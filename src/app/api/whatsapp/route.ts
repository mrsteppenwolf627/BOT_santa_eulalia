import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import type { WhatsAppIncomingMessage, OutgoingMessage } from '../../../types/index';
import { getOrCreateConversation, updateConversationState } from '../../../lib/supabase/conversations';
import { getConfig } from '../../../lib/supabase/config';
import { getVehicleData, saveVehicleData } from '../../../lib/supabase/vehicle-data';
import { getCustomerData, saveCustomerData } from '../../../lib/supabase/customer-data';
import { createEscalation } from '../../../lib/supabase/escalations';
import { stateMachine } from '../../../lib/state-machine/index';
import { normalizeText } from '../../../lib/whatsapp/normalize';
import { sendWhatsAppMessage } from '../../../lib/whatsapp/send';
import { extractEntities } from '../../../lib/openai/extract-entities';

// ─────────────────────────────────────────────────────────────
// GET — Meta webhook verification (handshake)
// ─────────────────────────────────────────────────────────────

export function GET(request: NextRequest): NextResponse {
  const { searchParams } = request.nextUrl;

  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (
    mode === 'subscribe' &&
    token === process.env['WHATSAPP_VERIFY_TOKEN'] &&
    challenge !== null
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

// ─────────────────────────────────────────────────────────────
// POST — Incoming messages from Meta
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Read raw body once — needed for HMAC verification AND JSON parsing.
  const rawBody = await request.text();

  // 1. Validate HMAC-SHA256 signature.
  const signature = request.headers.get('x-hub-signature-256') ?? '';
  const appSecret = process.env['WHATSAPP_APP_SECRET'] ?? '';

  if (!verifySignature(rawBody, signature, appSecret)) {
    console.warn('[webhook] Invalid HMAC signature — request rejected.');
    return new NextResponse('Forbidden', { status: 403 });
  }

  // 2. Parse body and extract the incoming message.
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    console.warn('[webhook] Failed to parse request body as JSON.');
    return new NextResponse('Bad Request', { status: 400 });
  }

  const incoming = extractIncomingMessage(parsedBody);

  // 3. Respond 200 to Meta immediately — Meta requires < 20 s.
  //    Processing happens asynchronously after this return.
  if (incoming !== null) {
    void processMessage(incoming);
  }

  return new NextResponse('OK', { status: 200 });
}

// ─────────────────────────────────────────────────────────────
// HMAC verification
// ─────────────────────────────────────────────────────────────

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;

  try {
    const expected =
      'sha256=' +
      crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');

    // timingSafeEqual requires equal-length buffers.
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Payload extraction
// ─────────────────────────────────────────────────────────────

function extractIncomingMessage(body: unknown): WhatsAppIncomingMessage | null {
  try {
    const entry  = (body as Record<string, unknown> | null)?.['entry'];
    const change = Array.isArray(entry) ? (entry[0] as Record<string, unknown>)?.['changes'] : undefined;
    const value  = Array.isArray(change) ? (change[0] as Record<string, unknown>)?.['value'] : undefined;
    const msgs   = (value as Record<string, unknown> | undefined)?.['messages'];

    if (!Array.isArray(msgs) || msgs.length === 0) return null;
    return msgs[0] as WhatsAppIncomingMessage;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Async message processing (runs after 200 is returned to Meta)
// ─────────────────────────────────────────────────────────────

async function processMessage(incoming: WhatsAppIncomingMessage): Promise<void> {
  const phone = incoming.from;

  try {
    // 1. Get or create conversation.
    const conversation = await getOrCreateConversation(phone);
    const currentState = conversation.state;

    // 2. Bot is silenced — do nothing.
    if (currentState === 'awaiting_human' || currentState === 'closed') {
      return;
    }

    // 3. Load config, vehicle data, customer data in parallel.
    const [config, vehicleData, customerData] = await Promise.all([
      getConfig(),
      getVehicleData(conversation.id),
      getCustomerData(conversation.id),
    ]);

    // 4. Extract text from the incoming message.
    const rawText = resolveMessageText(incoming);
    const normalizedText = normalizeText(rawText);

    // 5. Determine whether entity extraction is needed for this turn.
    //    The flag was stored in context by the previous state machine call.
    const requiresExtraction = conversation.context['requiresEntityExtraction'] === true;

    // 6. Extract entities (fail gracefully — continue with null).
    let extractedEntities = null;
    if (requiresExtraction) {
      try {
        extractedEntities = await extractEntities(normalizedText);
      } catch (err) {
        console.error('[webhook] extractEntities failed — continuing without entities:', err);
      }
    }

    // 7. Run the state machine.
    let output;
    try {
      output = stateMachine({
        currentState,
        conversation,
        vehicleData,
        customerData,
        incomingMessage: normalizedText,
        extractedEntities,
        config,
      });
    } catch (err) {
      console.error('[webhook] stateMachine threw — escalating to human:', err);
      await createEscalation(conversation.id, 'state_machine_error');
      await updateConversationState(conversation.id, 'awaiting_human', {
        ...conversation.context,
        requiresEntityExtraction: false,
      });
      await sendWhatsAppMessage(phone, [
        { type: 'text', text: 'Ha ocurrido un error inesperado. Un agente le atenderá en breve.' },
      ]);
      return;
    }

    const { nextState, messages, action, requiresEntityExtraction: nextRequires } = output;

    // 8. Build the list of outgoing messages (strings → TextMessages).
    const outgoing: OutgoingMessage[] = messages.map(
      (text): OutgoingMessage => ({ type: 'text', text }),
    );

    // 9. Execute the action returned by the state machine.
    if (action !== null) {
      switch (action.type) {
        case 'escalate_to_human':
          await createEscalation(conversation.id, action.reason);
          break;

        case 'update_vehicle_data':
          await saveVehicleData(conversation.id, action.data);
          break;

        case 'update_customer_data':
          await saveCustomerData(conversation.id, action.data);
          break;

        case 'send_pdf': {
          const pdfUrl =
            action.document === 'ventajas_tesla'
              ? config.pdf_ventajas_tesla_url
              : undefined;
          if (pdfUrl) {
            outgoing.push({ type: 'document', url: pdfUrl });
          } else {
            console.warn(`[webhook] send_pdf: no URL configured for document "${action.document}"`);
          }
          break;
        }

        case 'send_link':
          // The URL is already embedded in the text messages returned by the machine.
          break;

        case 'request_photos':
          // The message asking for photos is already in the text messages.
          break;
      }
    }

    // 10. Persist the new state and forward-looking extraction flag.
    await updateConversationState(conversation.id, nextState, {
      ...conversation.context,
      requiresEntityExtraction: nextRequires,
    });

    // 11. Send messages to the user (empty list is a no-op).
    if (outgoing.length > 0) {
      await sendWhatsAppMessage(phone, outgoing);
    }
  } catch (err) {
    // Top-level catch: log but never propagate — the 200 was already sent to Meta.
    console.error('[webhook] Unhandled error in processMessage:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Resolves the plain-text representation of any incoming message type. */
function resolveMessageText(msg: WhatsAppIncomingMessage): string {
  switch (msg.type) {
    case 'text':
      return msg.text?.body ?? '';

    case 'interactive': {
      const ia = msg.interactive;
      if (ia?.type === 'button_reply') return ia.button_reply?.id ?? '';
      if (ia?.type === 'list_reply')   return ia.list_reply?.id   ?? '';
      return '';
    }

    case 'button':
      // Legacy quick-reply button — treat the payload as text.
      return '';

    case 'image':
    case 'document':
    case 'video':
      // Media messages have no text; state handlers manage them by state alone.
      return '';
  }
}

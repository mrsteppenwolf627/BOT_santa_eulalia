import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase/client';
import { closeConversation, updateConversationState } from '../../../lib/supabase/conversations';

// ─────────────────────────────────────────────────────────────
// Chatwoot webhook payload types (minimal — only what we use)
// ─────────────────────────────────────────────────────────────

interface ChatwootConversationMeta {
  sender?: {
    phone_number?: string;
  };
}

interface ChatwootConversation {
  id: number;
  status?: string;
  meta?: ChatwootConversationMeta;
}

interface ChatwootMessage {
  id: number;
  content?: string;
  private?: boolean;
  message_type?: string; // 'incoming' | 'outgoing' | 'activity'
}

interface ChatwootWebhookPayload {
  event: string;
  account?: { id: number };
  conversation?: ChatwootConversation;
  message?: ChatwootMessage;
}

// ─────────────────────────────────────────────────────────────
// Token validation
// ─────────────────────────────────────────────────────────────

function isValidToken(request: NextRequest): boolean {
  const expected = process.env['CHATWOOT_WEBHOOK_TOKEN'];
  if (!expected) {
    console.warn('[chatwoot-webhook] CHATWOOT_WEBHOOK_TOKEN is not set — all requests rejected.');
    return false;
  }
  const received = request.headers.get('x-chatwoot-token') ?? '';
  return received === expected;
}

// ─────────────────────────────────────────────────────────────
// Supabase lookup by Chatwoot conversation id
// ─────────────────────────────────────────────────────────────

/**
 * Finds the Supabase conversation row whose `context.chatwoot_conversation_id`
 * matches the given Chatwoot conversation id.
 * The caller is responsible for storing the id there after escalation.
 */
async function findConversationByChatwootId(
  chatwootId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, state')
    .filter('context->>chatwoot_conversation_id', 'eq', chatwootId)
    .limit(1)
    .maybeSingle();

  if (error !== null) {
    console.error(
      `[chatwoot-webhook] Supabase lookup failed for chatwoot_id=${chatwootId}:`,
      error.message,
    );
    return null;
  }

  return data as { id: string } | null;
}

// ─────────────────────────────────────────────────────────────
// Event handlers
// ─────────────────────────────────────────────────────────────

async function handleConversationResolved(chatwootId: string): Promise<void> {
  const conv = await findConversationByChatwootId(chatwootId);
  if (conv === null) {
    console.warn(
      `[chatwoot-webhook] conversation_resolved: no Supabase conversation found for chatwoot_id=${chatwootId}`,
    );
    return;
  }

  try {
    await closeConversation(conv.id);
    console.info(
      `[chatwoot-webhook] conversation_resolved: closed Supabase conversation ${conv.id}`,
    );
  } catch (err) {
    console.error(
      `[chatwoot-webhook] conversation_resolved: failed to close conversation ${conv.id}:`,
      err,
    );
  }
}

async function handleConversationReopened(chatwootId: string): Promise<void> {
  const conv = await findConversationByChatwootId(chatwootId);
  if (conv === null) {
    console.warn(
      `[chatwoot-webhook] conversation_reopened: no Supabase conversation found for chatwoot_id=${chatwootId}`,
    );
    return;
  }

  try {
    await updateConversationState(conv.id, 'awaiting_human');
    console.info(
      `[chatwoot-webhook] conversation_reopened: set conversation ${conv.id} to awaiting_human`,
    );
  } catch (err) {
    console.error(
      `[chatwoot-webhook] conversation_reopened: failed to update conversation ${conv.id}:`,
      err,
    );
  }
}

// ─────────────────────────────────────────────────────────────
// POST — Chatwoot webhook entry point
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Validate webhook token.
  if (!isValidToken(request)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // 2. Parse body.
  let payload: ChatwootWebhookPayload;
  try {
    payload = (await request.json()) as ChatwootWebhookPayload;
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const { event, conversation, message } = payload;
  const chatwootId = conversation?.id?.toString() ?? '';

  // 3. Dispatch by event type.
  switch (event) {
    case 'conversation_resolved':
      // An agent marked the conversation as resolved → close the bot session.
      void handleConversationResolved(chatwootId);
      break;

    case 'conversation_reopened':
      // An agent reopened the conversation → keep bot silent, agent resumes.
      void handleConversationReopened(chatwootId);
      break;

    case 'message_created':
      // A new message was created. Only relevant when an agent sends a
      // public reply (private: false). The bot is already in 'awaiting_human'
      // so no state change is needed — we just log for observability.
      if (message !== undefined && !message.private) {
        console.info(
          `[chatwoot-webhook] message_created (public) in conversation ${chatwootId} — bot remains silent.`,
        );
      }
      break;

    default:
      // Unknown or irrelevant event — acknowledge and ignore.
      break;
  }

  // 4. Always respond 200 quickly — Chatwoot retries on non-2xx.
  return new NextResponse('OK', { status: 200 });
}

import { NextRequest, NextResponse } from 'next/server';
import type { TwilioVoiceWebhook } from '../../../../types/twilio';
import { validateTwilioSignature } from '../../../../lib/twilio/validate';
import { respondWithWhatsAppRedirect, respondWithHumanTransfer } from '../../../../lib/twilio/twiml';
import { sendWhatsAppFromCall } from '../../../../lib/twilio/send-whatsapp';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function env(name: string): string {
  return process.env[name] ?? '';
}

/**
 * Wraps a TwiML string in a NextResponse with the correct Content-Type.
 * Twilio requires Content-Type: text/xml; any other type may cause issues.
 */
function twimlResponse(xml: string): NextResponse {
  return new NextResponse(xml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

/**
 * Returns true when the `From` value Twilio provides cannot be used to
 * deliver a WhatsApp message (hidden, unknown, or absent).
 */
function isHiddenNumber(from: string | undefined): boolean {
  if (!from) return true;
  const trimmed = from.trim();
  return trimmed === '' || trimmed === 'anonymous' || trimmed === 'Unknown';
}

// ─────────────────────────────────────────────────────────────
// POST — Twilio Voice webhook
// ─────────────────────────────────────────────────────────────
//
// CRITICAL: this handler ALWAYS returns a valid TwiML response.
// Twilio has no way to handle a 4xx/5xx from the webhook — the caller
// would hear silence and the call would drop. Every code path ends with
// twimlResponse(), even in error cases.

export async function POST(request: NextRequest): Promise<NextResponse> {
  const humanPhone     = env('TALLER_HUMAN_PHONE');
  const authToken      = env('TWILIO_AUTH_TOKEN');
  const appUrl         = env('NEXT_PUBLIC_APP_URL').replace(/\/$/, '');
  const tallerWhatsApp = env('TALLER_WHATSAPP_NUMBER');

  // Outer try/catch is the last-resort safety net (Case 3).
  try {
    // 1. Read raw body — Twilio sends x-www-form-urlencoded.
    const rawBody = await request.text();

    // 2. Parse form parameters into a plain object for signature validation.
    const formData = new URLSearchParams(rawBody);
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value;
    });

    // 3. Validate X-Twilio-Signature.
    //    On failure, transfer to human rather than returning an HTTP error,
    //    so a legitimate call that fails validation (e.g. URL mismatch) is
    //    still handled gracefully. The warn log will surface the issue.
    const signature  = request.headers.get('x-twilio-signature') ?? '';
    const webhookUrl = `${appUrl}/api/twilio/voice`;

    if (!validateTwilioSignature(webhookUrl, params, signature, authToken)) {
      console.warn(
        '[twilio-webhook] Invalid X-Twilio-Signature — transferring to human as fallback. ' +
          `Checked URL: ${webhookUrl}`,
      );
      return twimlResponse(respondWithHumanTransfer(humanPhone, 'error'));
    }

    // 4. Extract caller number.
    const payload = params as unknown as Partial<TwilioVoiceWebhook>;
    const from    = payload.From;
    const callSid = payload.CallSid ?? 'unknown';

    // 5. Case 2 — hidden or unidentifiable number.
    if (isHiddenNumber(from)) {
      console.info(
        `[twilio-webhook] CallSid=${callSid} — hidden number, transferring to human.`,
      );
      return twimlResponse(respondWithHumanTransfer(humanPhone, 'hidden_number'));
    }

    // 6. Case 1 — known number.
    //    Fire the WhatsApp message asynchronously: we must return the TwiML
    //    immediately so Twilio can play the message and hang up without waiting
    //    for the WhatsApp API round-trip.
    console.info(
      `[twilio-webhook] CallSid=${callSid} — identified caller ${from}, sending WhatsApp.`,
    );

    void sendWhatsAppFromCall(from as string).catch((err) => {
      console.error(
        `[twilio-webhook] sendWhatsAppFromCall failed for CallSid=${callSid}:`,
        err,
      );
    });

    return twimlResponse(respondWithWhatsAppRedirect(tallerWhatsApp));
  } catch (err) {
    // Case 3 — unexpected error: always transfer to human, never let the
    // caller hear silence or receive an HTTP error.
    console.error('[twilio-webhook] Unexpected error in voice webhook:', err);
    return twimlResponse(respondWithHumanTransfer(humanPhone, 'error'));
  }
}

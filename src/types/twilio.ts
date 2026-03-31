// ============================================================
// TWILIO VOICE WEBHOOK — Payload types
// ============================================================
// Twilio sends POST requests with Content-Type: application/x-www-form-urlencoded.
// Only the fields the bot actually uses are typed here.
// ============================================================

/**
 * Payload Twilio sends to the voice webhook when a call arrives.
 * `From` is E.164 with '+' prefix when the caller's number is visible
 * (e.g. '+34612345678'), or the string 'anonymous' / empty when hidden.
 */
export interface TwilioVoiceWebhook {
  /** Unique identifier for this call. */
  CallSid: string;

  /**
   * Caller's phone number in E.164 format (e.g. '+34612345678').
   * May be 'anonymous', empty, or undefined if the number is hidden.
   */
  From: string;

  /** The Twilio number that received the call (E.164). */
  To: string;

  CallStatus:
    | 'queued'
    | 'ringing'
    | 'in-progress'
    | 'completed'
    | 'busy'
    | 'failed'
    | 'no-answer';

  Direction: 'inbound' | 'outbound-api' | 'outbound-dial';

  /** Twilio account SID (optional — present in all real requests). */
  AccountSid?: string;
}

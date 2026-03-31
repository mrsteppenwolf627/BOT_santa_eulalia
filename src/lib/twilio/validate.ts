import crypto from 'node:crypto';

// ============================================================
// TWILIO SIGNATURE VALIDATION
// ============================================================
// Twilio signs every webhook request with HMAC-SHA1 so we can
// verify it is genuine and has not been tampered with.
//
// Algorithm: https://www.twilio.com/docs/usage/webhooks/webhooks-security
//   1. Start with the full URL of the webhook endpoint.
//   2. Sort POST parameters alphabetically by key.
//   3. Append each key immediately followed by its value (no separator) to the URL.
//   4. Compute HMAC-SHA1 of that string using TWILIO_AUTH_TOKEN as the key.
//   5. Base64-encode the result and compare with X-Twilio-Signature (timing-safe).
// ============================================================

/**
 * Validates the X-Twilio-Signature header of an incoming webhook request.
 *
 * @param url           - Exact URL Twilio called, including scheme and path.
 *                        Must match what Twilio has configured in the console.
 * @param params        - All POST parameters parsed from the request body.
 * @param twilioSignature - Value of the X-Twilio-Signature request header.
 * @param authToken     - The Twilio Auth Token (TWILIO_AUTH_TOKEN env var).
 *
 * @returns `true` if the signature is valid; `false` otherwise.
 *
 * Pure function — no env reads, no side effects; straightforward to unit-test.
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  twilioSignature: string,
  authToken: string,
): boolean {
  if (!twilioSignature || !authToken) return false;

  try {
    // Build the string to sign: URL + sorted param key-value pairs concatenated.
    const sortedKeys = Object.keys(params).sort();
    const paramString = sortedKeys.reduce(
      (acc, key) => acc + key + (params[key] ?? ''),
      '',
    );
    const stringToSign = url + paramString;

    // Compute expected signature.
    const expected = crypto
      .createHmac('sha1', authToken)
      .update(stringToSign, 'utf8')
      .digest('base64');

    // Timing-safe comparison to prevent timing attacks.
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(twilioSignature, 'utf8');
    if (a.length !== b.length) return false;

    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

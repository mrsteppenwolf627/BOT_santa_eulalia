// ============================================================
// TWIML BUILDERS — Pure functions, no side effects
// ============================================================
// Every function returns a valid TwiML XML string.
// The webhook handler always returns one of these — never a plain HTTP error,
// because Twilio does not know what to do with a 500: the caller gets silence.
// ============================================================

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

/** Polly Conchita: natural-sounding Castilian Spanish female voice. */
const SAY_ATTRS = 'language="es-ES" voice="Polly.Conchita"';

/** Wraps inner TwiML verbs in a <Response> envelope with the XML declaration. */
function response(...verbs: string[]): string {
  return [XML_HEADER, '<Response>', ...verbs.map((v) => `  ${v}`), '</Response>'].join('\n');
}

// ------------------------------------------------------------
// Case 1 — Known caller: send WhatsApp and hang up
// ------------------------------------------------------------

/**
 * Generates TwiML for a caller whose number was identified.
 * Plays a message informing them they will receive a WhatsApp, then hangs up.
 *
 * @param tallerWhatsAppNumber - The workshop's WhatsApp Business number (E.164).
 *   Kept as a parameter for future use (e.g. mentioning the number in the message).
 */
export function respondWithWhatsAppRedirect(_tallerWhatsAppNumber: string): string {
  return response(
    `<Say ${SAY_ATTRS}>` +
      'Hola, gracias por llamar a Talleres Santa Eulalia. ' +
      'Le enviamos ahora mismo un mensaje de WhatsApp para gestionar su consulta de forma rápida y cómoda. ' +
      'Compruebe su teléfono en unos instantes. ¡Hasta pronto!' +
      '</Say>',
    '<Hangup/>',
  );
}

// ------------------------------------------------------------
// Cases 2 & 3 — Hidden number or unexpected error: transfer to human
// ------------------------------------------------------------

/**
 * Generates TwiML that plays a message and transfers the call to a human agent.
 *
 * @param humanPhone - Destination phone number in E.164 format (e.g. '+34938000000').
 * @param reason
 *   - 'hidden_number': caller's number could not be identified (Case 2).
 *   - 'error': an unexpected error occurred and the bot cannot proceed (Case 3).
 */
export function respondWithHumanTransfer(
  humanPhone: string,
  reason: 'hidden_number' | 'error',
): string {
  const message =
    reason === 'hidden_number'
      ? 'Hola, gracias por llamar a Talleres Santa Eulalia. ' +
        'No hemos podido identificar su número de teléfono, por lo que no podemos enviarle un mensaje de WhatsApp. ' +
        'También puede escribirnos directamente por WhatsApp en cualquier momento. ' +
        'Le transferimos ahora con nuestro equipo para atenderle personalmente. Un momento, por favor.'
      : 'Hola, gracias por llamar a Talleres Santa Eulalia. ' +
        'En este momento estamos teniendo una dificultad técnica. ' +
        'Le transferimos con nuestro equipo para atenderle personalmente. Disculpe las molestias.';

  return response(
    `<Say ${SAY_ATTRS}>${message}</Say>`,
    `<Dial>${humanPhone}</Dial>`,
  );
}

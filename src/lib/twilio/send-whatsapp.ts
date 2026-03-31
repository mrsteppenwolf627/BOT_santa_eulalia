import { sendWhatsAppMessage } from '../whatsapp/send';

/**
 * Sends the opening WhatsApp message to a caller identified during a Twilio voice call.
 * The message is phrased to acknowledge the call and invite the client to continue
 * by chat, which triggers the bot's normal 'init' flow on their next reply.
 *
 * Twilio sends `From` as E.164 with '+' (e.g. '+34612345678').
 * WhatsApp Cloud API also expects E.164 with '+', so the format matches directly.
 * The normalisation below adds '+' as a safety net in case it is missing.
 */
export async function sendWhatsAppFromCall(toPhone: string): Promise<void> {
  const normalised = toPhone.startsWith('+') ? toPhone : `+${toPhone}`;

  await sendWhatsAppMessage(normalised, [
    {
      type: 'text',
      text:
        'Hola, hemos recibido su llamada a Talleres Santa Eulalia. ' +
        'Estamos aquí para ayudarle. ¿En qué podemos atenderle?',
    },
  ]);
}

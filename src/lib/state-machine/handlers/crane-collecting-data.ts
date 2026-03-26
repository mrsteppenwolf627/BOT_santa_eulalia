import type { CustomerData } from '../../../types/index';
import type { StateMachineInput, StateMachineOutput } from '../types';

export function handleCraneCollectingData(input: StateMachineInput): StateMachineOutput {
  const e = input.extractedEntities;

  const name = e?.customer_name ?? input.customerData?.name;
  // DNI and email are not yet in ExtractedEntities; check incomingMessage heuristically
  // until those fields are added to the extraction schema.
  const hasDni = /\b[0-9]{8}[a-zA-Z]\b/.test(input.incomingMessage);
  const emailMatch = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.exec(input.incomingMessage);
  const email = emailMatch?.[0] ?? input.customerData?.email;

  const missing: string[] = [];
  if (!name) missing.push('nombre completo');
  if (!hasDni && !input.customerData?.name) missing.push('DNI');
  if (!email) missing.push('email');

  if (missing.length > 0) {
    const isFirstAsk = !input.customerData?.name && !name;
    return {
      nextState: 'crane_collecting_data',
      messages: isFirstAsk
        ? [
            'Perfecto, recepcion ha confirmado disponibilidad. Para registrar la cita necesito los siguientes datos:\n\n' +
              '- Nombre completo\n' +
              '- DNI\n' +
              '- Email de contacto',
          ]
        : [
            `Gracias. Solo me falta${missing.length === 1 ? '' : 'n'}: ${missing.join(', ')}. Por favor, indiqueme ese dato.`,
          ],
      action: null,
      requiresEntityExtraction: true,
    };
  }

  const customerUpdate: Partial<CustomerData> = {
    ...(name !== undefined && { name }),
    ...(email !== undefined && { email }),
  };

  return {
    nextState: 'closed',
    messages: [
      'Perfecto, su cita ha quedado registrada. Nos pondremos en contacto con usted para confirmar la hora de llegada de la grua.',
      'Muchas gracias por contactar con nosotros. Que tenga un buen dia.',
    ],
    action: { type: 'update_customer_data', data: customerUpdate },
    requiresEntityExtraction: false,
  };
}

import type { CustomerData } from '../../../types/index';
import type { StateMachineInput, StateMachineOutput } from '../types';
import { parseNonCollabIntent } from '../utils';

export function handleNewRepairNonCollabNoPeritar(input: StateMachineInput): StateMachineOutput {
  const intent = parseNonCollabIntent(input.incomingMessage);

  if (intent === 'come_in') {
    return {
      nextState: 'awaiting_human',
      messages: [
        'Perfecto. Un asesor se pondra en contacto con usted para concretar la fecha y hora de la peritacion presencial en nuestro taller.',
      ],
      action: { type: 'escalate_to_human', reason: 'non_collab_accepted' },
      requiresEntityExtraction: false,
    };
  }

  if (intent === 'price_request') {
    const e = input.extractedEntities;
    const name = e?.customer_name ?? input.customerData?.name;
    const emailMatch = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.exec(input.incomingMessage);
    const email = emailMatch?.[0] ?? input.customerData?.email;
    const hasDni = /\b[0-9]{8}[a-zA-Z]\b/.test(input.incomingMessage);

    const missing: string[] = [];
    if (!name) missing.push('nombre completo');
    if (!hasDni) missing.push('DNI');
    if (!email) missing.push('email');

    if (missing.length > 0) {
      return {
        nextState: 'new_repair_non_collab_no_peritar',
        messages: [
          'Para gestionar la valoracion sin desplazamiento necesito los siguientes datos:\n\n' +
            '- Nombre completo\n- DNI\n- Email de contacto\n\n' +
            'Ademas, le pedire ficha tecnica del vehiculo y fotos de los danos.',
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
      nextState: 'awaiting_human',
      messages: [
        'Hemos recibido sus datos. Un asesor revisara la documentacion y se pondra en contacto con usted con la valoracion.',
      ],
      action: { type: 'update_customer_data', data: customerUpdate },
      requiresEntityExtraction: false,
    };
  }

  // Intent not yet determined — keep state and ask
  return {
    nextState: 'new_repair_non_collab_no_peritar',
    messages: [
      '¿Como prefiere proceder?\n\n' +
        '- Si desea traer el vehiculo al taller para peritarlo, escriba "vengo".\n' +
        '- Si prefiere una valoracion sin desplazarse (por fotos y ficha tecnica), escriba "precio".',
    ],
    action: null,
    requiresEntityExtraction: false,
  };
}

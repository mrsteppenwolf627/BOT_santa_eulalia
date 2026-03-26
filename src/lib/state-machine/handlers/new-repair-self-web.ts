import type { StateMachineInput, StateMachineOutput } from '../types';
import { isRejection } from '../utils';

export function handleNewRepairSelfWeb(input: StateMachineInput): StateMachineOutput {
  const webUrl = input.config.presupuesto_web_url;

  // First entry into this state: offer the web form
  // Detect if the client is already responding to our offer (rejection = manual path)
  const clientIsResponding = input.conversation.state === 'new_repair_self_web';

  if (clientIsResponding && isRejection(input.incomingMessage)) {
    return {
      nextState: 'new_repair_self_manual',
      messages: [
        'Sin problema. Para preparar su presupuesto de forma manual, le pido que nos envie:\n\n' +
          '- Ficha tecnica del vehiculo\n' +
          '- Fotos de los danos (todas las zonas afectadas)\n\n' +
          'Un asesor revisara la documentacion y se pondra en contacto con usted.',
      ],
      action: { type: 'request_photos' },
      requiresEntityExtraction: false,
    };
  }

  if (clientIsResponding) {
    // Client accepted the web form
    return {
      nextState: 'closed',
      messages: [
        'Estupendo. Si tiene cualquier duda al rellenar el formulario, no dude en escribirnos. Que tenga un buen dia.',
      ],
      action: null,
      requiresEntityExtraction: false,
    };
  }

  // First time entering this state
  return {
    nextState: 'new_repair_self_web',
    messages: [
      `Puede solicitar su presupuesto online a traves de nuestro formulario: ${webUrl}`,
      'Desde el formulario podra adjuntar fotos y describir los danos. Suele ser la via mas rapida.\n\n' +
        'Si prefiere que un asesor le atienda manualmente, escriba "no" y le explicamos como proceder.',
    ],
    action: { type: 'send_link', url: webUrl },
    requiresEntityExtraction: false,
  };
}

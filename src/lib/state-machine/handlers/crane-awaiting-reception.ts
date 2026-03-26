import type { StateMachineInput, StateMachineOutput } from '../types';

export function handleCraneAwaitingReception(input: StateMachineInput): StateMachineOutput {
  void input;
  return {
    nextState: 'awaiting_human',
    messages: [
      'Gracias por la informacion. Estamos consultando con nuestro equipo de recepcion la disponibilidad para recibir su vehiculo.',
      'En cuanto tengamos confirmacion le avisaremos por este mismo mensaje. Por favor, espere nuestra respuesta.',
    ],
    action: { type: 'escalate_to_human', reason: 'crane_incoming' },
    requiresEntityExtraction: false,
  };
}

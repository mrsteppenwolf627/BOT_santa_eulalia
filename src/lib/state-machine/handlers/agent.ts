import type { StateMachineInput, StateMachineOutput } from '../types';

export function handleAgent(input: StateMachineInput): StateMachineOutput {
  void input; // no input data needed beyond triggering the state
  return {
    nextState: 'awaiting_human',
    messages: [
      'Entendido. Para que podamos asignarle el asesor correspondiente, necesito los siguientes datos:\n\n' +
        '- Nombre de la compania aseguradora\n' +
        '- Numero de expediente o siniestro\n\n' +
        'En breve un miembro de nuestro equipo se pondra en contacto con usted.',
    ],
    action: { type: 'escalate_to_human', reason: 'agent_request' },
    requiresEntityExtraction: false,
  };
}

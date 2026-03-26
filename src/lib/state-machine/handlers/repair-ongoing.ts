import type { StateMachineInput, StateMachineOutput } from '../types';

export function handleRepairOngoing(input: StateMachineInput): StateMachineOutput {
  void input;
  return {
    nextState: 'awaiting_human',
    messages: [
      'Enseguida le conecto con el asesor que lleva su reparacion para que pueda informarle del estado actual.',
      'Por favor, espere un momento.',
    ],
    action: { type: 'escalate_to_human', reason: 'repair_ongoing' },
    requiresEntityExtraction: false,
  };
}

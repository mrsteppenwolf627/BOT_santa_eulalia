import type { StateMachineInput, StateMachineOutput } from '../types';

export function handleNewRepairSelfManual(input: StateMachineInput): StateMachineOutput {
  void input;
  return {
    nextState: 'awaiting_human',
    messages: [
      'Hemos recibido su documentacion. Un asesor la revisara y se pondra en contacto con usted para prepararle el presupuesto.',
      'Gracias por su paciencia.',
    ],
    action: { type: 'escalate_to_human', reason: 'self_repair_manual_quote' },
    requiresEntityExtraction: false,
  };
}

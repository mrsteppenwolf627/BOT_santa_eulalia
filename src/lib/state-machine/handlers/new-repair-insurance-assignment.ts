import type { StateMachineInput, StateMachineOutput } from '../types';

export function handleNewRepairInsuranceAssignment(input: StateMachineInput): StateMachineOutput {
  void input;
  return {
    nextState: 'awaiting_human',
    messages: [
      'Para que podamos gestionar su reparacion, necesita asignarnos como taller en la plataforma online de su compania aseguradora.',
      'Una vez realizada la asignacion, escribanos aqui y verificaremos la recepcion para darle cita cuanto antes.',
      'Si tiene alguna duda con el proceso de asignacion, no dude en consultarnos.',
    ],
    action: { type: 'escalate_to_human', reason: 'insurance_assignment_pending' },
    requiresEntityExtraction: false,
  };
}

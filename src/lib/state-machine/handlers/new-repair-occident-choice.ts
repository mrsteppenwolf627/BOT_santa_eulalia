import type { StateMachineInput, StateMachineOutput } from '../types';
import { parseOccidentOption } from '../utils';

export function handleNewRepairOccidentChoice(input: StateMachineInput): StateMachineOutput {
  const option = parseOccidentOption(input.incomingMessage);

  if (option === null) {
    return {
      nextState: 'new_repair_occident_choice',
      messages: [
        'Por favor, indiqueme su preferencia:\n\n' +
          '1. Peritacion en su domicilio (el perito acude el dia y hora que usted elija)\n' +
          '2. Traer el vehiculo al taller (dejar toda la manana)',
      ],
      action: null,
      requiresEntityExtraction: false,
    };
  }

  const domicilio = option === 1;

  return {
    nextState: 'awaiting_human',
    messages: [
      domicilio
        ? 'Perfecto. Un asesor se pondra en contacto con usted para concretar el dia y la hora en que el perito acudira a su domicilio.'
        : 'Perfecto. Cuando traiga el vehiculo, le pedimos que deje toda la manana disponible para la peritacion. Un asesor le confirmara la fecha.',
    ],
    action: { type: 'escalate_to_human', reason: 'insurance_occident' },
    requiresEntityExtraction: false,
  };
}

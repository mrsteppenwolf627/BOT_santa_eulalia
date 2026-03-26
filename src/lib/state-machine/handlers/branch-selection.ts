import type { StateMachineInput, StateMachineOutput } from '../types';
import { parseBranchOption, MENU } from '../utils';

export function handleBranchSelection(input: StateMachineInput): StateMachineOutput {
  const option = parseBranchOption(input.incomingMessage);

  switch (option) {
    case 1:
      return {
        nextState: 'repair_ongoing',
        messages: [],
        action: null,
        requiresEntityExtraction: false,
      };

    case 2:
      return {
        nextState: 'new_repair_payment_type',
        messages: [],
        action: null,
        requiresEntityExtraction: false,
      };

    case 3:
      return {
        nextState: 'crane_photos',
        messages: [],
        action: null,
        requiresEntityExtraction: false,
      };

    case 4:
      return {
        nextState: 'agent',
        messages: [],
        action: null,
        requiresEntityExtraction: false,
      };

    case 5:
      return {
        nextState: 'admin',
        messages: [],
        action: null,
        requiresEntityExtraction: false,
      };

    default:
      return {
        nextState: 'branch_selection',
        messages: [
          'No he podido identificar su eleccion. Por favor, responda con el numero de la opcion deseada:\n\n' +
            MENU,
        ],
        action: null,
        requiresEntityExtraction: false,
      };
  }
}

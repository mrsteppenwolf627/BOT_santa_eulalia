import type { StateMachineInput, StateMachineOutput } from '../types';
import { parsePaymentOption } from '../utils';

export function handleNewRepairPaymentType(input: StateMachineInput): StateMachineOutput {
  const option = parsePaymentOption(input.incomingMessage);

  if (option === 1) {
    return {
      nextState: 'new_repair_self_web',
      messages: [],
      action: null,
      requiresEntityExtraction: false,
    };
  }

  if (option === 2) {
    return {
      nextState: 'new_repair_insurance_company',
      messages: [],
      action: null,
      requiresEntityExtraction: false,
    };
  }

  return {
    nextState: 'new_repair_payment_type',
    messages: [
      'Para gestionar su reparacion, necesito saber quien se hara cargo del coste:\n\n' +
        '1. La pago yo directamente (particular)\n' +
        '2. Lo gestiona mi compania aseguradora\n\n' +
        'Responda con el numero de su eleccion.',
    ],
    action: null,
    requiresEntityExtraction: false,
  };
}

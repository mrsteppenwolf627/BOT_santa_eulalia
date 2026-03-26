import type { StateMachineInput, StateMachineOutput } from '../types';

export function handleCranePhotos(input: StateMachineInput): StateMachineOutput {
  void input;
  return {
    nextState: 'crane_awaiting_reception',
    messages: [
      'Entendido, vamos a gestionar la entrada de su vehiculo mediante grua.',
      'Para agilizar el proceso, le pido que me envie:\n\n' +
        '1. Fotos de los danos del vehiculo (todas las caras afectadas)\n' +
        '2. Indiqueme: ¿han saltado los airbags? (Si / No)',
    ],
    action: { type: 'request_photos' },
    requiresEntityExtraction: false,
  };
}

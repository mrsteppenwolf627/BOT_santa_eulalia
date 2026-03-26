import type { StateMachineInput, StateMachineOutput } from '../types';

export function handleAdmin(input: StateMachineInput): StateMachineOutput {
  void input;
  return {
    nextState: 'closed',
    messages: [
      'Para consultas administrativas, le rogamos que se ponga en contacto con nuestro departamento de administracion directamente:\n\n' +
        'administracion@talleressantaeulalia.com\n\n' +
        'Le atenderemos lo antes posible. Que tenga un buen dia.',
    ],
    action: null,
    requiresEntityExtraction: false,
  };
}

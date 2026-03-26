import type { StateMachineInput, StateMachineOutput } from '../types';

export function handleInit(input: StateMachineInput): StateMachineOutput {
  return {
    nextState: 'collecting_vehicle',
    messages: [
      `Bienvenido/a a ${input.config.name}. Estamos aqui para ayudarle con la gestion de su vehiculo.`,
      'Para comenzar, necesito los siguientes datos de su vehiculo:\n\n' +
        '- Marca (ej.: Seat, Volkswagen, BMW)\n' +
        '- Modelo (ej.: Leon, Golf, Serie 3)\n' +
        '- Matricula (ej.: 1234 ABC)\n\n' +
        'Cuando este listo, escriba todos los datos en un mismo mensaje.',
    ],
    action: null,
    requiresEntityExtraction: false,
  };
}

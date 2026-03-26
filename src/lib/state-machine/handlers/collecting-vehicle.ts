import type { VehicleData } from '../../../types/index';
import type { StateMachineInput, StateMachineOutput } from '../types';
import { MENU } from '../utils';

export function handleCollectingVehicle(input: StateMachineInput): StateMachineOutput {
  const e = input.extractedEntities;

  const brand = e?.vehicle_brand ?? input.vehicleData?.brand;
  const model = e?.vehicle_model ?? input.vehicleData?.model;
  const plate = e?.license_plate ?? input.vehicleData?.licensePlate;

  const missing: string[] = [];
  if (!brand) missing.push('marca');
  if (!model) missing.push('modelo');
  if (!plate) missing.push('matricula');

  if (missing.length > 0) {
    return {
      nextState: 'collecting_vehicle',
      messages: [
        `Gracias. Aun me falta${missing.length === 1 ? '' : 'n'} el/la ${missing.join(', ')} de su vehiculo. ` +
          'Por favor, indiqueme ese dato para continuar.',
      ],
      action: null,
      requiresEntityExtraction: true,
    };
  }

  const vehicleUpdate: Partial<VehicleData> = {
    brand,
    model,
    licensePlate: plate,
    ...(e?.vehicle_year !== undefined && { year: e.vehicle_year }),
    ...(e?.is_tesla !== undefined && { isTesla: e.is_tesla }),
  };

  return {
    nextState: 'branch_selection',
    messages: [
      `Perfecto, he registrado su vehiculo: *${brand} ${model}* (${plate}).`,
      '¿En que podemos ayudarle hoy? Por favor, elija una opcion:\n\n' + MENU,
    ],
    action: { type: 'update_vehicle_data', data: vehicleUpdate },
    requiresEntityExtraction: true,
  };
}

import type { BotState } from '../../constants/bot-states';
import type { StateMachineInput, StateMachineOutput, StateHandler } from './types';
import { isCourtesyCarRequest, isTeslaDoubleVisitConcern } from './utils';

import { handleInit } from './handlers/init';
import { handleCollectingVehicle } from './handlers/collecting-vehicle';
import { handleBranchSelection } from './handlers/branch-selection';
import { handleAgent } from './handlers/agent';
import { handleAdmin } from './handlers/admin';
import { handleCranePhotos } from './handlers/crane-photos';
import { handleCraneAwaitingReception } from './handlers/crane-awaiting-reception';
import { handleCraneCollectingData } from './handlers/crane-collecting-data';
import { handleRepairOngoing } from './handlers/repair-ongoing';
import { handleNewRepairPaymentType } from './handlers/new-repair-payment-type';
import { handleNewRepairSelfWeb } from './handlers/new-repair-self-web';
import { handleNewRepairSelfManual } from './handlers/new-repair-self-manual';
import { handleNewRepairInsuranceCompany } from './handlers/new-repair-insurance-company';
import { handleNewRepairInsuranceAssignment } from './handlers/new-repair-insurance-assignment';
import { handleNewRepairOccidentChoice } from './handlers/new-repair-occident-choice';
import { handleNewRepairNonCollabNoPeritar } from './handlers/new-repair-non-collab-no-peritar';
import { handleAwaitingHuman } from './handlers/awaiting-human';
import { handleClosed } from './handlers/closed';

// ------------------------------------------------------------
// Handler registry
// ------------------------------------------------------------

const HANDLERS: Record<BotState, StateHandler> = {
  init:                                handleInit,
  collecting_vehicle:                  handleCollectingVehicle,
  branch_selection:                    handleBranchSelection,
  agent:                               handleAgent,
  admin:                               handleAdmin,
  crane_photos:                        handleCranePhotos,
  crane_awaiting_reception:            handleCraneAwaitingReception,
  crane_collecting_data:               handleCraneCollectingData,
  repair_ongoing:                      handleRepairOngoing,
  new_repair_payment_type:             handleNewRepairPaymentType,
  new_repair_self_web:                 handleNewRepairSelfWeb,
  new_repair_self_manual:              handleNewRepairSelfManual,
  new_repair_insurance_company:        handleNewRepairInsuranceCompany,
  new_repair_insurance_assignment:     handleNewRepairInsuranceAssignment,
  new_repair_occident_choice:          handleNewRepairOccidentChoice,
  new_repair_non_collab_no_peritar:    handleNewRepairNonCollabNoPeritar,
  awaiting_human:                      handleAwaitingHuman,
  closed:                              handleClosed,
};

// ------------------------------------------------------------
// Cross-cutting rules
// These are checked before dispatching to any state handler.
// They return a StateMachineOutput or null (meaning: proceed normally).
// ------------------------------------------------------------

function checkCourtesyCar(input: StateMachineInput): StateMachineOutput | null {
  if (!isCourtesyCarRequest(input.incomingMessage)) return null;

  const paymentType = input.conversation.payment_type;
  const hasCars = input.config.hay_coches_cortesia;

  if (paymentType === 'self_pay') {
    return {
      nextState: input.currentState,
      messages: [
        'Para reparaciones gestionadas directamente por el cliente no disponemos de vehiculo de cortesia.',
      ],
      action: null,
      requiresEntityExtraction: false,
    };
  }

  if (paymentType === 'insurance') {
    return {
      nextState: input.currentState,
      messages: [
        hasCars
          ? 'La disponibilidad de vehiculo de cortesia depende del estado del parque en el momento de la peritacion. Se lo confirmaremos una vez realizada.'
          : 'Actualmente no disponemos de vehiculo de cortesia. Le pedimos disculpas por las molestias.',
      ],
      action: null,
      requiresEntityExtraction: false,
    };
  }

  // payment_type not yet determined
  return {
    nextState: input.currentState,
    messages: [
      'La disponibilidad de vehiculo de cortesia se confirma una vez realizada la peritacion y conocido el tipo de gestion de la reparacion.',
    ],
    action: null,
    requiresEntityExtraction: false,
  };
}

const NEW_REPAIR_STATES = new Set<BotState>([
  'new_repair_payment_type',
  'new_repair_self_web',
  'new_repair_self_manual',
  'new_repair_insurance_company',
  'new_repair_insurance_assignment',
  'new_repair_occident_choice',
  'new_repair_non_collab_no_peritar',
]);

function checkTeslaDoubleVisit(input: StateMachineInput): StateMachineOutput | null {
  if (!NEW_REPAIR_STATES.has(input.currentState)) return null;
  if (input.vehicleData?.isTesla !== true) return null;
  if (!isTeslaDoubleVisitConcern(input.incomingMessage)) return null;

  const teslaUrl = input.config.cita_tesla_url;

  return {
    nextState: 'awaiting_human',
    messages: [
      'Al tratarse de un Tesla, nuestro tecnico especializado puede coordinar la peritacion y la reparacion en una sola cita, ' +
        'para que no tenga que venir dos veces.',
      teslaUrl
        ? `Solicite su cita aqui: ${teslaUrl}`
        : 'Un asesor le facilitara el enlace para solicitar la cita en breve.',
    ],
    action: teslaUrl
      ? { type: 'send_link', url: teslaUrl }
      : { type: 'escalate_to_human', reason: 'insurance_tesla' },
    requiresEntityExtraction: false,
  };
}

// ------------------------------------------------------------
// Main entry point — pure function, no side effects
// ------------------------------------------------------------

export function stateMachine(input: StateMachineInput): StateMachineOutput {
  // 1. Cross-cutting rules (evaluated before state dispatch)
  const courtesyCar = checkCourtesyCar(input);
  if (courtesyCar !== null) return courtesyCar;

  const tesla = checkTeslaDoubleVisit(input);
  if (tesla !== null) return tesla;

  // 2. State dispatch
  const handler = HANDLERS[input.currentState];
  if (handler === undefined) {
    throw new Error(
      `stateMachine: no handler registered for state "${input.currentState}". ` +
        'Add a handler to HANDLERS in src/lib/state-machine/index.ts.',
    );
  }

  return handler(input);
}

export type { StateMachineInput, StateMachineOutput, MachineAction } from './types';

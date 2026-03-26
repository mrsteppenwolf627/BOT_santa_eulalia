import type { BotState } from '../../constants/bot-states';
import type {
  Conversation,
  VehicleData,
  CustomerData,
  ExtractedEntities,
  TallerConfig,
} from '../../types/index';

export interface StateMachineInput {
  currentState: BotState;
  conversation: Conversation;
  vehicleData: VehicleData | null;
  customerData: CustomerData | null;
  /** Text already normalised: lowercase, no accents, no double spaces. */
  incomingMessage: string;
  /** Null when OpenAI was not invoked for this turn. */
  extractedEntities: ExtractedEntities | null;
  config: TallerConfig;
}

export interface StateMachineOutput {
  nextState: BotState;
  /** Ordered list of messages to send to the client. */
  messages: string[];
  /** Primary side-effect the webhook must carry out after this turn. */
  action: MachineAction | null;
  /** When true the webhook must call OpenAI before invoking stateMachine again. */
  requiresEntityExtraction: boolean;
}

export type MachineAction =
  | { type: 'escalate_to_human'; reason: string }
  | { type: 'send_link'; url: string }
  | { type: 'request_photos' }
  | { type: 'send_pdf'; document: 'ventajas_tesla' }
  | { type: 'update_vehicle_data'; data: Partial<VehicleData> }
  | { type: 'update_customer_data'; data: Partial<CustomerData> };

/** All state handlers share this signature. */
export type StateHandler = (input: StateMachineInput) => StateMachineOutput;

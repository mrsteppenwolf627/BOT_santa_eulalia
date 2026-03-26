// ============================================================
// DOMAIN TYPES — Talleres Santa Eulalia Bot
// ============================================================
// Rules:
//   - AI (OpenAI) NEVER makes decisions; it only extracts entities.
//   - All decision logic lives in pure TypeScript (if/switch).
//   - Supabase is the single source of truth for state and config.
// ============================================================

import type { BotState } from '../constants/bot-states';
import type { InsuranceGroupId } from '../constants/insurance-groups';

// ------------------------------------------------------------
// Vehicle
// ------------------------------------------------------------

export interface VehicleData {
  licensePlate?: string;
  brand?: string;
  model?: string;
  year?: number;
  /** Required to route Occident (Group 3) correctly */
  isTesla?: boolean;
  vin?: string;
  color?: string;
}

// ------------------------------------------------------------
// Customer
// ------------------------------------------------------------

export interface CustomerData {
  /** WhatsApp phone number in E.164 format, e.g. +34612345678 */
  phone: string;
  name?: string;
  email?: string;
}

// ------------------------------------------------------------
// Repair / Payment types
// ------------------------------------------------------------

export type RepairType =
  | 'new_repair'   // Nueva reparación
  | 'crane'        // Servicio de grúa
  | 'ongoing'      // Reparación en curso (consulta de estado)
  | 'other';       // Otro motivo de contacto

export type PaymentType =
  | 'self_pay'     // Paga el propio cliente (particular)
  | 'insurance';   // Paga la aseguradora

export type SelfPayChannel =
  | 'web'          // El cliente usa el formulario web del taller
  | 'manual';      // El bot recopila los datos manualmente

// Occident-specific fork inside Group 3
export type OccidentVehicleType =
  | 'tesla'
  | 'non_tesla';

// ------------------------------------------------------------
// WhatsApp outgoing messages
// ------------------------------------------------------------

export interface TextMessage {
  type: 'text';
  text: string;
}

export interface InteractiveButtonMessage {
  type: 'interactive_button';
  body: string;
  buttons: Array<{ id: string; title: string }>;
}

export interface InteractiveListMessage {
  type: 'interactive_list';
  body: string;
  buttonLabel: string;
  sections: Array<{
    title?: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
}

export interface MediaMessage {
  type: 'image' | 'document' | 'video';
  url: string;
  caption?: string;
}

export type OutgoingMessage =
  | TextMessage
  | InteractiveButtonMessage
  | InteractiveListMessage
  | MediaMessage;

// ------------------------------------------------------------
// Conversation
// ------------------------------------------------------------

/**
 * Single row in the `conversations` Supabase table.
 * `context` holds any ad-hoc state-machine data that doesn't
 * warrant a dedicated column (e.g. collected crane photos count).
 */
export interface Conversation {
  id: string;

  /** E.164 WhatsApp phone number, PK for lookup */
  whatsapp_phone_number: string;

  state: BotState;

  vehicle_data: Partial<VehicleData>;
  customer_data: Partial<CustomerData>;

  repair_type?: RepairType;
  payment_type?: PaymentType;
  self_pay_channel?: SelfPayChannel;

  insurance_company?: string;
  insurance_group_id?: InsuranceGroupId;
  occident_vehicle_type?: OccidentVehicleType;

  /**
   * Flexible key-value store for transient state-machine data.
   * Typed as unknown so consumers must narrow before use.
   */
  context: Record<string, unknown>;

  assigned_agent_phone?: string;

  created_at: string;   // ISO-8601
  updated_at: string;   // ISO-8601
  closed_at?: string;   // ISO-8601, set when state === 'closed'
}

// Convenience type for partial updates sent to Supabase
export type ConversationUpdate = Partial<
  Omit<Conversation, 'id' | 'whatsapp_phone_number' | 'created_at'>
>;

// ------------------------------------------------------------
// Taller configuration (loaded once from Supabase at startup)
// ------------------------------------------------------------

export interface TallerConfig {
  id: string;
  name: string;
  address: string;
  phone: string;
  /** e.g. { "lunes-viernes": "08:00-18:00", "sabado": "09:00-13:00" } */
  opening_hours: Record<string, string>;
  /** Default agent WhatsApp number for human-handoff */
  default_agent_phone: string;
  /** URL of the self-service web repair form */
  web_repair_form_url?: string;
  crane_service_enabled: boolean;
  /** Max photos required during crane flow */
  crane_photos_required: number;
  /** URL del formulario de presupuesto online para reparaciones a cargo del cliente */
  presupuesto_web_url: string;
  /** URL del formulario especial para coordinar cita única Tesla */
  cita_tesla_url: string;
  /** Si hay coches de cortesía disponibles actualmente (gestionado por el taller desde Supabase) */
  hay_coches_cortesia: boolean;
  /** URL del PDF de ventajas de reparar en taller Tesla (para compañías no colaboradoras) */
  pdf_ventajas_tesla_url?: string;
}

// ------------------------------------------------------------
// Bot response (output of every state-handler)
// ------------------------------------------------------------

/**
 * Returned by every state-handler function.
 * The router applies `next_state` and `conversation_update`
 * to Supabase, then sends `messages` via WhatsApp Cloud API.
 *
 * IMPORTANT: handlers never call Supabase or WhatsApp directly;
 * they only return a BotResponse.
 */
export interface BotResponse {
  /** Zero or more messages to send to the user, in order */
  messages: OutgoingMessage[];
  /** The state the conversation should transition to */
  next_state: BotState;
  /** Fields to persist on the conversation row */
  conversation_update: ConversationUpdate;
}

// ------------------------------------------------------------
// Incoming WhatsApp webhook payload (simplified)
// ------------------------------------------------------------

export interface WhatsAppIncomingMessage {
  from: string;         // E.164 sender phone
  message_id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'video' | 'interactive' | 'button';
  text?: { body: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
  image?: { id: string; mime_type: string; sha256: string };
}

// ------------------------------------------------------------
// Entity extraction result (OpenAI output — no decisions here)
// ------------------------------------------------------------

/**
 * This is the ONLY output OpenAI produces.
 * All fields are optional because NLP extraction may fail.
 * Decision logic MUST NOT live inside or depend on the AI call.
 */
export interface ExtractedEntities {
  license_plate?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  customer_name?: string;
  insurance_company_raw?: string; // raw text, normalisation is done in code
  is_tesla?: boolean;
  intent?: 'new_repair' | 'crane' | 'ongoing' | 'other' | 'greeting' | 'unknown';
}

// Re-export imported types so consumers only need one import path
export type { BotState, InsuranceGroupId };

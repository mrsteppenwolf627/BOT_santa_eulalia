import type { BotState } from '../../constants/bot-states';
import type { VehicleData, CustomerData } from '../../types/index';
import type { InsuranceGroupId } from '../../constants/insurance-groups';
import { INSURANCE_GROUPS } from '../../constants/insurance-groups';
import { chatwootFetch } from './client';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface FormatNoteParams {
  /** Escalation reason code from the state machine action. */
  reason: string;
  vehicleData?: Partial<VehicleData> | null;
  customerData?: Partial<CustomerData> | null;
  /** Raw insurance company name as the customer wrote it. */
  insuranceCompany?: string | null;
  /** Resolved insurance group id (from Supabase conversation). */
  insuranceGroupId?: InsuranceGroupId | null;
  /** Last bot state before transitioning to awaiting_human. */
  conversationState: BotState;
}

// ─────────────────────────────────────────────────────────────
// State → human-readable label
// ─────────────────────────────────────────────────────────────

const STATE_LABELS: Partial<Record<BotState, string>> = {
  init:                              'Inicio de conversación',
  collecting_vehicle:                'Identificación del vehículo',
  branch_selection:                  'Selección de opción',
  crane_photos:                      'Fotos de grúa',
  crane_awaiting_reception:          'Espera de recepción (grúa)',
  crane_collecting_data:             'Recopilación de datos (grúa)',
  repair_ongoing:                    'Consulta estado reparación en curso',
  new_repair_payment_type:           'Nueva reparación — tipo de pago',
  new_repair_self_web:               'Nueva reparación — particular (web)',
  new_repair_self_manual:            'Nueva reparación — particular (manual)',
  new_repair_insurance_company:      'Nueva reparación — nombre aseguradora',
  new_repair_insurance_assignment:   'Nueva reparación — asignación al taller',
  new_repair_occident_choice:        'Nueva reparación — Occident (Tesla/No-Tesla)',
  new_repair_non_collab_no_peritar:  'Nueva reparación — no colaboradora',
  awaiting_human:                    'Esperando agente humano',
  closed:                            'Conversación cerrada',
  agent:                             'Agente / tramitador',
  admin:                             'Consulta administrativa',
};

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Posts a private internal note to a Chatwoot conversation.
 * Private notes are visible only to agents, not to the customer.
 *
 * Errors are logged and swallowed — a failing note must never
 * block the bot's state transition.
 */
export async function sendChatwootNote(
  chatwootConversationId: string,
  note: string,
): Promise<void> {
  if (!chatwootConversationId || !note) return;

  try {
    await chatwootFetch(`/conversations/${chatwootConversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content:      note,
        message_type: 'outgoing',
        private:      true,
      }),
    });
  } catch (err) {
    console.error(
      `[chatwoot] sendChatwootNote(${chatwootConversationId}) failed:`,
      err,
    );
  }
}

/**
 * Pure function that builds the text of the escalation note
 * posted as a private message inside the Chatwoot conversation.
 * Designed to be scanned quickly by the reception team.
 */
export function formatEscalationNote(params: FormatNoteParams): string {
  const {
    reason,
    vehicleData,
    customerData,
    insuranceCompany,
    insuranceGroupId,
    conversationState,
  } = params;

  const lines: string[] = [];

  // ── Vehicle ──────────────────────────────────────────────
  const brand       = vehicleData?.brand;
  const model       = vehicleData?.model;
  const plate       = vehicleData?.licensePlate;
  const vehicleParts: string[] = [];
  if (brand || model) vehicleParts.push([brand, model].filter(Boolean).join(' '));
  if (plate)          vehicleParts.push(`— ${plate}`);
  lines.push(`🚗 Vehículo: ${vehicleParts.length > 0 ? vehicleParts.join(' ') : 'No identificado'}`);

  // ── Last bot state ────────────────────────────────────────
  const stateLabel = STATE_LABELS[conversationState] ?? conversationState;
  lines.push(`📋 Último paso del bot: ${stateLabel}`);

  // ── Insurance ─────────────────────────────────────────────
  if (insuranceCompany) {
    let insuranceLine = `🏢 Aseguradora: ${insuranceCompany}`;
    if (insuranceGroupId !== undefined && insuranceGroupId !== null) {
      const group = INSURANCE_GROUPS[insuranceGroupId];
      insuranceLine += ` (${group.label})`;
    }
    lines.push(insuranceLine);
  }

  // ── Customer ──────────────────────────────────────────────
  const customerPhone = customerData?.phone;
  const customerName  = customerData?.name;
  const customerParts: string[] = [];
  if (customerName)  customerParts.push(customerName);
  if (customerPhone) customerParts.push(customerPhone);
  lines.push(`👤 Cliente: ${customerParts.length > 0 ? customerParts.join(' — ') : 'No identificado'}`);

  // ── Escalation reason ─────────────────────────────────────
  lines.push(`⚠️ Razón del escalado: ${reason}`);

  return lines.join('\n');
}

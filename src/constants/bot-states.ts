// ============================================================
// BOT STATES — Finite State Machine
// ============================================================
// Each constant is the canonical string used in:
//   - Supabase `conversations.state` column
//   - State-handler routing (switch statement in the router)
//   - TypeScript union type BotState
//
// State transition diagram (high-level):
//
//  init
//   └─► collecting_vehicle
//        └─► branch_selection
//             ├─► new_repair_payment_type
//             │    ├─► new_repair_self_web          (pago propio, formulario web)
//             │    ├─► new_repair_self_manual        (pago propio, manual)
//             │    └─► new_repair_insurance_company  (seguro)
//             │         └─► new_repair_insurance_assignment
//             │              ├─► new_repair_occident_choice       (Grupo 3)
//             │              └─► new_repair_non_collab_no_peritar (Grupo 5)
//             ├─► crane_photos
//             │    └─► crane_awaiting_reception
//             │         └─► crane_collecting_data
//             ├─► repair_ongoing
//             └─► agent
//
//  Any state ──► awaiting_human  (handoff to human agent)
//  Any state ──► closed          (conversation ended)
//  Any state ──► admin           (internal/admin commands)
// ============================================================

// ------------------------------------------------------------
// Union type (single source of truth)
// ------------------------------------------------------------

export type BotState =
  // ── Entry point ──────────────────────────────────────────
  | 'init'

  // ── Vehicle identification ────────────────────────────────
  | 'collecting_vehicle'

  // ── Main menu fork ────────────────────────────────────────
  | 'branch_selection'

  // ── Direct-to-agent / admin ───────────────────────────────
  | 'agent'
  | 'admin'

  // ── Crane service flow ────────────────────────────────────
  | 'crane_photos'
  | 'crane_awaiting_reception'
  | 'crane_collecting_data'

  // ── Ongoing repair consultation ───────────────────────────
  | 'repair_ongoing'

  // ── New repair — payment split ────────────────────────────
  | 'new_repair_payment_type'

  // ── New repair — self-pay paths ───────────────────────────
  | 'new_repair_self_web'        // Redirect to web form
  | 'new_repair_self_manual'     // Bot collects data manually

  // ── New repair — insurance paths ─────────────────────────
  | 'new_repair_insurance_company'     // Collect insurance name
  | 'new_repair_insurance_assignment'  // Route by group (1-6)
  | 'new_repair_occident_choice'       // Group 3: Tesla vs No-Tesla
  | 'new_repair_non_collab_no_peritar' // Group 5: non-collab, client pays upfront

  // ── Terminal / special ────────────────────────────────────
  | 'awaiting_human'  // Waiting for a human agent to take over
  | 'closed';         // Conversation ended (resolved or abandoned)

// ------------------------------------------------------------
// Grouped sets (useful for guards and routing without AI)
// ------------------------------------------------------------

/** States where the bot is actively driving the conversation */
export const ACTIVE_STATES = new Set<BotState>([
  'init',
  'collecting_vehicle',
  'branch_selection',
  'crane_photos',
  'crane_awaiting_reception',
  'crane_collecting_data',
  'repair_ongoing',
  'new_repair_payment_type',
  'new_repair_self_web',
  'new_repair_self_manual',
  'new_repair_insurance_company',
  'new_repair_insurance_assignment',
  'new_repair_occident_choice',
  'new_repair_non_collab_no_peritar',
]);

/** States where no further automated processing should happen */
export const TERMINAL_STATES = new Set<BotState>([
  'awaiting_human',
  'closed',
  'agent',
  'admin',
]);

/** States that belong to the "nueva reparación" sub-flow */
export const NEW_REPAIR_STATES = new Set<BotState>([
  'new_repair_payment_type',
  'new_repair_self_web',
  'new_repair_self_manual',
  'new_repair_insurance_company',
  'new_repair_insurance_assignment',
  'new_repair_occident_choice',
  'new_repair_non_collab_no_peritar',
]);

/** States that belong to the crane sub-flow */
export const CRANE_STATES = new Set<BotState>([
  'crane_photos',
  'crane_awaiting_reception',
  'crane_collecting_data',
]);

// ------------------------------------------------------------
// Full ordered list (useful for validation, migrations, etc.)
// ------------------------------------------------------------

export const ALL_BOT_STATES: BotState[] = [
  'init',
  'collecting_vehicle',
  'branch_selection',
  'agent',
  'admin',
  'crane_photos',
  'crane_awaiting_reception',
  'crane_collecting_data',
  'repair_ongoing',
  'new_repair_payment_type',
  'new_repair_self_web',
  'new_repair_self_manual',
  'new_repair_insurance_company',
  'new_repair_insurance_assignment',
  'new_repair_occident_choice',
  'new_repair_non_collab_no_peritar',
  'awaiting_human',
  'closed',
];

// Type-level exhaustiveness check — fails at compile time if a state is missing
const _exhaustiveCheck: Record<BotState, true> = {
  init: true,
  collecting_vehicle: true,
  branch_selection: true,
  agent: true,
  admin: true,
  crane_photos: true,
  crane_awaiting_reception: true,
  crane_collecting_data: true,
  repair_ongoing: true,
  new_repair_payment_type: true,
  new_repair_self_web: true,
  new_repair_self_manual: true,
  new_repair_insurance_company: true,
  new_repair_insurance_assignment: true,
  new_repair_occident_choice: true,
  new_repair_non_collab_no_peritar: true,
  awaiting_human: true,
  closed: true,
};
// Suppress unused-variable warning in strict mode
void _exhaustiveCheck;

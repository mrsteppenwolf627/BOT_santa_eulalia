import type { BotState } from '../../constants/bot-states';
import type { Conversation } from '../../types/index';
import { supabase } from './client';

/** TTL for new conversations: 24 hours */
const CONVERSATION_TTL_MS = 24 * 60 * 60 * 1_000;

/**
 * Returns the active conversation for the given phone number.
 * A conversation is active when expires_at > now() and state !== 'closed'.
 * If none exists (or all have expired), inserts a fresh one with state = 'init'.
 */
export async function getOrCreateConversation(phoneNumber: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('whatsapp_phone_number', phoneNumber)
    .gt('expires_at', new Date().toISOString())
    .neq('state', 'closed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`getOrCreateConversation: query failed — ${error.message}`);
  }

  if (data !== null) {
    return data as unknown as Conversation;
  }

  const expiresAt = new Date(Date.now() + CONVERSATION_TTL_MS).toISOString();

  const { data: created, error: insertError } = await supabase
    .from('conversations')
    .insert({
      whatsapp_phone_number: phoneNumber,
      state: 'init' as BotState,
      vehicle_data: {},
      customer_data: {},
      context: {},
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (insertError !== null || created === null) {
    throw new Error(
      `getOrCreateConversation: insert failed — ${insertError?.message ?? 'no data returned'}`,
    );
  }

  return created as unknown as Conversation;
}

/**
 * Updates the state (and optionally the context) of a conversation.
 */
export async function updateConversationState(
  id: string,
  state: BotState,
  context?: Record<string, unknown>,
): Promise<void> {
  const patch: Record<string, unknown> = { state };
  if (context !== undefined) {
    patch['context'] = context;
  }

  const { error } = await supabase
    .from('conversations')
    .update(patch)
    .eq('id', id);

  if (error !== null) {
    throw new Error(`updateConversationState(${id}): update failed — ${error.message}`);
  }
}

/**
 * Marks a conversation as closed and immediately expires it.
 * Sets state = 'closed', expires_at = now(), closed_at = now().
 */
export async function closeConversation(id: string): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('conversations')
    .update({
      state: 'closed' as BotState,
      expires_at: now,
      closed_at: now,
    })
    .eq('id', id);

  if (error !== null) {
    throw new Error(`closeConversation(${id}): update failed — ${error.message}`);
  }
}

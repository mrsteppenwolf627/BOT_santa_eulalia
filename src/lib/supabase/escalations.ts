import { supabase } from './client';

/**
 * Inserts a new row in the `escalations` table and returns the generated id.
 */
export async function createEscalation(
  conversationId: string,
  reason: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('escalations')
    .insert({ conversation_id: conversationId, reason })
    .select('id')
    .single();

  if (error !== null || data === null) {
    throw new Error(
      `createEscalation(${conversationId}): insert failed — ${error?.message ?? 'no id returned'}`,
    );
  }

  return data.id as string;
}

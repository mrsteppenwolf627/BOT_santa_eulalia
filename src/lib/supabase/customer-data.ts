import type { CustomerData } from '../../types/index';
import { supabase } from './client';

/** Returns a shallow copy of `obj` with null and undefined values removed. */
function stripNullish<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined),
  ) as Partial<T>;
}

/**
 * Upserts customer data into the `customer_data` table keyed by `conversation_id`.
 * Only the fields present and non-null in `data` are written; existing fields
 * not included in the payload are left unchanged by Supabase's upsert semantics.
 *
 * Note: CustomerData columns (phone, name, email) are already snake_case,
 * so no column name mapping is required.
 */
export async function saveCustomerData(
  conversationId: string,
  data: Partial<CustomerData>,
): Promise<void> {
  const clean = stripNullish(data);

  if (Object.keys(clean).length === 0) return;

  const { error } = await supabase
    .from('customer_data')
    .upsert(
      { conversation_id: conversationId, ...clean },
      { onConflict: 'conversation_id' },
    );

  if (error !== null) {
    throw new Error(`saveCustomerData(${conversationId}): upsert failed — ${error.message}`);
  }
}

/**
 * Returns the customer data for the given conversation, or null if no row exists yet.
 */
export async function getCustomerData(conversationId: string): Promise<CustomerData | null> {
  const { data, error } = await supabase
    .from('customer_data')
    .select('*')
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`getCustomerData(${conversationId}): query failed — ${error.message}`);
  }

  if (data === null) return null;

  return data as unknown as CustomerData;
}

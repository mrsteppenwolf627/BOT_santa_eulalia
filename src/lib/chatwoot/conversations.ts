import { chatwootFetch, getInboxId } from './client';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CreateConversationParams {
  /** E.164 phone number of the WhatsApp customer. */
  phoneNumber: string;
  /** Display name for the contact (optional). */
  contactName?: string;
  /** First message to post inside the new conversation. */
  initialMessage: string;
  /** Escalation reason — stored as an additional attribute for reference. */
  reason: string;
}

// ─────────────────────────────────────────────────────────────
// Contact helpers
// ─────────────────────────────────────────────────────────────

/** Returns the Chatwoot contact id for the given phone, creating it if needed. */
async function getOrCreateContact(
  phoneNumber: string,
  name?: string,
): Promise<number> {
  // 1. Search for an existing contact.
  const searchResponse = await chatwootFetch(
    `/contacts/search?q=${encodeURIComponent(phoneNumber)}&include_contacts=true`,
  );
  const searchData = (await searchResponse.json()) as {
    payload?: { contacts?: Array<{ id: number }> };
  };

  const existing = searchData.payload?.contacts?.[0];
  if (existing !== undefined) {
    return existing.id;
  }

  // 2. Create the contact if not found.
  const createResponse = await chatwootFetch('/contacts', {
    method: 'POST',
    body: JSON.stringify({
      name: name ?? phoneNumber,
      phone_number: phoneNumber,
      identifier: phoneNumber,
    }),
  });

  const created = (await createResponse.json()) as { id: number };
  return created.id;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Finds or creates a Chatwoot contact for `phoneNumber`, then opens a new
 * conversation in the configured inbox with `status: pending`.
 *
 * Returns the numeric Chatwoot conversation id (as a string) so the caller
 * can persist it in Supabase's `context.chatwoot_conversation_id`.
 *
 * Never throws — errors are logged and an empty string is returned so the
 * bot can still transition to `awaiting_human` in Supabase.
 */
export async function createChatwootConversation(
  params: CreateConversationParams,
): Promise<string> {
  const { phoneNumber, contactName, initialMessage, reason } = params;

  try {
    const contactId = await getOrCreateContact(phoneNumber, contactName);
    const inboxId   = parseInt(getInboxId(), 10);

    const convResponse = await chatwootFetch('/conversations', {
      method: 'POST',
      body: JSON.stringify({
        inbox_id:   inboxId,
        contact_id: contactId,
        status:     'pending',
        additional_attributes: {
          escalation_reason: reason,
        },
      }),
    });

    const conv = (await convResponse.json()) as { id: number };
    const chatwootId = conv.id.toString();

    // Post the initial context message inside the new conversation.
    await chatwootFetch(`/conversations/${chatwootId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content:      initialMessage,
        message_type: 'outgoing',
        private:      true,
      }),
    });

    return chatwootId;
  } catch (err) {
    console.error('[chatwoot] createChatwootConversation failed:', err);
    return '';
  }
}

/**
 * Marks a Chatwoot conversation as `resolved`.
 * Called when the bot closes the session in Supabase.
 */
export async function resolveChatwootConversation(
  chatwootConversationId: string,
): Promise<void> {
  if (!chatwootConversationId) return;

  try {
    await chatwootFetch(
      `/conversations/${chatwootConversationId}/toggle_status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'resolved' }),
      },
    );
  } catch (err) {
    console.error(
      `[chatwoot] resolveChatwootConversation(${chatwootConversationId}) failed:`,
      err,
    );
  }
}

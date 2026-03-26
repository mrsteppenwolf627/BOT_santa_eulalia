import type { OutgoingMessage } from '../../types/index';

const GRAPH_API_VERSION = 'v19.0';
const DELAY_BETWEEN_MESSAGES_MS = 500;

// ------------------------------------------------------------
// Internal helpers — build WhatsApp Cloud API payloads
// ------------------------------------------------------------

function buildTextPayload(to: string, text: string): Record<string, unknown> {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  };
}

function buildInteractiveButtonPayload(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
): Record<string, unknown> {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  };
}

function buildInteractiveListPayload(
  to: string,
  body: string,
  buttonLabel: string,
  sections: Array<{
    title?: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>,
): Record<string, unknown> {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: buttonLabel,
        sections: sections.map((s) => ({
          ...(s.title !== undefined && { title: s.title }),
          rows: s.rows.map((r) => ({
            id: r.id,
            title: r.title,
            ...(r.description !== undefined && { description: r.description }),
          })),
        })),
      },
    },
  };
}

function buildMediaPayload(
  to: string,
  type: 'image' | 'document' | 'video',
  url: string,
  caption?: string,
): Record<string, unknown> {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type,
    [type]: {
      link: url,
      ...(caption !== undefined && { caption }),
    },
  };
}

function toApiPayload(to: string, msg: OutgoingMessage): Record<string, unknown> {
  switch (msg.type) {
    case 'text':
      return buildTextPayload(to, msg.text);

    case 'interactive_button':
      return buildInteractiveButtonPayload(to, msg.body, msg.buttons);

    case 'interactive_list':
      return buildInteractiveListPayload(to, msg.body, msg.buttonLabel, msg.sections);

    case 'image':
    case 'document':
    case 'video':
      return buildMediaPayload(to, msg.type, msg.url, msg.caption);
  }
}

// ------------------------------------------------------------
// Delay helper
// ------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

/**
 * Sends an ordered list of messages to a WhatsApp recipient via the
 * WhatsApp Cloud API (graph.facebook.com).
 *
 * Messages are delivered sequentially with a 500 ms pause between each
 * so they arrive in the correct order on the client's device.
 *
 * Throws if any individual send fails (after logging the error).
 */
export async function sendWhatsAppMessage(
  to: string,
  messages: OutgoingMessage[],
): Promise<void> {
  const phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'];
  const accessToken = process.env['WHATSAPP_ACCESS_TOKEN'];

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      'sendWhatsAppMessage: WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN is not set.',
    );
  }

  const endpoint = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  for (let i = 0; i < messages.length; i++) {
    if (i > 0) {
      await delay(DELAY_BETWEEN_MESSAGES_MS);
    }

    const payload = toApiPayload(to, messages[i]!);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `sendWhatsAppMessage: API error ${response.status} for message ${i + 1}/${messages.length} — ${body}`,
      );
    }
  }
}

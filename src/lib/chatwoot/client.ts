/**
 * Base Chatwoot API client.
 * All requests go through chatwootFetch, which injects auth headers
 * and surfaces HTTP errors with enough context to diagnose.
 */

const API_VERSION = 'v1';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`chatwoot/client: environment variable ${name} is not set.`);
  return value;
}

/** Returns the base REST prefix for the configured account. */
function accountBase(): string {
  const base  = env('CHATWOOT_BASE_URL').replace(/\/$/, '');
  const accId = env('CHATWOOT_ACCOUNT_ID');
  return `${base}/api/${API_VERSION}/accounts/${accId}`;
}

/**
 * Thin fetch wrapper that:
 *  - Prepends the Chatwoot base URL + account path.
 *  - Adds the `api_access_token` authentication header.
 *  - Throws a descriptive error on non-2xx responses.
 *
 * `path` must start with `/` (e.g. `/contacts`).
 */
export async function chatwootFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url   = `${accountBase()}${path}`;
  const token = env('CHATWOOT_API_TOKEN');

  const headers = new Headers(options.headers);
  headers.set('api_access_token', token);
  if (!headers.has('Content-Type') && options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const body = await response.text().catch(() => '(unreadable body)');
    throw new Error(
      `Chatwoot API error: ${response.status} ${response.statusText} — ${path} — ${body}`,
    );
  }

  return response;
}

/** Convenience: reads the configured inbox ID (fails fast if missing). */
export function getInboxId(): string {
  return env('CHATWOOT_INBOX_ID');
}

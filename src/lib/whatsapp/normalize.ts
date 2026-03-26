/**
 * Normalises an incoming WhatsApp text so the state machine
 * can work with clean, accent-free, lowercase input.
 *
 * Steps:
 *  1. Lowercase
 *  2. Remove diacritics (á→a, é→e, í→i, ó→o, ú/ü→u, ñ→n)
 *  3. Collapse multiple whitespace characters into a single space
 *  4. Trim leading / trailing whitespace
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[áàâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôö]/g, 'o')
    .replace(/[úùûüű]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/\s+/g, ' ')
    .trim();
}

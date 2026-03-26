import type { ExtractedEntities } from '../../types/index';

const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const TIMEOUT_MS = 8_000;

const SYSTEM_PROMPT = `Eres un extractor de datos estructurados para un taller de coches en España.
Tu único trabajo es leer el mensaje de un cliente y devolver un objeto JSON con los datos que encuentres.

REGLAS ESTRICTAS:
- Responde ÚNICAMENTE con un objeto JSON válido. Sin texto adicional, sin markdown, sin bloques de código.
- Extrae solo lo que esté explícitamente en el mensaje. Si algo no está claro, omite el campo.
- Si el mensaje no contiene ningún dato extraíble, devuelve exactamente: {}

CAMPOS QUE PUEDES DEVOLVER:
- license_plate (string): matrícula del vehículo en formato español (ej: 1234ABC, AB1234CD). Normalizar a mayúsculas sin espacios ni guiones.
- vehicle_brand (string): solo la marca del vehículo, sin modelo. Ej: "BMW", "Seat", "Volkswagen", "Tesla".
- vehicle_model (string): solo el modelo, sin la marca. Ej: "Serie 3", "Ibiza", "Golf", "Model 3".
- vehicle_year (number): año del vehículo como número entero. Ej: 2019.
- customer_name (string): nombre del cliente si se presenta o lo menciona.
- insurance_company_raw (string): nombre de la aseguradora tal como lo escribe el cliente, sin normalizar. Ej: "Mapfre", "la mutua", "Axa".
- is_tesla (boolean): true únicamente si la marca del vehículo es explícitamente Tesla.
- intent (string): intención principal del mensaje. Valores posibles: "new_repair", "crane", "ongoing", "other", "greeting", "unknown".
  - new_repair: quiere reparar su vehículo (nueva reparación, presupuesto, daños)
  - crane: necesita grúa o tiene una avería en la vía pública
  - ongoing: pregunta por el estado de una reparación ya en curso
  - other: consulta administrativa, factura, pago, etc.
  - greeting: solo saluda sin dar más información
  - unknown: no se puede determinar la intención

EJEMPLOS:
Mensaje: "Hola, tengo un Golf 2020 con matrícula 4523KLM y quiero repararlo"
Respuesta: {"vehicle_brand":"Volkswagen","vehicle_model":"Golf","vehicle_year":2020,"license_plate":"4523KLM","intent":"new_repair"}

Mensaje: "Buenos días"
Respuesta: {"intent":"greeting"}

Mensaje: "Me llamo Ana García y mi seguro es Mapfre"
Respuesta: {"customer_name":"Ana García","insurance_company_raw":"Mapfre"}`;

// ─────────────────────────────────────────────────────────────
// Allowed keys — used to strip any extra fields OpenAI adds
// ─────────────────────────────────────────────────────────────

const ALLOWED_KEYS: ReadonlySet<string> = new Set<keyof ExtractedEntities>([
  'license_plate',
  'vehicle_brand',
  'vehicle_model',
  'vehicle_year',
  'customer_name',
  'insurance_company_raw',
  'is_tesla',
  'intent',
]);

function pickAllowedFields(raw: Record<string, unknown>): ExtractedEntities {
  const result: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    if (key in raw) {
      result[key] = raw[key];
    }
  }
  return result as ExtractedEntities;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Calls OpenAI (gpt-4o-mini) to extract structured entities from a
 * normalised user message. Never throws — returns {} on any failure.
 */
export async function extractEntities(text: string): Promise<ExtractedEntities> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    console.error('[extractEntities] OPENAI_API_KEY is not set.');
    return {};
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 256,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: text },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[extractEntities] OpenAI API error ${response.status}: ${body}`);
      return {};
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    const content = json.choices?.[0]?.message?.content?.trim() ?? '';

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      return pickAllowedFields(parsed);
    } catch {
      console.warn('[extractEntities] Failed to parse OpenAI response as JSON:', content);
      return {};
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[extractEntities] OpenAI call timed out after 8 s.');
    } else {
      console.error('[extractEntities] Unexpected error:', err);
    }
    return {};
  } finally {
    clearTimeout(timer);
  }
}

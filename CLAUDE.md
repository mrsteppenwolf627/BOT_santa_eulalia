# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Qué es este proyecto

Chatbot de atención al cliente para WhatsApp dirigido a Talleres Santa Eulalia, un taller de coches en Terrassa (Catalunya). Atiende automáticamente las consultas de los clientes siguiendo un árbol de decisiones estricto en TypeScript puro.

## Regla fundamental — NO VIOLAR NUNCA

**La IA no toma decisiones. Solo extrae entidades del lenguaje natural.**

OpenAI convierte texto libre en campos estructurados (`license_plate`, `vehicle_brand`, `insurance_company_raw`, `intent`…). A partir de ahí, todo es TypeScript puro: `if`, `switch`, expresiones regulares y tablas de lookup. Si surge la tentación de pedir a OpenAI que decida el siguiente estado o genere la respuesta, eso es una señal de que hay que modelar un nuevo estado en la máquina.

## Stack

- **Canal**: WhatsApp Cloud API (Meta)
- **Servidor**: Vercel (Serverless Functions / Next.js App Router)
- **Base de datos**: Supabase (PostgreSQL)
- **IA**: OpenAI gpt-4o-mini — solo extracción de entidades
- **Bandeja humana**: Chatwoot (VPS IONOS del cliente)
- **Centralita**: Twilio Voice (módulo en construcción)
- **Lenguaje**: TypeScript estricto / Node.js 18+

## Comandos de desarrollo

```bash
npm install          # instalar dependencias
vercel dev           # servidor local en http://localhost:3000
ngrok http 3000      # exponer webhook públicamente para Meta/Chatwoot
```

Variables de entorno: copiar `.env.example` a `.env.local` y rellenar todos los valores antes de arrancar.

## Arquitectura: flujo de un mensaje entrante

```
Meta POST /api/whatsapp
  → validación HMAC-SHA256
  → respuesta 200 inmediata (< 20 s, requisito de Meta)
  → void processMessage() [asíncrono, sin bloquear la respuesta]
      → getOrCreateConversation(phone)          [Supabase]
      → ¿estado awaiting_human o closed? → silencio total
      → getConfig() + getVehicleData() + getCustomerData()  [paralelo]
      → normalizeText()                         [minúsculas, sin tildes]
      → ¿context.requiresEntityExtraction?
          → Sí: extractEntities() via OpenAI gpt-4o-mini (timeout 8 s)
      → stateMachine(input)                     [función pura, sin efectos secundarios]
          → cross-cutting rules (cortesía, Tesla doble cita)
          → dispatch al handler del estado actual
      → ejecutar action retornada por la máquina
      → updateConversationState()               [Supabase]
      → sendWhatsAppMessage()                   [500 ms entre mensajes]
```

## Máquina de estados (`src/lib/state-machine/`)

- **`index.ts`**: entrada pública `stateMachine(input)`. Evalúa cross-cutting rules antes del dispatch.
- **Cross-cutting rules** (evaluadas antes de cualquier handler):
  - `checkCourtesyCar`: intercepta consultas sobre coche de cortesía según `payment_type` y `config.hay_coches_cortesia`.
  - `checkTeslaDoubleVisit`: intercepta la preocupación de venir dos veces en estados `new_repair_*` si el vehículo es Tesla.
- **Handlers**: funciones puras sin efectos secundarios. Reciben `StateMachineInput`, devuelven `StateMachineOutput`.
- **`requiresEntityExtraction`**: flag en `StateMachineOutput` que se persiste en `context` de Supabase. Indica si el siguiente turno debe llamar a OpenAI antes de invocar la máquina.

### Estados de la FSM

```
init → collecting_vehicle → branch_selection
                              ├─ new_repair_payment_type
                              │    ├─ new_repair_self_web
                              │    ├─ new_repair_self_manual
                              │    └─ new_repair_insurance_company
                              │         └─ new_repair_insurance_assignment
                              │              ├─ new_repair_occident_choice   (Grupo 3)
                              │              └─ new_repair_non_collab_no_peritar (Grupo 5)
                              ├─ crane_photos → crane_awaiting_reception → crane_collecting_data
                              ├─ repair_ongoing
                              └─ agent

Cualquier estado → awaiting_human | closed | admin
```

`ACTIVE_STATES`, `TERMINAL_STATES`, `NEW_REPAIR_STATES` y `CRANE_STATES` están definidos en `src/constants/bot-states.ts`.

## Grupos de aseguradoras (`src/constants/insurance-groups.ts`)

| Grupo | Estrategia | Compañías |
|---|---|---|
| 1 | Fotoperitación obligatoria | Liberty, Generali, Allianz, BBVA Allianz, Allianz Direct, Regal |
| 2 | Perito aleatorio | Mapfre, SegurCaixa |
| 3 | Occident especial (Tesla vs No-Tesla) | Occident |
| 4 | Videoperitación urgente 1 h | Reale → escala a humano inmediatamente |
| 5 | No colaboradoras, cliente adelanta pago | Mutua Madrileña, Pelayo, Línea Directa |
| 6 | Perito físico estándar (catch-all) | Zurich, AXA + cualquier desconocida |

La normalización usa tablas de aliases (>100 variantes). OpenAI no interviene en esta normalización.

## Escalado a humano y ciclo Chatwoot

Cuando la máquina retorna `action: { type: 'escalate_to_human', reason }`:
1. `createEscalation()` registra el escalado en Supabase.
2. `createChatwootConversation()` abre conversación con `status: pending` y publica nota interna.
3. El estado pasa a `awaiting_human` y se guarda `chatwoot_conversation_id` en `context`.
4. El bot queda en silencio total hasta que Chatwoot envía `conversation_resolved` a `/api/chatwoot`.
5. El webhook de Chatwoot localiza la sesión por `context.chatwoot_conversation_id` y llama a `closeConversation()`.

## Capa de datos (`src/lib/supabase/`)

- `client.ts`: singleton con `service_role` (bypassa RLS — nunca exponer al cliente).
- `config.ts`: `getConfig()` con caché de 60 s. La tabla `taller_config` permite cambiar configuración dinámica sin redespliegue.
- `conversations.ts`: campo `context` (JSONB) almacena estado transitorio, incluyendo `requiresEntityExtraction` y `chatwoot_conversation_id`.
- `vehicle_data` y `customer_data` son tablas separadas (no JSONB) vinculadas por `conversation.id`.

## Reglas de código

- TypeScript estricto en todo el proyecto; `fetch` nativo, sin SDKs externos salvo Supabase.
- Ningún handler de la máquina de estados tiene efectos secundarios.
- Ninguna función de `lib/supabase/` contiene lógica de negocio.
- Todos los errores se loggean con `console.error` pero nunca rompen el flujo principal.
- Los mensajes al cliente van en español, sin tildes en el código (normalización previa), tono amable y profesional.
- Si la máquina de estados falla, el bot escala automáticamente a humano como fallback de seguridad.

## Módulo Twilio (en construcción)

Cuando un cliente llama al número fijo del taller, Twilio:
1. Si el número es identificable: envía WhatsApp automático arrancando el bot y cuelga con mensaje de voz.
2. Si el número es oculto: reproduce mensaje invitando a escribir al WhatsApp y transfiere a humano.
3. En cualquier error: transferir a humano.

## Estado actual del proyecto

- ✅ Tipos, constantes y aliases (aseguradoras + marcas)
- ✅ Capa Supabase
- ✅ Máquina de estados completa (18 estados)
- ✅ Webhook WhatsApp (HMAC + procesamiento asíncrono)
- ✅ Extracción de entidades OpenAI
- ✅ Integración Chatwoot
- ⏳ Esquema SQL en Supabase (migraciones pendientes de ejecutar)
- ⏳ Tests end-to-end (requieren credenciales reales)
- 🔧 Módulo Twilio (en construcción)

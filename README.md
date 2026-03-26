# Talleres Santa Eulalia — WhatsApp Bot

Chatbot de WhatsApp que guía a los clientes del taller a través de un árbol de decisiones estructurado: identifica el vehículo, clasifica la consulta (reparación nueva, grúa, estado de reparación en curso) y gestiona el traspaso a un agente humano vía Chatwoot.

---

## Arquitectura

El sistema está compuesto por seis capas con responsabilidades claramente separadas:

**WhatsApp Cloud API (Meta)** actúa como canal de entrada. Meta envía un `POST` a `/api/whatsapp` cada vez que un cliente escribe al número corporativo del taller. El servidor responde con `200` en menos de 20 segundos (requisito de Meta) y procesa el mensaje de forma asíncrona.

**Vercel Serverless Functions** ejecutan el código. Cada petición de Meta activa una función sin servidor en el edge. No hay servidor permanente: la infraestructura escala automáticamente y el coste es proporcional al uso.

**Árbol de decisiones TypeScript** es el cerebro del sistema. Implementado como una máquina de estados finitos en `src/lib/state-machine/`, contiene toda la lógica de negocio en código puro. Cada estado tiene un handler que recibe el mensaje normalizado y devuelve el siguiente estado, los mensajes a enviar y la acción a ejecutar. No hay llamadas a bases de datos ni efectos secundarios dentro de los handlers: son funciones puras.

**Supabase PostgreSQL** es la única fuente de verdad. Almacena el estado de cada conversación activa, los datos del vehículo, la configuración dinámica del taller y el registro de escalados. La configuración editable por el taller (horarios, URLs de formularios, disponibilidad de coches de cortesía) se gestiona directamente desde la tabla `taller_config`.

**OpenAI gpt-4o-mini** se utiliza exclusivamente para extracción de entidades en lenguaje natural (marca, modelo, matrícula, aseguradora, intención). La IA no toma ninguna decisión. Su output es un objeto JSON tipado que el árbol de decisiones consume como entrada.

**Chatwoot** es la bandeja de atención humana. Cuando el bot decide escalar una conversación, crea una conversación en Chatwoot con `status: pending` y publica una nota interna con el contexto completo para el agente. El bot queda en silencio hasta que Chatwoot resuelve la conversación, momento en que el webhook de Chatwoot cierra la sesión en Supabase.

---

## Principio fundamental

> **La IA no toma decisiones. Solo extrae datos.**

OpenAI convierte texto libre en campos estructurados (`license_plate`, `vehicle_brand`, `insurance_company_raw`, `intent`…). A partir de ahí, todo es TypeScript puro: `if`, `switch`, expresiones regulares y tablas de lookup.

Este principio garantiza que el comportamiento del bot sea completamente predecible, auditable y modificable sin tocar la IA. Si un handler toma una decisión incorrecta, el error está en el código TypeScript, no en un modelo opaco.

**No se debe violar este principio.** Si en el futuro surge la tentación de pedir a OpenAI que "decida" el siguiente estado o que "genere" la respuesta, es una señal de que la lógica correspondiente debe modelarse como un nuevo estado en la máquina.

---

## Estructura del proyecto

```
src/
├── app/
│   └── api/
│       ├── whatsapp/
│       │   └── route.ts          Webhook de entrada de Meta (GET handshake + POST mensajes)
│       └── chatwoot/
│           └── route.ts          Webhook de eventos de Chatwoot (resolved, reopened, message_created)
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             Cliente Supabase singleton (service_role)
│   │   ├── conversations.ts      getOrCreateConversation, updateConversationState, closeConversation
│   │   ├── config.ts             getConfig() con caché de 60 s
│   │   ├── escalations.ts        createEscalation()
│   │   ├── vehicle-data.ts       getVehicleData(), saveVehicleData()
│   │   └── customer-data.ts      getCustomerData(), saveCustomerData()
│   │
│   ├── state-machine/
│   │   ├── index.ts              Entrada pública: stateMachine(input) + reglas cross-cutting
│   │   ├── types.ts              StateMachineInput, StateMachineOutput, MachineAction
│   │   ├── utils.ts              Parsers de opciones, detectores de palabras clave
│   │   └── handlers/
│   │       ├── init.ts
│   │       ├── collecting-vehicle.ts
│   │       ├── branch-selection.ts
│   │       ├── new-repair-payment-type.ts
│   │       ├── new-repair-self-web.ts
│   │       ├── new-repair-self-manual.ts
│   │       ├── new-repair-insurance-company.ts
│   │       ├── new-repair-insurance-assignment.ts
│   │       ├── new-repair-occident-choice.ts
│   │       ├── new-repair-non-collab-no-peritar.ts
│   │       ├── crane-photos.ts
│   │       ├── crane-awaiting-reception.ts
│   │       ├── crane-collecting-data.ts
│   │       ├── repair-ongoing.ts
│   │       ├── agent.ts
│   │       ├── admin.ts
│   │       ├── awaiting-human.ts  Bot en silencio, esperando Chatwoot
│   │       └── closed.ts
│   │
│   ├── whatsapp/
│   │   ├── send.ts               sendWhatsAppMessage() + builders de payload para la Cloud API
│   │   └── normalize.ts          normalizeText(): minúsculas, sin tildes, sin espacios dobles
│   │
│   ├── openai/
│   │   └── extract-entities.ts   extractEntities(): llama a gpt-4o-mini, devuelve ExtractedEntities
│   │
│   └── chatwoot/
│       ├── client.ts             chatwootFetch() con autenticación centralizada
│       ├── conversations.ts      createChatwootConversation(), resolveChatwootConversation()
│       └── messages.ts           sendChatwootNote(), formatEscalationNote()
│
├── types/
│   └── index.ts                  Tipos de dominio: Conversation, VehicleData, OutgoingMessage, etc.
│
└── constants/
    ├── bot-states.ts             Tipo BotState + conjuntos ACTIVE_STATES, TERMINAL_STATES
    └── insurance-groups.ts       6 grupos de aseguradoras, aliases de nombres, aliases de marcas
```

---

## Variables de entorno

Copiar `.env.example` a `.env.local` y rellenar todos los valores antes de arrancar.

### WhatsApp Cloud API (Meta)

| Variable | Descripción | Dónde encontrarla |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Token de acceso permanente | Meta App Dashboard → WhatsApp → API Setup |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de teléfono | Meta App Dashboard → WhatsApp → Getting Started |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA ID | Meta App Dashboard → WhatsApp → Getting Started |
| `WHATSAPP_VERIFY_TOKEN` | Token arbitrario para el handshake GET | Definirlo tú mismo; usarlo al registrar el webhook en Meta |
| `WHATSAPP_APP_SECRET` | Secreto de la app para validar firma HMAC | Meta App Dashboard → App Settings → Basic → App Secret |

### Supabase

| Variable | Descripción | Dónde encontrarla |
|---|---|---|
| `SUPABASE_URL` | URL pública del proyecto | Dashboard → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Clave anónima (solo para referencias futuras) | Dashboard → Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio — bypassa RLS | Dashboard → Settings → API → service_role key |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` nunca debe exponerse al cliente. Solo se usa en código de servidor.

### OpenAI

| Variable | Descripción | Dónde encontrarla |
|---|---|---|
| `OPENAI_API_KEY` | Clave de API de OpenAI | platform.openai.com → API Keys |
| `OPENAI_ENTITY_MODEL` | Modelo a usar (por defecto: `gpt-4o-mini`) | Dejar el valor por defecto salvo necesidad |

### Chatwoot

| Variable | Descripción | Dónde encontrarla |
|---|---|---|
| `CHATWOOT_BASE_URL` | URL base de la instancia (sin `/` final) | Ej: `https://app.chatwoot.com` |
| `CHATWOOT_API_TOKEN` | Token de acceso personal | Chatwoot → Profile Settings → Access Token |
| `CHATWOOT_ACCOUNT_ID` | ID numérico de la cuenta | Visible en la URL: `/app/accounts/<id>` |
| `CHATWOOT_INBOX_ID` | ID de la bandeja de WhatsApp | Settings → Inboxes → (bandeja) → Settings |
| `CHATWOOT_WEBHOOK_TOKEN` | Token para validar webhooks entrantes | Definirlo tú mismo; usarlo en Chatwoot → Settings → Integrations → Webhooks |

### Aplicación

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_APP_URL` | URL pública del despliegue (ej: `https://tu-proyecto.vercel.app`) |
| `INTERNAL_API_SECRET` | Secreto para llamadas internas entre rutas (`openssl rand -hex 32`) |
| `DEBUG_STATE_MACHINE` | `true` para logging verbose de la máquina de estados |
| `ECHO_MODE` | `true` para modo eco (responde el mismo mensaje que recibe, útil para smoke tests) |

---

## Puesta en marcha (desarrollo local)

### Requisitos previos

- Node.js 18 o superior
- Cuenta en Vercel (para `vercel dev`)
- Proyecto creado en Supabase
- App de Meta con WhatsApp Cloud API configurada
- Instancia de Chatwoot (cloud o self-hosted)

### Pasos

**1. Clonar el repositorio**

```bash
git clone https://github.com/mrsteppenwolf627/BOT_santa_eulalia.git
cd BOT_santa_eulalia
```

**2. Instalar dependencias**

```bash
npm install
```

**3. Configurar variables de entorno**

```bash
cp .env.example .env.local
```

Abrir `.env.local` y rellenar todas las variables según la tabla anterior.

**4. Ejecutar el esquema SQL en Supabase**

El esquema de la base de datos (tablas, índices, políticas RLS) debe aplicarse en el editor SQL del dashboard de Supabase antes del primer arranque. El archivo de migraciones no está incluido aún en el repositorio — ver sección [Pendiente](#pendiente-paso-7).

Tablas requeridas: `conversations`, `vehicle_data`, `customer_data`, `taller_config`, `escalations`.

**5. Arrancar el servidor local**

```bash
vercel dev
```

Esto levanta las funciones serverless en `http://localhost:3000`.

**6. Exponer el webhook a Meta**

Meta necesita una URL pública para enviar los mensajes. Usar ngrok o un túnel similar:

```bash
ngrok http 3000
```

Registrar la URL generada (ej: `https://abc123.ngrok.io/api/whatsapp`) en el Meta App Dashboard como URL del webhook. Usar el mismo valor que `WHATSAPP_VERIFY_TOKEN` para el token de verificación.

Para el webhook de Chatwoot, registrar `https://abc123.ngrok.io/api/chatwoot` en Chatwoot → Settings → Integrations → Webhooks, con el valor de `CHATWOOT_WEBHOOK_TOKEN` como token de autenticación.

---

## Esquema de base de datos

| Tabla | Descripción |
|---|---|
| `conversations` | Una fila por sesión activa. Contiene el estado actual de la FSM, el número de WhatsApp, los datos recogidos y el campo `context` (JSON libre para datos transitorios de la máquina, incluido `chatwoot_conversation_id`). TTL de 24 horas. |
| `vehicle_data` | Datos del vehículo vinculados a una conversación: matrícula, marca, modelo, año, si es Tesla. Se upserta a medida que la máquina extrae información. |
| `customer_data` | Datos personales del cliente: teléfono, nombre, email. Solo se recopilan cuando el flujo los requiere explícitamente. |
| `taller_config` | Configuración dinámica editable por el taller sin tocar código: nombre, dirección, horarios, URLs de formularios, disponibilidad de coches de cortesía, URLs de PDFs. Una sola fila, sin necesidad de redespliegue para cambiar valores. |
| `escalations` | Registro de cada escalado a humano: motivo, ID de conversación, timestamp. Útil para analítica y auditoría. |
| `appointment_notes` | Notas internas generadas automáticamente por el bot. Pendiente de implementación. |

### Campo `context` en `conversations`

El campo JSONB `context` actúa como almacén de estado transitorio para la máquina de estados. Campos relevantes:

| Clave | Tipo | Descripción |
|---|---|---|
| `requiresEntityExtraction` | `boolean` | Si el siguiente turno debe llamar a OpenAI antes de invocar la máquina |
| `chatwoot_conversation_id` | `string` | ID de la conversación en Chatwoot (para enlazar el webhook de vuelta a Supabase) |

---

## Grupos de aseguradoras

La lógica de gestión varía según la aseguradora. Las compañías están agrupadas en 6 grupos con estrategias distintas:

| Grupo | Estrategia | Compañías | Comportamiento |
|---|---|---|---|
| **1** | Fotoperitación obligatoria | Liberty, Generali, Allianz, BBVA Allianz, Allianz Direct, Regal | El taller se asigna directamente. Se requiere fotoperitación antes de iniciar la reparación. |
| **2** | Perito aleatorio | Mapfre, SegurCaixa | El taller se asigna directamente. El perito lo asigna la aseguradora de forma aleatoria. |
| **3** | Occident especial | Occident | Fork según marca: si es Tesla, flujo propio con cita unificada; si no, el cliente elige entre peritación en domicilio o en taller. |
| **4** | Videoperitación 1 hora | Reale | Videoperitación urgente que debe coordinarse en la siguiente hora. Escala a humano inmediatamente. |
| **5** | No colaboradoras | Mutua Madrileña, Pelayo, Línea Directa | La aseguradora no es colaboradora. El cliente adelanta el pago; no hay peritaje previo. Se envía PDF de ventajas. |
| **6** | Perito físico estándar | Zurich, AXA + cualquier desconocida | Catch-all. Perito presencial estándar. Escala a humano para coordinación. |

La normalización de nombres se hace mediante tablas de aliases en `src/constants/insurance-groups.ts` (más de 100 variantes cubiertas: errores tipográficos, artículos, formas coloquiales). No interviene la IA en esta normalización.

---

## Flujo de una conversación

```
Cliente escribe → Meta envía POST /api/whatsapp
  │
  ├─ Validación HMAC-SHA256 (firma del payload)
  │
  ├─ Respuesta 200 a Meta (inmediata, < 20 s)
  │
  └─ Procesamiento asíncrono:
       │
       ├─ getOrCreateConversation(phone)         → Supabase
       ├─ getConfig()                             → Supabase (caché 60 s)
       ├─ getVehicleData() + getCustomerData()    → Supabase
       │
       ├─ ¿Estado = awaiting_human o closed?
       │     └─ Sí → silencio total, fin
       │
       ├─ normalizeText(rawText)                  → minúsculas, sin tildes, sin dobles espacios
       │
       ├─ ¿context.requiresEntityExtraction = true?
       │     └─ Sí → extractEntities(text) → OpenAI gpt-4o-mini (timeout 8 s)
       │
       ├─ stateMachine(input)                     → handler puro, sin efectos secundarios
       │     └─ Devuelve: nextState, messages[], action, requiresEntityExtraction
       │
       ├─ Ejecutar action:
       │     ├─ escalate_to_human   → createEscalation() + createChatwootConversation()
       │     ├─ update_vehicle_data → saveVehicleData()
       │     ├─ update_customer_data → saveCustomerData()
       │     ├─ send_pdf            → añade MediaMessage al payload de salida
       │     ├─ send_link           → URL ya embebida en el mensaje de texto
       │     └─ request_photos      → el mensaje ya lo indica, sin acción extra
       │
       ├─ updateConversationState(nextState, context)  → Supabase
       │
       └─ sendWhatsAppMessage(phone, messages)          → Meta Cloud API
             └─ 500 ms de pausa entre mensajes (orden garantizado)
```

---

## Escalado a humano

El escalado ocurre cuando la máquina de estados devuelve `action: { type: 'escalate_to_human', reason: '...' }`. Los motivos más comunes son:

- `insurance_reale` — Reale requiere videoperitación urgente
- `insurance_standard` — aseguradora de Grupo 6 que necesita coordinación manual
- `insurance_assignment_pending` — el cliente debe asignar el taller en la plataforma de la aseguradora
- `crane_incoming` — grúa en camino, el equipo de recepción debe estar listo
- `insurance_tesla` — Tesla con Occident, flujo especial de cita única
- `state_machine_error` — error inesperado en el bot (fallback de seguridad)

### Proceso de traspaso

1. El bot llama a `createEscalation()` en Supabase (registro de auditoría).
2. El bot llama a `createChatwootConversation()`:
   - Busca o crea el contacto en Chatwoot por número de teléfono.
   - Abre una conversación con `status: pending`.
   - Publica una nota interna con el resumen: vehículo, aseguradora, grupo, cliente y razón.
3. El bot actualiza el estado de Supabase a `awaiting_human` y guarda el `chatwoot_conversation_id` en `context`.
4. **El bot queda completamente en silencio.** Los mensajes del cliente no generan respuesta automática mientras la conversación esté en `awaiting_human`.

### Cierre del ciclo

Cuando el agente humano resuelve la conversación en Chatwoot, Chatwoot envía un evento `conversation_resolved` al webhook `/api/chatwoot`. El handler localiza la conversación en Supabase por `context.chatwoot_conversation_id` y llama a `closeConversation()`, que marca la sesión como `closed` y la expira inmediatamente.

Si un agente reabre la conversación en Chatwoot (`conversation_reopened`), el estado vuelve a `awaiting_human` sin reactivar el bot automático.

---

## Pendiente (paso 7)

Lo que queda por hacer antes de la primera prueba real con el número corporativo:

- [ ] **Esquema SQL**: escribir y ejecutar las migraciones en Supabase (tablas, índices, RLS, datos iniciales de `taller_config`).
- [ ] **Cuentas reales**: configurar la app de Meta con el número corporativo del taller, obtener token permanente.
- [ ] **Vercel**: crear el proyecto, vincular el repositorio, añadir todas las variables de entorno en el dashboard.
- [ ] **Chatwoot**: configurar la bandeja de WhatsApp, crear el webhook apuntando a `/api/chatwoot`.
- [ ] **Tests end-to-end**: realizar una conversación completa con un número de desarrollo antes de activar el número corporativo.
- [ ] **Monitorización**: revisar los logs de Vercel tras las primeras conversaciones reales para detectar casos no cubiertos.
- [ ] **`appointment_notes`**: implementar la tabla y la lógica de generación de notas de cita.
- [ ] **Variable `WHATSAPP_APP_SECRET`**: añadirla al `.env.example` (actualmente solo figura en el código del webhook).

---

## Licencia y autoría

Desarrollado por **Aitor Alarcón Muñoz** — aitor@aitoralmu.xyz

Proyecto privado — **Talleres Santa Eulalia**, Terrassa (Catalunya)

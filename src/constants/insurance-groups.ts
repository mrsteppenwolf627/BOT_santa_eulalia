// ============================================================
// INSURANCE GROUPS — Talleres Santa Eulalia
// ============================================================
// Groups define routing behaviour for new-repair flows.
// The routing decision is pure TypeScript code; AI only
// normalises the free-text company name into a canonical key.
//
// Assignment logic summary:
//  Group 1 — Obligatory assignment + fotoperitación
//  Group 2 — Obligatory assignment + random expert
//  Group 3 — Occident special: branches on Tesla vs. non-Tesla
//  Group 4 — Videoperitación within 1 h
//  Group 5 — Non-collaborators: client pays upfront, no peritaje
//  Group 6 — Standard physical expert (catch-all for unknowns)
// ============================================================

// ------------------------------------------------------------
// Identifiers
// ------------------------------------------------------------

export type InsuranceGroupId = 1 | 2 | 3 | 4 | 5 | 6;

// ------------------------------------------------------------
// Assignment strategies
// ------------------------------------------------------------

/**
 * How the taller handles the repair assignment for this group.
 *
 * obligatory_photo    — Taller assigned directly; photo-based expert report required
 * obligatory_random   — Taller assigned directly; expert assigned randomly by insurer
 * occident_special    — Fork: Tesla → own flow, non-Tesla → Occident standard
 * video_1h            — Video-based expert report, must happen within 1 hour
 * non_collab          — Insurer is not a collaborator; client advances payment
 * standard_physical   — Standard in-person expert visit; catch-all for unknowns
 */
export type AssignmentStrategy =
  | 'obligatory_photo'
  | 'obligatory_random'
  | 'occident_special'
  | 'video_1h'
  | 'non_collab'
  | 'standard_physical';

// ------------------------------------------------------------
// Group definition
// ------------------------------------------------------------

export interface InsuranceGroup {
  id: InsuranceGroupId;

  /** Human-readable label shown in logs / admin UI */
  label: string;

  /** Short description of the group's routing behaviour */
  description: string;

  /**
   * Canonical company keys used for exact matching after normalisation.
   * Empty for Group 6 because it is the catch-all.
   */
  companies: InsuranceCompanyKey[];

  strategy: AssignmentStrategy;

  /**
   * True when the taller can be directly assigned without insurer approval.
   * (Groups 1 and 2)
   */
  directAssignment: boolean;

  /**
   * True when a photo-based expert report (fotoperitación) is required.
   * (Group 1)
   */
  requiresPhotoPeritage: boolean;

  /**
   * True when a video-based expert report must be arranged within 1 hour.
   * (Group 4)
   */
  requiresVideoPeritage: boolean;

  /**
   * True when the client must advance payment because the insurer is
   * not a collaborator.
   * (Group 5)
   */
  clientPaysUpfront: boolean;

  /**
   * True for Group 6: any company not listed in Groups 1-5 falls here.
   */
  isCatchAll: boolean;
}

// ------------------------------------------------------------
// Canonical company keys
// ------------------------------------------------------------

/**
 * Normalised, lowercase, accent-free company identifiers.
 * The AI returns raw text; normalisation maps it to one of these.
 * Group 6 has no fixed keys because it is the catch-all.
 */
export type InsuranceCompanyKey =
  // Group 1
  | 'liberty'
  | 'generali'
  | 'allianz'
  | 'bbva_allianz'
  | 'allianz_direct'
  | 'regal'
  // Group 2
  | 'mapfre'
  | 'segur_caixa'
  // Group 3
  | 'occident'
  // Group 4
  | 'reale'
  // Group 5
  | 'mutua_madrilena'
  | 'pelayo'
  | 'linea_directa'
  // Group 6 — known but catch-all companies
  | 'zurich'
  | 'axa';

// ------------------------------------------------------------
// Group data
// ------------------------------------------------------------

export const INSURANCE_GROUPS: Record<InsuranceGroupId, InsuranceGroup> = {
  1: {
    id: 1,
    label: 'Grupo 1 — Fotoperitación obligatoria',
    description:
      'Asignación obligatoria al taller. Se requiere fotoperitación antes de iniciar la reparación.',
    companies: ['liberty', 'generali', 'allianz', 'bbva_allianz', 'allianz_direct', 'regal'],
    strategy: 'obligatory_photo',
    directAssignment: true,
    requiresPhotoPeritage: true,
    requiresVideoPeritage: false,
    clientPaysUpfront: false,
    isCatchAll: false,
  },

  2: {
    id: 2,
    label: 'Grupo 2 — Perito aleatorio',
    description:
      'Asignación obligatoria al taller. El perito es asignado aleatoriamente por la aseguradora.',
    companies: ['mapfre', 'segur_caixa'],
    strategy: 'obligatory_random',
    directAssignment: true,
    requiresPhotoPeritage: false,
    requiresVideoPeritage: false,
    clientPaysUpfront: false,
    isCatchAll: false,
  },

  3: {
    id: 3,
    label: 'Grupo 3 — Occident (Tesla / No-Tesla)',
    description:
      'Lógica especial según marca del vehículo: Tesla sigue un flujo propio; resto sigue el estándar de Occident.',
    companies: ['occident'],
    strategy: 'occident_special',
    directAssignment: false,
    requiresPhotoPeritage: false,
    requiresVideoPeritage: false,
    clientPaysUpfront: false,
    isCatchAll: false,
  },

  4: {
    id: 4,
    label: 'Grupo 4 — Videoperitación 1 hora',
    description:
      'Se organiza una videoperitación que debe realizarse en la siguiente hora.',
    companies: ['reale'],
    strategy: 'video_1h',
    directAssignment: false,
    requiresPhotoPeritage: false,
    requiresVideoPeritage: true,
    clientPaysUpfront: false,
    isCatchAll: false,
  },

  5: {
    id: 5,
    label: 'Grupo 5 — No colaboradores',
    description:
      'Aseguradoras no colaboradoras. El cliente debe adelantar el pago; no se realiza peritaje previo.',
    companies: ['mutua_madrilena', 'pelayo', 'linea_directa'],
    strategy: 'non_collab',
    directAssignment: false,
    requiresPhotoPeritage: false,
    requiresVideoPeritage: false,
    clientPaysUpfront: true,
    isCatchAll: false,
  },

  6: {
    id: 6,
    label: 'Grupo 6 — Perito físico estándar',
    description:
      'Perito físico presencial estándar. Aplica a Zurich, AXA y cualquier aseguradora no listada en los grupos 1-5.',
    companies: ['zurich', 'axa'],
    strategy: 'standard_physical',
    directAssignment: false,
    requiresPhotoPeritage: false,
    requiresVideoPeritage: false,
    clientPaysUpfront: false,
    isCatchAll: true, // also matches any unknown insurer
  },
};

// ------------------------------------------------------------
// Lookup map: company key → group id
// (built from INSURANCE_GROUPS to avoid duplication)
// ------------------------------------------------------------

export const COMPANY_TO_GROUP: Readonly<Record<InsuranceCompanyKey, InsuranceGroupId>> =
  (() => {
    const map = {} as Record<InsuranceCompanyKey, InsuranceGroupId>;
    for (const group of Object.values(INSURANCE_GROUPS)) {
      for (const key of group.companies) {
        map[key] = group.id;
      }
    }
    return map;
  })();

// ------------------------------------------------------------
// Aliases: raw-text variants → canonical key
// Populated from common misspellings, trade names, etc.
// No AI decision-making here — pure lookup table.
// ------------------------------------------------------------

export const COMPANY_ALIASES: Readonly<Record<string, InsuranceCompanyKey>> = {

  // ----- Liberty -----
  // canonical + typos (missing/doubled/swapped letters) + articles + verb prefixes
  liberty: 'liberty',
  'liberty seguros': 'liberty',
  'liberty seguro': 'liberty',
  libery: 'liberty',           // missing t
  libertty: 'liberty',         // double t
  liverthy: 'liberty',         // v/b swap + transposition
  libert: 'liberty',           // truncated
  liber: 'liberty',            // truncated short
  liberti: 'liberty',          // phonetic i for y
  'la liberty': 'liberty',
  'el liberty': 'liberty',
  'tengo liberty': 'liberty',
  'soy de liberty': 'liberty',
  'estoy con liberty': 'liberty',

  // ----- Generali -----
  // canonical + double-l / j-for-g / y-for-i typos + articles
  generali: 'generali',
  'generali seguros': 'generali',
  generalli: 'generali',       // double l
  jenerali: 'generali',        // j for g (phonetic Spanish)
  generaly: 'generali',        // y for i
  generalii: 'generali',       // double i
  'la generali': 'generali',
  'el generali': 'generali',
  'tengo generali': 'generali',
  'soy de generali': 'generali',

  // ----- Allianz -----
  // canonical + one-l forms + tz→s + articles
  allianz: 'allianz',
  'allianz seguros': 'allianz',
  alians: 'allianz',           // one l, no z
  alianz: 'allianz',           // one l
  allians: 'allianz',          // tz→s
  'la allianz': 'allianz',
  'el allianz': 'allianz',
  'tengo allianz': 'allianz',
  // BBVA Allianz sub-brand (Allianz acquired BBVA Seguros)
  'bbva allianz': 'bbva_allianz',
  'bbva seguros': 'bbva_allianz',
  'bbva assegurances': 'bbva_allianz', // Catalan: assegurances = seguros
  // Allianz Direct sub-brand
  'allianz direct': 'allianz_direct',
  'allianz directo': 'allianz_direct',
  'allianz directa': 'allianz_direct',

  // ----- Regal -----
  // canonical + double-r + i-for-e + articles + Catalan suffix
  regal: 'regal',
  'regal seguros': 'regal',
  'regal assegurances': 'regal', // Catalan
  rreal: 'regal',              // double r
  rigal: 'regal',              // i for e
  'la regal': 'regal',
  'el regal': 'regal',
  'tengo regal': 'regal',

  // ----- Mapfre -----
  // canonical + missing-p / missing-f / n-for-p typos + articles + verb prefixes
  mapfre: 'mapfre',
  'mapfre seguros': 'mapfre',
  mafre: 'mapfre',             // missing p
  mapre: 'mapfre',             // missing f
  manfre: 'mapfre',            // n for p
  'el mapfre': 'mapfre',
  'la mapfre': 'mapfre',
  'tengo mapfre': 'mapfre',
  'tengo el mapfre': 'mapfre',
  'soy de mapfre': 'mapfre',
  'estoy con mapfre': 'mapfre',
  'el mafre': 'mapfre',        // article + typo
  'la mafre': 'mapfre',
  'tengo mafre': 'mapfre',
  'soy de mafre': 'mapfre',
  'estoy con mafre': 'mapfre',

  // ----- SegurCaixa -----
  // canonical + CaixaBank branding + Catalan "assegurances" + short forms
  segur_caixa: 'segur_caixa',
  segurcaixa: 'segur_caixa',
  'segur caixa': 'segur_caixa',
  segur: 'segur_caixa',
  caixa: 'segur_caixa',
  'la caixa': 'segur_caixa',
  'caixa seguros': 'segur_caixa',
  'caixabank seguros': 'segur_caixa',
  caixabank: 'segur_caixa',
  'caixa assegurances': 'segur_caixa',     // Catalan
  'la caixa assegurances': 'segur_caixa',  // Catalan with article

  // ----- Occident -----
  // canonical + Catalan brand form + Spanish -e suffix + x/ks typos + articles
  // Note: Occident is originally a Catalan insurer — no accent in canonical key
  occident: 'occident',
  'occident seguros': 'occident',
  'occident assegurances': 'occident', // Catalan
  occidente: 'occident',       // Spanish speakers add final -e
  ocident: 'occident',         // one c
  oxident: 'occident',         // x for cc
  oksident: 'occident',        // phonetic ks
  'la occident': 'occident',
  'el occident': 'occident',
  'tengo occident': 'occident',

  // ----- Reale -----
  // canonical + double-l / double-r typos + "real seguros" spoken form + articles
  reale: 'reale',
  'reale seguros': 'reale',
  realle: 'reale',             // double l
  rreale: 'reale',             // double r
  'real seguros': 'reale',     // spoken form — clients drop final -e
  'la reale': 'reale',
  'el reale': 'reale',
  'tengo reale': 'reale',

  // ----- Mutua Madrileña -----
  // All keys accent-free (input pre-cleaned); covers "mútua" (Catalan) via stripping
  mutua_madrilena: 'mutua_madrilena',
  'mutua madrilena': 'mutua_madrilena',
  'mutua madrilenya': 'mutua_madrilena',   // phonetic Catalan spelling
  'mutua madrilena seguros': 'mutua_madrilena',
  // Short colloquial forms — by far the most common inputs
  mutua: 'mutua_madrilena',
  'la mutua': 'mutua_madrilena',
  mutu: 'mutua_madrilena',                 // truncated / fast typing
  madrilena: 'mutua_madrilena',
  madrilenya: 'mutua_madrilena',           // Catalan pronunciation written out
  'mutua seguros': 'mutua_madrilena',
  'la mutua seguros': 'mutua_madrilena',
  'tengo la mutua': 'mutua_madrilena',
  'soy de la mutua': 'mutua_madrilena',
  'estoy con la mutua': 'mutua_madrilena',
  'tengo mutua': 'mutua_madrilena',

  // ----- Pelayo -----
  // canonical + double-l / transposition typos + Catalan form "Pelai" + articles
  pelayo: 'pelayo',
  'pelayo seguros': 'pelayo',
  pelallo: 'pelayo',           // ll for y (Spanish ll-y confusion)
  pellayo: 'pelayo',           // double l
  pelago: 'pelayo',            // y→g transposition
  'san pelayo': 'pelayo',      // some clients associate with the saint's name
  pelai: 'pelayo',             // Catalan form (Pelai = Pelayo)
  'la pelayo': 'pelayo',
  'el pelayo': 'pelayo',
  'tengo pelayo': 'pelayo',

  // ----- Línea Directa -----
  // Accent-free keys only (input pre-cleaned; "línea" → "linea" before lookup)
  linea_directa: 'linea_directa',
  'linea directa': 'linea_directa',
  'linea directa seguros': 'linea_directa',
  // Abbreviation and short forms
  ld: 'linea_directa',
  linea: 'linea_directa',
  'la linea': 'linea_directa',
  'la linea directa': 'linea_directa',
  // Typos
  'liena directa': 'linea_directa',   // transposed letters
  'linea directo': 'linea_directa',   // wrong gender suffix
  // Verb prefixes
  'tengo linea directa': 'linea_directa',
  'soy de linea directa': 'linea_directa',
  'estoy con linea directa': 'linea_directa',

  // ----- Zurich -----
  // "zürich" → "zurich" after accent stripping, so only accent-free keys needed
  zurich: 'zurich',
  'zurich seguros': 'zurich',
  zuric: 'zurich',             // missing h
  zurick: 'zurich',            // extra k
  surich: 'zurich',            // s for z (phonetic)
  zurik: 'zurich',             // missing h + k
  'la zurich': 'zurich',
  'el zurich': 'zurich',
  'tengo zurich': 'zurich',

  // ----- AXA -----
  // canonical + double-x typo + articles + Catalan suffix
  axa: 'axa',
  'axa seguros': 'axa',
  axxa: 'axa',                 // double x
  'la axa': 'axa',
  'el axa': 'axa',
  'axa direct': 'axa',
  'axa directo': 'axa',
  'axa assegurances': 'axa',   // Catalan
};

// ------------------------------------------------------------
// Car brand aliases: raw-text variants → canonical brand name
// Input is pre-cleaned (lowercase, no accents, no double spaces)
// before this lookup is performed.
// ------------------------------------------------------------

export const CAR_BRAND_ALIASES: Readonly<Record<string, string>> = {

  // ----- Toyota -----
  // typos: double letters, vowel swaps
  toyota: 'toyota',
  toyotta: 'toyota',           // double t
  toyata: 'toyota',            // missing o
  toyoda: 'toyota',            // d for t (founder's surname)

  // ----- Volkswagen -----
  // v/w/f confusion + g→h + missing letters; "vw" abbreviation
  volkswagen: 'volkswagen',
  vw: 'volkswagen',
  volkswahen: 'volkswagen',    // g→h
  wolkswagen: 'volkswagen',    // transposed v/w
  folkswagen: 'volkswagen',    // f for v (phonetic)
  wolksvagen: 'volkswagen',    // both transpositions
  folksvagen: 'volkswagen',

  // ----- BMW -----
  // abbreviation only + phonetic "beemer/bemer" + Spanish letter-spelling
  bmw: 'bmw',
  bm: 'bmw',                   // truncated abbreviation
  beeme: 'bmw',                // phonetic English "beemer"
  beme: 'bmw',                 // short phonetic
  bieme: 'bmw',                // phonetic variant
  'be eme doble uve': 'bmw',   // full Spanish letter names

  // ----- Mercedes -----
  // z-for-s typo + "Benz" shorthand + "merche" colloquial nickname
  mercedes: 'mercedes',
  mercedez: 'mercedes',        // z for s
  'mercedes benz': 'mercedes',
  'mercedes-benz': 'mercedes',
  merche: 'mercedes',          // very common colloquial nickname in Spain
  benz: 'mercedes',

  // ----- Audi -----
  // phonetic misspellings
  audi: 'audi',
  aody: 'audi',                // phonetic
  aoudi: 'audi',               // extra o

  // ----- Seat -----
  // cedilla stripped: "çeat" → "ceat" before lookup
  seat: 'seat',
  ceat: 'seat',                // çeat after cedilla stripped
  seet: 'seat',                // double e
  seit: 'seat',                // ei transposition

  // ----- Renault -----
  // phonetic Spanish "renol/reno" + truncations
  renault: 'renault',
  renol: 'renault',            // phonetic Spanish
  reno: 'renault',             // short phonetic
  renaul: 'renault',           // missing t
  renaut: 'renault',           // missing l

  // ----- Peugeot -----
  // phonetic Spanish "puyot/pugot" — silent letters confuse Spanish speakers
  peugeot: 'peugeot',
  puyot: 'peugeot',            // phonetic (eu→u, ge→y)
  peugot: 'peugeot',           // missing e
  pugot: 'peugeot',            // missing eu
  puyo: 'peugeot',             // very short phonetic
  peujot: 'peugeot',           // j for g

  // ----- Citroën -----
  // umlaut stripped before lookup: "citröen" → "citroen"; s-for-c phonetic
  citroen: 'citroen',
  sitroen: 'citroen',          // s for c (phonetic)
  citron: 'citroen',           // missing e
  citreon: 'citroen',          // transposed eo

  // ----- Ford -----
  ford: 'ford',
  'ford motor': 'ford',

  // ----- Opel -----
  // double-l typo
  opel: 'opel',
  opell: 'opel',               // double l

  // ----- Hyundai -----
  // silent-h dropping + vowel swaps
  hyundai: 'hyundai',
  hundai: 'hyundai',           // missing h
  iundai: 'hyundai',           // h→i phonetic
  hundei: 'hyundai',           // a→e vowel swap

  // ----- Kia -----
  // qu-for-k phonetic (Spanish spelling rule)
  kia: 'kia',
  quia: 'kia',                 // qu for k (Spanish phonetics)

  // ----- Nissan -----
  // single-s typo + truncation
  nissan: 'nissan',
  nisan: 'nissan',             // one s
  nissa: 'nissan',             // missing final n

  // ----- Mazda -----
  // z→s phonetic swap
  mazda: 'mazda',
  masda: 'mazda',              // z→s

  // ----- Volvo -----
  // b-for-v (b/v confusion in Spanish)
  volvo: 'volvo',
  bolvo: 'volvo',              // b for v (bilabial confusion)
  volbo: 'volvo',              // b for second v

  // ----- Tesla -----
  // double-l typo + plural form
  tesla: 'tesla',
  teslla: 'tesla',             // double l
  teslas: 'tesla',             // plural

  // ----- Skoda -----
  // c-for-k (Spanish spelling)
  skoda: 'skoda',
  scoda: 'skoda',              // c for k (Spanish phonetics)

  // ----- MINI -----
  mini: 'mini',
  'mini cooper': 'mini',

  // ----- Jeep -----
  // phonetic: Spanish "yip/jip" — j/y both represent the English /dʒ/ sound
  jeep: 'jeep',
  yip: 'jeep',                 // phonetic Spanish
  jip: 'jeep',                 // phonetic Spanish variant
  yep: 'jeep',                 // phonetic

  // ----- Fiat -----
  fiat: 'fiat',
  fiet: 'fiat',                // i→e vowel swap

  // ----- Dacia -----
  // c→ts/s phonetic (Romanian c sounds like ts, Spanish speakers write it out)
  dacia: 'dacia',
  datsia: 'dacia',             // phonetic: c→ts
  dasia: 'dacia',              // phonetic: c→s

  // ----- Honda -----
  // silent-h dropping (Spanish h is always silent)
  honda: 'honda',
  onda: 'honda',               // missing h (silent in Spanish)
  jonda: 'honda',              // h→j (hypercorrection)

  // ----- Mitsubishi -----
  // sh→s typo + i→y ending + truncations
  mitsubishi: 'mitsubishi',
  mitsubisi: 'mitsubishi',     // sh→s
  mitsubishy: 'mitsubishi',    // i→y
  mitsu: 'mitsubishi',         // truncated to prefix
  mitsubi: 'mitsubishi',       // truncated

  // ----- Suzuki -----
  // z→s + qu-for-k (Spanish phonetics)
  suzuki: 'suzuki',
  susuki: 'suzuki',            // z→s
  suzuqui: 'suzuki',           // k→qu (Spanish spelling)

  // ----- Porsche -----
  // missing letters: silent cluster "sch" simplified by Spanish speakers
  porsche: 'porsche',
  porche: 'porsche',           // missing s
  porshe: 'porsche',           // missing c
  porsh: 'porsche',            // missing ce

  // ----- Lexus -----
  // x→ks phonetic
  lexus: 'lexus',
  leksus: 'lexus',             // x→ks (phonetic spelling)

  // ----- Infiniti -----
  // "infinity" English spelling + truncation
  infiniti: 'infiniti',
  infinity: 'infiniti',        // common English spelling
  infinty: 'infiniti',         // missing i (fast typing)

  // ----- Land Rover -----
  // no-space form + "rango rover" (Spanish confusing rango/range) + model name used as brand
  'land rover': 'land rover',
  landrover: 'land rover',     // no space
  'rango rover': 'land rover', // "range" → "rango" (Spanish false cognate)
  'range rover': 'land rover', // model name used as brand name
  'land rober': 'land rover',  // v→b phonetic (bilabial)
  landrober: 'land rover',     // no-space + v→b

  // ----- Jaguar -----
  // double-a + g→q typos
  jaguar: 'jaguar',
  jaguaar: 'jaguar',           // double a
  jaquar: 'jaguar',            // g→q
};

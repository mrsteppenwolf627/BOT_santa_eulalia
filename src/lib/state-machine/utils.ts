/**
 * Shared keyword-matching utilities for the state machine.
 * All inputs are expected to be already normalised (lowercase, no accents).
 * Functions are pure — no side effects.
 */

const MENU =
  '1. Reparacion en curso\n' +
  '2. Nueva reparacion\n' +
  '3. Entrada en grua\n' +
  '4. Soy agente o tramitador\n' +
  '5. Consulta administrativa';

export { MENU };

// ------------------------------------------------------------
// Option parsers
// ------------------------------------------------------------

export function parseBranchOption(msg: string): 1 | 2 | 3 | 4 | 5 | null {
  const t = msg.trim();
  if (t === '1' || /\b(reparacion en curso|estado|como va|mi coche|seguimiento)\b/.test(t)) return 1;
  if (t === '2' || /\b(nueva reparacion|nueva|presupuesto|repara[rc]|quiero reparar)\b/.test(t)) return 2;
  if (t === '3' || /\b(grua|remolque|averia|accidente|no arranca|no funciona)\b/.test(t)) return 3;
  if (t === '4' || /\b(agente|tramitador|gestor|soy perito|compania|mediador)\b/.test(t)) return 4;
  if (t === '5' || /\b(admin|administrativo|factura|pago|consulta|contabilidad)\b/.test(t)) return 5;
  return null;
}

export function parsePaymentOption(msg: string): 1 | 2 | null {
  const t = msg.trim();
  if (t === '1' || /\b(particular|cliente|yo pago|mi cargo|propio|privado|sin seguro)\b/.test(t)) return 1;
  if (t === '2' || /\b(seguro|aseguradora|compan[yi]a|poliza|parte contrario|tercero)\b/.test(t)) return 2;
  return null;
}

export function parseOccidentOption(msg: string): 1 | 2 | null {
  const t = msg.trim();
  if (t === '1' || /\b(domicilio|casa|vienen|acude|me visitan|en mi)\b/.test(t)) return 1;
  if (t === '2' || /\b(taller|llevo|traigo|dejo|me acerco|voy yo)\b/.test(t)) return 2;
  return null;
}

export function parseNonCollabIntent(msg: string): 'come_in' | 'price_request' | null {
  if (/\b(precio|presupuesto|cuanto|sin venir|sin pasar|por foto|valoracion)\b/.test(msg)) return 'price_request';
  if (isAcceptance(msg) || /\b(vengo|voy|me acerco|me paso|cita|cuando puedo)\b/.test(msg)) return 'come_in';
  return null;
}

// ------------------------------------------------------------
// Sentiment helpers
// ------------------------------------------------------------

export function isAcceptance(msg: string): boolean {
  return /\b(si|ok|vale|perfecto|de acuerdo|claro|acepto|quiero|me interesa|adelante|por favor)\b/.test(msg);
}

export function isRejection(msg: string): boolean {
  return /\b(no|nop|prefiero|mejor no|otro|necesito otra|manual|diferente|no gracias)\b/.test(msg);
}

// ------------------------------------------------------------
// Cross-cutting trigger detectors
// ------------------------------------------------------------

export function isCourtesyCarRequest(msg: string): boolean {
  return /\b(coche de cortesia|coche cortesia|vehiculo sustituto|coche sustituto|carro sustituto|coche de prestamo|vehiculo prestamo)\b/.test(msg);
}

export function isTeslaDoubleVisitConcern(msg: string): boolean {
  return /\b(dos veces|2 veces|una sola vez|una cita|doble visita|no puedo venir dos|venir dos)\b/.test(msg);
}

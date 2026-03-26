import type { VehicleData } from '../../types/index';
import { supabase } from './client';

/** Returns a shallow copy of `obj` with null and undefined values removed. */
function stripNullish<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined),
  ) as Partial<T>;
}

/**
 * Maps the camelCase VehicleData fields to their snake_case DB column names.
 * Only keys present in `data` are included in the output.
 */
function toDbColumns(data: Partial<VehicleData>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  if ('licensePlate' in data) columns['license_plate'] = data.licensePlate;
  if ('brand'        in data) columns['brand']         = data.brand;
  if ('model'        in data) columns['model']         = data.model;
  if ('year'         in data) columns['year']          = data.year;
  if ('isTesla'      in data) columns['is_tesla']      = data.isTesla;
  if ('vin'          in data) columns['vin']           = data.vin;
  if ('color'        in data) columns['color']         = data.color;
  return columns;
}

/** Maps a snake_case DB row back to a VehicleData object. */
function fromDbRow(row: Record<string, unknown>): VehicleData {
  const data: VehicleData = {};
  if (row['license_plate'] != null) data.licensePlate = row['license_plate'] as string;
  if (row['brand']         != null) data.brand        = row['brand']         as string;
  if (row['model']         != null) data.model        = row['model']         as string;
  if (row['year']          != null) data.year         = row['year']          as number;
  if (row['is_tesla']      != null) data.isTesla      = row['is_tesla']      as boolean;
  if (row['vin']           != null) data.vin          = row['vin']           as string;
  if (row['color']         != null) data.color        = row['color']         as string;
  return data;
}

/**
 * Upserts vehicle data into the `vehicle_data` table keyed by `conversation_id`.
 * Only the fields present and non-null in `data` are written; existing fields
 * not included in the payload are left unchanged by Supabase's upsert semantics.
 */
export async function saveVehicleData(
  conversationId: string,
  data: Partial<VehicleData>,
): Promise<void> {
  const columns = toDbColumns(stripNullish(data));

  if (Object.keys(columns).length === 0) return;

  const { error } = await supabase
    .from('vehicle_data')
    .upsert({ conversation_id: conversationId, ...columns }, { onConflict: 'conversation_id' });

  if (error !== null) {
    throw new Error(`saveVehicleData(${conversationId}): upsert failed — ${error.message}`);
  }
}

/**
 * Returns the vehicle data for the given conversation, or null if no row exists yet.
 */
export async function getVehicleData(conversationId: string): Promise<VehicleData | null> {
  const { data, error } = await supabase
    .from('vehicle_data')
    .select('*')
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`getVehicleData(${conversationId}): query failed — ${error.message}`);
  }

  if (data === null) return null;

  return fromDbRow(data as Record<string, unknown>);
}

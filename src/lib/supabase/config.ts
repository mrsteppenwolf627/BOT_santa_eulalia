import type { TallerConfig } from '../../types/index';
import { supabase } from './client';

const CACHE_TTL_MS = 60_000; // 60 seconds

let cache: { data: TallerConfig; cachedAt: number } | null = null;

/**
 * Returns the taller configuration from Supabase.
 * Result is cached for 60 seconds to avoid a DB round-trip on every message.
 * Throws if the table is empty or the query fails.
 */
export async function getConfig(): Promise<TallerConfig> {
  const now = Date.now();

  if (cache !== null && now - cache.cachedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const { data, error } = await supabase
    .from('taller_config')
    .select('*')
    .single();

  if (error !== null || data === null) {
    throw new Error(
      `getConfig: failed to load taller_config — ${error?.message ?? 'no data returned'}`,
    );
  }

  cache = { data: data as unknown as TallerConfig, cachedAt: now };
  return cache.data;
}

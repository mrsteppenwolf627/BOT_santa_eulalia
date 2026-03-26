import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl) {
  throw new Error('Missing environment variable: SUPABASE_URL');
}
if (!supabaseServiceRoleKey) {
  throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
}

/**
 * Singleton Supabase client initialised with the service_role key.
 * MUST only be used in server-side code — never exposed to the client.
 */
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

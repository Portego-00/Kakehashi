export const SUPABASE_NOT_CONFIGURED_ERROR_CODE = "SUPABASE_NOT_CONFIGURED";

export const SUPABASE_NOT_CONFIGURED_MESSAGE =
  "Supabase is not configured. Set the public Supabase URL and anon key to enable Supabase-backed features.";

export function isSupabaseConfigComplete(config: {
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
}) {
  return Boolean(config.supabaseUrl?.trim() && config.supabaseAnonKey?.trim());
}

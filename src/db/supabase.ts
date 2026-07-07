
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_ENV_ERROR_MESSAGE =
  "缺少 Supabase 环境变量，请在 Vercel 中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function createMissingSupabaseClient(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(SUPABASE_ENV_ERROR_MESSAGE);
    },
  });
}

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMissingSupabaseClient();

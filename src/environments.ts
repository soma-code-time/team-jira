export const environment = {
  supabaseUrl: (globalThis as any).__SUPABASE_URL__ || '',
  supabaseAnonKey: (globalThis as any).__SUPABASE_ANON_KEY__ || ''
};
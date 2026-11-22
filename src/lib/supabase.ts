import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_PUBLIC_SUPABASE_URL = 'https://avsdaviludflfedkxzys.supabase.co';
const DEFAULT_PUBLIC_SUPABASE_KEY = 'sb_publishable_UAlk63CEsWWL1rFOhJi6aA_ntkz9FqV';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_PUBLIC_SUPABASE_URL).trim();
const supabasePublicKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_PUBLIC_SUPABASE_KEY
).trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublicKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublicKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function syncOwnSupabaseProfile(input: {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
}): Promise<void> {
  if (!supabase || !input.id) return;
  try {
    const payload: Record<string, unknown> = { id: input.id };
    if (input.fullName !== undefined) payload.full_name = input.fullName;
    if (input.email !== undefined) payload.email = input.email.toLowerCase();
    if (input.phone !== undefined) payload.phone = input.phone;

    await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
  } catch {
    // Trigger on auth.users handles creation if RLS insert isn't triggered yet
  }
}

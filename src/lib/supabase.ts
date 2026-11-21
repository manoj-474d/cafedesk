import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabasePublicKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublicKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublicKey, {
      auth: {
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

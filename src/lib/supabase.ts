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

export interface BrowserSupabaseProfileRow {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  account_status?: string | null;
  email_verified?: boolean | null;
}

export async function syncOwnSupabaseProfile(input: {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  authProvider?: 'email' | 'google';
}): Promise<void> {
  if (!supabase || !input.id) return;
  try {
    const payload: Record<string, unknown> = {
      id: input.id,
      updated_at: new Date().toISOString(),
    };
    if (input.fullName !== undefined) payload.full_name = input.fullName;
    if (input.email !== undefined) payload.email = input.email.toLowerCase();
    if (input.phone !== undefined) payload.phone = input.phone;
    if (input.avatarUrl !== undefined) payload.avatar_url = input.avatarUrl;
    if (input.authProvider !== undefined) payload.auth_provider = input.authProvider;

    await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
  } catch {
    // Trigger on auth.users handles creation if RLS insert isn't triggered yet
  }
}

export async function fetchOwnSupabaseProfile(
  id: string
): Promise<BrowserSupabaseProfileRow | null> {
  if (!supabase || !id) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, avatar_url, account_status, email_verified')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return data as BrowserSupabaseProfileRow;
  } catch {
    return null;
  }
}

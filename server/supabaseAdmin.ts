import { EventEmitter } from 'node:events';
import { createClient, type RealtimeChannel, type SupabaseClient, type User } from '@supabase/supabase-js';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_PUBLIC_KEY = (
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

let adminClient: SupabaseClient | null = null;
let publicVerifyClient: SupabaseClient | null = null;
let realtimeChannel: RealtimeChannel | null = null;
let realtimeStarted = false;

export const userDirectoryEvents = new EventEmitter();
userDirectoryEvents.setMaxListeners(100);

export interface UserDirectoryBroadcastEvent {
  type: 'user_created' | 'user_updated' | 'user_login' | 'user_status' | 'user_deleted' | 'supabase_realtime';
  userId?: number;
  supabaseId?: string;
  email?: string;
  timestamp: number;
}

export function notifyUserDirectoryChange(event: Omit<UserDirectoryBroadcastEvent, 'timestamp'>): void {
  userDirectoryEvents.emit('change', {
    ...event,
    timestamp: Date.now(),
  } satisfies UserDirectoryBroadcastEvent);
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

export function isSupabaseAuthVerifyConfigured(): boolean {
  return Boolean(SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_PUBLIC_KEY));
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabaseAdminConfigured()) return null;
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
}

function getSupabaseVerifyClient(): SupabaseClient | null {
  const admin = getSupabaseAdminClient();
  if (admin) return admin;
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) return null;
  if (!publicVerifyClient) {
    publicVerifyClient = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return publicVerifyClient;
}

export function startSupabaseProfilesRealtimeListener(): void {
  if (realtimeStarted) return;
  const client = getSupabaseAdminClient();
  if (!client) return;
  realtimeStarted = true;

  try {
    realtimeChannel = client
      .channel('cafedesk-admin-profiles-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          const rec = (payload.new || payload.old || {}) as Record<string, unknown>;
          notifyUserDirectoryChange({
            type: 'supabase_realtime',
            supabaseId: typeof rec.id === 'string' ? rec.id : undefined,
            email: typeof rec.email === 'string' ? rec.email : undefined,
          });
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('Supabase Realtime profile listener skipped:', err);
  }
}

export async function verifySupabaseAccessToken(accessToken: string): Promise<User | null> {
  const client = getSupabaseVerifyClient();
  if (!client || !accessToken) return null;
  try {
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export interface SupabaseProfileRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string;
  auth_provider: 'email' | 'google';
  email_verified: boolean;
  account_status: 'active' | 'suspended';
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function upsertSupabaseProfile(input: {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  authProvider?: 'email' | 'google';
  emailVerified?: boolean;
  accountStatus?: 'active' | 'suspended';
  lastLoginIso?: string | null;
}): Promise<SupabaseProfileRow | null> {
  const client = getSupabaseAdminClient();
  if (!client || !input.id) return null;

  try {
    const payload: Record<string, unknown> = {
      id: input.id,
      full_name: input.fullName,
      email: input.email.toLowerCase(),
      updated_at: new Date().toISOString(),
    };
    if (input.phone !== undefined) payload.phone = input.phone;
    if (input.avatarUrl !== undefined) payload.avatar_url = input.avatarUrl;
    if (input.authProvider !== undefined) payload.auth_provider = input.authProvider;
    if (input.emailVerified !== undefined) payload.email_verified = input.emailVerified;
    if (input.accountStatus !== undefined) payload.account_status = input.accountStatus;
    if (input.lastLoginIso !== undefined) payload.last_login_at = input.lastLoginIso;

    const { data, error } = await client
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      console.warn('Supabase upsertSupabaseProfile warning:', error.message);
      return null;
    }
    return data as SupabaseProfileRow;
  } catch (err) {
    console.warn('Supabase upsertSupabaseProfile exception:', err);
    return null;
  }
}

export async function getSupabaseProfileById(supabaseUserId: string): Promise<SupabaseProfileRow | null> {
  const client = getSupabaseAdminClient();
  if (!client || !supabaseUserId) return null;
  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', supabaseUserId)
      .maybeSingle();
    if (error || !data) return null;
    return data as SupabaseProfileRow;
  } catch {
    return null;
  }
}

export async function createSupabaseAuthUserFromLocalSignup(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}): Promise<User | null> {
  const client = getSupabaseAdminClient();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.admin.createUser({
      email: input.email.toLowerCase(),
      password: input.password,
      email_confirm: false,
      user_metadata: {
        full_name: input.fullName,
        phone: input.phone || '',
      },
    });
    if (error || !data?.user) {
      return null;
    }
    await upsertSupabaseProfile({
      id: data.user.id,
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      phone: input.phone || '',
      authProvider: 'email',
      emailVerified: false,
      accountStatus: 'active',
      lastLoginIso: new Date().toISOString(),
    });
    return data.user;
  } catch {
    return null;
  }
}

export async function recordSupabaseLoginEvent(input: {
  supabaseUserId: string;
  provider: 'email' | 'google';
  eventType: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const client = getSupabaseAdminClient();
  if (!client || !input.supabaseUserId) return;
  try {
    await client.from('user_login_events').insert({
      user_id: input.supabaseUserId,
      provider: input.provider,
      event_type: input.eventType,
      ip_address: (input.ipAddress || '').slice(0, 64),
      user_agent: (input.userAgent || '').slice(0, 200),
    });
  } catch {
    // Non-blocking audit mirror
  }
}

export async function listAllSupabaseProfiles(): Promise<SupabaseProfileRow[]> {
  const client = getSupabaseAdminClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error || !Array.isArray(data)) return [];
    return data as SupabaseProfileRow[];
  } catch {
    return [];
  }
}

export async function listSupabaseUserLoginEvents(supabaseUserId: string): Promise<
  Array<{
    id: number;
    provider: string;
    event_type: string;
    ip_address: string;
    user_agent: string;
    created_at: number;
  }>
> {
  const client = getSupabaseAdminClient();
  if (!client || !supabaseUserId) return [];
  try {
    const { data, error } = await client
      .from('user_login_events')
      .select('*')
      .eq('user_id', supabaseUserId)
      .order('created_at', { ascending: false })
      .limit(40);
    if (error || !Array.isArray(data)) return [];
    return data.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      provider: String(row.provider || 'email'),
      event_type: String(row.event_type || 'login'),
      ip_address: String(row.ip_address || ''),
      user_agent: String(row.user_agent || ''),
      created_at: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
    }));
  } catch {
    return [];
  }
}

export async function updateSupabaseAccountStatus(
  supabaseUserId: string,
  status: 'active' | 'suspended'
): Promise<boolean> {
  const client = getSupabaseAdminClient();
  if (!client || !supabaseUserId) return false;
  try {
    await client
      .from('profiles')
      .update({
        account_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', supabaseUserId);

    await client.auth.admin.updateUserById(supabaseUserId, {
      ban_duration: status === 'suspended' ? '876000h' : 'none',
    });
    return true;
  } catch (err) {
    console.warn('Supabase updateSupabaseAccountStatus error:', err);
    return false;
  }
}

export async function markSupabaseEmailVerified(supabaseUserId: string): Promise<void> {
  const client = getSupabaseAdminClient();
  if (!client || !supabaseUserId) return;
  try {
    await client.auth.admin.updateUserById(supabaseUserId, {
      email_confirm: true,
    });
    await client
      .from('profiles')
      .update({
        email_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', supabaseUserId);
  } catch {
    // Non-blocking
  }
}

export async function deleteSupabaseUser(supabaseUserId: string): Promise<boolean> {
  const client = getSupabaseAdminClient();
  if (!client || !supabaseUserId) return false;
  try {
    const { error } = await client.auth.admin.deleteUser(supabaseUserId);
    return !error;
  } catch {
    return false;
  }
}

export function stopSupabaseRealtime(): void {
  if (realtimeChannel && adminClient) {
    void adminClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
    realtimeStarted = false;
  }
}

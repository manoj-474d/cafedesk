import type {
  PaymentRecord,
  PlanPermissions,
  PlanTier,
  SubscriptionHistoryItem,
  SubscriptionPlan,
  UserProfile,
  UserSubscription,
} from './src/types/subscription';
import {
  handleWorkerAdminAndBootstrapRoutes,
  type AdminWorkerEnv,
} from './server/workerAdmin.ts';

interface WorkerEnv extends AdminWorkerEnv {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  RAZORPAY_KEY_ID?: string;
  VITE_RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  GOOGLE_PLACES_API_KEY?: string;
  GOOGLE_MAPS_API_KEY?: string;
  VITE_GOOGLE_MAPS_API_KEY?: string;
}

interface WorkerSessionPayload {
  sub: string;
  email: string;
  name: string;
  phone: string;
  avatar: string;
  provider: 'email' | 'google';
  emailVerified: boolean;
  createdAt: number;
  exp: number;
}

interface WorkerOrderTokenPayload {
  orderId: string;
  paymentId: number;
  receiptNumber: string;
  userId: string;
  planId: PlanTier;
  planName: string;
  amountInr: number;
  durationDays: number;
  createdAt: number;
  exp: number;
}

const DEFAULT_SUPABASE_URL = 'https://avsdaviludflfedkxzys.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_UAlk63CEsWWL1rFOhJi6aA_ntkz9FqV';
const USER_SESSION_COOKIE = 'cafedesk_user_session';

const FREE_PERMISSIONS: PlanPermissions = {
  wifi_details: false,
  power_sockets: false,
  workspace_details: false,
  food_menu: false,
  menu_pricing: false,
  amenities: false,
  subscriber_benefits: false,
  booking: false,
  collections: false,
  compare: false,
};

const PAID_PERMISSIONS: PlanPermissions = {
  wifi_details: true,
  power_sockets: true,
  workspace_details: true,
  food_menu: true,
  menu_pricing: true,
  amenities: true,
  subscriber_benefits: true,
  booking: true,
  collections: true,
  compare: true,
};

const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free Explorer',
    tagline:
      'Discover Bengaluru cafes, save favourites, check laptops, seating, study, noise & sockets.',
    price_inr: 0,
    interval_days: 0,
    badge_text: 'Free Forever',
    is_recommended: false,
    features: [
      'Search cafes across Bengaluru by name, locality & live autocomplete',
      'Discover nearby cafes using GPS distance, photos & Google Maps directions',
      'Interactive Cafe Finder & curated Bengaluru discovery collections',
      'Laptop-friendly status, seating, studying, noise level, sockets & ambience',
      'Save & bookmark favourite Bengaluru cafes to your free account',
    ],
    permissions: { ...FREE_PERMISSIONS },
    cafe_access_scope: 'all',
    sort_order: 1,
    active: true,
    updated_at: 0,
  },
  {
    id: 'plus',
    name: 'Cafe Desk Plus (Monthly)',
    tagline: 'Complete menus & prices, budget filters, verified Wi-Fi speeds, comparisons & deals.',
    price_inr: 79,
    interval_days: 30,
    badge_text: 'Most Popular',
    is_recommended: true,
    features: [
      'Everything in Free Explorer',
      'Full food & beverage menus, coffee/tea/snack prices & average budget per person',
      'Verified Wi-Fi availability, measured speeds (Mbps) & work/meeting filters',
      'Advanced budget & food category filters',
      'Compare multiple cafes side-by-side (up to 4 cafes)',
      'Personal custom cafe collections & personalized recommendations',
      'Exclusive cafe deals, partner perks & student discounts',
    ],
    permissions: { ...PAID_PERMISSIONS },
    cafe_access_scope: 'all',
    sort_order: 2,
    active: true,
    updated_at: 0,
  },
  {
    id: 'premium',
    name: 'Cafe Desk Plus (Annual)',
    tagline: 'Full Cafe Desk Plus access all year — save 47% over monthly billing.',
    price_inr: 499,
    interval_days: 365,
    badge_text: 'Best Value · Save 47%',
    is_recommended: false,
    features: [
      'All Cafe Desk Plus features unlocked for 365 days (₹42/mo effective)',
      'Full food & beverage menus, prices & average budget filters',
      'Verified Wi-Fi speeds, remote work & meeting filters',
      'Side-by-side cafe comparison & unlimited custom collections',
      'Personalized cafe recommendations & exclusive partner deals',
    ],
    permissions: { ...PAID_PERMISSIONS },
    cafe_access_scope: 'all',
    sort_order: 3,
    active: true,
    updated_at: 0,
  },
];

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function cleanStr(val: unknown, maxLen = 400): string {
  return String(val ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function getSupabaseConfig(env: WorkerEnv) {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL)
    .trim()
    .replace(/\/+$/, '');
  const publishableKey = (
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_KEY
  ).trim();
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, publishableKey, serviceRoleKey };
}

function getRazorpayCredentials(env: WorkerEnv) {
  const keyId = (env.RAZORPAY_KEY_ID || env.VITE_RAZORPAY_KEY_ID || '').trim();
  const keySecret = (env.RAZORPAY_KEY_SECRET || '').trim();
  const missing: string[] = [];
  if (!keyId) missing.push('RAZORPAY_KEY_ID');
  if (!keySecret) missing.push('RAZORPAY_KEY_SECRET');
  return {
    keyId,
    keySecret,
    hasKeyId: Boolean(keyId),
    hasKeySecret: Boolean(keySecret),
    missing,
    enabled: Boolean(keyId && keySecret),
  };
}

function getSigningSecret(env: WorkerEnv): string {
  const explicit = (env.SESSION_SECRET || '').trim();
  if (explicit) return explicit;
  const { serviceRoleKey, publishableKey, url } = getSupabaseConfig(env);
  const { keySecret } = getRazorpayCredentials(env);
  return `${url}:${serviceRoleKey || keySecret || publishableKey}`;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Uint8Array | null {
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, textEncoder.encode(message));
  return toHex(sig);
}

async function signJsonToken(secret: string, payload: unknown): Promise<string> {
  const encoded = toBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const sig = await hmacSha256Hex(secret, encoded);
  return `${encoded}.${sig}`;
}

async function verifyJsonToken<T>(secret: string, token: string): Promise<T | null> {
  if (!token || !token.includes('.')) return null;
  const dotIdx = token.indexOf('.');
  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!encoded || !sig) return null;
  const expected = await hmacSha256Hex(secret, encoded);
  if (!timingSafeEqualStr(expected, sig)) return null;
  const decodedBytes = fromBase64Url(encoded);
  if (!decodedBytes) return null;
  try {
    return JSON.parse(textDecoder.decode(decodedBytes)) as T;
  } catch {
    return null;
  }
}

function randomHex(byteLen = 6): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

function makeReceiptNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `CD-${datePart}-${randomHex(3).toUpperCase()}`;
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function buildCookieHeader(
  name: string,
  value: string,
  maxAgeSec: number,
  isHttps: boolean
): string {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSec}`,
    isHttps ? 'Secure' : '',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
  ].filter(Boolean);
  return attrs.join('; ');
}

function corsHeadersFor(req: Request, env: WorkerEnv): HeadersInit {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-CafeDesk-Session, X-CSRF-Token',
    'Access-Control-Allow-Credentials': 'true',
  };
  if (origin) {
    const allowedList = (env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const reqOrigin = new URL(req.url).origin;
    const isAllowed =
      origin === reqOrigin ||
      origin === 'https://cafedesk.space' ||
      origin === 'https://www.cafedesk.space' ||
      origin.endsWith('.cafedesk.space') ||
      origin.endsWith('.workers.dev') ||
      origin.endsWith('.pages.dev') ||
      origin.startsWith('http://localhost:') ||
      allowedList.includes(origin);
    if (isAllowed) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Vary'] = 'Origin';
    }
  }
  return headers;
}

function jsonResponse(
  req: Request,
  env: WorkerEnv,
  body: unknown,
  status = 200,
  setCookies: string[] = []
): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...corsHeadersFor(req, env),
  });
  for (const cookie of setCookies) {
    headers.append('Set-Cookie', cookie);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function supabaseServiceRest(
  env: WorkerEnv,
  path: string,
  init: RequestInit = {}
): Promise<Response | null> {
  const { url, serviceRoleKey } = getSupabaseConfig(env);
  if (!serviceRoleKey) return null;
  const headers = new Headers(init.headers);
  headers.set('apikey', serviceRoleKey);
  headers.set('Authorization', `Bearer ${serviceRoleKey}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${url}/rest/v1/${path.replace(/^\/+/, '')}`, {
    ...init,
    headers,
  });
}

async function verifySupabaseJwt(
  accessToken: string,
  env: WorkerEnv
): Promise<{
  id: string;
  email: string;
  name: string;
  phone: string;
  avatar: string;
  provider: 'email' | 'google';
  emailVerified: boolean;
  createdAt: number;
} | null> {
  if (!accessToken) return null;
  const { url, publishableKey, serviceRoleKey } = getSupabaseConfig(env);
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: serviceRoleKey || publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) return null;
    const sbUser = (await res.json()) as {
      id?: string;
      email?: string;
      phone?: string;
      email_confirmed_at?: string | null;
      created_at?: string;
      user_metadata?: Record<string, unknown>;
      app_metadata?: Record<string, unknown>;
    };
    const meta = sbUser.user_metadata || {};
    const appMeta = sbUser.app_metadata || {};
    const email = String(sbUser.email || meta.email || '').trim().toLowerCase();
    if (!sbUser.id || !email) return null;
    const provider: 'email' | 'google' = appMeta.provider === 'google' ? 'google' : 'email';
    const name =
      cleanStr(meta.full_name || meta.name || email.split('@')[0], 80) || 'Cafe Desk Member';
    const phone = cleanStr(meta.phone || sbUser.phone || '', 24);
    const avatar = cleanStr(meta.avatar_url || meta.picture || '', 400);
    const createdAt = sbUser.created_at
      ? new Date(sbUser.created_at).getTime() || Date.now()
      : Date.now();
    return {
      id: sbUser.id,
      email,
      name,
      phone,
      avatar,
      provider,
      emailVerified: Boolean(sbUser.email_confirmed_at || provider === 'google'),
      createdAt,
    };
  } catch {
    return null;
  }
}

async function resolveWorkerUser(
  req: Request,
  env: WorkerEnv
): Promise<{
  session: WorkerSessionPayload;
  bearerToken: string;
} | null> {
  const authHeader = req.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (bearerToken) {
    const sbUser = await verifySupabaseJwt(bearerToken, env);
    if (sbUser) {
      return {
        session: {
          sub: sbUser.id,
          email: sbUser.email,
          name: sbUser.name,
          phone: sbUser.phone,
          avatar: sbUser.avatar,
          provider: sbUser.provider,
          emailVerified: sbUser.emailVerified,
          createdAt: sbUser.createdAt,
          exp: Date.now() + 14 * 24 * 60 * 60 * 1000,
        },
        bearerToken,
      };
    }
  }

  const cookies = parseCookies(req.headers.get('cookie'));
  const sessionToken =
    (req.headers.get('x-cafedesk-session') || '').trim() || cookies[USER_SESSION_COOKIE] || '';
  if (!sessionToken) return null;

  const parsed = await verifyJsonToken<WorkerSessionPayload>(getSigningSecret(env), sessionToken);
  if (parsed && parsed.sub && parsed.email && parsed.exp > Date.now()) {
    return { session: parsed, bearerToken: '' };
  }
  return null;
}

async function fetchPlansFromSupabaseOrDefault(env: WorkerEnv): Promise<SubscriptionPlan[]> {
  const { url, publishableKey } = getSupabaseConfig(env);
  try {
    const res = await fetch(
      `${url}/rest/v1/subscription_plans?active=eq.true&order=sort_order.asc`,
      {
        headers: {
          apikey: publishableKey,
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) return DEFAULT_PLANS;
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(rows) || rows.length === 0) return DEFAULT_PLANS;
    return rows.map((r, idx) => ({
      id: String(r.id) as PlanTier,
      name: String(r.name || r.id),
      tagline: String(r.tagline || ''),
      price_inr: Number(r.price_inr ?? 0),
      interval_days: Number(r.interval_days ?? 30),
      badge_text: String(r.badge_text || ''),
      is_recommended: Boolean(r.is_recommended),
      features: Array.isArray(r.features) ? (r.features as string[]) : [],
      permissions:
        r.permissions && typeof r.permissions === 'object'
          ? { ...FREE_PERMISSIONS, ...(r.permissions as Partial<PlanPermissions>) }
          : Number(r.price_inr ?? 0) > 0
            ? { ...PAID_PERMISSIONS }
            : { ...FREE_PERMISSIONS },
      cafe_access_scope: r.cafe_access_scope === 'specific' ? 'specific' : 'all',
      sort_order: Number(r.sort_order ?? idx + 1),
      active: Boolean(r.active ?? true),
      updated_at: r.updated_at ? new Date(String(r.updated_at)).getTime() || Date.now() : Date.now(),
    }));
  } catch {
    return DEFAULT_PLANS;
  }
}

function buildFreeSubscription(createdAt: number): UserSubscription {
  return {
    id: 0,
    user_id: 0,
    plan_id: 'free',
    plan_name: 'Free Explorer',
    price_inr: 0,
    subscribed_price_inr: 0,
    status: 'active',
    started_at: createdAt,
    expires_at: null,
    auto_renew: false,
    cancelled_at: null,
    expired: false,
    effective_active: false,
    permissions: { ...FREE_PERMISSIONS },
    updated_at: Date.now(),
  };
}

function mapSupabaseSubRow(
  row: Record<string, unknown>,
  plans: SubscriptionPlan[]
): UserSubscription {
  const now = Date.now();
  const planId = String(row.plan_id || 'free') as PlanTier;
  const rawStatus = String(row.status || 'active') as UserSubscription['status'];
  const startedAt = row.started_at ? new Date(String(row.started_at)).getTime() : now;
  const expiresAt = row.expires_at ? new Date(String(row.expires_at)).getTime() : null;
  const cancelledAt = row.cancelled_at ? new Date(String(row.cancelled_at)).getTime() : null;
  const expiredAt = row.expired_at ? new Date(String(row.expired_at)).getTime() : null;
  const suspendedAt = row.suspended_at ? new Date(String(row.suspended_at)).getTime() : null;
  const updatedAt = row.updated_at ? new Date(String(row.updated_at)).getTime() : now;

  const isExpired =
    rawStatus === 'expired' ||
    (planId !== 'free' && expiresAt !== null && expiresAt <= now);
  const isSuspended = rawStatus === 'suspended';
  const effectiveActive =
    planId !== 'free' &&
    !isExpired &&
    !isSuspended &&
    (rawStatus === 'active' || rawStatus === 'cancelled') &&
    (expiresAt === null || expiresAt > now);
  const matchedPlan = plans.find((p) => p.id === planId);
  const priceInr = Number(row.subscribed_price_inr ?? matchedPlan?.price_inr ?? 0);

  return {
    id: Number(row.id ?? 1),
    user_id: 0,
    plan_id: isExpired ? 'free' : planId,
    plan_name: isExpired ? 'Free Explorer' : matchedPlan?.name || planId,
    price_inr: isExpired ? 0 : priceInr,
    subscribed_price_inr: isExpired ? 0 : priceInr,
    status: isExpired ? 'expired' : rawStatus,
    started_at: startedAt,
    expires_at: expiresAt,
    auto_renew: Boolean(row.auto_renew),
    cancelled_at: cancelledAt,
    expired: isExpired,
    expired_from_plan: isExpired ? planId : (row.expired_from_plan ? String(row.expired_from_plan) : null),
    expired_from_plan_name: isExpired ? matchedPlan?.name || planId : null,
    expired_at: isExpired ? expiredAt || expiresAt : null,
    suspended_at: suspendedAt,
    effective_active: effectiveActive,
    permissions: effectiveActive
      ? matchedPlan?.permissions || { ...PAID_PERMISSIONS }
      : { ...FREE_PERMISSIONS },
    updated_at: updatedAt,
  };
}

async function fetchUserSubscriptionFromSupabase(
  env: WorkerEnv,
  session: WorkerSessionPayload,
  bearerToken: string,
  plans: SubscriptionPlan[]
): Promise<{ subscription: UserSubscription; accountSuspended: boolean }> {
  const { url, publishableKey, serviceRoleKey } = getSupabaseConfig(env);
  const authKey = serviceRoleKey || bearerToken;

  if (!authKey) {
    return { subscription: buildFreeSubscription(session.createdAt), accountSuspended: false };
  }

  try {
    const profileRes = await fetch(
      `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(session.sub)}&select=account_status`,
      {
        headers: {
          apikey: serviceRoleKey || publishableKey,
          Authorization: `Bearer ${authKey}`,
          Accept: 'application/json',
        },
      }
    );
    if (profileRes.ok) {
      const profiles = (await profileRes.json()) as Array<{ account_status?: string }>;
      if (profiles[0]?.account_status === 'suspended') {
        return {
          subscription: {
            ...buildFreeSubscription(session.createdAt),
            status: 'suspended',
          },
          accountSuspended: true,
        };
      }
    }

    const subRes = await fetch(
      `${url}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(session.sub)}&select=*`,
      {
        headers: {
          apikey: serviceRoleKey || publishableKey,
          Authorization: `Bearer ${authKey}`,
          Accept: 'application/json',
        },
      }
    );
    if (!subRes.ok) {
      return { subscription: buildFreeSubscription(session.createdAt), accountSuspended: false };
    }
    const rows = (await subRes.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(rows) || !rows[0]) {
      return { subscription: buildFreeSubscription(session.createdAt), accountSuspended: false };
    }
    return {
      subscription: mapSupabaseSubRow(rows[0], plans),
      accountSuspended: false,
    };
  } catch {
    return { subscription: buildFreeSubscription(session.createdAt), accountSuspended: false };
  }
}

async function ensureSupabaseProfileExists(
  env: WorkerEnv,
  session: WorkerSessionPayload
): Promise<void> {
  await supabaseServiceRest(env, 'profiles?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      id: session.sub,
      full_name: session.name,
      email: session.email,
      phone: session.phone,
      avatar_url: session.avatar,
      auth_provider: session.provider,
      email_verified: session.emailVerified,
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  }).catch(() => {});
}

function buildWorkerUserProfile(session: WorkerSessionPayload): UserProfile {
  return {
    id: 1,
    supabase_id: session.sub,
    name: session.name,
    email: session.email,
    phone: session.phone,
    avatar_url: session.avatar,
    auth_provider: session.provider,
    email_verified: session.emailVerified,
    status: 'active',
    last_login_at: Date.now(),
    created_at: session.createdAt,
  };
}

async function createRazorpayOrderApi(
  keyId: string,
  keySecret: string,
  payload: { amount: number; currency: string; receipt: string; notes: Record<string, string> }
): Promise<
  | { ok: true; id: string; amount: number; currency: string }
  | { ok: false; status: number; message: string }
> {
  const auth = btoa(`${keyId}:${keySecret}`);
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    data = {};
  }
  if (!res.ok || !data.id) {
    const errObj = data.error as { description?: string } | undefined;
    return {
      ok: false,
      status: res.status || 502,
      message: cleanStr(errObj?.description || 'Razorpay API request failed.', 240),
    };
  }
  return {
    ok: true,
    id: String(data.id),
    amount: Number(data.amount ?? payload.amount),
    currency: String(data.currency || payload.currency),
  };
}

async function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string
): Promise<boolean> {
  if (!orderId || !paymentId || !signature || !keySecret) return false;
  const expected = await hmacSha256Hex(keySecret, `${orderId}|${paymentId}`);
  return timingSafeEqualStr(expected, signature.trim());
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const isHttps = url.protocol === 'https:';

    if (!pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeadersFor(request, env) });
    }

    const secret = getSigningSecret(env);

    // Health check
    if (pathname === '/api/health' && request.method === 'GET') {
      const { serviceRoleKey } = getSupabaseConfig(env);
      const { enabled: razorpayConfigured, hasKeyId, hasKeySecret } = getRazorpayCredentials(env);
      return jsonResponse(request, env, {
        ok: true,
        runtime: 'cloudflare-worker',
        razorpayConfigured,
        razorpayKeyIdConfigured: hasKeyId,
        razorpayKeySecretConfigured: hasKeySecret,
        supabaseAdminConfigured: Boolean(serviceRoleKey),
      });
    }

    // Analytics visit
    if (pathname === '/api/analytics/visit' && request.method === 'POST') {
      return jsonResponse(request, env, { ok: true });
    }

    // Subscription Plans + Razorpay status (never exposes keySecret)
    if (pathname === '/api/plans' && request.method === 'GET') {
      const plans = await fetchPlansFromSupabaseOrDefault(env);
      const { keyId, enabled } = getRazorpayCredentials(env);
      return jsonResponse(request, env, {
        plans,
        razorpayEnabled: enabled,
        razorpayKeyId: enabled ? keyId : '',
      });
    }

    // Auth: Exchange Supabase JWT for Worker session cookie & token
    if (pathname === '/api/auth/supabase-exchange' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const authHeader = request.headers.get('authorization') || '';
      const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const accessToken = cleanStr(body.accessToken || bearer, 8192);
      if (!accessToken) {
        return jsonResponse(request, env, { error: 'Supabase access token is required.' }, 400);
      }

      const sbUser = await verifySupabaseJwt(accessToken, env);
      if (!sbUser) {
        return jsonResponse(
          request,
          env,
          { error: 'Invalid or expired Supabase authentication session.' },
          401
        );
      }

      const requestedName = cleanStr(body.fullName, 80);
      const requestedPhone = cleanStr(body.phone, 24);
      const now = Date.now();
      const sessionPayload: WorkerSessionPayload = {
        sub: sbUser.id,
        email: sbUser.email,
        name: requestedName || sbUser.name,
        phone: requestedPhone || sbUser.phone,
        avatar: sbUser.avatar,
        provider: sbUser.provider,
        emailVerified: sbUser.emailVerified,
        createdAt: sbUser.createdAt,
        exp: now + 14 * 24 * 60 * 60 * 1000,
      };

      const plans = await fetchPlansFromSupabaseOrDefault(env);
      const { subscription, accountSuspended } = await fetchUserSubscriptionFromSupabase(
        env,
        sessionPayload,
        accessToken,
        plans
      );
      if (accountSuspended) {
        return jsonResponse(
          request,
          env,
          { error: 'Your account has been suspended by an administrator. Please contact support.' },
          403
        );
      }

      await ensureSupabaseProfileExists(env, sessionPayload);
      const sessionToken = await signJsonToken(secret, sessionPayload);

      return jsonResponse(
        request,
        env,
        {
          authenticated: true,
          user: buildWorkerUserProfile(sessionPayload),
          subscription,
          savedCafes: [],
          collections: [],
          csrfToken: randomHex(16),
          sessionToken,
        },
        200,
        [buildCookieHeader(USER_SESSION_COOKIE, sessionToken, 14 * 24 * 60 * 60, isHttps)]
      );
    }

    // Auth: Me
    if (pathname === '/api/auth/me' && request.method === 'GET') {
      const resolved = await resolveWorkerUser(request, env);
      if (!resolved) {
        return jsonResponse(request, env, { authenticated: false });
      }
      const plans = await fetchPlansFromSupabaseOrDefault(env);
      const { subscription, accountSuspended } = await fetchUserSubscriptionFromSupabase(
        env,
        resolved.session,
        resolved.bearerToken,
        plans
      );
      if (accountSuspended) {
        return jsonResponse(
          request,
          env,
          {
            authenticated: false,
            suspended: true,
            error: 'Your account has been suspended. Please contact support.',
          },
          200,
          [buildCookieHeader(USER_SESSION_COOKIE, '', 0, isHttps)]
        );
      }
      return jsonResponse(request, env, {
        authenticated: true,
        user: buildWorkerUserProfile(resolved.session),
        subscription,
        savedCafes: [],
        collections: [],
        csrfToken: randomHex(16),
      });
    }

    // Auth: Logout
    if (pathname === '/api/auth/logout' && request.method === 'POST') {
      return jsonResponse(
        request,
        env,
        { ok: true },
        200,
        [buildCookieHeader(USER_SESSION_COOKIE, '', 0, isHttps)]
      );
    }

    // Razorpay Standard Endpoint 1: Create Order
    if (pathname === '/api/create-order' && request.method === 'POST') {
      const resolved = await resolveWorkerUser(request, env);
      if (!resolved) {
        return jsonResponse(
          request,
          env,
          { error: 'Please sign in to your Cafe Desk account.' },
          401
        );
      }

      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const amount = Math.round(Number(body.amount));
      if (!Number.isInteger(amount) || amount < 100) {
        return jsonResponse(
          request,
          env,
          { error: 'Minimum order amount is 100 paise (₹1.00).' },
          400
        );
      }

      const currencyRaw = cleanStr(body.currency || 'INR', 8).toUpperCase();
      const currency = /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : 'INR';
      const receipt = cleanStr(body.receipt || makeReceiptNumber(), 40) || makeReceiptNumber();

      const { keyId, keySecret, missing } = getRazorpayCredentials(env);
      if (!keyId || !keySecret) {
        return jsonResponse(
          request,
          env,
          {
            error: `Missing Cloudflare Worker secret(s): ${missing.join(', ')}. Add them in Cloudflare Dashboard -> Workers & Pages -> cafedesk -> Settings -> Variables and Secrets, then redeploy.`,
          },
          503
        );
      }

      const rzpOrder = await createRazorpayOrderApi(keyId, keySecret, {
        amount,
        currency,
        receipt,
        notes: {
          user_id: resolved.session.sub,
          email: resolved.session.email,
        },
      });
      if (!rzpOrder.ok) {
        return jsonResponse(
          request,
          env,
          {
            error:
              rzpOrder.status === 401
                ? 'Razorpay authentication failed. Verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.'
                : rzpOrder.message,
          },
          rzpOrder.status === 401 ? 401 : 502
        );
      }

      return jsonResponse(request, env, {
        order_id: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        key_id: keyId,
      });
    }

    // Razorpay Standard Endpoint 2: Verify Payment Signature
    if (pathname === '/api/verify-payment' && request.method === 'POST') {
      const resolved = await resolveWorkerUser(request, env);
      if (!resolved) {
        return jsonResponse(
          request,
          env,
          { verified: false, error: 'Please sign in to your Cafe Desk account.' },
          401
        );
      }

      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const orderId = cleanStr(body.razorpay_order_id || body.order_id, 120);
      const paymentId = cleanStr(body.razorpay_payment_id || body.payment_id, 120);
      const signature = cleanStr(body.razorpay_signature || body.signature, 256);

      if (!orderId || !paymentId || !signature) {
        return jsonResponse(
          request,
          env,
          {
            verified: false,
            error: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.',
          },
          400
        );
      }

      const { keySecret } = getRazorpayCredentials(env);
      if (!keySecret) {
        return jsonResponse(
          request,
          env,
          { verified: false, error: 'RAZORPAY_KEY_SECRET is not configured on the backend.' },
          503
        );
      }

      const valid = await verifyRazorpaySignature(orderId, paymentId, signature, keySecret);
      if (!valid) {
        return jsonResponse(
          request,
          env,
          { verified: false, error: 'Payment signature verification failed.' },
          400
        );
      }

      return jsonResponse(request, env, {
        verified: true,
        order_id: orderId,
        payment_id: paymentId,
      });
    }

    // Subscription Billing 1: Create Razorpay Order
    if (pathname === '/api/billing/checkout/create-order' && request.method === 'POST') {
      const resolved = await resolveWorkerUser(request, env);
      if (!resolved) {
        return jsonResponse(
          request,
          env,
          { error: 'Please sign in to your Cafe Desk account.' },
          401
        );
      }

      const { keyId, keySecret, missing } = getRazorpayCredentials(env);
      if (!keyId || !keySecret) {
        return jsonResponse(
          request,
          env,
          {
            error: `Missing Cloudflare Worker secret(s): ${missing.join(', ')}. Add them in Cloudflare Dashboard -> Workers & Pages -> cafedesk -> Settings -> Variables and Secrets, then redeploy.`,
          },
          503
        );
      }

      const { serviceRoleKey } = getSupabaseConfig(env);
      if (!serviceRoleKey) {
        return jsonResponse(
          request,
          env,
          {
            error:
              'SUPABASE_SERVICE_ROLE_KEY is not configured in Cloudflare Worker secrets to persist verified subscriptions.',
          },
          503
        );
      }

      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const planId = cleanStr(body.planId, 40) as PlanTier;
      const methodRaw = cleanStr(body.method, 20);
      const method =
        methodRaw === 'card' || methodRaw === 'netbanking' || methodRaw === 'upi' ? methodRaw : 'upi';

      const plans = await fetchPlansFromSupabaseOrDefault(env);
      const targetPlan = plans.find((p) => p.id === planId);
      if (!targetPlan || !targetPlan.active || targetPlan.price_inr <= 0 || targetPlan.id === 'free') {
        return jsonResponse(
          request,
          env,
          { error: 'Select an active paid subscription plan to upgrade.' },
          400
        );
      }

      const amountInr = targetPlan.price_inr;
      const amountPaise = Math.round(amountInr * 100);
      if (amountPaise < 100) {
        return jsonResponse(
          request,
          env,
          { error: 'Minimum payable amount is ₹1.00 (100 paise).' },
          400
        );
      }

      const receiptNumber = makeReceiptNumber();
      const rzpOrder = await createRazorpayOrderApi(keyId, keySecret, {
        amount: amountPaise,
        currency: 'INR',
        receipt: receiptNumber,
        notes: {
          user_id: resolved.session.sub,
          plan_id: planId,
          email: resolved.session.email,
        },
      });

      if (!rzpOrder.ok) {
        return jsonResponse(
          request,
          env,
          {
            error:
              rzpOrder.status === 401
                ? 'Razorpay authentication failed. Verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Cloudflare Worker secrets.'
                : rzpOrder.message,
          },
          rzpOrder.status === 401 ? 401 : 502
        );
      }

      await ensureSupabaseProfileExists(env, resolved.session);

      let paymentRowId = Date.now();
      const paymentInsertRes = await supabaseServiceRest(env, 'payments', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          receipt_number: receiptNumber,
          user_id: resolved.session.sub,
          plan_id: planId,
          amount_inr: amountInr,
          currency: 'INR',
          method,
          provider: 'razorpay',
          provider_order_id: rzpOrder.id,
          status: 'created',
        }),
      }).catch(() => null);

      if (paymentInsertRes?.ok) {
        const inserted = (await paymentInsertRes.json().catch(() => [])) as Array<{ id?: number }>;
        if (inserted[0]?.id) {
          paymentRowId = Number(inserted[0].id);
        }
      }

      const now = Date.now();
      const durationDays = Math.max(1, targetPlan.interval_days || 30);
      const orderToken = await signJsonToken(secret, {
        orderId: rzpOrder.id,
        paymentId: paymentRowId,
        receiptNumber,
        userId: resolved.session.sub,
        planId,
        planName: targetPlan.name,
        amountInr,
        durationDays,
        createdAt: now,
        exp: now + 60 * 60 * 1000,
      } satisfies WorkerOrderTokenPayload);

      return jsonResponse(request, env, {
        mode: 'razorpay',
        keyId,
        orderId: rzpOrder.id,
        paymentId: paymentRowId,
        receiptNumber,
        amountInr,
        amountPaise,
        currency: 'INR',
        plan: targetPlan,
        orderToken,
      });
    }

    // Subscription Billing 2: Verify Razorpay Signature & Activate Subscription in Supabase
    if (pathname === '/api/billing/checkout/verify' && request.method === 'POST') {
      const resolved = await resolveWorkerUser(request, env);
      if (!resolved) {
        return jsonResponse(
          request,
          env,
          { error: 'Please sign in to your Cafe Desk account.' },
          401
        );
      }

      const { keySecret } = getRazorpayCredentials(env);
      const { serviceRoleKey } = getSupabaseConfig(env);
      if (!keySecret || !serviceRoleKey) {
        return jsonResponse(
          request,
          env,
          { error: 'Payment verification credentials are not configured on the backend.' },
          503
        );
      }

      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const orderId = cleanStr(body.orderId || body.razorpay_order_id, 120);
      const razorpayPaymentId = cleanStr(
        body.razorpayPaymentId || body.razorpay_payment_id,
        120
      );
      const razorpaySignature = cleanStr(
        body.razorpaySignature || body.razorpay_signature,
        256
      );
      const orderToken = cleanStr(body.orderToken, 4096);
      const methodRaw = cleanStr(body.method, 20);
      const method =
        methodRaw === 'card' || methodRaw === 'netbanking' || methodRaw === 'upi' ? methodRaw : 'upi';

      if (!orderId || !razorpayPaymentId || !razorpaySignature) {
        return jsonResponse(
          request,
          env,
          { error: 'Missing razorpay_order_id, razorpay_payment_id, or razorpay_signature.' },
          400
        );
      }

      // Resolve order record from Supabase `payments` or HMAC-signed orderToken
      let orderMeta: WorkerOrderTokenPayload | null = null;
      if (orderToken) {
        const parsed = await verifyJsonToken<WorkerOrderTokenPayload>(secret, orderToken);
        if (parsed && parsed.orderId === orderId && parsed.userId === resolved.session.sub && parsed.exp >= Date.now()) {
          orderMeta = parsed;
        }
      }

      const paymentLookupRes = await supabaseServiceRest(
        env,
        `payments?provider_order_id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(resolved.session.sub)}&select=*`
      ).catch(() => null);

      const dbPaymentRows = paymentLookupRes?.ok
        ? ((await paymentLookupRes.json().catch(() => [])) as Array<Record<string, unknown>>)
        : [];
      const dbPayment = dbPaymentRows[0];

      const plans = await fetchPlansFromSupabaseOrDefault(env);

      if (dbPayment && dbPayment.status === 'paid') {
        const { subscription } = await fetchUserSubscriptionFromSupabase(
          env,
          resolved.session,
          resolved.bearerToken,
          plans
        );
        return jsonResponse(request, env, {
          ok: true,
          authenticated: true,
          user: buildWorkerUserProfile(resolved.session),
          subscription,
          savedCafes: [],
          collections: [],
          csrfToken: randomHex(16),
          payment: {
            id: Number(dbPayment.id),
            receipt_number: String(dbPayment.receipt_number),
            plan_id: String(dbPayment.plan_id),
            amount_inr: Number(dbPayment.amount_inr),
            method: String(dbPayment.method),
            provider_payment_id: String(dbPayment.provider_payment_id),
            status: String(dbPayment.status),
            created_at: new Date(String(dbPayment.created_at)).getTime() || Date.now(),
          },
        });
      }

      if (!orderMeta && !dbPayment) {
        return jsonResponse(request, env, { error: 'Payment order not found or expired.' }, 404);
      }

      // Cryptographic HMAC-SHA256 verification of Razorpay signature
      const signatureValid = await verifyRazorpaySignature(
        orderId,
        razorpayPaymentId,
        razorpaySignature,
        keySecret
      );
      if (!signatureValid) {
        if (dbPayment) {
          await supabaseServiceRest(
            env,
            `payments?provider_order_id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(resolved.session.sub)}`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                status: 'failed',
                failure_reason: 'Invalid Razorpay signature',
                updated_at: new Date().toISOString(),
              }),
            }
          ).catch(() => {});
        }
        return jsonResponse(
          request,
          env,
          { error: 'Payment signature verification failed.' },
          400
        );
      }

      const planId = (dbPayment ? String(dbPayment.plan_id) : orderMeta!.planId) as PlanTier;
      const plan = plans.find((p) => p.id === planId);
      const amountInr = dbPayment ? Number(dbPayment.amount_inr) : orderMeta!.amountInr;
      const receiptNumber = dbPayment ? String(dbPayment.receipt_number) : orderMeta!.receiptNumber;
      const paymentId = dbPayment ? Number(dbPayment.id) : orderMeta!.paymentId;
      const durationDays = Math.max(1, plan?.interval_days || orderMeta?.durationDays || 30);

      const { subscription: currentSub } = await fetchUserSubscriptionFromSupabase(
        env,
        resolved.session,
        resolved.bearerToken,
        plans
      );

      const now = Date.now();
      const baseTime =
        currentSub.effective_active &&
        currentSub.plan_id === planId &&
        currentSub.expires_at &&
        currentSub.expires_at > now
          ? currentSub.expires_at
          : now;
      const nextExpiresAt = baseTime + durationDays * 24 * 60 * 60 * 1000;

      // 1. Update payment row to paid
      if (dbPayment) {
        await supabaseServiceRest(
          env,
          `payments?provider_order_id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(resolved.session.sub)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'paid',
              method,
              provider_payment_id: razorpayPaymentId,
              failure_reason: '',
              updated_at: new Date().toISOString(),
            }),
          }
        ).catch(() => {});
      }

      // 2. Activate subscription ONLY after verified Razorpay signature
      const subUpsertRes = await supabaseServiceRest(
        env,
        'user_subscriptions?on_conflict=user_id',
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify({
            user_id: resolved.session.sub,
            plan_id: planId,
            subscribed_price_inr: amountInr,
            status: 'active',
            started_at: new Date(now).toISOString(),
            expires_at: new Date(nextExpiresAt).toISOString(),
            auto_renew: true,
            cancelled_at: null,
            expired_at: null,
            expired_from_plan: '',
            suspended_at: null,
            updated_at: new Date().toISOString(),
          }),
        }
      );

      if (!subUpsertRes || !subUpsertRes.ok) {
        const errText = subUpsertRes ? await subUpsertRes.text().catch(() => '') : '';
        return jsonResponse(
          request,
          env,
          {
            error: `Payment verified, but failed to activate subscription in Supabase (${subUpsertRes?.status ?? 500}): ${cleanStr(errText, 160)}`,
          },
          500
        );
      }

      const upsertedRows = (await subUpsertRes.json().catch(() => [])) as Array<
        Record<string, unknown>
      >;
      const activatedSub = upsertedRows[0]
        ? mapSupabaseSubRow(upsertedRows[0], plans)
        : (
            await fetchUserSubscriptionFromSupabase(
              env,
              resolved.session,
              resolved.bearerToken,
              plans
            )
          ).subscription;

      // 3. Record subscription history (if migration 003 table exists)
      const actionLabel = currentSub.plan_id === planId ? 'renewed' : 'upgraded';
      await supabaseServiceRest(env, 'subscription_history', {
        method: 'POST',
        body: JSON.stringify({
          user_id: resolved.session.sub,
          action: actionLabel,
          from_plan: currentSub.plan_id,
          to_plan: planId,
          note: `Verified ₹${amountInr} Razorpay payment (${method.toUpperCase()}) · Receipt ${receiptNumber}`,
        }),
      }).catch(() => {});

      return jsonResponse(request, env, {
        ok: true,
        authenticated: true,
        user: buildWorkerUserProfile(resolved.session),
        subscription: activatedSub,
        savedCafes: [],
        collections: [],
        csrfToken: randomHex(16),
        payment: {
          id: paymentId,
          receipt_number: receiptNumber,
          plan_id: planId,
          amount_inr: amountInr,
          method,
          provider_payment_id: razorpayPaymentId,
          status: 'paid',
          created_at: now,
        },
      });
    }

    // Subscription Billing 3: Record Payment Failure / Cancellation
    if (pathname === '/api/billing/checkout/fail' && request.method === 'POST') {
      const resolved = await resolveWorkerUser(request, env);
      if (!resolved) {
        return jsonResponse(
          request,
          env,
          { error: 'Please sign in to your Cafe Desk account.' },
          401
        );
      }

      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const paymentId = Number(body.paymentId);
      const orderId = cleanStr(body.orderId, 120);
      const reason = cleanStr(body.reason || 'Payment declined or cancelled by user', 200);

      if (orderId) {
        await supabaseServiceRest(
          env,
          `payments?provider_order_id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(resolved.session.sub)}&status=eq.created`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'failed',
              failure_reason: reason,
              updated_at: new Date().toISOString(),
            }),
          }
        ).catch(() => {});
      } else if (Number.isFinite(paymentId)) {
        await supabaseServiceRest(
          env,
          `payments?id=eq.${paymentId}&user_id=eq.${encodeURIComponent(resolved.session.sub)}&status=eq.created`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'failed',
              failure_reason: reason,
              updated_at: new Date().toISOString(),
            }),
          }
        ).catch(() => {});
      }

      return jsonResponse(request, env, { ok: true, message: reason });
    }

    // Subscription Billing 4: Payment & Subscription History
    if (pathname === '/api/billing/history' && request.method === 'GET') {
      const resolved = await resolveWorkerUser(request, env);
      if (!resolved) {
        return jsonResponse(
          request,
          env,
          { error: 'Please sign in to your Cafe Desk account.' },
          401
        );
      }

      const { url: sbUrl, publishableKey, serviceRoleKey } = getSupabaseConfig(env);
      const authKey = serviceRoleKey || resolved.bearerToken;
      let payments: PaymentRecord[] = [];
      let history: SubscriptionHistoryItem[] = [];

      if (authKey) {
        const payRes = await fetch(
          `${sbUrl}/rest/v1/payments?user_id=eq.${encodeURIComponent(resolved.session.sub)}&order=created_at.desc&limit=50`,
          {
            headers: {
              apikey: serviceRoleKey || publishableKey,
              Authorization: `Bearer ${authKey}`,
              Accept: 'application/json',
            },
          }
        ).catch(() => null);
        if (payRes?.ok) {
          const rows = (await payRes.json().catch(() => [])) as Array<Record<string, unknown>>;
          payments = rows.map((r) => ({
            id: Number(r.id),
            receipt_number: String(r.receipt_number || ''),
            user_id: 1,
            plan_id: String(r.plan_id || 'plus') as PlanTier,
            amount_inr: Number(r.amount_inr ?? 0),
            currency: String(r.currency || 'INR'),
            method: (String(r.method || 'upi') as PaymentRecord['method']),
            provider: 'razorpay',
            provider_order_id: String(r.provider_order_id || ''),
            provider_payment_id: String(r.provider_payment_id || ''),
            status: (String(r.status || 'created') as PaymentRecord['status']),
            failure_reason: String(r.failure_reason || ''),
            refunded_at: r.refunded_at ? new Date(String(r.refunded_at)).getTime() : null,
            created_at: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now(),
          }));
        }

        const histRes = await fetch(
          `${sbUrl}/rest/v1/subscription_history?user_id=eq.${encodeURIComponent(resolved.session.sub)}&order=created_at.desc&limit=50`,
          {
            headers: {
              apikey: serviceRoleKey || publishableKey,
              Authorization: `Bearer ${authKey}`,
              Accept: 'application/json',
            },
          }
        ).catch(() => null);
        if (histRes?.ok) {
          const rows = (await histRes.json().catch(() => [])) as Array<Record<string, unknown>>;
          history = rows.map((r) => ({
            id: Number(r.id),
            user_id: 1,
            action: String(r.action || ''),
            from_plan: String(r.from_plan || 'free'),
            to_plan: String(r.to_plan || 'free'),
            note: String(r.note || ''),
            created_at: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now(),
          }));
        }
      }

      return jsonResponse(request, env, { payments, history });
    }

    // Subscription Billing 5: Cancel Auto-Renew
    if (pathname === '/api/billing/cancel' && request.method === 'POST') {
      const resolved = await resolveWorkerUser(request, env);
      if (!resolved) {
        return jsonResponse(
          request,
          env,
          { error: 'Please sign in to your Cafe Desk account.' },
          401
        );
      }

      const plans = await fetchPlansFromSupabaseOrDefault(env);
      const { subscription: current } = await fetchUserSubscriptionFromSupabase(
        env,
        resolved.session,
        resolved.bearerToken,
        plans
      );
      if (current.plan_id === 'free') {
        return jsonResponse(
          request,
          env,
          { error: 'You are currently on the Free Explorer plan.' },
          400
        );
      }

      const patchRes = await supabaseServiceRest(
        env,
        `user_subscriptions?user_id=eq.${encodeURIComponent(resolved.session.sub)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            status: 'cancelled',
            auto_renew: false,
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        }
      );
      if (!patchRes || !patchRes.ok) {
        return jsonResponse(
          request,
          env,
          { error: 'Unable to update subscription auto-renewal in Supabase.' },
          500
        );
      }

      await supabaseServiceRest(env, 'subscription_history', {
        method: 'POST',
        body: JSON.stringify({
          user_id: resolved.session.sub,
          action: 'cancelled',
          from_plan: current.plan_id,
          to_plan: current.plan_id,
          note: 'Auto-renewal cancelled by member; access stays active until billing period ends',
        }),
      }).catch(() => {});

      const { subscription } = await fetchUserSubscriptionFromSupabase(
        env,
        resolved.session,
        resolved.bearerToken,
        plans
      );
      return jsonResponse(request, env, {
        authenticated: true,
        user: buildWorkerUserProfile(resolved.session),
        subscription,
        savedCafes: [],
        collections: [],
        csrfToken: randomHex(16),
      });
    }

    // Subscription Billing 6: Resume Auto-Renew (for active non-expired period)
    if (pathname === '/api/billing/renew' && request.method === 'POST') {
      const resolved = await resolveWorkerUser(request, env);
      if (!resolved) {
        return jsonResponse(
          request,
          env,
          { error: 'Please sign in to your Cafe Desk account.' },
          401
        );
      }

      const plans = await fetchPlansFromSupabaseOrDefault(env);
      const { subscription: current } = await fetchUserSubscriptionFromSupabase(
        env,
        resolved.session,
        resolved.bearerToken,
        plans
      );
      if (current.plan_id === 'free') {
        return jsonResponse(
          request,
          env,
          { error: 'Choose Plus or Premium from Pricing to subscribe.' },
          400
        );
      }
      if (current.status === 'suspended') {
        return jsonResponse(
          request,
          env,
          { error: 'Your subscription is suspended. Contact support to restore it.' },
          403
        );
      }
      if (current.expired || current.status === 'expired') {
        return jsonResponse(
          request,
          env,
          {
            error: 'Your subscription period has ended. Complete a quick checkout to renew your plan.',
            requiresCheckout: true,
          },
          400
        );
      }

      const patchRes = await supabaseServiceRest(
        env,
        `user_subscriptions?user_id=eq.${encodeURIComponent(resolved.session.sub)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            status: 'active',
            auto_renew: true,
            cancelled_at: null,
            updated_at: new Date().toISOString(),
          }),
        }
      );
      if (!patchRes || !patchRes.ok) {
        return jsonResponse(
          request,
          env,
          { error: 'Unable to resume subscription auto-renewal in Supabase.' },
          500
        );
      }

      const { subscription } = await fetchUserSubscriptionFromSupabase(
        env,
        resolved.session,
        resolved.bearerToken,
        plans
      );
      return jsonResponse(request, env, {
        authenticated: true,
        user: buildWorkerUserProfile(resolved.session),
        subscription,
        savedCafes: [],
        collections: [],
        csrfToken: randomHex(16),
      });
    }

    // Google Places API (New) Worker Proxy Endpoints
    if (pathname.startsWith('/api/places/')) {
      const apiKey = (
        env.GOOGLE_PLACES_API_KEY ||
        env.GOOGLE_MAPS_API_KEY ||
        env.VITE_GOOGLE_MAPS_API_KEY ||
        ''
      ).trim();

      if (pathname === '/api/places/photo' && request.method === 'GET') {
        const photoName = (url.searchParams.get('name') || '').trim();
        if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photoName)) {
          return new Response('Invalid photo reference', { status: 400 });
        }
        if (!apiKey) return new Response('Maps key not configured', { status: 503 });
        const width = Math.min(1200, Math.max(200, Number(url.searchParams.get('w')) || 900));
        const upstream = await fetch(
          `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${width}&key=${encodeURIComponent(apiKey)}`,
          { redirect: 'follow' }
        );
        if (!upstream.ok) return new Response('Photo unavailable', { status: upstream.status });
        const headers = new Headers();
        headers.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=86400');
        return new Response(upstream.body, { status: 200, headers });
      }

      if (!apiKey) {
        return jsonResponse(
          request,
          env,
          { code: 'MISSING_KEY', error: 'Google Places API key is not configured.' },
          503
        );
      }

      const mask = [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.rating',
        'places.userRatingCount',
        'places.websiteUri',
        'places.googleMapsUri',
        'places.nationalPhoneNumber',
        'places.regularOpeningHours.weekdayDescriptions',
        'places.priceLevel',
        'places.types',
        'places.primaryType',
        'places.photos',
        'nextPageToken',
      ].join(',');

      const normalizeWorkerPlace = (raw: Record<string, unknown>, fallbackArea = 'Bengaluru') => {
        const loc = raw.location as { latitude?: number; longitude?: number } | undefined;
        if (typeof loc?.latitude !== 'number' || typeof loc?.longitude !== 'number') return null;
        const pid = String(raw.id || '').trim();
        if (!pid) return null;
        const dn = raw.displayName as { text?: string } | string | undefined;
        const name = typeof dn === 'string' ? dn : String(dn?.text || 'Local Place');
        const address = String(raw.formattedAddress || `${fallbackArea}, India`);
        const photosRaw = Array.isArray(raw.photos) ? raw.photos : [];
        const photos = photosRaw
          .slice(0, 6)
          .map((p) => {
            const n = String((p as { name?: string })?.name || '').trim();
            return /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(n)
              ? `/api/places/photo?name=${encodeURIComponent(n)}&w=900`
              : '';
          })
          .filter(Boolean);
        const opening = (raw.regularOpeningHours as { weekdayDescriptions?: string[] } | undefined)?.weekdayDescriptions ?? [];
        const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${name}, ${address}`)}&destination_place_id=${encodeURIComponent(pid)}`;
        return {
          id: `google:${pid}`,
          placeId: pid,
          name,
          areaLabel: fallbackArea,
          address,
          lat: loc.latitude,
          lng: loc.longitude,
          rating: typeof raw.rating === 'number' ? Math.round(raw.rating * 10) / 10 : null,
          ratingCount: typeof raw.userRatingCount === 'number' ? raw.userRatingCount : null,
          websiteUrl: String(raw.websiteUri || ''),
          mapLink: directionsUrl,
          viewMapUrl: String(raw.googleMapsUri || ''),
          phone: String(raw.nationalPhoneNumber || ''),
          photos,
          openingHours: Array.isArray(opening) ? opening : [],
          priceLevelLabel: '',
          primaryType: String(raw.primaryType || ''),
          types: Array.isArray(raw.types) ? raw.types : [],
          categoryLabel: 'Cafe',
          distanceKm: null,
          sourceType: 'google_places',
          cachedAt: Date.now(),
        };
      };

      if (pathname === '/api/places/search' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const textQuery = String(body.query || body.locality || 'cafes in Bengaluru').trim();
        const gRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': mask,
          },
          body: JSON.stringify({
            textQuery,
            pageSize: 15,
            regionCode: 'IN',
            languageCode: 'en',
            ...(body.pageToken ? { pageToken: String(body.pageToken) } : {}),
          }),
        });
        const gJson = (await gRes.json().catch(() => ({}))) as Record<string, unknown>;
        if (!gRes.ok) {
          return jsonResponse(request, env, { code: gRes.status === 429 ? 'RESOURCE_EXHAUSTED' : 'PLACES_API_ERROR', error: 'Google Places request failed.' }, gRes.status === 429 ? 429 : 502);
        }
        const places = (Array.isArray(gJson.places) ? gJson.places : [])
          .map((p) => normalizeWorkerPlace(p as Record<string, unknown>, String(body.locality || body.city || 'Bengaluru')))
          .filter(Boolean);
        return jsonResponse(request, env, { places, nextPageToken: gJson.nextPageToken || null });
      }

      if (pathname === '/api/places/nearby' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const lat = Number(body.lat);
        const lng = Number(body.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return jsonResponse(request, env, { error: 'Valid lat/lng required.' }, 400);
        }
        const radius = Math.min(50000, Math.max(500, Number(body.radiusMeters) || 3500));
        const gRes = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': mask.replace(',nextPageToken', ''),
          },
          body: JSON.stringify({
            includedPrimaryTypes: ['cafe', 'coffee_shop', 'bakery', 'tea_house'],
            maxResultCount: 15,
            rankPreference: 'DISTANCE',
            languageCode: 'en',
            regionCode: 'IN',
            locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
          }),
        });
        const gJson = (await gRes.json().catch(() => ({}))) as Record<string, unknown>;
        if (!gRes.ok) {
          return jsonResponse(request, env, { code: gRes.status === 429 ? 'RESOURCE_EXHAUSTED' : 'PLACES_API_ERROR', error: 'Nearby Places request failed.' }, gRes.status === 429 ? 429 : 502);
        }
        const places = (Array.isArray(gJson.places) ? gJson.places : [])
          .map((p) => normalizeWorkerPlace(p as Record<string, unknown>, 'Nearby'))
          .filter(Boolean);
        return jsonResponse(request, env, { places, nextPageToken: null });
      }

      if (pathname === '/api/places/details' && request.method === 'GET') {
        const placeId = (url.searchParams.get('placeId') || '').replace(/^google:/, '').trim();
        if (!placeId) return jsonResponse(request, env, { error: 'placeId required.' }, 400);
        const gRes = await fetch(
          `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`,
          {
            method: 'GET',
            headers: {
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': mask.replace(/places\./g, '').replace(',nextPageToken', ''),
            },
          }
        );
        const gJson = (await gRes.json().catch(() => ({}))) as Record<string, unknown>;
        if (!gRes.ok) return jsonResponse(request, env, { error: 'Place details failed.' }, 502);
        const place = normalizeWorkerPlace(gJson, 'Bengaluru');
        return jsonResponse(request, env, { place });
      }

      if (pathname === '/api/places/autocomplete' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const input = String(body.input || '').trim();
        if (input.length < 2) return jsonResponse(request, env, { suggestions: [] });
        const gRes = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
          body: JSON.stringify({
            input,
            includedRegionCodes: ['in'],
            includedPrimaryTypes: ['cafe', 'coffee_shop', 'bakery', 'tea_house', 'restaurant'],
          }),
        });
        const gJson = (await gRes.json().catch(() => ({}))) as Record<string, unknown>;
        const rawSuggestions = Array.isArray(gJson.suggestions) ? gJson.suggestions : [];
        const suggestions = rawSuggestions
          .map((s) => {
            const pred = (s as { placePrediction?: Record<string, unknown> }).placePrediction;
            if (!pred) return null;
            const sf = pred.structuredFormat as { mainText?: { text?: string }; secondaryText?: { text?: string } } | undefined;
            return {
              placeId: String(pred.placeId || ''),
              mainText: String(sf?.mainText?.text || ''),
              secondaryText: String(sf?.secondaryText?.text || ''),
              fullText: `${sf?.mainText?.text || ''} ${sf?.secondaryText?.text || ''}`.trim(),
            };
          })
          .filter(Boolean);
        return jsonResponse(request, env, { suggestions });
      }
    }

    if (pathname === '/api/corrections' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const resolved = await resolveWorkerUser(request, env);
      const res = await supabaseServiceRest(env, 'community_corrections', {
        method: 'POST',
        body: JSON.stringify({
          cafe_key: String(body.cafeKey || ''),
          cafe_name: String(body.cafeName || ''),
          issue_type: String(body.issueType || 'wrong_address'),
          details: String(body.details || ''),
          suggested_value: String(body.suggestedValue || ''),
          reporter_name: String(body.reporterName || resolved?.session.name || 'Community Member'),
          reporter_email: String(body.reporterEmail || resolved?.session.email || ''),
          user_id: resolved?.session.sub || null,
        }),
      });
      if (!res || !res.ok) {
        return jsonResponse(request, env, { error: 'Could not store correction report.' }, 500);
      }
      return jsonResponse(request, env, { ok: true, message: 'Correction report submitted.' }, 201);
    }

    const adminOrBootstrapResponse = await handleWorkerAdminAndBootstrapRoutes(request, env, {
      cleanStr,
      getSupabaseConfig,
      getSigningSecret,
      jsonResponse,
      parseCookies,
      buildCookieHeader,
      signJsonToken,
      verifyJsonToken,
      supabaseServiceRest,
      randomHex,
      timingSafeEqualStr,
    });
    if (adminOrBootstrapResponse) {
      return adminOrBootstrapResponse;
    }

    return jsonResponse(request, env, { error: `API route not found: ${pathname}` }, 404);
  },
};

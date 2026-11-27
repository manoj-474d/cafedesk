import { CAFES } from '../src/data/cafes.ts';
import { SITE_CONFIG } from '../src/config/constants.ts';
import type { LocationItem, NavigationItem, SiteSettings } from '../src/types/cms.ts';

export interface AdminWorkerEnv {
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SESSION_SECRET?: string;
  ALLOWED_ORIGINS?: string;
  ADMIN_BOOTSTRAP_USER?: string;
  ADMIN_BOOTSTRAP_PASSWORD?: string;
  ADMIN_EMAIL?: string;
  BACKEND_ORIGIN?: string;
  API_ORIGIN?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

interface AdminTokenPayload {
  sub: string;
  username: string;
  email: string;
  displayName: string;
  role: 'super_admin' | 'admin' | 'editor';
  csrfToken: string;
  twoFactorEnabled: boolean;
  tokenVersion: number;
  source: 'supabase' | 'env';
  exp: number;
}

interface AdminAccountRow {
  id: number;
  username: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: 'super_admin' | 'admin' | 'editor';
  two_factor_enabled: boolean;
  two_factor_secret: string;
  reset_token_hash: string | null;
  reset_token_expires_at: string | null;
  failed_attempts: number;
  locked_until: string | null;
  token_version: number;
}

export interface WorkerHelperBridge<TEnv extends AdminWorkerEnv = AdminWorkerEnv> {
  cleanStr: (val: unknown, maxLen?: number) => string;
  getSupabaseConfig: (env: TEnv) => {
    url: string;
    publishableKey: string;
    serviceRoleKey: string;
  };
  getSigningSecret: (env: TEnv) => string;
  jsonResponse: (
    req: Request,
    env: TEnv,
    body: unknown,
    status?: number,
    setCookies?: string[]
  ) => Response;
  parseCookies: (cookieHeader: string | null) => Record<string, string>;
  buildCookieHeader: (
    name: string,
    value: string,
    maxAgeSec: number,
    isHttps: boolean
  ) => string;
  signJsonToken: (secret: string, payload: unknown) => Promise<string>;
  verifyJsonToken: <T>(secret: string, token: string) => Promise<T | null>;
  supabaseServiceRest: (
    env: TEnv,
    path: string,
    init?: RequestInit
  ) => Promise<Response | null>;
  randomHex: (byteLen?: number) => string;
  timingSafeEqualStr: (a: string, b: string) => boolean;
}

const ADMIN_SESSION_COOKIE = 'cafedesk_admin_session';
const ADMIN_SESSION_TTL_SEC = 60 * 60 * 12; // 12 hours

const textEncoder = new TextEncoder();

// Edge instance rate-limit map (best-effort defense-in-depth per isolate)
const edgeRateBuckets = new Map<string, number[]>();

function checkEdgeRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const list = (edgeRateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= maxAttempts) {
    const oldest = list[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    edgeRateBuckets.set(key, list);
    return { allowed: false, retryAfterSec };
  }
  edgeRateBuckets.set(key, list);
  return { allowed: true, retryAfterSec: 0 };
}

function recordEdgeRateAttempt(key: string, windowMs: number): void {
  const now = Date.now();
  const list = (edgeRateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  edgeRateBuckets.set(key, list);
}

function clearEdgeRateLimit(key: string): void {
  edgeRateBuckets.delete(key);
}

function getClientIpFromRequest(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function sha256HexWeb(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function hashPasswordWeb(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: 100_000,
    },
    keyMaterial,
    256
  );
  return `pbkdf2:${bytesToHex(salt)}:${bytesToHex(new Uint8Array(bits))}`;
}

async function verifyPasswordWeb(
  password: string,
  storedHash: string,
  timingSafeEqualStr: (a: string, b: string) => boolean
): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;
  const salt = hexToBytes(parts[1]);
  const expectedHex = parts[2];
  if (!salt || !expectedHex) return false;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt as BufferSource,
      iterations: 100_000,
    },
    keyMaterial,
    256
  );
  const actualHex = bytesToHex(new Uint8Array(bits));
  return timingSafeEqualStr(expectedHex.toLowerCase(), actualHex.toLowerCase());
}

function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return 'Password must be at least 10 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  return null;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

async function verifyTotpWeb(
  secret: string,
  token: string,
  timingSafeEqualStr: (a: string, b: string) => boolean
): Promise<boolean> {
  const clean = String(token || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean) || !secret) return false;
  const keyBytes = base32Decode(secret);
  if (keyBytes.length === 0) return false;
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const nowSec = Math.floor(Date.now() / 1000 / 30);
  for (const offset of [-1, 0, 1]) {
    const counter = nowSec + offset;
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigInt64(0, BigInt(counter), false);
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, buf));
    const dynOffset = sig[sig.length - 1] & 0x0f;
    const code =
      ((sig[dynOffset] & 0x7f) << 24) |
      ((sig[dynOffset + 1] & 0xff) << 16) |
      ((sig[dynOffset + 2] & 0xff) << 8) |
      (sig[dynOffset + 3] & 0xff);
    const expected = String(code % 1_000_000).padStart(6, '0');
    if (timingSafeEqualStr(expected, clean)) return true;
  }
  return false;
}

function isAllowedSameOriginForMutation(req: Request, env: AdminWorkerEnv): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // Non-browser/direct same-origin requests without Origin header rely on CSRF token
  const reqOrigin = new URL(req.url).origin;
  if (origin === reqOrigin) return true;
  const allowedList = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    origin === 'https://cafedesk.space' ||
    origin === 'https://www.cafedesk.space' ||
    origin.endsWith('.cafedesk.space') ||
    allowedList.includes(origin)
  );
}

function validateSafeUpstreamOrigin(raw: string | undefined): string | null {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const h = u.hostname.toLowerCase();
    if (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '::1' ||
      h === '169.254.169.254' ||
      h.startsWith('10.') ||
      h.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)
    ) {
      return null;
    }
    return u.origin;
  } catch {
    return null;
  }
}

async function checkSupabaseAdminTable(
  env: AdminWorkerEnv,
  bridge: WorkerHelperBridge
): Promise<{
  available: boolean;
  accounts: AdminAccountRow[];
}> {
  const res = await bridge.supabaseServiceRest(
    env,
    'admin_accounts?select=id,username,email,display_name,password_hash,role,two_factor_enabled,two_factor_secret,reset_token_hash,reset_token_expires_at,failed_attempts,locked_until,token_version&order=id.asc'
  );
  if (!res || !res.ok) {
    return { available: false, accounts: [] };
  }
  const rows = (await res.json().catch(() => [])) as AdminAccountRow[];
  return { available: true, accounts: Array.isArray(rows) ? rows : [] };
}

async function recordWorkerActivity(
  env: AdminWorkerEnv,
  bridge: WorkerHelperBridge,
  actor: string,
  action: string,
  target = '',
  previousValue = '',
  newValue = ''
): Promise<void> {
  await bridge
    .supabaseServiceRest(env, 'admin_activity_logs', {
      method: 'POST',
      body: JSON.stringify({
        actor,
        action,
        target,
        previous_value: previousValue,
        new_value: newValue,
      }),
    })
    .catch(() => {});
}

function getEnvBootstrapAdmin(env: AdminWorkerEnv): {
  configured: boolean;
  username: string;
  password: string;
  email: string;
} {
  const username = (env.ADMIN_BOOTSTRAP_USER || '').trim();
  const password = env.ADMIN_BOOTSTRAP_PASSWORD || '';
  const email = (env.ADMIN_EMAIL || '').trim();
  return {
    configured: Boolean(username && password),
    username,
    password,
    email,
  };
}

async function resolveAuthenticatedWorkerAdmin(
  request: Request,
  env: AdminWorkerEnv,
  bridge: WorkerHelperBridge
): Promise<AdminTokenPayload | null> {
  const cookies = bridge.parseCookies(request.headers.get('cookie'));
  const token = cookies[ADMIN_SESSION_COOKIE];
  if (!token) return null;

  const payload = await bridge.verifyJsonToken<AdminTokenPayload>(
    bridge.getSigningSecret(env),
    token
  );
  if (!payload || !payload.username || !payload.exp || payload.exp <= Date.now()) {
    return null;
  }

  if (payload.source === 'supabase') {
    const res = await bridge.supabaseServiceRest(
      env,
      `admin_accounts?id=eq.${encodeURIComponent(payload.sub)}&select=id,token_version`
    );
    if (res?.ok) {
      const rows = (await res.json().catch(() => [])) as Array<{
        id: number;
        token_version?: number;
      }>;
      if (!rows[0] || Number(rows[0].token_version ?? 1) !== Number(payload.tokenVersion ?? 1)) {
        return null;
      }
    }
  }
  return payload;
}

async function requireWorkerAdmin(
  request: Request,
  env: AdminWorkerEnv,
  bridge: WorkerHelperBridge
): Promise<{ ok: true; admin: AdminTokenPayload } | { ok: false; response: Response }> {
  const isHttps = new URL(request.url).protocol === 'https:';
  const admin = await resolveAuthenticatedWorkerAdmin(request, env, bridge);
  if (!admin) {
    return {
      ok: false,
      response: bridge.jsonResponse(
        request,
        env,
        { error: 'Authentication required.' },
        401,
        [bridge.buildCookieHeader(ADMIN_SESSION_COOKIE, '', 0, isHttps)]
      ),
    };
  }

  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    if (!isAllowedSameOriginForMutation(request, env)) {
      return {
        ok: false,
        response: bridge.jsonResponse(request, env, { error: 'Origin not allowed.' }, 403),
      };
    }
    const csrfHeader = request.headers.get('x-csrf-token') || '';
    if (!bridge.timingSafeEqualStr(admin.csrfToken, csrfHeader)) {
      return {
        ok: false,
        response: bridge.jsonResponse(request, env, { error: 'Invalid CSRF token.' }, 403),
      };
    }
  }

  return { ok: true, admin };
}

function buildWorkerFallbackSettings(): SiteSettings {
  return {
    brand_name: 'Cafe Desk',
    brand_tagline: 'Bengaluru Cafe Discovery Platform',
    logo_url: '',
    favicon_url: '',
    accent_color: '#B45309',
    business_legal_name: 'Cafe Desk · Bengaluru Cafe Discovery',
    business_city: 'Bengaluru',
    business_address: 'Bengaluru, Karnataka',
    footer_copyright: '© 2026 Cafe Desk. Bengaluru cafe discovery for coffee, tea, study, and work.',
    analytics_id: '',
    contact_email: SITE_CONFIG.contactEmail,
    contact_phone: SITE_CONFIG.whatsappDisplay,
    whatsapp_number: SITE_CONFIG.whatsappNumber,
    whatsapp_display: SITE_CONFIG.whatsappDisplay,
    instagram_url: SITE_CONFIG.instagramUrl,
    instagram_handle: SITE_CONFIG.instagramHandle,
    twitter_url: 'https://x.com/cafedesk_space',
    linkedin_url: 'https://linkedin.com/company/cafedesk',
    hero_kicker: 'Bengaluru · Cafe & Workspace Discovery Platform',
    hero_tagline: 'Find Your Perfect Workspace.',
    hero_subtitle: 'Discover cafes to work, study, meet and relax.',
    hero_image_url: '/src/assets/images/hero_cafedesk_interior_1794976059561.jpg',
    hero_bg_image_url: '/src/assets/images/hero_cafedesk_interior_1794976059561.jpg',
    hero_cta_primary_label: 'Explore Cafes',
    hero_cta_primary_link: '/locations',
    hero_cta_secondary_label: 'Find Near Me',
    hero_cta_secondary_link: '/locations?nearby=1',
    hero_cta_tertiary_label: 'Explore Map',
    hero_cta_tertiary_link: '/locations?view=map',
    homepage_sections: [
      { key: 'hero', label: 'Hero, Quick Search & Filter Chips', visible: true, order: 1 },
      { key: 'announcements', label: 'Discovery Highlights Strip', visible: true, order: 2 },
      { key: 'locations', label: 'Bengaluru Interactive Map & Cafe Grid', visible: true, order: 3 },
      { key: 'experience', label: 'Coffee, Culinary & Craft Gallery', visible: true, order: 4 },
      { key: 'services', label: 'Work, Study & Budget Discovery Features', visible: true, order: 5 },
      { key: 'offers', label: 'Browse by Mood & Budget Brackets', visible: true, order: 6 },
      { key: 'testimonials', label: 'Community Stories', visible: true, order: 7 },
      { key: 'contact_cta', label: 'Community Updates & Submit a Cafe CTA', visible: true, order: 8 },
    ],
    banner_enabled: true,
    banner_text: 'Discover Bengaluru cafes by budget (₹50–₹500+), Wi-Fi, sockets, food & live distance.',
    banner_cta_label: 'Open Cafe Map',
    banner_link: '/locations?view=map',
    announcements: [],
    about_heading: 'Built for people who choose a cafe by its coffee, budget, and focus.',
    about_lead:
      'Cafe Desk began in Bengaluru with a simple goal: help students, freelancers, and remote workers discover nearby cafes using practical details that standard food apps miss.',
    about_story: '',
    about_image_url: '/src/assets/images/editorial_team_meeting_1794976060148.jpg',
    services_heading: 'Everything you check before visiting or bringing your laptop.',
    services_subtitle:
      'Whether you need affordable tea and coffee under ₹200, reachable wall sockets for a workday, or nearby cafes in your neighborhood.',
    services_image_url: '/src/assets/images/editorial_workspace_lounge_1794976060874.jpg',
    services_items: [],
    facilities_items: [],
    faqs_items: [],
    contact_heading: 'Questions, cafe suggestions, or data updates.',
    contact_subtitle:
      'Share feedback, suggest a great Bengaluru cafe, or reach our editorial team via email or WhatsApp.',
    contact_hours: 'Mon – Sun · 9:00 AM to 8:00 PM IST',
    contact_map_url: 'https://maps.google.com/?q=Bengaluru',
    editorial_gallery: [],
    seo_home_title: 'Cafe Desk – Find Your Perfect Cafe in Bengaluru',
    seo_home_description:
      'Discover nearby Bengaluru cafes for coffee, tea, studying, casual meetings, and remote working.',
    seo_locations_title: 'Explore Bengaluru Cafes & Interactive Map | Cafe Desk',
    seo_locations_description:
      'Find cafes near you across Indiranagar, Koramangala, Jayanagar, Banashankari, Malleshwaram & more.',
    seo_about_title: 'About Cafe Desk & Discovery Standards',
    seo_about_description:
      'Learn how Cafe Desk helps Bengaluru students and remote workers find reliable cafes.',
    seo_contact_title: 'Contact & Cafe Updates – Cafe Desk',
    seo_contact_description: 'Reach the Cafe Desk team or suggest cafe updates in Bengaluru.',
    seo_og_image: '/src/assets/images/hero_cafedesk_interior_1794976059561.jpg',
    seo_allow_indexing: true,
    google_site_verification: '',
    currency_code: 'INR',
    currency_symbol: '₹',
    bookings_enabled: true,
    booking_lead_hours: 2,
    booking_max_guests: 8,
    booking_policy_note: 'Tables and power-socket desks are held for 15 minutes past arrival time.',
    notify_new_booking: true,
    notify_new_customer: true,
    notify_new_payment: true,
    notify_new_suggestion: true,
    notification_email: '',
  };
}

function buildDefaultWorkerLocations(): LocationItem[] {
  return CAFES.map((c, idx) => ({
    ...c,
    slug: c.id,
    city: 'Bengaluru',
    address: c.address || `${c.area}, Bengaluru`,
    phone: '',
    website_url: c.website_url || '',
    menu_url: c.menu_url || '',
    instagram_url: c.instagram_url || '',
    place_id: '',
    lat: null,
    lng: null,
    description: c.claims.join(' · '),
    photos_approved: c.photos.length > 0,
    charging_sockets: c.sockets_count || c.sockets_claimed ? 'yes' : 'unknown',
    comfortable_seating: c.laptop_friendly ? 'yes' : 'unknown',
    suitable_for_studying: c.modes.includes('calm') ? 'yes' : 'unknown',
    suitable_for_working: c.modes.includes('work') || c.laptop_friendly ? 'yes' : 'unknown',
    price_range: c.avg_cost_per_person ? `₹${c.avg_cost_per_person}` : '',
    coffee_price: c.coffee_price ?? null,
    tea_price: c.tea_price ?? null,
    snacks_price: c.snacks_price ?? null,
    meals_price: c.meals_price ?? null,
    rating: null,
    rating_count: null,
    facilities: [],
    offers: [],
    menu_services: [],
    verdict: c.claims[0] ?? 'Bengaluru cafe listed from official website & public sources.',
    published: true,
    display_order: idx + 1,
    sample: false,
    updated_at: Date.now(),
  }));
}

async function getCmsKvValue<T>(
  env: AdminWorkerEnv,
  bridge: WorkerHelperBridge,
  key: string,
  fallback: T
): Promise<T> {
  const { url, publishableKey, serviceRoleKey } = bridge.getSupabaseConfig(env);
  const authKey = serviceRoleKey || publishableKey;
  if (!url || !authKey) return fallback;
  try {
    const res = await fetch(
      `${url}/rest/v1/cms_kv?key=eq.${encodeURIComponent(key)}&select=value`,
      {
        headers: {
          apikey: authKey,
          Authorization: `Bearer ${authKey}`,
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) return fallback;
    const rows = (await res.json().catch(() => [])) as Array<{ value?: T }>;
    if (rows[0] && rows[0].value !== undefined && rows[0].value !== null) {
      return rows[0].value;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

async function setCmsKvValue(
  env: AdminWorkerEnv,
  bridge: WorkerHelperBridge,
  key: string,
  value: unknown
): Promise<boolean> {
  const res = await bridge.supabaseServiceRest(env, 'cms_kv?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      key,
      value,
      updated_at: new Date().toISOString(),
    }),
  });
  return Boolean(res?.ok);
}

async function sendRecoveryCodeEmailIfConfigured(
  env: AdminWorkerEnv,
  toEmail: string,
  username: string,
  recoveryCode: string
): Promise<boolean> {
  const resendKey = (env.RESEND_API_KEY || '').trim();
  const fromEmail = (env.RESEND_FROM_EMAIL || 'CafeDesk Security <no-reply@cafedesk.space>').trim();
  if (!resendKey || !toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) return false;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: 'CafeDesk Owner Password Recovery Code',
        text: [
          `Hello ${username},`,
          '',
          `Your single-use CafeDesk owner password recovery code (valid for 15 minutes) is:`,
          '',
          `    ${recoveryCode}`,
          '',
          'If you did not request this reset, you can safely ignore this message.',
        ].join('\n'),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function handleWorkerAdminAndBootstrapRoutes<TEnv extends AdminWorkerEnv>(
  request: Request,
  env: TEnv,
  rawBridge: WorkerHelperBridge<TEnv>
): Promise<Response | null> {
  const bridge = rawBridge as unknown as WorkerHelperBridge<AdminWorkerEnv>;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const isHttps = url.protocol === 'https:';

  // Optional upstream Node proxy when BACKEND_ORIGIN / API_ORIGIN is explicitly configured
  const upstreamOrigin = validateSafeUpstreamOrigin(env.BACKEND_ORIGIN || env.API_ORIGIN);
  if (
    upstreamOrigin &&
    (pathname.startsWith('/api/admin/') ||
      pathname === '/api/public/bootstrap' ||
      pathname.startsWith('/api/cafes/'))
  ) {
    const targetUrl = `${upstreamOrigin}${pathname}${url.search}`;
    const fwdHeaders = new Headers();
    for (const hName of [
      'content-type',
      'accept',
      'cookie',
      'authorization',
      'x-csrf-token',
      'x-cafedesk-session',
    ]) {
      const val = request.headers.get(hName);
      if (val) fwdHeaders.set(hName, val);
    }
    const init: RequestInit = {
      method: request.method,
      headers: fwdHeaders,
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.arrayBuffer();
    }
    const upstreamRes = await fetch(targetUrl, init);
    const outHeaders = new Headers(upstreamRes.headers);
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: outHeaders,
    });
  }

  // Public CMS bootstrap in Worker mode
  if (pathname === '/api/public/bootstrap' && request.method === 'GET') {
    const defaultSettings = buildWorkerFallbackSettings();
    const storedSettings = await getCmsKvValue<Partial<SiteSettings>>(
      env,
      bridge,
      'site_settings',
      {}
    );
    const storedNav = await getCmsKvValue<NavigationItem[] | null>(
      env,
      bridge,
      'navigation_items',
      null
    );
    const storedLocations = await getCmsKvValue<LocationItem[] | null>(
      env,
      bridge,
      'cafes_catalog',
      null
    );
    return bridge.jsonResponse(request, env, {
      locations: Array.isArray(storedLocations) && storedLocations.length > 0
        ? storedLocations
        : buildDefaultWorkerLocations(),
      settings: { ...defaultSettings, ...storedSettings },
      navigation: Array.isArray(storedNav) && storedNav.length > 0
        ? storedNav
        : [
            { id: 1, location: 'header', label: 'Explore Cafes', url: '/locations', sort_order: 1, visible: true, is_external: false },
            { id: 2, location: 'header', label: 'Cafe Map', url: '/locations?view=map', sort_order: 2, visible: true, is_external: false },
            { id: 3, location: 'header', label: 'About', url: '/about', sort_order: 3, visible: true, is_external: false },
            { id: 4, location: 'header', label: 'Contact', url: '/contact', sort_order: 4, visible: true, is_external: false },
          ],
      testimonials: [],
      media: [],
    });
  }

  if (!pathname.startsWith('/api/admin/')) {
    return null;
  }

  // 1. GET /api/admin/status
  if (pathname === '/api/admin/status' && request.method === 'GET') {
    const envBootstrap = getEnvBootstrapAdmin(env);
    const { available: sbAvailable, accounts } = await checkSupabaseAdminTable(env, bridge);
    const setupRequired = sbAvailable
      ? accounts.length === 0 && !envBootstrap.configured
      : !envBootstrap.configured;

    const currentAdmin = await resolveAuthenticatedWorkerAdmin(request, env, bridge);
    if (!currentAdmin) {
      if (!sbAvailable && !envBootstrap.configured) {
        return bridge.jsonResponse(
          request,
          env,
          {
            setupRequired: false,
            authenticated: false,
            storageConfigured: false,
            error:
              'Admin storage is not configured on this Worker. Set SUPABASE_SERVICE_ROLE_KEY (with migration 006_admin_and_cms.sql) or set ADMIN_BOOTSTRAP_USER and ADMIN_BOOTSTRAP_PASSWORD in Cloudflare Worker Secrets.',
          },
          200
        );
      }
      return bridge.jsonResponse(request, env, {
        setupRequired,
        authenticated: false,
        storageConfigured: true,
      });
    }

    return bridge.jsonResponse(request, env, {
      setupRequired: false,
      authenticated: true,
      storageConfigured: true,
      admin: {
        username: currentAdmin.username,
        email: currentAdmin.email,
        displayName: currentAdmin.displayName,
        role: currentAdmin.role,
        csrfToken: currentAdmin.csrfToken,
        expiresAt: currentAdmin.exp,
        twoFactorEnabled: currentAdmin.twoFactorEnabled,
      },
    });
  }

  // 2. POST /api/admin/setup (one-time initial owner claim when no admin exists)
  if (pathname === '/api/admin/setup' && request.method === 'POST') {
    const envBootstrap = getEnvBootstrapAdmin(env);
    const { available: sbAvailable, accounts } = await checkSupabaseAdminTable(env, bridge);
    if (!sbAvailable) {
      return bridge.jsonResponse(
        request,
        env,
        {
          error: envBootstrap.configured
            ? 'Owner account is managed via Cloudflare Worker secrets. Please sign in.'
            : 'Admin database table is not provisioned. Add SUPABASE_SERVICE_ROLE_KEY and run migration 006_admin_and_cms.sql, or configure ADMIN_BOOTSTRAP_USER & ADMIN_BOOTSTRAP_PASSWORD.',
        },
        503
      );
    }

    if (accounts.length > 0 || envBootstrap.configured) {
      return bridge.jsonResponse(
        request,
        env,
        { error: 'Administrator account already configured.' },
        403
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const username = bridge.cleanStr(body.username, 40);
    const email = bridge.cleanStr(body.email, 120);
    const displayName = bridge.cleanStr(body.displayName, 60) || 'Site Administrator';
    const password = String(body.password ?? '');

    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
      return bridge.jsonResponse(
        request,
        env,
        { error: 'Username must be 3–40 characters (letters, numbers, dot, underscore, or hyphen).' },
        400
      );
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return bridge.jsonResponse(request, env, { error: 'Please enter a valid email address.' }, 400);
    }
    const pwErr = validatePasswordStrength(password);
    if (pwErr) {
      return bridge.jsonResponse(request, env, { error: pwErr }, 400);
    }

    const pwHash = await hashPasswordWeb(password);
    const insertRes = await bridge.supabaseServiceRest(env, 'admin_accounts', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        username,
        email,
        display_name: displayName,
        password_hash: pwHash,
        role: 'super_admin',
        token_version: 1,
      }),
    });
    if (!insertRes || !insertRes.ok) {
      return bridge.jsonResponse(
        request,
        env,
        { error: 'Could not save administrator account. Check Supabase configuration.' },
        500
      );
    }
    const createdRows = (await insertRes.json().catch(() => [])) as AdminAccountRow[];
    const created = createdRows[0];
    if (!created) {
      return bridge.jsonResponse(request, env, { error: 'Failed to create owner account.' }, 500);
    }

    const csrfToken = bridge.randomHex(24);
    const expiresAt = Date.now() + ADMIN_SESSION_TTL_SEC * 1000;
    const payload: AdminTokenPayload = {
      sub: String(created.id),
      username: created.username,
      email: created.email || '',
      displayName: created.display_name,
      role: 'super_admin',
      csrfToken,
      twoFactorEnabled: false,
      tokenVersion: Number(created.token_version ?? 1),
      source: 'supabase',
      exp: expiresAt,
    };
    const token = await bridge.signJsonToken(bridge.getSigningSecret(env), payload);
    await recordWorkerActivity(env, bridge, created.username, 'Initial admin setup', 'Super Admin account created');

    return bridge.jsonResponse(
      request,
      env,
      {
        ok: true,
        admin: {
          username: payload.username,
          email: payload.email,
          displayName: payload.displayName,
          role: payload.role,
          csrfToken,
          expiresAt,
          twoFactorEnabled: false,
        },
      },
      201,
      [bridge.buildCookieHeader(ADMIN_SESSION_COOKIE, token, ADMIN_SESSION_TTL_SEC, isHttps)]
    );
  }

  // 3. POST /api/admin/login
  if (pathname === '/api/admin/login' && request.method === 'POST') {
    const ip = getClientIpFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const identifier = bridge.cleanStr(body.username, 120);
    const password = String(body.password ?? '');
    const totpCode = bridge.cleanStr(body.totpCode, 12);

    const ipKey = `worker-login:ip:${ip}`;
    const userKey = `worker-login:user:${identifier.toLowerCase()}`;

    const ipCheck = checkEdgeRateLimit(ipKey, 15, 15 * 60 * 1000);
    if (!ipCheck.allowed) {
      return bridge.jsonResponse(
        request,
        env,
        { error: `Too many login attempts. Try again in ${ipCheck.retryAfterSec} seconds.` },
        429
      );
    }
    const userCheck = checkEdgeRateLimit(userKey, 6, 15 * 60 * 1000);
    if (!userCheck.allowed) {
      return bridge.jsonResponse(
        request,
        env,
        { error: `Account temporarily locked due to failed attempts. Try again in ${userCheck.retryAfterSec} seconds.` },
        429
      );
    }

    if (!identifier || !password) {
      return bridge.jsonResponse(
        request,
        env,
        { error: 'Username/email and password are required.' },
        400
      );
    }

    const envBootstrap = getEnvBootstrapAdmin(env);
    const { available: sbAvailable, accounts } = await checkSupabaseAdminTable(env, bridge);

    // Match against Supabase admin_accounts first if available
    const idLower = identifier.toLowerCase();
    const matchedRow = accounts.find(
      (a) =>
        a.username.toLowerCase() === idLower ||
        (a.email && a.email.trim().toLowerCase() === idLower)
    );

    if (matchedRow) {
      const lockMs = matchedRow.locked_until ? new Date(matchedRow.locked_until).getTime() : 0;
      if (lockMs > Date.now()) {
        const retrySec = Math.max(1, Math.ceil((lockMs - Date.now()) / 1000));
        return bridge.jsonResponse(
          request,
          env,
          { error: `Account locked after repeated failed attempts. Try again in ${retrySec} seconds.` },
          429
        );
      }

      const validPw = await verifyPasswordWeb(
        password,
        matchedRow.password_hash,
        bridge.timingSafeEqualStr
      );
      if (!validPw) {
        recordEdgeRateAttempt(ipKey, 15 * 60 * 1000);
        recordEdgeRateAttempt(userKey, 15 * 60 * 1000);
        const nextAttempts = (matchedRow.failed_attempts ?? 0) + 1;
        const lockedUntil =
          nextAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
        await bridge
          .supabaseServiceRest(env, `admin_accounts?id=eq.${matchedRow.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              failed_attempts: nextAttempts,
              locked_until: lockedUntil,
              updated_at: new Date().toISOString(),
            }),
          })
          .catch(() => {});
        return bridge.jsonResponse(request, env, { error: 'Invalid credentials.' }, 401);
      }

      if (matchedRow.two_factor_enabled) {
        if (!totpCode) {
          return bridge.jsonResponse(request, env, {
            ok: false,
            requires2FA: true,
            message: 'Enter the 6-digit verification code from your authenticator app.',
          });
        }
        const okTotp = await verifyTotpWeb(
          matchedRow.two_factor_secret,
          totpCode,
          bridge.timingSafeEqualStr
        );
        if (!okTotp) {
          recordEdgeRateAttempt(ipKey, 15 * 60 * 1000);
          recordEdgeRateAttempt(userKey, 15 * 60 * 1000);
          return bridge.jsonResponse(request, env, { error: 'Invalid 2FA verification code.' }, 401);
        }
      }

      await bridge
        .supabaseServiceRest(env, `admin_accounts?id=eq.${matchedRow.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            failed_attempts: 0,
            locked_until: null,
            updated_at: new Date().toISOString(),
          }),
        })
        .catch(() => {});

      clearEdgeRateLimit(ipKey);
      clearEdgeRateLimit(userKey);

      const csrfToken = bridge.randomHex(24);
      const expiresAt = Date.now() + ADMIN_SESSION_TTL_SEC * 1000;
      const payload: AdminTokenPayload = {
        sub: String(matchedRow.id),
        username: matchedRow.username,
        email: matchedRow.email || '',
        displayName: matchedRow.display_name,
        role: matchedRow.role || 'admin',
        csrfToken,
        twoFactorEnabled: Boolean(matchedRow.two_factor_enabled),
        tokenVersion: Number(matchedRow.token_version ?? 1),
        source: 'supabase',
        exp: expiresAt,
      };
      const token = await bridge.signJsonToken(bridge.getSigningSecret(env), payload);
      await recordWorkerActivity(env, bridge, matchedRow.username, 'Signed in', 'Admin dashboard');

      return bridge.jsonResponse(
        request,
        env,
        {
          ok: true,
          admin: {
            username: payload.username,
            email: payload.email,
            displayName: payload.displayName,
            role: payload.role,
            csrfToken,
            expiresAt,
            twoFactorEnabled: payload.twoFactorEnabled,
          },
        },
        200,
        [bridge.buildCookieHeader(ADMIN_SESSION_COOKIE, token, ADMIN_SESSION_TTL_SEC, isHttps)]
      );
    }

    // Env bootstrap login (when Worker secrets are configured and either table is empty or matching bootstrap credentials)
    if (envBootstrap.configured) {
      const userMatches =
        idLower === envBootstrap.username.toLowerCase() ||
        (envBootstrap.email && idLower === envBootstrap.email.toLowerCase());
      const passMatches = bridge.timingSafeEqualStr(password, envBootstrap.password);
      if (userMatches && passMatches) {
        clearEdgeRateLimit(ipKey);
        clearEdgeRateLimit(userKey);

        const csrfToken = bridge.randomHex(24);
        const expiresAt = Date.now() + ADMIN_SESSION_TTL_SEC * 1000;
        const payload: AdminTokenPayload = {
          sub: 'env-bootstrap',
          username: envBootstrap.username,
          email: envBootstrap.email,
          displayName: 'Site Administrator',
          role: 'super_admin',
          csrfToken,
          twoFactorEnabled: false,
          tokenVersion: 1,
          source: 'env',
          exp: expiresAt,
        };
        const token = await bridge.signJsonToken(bridge.getSigningSecret(env), payload);

        return bridge.jsonResponse(
          request,
          env,
          {
            ok: true,
            admin: {
              username: payload.username,
              email: payload.email,
              displayName: payload.displayName,
              role: payload.role,
              csrfToken,
              expiresAt,
              twoFactorEnabled: false,
            },
          },
          200,
          [bridge.buildCookieHeader(ADMIN_SESSION_COOKIE, token, ADMIN_SESSION_TTL_SEC, isHttps)]
        );
      }
    }

    // Supabase Auth email/password fallback (strictly requires app_metadata.role in ['admin', 'super_admin'])
    if (identifier.includes('@')) {
      const { url: sbUrl, publishableKey } = bridge.getSupabaseConfig(env);
      if (sbUrl && publishableKey) {
        try {
          const authRes = await fetch(`${sbUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              apikey: publishableKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: idLower, password }),
          });
          if (authRes.ok) {
            const authJson = (await authRes.json().catch(() => ({}))) as {
              user?: {
                id?: string;
                email?: string;
                app_metadata?: { role?: string };
                user_metadata?: { full_name?: string; name?: string };
              };
            };
            const role = String(authJson.user?.app_metadata?.role || '');
            if (authJson.user?.id && (role === 'super_admin' || role === 'admin')) {
              clearEdgeRateLimit(ipKey);
              clearEdgeRateLimit(userKey);
              const csrfToken = bridge.randomHex(24);
              const expiresAt = Date.now() + ADMIN_SESSION_TTL_SEC * 1000;
              const payload: AdminTokenPayload = {
                sub: authJson.user.id,
                username: authJson.user.email || idLower,
                email: authJson.user.email || idLower,
                displayName:
                  bridge.cleanStr(
                    authJson.user.user_metadata?.full_name || authJson.user.user_metadata?.name || 'Admin',
                    60
                  ) || 'Admin',
                role,
                csrfToken,
                twoFactorEnabled: false,
                tokenVersion: 1,
                source: 'env',
                exp: expiresAt,
              };
              const token = await bridge.signJsonToken(bridge.getSigningSecret(env), payload);
              return bridge.jsonResponse(
                request,
                env,
                {
                  ok: true,
                  admin: {
                    username: payload.username,
                    email: payload.email,
                    displayName: payload.displayName,
                    role: payload.role,
                    csrfToken,
                    expiresAt,
                    twoFactorEnabled: false,
                  },
                },
                200,
                [bridge.buildCookieHeader(ADMIN_SESSION_COOKIE, token, ADMIN_SESSION_TTL_SEC, isHttps)]
              );
            }
          }
        } catch {
          // Fall through to invalid credentials
        }
      }
    }

    if (!sbAvailable && !envBootstrap.configured && !identifier.includes('@')) {
      return bridge.jsonResponse(
        request,
        env,
        {
          error:
            'Admin authentication is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY (with migration 006_admin_and_cms.sql) or set ADMIN_BOOTSTRAP_USER and ADMIN_BOOTSTRAP_PASSWORD in Cloudflare Worker Secrets.',
        },
        503
      );
    }

    recordEdgeRateAttempt(ipKey, 15 * 60 * 1000);
    recordEdgeRateAttempt(userKey, 15 * 60 * 1000);
    return bridge.jsonResponse(request, env, { error: 'Invalid credentials.' }, 401);
  }

  // 4. POST /api/admin/reset-request
  if (pathname === '/api/admin/reset-request' && request.method === 'POST') {
    const ip = getClientIpFromRequest(request);
    const rl = checkEdgeRateLimit(`worker-reset-req:${ip}`, 3, 15 * 60 * 1000);
    if (!rl.allowed) {
      return bridge.jsonResponse(
        request,
        env,
        { error: `Too many reset requests. Please wait ${rl.retryAfterSec} seconds.` },
        429
      );
    }
    recordEdgeRateAttempt(`worker-reset-req:${ip}`, 15 * 60 * 1000);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const identifier = bridge.cleanStr(body.username, 120);
    const envBootstrap = getEnvBootstrapAdmin(env);
    const { available: sbAvailable, accounts } = await checkSupabaseAdminTable(env, bridge);

    if (!sbAvailable) {
      return bridge.jsonResponse(
        request,
        env,
        {
          error: envBootstrap.configured
            ? 'This Worker uses environment secrets (ADMIN_BOOTSTRAP_PASSWORD). Update the secret in Cloudflare Dashboard -> Workers & Pages -> Settings -> Variables and Secrets, or enable Supabase admin_accounts (migration 006) for recovery-code resets.'
            : 'Admin password reset requires SUPABASE_SERVICE_ROLE_KEY (with migration 006_admin_and_cms.sql) configured in Cloudflare Worker Secrets.',
        },
        503
      );
    }

    let emailSent = false;
    if (identifier) {
      const idLower = identifier.toLowerCase();
      const admin = accounts.find(
        (a) =>
          a.username.toLowerCase() === idLower ||
          (a.email && a.email.trim().toLowerCase() === idLower)
      );
      if (admin) {
        const recoveryCode = bridge.randomHex(6).toUpperCase();
        const codeHash = await sha256HexWeb(recoveryCode);
        const expiresAtIso = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await bridge.supabaseServiceRest(env, `admin_accounts?id=eq.${admin.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            reset_token_hash: codeHash,
            reset_token_expires_at: expiresAtIso,
            updated_at: new Date().toISOString(),
          }),
        });

        console.info(
          `[CafeDesk Security] Password recovery code for "${admin.username}" (valid 15m): ${recoveryCode}`
        );
        emailSent = await sendRecoveryCodeEmailIfConfigured(
          env,
          admin.email || envBootstrap.email,
          admin.username,
          recoveryCode
        );
        await recordWorkerActivity(env, bridge, admin.username, 'Requested password reset', 'Recovery token issued');
      }
    }

    return bridge.jsonResponse(request, env, {
      ok: true,
      message: emailSent
        ? 'If an account matches that username or email, a 15-minute single-use recovery code has been sent to your admin email and logged on the Worker console.'
        : 'If an account matches that username or email, a 15-minute single-use recovery code has been logged in the Cloudflare Worker logs (wrangler tail / Logs).',
    });
  }

  // 5. POST /api/admin/reset-confirm
  if (pathname === '/api/admin/reset-confirm' && request.method === 'POST') {
    const ip = getClientIpFromRequest(request);
    const rl = checkEdgeRateLimit(`worker-reset-confirm:${ip}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      return bridge.jsonResponse(
        request,
        env,
        { error: `Too many attempts. Try again in ${rl.retryAfterSec} seconds.` },
        429
      );
    }
    recordEdgeRateAttempt(`worker-reset-confirm:${ip}`, 15 * 60 * 1000);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const identifier = bridge.cleanStr(body.username, 120);
    const recoveryCode = bridge.cleanStr(body.recoveryCode, 32).toUpperCase();
    const newPassword = String(body.newPassword ?? '');

    if (!identifier || !recoveryCode || !newPassword) {
      return bridge.jsonResponse(
        request,
        env,
        { error: 'Username/email, recovery code, and new password are required.' },
        400
      );
    }

    const pwErr = validatePasswordStrength(newPassword);
    if (pwErr) {
      return bridge.jsonResponse(request, env, { error: pwErr }, 400);
    }

    const { available: sbAvailable, accounts } = await checkSupabaseAdminTable(env, bridge);
    if (!sbAvailable) {
      return bridge.jsonResponse(
        request,
        env,
        { error: 'Admin database table is not provisioned on this Worker.' },
        503
      );
    }

    const idLower = identifier.toLowerCase();
    const admin = accounts.find(
      (a) =>
        a.username.toLowerCase() === idLower ||
        (a.email && a.email.trim().toLowerCase() === idLower)
    );
    const expiresMs = admin?.reset_token_expires_at
      ? new Date(admin.reset_token_expires_at).getTime()
      : 0;
    if (!admin || !admin.reset_token_hash || !expiresMs || expiresMs < Date.now()) {
      return bridge.jsonResponse(
        request,
        env,
        { error: 'Invalid or expired recovery code.' },
        400
      );
    }

    const actualHash = await sha256HexWeb(recoveryCode);
    if (!bridge.timingSafeEqualStr(admin.reset_token_hash, actualHash)) {
      return bridge.jsonResponse(
        request,
        env,
        { error: 'Invalid or expired recovery code.' },
        400
      );
    }

    const newHash = await hashPasswordWeb(newPassword);
    const nextVersion = Number(admin.token_version ?? 1) + 1;
    const updRes = await bridge.supabaseServiceRest(env, `admin_accounts?id=eq.${admin.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        password_hash: newHash,
        reset_token_hash: null,
        reset_token_expires_at: null,
        failed_attempts: 0,
        locked_until: null,
        token_version: nextVersion,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!updRes || !updRes.ok) {
      return bridge.jsonResponse(request, env, { error: 'Could not update password.' }, 500);
    }

    await recordWorkerActivity(env, bridge, admin.username, 'Reset password', 'All old sessions revoked');
    return bridge.jsonResponse(request, env, {
      ok: true,
      message: 'Password updated. You may now sign in.',
    });
  }

  // ============================================================================
  // PROTECTED WORKER ADMIN ROUTES
  // ============================================================================
  const auth = await requireWorkerAdmin(request, env, bridge);
  if (!auth.ok) return auth.response;
  const currentAdmin = auth.admin;

  if (pathname === '/api/admin/logout' && request.method === 'POST') {
    await recordWorkerActivity(env, bridge, currentAdmin.username, 'Signed out', 'Admin dashboard');
    return bridge.jsonResponse(
      request,
      env,
      { ok: true },
      200,
      [bridge.buildCookieHeader(ADMIN_SESSION_COOKIE, '', 0, isHttps)]
    );
  }

  if (pathname === '/api/admin/overview' && request.method === 'GET') {
    const [profilesRes, subsRes, paymentsRes, correctionsRes, logsRes] = await Promise.all([
      bridge.supabaseServiceRest(env, 'profiles?select=id,full_name,email,created_at&order=created_at.desc&limit=100'),
      bridge.supabaseServiceRest(env, 'user_subscriptions?select=user_id,plan_id,status,expires_at'),
      bridge.supabaseServiceRest(env, 'payments?select=id,receipt_number,plan_id,amount_inr,status,created_at&order=created_at.desc&limit=100'),
      bridge.supabaseServiceRest(env, 'community_corrections?select=id,status'),
      bridge.supabaseServiceRest(env, 'admin_activity_logs?select=id,actor,action,target,previous_value,new_value,created_at&order=id.desc&limit=25'),
    ]);

    const profiles = profilesRes?.ok ? ((await profilesRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    const subs = subsRes?.ok ? ((await subsRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    const payments = paymentsRes?.ok ? ((await paymentsRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    const corrections = correctionsRes?.ok ? ((await correctionsRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    const logs = logsRes?.ok ? ((await logsRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];

    const now = Date.now();
    const activeSubs = subs.filter(
      (s) =>
        s.plan_id !== 'free' &&
        s.status === 'active' &&
        (!s.expires_at || new Date(String(s.expires_at)).getTime() > now)
    ).length;
    const paidPayments = payments.filter((p) => p.status === 'paid');
    const totalRevenueInr = paidPayments.reduce((sum, p) => sum + Number(p.amount_inr ?? 0), 0);

    return bridge.jsonResponse(request, env, {
      totalVisitors: 0,
      totalPageViews: 0,
      todayVisitors: 0,
      todayPageViews: 0,
      totalCafes: CAFES.length,
      publishedCafes: CAFES.length,
      inactiveCafes: 0,
      verifiedCafes: CAFES.filter((c) => c.verified).length,
      featuredCafes: CAFES.filter((c) => c.featured).length,
      newCafesThisWeek: 0,
      totalMenuItems: 0,
      totalUsers: profiles.length,
      freeUsers: Math.max(0, profiles.length - activeSubs),
      paidUsers: activeSubs,
      activeSubs,
      cancelledSubs: subs.filter((s) => s.status === 'cancelled').length,
      expiredSubs: subs.filter((s) => s.status === 'expired').length,
      totalRevenueInr,
      monthRevenueInr: totalRevenueInr,
      yearRevenueInr: totalRevenueInr,
      mrrInr: 0,
      totalBookings: 0,
      todayBookings: 0,
      pendingBookings: 0,
      confirmedBookings: 0,
      cancelledBookings: 0,
      totalSubmissions: corrections.length,
      newSubmissions: corrections.filter((c) => c.status === 'pending').length,
      totalSuggestions: 0,
      newSuggestions: 0,
      totalMedia: 0,
      totalAdmins: 1,
      dailyChart: [],
      revenueChart: [],
      recentPayments: paidPayments.slice(0, 6),
      recentUsers: profiles.slice(0, 6),
      recentRenewals: [],
      recentBookings: [],
      popularWorkspaceTypes: [],
      popularMenuItems: [],
      recentActivity: logs.map((l) => ({
        ...l,
        created_at: l.created_at ? new Date(String(l.created_at)).getTime() : Date.now(),
      })),
    });
  }

  if (pathname === '/api/admin/settings' && request.method === 'GET') {
    const defaults = buildWorkerFallbackSettings();
    const stored = await getCmsKvValue<Partial<SiteSettings>>(env, bridge, 'site_settings', {});
    return bridge.jsonResponse(request, env, { settings: { ...defaults, ...stored } });
  }

  if (pathname === '/api/admin/settings' && request.method === 'PUT') {
    const body = (await request.json().catch(() => ({}))) as Partial<SiteSettings>;
    const defaults = buildWorkerFallbackSettings();
    const existing = await getCmsKvValue<Partial<SiteSettings>>(env, bridge, 'site_settings', {});
    const merged: SiteSettings = { ...defaults, ...existing, ...body };
    const saved = await setCmsKvValue(env, bridge, 'site_settings', merged);
    if (!saved) {
      return bridge.jsonResponse(
        request,
        env,
        { error: 'Unable to persist settings. Ensure Supabase migration 006_admin_and_cms.sql is applied.' },
        503
      );
    }
    await recordWorkerActivity(env, bridge, currentAdmin.username, 'Saved CMS & website settings', 'Global configuration');
    return bridge.jsonResponse(request, env, { settings: merged });
  }

  if (pathname === '/api/admin/cafes' && request.method === 'GET') {
    const stored = await getCmsKvValue<LocationItem[] | null>(env, bridge, 'cafes_catalog', null);
    return bridge.jsonResponse(request, env, {
      cafes: Array.isArray(stored) && stored.length > 0 ? stored : buildDefaultWorkerLocations(),
    });
  }

  if (pathname === '/api/admin/navigation' && request.method === 'GET') {
    const nav = await getCmsKvValue<NavigationItem[]>(env, bridge, 'navigation_items', [
      { id: 1, location: 'header', label: 'Explore Cafes', url: '/locations', sort_order: 1, visible: true, is_external: false },
      { id: 2, location: 'header', label: 'Cafe Map', url: '/locations?view=map', sort_order: 2, visible: true, is_external: false },
      { id: 3, location: 'header', label: 'About', url: '/about', sort_order: 3, visible: true, is_external: false },
      { id: 4, location: 'header', label: 'Contact', url: '/contact', sort_order: 4, visible: true, is_external: false },
    ]);
    return bridge.jsonResponse(request, env, { navigation: nav });
  }

  if (pathname === '/api/admin/testimonials' && request.method === 'GET') {
    return bridge.jsonResponse(request, env, { testimonials: [] });
  }

  if (pathname === '/api/admin/media' && request.method === 'GET') {
    return bridge.jsonResponse(request, env, { media: [] });
  }

  if (pathname === '/api/admin/submissions' && request.method === 'GET') {
    return bridge.jsonResponse(request, env, { submissions: [] });
  }

  if (pathname === '/api/admin/suggestions' && request.method === 'GET') {
    return bridge.jsonResponse(request, env, { suggestions: [] });
  }

  if (pathname === '/api/admin/bookings' && request.method === 'GET') {
    return bridge.jsonResponse(request, env, { bookings: [] });
  }

  if (pathname === '/api/admin/users' && request.method === 'GET') {
    const { accounts } = await checkSupabaseAdminTable(env, bridge);
    return bridge.jsonResponse(request, env, {
      users: accounts.map((a) => ({
        id: a.id,
        username: a.username,
        email: a.email,
        display_name: a.display_name,
        role: a.role,
        two_factor_enabled: a.two_factor_enabled,
      })),
    });
  }

  if (pathname === '/api/admin/corrections' && request.method === 'GET') {
    const res = await bridge.supabaseServiceRest(
      env,
      'community_corrections?select=*&order=created_at.desc&limit=100'
    );
    const rows = res?.ok ? ((await res.json().catch(() => [])) as unknown[]) : [];
    return bridge.jsonResponse(request, env, { corrections: rows });
  }

  if (pathname.startsWith('/api/admin/corrections/') && request.method === 'PATCH') {
    const id = pathname.split('/').pop() || '';
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const status = bridge.cleanStr(body.status, 30);
    const adminNote = bridge.cleanStr(body.admin_note, 500);
    if (!['pending', 'approved', 'rejected', 'resolved'].includes(status)) {
      return bridge.jsonResponse(request, env, { error: 'Invalid status value.' }, 400);
    }
    const res = await bridge.supabaseServiceRest(
      env,
      `community_corrections?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          status,
          admin_note: adminNote,
          updated_at: new Date().toISOString(),
        }),
      }
    );
    if (!res?.ok) {
      return bridge.jsonResponse(request, env, { error: 'Could not update correction.' }, 500);
    }
    const updated = (await res.json().catch(() => [])) as unknown[];
    return bridge.jsonResponse(request, env, { ok: true, correction: updated[0] ?? null });
  }

  if (pathname === '/api/admin/audit-logs' && request.method === 'GET') {
    const res = await bridge.supabaseServiceRest(
      env,
      'admin_activity_logs?select=*&order=id.desc&limit=200'
    );
    const rows = res?.ok ? ((await res.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    const actors = Array.from(new Set(rows.map((r) => String(r.actor || '')).filter(Boolean))).sort();
    return bridge.jsonResponse(request, env, {
      logs: rows.map((r) => ({
        ...r,
        created_at: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now(),
      })),
      actors,
    });
  }

  if (pathname === '/api/admin/places/usage' && request.method === 'GET') {
    const res = await bridge.supabaseServiceRest(
      env,
      'places_api_logs?select=*&order=created_at.desc&limit=50'
    );
    const logs = res?.ok ? ((await res.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    return bridge.jsonResponse(request, env, {
      totalRequests: logs.length,
      cachedRequests: logs.filter((l) => Boolean(l.cached)).length,
      recentLogs: logs,
    });
  }

  if (pathname === '/api/admin/2fa/setup' && request.method === 'POST') {
    if (currentAdmin.source !== 'supabase') {
      return bridge.jsonResponse(
        request,
        env,
        { error: '2FA setup requires Supabase admin_accounts storage.' },
        503
      );
    }
    const secretBytes = new Uint8Array(20);
    crypto.getRandomValues(secretBytes);
    const secret = base32Encode(secretBytes);
    await bridge.supabaseServiceRest(env, `admin_accounts?id=eq.${encodeURIComponent(currentAdmin.sub)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        two_factor_secret: secret,
        updated_at: new Date().toISOString(),
      }),
    });
    const issuer = encodeURIComponent('Cafe Desk Admin');
    const label = encodeURIComponent(`Cafe Desk Admin:${currentAdmin.username}`);
    const otpauthUri = `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
    return bridge.jsonResponse(request, env, {
      secret,
      otpauthUri,
      alreadyEnabled: currentAdmin.twoFactorEnabled,
    });
  }

  if (pathname === '/api/admin/2fa/enable' && request.method === 'POST') {
    if (currentAdmin.source !== 'supabase') {
      return bridge.jsonResponse(request, env, { error: '2FA requires Supabase admin_accounts storage.' }, 503);
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const code = bridge.cleanStr(body.code, 12);
    const currentPassword = String(body.currentPassword ?? '');
    const { accounts } = await checkSupabaseAdminTable(env, bridge);
    const row = accounts.find((a) => String(a.id) === currentAdmin.sub);
    if (!row || !row.two_factor_secret) {
      return bridge.jsonResponse(request, env, { error: 'Generate a 2FA setup key first.' }, 400);
    }
    if (!currentPassword || !(await verifyPasswordWeb(currentPassword, row.password_hash, bridge.timingSafeEqualStr))) {
      return bridge.jsonResponse(request, env, { error: 'Current password is required to enable 2FA.' }, 400);
    }
    if (!(await verifyTotpWeb(row.two_factor_secret, code, bridge.timingSafeEqualStr))) {
      return bridge.jsonResponse(request, env, { error: 'Invalid 6-digit authenticator code.' }, 400);
    }
    await bridge.supabaseServiceRest(env, `admin_accounts?id=eq.${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ two_factor_enabled: true, updated_at: new Date().toISOString() }),
    });
    return bridge.jsonResponse(request, env, { ok: true, twoFactorEnabled: true });
  }

  if (pathname === '/api/admin/2fa/disable' && request.method === 'POST') {
    if (currentAdmin.source !== 'supabase') {
      return bridge.jsonResponse(request, env, { error: '2FA requires Supabase admin_accounts storage.' }, 503);
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const currentPassword = String(body.currentPassword ?? '');
    const { accounts } = await checkSupabaseAdminTable(env, bridge);
    const row = accounts.find((a) => String(a.id) === currentAdmin.sub);
    if (!row || !currentPassword || !(await verifyPasswordWeb(currentPassword, row.password_hash, bridge.timingSafeEqualStr))) {
      return bridge.jsonResponse(request, env, { error: 'Current password is required to disable 2FA.' }, 400);
    }
    await bridge.supabaseServiceRest(env, `admin_accounts?id=eq.${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        two_factor_enabled: false,
        two_factor_secret: '',
        updated_at: new Date().toISOString(),
      }),
    });
    return bridge.jsonResponse(request, env, { ok: true, twoFactorEnabled: false });
  }

  if (pathname === '/api/admin/profile' && request.method === 'PUT') {
    if (currentAdmin.source !== 'supabase') {
      return bridge.jsonResponse(request, env, { error: 'Profile updates require Supabase admin_accounts storage.' }, 503);
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const displayName = bridge.cleanStr(body.displayName, 60) || currentAdmin.displayName;
    const email = bridge.cleanStr(body.email, 120);
    const currentPassword = String(body.currentPassword ?? '');
    const newPassword = String(body.newPassword ?? '');
    const { accounts } = await checkSupabaseAdminTable(env, bridge);
    const row = accounts.find((a) => String(a.id) === currentAdmin.sub);
    if (!row) {
      return bridge.jsonResponse(request, env, { error: 'Admin account not found.' }, 404);
    }
    const patch: Record<string, unknown> = {
      display_name: displayName,
      email: email || row.email,
      updated_at: new Date().toISOString(),
    };
    if (newPassword) {
      if (!currentPassword || !(await verifyPasswordWeb(currentPassword, row.password_hash, bridge.timingSafeEqualStr))) {
        return bridge.jsonResponse(request, env, { error: 'Current password is incorrect.' }, 400);
      }
      const pwErr = validatePasswordStrength(newPassword);
      if (pwErr) return bridge.jsonResponse(request, env, { error: pwErr }, 400);
      patch.password_hash = await hashPasswordWeb(newPassword);
    }
    await bridge.supabaseServiceRest(env, `admin_accounts?id=eq.${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return bridge.jsonResponse(request, env, {
      ok: true,
      admin: {
        username: row.username,
        email: String(patch.email || ''),
        displayName,
        role: row.role,
      },
    });
  }

  if (pathname === '/api/admin/users/directory' && request.method === 'GET') {
    const [profilesRes, subsRes, paymentsRes] = await Promise.all([
      bridge.supabaseServiceRest(env, 'profiles?select=*&order=created_at.desc&limit=200'),
      bridge.supabaseServiceRest(env, 'user_subscriptions?select=*'),
      bridge.supabaseServiceRest(env, 'payments?select=*&order=created_at.desc&limit=200'),
    ]);
    const profiles = profilesRes?.ok ? ((await profilesRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    const subs = subsRes?.ok ? ((await subsRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    const payments = paymentsRes?.ok ? ((await paymentsRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    const subMap = new Map<string, Record<string, unknown>>();
    for (const s of subs) {
      if (s.user_id) subMap.set(String(s.user_id), s);
    }
    const users = profiles.map((p) => {
      const uid = String(p.id || '');
      const sub = subMap.get(uid);
      const userPayments = payments.filter((pay) => String(pay.user_id || '') === uid && pay.status === 'paid');
      const totalSpentInr = userPayments.reduce((acc, pay) => acc + Number(pay.amount_inr ?? 0), 0);
      return {
        id: uid,
        name: String(p.full_name || ''),
        email: String(p.email || ''),
        phone: String(p.phone || ''),
        auth_provider: String(p.auth_provider || 'email'),
        email_verified: Boolean(p.email_verified),
        status: String(p.account_status || 'active'),
        plan_id: String(sub?.plan_id || 'free'),
        subscription_status: String(sub?.status || 'active'),
        expires_at: sub?.expires_at ? new Date(String(sub.expires_at)).getTime() : null,
        total_spent_inr: totalSpentInr,
        last_login_at: p.last_login_at ? new Date(String(p.last_login_at)).getTime() : null,
        created_at: p.created_at ? new Date(String(p.created_at)).getTime() : Date.now(),
      };
    });
    return bridge.jsonResponse(request, env, { users });
  }

  if (pathname === '/api/admin/subscriptions/overview' && request.method === 'GET') {
    const [plansRes, subsRes, paymentsRes, profilesRes] = await Promise.all([
      bridge.supabaseServiceRest(env, 'subscription_plans?select=*&order=sort_order.asc'),
      bridge.supabaseServiceRest(env, 'user_subscriptions?select=*'),
      bridge.supabaseServiceRest(env, 'payments?select=*&order=created_at.desc&limit=100'),
      bridge.supabaseServiceRest(env, 'profiles?select=id,full_name,email'),
    ]);
    const plans = plansRes?.ok ? ((await plansRes.json().catch(() => [])) as unknown[]) : [];
    const subs = subsRes?.ok ? ((await subsRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    const payments = paymentsRes?.ok ? ((await paymentsRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    const profiles = profilesRes?.ok ? ((await profilesRes.json().catch(() => [])) as Array<Record<string, unknown>>) : [];
    const profileMap = new Map(profiles.map((p) => [String(p.id || ''), p]));
    return bridge.jsonResponse(request, env, {
      plans,
      subscriptions: subs.map((s) => {
        const p = profileMap.get(String(s.user_id || ''));
        return {
          ...s,
          user_name: String(p?.full_name || ''),
          user_email: String(p?.email || ''),
        };
      }),
      payments,
    });
  }

  if (pathname === '/api/admin/menu' && request.method === 'GET') {
    return bridge.jsonResponse(request, env, { items: [] });
  }

  if (pathname === '/api/admin/navigation' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const existing = await getCmsKvValue<NavigationItem[]>(env, bridge, 'navigation_items', []);
    const nextId = existing.reduce((max, it) => Math.max(max, Number(it.id || 0)), 0) + 1;
    const created: NavigationItem = {
      id: nextId,
      location: body.location === 'footer' ? 'footer' : 'header',
      label: bridge.cleanStr(body.label, 80) || 'Link',
      url: bridge.cleanStr(body.url, 300) || '/',
      sort_order: Number(body.sort_order ?? nextId),
      visible: body.visible !== false,
      is_external: Boolean(body.is_external),
    };
    const next = [...existing, created];
    await setCmsKvValue(env, bridge, 'navigation_items', next);
    return bridge.jsonResponse(request, env, { item: created }, 201);
  }

  if (pathname.startsWith('/api/admin/navigation/') && (request.method === 'PUT' || request.method === 'DELETE')) {
    const id = Number(pathname.split('/').pop());
    const existing = await getCmsKvValue<NavigationItem[]>(env, bridge, 'navigation_items', []);
    if (request.method === 'DELETE') {
      await setCmsKvValue(env, bridge, 'navigation_items', existing.filter((i) => i.id !== id));
      return bridge.jsonResponse(request, env, { ok: true });
    }
    const body = (await request.json().catch(() => ({}))) as Partial<NavigationItem>;
    const next = existing.map((i) => (i.id === id ? { ...i, ...body, id } : i));
    await setCmsKvValue(env, bridge, 'navigation_items', next);
    return bridge.jsonResponse(request, env, { ok: true });
  }

  if (pathname === '/api/admin/cafes' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as Partial<LocationItem>;
    const existing = await getCmsKvValue<LocationItem[] | null>(env, bridge, 'cafes_catalog', null) ?? buildDefaultWorkerLocations();
    const id = bridge.cleanStr(body.id || body.slug || `cafe-${bridge.randomHex(3)}`, 80);
    const created: LocationItem = {
      ...buildDefaultWorkerLocations()[0],
      ...body,
      id,
      slug: id,
      updated_at: Date.now(),
    };
    const saved = await setCmsKvValue(env, bridge, 'cafes_catalog', [created, ...existing]);
    if (!saved) {
      return bridge.jsonResponse(request, env, { error: 'Could not persist cafe in Supabase cms_kv.' }, 503);
    }
    return bridge.jsonResponse(request, env, { cafe: created }, 201);
  }

  if (pathname.startsWith('/api/admin/cafes/') && (request.method === 'PUT' || request.method === 'DELETE')) {
    const cafeId = decodeURIComponent(pathname.slice('/api/admin/cafes/'.length));
    const existing = await getCmsKvValue<LocationItem[] | null>(env, bridge, 'cafes_catalog', null) ?? buildDefaultWorkerLocations();
    if (request.method === 'DELETE') {
      await setCmsKvValue(env, bridge, 'cafes_catalog', existing.filter((c) => c.id !== cafeId));
      return bridge.jsonResponse(request, env, { ok: true });
    }
    const body = (await request.json().catch(() => ({}))) as Partial<LocationItem>;
    const next = existing.map((c) => (c.id === cafeId ? { ...c, ...body, id: cafeId, updated_at: Date.now() } : c));
    await setCmsKvValue(env, bridge, 'cafes_catalog', next);
    return bridge.jsonResponse(request, env, { cafe: next.find((c) => c.id === cafeId) ?? null });
  }

  return bridge.jsonResponse(
    request,
    env,
    {
      error: `Admin endpoint ${pathname} requires the full Node.js backend (BACKEND_ORIGIN).`,
    },
    501
  );
}

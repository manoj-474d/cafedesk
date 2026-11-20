import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import {
  DEFAULT_SITE_SETTINGS,
  getDb,
  getSiteSettingsFromDb,
  getUploadsDir,
  listLocationsFromDb,
  listMediaFromDb,
  listMenuItemsFromDb,
  listNavigationFromDb,
  listTestimonialsFromDb,
  recordActivity,
  syncCafeMenuServicesFromItems,
} from './server/db.ts';
import {
  buildTotpUri,
  checkRateLimit,
  clearRateLimit,
  clearSessionCookie,
  createSession,
  generateTotpSecret,
  getClientIp,
  hashPassword,
  parseCookies,
  recordRateAttempt,
  requireAdminAuth,
  requireFullAdmin,
  SESSION_COOKIE_NAME,
  setSessionCookie,
  sha256,
  validatePasswordStrength,
  verifyPassword,
  verifyTotpCode,
  type AdminRole,
} from './server/auth.ts';
import { registerSubscriptionRoutes } from './server/subscriptionRoutes.ts';
import type { CafeMode } from './src/config/constants.ts';
import type { AmenityState, DietaryType, SiteSettings } from './src/types/cms.ts';

const PORT = Number(process.env.PORT ?? 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

// Initialize SQLite database & run migrations on startup
getDb();

function cleanStr(val: unknown, maxLen = 500): string {
  return String(val ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanProse(val: unknown, maxLen = 4000): string {
  return String(val ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function isSafeHttpUrl(val: string): boolean {
  if (!val) return false;
  try {
    const u = new URL(val);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function isSafeLinkOrPath(val: string): boolean {
  if (!val) return true;
  if (val.startsWith('/') || val.startsWith('#')) return !val.startsWith('//');
  if (val.startsWith('mailto:') || val.startsWith('tel:')) return true;
  return isSafeHttpUrl(val);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

function slugifyId(name: string): string {
  const base = slugify(name).slice(0, 48);
  const suffix = crypto.randomBytes(2).toString('hex');
  return base ? `${base}-${suffix}` : `cafe-${suffix}`;
}

function getTodayIsoIst(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function parseAndValidateImageDataUrl(dataUrl: string): {
  error?: string;
  mimeType?: string;
  buffer?: Buffer;
  ext?: string;
} {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    return { error: 'Only PNG, JPEG, or WebP images are allowed.' };
  }
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > 4 * 1024 * 1024) {
    return { error: 'Image must be smaller than 4 MB.' };
  }

  const isPng =
    buffer.length > 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp =
    buffer.length > 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (
    (mimeType === 'image/png' && !isPng) ||
    (mimeType === 'image/jpeg' && !isJpeg) ||
    (mimeType === 'image/webp' && !isWebp)
  ) {
    return { error: 'File contents do not match declared image format.' };
  }

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  return { mimeType, buffer, ext };
}

function csvEscape(val: unknown): string {
  const s = String(val ?? '').replace(/\r?\n/g, ' ');
  if (/[",]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  // Global security headers (compatible with AI Studio preview iframe)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    res.setHeader('X-XSS-Protection', '0');
    if (IS_PROD && (req.secure || req.headers['x-forwarded-proto'] === 'https')) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  app.use(express.json({ limit: '6mb' }));

  app.use(
    '/uploads',
    express.static(getUploadsDir(), {
      maxAge: '7d',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    })
  );

  // ============================================================================
  // DYNAMIC SEO ENDPOINTS (sitemap.xml & robots.txt)
  // ============================================================================

  app.get('/robots.txt', (req, res) => {
    const settings = getSiteSettingsFromDb();
    const host = process.env.APP_URL || `${req.protocol}://${req.get('host') || 'cafedesk.space'}`;
    const baseUrl = host.replace(/\/$/, '');
    res.type('text/plain');
    if (!settings.seo_allow_indexing) {
      res.send(`User-agent: *\nDisallow: /\n`);
      return;
    }
    res.send(`User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${baseUrl}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (req, res) => {
    const locations = listLocationsFromDb(false);
    const host = process.env.APP_URL || `${req.protocol}://${req.get('host') || 'cafedesk.space'}`;
    const baseUrl = host.replace(/\/$/, '');
    const staticRoutes = ['/', '/locations', '/pricing', '/about', '/contact', '/submit', '/owners'];

    const urls = [
      ...staticRoutes.map((r) => `  <url><loc>${baseUrl}${r}</loc><changefreq>weekly</changefreq></url>`),
      ...locations.map(
        (loc) =>
          `  <url><loc>${baseUrl}/locations/${encodeURIComponent(loc.slug)}</loc><changefreq>weekly</changefreq></url>`
      ),
    ];

    res.type('application/xml');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`
    );
  });

  // ============================================================================
  // CUSTOMER AUTH, SUBSCRIPTIONS, RAZORPAY BILLING & ADMIN CONTROLS
  // ============================================================================

  registerSubscriptionRoutes(app);

  // ============================================================================
  // PUBLIC CMS & SUBMISSION API
  // ============================================================================

  app.get('/api/public/bootstrap', (_req, res) => {
    const locations = listLocationsFromDb(false);
    const settings = getSiteSettingsFromDb();
    const navigation = listNavigationFromDb(false);
    const testimonials = listTestimonialsFromDb(false);
    const media = listMediaFromDb();
    res.json({ locations, settings, navigation, testimonials, media });
  });

  app.post('/api/analytics/visit', (req, res) => {
    const db = getDb();
    const today = getTodayIsoIst();
    const cookies = parseCookies(req.headers.cookie);
    const existingVid = cookies['cafedesk_vid'];
    const vid =
      existingVid && /^[a-f0-9]{24}$/.test(existingVid)
        ? existingVid
        : crypto.randomBytes(12).toString('hex');

    if (!existingVid) {
      res.cookie('cafedesk_vid', vid, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 365,
        path: '/',
      });
    }

    const visitorHash = sha256(`${vid}:${today}`);
    const now = Date.now();
    const seenToday = db
      .prepare('SELECT visitor_hash FROM visitor_tokens WHERE visitor_hash = ?')
      .get(visitorHash);

    db.prepare(
      `INSERT INTO daily_visits (date, page_views, unique_visitors)
       VALUES (?, 1, ?)
       ON CONFLICT(date) DO UPDATE SET
         page_views = page_views + 1,
         unique_visitors = unique_visitors + ?`
    ).run(today, seenToday ? 0 : 1, seenToday ? 0 : 1);

    if (!seenToday) {
      db.prepare(
        `INSERT OR IGNORE INTO visitor_tokens (visitor_hash, first_seen, last_seen)
         VALUES (?, ?, ?)`
      ).run(visitorHash, now, now);
    }

    res.json({ ok: true });
  });

  app.post('/api/submissions', (req, res) => {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`submit:${ip}`, 15, 15 * 60 * 1000);
    if (!rl.allowed) {
      res.status(429).json({
        error: `Too many submissions. Please wait ${rl.retryAfterSec} seconds.`,
      });
      return;
    }
    recordRateAttempt(`submit:${ip}`, 15 * 60 * 1000);

    const type = cleanStr(req.body?.type, 40);
    const allowedTypes = new Set([
      'contact_enquiry',
      'cafe_suggest',
      'cafe_update',
      'owner_enquiry',
      'newsletter',
    ]);
    if (!allowedTypes.has(type)) {
      res.status(400).json({ error: 'Invalid submission type.' });
      return;
    }

    const cafeName = cleanStr(req.body?.cafeName, 140);
    const area = cleanStr(req.body?.area, 80);
    const contactName = cleanStr(req.body?.contactName, 100);
    const contactInfo = cleanStr(req.body?.contactInfo, 180);
    const plan = cleanStr(req.body?.plan, 60);
    const notes = cleanProse(req.body?.notes, 2000);

    if (type === 'newsletter') {
      if (!contactInfo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactInfo)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
    } else if (type === 'contact_enquiry') {
      if (!contactName || !contactInfo || !notes) {
        res.status(400).json({ error: 'Name, email/phone, and message are required.' });
        return;
      }
    } else if (type === 'owner_enquiry') {
      if (!cafeName || !contactName || !contactInfo) {
        res.status(400).json({ error: 'Cafe name, contact name, and phone are required.' });
        return;
      }
    } else {
      if (!cafeName || !notes) {
        res.status(400).json({ error: 'Cafe name and details are required.' });
        return;
      }
    }

    const db = getDb();
    const now = Date.now();
    const payload = {
      mapOrAddress: cleanStr(req.body?.mapOrAddress, 300),
      wifiAndSockets: cleanStr(req.body?.wifiAndSockets, 200),
      preferredDate: cleanStr(req.body?.preferredDate, 60),
      preferredTime: cleanStr(req.body?.preferredTime, 40),
      guestsCount: cleanStr(req.body?.guestsCount, 20),
      email: cleanStr(req.body?.email, 160),
      notes,
    };

    const result = db
      .prepare(
        `INSERT INTO submissions (type, cafe_name, area, contact_name, contact_info, plan, payload_json, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)`
      )
      .run(
        type,
        cafeName || null,
        area || null,
        contactName || null,
        contactInfo || null,
        plan || null,
        JSON.stringify(payload),
        now
      );

    recordActivity('Public Visitor', `Submitted ${type}`, cafeName || contactName || contactInfo || 'Form');
    res.status(201).json({ ok: true, id: Number(result.lastInsertRowid) });
  });

  // ============================================================================
  // ADMIN AUTHENTICATION & PASSWORD RESET API
  // ============================================================================

  app.get('/api/admin/status', (req, res) => {
    const db = getDb();
    const countRow = db.prepare('SELECT COUNT(*) as cnt FROM admins').get() as { cnt: number };
    const setupRequired = countRow.cnt === 0;

    const cookies = parseCookies(req.headers.cookie);
    const rawToken = cookies[SESSION_COOKIE_NAME];
    if (!rawToken) {
      res.json({ setupRequired, authenticated: false });
      return;
    }

    const row = db
      .prepare(
        `SELECT s.id as session_id, s.csrf_token, s.expires_at,
                a.username, a.email, a.display_name, a.role, a.two_factor_enabled
         FROM sessions s
         JOIN admins a ON a.id = s.admin_id
         WHERE s.token_hash = ?`
      )
      .get(sha256(rawToken)) as
      | {
          session_id: number;
          csrf_token: string;
          expires_at: number;
          username: string;
          email: string | null;
          display_name: string;
          role: string;
          two_factor_enabled: number;
        }
      | undefined;

    if (!row || row.expires_at < Date.now()) {
      clearSessionCookie(req, res);
      res.json({ setupRequired, authenticated: false });
      return;
    }

    res.json({
      setupRequired,
      authenticated: true,
      admin: {
        username: row.username,
        email: row.email ?? '',
        displayName: row.display_name,
        role: row.role,
        csrfToken: row.csrf_token,
        expiresAt: row.expires_at,
        twoFactorEnabled: Boolean(row.two_factor_enabled),
      },
    });
  });

  app.post('/api/admin/setup', (req, res) => {
    const db = getDb();
    const countRow = db.prepare('SELECT COUNT(*) as cnt FROM admins').get() as { cnt: number };
    if (countRow.cnt > 0) {
      res.status(403).json({ error: 'Administrator account already configured.' });
      return;
    }

    const username = cleanStr(req.body?.username, 40);
    const email = cleanStr(req.body?.email, 120);
    const displayName = cleanStr(req.body?.displayName, 60) || 'Site Administrator';
    const password = String(req.body?.password ?? '');

    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
      res.status(400).json({
        error: 'Username must be 3–40 characters (letters, numbers, dot, underscore, or hyphen).',
      });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const pwError = validatePasswordStrength(password);
    if (pwError) {
      res.status(400).json({ error: pwError });
      return;
    }

    const now = Date.now();
    const pwHash = hashPassword(password);
    const insertRes = db
      .prepare(
        `INSERT INTO admins (username, email, display_name, password_hash, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'super_admin', ?, ?)`
      )
      .run(username, email, displayName, pwHash, now, now);

    const adminId = Number(insertRes.lastInsertRowid);
    const { rawToken, csrfToken, expiresAt } = createSession(adminId, req);
    setSessionCookie(req, res, rawToken);
    recordActivity(username, 'Initial admin setup', 'Super Admin account created');

    res.status(201).json({
      ok: true,
      admin: {
        username,
        email,
        displayName,
        role: 'super_admin',
        csrfToken,
        expiresAt,
        twoFactorEnabled: false,
      },
    });
  });

  app.post('/api/admin/login', (req, res) => {
    const ip = getClientIp(req);
    const identifier = cleanStr(req.body?.username, 120);
    const password = String(req.body?.password ?? '');
    const totpCode = cleanStr(req.body?.totpCode, 12);

    const ipKey = `login:ip:${ip}`;
    const userKey = `login:user:${identifier.toLowerCase()}`;

    const ipCheck = checkRateLimit(ipKey, 15, 15 * 60 * 1000);
    if (!ipCheck.allowed) {
      res.setHeader('Retry-After', String(ipCheck.retryAfterSec));
      res.status(429).json({
        error: `Too many login attempts. Try again in ${ipCheck.retryAfterSec} seconds.`,
      });
      return;
    }

    const userCheck = checkRateLimit(userKey, 6, 15 * 60 * 1000);
    if (!userCheck.allowed) {
      res.setHeader('Retry-After', String(userCheck.retryAfterSec));
      res.status(429).json({
        error: `Account temporarily locked due to failed attempts. Try again in ${userCheck.retryAfterSec} seconds.`,
      });
      return;
    }

    if (!identifier || !password) {
      res.status(400).json({ error: 'Username/email and password are required.' });
      return;
    }

    const db = getDb();
    const adminRow = db
      .prepare(
        `SELECT id, username, email, display_name, password_hash, role,
                two_factor_enabled, two_factor_secret, failed_attempts, locked_until
         FROM admins
         WHERE username = ? OR (email IS NOT NULL AND email != '' AND LOWER(email) = LOWER(?))`
      )
      .get(identifier, identifier) as
      | {
          id: number;
          username: string;
          email: string | null;
          display_name: string;
          password_hash: string;
          role: string;
          two_factor_enabled: number;
          two_factor_secret: string;
          failed_attempts: number;
          locked_until: number | null;
        }
      | undefined;

    const now = Date.now();
    if (adminRow?.locked_until && adminRow.locked_until > now) {
      const retryAfterSec = Math.max(1, Math.ceil((adminRow.locked_until - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: `Account locked after repeated failed attempts. Try again in ${retryAfterSec} seconds.`,
      });
      return;
    }

    if (!adminRow || !verifyPassword(password, adminRow.password_hash)) {
      recordRateAttempt(ipKey, 15 * 60 * 1000);
      recordRateAttempt(userKey, 15 * 60 * 1000);
      if (adminRow) {
        const nextAttempts = (adminRow.failed_attempts ?? 0) + 1;
        const lockUntil = nextAttempts >= 5 ? now + 15 * 60 * 1000 : null;
        db.prepare('UPDATE admins SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(
          nextAttempts,
          lockUntil,
          adminRow.id
        );
      }
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    if (adminRow.two_factor_enabled === 1) {
      if (!totpCode) {
        res.json({
          ok: false,
          requires2FA: true,
          message: 'Enter the 6-digit verification code from your authenticator app.',
        });
        return;
      }
      if (!verifyTotpCode(adminRow.two_factor_secret, totpCode)) {
        recordRateAttempt(ipKey, 15 * 60 * 1000);
        recordRateAttempt(userKey, 15 * 60 * 1000);
        const nextAttempts = (adminRow.failed_attempts ?? 0) + 1;
        const lockUntil = nextAttempts >= 5 ? now + 15 * 60 * 1000 : null;
        db.prepare('UPDATE admins SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(
          nextAttempts,
          lockUntil,
          adminRow.id
        );
        res.status(401).json({ error: 'Invalid 2FA verification code.' });
        return;
      }
    }

    db.prepare('UPDATE admins SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(
      adminRow.id
    );
    clearRateLimit(ipKey);
    clearRateLimit(userKey);

    const { rawToken, csrfToken, expiresAt } = createSession(adminRow.id, req);
    setSessionCookie(req, res, rawToken);
    recordActivity(adminRow.username, 'Signed in', 'Admin dashboard');

    res.json({
      ok: true,
      admin: {
        username: adminRow.username,
        email: adminRow.email ?? '',
        displayName: adminRow.display_name,
        role: adminRow.role,
        csrfToken,
        expiresAt,
        twoFactorEnabled: Boolean(adminRow.two_factor_enabled),
      },
    });
  });

  app.post('/api/admin/reset-request', (req, res) => {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`reset-req:${ip}`, 3, 15 * 60 * 1000);
    if (!rl.allowed) {
      res.status(429).json({
        error: `Too many reset requests. Please wait ${rl.retryAfterSec} seconds.`,
      });
      return;
    }
    recordRateAttempt(`reset-req:${ip}`, 15 * 60 * 1000);

    const identifier = cleanStr(req.body?.username, 120);
    if (identifier) {
      const db = getDb();
      const admin = db
        .prepare(
          `SELECT id, username FROM admins
           WHERE username = ? OR (email IS NOT NULL AND email != '' AND LOWER(email) = LOWER(?))`
        )
        .get(identifier, identifier) as { id: number; username: string } | undefined;

      if (admin) {
        const recoveryCode = crypto.randomBytes(6).toString('hex').toUpperCase();
        const expiresAt = Date.now() + 15 * 60 * 1000;
        db.prepare(
          'UPDATE admins SET reset_token_hash = ?, reset_token_expires_at = ? WHERE id = ?'
        ).run(sha256(recoveryCode), expiresAt, admin.id);

        console.info(
          `[CafeDesk Security] Password recovery code for "${admin.username}" (valid 15m): ${recoveryCode}`
        );
        recordActivity(admin.username, 'Requested password reset', 'Recovery token issued');
      }
    }

    res.json({
      ok: true,
      message:
        'If an account matches that username or email, a 15-minute single-use recovery code has been logged on the server.',
    });
  });

  app.post('/api/admin/reset-confirm', (req, res) => {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`reset-confirm:${ip}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      res.status(429).json({
        error: `Too many attempts. Try again in ${rl.retryAfterSec} seconds.`,
      });
      return;
    }
    recordRateAttempt(`reset-confirm:${ip}`, 15 * 60 * 1000);

    const identifier = cleanStr(req.body?.username, 120);
    const recoveryCode = cleanStr(req.body?.recoveryCode, 32).toUpperCase();
    const newPassword = String(req.body?.newPassword ?? '');

    if (!identifier || !recoveryCode || !newPassword) {
      res.status(400).json({ error: 'Username/email, recovery code, and new password are required.' });
      return;
    }

    const pwError = validatePasswordStrength(newPassword);
    if (pwError) {
      res.status(400).json({ error: pwError });
      return;
    }

    const db = getDb();
    const admin = db
      .prepare(
        `SELECT id, username, reset_token_hash, reset_token_expires_at FROM admins
         WHERE username = ? OR (email IS NOT NULL AND email != '' AND LOWER(email) = LOWER(?))`
      )
      .get(identifier, identifier) as
      | {
          id: number;
          username: string;
          reset_token_hash: string | null;
          reset_token_expires_at: number | null;
        }
      | undefined;

    if (
      !admin ||
      !admin.reset_token_hash ||
      !admin.reset_token_expires_at ||
      admin.reset_token_expires_at < Date.now()
    ) {
      res.status(400).json({ error: 'Invalid or expired recovery code.' });
      return;
    }

    const expected = Buffer.from(admin.reset_token_hash);
    const actual = Buffer.from(sha256(recoveryCode));
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      res.status(400).json({ error: 'Invalid or expired recovery code.' });
      return;
    }

    const newHash = hashPassword(newPassword);
    db.prepare(
      `UPDATE admins
       SET password_hash = ?, reset_token_hash = NULL, reset_token_expires_at = NULL, updated_at = ?
       WHERE id = ?`
    ).run(newHash, Date.now(), admin.id);

    db.prepare('DELETE FROM sessions WHERE admin_id = ?').run(admin.id);
    recordActivity(admin.username, 'Reset password', 'All old sessions revoked');

    res.json({ ok: true, message: 'Password updated. You may now sign in.' });
  });

  // ============================================================================
  // PROTECTED ADMIN DASHBOARD API (Session + Role + CSRF required)
  // ============================================================================

  app.post('/api/admin/logout', requireAdminAuth, (req, res) => {
    const db = getDb();
    if (req.admin) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(req.admin.sessionId);
      recordActivity(req.admin.username, 'Signed out', 'Admin dashboard');
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // ---- Two-Factor Authentication (TOTP 2FA) ----
  app.post('/api/admin/2fa/setup', requireAdminAuth, (req, res) => {
    const db = getDb();
    const row = db
      .prepare('SELECT username, two_factor_enabled FROM admins WHERE id = ?')
      .get(req.admin!.id) as { username: string; two_factor_enabled: number } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Admin account not found.' });
      return;
    }
    const secret = generateTotpSecret();
    db.prepare('UPDATE admins SET two_factor_secret = ?, updated_at = ? WHERE id = ?').run(
      secret,
      Date.now(),
      req.admin!.id
    );
    const otpauthUri = buildTotpUri(secret, row.username, 'Cafe Desk Admin');
    res.json({ secret, otpauthUri, alreadyEnabled: Boolean(row.two_factor_enabled) });
  });

  app.post('/api/admin/2fa/enable', requireAdminAuth, (req, res) => {
    const code = cleanStr(req.body?.code, 12);
    const currentPassword = String(req.body?.currentPassword ?? '');
    const db = getDb();
    const row = db
      .prepare('SELECT username, password_hash, two_factor_secret FROM admins WHERE id = ?')
      .get(req.admin!.id) as
      | { username: string; password_hash: string; two_factor_secret: string }
      | undefined;

    if (!row || !row.two_factor_secret) {
      res.status(400).json({ error: 'Generate a 2FA setup key first.' });
      return;
    }
    if (!currentPassword || !verifyPassword(currentPassword, row.password_hash)) {
      res.status(400).json({ error: 'Current password is required to enable 2FA.' });
      return;
    }
    if (!verifyTotpCode(row.two_factor_secret, code)) {
      res.status(400).json({ error: 'Invalid 6-digit authenticator code. Check your device clock and retry.' });
      return;
    }

    db.prepare('UPDATE admins SET two_factor_enabled = 1, updated_at = ? WHERE id = ?').run(
      Date.now(),
      req.admin!.id
    );
    recordActivity(row.username, 'Enabled Two-Factor Authentication', 'Admin security', 'Disabled', 'Enabled');
    res.json({ ok: true, twoFactorEnabled: true });
  });

  app.post('/api/admin/2fa/disable', requireAdminAuth, (req, res) => {
    const currentPassword = String(req.body?.currentPassword ?? '');
    const db = getDb();
    const row = db
      .prepare('SELECT username, password_hash FROM admins WHERE id = ?')
      .get(req.admin!.id) as { username: string; password_hash: string } | undefined;

    if (!row || !currentPassword || !verifyPassword(currentPassword, row.password_hash)) {
      res.status(400).json({ error: 'Current password is required to disable 2FA.' });
      return;
    }

    db.prepare(
      "UPDATE admins SET two_factor_enabled = 0, two_factor_secret = '', updated_at = ? WHERE id = ?"
    ).run(Date.now(), req.admin!.id);
    recordActivity(row.username, 'Disabled Two-Factor Authentication', 'Admin security', 'Enabled', 'Disabled');
    res.json({ ok: true, twoFactorEnabled: false });
  });

  app.get('/api/admin/overview', requireAdminAuth, (_req, res) => {
    const db = getDb();
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const yearAgo = now - 365 * 24 * 60 * 60 * 1000;

    const visitsAgg = db
      .prepare(
        'SELECT COALESCE(SUM(unique_visitors), 0) as visitors, COALESCE(SUM(page_views), 0) as views FROM daily_visits'
      )
      .get() as { visitors: number; views: number };

    const today = getTodayIsoIst();
    const todayRow = db
      .prepare('SELECT unique_visitors, page_views FROM daily_visits WHERE date = ?')
      .get(today) as { unique_visitors: number; page_views: number } | undefined;

    const cafeStats = db
      .prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN published = 1 THEN 1 ELSE 0 END) as publishedCount,
                SUM(CASE WHEN published = 0 THEN 1 ELSE 0 END) as inactiveCount,
                SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified,
                SUM(CASE WHEN featured = 1 THEN 1 ELSE 0 END) as featured,
                SUM(CASE WHEN COALESCE(created_at, updated_at) >= ? THEN 1 ELSE 0 END) as newThisWeek
         FROM cafes`
      )
      .get(weekAgo) as {
      total: number;
      publishedCount: number;
      inactiveCount: number;
      verified: number;
      featured: number;
      newThisWeek: number;
    };

    const menuStats = db.prepare('SELECT COUNT(*) as total FROM menu_items').get() as {
      total: number;
    };

    const userCountRow = db.prepare('SELECT COUNT(*) as total FROM users').get() as { total: number };
    const subStats = db
      .prepare(
        `SELECT
           SUM(CASE WHEN us.plan_id = 'free' THEN 1 ELSE 0 END) as freeUsers,
           SUM(CASE WHEN us.plan_id != 'free' AND us.status = 'active' AND (us.expires_at IS NULL OR us.expires_at > ?) THEN 1 ELSE 0 END) as activePaidSubs,
           SUM(CASE WHEN us.plan_id != 'free' AND us.status = 'cancelled' THEN 1 ELSE 0 END) as cancelledSubs,
           SUM(CASE WHEN us.plan_id != 'free' AND (us.status = 'expired' OR (us.expires_at IS NOT NULL AND us.expires_at <= ?)) THEN 1 ELSE 0 END) as expiredSubs
         FROM user_subscriptions us`
      )
      .get(now, now) as {
      freeUsers: number;
      activePaidSubs: number;
      cancelledSubs: number;
      expiredSubs: number;
    };

    const revAgg = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_inr ELSE 0 END), 0) as totalRev,
           COALESCE(SUM(CASE WHEN status = 'paid' AND created_at >= ? THEN amount_inr ELSE 0 END), 0) as monthRev,
           COALESCE(SUM(CASE WHEN status = 'paid' AND created_at >= ? THEN amount_inr ELSE 0 END), 0) as yearRev
         FROM payments`
      )
      .get(monthAgo, yearAgo) as { totalRev: number; monthRev: number; yearRev: number };

    const activePaidRows = db
      .prepare(
        `SELECT COALESCE(us.subscribed_price_inr, sp.price_inr) as eff_price, sp.interval_days
         FROM user_subscriptions us
         JOIN subscription_plans sp ON sp.id = us.plan_id
         WHERE us.plan_id != 'free' AND us.status = 'active' AND (us.expires_at IS NULL OR us.expires_at > ?)`
      )
      .all(now) as Array<{ eff_price: number; interval_days: number }>;

    const mrrInr = Math.round(
      activePaidRows.reduce((sum, r) => {
        const days = Math.max(1, Number(r.interval_days || 30));
        return sum + (Number(r.eff_price || 0) * 30) / days;
      }, 0)
    );

    const enquiryStats = db
      .prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as pending
         FROM submissions`
      )
      .get() as { total: number; pending: number };

    const suggestionStats = db
      .prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as pending
         FROM feature_suggestions`
      )
      .get() as { total: number; pending: number };

    const mediaStats = db.prepare('SELECT COUNT(*) as total FROM media_assets').get() as {
      total: number;
    };

    const adminCount = db.prepare('SELECT COUNT(*) as total FROM admins').get() as {
      total: number;
    };

    const dailyChart = db
      .prepare('SELECT date, page_views, unique_visitors FROM daily_visits ORDER BY date DESC LIMIT 14')
      .all() as Array<{ date: string; page_views: number; unique_visitors: number }>;

    const recentPayments = db
      .prepare(
        `SELECT p.id, p.receipt_number, p.amount_inr, p.status, p.method, p.created_at,
                u.name as user_name, u.email as user_email, COALESCE(sp.name, p.plan_id) as plan_name
         FROM payments p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN subscription_plans sp ON sp.id = p.plan_id
         ORDER BY p.created_at DESC
         LIMIT 6`
      )
      .all();

    const recentUsers = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.status, u.created_at, u.last_login_at,
                COALESCE(sp.name, 'Free Explorer') as plan_name,
                COALESCE(us.plan_id, 'free') as plan_id
         FROM users u
         LEFT JOIN user_subscriptions us ON us.user_id = u.id
         LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
         ORDER BY u.created_at DESC
         LIMIT 6`
      )
      .all();

    const recentRenewals = db
      .prepare(
        `SELECT sh.id, sh.action, sh.from_plan, sh.to_plan, sh.note, sh.created_at,
                u.name as user_name, u.email as user_email
         FROM subscription_history sh
         JOIN users u ON u.id = sh.user_id
         ORDER BY sh.created_at DESC
         LIMIT 6`
      )
      .all();

    const paidRowsForChart = db
      .prepare(
        "SELECT amount_inr, created_at FROM payments WHERE status = 'paid' AND created_at >= ? ORDER BY created_at ASC"
      )
      .all(now - 14 * 24 * 60 * 60 * 1000) as Array<{ amount_inr: number; created_at: number }>;
    const revByDay = new Map<string, number>();
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      revByDay.set(d, 0);
    }
    for (const r of paidRowsForChart) {
      const d = new Date(Number(r.created_at)).toISOString().slice(0, 10);
      if (revByDay.has(d)) {
        revByDay.set(d, (revByDay.get(d) ?? 0) + Number(r.amount_inr || 0));
      }
    }
    const revenueChart = Array.from(revByDay.entries()).map(([date, amount_inr]) => ({
      date,
      amount_inr,
    }));

    const recentActivity = db
      .prepare(
        'SELECT id, actor, action, target, previous_value, new_value, created_at FROM activity_logs ORDER BY id DESC LIMIT 25'
      )
      .all();

    const totalUsers = Number(userCountRow.total ?? 0);
    const activeSubs = Number(subStats?.activePaidSubs ?? 0);
    const freeUsers = Math.max(0, totalUsers - activeSubs);

    res.json({
      totalVisitors: Number(visitsAgg.visitors),
      totalPageViews: Number(visitsAgg.views),
      todayVisitors: Number(todayRow?.unique_visitors ?? 0),
      todayPageViews: Number(todayRow?.page_views ?? 0),
      totalCafes: Number(cafeStats.total),
      publishedCafes: Number(cafeStats.publishedCount ?? 0),
      inactiveCafes: Number(cafeStats.inactiveCount ?? 0),
      verifiedCafes: Number(cafeStats.verified ?? 0),
      featuredCafes: Number(cafeStats.featured ?? 0),
      newCafesThisWeek: Number(cafeStats.newThisWeek ?? 0),
      totalMenuItems: Number(menuStats.total ?? 0),
      totalUsers,
      freeUsers,
      paidUsers: activeSubs,
      activeSubs,
      cancelledSubs: Number(subStats?.cancelledSubs ?? 0),
      expiredSubs: Number(subStats?.expiredSubs ?? 0),
      totalRevenueInr: Number(revAgg?.totalRev ?? 0),
      monthRevenueInr: Number(revAgg?.monthRev ?? 0),
      yearRevenueInr: Number(revAgg?.yearRev ?? 0),
      mrrInr,
      totalSubmissions: Number(enquiryStats.total),
      newSubmissions: Number(enquiryStats.pending ?? 0),
      totalSuggestions: Number(suggestionStats.total),
      newSuggestions: Number(suggestionStats.pending ?? 0),
      totalMedia: Number(mediaStats.total),
      totalAdmins: Number(adminCount.total),
      dailyChart: dailyChart.reverse(),
      revenueChart,
      recentPayments,
      recentUsers,
      recentRenewals,
      recentActivity,
    });
  });

  // ---- Activity & Audit Logs ----
  app.get('/api/admin/audit-logs', requireAdminAuth, (req, res) => {
    const db = getDb();
    const q = cleanStr(req.query.q, 100).toLowerCase();
    const actor = cleanStr(req.query.actor, 80);
    const limit = Math.max(10, Math.min(1000, Number(req.query.limit ?? 300)));

    const rows = db
      .prepare(
        'SELECT id, actor, action, target, previous_value, new_value, created_at FROM activity_logs ORDER BY id DESC LIMIT ?'
      )
      .all(limit) as Array<Record<string, unknown>>;

    const actorsSet = new Set<string>();
    const filtered = rows
      .map((r) => {
        const entry = {
          id: Number(r.id),
          actor: String(r.actor),
          action: String(r.action),
          target: String(r.target),
          previous_value: String(r.previous_value ?? ''),
          new_value: String(r.new_value ?? ''),
          created_at: Number(r.created_at),
        };
        if (entry.actor) actorsSet.add(entry.actor);
        return entry;
      })
      .filter((entry) => {
        if (actor && entry.actor !== actor) return false;
        if (q) {
          const hay = `${entry.actor} ${entry.action} ${entry.target} ${entry.previous_value} ${entry.new_value}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

    res.json({ logs: filtered, actors: Array.from(actorsSet).sort() });
  });

  // ---- Locations Management ----
  app.get('/api/admin/cafes', requireAdminAuth, (_req, res) => {
    res.json({ cafes: listLocationsFromDb(true) });
  });

  function toNullableInt(val: unknown, min: number, max: number): number | null {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    if (!Number.isFinite(n)) return null;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  function toNullableFloat(val: unknown, min: number, max: number, decimals = 6): number | null {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    if (!Number.isFinite(n)) return null;
    const clamped = Math.max(min, Math.min(max, n));
    const factor = 10 ** decimals;
    return Math.round(clamped * factor) / factor;
  }

  function toNullableStr(val: unknown, maxLen: number): string | null {
    const s = cleanStr(val, maxLen);
    return s || null;
  }

  function parseAmenityState(val: unknown): AmenityState {
    if (val === 'yes' || val === 'no' || val === 'unknown') return val;
    if (val === true) return 'yes';
    if (val === false) return 'no';
    return 'unknown';
  }

  function derivePriceRangeText(avgCost: number | null): string {
    if (avgCost === null) return '';
    if (avgCost <= 200) return '₹100–₹200';
    if (avgCost <= 300) return '₹200–₹300';
    if (avgCost <= 500) return '₹300–₹500';
    return '₹500+';
  }

  function validateLocationPayload(body: Record<string, unknown>, existingId?: string) {
    const name = cleanStr(body.name, 140);
    const category = cleanStr(body.category, 60) || 'Cafe';
    const city = cleanStr(body.city, 80) || 'Bengaluru';
    const area = cleanStr(body.area, 80);
    const address = cleanStr(body.address, 300);
    const phone = cleanStr(body.phone, 40);
    const mapLink = cleanStr(body.map_link, 500);
    const websiteUrl = cleanStr(body.website_url, 400);
    const menuUrl = cleanStr(body.menu_url, 400);
    const instagramUrl = cleanStr(body.instagram_url, 400);
    const otherSocialLinks = cleanStr(body.other_social_links, 500);
    const placeId = cleanStr(body.place_id, 140);
    const lat = toNullableFloat(body.lat, -90, 90, 6);
    const lng = toNullableFloat(body.lng, -180, 180, 6);
    const timings = cleanStr(body.timings, 80);
    const description = cleanProse(body.description, 2000);
    const seatingInfo = cleanStr(body.seating_info, 280);
    const ambience = cleanStr(body.ambience, 280);
    const outdoorSeating = parseAmenityState(body.outdoor_seating);
    const claims = (Array.isArray(body.claims) ? body.claims : [])
      .map((c) => cleanStr(c, 300))
      .filter(Boolean)
      .slice(0, 12);
    const verdict = cleanStr(body.verdict, 300) || claims[0] || '';
    const avoidIf = toNullableStr(body.avoid_if, 300);
    const studentDiscount = toNullableStr(body.student_discount, 200);
    const minSpend = toNullableStr(body.min_spend, 120);
    const timeLimit = toNullableStr(body.time_limit, 120);
    const lastVerifiedDate = toNullableStr(body.last_verified_date, 40);
    const sourceName = cleanStr(body.source_name, 140);
    const sourceUrl = cleanStr(body.source_url, 500);

    if (!name || !area || !timings) {
      return { error: 'Name, area, and timings are required.' } as const;
    }
    if (mapLink && !isSafeHttpUrl(mapLink)) {
      return { error: 'Google Maps link must start with http:// or https://.' } as const;
    }
    if (sourceUrl && !isSafeHttpUrl(sourceUrl)) {
      return { error: 'Source URL must start with http:// or https://.' } as const;
    }
    if (websiteUrl && !isSafeHttpUrl(websiteUrl)) {
      return { error: 'Website URL must start with http:// or https://.' } as const;
    }
    if (menuUrl && !isSafeHttpUrl(menuUrl)) {
      return { error: 'Menu URL must start with http:// or https://.' } as const;
    }
    if (instagramUrl && !isSafeHttpUrl(instagramUrl)) {
      return { error: 'Instagram URL must start with http:// or https://.' } as const;
    }

    const rawSlug = cleanStr(body.slug, 80);
    const slug = slugify(rawSlug || name) || existingId || slugifyId(name);

    const wifiMbps = toNullableInt(body.wifi_mbps, 0, 2000);
    const socketsCount = toNullableInt(body.sockets_count, 0, 500);
    const noiseLevel = toNullableInt(body.noise_level, 1, 5);
    const avgCost = toNullableInt(body.avg_cost_per_person, 0, 10000);
    const rating = toNullableFloat(body.rating, 0, 5, 1);
    const ratingCount = toNullableInt(body.rating_count, 0, 1000000);
    const displayOrder = Math.max(0, Math.min(9999, Math.round(Number(body.display_order ?? 0))));

    const priceRange = cleanStr(body.price_range, 60) || derivePriceRangeText(avgCost);
    const coffeePrice = toNullableStr(body.coffee_price, 80);
    const teaPrice = toNullableStr(body.tea_price, 80);
    const snacksPrice = toNullableStr(body.snacks_price, 80);
    const mealsPrice = toNullableStr(body.meals_price, 80);
    const popularItems = (Array.isArray(body.popular_items) ? body.popular_items : [])
      .map((item) => cleanStr(item, 80))
      .filter(Boolean)
      .slice(0, 15);

    const wifiAvailable: AmenityState =
      body.wifi_available !== undefined
        ? parseAmenityState(body.wifi_available)
        : wifiMbps !== null && wifiMbps > 0
        ? 'yes'
        : 'unknown';

    const socketsClaimed = Boolean(body.sockets_claimed);
    const chargingSockets: AmenityState =
      body.charging_sockets !== undefined
        ? parseAmenityState(body.charging_sockets)
        : (socketsCount !== null && socketsCount > 0) || socketsClaimed
        ? 'yes'
        : 'unknown';

    const comfortableSeating = parseAmenityState(body.comfortable_seating);

    const validModes = new Set<CafeMode>(['work', 'budget', 'calm', 'plan']);
    const modesInput = Array.isArray(body.modes) ? body.modes : [];
    const modes = modesInput
      .map((m) => cleanStr(m, 20) as CafeMode)
      .filter((m) => validModes.has(m));
    if (modes.length === 0) modes.push('work');

    const laptopFriendly = Boolean(body.laptop_friendly);
    const suitableForStudying: AmenityState =
      body.suitable_for_studying !== undefined
        ? parseAmenityState(body.suitable_for_studying)
        : modes.includes('calm')
        ? 'yes'
        : 'unknown';
    const suitableForWorking: AmenityState =
      body.suitable_for_working !== undefined
        ? parseAmenityState(body.suitable_for_working)
        : laptopFriendly || modes.includes('work')
        ? 'yes'
        : 'unknown';

    const bestFor = (Array.isArray(body.best_for) ? body.best_for : [])
      .map((b) => cleanStr(b, 100))
      .filter(Boolean)
      .slice(0, 12);

    const facilities = (Array.isArray(body.facilities) ? body.facilities : [])
      .map((f) => cleanStr(f, 100))
      .filter(Boolean)
      .slice(0, 20);

    const offers = (Array.isArray(body.offers) ? body.offers : [])
      .map((o) => cleanStr(o, 200))
      .filter(Boolean)
      .slice(0, 10);

    const menuServices = (Array.isArray(body.menu_services) ? body.menu_services : [])
      .slice(0, 25)
      .map((item) => {
        const rec = (item ?? {}) as Record<string, unknown>;
        return {
          name: cleanStr(rec.name, 100),
          price: cleanStr(rec.price, 30),
          category: cleanStr(rec.category, 50) || 'Cafe Menu',
          description: cleanStr(rec.description, 220),
        };
      })
      .filter((m) => m.name);

    const interiorPhotos = (Array.isArray(body.interior_photos) ? body.interior_photos : [])
      .map((p) => cleanStr(p, 500))
      .filter((p) => isSafeLinkOrPath(p))
      .slice(0, 10);

    const exteriorPhotos = (Array.isArray(body.exterior_photos) ? body.exterior_photos : [])
      .map((p) => cleanStr(p, 500))
      .filter((p) => isSafeLinkOrPath(p))
      .slice(0, 10);

    const explicitPhotos = (Array.isArray(body.photos) ? body.photos : [])
      .map((p) => cleanStr(p, 500))
      .filter((p) => isSafeLinkOrPath(p));

    const photos = Array.from(new Set([...explicitPhotos, ...interiorPhotos, ...exteriorPhotos])).slice(0, 16);

    return {
      cafe: {
        id: existingId ?? slugifyId(name),
        slug,
        name,
        category,
        city,
        area,
        address: address || `${area}, ${city}`,
        phone,
        map_link:
          mapLink || `https://maps.google.com/?q=${encodeURIComponent(`${name} ${area} ${city}`)}`,
        website_url: websiteUrl,
        menu_url: menuUrl,
        instagram_url: instagramUrl,
        other_social_links: otherSocialLinks,
        place_id: placeId,
        lat,
        lng,
        timings,
        description: description || verdict,
        photos,
        interior_photos: interiorPhotos,
        exterior_photos: exteriorPhotos,
        photos_approved: Boolean(body.photos_approved) && photos.length > 0,
        wifi_available: wifiAvailable,
        wifi_mbps: wifiMbps,
        charging_sockets: chargingSockets,
        sockets_count: socketsCount,
        sockets_claimed: socketsClaimed,
        comfortable_seating: comfortableSeating,
        seating_info: seatingInfo,
        ambience,
        outdoor_seating: outdoorSeating,
        suitable_for_studying: suitableForStudying,
        suitable_for_working: suitableForWorking,
        noise_level: noiseLevel as 1 | 2 | 3 | 4 | 5 | null,
        avg_cost_per_person: avgCost,
        price_range: priceRange,
        coffee_price: coffeePrice,
        tea_price: teaPrice,
        snacks_price: snacksPrice,
        meals_price: mealsPrice,
        popular_items: popularItems,
        rating,
        rating_count: ratingCount,
        min_spend: minSpend,
        laptop_friendly: laptopFriendly,
        time_limit: timeLimit,
        modes,
        facilities,
        offers,
        menu_services: menuServices,
        best_for: bestFor.length > 0 ? bestFor : ['Laptop work'],
        verdict,
        avoid_if: avoidIf,
        student_discount: studentDiscount,
        verified: Boolean(body.verified),
        featured: Boolean(body.featured),
        published: body.published === undefined ? true : Boolean(body.published),
        display_order: displayOrder,
        last_verified_date: lastVerifiedDate,
        claims,
        source_name: sourceName,
        source_url: sourceUrl,
        sample: Boolean(body.sample),
      },
    } as const;
  }

  app.post('/api/admin/cafes', requireAdminAuth, (req, res) => {
    const parsed = validateLocationPayload((req.body ?? {}) as Record<string, unknown>);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const c = parsed.cafe;
    const db = getDb();
    const now = Date.now();

    const slugConflict = db.prepare('SELECT id FROM cafes WHERE slug = ?').get(c.slug);
    const finalSlug = slugConflict ? c.id : c.slug;

    db.prepare(
      `INSERT INTO cafes (
        id, slug, name, category, city, area, address, phone, map_link, booking_url,
        website_url, menu_url, instagram_url, other_social_links, place_id, lat, lng,
        timings, description, photos_json, interior_photos_json, exterior_photos_json, photos_approved,
        wifi_available, wifi_mbps, charging_sockets, sockets_count, sockets_claimed,
        comfortable_seating, seating_info, ambience, outdoor_seating,
        suitable_for_studying, suitable_for_working,
        noise_level, avg_cost_per_person, price_range,
        coffee_price, tea_price, snacks_price, meals_price, popular_items_json,
        rating, rating_count, min_spend, laptop_friendly, time_limit,
        modes_json, facilities_json, offers_json, menu_services_json,
        best_for_json, verdict, avoid_if, student_discount,
        verified, featured, published, display_order, last_verified_date, claims_json,
        source_name, source_url, sample, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      c.id,
      finalSlug,
      c.name,
      c.category,
      c.city,
      c.area,
      c.address,
      c.phone,
      c.map_link,
      c.website_url,
      c.menu_url,
      c.instagram_url,
      c.other_social_links,
      c.place_id,
      c.lat,
      c.lng,
      c.timings,
      c.description,
      JSON.stringify(c.photos),
      JSON.stringify(c.interior_photos),
      JSON.stringify(c.exterior_photos),
      c.photos_approved ? 1 : 0,
      c.wifi_available,
      c.wifi_mbps,
      c.charging_sockets,
      c.sockets_count,
      c.sockets_claimed ? 1 : 0,
      c.comfortable_seating,
      c.seating_info,
      c.ambience,
      c.outdoor_seating,
      c.suitable_for_studying,
      c.suitable_for_working,
      c.noise_level,
      c.avg_cost_per_person,
      c.price_range,
      c.coffee_price,
      c.tea_price,
      c.snacks_price,
      c.meals_price,
      JSON.stringify(c.popular_items),
      c.rating,
      c.rating_count,
      c.min_spend,
      c.laptop_friendly ? 1 : 0,
      c.time_limit,
      JSON.stringify(c.modes),
      JSON.stringify(c.facilities),
      JSON.stringify(c.offers),
      JSON.stringify(c.menu_services),
      JSON.stringify(c.best_for),
      c.verdict,
      c.avoid_if,
      c.student_discount,
      c.verified ? 1 : 0,
      c.featured ? 1 : 0,
      c.published ? 1 : 0,
      c.display_order,
      c.last_verified_date,
      JSON.stringify(c.claims),
      c.source_name,
      c.source_url,
      c.sample ? 1 : 0,
      now,
      now
    );

    recordActivity(
      req.admin!.username,
      'Created cafe listing',
      c.name,
      '',
      `${c.area} · ${c.published ? 'Active' : 'Hidden'} · Avg ₹${c.avg_cost_per_person ?? '—'}`
    );
    res.status(201).json({ cafe: { ...c, slug: finalSlug, menu_items: [], created_at: now, updated_at: now } });
  });

  app.put('/api/admin/cafes/:id', requireAdminAuth, (req, res) => {
    const id = cleanStr(req.params.id, 100);
    const db = getDb();
    const existing = db
      .prepare('SELECT id, name, published, verified, featured, avg_cost_per_person, wifi_available FROM cafes WHERE id = ?')
      .get(id) as
      | {
          id: string;
          name: string;
          published: number;
          verified: number;
          featured: number;
          avg_cost_per_person: number | null;
          wifi_available: string;
        }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Location not found.' });
      return;
    }

    const parsed = validateLocationPayload((req.body ?? {}) as Record<string, unknown>, id);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const c = parsed.cafe;
    const slugConflict = db
      .prepare('SELECT id FROM cafes WHERE slug = ? AND id != ?')
      .get(c.slug, id);
    const finalSlug = slugConflict ? `${c.slug}-${crypto.randomBytes(2).toString('hex')}` : c.slug;
    const now = Date.now();

    db.prepare(
      `UPDATE cafes SET
        slug = ?, name = ?, category = ?, city = ?, area = ?, address = ?, phone = ?, map_link = ?,
        booking_url = '', website_url = ?, menu_url = ?, instagram_url = ?, other_social_links = ?, place_id = ?,
        lat = ?, lng = ?, timings = ?, description = ?, photos_json = ?, interior_photos_json = ?, exterior_photos_json = ?, photos_approved = ?,
        wifi_available = ?, wifi_mbps = ?, charging_sockets = ?, sockets_count = ?, sockets_claimed = ?,
        comfortable_seating = ?, seating_info = ?, ambience = ?, outdoor_seating = ?,
        suitable_for_studying = ?, suitable_for_working = ?,
        noise_level = ?, avg_cost_per_person = ?, price_range = ?,
        coffee_price = ?, tea_price = ?, snacks_price = ?, meals_price = ?, popular_items_json = ?,
        rating = ?, rating_count = ?, min_spend = ?, laptop_friendly = ?, time_limit = ?,
        modes_json = ?, facilities_json = ?, offers_json = ?, menu_services_json = ?,
        best_for_json = ?, verdict = ?, avoid_if = ?, student_discount = ?, verified = ?,
        featured = ?, published = ?, display_order = ?, last_verified_date = ?,
        claims_json = ?, source_name = ?, source_url = ?, sample = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      finalSlug,
      c.name,
      c.category,
      c.city,
      c.area,
      c.address,
      c.phone,
      c.map_link,
      c.website_url,
      c.menu_url,
      c.instagram_url,
      c.other_social_links,
      c.place_id,
      c.lat,
      c.lng,
      c.timings,
      c.description,
      JSON.stringify(c.photos),
      JSON.stringify(c.interior_photos),
      JSON.stringify(c.exterior_photos),
      c.photos_approved ? 1 : 0,
      c.wifi_available,
      c.wifi_mbps,
      c.charging_sockets,
      c.sockets_count,
      c.sockets_claimed ? 1 : 0,
      c.comfortable_seating,
      c.seating_info,
      c.ambience,
      c.outdoor_seating,
      c.suitable_for_studying,
      c.suitable_for_working,
      c.noise_level,
      c.avg_cost_per_person,
      c.price_range,
      c.coffee_price,
      c.tea_price,
      c.snacks_price,
      c.meals_price,
      JSON.stringify(c.popular_items),
      c.rating,
      c.rating_count,
      c.min_spend,
      c.laptop_friendly ? 1 : 0,
      c.time_limit,
      JSON.stringify(c.modes),
      JSON.stringify(c.facilities),
      JSON.stringify(c.offers),
      JSON.stringify(c.menu_services),
      JSON.stringify(c.best_for),
      c.verdict,
      c.avoid_if,
      c.student_discount,
      c.verified ? 1 : 0,
      c.featured ? 1 : 0,
      c.published ? 1 : 0,
      c.display_order,
      c.last_verified_date,
      JSON.stringify(c.claims),
      c.source_name,
      c.source_url,
      c.sample ? 1 : 0,
      now,
      id
    );

    const prevSummary = `pub=${Boolean(existing.published)}, ver=${Boolean(existing.verified)}, feat=${Boolean(existing.featured)}, avg=₹${existing.avg_cost_per_person ?? '—'}`;
    const newSummary = `pub=${c.published}, ver=${c.verified}, feat=${c.featured}, avg=₹${c.avg_cost_per_person ?? '—'}`;
    recordActivity(req.admin!.username, 'Updated cafe listing', c.name, prevSummary, newSummary);
    res.json({ cafe: { ...c, slug: finalSlug, updated_at: now } });
  });

  app.delete('/api/admin/cafes/:id', requireAdminAuth, (req, res) => {
    const id = cleanStr(req.params.id, 100);
    const db = getDb();
    const existing = db.prepare('SELECT name, area FROM cafes WHERE id = ?').get(id) as
      | { name: string; area: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Location not found.' });
      return;
    }

    db.prepare('DELETE FROM cafes WHERE id = ?').run(id);
    recordActivity(req.admin!.username, 'Deleted cafe listing', existing.name, `${existing.name} (${existing.area})`, 'Deleted');
    res.json({ ok: true });
  });

  // ---- Menu & Food Price Management ----
  const ALLOWED_DIETARY = new Set<DietaryType>(['veg', 'non_veg', 'vegan', 'na']);

  app.get('/api/admin/menu', requireAdminAuth, (req, res) => {
    const cafeId = cleanStr(req.query.cafeId, 100);
    const items = listMenuItemsFromDb(cafeId || undefined);
    res.json({ items });
  });

  app.post('/api/admin/menu', requireAdminAuth, (req, res) => {
    const db = getDb();
    const cafeId = cleanStr(req.body?.cafe_id, 100);
    if (!cafeId) {
      res.status(400).json({ error: 'Cafe ID is required.' });
      return;
    }
    const cafe = db.prepare('SELECT id, name FROM cafes WHERE id = ?').get(cafeId) as
      | { id: string; name: string }
      | undefined;
    if (!cafe) {
      res.status(404).json({ error: 'Cafe not found.' });
      return;
    }

    const rawList = Array.isArray(req.body?.items) ? req.body.items : [req.body];
    if (rawList.length === 0 || rawList.length > 50) {
      res.status(400).json({ error: 'Provide between 1 and 50 menu items.' });
      return;
    }

    const now = Date.now();
    const ins = db.prepare(
      `INSERT INTO menu_items
       (cafe_id, name, category, description, price_inr, photo_url, available, dietary, is_bestseller, is_featured, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const createdIds: number[] = [];
    for (let i = 0; i < rawList.length; i += 1) {
      const rec = (rawList[i] ?? {}) as Record<string, unknown>;
      const name = cleanStr(rec.name, 120);
      if (!name) {
        res.status(400).json({ error: `Item #${i + 1} requires an item name.` });
        return;
      }
      const category = cleanStr(rec.category, 60) || 'Coffee';
      const description = cleanStr(rec.description, 300);
      const priceInr = Math.max(0, Math.min(100000, Math.round(Number(rec.price_inr ?? 0))));
      const photoUrl = cleanStr(rec.photo_url, 500);
      if (photoUrl && !isSafeLinkOrPath(photoUrl)) {
        res.status(400).json({ error: 'Invalid photo URL.' });
        return;
      }
      const available = rec.available === undefined ? true : Boolean(rec.available);
      const dietaryRaw = cleanStr(rec.dietary, 20) as DietaryType;
      const dietary: DietaryType = ALLOWED_DIETARY.has(dietaryRaw) ? dietaryRaw : 'na';
      const isBestseller = Boolean(rec.is_bestseller);
      const isFeatured = Boolean(rec.is_featured);
      const sortOrder = Math.max(0, Math.min(9999, Math.round(Number(rec.sort_order ?? i))));

      const r = ins.run(
        cafeId,
        name,
        category,
        description,
        priceInr,
        photoUrl,
        available ? 1 : 0,
        dietary,
        isBestseller ? 1 : 0,
        isFeatured ? 1 : 0,
        sortOrder,
        now,
        now
      );
      createdIds.push(Number(r.lastInsertRowid));
    }

    syncCafeMenuServicesFromItems(db, cafeId);
    recordActivity(
      req.admin!.username,
      createdIds.length > 1 ? `Bulk added ${createdIds.length} menu items` : 'Added menu item',
      cafe.name,
      '',
      createdIds.length > 1 ? `${createdIds.length} items added` : cleanStr(rawList[0]?.name, 80)
    );

    res.status(201).json({ ok: true, items: listMenuItemsFromDb(cafeId) });
  });

  app.put('/api/admin/menu/:id', requireAdminAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid menu item ID.' });
      return;
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Menu item not found.' });
      return;
    }

    const name = req.body?.name === undefined ? String(existing.name) : cleanStr(req.body.name, 120);
    if (!name) {
      res.status(400).json({ error: 'Item name is required.' });
      return;
    }
    const category =
      req.body?.category === undefined
        ? String(existing.category)
        : cleanStr(req.body.category, 60) || 'Coffee';
    const description =
      req.body?.description === undefined
        ? String(existing.description || '')
        : cleanStr(req.body.description, 300);
    const priceInr =
      req.body?.price_inr === undefined
        ? Number(existing.price_inr ?? 0)
        : Math.max(0, Math.min(100000, Math.round(Number(req.body.price_inr))));
    const photoUrl =
      req.body?.photo_url === undefined
        ? String(existing.photo_url || '')
        : cleanStr(req.body.photo_url, 500);
    if (photoUrl && !isSafeLinkOrPath(photoUrl)) {
      res.status(400).json({ error: 'Invalid photo URL.' });
      return;
    }
    const available =
      req.body?.available === undefined ? Boolean(existing.available) : Boolean(req.body.available);
    const dietaryRaw =
      req.body?.dietary === undefined
        ? (String(existing.dietary || 'na') as DietaryType)
        : (cleanStr(req.body.dietary, 20) as DietaryType);
    const dietary: DietaryType = ALLOWED_DIETARY.has(dietaryRaw) ? dietaryRaw : 'na';
    const isBestseller =
      req.body?.is_bestseller === undefined
        ? Boolean(existing.is_bestseller)
        : Boolean(req.body.is_bestseller);
    const isFeatured =
      req.body?.is_featured === undefined
        ? Boolean(existing.is_featured)
        : Boolean(req.body.is_featured);
    const sortOrder =
      req.body?.sort_order === undefined
        ? Number(existing.sort_order ?? 0)
        : Math.max(0, Math.min(9999, Math.round(Number(req.body.sort_order))));

    const now = Date.now();
    db.prepare(
      `UPDATE menu_items
       SET name = ?, category = ?, description = ?, price_inr = ?, photo_url = ?,
           available = ?, dietary = ?, is_bestseller = ?, is_featured = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      name,
      category,
      description,
      priceInr,
      photoUrl,
      available ? 1 : 0,
      dietary,
      isBestseller ? 1 : 0,
      isFeatured ? 1 : 0,
      sortOrder,
      now,
      id
    );

    const cafeId = String(existing.cafe_id);
    syncCafeMenuServicesFromItems(db, cafeId);
    recordActivity(
      req.admin!.username,
      'Updated menu item',
      `${name} (${cafeId})`,
      `₹${Number(existing.price_inr ?? 0)} · ${Boolean(existing.available) ? 'Available' : 'Unavailable'}`,
      `₹${priceInr} · ${available ? 'Available' : 'Unavailable'}`
    );

    res.json({ ok: true, items: listMenuItemsFromDb(cafeId) });
  });

  app.delete('/api/admin/menu/:id', requireAdminAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid menu item ID.' });
      return;
    }

    const db = getDb();
    const existing = db.prepare('SELECT cafe_id, name, price_inr FROM menu_items WHERE id = ?').get(id) as
      | { cafe_id: string; name: string; price_inr: number }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Menu item not found.' });
      return;
    }

    db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
    syncCafeMenuServicesFromItems(db, existing.cafe_id);
    recordActivity(
      req.admin!.username,
      'Deleted menu item',
      `${existing.name} (${existing.cafe_id})`,
      `${existing.name} ₹${existing.price_inr}`,
      'Deleted'
    );
    res.json({ ok: true, items: listMenuItemsFromDb(existing.cafe_id) });
  });

  // ---- Submissions & Enquiries Management ----
  app.get('/api/admin/submissions', requireAdminAuth, (_req, res) => {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM submissions ORDER BY created_at DESC LIMIT 300')
      .all() as Array<Record<string, unknown>>;

    const submissions = rows.map((r) => ({
      id: Number(r.id),
      type: String(r.type),
      cafeName: r.cafe_name ? String(r.cafe_name) : '',
      area: r.area ? String(r.area) : '',
      contactName: r.contact_name ? String(r.contact_name) : '',
      contactInfo: r.contact_info ? String(r.contact_info) : '',
      plan: r.plan ? String(r.plan) : '',
      payload: JSON.parse(String(r.payload_json)),
      status: String(r.status),
      createdAt: Number(r.created_at),
    }));

    res.json({ submissions });
  });

  app.get('/api/admin/submissions/export', requireAdminAuth, (_req, res) => {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM submissions ORDER BY created_at DESC LIMIT 1000')
      .all() as Array<Record<string, unknown>>;

    const header = [
      'ID',
      'Type',
      'Status',
      'Branch/Cafe',
      'Area',
      'Contact Name',
      'Contact Info',
      'Plan',
      'Notes',
      'Created At',
    ].join(',');

    const lines = rows.map((r) => {
      const p = JSON.parse(String(r.payload_json || '{}')) as Record<string, unknown>;
      return [
        csvEscape(r.id),
        csvEscape(r.type),
        csvEscape(r.status),
        csvEscape(r.cafe_name),
        csvEscape(r.area),
        csvEscape(r.contact_name),
        csvEscape(r.contact_info),
        csvEscape(r.plan),
        csvEscape(p.notes ?? ''),
        csvEscape(new Date(Number(r.created_at)).toISOString()),
      ].join(',');
    });

    recordActivity(_req.admin!.username, 'Exported enquiries CSV', `${rows.length} records`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cafedesk-enquiries.csv"');
    res.send([header, ...lines].join('\n'));
  });

  app.patch('/api/admin/submissions/:id', requireAdminAuth, (req, res) => {
    const id = Number(req.params.id);
    const status = cleanStr(req.body?.status, 20);
    if (!Number.isInteger(id) || !['new', 'reviewed', 'resolved', 'archived'].includes(status)) {
      res.status(400).json({ error: 'Invalid submission status.' });
      return;
    }

    const db = getDb();
    db.prepare('UPDATE submissions SET status = ? WHERE id = ?').run(status, id);
    recordActivity(req.admin!.username, `Marked enquiry ${status}`, `Submission #${id}`);
    res.json({ ok: true });
  });

  app.delete('/api/admin/submissions/:id', requireAdminAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid ID.' });
      return;
    }
    const db = getDb();
    db.prepare('DELETE FROM submissions WHERE id = ?').run(id);
    recordActivity(req.admin!.username, 'Deleted enquiry', `Submission #${id}`);
    res.json({ ok: true });
  });

  // ---- Site Settings, Homepage Editor, Content & SEO Manager ----
  app.get('/api/admin/settings', requireAdminAuth, (_req, res) => {
    res.json({ settings: getSiteSettingsFromDb() });
  });

  app.put('/api/admin/settings', requireAdminAuth, (req, res) => {
    const current = getSiteSettingsFromDb();
    const b = (req.body ?? {}) as Partial<SiteSettings>;

    const next: SiteSettings = {
      brand_name: cleanStr(b.brand_name, 60) || current.brand_name,
      brand_tagline: cleanStr(b.brand_tagline, 120) || current.brand_tagline,
      logo_url: isSafeLinkOrPath(cleanStr(b.logo_url, 300))
        ? cleanStr(b.logo_url, 300)
        : current.logo_url,
      favicon_url: isSafeLinkOrPath(cleanStr(b.favicon_url, 300))
        ? cleanStr(b.favicon_url, 300)
        : current.favicon_url,
      accent_color: /^#[0-9A-Fa-f]{6}$/.test(String(b.accent_color ?? ''))
        ? String(b.accent_color)
        : current.accent_color,
      business_legal_name: cleanStr(b.business_legal_name, 140) || current.business_legal_name,
      business_city: cleanStr(b.business_city, 80) || current.business_city,
      business_address: cleanStr(b.business_address, 260) || current.business_address,
      footer_copyright: cleanStr(b.footer_copyright, 160) || current.footer_copyright,
      analytics_id: cleanStr(b.analytics_id, 60),

      contact_email: cleanStr(b.contact_email, 120) || current.contact_email,
      contact_phone: cleanStr(b.contact_phone, 40) || current.contact_phone,
      whatsapp_number:
        cleanStr(b.whatsapp_number, 24).replace(/[^\d]/g, '') || current.whatsapp_number,
      whatsapp_display: cleanStr(b.whatsapp_display, 32) || current.whatsapp_display,
      instagram_url: isSafeHttpUrl(cleanStr(b.instagram_url, 200))
        ? cleanStr(b.instagram_url, 200)
        : current.instagram_url,
      instagram_handle: cleanStr(b.instagram_handle, 60) || current.instagram_handle,
      twitter_url: isSafeLinkOrPath(cleanStr(b.twitter_url, 200))
        ? cleanStr(b.twitter_url, 200)
        : current.twitter_url,
      linkedin_url: isSafeLinkOrPath(cleanStr(b.linkedin_url, 200))
        ? cleanStr(b.linkedin_url, 200)
        : current.linkedin_url,

      hero_kicker: cleanStr(b.hero_kicker, 100) || current.hero_kicker,
      hero_tagline: cleanStr(b.hero_tagline, 140) || current.hero_tagline,
      hero_subtitle: cleanProse(b.hero_subtitle, 450) || current.hero_subtitle,
      hero_image_url: isSafeLinkOrPath(cleanStr(b.hero_image_url, 300))
        ? cleanStr(b.hero_image_url, 300) || current.hero_image_url
        : current.hero_image_url,
      hero_bg_image_url: isSafeLinkOrPath(cleanStr(b.hero_bg_image_url, 300))
        ? cleanStr(b.hero_bg_image_url, 300) || current.hero_bg_image_url
        : current.hero_bg_image_url,
      hero_cta_primary_label:
        cleanStr(b.hero_cta_primary_label, 50) || current.hero_cta_primary_label,
      hero_cta_primary_link: isSafeLinkOrPath(cleanStr(b.hero_cta_primary_link, 200))
        ? cleanStr(b.hero_cta_primary_link, 200) || '/locations'
        : current.hero_cta_primary_link,
      hero_cta_secondary_label:
        cleanStr(b.hero_cta_secondary_label, 50) || current.hero_cta_secondary_label,
      hero_cta_secondary_link: isSafeLinkOrPath(cleanStr(b.hero_cta_secondary_link, 200))
        ? cleanStr(b.hero_cta_secondary_link, 200) || '/locations?nearby=1'
        : current.hero_cta_secondary_link,
      hero_cta_tertiary_label:
        cleanStr(b.hero_cta_tertiary_label, 50) || current.hero_cta_tertiary_label,
      hero_cta_tertiary_link: isSafeLinkOrPath(cleanStr(b.hero_cta_tertiary_link, 200))
        ? cleanStr(b.hero_cta_tertiary_link, 200) || '/contact'
        : current.hero_cta_tertiary_link,

      homepage_sections:
        Array.isArray(b.homepage_sections) && b.homepage_sections.length > 0
          ? b.homepage_sections.map((s, idx) => ({
              key: s.key,
              label: cleanStr(s.label, 80) || s.key,
              visible: Boolean(s.visible),
              order: Number.isFinite(Number(s.order)) ? Number(s.order) : idx + 1,
            }))
          : current.homepage_sections,

      banner_enabled: b.banner_enabled === undefined ? current.banner_enabled : Boolean(b.banner_enabled),
      banner_text: b.banner_text === undefined ? current.banner_text : cleanStr(b.banner_text, 240),
      banner_cta_label: cleanStr(b.banner_cta_label, 50) || current.banner_cta_label,
      banner_link: isSafeLinkOrPath(cleanStr(b.banner_link, 250))
        ? cleanStr(b.banner_link, 250) || '/locations'
        : current.banner_link,
      banner_start_at:
        b.banner_start_at === undefined ? (current.banner_start_at || '') : cleanStr(b.banner_start_at, 40),
      banner_end_at:
        b.banner_end_at === undefined ? (current.banner_end_at || '') : cleanStr(b.banner_end_at, 40),
      cafe_of_the_day_slug:
        b.cafe_of_the_day_slug === undefined
          ? (current.cafe_of_the_day_slug || '')
          : cleanStr(b.cafe_of_the_day_slug, 100),

      announcements: Array.isArray(b.announcements)
        ? b.announcements.slice(0, 12).map((a, idx) => ({
            id: cleanStr(a.id, 40) || `ann-${idx + 1}`,
            title: cleanStr(a.title, 100),
            detail: cleanStr(a.detail, 260),
            badge: cleanStr(a.badge, 40),
            link: isSafeLinkOrPath(cleanStr(a.link, 200)) ? cleanStr(a.link, 200) : '/locations',
            active: Boolean(a.active),
          }))
        : current.announcements,

      pricing_headline:
        b.pricing_headline === undefined
          ? (current.pricing_headline || DEFAULT_SITE_SETTINGS.pricing_headline)
          : cleanStr(b.pricing_headline, 160),
      pricing_subtitle:
        b.pricing_subtitle === undefined
          ? (current.pricing_subtitle || DEFAULT_SITE_SETTINGS.pricing_subtitle)
          : cleanProse(b.pricing_subtitle, 450),

      about_heading: cleanStr(b.about_heading, 160) || current.about_heading,
      about_lead: cleanProse(b.about_lead, 600) || current.about_lead,
      about_story: cleanProse(b.about_story, 2500) || current.about_story,
      about_image_url: isSafeLinkOrPath(cleanStr(b.about_image_url, 300))
        ? cleanStr(b.about_image_url, 300) || current.about_image_url
        : current.about_image_url,

      services_heading: cleanStr(b.services_heading, 160) || current.services_heading,
      services_subtitle: cleanProse(b.services_subtitle, 450) || current.services_subtitle,
      services_image_url: isSafeLinkOrPath(cleanStr(b.services_image_url, 300))
        ? cleanStr(b.services_image_url, 300) || current.services_image_url
        : current.services_image_url,
      services_items: Array.isArray(b.services_items)
        ? b.services_items.slice(0, 12).map((s) => ({
            title: cleanStr(s.title, 100),
            description: cleanStr(s.description, 320),
            highlight: cleanStr(s.highlight, 80),
          }))
        : current.services_items,

      facilities_items: Array.isArray(b.facilities_items)
        ? b.facilities_items.slice(0, 20).map((f) => ({
            name: cleanStr(f.name, 80),
            detail: cleanStr(f.detail, 200),
          }))
        : current.facilities_items,

      faqs_items: Array.isArray(b.faqs_items)
        ? b.faqs_items.slice(0, 25).map((q) => ({
            question: cleanStr(q.question, 220),
            answer: cleanProse(q.answer, 1000),
          }))
        : current.faqs_items,

      contact_heading: cleanStr(b.contact_heading, 160) || current.contact_heading,
      contact_subtitle: cleanProse(b.contact_subtitle, 450) || current.contact_subtitle,
      contact_hours: cleanStr(b.contact_hours, 120) || current.contact_hours,
      contact_map_url: isSafeHttpUrl(cleanStr(b.contact_map_url, 300))
        ? cleanStr(b.contact_map_url, 300)
        : current.contact_map_url,

      editorial_gallery: Array.isArray(b.editorial_gallery)
        ? b.editorial_gallery.slice(0, 9).map((g) => ({
            url: isSafeLinkOrPath(cleanStr(g.url, 300)) ? cleanStr(g.url, 300) : '',
            alt: cleanStr(g.alt, 200),
            caption: cleanStr(g.caption, 140),
          })).filter((g) => g.url)
        : current.editorial_gallery,

      seo_home_title: cleanStr(b.seo_home_title, 120) || current.seo_home_title,
      seo_home_description: cleanStr(b.seo_home_description, 260) || current.seo_home_description,
      seo_locations_title: cleanStr(b.seo_locations_title, 120) || current.seo_locations_title,
      seo_locations_description:
        cleanStr(b.seo_locations_description, 260) || current.seo_locations_description,
      seo_about_title: cleanStr(b.seo_about_title, 120) || current.seo_about_title,
      seo_about_description:
        cleanStr(b.seo_about_description, 260) || current.seo_about_description,
      seo_contact_title: cleanStr(b.seo_contact_title, 120) || current.seo_contact_title,
      seo_contact_description:
        cleanStr(b.seo_contact_description, 260) || current.seo_contact_description,
      seo_og_image: isSafeLinkOrPath(cleanStr(b.seo_og_image, 300))
        ? cleanStr(b.seo_og_image, 300) || current.seo_og_image
        : current.seo_og_image,
      seo_allow_indexing:
        b.seo_allow_indexing === undefined ? current.seo_allow_indexing : Boolean(b.seo_allow_indexing),
    };

    const db = getDb();
    const upsert = db.prepare(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    );
    const now = Date.now();
    for (const [k, v] of Object.entries(next)) {
      const serialized = typeof v === 'object' ? JSON.stringify(v) : String(v);
      upsert.run(k, serialized, now);
    }

    const changedKeys = Object.keys(next).filter((k) => {
      const a = (current as unknown as Record<string, unknown>)[k];
      const val = (next as unknown as Record<string, unknown>)[k];
      return JSON.stringify(a) !== JSON.stringify(val);
    });
    recordActivity(
      req.admin!.username,
      'Saved CMS & website settings',
      'Global configuration',
      changedKeys.length > 0 ? `${changedKeys.length} setting(s) updated` : 'No change',
      changedKeys.slice(0, 8).join(', ') || 'Unchanged'
    );
    res.json({ settings: next });
  });

  // ---- Navigation Manager ----
  app.get('/api/admin/navigation', requireAdminAuth, (_req, res) => {
    res.json({ navigation: listNavigationFromDb(true) });
  });

  app.post('/api/admin/navigation', requireAdminAuth, (req, res) => {
    const location = req.body?.location === 'footer' ? 'footer' : 'header';
    const label = cleanStr(req.body?.label, 40);
    const url = cleanStr(req.body?.url, 220);
    const sortOrder = Math.max(0, Math.min(999, Math.round(Number(req.body?.sort_order ?? 10))));
    const visible = req.body?.visible === undefined ? true : Boolean(req.body.visible);
    const isExternal = Boolean(req.body?.is_external);

    if (!label || !url || !isSafeLinkOrPath(url)) {
      res.status(400).json({ error: 'Valid link label and URL/route are required.' });
      return;
    }

    const db = getDb();
    const result = db
      .prepare(
        `INSERT INTO navigation_items (location, label, url, sort_order, visible, is_external)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(location, label, url, sortOrder, visible ? 1 : 0, isExternal ? 1 : 0);

    recordActivity(req.admin!.username, 'Added navigation link', `${location}: ${label}`);
    res.status(201).json({
      item: {
        id: Number(result.lastInsertRowid),
        location,
        label,
        url,
        sort_order: sortOrder,
        visible,
        is_external: isExternal,
      },
    });
  });

  app.put('/api/admin/navigation/:id', requireAdminAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid navigation ID.' });
      return;
    }
    const location = req.body?.location === 'footer' ? 'footer' : 'header';
    const label = cleanStr(req.body?.label, 40);
    const url = cleanStr(req.body?.url, 220);
    const sortOrder = Math.max(0, Math.min(999, Math.round(Number(req.body?.sort_order ?? 1))));
    const visible = Boolean(req.body?.visible);
    const isExternal = Boolean(req.body?.is_external);

    if (!label || !url || !isSafeLinkOrPath(url)) {
      res.status(400).json({ error: 'Valid link label and URL/route are required.' });
      return;
    }

    const db = getDb();
    db.prepare(
      `UPDATE navigation_items SET location = ?, label = ?, url = ?, sort_order = ?, visible = ?, is_external = ?
       WHERE id = ?`
    ).run(location, label, url, sortOrder, visible ? 1 : 0, isExternal ? 1 : 0, id);

    recordActivity(req.admin!.username, 'Updated navigation link', `${location}: ${label}`);
    res.json({ ok: true });
  });

  app.delete('/api/admin/navigation/:id', requireAdminAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid navigation ID.' });
      return;
    }
    const db = getDb();
    db.prepare('DELETE FROM navigation_items WHERE id = ?').run(id);
    recordActivity(req.admin!.username, 'Deleted navigation link', `#${id}`);
    res.json({ ok: true });
  });

  // ---- Testimonials Manager ----
  app.get('/api/admin/testimonials', requireAdminAuth, (_req, res) => {
    res.json({ testimonials: listTestimonialsFromDb(true) });
  });

  app.post('/api/admin/testimonials', requireAdminAuth, (req, res) => {
    const authorName = cleanStr(req.body?.author_name, 80);
    const authorRole = cleanStr(req.body?.author_role, 100);
    const branchName = cleanStr(req.body?.branch_name, 100);
    const quote = cleanProse(req.body?.quote, 600);
    const verifiedDate = cleanStr(req.body?.verified_visit_date, 40);
    const published = req.body?.published === undefined ? true : Boolean(req.body.published);

    if (!authorName || !quote) {
      res.status(400).json({ error: 'Guest name and quote are required.' });
      return;
    }

    const db = getDb();
    const now = Date.now();
    const result = db
      .prepare(
        `INSERT INTO testimonials (author_name, author_role, branch_name, quote, verified_visit_date, published, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(authorName, authorRole, branchName, quote, verifiedDate, published ? 1 : 0, now);

    recordActivity(req.admin!.username, 'Added verified testimonial', authorName);
    res.status(201).json({
      item: {
        id: Number(result.lastInsertRowid),
        author_name: authorName,
        author_role: authorRole,
        branch_name: branchName,
        quote,
        verified_visit_date: verifiedDate,
        published,
        created_at: now,
      },
    });
  });

  app.put('/api/admin/testimonials/:id', requireAdminAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid testimonial ID.' });
      return;
    }
    const authorName = cleanStr(req.body?.author_name, 80);
    const authorRole = cleanStr(req.body?.author_role, 100);
    const branchName = cleanStr(req.body?.branch_name, 100);
    const quote = cleanProse(req.body?.quote, 600);
    const verifiedDate = cleanStr(req.body?.verified_visit_date, 40);
    const published = Boolean(req.body?.published);

    if (!authorName || !quote) {
      res.status(400).json({ error: 'Guest name and quote are required.' });
      return;
    }

    const db = getDb();
    db.prepare(
      `UPDATE testimonials
       SET author_name = ?, author_role = ?, branch_name = ?, quote = ?, verified_visit_date = ?, published = ?
       WHERE id = ?`
    ).run(authorName, authorRole, branchName, quote, verifiedDate, published ? 1 : 0, id);

    recordActivity(req.admin!.username, 'Updated testimonial', authorName);
    res.json({ ok: true });
  });

  app.delete('/api/admin/testimonials/:id', requireAdminAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid ID.' });
      return;
    }
    const db = getDb();
    db.prepare('DELETE FROM testimonials WHERE id = ?').run(id);
    recordActivity(req.admin!.username, 'Deleted testimonial', `#${id}`);
    res.json({ ok: true });
  });

  // ---- Media / Image Library Manager ----
  app.get('/api/admin/media', requireAdminAuth, (_req, res) => {
    res.json({ media: listMediaFromDb() });
  });

  app.post('/api/admin/media', requireAdminAuth, (req, res) => {
    const dataUrl = String(req.body?.dataUrl ?? '');
    const originalName = cleanStr(req.body?.fileName, 120) || 'cafe-photo';
    const altText = cleanStr(req.body?.altText, 220) || 'CafeDesk uploaded photo';
    const description = cleanStr(req.body?.description, 300);
    const category = cleanStr(req.body?.category, 60) || 'Branch Photos';

    const parsed = parseAndValidateImageDataUrl(dataUrl);
    if (parsed.error || !parsed.buffer || !parsed.mimeType || !parsed.ext) {
      res.status(400).json({ error: parsed.error ?? 'Invalid image upload.' });
      return;
    }

    const filename = `cafe-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${parsed.ext}`;
    const targetPath = path.join(getUploadsDir(), filename);
    fs.writeFileSync(targetPath, parsed.buffer);

    const url = `/uploads/${filename}`;
    const db = getDb();
    const now = Date.now();
    const result = db
      .prepare(
        `INSERT INTO media_assets (filename, original_name, mime_type, size_bytes, url, alt_text, description, category, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        filename,
        originalName,
        parsed.mimeType,
        parsed.buffer.length,
        url,
        altText,
        description,
        category,
        now
      );

    recordActivity(req.admin!.username, 'Uploaded image', `${category}: ${originalName}`);
    res.status(201).json({
      item: {
        id: Number(result.lastInsertRowid),
        filename,
        original_name: originalName,
        mime_type: parsed.mimeType,
        size_bytes: parsed.buffer.length,
        url,
        alt_text: altText,
        description,
        category,
        created_at: now,
      },
    });
  });

  app.put('/api/admin/media/:id', requireAdminAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid media ID.' });
      return;
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Media asset not found.' });
      return;
    }

    const altText = cleanStr(req.body?.altText, 220) || String(existing.alt_text);
    const description =
      req.body?.description === undefined
        ? String(existing.description ?? '')
        : cleanStr(req.body.description, 300);
    const category = cleanStr(req.body?.category, 60) || String(existing.category ?? 'General');
    const originalName = cleanStr(req.body?.fileName, 120) || String(existing.original_name);

    let url = String(existing.url);
    let filename = String(existing.filename);
    let mimeType = String(existing.mime_type);
    let sizeBytes = Number(existing.size_bytes);

    // Optional file replacement
    const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
    if (dataUrl) {
      const parsed = parseAndValidateImageDataUrl(dataUrl);
      if (parsed.error || !parsed.buffer || !parsed.mimeType || !parsed.ext) {
        res.status(400).json({ error: parsed.error ?? 'Invalid image upload.' });
        return;
      }

      // Remove old uploaded file if it lived in /uploads
      if (url.startsWith('/uploads/')) {
        const oldFull = path.join(getUploadsDir(), path.basename(filename));
        if (fs.existsSync(oldFull)) fs.unlinkSync(oldFull);
      }

      filename = `cafe-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${parsed.ext}`;
      fs.writeFileSync(path.join(getUploadsDir(), filename), parsed.buffer);
      url = `/uploads/${filename}`;
      mimeType = parsed.mimeType;
      sizeBytes = parsed.buffer.length;
    }

    db.prepare(
      `UPDATE media_assets
       SET filename = ?, original_name = ?, mime_type = ?, size_bytes = ?, url = ?, alt_text = ?, description = ?, category = ?
       WHERE id = ?`
    ).run(filename, originalName, mimeType, sizeBytes, url, altText, description, category, id);

    recordActivity(req.admin!.username, dataUrl ? 'Replaced image' : 'Updated image metadata', originalName);
    res.json({
      item: {
        id,
        filename,
        original_name: originalName,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        url,
        alt_text: altText,
        description,
        category,
        created_at: Number(existing.created_at),
      },
    });
  });

  app.delete('/api/admin/media/:id', requireAdminAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid media ID.' });
      return;
    }
    const db = getDb();
    const row = db
      .prepare('SELECT filename, original_name, url FROM media_assets WHERE id = ?')
      .get(id) as { filename: string; original_name: string; url: string } | undefined;

    if (!row) {
      res.status(404).json({ error: 'Media asset not found.' });
      return;
    }

    if (row.url.startsWith('/uploads/')) {
      const safeFile = path.basename(row.filename);
      const fullPath = path.join(getUploadsDir(), safeFile);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    db.prepare('DELETE FROM media_assets WHERE id = ?').run(id);
    recordActivity(req.admin!.username, 'Deleted image', row.original_name);
    res.json({ ok: true });
  });

  // ---- Role-Based Team Users Management (Admin / Super Admin only) ----
  app.get('/api/admin/users', requireAdminAuth, requireFullAdmin, (_req, res) => {
    const db = getDb();
    const users = db
      .prepare('SELECT id, username, email, display_name, role, created_at FROM admins ORDER BY id ASC')
      .all() as Array<Record<string, unknown>>;
    res.json({
      users: users.map((u) => ({
        id: Number(u.id),
        username: String(u.username),
        email: String(u.email ?? ''),
        displayName: String(u.display_name),
        role: String(u.role),
        createdAt: Number(u.created_at),
      })),
    });
  });

  app.post('/api/admin/users', requireAdminAuth, requireFullAdmin, (req, res) => {
    const username = cleanStr(req.body?.username, 40);
    const email = cleanStr(req.body?.email, 120);
    const displayName = cleanStr(req.body?.displayName, 60) || username;
    const password = String(req.body?.password ?? '');
    const roleInput = cleanStr(req.body?.role, 20) as AdminRole;
    const role: AdminRole = roleInput === 'admin' ? 'admin' : 'editor';

    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
      res.status(400).json({ error: 'Username must be 3–40 characters.' });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Valid email address required.' });
      return;
    }
    const pwErr = validatePasswordStrength(password);
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }

    const db = getDb();
    const exists = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
    if (exists) {
      res.status(409).json({ error: 'Username already exists.' });
      return;
    }

    const now = Date.now();
    const result = db
      .prepare(
        `INSERT INTO admins (username, email, display_name, password_hash, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(username, email, displayName, hashPassword(password), role, now, now);

    recordActivity(req.admin!.username, 'Created team account', `${username} (${role})`);
    res.status(201).json({
      user: {
        id: Number(result.lastInsertRowid),
        username,
        email,
        displayName,
        role,
        createdAt: now,
      },
    });
  });

  app.delete('/api/admin/users/:id', requireAdminAuth, requireFullAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid user ID.' });
      return;
    }
    if (id === req.admin!.id) {
      res.status(400).json({ error: 'You cannot delete your own active account.' });
      return;
    }
    const db = getDb();
    const target = db.prepare('SELECT username FROM admins WHERE id = ?').get(id) as
      | { username: string }
      | undefined;
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    db.prepare('DELETE FROM admins WHERE id = ?').run(id);
    recordActivity(req.admin!.username, 'Removed team account', target.username);
    res.json({ ok: true });
  });

  // ---- Backup & Recovery Snapshot (Full Admin only) ----
  app.get('/api/admin/backup', requireAdminAuth, requireFullAdmin, (req, res) => {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      exportedBy: req.admin!.username,
      version: 2,
      locations: listLocationsFromDb(true),
      settings: getSiteSettingsFromDb(),
      navigation: listNavigationFromDb(true),
      testimonials: listTestimonialsFromDb(true),
    };
    recordActivity(req.admin!.username, 'Downloaded CMS backup', 'JSON snapshot');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cafedesk-backup-${getTodayIsoIst()}.json"`
    );
    res.send(JSON.stringify(snapshot, null, 2));
  });

  app.post('/api/admin/restore', requireAdminAuth, requireFullAdmin, (req, res) => {
    const snap = req.body as Record<string, unknown>;
    if (!snap || typeof snap !== 'object' || !Array.isArray(snap.locations) || !snap.settings) {
      res.status(400).json({ error: 'Invalid backup snapshot format.' });
      return;
    }

    const db = getDb();
    const now = Date.now();
    try {
      db.exec('BEGIN TRANSACTION');

      // Restore settings
      const upsertSetting = db.prepare(
        `INSERT INTO site_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      );
      for (const [k, v] of Object.entries(snap.settings as Record<string, unknown>)) {
        if (k in DEFAULT_SITE_SETTINGS) {
          upsertSetting.run(k, typeof v === 'object' ? JSON.stringify(v) : String(v), now);
        }
      }

      // Restore locations cleanly
      db.exec('DELETE FROM cafes');
      const insCafe = db.prepare(`
        INSERT INTO cafes (
          id, slug, name, category, city, area, address, phone, map_link, booking_url,
          website_url, menu_url, instagram_url, other_social_links, place_id, lat, lng,
          timings, description, photos_json, interior_photos_json, exterior_photos_json, photos_approved,
          wifi_available, wifi_mbps, charging_sockets, sockets_count, sockets_claimed,
          comfortable_seating, seating_info, ambience, outdoor_seating,
          suitable_for_studying, suitable_for_working,
          noise_level, avg_cost_per_person, price_range,
          coffee_price, tea_price, snacks_price, meals_price, popular_items_json,
          rating, rating_count, min_spend, laptop_friendly, time_limit,
          modes_json, facilities_json, offers_json, menu_services_json,
          best_for_json, verdict, avoid_if, student_discount,
          verified, featured, published, display_order, last_verified_date, claims_json,
          source_name, source_url, sample, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const rawLoc of snap.locations as Array<Record<string, unknown>>) {
        const parsed = validateLocationPayload(
          rawLoc,
          cleanStr(rawLoc.id, 100) || undefined
        );
        if ('cafe' in parsed && parsed.cafe) {
          const c = parsed.cafe;
          insCafe.run(
            c.id,
            c.slug,
            c.name,
            c.category,
            c.city,
            c.area,
            c.address,
            c.phone,
            c.map_link,
            c.website_url,
            c.menu_url,
            c.instagram_url,
            c.other_social_links,
            c.place_id,
            c.lat,
            c.lng,
            c.timings,
            c.description,
            JSON.stringify(c.photos),
            JSON.stringify(c.interior_photos),
            JSON.stringify(c.exterior_photos),
            c.photos_approved ? 1 : 0,
            c.wifi_available,
            c.wifi_mbps,
            c.charging_sockets,
            c.sockets_count,
            c.sockets_claimed ? 1 : 0,
            c.comfortable_seating,
            c.seating_info,
            c.ambience,
            c.outdoor_seating,
            c.suitable_for_studying,
            c.suitable_for_working,
            c.noise_level,
            c.avg_cost_per_person,
            c.price_range,
            c.coffee_price,
            c.tea_price,
            c.snacks_price,
            c.meals_price,
            JSON.stringify(c.popular_items),
            c.rating,
            c.rating_count,
            c.min_spend,
            c.laptop_friendly ? 1 : 0,
            c.time_limit,
            JSON.stringify(c.modes),
            JSON.stringify(c.facilities),
            JSON.stringify(c.offers),
            JSON.stringify(c.menu_services),
            JSON.stringify(c.best_for),
            c.verdict,
            c.avoid_if,
            c.student_discount,
            c.verified ? 1 : 0,
            c.featured ? 1 : 0,
            c.published ? 1 : 0,
            c.display_order,
            c.last_verified_date,
            JSON.stringify(c.claims),
            c.source_name,
            c.source_url,
            c.sample ? 1 : 0,
            now,
            now
          );
        }
      }

      if (Array.isArray(snap.navigation)) {
        db.exec('DELETE FROM navigation_items');
        const insNav = db.prepare(
          'INSERT INTO navigation_items (location, label, url, sort_order, visible, is_external) VALUES (?, ?, ?, ?, ?, ?)'
        );
        for (const item of snap.navigation as Array<Record<string, unknown>>) {
          const url = cleanStr(item.url, 200);
          if (isSafeLinkOrPath(url)) {
            insNav.run(
              item.location === 'footer' ? 'footer' : 'header',
              cleanStr(item.label, 40) || 'Link',
              url || '/',
              Number(item.sort_order ?? 1),
              item.visible ? 1 : 0,
              item.is_external ? 1 : 0
            );
          }
        }
      }

      db.exec('COMMIT');
      recordActivity(req.admin!.username, 'Restored CMS backup', 'Database snapshot applied');
      res.json({ ok: true });
    } catch (err) {
      db.exec('ROLLBACK');
      console.error('Backup restore failed:', err);
      res.status(500).json({ error: 'Failed to restore snapshot.' });
    }
  });

  // ---- Admin Profile & Password Change ----
  app.put('/api/admin/profile', requireAdminAuth, (req, res) => {
    const displayName = cleanStr(req.body?.displayName, 60);
    const email = cleanStr(req.body?.email, 120);
    const currentPassword = String(req.body?.currentPassword ?? '');
    const newPassword = String(req.body?.newPassword ?? '');

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const db = getDb();
    const adminRow = db
      .prepare('SELECT id, username, email, display_name, password_hash FROM admins WHERE id = ?')
      .get(req.admin!.id) as
      | {
          id: number;
          username: string;
          email: string | null;
          display_name: string;
          password_hash: string;
        }
      | undefined;

    if (!adminRow) {
      res.status(404).json({ error: 'Admin account not found.' });
      return;
    }

    let updatedHash = adminRow.password_hash;
    let passwordChanged = false;

    if (newPassword) {
      if (!currentPassword || !verifyPassword(currentPassword, adminRow.password_hash)) {
        res.status(400).json({ error: 'Current password is incorrect.' });
        return;
      }
      const pwError = validatePasswordStrength(newPassword);
      if (pwError) {
        res.status(400).json({ error: pwError });
        return;
      }
      updatedHash = hashPassword(newPassword);
      passwordChanged = true;
    }

    const finalDisplay = displayName || adminRow.display_name;
    const finalEmail = req.body?.email === undefined ? (adminRow.email ?? '') : email;
    db.prepare(
      'UPDATE admins SET display_name = ?, email = ?, password_hash = ?, updated_at = ? WHERE id = ?'
    ).run(finalDisplay, finalEmail, updatedHash, Date.now(), adminRow.id);

    if (passwordChanged) {
      db.prepare('DELETE FROM sessions WHERE admin_id = ? AND id != ?').run(
        adminRow.id,
        req.admin!.sessionId
      );
      recordActivity(adminRow.username, 'Changed admin password', 'Security settings');
    } else {
      recordActivity(adminRow.username, 'Updated profile details', finalDisplay);
    }

    res.json({
      ok: true,
      displayName: finalDisplay,
      email: finalEmail,
      passwordChanged,
    });
  });

  // ============================================================================
  // VITE DEV MIDDLEWARE OR PRODUCTION STATIC HOSTING
  // ============================================================================

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CafeDesk server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CafeDesk server:', err);
  process.exit(1);
});

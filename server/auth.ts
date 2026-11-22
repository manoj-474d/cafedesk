import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getDb } from './db.ts';

export const SESSION_COOKIE_NAME = 'cafedesk_admin_session';
export const USER_SESSION_COOKIE_NAME = 'cafedesk_user_session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const USER_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export type AdminRole = 'super_admin' | 'admin' | 'editor';

export interface AuthenticatedAdmin {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: AdminRole;
  csrfToken: string;
  sessionId: number;
  expiresAt: number;
  twoFactorEnabled: boolean;
}

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  authProvider: 'email' | 'google';
  emailVerified: boolean;
  status: 'active' | 'suspended';
  csrfToken: string;
  sessionId: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    admin?: AuthenticatedAdmin;
    user?: AuthenticatedUser;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return 'Password must be at least 10 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  return null;
}

export function validateUserPasswordStrength(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Za-z]/.test(password)) return 'Password must include at least one letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  return null;
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
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

export function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.split(',')[0].trim() === 'https') return true;
  return false;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
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
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function buildTotpUri(secret: string, accountName: string, issuer = 'Cafe Desk Admin'): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const iss = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`;
}

export function generateTotpCode(secret: string, counterOffset = 0, timestampMs = Date.now()): string {
  const key = base32Decode(secret);
  const counter = Math.floor(timestampMs / 1000 / 30) + counterOffset;
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(secret: string, token: string): boolean {
  const clean = String(token || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean) || !secret) return false;
  for (const offset of [-1, 0, 1]) {
    const expected = generateTotpCode(secret, offset);
    if (
      expected.length === clean.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))
    ) {
      return true;
    }
  }
  return false;
}

export function createSession(
  adminId: number,
  req: Request
): { rawToken: string; csrfToken: string; expiresAt: number } {
  const db = getDb();
  const rawToken = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = sha256(rawToken);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;

  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);

  db.prepare(
    `INSERT INTO sessions (admin_id, token_hash, csrf_token, expires_at, user_agent, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    adminId,
    tokenHash,
    csrfToken,
    expiresAt,
    String(req.headers['user-agent'] ?? '').slice(0, 200),
    getClientIp(req),
    now
  );

  return { rawToken, csrfToken, expiresAt };
}

export function setSessionCookie(req: Request, res: Response, rawToken: string): void {
  const secure = isHttpsRequest(req);
  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  const secure = isHttpsRequest(req);
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
  });
}

export function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim().slice(0, 64);
  }
  return String(req.socket.remoteAddress ?? 'unknown').slice(0, 64);
}

interface AttemptBucket {
  timestamps: number[];
}

const rateBuckets = new Map<string, AttemptBucket>();

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = rateBuckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= maxAttempts) {
    const oldest = bucket.timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    rateBuckets.set(key, bucket);
    return { allowed: false, retryAfterSec };
  }

  rateBuckets.set(key, bucket);
  return { allowed: true, retryAfterSec: 0 };
}

export function recordRateAttempt(key: string, windowMs: number): void {
  const now = Date.now();
  const bucket = rateBuckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  bucket.timestamps.push(now);
  rateBuckets.set(key, bucket);
}

export function clearRateLimit(key: string): void {
  rateBuckets.delete(key);
}

const ALLOWED_ROLES = new Set<AdminRole>(['super_admin', 'admin', 'editor']);

/**
 * Express middleware enforcing authenticated admin session + role + CSRF header on mutations.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const cookies = parseCookies(req.headers.cookie);
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.id as session_id, s.csrf_token, s.expires_at,
              a.id as admin_id, a.username, a.email, a.display_name, a.role, a.two_factor_enabled
       FROM sessions s
       JOIN admins a ON a.id = s.admin_id
       WHERE s.token_hash = ?`
    )
    .get(sha256(rawToken)) as
    | {
        session_id: number;
        csrf_token: string;
        expires_at: number;
        admin_id: number;
        username: string;
        email: string | null;
        display_name: string;
        role: string;
        two_factor_enabled: number;
      }
    | undefined;

  if (!row || row.expires_at < Date.now()) {
    if (row) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(row.session_id);
    }
    clearSessionCookie(req, res);
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return;
  }

  const role = (row.role || 'admin') as AdminRole;
  if (!ALLOWED_ROLES.has(role)) {
    res.status(403).json({ error: 'Administrator privileges required.' });
    return;
  }

  // Enforce CSRF token on state-changing requests
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const headerToken = String(req.headers['x-csrf-token'] ?? '');
    const expectedBuf = Buffer.from(row.csrf_token);
    const actualBuf = Buffer.from(headerToken);
    if (
      expectedBuf.length === 0 ||
      expectedBuf.length !== actualBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, actualBuf)
    ) {
      res.status(403).json({ error: 'Invalid CSRF token.' });
      return;
    }
  }

  req.admin = {
    id: row.admin_id,
    username: row.username,
    email: String(row.email ?? ''),
    displayName: row.display_name,
    role,
    csrfToken: row.csrf_token,
    sessionId: row.session_id,
    expiresAt: row.expires_at,
    twoFactorEnabled: Boolean(row.two_factor_enabled),
  };

  next();
}

/**
 * Role-based permission check middleware for elevated admin operations (settings, user management, backup/restore).
 */
export function requireFullAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.admin || (req.admin.role !== 'super_admin' && req.admin.role !== 'admin')) {
    res.status(403).json({ error: 'Only full administrators can perform this action.' });
    return;
  }
  next();
}

export function createUserSession(userId: number, req: Request): { rawToken: string; csrfToken: string } {
  const db = getDb();
  const rawToken = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = sha256(rawToken);
  const now = Date.now();
  const expiresAt = now + USER_SESSION_TTL_MS;

  db.prepare('DELETE FROM user_sessions WHERE expires_at < ?').run(now);
  db.prepare(
    `INSERT INTO user_sessions (user_id, token_hash, csrf_token, expires_at, user_agent, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    tokenHash,
    csrfToken,
    expiresAt,
    String(req.headers['user-agent'] ?? '').slice(0, 200),
    getClientIp(req),
    now
  );

  return { rawToken, csrfToken };
}

export function setUserSessionCookie(req: Request, res: Response, rawToken: string): void {
  const secure = isHttpsRequest(req);
  res.cookie(USER_SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    maxAge: USER_SESSION_TTL_MS,
    path: '/',
  });
}

export function clearUserSessionCookie(req: Request, res: Response): void {
  const secure = isHttpsRequest(req);
  res.clearCookie(USER_SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
  });
}

export function resolveUserFromRequest(req: Request, res?: Response): AuthenticatedUser | null {
  const cookies = parseCookies(req.headers.cookie);
  const headerToken =
    typeof req.headers['x-cafedesk-session'] === 'string'
      ? req.headers['x-cafedesk-session'].trim()
      : '';
  const rawToken = cookies[USER_SESSION_COOKIE_NAME] || headerToken;
  if (!rawToken) return null;

  const db = getDb();
  const row = db
    .prepare(
      `SELECT us.id as session_id, us.csrf_token, us.expires_at,
              u.id as user_id, u.name, u.email, u.auth_provider, u.email_verified, u.status
       FROM user_sessions us
       JOIN users u ON u.id = us.user_id
       WHERE us.token_hash = ?`
    )
    .get(sha256(rawToken)) as
    | {
        session_id: number;
        csrf_token: string;
        expires_at: number;
        user_id: number;
        name: string;
        email: string;
        auth_provider: string;
        email_verified: number;
        status: string;
      }
    | undefined;

  if (!row || row.expires_at < Date.now()) {
    if (row) {
      db.prepare('DELETE FROM user_sessions WHERE id = ?').run(row.session_id);
    }
    if (res) clearUserSessionCookie(req, res);
    return null;
  }

  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    authProvider: row.auth_provider === 'google' ? 'google' : 'email',
    emailVerified: Boolean(row.email_verified),
    status: row.status === 'suspended' ? 'suspended' : 'active',
    csrfToken: row.csrf_token,
    sessionId: row.session_id,
  };
}

export function optionalUserAuth(req: Request, res: Response, next: NextFunction): void {
  const user = resolveUserFromRequest(req, res);
  if (user && user.status === 'active') {
    req.user = user;
  }
  next();
}

export function requireUserAuth(req: Request, res: Response, next: NextFunction): void {
  const user = resolveUserFromRequest(req, res);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to your Cafe Desk account.' });
    return;
  }
  if (user.status === 'suspended') {
    res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
    return;
  }
  req.user = user;
  next();
}


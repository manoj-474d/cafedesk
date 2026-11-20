import crypto from 'node:crypto';
import type { Express, Request, Response } from 'express';
import {
  getDb,
  getUserEffectiveSubscription,
  listPlansFromDb,
  recordActivity,
} from './db.ts';
import {
  checkRateLimit,
  clearRateLimit,
  clearUserSessionCookie,
  createUserSession,
  getClientIp,
  hashPassword,
  recordRateAttempt,
  requireAdminAuth,
  requireFullAdmin,
  requireUserAuth,
  resolveUserFromRequest,
  setUserSessionCookie,
  sha256,
  validateUserPasswordStrength,
  verifyPassword,
} from './auth.ts';
import type {
  CafeLibrarySnapshot,
  PaymentRecord,
  PlanTier,
  SavedCafeRecord,
  SubscriptionHistoryItem,
  UserCollection,
  UserProfile,
} from '../src/types/subscription.ts';

const TEST_SIGNING_SECRET =
  process.env.SESSION_SECRET || 'cafedesk-local-razorpay-test-signing-key-2026';

function cleanStr(val: unknown, maxLen = 400): string {
  return String(val ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function safeJson<T>(raw: unknown, fallback: T): T {
  try {
    if (typeof raw !== 'string' || !raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function signTestOrderToken(orderId: string, userId: number, planId: string): string {
  return crypto
    .createHmac('sha256', TEST_SIGNING_SECRET)
    .update(`${orderId}|${userId}|${planId}`)
    .digest('hex');
}

function getUserLibraryPayload(userId: number): {
  savedCafes: SavedCafeRecord[];
  collections: UserCollection[];
} {
  const db = getDb();
  const savedRows = db
    .prepare('SELECT * FROM saved_cafes WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as Array<Record<string, unknown>>;

  const savedCafes: SavedCafeRecord[] = savedRows.map((r) => ({
    id: Number(r.id),
    user_id: Number(r.user_id),
    cafe_key: String(r.cafe_key),
    cafe_source: r.cafe_source === 'google' ? 'google' : 'curated',
    snapshot: safeJson<CafeLibrarySnapshot>(r.cafe_snapshot_json, {
      key: String(r.cafe_key),
      source: 'curated',
      name: 'Cafe',
      area: 'Bengaluru',
      address: '',
      map_link: 'https://maps.google.com/?q=Bengaluru',
    }),
    is_favourite: Boolean(r.is_favourite),
    created_at: Number(r.created_at),
  }));

  const colRows = db
    .prepare('SELECT * FROM user_collections WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as Array<Record<string, unknown>>;

  const itemStmt = db.prepare(
    'SELECT * FROM collection_items WHERE collection_id = ? ORDER BY added_at DESC'
  );
  const collections: UserCollection[] = colRows.map((c) => {
    const colId = Number(c.id);
    const itemRows = itemStmt.all(colId) as Array<Record<string, unknown>>;
    return {
      id: colId,
      user_id: Number(c.user_id),
      name: String(c.name),
      description: String(c.description || ''),
      created_at: Number(c.created_at),
      items: itemRows.map((ir) => ({
        cafe_key: String(ir.cafe_key),
        added_at: Number(ir.added_at),
        snapshot: safeJson<CafeLibrarySnapshot>(ir.cafe_snapshot_json, {
          key: String(ir.cafe_key),
          source: 'curated',
          name: 'Cafe',
          area: 'Bengaluru',
          address: '',
          map_link: 'https://maps.google.com/?q=Bengaluru',
        }),
      })),
    };
  });

  return { savedCafes, collections };
}

function formatUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
    auth_provider: row.auth_provider === 'google' ? 'google' : 'email',
    email_verified: Boolean(row.email_verified),
    status: row.status === 'suspended' ? 'suspended' : 'active',
    last_login_at: row.last_login_at ? Number(row.last_login_at) : null,
    created_at: Number(row.created_at),
  };
}

function buildAuthPayload(userId: number, csrfToken: string) {
  const db = getDb();
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<
    string,
    unknown
  >;
  const subscription = getUserEffectiveSubscription(userId);
  const library = getUserLibraryPayload(userId);
  return {
    authenticated: true,
    user: formatUserProfile(userRow),
    subscription,
    savedCafes: library.savedCafes,
    collections: library.collections,
    csrfToken,
  };
}

function makeReceiptNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CD-${datePart}-${randPart}`;
}

export function registerSubscriptionRoutes(app: Express): void {
  // ============================================================================
  // 1. CUSTOMER AUTHENTICATION & PROFILE
  // ============================================================================

  app.get('/api/auth/me', (req: Request, res: Response) => {
    const resolved = resolveUserFromRequest(req, res);
    if (!resolved) {
      res.json({ authenticated: false });
      return;
    }
    if (resolved.status === 'suspended') {
      clearUserSessionCookie(req, res);
      res.json({
        authenticated: false,
        suspended: true,
        error: 'Your account has been suspended. Please contact support.',
      });
      return;
    }
    res.json(buildAuthPayload(resolved.id, resolved.csrfToken));
  });

  app.post('/api/auth/signup', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`user-signup:${ip}`, 12, 15 * 60 * 1000);
    if (!limit.allowed) {
      res.status(429).json({
        error: `Too many signup attempts. Please retry in ${limit.retryAfterSec} seconds.`,
      });
      return;
    }

    const name = cleanStr(req.body?.name, 80);
    const email = cleanStr(req.body?.email, 160).toLowerCase();
    const password = String(req.body?.password ?? '');

    if (!name || name.length < 2) {
      res.status(400).json({ error: 'Please enter your full name.' });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    const pwErr = validateUserPasswordStrength(password);
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      recordRateAttempt(`user-signup:${ip}`, 15 * 60 * 1000);
      res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
      return;
    }

    const now = Date.now();
    const verifyCode = String(crypto.randomInt(100000, 999999));
    const verifyHash = sha256(verifyCode);
    const verifyExpires = now + 30 * 60 * 1000;
    const pwHash = hashPassword(password);

    const insertRes = db
      .prepare(
        `INSERT INTO users
         (name, email, password_hash, auth_provider, email_verified, verify_token_hash, verify_token_expires_at, status, last_login_at, created_at, updated_at)
         VALUES (?, ?, ?, 'email', 0, ?, ?, 'active', ?, ?, ?)`
      )
      .run(name, email, pwHash, verifyHash, verifyExpires, now, now, now);

    const userId = Number(insertRes.lastInsertRowid);

    // Every new user automatically receives the Free Explorer (₹0) plan
    db.prepare(
      `INSERT INTO user_subscriptions (user_id, plan_id, subscribed_price_inr, status, started_at, expires_at, auto_renew, updated_at)
       VALUES (?, 'free', 0, 'active', ?, NULL, 0, ?)`
    ).run(userId, now, now);

    db.prepare(
      `INSERT INTO subscription_history (user_id, action, from_plan, to_plan, note, created_at)
       VALUES (?, 'registered', '', 'free', 'Automatically assigned Free Explorer plan on signup', ?)`
    ).run(userId, now);

    const { rawToken, csrfToken } = createUserSession(userId, req);
    setUserSessionCookie(req, res, rawToken);

    res.status(201).json({
      ...buildAuthPayload(userId, csrfToken),
      devVerificationCode: verifyCode,
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const limitKey = `user-login:${ip}`;
    const limit = checkRateLimit(limitKey, 12, 15 * 60 * 1000);
    if (!limit.allowed) {
      res.status(429).json({
        error: `Too many login attempts. Please retry in ${limit.retryAfterSec} seconds.`,
      });
      return;
    }

    const email = cleanStr(req.body?.email, 160).toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
      | Record<string, unknown>
      | undefined;

    if (!row || !verifyPassword(password, String(row.password_hash))) {
      recordRateAttempt(limitKey, 15 * 60 * 1000);
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (row.status === 'suspended') {
      res.status(403).json({
        error: 'Your account has been suspended by an administrator. Please contact support.',
      });
      return;
    }

    clearRateLimit(limitKey);
    const userId = Number(row.id);
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Date.now(), userId);
    const { rawToken, csrfToken } = createUserSession(userId, req);
    setUserSessionCookie(req, res, rawToken);
    res.json(buildAuthPayload(userId, csrfToken));
  });

  app.post('/api/auth/google', async (req: Request, res: Response) => {
    const idToken = cleanStr(req.body?.idToken, 4096);
    const expectedClientId = (process.env.VITE_GOOGLE_CLIENT_ID || '').trim();
    if (!expectedClientId) {
      res.status(501).json({
        error: 'Google Sign-In is not configured on this environment. Please use email sign-in.',
      });
      return;
    }
    if (!idToken) {
      res.status(400).json({ error: 'Missing Google credential token.' });
      return;
    }

    try {
      const verifyResp = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
      );
      if (!verifyResp.ok) {
        res.status(401).json({ error: 'Google token verification failed.' });
        return;
      }
      const claims = (await verifyResp.json()) as {
        aud?: string;
        email?: string;
        email_verified?: string | boolean;
        name?: string;
      };
      if (claims.aud !== expectedClientId || !claims.email) {
        res.status(401).json({ error: 'Google token audience mismatch.' });
        return;
      }

      const email = claims.email.toLowerCase();
      const displayName = cleanStr(claims.name || email.split('@')[0], 80);
      const db = getDb();
      const now = Date.now();
      let userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
        | Record<string, unknown>
        | undefined;

      let userId: number;
      if (!userRow) {
        const randomSecret = hashPassword(crypto.randomBytes(24).toString('hex'));
        const inserted = db
          .prepare(
            `INSERT INTO users
             (name, email, password_hash, auth_provider, email_verified, status, last_login_at, created_at, updated_at)
             VALUES (?, ?, ?, 'google', 1, 'active', ?, ?, ?)`
          )
          .run(displayName, email, randomSecret, now, now, now);
        userId = Number(inserted.lastInsertRowid);
        db.prepare(
          `INSERT INTO user_subscriptions (user_id, plan_id, subscribed_price_inr, status, started_at, expires_at, auto_renew, updated_at)
           VALUES (?, 'free', 0, 'active', ?, NULL, 0, ?)`
        ).run(userId, now, now);
        db.prepare(
          `INSERT INTO subscription_history (user_id, action, from_plan, to_plan, note, created_at)
           VALUES (?, 'registered', '', 'free', 'Google Sign-In — assigned Free Explorer plan', ?)`
        ).run(userId, now);
      } else {
        if (userRow.status === 'suspended') {
          res.status(403).json({ error: 'Your account is suspended.' });
          return;
        }
        userId = Number(userRow.id);
        db.prepare('UPDATE users SET email_verified = 1, last_login_at = ?, updated_at = ? WHERE id = ?').run(
          now,
          now,
          userId
        );
      }

      const { rawToken, csrfToken } = createUserSession(userId, req);
      setUserSessionCookie(req, res, rawToken);
      res.json(buildAuthPayload(userId, csrfToken));
    } catch (err) {
      console.error('Google auth verification failed:', err);
      res.status(500).json({ error: 'Failed to verify Google Sign-In.' });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const resolved = resolveUserFromRequest(req, res);
    if (resolved) {
      getDb().prepare('DELETE FROM user_sessions WHERE id = ?').run(resolved.sessionId);
    }
    clearUserSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.post('/api/auth/verify-email/request', requireUserAuth, (req: Request, res: Response) => {
    const now = Date.now();
    const code = String(crypto.randomInt(100000, 999999));
    getDb()
      .prepare(
        'UPDATE users SET verify_token_hash = ?, verify_token_expires_at = ?, updated_at = ? WHERE id = ?'
      )
      .run(sha256(code), now + 30 * 60 * 1000, now, req.user!.id);

    res.json({
      ok: true,
      message: 'Verification code generated. Enter the 6-digit code to verify your email.',
      devVerificationCode: code,
    });
  });

  app.post('/api/auth/verify-email/confirm', requireUserAuth, (req: Request, res: Response) => {
    const code = cleanStr(req.body?.code, 20);
    if (!code) {
      res.status(400).json({ error: 'Verification code is required.' });
      return;
    }

    const db = getDb();
    const row = db
      .prepare('SELECT verify_token_hash, verify_token_expires_at FROM users WHERE id = ?')
      .get(req.user!.id) as
      | { verify_token_hash: string | null; verify_token_expires_at: number | null }
      | undefined;

    if (
      !row ||
      !row.verify_token_hash ||
      !row.verify_token_expires_at ||
      row.verify_token_expires_at < Date.now() ||
      row.verify_token_hash !== sha256(code)
    ) {
      res.status(400).json({ error: 'Invalid or expired verification code.' });
      return;
    }

    const now = Date.now();
    db.prepare(
      'UPDATE users SET email_verified = 1, verify_token_hash = NULL, verify_token_expires_at = NULL, updated_at = ? WHERE id = ?'
    ).run(now, req.user!.id);

    res.json({
      ok: true,
      ...buildAuthPayload(req.user!.id, req.user!.csrfToken),
    });
  });

  app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`user-forgot:${ip}`, 8, 15 * 60 * 1000);
    if (!limit.allowed) {
      res.status(429).json({
        error: `Too many reset requests. Please try again in ${limit.retryAfterSec} seconds.`,
      });
      return;
    }
    recordRateAttempt(`user-forgot:${ip}`, 15 * 60 * 1000);

    const email = cleanStr(req.body?.email, 160).toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as
      | { id: number }
      | undefined;

    if (!user) {
      res.json({
        ok: true,
        message: 'If an account matches that email, a password reset code has been prepared.',
      });
      return;
    }

    const resetCode = String(crypto.randomInt(100000, 999999));
    const now = Date.now();
    db.prepare(
      'UPDATE users SET reset_token_hash = ?, reset_token_expires_at = ?, updated_at = ? WHERE id = ?'
    ).run(sha256(resetCode), now + 30 * 60 * 1000, now, user.id);

    res.json({
      ok: true,
      message: 'Password reset code prepared. Enter the code below along with your new password.',
      devResetCode: resetCode,
    });
  });

  app.post('/api/auth/reset-password', (req: Request, res: Response) => {
    const email = cleanStr(req.body?.email, 160).toLowerCase();
    const code = cleanStr(req.body?.code, 20);
    const newPassword = String(req.body?.newPassword ?? '');

    if (!email || !code) {
      res.status(400).json({ error: 'Email and reset code are required.' });
      return;
    }
    const pwErr = validateUserPasswordStrength(newPassword);
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }

    const db = getDb();
    const user = db
      .prepare('SELECT id, reset_token_hash, reset_token_expires_at FROM users WHERE email = ?')
      .get(email) as
      | { id: number; reset_token_hash: string | null; reset_token_expires_at: number | null }
      | undefined;

    if (
      !user ||
      !user.reset_token_hash ||
      !user.reset_token_expires_at ||
      user.reset_token_expires_at < Date.now() ||
      user.reset_token_hash !== sha256(code)
    ) {
      res.status(400).json({ error: 'Invalid or expired password reset code.' });
      return;
    }

    const now = Date.now();
    db.prepare(
      'UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires_at = NULL, updated_at = ? WHERE id = ?'
    ).run(hashPassword(newPassword), now, user.id);
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(user.id);

    res.json({ ok: true, message: 'Password updated successfully. You can now sign in.' });
  });

  app.put('/api/auth/profile', requireUserAuth, (req: Request, res: Response) => {
    const name = cleanStr(req.body?.name, 80);
    const currentPassword = String(req.body?.currentPassword ?? '');
    const newPassword = String(req.body?.newPassword ?? '');

    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as Record<
      string,
      unknown
    >;
    let updatedHash = String(row.password_hash);

    if (newPassword) {
      if (row.auth_provider === 'email' && !verifyPassword(currentPassword, updatedHash)) {
        res.status(400).json({ error: 'Current password is incorrect.' });
        return;
      }
      const pwErr = validateUserPasswordStrength(newPassword);
      if (pwErr) {
        res.status(400).json({ error: pwErr });
        return;
      }
      updatedHash = hashPassword(newPassword);
    }

    const finalName = name && name.length >= 2 ? name : String(row.name);
    db.prepare('UPDATE users SET name = ?, password_hash = ?, updated_at = ? WHERE id = ?').run(
      finalName,
      updatedHash,
      Date.now(),
      req.user!.id
    );

    res.json(buildAuthPayload(req.user!.id, req.user!.csrfToken));
  });

  // ============================================================================
  // 2. SUBSCRIPTION PLANS & RAZORPAY CHECKOUT
  // ============================================================================

  app.get('/api/plans', (_req: Request, res: Response) => {
    const plans = listPlansFromDb();
    const keyId = (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '').trim();
    const hasSecret = Boolean((process.env.RAZORPAY_KEY_SECRET || '').trim());
    res.json({
      plans,
      razorpayEnabled: Boolean(keyId && hasSecret),
      razorpayKeyId: keyId && hasSecret ? keyId : '',
    });
  });

  app.post('/api/billing/checkout/create-order', requireUserAuth, async (req: Request, res: Response) => {
    const planId = cleanStr(req.body?.planId, 40) as PlanTier;
    const methodRaw = cleanStr(req.body?.method, 20);
    const method =
      methodRaw === 'card' || methodRaw === 'netbanking' || methodRaw === 'upi' ? methodRaw : 'upi';

    const plans = listPlansFromDb();
    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan || !targetPlan.active || targetPlan.price_inr <= 0 || targetPlan.id === 'free') {
      res.status(400).json({ error: 'Select an active paid subscription plan to upgrade.' });
      return;
    }

    const amountInr = targetPlan.price_inr;
    const amountPaise = Math.round(amountInr * 100);
    const receiptNumber = makeReceiptNumber();
    const now = Date.now();
    const db = getDb();

    const rzpKey = (process.env.RAZORPAY_KEY_ID || '').trim();
    const rzpSecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

    if (rzpKey && rzpSecret) {
      try {
        const authHeader = Buffer.from(`${rzpKey}:${rzpSecret}`).toString('base64');
        const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${authHeader}`,
          },
          body: JSON.stringify({
            amount: amountPaise,
            currency: 'INR',
            receipt: receiptNumber,
            notes: {
              user_id: String(req.user!.id),
              plan_id: planId,
              email: req.user!.email,
            },
          }),
        });
        const orderData = (await rzpRes.json()) as { id?: string; error?: { description?: string } };
        if (!rzpRes.ok || !orderData.id) {
          res.status(502).json({
            error: orderData.error?.description || 'Failed to initiate Razorpay payment order.',
          });
          return;
        }

        const insertPayment = db
          .prepare(
            `INSERT INTO payments
             (receipt_number, user_id, plan_id, amount_inr, currency, method, provider, provider_order_id, status, created_at)
             VALUES (?, ?, ?, ?, 'INR', ?, 'razorpay', ?, 'created', ?)`
          )
          .run(receiptNumber, req.user!.id, planId, amountInr, method, orderData.id, now);

        res.json({
          mode: 'razorpay',
          keyId: rzpKey,
          orderId: orderData.id,
          paymentId: Number(insertPayment.lastInsertRowid),
          receiptNumber,
          amountInr,
          amountPaise,
          currency: 'INR',
          plan: targetPlan,
        });
        return;
      } catch (err) {
        console.error('Razorpay order error:', err);
        res.status(502).json({ error: 'Payment gateway could not be reached.' });
        return;
      }
    }

    // Razorpay-compatible server-signed checkout order (test mode)
    const testOrderId = `order_cd_${crypto.randomBytes(6).toString('hex')}`;
    const testToken = signTestOrderToken(testOrderId, req.user!.id, planId);
    const insertPayment = db
      .prepare(
        `INSERT INTO payments
         (receipt_number, user_id, plan_id, amount_inr, currency, method, provider, provider_order_id, status, created_at)
         VALUES (?, ?, ?, ?, 'INR', ?, 'razorpay_test', ?, 'created', ?)`
      )
      .run(receiptNumber, req.user!.id, planId, amountInr, method, testOrderId, now);

    res.json({
      mode: 'test',
      orderId: testOrderId,
      paymentId: Number(insertPayment.lastInsertRowid),
      receiptNumber,
      amountInr,
      amountPaise,
      currency: 'INR',
      plan: targetPlan,
      testToken,
    });
  });

  app.post('/api/billing/checkout/verify', requireUserAuth, (req: Request, res: Response) => {
    const orderId = cleanStr(req.body?.orderId, 120);
    const paymentId = Number(req.body?.paymentId);
    const providerPaymentId = cleanStr(req.body?.razorpayPaymentId || `pay_${crypto.randomBytes(6).toString('hex')}`, 120);
    const razorpaySignature = cleanStr(req.body?.razorpaySignature, 256);
    const testToken = cleanStr(req.body?.testToken, 256);
    const methodRaw = cleanStr(req.body?.method, 20);
    const method =
      methodRaw === 'card' || methodRaw === 'netbanking' || methodRaw === 'upi' ? methodRaw : 'upi';

    if (!orderId || !Number.isFinite(paymentId)) {
      res.status(400).json({ error: 'Invalid payment confirmation payload.' });
      return;
    }

    const db = getDb();
    const paymentRow = db
      .prepare('SELECT * FROM payments WHERE id = ? AND user_id = ? AND provider_order_id = ?')
      .get(paymentId, req.user!.id, orderId) as Record<string, unknown> | undefined;

    if (!paymentRow) {
      res.status(404).json({ error: 'Payment order not found.' });
      return;
    }

    if (paymentRow.status === 'paid') {
      const sub = getUserEffectiveSubscription(req.user!.id);
      res.json({ ok: true, subscription: sub });
      return;
    }

    const planId = String(paymentRow.plan_id) as PlanTier;
    if (paymentRow.provider === 'razorpay') {
      const rzpSecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
      const expectedSig = crypto
        .createHmac('sha256', rzpSecret)
        .update(`${orderId}|${providerPaymentId}`)
        .digest('hex');
      if (!rzpSecret || !razorpaySignature || expectedSig !== razorpaySignature) {
        db.prepare(
          "UPDATE payments SET status = 'failed', failure_reason = 'Invalid Razorpay signature' WHERE id = ?"
        ).run(paymentId);
        res.status(400).json({ error: 'Payment signature verification failed.' });
        return;
      }
    } else {
      const expectedTestToken = signTestOrderToken(orderId, req.user!.id, planId);
      if (!testToken || testToken !== expectedTestToken) {
        db.prepare(
          "UPDATE payments SET status = 'failed', failure_reason = 'Invalid checkout verification token' WHERE id = ?"
        ).run(paymentId);
        res.status(400).json({ error: 'Checkout verification failed.' });
        return;
      }
    }

    const plan = listPlansFromDb(true).find((p) => p.id === planId);
    const durationDays = Math.max(1, plan?.interval_days || 30);
    const now = Date.now();
    const currentSub = getUserEffectiveSubscription(req.user!.id);
    const baseTime =
      currentSub.plan_id === planId && currentSub.expires_at && currentSub.expires_at > now
        ? currentSub.expires_at
        : now;
    const nextExpiresAt = baseTime + durationDays * 24 * 60 * 60 * 1000;

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        `UPDATE payments
         SET status = 'paid', method = ?, provider_payment_id = ?, failure_reason = ''
         WHERE id = ?`
      ).run(method, providerPaymentId, paymentId);

      db.prepare(
        `INSERT INTO user_subscriptions (user_id, plan_id, subscribed_price_inr, status, started_at, expires_at, auto_renew, cancelled_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, 1, NULL, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           plan_id = excluded.plan_id,
           subscribed_price_inr = excluded.subscribed_price_inr,
           status = 'active',
           started_at = excluded.started_at,
           expires_at = excluded.expires_at,
           auto_renew = 1,
           cancelled_at = NULL,
           updated_at = excluded.updated_at`
      ).run(req.user!.id, planId, Number(paymentRow.amount_inr), now, nextExpiresAt, now);

      const actionLabel = currentSub.plan_id === planId ? 'renewed' : 'upgraded';
      db.prepare(
        `INSERT INTO subscription_history (user_id, action, from_plan, to_plan, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        req.user!.id,
        actionLabel,
        currentSub.plan_id,
        planId,
        `Verified ₹${Number(paymentRow.amount_inr)} payment (${method.toUpperCase()}) · Receipt ${String(paymentRow.receipt_number)}`,
        now
      );

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      console.error('Subscription activation error:', err);
      res.status(500).json({ error: 'Failed to activate subscription after payment.' });
      return;
    }

    const updatedPayment = db
      .prepare('SELECT * FROM payments WHERE id = ?')
      .get(paymentId) as Record<string, unknown>;

    res.json({
      ok: true,
      ...buildAuthPayload(req.user!.id, req.user!.csrfToken),
      payment: {
        id: Number(updatedPayment.id),
        receipt_number: String(updatedPayment.receipt_number),
        plan_id: String(updatedPayment.plan_id),
        amount_inr: Number(updatedPayment.amount_inr),
        method: String(updatedPayment.method),
        provider_payment_id: String(updatedPayment.provider_payment_id),
        status: String(updatedPayment.status),
        created_at: Number(updatedPayment.created_at),
      },
    });
  });

  app.post('/api/billing/checkout/fail', requireUserAuth, (req: Request, res: Response) => {
    const paymentId = Number(req.body?.paymentId);
    const reason = cleanStr(req.body?.reason || 'Payment declined or cancelled by user', 200);
    if (!Number.isFinite(paymentId)) {
      res.status(400).json({ error: 'Payment ID required.' });
      return;
    }

    getDb()
      .prepare(
        "UPDATE payments SET status = 'failed', failure_reason = ? WHERE id = ? AND user_id = ? AND status = 'created'"
      )
      .run(reason, paymentId, req.user!.id);

    res.json({ ok: true, message: reason });
  });

  app.post('/api/billing/cancel', requireUserAuth, (req: Request, res: Response) => {
    const sub = getUserEffectiveSubscription(req.user!.id);
    if (sub.plan_id === 'free') {
      res.status(400).json({ error: 'You are currently on the Free Explorer plan.' });
      return;
    }

    const now = Date.now();
    const db = getDb();
    db.prepare(
      "UPDATE user_subscriptions SET status = 'cancelled', auto_renew = 0, cancelled_at = ?, updated_at = ? WHERE user_id = ?"
    ).run(now, now, req.user!.id);
    db.prepare(
      `INSERT INTO subscription_history (user_id, action, from_plan, to_plan, note, created_at)
       VALUES (?, 'cancelled', ?, ?, 'Auto-renewal cancelled by member; access stays active until billing period ends', ?)`
    ).run(req.user!.id, sub.plan_id, sub.plan_id, now);

    res.json(buildAuthPayload(req.user!.id, req.user!.csrfToken));
  });

  app.post('/api/billing/renew', requireUserAuth, (req: Request, res: Response) => {
    const sub = getUserEffectiveSubscription(req.user!.id);
    if (sub.plan_id === 'free') {
      res.status(400).json({ error: 'Choose Plus or Premium from Pricing to subscribe.' });
      return;
    }

    const now = Date.now();
    const db = getDb();
    db.prepare(
      "UPDATE user_subscriptions SET status = 'active', auto_renew = 1, cancelled_at = NULL, updated_at = ? WHERE user_id = ?"
    ).run(now, req.user!.id);
    db.prepare(
      `INSERT INTO subscription_history (user_id, action, from_plan, to_plan, note, created_at)
       VALUES (?, 'reactivated', ?, ?, 'Auto-renewal resumed by member', ?)`
    ).run(req.user!.id, sub.plan_id, sub.plan_id, now);

    res.json(buildAuthPayload(req.user!.id, req.user!.csrfToken));
  });

  app.get('/api/billing/history', requireUserAuth, (req: Request, res: Response) => {
    const db = getDb();
    const paymentRows = db
      .prepare(
        `SELECT p.*, sp.name as plan_name
         FROM payments p
         LEFT JOIN subscription_plans sp ON sp.id = p.plan_id
         WHERE p.user_id = ?
         ORDER BY p.created_at DESC`
      )
      .all(req.user!.id) as Array<Record<string, unknown>>;

    const payments: PaymentRecord[] = paymentRows.map((p) => ({
      id: Number(p.id),
      receipt_number: String(p.receipt_number),
      user_id: Number(p.user_id),
      plan_id: String(p.plan_id) as PlanTier,
      plan_name: String(p.plan_name || p.plan_id),
      amount_inr: Number(p.amount_inr),
      currency: String(p.currency),
      method: String(p.method) as PaymentRecord['method'],
      provider: String(p.provider) as PaymentRecord['provider'],
      provider_order_id: String(p.provider_order_id),
      provider_payment_id: String(p.provider_payment_id),
      status: String(p.status) as PaymentRecord['status'],
      failure_reason: String(p.failure_reason || ''),
      refunded_at: p.refunded_at ? Number(p.refunded_at) : null,
      created_at: Number(p.created_at),
    }));

    const historyRows = db
      .prepare(
        'SELECT * FROM subscription_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 40'
      )
      .all(req.user!.id) as Array<Record<string, unknown>>;

    const history: SubscriptionHistoryItem[] = historyRows.map((h) => ({
      id: Number(h.id),
      user_id: Number(h.user_id),
      action: String(h.action),
      from_plan: String(h.from_plan),
      to_plan: String(h.to_plan),
      note: String(h.note),
      created_at: Number(h.created_at),
    }));

    res.json({ payments, history });
  });

  // ============================================================================
  // 3. PREMIUM SAVED CAFES, FAVOURITES & PERSONAL COLLECTIONS
  // ============================================================================

  app.get('/api/user/library', requireUserAuth, (req: Request, res: Response) => {
    res.json(getUserLibraryPayload(req.user!.id));
  });

  // Saving & favouriting cafes is unlocked for all Free & Plus members
  app.post('/api/user/saved', requireUserAuth, (req: Request, res: Response) => {
    const cafeKey = cleanStr(req.body?.cafeKey, 160);
    const snapshot = req.body?.snapshot as CafeLibrarySnapshot | undefined;
    const isFavourite = Boolean(req.body?.isFavourite);
    if (!cafeKey || !snapshot || !snapshot.name) {
      res.status(400).json({ error: 'Cafe details are required to save.' });
      return;
    }

    const db = getDb();
    const source = snapshot.source === 'google' ? 'google' : 'curated';
    db.prepare(
      `INSERT INTO saved_cafes (user_id, cafe_key, cafe_source, cafe_snapshot_json, is_favourite, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, cafe_key) DO UPDATE SET
         cafe_snapshot_json = excluded.cafe_snapshot_json,
         is_favourite = excluded.is_favourite`
    ).run(req.user!.id, cafeKey, source, JSON.stringify(snapshot), isFavourite ? 1 : 0, Date.now());

    res.json(getUserLibraryPayload(req.user!.id));
  });

  app.delete('/api/user/saved/:cafeKey', requireUserAuth, (req: Request, res: Response) => {
    const cafeKey = decodeURIComponent(String(req.params.cafeKey ?? ''));
    getDb()
      .prepare('DELETE FROM saved_cafes WHERE user_id = ? AND cafe_key = ?')
      .run(req.user!.id, cafeKey);
    res.json(getUserLibraryPayload(req.user!.id));
  });

  app.post('/api/user/collections', requireUserAuth, (req: Request, res: Response) => {
    const sub = getUserEffectiveSubscription(req.user!.id);
    if (sub.plan_id === 'free') {
      res.status(403).json({
        error: 'Personal cafe collections require Cafe Desk Plus (₹79/month or ₹499/year).',
        requiredPlan: 'plus',
      });
      return;
    }

    const name = cleanStr(req.body?.name, 80);
    const description = cleanStr(req.body?.description, 240);
    if (!name) {
      res.status(400).json({ error: 'Collection name is required.' });
      return;
    }

    getDb()
      .prepare(
        'INSERT INTO user_collections (user_id, name, description, created_at) VALUES (?, ?, ?, ?)'
      )
      .run(req.user!.id, name, description, Date.now());

    res.status(201).json(getUserLibraryPayload(req.user!.id));
  });

  app.delete('/api/user/collections/:id', requireUserAuth, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    getDb()
      .prepare('DELETE FROM user_collections WHERE id = ? AND user_id = ?')
      .run(id, req.user!.id);
    res.json(getUserLibraryPayload(req.user!.id));
  });

  app.post('/api/user/collections/:id/items', requireUserAuth, (req: Request, res: Response) => {
    const sub = getUserEffectiveSubscription(req.user!.id);
    if (sub.plan_id === 'free') {
      res.status(403).json({
        error: 'Adding cafes to collections requires Cafe Desk Plus (₹79/month or ₹499/year).',
        requiredPlan: 'plus',
      });
      return;
    }

    const colId = Number(req.params.id);
    const cafeKey = cleanStr(req.body?.cafeKey, 160);
    const snapshot = req.body?.snapshot as CafeLibrarySnapshot | undefined;
    if (!cafeKey || !snapshot || !snapshot.name) {
      res.status(400).json({ error: 'Cafe details are required.' });
      return;
    }

    const db = getDb();
    const owns = db
      .prepare('SELECT id FROM user_collections WHERE id = ? AND user_id = ?')
      .get(colId, req.user!.id);
    if (!owns) {
      res.status(404).json({ error: 'Collection not found.' });
      return;
    }

    db.prepare(
      `INSERT INTO collection_items (collection_id, cafe_key, cafe_snapshot_json, added_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(collection_id, cafe_key) DO UPDATE SET cafe_snapshot_json = excluded.cafe_snapshot_json`
    ).run(colId, cafeKey, JSON.stringify(snapshot), Date.now());

    res.json(getUserLibraryPayload(req.user!.id));
  });

  app.delete(
    '/api/user/collections/:id/items/:cafeKey',
    requireUserAuth,
    (req: Request, res: Response) => {
      const colId = Number(req.params.id);
      const cafeKey = decodeURIComponent(String(req.params.cafeKey ?? ''));
      const db = getDb();
      const owns = db
        .prepare('SELECT id FROM user_collections WHERE id = ? AND user_id = ?')
        .get(colId, req.user!.id);
      if (!owns) {
        res.status(404).json({ error: 'Collection not found.' });
        return;
      }
      db.prepare('DELETE FROM collection_items WHERE collection_id = ? AND cafe_key = ?').run(
        colId,
        cafeKey
      );
      res.json(getUserLibraryPayload(req.user!.id));
    }
  );

  // ============================================================================
  // 4. ADMIN SUBSCRIPTION, USER & REVENUE MANAGEMENT
  // ============================================================================

  app.get('/api/admin/subscriptions/overview', requireAdminAuth, (_req: Request, res: Response) => {
    const db = getDb();
    const now = Date.now();
    const plans = listPlansFromDb(true);
    const planIntervalMap = new Map(plans.map((p) => [p.id, Math.max(1, p.interval_days || 30)]));

    const userRows = db
      .prepare(
        'SELECT id, name, email, auth_provider, email_verified, status, last_login_at, created_at FROM users ORDER BY created_at DESC'
      )
      .all() as Array<Record<string, unknown>>;

    const users = userRows.map((u) => {
      const uid = Number(u.id);
      const sub = getUserEffectiveSubscription(uid);
      const payStats = db
        .prepare(
          "SELECT COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_inr ELSE 0 END), 0) as spent FROM payments WHERE user_id = ?"
        )
        .get(uid) as { spent: number };
      const lastPay = db
        .prepare(
          'SELECT status, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
        )
        .get(uid) as { status: string; created_at: number } | undefined;

      return {
        ...formatUserProfile(u),
        subscription: sub,
        total_spent_inr: Number(payStats?.spent ?? 0),
        last_payment_at: lastPay ? Number(lastPay.created_at) : null,
        last_payment_status: lastPay ? String(lastPay.status) : 'none',
      };
    });

    const paymentRows = db
      .prepare(
        `SELECT p.*, u.name as user_name, u.email as user_email, sp.name as plan_name
         FROM payments p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN subscription_plans sp ON sp.id = p.plan_id
         ORDER BY p.created_at DESC
         LIMIT 500`
      )
      .all() as Array<Record<string, unknown>>;

    const payments: PaymentRecord[] = paymentRows.map((p) => ({
      id: Number(p.id),
      receipt_number: String(p.receipt_number),
      user_id: Number(p.user_id),
      user_name: String(p.user_name),
      user_email: String(p.user_email),
      plan_id: String(p.plan_id) as PlanTier,
      plan_name: String(p.plan_name || p.plan_id),
      amount_inr: Number(p.amount_inr),
      currency: String(p.currency),
      method: String(p.method) as PaymentRecord['method'],
      provider: String(p.provider) as PaymentRecord['provider'],
      provider_order_id: String(p.provider_order_id),
      provider_payment_id: String(p.provider_payment_id),
      status: String(p.status) as PaymentRecord['status'],
      failure_reason: String(p.failure_reason || ''),
      refunded_at: p.refunded_at ? Number(p.refunded_at) : null,
      created_at: Number(p.created_at),
    }));

    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const yearAgo = now - 365 * 24 * 60 * 60 * 1000;
    const totalRevenueInr = payments
      .filter((p) => p.status === 'paid')
      .reduce((acc, p) => acc + p.amount_inr, 0);
    const monthRevenueInr = payments
      .filter((p) => p.status === 'paid' && p.created_at >= thirtyDaysAgo)
      .reduce((acc, p) => acc + p.amount_inr, 0);
    const yearRevenueInr = payments
      .filter((p) => p.status === 'paid' && p.created_at >= yearAgo)
      .reduce((acc, p) => acc + p.amount_inr, 0);
    const refundedInr = payments
      .filter((p) => p.status === 'refunded')
      .reduce((acc, p) => acc + p.amount_inr, 0);
    const paidCount = payments.filter((p) => p.status === 'paid').length;
    const failedPayments = payments.filter((p) => p.status === 'failed').length;
    const pendingPayments = payments.filter((p) => p.status === 'created').length;
    const refundedCount = payments.filter((p) => p.status === 'refunded').length;

    const countsByPlan: Record<string, number> = { free: 0, plus: 0, premium: 0 };
    for (const u of users) {
      countsByPlan[u.subscription.plan_id] = (countsByPlan[u.subscription.plan_id] ?? 0) + 1;
    }

    const activePaidUsersList = users.filter(
      (u) => u.subscription.plan_id !== 'free' && u.subscription.status === 'active'
    );
    const cancelledSubs = users.filter(
      (u) => u.subscription.plan_id !== 'free' && u.subscription.status === 'cancelled'
    ).length;
    const expiredSubs = users.filter((u) => u.subscription.status === 'expired').length;

    const mrrInr = Math.round(
      activePaidUsersList.reduce((acc, u) => {
        const price = u.subscription.subscribed_price_inr ?? u.subscription.price_inr;
        const interval = planIntervalMap.get(u.subscription.plan_id) ?? 30;
        return acc + (price * 30) / interval;
      }, 0)
    );

    const revByDay = new Map<string, number>();
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      revByDay.set(d, 0);
    }
    for (const p of payments) {
      if (p.status !== 'paid') continue;
      const d = new Date(p.created_at).toISOString().slice(0, 10);
      if (revByDay.has(d)) {
        revByDay.set(d, (revByDay.get(d) ?? 0) + p.amount_inr);
      }
    }
    const revenueSeries = Array.from(revByDay.entries()).map(([date, amount_inr]) => ({
      date,
      amount_inr,
    }));

    res.json({
      plans,
      users,
      payments,
      revenueSeries,
      metrics: {
        totalUsers: users.length,
        activePaidUsers: users.filter((u) => u.subscription.plan_id !== 'free').length,
        activeSubs: activePaidUsersList.length,
        cancelledSubs,
        expiredSubs,
        countsByPlan,
        totalRevenueInr,
        monthRevenueInr,
        yearRevenueInr,
        mrrInr,
        refundedInr,
        paidCount,
        failedPayments,
        pendingPayments,
        refundedCount,
      },
    });
  });

  app.post(
    '/api/admin/subscriptions/plans',
    requireAdminAuth,
    requireFullAdmin,
    (req: Request, res: Response) => {
      const rawId = cleanStr(req.body?.id || req.body?.name, 40)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const name = cleanStr(req.body?.name, 80);
      const tagline = cleanStr(req.body?.tagline, 200);
      const badgeText = cleanStr(req.body?.badge_text, 40);
      const promoNote = cleanStr(req.body?.promo_note, 140);
      const priceInr = Math.max(1, Math.round(Number(req.body?.price_inr ?? 0)));
      const intervalDays = Math.max(1, Math.min(3650, Math.round(Number(req.body?.interval_days ?? 30))));
      const features = Array.isArray(req.body?.features)
        ? req.body.features.map((f: unknown) => cleanStr(f, 160)).filter(Boolean)
        : [];
      const active = req.body?.active === undefined ? 1 : req.body.active ? 1 : 0;

      if (!rawId || !name || features.length === 0) {
        res.status(400).json({ error: 'Plan name, valid ID, price > 0, and at least one feature are required.' });
        return;
      }

      const db = getDb();
      const exists = db.prepare('SELECT id FROM subscription_plans WHERE id = ?').get(rawId);
      if (exists) {
        res.status(409).json({ error: `A plan with ID "${rawId}" already exists.` });
        return;
      }

      const maxSortRow = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM subscription_plans').get() as {
        m: number;
      };

      db.prepare(
        `INSERT INTO subscription_plans
         (id, name, tagline, price_inr, interval_days, badge_text, promo_note, features_json, sort_order, active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        rawId,
        name,
        tagline,
        priceInr,
        intervalDays,
        badgeText,
        promoNote,
        JSON.stringify(features),
        Number(maxSortRow.m) + 1,
        active,
        Date.now()
      );

      recordActivity(
        req.admin!.username,
        'Created subscription plan',
        name,
        '',
        `₹${priceInr}/${intervalDays}d`
      );
      res.status(201).json({ ok: true, plans: listPlansFromDb(true) });
    }
  );

  app.put(
    '/api/admin/subscriptions/plans/:id',
    requireAdminAuth,
    requireFullAdmin,
    (req: Request, res: Response) => {
      const id = cleanStr(req.params.id, 40) as PlanTier;
      const db = getDb();
      const existing = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(id) as
        | Record<string, unknown>
        | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Subscription plan not found.' });
        return;
      }

      const name = cleanStr(req.body?.name, 80);
      const tagline = cleanStr(req.body?.tagline, 200);
      const badgeText = cleanStr(req.body?.badge_text, 40);
      const promoNote = cleanStr(req.body?.promo_note, 140);
      const priceInr = Math.max(0, Math.round(Number(req.body?.price_inr ?? 0)));
      const intervalDaysRaw = Number(req.body?.interval_days);
      const intervalDays =
        id === 'free'
          ? 0
          : Number.isFinite(intervalDaysRaw) && intervalDaysRaw > 0
          ? Math.min(3650, Math.round(intervalDaysRaw))
          : Number(existing.interval_days || 30);
      const features = Array.isArray(req.body?.features)
        ? req.body.features.map((f: unknown) => cleanStr(f, 160)).filter(Boolean)
        : [];
      const active = id === 'free' ? 1 : req.body?.active === undefined ? 1 : req.body.active ? 1 : 0;

      if (!name || features.length === 0) {
        res.status(400).json({ error: 'Plan name and at least one feature are required.' });
        return;
      }

      const nextPrice = id === 'free' ? 0 : priceInr;
      db.prepare(
        `UPDATE subscription_plans
         SET name = ?, tagline = ?, price_inr = ?, interval_days = ?, badge_text = ?, promo_note = ?, features_json = ?, active = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        name,
        tagline,
        nextPrice,
        intervalDays,
        badgeText,
        promoNote,
        JSON.stringify(features),
        active,
        Date.now(),
        id
      );

      recordActivity(
        req.admin!.username,
        'Updated subscription plan',
        name,
        `${String(existing.name)} · ₹${Number(existing.price_inr)}`,
        `${name} · ₹${nextPrice} (${active ? 'Active' : 'Inactive'})`
      );
      res.json({ ok: true, plans: listPlansFromDb(true) });
    }
  );

  app.get(
    '/api/admin/subscriptions/users/:userId/details',
    requireAdminAuth,
    (req: Request, res: Response) => {
      const userId = Number(req.params.userId);
      if (!Number.isInteger(userId)) {
        res.status(400).json({ error: 'Invalid user ID.' });
        return;
      }

      const db = getDb();
      const userRow = db
        .prepare(
          'SELECT id, name, email, auth_provider, email_verified, status, last_login_at, created_at FROM users WHERE id = ?'
        )
        .get(userId) as Record<string, unknown> | undefined;

      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const subscription = getUserEffectiveSubscription(userId);
      const library = getUserLibraryPayload(userId);

      const paymentRows = db
        .prepare(
          `SELECT p.*, sp.name as plan_name
           FROM payments p
           LEFT JOIN subscription_plans sp ON sp.id = p.plan_id
           WHERE p.user_id = ?
           ORDER BY p.created_at DESC`
        )
        .all(userId) as Array<Record<string, unknown>>;

      const payments: PaymentRecord[] = paymentRows.map((p) => ({
        id: Number(p.id),
        receipt_number: String(p.receipt_number),
        user_id: Number(p.user_id),
        plan_id: String(p.plan_id) as PlanTier,
        plan_name: String(p.plan_name || p.plan_id),
        amount_inr: Number(p.amount_inr),
        currency: String(p.currency),
        method: String(p.method) as PaymentRecord['method'],
        provider: String(p.provider) as PaymentRecord['provider'],
        provider_order_id: String(p.provider_order_id),
        provider_payment_id: String(p.provider_payment_id),
        status: String(p.status) as PaymentRecord['status'],
        failure_reason: String(p.failure_reason || ''),
        refunded_at: p.refunded_at ? Number(p.refunded_at) : null,
        created_at: Number(p.created_at),
      }));

      const historyRows = db
        .prepare('SELECT * FROM subscription_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
        .all(userId) as Array<Record<string, unknown>>;

      const history: SubscriptionHistoryItem[] = historyRows.map((h) => ({
        id: Number(h.id),
        user_id: Number(h.user_id),
        action: String(h.action),
        from_plan: String(h.from_plan),
        to_plan: String(h.to_plan),
        note: String(h.note),
        created_at: Number(h.created_at),
      }));

      res.json({
        user: formatUserProfile(userRow),
        subscription,
        payments,
        history,
        savedCafes: library.savedCafes,
        collections: library.collections,
      });
    }
  );

  app.post(
    '/api/admin/subscriptions/users/:userId/plan',
    requireAdminAuth,
    requireFullAdmin,
    (req: Request, res: Response) => {
      const userId = Number(req.params.userId);
      const planId = cleanStr(req.body?.planId, 40) as PlanTier;
      const durationDays = Math.max(1, Math.min(3650, Number(req.body?.durationDays ?? 30)));

      const targetPlan = listPlansFromDb(true).find((p) => p.id === planId);
      if (!Number.isFinite(userId) || !targetPlan) {
        res.status(400).json({ error: 'Invalid user or plan specified.' });
        return;
      }

      const db = getDb();
      const userRow = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as
        | { email: string }
        | undefined;
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const prevSub = getUserEffectiveSubscription(userId);
      const now = Date.now();
      const expiresAt = planId === 'free' ? null : now + durationDays * 24 * 60 * 60 * 1000;

      db.prepare(
        `INSERT INTO user_subscriptions (user_id, plan_id, subscribed_price_inr, status, started_at, expires_at, auto_renew, cancelled_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?, NULL, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           plan_id = excluded.plan_id,
           subscribed_price_inr = excluded.subscribed_price_inr,
           status = 'active',
           started_at = excluded.started_at,
           expires_at = excluded.expires_at,
           auto_renew = excluded.auto_renew,
           cancelled_at = NULL,
           updated_at = excluded.updated_at`
      ).run(userId, planId, targetPlan.price_inr, now, expiresAt, planId === 'free' ? 0 : 1, now);

      db.prepare(
        `INSERT INTO subscription_history (user_id, action, from_plan, to_plan, note, created_at)
         VALUES (?, 'admin_updated', ?, ?, ?, ?)`
      ).run(
        userId,
        prevSub.plan_id,
        planId,
        `Updated manually by admin ${req.admin!.username}${planId === 'free' ? '' : ` (${durationDays} days)`}`,
        now
      );

      recordActivity(
        req.admin!.username,
        'Changed user subscription',
        userRow.email,
        prevSub.plan_id,
        planId
      );
      res.json({ ok: true });
    }
  );

  app.post(
    '/api/admin/subscriptions/users/:userId/status',
    requireAdminAuth,
    requireFullAdmin,
    (req: Request, res: Response) => {
      const userId = Number(req.params.userId);
      const status = req.body?.status === 'suspended' ? 'suspended' : 'active';
      const db = getDb();
      const userRow = db.prepare('SELECT email, status FROM users WHERE id = ?').get(userId) as
        | { email: string; status: string }
        | undefined;
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(
        status,
        Date.now(),
        userId
      );
      if (status === 'suspended') {
        db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
      }

      recordActivity(
        req.admin!.username,
        `Set user status to ${status}`,
        userRow.email,
        userRow.status,
        status
      );
      res.json({ ok: true });
    }
  );

  app.delete(
    '/api/admin/subscriptions/users/:userId',
    requireAdminAuth,
    requireFullAdmin,
    (req: Request, res: Response) => {
      const userId = Number(req.params.userId);
      if (!Number.isInteger(userId)) {
        res.status(400).json({ error: 'Invalid user ID.' });
        return;
      }
      const db = getDb();
      const userRow = db.prepare('SELECT name, email FROM users WHERE id = ?').get(userId) as
        | { name: string; email: string }
        | undefined;
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      recordActivity(
        req.admin!.username,
        'Deleted customer account',
        userRow.email,
        `${userRow.name} (${userRow.email})`,
        'Deleted'
      );
      res.json({ ok: true });
    }
  );

  app.post(
    '/api/admin/subscriptions/payments/:paymentId/refund',
    requireAdminAuth,
    requireFullAdmin,
    (req: Request, res: Response) => {
      const paymentId = Number(req.params.paymentId);
      const db = getDb();
      const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as
        | Record<string, unknown>
        | undefined;

      if (!payment) {
        res.status(404).json({ error: 'Payment record not found.' });
        return;
      }
      if (payment.status !== 'paid') {
        res.status(400).json({ error: 'Only paid transactions can be refunded.' });
        return;
      }

      const now = Date.now();
      const userId = Number(payment.user_id);
      const prevSub = getUserEffectiveSubscription(userId);

      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare("UPDATE payments SET status = 'refunded', refunded_at = ? WHERE id = ?").run(
          now,
          paymentId
        );
        db.prepare(
          `UPDATE user_subscriptions
           SET plan_id = 'free', status = 'active', started_at = ?, expires_at = NULL, auto_renew = 0, updated_at = ?
           WHERE user_id = ?`
        ).run(now, now, userId);
        db.prepare(
          `INSERT INTO subscription_history (user_id, action, from_plan, to_plan, note, created_at)
           VALUES (?, 'refunded', ?, 'free', ?, ?)`
        ).run(
          userId,
          prevSub.plan_id,
          `Payment ${String(payment.receipt_number)} refunded by admin ${req.admin!.username}`,
          now
        );
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        console.error('Refund error:', err);
        res.status(500).json({ error: 'Failed to process refund.' });
        return;
      }

      recordActivity(
        req.admin!.username,
        'Issued subscription refund',
        `Receipt ${String(payment.receipt_number)} (₹${Number(payment.amount_inr)})`
      );
      res.json({ ok: true });
    }
  );

  // ============================================================================
  // 5. COMMUNITY IDEAS & FEATURE SUGGESTIONS + ADMIN FEEDBACK WORKFLOW
  // ============================================================================

  const ALLOWED_SUGGESTION_CATEGORIES = new Set([
    'New Feature',
    'Improvement',
    'Cafe Information',
    'Bug',
    'Other',
  ]);
  const ALLOWED_SUGGESTION_STATUSES = new Set([
    'new',
    'under_review',
    'planned',
    'implemented',
    'rejected',
  ]);

  app.post('/api/suggestions', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`suggestion:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      res.status(429).json({
        error: `Too many submissions right now. Please try again in ${limit.retryAfterSec} seconds.`,
      });
      return;
    }

    const title = cleanStr(req.body?.title, 120);
    const categoryRaw = cleanStr(req.body?.category, 40);
    const category = ALLOWED_SUGGESTION_CATEGORIES.has(categoryRaw) ? categoryRaw : 'Other';
    const details = cleanStr(req.body?.details, 2000);
    const email = cleanStr(req.body?.email, 160).toLowerCase();

    if (!title || title.length < 3) {
      res.status(400).json({ error: 'Please enter a brief suggestion title (at least 3 characters).' });
      return;
    }
    if (!details || details.length < 8) {
      res.status(400).json({ error: 'Please share a few more details about your idea or feedback.' });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address or leave it blank.' });
      return;
    }

    recordRateAttempt(`suggestion:${ip}`, 15 * 60 * 1000);
    const now = Date.now();
    const resDb = getDb()
      .prepare(
        `INSERT INTO feature_suggestions
         (title, category, details, email, status, admin_notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'new', '', ?, ?)`
      )
      .run(title, category, details, email, now, now);

    res.status(201).json({
      ok: true,
      id: Number(resDb.lastInsertRowid),
      message: 'Thank you! Your suggestion has been received by the Cafe Desk team.',
    });
  });

  app.get('/api/admin/suggestions', requireAdminAuth, (_req: Request, res: Response) => {
    const rows = getDb()
      .prepare('SELECT * FROM feature_suggestions ORDER BY created_at DESC LIMIT 500')
      .all() as Array<Record<string, unknown>>;

    res.json({
      suggestions: rows.map((r) => ({
        id: Number(r.id),
        title: String(r.title),
        category: String(r.category),
        details: String(r.details),
        email: String(r.email || ''),
        status: String(r.status || 'new'),
        admin_notes: String(r.admin_notes || ''),
        created_at: Number(r.created_at),
        updated_at: Number(r.updated_at),
      })),
    });
  });

  app.put('/api/admin/suggestions/:id', requireAdminAuth, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid suggestion ID.' });
      return;
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM feature_suggestions WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Suggestion not found.' });
      return;
    }

    const statusRaw = cleanStr(req.body?.status, 30);
    const status = ALLOWED_SUGGESTION_STATUSES.has(statusRaw)
      ? statusRaw
      : String(existing.status || 'new');
    const adminNotes =
      req.body?.admin_notes === undefined
        ? String(existing.admin_notes || '')
        : cleanStr(req.body.admin_notes, 2000);
    const now = Date.now();

    db.prepare(
      'UPDATE feature_suggestions SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?'
    ).run(status, adminNotes, now, id);

    recordActivity(
      req.admin!.username,
      `Marked idea "${String(existing.title)}" as ${status}`,
      `Suggestion #${id}`
    );

    res.json({
      ok: true,
      item: {
        id,
        title: String(existing.title),
        category: String(existing.category),
        details: String(existing.details),
        email: String(existing.email || ''),
        status,
        admin_notes: adminNotes,
        created_at: Number(existing.created_at),
        updated_at: now,
      },
    });
  });

  app.delete('/api/admin/suggestions/:id', requireAdminAuth, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid suggestion ID.' });
      return;
    }
    getDb().prepare('DELETE FROM feature_suggestions WHERE id = ?').run(id);
    recordActivity(req.admin!.username, 'Deleted feature suggestion', `#${id}`);
    res.json({ ok: true });
  });
}

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import { resolveViewerAccessContext } from './accessControl.ts';
import {
  SESSION_COOKIE_NAME,
  checkRateLimit,
  getClientIp,
  parseCookies,
  recordRateAttempt,
  requireUserAuth,
  resolveUserFromRequest,
  sha256,
} from './auth.ts';
import {
  getDb,
  getSiteSettingsFromDb,
  getUploadsDir,
  getUserEffectiveSubscription,
} from './db.ts';
import type { CafeLibrarySnapshot, UserCollection } from '../src/types/subscription.ts';

function cleanStr(val: unknown, maxLen: number): string {
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

function hasValidAdminSession(req: Request): boolean {
  const cookies = parseCookies(req.headers.cookie);
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) return false;
  const row = getDb()
    .prepare('SELECT id, expires_at FROM sessions WHERE token_hash = ?')
    .get(sha256(rawToken)) as { id: number; expires_at: number } | undefined;
  return Boolean(row && row.expires_at >= Date.now());
}

function parseAndValidateCommunityImage(dataUrl: string): {
  error?: string;
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
  const isJpeg =
    buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp =
    buffer.length > 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (
    (mimeType === 'image/png' && !isPng) ||
    (mimeType === 'image/jpeg' && !isJpeg) ||
    (mimeType === 'image/webp' && !isWebp)
  ) {
    return { error: 'Image file header does not match declared format.' };
  }

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  return { buffer, ext };
}

function resolveCafeTarget(slugOrIdRaw: string): {
  cafeId: string;
  cafeKey: string;
  cafeName: string;
} {
  const key = cleanStr(decodeURIComponent(slugOrIdRaw || ''), 160);
  const db = getDb();
  const row = db
    .prepare('SELECT id, slug, name FROM cafes WHERE slug = ? OR id = ? LIMIT 1')
    .get(key, key) as { id: string; slug: string | null; name: string } | undefined;
  if (row) {
    return {
      cafeId: String(row.id),
      cafeKey: String(row.slug || row.id),
      cafeName: String(row.name),
    };
  }
  return {
    cafeId: '',
    cafeKey: key,
    cafeName: key.startsWith('google:') ? 'Bengaluru Cafe' : key.replace(/-/g, ' '),
  };
}

function sanitizeContributionPayload(
  type: string,
  payloadRaw: Record<string, unknown>,
  pricingUnlocked: boolean
): Record<string, unknown> {
  if (type === 'menu_price' && !pricingUnlocked) {
    return {
      ...payloadRaw,
      priceInr: null,
      price_inr: null,
      priceMasked: true,
    };
  }
  return payloadRaw;
}

function formatReviewRow(r: Record<string, unknown>) {
  return {
    id: Number(r.id),
    cafe_id: String(r.cafe_id || ''),
    cafe_key: String(r.cafe_key),
    cafe_name: String(r.cafe_name),
    user_id: Number(r.user_id),
    author_name: String(r.author_name),
    rating: Number(r.rating),
    visit_purpose: String(r.visit_purpose || 'coffee_food'),
    wifi_confirmed:
      r.wifi_confirmed === 'yes' || r.wifi_confirmed === 'no' ? r.wifi_confirmed : 'unknown',
    sockets_confirmed:
      r.sockets_confirmed === 'yes' || r.sockets_confirmed === 'no'
        ? r.sockets_confirmed
        : 'unknown',
    noise_observed:
      r.noise_observed !== null && r.noise_observed !== undefined ? Number(r.noise_observed) : null,
    review_text: String(r.review_text || ''),
    helpful_count: Number(r.helpful_count || 0),
    moderation_status: String(r.moderation_status || 'pending'),
    created_at: Number(r.created_at),
    updated_at: Number(r.updated_at || r.created_at),
  };
}

function formatContributionRow(r: Record<string, unknown>, pricingUnlocked: boolean) {
  const type = String(r.contribution_type || 'facility_update');
  const parsedPayload = safeJson<Record<string, unknown>>(r.payload_json, {});
  return {
    id: Number(r.id),
    cafe_id: String(r.cafe_id || ''),
    cafe_key: String(r.cafe_key),
    cafe_name: String(r.cafe_name),
    user_id: Number(r.user_id),
    contributor_name: String(r.contributor_name),
    contribution_type: type,
    payload: sanitizeContributionPayload(type, parsedPayload, pricingUnlocked),
    photo_url: String(r.photo_url || ''),
    points_awarded: Number(r.points_awarded || 0),
    moderation_status: String(r.moderation_status || 'pending'),
    reviewer_note: String(r.reviewer_note || ''),
    created_at: Number(r.created_at),
    updated_at: Number(r.updated_at || r.created_at),
  };
}

function slugifyShareTitle(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  return `${base || 'cafe-list'}-${crypto.randomBytes(3).toString('hex')}`;
}

function listUserCollections(userId: number): UserCollection[] {
  const db = getDb();
  const colRows = db
    .prepare('SELECT * FROM user_collections WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as Array<Record<string, unknown>>;
  const itemStmt = db.prepare(
    'SELECT * FROM collection_items WHERE collection_id = ? ORDER BY added_at DESC'
  );
  return colRows.map((c) => {
    const colId = Number(c.id);
    const itemRows = itemStmt.all(colId) as Array<Record<string, unknown>>;
    return {
      id: colId,
      user_id: Number(c.user_id),
      name: String(c.name),
      description: String(c.description || ''),
      share_slug: String(c.share_slug || ''),
      is_public: Boolean(c.is_public),
      created_at: Number(c.created_at),
      updated_at: Number(c.updated_at || c.created_at),
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
}

export function registerCommunityRoutes(app: Express): void {
  // 1. Cafe Community Feed (approved reviews + approved contributions + caller's own pending submissions)
  app.get('/api/cafes/:slug/community', (req: Request, res: Response) => {
    const settings = getSiteSettingsFromDb();
    const reviewsEnabled = settings.feature_flags?.community_reviews !== false;
    const photosEnabled = settings.feature_flags?.community_photos !== false;

    const isAdmin = hasValidAdminSession(req);
    const caller = isAdmin ? null : resolveUserFromRequest(req, res);
    const viewer = resolveViewerAccessContext({ userId: caller?.id ?? null, isAdmin });
    const pricingUnlocked = Boolean(
      viewer.permissions.menu_pricing ||
        settings.access_control?.sections?.menu_pricing === 'public'
    );

    const target = resolveCafeTarget(String(req.params.slug || ''));
    const db = getDb();

    const approvedReviewsRaw = reviewsEnabled
      ? (db
          .prepare(
            `SELECT * FROM cafe_reviews
             WHERE (cafe_key = ? OR (? != '' AND cafe_id = ?))
               AND moderation_status = 'approved'
             ORDER BY helpful_count DESC, created_at DESC
             LIMIT 50`
          )
          .all(target.cafeKey, target.cafeId, target.cafeId) as Array<Record<string, unknown>>)
      : [];

    const myPendingReviewsRaw =
      reviewsEnabled && caller
        ? (db
            .prepare(
              `SELECT * FROM cafe_reviews
               WHERE (cafe_key = ? OR (? != '' AND cafe_id = ?))
                 AND user_id = ?
                 AND moderation_status != 'approved'
               ORDER BY created_at DESC
               LIMIT 10`
            )
            .all(target.cafeKey, target.cafeId, target.cafeId, caller.id) as Array<
            Record<string, unknown>
          >)
        : [];

    const approvedContribsRaw = db
      .prepare(
        `SELECT * FROM community_contributions
         WHERE (cafe_key = ? OR (? != '' AND cafe_id = ?))
           AND moderation_status = 'approved'
         ORDER BY created_at DESC
         LIMIT 50`
      )
      .all(target.cafeKey, target.cafeId, target.cafeId) as Array<Record<string, unknown>>;

    const myPendingContribsRaw = caller
      ? (db
          .prepare(
            `SELECT * FROM community_contributions
             WHERE (cafe_key = ? OR (? != '' AND cafe_id = ?))
               AND user_id = ?
               AND moderation_status != 'approved'
             ORDER BY created_at DESC
             LIMIT 10`
          )
          .all(target.cafeKey, target.cafeId, target.cafeId, caller.id) as Array<
          Record<string, unknown>
        >)
      : [];

    const approvedReviews = approvedReviewsRaw.map(formatReviewRow);
    const ratingSum = approvedReviews.reduce((acc, r) => acc + r.rating, 0);
    const noiseItems = approvedReviews.filter((r) => r.noise_observed !== null);
    const noiseSum = noiseItems.reduce((acc, r) => acc + (r.noise_observed || 0), 0);

    const summary = {
      count: approvedReviews.length,
      avgRating:
        approvedReviews.length > 0 ? Number((ratingSum / approvedReviews.length).toFixed(1)) : null,
      wifiYes: approvedReviews.filter((r) => r.wifi_confirmed === 'yes').length,
      wifiNo: approvedReviews.filter((r) => r.wifi_confirmed === 'no').length,
      socketsYes: approvedReviews.filter((r) => r.sockets_confirmed === 'yes').length,
      socketsNo: approvedReviews.filter((r) => r.sockets_confirmed === 'no').length,
      avgNoise:
        noiseItems.length > 0 ? Number((noiseSum / noiseItems.length).toFixed(1)) : null,
    };

    const filterPhotoDisabled = (item: ReturnType<typeof formatContributionRow>) =>
      photosEnabled || item.contribution_type !== 'photo';

    res.json({
      reviewsEnabled,
      photosEnabled,
      pricingUnlocked,
      summary,
      reviews: approvedReviews,
      myPendingReviews: myPendingReviewsRaw.map(formatReviewRow),
      contributions: approvedContribsRaw
        .map((r) => formatContributionRow(r, pricingUnlocked))
        .filter(filterPhotoDisabled),
      myPendingContributions: myPendingContribsRaw
        .map((r) => formatContributionRow(r, pricingUnlocked))
        .filter(filterPhotoDisabled),
    });
  });

  // 2. Submit Cafe Review (Authenticated + Duplicate/Spam Protection + Points)
  app.post('/api/cafes/:slug/reviews', requireUserAuth, (req: Request, res: Response) => {
    const settings = getSiteSettingsFromDb();
    if (settings.feature_flags?.community_reviews === false) {
      res.status(403).json({ error: 'Community reviews are currently disabled by admin.' });
      return;
    }

    const user = req.user!;
    const ip = getClientIp(req);
    const userLimit = checkRateLimit(`review-user:${user.id}`, 5, 15 * 60 * 1000);
    if (!userLimit.allowed) {
      res.status(429).json({
        error: `Please wait ${userLimit.retryAfterSec}s before submitting another review.`,
      });
      return;
    }
    const ipLimit = checkRateLimit(`review-ip:${ip}`, 10, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      res.status(429).json({
        error: `Too many review submissions from this network. Retry in ${ipLimit.retryAfterSec}s.`,
      });
      return;
    }

    const target = resolveCafeTarget(String(req.params.slug || ''));
    const rating = Math.round(Number(req.body?.rating));
    const allowedPurposes = new Set(['work', 'study', 'coffee_food', 'family', 'meetup']);
    const visitPurpose = allowedPurposes.has(String(req.body?.visitPurpose || ''))
      ? String(req.body.visitPurpose)
      : 'coffee_food';
    const wifiConfirmed =
      req.body?.wifiConfirmed === 'yes' || req.body?.wifiConfirmed === 'no'
        ? req.body.wifiConfirmed
        : 'unknown';
    const socketsConfirmed =
      req.body?.socketsConfirmed === 'yes' || req.body?.socketsConfirmed === 'no'
        ? req.body.socketsConfirmed
        : 'unknown';
    const rawNoise = req.body?.noiseObserved;
    const noiseObserved =
      rawNoise === null || rawNoise === undefined || rawNoise === ''
        ? null
        : Math.min(5, Math.max(1, Math.round(Number(rawNoise))));
    const reviewText = cleanStr(req.body?.reviewText, 1200);
    const cafeName = cleanStr(req.body?.cafeName, 140) || target.cafeName;

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Please choose a rating between 1 and 5 stars.' });
      return;
    }
    if (reviewText.length < 15) {
      res.status(400).json({
        error: 'Please write at least 15 characters describing your genuine cafe visit.',
      });
      return;
    }

    const normalizedForHash = reviewText.toLowerCase().replace(/\s+/g, ' ');
    const contentHash = sha256(`${user.id}|${target.cafeKey}|${normalizedForHash}`);
    const db = getDb();
    const now = Date.now();

    const dupRow = db
      .prepare(
        `SELECT id FROM cafe_reviews
         WHERE user_id = ? AND (content_hash = ? OR (cafe_key = ? AND created_at > ?))
         LIMIT 1`
      )
      .get(user.id, contentHash, target.cafeKey, now - 30 * 60 * 1000);
    if (dupRow) {
      res.status(409).json({
        error: 'You already submitted a review for this cafe recently.',
      });
      return;
    }

    recordRateAttempt(`review-user:${user.id}`, 15 * 60 * 1000);
    recordRateAttempt(`review-ip:${ip}`, 15 * 60 * 1000);

    const inserted = db
      .prepare(
        `INSERT INTO cafe_reviews
         (cafe_id, cafe_key, cafe_name, user_id, author_name, rating, visit_purpose, wifi_confirmed, sockets_confirmed, noise_observed, review_text, helpful_count, moderation_status, content_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?)`
      )
      .run(
        target.cafeId,
        target.cafeKey,
        cafeName,
        user.id,
        user.name,
        rating,
        visitPurpose,
        wifiConfirmed,
        socketsConfirmed,
        Number.isFinite(noiseObserved as number) ? noiseObserved : null,
        reviewText,
        contentHash,
        now,
        now
      );

    const reviewId = Number(inserted.lastInsertRowid);
    db.prepare(
      `INSERT INTO user_points_ledger (user_id, points, reason, reference_type, reference_id, created_at)
       VALUES (?, ?, ?, 'cafe_review', ?, ?)`
    ).run(user.id, 15, `Submitted review for ${cafeName}`, String(reviewId), now);

    const created = db.prepare('SELECT * FROM cafe_reviews WHERE id = ?').get(reviewId) as Record<
      string,
      unknown
    >;

    res.status(201).json({
      ok: true,
      review: formatReviewRow(created),
      pointsAwarded: 15,
      message: 'Review submitted for CafeDesk moderation (+15 contributor points awarded).',
    });
  });

  // 3. Mark Review Helpful
  app.post('/api/reviews/:id/helpful', requireUserAuth, (req: Request, res: Response) => {
    const reviewId = Number(req.params.id);
    if (!Number.isFinite(reviewId) || reviewId <= 0) {
      res.status(400).json({ error: 'Invalid review ID.' });
      return;
    }
    const key = `helpful:${req.user!.id}:${reviewId}`;
    const voteLimit = checkRateLimit(key, 1, 24 * 60 * 60 * 1000);
    if (!voteLimit.allowed) {
      res.status(409).json({ error: 'You already marked this review as helpful.' });
      return;
    }

    const db = getDb();
    const row = db
      .prepare("SELECT id, helpful_count FROM cafe_reviews WHERE id = ? AND moderation_status = 'approved'")
      .get(reviewId) as { id: number; helpful_count: number } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Approved review not found.' });
      return;
    }

    recordRateAttempt(key, 24 * 60 * 60 * 1000);
    const nextCount = Number(row.helpful_count || 0) + 1;
    db.prepare('UPDATE cafe_reviews SET helpful_count = ?, updated_at = ? WHERE id = ?').run(
      nextCount,
      Date.now(),
      reviewId
    );
    res.json({ ok: true, id: reviewId, helpful_count: nextCount });
  });

  // 4. Community Photo, Menu Price, or Facility Update Submission
  app.post('/api/cafes/:slug/contributions', requireUserAuth, (req: Request, res: Response) => {
    const settings = getSiteSettingsFromDb();
    const flags = settings.feature_flags || {};
    const user = req.user!;
    const ip = getClientIp(req);
    const rate = checkRateLimit(`contrib-user:${user.id}`, 6, 15 * 60 * 1000);
    if (!rate.allowed) {
      res.status(429).json({
        error: `Please wait ${rate.retryAfterSec}s before sending another update.`,
      });
      return;
    }

    const contributionType = cleanStr(req.body?.contributionType, 32);
    if (
      contributionType !== 'photo' &&
      contributionType !== 'menu_price' &&
      contributionType !== 'facility_update'
    ) {
      res.status(400).json({ error: 'Invalid contribution type.' });
      return;
    }
    if (contributionType === 'photo' && settings.feature_flags?.community_photos === false) {
      res.status(403).json({ error: 'Community photo uploads are currently disabled.' });
      return;
    }

    const target = resolveCafeTarget(String(req.params.slug || ''));
    const cafeName = cleanStr(req.body?.cafeName, 140) || target.cafeName;
    const db = getDb();
    const now = Date.now();

    let payloadObj: Record<string, unknown> = {};
    let photoUrl = '';
    let hashSource = '';

    if (contributionType === 'photo') {
      const photoDataUrl = String(req.body?.photoDataUrl || '');
      const caption = cleanStr(req.body?.caption, 140);
      const areaCategory = cleanStr(req.body?.category, 32) || 'interior';
      const parsed = parseAndValidateCommunityImage(photoDataUrl);
      if (parsed.error || !parsed.buffer || !parsed.ext) {
        res.status(400).json({ error: parsed.error || 'Invalid image upload.' });
        return;
      }
      const uploadsDir = path.resolve(getUploadsDir());
      const filename = `community-${now}-${crypto.randomBytes(6).toString('hex')}.${parsed.ext}`;
      const resolvedPath = path.resolve(uploadsDir, filename);
      if (!resolvedPath.startsWith(uploadsDir + path.sep)) {
        res.status(400).json({ error: 'Invalid upload destination.' });
        return;
      }
      fs.writeFileSync(resolvedPath, parsed.buffer);
      photoUrl = `/uploads/${filename}`;
      payloadObj = { caption, category: areaCategory };
      hashSource = `photo|${sha256(parsed.buffer.toString('base64').slice(0, 512))}`;
    } else if (contributionType === 'menu_price') {
      const itemName = cleanStr(req.body?.itemName, 80);
      const category = cleanStr(req.body?.category, 32) || 'Coffee';
      const priceInr = Math.round(Number(req.body?.priceInr));
      const sourceNote = cleanStr(req.body?.sourceNote, 120);
      if (itemName.length < 2) {
        res.status(400).json({ error: 'Please enter a valid menu item name.' });
        return;
      }
      if (!Number.isFinite(priceInr) || priceInr < 5 || priceInr > 15000) {
        res.status(400).json({ error: 'Please enter a valid item price in INR (₹5–₹15,000).' });
        return;
      }
      payloadObj = { itemName, category, priceInr, sourceNote };
      hashSource = `menu|${itemName.toLowerCase()}|${priceInr}`;
    } else {
      const allowedFields = new Set([
        'wifi_available',
        'wifi_mbps',
        'charging_sockets',
        'sockets_count',
        'noise_level',
        'family_friendly',
        'timings',
        'seating_info',
      ]);
      const field = cleanStr(req.body?.field, 40);
      const proposedValue = cleanStr(req.body?.proposedValue, 140);
      const note = cleanStr(req.body?.note, 220);
      if (!allowedFields.has(field)) {
        res.status(400).json({ error: 'Please select a valid facility field to update.' });
        return;
      }
      if (!proposedValue) {
        res.status(400).json({ error: 'Please enter the verified value you observed.' });
        return;
      }
      payloadObj = { field, proposedValue, note };
      hashSource = `facility|${field}|${proposedValue.toLowerCase()}`;
    }

    const contentHash = sha256(`${user.id}|${target.cafeKey}|${hashSource}`);
    const recentDup = db
      .prepare(
        `SELECT id FROM community_contributions
         WHERE user_id = ? AND content_hash = ? AND created_at > ? LIMIT 1`
      )
      .get(user.id, contentHash, now - 24 * 60 * 60 * 1000);
    if (recentDup) {
      res.status(409).json({
        error: 'You already submitted this exact update in the last 24 hours.',
      });
      return;
    }

    recordRateAttempt(`contrib-user:${user.id}`, 15 * 60 * 1000);
    recordRateAttempt(`contrib-ip:${ip}`, 15 * 60 * 1000);

    const inserted = db
      .prepare(
        `INSERT INTO community_contributions
         (cafe_id, cafe_key, cafe_name, user_id, contributor_name, contribution_type, payload_json, photo_url, points_awarded, moderation_status, reviewer_note, content_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 5, 'pending', '', ?, ?, ?)`
      )
      .run(
        target.cafeId,
        target.cafeKey,
        cafeName,
        user.id,
        user.name,
        contributionType,
        JSON.stringify(payloadObj),
        photoUrl,
        contentHash,
        now,
        now
      );

    const contribId = Number(inserted.lastInsertRowid);
    db.prepare(
      `INSERT INTO user_points_ledger (user_id, points, reason, reference_type, reference_id, created_at)
       VALUES (?, 5, ?, 'contribution', ?, ?)`
    ).run(
      user.id,
      `Submitted ${contributionType.replace('_', ' ')} for ${cafeName}`,
      String(contribId),
      now
    );

    const created = db
      .prepare('SELECT * FROM community_contributions WHERE id = ?')
      .get(contribId) as Record<string, unknown>;

    const viewer = resolveViewerAccessContext({ userId: user.id, isAdmin: false });
    res.status(201).json({
      ok: true,
      contribution: formatContributionRow(created, Boolean(viewer.permissions.menu_pricing)),
      pointsAwarded: 5,
      message:
        'Thank you! Submitted for CafeDesk moderation (+5 pts now, +20 bonus pts upon approval).',
    });
  });

  // 5. Visit Companion Checklist Sync
  app.get('/api/user/checklist/:cafeKey', requireUserAuth, (req: Request, res: Response) => {
    const settings = getSiteSettingsFromDb();
    if (settings.feature_flags?.visit_companion === false) {
      res.json({ checklist: null, disabled: true });
      return;
    }
    const cafeKey = cleanStr(decodeURIComponent(String(req.params.cafeKey || '')), 160);
    const row = getDb()
      .prepare('SELECT * FROM user_visit_checklists WHERE user_id = ? AND cafe_key = ?')
      .get(req.user!.id, cafeKey) as Record<string, unknown> | undefined;

    if (!row) {
      res.json({ checklist: null });
      return;
    }
    const parsed = safeJson<{
      hours?: boolean;
      budget?: boolean;
      workspace?: boolean;
      route?: boolean;
      note?: string;
    }>(row.checklist_json, {});
    res.json({
      checklist: {
        hours: Boolean(parsed.hours),
        budget: Boolean(parsed.budget),
        workspace: Boolean(parsed.workspace),
        route: Boolean(parsed.route),
        note: typeof parsed.note === 'string' ? parsed.note : '',
        feedback_submitted: Boolean(row.feedback_submitted),
        visited_at: row.visited_at ? Number(row.visited_at) : null,
        updated_at: Number(row.updated_at || Date.now()),
      },
    });
  });

  app.put('/api/user/checklist/:cafeKey', requireUserAuth, (req: Request, res: Response) => {
    const settings = getSiteSettingsFromDb();
    if (settings.feature_flags?.visit_companion === false) {
      res.status(403).json({ error: 'Visit Companion is currently disabled.' });
      return;
    }
    const cafeKey = cleanStr(decodeURIComponent(String(req.params.cafeKey || '')), 160);
    if (!cafeKey) {
      res.status(400).json({ error: 'Cafe key is required.' });
      return;
    }

    const checklistPayload = {
      hours: Boolean(req.body?.hours),
      budget: Boolean(req.body?.budget),
      workspace: Boolean(req.body?.workspace),
      route: Boolean(req.body?.route),
      note: cleanStr(req.body?.note, 280),
    };
    const feedbackSubmitted = Boolean(req.body?.feedbackSubmitted);
    const now = Date.now();

    getDb()
      .prepare(
        `INSERT INTO user_visit_checklists (user_id, cafe_key, checklist_json, feedback_submitted, visited_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, cafe_key) DO UPDATE SET
           checklist_json = excluded.checklist_json,
           feedback_submitted = CASE WHEN excluded.feedback_submitted = 1 THEN 1 ELSE user_visit_checklists.feedback_submitted END,
           visited_at = COALESCE(user_visit_checklists.visited_at, excluded.visited_at),
           updated_at = excluded.updated_at`
      )
      .run(
        req.user!.id,
        cafeKey,
        JSON.stringify(checklistPayload),
        feedbackSubmitted ? 1 : 0,
        now,
        now
      );

    res.json({
      ok: true,
      checklist: {
        ...checklistPayload,
        feedback_submitted: feedbackSubmitted,
        updated_at: now,
      },
    });
  });

  // 6. Contributor Points Ledger & Badges
  app.get('/api/user/points', requireUserAuth, (req: Request, res: Response) => {
    const userId = req.user!.id;
    const db = getDb();

    const totalRow = db
      .prepare('SELECT COALESCE(SUM(points), 0) AS total FROM user_points_ledger WHERE user_id = ?')
      .get(userId) as { total: number };
    const totalPoints = Number(totalRow?.total || 0);

    const ledger = db
      .prepare(
        'SELECT id, points, reason, reference_type, reference_id, created_at FROM user_points_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 25'
      )
      .all(userId) as Array<{
      id: number;
      points: number;
      reason: string;
      reference_type: string;
      reference_id: string;
      created_at: number;
    }>;

    const reviewsCount = Number(
      (
        db
          .prepare('SELECT COUNT(*) AS cnt FROM cafe_reviews WHERE user_id = ?')
          .get(userId) as { cnt: number }
      ).cnt || 0
    );
    const approvedReviewsCount = Number(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS cnt FROM cafe_reviews WHERE user_id = ? AND moderation_status = 'approved'"
          )
          .get(userId) as { cnt: number }
      ).cnt || 0
    );
    const menuContribsCount = Number(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS cnt FROM community_contributions WHERE user_id = ? AND contribution_type = 'menu_price'"
          )
          .get(userId) as { cnt: number }
      ).cnt || 0
    );
    const fieldContribsCount = Number(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS cnt FROM community_contributions WHERE user_id = ? AND contribution_type IN ('photo', 'facility_update')"
          )
          .get(userId) as { cnt: number }
      ).cnt || 0
    );
    const correctionsCount = Number(
      (
        db
          .prepare('SELECT COUNT(*) AS cnt FROM community_corrections WHERE user_id = ?')
          .get(userId) as { cnt: number }
      ).cnt || 0
    );

    const earnedBadges = [
      {
        id: 'helper',
        title: 'Helper',
        description: 'Submit your first cafe review, photo, or accuracy correction.',
        unlocked: reviewsCount + fieldContribsCount + correctionsCount >= 1 || totalPoints >= 10,
      },
      {
        id: 'menu_scout',
        title: 'Menu Scout',
        description: 'Help verify Bengaluru tea, coffee, or snack prices for the community.',
        unlocked: menuContribsCount >= 1,
      },
      {
        id: 'field_verifier',
        title: 'Field Verifier',
        description: 'Contribute 2+ reviews, facility checks, or cafe photographs.',
        unlocked: reviewsCount + fieldContribsCount >= 2,
      },
      {
        id: 'top_contributor',
        title: 'Top Contributor',
        description: 'Reach 100+ CafeDesk community trust points.',
        unlocked: totalPoints >= 100,
      },
    ];

    res.json({
      totalPoints,
      ledger,
      stats: {
        reviewsCount,
        approvedReviewsCount,
        menuContribsCount,
        fieldContribsCount,
        correctionsCount,
      },
      earnedBadges,
    });
  });

  // 7. Toggle Shareable Public Link on a Personal Collection
  app.put('/api/user/collections/:id/share', requireUserAuth, (req: Request, res: Response) => {
    const settings = getSiteSettingsFromDb();
    if (settings.feature_flags?.public_collections === false) {
      res.status(403).json({ error: 'Public shareable collections are currently disabled.' });
      return;
    }

    const sub = getUserEffectiveSubscription(req.user!.id);
    if (!sub.effective_active || !sub.permissions?.collections) {
      res.status(403).json({
        error: sub.expired
          ? 'Your subscription has expired. Renew your plan to share collections.'
          : 'Shareable collections require an active Cafe Desk Plus subscription.',
        requiredPlan: 'plus',
      });
      return;
    }

    const colId = Number(req.params.id);
    if (!Number.isFinite(colId) || colId <= 0) {
      res.status(400).json({ error: 'Invalid collection ID.' });
      return;
    }

    const db = getDb();
    const row = db
      .prepare('SELECT id, name, share_slug, is_public FROM user_collections WHERE id = ? AND user_id = ?')
      .get(colId, req.user!.id) as
      | { id: number; name: string; share_slug: string; is_public: number }
      | undefined;

    if (!row) {
      res.status(404).json({ error: 'Collection not found.' });
      return;
    }

    const makePublic = Boolean(req.body?.isPublic);
    let shareSlug = String(row.share_slug || '').trim();
    if (makePublic && !shareSlug) {
      shareSlug = slugifyShareTitle(row.name);
    }

    const now = Date.now();
    db.prepare(
      'UPDATE user_collections SET is_public = ?, share_slug = ?, updated_at = ? WHERE id = ? AND user_id = ?'
    ).run(makePublic ? 1 : 0, shareSlug, now, colId, req.user!.id);

    const updatedCollections = listUserCollections(req.user!.id);
    const updatedCollection = updatedCollections.find((c) => c.id === colId) || null;
    res.json({
      ok: true,
      collection: updatedCollection,
      collections: updatedCollections,
    });
  });

  // 8. Public Shared Collection Endpoint (Strictly Redacts Menu Prices for Free/Anonymous Viewers)
  app.get('/api/collections/:slug', (req: Request, res: Response) => {
    const settings = getSiteSettingsFromDb();
    if (settings.feature_flags?.public_collections === false) {
      res.status(404).json({ error: 'Public collections are disabled.' });
      return;
    }

    const slug = cleanStr(req.params.slug, 96);
    if (!slug) {
      res.status(404).json({ error: 'Collection not found.' });
      return;
    }

    const db = getDb();
    const row = db
      .prepare(
        `SELECT uc.id, uc.name, uc.description, uc.share_slug, uc.is_public, uc.created_at, uc.updated_at, u.name AS owner_name
         FROM user_collections uc
         JOIN users u ON u.id = uc.user_id
         WHERE uc.share_slug = ? AND uc.is_public = 1
         LIMIT 1`
      )
      .get(slug) as
      | {
          id: number;
          name: string;
          description: string;
          share_slug: string;
          is_public: number;
          created_at: number;
          updated_at: number;
          owner_name: string;
        }
      | undefined;

    if (!row) {
      res.status(404).json({ error: 'Shared cafe collection was not found or made private.' });
      return;
    }

    const isAdmin = hasValidAdminSession(req);
    const caller = isAdmin ? null : resolveUserFromRequest(req, res);
    const viewer = resolveViewerAccessContext({ userId: caller?.id ?? null, isAdmin });
    const pricingUnlocked = Boolean(
      viewer.permissions.menu_pricing ||
        settings.access_control?.sections?.menu_pricing === 'public'
    );

    const itemRows = db
      .prepare('SELECT cafe_key, cafe_snapshot_json, added_at FROM collection_items WHERE collection_id = ? ORDER BY added_at DESC')
      .all(row.id) as Array<{ cafe_key: string; cafe_snapshot_json: string; added_at: number }>;

    const items = itemRows.map((ir) => {
      const snap = safeJson<CafeLibrarySnapshot>(ir.cafe_snapshot_json, {
        key: String(ir.cafe_key),
        source: 'curated',
        name: 'Cafe',
        area: 'Bengaluru',
        address: '',
        map_link: 'https://maps.google.com/?q=Bengaluru',
      });
      return {
        cafe_key: String(ir.cafe_key),
        added_at: Number(ir.added_at),
        snapshot: pricingUnlocked
          ? snap
          : {
              ...snap,
              avg_cost_per_person: null,
            },
      };
    });

    const ownerFirstName = cleanStr(String(row.owner_name || 'Explorer').split(/\s+/)[0], 32) || 'Explorer';
    res.json({
      collection: {
        name: String(row.name),
        description: String(row.description || ''),
        share_slug: String(row.share_slug),
        ownerFirstName,
        created_at: Number(row.created_at),
        updated_at: Number(row.updated_at || row.created_at),
        pricingUnlocked,
        items,
      },
    });
  });
}

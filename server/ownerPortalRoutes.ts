import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import {
  checkRateLimit,
  recordRateAttempt,
  requireUserAuth,
} from './auth.ts';
import { getDb, getSiteSettingsFromDb, getUploadsDir } from './db.ts';

function cleanStr(val: unknown, maxLen: number): string {
  return String(val ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanSafeHttpUrl(val: unknown, maxLen: number): string {
  const s = cleanStr(val, maxLen);
  if (!s) return '';
  try {
    const parsed = new URL(s);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.toString().slice(0, maxLen);
  } catch {
    // Reject non-URL / javascript: payloads
  }
  return '';
}

function safeJson<T>(raw: unknown, fallback: T): T {
  try {
    if (typeof raw !== 'string' || !raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseAndValidateOwnerImage(dataUrl: string): {
  error?: string;
  buffer?: Buffer;
  ext?: string;
} {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return { error: 'Only PNG, JPEG, or WebP images are allowed.' };
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
    return { error: 'File contents do not match declared image format.' };
  }
  return {
    buffer,
    ext: mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg',
  };
}

function userOwnsCafe(userId: number, cafeId: string): boolean {
  const db = getDb();
  const direct = db
    .prepare('SELECT id, claimed_by_owner_id FROM cafes WHERE id = ? LIMIT 1')
    .get(cafeId) as { id: string; claimed_by_owner_id: number | null } | undefined;
  if (!direct) return false;
  if (Number(direct.claimed_by_owner_id) === userId) return true;
  const approvedClaim = db
    .prepare(
      "SELECT id FROM cafe_claim_requests WHERE cafe_id = ? AND user_id = ? AND status = 'approved' LIMIT 1"
    )
    .get(cafeId, userId);
  return Boolean(approvedClaim);
}

export function registerOwnerPortalRoutes(app: Express): void {
  // 1. Partner Portal Dashboard Payload
  app.get('/api/owner/portal', requireUserAuth, (req: Request, res: Response) => {
    const settings = getSiteSettingsFromDb();
    if (settings.feature_flags?.owner_portal === false) {
      res.status(403).json({ error: 'Cafe Owner Partner Portal is currently disabled by admin.' });
      return;
    }

    const userId = req.user!.id;
    const db = getDb();

    const ownerProfile = db
      .prepare('SELECT * FROM cafe_owners WHERE user_id = ? LIMIT 1')
      .get(userId) as Record<string, unknown> | undefined;

    const claimRows = db
      .prepare('SELECT * FROM cafe_claim_requests WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as Array<Record<string, unknown>>;

    const claimedIds = new Set<string>();
    const ownedCafesRaw = db
      .prepare(
        `SELECT id, slug, name, area, address, timings, phone, website_url, menu_url, instagram_url,
                wifi_available, wifi_mbps, charging_sockets, sockets_count, avg_cost_per_person,
                coffee_price, tea_price, snacks_price, desserts_price, meals_price, offers_json,
                photos_json, verified, owner_verified, last_verified_date
         FROM cafes
         WHERE claimed_by_owner_id = ? AND published = 1`
      )
      .all(userId) as Array<Record<string, unknown>>;
    ownedCafesRaw.forEach((c) => claimedIds.add(String(c.id)));

    const approvedClaimCafes = claimRows
      .filter((c) => c.status === 'approved' && !claimedIds.has(String(c.cafe_id)))
      .map((c) =>
        db
          .prepare(
            `SELECT id, slug, name, area, address, timings, phone, website_url, menu_url, instagram_url,
                    wifi_available, wifi_mbps, charging_sockets, sockets_count, avg_cost_per_person,
                    coffee_price, tea_price, snacks_price, desserts_price, meals_price, offers_json,
                    photos_json, verified, owner_verified, last_verified_date
             FROM cafes WHERE id = ? AND published = 1`
          )
          .get(String(c.cafe_id)) as Record<string, unknown> | undefined
      )
      .filter((x): x is Record<string, unknown> => Boolean(x));

    const allOwnedCafes = [...ownedCafesRaw, ...approvedClaimCafes].map((c) => {
      const cafeId = String(c.id);
      const cafeKey = String(c.slug || c.id);
      const savesCount = Number(
        (
          db
            .prepare('SELECT COUNT(*) AS cnt FROM saved_cafes WHERE cafe_key = ? OR cafe_key = ?')
            .get(cafeKey, cafeId) as { cnt: number }
        ).cnt || 0
      );
      const followersCount = Number(
        (
          db
            .prepare('SELECT COUNT(*) AS cnt FROM cafe_follows WHERE cafe_key = ? OR cafe_key = ?')
            .get(cafeKey, cafeId) as { cnt: number }
        ).cnt || 0
      );
      const reviewsCount = Number(
        (
          db
            .prepare(
              "SELECT COUNT(*) AS cnt FROM cafe_reviews WHERE (cafe_id = ? OR cafe_key = ?) AND moderation_status = 'approved'"
            )
            .get(cafeId, cafeKey) as { cnt: number }
        ).cnt || 0
      );
      const bookingsCount = Number(
        (
          db
            .prepare('SELECT COUNT(*) AS cnt FROM bookings WHERE cafe_id = ?')
            .get(cafeId) as { cnt: number }
        ).cnt || 0
      );

      return {
        id: cafeId,
        slug: cafeKey,
        name: String(c.name),
        area: String(c.area),
        address: String(c.address),
        timings: String(c.timings),
        phone: String(c.phone || ''),
        website_url: String(c.website_url || ''),
        menu_url: String(c.menu_url || ''),
        instagram_url: String(c.instagram_url || ''),
        wifi_available: String(c.wifi_available || 'unknown'),
        wifi_mbps: c.wifi_mbps !== null ? Number(c.wifi_mbps) : null,
        charging_sockets: String(c.charging_sockets || 'unknown'),
        sockets_count: c.sockets_count !== null ? Number(c.sockets_count) : null,
        avg_cost_per_person: c.avg_cost_per_person !== null ? Number(c.avg_cost_per_person) : null,
        coffee_price: c.coffee_price ? String(c.coffee_price) : '',
        tea_price: c.tea_price ? String(c.tea_price) : '',
        snacks_price: c.snacks_price ? String(c.snacks_price) : '',
        desserts_price: c.desserts_price ? String(c.desserts_price) : '',
        meals_price: c.meals_price ? String(c.meals_price) : '',
        offers: safeJson<string[]>(c.offers_json, []),
        photos: safeJson<string[]>(c.photos_json, []),
        verified: Boolean(c.verified),
        owner_verified: Boolean(c.owner_verified),
        last_verified_date: c.last_verified_date ? String(c.last_verified_date) : '',
        engagement: {
          savesCount,
          followersCount,
          reviewsCount,
          bookingsCount,
        },
      };
    });

    const changeRequests = db
      .prepare(
        `SELECT ocr.*, c.name AS cafe_name
         FROM owner_change_requests ocr
         LEFT JOIN cafes c ON c.id = ocr.cafe_id
         WHERE ocr.user_id = ?
         ORDER BY ocr.created_at DESC
         LIMIT 40`
      )
      .all(userId) as Array<Record<string, unknown>>;

    const promotions = db
      .prepare('SELECT * FROM cafe_promotions WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT 30')
      .all(userId) as Array<Record<string, unknown>>;

    const directoryOptions = db
      .prepare(
        'SELECT id, slug, name, area, claimed_by_owner_id, owner_verified FROM cafes WHERE published = 1 ORDER BY name ASC'
      )
      .all() as Array<{
      id: string;
      slug: string | null;
      name: string;
      area: string;
      claimed_by_owner_id: number | null;
      owner_verified: number;
    }>;

    res.json({
      promotionsEnabled: settings.feature_flags?.promotions !== false,
      ownerProfile: ownerProfile
        ? {
            id: Number(ownerProfile.id),
            user_id: Number(ownerProfile.user_id),
            business_name: String(ownerProfile.business_name || ''),
            owner_name: String(ownerProfile.owner_name || ''),
            phone: String(ownerProfile.phone || ''),
            email: String(ownerProfile.email || ''),
            plan_tier: String(ownerProfile.plan_tier || 'free'),
            status: String(ownerProfile.status || 'active'),
          }
        : {
            id: 0,
            user_id: userId,
            business_name: '',
            owner_name: req.user!.name,
            phone: '',
            email: req.user!.email,
            plan_tier: 'free',
            status: 'active',
          },
      ownedCafes: allOwnedCafes,
      claims: claimRows.map((c) => ({
        id: Number(c.id),
        cafe_id: String(c.cafe_id),
        cafe_name: String(c.cafe_name),
        user_id: Number(c.user_id),
        owner_name: String(c.owner_name),
        phone: String(c.phone || ''),
        email: String(c.email || ''),
        verification_proof: String(c.verification_proof || ''),
        notes: String(c.notes || ''),
        status: String(c.status || 'pending'),
        admin_note: String(c.admin_note || ''),
        created_at: Number(c.created_at),
        reviewed_at: c.reviewed_at ? Number(c.reviewed_at) : null,
      })),
      changeRequests: changeRequests.map((r) => ({
        id: Number(r.id),
        cafe_id: String(r.cafe_id),
        cafe_name: String(r.cafe_name || ''),
        user_id: Number(r.user_id),
        change_type: String(r.change_type),
        payload: safeJson<Record<string, unknown>>(r.payload_json, {}),
        summary: String(r.summary || ''),
        status: String(r.status || 'pending'),
        admin_note: String(r.admin_note || ''),
        created_at: Number(r.created_at),
        reviewed_at: r.reviewed_at ? Number(r.reviewed_at) : null,
      })),
      promotions: promotions.map((p) => ({
        id: Number(p.id),
        cafe_id: String(p.cafe_id),
        cafe_name: String(p.cafe_name),
        owner_user_id: Number(p.owner_user_id),
        title: String(p.title),
        badge_label: String(p.badge_label || 'Sponsored'),
        placement: String(p.placement || 'homepage'),
        area: String(p.area || ''),
        budget_inr: Number(p.budget_inr || 0),
        starts_at: Number(p.starts_at),
        ends_at: Number(p.ends_at),
        status: String(p.status || 'pending'),
        created_at: Number(p.created_at),
      })),
      directoryOptions: directoryOptions.map((d) => ({
        id: d.id,
        slug: d.slug || d.id,
        name: d.name,
        area: d.area,
        isClaimed: Boolean(d.claimed_by_owner_id),
        claimedByYou: Number(d.claimed_by_owner_id) === userId,
      })),
    });
  });

  // 2. Update Owner Profile
  app.put('/api/owner/profile', requireUserAuth, (req: Request, res: Response) => {
    const businessName = cleanStr(req.body?.businessName, 120);
    const ownerName = cleanStr(req.body?.ownerName, 80) || req.user!.name;
    const phone = cleanStr(req.body?.phone, 24);
    const email = cleanStr(req.body?.email, 120) || req.user!.email;
    const now = Date.now();

    getDb()
      .prepare(
        `INSERT INTO cafe_owners (user_id, business_name, owner_name, phone, email, plan_tier, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'free', 'active', ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           business_name = excluded.business_name,
           owner_name = excluded.owner_name,
           phone = excluded.phone,
           email = excluded.email,
           updated_at = excluded.updated_at`
      )
      .run(req.user!.id, businessName, ownerName, phone, email, now, now);

    res.json({ ok: true });
  });

  // 3. Submit Cafe Ownership Claim Request
  app.post('/api/owner/claims', requireUserAuth, (req: Request, res: Response) => {
    const settings = getSiteSettingsFromDb();
    if (settings.feature_flags?.owner_portal === false) {
      res.status(403).json({ error: 'Owner portal is currently disabled.' });
      return;
    }

    const userId = req.user!.id;
    const limit = checkRateLimit(`owner-claim:${userId}`, 5, 24 * 60 * 60 * 1000);
    if (!limit.allowed) {
      res.status(429).json({ error: 'Too many claim requests today. Please wait for review.' });
      return;
    }

    const cafeId = cleanStr(req.body?.cafeId, 120);
    const ownerName = cleanStr(req.body?.ownerName, 80) || req.user!.name;
    const phone = cleanStr(req.body?.phone, 24);
    const email = cleanStr(req.body?.email, 120) || req.user!.email;
    const verificationProof = cleanStr(req.body?.verificationProof, 300);
    const notes = cleanStr(req.body?.notes, 400);

    if (!cafeId || !phone || !verificationProof) {
      res.status(400).json({
        error: 'Cafe selection, contact phone number, and ownership verification proof are required.',
      });
      return;
    }

    const db = getDb();
    const cafeRow = db
      .prepare('SELECT id, name, claimed_by_owner_id FROM cafes WHERE id = ? LIMIT 1')
      .get(cafeId) as
      | { id: string; name: string; claimed_by_owner_id: number | null }
      | undefined;

    if (!cafeRow) {
      res.status(404).json({ error: 'Selected cafe was not found in our directory.' });
      return;
    }
    if (cafeRow.claimed_by_owner_id && Number(cafeRow.claimed_by_owner_id) !== userId) {
      res.status(409).json({
        error: 'This cafe listing has already been claimed and verified by another owner.',
      });
      return;
    }

    const dupPending = db
      .prepare(
        "SELECT id FROM cafe_claim_requests WHERE cafe_id = ? AND user_id = ? AND status = 'pending' LIMIT 1"
      )
      .get(cafeId, userId);
    if (dupPending) {
      res.status(409).json({
        error: 'You already have a pending ownership claim for this cafe.',
      });
      return;
    }

    recordRateAttempt(`owner-claim:${userId}`, 24 * 60 * 60 * 1000);
    const now = Date.now();

    db.prepare(
      `INSERT INTO cafe_owners (user_id, business_name, owner_name, phone, email, plan_tier, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'free', 'active', ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         owner_name = excluded.owner_name,
         phone = CASE WHEN excluded.phone != '' THEN excluded.phone ELSE cafe_owners.phone END,
         updated_at = excluded.updated_at`
    ).run(userId, cafeRow.name, ownerName, phone, email, now, now);

    db.prepare(
      `INSERT INTO cafe_claim_requests
       (cafe_id, cafe_name, user_id, owner_name, phone, email, verification_proof, notes, status, admin_note, created_at, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', ?, NULL)`
    ).run(cafeRow.id, cafeRow.name, userId, ownerName, phone, email, verificationProof, notes, now);

    res.status(201).json({
      ok: true,
      message: `Ownership claim for ${cafeRow.name} submitted for admin verification.`,
    });
  });

  // 4. Submit Moderated Cafe Change Request (Business Info, Menu & Prices, Offers, Photos)
  app.post(
    '/api/owner/listings/:cafeId/request-change',
    requireUserAuth,
    (req: Request, res: Response) => {
      const settings = getSiteSettingsFromDb();
      if (settings.feature_flags?.owner_portal === false) {
        res.status(403).json({ error: 'Owner portal is currently disabled.' });
        return;
      }

      const userId = req.user!.id;
      const cafeId = cleanStr(req.params.cafeId, 120);
      if (!userOwnsCafe(userId, cafeId)) {
        res.status(403).json({
          error: 'Only approved verified owners of this cafe can submit listing updates.',
        });
        return;
      }

      const limit = checkRateLimit(`owner-edit:${userId}`, 15, 60 * 60 * 1000);
      if (!limit.allowed) {
        res.status(429).json({ error: 'Rate limit reached for listing updates. Please wait.' });
        return;
      }

      const changeType = cleanStr(req.body?.changeType, 32);
      if (
        changeType !== 'cafe_info' &&
        changeType !== 'menu_update' &&
        changeType !== 'offer' &&
        changeType !== 'photo'
      ) {
        res.status(400).json({ error: 'Invalid change type.' });
        return;
      }

      const db = getDb();
      let payload: Record<string, unknown> = {};
      let summary = '';

      if (changeType === 'cafe_info') {
        const updates: Record<string, unknown> = {};
        if (req.body?.timings !== undefined) updates.timings = cleanStr(req.body.timings, 120);
        if (req.body?.phone !== undefined) updates.phone = cleanStr(req.body.phone, 24);
        if (req.body?.website_url !== undefined) {
          updates.website_url = cleanSafeHttpUrl(req.body.website_url, 220);
        }
        if (req.body?.menu_url !== undefined) {
          updates.menu_url = cleanSafeHttpUrl(req.body.menu_url, 220);
        }
        if (req.body?.instagram_url !== undefined) {
          updates.instagram_url = cleanSafeHttpUrl(req.body.instagram_url, 220);
        }
        if (req.body?.wifi_available !== undefined) {
          updates.wifi_available =
            req.body.wifi_available === 'yes' || req.body.wifi_available === 'no'
              ? req.body.wifi_available
              : 'unknown';
        }
        if (req.body?.wifi_mbps !== undefined && req.body.wifi_mbps !== '') {
          const mbps = Number(req.body.wifi_mbps);
          if (Number.isFinite(mbps) && mbps >= 0 && mbps <= 2000) updates.wifi_mbps = Math.round(mbps);
        }
        if (req.body?.charging_sockets !== undefined) {
          updates.charging_sockets =
            req.body.charging_sockets === 'yes' || req.body.charging_sockets === 'no'
              ? req.body.charging_sockets
              : 'unknown';
        }
        if (req.body?.sockets_count !== undefined && req.body.sockets_count !== '') {
          const cnt = Number(req.body.sockets_count);
          if (Number.isFinite(cnt) && cnt >= 0 && cnt <= 200) updates.sockets_count = Math.round(cnt);
        }
        if (req.body?.seating_info !== undefined) {
          updates.seating_info = cleanStr(req.body.seating_info, 160);
        }
        if (req.body?.family_friendly !== undefined) {
          updates.family_friendly =
            req.body.family_friendly === 'yes' || req.body.family_friendly === 'no'
              ? req.body.family_friendly
              : 'unknown';
        }
        if (Object.keys(updates).length === 0) {
          res.status(400).json({ error: 'Provide at least one updated business or facility field.' });
          return;
        }
        payload = updates;
        summary = `Business & facility update (${Object.keys(updates).join(', ')})`;
      } else if (changeType === 'menu_update') {
        const updates: Record<string, unknown> = {};
        if (req.body?.avg_cost_per_person !== undefined && req.body.avg_cost_per_person !== '') {
          const avg = Number(req.body.avg_cost_per_person);
          if (Number.isFinite(avg) && avg >= 20 && avg <= 5000) {
            updates.avg_cost_per_person = Math.round(avg);
          }
        }
        if (req.body?.coffee_price !== undefined) updates.coffee_price = cleanStr(req.body.coffee_price, 60);
        if (req.body?.tea_price !== undefined) updates.tea_price = cleanStr(req.body.tea_price, 60);
        if (req.body?.snacks_price !== undefined) updates.snacks_price = cleanStr(req.body.snacks_price, 60);
        if (req.body?.desserts_price !== undefined) {
          updates.desserts_price = cleanStr(req.body.desserts_price, 60);
        }
        if (req.body?.meals_price !== undefined) updates.meals_price = cleanStr(req.body.meals_price, 60);
        if (Array.isArray(req.body?.popular_items)) {
          updates.popular_items = req.body.popular_items
            .map((x: unknown) => cleanStr(x, 80))
            .filter(Boolean)
            .slice(0, 12);
        }
        if (Object.keys(updates).length === 0) {
          res.status(400).json({ error: 'Provide at least one menu price or item update.' });
          return;
        }
        payload = updates;
        summary = `Menu & pricing update (${Object.keys(updates).join(', ')})`;
      } else if (changeType === 'offer') {
        const offers = Array.isArray(req.body?.offers)
          ? req.body.offers.map((x: unknown) => cleanStr(x, 120)).filter(Boolean).slice(0, 8)
          : [];
        const singleOffer = cleanStr(req.body?.offerText, 120);
        const finalOffers = singleOffer ? Array.from(new Set([...offers, singleOffer])) : offers;
        if (finalOffers.length === 0) {
          res.status(400).json({ error: 'Please specify an offer or member perk.' });
          return;
        }
        payload = { offers: finalOffers };
        summary = `Offers update: ${finalOffers[0]}`;
      } else {
        const photoDataUrl = String(req.body?.photoDataUrl || '');
        const caption = cleanStr(req.body?.caption, 120);
        const parsed = parseAndValidateOwnerImage(photoDataUrl);
        if (parsed.error || !parsed.buffer || !parsed.ext) {
          res.status(400).json({ error: parsed.error || 'Valid image upload is required.' });
          return;
        }
        const uploadsDir = path.resolve(getUploadsDir());
        const now = Date.now();
        const filename = `owner-${now}-${crypto.randomBytes(6).toString('hex')}.${parsed.ext}`;
        const resolvedPath = path.resolve(uploadsDir, filename);
        if (!resolvedPath.startsWith(uploadsDir + path.sep)) {
          res.status(400).json({ error: 'Invalid upload destination.' });
          return;
        }
        fs.writeFileSync(resolvedPath, parsed.buffer);
        payload = { photoUrl: `/uploads/${filename}`, caption };
        summary = `Official cafe photo upload${caption ? `: ${caption}` : ''}`;
      }

      recordRateAttempt(`owner-edit:${userId}`, 60 * 60 * 1000);
      const now = Date.now();
      db.prepare(
        `INSERT INTO owner_change_requests
         (cafe_id, user_id, change_type, payload_json, summary, status, admin_note, created_at, reviewed_at)
         VALUES (?, ?, ?, ?, ?, 'pending', '', ?, NULL)`
      ).run(cafeId, userId, changeType, JSON.stringify(payload), summary, now);

      res.status(201).json({
        ok: true,
        message: 'Change request submitted for CafeDesk moderation. Subscribers following this cafe will be notified once approved.',
      });
    }
  );

  // 5. Submit Transparent Sponsored Promotion Request (Never affects organic scores)
  app.post('/api/owner/promotions', requireUserAuth, (req: Request, res: Response) => {
    const settings = getSiteSettingsFromDb();
    if (settings.feature_flags?.owner_portal === false || settings.feature_flags?.promotions === false) {
      res.status(403).json({ error: 'Promotional placements are currently disabled.' });
      return;
    }

    const userId = req.user!.id;
    const cafeId = cleanStr(req.body?.cafeId, 120);
    if (!userOwnsCafe(userId, cafeId)) {
      res.status(403).json({
        error: 'Only verified cafe owners can request promoted spotlight placement.',
      });
      return;
    }

    const db = getDb();
    const cafeRow = db
      .prepare('SELECT id, name, area FROM cafes WHERE id = ? LIMIT 1')
      .get(cafeId) as { id: string; name: string; area: string } | undefined;
    if (!cafeRow) {
      res.status(404).json({ error: 'Cafe not found.' });
      return;
    }

    const title = cleanStr(req.body?.title, 120);
    const badgeLabel = cleanStr(req.body?.badgeLabel, 32) || 'Sponsored';
    const placementRaw = cleanStr(req.body?.placement, 24);
    const placement =
      placementRaw === 'category' || placementRaw === 'city' ? placementRaw : 'homepage';
    const budgetInr = Math.min(100000, Math.max(499, Math.round(Number(req.body?.budgetInr || 999))));
    const durationDays = Math.min(90, Math.max(7, Math.round(Number(req.body?.durationDays || 30))));

    if (title.length < 5) {
      res.status(400).json({ error: 'Please enter a concise promotion headline (5+ characters).' });
      return;
    }

    const now = Date.now();
    const endsAt = now + durationDays * 24 * 60 * 60 * 1000;

    db.prepare(
      `INSERT INTO cafe_promotions
       (cafe_id, cafe_name, owner_user_id, title, badge_label, placement, area, budget_inr, starts_at, ends_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).run(
      cafeRow.id,
      cafeRow.name,
      userId,
      title,
      badgeLabel,
      placement,
      cafeRow.area,
      budgetInr,
      now,
      endsAt,
      now
    );

    res.status(201).json({
      ok: true,
      message:
        'Promotional spotlight request queued for review. Paid placements carry a Sponsored badge and never modify organic Work-Ready or star ratings.',
    });
  });
}

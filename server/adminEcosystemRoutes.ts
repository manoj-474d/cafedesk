import fs from 'node:fs';
import type { Express, Request, Response } from 'express';
import { DEFAULT_FEATURE_FLAGS } from '../src/config/constants.ts';
import type { FeatureFlags } from '../src/types/cms.ts';
import { requireAdminAuth, requireFullAdmin } from './auth.ts';
import {
  getDb,
  getPlacesApiStatsFromDb,
  getSiteSettingsFromDb,
  getUploadsDir,
  recordActivity,
} from './db.ts';

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

function derivePriceRangeLabel(avgCost: number | null): string {
  if (avgCost === null) return '';
  if (avgCost <= 100) return '₹50–₹100';
  if (avgCost <= 200) return '₹100–₹200';
  if (avgCost <= 300) return '₹200–₹300';
  if (avgCost <= 500) return '₹300–₹500';
  return '₹500+';
}

function isSafePhotoPath(val: string): boolean {
  if (!val) return false;
  if (val.startsWith('/uploads/') && !val.includes('..')) return true;
  try {
    const u = new URL(val);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function cleanSafeHttpUrl(val: unknown, maxLen: number): string {
  const s = cleanStr(val, maxLen);
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.toString().slice(0, maxLen);
  } catch {
    // Reject unsafe URL schemes
  }
  return '';
}

export function registerAdminEcosystemRoutes(app: Express): void {
  // 1. Unified Ecosystem Queue + System Health Diagnostics
  app.get('/api/admin/ecosystem', requireAdminAuth, (_req: Request, res: Response) => {
    const db = getDb();
    const settings = getSiteSettingsFromDb();

    const reviews = db
      .prepare('SELECT * FROM cafe_reviews ORDER BY created_at DESC LIMIT 80')
      .all() as Array<Record<string, unknown>>;

    const contributions = db
      .prepare('SELECT * FROM community_contributions ORDER BY created_at DESC LIMIT 80')
      .all() as Array<Record<string, unknown>>;

    const claims = db
      .prepare('SELECT * FROM cafe_claim_requests ORDER BY created_at DESC LIMIT 60')
      .all() as Array<Record<string, unknown>>;

    const ownerChanges = db
      .prepare(
        `SELECT ocr.*, c.name AS cafe_name, u.name AS owner_user_name, u.email AS owner_user_email
         FROM owner_change_requests ocr
         LEFT JOIN cafes c ON c.id = ocr.cafe_id
         LEFT JOIN users u ON u.id = ocr.user_id
         ORDER BY ocr.created_at DESC
         LIMIT 60`
      )
      .all() as Array<Record<string, unknown>>;

    const promotions = db
      .prepare('SELECT * FROM cafe_promotions ORDER BY created_at DESC LIMIT 60')
      .all() as Array<Record<string, unknown>>;

    // System Health Diagnostics
    const quickCheckRow = db.prepare('PRAGMA quick_check(1)').get() as
      | { quick_check?: string }
      | undefined;

    const countTable = (table: string): number => {
      const row = db.prepare(`SELECT COUNT(*) AS cnt FROM ${table}`).get() as
        | { cnt?: number }
        | undefined;
      return Number(row?.cnt ?? 0);
    };

    const hasPlacesKey = Boolean(
      (
        process.env.GOOGLE_PLACES_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY ||
        process.env.VITE_GOOGLE_MAPS_API_KEY ||
        ''
      ).trim()
    );
    const placesStats = getPlacesApiStatsFromDb(hasPlacesKey);

    let uploadsWritable = false;
    try {
      const dir = getUploadsDir();
      fs.accessSync(dir, fs.constants.W_OK);
      uploadsWritable = true;
    } catch {
      uploadsWritable = false;
    }

    const flags: FeatureFlags = {
      ...DEFAULT_FEATURE_FLAGS,
      ...(settings.feature_flags || {}),
    };
    const flagKeys = Object.keys(DEFAULT_FEATURE_FLAGS) as Array<keyof FeatureFlags>;
    const enabledFlagsCount = flagKeys.filter((k) => flags[k] !== false).length;

    const razorpayConfigured = Boolean(
      (process.env.RAZORPAY_KEY_ID || '').trim() &&
        (process.env.RAZORPAY_KEY_SECRET || '').trim()
    );
    const supabaseConfigured = Boolean(
      (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim() &&
        (process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY ||
          '').trim()
    );

    res.json({
      reviews: reviews.map((r) => ({
        id: Number(r.id),
        cafe_id: String(r.cafe_id || ''),
        cafe_key: String(r.cafe_key),
        cafe_name: String(r.cafe_name),
        user_id: Number(r.user_id),
        author_name: String(r.author_name),
        rating: Number(r.rating),
        visit_purpose: String(r.visit_purpose || ''),
        wifi_confirmed: String(r.wifi_confirmed || 'unknown'),
        sockets_confirmed: String(r.sockets_confirmed || 'unknown'),
        noise_observed: r.noise_observed !== null ? Number(r.noise_observed) : null,
        review_text: String(r.review_text || ''),
        helpful_count: Number(r.helpful_count || 0),
        moderation_status: String(r.moderation_status || 'pending'),
        created_at: Number(r.created_at),
      })),
      contributions: contributions.map((c) => ({
        id: Number(c.id),
        cafe_id: String(c.cafe_id || ''),
        cafe_key: String(c.cafe_key),
        cafe_name: String(c.cafe_name),
        user_id: Number(c.user_id),
        contributor_name: String(c.contributor_name),
        contribution_type: String(c.contribution_type),
        payload: safeJson<Record<string, unknown>>(c.payload_json, {}),
        photo_url: String(c.photo_url || ''),
        points_awarded: Number(c.points_awarded || 0),
        moderation_status: String(c.moderation_status || 'pending'),
        reviewer_note: String(c.reviewer_note || ''),
        created_at: Number(c.created_at),
      })),
      claims: claims.map((c) => ({
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
      ownerChanges: ownerChanges.map((o) => ({
        id: Number(o.id),
        cafe_id: String(o.cafe_id),
        cafe_name: String(o.cafe_name || o.cafe_id),
        user_id: Number(o.user_id),
        owner_user_name: String(o.owner_user_name || ''),
        owner_user_email: String(o.owner_user_email || ''),
        change_type: String(o.change_type),
        payload: safeJson<Record<string, unknown>>(o.payload_json, {}),
        summary: String(o.summary || ''),
        status: String(o.status || 'pending'),
        admin_note: String(o.admin_note || ''),
        created_at: Number(o.created_at),
        reviewed_at: o.reviewed_at ? Number(o.reviewed_at) : null,
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
      systemHealth: {
        sqliteQuickCheck: quickCheckRow?.quick_check === 'ok',
        uploadsWritable,
        googleMapsConfigured: hasPlacesKey,
        razorpayConfigured,
        supabaseConfigured,
        enabledFlagsCount,
        totalFlagsCount: flagKeys.length,
        placesStats,
        tableCounts: {
          cafes: countTable('cafes'),
          users: countTable('users'),
          activeSubscriptions: Number(
            (
              db
                .prepare("SELECT COUNT(*) AS cnt FROM user_subscriptions WHERE status = 'active'")
                .get() as { cnt?: number }
            )?.cnt ?? 0
          ),
          reviews: countTable('cafe_reviews'),
          contributions: countTable('community_contributions'),
          claims: countTable('cafe_claim_requests'),
          ownerChanges: countTable('owner_change_requests'),
          promotions: countTable('cafe_promotions'),
        },
        checkedAt: Date.now(),
      },
    });
  });

  // 2. Moderate Community Review
  app.patch('/api/admin/reviews/:id', requireAdminAuth, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const status = cleanStr(req.body?.moderation_status, 20);
    if (
      !Number.isInteger(id) ||
      (status !== 'approved' && status !== 'rejected' && status !== 'pending')
    ) {
      res.status(400).json({ error: 'Invalid review ID or moderation status.' });
      return;
    }

    const db = getDb();
    const existing = db
      .prepare('SELECT id, cafe_name, author_name, moderation_status FROM cafe_reviews WHERE id = ?')
      .get(id) as
      | { id: number; cafe_name: string; author_name: string; moderation_status: string }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Review not found.' });
      return;
    }

    db.prepare('UPDATE cafe_reviews SET moderation_status = ?, updated_at = ? WHERE id = ?').run(
      status,
      Date.now(),
      id
    );

    recordActivity(
      req.admin!.username,
      `Moderated review (${status})`,
      `${existing.cafe_name} · by ${existing.author_name}`,
      existing.moderation_status,
      status
    );

    res.json({ ok: true, id, moderation_status: status });
  });

  // 3. Moderate Community Contribution (awards +20 bonus pts & appends verified photo on approval)
  app.patch('/api/admin/contributions/:id', requireAdminAuth, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const status = cleanStr(req.body?.moderation_status, 20);
    const reviewerNote = cleanStr(req.body?.reviewer_note, 300);

    if (
      !Number.isInteger(id) ||
      (status !== 'approved' && status !== 'rejected' && status !== 'pending')
    ) {
      res.status(400).json({ error: 'Invalid contribution ID or status.' });
      return;
    }

    const db = getDb();
    const contrib = db
      .prepare('SELECT * FROM community_contributions WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!contrib) {
      res.status(404).json({ error: 'Contribution not found.' });
      return;
    }

    const userId = Number(contrib.user_id);
    const cafeId = String(contrib.cafe_id || '');
    const cafeKey = String(contrib.cafe_key || '');
    const cafeName = String(contrib.cafe_name || '');
    const contribType = String(contrib.contribution_type || '');
    const photoUrl = String(contrib.photo_url || '');
    const now = Date.now();
    const todayIst = getTodayIsoIst();

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        'UPDATE community_contributions SET moderation_status = ?, reviewer_note = ?, updated_at = ? WHERE id = ?'
      ).run(status, reviewerNote, now, id);

      if (status === 'approved') {
        const alreadyBonus = db
          .prepare(
            "SELECT id FROM user_points_ledger WHERE user_id = ? AND reference_type = 'contribution_approved' AND reference_id = ? LIMIT 1"
          )
          .get(userId, String(id));

        if (!alreadyBonus) {
          db.prepare(
            `INSERT INTO user_points_ledger (user_id, points, reason, reference_type, reference_id, created_at)
             VALUES (?, ?, ?, 'contribution_approved', ?, ?)`
          ).run(
            userId,
            20,
            `Verified contribution approved for ${cafeName}`,
            String(id),
            now
          );
          db.prepare(
            'UPDATE community_contributions SET points_awarded = points_awarded + 20 WHERE id = ?'
          ).run(id);
        }

        const cafeRow = db
          .prepare('SELECT id, slug, photos_json FROM cafes WHERE id = ? OR slug = ? LIMIT 1')
          .get(cafeId, cafeKey) as
          | { id: string; slug: string | null; photos_json: string }
          | undefined;

        if (cafeRow) {
          if (contribType === 'photo' && isSafePhotoPath(photoUrl)) {
            const existingPhotos = safeJson<string[]>(cafeRow.photos_json, []);
            const merged = Array.from(new Set([...existingPhotos, photoUrl])).slice(0, 16);
            db.prepare(
              'UPDATE cafes SET photos_json = ?, photos_approved = 1, last_verified_date = ?, updated_at = ? WHERE id = ?'
            ).run(JSON.stringify(merged), todayIst, now, cafeRow.id);
          } else {
            db.prepare(
              'UPDATE cafes SET last_verified_date = ?, updated_at = ? WHERE id = ?'
            ).run(todayIst, now, cafeRow.id);
          }
        }
      }

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      res.status(500).json({ error: (err as Error).message || 'Failed to update contribution.' });
      return;
    }

    recordActivity(
      req.admin!.username,
      `Moderated ${contribType} contribution (${status})`,
      cafeName,
      String(contrib.moderation_status || 'pending'),
      status
    );

    res.json({ ok: true, id, moderation_status: status });
  });

  // 4. Approve / Reject Cafe Ownership Claim Request (Full Admin Required)
  app.patch(
    '/api/admin/claims/:id',
    requireAdminAuth,
    requireFullAdmin,
    (req: Request, res: Response) => {
      const id = Number(req.params.id);
      const status = cleanStr(req.body?.status, 20);
      const adminNote = cleanStr(req.body?.admin_note, 300);

      if (
        !Number.isInteger(id) ||
        (status !== 'approved' && status !== 'rejected' && status !== 'pending')
      ) {
        res.status(400).json({ error: 'Invalid claim ID or status.' });
        return;
      }

      const db = getDb();
      const claim = db
        .prepare('SELECT * FROM cafe_claim_requests WHERE id = ?')
        .get(id) as
        | {
            id: number;
            cafe_id: string;
            cafe_name: string;
            user_id: number;
            owner_name: string;
            status: string;
          }
        | undefined;

      if (!claim) {
        res.status(404).json({ error: 'Ownership claim not found.' });
        return;
      }

      const now = Date.now();
      const todayIst = getTodayIsoIst();

      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(
          'UPDATE cafe_claim_requests SET status = ?, admin_note = ?, reviewed_at = ? WHERE id = ?'
        ).run(status, adminNote, now, id);

        if (status === 'approved') {
          db.prepare(
            'UPDATE cafes SET claimed_by_owner_id = ?, owner_verified = 1, last_verified_date = ?, updated_at = ? WHERE id = ?'
          ).run(claim.user_id, todayIst, now, claim.cafe_id);

          db.prepare(
            "UPDATE cafe_owners SET status = 'verified', updated_at = ? WHERE user_id = ?"
          ).run(now, claim.user_id);

          const cafeRow = db
            .prepare('SELECT slug, name FROM cafes WHERE id = ?')
            .get(claim.cafe_id) as { slug: string | null; name: string } | undefined;

          const targetSlug = cafeRow?.slug || claim.cafe_id;
          db.prepare(
            `INSERT INTO user_notifications (user_id, cafe_key, title, message, link, is_read, created_at)
             VALUES (?, ?, ?, ?, '/partner-portal', 0, ?)`
          ).run(
            claim.user_id,
            targetSlug,
            `Ownership Verified: ${claim.cafe_name}`,
            `Your ownership claim for ${claim.cafe_name} has been approved. You can now submit menu, hours, offer, and facility updates from your Partner Portal.`,
            now
          );
        }

        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        res.status(500).json({ error: (err as Error).message || 'Failed to update claim.' });
        return;
      }

      recordActivity(
        req.admin!.username,
        `Ownership claim ${status}`,
        `${claim.cafe_name} · ${claim.owner_name}`,
        claim.status,
        status
      );

      res.json({ ok: true, id, status });
    }
  );

  // 5. Approve / Reject Owner Listing Change Request & Notify Cafe Followers (Full Admin Required)
  app.patch(
    '/api/admin/owner-changes/:id',
    requireAdminAuth,
    requireFullAdmin,
    (req: Request, res: Response) => {
      const id = Number(req.params.id);
      const status = cleanStr(req.body?.status, 20);
      const adminNote = cleanStr(req.body?.admin_note, 300);

      if (
        !Number.isInteger(id) ||
        (status !== 'approved' && status !== 'rejected' && status !== 'pending')
      ) {
        res.status(400).json({ error: 'Invalid change request ID or status.' });
        return;
      }

      const db = getDb();
      const changeReq = db
        .prepare('SELECT * FROM owner_change_requests WHERE id = ?')
        .get(id) as
        | {
            id: number;
            cafe_id: string;
            user_id: number;
            change_type: string;
            payload_json: string;
            summary: string;
            status: string;
          }
        | undefined;

      if (!changeReq) {
        res.status(404).json({ error: 'Owner change request not found.' });
        return;
      }

      const now = Date.now();
      const todayIst = getTodayIsoIst();
      const payload = safeJson<Record<string, unknown>>(changeReq.payload_json, {});
      let followersNotified = 0;

      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(
          'UPDATE owner_change_requests SET status = ?, admin_note = ?, reviewed_at = ? WHERE id = ?'
        ).run(status, adminNote, now, id);

        if (status === 'approved') {
          const cafe = db
            .prepare('SELECT * FROM cafes WHERE id = ? LIMIT 1')
            .get(changeReq.cafe_id) as Record<string, unknown> | undefined;

          if (cafe) {
            const sets: string[] = [];
            const vals: Array<string | number | null> = [];

            const addStrField = (col: string, val: unknown, maxLen: number) => {
              if (val !== undefined) {
                sets.push(`${col} = ?`);
                vals.push(cleanStr(val, maxLen));
              }
            };

            if (changeReq.change_type === 'cafe_info') {
              addStrField('timings', payload.timings, 120);
              addStrField('phone', payload.phone, 24);
              if (payload.website_url !== undefined) {
                sets.push('website_url = ?');
                vals.push(cleanSafeHttpUrl(payload.website_url, 220));
              }
              if (payload.menu_url !== undefined) {
                sets.push('menu_url = ?');
                vals.push(cleanSafeHttpUrl(payload.menu_url, 220));
              }
              if (payload.instagram_url !== undefined) {
                sets.push('instagram_url = ?');
                vals.push(cleanSafeHttpUrl(payload.instagram_url, 220));
              }
              addStrField('seating_info', payload.seating_info, 160);

              if (
                payload.wifi_available === 'yes' ||
                payload.wifi_available === 'no' ||
                payload.wifi_available === 'unknown'
              ) {
                sets.push('wifi_available = ?');
                vals.push(String(payload.wifi_available));
              }
              if (payload.wifi_mbps !== undefined && payload.wifi_mbps !== null) {
                const mbps = Math.max(0, Math.min(2000, Math.round(Number(payload.wifi_mbps))));
                if (Number.isFinite(mbps)) {
                  sets.push('wifi_mbps = ?');
                  vals.push(mbps);
                }
              }
              if (
                payload.charging_sockets === 'yes' ||
                payload.charging_sockets === 'no' ||
                payload.charging_sockets === 'unknown'
              ) {
                sets.push('charging_sockets = ?');
                vals.push(String(payload.charging_sockets));
              }
              if (payload.sockets_count !== undefined && payload.sockets_count !== null) {
                const cnt = Math.max(0, Math.min(200, Math.round(Number(payload.sockets_count))));
                if (Number.isFinite(cnt)) {
                  sets.push('sockets_count = ?');
                  vals.push(cnt);
                }
              }
              if (
                payload.family_friendly === 'yes' ||
                payload.family_friendly === 'no' ||
                payload.family_friendly === 'unknown'
              ) {
                sets.push('family_friendly = ?');
                vals.push(String(payload.family_friendly));
              }
            } else if (changeReq.change_type === 'menu_update') {
              if (
                payload.avg_cost_per_person !== undefined &&
                payload.avg_cost_per_person !== null
              ) {
                const avg = Math.max(
                  20,
                  Math.min(5000, Math.round(Number(payload.avg_cost_per_person)))
                );
                if (Number.isFinite(avg)) {
                  sets.push('avg_cost_per_person = ?');
                  vals.push(avg);
                  sets.push('price_range = ?');
                  vals.push(derivePriceRangeLabel(avg));
                }
              }
              addStrField('coffee_price', payload.coffee_price, 60);
              addStrField('tea_price', payload.tea_price, 60);
              addStrField('snacks_price', payload.snacks_price, 60);
              addStrField('desserts_price', payload.desserts_price, 60);
              addStrField('meals_price', payload.meals_price, 60);
              if (Array.isArray(payload.popular_items)) {
                const cleanItems = payload.popular_items
                  .map((x) => cleanStr(x, 80))
                  .filter(Boolean)
                  .slice(0, 12);
                sets.push('popular_items_json = ?');
                vals.push(JSON.stringify(cleanItems));
              }
            } else if (changeReq.change_type === 'offer') {
              if (Array.isArray(payload.offers)) {
                const cleanOffers = payload.offers
                  .map((x) => cleanStr(x, 120))
                  .filter(Boolean)
                  .slice(0, 8);
                sets.push('offers_json = ?');
                vals.push(JSON.stringify(cleanOffers));
              }
            } else if (changeReq.change_type === 'photo') {
              const photoUrl = cleanStr(payload.photoUrl, 300);
              if (isSafePhotoPath(photoUrl)) {
                const existingPhotos = safeJson<string[]>(cafe.photos_json, []);
                const merged = Array.from(new Set([...existingPhotos, photoUrl])).slice(0, 16);
                sets.push('photos_json = ?');
                vals.push(JSON.stringify(merged));
                sets.push('photos_approved = 1');
              }
            }

            sets.push('owner_verified = 1');
            sets.push('last_verified_date = ?');
            vals.push(todayIst);
            sets.push('updated_at = ?');
            vals.push(now);

            db.prepare(`UPDATE cafes SET ${sets.join(', ')} WHERE id = ?`).run(
              ...vals,
              String(cafe.id)
            );

            // Notify every follower watching this cafe (and the submitting owner)
            const cafeSlug = String(cafe.slug || cafe.id);
            const cafeName = String(cafe.name);
            const followerRows = db
              .prepare(
                'SELECT DISTINCT user_id FROM cafe_follows WHERE cafe_key = ? OR cafe_key = ?'
              )
              .all(cafeSlug, String(cafe.id)) as Array<{ user_id: number }>;

            const insertNotif = db.prepare(
              `INSERT INTO user_notifications (user_id, cafe_key, title, message, link, is_read, created_at)
               VALUES (?, ?, ?, ?, ?, 0, ?)`
            );

            for (const f of followerRows) {
              insertNotif.run(
                f.user_id,
                cafeSlug,
                `${cafeName} updated its listing`,
                `${changeReq.summary || 'Verified owner update published'} on ${cafeName}.`,
                `/cafe/${encodeURIComponent(cafeSlug)}`,
                now
              );
              followersNotified += 1;
            }
          }
        }

        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        res.status(500).json({ error: (err as Error).message || 'Failed to review owner change.' });
        return;
      }

      recordActivity(
        req.admin!.username,
        `Owner change request ${status}`,
        `${changeReq.cafe_id} · ${changeReq.change_type}`,
        changeReq.status,
        `${status}${followersNotified > 0 ? ` (${followersNotified} followers notified)` : ''}`
      );

      res.json({ ok: true, id, status, followersNotified });
    }
  );

  // 6. Manage Transparent Paid Promotions (Full Admin Required)
  app.patch(
    '/api/admin/promotions/:id',
    requireAdminAuth,
    requireFullAdmin,
    (req: Request, res: Response) => {
      const id = Number(req.params.id);
      const status = cleanStr(req.body?.status, 20);
      if (
        !Number.isInteger(id) ||
        !['pending', 'active', 'paused', 'rejected', 'ended'].includes(status)
      ) {
        res.status(400).json({ error: 'Invalid promotion ID or status.' });
        return;
      }

      const db = getDb();
      const promo = db
        .prepare('SELECT id, cafe_name, title, status FROM cafe_promotions WHERE id = ?')
        .get(id) as
        | { id: number; cafe_name: string; title: string; status: string }
        | undefined;

      if (!promo) {
        res.status(404).json({ error: 'Promotion record not found.' });
        return;
      }

      db.prepare('UPDATE cafe_promotions SET status = ? WHERE id = ?').run(status, id);

      recordActivity(
        req.admin!.username,
        `Set promotion status to ${status}`,
        `${promo.cafe_name} · ${promo.title}`,
        promo.status,
        status
      );

      res.json({ ok: true, id, status });
    }
  );
}

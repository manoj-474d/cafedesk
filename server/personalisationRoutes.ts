import type { Express, Request, Response } from 'express';
import {
  checkRateLimit,
  recordRateAttempt,
  requireUserAuth,
} from './auth.ts';
import { getDb, getSiteSettingsFromDb } from './db.ts';

function cleanStr(val: unknown, maxLen: number): string {
  return String(val ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function safeJsonArray(raw: unknown): string[] {
  try {
    if (typeof raw !== 'string' || !raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((x) => cleanStr(x, 60)).filter(Boolean).slice(0, 12)
      : [];
  } catch {
    return [];
  }
}

function resolveCafeKeyAndName(slugOrIdRaw: string): { cafeKey: string; cafeName: string } {
  const key = cleanStr(decodeURIComponent(slugOrIdRaw || ''), 160);
  const row = getDb()
    .prepare('SELECT id, slug, name FROM cafes WHERE slug = ? OR id = ? LIMIT 1')
    .get(key, key) as { id: string; slug: string | null; name: string } | undefined;
  if (row) {
    return {
      cafeKey: String(row.slug || row.id),
      cafeName: String(row.name),
    };
  }
  return {
    cafeKey: key,
    cafeName: key.startsWith('google:') ? 'Bengaluru Cafe' : key.replace(/-/g, ' '),
  };
}

export function registerPersonalisationRoutes(app: Express): void {
  // 1. User Personalisation & Privacy Preferences
  app.get('/api/user/preferences', requireUserAuth, (req: Request, res: Response) => {
    const row = getDb()
      .prepare('SELECT * FROM user_preferences WHERE user_id = ?')
      .get(req.user!.id) as Record<string, unknown> | undefined;

    if (!row) {
      res.json({
        preferences: {
          user_id: req.user!.id,
          favourite_areas: [],
          favourite_categories: [],
          preferred_max_budget: null,
          personalisation_enabled: true,
          public_profile_enabled: false,
          save_visit_history: true,
          updated_at: 0,
        },
      });
      return;
    }

    res.json({
      preferences: {
        user_id: Number(row.user_id),
        favourite_areas: safeJsonArray(row.favourite_areas_json),
        favourite_categories: safeJsonArray(row.favourite_categories_json),
        preferred_max_budget:
          row.preferred_max_budget !== null && row.preferred_max_budget !== undefined
            ? Number(row.preferred_max_budget)
            : null,
        personalisation_enabled: Boolean(row.personalisation_enabled),
        public_profile_enabled: Boolean(row.public_profile_enabled),
        save_visit_history: Boolean(row.save_visit_history),
        updated_at: Number(row.updated_at || 0),
      },
    });
  });

  app.put('/api/user/preferences', requireUserAuth, (req: Request, res: Response) => {
    const favouriteAreas = Array.isArray(req.body?.favourite_areas)
      ? req.body.favourite_areas.map((x: unknown) => cleanStr(x, 60)).filter(Boolean).slice(0, 12)
      : [];
    const favouriteCategories = Array.isArray(req.body?.favourite_categories)
      ? req.body.favourite_categories
          .map((x: unknown) => cleanStr(x, 60))
          .filter(Boolean)
          .slice(0, 12)
      : [];

    const rawBudget = req.body?.preferred_max_budget;
    const preferredMaxBudget =
      rawBudget === null || rawBudget === undefined || rawBudget === ''
        ? null
        : Math.min(5000, Math.max(20, Math.round(Number(rawBudget))));
    const safeBudget = Number.isFinite(preferredMaxBudget as number) ? preferredMaxBudget : null;

    const personalisationEnabled = req.body?.personalisation_enabled !== false;
    const publicProfileEnabled = Boolean(req.body?.public_profile_enabled);
    const saveVisitHistory = req.body?.save_visit_history !== false;
    const now = Date.now();

    getDb()
      .prepare(
        `INSERT INTO user_preferences
         (user_id, favourite_areas_json, favourite_categories_json, preferred_max_budget, personalisation_enabled, public_profile_enabled, save_visit_history, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           favourite_areas_json = excluded.favourite_areas_json,
           favourite_categories_json = excluded.favourite_categories_json,
           preferred_max_budget = excluded.preferred_max_budget,
           personalisation_enabled = excluded.personalisation_enabled,
           public_profile_enabled = excluded.public_profile_enabled,
           save_visit_history = excluded.save_visit_history,
           updated_at = excluded.updated_at`
      )
      .run(
        req.user!.id,
        JSON.stringify(favouriteAreas),
        JSON.stringify(favouriteCategories),
        safeBudget,
        personalisationEnabled ? 1 : 0,
        publicProfileEnabled ? 1 : 0,
        saveVisitHistory ? 1 : 0,
        now
      );

    res.json({
      ok: true,
      preferences: {
        user_id: req.user!.id,
        favourite_areas: favouriteAreas,
        favourite_categories: favouriteCategories,
        preferred_max_budget: safeBudget,
        personalisation_enabled: personalisationEnabled,
        public_profile_enabled: publicProfileEnabled,
        save_visit_history: saveVisitHistory,
        updated_at: now,
      },
    });
  });

  // 2. Follow / Unfollow Cafes
  app.get('/api/user/follows', requireUserAuth, (req: Request, res: Response) => {
    const rows = getDb()
      .prepare('SELECT id, cafe_key, cafe_name, created_at FROM cafe_follows WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.user!.id) as Array<{
      id: number;
      cafe_key: string;
      cafe_name: string;
      created_at: number;
    }>;
    res.json({ follows: rows });
  });

  app.post('/api/cafes/:slug/follow', requireUserAuth, (req: Request, res: Response) => {
    const userId = req.user!.id;
    const rate = checkRateLimit(`follow:${userId}`, 30, 15 * 60 * 1000);
    if (!rate.allowed) {
      res.status(429).json({ error: 'Too many follow actions. Please wait a moment.' });
      return;
    }
    recordRateAttempt(`follow:${userId}`, 15 * 60 * 1000);

    const target = resolveCafeKeyAndName(String(req.params.slug || ''));
    const cafeName = cleanStr(req.body?.cafeName, 140) || target.cafeName;
    if (!target.cafeKey) {
      res.status(400).json({ error: 'Cafe slug is required.' });
      return;
    }

    getDb()
      .prepare(
        `INSERT INTO cafe_follows (user_id, cafe_key, cafe_name, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, cafe_key) DO UPDATE SET cafe_name = excluded.cafe_name`
      )
      .run(userId, target.cafeKey, cafeName, Date.now());

    const follows = getDb()
      .prepare('SELECT id, cafe_key, cafe_name, created_at FROM cafe_follows WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId);
    res.json({ ok: true, following: true, follows });
  });

  app.delete('/api/cafes/:slug/follow', requireUserAuth, (req: Request, res: Response) => {
    const userId = req.user!.id;
    const target = resolveCafeKeyAndName(String(req.params.slug || ''));
    getDb()
      .prepare('DELETE FROM cafe_follows WHERE user_id = ? AND cafe_key = ?')
      .run(userId, target.cafeKey);

    const follows = getDb()
      .prepare('SELECT id, cafe_key, cafe_name, created_at FROM cafe_follows WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId);
    res.json({ ok: true, following: false, follows });
  });

  // 3. User Notifications Inbox
  app.get('/api/user/notifications', requireUserAuth, (req: Request, res: Response) => {
    const settings = getSiteSettingsFromDb();
    if (settings.feature_flags?.notifications === false) {
      res.json({ enabled: false, unreadCount: 0, notifications: [] });
      return;
    }

    const rows = getDb()
      .prepare(
        'SELECT id, user_id, cafe_key, title, message, link, is_read, created_at FROM user_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30'
      )
      .all(req.user!.id) as Array<Record<string, unknown>>;

    const notifications = rows.map((r) => ({
      id: Number(r.id),
      user_id: Number(r.user_id),
      cafe_key: String(r.cafe_key || ''),
      title: String(r.title || ''),
      message: String(r.message || ''),
      link: String(r.link || ''),
      is_read: Boolean(r.is_read),
      created_at: Number(r.created_at),
    }));

    const unreadCount = notifications.filter((n) => !n.is_read).length;
    res.json({ enabled: true, unreadCount, notifications });
  });

  app.post('/api/user/notifications/read', requireUserAuth, (req: Request, res: Response) => {
    const notifId = req.body?.id ? Number(req.body.id) : null;
    const db = getDb();
    if (notifId && Number.isFinite(notifId)) {
      db.prepare('UPDATE user_notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
        notifId,
        req.user!.id
      );
    } else {
      db.prepare('UPDATE user_notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id);
    }
    res.json({ ok: true });
  });
}

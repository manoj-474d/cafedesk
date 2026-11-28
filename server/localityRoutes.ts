import type { Express, Request, RequestHandler, Response } from 'express';
import {
  BENGALURU_REGIONS,
  LOCALITY_SEARCH_QUERIES,
  STANDARD_BUSINESS_CATEGORIES,
  type BengaluruRegion,
} from '../src/config/localities.ts';
import type { LocationItem } from '../src/types/cms.ts';
import {
  buildGoogleMapsDirectionsUrl,
  computeDistanceKm,
  deduplicateCafeItems,
} from '../src/utils/cafeHelpers.ts';
import { resolveViewerAccessContext, sanitizeCafeForAccess } from './accessControl.ts';
import { checkRateLimit, getClientIp, recordRateAttempt, resolveUserFromRequest } from './auth.ts';
import {
  createOrUpdateLocalityInDb,
  getDb,
  getDiscoverySettingsFromDb,
  getLocalityByIdOrSlugFromDb,
  getSiteSettingsFromDb,
  listLocalitiesFromDb,
  listLocationsFromDb,
  purgeExpiredPlacesTransientCache,
  recordActivity,
  updateDiscoverySettingsInDb,
} from './db.ts';
import {
  buildLocalityCoverageOverview,
  buildPlaceRefLocationItem,
  getCallsInLast24h,
  isDiscoveryRunActive,
  listDiscoveredPlaceRefsHydrated,
  promotePlaceRefToCafeCatalog,
  rehydrateExpiredPlaceRefs,
  runLocalityDiscoverySweep,
  startBatchDiscoveryJob,
} from './localityDiscoveryEngine.ts';
import { getPlacesApiKey } from './placesDiscoveryRoutes.ts';

function cleanStr(val: unknown, maxLen = 200): string {
  return String(val ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

const VALID_REGION_SET = new Set<string>(BENGALURU_REGIONS);
const VALID_CAT_SET = new Set<string>(STANDARD_BUSINESS_CATEGORIES);

export function registerLocalityRoutes(
  app: Express,
  requireAdminAuth: RequestHandler
): void {
  // ============================================================================
  // PUBLIC BENGALURU LOCALITY ENDPOINTS
  // ============================================================================

  app.get('/api/localities', (req: Request, res: Response) => {
    const region = cleanStr(req.query.region, 60);
    const localities = listLocalitiesFromDb({
      activeOnly: true,
      approvedOnly: true,
      region: region && VALID_REGION_SET.has(region) ? region : undefined,
    });

    const grouped: Record<string, typeof localities> = {};
    for (const r of BENGALURU_REGIONS) {
      grouped[r] = localities.filter((l) => l.region === r);
    }

    res.json({
      localities,
      grouped,
      regions: BENGALURU_REGIONS,
      total: localities.length,
    });
  });

  // Suggest a missing Bengaluru neighbourhood (queued for admin approval)
  app.post('/api/localities/suggest', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`suggest-loc:${ip}`, 8, 60 * 60 * 1000);
    if (!rl.allowed) {
      res.status(429).json({ error: 'Too many locality suggestions. Please try again later.' });
      return;
    }
    recordRateAttempt(`suggest-loc:${ip}`, 60 * 60 * 1000);

    const name = cleanStr(req.body?.name, 80);
    if (!name || name.length < 2) {
      res.status(400).json({ error: 'Locality name is required (at least 2 characters).' });
      return;
    }
    const rawRegion = cleanStr(req.body?.region, 60);
    const region: BengaluruRegion = (
      VALID_REGION_SET.has(rawRegion) ? rawRegion : 'Outer Bengaluru'
    ) as BengaluruRegion;
    const altSpellings = String(req.body?.alt_spellings || '')
      .split(',')
      .map((s) => cleanStr(s, 60))
      .filter(Boolean)
      .slice(0, 8);
    const notes = cleanStr(req.body?.notes, 300);
    const email = cleanStr(req.body?.email, 120);

    const db = getDb();
    const now = Date.now();
    const result = db
      .prepare(
        `INSERT INTO locality_suggestions (name, region, alt_spellings_json, notes, suggested_by_email, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`
      )
      .run(name, region, JSON.stringify(altSpellings), notes, email, now);

    res.status(201).json({
      ok: true,
      id: Number(result.lastInsertRowid),
      message: `${name} has been submitted for admin approval and discovery scheduling.`,
    });
  });

  // Public Locality-Wise Places Feed (Curated CafeDesk + ToS-compliant Google Places Discovery Index)
  app.get('/api/localities/:slug/places', async (req: Request, res: Response) => {
    const slug = cleanStr(req.params.slug, 100);
    const locality = getLocalityByIdOrSlugFromDb(slug);
    if (!locality || !locality.active || !locality.admin_approved) {
      res.status(404).json({ error: 'Bengaluru locality not found.' });
      return;
    }

    const category = cleanStr(req.query.category, 60);
    const onDemandWarm = req.query.warm === '1' || req.query.warm === 'true';

    // Optional bounded on-demand warm sweep if locality has never been searched yet
    if (
      onDemandWarm &&
      locality.discovery_status === 'pending' &&
      getPlacesApiKey() &&
      !isDiscoveryRunActive()
    ) {
      const settings = getDiscoverySettingsFromDb();
      if (!settings.paused && getCallsInLast24h() < settings.daily_call_cap) {
        const quickQueries = LOCALITY_SEARCH_QUERIES.filter((q) =>
          ['cafes', 'tea_shops', 'bakeries', 'food_and_beverage_nearby'].includes(q.id)
        );
        const db = getDb();
        const jobInsert = db
          .prepare(
            `INSERT INTO discovery_jobs (scope, target_key, status, calls_made, started_at)
             VALUES ('locality', ?, 'running', 0, ?)`
          )
          .run(locality.slug, Date.now());
        const jobId = Number(jobInsert.lastInsertRowid);
        const sweepRes = await runLocalityDiscoverySweep({
          locality,
          jobId,
          maxCallsRemaining: Math.min(6, Math.max(1, settings.daily_call_cap - getCallsInLast24h())),
          queriesSubset: quickQueries,
        });
        db.prepare(
          `UPDATE discovery_jobs SET status = 'completed', calls_made = ?, places_seen = ?, new_places = ?, duplicates_flagged = ?, finished_at = ? WHERE id = ?`
        ).run(
          sweepRes.callsMade,
          sweepRes.placesSeen,
          sweepRes.newPlaces,
          sweepRes.duplicatesFlagged,
          Date.now(),
          jobId
        );
      }
    }

    const updatedLocality = getLocalityByIdOrSlugFromDb(locality.id) ?? locality;
    const settings = getSiteSettingsFromDb();
    const user = resolveUserFromRequest(req, res);
    const viewer = resolveViewerAccessContext({ userId: user?.id ?? null, isAdmin: false });

    // 1. Curated CafeDesk listings matching this locality (by area/alt spellings/proximity <= 3.5km)
    const terms = [
      updatedLocality.name,
      ...updatedLocality.alt_spellings,
      ...updatedLocality.local_names,
    ].map((t) => t.toLowerCase());

    const curatedAll = listLocationsFromDb(false)
      .filter((c) => {
        const hay = `${c.area} ${c.address}`.toLowerCase();
        if (terms.some((t) => t.length >= 3 && hay.includes(t))) return true;
        if (c.lat !== null && c.lng !== null) {
          return (
            computeDistanceKm(updatedLocality.lat, updatedLocality.lng, c.lat, c.lng) <=
            Math.max(2.5, updatedLocality.radius_meters / 1000)
          );
        }
        return false;
      })
      .map((c) => sanitizeCafeForAccess(c, viewer, settings));

    // 2. Indexed Google Places discovery refs hydrated from 24h transient cache
    const refs = listDiscoveredPlaceRefsHydrated({
      localityId: updatedLocality.id,
      category: category && category !== 'all' ? category : undefined,
      limit: 120,
    }).filter((r) => r.duplicate_review_status !== 'merged');

    // Re-hydrate a small bounded batch if transient display cache expired
    const expiredIds = refs.filter((r) => !r.cached_display).map((r) => r.place_id);
    if (expiredIds.length > 0 && onDemandWarm) {
      await rehydrateExpiredPlaceRefs(expiredIds, 6);
    }

    const hydratedRefs =
      expiredIds.length > 0 && onDemandWarm
        ? listDiscoveredPlaceRefsHydrated({
            localityId: updatedLocality.id,
            category: category && category !== 'all' ? category : undefined,
            limit: 120,
          }).filter((r) => r.duplicate_review_status !== 'merged')
        : refs;

    const discoveryItems: LocationItem[] = [];
    for (const ref of hydratedRefs) {
      const item = buildPlaceRefLocationItem(ref, updatedLocality.name);
      if (item) {
        discoveryItems.push(sanitizeCafeForAccess(item, viewer, settings));
      }
    }

    const merged = deduplicateCafeItems(curatedAll, discoveryItems);

    res.json({
      locality: updatedLocality,
      places: merged,
      curated_count: curatedAll.length,
      discovered_count: discoveryItems.length,
      total: merged.length,
      attribution: 'Includes live business listings sourced from Google Places API (New).',
    });
  });

  // ============================================================================
  // ADMIN LOCALITY MASTER & COVERAGE ENGINE ROUTES
  // ============================================================================

  app.get('/api/admin/localities/coverage', requireAdminAuth, (_req: Request, res: Response) => {
    purgeExpiredPlacesTransientCache();
    const overview = buildLocalityCoverageOverview();
    res.json({
      ...overview,
      running: isDiscoveryRunActive(),
    });
  });

  app.post('/api/admin/localities', requireAdminAuth, (req: Request, res: Response) => {
    const name = cleanStr(req.body?.name, 80);
    const region = cleanStr(req.body?.region, 60);
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!name || !VALID_REGION_SET.has(region) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'Valid locality name, Bengaluru region, lat, and lng are required.' });
      return;
    }

    const altSpellings = Array.isArray(req.body?.alt_spellings)
      ? req.body.alt_spellings.map((s: unknown) => cleanStr(s, 60)).filter(Boolean)
      : String(req.body?.alt_spellings || '')
          .split(',')
          .map((s) => cleanStr(s, 60))
          .filter(Boolean);
    const localNames = Array.isArray(req.body?.local_names)
      ? req.body.local_names.map((s: unknown) => cleanStr(s, 60)).filter(Boolean)
      : String(req.body?.local_names || '')
          .split(',')
          .map((s) => cleanStr(s, 60))
          .filter(Boolean);
    const keywords = Array.isArray(req.body?.keywords)
      ? req.body.keywords.map((s: unknown) => cleanStr(s, 60)).filter(Boolean)
      : String(req.body?.keywords || '')
          .split(',')
          .map((s) => cleanStr(s, 60))
          .filter(Boolean);

    const loc = createOrUpdateLocalityInDb({
      name,
      region: region as BengaluruRegion,
      alt_spellings: altSpellings,
      local_names: localNames,
      keywords,
      lat,
      lng,
      radius_meters: Number(req.body?.radius_meters) || 2800,
      active: req.body?.active === undefined ? true : Boolean(req.body.active),
      admin_approved: req.body?.admin_approved === undefined ? true : Boolean(req.body.admin_approved),
      coverage_notes: cleanStr(req.body?.coverage_notes, 240),
    });

    recordActivity(req.admin!.username, 'Added Bengaluru locality', loc.name, '', loc.region);
    res.status(201).json({ locality: loc });
  });

  app.patch('/api/admin/localities/:id', requireAdminAuth, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid locality ID.' });
      return;
    }
    const existing = getLocalityByIdOrSlugFromDb(id);
    if (!existing) {
      res.status(404).json({ error: 'Locality not found.' });
      return;
    }

    const nextName = req.body?.name !== undefined ? cleanStr(req.body.name, 80) : existing.name;
    const rawRegion = req.body?.region !== undefined ? cleanStr(req.body.region, 60) : existing.region;
    const nextRegion = (
      VALID_REGION_SET.has(rawRegion) ? rawRegion : existing.region
    ) as BengaluruRegion;

    const updated = createOrUpdateLocalityInDb({
      id,
      name: nextName || existing.name,
      region: nextRegion,
      alt_spellings:
        req.body?.alt_spellings !== undefined
          ? Array.isArray(req.body.alt_spellings)
            ? req.body.alt_spellings.map((s: unknown) => cleanStr(s, 60)).filter(Boolean)
            : String(req.body.alt_spellings)
                .split(',')
                .map((s) => cleanStr(s, 60))
                .filter(Boolean)
          : existing.alt_spellings,
      local_names:
        req.body?.local_names !== undefined
          ? Array.isArray(req.body.local_names)
            ? req.body.local_names.map((s: unknown) => cleanStr(s, 60)).filter(Boolean)
            : String(req.body.local_names)
                .split(',')
                .map((s) => cleanStr(s, 60))
                .filter(Boolean)
          : existing.local_names,
      keywords:
        req.body?.keywords !== undefined
          ? Array.isArray(req.body.keywords)
            ? req.body.keywords.map((s: unknown) => cleanStr(s, 60)).filter(Boolean)
            : String(req.body.keywords)
                .split(',')
                .map((s) => cleanStr(s, 60))
                .filter(Boolean)
          : existing.keywords,
      lat: Number.isFinite(Number(req.body?.lat)) ? Number(req.body.lat) : existing.lat,
      lng: Number.isFinite(Number(req.body?.lng)) ? Number(req.body.lng) : existing.lng,
      radius_meters: Number.isFinite(Number(req.body?.radius_meters))
        ? Number(req.body.radius_meters)
        : existing.radius_meters,
      active: req.body?.active !== undefined ? Boolean(req.body.active) : existing.active,
      admin_approved:
        req.body?.admin_approved !== undefined
          ? Boolean(req.body.admin_approved)
          : existing.admin_approved,
      coverage_notes:
        req.body?.coverage_notes !== undefined
          ? cleanStr(req.body.coverage_notes, 240)
          : existing.coverage_notes,
    });

    recordActivity(
      req.admin!.username,
      'Updated Bengaluru locality',
      updated.name,
      `active=${existing.active}`,
      `active=${updated.active}, region=${updated.region}`
    );
    res.json({ locality: updated });
  });

  app.patch('/api/admin/locality-suggestions/:id', requireAdminAuth, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const action = cleanStr(req.body?.status, 20);
    if (!Number.isInteger(id) || (action !== 'approved' && action !== 'rejected')) {
      res.status(400).json({ error: 'Valid suggestion ID and status (approved/rejected) are required.' });
      return;
    }

    const db = getDb();
    const row = db.prepare('SELECT * FROM locality_suggestions WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      res.status(404).json({ error: 'Locality suggestion not found.' });
      return;
    }

    const now = Date.now();
    db.prepare('UPDATE locality_suggestions SET status = ?, reviewed_at = ? WHERE id = ?').run(
      action,
      now,
      id
    );

    let createdLocality = null;
    if (action === 'approved') {
      const lat = Number.isFinite(Number(req.body?.lat)) ? Number(req.body.lat) : 12.9716;
      const lng = Number.isFinite(Number(req.body?.lng)) ? Number(req.body.lng) : 77.5946;
      const rawRegion = String(row.region || 'Outer Bengaluru');
      const region = (
        VALID_REGION_SET.has(rawRegion) ? rawRegion : 'Outer Bengaluru'
      ) as BengaluruRegion;
      let alt: string[] = [];
      try {
        alt = JSON.parse(String(row.alt_spellings_json || '[]'));
      } catch {
        alt = [];
      }
      createdLocality = createOrUpdateLocalityInDb({
        name: String(row.name),
        region,
        alt_spellings: alt,
        lat,
        lng,
        radius_meters: Number(req.body?.radius_meters) || 2800,
        active: true,
        admin_approved: true,
        coverage_notes: String(row.notes || ''),
      });
    }

    recordActivity(
      req.admin!.username,
      `Locality suggestion ${action}`,
      String(row.name),
      'pending',
      action
    );
    res.json({ ok: true, locality: createdLocality });
  });

  app.post('/api/admin/discovery/run', requireAdminAuth, async (req: Request, res: Response) => {
    const rawScope = cleanStr(req.body?.scope, 30) || 'locality';
    const allowedScopes = new Set(['locality', 'region', 'all', 'retry_failed', 'refresh']);
    if (!allowedScopes.has(rawScope)) {
      res.status(400).json({ error: 'Invalid discovery job scope.' });
      return;
    }
    const targetKey = cleanStr(req.body?.target, 100);
    const result = await startBatchDiscoveryJob({
      scope: rawScope as 'locality' | 'region' | 'all' | 'retry_failed' | 'refresh',
      targetKey,
    });

    if ('error' in result) {
      res.status(result.status >= 400 ? result.status : 200).json(result);
      return;
    }

    recordActivity(
      req.admin!.username,
      'Ran Bengaluru locality discovery',
      targetKey || rawScope,
      '',
      `${result.calls_made} calls · ${result.new_places} new places`
    );
    res.json({ ok: true, job: result });
  });

  app.post('/api/admin/discovery/pause', requireAdminAuth, (req: Request, res: Response) => {
    const paused = Boolean(req.body?.paused);
    const settings = updateDiscoverySettingsInDb({ paused });
    recordActivity(
      req.admin!.username,
      paused ? 'Paused locality discovery' : 'Resumed locality discovery',
      'Discovery Scheduler',
      String(!paused),
      String(paused)
    );
    res.json({ settings });
  });

  app.patch('/api/admin/discovery/settings', requireAdminAuth, (req: Request, res: Response) => {
    const settings = updateDiscoverySettingsInDb({
      scheduler_enabled:
        req.body?.scheduler_enabled !== undefined ? Boolean(req.body.scheduler_enabled) : undefined,
      paused: req.body?.paused !== undefined ? Boolean(req.body.paused) : undefined,
      interval_minutes: req.body?.interval_minutes,
      daily_call_cap: req.body?.daily_call_cap,
      max_calls_per_run: req.body?.max_calls_per_run,
      pages_per_query_cap: req.body?.pages_per_query_cap,
      stale_after_days: req.body?.stale_after_days,
      include_nearby_distance_sweep:
        req.body?.include_nearby_distance_sweep !== undefined
          ? Boolean(req.body.include_nearby_distance_sweep)
          : undefined,
    });
    recordActivity(
      req.admin!.username,
      'Updated discovery schedule & budget caps',
      'Discovery Settings',
      '',
      `daily=${settings.daily_call_cap}, run=${settings.max_calls_per_run}`
    );
    res.json({ settings });
  });

  app.post('/api/admin/discovery/cache-purge', requireAdminAuth, (req: Request, res: Response) => {
    const removed = purgeExpiredPlacesTransientCache();
    recordActivity(
      req.admin!.username,
      'Purged expired Places transient cache',
      'places_transient_cache',
      '',
      `${removed} expired rows removed`
    );
    res.json({ ok: true, removed });
  });

  app.get('/api/admin/discovery/places', requireAdminAuth, (req: Request, res: Response) => {
    const localityId = req.query.localityId ? Number(req.query.localityId) : null;
    const region = cleanStr(req.query.region, 60);
    const category = cleanStr(req.query.category, 60);
    const duplicateStatus = cleanStr(req.query.duplicateStatus, 30);

    const refs = listDiscoveredPlaceRefsHydrated({
      localityId: localityId && Number.isInteger(localityId) ? localityId : null,
      region: region || undefined,
      category: category || undefined,
      duplicateStatus: duplicateStatus || undefined,
      limit: 160,
    });

    res.json({ places: refs, total: refs.length });
  });

  app.patch('/api/admin/discovery/places/:placeId', requireAdminAuth, (req: Request, res: Response) => {
    const placeId = cleanStr(req.params.placeId, 160);
    const db = getDb();
    const existing = db
      .prepare('SELECT * FROM discovery_place_refs WHERE place_id = ?')
      .get(placeId) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Place reference not found.' });
      return;
    }

    const action = cleanStr(req.body?.action, 30);
    if (action === 'promote') {
      const cat = cleanStr(req.body?.cafedesk_category, 60);
      const result = promotePlaceRefToCafeCatalog(
        placeId,
        req.admin!.username,
        cat && VALID_CAT_SET.has(cat) ? cat : undefined
      );
      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      recordActivity(
        req.admin!.username,
        'Promoted discovered place to catalog',
        placeId,
        '',
        result.cafeId
      );
      res.json({ ok: true, cafeId: result.cafeId });
      return;
    }

    const nextCategory = cleanStr(req.body?.cafedesk_category, 60);
    const nextDupStatus = cleanStr(req.body?.duplicate_review_status, 30);
    const nextActive = req.body?.active !== undefined ? (Boolean(req.body.active) ? 1 : 0) : null;

    if (nextCategory && VALID_CAT_SET.has(nextCategory)) {
      db.prepare('UPDATE discovery_place_refs SET cafedesk_category = ? WHERE place_id = ?').run(
        nextCategory,
        placeId
      );
    }
    if (
      nextDupStatus &&
      ['clean', 'needs_review', 'merged', 'distinct_branch'].includes(nextDupStatus)
    ) {
      db.prepare('UPDATE discovery_place_refs SET duplicate_review_status = ? WHERE place_id = ?').run(
        nextDupStatus,
        placeId
      );
    }
    if (nextActive !== null) {
      db.prepare('UPDATE discovery_place_refs SET active = ? WHERE place_id = ?').run(
        nextActive,
        placeId
      );
    }

    if (existing.primary_locality_id) {
      const loc = getLocalityByIdOrSlugFromDb(Number(existing.primary_locality_id));
      if (loc) {
        const cnt = db
          .prepare(
            "SELECT COUNT(*) as c FROM discovery_place_refs WHERE primary_locality_id = ? AND active = 1 AND duplicate_review_status != 'merged'"
          )
          .get(loc.id) as { c?: number };
        db.prepare('UPDATE localities SET unique_place_count = ? WHERE id = ?').run(
          Number(cnt?.c ?? 0),
          loc.id
        );
      }
    }

    recordActivity(
      req.admin!.username,
      'Updated discovered place ref',
      placeId,
      String(existing.cafedesk_category),
      nextCategory || nextDupStatus || 'updated'
    );
    res.json({ ok: true });
  });
}

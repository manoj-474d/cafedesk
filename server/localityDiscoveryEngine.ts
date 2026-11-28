import {
  BENGALURU_REGIONS,
  classifyGooglePlaceCategory,
  LOCALITY_SEARCH_QUERIES,
  type BengaluruRegion,
  type LocalityQueryDefinition,
} from '../src/config/localities.ts';
import type {
  BengaluruRegionName,
  DiscoveryJobRecord,
  DiscoveryPlaceRefRecord,
  LocalityCoverageOverview,
  LocalityRecord,
  LocationItem,
  RegionCoverageStat,
} from '../src/types/cms.ts';
import { computeDistanceKm } from '../src/utils/cafeHelpers.ts';
import {
  createOrUpdateLocalityInDb,
  getDb,
  getDiscoverySettingsFromDb,
  getLocalityByIdOrSlugFromDb,
  getSiteSettingsFromDb,
  getTransientPlaceSnapshot,
  listDiscoveryJobLogsFromDb,
  listDiscoveryJobsFromDb,
  listLocalitiesFromDb,
  listLocalitySuggestionsFromDb,
  listLocationsFromDb,
  logPlacesApiCall,
  purgeExpiredPlacesTransientCache,
  saveTransientPlaceSnapshot,
  updateDiscoverySettingsInDb,
} from './db.ts';
import {
  callGooglePlacesJson,
  getPlacesApiKey,
  mapRawGooglePlace,
  PLACES_DETAIL_FIELDMASK,
  PLACES_SEARCH_FIELDMASK,
  type PlaceSearchResult,
} from './placesDiscoveryRoutes.ts';

const COST_PER_ENTERPRISE_SEARCH_CALL_USD = 0.035;
const COST_PER_ENTERPRISE_DETAIL_CALL_USD = 0.02;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalizeBusinessName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(the|cafe|coffee|house|shop|bakery|tea|chai|restaurant|express|bengaluru|bangalore|indiranagar|koramangala)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenJaccardSimilarity(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter((t) => t.length >= 2));
  const tb = new Set(b.split(/\s+/).filter((t) => t.length >= 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection += 1;
  }
  const union = ta.size + tb.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function parseJsonSafe<T>(raw: unknown, fallback: T): T {
  try {
    if (typeof raw !== 'string' || !raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getCallsInLast24h(): number {
  const db = getDb();
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const row = db
    .prepare('SELECT COUNT(*) AS cnt FROM places_api_logs WHERE created_at >= ? AND cached = 0')
    .get(since) as { cnt?: number } | undefined;
  return Number(row?.cnt ?? 0);
}

/**
 * Two-tier deduplication:
 * 1) Exact match on Google place_id -> merge category/query/locality tags, never create duplicate row.
 * 2) Proximity + name similarity check -> ONLY flag `needs_review` when BOTH:
 *    - distanceKm <= 0.12 (120 meters)
 *    - normalized name similarity >= 0.78
 *    Distinct branches of chains (>150m apart) ALWAYS stay clean & separate!
 */
export function evaluateDuplicateAgainstExisting(
  place: PlaceSearchResult,
  curatedCafes: LocationItem[]
): {
  duplicateStatus: 'clean' | 'needs_review';
  possibleCafeId: string;
  possiblePlaceId: string;
  confidence: number;
} {
  const normNew = normalizeBusinessName(place.name);
  if (!normNew) {
    return { duplicateStatus: 'clean', possibleCafeId: '', possiblePlaceId: '', confidence: 1.0 };
  }

  for (const cafe of curatedCafes) {
    if (cafe.place_id && cafe.place_id === place.placeId) {
      return { duplicateStatus: 'clean', possibleCafeId: cafe.id, possiblePlaceId: '', confidence: 1.0 };
    }
    if (cafe.lat === null || cafe.lng === null) continue;
    const dist = computeDistanceKm(cafe.lat, cafe.lng, place.lat, place.lng);
    if (dist <= 0.12) {
      const sim = tokenJaccardSimilarity(normNew, normalizeBusinessName(cafe.name));
      if (sim >= 0.78 || cafe.name.toLowerCase().trim() === place.name.toLowerCase().trim()) {
        return {
          duplicateStatus: 'needs_review',
          possibleCafeId: cafe.id,
          possiblePlaceId: '',
          confidence: Number(sim.toFixed(2)),
        };
      }
    }
  }

  // Check against other already indexed discovery_place_refs via transient spatial coordinates
  const db = getDb();
  const nearbyCached = db
    .prepare(
      `SELECT pt.place_id, pt.payload_json, pt.lat, pt.lng
       FROM places_transient_cache pt
       WHERE pt.place_id != ?
         AND pt.lat BETWEEN ? AND ?
         AND pt.lng BETWEEN ? AND ?
         AND pt.expires_at > ?
       LIMIT 40`
    )
    .all(
      place.placeId,
      place.lat - 0.0015,
      place.lat + 0.0015,
      place.lng - 0.0015,
      place.lng + 0.0015,
      Date.now()
    ) as Array<{ place_id: string; payload_json: string; lat: number; lng: number }>;

  for (const other of nearbyCached) {
    const dist = computeDistanceKm(other.lat, other.lng, place.lat, place.lng);
    if (dist <= 0.12) {
      const parsed = parseJsonSafe<{ name?: string }>(other.payload_json, {});
      const otherName = String(parsed.name || '');
      const sim = tokenJaccardSimilarity(normNew, normalizeBusinessName(otherName));
      if (sim >= 0.8) {
        return {
          duplicateStatus: 'needs_review',
          possibleCafeId: '',
          possiblePlaceId: other.place_id,
          confidence: Number(sim.toFixed(2)),
        };
      }
    }
  }

  return { duplicateStatus: 'clean', possibleCafeId: '', possiblePlaceId: '', confidence: 1.0 };
}

function upsertDiscoveredPlaceRef(
  place: PlaceSearchResult,
  locality: LocalityRecord,
  queryTag: string,
  curatedCafes: LocationItem[]
): { isNew: boolean; duplicateFlagged: boolean } {
  const db = getDb();
  const now = Date.now();
  const classifiedCategory = classifyGooglePlaceCategory(
    place.primaryType,
    place.types,
    place.name
  );

  // Store transient display payload (< 24h TTL) strictly in places_transient_cache
  saveTransientPlaceSnapshot(
    place.placeId,
    {
      name: place.name,
      address: place.address,
      areaLabel: locality.name || place.areaLabel,
      lat: place.lat,
      lng: place.lng,
      rating: place.rating,
      ratingCount: place.ratingCount,
      openingHours: place.openingHours,
      priceLevelLabel: place.priceLevelLabel,
      websiteUrl: place.websiteUrl,
      phone: place.phone,
      viewMapUrl: place.viewMapUrl,
      mapLink: place.mapLink,
      photos: place.photos,
      cachedAt: now,
    },
    place.lat,
    place.lng
  );

  const existing = db
    .prepare('SELECT * FROM discovery_place_refs WHERE place_id = ?')
    .get(place.placeId) as Record<string, unknown> | undefined;

  if (existing) {
    const secIds = new Set<number>(parseJsonSafe<number[]>(existing.secondary_locality_ids_json, []));
    const primaryLocId = existing.primary_locality_id ? Number(existing.primary_locality_id) : null;
    if (primaryLocId && primaryLocId !== locality.id) {
      secIds.add(locality.id);
    }
    const tags = new Set<string>(parseJsonSafe<string[]>(existing.source_query_tags_json, []));
    tags.add(queryTag);
    const cats = new Set<string>(parseJsonSafe<string[]>(existing.discovered_categories_json, []));
    cats.add(classifiedCategory);
    const mergedTypes = new Set<string>(parseJsonSafe<string[]>(existing.types_json, []));
    for (const t of place.types) mergedTypes.add(t);

    db.prepare(
      `UPDATE discovery_place_refs SET
        primary_locality_id = COALESCE(primary_locality_id, ?),
        secondary_locality_ids_json = ?,
        primary_type = CASE WHEN primary_type = '' THEN ? ELSE primary_type END,
        types_json = ?,
        source_query_tags_json = ?,
        discovered_categories_json = ?,
        discovery_count = discovery_count + 1,
        last_seen_at = ?
       WHERE place_id = ?`
    ).run(
      locality.id,
      JSON.stringify(Array.from(secIds)),
      place.primaryType,
      JSON.stringify(Array.from(mergedTypes).slice(0, 16)),
      JSON.stringify(Array.from(tags).slice(0, 20)),
      JSON.stringify(Array.from(cats).slice(0, 12)),
      now,
      place.placeId
    );
    return { isNew: false, duplicateFlagged: false };
  }

  const dup = evaluateDuplicateAgainstExisting(place, curatedCafes);
  db.prepare(
    `INSERT INTO discovery_place_refs (
      place_id, primary_locality_id, secondary_locality_ids_json, cafedesk_category,
      primary_type, types_json, source_query_tags_json, discovered_categories_json,
      match_confidence, duplicate_review_status, possible_duplicate_of_cafe_id,
      possible_duplicate_of_place_id, promoted_cafe_id, discovery_count,
      first_discovered_at, last_seen_at, active
    ) VALUES (?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 1, ?, ?, 1)`
  ).run(
    place.placeId,
    locality.id,
    classifiedCategory,
    place.primaryType,
    JSON.stringify(place.types.slice(0, 16)),
    JSON.stringify([queryTag]),
    JSON.stringify([classifiedCategory]),
    dup.confidence,
    dup.duplicateStatus,
    dup.possibleCafeId,
    dup.possiblePlaceId,
    now,
    now
  );

  return { isNew: true, duplicateFlagged: dup.duplicateStatus === 'needs_review' };
}

function refreshLocalityCounters(localityId: number): void {
  const db = getDb();
  const uniqueRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt,
              SUM(CASE WHEN duplicate_review_status = 'needs_review' THEN 1 ELSE 0 END) AS dup_cnt
       FROM discovery_place_refs
       WHERE primary_locality_id = ? AND active = 1 AND duplicate_review_status != 'merged'`
    )
    .get(localityId) as { cnt?: number; dup_cnt?: number } | undefined;

  db.prepare(
    `UPDATE localities SET
      unique_place_count = ?,
      duplicate_count = ?,
      updated_at = ?
     WHERE id = ?`
  ).run(Number(uniqueRow?.cnt ?? 0), Number(uniqueRow?.dup_cnt ?? 0), Date.now(), localityId);
}

let activeDiscoveryRunPromise: Promise<DiscoveryJobRecord | null> | null = null;

export function isDiscoveryRunActive(): boolean {
  return activeDiscoveryRunPromise !== null;
}

export async function runLocalityDiscoverySweep(options: {
  locality: LocalityRecord;
  jobId: number;
  maxCallsRemaining: number;
  queriesSubset?: LocalityQueryDefinition[];
}): Promise<{
  callsMade: number;
  placesSeen: number;
  newPlaces: number;
  duplicatesFlagged: number;
  failedQueries: number;
  quotaHit: boolean;
  lastError: string;
}> {
  const apiKey = getPlacesApiKey();
  if (!apiKey) {
    return {
      callsMade: 0,
      placesSeen: 0,
      newPlaces: 0,
      duplicatesFlagged: 0,
      failedQueries: 1,
      quotaHit: false,
      lastError: 'Google Places API key is not configured on the server.',
    };
  }

  const db = getDb();
  const settings = getDiscoverySettingsFromDb();
  const curatedCafes = listLocationsFromDb(true);
  const queriesToRun = options.queriesSubset
    ? options.queriesSubset
    : settings.include_nearby_distance_sweep
    ? LOCALITY_SEARCH_QUERIES
    : LOCALITY_SEARCH_QUERIES.filter((q) => q.mode === 'text');

  db.prepare("UPDATE localities SET discovery_status = 'running', updated_at = ? WHERE id = ?").run(
    Date.now(),
    options.locality.id
  );

  const completedCats = new Set<string>(options.locality.categories_completed);
  const failedCats = new Set<string>(options.locality.categories_failed);

  let callsMade = 0;
  let placesSeen = 0;
  let newPlaces = 0;
  let duplicatesFlagged = 0;
  let failedQueries = 0;
  let quotaHit = false;
  let lastError = '';

  const logStep = db.prepare(
    `INSERT INTO discovery_job_logs
      (job_id, locality_slug, query_label, endpoint, page_num, results_count, new_count, status_code, error_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const qDef of queriesToRun) {
    if (callsMade >= options.maxCallsRemaining || quotaHit) break;
    const latestSettings = getDiscoverySettingsFromDb();
    if (latestSettings.paused) break;

    if (qDef.mode === 'text' && qDef.buildTextQuery) {
      const textQuery = qDef.buildTextQuery(options.locality.name);
      let pageToken: string | null = null;
      let pageNum = 0;
      let queryErrored = false;

      while (pageNum < settings.pages_per_query_cap && callsMade < options.maxCallsRemaining && !quotaHit) {
        pageNum += 1;
        if (pageNum > 1 && !pageToken) break;
        if (pageNum > 1) await sleep(220);

        const body: Record<string, unknown> = {
          textQuery,
          pageSize: 20,
          regionCode: 'IN',
          languageCode: 'en',
          locationBias: {
            circle: {
              center: { latitude: options.locality.lat, longitude: options.locality.lng },
              radius: Math.min(25000, Math.max(1200, options.locality.radius_meters)),
            },
          },
        };
        if (qDef.includedType) {
          body.includedType = qDef.includedType;
        }
        if (pageToken) {
          body.pageToken = pageToken;
        }

        callsMade += 1;
        const apiRes = await callGooglePlacesJson(
          'https://places.googleapis.com/v1/places:searchText',
          {
            method: 'POST',
            apiKey,
            fieldMask: PLACES_SEARCH_FIELDMASK,
            body,
          }
        );

        logPlacesApiCall({
          endpoint: 'locality_searchText',
          queryText: `${textQuery} (p${pageNum})`,
          statusCode: apiRes.status,
          cached: false,
          resultCount: Array.isArray(apiRes.data.places) ? apiRes.data.places.length : 0,
          errorMessage: apiRes.errorText,
        });

        if (!apiRes.ok) {
          queryErrored = true;
          failedQueries += 1;
          lastError = apiRes.errorText;
          if (apiRes.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(apiRes.errorText)) {
            quotaHit = true;
          }
          logStep.run(
            options.jobId,
            options.locality.slug,
            qDef.label,
            'places:searchText',
            pageNum,
            0,
            0,
            apiRes.status,
            apiRes.errorText,
            Date.now()
          );
          break;
        }

        const rawPlaces = Array.isArray(apiRes.data.places)
          ? (apiRes.data.places as Array<Record<string, unknown>>)
          : [];
        let pageNew = 0;
        for (const rawP of rawPlaces) {
          const mapped = mapRawGooglePlace(rawP, options.locality.name, {
            lat: options.locality.lat,
            lng: options.locality.lng,
          });
          if (!mapped) continue;
          placesSeen += 1;
          const up = upsertDiscoveredPlaceRef(mapped, options.locality, qDef.id, curatedCafes);
          if (up.isNew) {
            newPlaces += 1;
            pageNew += 1;
          }
          if (up.duplicateFlagged) duplicatesFlagged += 1;
        }

        logStep.run(
          options.jobId,
          options.locality.slug,
          qDef.label,
          'places:searchText',
          pageNum,
          rawPlaces.length,
          pageNew,
          200,
          '',
          Date.now()
        );

        pageToken = typeof apiRes.data.nextPageToken === 'string' && apiRes.data.nextPageToken ? apiRes.data.nextPageToken : null;
        if (!pageToken) break;
      }

      if (queryErrored) {
        failedCats.add(qDef.id);
      } else {
        completedCats.add(qDef.id);
        failedCats.delete(qDef.id);
      }
    } else if (qDef.mode === 'nearby' && qDef.includedPrimaryTypes) {
      // Distance-based nearby sweep covering main center + subzones to surface small local shops
      const zones =
        options.locality.subzones.length > 0
          ? options.locality.subzones
          : [
              {
                label: options.locality.name,
                lat: options.locality.lat,
                lng: options.locality.lng,
                radiusMeters: options.locality.radius_meters,
              },
            ];

      let zoneErrored = false;
      for (const zone of zones) {
        if (callsMade >= options.maxCallsRemaining || quotaHit) break;
        callsMade += 1;
        const apiRes = await callGooglePlacesJson(
          'https://places.googleapis.com/v1/places:searchNearby',
          {
            method: 'POST',
            apiKey,
            fieldMask: PLACES_SEARCH_FIELDMASK.replace(',nextPageToken', ''),
            body: {
              includedPrimaryTypes: qDef.includedPrimaryTypes,
              maxResultCount: 20,
              rankPreference: 'DISTANCE',
              languageCode: 'en',
              regionCode: 'IN',
              locationRestriction: {
                circle: {
                  center: { latitude: zone.lat, longitude: zone.lng },
                  radius: Math.min(20000, Math.max(800, zone.radiusMeters)),
                },
              },
            },
          }
        );

        logPlacesApiCall({
          endpoint: 'locality_searchNearby',
          queryText: `${options.locality.name}: ${zone.label}`,
          statusCode: apiRes.status,
          cached: false,
          resultCount: Array.isArray(apiRes.data.places) ? apiRes.data.places.length : 0,
          errorMessage: apiRes.errorText,
        });

        if (!apiRes.ok) {
          zoneErrored = true;
          failedQueries += 1;
          lastError = apiRes.errorText;
          if (apiRes.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(apiRes.errorText)) {
            quotaHit = true;
          }
          logStep.run(
            options.jobId,
            options.locality.slug,
            `${qDef.label} (${zone.label})`,
            'places:searchNearby',
            1,
            0,
            0,
            apiRes.status,
            apiRes.errorText,
            Date.now()
          );
          continue;
        }

        const rawPlaces = Array.isArray(apiRes.data.places)
          ? (apiRes.data.places as Array<Record<string, unknown>>)
          : [];
        let zoneNew = 0;
        for (const rawP of rawPlaces) {
          const mapped = mapRawGooglePlace(rawP, options.locality.name, {
            lat: options.locality.lat,
            lng: options.locality.lng,
          });
          if (!mapped) continue;
          placesSeen += 1;
          const up = upsertDiscoveredPlaceRef(mapped, options.locality, qDef.id, curatedCafes);
          if (up.isNew) {
            newPlaces += 1;
            zoneNew += 1;
          }
          if (up.duplicateFlagged) duplicatesFlagged += 1;
        }
        logStep.run(
          options.jobId,
          options.locality.slug,
          `${qDef.label} (${zone.label})`,
          'places:searchNearby',
          1,
          rawPlaces.length,
          zoneNew,
          200,
          '',
          Date.now()
        );
      }

      if (zoneErrored) {
        failedCats.add(qDef.id);
      } else {
        completedCats.add(qDef.id);
        failedCats.delete(qDef.id);
      }
    }
  }

  refreshLocalityCounters(options.locality.id);

  const totalExpected = LOCALITY_SEARCH_QUERIES.length;
  const progressPct = Math.min(100, Math.round((completedCats.size / totalExpected) * 100));
  const status: LocalityRecord['discovery_status'] =
    completedCats.size === totalExpected && failedCats.size === 0
      ? 'completed'
      : completedCats.size > 0
      ? 'partial'
      : 'failed';

  const nextRetryCount = status === 'failed' || quotaHit ? options.locality.retry_count + 1 : 0;
  const backoffMinutes = Math.min(720, 15 * 2 ** Math.min(5, nextRetryCount));
  const nextRetryAt =
    status === 'failed' || status === 'partial' || quotaHit
      ? Date.now() + backoffMinutes * 60 * 1000
      : null;

  const now = Date.now();
  db.prepare(
    `UPDATE localities SET
      discovery_status = ?,
      last_discovery_at = ?,
      discovery_progress = ?,
      categories_completed_json = ?,
      categories_failed_json = ?,
      discovered_count = discovered_count + ?,
      last_error = ?,
      retry_count = ?,
      next_retry_at = ?,
      updated_at = ?
     WHERE id = ?`
  ).run(
    status,
    now,
    progressPct,
    JSON.stringify(Array.from(completedCats)),
    JSON.stringify(Array.from(failedCats)),
    placesSeen,
    lastError.slice(0, 300),
    nextRetryCount,
    nextRetryAt,
    now,
    options.locality.id
  );

  return {
    callsMade,
    placesSeen,
    newPlaces,
    duplicatesFlagged,
    failedQueries,
    quotaHit,
    lastError,
  };
}

export async function startBatchDiscoveryJob(params: {
  scope: DiscoveryJobRecord['scope'];
  targetKey?: string;
}): Promise<DiscoveryJobRecord | { error: string; status: number }> {
  if (activeDiscoveryRunPromise) {
    return { error: 'A discovery job is already running. Please wait for it to finish.', status: 409 };
  }

  const settings = getDiscoverySettingsFromDb();
  if (settings.paused) {
    return { error: 'Discovery is currently paused in Admin controls. Resume discovery to run jobs.', status: 400 };
  }

  const apiKey = getPlacesApiKey();
  if (!apiKey) {
    return { error: 'Google Places API key is not configured on the server.', status: 503 };
  }

  const calls24h = getCallsInLast24h();
  const remainingDailyBudget = Math.max(0, settings.daily_call_cap - calls24h);
  if (remainingDailyBudget <= 0) {
    return {
      error: `Daily API call cap (${settings.daily_call_cap}) reached. Increase cap in Discovery Settings or wait for the 24h rolling window.`,
      status: 429,
    };
  }

  const allLocalities = listLocalitiesFromDb({ activeOnly: true, approvedOnly: true });
  const now = Date.now();
  const staleCutoff = now - settings.stale_after_days * 24 * 60 * 60 * 1000;

  let targets: LocalityRecord[] = [];
  if (params.scope === 'locality' && params.targetKey) {
    const loc = getLocalityByIdOrSlugFromDb(params.targetKey);
    if (!loc) return { error: 'Target locality not found.', status: 404 };
    targets = [loc];
  } else if (params.scope === 'region' && params.targetKey) {
    targets = allLocalities.filter((l) => l.region === params.targetKey);
    if (targets.length === 0) return { error: 'No active localities found in that region.', status: 404 };
  } else if (params.scope === 'retry_failed') {
    targets = allLocalities.filter(
      (l) => l.discovery_status === 'failed' || l.discovery_status === 'partial'
    );
  } else if (params.scope === 'refresh') {
    targets = [...allLocalities].sort(
      (a, b) => (a.last_discovery_at ?? 0) - (b.last_discovery_at ?? 0)
    );
  } else if (params.scope === 'scheduled') {
    // Priority: 1. Newly added / pending -> 2. Failed due for retry -> 3. Stale
    const pending = allLocalities.filter((l) => l.discovery_status === 'pending');
    const retryDue = allLocalities.filter(
      (l) =>
        (l.discovery_status === 'failed' || l.discovery_status === 'partial') &&
        (!l.next_retry_at || l.next_retry_at <= now)
    );
    const stale = allLocalities
      .filter((l) => l.last_discovery_at !== null && l.last_discovery_at < staleCutoff)
      .sort((a, b) => (a.last_discovery_at ?? 0) - (b.last_discovery_at ?? 0));
    targets = [...pending, ...retryDue, ...stale];
  } else {
    // 'all': prioritize pending, then partial/failed, then oldest
    const pending = allLocalities.filter((l) => l.discovery_status === 'pending');
    const partial = allLocalities.filter(
      (l) => l.discovery_status === 'partial' || l.discovery_status === 'failed'
    );
    const completed = allLocalities
      .filter((l) => l.discovery_status === 'completed')
      .sort((a, b) => (a.last_discovery_at ?? 0) - (b.last_discovery_at ?? 0));
    targets = [...pending, ...partial, ...completed];
  }

  if (targets.length === 0) {
    return { error: 'No localities currently need discovery for this scope.', status: 200 };
  }

  const db = getDb();
  const jobInsert = db
    .prepare(
      `INSERT INTO discovery_jobs
        (scope, target_key, status, calls_made, cache_hits, places_seen, new_places, duplicates_flagged, failed_queries, estimated_cost_usd, error_summary, started_at)
       VALUES (?, ?, 'running', 0, 0, 0, 0, 0, 0, 0, '', ?)`
    )
    .run(params.scope, params.targetKey || '', now);

  const jobId = Number(jobInsert.lastInsertRowid);
  const runBudgetCap = Math.min(remainingDailyBudget, settings.max_calls_per_run);

  const runner = (async (): Promise<DiscoveryJobRecord> => {
    let callsUsed = 0;
    let totalSeen = 0;
    let totalNew = 0;
    let totalDup = 0;
    let totalFailed = 0;
    let quotaStopped = false;
    let lastErr = '';

    for (const loc of targets) {
      const liveSettings = getDiscoverySettingsFromDb();
      if (liveSettings.paused || callsUsed >= runBudgetCap || quotaStopped) break;

      const res = await runLocalityDiscoverySweep({
        locality: loc,
        jobId,
        maxCallsRemaining: runBudgetCap - callsUsed,
      });

      callsUsed += res.callsMade;
      totalSeen += res.placesSeen;
      totalNew += res.newPlaces;
      totalDup += res.duplicatesFlagged;
      totalFailed += res.failedQueries;
      if (res.lastError) lastErr = res.lastError;
      if (res.quotaHit) quotaStopped = true;
    }

    const finalStatus: DiscoveryJobRecord['status'] = quotaStopped
      ? 'paused'
      : callsUsed >= runBudgetCap && targets.length > 1
      ? 'budget_stopped'
      : totalFailed > 0 && totalSeen === 0
      ? 'failed'
      : 'completed';

    if (quotaStopped) {
      updateDiscoverySettingsInDb({ paused: true });
    }

    const estCost = Number((callsUsed * COST_PER_ENTERPRISE_SEARCH_CALL_USD).toFixed(3));
    const finishedAt = Date.now();
    db.prepare(
      `UPDATE discovery_jobs SET
        status = ?, calls_made = ?, places_seen = ?, new_places = ?,
        duplicates_flagged = ?, failed_queries = ?, estimated_cost_usd = ?,
        error_summary = ?, finished_at = ?
       WHERE id = ?`
    ).run(
      finalStatus,
      callsUsed,
      totalSeen,
      totalNew,
      totalDup,
      totalFailed,
      estCost,
      lastErr.slice(0, 300),
      finishedAt,
      jobId
    );

    const jobRow = listDiscoveryJobsFromDb(1)[0];
    return jobRow;
  })().finally(() => {
    activeDiscoveryRunPromise = null;
  });

  activeDiscoveryRunPromise = runner;
  return await runner;
}

export function listDiscoveredPlaceRefsHydrated(filters?: {
  localityId?: number | null;
  region?: string;
  category?: string;
  duplicateStatus?: string;
  limit?: number;
}): DiscoveryPlaceRefRecord[] {
  const db = getDb();
  const clauses: string[] = ['r.active = 1'];
  const params: Array<string | number> = [];

  if (filters?.localityId) {
    clauses.push('r.primary_locality_id = ?');
    params.push(filters.localityId);
  }
  if (filters?.region && filters.region !== 'all') {
    clauses.push('l.region = ?');
    params.push(filters.region);
  }
  if (filters?.category && filters.category !== 'all') {
    clauses.push('r.cafedesk_category = ?');
    params.push(filters.category);
  }
  if (filters?.duplicateStatus && filters.duplicateStatus !== 'all') {
    clauses.push('r.duplicate_review_status = ?');
    params.push(filters.duplicateStatus);
  }

  const limit = Math.min(250, Math.max(10, filters?.limit ?? 120));
  params.push(limit);

  const rows = db
    .prepare(
      `SELECT r.*, l.name AS locality_name, l.slug AS locality_slug, l.region AS region
       FROM discovery_place_refs r
       LEFT JOIN localities l ON l.id = r.primary_locality_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY (r.duplicate_review_status = 'needs_review') DESC, r.last_seen_at DESC
       LIMIT ?`
    )
    .all(...params) as Array<Record<string, unknown>>;

  return rows.map((r) => {
    const placeId = String(r.place_id);
    const cachedDisplay = getTransientPlaceSnapshot(placeId);
    return {
      place_id: placeId,
      primary_locality_id:
        r.primary_locality_id !== null && r.primary_locality_id !== undefined
          ? Number(r.primary_locality_id)
          : null,
      locality_name: r.locality_name ? String(r.locality_name) : undefined,
      locality_slug: r.locality_slug ? String(r.locality_slug) : undefined,
      region: r.region ? (String(r.region) as BengaluruRegionName) : undefined,
      secondary_locality_ids: parseJsonSafe<number[]>(r.secondary_locality_ids_json, []),
      cafedesk_category: String(r.cafedesk_category || 'Cafe'),
      primary_type: String(r.primary_type || ''),
      types: parseJsonSafe<string[]>(r.types_json, []),
      source_query_tags: parseJsonSafe<string[]>(r.source_query_tags_json, []),
      discovered_categories: parseJsonSafe<string[]>(r.discovered_categories_json, []),
      match_confidence: Number(r.match_confidence ?? 1),
      duplicate_review_status: String(
        r.duplicate_review_status || 'clean'
      ) as DiscoveryPlaceRefRecord['duplicate_review_status'],
      possible_duplicate_of_cafe_id: String(r.possible_duplicate_of_cafe_id || ''),
      possible_duplicate_of_place_id: String(r.possible_duplicate_of_place_id || ''),
      promoted_cafe_id: String(r.promoted_cafe_id || ''),
      discovery_count: Number(r.discovery_count ?? 1),
      first_discovered_at: Number(r.first_discovered_at ?? 0),
      last_seen_at: Number(r.last_seen_at ?? 0),
      active: Boolean(r.active ?? 1),
      cached_display: cachedDisplay,
    };
  });
}

export async function rehydrateExpiredPlaceRefs(
  placeIds: string[],
  maxHydrations = 6
): Promise<number> {
  const apiKey = getPlacesApiKey();
  if (!apiKey || placeIds.length === 0) return 0;

  const settings = getDiscoverySettingsFromDb();
  if (settings.paused || getCallsInLast24h() >= settings.daily_call_cap) return 0;

  let hydrated = 0;
  for (const pid of placeIds.slice(0, maxHydrations)) {
    if (getTransientPlaceSnapshot(pid)) continue;
    const apiRes = await callGooglePlacesJson(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(pid)}`,
      {
        method: 'GET',
        apiKey,
        fieldMask: PLACES_DETAIL_FIELDMASK,
      }
    );
    logPlacesApiCall({
      endpoint: 'locality_rehydrate_detail',
      queryText: pid,
      statusCode: apiRes.status,
      cached: false,
      resultCount: apiRes.ok ? 1 : 0,
      errorMessage: apiRes.errorText,
    });
    if (!apiRes.ok) {
      if (apiRes.status === 429) break;
      continue;
    }
    const mapped = mapRawGooglePlace(apiRes.data, 'Bengaluru', null);
    if (mapped) {
      saveTransientPlaceSnapshot(
        pid,
        {
          name: mapped.name,
          address: mapped.address,
          areaLabel: mapped.areaLabel,
          lat: mapped.lat,
          lng: mapped.lng,
          rating: mapped.rating,
          ratingCount: mapped.ratingCount,
          openingHours: mapped.openingHours,
          priceLevelLabel: mapped.priceLevelLabel,
          websiteUrl: mapped.websiteUrl,
          phone: mapped.phone,
          viewMapUrl: mapped.viewMapUrl,
          mapLink: mapped.mapLink,
          photos: mapped.photos,
          cachedAt: Date.now(),
        },
        mapped.lat,
        mapped.lng
      );
      hydrated += 1;
    }
  }
  return hydrated;
}

export function buildPlaceRefLocationItem(
  ref: DiscoveryPlaceRefRecord,
  localityName: string
): LocationItem | null {
  const disp = ref.cached_display;
  if (!disp) return null;
  return {
    id: `google:${ref.place_id}`,
    slug: `google:${ref.place_id}`,
    name: disp.name,
    category: ref.cafedesk_category || 'Cafe',
    city: 'Bengaluru',
    area: localityName || disp.areaLabel || 'Bengaluru',
    address: disp.address,
    phone: disp.phone || '',
    map_link: disp.mapLink,
    website_url: disp.websiteUrl || '',
    menu_url: '',
    instagram_url: '',
    place_id: ref.place_id,
    lat: disp.lat,
    lng: disp.lng,
    timings: disp.openingHours[0] ? 'See weekly hours below' : 'Hours not available',
    description: `${disp.name} in ${localityName || disp.areaLabel} discovered via Google Places (${ref.cafedesk_category}).`,
    photos: disp.photos || [],
    photos_approved: (disp.photos || []).length > 0,
    wifi_available: 'unknown',
    wifi_mbps: null,
    charging_sockets: 'unknown',
    sockets_count: null,
    sockets_claimed: false,
    comfortable_seating: 'unknown',
    suitable_for_studying: 'unknown',
    suitable_for_working: 'unknown',
    noise_level: null,
    avg_cost_per_person: null,
    price_range: disp.priceLevelLabel || '',
    coffee_price: null,
    tea_price: null,
    snacks_price: null,
    meals_price: null,
    popular_items: [],
    rating: disp.rating,
    rating_count: disp.ratingCount,
    min_spend: null,
    laptop_friendly: false,
    time_limit: null,
    modes: ['work'],
    facilities: [],
    offers: [],
    menu_services: [],
    best_for: [ref.cafedesk_category, 'Google Places Discovery'],
    verdict:
      'Discovered via official Google Places API (New). Wi-Fi speed, plug points & menu prices are marked Not verified until reviewed.',
    avoid_if: null,
    student_discount: null,
    verified: false,
    featured: false,
    published: true,
    display_order: 999,
    last_verified_date: null,
    claims: ['Place listing sourced from Google Places API (New).'],
    source_name: 'Google Places Discovery',
    source_url: disp.viewMapUrl || disp.mapLink,
    source_type: 'google_places',
    opening_hours_list: disp.openingHours || [],
    price_level_label: disp.priceLevelLabel || '',
    isLiveGooglePlace: true,
    sample: false,
  };
}

export function buildLocalityCoverageOverview(): LocalityCoverageOverview {
  const db = getDb();
  const hasServerKey = Boolean(getPlacesApiKey());
  const localities = listLocalitiesFromDb({ activeOnly: false, approvedOnly: false });
  const curated = listLocationsFromDb(false);
  const suggestions = listLocalitySuggestionsFromDb();
  const settings = getDiscoverySettingsFromDb();
  const recentJobs = listDiscoveryJobsFromDb(15);
  const recentLogs = listDiscoveryJobLogsFromDb(40);
  const calls24h = getCallsInLast24h();

  const now = Date.now();
  const cacheStats = db
    .prepare(
      `SELECT
         COUNT(*) AS total_cnt,
         SUM(CASE WHEN expires_at <= ? THEN 1 ELSE 0 END) AS expired_cnt
       FROM places_transient_cache`
    )
    .get(now) as { total_cnt?: number; expired_cnt?: number } | undefined;

  const refsStats = db
    .prepare(
      `SELECT
         COUNT(*) AS total_refs,
         SUM(CASE WHEN duplicate_review_status = 'needs_review' THEN 1 ELSE 0 END) AS dup_cnt
       FROM discovery_place_refs WHERE active = 1 AND duplicate_review_status != 'merged'`
    )
    .get() as { total_refs?: number; dup_cnt?: number } | undefined;

  const catBreakdownRows = db
    .prepare(
      `SELECT cafedesk_category AS category, COUNT(*) AS cnt
       FROM discovery_place_refs
       WHERE active = 1 AND duplicate_review_status != 'merged'
       GROUP BY cafedesk_category
       ORDER BY cnt DESC`
    )
    .all() as Array<{ category: string; cnt: number }>;

  const regionStats: RegionCoverageStat[] = BENGALURU_REGIONS.map((region: BengaluruRegion) => {
    const inRegion = localities.filter((l) => l.region === region);
    const activeLocs = inRegion.filter((l) => l.active);
    const completed = inRegion.filter((l) => l.discovery_status === 'completed').length;
    const partial = inRegion.filter((l) => l.discovery_status === 'partial').length;
    const failed = inRegion.filter((l) => l.discovery_status === 'failed').length;
    const pending = inRegion.filter((l) => l.discovery_status === 'pending').length;
    const uniquePlaces = inRegion.reduce((acc, l) => acc + l.unique_place_count, 0);
    const regionLocNames = new Set(inRegion.map((l) => l.name.toLowerCase()));
    const curatedInRegion = curated.filter((c) => regionLocNames.has(c.area.toLowerCase())).length;
    const avgProgress =
      activeLocs.length > 0
        ? Math.round(activeLocs.reduce((acc, l) => acc + l.discovery_progress, 0) / activeLocs.length)
        : 0;
    return {
      region,
      total_localities: inRegion.length,
      active_localities: activeLocs.length,
      completed_localities: completed,
      partial_localities: partial,
      failed_localities: failed,
      pending_localities: pending,
      unique_places_indexed: uniquePlaces,
      curated_cafes_count: curatedInRegion,
      avg_progress: avgProgress,
    };
  });

  const incompleteLocalities = localities
    .filter((l) => l.active && l.discovery_status !== 'completed')
    .map((l) => ({
      slug: l.slug,
      name: l.name,
      region: l.region,
      status: l.discovery_status,
      progress: l.discovery_progress,
      failed_categories: l.categories_failed,
      last_error: l.last_error,
    }));

  const estCost24h = Number(
    (calls24h * ((COST_PER_ENTERPRISE_SEARCH_CALL_USD + COST_PER_ENTERPRISE_DETAIL_CALL_USD) / 2)).toFixed(2)
  );

  return {
    regions: regionStats,
    localities,
    suggestions,
    settings,
    recent_jobs: recentJobs,
    recent_logs: recentLogs,
    usage: {
      has_server_key: hasServerKey,
      calls_24h: calls24h,
      daily_call_cap: settings.daily_call_cap,
      estimated_cost_24h_usd: estCost24h,
      transient_cache_entries: Number(cacheStats?.total_cnt ?? 0),
      expired_cache_entries: Number(cacheStats?.expired_cnt ?? 0),
      total_indexed_refs: Number(refsStats?.total_refs ?? 0),
      duplicates_needing_review: Number(refsStats?.dup_cnt ?? 0),
      paused: settings.paused,
    },
    quality_report: {
      total_localities: localities.length,
      fully_covered_count: localities.filter((l) => l.discovery_status === 'completed').length,
      partial_or_failed_count: localities.filter(
        (l) => l.discovery_status === 'partial' || l.discovery_status === 'failed'
      ).length,
      unsearched_count: localities.filter((l) => l.discovery_status === 'pending').length,
      total_unique_place_refs: Number(refsStats?.total_refs ?? 0),
      total_curated_cafes: curated.length,
      category_breakdown: catBreakdownRows.map((c) => ({
        category: String(c.category || 'Cafe'),
        count: Number(c.cnt ?? 0),
      })),
      incomplete_localities: incompleteLocalities.slice(0, 30),
      honesty_note:
        'Coverage reflects businesses returned by Google Places API (New) multi-query and distance sweeps plus CafeDesk verified/community entries. Small unmarked stalls without Google Maps listings are not guaranteed to appear — residents & owners can submit missing spots anytime.',
    },
  };
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let lastScheduledRunAt = 0;

export function startScheduledDiscoveryRunner(): void {
  if (schedulerTimer) return;
  schedulerTimer = setInterval(() => {
    void (async () => {
      try {
        purgeExpiredPlacesTransientCache();
        const settings = getDiscoverySettingsFromDb();
        if (!settings.scheduler_enabled || settings.paused) return;
        if (activeDiscoveryRunPromise) return;
        if (!getPlacesApiKey()) return;

        const now = Date.now();
        if (now - lastScheduledRunAt < settings.interval_minutes * 60 * 1000) return;

        lastScheduledRunAt = now;
        await startBatchDiscoveryJob({ scope: 'scheduled' });
      } catch {
        // Scheduled background sweeps never throw unhandled exceptions
      }
    })();
  }, 5 * 60 * 1000);
  if (typeof schedulerTimer.unref === 'function') {
    schedulerTimer.unref();
  }
}

export function promotePlaceRefToCafeCatalog(
  placeId: string,
  adminUsername: string,
  overrideCategory?: string
): { cafeId: string } | { error: string; status: number } {
  const db = getDb();
  const ref = db
    .prepare('SELECT * FROM discovery_place_refs WHERE place_id = ?')
    .get(placeId) as Record<string, unknown> | undefined;
  if (!ref) return { error: 'Discovery place reference not found.', status: 404 };

  const existingCafe = db
    .prepare('SELECT id FROM cafes WHERE place_id = ?')
    .get(placeId) as { id?: string } | undefined;
  if (existingCafe?.id) {
    db.prepare('UPDATE discovery_place_refs SET promoted_cafe_id = ? WHERE place_id = ?').run(
      existingCafe.id,
      placeId
    );
    return { cafeId: existingCafe.id };
  }

  const cached = getTransientPlaceSnapshot(placeId);
  if (!cached) {
    return {
      error:
        'Transient Google Places snapshot expired. Refresh this locality or open its place details before promoting into the CafeDesk catalog.',
      status: 400,
    };
  }

  const loc = ref.primary_locality_id
    ? getLocalityByIdOrSlugFromDb(Number(ref.primary_locality_id))
    : null;
  const areaName = loc?.name || cached.areaLabel || 'Bengaluru';
  const category = overrideCategory || String(ref.cafedesk_category || 'Cafe');
  const slugBase = cached.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 44);
  const newId = `${slugBase || 'cafe'}-${placeId.slice(-6).toLowerCase()}`;
  const now = Date.now();

  db.prepare(
    `INSERT INTO cafes (
      id, slug, name, category, city, area, address, phone, map_link, booking_url,
      website_url, menu_url, instagram_url, place_id, lat, lng,
      timings, description, photos_json, photos_approved,
      wifi_available, wifi_mbps, charging_sockets, sockets_count, sockets_claimed,
      comfortable_seating, suitable_for_studying, suitable_for_working,
      noise_level, avg_cost_per_person, price_range,
      popular_items_json, rating, rating_count, min_spend, laptop_friendly, time_limit,
      modes_json, facilities_json, offers_json, menu_services_json,
      best_for_json, verdict, avoid_if, student_discount,
      verified, featured, published, display_order, last_verified_date, claims_json,
      source_name, source_url, source_type, sample, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'Bengaluru', ?, ?, ?, ?, '', ?, '', '', ?, ?, ?, ?, ?, ?, ?, 'unknown', NULL, 'unknown', NULL, 0, 'unknown', 'unknown', 'unknown', NULL, NULL, ?, '[]', ?, ?, NULL, 0, NULL, ?, '[]', '[]', '[]', ?, ?, NULL, NULL, 0, 0, 1, 500, NULL, ?, 'Google Places Discovery', ?, 'google_places', 0, ?, ?)`
  ).run(
    newId,
    newId,
    cached.name,
    category,
    areaName,
    cached.address,
    cached.phone || '',
    cached.mapLink,
    cached.websiteUrl || '',
    placeId,
    cached.lat,
    cached.lng,
    cached.openingHours[0] ? 'See Google Maps hours' : 'Check hours',
    `${cached.name} in ${areaName} — promoted from Google Places Locality Discovery for CafeDesk verification.`,
    JSON.stringify(cached.photos || []),
    (cached.photos || []).length > 0 ? 1 : 0,
    cached.priceLevelLabel || '',
    cached.rating,
    cached.ratingCount,
    JSON.stringify(['work']),
    JSON.stringify([category, areaName]),
    'Promoted from Google Places locality discovery. Amenity details pending field check.',
    JSON.stringify(['Promoted from Bengaluru locality discovery queue.']),
    cached.viewMapUrl || cached.mapLink,
    now,
    now
  );

  db.prepare(
    "UPDATE discovery_place_refs SET promoted_cafe_id = ?, duplicate_review_status = 'clean' WHERE place_id = ?"
  ).run(newId, placeId);

  return { cafeId: newId };
}

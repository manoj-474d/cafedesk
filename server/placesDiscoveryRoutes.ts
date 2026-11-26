import crypto from 'node:crypto';
import type { Express, Request, RequestHandler, Response } from 'express';
import {
  BENGALURU_CENTER,
  CORRECTION_ISSUE_TYPES,
  DISCOVERY_CATEGORY_TABS,
} from '../src/config/constants.ts';
import type { LocationItem } from '../src/types/cms.ts';
import {
  buildGoogleMapsDirectionsUrl,
  computeDistanceKm,
  deduplicateCafeItems,
  matchesBudgetBracket,
  matchesDiscoveryCategoryTab,
  matchesWorkMood,
} from '../src/utils/cafeHelpers.ts';
import {
  createCommunityCorrectionInDb,
  getDb,
  getPlacesApiStatsFromDb,
  getSiteSettingsFromDb,
  getUserAchievementsFromDb,
  listCommunityCorrectionsFromDb,
  listLocationsFromDb,
  logPlacesApiCall,
  recordActivity,
  recordExplorerEventInDb,
} from './db.ts';
import { getClientIp, resolveUserFromRequest } from './auth.ts';
import { resolveViewerAccessContext, sanitizeCafeForAccess } from './accessControl.ts';

interface PlaceSearchResult {
  id: string;
  placeId: string;
  name: string;
  areaLabel: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  ratingCount: number | null;
  websiteUrl: string;
  mapLink: string;
  viewMapUrl: string;
  phone: string;
  photos: string[];
  openingHours: string[];
  priceLevelLabel: string;
  primaryType: string;
  types: string[];
  categoryLabel: string;
  distanceKm: number | null;
  sourceType: 'google_places';
  cachedAt: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const searchCache = new Map<string, CacheEntry<{ places: PlaceSearchResult[]; nextPageToken: string | null }>>();
const detailsCache = new Map<string, CacheEntry<PlaceSearchResult>>();
const autocompleteCache = new Map<string, CacheEntry<Array<{ placeId: string; mainText: string; secondaryText: string; fullText: string }>>>();

const IP_RATE_WINDOW_MS = 60 * 1000;
const IP_RATE_MAX = 45;
const ipHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const prev = (ipHits.get(ip) ?? []).filter((t) => now - t < IP_RATE_WINDOW_MS);
  if (prev.length >= IP_RATE_MAX) {
    ipHits.set(ip, prev);
    return true;
  }
  prev.push(now);
  ipHits.set(ip, prev);
  if (ipHits.size > 2000) {
    ipHits.clear();
  }
  return false;
}

function getPlacesApiKey(): string {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();
}

function cleanStr(val: unknown, maxLen = 300): string {
  return String(val ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function pruneMapCache<T>(cache: Map<string, CacheEntry<T>>, maxSize = 200) {
  if (cache.size <= maxSize) return;
  const now = Date.now();
  for (const [k, entry] of cache.entries()) {
    if (entry.expiresAt <= now) cache.delete(k);
  }
  if (cache.size > maxSize) {
    const keys = Array.from(cache.keys()).slice(0, cache.size - maxSize);
    for (const k of keys) cache.delete(k);
  }
}

function formatPriceLevel(raw: unknown): string {
  const s = String(raw ?? '');
  if (s === 'PRICE_LEVEL_FREE' || s === 'FREE') return 'Free';
  if (s === 'PRICE_LEVEL_INEXPENSIVE' || s === 'INEXPENSIVE') return 'Budget-friendly (₹)';
  if (s === 'PRICE_LEVEL_MODERATE' || s === 'MODERATE') return 'Moderate (₹₹)';
  if (s === 'PRICE_LEVEL_EXPENSIVE' || s === 'EXPENSIVE') return 'Premium (₹₹₹)';
  if (s === 'PRICE_LEVEL_VERY_EXPENSIVE' || s === 'VERY_EXPENSIVE') return 'High-end (₹₹₹₹)';
  return '';
}

function extractAreaLabel(formattedAddress: string, fallback = 'Bengaluru'): string {
  if (!formattedAddress) return fallback;
  const parts = formattedAddress
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    const candidate = parts[parts.length - 3];
    if (
      candidate &&
      !/^\d+$/.test(candidate) &&
      !/^(bengaluru|bangalore|karnataka|india)$/i.test(candidate)
    ) {
      return candidate;
    }
  }
  return fallback;
}

function deriveCategoryLabel(primaryType: string, types: string[]): string {
  const all = [primaryType, ...types].join(' ').toLowerCase();
  if (all.includes('tea')) return 'Tea Shop';
  if (all.includes('bakery')) return 'Bakery';
  if (all.includes('juice')) return 'Juice & Beverage';
  if (all.includes('ice_cream') || all.includes('dessert')) return 'Dessert & Ice Cream';
  if (all.includes('sandwich') || all.includes('hamburger')) return 'Sandwich & Burger';
  if (all.includes('fast_food')) return 'Snacks & Fast Food';
  if (all.includes('coffee_shop')) return 'Coffee Shop';
  if (all.includes('restaurant')) return 'Eatery / Cafe';
  return 'Cafe';
}

function mapRawGooglePlace(
  raw: Record<string, unknown>,
  areaFallback: string,
  originPoint?: { lat: number; lng: number } | null
): PlaceSearchResult | null {
  const loc = raw.location as { latitude?: number; longitude?: number } | undefined;
  const lat = typeof loc?.latitude === 'number' ? loc.latitude : null;
  const lng = typeof loc?.longitude === 'number' ? loc.longitude : null;
  if (lat === null || lng === null) return null;

  const rawId = cleanStr(raw.id, 160);
  if (!rawId) return null;

  const displayNameObj = raw.displayName as { text?: string } | string | undefined;
  const name =
    typeof displayNameObj === 'string'
      ? cleanStr(displayNameObj, 160)
      : cleanStr(displayNameObj?.text, 160) || 'Local Place';
  const address = cleanStr(raw.formattedAddress, 320) || `${areaFallback}, India`;
  const areaLabel = extractAreaLabel(address, areaFallback);
  const primaryType = cleanStr(raw.primaryType, 80);
  const types = Array.isArray(raw.types)
    ? raw.types.map((t) => cleanStr(t, 60)).filter(Boolean)
    : [];

  const photosRaw = Array.isArray(raw.photos) ? raw.photos : [];
  const photos = photosRaw
    .slice(0, 6)
    .map((p) => {
      const resourceName = cleanStr((p as { name?: string })?.name, 260);
      if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(resourceName)) return '';
      return `/api/places/photo?name=${encodeURIComponent(resourceName)}&w=900`;
    })
    .filter(Boolean);

  const openingObj = raw.regularOpeningHours as { weekdayDescriptions?: string[] } | undefined;
  const openingHours = Array.isArray(openingObj?.weekdayDescriptions)
    ? openingObj.weekdayDescriptions.map((d) => cleanStr(d, 120)).filter(Boolean)
    : [];

  const directionsUrl =
    buildGoogleMapsDirectionsUrl({
      place_id: rawId,
      lat,
      lng,
      name,
      address,
      area: areaLabel,
      city: areaFallback,
    }) || '';

  const viewMapUrl =
    cleanStr(raw.googleMapsUri, 300) ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}`)}&query_place_id=${encodeURIComponent(rawId)}`;

  return {
    id: `google:${rawId}`,
    placeId: rawId,
    name,
    areaLabel,
    address,
    lat,
    lng,
    rating: typeof raw.rating === 'number' ? Math.round(raw.rating * 10) / 10 : null,
    ratingCount: typeof raw.userRatingCount === 'number' ? raw.userRatingCount : null,
    websiteUrl: cleanStr(raw.websiteUri, 260),
    mapLink: directionsUrl,
    viewMapUrl,
    phone: cleanStr(raw.nationalPhoneNumber, 40),
    photos,
    openingHours,
    priceLevelLabel: formatPriceLevel(raw.priceLevel),
    primaryType,
    types,
    categoryLabel: deriveCategoryLabel(primaryType, types),
    distanceKm: originPoint ? computeDistanceKm(originPoint.lat, originPoint.lng, lat, lng) : null,
    sourceType: 'google_places',
    cachedAt: Date.now(),
  };
}

function toLocationItem(place: PlaceSearchResult, cityLabel = 'Bengaluru'): LocationItem {
  return {
    id: `google:${place.placeId}`,
    slug: `google:${place.placeId}`,
    name: place.name,
    category: place.categoryLabel,
    city: cityLabel,
    area: place.areaLabel || cityLabel,
    address: place.address,
    phone: place.phone,
    map_link: place.mapLink,
    website_url: place.websiteUrl,
    menu_url: '',
    instagram_url: '',
    place_id: place.placeId,
    lat: place.lat,
    lng: place.lng,
    timings: place.openingHours[0] ? 'See weekly hours below' : 'Hours not available',
    description: `${place.name} in ${place.areaLabel || cityLabel} via Google Places Discovery.`,
    photos: place.photos,
    photos_approved: place.photos.length > 0,
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
    price_range: place.priceLevelLabel,
    coffee_price: null,
    tea_price: null,
    snacks_price: null,
    meals_price: null,
    popular_items: [],
    rating: place.rating,
    rating_count: place.ratingCount,
    min_spend: null,
    laptop_friendly: false,
    time_limit: null,
    modes: ['work'],
    facilities: [],
    offers: [],
    menu_services: [],
    best_for: [place.categoryLabel, 'Google Places Discovery'],
    verdict:
      'Live Google Places listing. Wi-Fi, plug points, and exact workspace suitability have not been verified by CafeDesk yet.',
    avoid_if: null,
    student_discount: null,
    verified: false,
    featured: false,
    published: true,
    display_order: 999,
    last_verified_date: null,
    claims: ['Place listing sourced from Google Places API (New).'],
    source_name: 'Google Places Discovery',
    source_url: place.viewMapUrl,
    source_type: 'google_places',
    opening_hours_list: place.openingHours,
    price_level_label: place.priceLevelLabel,
    isLiveGooglePlace: true,
    sample: false,
  };
}

const PLACES_SEARCH_FIELDMASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.nationalPhoneNumber',
  'places.regularOpeningHours.weekdayDescriptions',
  'places.priceLevel',
  'places.types',
  'places.primaryType',
  'places.photos',
  'nextPageToken',
].join(',');

const PLACES_DETAIL_FIELDMASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'websiteUri',
  'googleMapsUri',
  'nationalPhoneNumber',
  'regularOpeningHours.weekdayDescriptions',
  'priceLevel',
  'types',
  'primaryType',
  'photos',
].join(',');

async function callGooglePlacesJson(
  url: string,
  options: {
    method: 'GET' | 'POST';
    apiKey: string;
    fieldMask?: string;
    body?: Record<string, unknown>;
  }
): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; errorText: string }> {
  const headers: Record<string, string> = {
    'X-Goog-Api-Key': options.apiKey,
  };
  if (options.method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }
  if (options.fieldMask) {
    headers['X-Goog-FieldMask'] = options.fieldMask;
  }

  const response = await fetch(url, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  if (!response.ok) {
    const errObj = parsed.error as { message?: string; status?: string } | undefined;
    const msg = errObj?.message || text.slice(0, 240) || `HTTP ${response.status}`;
    return { ok: false, status: response.status, data: parsed, errorText: msg };
  }

  return { ok: true, status: response.status, data: parsed, errorText: '' };
}

function buildCategoryTextQuery(query: string, categoryId: string, locality: string, city: string): string {
  const cleanQ = cleanStr(query, 120);
  const cleanLoc = cleanStr(locality, 80);
  const cleanCity = cleanStr(city, 60) || 'Bengaluru';
  const catTab = DISCOVERY_CATEGORY_TABS.find((c) => c.id === categoryId);

  const parts: string[] = [];
  if (cleanQ) {
    parts.push(cleanQ);
  } else if (catTab && catTab.id !== 'all') {
    parts.push(catTab.placesQuery);
  } else {
    parts.push('cafes coffee tea bakery snacks');
  }

  if (cleanLoc && !parts[0].toLowerCase().includes(cleanLoc.toLowerCase())) {
    parts.push(`in ${cleanLoc}`);
  }
  if (
    !/near me|nearby/i.test(parts[0]) &&
    !parts.join(' ').toLowerCase().includes(cleanCity.toLowerCase())
  ) {
    parts.push(cleanCity);
  }
  return parts.join(' ').trim();
}

export function registerPlacesDiscoveryRoutes(
  app: Express,
  requireAdminAuth: RequestHandler
): void {
  // 1. Places API (New): Text Search Proxy
  app.post('/api/places/search', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      res.status(429).json({ code: 'RATE_LIMITED', error: 'Too many discovery requests. Please wait a moment.' });
      return;
    }

    const apiKey = getPlacesApiKey();
    const query = cleanStr(req.body?.query, 140);
    const category = cleanStr(req.body?.category, 40) || 'all';
    const locality = cleanStr(req.body?.locality, 80);
    const city = cleanStr(req.body?.city, 60) || 'Bengaluru';
    const pageToken = cleanStr(req.body?.pageToken, 300);
    const lat = Number.isFinite(Number(req.body?.lat)) ? Number(req.body.lat) : null;
    const lng = Number.isFinite(Number(req.body?.lng)) ? Number(req.body.lng) : null;
    const radiusMeters = Math.min(50000, Math.max(500, Number(req.body?.radiusMeters) || 12000));

    const textQuery = buildCategoryTextQuery(query, category, locality, city);
    if (!apiKey) {
      logPlacesApiCall({
        endpoint: '/api/places/search',
        queryText: textQuery,
        statusCode: 503,
        errorMessage: 'MISSING_KEY: Google Places API key is not configured on server.',
      });
      res.status(503).json({
        code: 'MISSING_KEY',
        error: 'Google Places API key is not configured yet. Showing CafeDesk verified listings.',
      });
      return;
    }

    const cacheKey = `${textQuery.toLowerCase()}|${category}|${lat?.toFixed(2) ?? ''}|${lng?.toFixed(2) ?? ''}|${radiusMeters}|${pageToken}`;
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      logPlacesApiCall({
        endpoint: '/api/places/search',
        queryText: textQuery,
        statusCode: 200,
        cached: true,
        resultCount: cached.value.places.length,
      });
      res.json({ ...cached.value, cached: true, textQuery });
      return;
    }

    try {
      const biasCenter =
        lat !== null && lng !== null
          ? { latitude: lat, longitude: lng }
          : { latitude: BENGALURU_CENTER.lat, longitude: BENGALURU_CENTER.lng };

      const payload: Record<string, unknown> = {
        textQuery,
        pageSize: 15,
        regionCode: 'IN',
        languageCode: 'en',
        locationBias: {
          circle: {
            center: biasCenter,
            radius: radiusMeters,
          },
        },
      };
      if (pageToken) {
        payload.pageToken = pageToken;
      }
      const catTab = DISCOVERY_CATEGORY_TABS.find((c) => c.id === category);
      if (catTab && catTab.id !== 'all' && catTab.includedTypes.length === 1) {
        payload.includedType = catTab.includedTypes[0];
      }

      const apiRes = await callGooglePlacesJson(
        'https://places.googleapis.com/v1/places:searchText',
        {
          method: 'POST',
          apiKey,
          fieldMask: PLACES_SEARCH_FIELDMASK,
          body: payload,
        }
      );

      if (!apiRes.ok) {
        const isQuota = apiRes.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(apiRes.errorText);
        logPlacesApiCall({
          endpoint: '/api/places/search',
          queryText: textQuery,
          statusCode: apiRes.status,
          errorMessage: apiRes.errorText,
        });
        res.status(isQuota ? 429 : 502).json({
          code: isQuota ? 'RESOURCE_EXHAUSTED' : 'PLACES_API_ERROR',
          error: apiRes.errorText,
        });
        return;
      }

      const rawPlaces = Array.isArray(apiRes.data.places)
        ? (apiRes.data.places as Array<Record<string, unknown>>)
        : [];
      const originPoint = lat !== null && lng !== null ? { lat, lng } : null;
      const mapped = rawPlaces
        .map((p) => mapRawGooglePlace(p, locality || city, originPoint))
        .filter((x): x is PlaceSearchResult => x !== null);

      const nextToken = cleanStr(apiRes.data.nextPageToken, 400) || null;
      const resultPayload = { places: mapped, nextPageToken: nextToken };
      searchCache.set(cacheKey, { value: resultPayload, expiresAt: Date.now() + 15 * 60 * 1000 });
      pruneMapCache(searchCache);

      logPlacesApiCall({
        endpoint: '/api/places/search',
        queryText: textQuery,
        statusCode: 200,
        cached: false,
        resultCount: mapped.length,
      });

      res.json({ ...resultPayload, cached: false, textQuery });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to query Google Places.';
      logPlacesApiCall({
        endpoint: '/api/places/search',
        queryText: textQuery,
        statusCode: 500,
        errorMessage: msg,
      });
      res.status(500).json({ code: 'PLACES_FETCH_FAILED', error: msg });
    }
  });

  // 2. Places API (New): Nearby Search Proxy
  app.post('/api/places/nearby', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      res.status(429).json({ code: 'RATE_LIMITED', error: 'Too many nearby requests. Please wait a moment.' });
      return;
    }

    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'Valid latitude and longitude coordinates are required.' });
      return;
    }

    const apiKey = getPlacesApiKey();
    const category = cleanStr(req.body?.category, 40) || 'all';
    const radiusMeters = Math.min(50000, Math.max(500, Number(req.body?.radiusMeters) || 3500));

    if (!apiKey) {
      logPlacesApiCall({
        endpoint: '/api/places/nearby',
        queryText: `${lat.toFixed(3)},${lng.toFixed(3)} (${category})`,
        statusCode: 503,
        errorMessage: 'MISSING_KEY: Google Places API key is not configured on server.',
      });
      res.status(503).json({
        code: 'MISSING_KEY',
        error: 'Google Places API key is not configured yet.',
      });
      return;
    }

    const cacheKey = `nearby:${lat.toFixed(3)},${lng.toFixed(3)},${radiusMeters},${category}`;
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      logPlacesApiCall({
        endpoint: '/api/places/nearby',
        queryText: cacheKey,
        statusCode: 200,
        cached: true,
        resultCount: cached.value.places.length,
      });
      res.json({ ...cached.value, cached: true });
      return;
    }

    try {
      const catTab = DISCOVERY_CATEGORY_TABS.find((c) => c.id === category);
      const includedPrimaryTypes =
        catTab && catTab.includedTypes.length > 0
          ? catTab.includedTypes
          : ['cafe', 'coffee_shop', 'bakery', 'tea_house'];

      const apiRes = await callGooglePlacesJson(
        'https://places.googleapis.com/v1/places:searchNearby',
        {
          method: 'POST',
          apiKey,
          fieldMask: PLACES_SEARCH_FIELDMASK.replace(',nextPageToken', ''),
          body: {
            includedPrimaryTypes,
            maxResultCount: 15,
            rankPreference: 'DISTANCE',
            languageCode: 'en',
            regionCode: 'IN',
            locationRestriction: {
              circle: {
                center: { latitude: lat, longitude: lng },
                radius: radiusMeters,
              },
            },
          },
        }
      );

      if (!apiRes.ok) {
        const isQuota = apiRes.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(apiRes.errorText);
        logPlacesApiCall({
          endpoint: '/api/places/nearby',
          queryText: cacheKey,
          statusCode: apiRes.status,
          errorMessage: apiRes.errorText,
        });
        res.status(isQuota ? 429 : 502).json({
          code: isQuota ? 'RESOURCE_EXHAUSTED' : 'PLACES_API_ERROR',
          error: apiRes.errorText,
        });
        return;
      }

      const rawPlaces = Array.isArray(apiRes.data.places)
        ? (apiRes.data.places as Array<Record<string, unknown>>)
        : [];
      const mapped = rawPlaces
        .map((p) => mapRawGooglePlace(p, 'Nearby', { lat, lng }))
        .filter((x): x is PlaceSearchResult => x !== null);

      const payload = { places: mapped, nextPageToken: null };
      searchCache.set(cacheKey, { value: payload, expiresAt: Date.now() + 15 * 60 * 1000 });
      pruneMapCache(searchCache);

      logPlacesApiCall({
        endpoint: '/api/places/nearby',
        queryText: cacheKey,
        statusCode: 200,
        cached: false,
        resultCount: mapped.length,
      });

      res.json({ ...payload, cached: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load nearby places.';
      logPlacesApiCall({
        endpoint: '/api/places/nearby',
        queryText: cacheKey,
        statusCode: 500,
        errorMessage: msg,
      });
      res.status(500).json({ code: 'PLACES_FETCH_FAILED', error: msg });
    }
  });

  // 3. Places API (New): Place Details Proxy
  app.get('/api/places/details', async (req: Request, res: Response) => {
    const placeId = cleanStr(req.query.placeId, 160).replace(/^google:/, '');
    if (!placeId || !/^[A-Za-z0-9_-]{8,140}$/.test(placeId)) {
      res.status(400).json({ error: 'Valid Google Place ID is required.' });
      return;
    }

    const apiKey = getPlacesApiKey();
    if (!apiKey) {
      res.status(503).json({ code: 'MISSING_KEY', error: 'Google Places API key is not configured.' });
      return;
    }

    const cached = detailsCache.get(placeId);
    if (cached && cached.expiresAt > Date.now()) {
      res.json({ place: cached.value, cached: true });
      return;
    }

    try {
      const apiRes = await callGooglePlacesJson(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`,
        {
          method: 'GET',
          apiKey,
          fieldMask: PLACES_DETAIL_FIELDMASK,
        }
      );

      if (!apiRes.ok) {
        const isQuota = apiRes.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(apiRes.errorText);
        logPlacesApiCall({
          endpoint: '/api/places/details',
          queryText: placeId,
          statusCode: apiRes.status,
          errorMessage: apiRes.errorText,
        });
        res.status(isQuota ? 429 : 502).json({
          code: isQuota ? 'RESOURCE_EXHAUSTED' : 'PLACES_API_ERROR',
          error: apiRes.errorText,
        });
        return;
      }

      const mapped = mapRawGooglePlace(apiRes.data, 'Bengaluru', null);
      if (!mapped) {
        res.status(404).json({ error: 'Place details unavailable.' });
        return;
      }

      detailsCache.set(placeId, { value: mapped, expiresAt: Date.now() + 60 * 60 * 1000 });
      pruneMapCache(detailsCache);
      logPlacesApiCall({
        endpoint: '/api/places/details',
        queryText: placeId,
        statusCode: 200,
        cached: false,
        resultCount: 1,
      });

      res.json({ place: mapped, cached: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load place details.';
      res.status(500).json({ code: 'PLACES_FETCH_FAILED', error: msg });
    }
  });

  // 4. Places API (New): Autocomplete Proxy
  app.post('/api/places/autocomplete', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      res.status(429).json({ code: 'RATE_LIMITED', error: 'Rate limit exceeded.' });
      return;
    }

    const input = cleanStr(req.body?.input, 140);
    const city = cleanStr(req.body?.city, 60) || 'Bengaluru';
    if (input.length < 2) {
      res.json({ suggestions: [] });
      return;
    }

    const apiKey = getPlacesApiKey();
    if (!apiKey) {
      res.status(503).json({ code: 'MISSING_KEY', error: 'Google Places API key is not configured.' });
      return;
    }

    const lat = Number.isFinite(Number(req.body?.lat)) ? Number(req.body.lat) : BENGALURU_CENTER.lat;
    const lng = Number.isFinite(Number(req.body?.lng)) ? Number(req.body.lng) : BENGALURU_CENTER.lng;
    const cacheKey = `${input.toLowerCase()}|${city.toLowerCase()}`;
    const cached = autocompleteCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json({ suggestions: cached.value, cached: true });
      return;
    }

    try {
      const apiRes = await callGooglePlacesJson(
        'https://places.googleapis.com/v1/places:autocomplete',
        {
          method: 'POST',
          apiKey,
          body: {
            input: input.toLowerCase().includes(city.toLowerCase()) ? input : `${input} ${city}`,
            includedPrimaryTypes: [
              'cafe',
              'coffee_shop',
              'bakery',
              'tea_house',
              'restaurant',
              'fast_food_restaurant',
              'ice_cream_shop',
              'dessert_shop',
            ],
            includedRegionCodes: ['in'],
            locationBias: {
              circle: {
                center: { latitude: lat, longitude: lng },
                radius: 35000,
              },
            },
          },
        }
      );

      if (!apiRes.ok) {
        res.status(apiRes.status === 429 ? 429 : 502).json({
          code: apiRes.status === 429 ? 'RESOURCE_EXHAUSTED' : 'PLACES_API_ERROR',
          error: apiRes.errorText,
        });
        return;
      }

      const rawSuggestions = Array.isArray(apiRes.data.suggestions)
        ? (apiRes.data.suggestions as Array<Record<string, unknown>>)
        : [];
      const suggestions = rawSuggestions
        .map((s) => {
          const pred = s.placePrediction as Record<string, unknown> | undefined;
          if (!pred) return null;
          const sf = pred.structuredFormat as
            | { mainText?: { text?: string }; secondaryText?: { text?: string } }
            | undefined;
          const placeId = cleanStr(pred.placeId, 160);
          const mainText = cleanStr(sf?.mainText?.text || (pred.text as { text?: string })?.text, 140);
          const secondaryText = cleanStr(sf?.secondaryText?.text, 200);
          if (!placeId || !mainText) return null;
          return {
            placeId,
            mainText,
            secondaryText,
            fullText: secondaryText ? `${mainText}, ${secondaryText}` : mainText,
          };
        })
        .filter(
          (x): x is { placeId: string; mainText: string; secondaryText: string; fullText: string } =>
            x !== null
        )
        .slice(0, 7);

      autocompleteCache.set(cacheKey, { value: suggestions, expiresAt: Date.now() + 5 * 60 * 1000 });
      pruneMapCache(autocompleteCache);
      res.json({ suggestions, cached: false });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Autocomplete failed.' });
    }
  });

  // 5. Places Photo Media Proxy (keeps API key secret on server)
  app.get('/api/places/photo', async (req: Request, res: Response) => {
    const photoName = cleanStr(req.query.name, 260);
    if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photoName)) {
      res.status(400).send('Invalid photo reference');
      return;
    }

    const apiKey = getPlacesApiKey();
    if (!apiKey) {
      res.status(503).send('Maps key not configured');
      return;
    }

    const width = Math.min(1200, Math.max(200, Number(req.query.w) || 900));
    try {
      const target = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${width}&key=${encodeURIComponent(apiKey)}`;
      const upstream = await fetch(target, { redirect: 'follow' });
      if (!upstream.ok) {
        res.status(upstream.status).send('Photo unavailable');
        return;
      }
      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buf);
    } catch {
      res.status(502).send('Failed to fetch photo');
    }
  });

  // 6. Combined Discovery Feed & Work Mood Endpoint
  app.get('/api/discover', (req: Request, res: Response) => {
    const q = cleanStr(req.query.q, 120).toLowerCase();
    const category = cleanStr(req.query.category, 40) || 'all';
    const mood = cleanStr(req.query.mood, 40);
    const budget = cleanStr(req.query.budget, 40);
    const area = cleanStr(req.query.area, 80).toLowerCase();
    const sort = cleanStr(req.query.sort, 40) || 'nearest';

    const settings = getSiteSettingsFromDb();
    const user = resolveUserFromRequest(req, res);
    const viewer = resolveViewerAccessContext({ userId: user?.id ?? null, isAdmin: false });
    const curated = listLocationsFromDb(false).map((loc) => sanitizeCafeForAccess(loc, viewer, settings));

    const filtered = curated.filter((loc) => {
      if (category && category !== 'all' && !matchesDiscoveryCategoryTab(loc, category)) return false;
      if (mood && !matchesWorkMood(loc, mood)) return false;
      if (budget && !matchesBudgetBracket(loc.avg_cost_per_person, loc.price_range, budget)) return false;
      if (area && area !== 'all' && !loc.area.toLowerCase().includes(area) && !loc.address.toLowerCase().includes(area)) {
        return false;
      }
      if (q) {
        const hay = [
          loc.name,
          loc.category || '',
          loc.area,
          loc.address,
          loc.popular_items.join(' '),
          loc.claims.join(' '),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sort === 'highest_rated') {
      filtered.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (sort === 'budget_friendly') {
      filtered.sort((a, b) => (a.avg_cost_per_person ?? 9999) - (b.avg_cost_per_person ?? 9999));
    } else if (sort === 'most_reviewed') {
      filtered.sort((a, b) => (b.rating_count ?? 0) - (a.rating_count ?? 0));
    }

    res.json({ places: filtered, total: filtered.length });
  });

  app.get('/api/discover/mood', (req: Request, res: Response) => {
    const mood = cleanStr(req.query.mood, 40);
    const area = cleanStr(req.query.area, 80).toLowerCase();
    const settings = getSiteSettingsFromDb();
    const curated = listLocationsFromDb(false).filter((loc) => {
      if (mood && !matchesWorkMood(loc, mood)) return false;
      if (area && area !== 'all' && !loc.area.toLowerCase().includes(area)) return false;
      return true;
    });

    const viewer = resolveViewerAccessContext({ userId: null, isAdmin: false });
    res.json({
      mood,
      places: curated.map((loc) => sanitizeCafeForAccess(loc, viewer, settings)),
    });
  });

  // 7. Community Corrections & Issue Reporting
  const ALLOWED_ISSUE_TYPES = new Set<string>(CORRECTION_ISSUE_TYPES.map((i) => i.id));

  app.post('/api/corrections', (req: Request, res: Response) => {
    const cafeKey = cleanStr(req.body?.cafeKey, 160);
    const cafeName = cleanStr(req.body?.cafeName, 160);
    const issueType = cleanStr(req.body?.issueType, 40);
    const details = cleanStr(req.body?.details, 800);
    const suggestedValue = cleanStr(req.body?.suggestedValue, 300);
    const reporterName = cleanStr(req.body?.reporterName, 80);
    const reporterEmail = cleanStr(req.body?.reporterEmail, 120);

    if (!cafeName || !ALLOWED_ISSUE_TYPES.has(issueType)) {
      res.status(400).json({ error: 'Please select a valid issue type and provide place details.' });
      return;
    }

    const user = resolveUserFromRequest(req, res);
    const created = createCommunityCorrectionInDb({
      cafeKey: cafeKey || cafeName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      cafeName,
      issueType,
      details,
      suggestedValue,
      reporterName: reporterName || user?.name || 'Community Member',
      reporterEmail: reporterEmail || user?.email || '',
      userId: user?.id ?? null,
    });

    if (user) {
      getUserAchievementsFromDb(user.id);
    }

    res.status(201).json({
      ok: true,
      correction: created,
      message: 'Thanks! Your correction has been queued for CafeDesk moderation.',
    });
  });

  // 8. CafeDesk Explorer Achievements (server-validated anti-abuse)
  app.get('/api/explorer/achievements', (req: Request, res: Response) => {
    const user = resolveUserFromRequest(req, res);
    if (!user) {
      res.status(401).json({ error: 'Sign in to view your CafeDesk Explorer achievements.' });
      return;
    }
    res.json({ achievements: getUserAchievementsFromDb(user.id) });
  });

  app.post('/api/explorer/event', (req: Request, res: Response) => {
    const user = resolveUserFromRequest(req, res);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const eventType = cleanStr(req.body?.eventType, 40);
    const targetKey = cleanStr(req.body?.targetKey, 120);
    if (eventType !== 'view_place' && eventType !== 'compare_places' && eventType !== 'work_mood') {
      res.status(400).json({ error: 'Unsupported explorer event type.' });
      return;
    }
    const achievements = recordExplorerEventInDb(user.id, eventType, targetKey);
    res.json({ ok: true, achievements });
  });

  // 9. Admin Places Discovery, Import, Duplicate Merge, Corrections Moderation & API Stats
  app.get('/api/admin/places/usage', requireAdminAuth, (_req: Request, res: Response) => {
    res.json(getPlacesApiStatsFromDb(Boolean(getPlacesApiKey())));
  });

  app.post('/api/admin/places/search', requireAdminAuth, async (req: Request, res: Response) => {
    const apiKey = getPlacesApiKey();
    if (!apiKey) {
      res.status(503).json({
        code: 'MISSING_KEY',
        error: 'Google Places API key is missing in server environment.',
      });
      return;
    }

    const query = cleanStr(req.body?.query, 140);
    const locality = cleanStr(req.body?.locality, 80);
    const city = cleanStr(req.body?.city, 60) || 'Bengaluru';
    const category = cleanStr(req.body?.category, 40) || 'all';
    const textQuery = buildCategoryTextQuery(query, category, locality, city);

    try {
      const apiRes = await callGooglePlacesJson(
        'https://places.googleapis.com/v1/places:searchText',
        {
          method: 'POST',
          apiKey,
          fieldMask: PLACES_SEARCH_FIELDMASK,
          body: {
            textQuery,
            pageSize: 15,
            regionCode: 'IN',
            languageCode: 'en',
          },
        }
      );

      if (!apiRes.ok) {
        logPlacesApiCall({
          endpoint: '/api/admin/places/search',
          queryText: textQuery,
          statusCode: apiRes.status,
          errorMessage: apiRes.errorText,
        });
        res.status(502).json({ error: apiRes.errorText });
        return;
      }

      const rawPlaces = Array.isArray(apiRes.data.places)
        ? (apiRes.data.places as Array<Record<string, unknown>>)
        : [];
      const mapped = rawPlaces
        .map((p) => mapRawGooglePlace(p, locality || city, null))
        .filter((x): x is PlaceSearchResult => x !== null);

      const existing = listLocationsFromDb(true);
      const enriched = mapped.map((place) => {
        const asLoc = toLocationItem(place, city);
        const deduped = deduplicateCafeItems(existing, [asLoc]);
        return {
          ...place,
          alreadyImported: deduped.length === existing.length,
        };
      });

      logPlacesApiCall({
        endpoint: '/api/admin/places/search',
        queryText: textQuery,
        statusCode: 200,
        resultCount: enriched.length,
      });

      res.json({ places: enriched, textQuery });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Admin places search failed.' });
    }
  });

  app.post('/api/admin/places/import', requireAdminAuth, (req: Request, res: Response) => {
    const place = (req.body?.place ?? {}) as Partial<PlaceSearchResult>;
    const placeId = cleanStr(place.placeId, 160).replace(/^google:/, '');
    const name = cleanStr(place.name, 140);
    const address = cleanStr(place.address, 300);
    const area = cleanStr(place.areaLabel, 80) || 'Bengaluru';
    const city = cleanStr(req.body?.city, 60) || 'Bengaluru';
    const category = cleanStr(req.body?.category || place.categoryLabel, 80) || 'Cafe';
    const published = req.body?.published === undefined ? true : Boolean(req.body.published);
    const verified = Boolean(req.body?.verified);

    if (!placeId || !name || !address) {
      res.status(400).json({ error: 'Place ID, name, and address are required to import.' });
      return;
    }

    const db = getDb();
    const dupRow = db
      .prepare('SELECT id, name FROM cafes WHERE place_id = ?')
      .get(placeId) as { id: string; name: string } | undefined;
    if (dupRow) {
      res.status(409).json({ error: `Already imported as "${dupRow.name}".` });
      return;
    }

    const slugBase = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 48);
    const suffix = crypto.randomBytes(2).toString('hex');
    const id = slugBase ? `${slugBase}-${suffix}` : `place-${suffix}`;
    const slug = id;
    const now = Date.now();
    const lat = typeof place.lat === 'number' && Number.isFinite(place.lat) ? place.lat : null;
    const lng = typeof place.lng === 'number' && Number.isFinite(place.lng) ? place.lng : null;
    const directionsUrl =
      buildGoogleMapsDirectionsUrl({
        place_id: placeId,
        lat,
        lng,
        name,
        address,
        area,
        city,
      }) || '';

    const sourceType = verified ? 'cafedesk_verified' : 'google_places';
    const verdict = verified
      ? `Reviewed by CafeDesk editorial team (${area}).`
      : 'Imported from Google Places Discovery. Wi-Fi speed and sockets are not yet verified by CafeDesk.';

    db.prepare(
      `INSERT INTO cafes (
        id, slug, name, category, city, area, address, phone, map_link, booking_url,
        website_url, menu_url, instagram_url, other_social_links, place_id, lat, lng,
        timings, description, photos_json, interior_photos_json, exterior_photos_json, photos_approved,
        wifi_available, wifi_mbps, wifi_password, charging_sockets, sockets_count, sockets_claimed,
        comfortable_seating, seating_info, ambience, outdoor_seating,
        suitable_for_studying, suitable_for_working,
        noise_level, avg_cost_per_person, price_range,
        coffee_price, tea_price, snacks_price, meals_price, popular_items_json,
        rating, rating_count, min_spend, laptop_friendly, time_limit,
        modes_json, facilities_json, offers_json, subscriber_benefits_json, menu_services_json,
        best_for_json, verdict, avoid_if, student_discount,
        verified, featured, published, display_order, last_verified_date, claims_json,
        source_name, source_url, source_type, merged_into_id, sample, access_rule, allowed_plan_ids_json,
        locked_sections_override_json, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, '',
        ?, '', '', '', ?, ?, ?,
        ?, ?, ?, '[]', '[]', ?,
        'unknown', NULL, '', 'unknown', NULL, 0,
        'unknown', '', '', 'unknown',
        'unknown', 'unknown',
        NULL, NULL, ?,
        NULL, NULL, NULL, NULL, '[]',
        ?, ?, NULL, 0, NULL,
        '["work"]', '[]', '[]', '[]', '[]',
        ?, ?, NULL, NULL,
        ?, 0, ?, 500, NULL, ?,
        'Google Places Discovery', ?, ?, '', 0, 'free_public', '[]',
        '{}', ?, ?
      )`
    ).run(
      id,
      slug,
      name,
      category,
      city,
      area,
      address,
      cleanStr(place.phone, 40),
      directionsUrl,
      cleanStr(place.websiteUrl, 240),
      placeId,
      lat,
      lng,
      Array.isArray(place.openingHours) && place.openingHours[0]
        ? cleanStr(place.openingHours[0], 140)
        : 'Check hours on Google Maps',
      `${name} in ${area}, ${city}.`,
      JSON.stringify(Array.isArray(place.photos) ? place.photos.slice(0, 6) : []),
      Array.isArray(place.photos) && place.photos.length > 0 ? 1 : 0,
      cleanStr(place.priceLevelLabel, 60),
      typeof place.rating === 'number' ? place.rating : null,
      typeof place.ratingCount === 'number' ? place.ratingCount : null,
      JSON.stringify([category]),
      verdict,
      verified ? 1 : 0,
      published ? 1 : 0,
      JSON.stringify(['Imported from Google Places API (New).']),
      cleanStr(place.viewMapUrl || directionsUrl, 300),
      sourceType,
      now,
      now
    );

    recordActivity(req.admin!.username, 'Imported Google Place', name, sourceType, area);
    res.status(201).json({ ok: true, id, slug, source_type: sourceType });
  });

  app.post('/api/admin/cafes/merge', requireAdminAuth, (req: Request, res: Response) => {
    const primaryId = cleanStr(req.body?.primaryId, 100);
    const duplicateId = cleanStr(req.body?.duplicateId, 100);
    if (!primaryId || !duplicateId || primaryId === duplicateId) {
      res.status(400).json({ error: 'Select two distinct listings to merge.' });
      return;
    }

    const db = getDb();
    const primary = db.prepare('SELECT * FROM cafes WHERE id = ?').get(primaryId) as
      | Record<string, unknown>
      | undefined;
    const dup = db.prepare('SELECT * FROM cafes WHERE id = ?').get(duplicateId) as
      | Record<string, unknown>
      | undefined;

    if (!primary || !dup) {
      res.status(404).json({ error: 'One or both cafe records were not found.' });
      return;
    }

    const now = Date.now();
    const mergedPlaceId = String(primary.place_id || '').trim() || String(dup.place_id || '').trim();
    const rawLat = primary.lat ?? dup.lat;
    const rawLng = primary.lng ?? dup.lng;
    const mergedLat = typeof rawLat === 'number' && Number.isFinite(rawLat) ? rawLat : null;
    const mergedLng = typeof rawLng === 'number' && Number.isFinite(rawLng) ? rawLng : null;
    const mergedPhone = String(primary.phone || '').trim() || String(dup.phone || '').trim();
    const mergedWebsite = String(primary.website_url || '').trim() || String(dup.website_url || '').trim();

    db.prepare(
      `UPDATE cafes
       SET place_id = ?, lat = ?, lng = ?, phone = ?, website_url = ?, updated_at = ?
       WHERE id = ?`
    ).run(mergedPlaceId, mergedLat, mergedLng, mergedPhone, mergedWebsite, now, primaryId);

    db.prepare(
      `UPDATE cafes
       SET merged_into_id = ?, published = 0, updated_at = ?
       WHERE id = ?`
    ).run(primaryId, now, duplicateId);

    recordActivity(
      req.admin!.username,
      'Merged duplicate place listing',
      String(primary.name),
      String(dup.name),
      `Merged ${duplicateId} -> ${primaryId}`
    );

    res.json({ ok: true, primaryId, duplicateId });
  });

  app.get('/api/admin/corrections', requireAdminAuth, (_req: Request, res: Response) => {
    res.json({ corrections: listCommunityCorrectionsFromDb() });
  });

  app.patch('/api/admin/corrections/:id', requireAdminAuth, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid correction ID.' });
      return;
    }

    const status = cleanStr(req.body?.status, 20);
    if (!['pending', 'approved', 'rejected', 'resolved'].includes(status)) {
      res.status(400).json({ error: 'Invalid moderation status.' });
      return;
    }
    const adminNote = cleanStr(req.body?.adminNote, 400);
    const applyToCafe = Boolean(req.body?.applyToCafe);

    const db = getDb();
    const row = db.prepare('SELECT * FROM community_corrections WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      res.status(404).json({ error: 'Correction report not found.' });
      return;
    }

    const now = Date.now();
    db.prepare(
      `UPDATE community_corrections
       SET status = ?, admin_note = ?, updated_at = ?
       WHERE id = ?`
    ).run(status, adminNote, now, id);

    if (applyToCafe && (status === 'approved' || status === 'resolved')) {
      const cafeKey = String(row.cafe_key || '').trim();
      const suggested = String(row.suggested_value || '').trim();
      const issueType = String(row.issue_type || '');
      const cafe = db
        .prepare('SELECT id, name FROM cafes WHERE id = ? OR slug = ? OR place_id = ?')
        .get(cafeKey, cafeKey, cafeKey.replace(/^google:/, '')) as
        | { id: string; name: string }
        | undefined;

      if (cafe) {
        if (issueType === 'closed_business') {
          db.prepare('UPDATE cafes SET published = 0, updated_at = ? WHERE id = ?').run(now, cafe.id);
        } else if (suggested) {
          if (issueType === 'wrong_address') {
            db.prepare("UPDATE cafes SET address = ?, source_type = 'community_updated', updated_at = ? WHERE id = ?").run(
              suggested,
              now,
              cafe.id
            );
          } else if (issueType === 'changed_hours') {
            db.prepare("UPDATE cafes SET timings = ?, source_type = 'community_updated', updated_at = ? WHERE id = ?").run(
              suggested,
              now,
              cafe.id
            );
          } else if (issueType === 'incorrect_phone') {
            db.prepare("UPDATE cafes SET phone = ?, source_type = 'community_updated', updated_at = ? WHERE id = ?").run(
              suggested,
              now,
              cafe.id
            );
          } else if (issueType === 'incorrect_category') {
            db.prepare("UPDATE cafes SET category = ?, source_type = 'community_updated', updated_at = ? WHERE id = ?").run(
              suggested,
              now,
              cafe.id
            );
          }
        }
      }
    }

    recordActivity(
      req.admin!.username,
      `Moderated community correction (${status})`,
      String(row.cafe_name),
      String(row.issue_type),
      adminNote || status
    );

    res.json({ ok: true });
  });
}

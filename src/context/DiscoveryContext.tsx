/// <reference types="google.maps" />
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  BENGALURU_CENTER,
  BENGALURU_REGIONS,
  DEFAULT_BENGALURU_LOCALITIES,
  DISCOVERY_CATEGORY_TABS,
} from '../config/constants';
import type { BengaluruRegionName, LocalityRecord, LocationItem } from '../types/cms';
import { buildGoogleMapsDirectionsUrl, buildGoogleMapsViewUrl, computeDistanceKm } from '../utils/cafeHelpers';
import { resolveApiUrl } from './AuthContext';

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface CachedPlaceMeta {
  placeId: string;
  lat: number;
  lng: number;
  rating: number | null;
  ratingCount: number | null;
  websiteUrl: string;
  googleMapsUri: string;
  formattedAddress: string;
  phone: string;
  photos: string[];
  cachedAt: number;
}

export interface GoogleDiscoveryCafe {
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
  viewMapUrl?: string;
  phone: string;
  photos: string[];
  openingHours: string[];
  priceLevelLabel: string;
  categoryLabel?: string;
  primaryType?: string;
  types?: string[];
  distanceKm: number | null;
  sourceType?: 'google_places';
  cachedAt?: number;
}

export interface DiscoverSearchParams {
  query?: string;
  category?: string;
  locality?: string;
  city?: string;
  radiusMeters?: number;
  lat?: number | null;
  lng?: number | null;
  append?: boolean;
}

type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

interface DiscoveryContextValue {
  userLocation: LatLngPoint | null;
  geoStatus: GeoStatus;
  geoError: string;
  requestUserLocation: () => Promise<LatLngPoint | null>;
  clearUserLocation: () => void;
  placeMetaByCafeId: Record<string, CachedPlaceMeta>;
  enrichLocationFromPlaces: (loc: LocationItem) => Promise<void>;
  getEffectiveLocation: (loc: LocationItem) => LocationItem & { distanceKm: number | null };
  nearbyPlaces: GoogleDiscoveryCafe[];
  nearbyLoading: boolean;
  loadingMoreNearby: boolean;
  nearbyHasMore: boolean;
  nearbyLabel: string;
  placesNotice: string;
  clearPlacesNotice: () => void;
  discoverCafesNear: (
    center: LatLngPoint,
    label: string,
    radiusMeters?: number,
    category?: string
  ) => Promise<void>;
  discoverCafesByAreaText: (
    areaQuery: string,
    category?: string,
    city?: string
  ) => Promise<LatLngPoint | null>;
  searchLiveCafesInBengaluru: (
    queryText: string,
    options?: Omit<DiscoverSearchParams, 'query'>
  ) => Promise<GoogleDiscoveryCafe[]>;
  loadMoreLiveCafes: () => Promise<void>;
  livePlaceCache: Record<string, GoogleDiscoveryCafe>;
  fetchGooglePlaceDetails: (placeId: string) => Promise<GoogleDiscoveryCafe | null>;
  resolvePredictionToPlace: (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => Promise<GoogleDiscoveryCafe | null>;
  placesReady: boolean;
  localities: LocalityRecord[];
  localitiesByRegion: Record<BengaluruRegionName, LocalityRecord[]>;
  refreshLocalities: () => Promise<void>;
  localityPlaces: LocationItem[];
  localityLoading: boolean;
  activeLocalityMeta: LocalityRecord | null;
  loadLocalityPlaces: (
    slugOrName: string,
    options?: { category?: string; warm?: boolean }
  ) => Promise<{
    locality: LocalityRecord | null;
    places: LocationItem[];
    curatedCount: number;
    discoveredCount: number;
  }>;
}

const CACHE_STORAGE_KEY = 'cafedesk_places_meta_v2';
const LIVE_PLACES_STORAGE_KEY = 'cafedesk_live_places_v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // < 30 days ToS ceiling
export const GMP_ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

function loadCachedMeta(): Record<string, CachedPlaceMeta> {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CachedPlaceMeta>;
    const now = Date.now();
    const fresh: Record<string, CachedPlaceMeta> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.cachedAt === 'number' && now - v.cachedAt < CACHE_TTL_MS) {
        fresh[k] = v;
      }
    }
    return fresh;
  } catch {
    return {};
  }
}

function loadLivePlaceCache(): Record<string, GoogleDiscoveryCafe> {
  try {
    const raw = localStorage.getItem(LIVE_PLACES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, GoogleDiscoveryCafe>;
    const now = Date.now();
    const fresh: Record<string, GoogleDiscoveryCafe> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.cachedAt === 'number' && now - v.cachedAt < CACHE_TTL_MS) {
        fresh[k] = v;
      }
    }
    return fresh;
  } catch {
    return {};
  }
}

function persistCachedMeta(next: Record<string, CachedPlaceMeta>) {
  try {
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
}

function persistLivePlaceCache(next: Record<string, GoogleDiscoveryCafe>) {
  try {
    const entries = Object.entries(next).slice(-45);
    localStorage.setItem(LIVE_PLACES_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Ignore storage quota errors
  }
}

export function checkGmpQuotaError(err: unknown) {
  const text = err instanceof Error ? err.message : String(err ?? '');
  if (
    text.includes('RESOURCE_EXHAUSTED') ||
    text.includes('OVER_QUERY_LIMIT') ||
    text.includes('QuotaExceeded') ||
    text.includes('429')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

function formatPriceLevel(raw: unknown): string {
  const s = String(raw ?? '');
  if (s === 'FREE' || s === 'PRICE_LEVEL_FREE') return 'Free';
  if (s === 'INEXPENSIVE' || s === 'PRICE_LEVEL_INEXPENSIVE') return 'Budget-friendly (₹)';
  if (s === 'MODERATE' || s === 'PRICE_LEVEL_MODERATE') return 'Moderate (₹₹)';
  if (s === 'EXPENSIVE' || s === 'PRICE_LEVEL_EXPENSIVE') return 'Premium (₹₹₹)';
  if (s === 'VERY_EXPENSIVE' || s === 'PRICE_LEVEL_VERY_EXPENSIVE') return 'High-end (₹₹₹₹)';
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
    if (candidate && !/^\d+$/.test(candidate) && !/bengaluru|bangalore|karnataka|india/i.test(candidate)) {
      return candidate;
    }
  }
  return fallback;
}

function deriveCategoryLabel(types: string[] = []): string {
  const joined = types.join(' ').toLowerCase();
  if (joined.includes('tea')) return 'Tea Shop';
  if (joined.includes('bakery')) return 'Bakery';
  if (joined.includes('juice')) return 'Juice & Beverage';
  if (joined.includes('ice_cream') || joined.includes('dessert')) return 'Dessert & Ice Cream';
  if (joined.includes('sandwich') || joined.includes('hamburger')) return 'Sandwich & Burger';
  if (joined.includes('fast_food')) return 'Snacks & Fast Food';
  if (joined.includes('coffee_shop')) return 'Coffee Shop';
  if (joined.includes('restaurant')) return 'Eatery / Cafe';
  return 'Cafe';
}

function toDiscoveryCafe(
  place: google.maps.places.Place,
  areaFallback: string,
  userLoc: LatLngPoint | null
): GoogleDiscoveryCafe | null {
  const loc = place.location;
  if (!loc) return null;
  const lat = loc.lat();
  const lng = loc.lng();
  const id = place.id || `place-${lat.toFixed(4)}-${lng.toFixed(4)}`;
  const name = place.displayName || 'Local Place';
  const address = place.formattedAddress || `${areaFallback}, India`;
  const areaLabel = extractAreaLabel(address, areaFallback);
  const photos = (place.photos ?? [])
    .slice(0, 6)
    .map((photo) => {
      try {
        return photo.getURI({ maxWidth: 1000 });
      } catch {
        return '';
      }
    })
    .filter((uri: string): uri is string => Boolean(uri));
  const openingHours = place.regularOpeningHours?.weekdayDescriptions ?? [];

  const directionsUrl =
    buildGoogleMapsDirectionsUrl({
      place_id: place.id || '',
      lat,
      lng,
      name,
      address,
      area: areaLabel,
      city: 'Bengaluru',
    }) || '';

  const viewMapUrl =
    place.googleMapsURI ||
    buildGoogleMapsViewUrl({
      place_id: place.id || '',
      lat,
      lng,
      name,
      address,
      area: areaLabel,
      city: 'Bengaluru',
      map_link: '',
    }) ||
    directionsUrl;

  const types = Array.isArray(place.types) ? place.types : [];

  return {
    id,
    placeId: place.id,
    name,
    areaLabel,
    address,
    lat,
    lng,
    rating: typeof place.rating === 'number' ? Math.round(place.rating * 10) / 10 : null,
    ratingCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
    websiteUrl: place.websiteURI || '',
    mapLink: directionsUrl,
    viewMapUrl,
    phone: place.nationalPhoneNumber || '',
    photos,
    openingHours,
    priceLevelLabel: formatPriceLevel(place.priceLevel),
    categoryLabel: deriveCategoryLabel(types),
    types,
    distanceKm: userLoc ? computeDistanceKm(userLoc.lat, userLoc.lng, lat, lng) : null,
    sourceType: 'google_places',
    cachedAt: Date.now(),
  };
}

export function googleDiscoveryToLocationItem(
  gc: GoogleDiscoveryCafe
): LocationItem & {
  distanceKm: number | null;
  isLiveGooglePlace: true;
  openingHours: string[];
  priceLevelLabel: string;
} {
  const directionsUrl =
    buildGoogleMapsDirectionsUrl({
      place_id: gc.placeId,
      lat: gc.lat,
      lng: gc.lng,
      name: gc.name,
      address: gc.address,
      area: gc.areaLabel || 'Bengaluru',
      city: 'Bengaluru',
    }) || gc.mapLink;

  return {
    id: `google:${gc.placeId}`,
    slug: `google:${gc.placeId}`,
    name: gc.name,
    category: gc.categoryLabel || 'Cafe',
    city: 'Bengaluru',
    area: gc.areaLabel || 'Bengaluru',
    address: gc.address,
    phone: gc.phone,
    map_link: directionsUrl,
    website_url: gc.websiteUrl,
    menu_url: '',
    instagram_url: '',
    place_id: gc.placeId,
    lat: gc.lat,
    lng: gc.lng,
    timings: gc.openingHours[0] ? 'See weekly hours below' : 'Hours not available',
    description: `${gc.name} in ${gc.areaLabel || 'Bengaluru'} discovered live via Google Places.`,
    photos: gc.photos,
    photos_approved: gc.photos.length > 0,
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
    price_range: gc.priceLevelLabel,
    coffee_price: null,
    tea_price: null,
    snacks_price: null,
    meals_price: null,
    popular_items: [],
    rating: gc.rating,
    rating_count: gc.ratingCount,
    min_spend: null,
    laptop_friendly: false,
    time_limit: null,
    modes: ['work'],
    facilities: [],
    offers: [],
    menu_services: [],
    best_for: [gc.categoryLabel || 'Coffee & snacks', 'Google Places Discovery'],
    verdict:
      'Google Places Discovery listing. Wi-Fi speed, plug points, and workspace details are not independently verified by CafeDesk yet.',
    avoid_if: null,
    student_discount: null,
    verified: false,
    featured: false,
    published: true,
    display_order: 999,
    last_verified_date: null,
    claims: ['Live place details sourced from Google Places API (New).'],
    source_name: 'Google Places Discovery',
    source_url: gc.viewMapUrl || directionsUrl,
    source_type: 'google_places',
    opening_hours_list: gc.openingHours,
    price_level_label: gc.priceLevelLabel,
    distanceKm: gc.distanceKm,
    isLiveGooglePlace: true,
    openingHours: gc.openingHours,
    priceLevelLabel: gc.priceLevelLabel,
    sample: false,
  };
}

const DiscoveryContext = createContext<DiscoveryContextValue>({
  userLocation: null,
  geoStatus: 'idle',
  geoError: '',
  requestUserLocation: async () => null,
  clearUserLocation: () => {},
  placeMetaByCafeId: {},
  enrichLocationFromPlaces: async () => {},
  getEffectiveLocation: (loc) => ({ ...loc, distanceKm: null }),
  nearbyPlaces: [],
  nearbyLoading: false,
  loadingMoreNearby: false,
  nearbyHasMore: false,
  nearbyLabel: '',
  placesNotice: '',
  clearPlacesNotice: () => {},
  discoverCafesNear: async () => {},
  discoverCafesByAreaText: async () => null,
  searchLiveCafesInBengaluru: async () => [],
  loadMoreLiveCafes: async () => {},
  livePlaceCache: {},
  fetchGooglePlaceDetails: async () => null,
  resolvePredictionToPlace: async () => null,
  placesReady: false,
  localities: [],
  localitiesByRegion: {
    'North Bengaluru': [],
    'South Bengaluru': [],
    'East Bengaluru': [],
    'West Bengaluru': [],
    'Central Bengaluru': [],
    'Outer Bengaluru': [],
  },
  refreshLocalities: async () => {},
  localityPlaces: [],
  localityLoading: false,
  activeLocalityMeta: null,
  loadLocalityPlaces: async () => ({
    locality: null,
    places: [],
    curatedCount: 0,
    discoveredCount: 0,
  }),
});

const LIVE_PLACE_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'websiteURI',
  'googleMapsURI',
  'nationalPhoneNumber',
  'regularOpeningHours',
  'priceLevel',
  'types',
  'photos',
];

export function DiscoveryProvider({ children }: { children: React.ReactNode }) {
  const placesLib = useMapsLibrary('places');

  const [userLocation, setUserLocation] = useState<LatLngPoint | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [geoError, setGeoError] = useState('');
  const [placeMetaByCafeId, setPlaceMetaByCafeId] = useState<Record<string, CachedPlaceMeta>>(() =>
    loadCachedMeta()
  );
  const [livePlaceCache, setLivePlaceCache] = useState<Record<string, GoogleDiscoveryCafe>>(() =>
    loadLivePlaceCache()
  );
  const [nearbyPlaces, setNearbyPlaces] = useState<GoogleDiscoveryCafe[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [loadingMoreNearby, setLoadingMoreNearby] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [nearbyLabel, setNearbyLabel] = useState('');
  const [placesNotice, setPlacesNotice] = useState('');
  const [localities, setLocalities] = useState<LocalityRecord[]>(() =>
    DEFAULT_BENGALURU_LOCALITIES.map((seed, idx) => ({
      id: idx + 1,
      slug: seed.slug,
      name: seed.name,
      region: seed.region,
      city: 'Bengaluru',
      alt_spellings: seed.altSpellings,
      local_names: seed.localNames,
      keywords: seed.keywords,
      lat: seed.lat,
      lng: seed.lng,
      radius_meters: seed.radiusMeters,
      subzones: seed.subzones,
      active: true,
      admin_approved: true,
      discovery_status: 'pending',
      last_discovery_at: null,
      discovery_progress: 0,
      categories_completed: [],
      categories_failed: [],
      discovered_count: 0,
      unique_place_count: 0,
      duplicate_count: 0,
      coverage_notes: '',
      last_error: '',
      retry_count: 0,
      next_retry_at: null,
      created_at: 0,
      updated_at: 0,
    }))
  );
  const [localityPlaces, setLocalityPlaces] = useState<LocationItem[]>([]);
  const [localityLoading, setLocalityLoading] = useState(false);
  const [activeLocalityMeta, setActiveLocalityMeta] = useState<LocalityRecord | null>(null);

  const inFlightIdsRef = useRef<Record<string, boolean>>({});
  const nearbyCacheRef = useRef<
    Record<string, { places: GoogleDiscoveryCafe[]; nextPageToken: string | null }>
  >({});
  const lastSearchPayloadRef = useRef<Record<string, unknown> | null>(null);

  const refreshLocalities = useCallback(async () => {
    try {
      const res = await fetch(resolveApiUrl('/api/localities'));
      if (!res.ok) return;
      const data = (await res.json()) as { localities?: LocalityRecord[] };
      if (Array.isArray(data.localities) && data.localities.length > 0) {
        setLocalities(data.localities);
      }
    } catch {
      // Fallback to default Bengaluru seed localities
    }
  }, []);

  useEffect(() => {
    void refreshLocalities();
  }, [refreshLocalities]);

  const localitiesByRegion = React.useMemo(() => {
    const grouped: Record<BengaluruRegionName, LocalityRecord[]> = {
      'North Bengaluru': [],
      'South Bengaluru': [],
      'East Bengaluru': [],
      'West Bengaluru': [],
      'Central Bengaluru': [],
      'Outer Bengaluru': [],
    };
    for (const loc of localities) {
      if (grouped[loc.region]) {
        grouped[loc.region].push(loc);
      } else {
        grouped['Outer Bengaluru'].push(loc);
      }
    }
    for (const r of BENGALURU_REGIONS) {
      grouped[r].sort((a, b) => a.name.localeCompare(b.name));
    }
    return grouped;
  }, [localities]);

  const clearPlacesNotice = useCallback(() => setPlacesNotice(''), []);

  const cacheLiveCafes = useCallback((items: GoogleDiscoveryCafe[]) => {
    if (items.length === 0) return;
    setLivePlaceCache((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (item.placeId) next[item.placeId] = { ...item, cachedAt: Date.now() };
      }
      persistLivePlaceCache(next);
      return next;
    });
  }, []);

  const requestUserLocation = useCallback(async (): Promise<LatLngPoint | null> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('unavailable');
      setGeoError('Geolocation is not supported in this browser.');
      return null;
    }

    setGeoStatus('requesting');
    setGeoError('');

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const point = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setUserLocation(point);
          setGeoStatus('granted');
          resolve(point);
        },
        (err) => {
          setGeoStatus('denied');
          setGeoError(
            err.code === 1
              ? 'Location permission was declined. Search any Bengaluru locality or Indian city manually.'
              : 'Could not detect your current GPS position.'
          );
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 180000 }
      );
    });
  }, []);

  const clearUserLocation = useCallback(() => {
    setUserLocation(null);
    setGeoStatus('idle');
    setGeoError('');
  }, []);

  useEffect(() => {
    if (!userLocation) return;
    setNearbyPlaces((prev) =>
      prev.map((item) => ({
        ...item,
        distanceKm: computeDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng),
      }))
    );
  }, [userLocation]);

  const enrichLocationFromPlaces = useCallback(
    async (loc: LocationItem) => {
      if (!placesLib) return;
      const existing = placeMetaByCafeId[loc.id];
      const hasCoordsAndRating = loc.lat !== null && loc.lng !== null && loc.rating !== null;
      const hasCachedPhotos = Boolean(existing && existing.photos && existing.photos.length > 0);
      if (hasCoordsAndRating && (loc.photos.length >= 4 || hasCachedPhotos)) return;
      if (existing && Date.now() - existing.cachedAt < CACHE_TTL_MS && hasCachedPhotos) return;
      if (inFlightIdsRef.current[loc.id]) return;

      inFlightIdsRef.current[loc.id] = true;
      try {
        const response = await placesLib.Place.searchByText({
          textQuery: `${loc.name} ${loc.area} ${loc.city || 'Bengaluru'}`,
          includedType: 'cafe',
          locationBias: {
            center: BENGALURU_CENTER,
            radius: 25000,
          },
          maxResultCount: 1,
          fields: [
            'id',
            'displayName',
            'formattedAddress',
            'location',
            'rating',
            'userRatingCount',
            'websiteURI',
            'googleMapsURI',
            'nationalPhoneNumber',
            'photos',
          ],
          internalUsageAttributionIds: [GMP_ATTRIBUTION_ID],
        });

        const match = response.places?.[0];
        if (!match || !match.location) return;

        const placePhotos: string[] = (match.photos ?? [])
          .slice(0, 6)
          .map((photo) => {
            try {
              return photo.getURI({ maxWidth: 1200 });
            } catch {
              return '';
            }
          })
          .filter((uri: string): uri is string => Boolean(uri));

        const meta: CachedPlaceMeta = {
          placeId: match.id,
          lat: match.location.lat(),
          lng: match.location.lng(),
          rating: typeof match.rating === 'number' ? Math.round(match.rating * 10) / 10 : null,
          ratingCount: typeof match.userRatingCount === 'number' ? match.userRatingCount : null,
          websiteUrl: match.websiteURI || '',
          googleMapsUri: match.googleMapsURI || '',
          formattedAddress: match.formattedAddress || '',
          phone: match.nationalPhoneNumber || '',
          photos: placePhotos,
          cachedAt: Date.now(),
        };

        setPlaceMetaByCafeId((prev) => {
          const next = { ...prev, [loc.id]: meta };
          persistCachedMeta(next);
          return next;
        });
      } catch (err) {
        checkGmpQuotaError(err);
      } finally {
        inFlightIdsRef.current[loc.id] = false;
      }
    },
    [placesLib, placeMetaByCafeId]
  );

  const normalizeServerPlaces = useCallback(
    (rawList: GoogleDiscoveryCafe[], originPoint?: LatLngPoint | null): GoogleDiscoveryCafe[] => {
      const refPoint = originPoint || userLocation;
      return rawList.map((item) => ({
        ...item,
        distanceKm:
          refPoint && typeof item.lat === 'number' && typeof item.lng === 'number'
            ? computeDistanceKm(refPoint.lat, refPoint.lng, item.lat, item.lng)
            : item.distanceKm ?? null,
        mapLink:
          buildGoogleMapsDirectionsUrl({
            place_id: item.placeId,
            lat: item.lat,
            lng: item.lng,
            name: item.name,
            address: item.address,
            area: item.areaLabel,
            city: 'Bengaluru',
          }) || item.mapLink,
      }));
    },
    [userLocation]
  );

  const discoverCafesNear = useCallback(
    async (
      center: LatLngPoint,
      label: string,
      radiusMeters = 3500,
      category = 'all'
    ) => {
      const cacheKey = `nearby:${center.lat.toFixed(2)},${center.lng.toFixed(2)},${radiusMeters},${category}`;
      const cached = nearbyCacheRef.current[cacheKey];
      if (cached) {
        setNearbyPlaces(cached.places);
        setNextPageToken(cached.nextPageToken);
        setNearbyLabel(label);
        return;
      }

      setNearbyLoading(true);
      setNearbyLabel(label);
      setPlacesNotice('');
      try {
        const res = await fetch(resolveApiUrl('/api/places/nearby'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: center.lat,
            lng: center.lng,
            radiusMeters,
            category,
          }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          places?: GoogleDiscoveryCafe[];
          code?: string;
          error?: string;
        };

        if (res.ok && Array.isArray(data.places)) {
          const normalized = normalizeServerPlaces(data.places, center);
          nearbyCacheRef.current[cacheKey] = { places: normalized, nextPageToken: null };
          cacheLiveCafes(normalized);
          setNearbyPlaces(normalized);
          setNextPageToken(null);
          return;
        }

        if (res.status === 429 || data.code === 'RESOURCE_EXHAUSTED') {
          checkGmpQuotaError('RESOURCE_EXHAUSTED');
        }

        // Fallback to Places JS library when server key is not injected into Node env
        if (placesLib) {
          const catTab = DISCOVERY_CATEGORY_TABS.find((c) => c.id === category);
          const sdkRes = await placesLib.Place.searchNearby({
            locationRestriction: {
              center,
              radius: Math.min(50000, Math.max(500, radiusMeters)),
            },
            includedPrimaryTypes:
              catTab && catTab.includedTypes.length > 0
                ? catTab.includedTypes
                : ['cafe', 'coffee_shop', 'bakery'],
            maxResultCount: 14,
            rankPreference: 'DISTANCE',
            fields: LIVE_PLACE_FIELDS,
            internalUsageAttributionIds: [GMP_ATTRIBUTION_ID],
          });

          const parsed = (sdkRes.places ?? [])
            .map((p: google.maps.places.Place) => toDiscoveryCafe(p, label, center))
            .filter((x: GoogleDiscoveryCafe | null): x is GoogleDiscoveryCafe => x !== null);

          nearbyCacheRef.current[cacheKey] = { places: parsed, nextPageToken: null };
          cacheLiveCafes(parsed);
          setNearbyPlaces(parsed);
          setNextPageToken(null);
          return;
        }

        setPlacesNotice(
          data.error || 'Live Google Places nearby search requires an active Places API key.'
        );
      } catch (err) {
        checkGmpQuotaError(err);
        setPlacesNotice('Unable to reach live Google Places nearby search right now.');
      } finally {
        setNearbyLoading(false);
      }
    },
    [placesLib, normalizeServerPlaces, cacheLiveCafes]
  );

  const searchLiveCafesInBengaluru = useCallback(
    async (
      queryText: string,
      options?: Omit<DiscoverSearchParams, 'query'>
    ): Promise<GoogleDiscoveryCafe[]> => {
      const cleaned = queryText.trim();
      const category = options?.category || 'all';
      const locality = (options?.locality || '').trim();
      const city = (options?.city || 'Bengaluru').trim();
      const radiusMeters = options?.radiusMeters || 12000;
      const lat = options?.lat ?? userLocation?.lat ?? null;
      const lng = options?.lng ?? userLocation?.lng ?? null;

      if (!cleaned && !locality && category === 'all') return [];

      const cacheKey = `search:${cleaned.toLowerCase()}|${category}|${locality.toLowerCase()}|${city.toLowerCase()}|${radiusMeters}`;
      const cached = nearbyCacheRef.current[cacheKey];
      if (cached && !options?.append) {
        setNearbyPlaces(cached.places);
        setNextPageToken(cached.nextPageToken);
        setNearbyLabel(cleaned || locality || city);
        lastSearchPayloadRef.current = {
          query: cleaned,
          category,
          locality,
          city,
          radiusMeters,
          lat,
          lng,
        };
        return cached.places;
      }

      setNearbyLoading(true);
      setNearbyLabel(cleaned || locality || city);
      setPlacesNotice('');
      try {
        const requestBody = {
          query: cleaned,
          category,
          locality,
          city,
          radiusMeters,
          lat,
          lng,
        };
        lastSearchPayloadRef.current = requestBody;

        const res = await fetch(resolveApiUrl('/api/places/search'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const data = (await res.json().catch(() => ({}))) as {
          places?: GoogleDiscoveryCafe[];
          nextPageToken?: string | null;
          code?: string;
          error?: string;
        };

        if (res.ok && Array.isArray(data.places)) {
          const originPt = lat !== null && lng !== null ? { lat, lng } : userLocation;
          const normalized = normalizeServerPlaces(data.places, originPt);
          const nextTok = data.nextPageToken || null;
          nearbyCacheRef.current[cacheKey] = { places: normalized, nextPageToken: nextTok };
          cacheLiveCafes(normalized);
          setNearbyPlaces(normalized);
          setNextPageToken(nextTok);
          return normalized;
        }

        if (res.status === 429 || data.code === 'RESOURCE_EXHAUSTED') {
          checkGmpQuotaError('RESOURCE_EXHAUSTED');
        }

        if (placesLib) {
          const catTab = DISCOVERY_CATEGORY_TABS.find((c) => c.id === category);
          const textQ = [
            cleaned || (catTab && catTab.id !== 'all' ? catTab.placesQuery : 'cafes coffee tea bakery'),
            locality,
            city,
          ]
            .filter(Boolean)
            .join(' ');
          const sdkRes = await placesLib.Place.searchByText({
            textQuery: textQ,
            locationBias: {
              center: lat !== null && lng !== null ? { lat, lng } : BENGALURU_CENTER,
              radius: Math.min(50000, radiusMeters),
            },
            maxResultCount: 14,
            fields: LIVE_PLACE_FIELDS,
            internalUsageAttributionIds: [GMP_ATTRIBUTION_ID],
          });

          const parsed = (sdkRes.places ?? [])
            .map((p: google.maps.places.Place) =>
              toDiscoveryCafe(p, locality || city, userLocation)
            )
            .filter((x: GoogleDiscoveryCafe | null): x is GoogleDiscoveryCafe => x !== null);

          nearbyCacheRef.current[cacheKey] = { places: parsed, nextPageToken: null };
          cacheLiveCafes(parsed);
          setNearbyPlaces(parsed);
          setNextPageToken(null);
          return parsed;
        }

        setPlacesNotice(
          data.error || 'Live Google Places discovery is waiting for a valid Places API key.'
        );
        return [];
      } catch (err) {
        checkGmpQuotaError(err);
        setPlacesNotice('Unable to query live local businesses right now.');
        return [];
      } finally {
        setNearbyLoading(false);
      }
    },
    [placesLib, userLocation, normalizeServerPlaces, cacheLiveCafes]
  );

  const loadMoreLiveCafes = useCallback(async () => {
    if (!nextPageToken || !lastSearchPayloadRef.current || loadingMoreNearby) return;
    setLoadingMoreNearby(true);
    try {
      const res = await fetch(resolveApiUrl('/api/places/search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...lastSearchPayloadRef.current,
          pageToken: nextPageToken,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        places?: GoogleDiscoveryCafe[];
        nextPageToken?: string | null;
      };
      if (res.ok && Array.isArray(data.places)) {
        const more = normalizeServerPlaces(data.places, userLocation);
        cacheLiveCafes(more);
        setNearbyPlaces((prev) => {
          const seen = new Set(prev.map((p) => p.placeId));
          return [...prev, ...more.filter((m) => !seen.has(m.placeId))];
        });
        setNextPageToken(data.nextPageToken || null);
      } else {
        setNextPageToken(null);
      }
    } catch {
      setNextPageToken(null);
    } finally {
      setLoadingMoreNearby(false);
    }
  }, [nextPageToken, loadingMoreNearby, normalizeServerPlaces, userLocation, cacheLiveCafes]);

  const discoverCafesByAreaText = useCallback(
    async (
      areaQuery: string,
      category = 'all',
      city = 'Bengaluru'
    ): Promise<LatLngPoint | null> => {
      if (!areaQuery.trim()) return null;
      const results = await searchLiveCafesInBengaluru('', {
        locality: areaQuery.trim(),
        city,
        category,
      });
      return results[0] ? { lat: results[0].lat, lng: results[0].lng } : null;
    },
    [searchLiveCafesInBengaluru]
  );

  const fetchGooglePlaceDetails = useCallback(
    async (placeId: string): Promise<GoogleDiscoveryCafe | null> => {
      const cleanId = placeId.replace(/^google:/, '').trim();
      if (!cleanId) return null;
      const cached = livePlaceCache[cleanId];
      if (cached && cached.cachedAt && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return userLocation
          ? {
              ...cached,
              distanceKm: computeDistanceKm(
                userLocation.lat,
                userLocation.lng,
                cached.lat,
                cached.lng
              ),
            }
          : cached;
      }

      try {
        const res = await fetch(
          resolveApiUrl(`/api/places/details?placeId=${encodeURIComponent(cleanId)}`)
        );
        if (res.ok) {
          const data = (await res.json()) as { place?: GoogleDiscoveryCafe };
          if (data.place) {
            const [normalized] = normalizeServerPlaces([data.place], userLocation);
            if (normalized) {
              cacheLiveCafes([normalized]);
              return normalized;
            }
          }
        }
      } catch {
        // Fallback to JS SDK below
      }

      if (!placesLib) return cached ?? null;

      try {
        const place = new placesLib.Place({ id: cleanId });
        await place.fetchFields({ fields: LIVE_PLACE_FIELDS });
        const parsed = toDiscoveryCafe(place, 'Bengaluru', userLocation);
        if (parsed) cacheLiveCafes([parsed]);
        return parsed;
      } catch (err) {
        checkGmpQuotaError(err);
        return cached ?? null;
      }
    },
    [placesLib, livePlaceCache, userLocation, normalizeServerPlaces, cacheLiveCafes]
  );

  const resolvePredictionToPlace = useCallback(
    async (
      suggestion: google.maps.places.AutocompleteSuggestion
    ): Promise<GoogleDiscoveryCafe | null> => {
      if (!placesLib || !suggestion.placePrediction) return null;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({ fields: LIVE_PLACE_FIELDS });
        const parsed = toDiscoveryCafe(place, 'Bengaluru', userLocation);
        if (parsed) cacheLiveCafes([parsed]);
        return parsed;
      } catch (err) {
        checkGmpQuotaError(err);
        return null;
      }
    },
    [placesLib, userLocation, cacheLiveCafes]
  );

  const getEffectiveLocation = useCallback(
    (loc: LocationItem): LocationItem & { distanceKm: number | null } => {
      const cached = placeMetaByCafeId[loc.id];
      const lat = loc.lat ?? cached?.lat ?? null;
      const lng = loc.lng ?? cached?.lng ?? null;
      const rating = loc.rating ?? cached?.rating ?? null;
      const rating_count = loc.rating_count ?? cached?.ratingCount ?? null;
      const website_url = loc.website_url || cached?.websiteUrl || '';
      const place_id = loc.place_id || cached?.placeId || '';
      const phone = loc.phone || cached?.phone || '';
      const rawMapLink = loc.map_link || cached?.googleMapsUri || '';
      const address = loc.address || cached?.formattedAddress || '';
      const map_link =
        buildGoogleMapsDirectionsUrl({
          place_id,
          lat,
          lng,
          name: loc.name,
          address,
          area: loc.area,
          city: loc.city,
        }) || rawMapLink;
      const mergedPhotos = Array.from(
        new Set([...(loc.photos || []), ...(cached?.photos || [])])
      ).filter(Boolean);
      const photos_approved = loc.photos_approved || mergedPhotos.length > 0;
      const distanceKm =
        userLocation && lat !== null && lng !== null
          ? computeDistanceKm(userLocation.lat, userLocation.lng, lat, lng)
          : null;

      return {
        ...loc,
        address,
        lat,
        lng,
        rating,
        rating_count,
        website_url,
        place_id,
        phone,
        map_link,
        photos: mergedPhotos,
        photos_approved,
        distanceKm,
      };
    },
    [placeMetaByCafeId, userLocation]
  );

  const loadLocalityPlaces = useCallback(
    async (
      slugOrName: string,
      options?: { category?: string; warm?: boolean }
    ): Promise<{
      locality: LocalityRecord | null;
      places: LocationItem[];
      curatedCount: number;
      discoveredCount: number;
    }> => {
      const clean = String(slugOrName || '').trim().toLowerCase();
      if (!clean) {
        setLocalityPlaces([]);
        setActiveLocalityMeta(null);
        return { locality: null, places: [], curatedCount: 0, discoveredCount: 0 };
      }

      const matched = localities.find(
        (l) =>
          l.slug === clean ||
          l.name.toLowerCase() === clean ||
          l.alt_spellings.some((a) => a.toLowerCase() === clean) ||
          l.local_names.some((n) => n.toLowerCase() === clean)
      );
      const targetSlug = matched?.slug || clean.replace(/[^a-z0-9]+/g, '-');

      setLocalityLoading(true);
      try {
        const params = new URLSearchParams();
        if (options?.category && options.category !== 'all') {
          params.set('category', options.category);
        }
        if (options?.warm !== false) {
          params.set('warm', '1');
        }
        const res = await fetch(
          resolveApiUrl(
            `/api/localities/${encodeURIComponent(targetSlug)}/places?${params.toString()}`
          ),
          { credentials: 'include' }
        );
        if (res.status === 429) {
          checkGmpQuotaError('RESOURCE_EXHAUSTED');
        }
        if (!res.ok) {
          return { locality: matched ?? null, places: [], curatedCount: 0, discoveredCount: 0 };
        }
        const data = (await res.json()) as {
          locality?: LocalityRecord;
          places?: LocationItem[];
          curated_count?: number;
          discovered_count?: number;
        };
        const rawPlaces = Array.isArray(data.places) ? data.places : [];
        const withDistance = rawPlaces.map((p) => {
          const dist =
            userLocation && p.lat !== null && p.lng !== null
              ? computeDistanceKm(userLocation.lat, userLocation.lng, p.lat, p.lng)
              : null;
          return { ...p, distanceKm: dist };
        });
        setLocalityPlaces(withDistance);
        setActiveLocalityMeta(data.locality ?? matched ?? null);
        if (data.locality) {
          setLocalities((prev) =>
            prev.map((item) => (item.id === data.locality!.id ? data.locality! : item))
          );
        }
        // Cache discovered Google entries into livePlaceCache for instant detail view
        const googleItems: GoogleDiscoveryCafe[] = withDistance
          .filter((p) => p.isLiveGooglePlace && p.place_id)
          .map((p) => ({
            id: p.id,
            placeId: p.place_id!,
            name: p.name,
            areaLabel: p.area,
            address: p.address,
            lat: p.lat ?? BENGALURU_CENTER.lat,
            lng: p.lng ?? BENGALURU_CENTER.lng,
            rating: p.rating,
            ratingCount: p.rating_count,
            websiteUrl: p.website_url || '',
            mapLink: p.map_link,
            viewMapUrl: p.source_url || p.map_link,
            phone: p.phone || '',
            photos: p.photos || [],
            openingHours: p.opening_hours_list || [],
            priceLevelLabel: p.price_level_label || p.price_range || '',
            categoryLabel: p.category,
            distanceKm: p.distanceKm ?? null,
            sourceType: 'google_places',
            cachedAt: Date.now(),
          }));
        if (googleItems.length > 0) cacheLiveCafes(googleItems);

        return {
          locality: data.locality ?? matched ?? null,
          places: withDistance,
          curatedCount: Number(data.curated_count ?? 0),
          discoveredCount: Number(data.discovered_count ?? 0),
        };
      } catch (err) {
        checkGmpQuotaError(err);
        return { locality: matched ?? null, places: [], curatedCount: 0, discoveredCount: 0 };
      } finally {
        setLocalityLoading(false);
      }
    },
    [localities, userLocation, cacheLiveCafes]
  );

  return (
    <DiscoveryContext.Provider
      value={{
        userLocation,
        geoStatus,
        geoError,
        requestUserLocation,
        clearUserLocation,
        placeMetaByCafeId,
        enrichLocationFromPlaces,
        getEffectiveLocation,
        nearbyPlaces,
        nearbyLoading,
        loadingMoreNearby,
        nearbyHasMore: Boolean(nextPageToken),
        nearbyLabel,
        placesNotice,
        clearPlacesNotice,
        discoverCafesNear,
        discoverCafesByAreaText,
        searchLiveCafesInBengaluru,
        loadMoreLiveCafes,
        livePlaceCache,
        fetchGooglePlaceDetails,
        resolvePredictionToPlace,
        placesReady: Boolean(placesLib),
        localities,
        localitiesByRegion,
        refreshLocalities,
        localityPlaces,
        localityLoading,
        activeLocalityMeta,
        loadLocalityPlaces,
      }}
    >
      {children}
    </DiscoveryContext.Provider>
  );
}

export function useDiscovery() {
  return useContext(DiscoveryContext);
}

/// <reference types="google.maps" />
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { BENGALURU_CENTER } from '../config/constants';
import type { LocationItem } from '../types/cms';
import { computeDistanceKm } from '../utils/cafeHelpers';

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
  phone: string;
  photos: string[];
  openingHours: string[];
  priceLevelLabel: string;
  distanceKm: number | null;
  cachedAt?: number;
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
  nearbyLabel: string;
  discoverCafesNear: (center: LatLngPoint, label: string, radiusMeters?: number) => Promise<void>;
  discoverCafesByAreaText: (areaQuery: string) => Promise<LatLngPoint | null>;
  searchLiveCafesInBengaluru: (queryText: string) => Promise<GoogleDiscoveryCafe[]>;
  livePlaceCache: Record<string, GoogleDiscoveryCafe>;
  fetchGooglePlaceDetails: (placeId: string) => Promise<GoogleDiscoveryCafe | null>;
  resolvePredictionToPlace: (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => Promise<GoogleDiscoveryCafe | null>;
  placesReady: boolean;
}

const CACHE_STORAGE_KEY = 'cafedesk_places_meta_v2';
const LIVE_PLACES_STORAGE_KEY = 'cafedesk_live_places_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (< 30 day ToS cap)
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
    // Cap stored entries to keep localStorage fast and compact
    const entries = Object.entries(next).slice(-40);
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
  const name = place.displayName || 'Bengaluru Cafe';
  const address = place.formattedAddress || `${areaFallback}, Bengaluru`;
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
    mapLink:
      place.googleMapsURI ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${areaLabel} Bengaluru`)}`,
    phone: place.nationalPhoneNumber || '',
    photos,
    openingHours,
    priceLevelLabel: formatPriceLevel(place.priceLevel),
    distanceKm: userLoc ? computeDistanceKm(userLoc.lat, userLoc.lng, lat, lng) : null,
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
  return {
    id: `google:${gc.placeId}`,
    slug: `google:${gc.placeId}`,
    name: gc.name,
    city: 'Bengaluru',
    area: gc.areaLabel || 'Bengaluru',
    address: gc.address,
    phone: gc.phone,
    map_link: gc.mapLink,
    website_url: gc.websiteUrl,
    menu_url: '',
    instagram_url: '',
    place_id: gc.placeId,
    lat: gc.lat,
    lng: gc.lng,
    timings: gc.openingHours[0] ? 'See weekly hours below' : 'Check hours on Google Maps',
    description: `${gc.name} in ${gc.areaLabel || 'Bengaluru'} discovered live via Google Maps.`,
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
    best_for: ['Coffee & meetups', 'Live Bengaluru discovery'],
    verdict: 'Live Google Maps cafe listing. Wi-Fi speed and socket count have not been verified in person yet.',
    avoid_if: null,
    student_discount: null,
    verified: false,
    featured: false,
    published: true,
    display_order: 999,
    last_verified_date: null,
    claims: ['Live place information fetched directly from Google Maps Platform.'],
    source_name: 'Google Maps Places',
    source_url: gc.mapLink,
    sample: false,
    distanceKm: gc.distanceKm,
    isLiveGooglePlace: true,
    openingHours: gc.openingHours,
    priceLevelLabel: gc.priceLevelLabel,
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
  nearbyLabel: '',
  discoverCafesNear: async () => {},
  discoverCafesByAreaText: async () => null,
  searchLiveCafesInBengaluru: async () => [],
  livePlaceCache: {},
  fetchGooglePlaceDetails: async () => null,
  resolvePredictionToPlace: async () => null,
  placesReady: false,
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
  const [nearbyLabel, setNearbyLabel] = useState('');

  const inFlightIdsRef = useRef<Record<string, boolean>>({});
  const nearbyCacheRef = useRef<Record<string, GoogleDiscoveryCafe[]>>({});

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
              ? 'Location permission was declined. You can still browse cafes by Bengaluru area.'
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
          textQuery: `${loc.name} ${loc.area} Bengaluru`,
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

  const discoverCafesNear = useCallback(
    async (center: LatLngPoint, label: string, radiusMeters = 3500) => {
      if (!placesLib) return;
      const cacheKey = `${center.lat.toFixed(2)},${center.lng.toFixed(2)},${radiusMeters}`;
      const cached = nearbyCacheRef.current[cacheKey];
      if (cached) {
        setNearbyPlaces(cached);
        setNearbyLabel(label);
        return;
      }

      setNearbyLoading(true);
      setNearbyLabel(label);
      try {
        const res = await placesLib.Place.searchNearby({
          locationRestriction: {
            center,
            radius: Math.min(50000, Math.max(500, radiusMeters)),
          },
          includedPrimaryTypes: ['cafe', 'coffee_shop'],
          maxResultCount: 12,
          rankPreference: 'DISTANCE',
          fields: LIVE_PLACE_FIELDS,
          internalUsageAttributionIds: [GMP_ATTRIBUTION_ID],
        });

        const parsed = (res.places ?? [])
          .map((p: google.maps.places.Place) => toDiscoveryCafe(p, label, userLocation))
          .filter((x: GoogleDiscoveryCafe | null): x is GoogleDiscoveryCafe => x !== null);

        nearbyCacheRef.current[cacheKey] = parsed;
        cacheLiveCafes(parsed);
        setNearbyPlaces(parsed);
      } catch (err) {
        checkGmpQuotaError(err);
      } finally {
        setNearbyLoading(false);
      }
    },
    [placesLib, userLocation, cacheLiveCafes]
  );

  const discoverCafesByAreaText = useCallback(
    async (areaQuery: string): Promise<LatLngPoint | null> => {
      if (!placesLib || !areaQuery.trim()) return null;
      const cacheKey = `area:${areaQuery.trim().toLowerCase()}`;
      const cached = nearbyCacheRef.current[cacheKey];
      if (cached) {
        setNearbyPlaces(cached);
        setNearbyLabel(areaQuery);
        return cached[0] ? { lat: cached[0].lat, lng: cached[0].lng } : null;
      }

      setNearbyLoading(true);
      setNearbyLabel(areaQuery);
      try {
        const res = await placesLib.Place.searchByText({
          textQuery: `cafes in ${areaQuery} Bengaluru`,
          includedType: 'cafe',
          locationBias: { center: BENGALURU_CENTER, radius: 30000 },
          maxResultCount: 12,
          fields: LIVE_PLACE_FIELDS,
          internalUsageAttributionIds: [GMP_ATTRIBUTION_ID],
        });

        const parsed = (res.places ?? [])
          .map((p: google.maps.places.Place) => toDiscoveryCafe(p, areaQuery, userLocation))
          .filter((x: GoogleDiscoveryCafe | null): x is GoogleDiscoveryCafe => x !== null);

        nearbyCacheRef.current[cacheKey] = parsed;
        cacheLiveCafes(parsed);
        setNearbyPlaces(parsed);
        return parsed[0] ? { lat: parsed[0].lat, lng: parsed[0].lng } : null;
      } catch (err) {
        checkGmpQuotaError(err);
        return null;
      } finally {
        setNearbyLoading(false);
      }
    },
    [placesLib, userLocation, cacheLiveCafes]
  );

  const searchLiveCafesInBengaluru = useCallback(
    async (queryText: string): Promise<GoogleDiscoveryCafe[]> => {
      const cleaned = queryText.trim();
      if (!placesLib || cleaned.length < 2) return [];

      const wantsNearby = /near me|nearby/i.test(cleaned);
      const hasCity = /bengaluru|bangalore/i.test(cleaned);
      const formattedQuery =
        wantsNearby || hasCity ? cleaned : `${cleaned} cafe Bengaluru`;
      const cacheKey = `search:${formattedQuery.toLowerCase()}`;
      const cached = nearbyCacheRef.current[cacheKey];
      if (cached) {
        setNearbyPlaces(cached);
        setNearbyLabel(cleaned);
        return cached;
      }

      setNearbyLoading(true);
      setNearbyLabel(cleaned);
      try {
        const center = wantsNearby && userLocation ? userLocation : BENGALURU_CENTER;
        const radius = wantsNearby && userLocation ? 6000 : 32000;
        const res = await placesLib.Place.searchByText({
          textQuery: formattedQuery,
          includedType: 'cafe',
          locationBias: { center, radius },
          maxResultCount: 12,
          fields: LIVE_PLACE_FIELDS,
          internalUsageAttributionIds: [GMP_ATTRIBUTION_ID],
        });

        const parsed = (res.places ?? [])
          .map((p: google.maps.places.Place) => toDiscoveryCafe(p, 'Bengaluru', userLocation))
          .filter((x: GoogleDiscoveryCafe | null): x is GoogleDiscoveryCafe => x !== null);

        nearbyCacheRef.current[cacheKey] = parsed;
        cacheLiveCafes(parsed);
        setNearbyPlaces(parsed);
        return parsed;
      } catch (err) {
        checkGmpQuotaError(err);
        return [];
      } finally {
        setNearbyLoading(false);
      }
    },
    [placesLib, userLocation, cacheLiveCafes]
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
    [placesLib, livePlaceCache, userLocation, cacheLiveCafes]
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
      const map_link = loc.map_link || cached?.googleMapsUri || '';
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
        nearbyLabel,
        discoverCafesNear,
        discoverCafesByAreaText,
        searchLiveCafesInBengaluru,
        livePlaceCache,
        fetchGooglePlaceDetails,
        resolvePredictionToPlace,
        placesReady: Boolean(placesLib),
      }}
    >
      {children}
    </DiscoveryContext.Provider>
  );
}

export function useDiscovery() {
  return useContext(DiscoveryContext);
}

import { useEffect } from 'react';
import {
  BUDGET_BRACKETS,
  type BudgetBracketId,
  DISCOVERY_CATEGORY_TABS,
  type DiscoveryCategoryTabId,
  SITE_CONFIG,
  type WorkMoodId,
} from '../config/constants';
import type { CafeSourceType, LocationItem } from '../types/cms';

/**
 * Parses "8:00 AM – 11:00 PM" or overnight "11:00 AM – 1:30 AM" into minutes from midnight.
 */
function parseTimeToMinutes(raw: string): number | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function getBengaluruMinutesNow(): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? '12');
    const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return hh * 60 + mm;
  } catch {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
}

export type CafeOpenStatus = 'open' | 'closed' | 'unknown';

export function getCafeOpenStatus(timings: string): CafeOpenStatus {
  const segments = timings.split(/[–-]/);
  if (segments.length !== 2) return 'unknown';
  const openMin = parseTimeToMinutes(segments[0]);
  const closeMin = parseTimeToMinutes(segments[1]);
  if (openMin === null || closeMin === null) return 'unknown';

  const currentMin = getBengaluruMinutesNow();
  if (closeMin > openMin) {
    return currentMin >= openMin && currentMin < closeMin ? 'open' : 'closed';
  }
  return currentMin >= openMin || currentMin < closeMin ? 'open' : 'closed';
}

export function isCafeOpenNow(timings: string): boolean {
  return getCafeOpenStatus(timings) === 'open';
}

/**
 * Haversine great-circle distance in kilometres.
 */
export function computeDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function formatDistanceKm(km: number | null | undefined): string | null {
  if (km === null || km === undefined || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.max(50, Math.round(km * 1000))} m away`;
  return `${km.toFixed(1)} km away`;
}

/**
 * Official Google Maps Directions URL builder — exact destination per cafe.
 * Priority:
 * 1. Valid Google Place ID + destination name/address
 * 2. Valid lat/lng coordinates
 * 3. Reliable full address string
 * 4. null when no valid location details exist (UI shows disabled/error state)
 * Never includes origin so Google Maps defaults to the user's own starting point.
 */
export function buildGoogleMapsDirectionsUrl(
  loc: Pick<LocationItem, 'place_id' | 'lat' | 'lng' | 'name' | 'address' | 'area' | 'city'>
): string | null {
  const rawPlaceId = String(loc.place_id || '').replace(/^google:/, '').trim();
  const hasValidPlaceId = Boolean(rawPlaceId) && !rawPlaceId.startsWith('place-');

  const cleanName = String(loc.name || '').trim();
  const cleanAddr = String(loc.address || '').trim();
  const cleanArea = String(loc.area || '').trim();
  const cleanCity = String(loc.city || 'Bengaluru').trim();

  const destinationLabel =
    cleanName && cleanAddr
      ? `${cleanName}, ${cleanAddr}`
      : cleanAddr || (cleanName && cleanArea ? `${cleanName}, ${cleanArea}, ${cleanCity}` : cleanName);

  if (hasValidPlaceId) {
    const dest = destinationLabel || `${loc.lat ?? ''},${loc.lng ?? ''}`.replace(/^,$/, '') || 'Destination';
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&destination_place_id=${encodeURIComponent(rawPlaceId)}`;
  }

  if (
    typeof loc.lat === 'number' &&
    typeof loc.lng === 'number' &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng)
  ) {
    return `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;
  }

  if (destinationLabel && destinationLabel.length >= 4) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationLabel)}`;
  }

  return null;
}

/**
 * Opens the exact place page / pin on Google Maps (separate from Directions).
 */
export function buildGoogleMapsViewUrl(
  loc: Pick<LocationItem, 'place_id' | 'lat' | 'lng' | 'name' | 'address' | 'area' | 'city' | 'map_link'>
): string | null {
  const rawPlaceId = String(loc.place_id || '').replace(/^google:/, '').trim();
  const hasValidPlaceId = Boolean(rawPlaceId) && !rawPlaceId.startsWith('place-');
  const query = [loc.name, loc.address || loc.area, loc.city || 'Bengaluru']
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(', ');

  if (hasValidPlaceId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || loc.name || 'Cafe')}&query_place_id=${encodeURIComponent(rawPlaceId)}`;
  }
  if (loc.map_link && /^https:\/\/(www\.)?(google\.com\/maps|maps\.google\.com|maps\.app\.goo\.gl)/i.test(loc.map_link)) {
    return loc.map_link;
  }
  if (
    typeof loc.lat === 'number' &&
    typeof loc.lng === 'number' &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;
  }
  if (query.length >= 4) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  return null;
}

export interface CafeSourceMeta {
  type: CafeSourceType;
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
}

export function getCafeSourceMeta(
  loc: Pick<LocationItem, 'source_type' | 'verified' | 'isLiveGooglePlace' | 'source_name'>
): CafeSourceMeta {
  let type: CafeSourceType = 'cafedesk_verified';
  if (loc.source_type === 'google_places' || loc.isLiveGooglePlace || /google/i.test(loc.source_name || '')) {
    type = loc.verified ? 'cafedesk_verified' : 'google_places';
  } else if (loc.source_type === 'community_updated') {
    type = 'community_updated';
  } else if (loc.verified) {
    type = 'cafedesk_verified';
  } else if (loc.source_type) {
    type = loc.source_type;
  }

  if (type === 'cafedesk_verified') {
    return {
      type,
      label: 'CafeDesk Verified',
      shortLabel: 'Verified',
      description: 'Curated or reviewed by the CafeDesk editorial team.',
      badgeClass: 'bg-[#ecfdf5] text-[#1b4d3e] border border-[#a7f3d0]',
    };
  }
  if (type === 'community_updated') {
    return {
      type,
      label: 'Community Updated',
      shortLabel: 'Community',
      description: 'Updated via a recent user or cafe owner correction.',
      badgeClass: 'bg-[#fef3c7] text-[#92400e] border border-[#fcd34d]',
    };
  }
  return {
    type: 'google_places',
    label: 'Google Places Discovery',
    shortLabel: 'Google Places',
    description: 'Live Google Places listing. Not independently verified by CafeDesk.',
    badgeClass: 'bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]',
  };
}

export function normalizePlaceName(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|cafe|coffee|roasters|tea|shop|bakery|house|kitchen|restaurant|bengaluru|bangalore)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function deduplicateCafeItems<
  T extends Pick<LocationItem, 'id' | 'place_id' | 'name' | 'area' | 'lat' | 'lng'>,
>(curated: T[], external: T[]): T[] {
  const seenPlaceIds = new Set<string>();
  for (const item of curated) {
    const pid = String(item.place_id || '').replace(/^google:/, '').trim();
    if (pid) seenPlaceIds.add(pid);
  }

  const out: T[] = [...curated];
  for (const ext of external) {
    const extPid = String(ext.place_id || '').replace(/^google:/, '').trim();
    if (extPid && seenPlaceIds.has(extPid)) continue;

    const normExtName = normalizePlaceName(ext.name);
    const isDuplicate = out.some((existing) => {
      const existingPid = String(existing.place_id || '').replace(/^google:/, '').trim();
      if (extPid && existingPid && extPid === existingPid) return true;

      const normExisting = normalizePlaceName(existing.name);
      const nameMatches =
        Boolean(normExtName) &&
        Boolean(normExisting) &&
        (normExtName === normExisting ||
          (normExtName.length >= 5 && normExisting.includes(normExtName)) ||
          (normExisting.length >= 5 && normExtName.includes(normExisting)));

      if (!nameMatches) return false;

      if (
        typeof existing.lat === 'number' &&
        typeof existing.lng === 'number' &&
        typeof ext.lat === 'number' &&
        typeof ext.lng === 'number'
      ) {
        return computeDistanceKm(existing.lat, existing.lng, ext.lat, ext.lng) <= 0.18;
      }

      return existing.area.trim().toLowerCase() === ext.area.trim().toLowerCase();
    });

    if (!isDuplicate) {
      if (extPid) seenPlaceIds.add(extPid);
      out.push(ext);
    }
  }
  return out;
}

export function matchesDiscoveryCategoryTab(
  loc: Pick<
    LocationItem,
    'category' | 'name' | 'description' | 'popular_items' | 'claims' | 'facilities' | 'modes' | 'laptop_friendly' | 'avg_cost_per_person' | 'tea_price' | 'snacks_price'
  >,
  tabId: DiscoveryCategoryTabId | string
): boolean {
  if (!tabId || tabId === 'all') return true;
  const tab = DISCOVERY_CATEGORY_TABS.find((t) => t.id === tabId);
  if (!tab) return true;

  const haystack = [
    loc.category || '',
    loc.name || '',
    loc.description || '',
    ...(loc.popular_items || []),
    ...(loc.claims || []),
    ...(loc.facilities || []),
    loc.tea_price ? 'tea chai' : '',
    loc.snacks_price ? 'snacks' : '',
  ]
    .join(' ')
    .toLowerCase();

  if (tabId === 'workspaces') {
    return (
      loc.laptop_friendly ||
      loc.modes.includes('work') ||
      loc.modes.includes('calm') ||
      /work|study|laptop|cowork|workspace/i.test(haystack)
    );
  }
  if (tabId === 'budget_food') {
    return (
      loc.modes.includes('budget') ||
      (loc.avg_cost_per_person !== null && loc.avg_cost_per_person <= 220) ||
      tab.keywords.some((kw) => haystack.includes(kw))
    );
  }

  return tab.keywords.some((kw) => haystack.includes(kw));
}

export function matchesWorkMood(
  loc: Pick<
    LocationItem,
    'modes' | 'noise_level' | 'wifi_available' | 'charging_sockets' | 'suitable_for_studying' | 'suitable_for_working' | 'laptop_friendly' | 'avg_cost_per_person' | 'best_for' | 'category'
  >,
  moodId: WorkMoodId | string
): boolean {
  if (!moodId) return true;
  switch (moodId) {
    case 'deep_focus':
      return (
        (loc.noise_level !== null ? loc.noise_level <= 2 : loc.modes.includes('calm') || loc.modes.includes('work')) &&
        (loc.laptop_friendly || loc.suitable_for_working === 'yes' || loc.wifi_available === 'yes')
      );
    case 'study_mode':
      return (
        loc.suitable_for_studying === 'yes' ||
        loc.modes.includes('calm') ||
        (loc.noise_level !== null && loc.noise_level <= 2) ||
        loc.best_for.some((b) => /study|read|focus/i.test(b))
      );
    case 'business_meeting':
      return (
        loc.modes.includes('plan') ||
        loc.modes.includes('work') ||
        loc.best_for.some((b) => /meeting|call|team/i.test(b))
      );
    case 'casual_coffee':
      return /coffee|cafe|tea|chai|bakery/i.test(loc.category || 'cafe') || loc.modes.includes('budget');
    case 'creative_work':
      return loc.laptop_friendly || loc.modes.includes('work') || loc.modes.includes('calm');
    case 'social_workspace':
      return loc.modes.includes('plan') || (loc.noise_level !== null && loc.noise_level >= 3);
    default:
      return true;
  }
}

export function matchesBudgetBracket(
  avgCost: number | null,
  priceRange: string,
  bracketId: BudgetBracketId | string | ''
): boolean {
  if (!bracketId) return true;
  if (bracketId === 'under-50') {
    if (avgCost !== null) return avgCost <= 50;
    return /₹\s*[1-4]?\d\b|under ₹50/i.test(priceRange);
  }
  if (bracketId === 'under-200') {
    if (avgCost !== null) return avgCost <= 200;
    return /₹50–₹100|₹100–₹200|Under ₹200|Budget-friendly/i.test(priceRange);
  }
  if (bracketId === '200-500') {
    if (avgCost !== null) return avgCost >= 200 && avgCost <= 500;
    return /₹200–₹300|₹300–₹500|₹200–₹500|Moderate/i.test(priceRange);
  }
  if (bracketId === '200-300') {
    if (avgCost !== null) return avgCost >= 200 && avgCost <= 300;
    return /₹200–₹300|Moderate/i.test(priceRange);
  }
  if (bracketId === '300-500') {
    if (avgCost !== null) return avgCost >= 300 && avgCost <= 500;
    return /₹300–₹500/i.test(priceRange);
  }
  const bracket = BUDGET_BRACKETS.find((b) => b.id === bracketId);
  if (!bracket) return true;
  if (avgCost !== null) {
    if (bracket.max === null) return avgCost >= bracket.min;
    if (bracketId === '50-100') return avgCost >= 50 && avgCost <= 100;
    return avgCost >= bracket.min && avgCost <= bracket.max;
  }
  if (bracketId === '50-100' || bracketId === '100-200') {
    return priceRange.includes(bracket.label) || /Budget-friendly/i.test(priceRange);
  }
  if (bracketId === '500+') {
    return priceRange.includes('₹500+') || /Premium|High-end/i.test(priceRange);
  }
  return priceRange.includes(bracket.label);
}

export function buildWhatsAppUrl(message: string, phoneNumber?: string): string {
  const cleanDigits = (phoneNumber || SITE_CONFIG.whatsappNumber).replace(/[^\d]/g, '');
  return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(message)}`;
}

export function triggerWhatsAppLink(message: string, phoneNumber?: string): string {
  const url = buildWhatsAppUrl(message, phoneNumber);
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return url;
}

/**
 * Updates document title, meta description, canonical URL, OpenGraph, Twitter,
 * robots tags, Google Search Console verification, and JSON-LD structured data per route.
 */
export function useDocumentMeta(
  title: string,
  description: string,
  options?: {
    ogImage?: string;
    allowIndexing?: boolean;
    canonicalPath?: string;
    ogType?: 'website' | 'article' | 'place';
    schemas?: Array<Record<string, unknown> | null | undefined>;
    googleSiteVerification?: string;
  }
) {
  const schemasKey = JSON.stringify(options?.schemas?.filter(Boolean) ?? []);

  useEffect(() => {
    document.title = title;

    const origin = window.location.origin;
    const rawCanonicalPath = options?.canonicalPath ?? window.location.pathname;
    const cleanCanonicalPath =
      rawCanonicalPath === '/' ? '/' : rawCanonicalPath.replace(/\/+$/, '');
    const canonicalUrl = /^https?:\/\//i.test(cleanCanonicalPath)
      ? cleanCanonicalPath
      : `${origin}${cleanCanonicalPath.startsWith('/') ? '' : '/'}${cleanCanonicalPath}`;

    const setOrCreateMeta = (attr: 'name' | 'property', key: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setOrCreateMeta('name', 'description', description);
    setOrCreateMeta('property', 'og:type', options?.ogType || 'website');
    setOrCreateMeta('property', 'og:url', canonicalUrl);
    setOrCreateMeta('property', 'og:title', title);
    setOrCreateMeta('property', 'og:description', description);
    setOrCreateMeta('name', 'twitter:title', title);
    setOrCreateMeta('name', 'twitter:description', description);

    let canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonicalUrl);

    if (options?.ogImage) {
      const absImg = /^https?:\/\//i.test(options.ogImage)
        ? options.ogImage
        : `${origin}${options.ogImage.startsWith('/') ? '' : '/'}${options.ogImage}`;
      setOrCreateMeta('property', 'og:image', absImg);
      setOrCreateMeta('name', 'twitter:image', absImg);
    }

    setOrCreateMeta(
      'name',
      'robots',
      options?.allowIndexing === false ? 'noindex,nofollow' : 'index,follow'
    );

    if (options?.googleSiteVerification?.trim()) {
      setOrCreateMeta('name', 'google-site-verification', options.googleSiteVerification.trim());
    }

    // Replace route-scoped JSON-LD blocks cleanly
    document
      .querySelectorAll('script[type="application/ld+json"][data-cafedesk-seo="true"]')
      .forEach((node) => node.remove());

    const parsedSchemas = JSON.parse(schemasKey) as Array<Record<string, unknown>>;
    parsedSchemas.forEach((schemaObj) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-cafedesk-seo', 'true');
      script.textContent = JSON.stringify(schemaObj);
      document.head.appendChild(script);
    });
  }, [
    title,
    description,
    options?.ogImage,
    options?.allowIndexing,
    options?.canonicalPath,
    options?.ogType,
    options?.googleSiteVerification,
    schemasKey,
  ]);
}

/**
 * Returns the canonical cafe detail route (/cafe/:slug).
 */
export function getCafeDetailRoute(slugOrKey: string, _authenticated?: boolean): string {
  if (slugOrKey.startsWith('/cafe/')) return slugOrKey;
  if (slugOrKey.startsWith('/locations/')) {
    return slugOrKey.replace(/^\/locations\//, '/cafe/');
  }
  return `/cafe/${slugOrKey}`;
}

/**
 * Extracts a clean starting price label (e.g., "From ₹90") for public cafe cards.
 */
export function getStartingPriceLabel(
  loc: Pick<LocationItem, 'tea_price' | 'coffee_price' | 'price_range' | 'avg_cost_per_person'>
): string {
  const candidates: number[] = [];
  const collectNums = (raw: string | null | undefined) => {
    if (!raw) return;
    const matches = raw.match(/\d{2,4}/g);
    if (matches) {
      for (const m of matches) {
        const n = Number(m);
        if (Number.isFinite(n) && n >= 15 && n <= 5000) candidates.push(n);
      }
    }
  };
  collectNums(loc.tea_price);
  collectNums(loc.coffee_price);
  collectNums(loc.price_range);
  if (candidates.length > 0) {
    return `From ₹${Math.min(...candidates)}`;
  }
  if (loc.avg_cost_per_person !== null && loc.avg_cost_per_person > 0) {
    return `Avg ₹${loc.avg_cost_per_person}`;
  }
  if (loc.price_range) {
    return loc.price_range;
  }
  return 'Price not available';
}

/**
 * Derives available workspace types for public cafe cards & cafe detail views.
 */
export function getWorkspaceTypesForCafe(
  loc: Pick<
    LocationItem,
    'laptop_friendly' | 'suitable_for_working' | 'suitable_for_studying' | 'comfortable_seating' | 'modes' | 'charging_sockets' | 'isLiveGooglePlace' | 'verified'
  >
): string[] {
  const types: string[] = [];
  if (loc.laptop_friendly || loc.suitable_for_working === 'yes' || loc.modes.includes('work')) {
    types.push('Laptop Desk');
  }
  if (loc.suitable_for_studying === 'yes' || loc.modes.includes('calm')) {
    types.push('Quiet Study');
  }
  if (loc.modes.includes('plan')) {
    types.push('Meeting Seats');
  }
  if (loc.modes.includes('budget')) {
    types.push('Budget Tables');
  }
  if (types.length === 0 && loc.comfortable_seating === 'yes') {
    types.push('Comfortable Seating');
  }
  if (types.length === 0 && (loc.isLiveGooglePlace || !loc.verified)) {
    return ['Workspace not verified'];
  }
  if (types.length === 0) {
    types.push('Cafe Seating');
  }
  return types.slice(0, 3);
}

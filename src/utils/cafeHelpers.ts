import { useEffect } from 'react';
import { BUDGET_BRACKETS, type BudgetBracketId, SITE_CONFIG } from '../config/constants';
import type { LocationItem } from '../types/cms';

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
  if (km < 1) return `${Math.max(100, Math.round(km * 1000))} m away`;
  return `${km.toFixed(1)} km away`;
}

export function matchesBudgetBracket(
  avgCost: number | null,
  priceRange: string,
  bracketId: BudgetBracketId | string | ''
): boolean {
  if (!bracketId) return true;
  if (bracketId === 'under-200') {
    if (avgCost !== null) return avgCost <= 200;
    return /₹50–₹100|₹100–₹200|Under ₹200/i.test(priceRange);
  }
  const bracket = BUDGET_BRACKETS.find((b) => b.id === bracketId);
  if (!bracket) return true;
  if (avgCost !== null) {
    if (bracket.max === null) return avgCost >= bracket.min;
    if (bracketId === '50-100') return avgCost <= bracket.max;
    return avgCost >= bracket.min && avgCost <= bracket.max;
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
 * Updates document title, meta description, OpenGraph, Twitter, and robots tags dynamically per route.
 */
export function useDocumentMeta(
  title: string,
  description: string,
  options?: { ogImage?: string; allowIndexing?: boolean }
) {
  useEffect(() => {
    document.title = title;

    const setMeta = (selector: string, content: string) => {
      const el = document.querySelector<HTMLMetaElement>(selector);
      if (el) el.setAttribute('content', content);
    };

    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);

    if (options?.ogImage) {
      let ogImg = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
      if (!ogImg) {
        ogImg = document.createElement('meta');
        ogImg.setAttribute('property', 'og:image');
        document.head.appendChild(ogImg);
      }
      ogImg.setAttribute('content', options.ogImage);
    }

    if (options?.allowIndexing === false) {
      let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
      if (!robots) {
        robots = document.createElement('meta');
        robots.setAttribute('name', 'robots');
        document.head.appendChild(robots);
      }
      robots.setAttribute('content', 'noindex,nofollow');
    } else {
      const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
      if (robots) robots.setAttribute('content', 'index,follow');
    }
  }, [title, description, options?.ogImage, options?.allowIndexing]);
}

/**
 * Returns the direct cafe detail route for signed-in members,
 * or redirects unauthenticated visitors to /login?next=<encoded_cafe_path>.
 */
export function getCafeDetailRoute(slugOrKey: string, authenticated: boolean): string {
  const safePath = slugOrKey.startsWith('/locations/')
    ? slugOrKey
    : `/locations/${slugOrKey}`;
  if (authenticated) return safePath;
  return `/login?next=${encodeURIComponent(safePath)}`;
}

/**
 * Extracts a clean starting price label (e.g., "From ₹90") for public cafe cards.
 */
export function getStartingPriceLabel(loc: Pick<LocationItem, 'tea_price' | 'coffee_price' | 'price_range' | 'avg_cost_per_person'>): string {
  const candidates: number[] = [];
  const collectNums = (raw: string | null | undefined) => {
    if (!raw) return;
    const matches = raw.match(/\d{2,4}/g);
    if (matches) {
      for (const m of matches) {
        const n = Number(m);
        if (Number.isFinite(n) && n >= 20 && n <= 5000) candidates.push(n);
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
  return 'Cafe pricing';
}

/**
 * Derives available workspace types for public cafe cards & cafe detail views.
 */
export function getWorkspaceTypesForCafe(
  loc: Pick<
    LocationItem,
    'laptop_friendly' | 'suitable_for_working' | 'suitable_for_studying' | 'comfortable_seating' | 'modes' | 'charging_sockets'
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
  if (types.length === 0) {
    types.push('Cafe Seating');
  }
  return types.slice(0, 3);
}

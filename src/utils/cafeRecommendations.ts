import type { LocationItem } from '../types/cms';

export type FinderPurpose =
  | 'all'
  | 'working'
  | 'studying'
  | 'meeting'
  | 'relaxing'
  | 'date'
  | 'coffee'
  | 'food';

export type FinderAtmosphere = 'any' | 'quiet' | 'lively';

export type FinderBudgetFilter = 'any' | 'under-200' | '200-350' | '350-plus';

export interface FinderPreferences {
  purpose: FinderPurpose;
  area: string;
  nearMeOnly: boolean;
  budget: FinderBudgetFilter;
  atmosphere: FinderAtmosphere;
  laptopFriendly: boolean;
  wifiRequired: boolean;
  chargingSockets: boolean;
  outdoorSeating: boolean;
}

export interface FinderMatchResult {
  location: LocationItem & { distanceKm?: number | null };
  score: number;
  reasons: string[];
}

const RECENTLY_VIEWED_KEY = 'cafedesk_recently_viewed_v1';
const MAX_RECENTLY_VIEWED = 8;

export function getRecentlyViewedSlugs(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function recordRecentlyViewedSlug(slug: string): string[] {
  const clean = slug.trim();
  if (!clean) return getRecentlyViewedSlugs();
  try {
    const prev = getRecentlyViewedSlugs().filter((s) => s !== clean);
    const next = [clean, ...prev].slice(0, MAX_RECENTLY_VIEWED);
    window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

function combinedSearchText(loc: LocationItem): string {
  return [
    loc.name,
    loc.area,
    loc.description,
    loc.verdict,
    ...loc.claims,
    ...loc.facilities,
    ...loc.best_for,
    ...loc.popular_items,
  ]
    .join(' ')
    .toLowerCase();
}

export function isOutdoorFriendly(loc: LocationItem): boolean {
  if (loc.outdoor_seating === 'yes') return true;
  if (loc.outdoor_seating === 'no') return false;
  return /\b(outdoor|patio|terrace|garden|courtyard|balcony|open-air|alfresco|rooftop)\b/i.test(
    combinedSearchText(loc)
  );
}

export function isHiddenGem(loc: LocationItem): boolean {
  if (loc.featured) return false;
  const isIndie = !/starbucks|cafe coffee day|ccd|third wave|blue tokai|tim hortons|costa/i.test(
    loc.name
  );
  return isIndie && (loc.verified || (loc.rating ?? 0) >= 4.2 || loc.photos_approved);
}

export function isTrendingCafe(loc: LocationItem): boolean {
  return (
    (loc.rating !== null && loc.rating >= 4.3) ||
    (loc.rating_count !== null && loc.rating_count >= 500) ||
    loc.featured ||
    loc.verified
  );
}

export function isGoodForDates(loc: LocationItem): boolean {
  const text = combinedSearchText(loc);
  return (
    /\b(date|aesthetic|cozy|garden|rooftop|dessert|brunch|ambience|intimate|warm|courtyard|pastry|cake)\b/i.test(
      text
    ) ||
    loc.modes.includes('plan') ||
    (loc.noise_level !== null && loc.noise_level <= 3 && (loc.rating ?? 0) >= 4.2)
  );
}

export function isRecentlyAddedCafe(loc: LocationItem): boolean {
  if (loc.last_verified_date) {
    const parsed = Date.parse(loc.last_verified_date);
    if (!Number.isNaN(parsed)) return true;
  }
  return loc.display_order > 12;
}

export function getCafeOfTheDay(
  locations: Array<LocationItem & { distanceKm?: number | null }>,
  overrideSlug?: string
): (LocationItem & { distanceKm?: number | null }) | null {
  if (locations.length === 0) return null;
  if (overrideSlug) {
    const clean = overrideSlug.trim().toLowerCase();
    const matched = locations.find(
      (l) => l.slug.toLowerCase() === clean || l.id.toLowerCase() === clean
    );
    if (matched) return matched;
  }
  const pool = locations.filter((l) => l.photos_approved && l.photos.length > 0 && l.verified);
  const candidates = pool.length > 0 ? pool : locations;
  const now = new Date();
  const daySeed =
    now.getFullYear() * 1000 +
    Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  return candidates[daySeed % candidates.length] ?? candidates[0];
}

export interface CuratedCollectionDef {
  id: string;
  title: string;
  subtitle: string;
  areaLabel: string;
  to: string;
  accent: 'amber' | 'forest' | 'espresso';
  match: (loc: LocationItem) => boolean;
}

export const CURATED_COLLECTIONS: CuratedCollectionDef[] = [
  {
    id: 'deep-work-sockets',
    title: 'Deep Work & Wall Sockets',
    subtitle: 'Quiet corners, reachable charging points, and laptop-friendly desks.',
    areaLabel: 'Bengaluru Workspaces',
    to: '/locations?workFriendly=1&sockets=1',
    accent: 'forest',
    match: (loc) =>
      loc.laptop_friendly &&
      (loc.charging_sockets === 'yes' || loc.sockets_claimed || (loc.sockets_count ?? 0) > 0),
  },
  {
    id: 'budget-chai-bakery',
    title: 'Budget Chai & Bakery Spots',
    subtitle: 'Affordable ₹50–₹200 filter coffee, chai, puffs, and neighbourhood bakeries.',
    areaLabel: 'Student Friendly',
    to: '/locations?mode=budget',
    accent: 'amber',
    match: (loc) =>
      loc.modes.includes('budget') ||
      (loc.avg_cost_per_person !== null && loc.avg_cost_per_person <= 220),
  },
  {
    id: 'study-sanctuaries',
    title: 'Quiet Study Sanctuaries',
    subtitle: 'Low-noise seating designed for focused reading and exam prep.',
    areaLabel: 'Calm Acoustics',
    to: '/locations?quiet=1',
    accent: 'espresso',
    match: (loc) =>
      loc.suitable_for_studying === 'yes' ||
      loc.modes.includes('calm') ||
      (loc.noise_level !== null && loc.noise_level <= 2),
  },
  {
    id: 'indiranagar-coffee',
    title: 'Indiranagar & Koramangala Trail',
    subtitle: 'Specialty pour-overs, all-day sourdough, and startup meetups.',
    areaLabel: 'East & South Hubs',
    to: '/locations?area=Indiranagar',
    accent: 'amber',
    match: (loc) => /indiranagar|koramangala/i.test(`${loc.area} ${loc.address}`),
  },
  {
    id: 'outdoor-dates',
    title: 'Garden Corners & Catchups',
    subtitle: 'Warm lighting, conversations, pastries, and outdoor breezes.',
    areaLabel: 'Social & Dates',
    to: '/locations?collection=dates',
    accent: 'forest',
    match: (loc) => isOutdoorFriendly(loc) || isGoodForDates(loc),
  },
];

export function scoreCafeMatch(
  loc: LocationItem & { distanceKm?: number | null },
  prefs: FinderPreferences,
  hasPaidAccess: boolean
): FinderMatchResult {
  let score = 42;
  const reasons: string[] = [];
  const text = combinedSearchText(loc);

  // Locality & distance
  if (prefs.area) {
    const areaMatch = `${loc.area} ${loc.address}`.toLowerCase().includes(prefs.area.toLowerCase());
    if (areaMatch) {
      score += 18;
      reasons.push(`Located in ${loc.area}`);
    } else {
      score -= 18;
    }
  }

  if (prefs.nearMeOnly && loc.distanceKm !== null && loc.distanceKm !== undefined) {
    if (loc.distanceKm <= 2.5) {
      score += 16;
      reasons.push(`${loc.distanceKm.toFixed(1)} km away`);
    } else if (loc.distanceKm <= 5) {
      score += 10;
      reasons.push(`${loc.distanceKm.toFixed(1)} km away`);
    } else if (loc.distanceKm > 10) {
      score -= 10;
    }
  }

  // Purpose matching
  switch (prefs.purpose) {
    case 'working':
      if (loc.suitable_for_working === 'yes' || loc.modes.includes('work')) {
        score += 16;
        reasons.push('Work-ready seating');
      }
      if (loc.laptop_friendly) score += 6;
      break;
    case 'studying':
      if (loc.suitable_for_studying === 'yes' || loc.modes.includes('calm')) {
        score += 18;
        reasons.push('Ideal for focused study');
      }
      if (loc.noise_level !== null && loc.noise_level <= 2) score += 8;
      break;
    case 'meeting':
      if (loc.modes.includes('plan') || /meeting|meetup|group|booth|catchup/i.test(text)) {
        score += 18;
        reasons.push('Great for meetings & catchups');
      }
      break;
    case 'relaxing':
      if (loc.comfortable_seating === 'yes' || /cozy|relax|lounge|calm|garden/i.test(text)) {
        score += 16;
        reasons.push('Relaxed seating & ambience');
      }
      break;
    case 'date':
      if (isGoodForDates(loc)) {
        score += 18;
        reasons.push('Warm ambience & treats');
      }
      break;
    case 'coffee':
      if (loc.coffee_price || /coffee|espresso|latte|kaapi|brew|cappuccino/i.test(text)) {
        score += 16;
        reasons.push('Specialty coffee & brews');
      }
      break;
    case 'food':
      if (loc.snacks_price || loc.meals_price || /sandwich|burger|pastry|breakfast|croissant|bakery/i.test(text)) {
        score += 16;
        reasons.push('Fresh bakery & food bites');
      }
      break;
    default:
      if (loc.verified) score += 6;
  }

  // Atmosphere
  if (prefs.atmosphere === 'quiet') {
    if (loc.noise_level !== null && loc.noise_level <= 2) {
      score += 14;
      reasons.push('Quiet acoustics');
    } else if (loc.noise_level !== null && loc.noise_level >= 4) {
      score -= 14;
    }
  } else if (prefs.atmosphere === 'lively') {
    if (loc.noise_level !== null && loc.noise_level >= 3) {
      score += 12;
      reasons.push('Lively social buzz');
    } else if (loc.modes.includes('plan')) {
      score += 8;
      reasons.push('Vibrant neighbourhood crowd');
    }
  }

  // Laptop friendly
  if (prefs.laptopFriendly) {
    if (loc.laptop_friendly) {
      score += 12;
      reasons.push('Laptop-friendly desks');
    } else {
      score -= 16;
    }
  }

  // Charging sockets
  if (prefs.chargingSockets) {
    const hasPlugs =
      loc.charging_sockets === 'yes' || loc.sockets_claimed || (loc.sockets_count ?? 0) > 0;
    if (hasPlugs) {
      score += 12;
      reasons.push(
        loc.sockets_count ? `${loc.sockets_count} power sockets` : 'Charging sockets available'
      );
    } else {
      score -= 12;
    }
  }

  // Outdoor seating
  if (prefs.outdoorSeating) {
    if (isOutdoorFriendly(loc)) {
      score += 14;
      reasons.push('Outdoor / garden seating');
    } else {
      score -= 10;
    }
  }

  // Wi-Fi requirement (apply gracefully; show speed reason only when Plus unlocked)
  if (prefs.wifiRequired) {
    const hasWifi = loc.wifi_available === 'yes' || (loc.wifi_mbps ?? 0) > 0;
    if (hasWifi) {
      score += 10;
      if (hasPaidAccess) {
        reasons.push(loc.wifi_mbps ? `${loc.wifi_mbps} Mbps Wi-Fi` : 'Customer Wi-Fi');
      }
    } else if (loc.wifi_available === 'no') {
      score -= 18;
    }
  }

  // Budget matching
  if (prefs.budget !== 'any' && loc.avg_cost_per_person !== null) {
    const avg = loc.avg_cost_per_person;
    if (prefs.budget === 'under-200' && avg <= 200) {
      score += 14;
      if (hasPaidAccess) reasons.push(`Budget ~₹${avg}/person`);
    } else if (prefs.budget === '200-350' && avg > 150 && avg <= 380) {
      score += 14;
      if (hasPaidAccess) reasons.push(`Moderate ~₹${avg}/person`);
    } else if (prefs.budget === '350-plus' && avg >= 320) {
      score += 12;
    } else {
      score -= 12;
    }
  }

  if (loc.verified) score += 4;
  if (loc.rating && loc.rating >= 4.3) score += 4;

  const clamped = Math.max(15, Math.min(99, Math.round(score)));
  return {
    location: loc,
    score: clamped,
    reasons: reasons.slice(0, 3),
  };
}

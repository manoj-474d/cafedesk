/**
 * ============================================================================
 * Cafe Desk Contact, Areas & Discovery Constants
 * ============================================================================
 */

export const SITE_CONFIG = {
  name: 'Cafe Desk',
  domain: 'cafedesk.space',
  tagline: 'Find Your Perfect Work Cafe.',
  city: 'Bengaluru',
  whatsappNumber: '919845000000',
  whatsappDisplay: '+91 98450 00000',
  instagramUrl: 'https://instagram.com/cafedesk.space',
  instagramHandle: '@cafedesk.space',
  contactEmail: 'hello@cafedesk.space',
} as const;

export type CafeMode = 'work' | 'budget' | 'calm' | 'plan';

export interface ModeMeta {
  id: CafeMode;
  title: string;
  subtitle: string;
  highlights: string;
}

export const BROWSING_MODES: ModeMeta[] = [
  {
    id: 'work',
    title: 'Laptop-Friendly',
    subtitle: 'Wi-Fi, power sockets, laptop seating',
    highlights: 'Verified Wi-Fi Mbps when measured, reachable plugs, desk seating',
  },
  {
    id: 'budget',
    title: 'Budget-Friendly',
    subtitle: '₹50–₹300 per person, student & chai cafes',
    highlights: 'Pocket-friendly coffee, tea, bakery puffs, snacks & quick bites',
  },
  {
    id: 'calm',
    title: 'Quiet & Study',
    subtitle: 'Low ambient noise, calm corners',
    highlights: 'Peaceful reading spots and study-friendly seating',
  },
  {
    id: 'plan',
    title: 'Conversations & Meetups',
    subtitle: 'Friends catchups & casual meetings',
    highlights: 'Comfortable group tables and relaxed cafe ambiance',
  },
];

export const BENGALURU_AREAS = [
  'Indiranagar',
  'Koramangala',
  'HSR Layout',
  'Whitefield',
  'Jayanagar',
  'MG Road',
  'Church Street',
  'BTM Layout',
  'JP Nagar',
  'Electronic City',
  'Banashankari',
  'Basavanagudi',
  'Malleshwaram',
  'Rajajinagar',
  'Vijayanagar',
  'Yelahanka',
  'Marathahalli',
  'Hennur',
] as const;

export type BudgetBracketId = '50-100' | '100-200' | 'under-200' | '200-300' | '300-500' | '500+';

export interface BudgetBracket {
  id: BudgetBracketId;
  label: string;
  min: number;
  max: number | null;
}

export const BUDGET_BRACKETS: BudgetBracket[] = [
  { id: '50-100', label: '₹50–₹100', min: 50, max: 100 },
  { id: '100-200', label: '₹100–₹200', min: 100, max: 200 },
  { id: '200-300', label: '₹200–₹300', min: 200, max: 300 },
  { id: '300-500', label: '₹300–₹500', min: 300, max: 500 },
  { id: '500+', label: '₹500+', min: 500, max: null },
];

export interface QuickFilterChip {
  id: string;
  label: string;
  to: string;
}

export const HOME_QUICK_FILTERS: QuickFilterChip[] = [
  { id: 'coffee', label: 'Coffee', to: '/locations?q=coffee' },
  { id: 'wifi', label: 'Wi-Fi', to: '/locations?wifi=1' },
  { id: 'work', label: 'Laptop-Friendly', to: '/locations?workFriendly=1' },
  { id: 'sockets', label: 'Charging Points', to: '/locations?sockets=1' },
  { id: 'budget', label: 'Budget-Friendly', to: '/locations?mode=budget' },
  { id: 'quiet', label: 'Quiet Cafes', to: '/locations?quiet=1' },
];

export const BENGALURU_CENTER = { lat: 12.9716, lng: 77.5946 } as const;

export const NOISE_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Quiet · Library calm',
  2: 'Quiet · Soft acoustic hum',
  3: 'Moderate · Cafe chatter',
  4: 'Busy · Lively & upbeat',
  5: 'Busy · Loud & bustling',
};

export function getNoiseSummary(noise: 1 | 2 | 3 | 4 | 5 | null): 'Quiet' | 'Moderate' | 'Busy' | null {
  if (noise === null) return null;
  if (noise <= 2) return 'Quiet';
  if (noise === 3) return 'Moderate';
  return 'Busy';
}

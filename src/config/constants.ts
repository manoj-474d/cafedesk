/**
 * ============================================================================
 * Cafe Desk Contact, Areas, Categories, Moods & Discovery Constants
 * ============================================================================
 */

export const SITE_CONFIG = {
  name: 'Cafe Desk',
  domain: 'cafedesk.space',
  tagline: 'Find Your Perfect Work Cafe.',
  city: 'Bengaluru',
  whatsappNumber: '918217379133',
  whatsappDisplay: '+91 82173 79133',
  instagramUrl: 'https://instagram.com/cafedesk.space',
  instagramHandle: '@cafedesk.space',
  contactEmail: 'hellocafedeskspace@gmail.com',
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

import {
  BENGALURU_REGIONS,
  DEFAULT_BENGALURU_LOCALITIES,
  STANDARD_BUSINESS_CATEGORIES,
  type BengaluruRegion,
  type StandardBusinessCategory,
} from './localities';

export {
  BENGALURU_REGIONS,
  DEFAULT_BENGALURU_LOCALITIES,
  STANDARD_BUSINESS_CATEGORIES,
  type BengaluruRegion,
  type StandardBusinessCategory,
};

export const BENGALURU_AREAS = DEFAULT_BENGALURU_LOCALITIES.map((l) => l.name);


export const SUPPORTED_CITIES = [
  'Bengaluru',
  'Mysuru',
  'Mumbai',
  'Pune',
  'Hyderabad',
  'Chennai',
  'Delhi NCR',
] as const;

export type DiscoveryCategoryTabId =
  | 'all'
  | 'coffee'
  | 'tea'
  | 'snacks'
  | 'bakery'
  | 'juice'
  | 'desserts'
  | 'budget_food'
  | 'workspaces';

export type DiscoveryBusinessCategoryId =
  | 'coffee_shop'
  | 'tea_shop'
  | 'cafe'
  | 'bakery'
  | 'snacks_fast_food'
  | 'juice_beverage'
  | 'sandwich_burger'
  | 'dessert_ice_cream'
  | 'budget_eatery'
  | 'workspace_restaurant'
  | 'study_cafe'
  | 'laptop_workspace'
  | 'neighbourhood_food';

export interface DiscoveryCategoryTab {
  id: DiscoveryCategoryTabId;
  label: string;
  placesQuery: string;
  includedTypes: string[];
  keywords: string[];
}

export const DISCOVERY_CATEGORY_TABS: DiscoveryCategoryTab[] = [
  {
    id: 'all',
    label: 'All',
    placesQuery: 'cafes coffee tea bakery snacks',
    includedTypes: ['cafe', 'coffee_shop', 'bakery', 'tea_house'],
    keywords: [],
  },
  {
    id: 'coffee',
    label: 'Coffee',
    placesQuery: 'coffee shops filter coffee espresso',
    includedTypes: ['coffee_shop', 'cafe'],
    keywords: ['coffee', 'espresso', 'roaster', 'latte', 'filter coffee', 'kaapi', 'cappuccino', 'cold coffee'],
  },
  {
    id: 'tea',
    label: 'Tea',
    placesQuery: 'tea shop chai stall tea house',
    includedTypes: ['tea_house', 'cafe'],
    keywords: ['tea', 'chai', 'irani', 'darjeeling', 'matcha', 'kulhad', 'kullad', 'dum tea'],
  },
  {
    id: 'snacks',
    label: 'Snacks',
    placesQuery: 'snacks fast food chaat sandwich burger',
    includedTypes: ['fast_food_restaurant', 'sandwich_shop'],
    keywords: ['snack', 'samosa', 'puff', 'chaat', 'sandwich', 'burger', 'maggi', 'fries', 'vada', 'fast food', 'toast'],
  },
  {
    id: 'bakery',
    label: 'Bakery',
    placesQuery: 'bakery pastries cakes puffs',
    includedTypes: ['bakery'],
    keywords: ['bakery', 'bake', 'croissant', 'cake', 'pastry', 'bread', 'bun', 'biscuit'],
  },
  {
    id: 'juice',
    label: 'Juice',
    placesQuery: 'fresh juice shop smoothies shakes',
    includedTypes: ['juice_shop', 'cafe'],
    keywords: ['juice', 'smoothie', 'shake', 'milkshake', 'fresh', 'cooler', 'beverage', 'iced tea'],
  },
  {
    id: 'desserts',
    label: 'Desserts',
    placesQuery: 'desserts ice cream gelato waffles',
    includedTypes: ['ice_cream_shop', 'dessert_shop'],
    keywords: ['dessert', 'ice cream', 'gelato', 'waffle', 'brownie', 'sweet', 'cake', 'donut', 'cheesecake'],
  },
  {
    id: 'budget_food',
    label: 'Budget Food',
    placesQuery: 'budget eatery darshini tiffin pocket friendly',
    includedTypes: ['restaurant', 'fast_food_restaurant', 'cafe'],
    keywords: ['budget', 'darshini', 'tiffin', 'chai', 'student', 'affordable', 'eatery', 'dosa', 'idli', 'parotta'],
  },
  {
    id: 'workspaces',
    label: 'Workspaces',
    placesQuery: 'study cafe laptop friendly wifi workspace cafe',
    includedTypes: ['cafe', 'coffee_shop'],
    keywords: ['work', 'laptop', 'study', 'wifi', 'socket', 'cowork', 'quiet'],
  },
];

export interface DiscoveryBusinessCategory {
  id: DiscoveryBusinessCategoryId;
  label: string;
  tabId: DiscoveryCategoryTabId;
  placesQuery: string;
  includedTypes: string[];
  quickScan: boolean;
}

export const DISCOVERY_BUSINESS_CATEGORIES: DiscoveryBusinessCategory[] = [
  {
    id: 'coffee_shop',
    label: 'Coffee shops',
    tabId: 'coffee',
    placesQuery: 'coffee shop',
    includedTypes: ['coffee_shop'],
    quickScan: true,
  },
  {
    id: 'tea_shop',
    label: 'Tea shops & tea stalls',
    tabId: 'tea',
    placesQuery: 'tea shop chai stall',
    includedTypes: ['tea_house', 'cafe'],
    quickScan: true,
  },
  {
    id: 'cafe',
    label: 'Cafes',
    tabId: 'all',
    placesQuery: 'cafe',
    includedTypes: ['cafe'],
    quickScan: false,
  },
  {
    id: 'bakery',
    label: 'Bakeries',
    tabId: 'bakery',
    placesQuery: 'bakery',
    includedTypes: ['bakery'],
    quickScan: true,
  },
  {
    id: 'snacks_fast_food',
    label: 'Snacks & fast-food shops',
    tabId: 'snacks',
    placesQuery: 'snacks fast food shop',
    includedTypes: ['fast_food_restaurant'],
    quickScan: true,
  },
  {
    id: 'juice_beverage',
    label: 'Juice & fresh beverage shops',
    tabId: 'juice',
    placesQuery: 'fresh juice shop',
    includedTypes: ['juice_shop', 'cafe'],
    quickScan: true,
  },
  {
    id: 'sandwich_burger',
    label: 'Sandwich & burger shops',
    tabId: 'snacks',
    placesQuery: 'sandwich burger cafe',
    includedTypes: ['sandwich_shop', 'hamburger_restaurant'],
    quickScan: true,
  },
  {
    id: 'dessert_ice_cream',
    label: 'Dessert & ice cream shops',
    tabId: 'desserts',
    placesQuery: 'dessert ice cream shop',
    includedTypes: ['ice_cream_shop', 'dessert_shop'],
    quickScan: true,
  },
  {
    id: 'budget_eatery',
    label: 'Budget-friendly eateries',
    tabId: 'budget_food',
    placesQuery: 'budget eatery darshini snacks',
    includedTypes: ['restaurant', 'fast_food_restaurant'],
    quickScan: true,
  },
  {
    id: 'workspace_restaurant',
    label: 'Restaurants with workspace seating',
    tabId: 'workspaces',
    placesQuery: 'laptop friendly cafe restaurant wifi',
    includedTypes: ['cafe', 'restaurant'],
    quickScan: false,
  },
  {
    id: 'study_cafe',
    label: 'Study-friendly cafes',
    tabId: 'workspaces',
    placesQuery: 'quiet study cafe reading wifi',
    includedTypes: ['cafe', 'coffee_shop'],
    quickScan: false,
  },
  {
    id: 'laptop_workspace',
    label: 'Laptop-friendly workspaces',
    tabId: 'workspaces',
    placesQuery: 'work cafe laptop coworking coffee',
    includedTypes: ['cafe', 'coffee_shop'],
    quickScan: false,
  },
  {
    id: 'neighbourhood_food',
    label: 'Small neighbourhood food shops',
    tabId: 'budget_food',
    placesQuery: 'local snacks tea bakery shop',
    includedTypes: ['bakery', 'cafe', 'fast_food_restaurant'],
    quickScan: true,
  },
];

export type WorkMoodId =
  | 'deep_focus'
  | 'study_mode'
  | 'business_meeting'
  | 'casual_coffee'
  | 'creative_work'
  | 'social_workspace';

export interface WorkMoodMeta {
  id: WorkMoodId;
  label: string;
  description: string;
  searchHint: string;
}

export const WORK_MOODS: WorkMoodMeta[] = [
  {
    id: 'deep_focus',
    label: 'Deep Focus',
    description: 'Low noise, steady desks & verified power/Wi-Fi where available',
    searchHint: 'quiet work cafe',
  },
  {
    id: 'study_mode',
    label: 'Study Mode',
    description: 'Calm reading corners, student-friendly tables & affordable drinks',
    searchHint: 'study cafe',
  },
  {
    id: 'business_meeting',
    label: 'Business Meeting',
    description: 'Clean seating, reliable ambiance & central locations',
    searchHint: 'specialty coffee meeting',
  },
  {
    id: 'casual_coffee',
    label: 'Casual Coffee',
    description: 'Great espresso, chai, or cold brew without heavy spend',
    searchHint: 'coffee shop',
  },
  {
    id: 'creative_work',
    label: 'Creative Work',
    description: 'Natural light, inspiring interiors & flexible laptop tables',
    searchHint: 'roastery cafe',
  },
  {
    id: 'social_workspace',
    label: 'Social Workspace',
    description: 'Upbeat collaborative booths, food plates & group tables',
    searchHint: 'cafe brunch',
  },
];

export type BudgetBracketId =
  | 'under-30'
  | 'under-50'
  | 'under-100'
  | 'under-150'
  | 'under-200'
  | 'under-300'
  | '300-plus'
  | '50-100'
  | '100-200'
  | '200-300'
  | '200-500'
  | '300-500'
  | '500+';

export interface BudgetBracket {
  id: BudgetBracketId;
  label: string;
  min: number;
  max: number | null;
}

export const BUDGET_BRACKETS: BudgetBracket[] = [
  { id: 'under-30', label: 'Under ₹30', min: 0, max: 30 },
  { id: 'under-50', label: 'Under ₹50', min: 0, max: 50 },
  { id: 'under-100', label: 'Under ₹100', min: 0, max: 100 },
  { id: 'under-150', label: 'Under ₹150', min: 0, max: 150 },
  { id: 'under-200', label: 'Under ₹200', min: 0, max: 200 },
  { id: 'under-300', label: 'Under ₹300', min: 0, max: 300 },
  { id: '300-plus', label: '₹300 and above', min: 300, max: null },
];

export const COLLECTION_PRESETS: Array<{ name: string; description: string }> = [
  { name: 'My Favourite Cafes', description: 'Go-to coffee, food & work spots.' },
  { name: 'Best Tea Shops', description: 'Neighbourhood chai stalls & tea houses.' },
  { name: 'Budget Food Spots', description: 'Great snacks & meals under ₹200.' },
  { name: 'My Study Places', description: 'Quiet corners for focused reading & prep.' },
  { name: 'Weekend Cafes', description: 'Relaxed bakeries, brunch & catchup spots.' },
  { name: 'Places to Visit', description: 'Wishlist of new local spots to try.' },
];

export const EXPLORER_BADGES: Array<{
  id: string;
  title: string;
  description: string;
  target: number;
}> = [
  {
    id: 'first_save',
    title: 'First Place Saved',
    description: 'Save your first cafe or local food spot.',
    target: 1,
  },
  {
    id: 'cafe_explorer',
    title: 'Cafe Explorer',
    description: 'Explore 5 distinct cafe & food detail pages.',
    target: 5,
  },
  {
    id: 'helpful_reviewer',
    title: 'Helpful Reviewer',
    description: 'Submit a verified info correction or cafe suggestion.',
    target: 1,
  },
  {
    id: 'local_guide',
    title: 'Local Guide',
    description: 'Organize 3 or more spots across personal collections.',
    target: 3,
  },
  {
    id: 'workspace_explorer',
    title: 'Workspace Explorer',
    description: 'Compare cafes side-by-side or explore Work Mood matches.',
    target: 1,
  },
];

export const CORRECTION_ISSUE_TYPES = [
  { id: 'wrong_address', label: 'Wrong address' },
  { id: 'closed_business', label: 'Closed business' },
  { id: 'changed_hours', label: 'Changed opening hours' },
  { id: 'incorrect_phone', label: 'Incorrect phone number' },
  { id: 'missing_business', label: 'Missing business' },
  { id: 'incorrect_category', label: 'Incorrect category' },
] as const;

export interface QuickFilterChip {
  id: string;
  label: string;
  to: string;
}

export const HOME_QUICK_FILTERS: QuickFilterChip[] = [
  { id: 'tea', label: 'Tea Under ₹30', to: '/discover?q=Tea+under+₹30' },
  { id: 'coffee', label: 'Coffee Under ₹50', to: '/discover?q=Coffee+under+₹50' },
  { id: 'snacks', label: 'Snacks Under ₹50', to: '/discover?category=snacks&budget=under-50' },
  { id: 'budget', label: 'Best Food Under ₹100', to: '/discover?budget=under-100' },
  { id: 'bakery', label: 'Bakeries & Puffs', to: '/discover?category=bakery' },
  { id: 'workspaces', label: 'Workspaces', to: '/discover?category=workspaces' },
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

export const DEFAULT_FEATURE_FLAGS = {
  smart_nl_search: true,
  quality_scores: true,
  visit_companion: true,
  menu_intelligence: true,
  community_reviews: true,
  community_photos: true,
  public_collections: true,
  personalisation: true,
  cafe_following: true,
  notifications: true,
  owner_portal: true,
  promotions: true,
  bookings: true,
  live_google_places: true,
} as const;

export const DEFAULT_SCORING_CONFIG = {
  work_ready_weights: {
    wifi: 26,
    sockets: 22,
    seating: 16,
    noise: 14,
    affordability: 10,
    workspace_fit: 12,
  },
  confidence_weights: {
    verified_badge: 28,
    recency: 24,
    completeness: 24,
    photos_verified: 12,
    source_attribution: 12,
  },
} as const;

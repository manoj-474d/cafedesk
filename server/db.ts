import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CAFES } from '../src/data/cafes.ts';
import { EXPLORER_BADGES, SITE_CONFIG } from '../src/config/constants.ts';
import type {
  AccessControlSettings,
  AccessSectionKey,
  AmenityState,
  CafeAccessRule,
  CafeSourceType,
  CommunityCorrectionRecord,
  DietaryType,
  ExplorerAchievementStatus,
  LocationItem,
  MediaAsset,
  MenuItemRecord,
  NavigationItem,
  PlacesApiUsageSummary,
  SectionOverrideMode,
  SiteSettings,
  TestimonialItem,
} from '../src/types/cms.ts';
import type {
  PlanPermissions,
  PlanTier,
  SubscriptionPlan,
  UserSubscription,
} from '../src/types/subscription.ts';

export const DEFAULT_ACCESS_CONTROL: AccessControlSettings = {
  default_rule: 'subscription_required',
  sections: {
    wifi_details: 'subscription',
    power_sockets: 'subscription',
    workspace_details: 'subscription',
    food_menu: 'subscription',
    menu_pricing: 'subscription',
    amenities: 'subscription',
    subscriber_benefits: 'subscription',
    booking: 'subscription',
  },
  free_cafe_preview_note:
    'Basic cafe overview is free to browse. Subscribe to unlock Wi-Fi speeds & credentials, charging sockets, full food & beverage pricing, and workspace booking.',
};

export const DEFAULT_FREE_PERMISSIONS: PlanPermissions = {
  wifi_details: false,
  power_sockets: false,
  workspace_details: false,
  food_menu: false,
  menu_pricing: false,
  amenities: false,
  subscriber_benefits: false,
  booking: false,
  collections: false,
  compare: false,
};

export const DEFAULT_PAID_PERMISSIONS: PlanPermissions = {
  wifi_details: true,
  power_sockets: true,
  workspace_details: true,
  food_menu: true,
  menu_pricing: true,
  amenities: true,
  subscriber_benefits: true,
  booking: true,
  collections: true,
  compare: true,
};

export function normalizePlanPermissions(raw: unknown, isPaid: boolean): PlanPermissions {
  const base = isPaid ? { ...DEFAULT_PAID_PERMISSIONS } : { ...DEFAULT_FREE_PERMISSIONS };
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as Record<string, unknown>;
  (Object.keys(base) as Array<keyof PlanPermissions>).forEach((key) => {
    if (typeof src[key] === 'boolean') {
      base[key] = src[key] as boolean;
    }
  });
  return base;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'cafedesk.db');

export const DEFAULT_MEDIA_SEED = [
  {
    filename: 'hero_cafedesk_interior_1794976059561.jpg',
    original_name: 'Sunlit Specialty Coffee Lounge Interior',
    mime_type: 'image/jpeg',
    size_bytes: 245000,
    url: '/src/assets/images/hero_cafedesk_interior_1794976059561.jpg',
    alt_text:
      'Sunlit specialty cafe interior with communal oak work tables, brass pendant lights, indoor greenery, and espresso bar.',
    description: 'Brand editorial wide-angle interior photography for Cafe Desk homepage hero.',
    category: 'Hero & Interiors',
  },
  {
    filename: 'editorial_coffee_pour_1794976060659.jpg',
    original_name: 'Artisanal Rosetta Latte & Croissant',
    mime_type: 'image/jpeg',
    size_bytes: 198000,
    url: '/src/assets/images/editorial_coffee_pour_1794976060659.jpg',
    alt_text:
      'Ceramic cup of flat white coffee with crisp rosetta latte art beside a flaky butter croissant on an oak table.',
    description: 'Specialty beverage & bakery craft photography.',
    category: 'Coffee & Food',
  },
  {
    filename: 'editorial_workspace_lounge_1794976060874.jpg',
    original_name: 'Window Desk with Power Outlets & Cold Brew',
    mime_type: 'image/jpeg',
    size_bytes: 210000,
    url: '/src/assets/images/editorial_workspace_lounge_1794976060874.jpg',
    alt_text:
      'Remote worker typing on a laptop beside wall power sockets, notebook, and iced cold brew by a sunlit window.',
    description: 'Workspace ergonomics & power-accessible seating showcase.',
    category: 'Workspace & People',
  },
  {
    filename: 'editorial_food_brunch_1794976061253.jpg',
    original_name: 'Sourdough Tartine, Pastries & Iced Pour-Over',
    mime_type: 'image/jpeg',
    size_bytes: 215000,
    url: '/src/assets/images/editorial_food_brunch_1794976061253.jpg',
    alt_text:
      'Sourdough avocado tartine, fresh cardamom buns, and iced single-origin coffee on a natural stone tabletop.',
    description: 'All-day kitchen & artisan pastry showcase.',
    category: 'Coffee & Food',
  },
  {
    filename: 'editorial_team_meeting_1794976060148.jpg',
    original_name: 'Founders Collaborating in Sunlit Cafe Booth',
    mime_type: 'image/jpeg',
    size_bytes: 205000,
    url: '/src/assets/images/editorial_team_meeting_1794976060148.jpg',
    alt_text:
      'Two colleagues collaborating with notebooks and espresso cups inside a warm upholstered wooden cafe booth.',
    description: 'Quiet meeting booths & team table photography.',
    category: 'Workspace & People',
  },
];

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  brand_name: 'Cafe Desk',
  brand_tagline: 'Bengaluru Cafe Discovery Platform',
  logo_url: '',
  favicon_url: '',
  accent_color: '#B45309',
  business_legal_name: 'Cafe Desk · Bengaluru Cafe Discovery',
  business_city: 'Bengaluru',
  business_address: 'Bengaluru, Karnataka',
  footer_copyright: '© 2026 Cafe Desk. Bengaluru cafe discovery for coffee, tea, study, and work.',
  analytics_id: '',

  contact_email: SITE_CONFIG.contactEmail,
  contact_phone: SITE_CONFIG.whatsappDisplay,
  whatsapp_number: SITE_CONFIG.whatsappNumber,
  whatsapp_display: SITE_CONFIG.whatsappDisplay,
  instagram_url: SITE_CONFIG.instagramUrl,
  instagram_handle: SITE_CONFIG.instagramHandle,
  twitter_url: 'https://x.com/cafedesk_space',
  linkedin_url: 'https://linkedin.com/company/cafedesk',

  currency_code: 'INR',
  currency_symbol: '₹',
  bookings_enabled: true,
  booking_lead_hours: 2,
  booking_max_guests: 8,
  booking_policy_note:
    'Reserve a desk or meeting seat at listed cafes. Coffee and food orders are settled directly at the cafe.',
  notify_new_booking: true,
  notify_new_customer: true,
  notify_new_payment: true,
  notify_new_suggestion: true,
  notification_email: SITE_CONFIG.contactEmail,

  hero_kicker: 'Bengaluru · Cafe & Workspace Discovery Platform',
  hero_tagline: 'Find Your Perfect Cafe in Bengaluru.',
  hero_subtitle:
    'Discover hidden gems, peaceful workspaces, great coffee and your next favourite cafe.',
  hero_image_url: '/src/assets/images/hero_cafedesk_interior_1794976059561.jpg',
  hero_bg_image_url: '/src/assets/images/hero_cafedesk_interior_1794976059561.jpg',
  hero_cta_primary_label: 'Explore Cafes',
  hero_cta_primary_link: '/locations',
  hero_cta_secondary_label: 'Find Near Me',
  hero_cta_secondary_link: '/locations?nearby=1',
  hero_cta_tertiary_label: 'Explore Map',
  hero_cta_tertiary_link: '/locations?view=map',

  homepage_sections: [
    { key: 'hero', label: 'Hero, Quick Search & Filter Chips', visible: true, order: 1 },
    { key: 'announcements', label: 'Discovery Highlights Strip', visible: true, order: 2 },
    { key: 'locations', label: 'Bengaluru Interactive Map & Cafe Grid', visible: true, order: 3 },
    { key: 'experience', label: 'Coffee, Culinary & Craft Gallery', visible: true, order: 4 },
    { key: 'services', label: 'Work, Study & Budget Discovery Features', visible: true, order: 5 },
    { key: 'offers', label: 'Browse by Mood & Budget Brackets', visible: true, order: 6 },
    { key: 'testimonials', label: 'Community Stories', visible: true, order: 7 },
    { key: 'contact_cta', label: 'Community Updates & Submit a Cafe CTA', visible: true, order: 8 },
  ],

  banner_enabled: true,
  banner_text: 'Discover Bengaluru cafes by budget (₹50–₹500+), tea & snacks, Wi-Fi, sockets, noise & live distance.',
  banner_cta_label: 'Open Cafe Map',
  banner_link: '/locations?view=map',
  banner_start_at: '',
  banner_end_at: '',
  cafe_of_the_day_slug: '',
  announcements: [
    {
      id: 'ann-1',
      title: 'Neighbourhood Cafes Across 18 Bengaluru Localities',
      detail: 'Explore Indiranagar, Koramangala, Jayanagar, Banashankari, Basavanagudi, Malleshwaram, Rajajinagar, Vijayanagar, Yelahanka & more.',
      badge: 'Bengaluru Coverage',
      link: '/locations?view=map',
      active: true,
    },
    {
      id: 'ann-2',
      title: 'Budget-Friendly Chai, Coffee & Bakery Cafes (₹50–₹300)',
      detail: 'Compare student-friendly tea spots, bakery cafes, and work-ready Wi-Fi cafes with real menu pricing and Google Maps routes.',
      badge: 'Budget & Work Guides',
      link: '/locations?mode=budget',
      active: true,
    },
  ],

  pricing_headline: 'Explore Bengaluru cafes free, or unlock full menu & budget tools',
  pricing_subtitle:
    'Save favourites, check laptop readiness, seating, sockets, and noise levels free forever. Upgrade to Cafe Desk Plus when you want full food prices, verified Wi-Fi speeds, comparisons, and deals.',

  about_heading: 'Built for people who choose a cafe by its coffee, budget, and focus.',
  about_lead:
    'Cafe Desk is a Bengaluru cafe discovery platform connecting students, freelancers, and remote workers to affordable neighbourhood tea & coffee shops as well as work-ready Wi-Fi cafes.',
  about_story:
    'Browse Bengaluru cafes across Indiranagar, Koramangala, HSR Layout, Whitefield, Jayanagar, Banashankari, Basavanagudi, Malleshwaram, Rajajinagar, Vijayanagar, Yelahanka, and more. Where Cafe Desk or public sources document Wi-Fi speeds and charging sockets, specs are clearly shown; otherwise unverified metrics are honestly labelled alongside real food & beverage prices and official links.',
  about_image_url: '/src/assets/images/editorial_team_meeting_1794976060148.jpg',

  services_heading: 'Everything you check before visiting or bringing your laptop.',
  services_subtitle:
    'Whether you want a ₹50–₹200 tea & bakery snack spot with friends or a quiet Wi-Fi cafe with charging sockets for deep work.',
  services_image_url: '/src/assets/images/editorial_workspace_lounge_1794976060874.jpg',
  services_items: [
    {
      title: '01. Nearby & Neighborhood Map',
      description:
        'Share your GPS location or browse 18+ Bengaluru localities from Indiranagar and Koramangala to Banashankari, Malleshwaram, Rajajinagar, and Yelahanka.',
      highlight: 'Live distance & Google Maps directions',
    },
    {
      title: '02. Transparent Food & Coffee Budgets',
      description:
        'Filter by ₹50–₹100, ₹100–₹200, ₹200–₹300, ₹300–₹500, and ₹500+ with real tea, coffee, snack prices, and popular menu highlights.',
      highlight: 'Real cafe menu clarity',
    },
    {
      title: '03. Honest Wi-Fi & Laptop Readiness',
      description:
        'Filter for confirmed Wi-Fi, measured Mbps speeds, charging sockets, and laptop-friendly desks — with zero fabricated claims where data is unverified.',
      highlight: 'No fabricated speeds or ratings',
    },
    {
      title: '04. Connect to Official Platforms',
      description:
        'Actively connects you to each cafe’s official website, digital menu, Instagram profile, phone number, and Google Maps route.',
      highlight: 'Direct discovery layer',
    },
  ],

  facilities_items: [
    { name: 'Budget & Work Cafe Mix', detail: 'Includes ₹50–₹300 tea/bakery cafes and work-ready coffeehouses' },
    { name: 'Honest Speed Transparency', detail: 'Shows tested Mbps or honestly states Not verified' },
    { name: 'Charging Sockets & Seating', detail: 'Plug access, desk comfort & laptop-friendliness' },
    { name: 'Calibrated Noise Labels', detail: 'Quiet, Moderate, or Busy expectations before you go' },
    { name: 'Budget Bracket Filtering', detail: '₹50–₹100, ₹100–₹200, ₹200–₹300, ₹300–₹500, and ₹500+ options' },
    { name: 'Official Cafe Links', detail: 'Direct links to official websites, menus, Instagram & Maps' },
  ],

  faqs_items: [
    {
      question: 'What types of cafes are listed on Cafe Desk?',
      answer:
        'Cafe Desk lists Bengaluru coffee shops, neighbourhood tea & chai cafes, bakery cafes, and work-friendly coffeehouses — from ₹50–₹200 student spots to specialty workspaces.',
    },
    {
      question: 'Does Cafe Desk show verified Wi-Fi speeds and availability?',
      answer:
        'Yes. Cafes with confirmed customer Wi-Fi are clearly tagged and filterable, and measured Mbps speeds are shown where field-tested. When Wi-Fi or speed has not been verified from official sources yet, we honestly display "Not verified" rather than guessing.',
    },
    {
      question: 'Can I book tables through Cafe Desk?',
      answer:
        'No — Cafe Desk is a cafe discovery platform. Each listing connects you directly to the cafe’s official website, menu link, Instagram, phone, or Google Maps directions.',
    },
    {
      question: 'How can I suggest a neighbourhood cafe or report updated info?',
      answer:
        'Use our Submit / Update a Cafe form to share Bengaluru cafes, updated beverage prices, Wi-Fi details, or opening hours.',
    },
  ],

  contact_heading: 'Questions, cafe suggestions, or data updates.',
  contact_subtitle:
    'Share feedback, suggest a Bengaluru cafe, or update menu prices & official links via email or WhatsApp.',
  contact_hours: 'Mon – Sun · 9:00 AM to 8:00 PM IST',
  contact_map_url: 'https://maps.google.com/?q=Bengaluru',

  editorial_gallery: [
    {
      url: '/src/assets/images/editorial_coffee_pour_1794976060659.jpg',
      alt: 'Rosetta latte art beside a freshly baked flaky croissant on an oak table',
      caption: 'Single-origin espresso & morning viennoiserie',
    },
    {
      url: '/src/assets/images/editorial_workspace_lounge_1794976060874.jpg',
      alt: 'Remote worker at a sunlit oak window desk with wall sockets and cold brew',
      caption: 'Sunlit window desks with reachable wall power',
    },
    {
      url: '/src/assets/images/editorial_food_brunch_1794976061253.jpg',
      alt: 'Sourdough avocado tartine, pastries, and iced pour-over coffee on stone tabletop',
      caption: 'All-day sourdough plates & iced pour-overs',
    },
  ],

  seo_home_title: 'Cafe Desk – Find Your Perfect Cafe in Bengaluru',
  seo_home_description:
    "Discover Bengaluru cafes for affordable tea & coffee (₹50–₹300), bakery snacks, studying, meetings, and laptop work across Indiranagar, Koramangala, Banashankari, Malleshwaram & more.",
  seo_locations_title: 'Explore Bengaluru Cafes & Interactive Map | Cafe Desk',
  seo_locations_description:
    'Explore Bengaluru cafes by locality, live distance, budget (₹50–₹500+), tea & snacks, Wi-Fi, charging sockets, and official cafe websites.',
  seo_about_title: 'About Cafe Desk & Discovery Standards',
  seo_about_description:
    'Learn how Cafe Desk curates Bengaluru cafes — from budget tea & bakery spots to Wi-Fi workspaces — with honest amenity and price data.',
  seo_contact_title: 'Contact & Cafe Updates – Cafe Desk',
  seo_contact_description:
    'Suggest a Bengaluru cafe, report outdated menu prices or hours, or contact the Cafe Desk team.',
  seo_og_image: '/src/assets/images/hero_cafedesk_interior_1794976059561.jpg',
  seo_allow_indexing: true,
  google_site_verification: '',
  access_control: DEFAULT_ACCESS_CONTROL,
};

let dbInstance: DatabaseSync | null = null;

export function getUploadsDir(): string {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  return UPLOADS_DIR;
}

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function derivePriceRangeLabel(avgCost: number | null): string {
  if (avgCost === null) return '';
  if (avgCost <= 100) return '₹50–₹100';
  if (avgCost <= 200) return '₹100–₹200';
  if (avgCost <= 300) return '₹200–₹300';
  if (avgCost <= 500) return '₹300–₹500';
  return '₹500+';
}

function parseAmenityState(val: unknown): AmenityState {
  if (val === 'yes' || val === 'no' || val === 'unknown') return val;
  return 'unknown';
}

export function closeDb(): void {
  if (!dbInstance) return;
  try {
    dbInstance.close();
  } catch {
    // Ignore close errors during shutdown
  } finally {
    dbInstance = null;
  }
}

function openSqliteWithRecovery(dbPath: string): DatabaseSync {
  const shmPath = `${dbPath}-shm`;
  const walPath = `${dbPath}-wal`;

  const configure = (db: DatabaseSync): DatabaseSync => {
    db.exec('PRAGMA busy_timeout = 5000;');
    const check = db.prepare('PRAGMA quick_check(1);').get() as { quick_check?: string } | undefined;
    if (check?.quick_check !== 'ok') {
      throw new Error(`SQLite quick_check failed: ${check?.quick_check ?? 'unknown'}`);
    }
    db.exec('PRAGMA journal_mode = DELETE;');
    db.exec('PRAGMA synchronous = NORMAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    return db;
  };

  try {
    return configure(new DatabaseSync(dbPath));
  } catch (err) {
    console.warn('[db] SQLite open/check failed, attempting sidecar recovery:', (err as Error).message);
    if (fs.existsSync(shmPath)) {
      try {
        fs.unlinkSync(shmPath);
        return configure(new DatabaseSync(dbPath));
      } catch {
        // Fall through to full sidecar quarantine
      }
    }
    const stamp = Date.now();
    if (fs.existsSync(shmPath)) {
      fs.renameSync(shmPath, `${shmPath}.corrupt-${stamp}`);
    }
    if (fs.existsSync(walPath)) {
      fs.renameSync(walPath, `${walPath}.corrupt-${stamp}`);
    }
    return configure(new DatabaseSync(dbPath));
  }
}

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const db = openSqliteWithRecovery(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      reset_token_hash TEXT,
      reset_token_expires_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      csrf_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      user_agent TEXT,
      ip_address TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cafes (
      id TEXT PRIMARY KEY,
      slug TEXT,
      name TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT 'Bengaluru',
      area TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      map_link TEXT NOT NULL,
      booking_url TEXT NOT NULL DEFAULT '',
      website_url TEXT NOT NULL DEFAULT '',
      menu_url TEXT NOT NULL DEFAULT '',
      instagram_url TEXT NOT NULL DEFAULT '',
      place_id TEXT NOT NULL DEFAULT '',
      lat REAL,
      lng REAL,
      timings TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      photos_json TEXT NOT NULL,
      photos_approved INTEGER NOT NULL DEFAULT 0,
      wifi_available TEXT NOT NULL DEFAULT 'unknown',
      wifi_mbps INTEGER,
      charging_sockets TEXT NOT NULL DEFAULT 'unknown',
      sockets_count INTEGER,
      sockets_claimed INTEGER NOT NULL DEFAULT 0,
      comfortable_seating TEXT NOT NULL DEFAULT 'unknown',
      suitable_for_studying TEXT NOT NULL DEFAULT 'unknown',
      suitable_for_working TEXT NOT NULL DEFAULT 'unknown',
      noise_level INTEGER,
      avg_cost_per_person INTEGER,
      price_range TEXT NOT NULL DEFAULT '',
      coffee_price TEXT,
      tea_price TEXT,
      snacks_price TEXT,
      meals_price TEXT,
      popular_items_json TEXT NOT NULL DEFAULT '[]',
      rating REAL,
      rating_count INTEGER,
      min_spend TEXT,
      laptop_friendly INTEGER NOT NULL,
      time_limit TEXT,
      modes_json TEXT NOT NULL,
      facilities_json TEXT NOT NULL DEFAULT '[]',
      offers_json TEXT NOT NULL DEFAULT '[]',
      menu_services_json TEXT NOT NULL DEFAULT '[]',
      best_for_json TEXT NOT NULL,
      verdict TEXT NOT NULL,
      avoid_if TEXT,
      student_discount TEXT,
      verified INTEGER NOT NULL,
      featured INTEGER NOT NULL,
      published INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0,
      last_verified_date TEXT,
      claims_json TEXT NOT NULL DEFAULT '[]',
      source_name TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL DEFAULT '',
      sample INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS navigation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location TEXT NOT NULL,
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      visible INTEGER NOT NULL DEFAULT 1,
      is_external INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      branch_name TEXT NOT NULL DEFAULT '',
      quote TEXT NOT NULL,
      verified_visit_date TEXT NOT NULL DEFAULT '',
      published INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      cafe_name TEXT,
      area TEXT,
      contact_name TEXT,
      contact_info TEXT,
      plan TEXT,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_visits (
      date TEXT PRIMARY KEY,
      page_views INTEGER NOT NULL DEFAULT 0,
      unique_visitors INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS visitor_tokens (
      visitor_hash TEXT PRIMARY KEY,
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      url TEXT NOT NULL,
      alt_text TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'General',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      auth_provider TEXT NOT NULL DEFAULT 'email',
      email_verified INTEGER NOT NULL DEFAULT 0,
      verify_token_hash TEXT,
      verify_token_expires_at INTEGER,
      reset_token_hash TEXT,
      reset_token_expires_at INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      csrf_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      user_agent TEXT,
      ip_address TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      price_inr INTEGER NOT NULL,
      interval_days INTEGER NOT NULL DEFAULT 30,
      badge_text TEXT NOT NULL DEFAULT '',
      features_json TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
      status TEXT NOT NULL DEFAULT 'active',
      started_at INTEGER NOT NULL,
      expires_at INTEGER,
      auto_renew INTEGER NOT NULL DEFAULT 1,
      cancelled_at INTEGER,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
      amount_inr INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      method TEXT NOT NULL DEFAULT 'upi',
      provider TEXT NOT NULL DEFAULT 'razorpay_test',
      provider_order_id TEXT NOT NULL DEFAULT '',
      provider_payment_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'created',
      failure_reason TEXT NOT NULL DEFAULT '',
      refunded_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscription_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      from_plan TEXT NOT NULL DEFAULT '',
      to_plan TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_cafes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cafe_key TEXT NOT NULL,
      cafe_source TEXT NOT NULL DEFAULT 'curated',
      cafe_snapshot_json TEXT NOT NULL,
      is_favourite INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, cafe_key)
    );

    CREATE TABLE IF NOT EXISTS user_collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS collection_items (
      collection_id INTEGER NOT NULL REFERENCES user_collections(id) ON DELETE CASCADE,
      cafe_key TEXT NOT NULL,
      cafe_snapshot_json TEXT NOT NULL,
      added_at INTEGER NOT NULL,
      PRIMARY KEY(collection_id, cafe_key)
    );

    CREATE TABLE IF NOT EXISTS feature_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      details TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      admin_notes TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cafe_id TEXT NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Coffee',
      description TEXT NOT NULL DEFAULT '',
      price_inr INTEGER NOT NULL DEFAULT 0,
      discount_price_inr INTEGER,
      photo_url TEXT NOT NULL DEFAULT '',
      available INTEGER NOT NULL DEFAULT 1,
      dietary TEXT NOT NULL DEFAULT 'na',
      is_bestseller INTEGER NOT NULL DEFAULT 0,
      is_featured INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_ref TEXT NOT NULL UNIQUE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL DEFAULT '',
      customer_phone TEXT NOT NULL DEFAULT '',
      cafe_id TEXT NOT NULL,
      cafe_name TEXT NOT NULL,
      workspace_type TEXT NOT NULL DEFAULT 'Laptop Desk',
      booking_date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      guests_count INTEGER NOT NULL DEFAULT 1,
      amount_inr INTEGER NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'pay_at_cafe',
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_login_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      supabase_id TEXT NOT NULL DEFAULT '',
      event_type TEXT NOT NULL DEFAULT 'login',
      provider TEXT NOT NULL DEFAULT 'email',
      ip_address TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS community_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cafe_key TEXT NOT NULL,
      cafe_name TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      suggested_value TEXT NOT NULL DEFAULT '',
      reporter_name TEXT NOT NULL DEFAULT '',
      reporter_email TEXT NOT NULL DEFAULT '',
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      badge_id TEXT NOT NULL,
      unlocked_at INTEGER NOT NULL,
      meta_json TEXT NOT NULL DEFAULT '{}',
      UNIQUE(user_id, badge_id)
    );

    CREATE TABLE IF NOT EXISTS explorer_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      target_key TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, event_type, target_key)
    );

    CREATE TABLE IF NOT EXISTS places_api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      query_text TEXT NOT NULL DEFAULT '',
      status_code INTEGER NOT NULL DEFAULT 200,
      cached INTEGER NOT NULL DEFAULT 0,
      result_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
  `);

  // Non-destructive column migrations for pre-existing database files
  ensureColumn(db, 'admins', 'email', 'TEXT');
  ensureColumn(db, 'admins', 'two_factor_enabled', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'admins', 'two_factor_secret', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'admins', 'failed_attempts', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'admins', 'locked_until', 'INTEGER');
  ensureColumn(db, 'users', 'last_login_at', 'INTEGER');
  ensureColumn(db, 'users', 'supabase_id', 'TEXT');
  ensureColumn(db, 'users', 'phone', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'users', 'avatar_url', "TEXT NOT NULL DEFAULT ''");
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id)');
  ensureColumn(db, 'activity_logs', 'previous_value', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'activity_logs', 'new_value', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'menu_items', 'discount_price_inr', 'INTEGER');
  ensureColumn(db, 'subscription_plans', 'promo_note', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'subscription_plans', 'usage_limits', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'subscription_plans', 'is_recommended', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'subscription_plans', 'permissions_json', "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(db, 'subscription_plans', 'cafe_access_scope', "TEXT NOT NULL DEFAULT 'all'");
  ensureColumn(db, 'user_subscriptions', 'subscribed_price_inr', 'INTEGER');
  ensureColumn(db, 'user_subscriptions', 'expired_at', 'INTEGER');
  ensureColumn(db, 'user_subscriptions', 'expired_from_plan', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'user_subscriptions', 'suspended_at', 'INTEGER');
  ensureColumn(db, 'cafes', 'slug', 'TEXT');
  ensureColumn(db, 'cafes', 'category', "TEXT NOT NULL DEFAULT 'Cafe'");
  ensureColumn(db, 'cafes', 'city', "TEXT NOT NULL DEFAULT 'Bengaluru'");
  ensureColumn(db, 'cafes', 'phone', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'cafes', 'booking_url', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'cafes', 'website_url', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'cafes', 'menu_url', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'cafes', 'instagram_url', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'cafes', 'other_social_links', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'cafes', 'place_id', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'cafes', 'lat', 'REAL');
  ensureColumn(db, 'cafes', 'lng', 'REAL');
  ensureColumn(db, 'cafes', 'description', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'cafes', 'photos_approved', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'cafes', 'interior_photos_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'cafes', 'exterior_photos_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'cafes', 'wifi_available', "TEXT NOT NULL DEFAULT 'unknown'");
  ensureColumn(db, 'cafes', 'wifi_password', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'cafes', 'charging_sockets', "TEXT NOT NULL DEFAULT 'unknown'");
  ensureColumn(db, 'cafes', 'sockets_claimed', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'cafes', 'comfortable_seating', "TEXT NOT NULL DEFAULT 'unknown'");
  ensureColumn(db, 'cafes', 'seating_info', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'cafes', 'ambience', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'cafes', 'outdoor_seating', "TEXT NOT NULL DEFAULT 'unknown'");
  ensureColumn(db, 'cafes', 'suitable_for_studying', "TEXT NOT NULL DEFAULT 'unknown'");
  ensureColumn(db, 'cafes', 'suitable_for_working', "TEXT NOT NULL DEFAULT 'unknown'");
  ensureColumn(db, 'cafes', 'price_range', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'cafes', 'coffee_price', 'TEXT');
  ensureColumn(db, 'cafes', 'tea_price', 'TEXT');
  ensureColumn(db, 'cafes', 'snacks_price', 'TEXT');
  ensureColumn(db, 'cafes', 'meals_price', 'TEXT');
  ensureColumn(db, 'cafes', 'popular_items_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'cafes', 'rating', 'REAL');
  ensureColumn(db, 'cafes', 'rating_count', 'INTEGER');
  ensureColumn(db, 'cafes', 'facilities_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'cafes', 'offers_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'cafes', 'subscriber_benefits_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'cafes', 'menu_services_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'cafes', 'published', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn(db, 'cafes', 'display_order', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'cafes', 'claims_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'cafes', 'source_name', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'cafes', 'source_url', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'cafes', 'access_rule', "TEXT NOT NULL DEFAULT 'inherit'");
  ensureColumn(db, 'cafes', 'allowed_plan_ids_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'cafes', 'locked_sections_override_json', "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(db, 'cafes', 'source_type', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'cafes', 'merged_into_id', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'cafes', 'created_at', 'INTEGER');
  ensureColumn(db, 'media_assets', 'description', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'media_assets', 'category', "TEXT NOT NULL DEFAULT 'General'");

  // Migrate pre-existing cafes table if nullable metrics still have legacy NOT NULL constraints
  const cafesSchemaCols = db.prepare('PRAGMA table_info(cafes)').all() as Array<{
    name: string;
    notnull: number;
  }>;
  const legacyNotNullCols = [
    'wifi_mbps',
    'sockets_count',
    'noise_level',
    'avg_cost_per_person',
    'min_spend',
    'time_limit',
    'avoid_if',
    'student_discount',
    'last_verified_date',
  ];
  const needsNullableRebuild = cafesSchemaCols.some(
    (c) => legacyNotNullCols.includes(c.name) && c.notnull === 1
  );
  if (needsNullableRebuild) {
    db.exec(`
      CREATE TABLE cafes_migrated (
        id TEXT PRIMARY KEY,
        slug TEXT,
        name TEXT NOT NULL,
        city TEXT NOT NULL DEFAULT 'Bengaluru',
        area TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        map_link TEXT NOT NULL,
        booking_url TEXT NOT NULL DEFAULT '',
        website_url TEXT NOT NULL DEFAULT '',
        menu_url TEXT NOT NULL DEFAULT '',
        instagram_url TEXT NOT NULL DEFAULT '',
        place_id TEXT NOT NULL DEFAULT '',
        lat REAL,
        lng REAL,
        timings TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        photos_json TEXT NOT NULL,
        photos_approved INTEGER NOT NULL DEFAULT 0,
        wifi_available TEXT NOT NULL DEFAULT 'unknown',
        wifi_mbps INTEGER,
        charging_sockets TEXT NOT NULL DEFAULT 'unknown',
        sockets_count INTEGER,
        sockets_claimed INTEGER NOT NULL DEFAULT 0,
        comfortable_seating TEXT NOT NULL DEFAULT 'unknown',
        suitable_for_studying TEXT NOT NULL DEFAULT 'unknown',
        suitable_for_working TEXT NOT NULL DEFAULT 'unknown',
        noise_level INTEGER,
        avg_cost_per_person INTEGER,
        price_range TEXT NOT NULL DEFAULT '',
        coffee_price TEXT,
        tea_price TEXT,
        snacks_price TEXT,
        meals_price TEXT,
        popular_items_json TEXT NOT NULL DEFAULT '[]',
        rating REAL,
        rating_count INTEGER,
        min_spend TEXT,
        laptop_friendly INTEGER NOT NULL,
        time_limit TEXT,
        modes_json TEXT NOT NULL,
        facilities_json TEXT NOT NULL DEFAULT '[]',
        offers_json TEXT NOT NULL DEFAULT '[]',
        menu_services_json TEXT NOT NULL DEFAULT '[]',
        best_for_json TEXT NOT NULL,
        verdict TEXT NOT NULL,
        avoid_if TEXT,
        student_discount TEXT,
        verified INTEGER NOT NULL,
        featured INTEGER NOT NULL,
        published INTEGER NOT NULL DEFAULT 1,
        display_order INTEGER NOT NULL DEFAULT 0,
        last_verified_date TEXT,
        claims_json TEXT NOT NULL DEFAULT '[]',
        source_name TEXT NOT NULL DEFAULT '',
        source_url TEXT NOT NULL DEFAULT '',
        sample INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO cafes_migrated (
        id, slug, name, city, area, address, phone, map_link, booking_url,
        website_url, menu_url, instagram_url, place_id, lat, lng,
        timings, description, photos_json, photos_approved,
        wifi_available, wifi_mbps, charging_sockets, sockets_count, sockets_claimed,
        comfortable_seating, suitable_for_studying, suitable_for_working,
        noise_level, avg_cost_per_person, price_range,
        coffee_price, tea_price, snacks_price, meals_price, popular_items_json,
        rating, rating_count, min_spend, laptop_friendly, time_limit,
        modes_json, facilities_json, offers_json, menu_services_json,
        best_for_json, verdict, avoid_if, student_discount,
        verified, featured, published, display_order, last_verified_date, claims_json,
        source_name, source_url, sample, updated_at
      )
      SELECT
        id, slug, name, city, area, address, phone, map_link, booking_url,
        website_url, menu_url, instagram_url, place_id, lat, lng,
        timings, description, photos_json, photos_approved,
        wifi_available, wifi_mbps, charging_sockets, sockets_count, sockets_claimed,
        comfortable_seating, suitable_for_studying, suitable_for_working,
        noise_level, avg_cost_per_person, price_range,
        coffee_price, tea_price, snacks_price, meals_price, popular_items_json,
        rating, rating_count, min_spend, laptop_friendly, time_limit,
        modes_json, facilities_json, offers_json, menu_services_json,
        best_for_json, verdict, avoid_if, student_discount,
        verified, featured, published, display_order, last_verified_date, claims_json,
        source_name, source_url, sample, updated_at
      FROM cafes WHERE sample = 0;
      DROP TABLE cafes;
      ALTER TABLE cafes_migrated RENAME TO cafes;
    `);
  }

  // Remove any legacy booking URLs, synthetic sample=1 rows, and normalize labels
  db.exec("DELETE FROM cafes WHERE sample = 1");
  db.exec("UPDATE cafes SET booking_url = '' WHERE booking_url != ''");

  // Backfill slug for any existing cafes without slug
  db.exec(`UPDATE cafes SET slug = id WHERE slug IS NULL OR slug = ''`);

  // Normalize legacy price_range labels and keep official cafe catalog synced non-destructively
  db.exec("UPDATE cafes SET price_range = '₹50–₹100' WHERE avg_cost_per_person IS NOT NULL AND avg_cost_per_person <= 100");
  db.exec("UPDATE cafes SET price_range = '₹100–₹200' WHERE price_range = 'Under ₹200'");

  // Unpublish legacy seed entries that do not belong to the curated catalog
  db.exec(
    "UPDATE cafes SET published = 0, wifi_available = 'unknown' WHERE id IN ('beetle-cafe-jp-nagar', 'writers-cafe-hrbr', 'alchemy-jayanagar')"
  );

  // Upsert all Bengaluru cafes from src/data/cafes.ts
  const insertCafe = db.prepare(`
    INSERT INTO cafes (
      id, slug, name, city, area, address, phone, map_link, booking_url,
      website_url, menu_url, instagram_url, place_id, lat, lng,
      timings, description, photos_json, photos_approved,
      wifi_available, wifi_mbps, charging_sockets, sockets_count, sockets_claimed,
      comfortable_seating, suitable_for_studying, suitable_for_working,
      noise_level, avg_cost_per_person, price_range,
      coffee_price, tea_price, snacks_price, meals_price, popular_items_json,
      rating, rating_count, min_spend, laptop_friendly, time_limit,
      modes_json, facilities_json, offers_json, menu_services_json,
      best_for_json, verdict, avoid_if, student_discount,
      verified, featured, published, display_order, last_verified_date, claims_json,
      source_name, source_url, sample, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  const updateCafeOfficialMeta = db.prepare(`
    UPDATE cafes SET
      website_url = CASE WHEN website_url = '' THEN ? ELSE website_url END,
      menu_url = CASE WHEN menu_url = '' THEN ? ELSE menu_url END,
      instagram_url = CASE WHEN instagram_url = '' THEN ? ELSE instagram_url END,
      popular_items_json = CASE WHEN popular_items_json = '[]' OR popular_items_json = '' THEN ? ELSE popular_items_json END,
      wifi_available = CASE WHEN wifi_available = 'unknown' THEN ? ELSE wifi_available END,
      price_range = CASE WHEN price_range = '' OR price_range = 'Under ₹200' THEN ? ELSE price_range END,
      coffee_price = CASE WHEN coffee_price IS NULL OR coffee_price = '' THEN ? ELSE coffee_price END,
      tea_price = CASE WHEN tea_price IS NULL OR tea_price = '' THEN ? ELSE tea_price END,
      snacks_price = CASE WHEN snacks_price IS NULL OR snacks_price = '' THEN ? ELSE snacks_price END,
      meals_price = CASE WHEN meals_price IS NULL OR meals_price = '' THEN ? ELSE meals_price END,
      photos_json = CASE WHEN (photos_json = '[]' OR photos_json = '') AND ? != '[]' THEN ? ELSE photos_json END,
      photos_approved = CASE WHEN photos_approved = 0 AND ? = 1 THEN 1 ELSE photos_approved END
    WHERE id = ?
  `);

  const seedNow = Date.now();
  CAFES.forEach((c, idx) => {
    const verdictText =
      c.claims[0] ?? 'Bengaluru cafe listed from official website & public sources.';
    const facilities: string[] = [];
    if (c.wifi_available === 'yes') facilities.push('Customer Wi-Fi available');
    if (c.sockets_claimed) facilities.push('Power sockets reported by public sources');
    if (c.laptop_friendly) facilities.push('Laptop-friendly seating');
    if (c.modes.includes('budget')) facilities.push('Budget-friendly cafe menu');

    const socketsState: AmenityState =
      (c.sockets_count !== null && c.sockets_count > 0) || c.sockets_claimed ? 'yes' : 'unknown';
    const studyState: AmenityState =
      c.modes.includes('calm') || c.best_for.some((b) => /study|read|deep/i.test(b))
        ? 'yes'
        : 'unknown';
    const workState: AmenityState =
      c.modes.includes('work') || c.laptop_friendly ? 'yes' : 'unknown';
    const comfortableState: AmenityState =
      c.laptop_friendly || c.modes.includes('plan') ? 'yes' : 'unknown';
    const priceLabel = derivePriceRangeLabel(c.avg_cost_per_person);
    const popularJson = JSON.stringify(c.popular_items ?? []);
    const photosJson = JSON.stringify(c.photos ?? []);
    const hasPhotos = c.photos && c.photos.length > 0 ? 1 : 0;

    insertCafe.run(
      c.id,
      c.id,
      c.name,
      'Bengaluru',
      c.area,
      c.address,
      '',
      c.map_link,
      '',
      c.website_url || '',
      c.menu_url || '',
      c.instagram_url || '',
      '',
      null,
      null,
      c.timings,
      c.claims.join(' · '),
      photosJson,
      hasPhotos,
      c.wifi_available,
      c.wifi_mbps,
      socketsState,
      c.sockets_count,
      c.sockets_claimed ? 1 : 0,
      comfortableState,
      studyState,
      workState,
      c.noise_level,
      c.avg_cost_per_person,
      priceLabel,
      c.coffee_price ?? null,
      c.tea_price ?? null,
      c.snacks_price ?? null,
      c.meals_price ?? null,
      popularJson,
      null,
      null,
      c.min_spend,
      c.laptop_friendly ? 1 : 0,
      c.time_limit,
      JSON.stringify(c.modes),
      JSON.stringify(facilities),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify(c.best_for),
      verdictText,
      c.avoid_if,
      c.student_discount,
      c.verified ? 1 : 0,
      c.featured ? 1 : 0,
      1,
      idx + 1,
      c.last_verified_date,
      JSON.stringify(c.claims),
      c.source_name,
      c.source_url,
      0,
      seedNow
    );

    updateCafeOfficialMeta.run(
      c.website_url || '',
      c.menu_url || '',
      c.instagram_url || '',
      popularJson,
      c.wifi_available,
      priceLabel,
      c.coffee_price ?? null,
      c.tea_price ?? null,
      c.snacks_price ?? null,
      c.meals_price ?? null,
      photosJson,
      photosJson,
      hasPhotos,
      c.id
    );
  });

  // Seed default site settings (adds any new keys without overwriting custom edits)
  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)'
  );
  const now = Date.now();
  for (const [k, v] of Object.entries(DEFAULT_SITE_SETTINGS)) {
    const serialized = typeof v === 'object' ? JSON.stringify(v) : String(v);
    insertSetting.run(k, serialized, now);
  }

  // Upgrade pre-existing default settings that carry legacy booking or older tagline copy
  const legacyUpgrades: Array<[string, string, string]> = [
    ['brand_name', 'CafeDesk', DEFAULT_SITE_SETTINGS.brand_name],
    ['brand_tagline', 'Specialty Coffee Houses & Workspaces', DEFAULT_SITE_SETTINGS.brand_tagline],
    ['brand_tagline', 'Bengaluru Wi-Fi Cafe Discovery Platform', DEFAULT_SITE_SETTINGS.brand_tagline],
    ['business_legal_name', 'Cafe Desk · Bengaluru Wi-Fi Cafe Discovery', DEFAULT_SITE_SETTINGS.business_legal_name],
    ['footer_copyright', '© 2026 Cafe Desk. Bengaluru Wi-Fi cafe discovery for coffee, study, and work.', DEFAULT_SITE_SETTINGS.footer_copyright],
    ['hero_kicker', 'Bengaluru · Specialty Work Cafes', DEFAULT_SITE_SETTINGS.hero_kicker],
    ['hero_kicker', 'Bengaluru · Cafe Discovery Platform', DEFAULT_SITE_SETTINGS.hero_kicker],
    ['hero_kicker', 'Bengaluru · Wi-Fi Cafe Discovery Platform', DEFAULT_SITE_SETTINGS.hero_kicker],
    ['hero_tagline', 'Find your desk, savour your coffee.', DEFAULT_SITE_SETTINGS.hero_tagline],
    ['hero_tagline', 'Find your desk, find your cafe.', DEFAULT_SITE_SETTINGS.hero_tagline],
    ['hero_tagline', 'Find Your Perfect Work Cafe.', DEFAULT_SITE_SETTINGS.hero_tagline],
    [
      'hero_subtitle',
      'WiFi Mbps, reachable sockets, noise levels, and honest spend checks across Indiranagar, Koramangala, Jayanagar, HSR Layout, and Rajajinagar.',
      DEFAULT_SITE_SETTINGS.hero_subtitle,
    ],
    [
      'hero_subtitle',
      'Thoughtfully designed cafe workspaces verified for symmetric fiber WiFi, dedicated power access, balanced acoustics, and single-origin espresso.',
      DEFAULT_SITE_SETTINGS.hero_subtitle,
    ],
    [
      'hero_subtitle',
      'Discover nearby cafes for coffee, conversations, studying, and working.',
      DEFAULT_SITE_SETTINGS.hero_subtitle,
    ],
    [
      'hero_subtitle',
      "Discover Bengaluru's Wi-Fi cafes. Find your next coffee, workspace, or study spot.",
      DEFAULT_SITE_SETTINGS.hero_subtitle,
    ],
    [
      'hero_subtitle',
      "Discover Bengaluru's cafes for affordable coffee, tea, study, casual meetings, and laptop work.",
      DEFAULT_SITE_SETTINGS.hero_subtitle,
    ],
    ['hero_cta_primary_label', 'Explore Locations', DEFAULT_SITE_SETTINGS.hero_cta_primary_label],
    ['hero_cta_primary_label', 'Explore Wi-Fi Cafes', DEFAULT_SITE_SETTINGS.hero_cta_primary_label],
    ['hero_cta_secondary_label', 'Book a Table', DEFAULT_SITE_SETTINGS.hero_cta_secondary_label],
    [
      'hero_cta_secondary_link',
      '/contact?intent=booking',
      DEFAULT_SITE_SETTINGS.hero_cta_secondary_link,
    ],
    ['hero_cta_tertiary_label', 'Contact Us', DEFAULT_SITE_SETTINGS.hero_cta_tertiary_label],
    ['hero_cta_tertiary_link', '/contact', DEFAULT_SITE_SETTINGS.hero_cta_tertiary_link],
    [
      'banner_text',
      'Weekday Work Pass: Enjoy unlimited pour-over refills with reserved window desks.',
      DEFAULT_SITE_SETTINGS.banner_text,
    ],
    [
      'banner_text',
      'Discover Bengaluru cafes by live distance, Wi-Fi, charging sockets, noise & budget.',
      DEFAULT_SITE_SETTINGS.banner_text,
    ],
    [
      'banner_text',
      'Every listed Bengaluru cafe provides customer Wi-Fi — compare distance, charging sockets, noise & budgets.',
      DEFAULT_SITE_SETTINGS.banner_text,
    ],
    ['banner_cta_label', 'Reserve a table', DEFAULT_SITE_SETTINGS.banner_cta_label],
    ['banner_link', '/contact?intent=booking', DEFAULT_SITE_SETTINGS.banner_link],
    [
      'about_heading',
      'Built for people who choose a cafe by its Wi-Fi, coffee, budget, and focus.',
      DEFAULT_SITE_SETTINGS.about_heading,
    ],
    [
      'about_lead',
      'Cafe Desk is a Bengaluru cafe discovery platform listing cafes that provide customer Wi-Fi, connecting students, freelancers, and remote workers directly to real cafes and their official websites.',
      DEFAULT_SITE_SETTINGS.about_lead,
    ],
    [
      'about_story',
      'Browse Bengaluru Wi-Fi cafes across Indiranagar, Koramangala, HSR Layout, Whitefield, Jayanagar, MG Road, Church Street, BTM Layout, JP Nagar, and Electronic City. Where Cafe Desk has measured Wi-Fi speed or sockets in person, metrics are timestamped; otherwise speed is honestly shown as "Not verified" alongside direct links to each cafe’s official website, menu, Instagram, and Google Maps directions.',
      DEFAULT_SITE_SETTINGS.about_story,
    ],
    [
      'services_subtitle',
      'Find reliable Bengaluru cafes with customer Wi-Fi, clear food budgets, reachable charging points, and direct access to official menus.',
      DEFAULT_SITE_SETTINGS.services_subtitle,
    ],
    [
      'contact_heading',
      'Reserve a desk, plan a meetup, or talk to our team.',
      DEFAULT_SITE_SETTINGS.contact_heading,
    ],
    [
      'contact_subtitle',
      'Send a table reservation request, ask about corporate work passes, or update details for any Bengaluru branch.',
      DEFAULT_SITE_SETTINGS.contact_subtitle,
    ],
    [
      'contact_subtitle',
      'Share feedback, suggest a Bengaluru Wi-Fi cafe, or update an official website link via email or WhatsApp.',
      DEFAULT_SITE_SETTINGS.contact_subtitle,
    ],
    [
      'seo_home_title',
      'CafeDesk – Specialty Coffee Houses & Workspaces',
      DEFAULT_SITE_SETTINGS.seo_home_title,
    ],
    [
      'seo_home_title',
      'Cafe Desk – Find Your Perfect Work Cafe in Bengaluru',
      DEFAULT_SITE_SETTINGS.seo_home_title,
    ],
    [
      'seo_home_description',
      "Discover Bengaluru's Wi-Fi cafes across Indiranagar, Koramangala, HSR Layout, Whitefield, Jayanagar & more. Find your next coffee, workspace, or study spot.",
      DEFAULT_SITE_SETTINGS.seo_home_description,
    ],
    [
      'seo_locations_title',
      'Find Wi-Fi Cafes in Bengaluru & Interactive Map | Cafe Desk',
      DEFAULT_SITE_SETTINGS.seo_locations_title,
    ],
    [
      'seo_locations_description',
      'Explore Bengaluru Wi-Fi cafes by locality, live distance, budget (Under ₹200–₹500+), charging sockets, and official cafe websites.',
      DEFAULT_SITE_SETTINGS.seo_locations_description,
    ],
    [
      'seo_about_description',
      'Learn how Cafe Desk curates Bengaluru Wi-Fi cafes and connects students and remote workers directly to official cafe websites.',
      DEFAULT_SITE_SETTINGS.seo_about_description,
    ],
    [
      'seo_contact_title',
      'Contact & Table Reservations – CafeDesk',
      DEFAULT_SITE_SETTINGS.seo_contact_title,
    ],
    [
      'seo_contact_description',
      'Suggest a Bengaluru Wi-Fi cafe, report outdated details, or contact the Cafe Desk team.',
      DEFAULT_SITE_SETTINGS.seo_contact_description,
    ],
  ];
  const updateLegacySetting = db.prepare(
    'UPDATE site_settings SET value = ?, updated_at = ? WHERE key = ? AND value = ?'
  );
  for (const [k, oldVal, newVal] of legacyUpgrades) {
    updateLegacySetting.run(newVal, now, k, oldVal);
  }

  // Clean up legacy booking references or outdated all-Wi-Fi pool copy inside JSON settings
  const currentSettingsRows = db
    .prepare("SELECT key, value FROM site_settings WHERE key IN ('homepage_sections', 'announcements', 'faqs_items', 'services_items', 'facilities_items', 'seo_home_description', 'seo_contact_description', 'about_lead', 'about_story')")
    .all() as Array<{ key: string; value: string }>;
  for (const row of currentSettingsRows) {
    if (
      /book a table|reserve|reservation|Wi-Fi-Only Cafe Pool|Only cafes providing customer Wi-Fi|Every listed cafe provides customer Wi-Fi|Across 10 Bengaluru Localities/i.test(
        row.value
      ) &&
      row.key in DEFAULT_SITE_SETTINGS
    ) {
      const defVal = DEFAULT_SITE_SETTINGS[row.key as keyof SiteSettings];
      const serialized = typeof defVal === 'object' ? JSON.stringify(defVal) : String(defVal);
      db.prepare('UPDATE site_settings SET value = ?, updated_at = ? WHERE key = ?').run(
        serialized,
        now,
        row.key
      );
    }
  }

  // Clean any legacy "Book a Table" navigation items
  db.exec(
    "DELETE FROM navigation_items WHERE lower(label) LIKE '%book a table%' OR lower(label) LIKE '%book slot%' OR url LIKE '%intent=booking%'"
  );

  // Seed or normalize navigation links
  const navCount = db.prepare('SELECT COUNT(*) as cnt FROM navigation_items').get() as { cnt: number };
  if (navCount.cnt === 0) {
    const insNav = db.prepare(
      'INSERT INTO navigation_items (location, label, url, sort_order, visible, is_external) VALUES (?, ?, ?, ?, 1, 0)'
    );
    insNav.run('header', 'Explore Cafes', '/locations', 1);
    insNav.run('header', 'Cafe Finder', '/finder', 2);
    insNav.run('header', 'Cafe Map', '/locations?view=map', 3);
    insNav.run('header', 'Pricing', '/pricing', 4);
    insNav.run('header', 'About', '/about', 5);
    insNav.run('header', 'Contact', '/contact', 6);

    insNav.run('footer', 'Explore Cafes', '/locations', 1);
    insNav.run('footer', 'Interactive Cafe Finder', '/finder', 2);
    insNav.run('footer', 'Interactive Cafe Map', '/locations?view=map', 3);
    insNav.run('footer', 'Plans & Pricing', '/pricing', 4);
    insNav.run('footer', 'About & FAQs', '/about', 5);
    insNav.run('footer', 'Submit / Update Cafe', '/submit', 6);
    insNav.run('footer', 'For Cafe Owners', '/owners', 7);
    insNav.run('footer', 'Admin Login', '/admin/login', 8);
  } else {
    // Rename legacy "Locations" label to "Explore Cafes" if default
    db.exec("UPDATE navigation_items SET label = 'Explore Cafes' WHERE location = 'header' AND label = 'Locations' AND url = '/locations'");
    const hasFinderHeader = db
      .prepare("SELECT COUNT(*) as cnt FROM navigation_items WHERE location = 'header' AND url = '/finder'")
      .get() as { cnt: number };
    if (hasFinderHeader.cnt === 0) {
      db.prepare(
        "INSERT INTO navigation_items (location, label, url, sort_order, visible, is_external) VALUES ('header', 'Cafe Finder', '/finder', 2, 1, 0)"
      ).run();
    }
    const hasFinderFooter = db
      .prepare("SELECT COUNT(*) as cnt FROM navigation_items WHERE location = 'footer' AND url = '/finder'")
      .get() as { cnt: number };
    if (hasFinderFooter.cnt === 0) {
      db.prepare(
        "INSERT INTO navigation_items (location, label, url, sort_order, visible, is_external) VALUES ('footer', 'Interactive Cafe Finder', '/finder', 2, 1, 0)"
      ).run();
    }
    const hasMapLink = db
      .prepare("SELECT COUNT(*) as cnt FROM navigation_items WHERE url LIKE '%view=map%'")
      .get() as { cnt: number };
    if (hasMapLink.cnt === 0) {
      db.prepare(
        "INSERT INTO navigation_items (location, label, url, sort_order, visible, is_external) VALUES ('footer', 'Interactive Cafe Map', '/locations?view=map', 3, 1, 0)"
      ).run();
    }
    const hasHeaderPricing = db
      .prepare("SELECT COUNT(*) as cnt FROM navigation_items WHERE location = 'header' AND url = '/pricing'")
      .get() as { cnt: number };
    if (hasHeaderPricing.cnt === 0) {
      db.prepare(
        "INSERT INTO navigation_items (location, label, url, sort_order, visible, is_external) VALUES ('header', 'Pricing', '/pricing', 4, 1, 0)"
      ).run();
    }
    const hasFooterPricing = db
      .prepare("SELECT COUNT(*) as cnt FROM navigation_items WHERE location = 'footer' AND url = '/pricing'")
      .get() as { cnt: number };
    if (hasFooterPricing.cnt === 0) {
      db.prepare(
        "INSERT INTO navigation_items (location, label, url, sort_order, visible, is_external) VALUES ('footer', 'Plans & Pricing', '/pricing', 4, 1, 0)"
      ).run();
    }
  }

  // Seed editorial photography into Media Manager if empty
  const mediaCount = db.prepare('SELECT COUNT(*) as cnt FROM media_assets').get() as { cnt: number };
  if (mediaCount.cnt === 0) {
    const insMedia = db.prepare(
      `INSERT OR IGNORE INTO media_assets (filename, original_name, mime_type, size_bytes, url, alt_text, description, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const m of DEFAULT_MEDIA_SEED) {
      insMedia.run(
        m.filename,
        m.original_name,
        m.mime_type,
        m.size_bytes,
        m.url,
        m.alt_text,
        m.description,
        m.category,
        now
      );
    }
  }

  const adminCount = db.prepare('SELECT COUNT(*) as cnt FROM admins').get() as { cnt: number };
  const bootstrapUser = process.env.ADMIN_BOOTSTRAP_USER?.trim();
  const bootstrapPass = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (adminCount.cnt === 0 && bootstrapUser && bootstrapPass && bootstrapPass.length >= 10) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(bootstrapPass, salt, 64).toString('hex');
    db.prepare(
      `INSERT INTO admins (username, email, display_name, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'super_admin', ?, ?)`
    ).run(bootstrapUser, '', 'Administrator', `scrypt:${salt}:${derived}`, now, now);
  }

  // Seed streamlined Free + Cafe Desk Plus (Monthly ₹79 & Annual ₹499) subscription plans
  const freeFeatures = JSON.stringify([
    'Search cafes across Bengaluru by name, locality & live autocomplete',
    'Discover nearby cafes using GPS distance, photos & Google Maps directions',
    'Interactive Cafe Finder & curated Bengaluru discovery collections',
    'Laptop-friendly status, seating, studying, noise level, sockets & ambience',
    'Save & bookmark favourite Bengaluru cafes to your free account',
  ]);
  const plusMonthlyFeatures = JSON.stringify([
    'Everything in Free Explorer',
    'Full food & beverage menus, coffee/tea/snack prices & average budget per person',
    'Verified Wi-Fi availability, measured speeds (Mbps) & work/meeting filters',
    'Advanced budget & food category filters',
    'Compare multiple cafes side-by-side (up to 4 cafes)',
    'Personal custom cafe collections & personalized recommendations',
    'Exclusive cafe deals, partner perks & student discounts',
  ]);
  const plusAnnualFeatures = JSON.stringify([
    'All Cafe Desk Plus features unlocked for 365 days (₹42/mo effective)',
    'Full food & beverage menus, prices & average budget filters',
    'Verified Wi-Fi speeds, remote work & meeting filters',
    'Side-by-side cafe comparison & unlimited custom collections',
    'Personalized cafe recommendations & exclusive partner deals',
  ]);

  const insertPlan = db.prepare(
    `INSERT OR IGNORE INTO subscription_plans
     (id, name, tagline, price_inr, interval_days, badge_text, features_json, sort_order, active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  );
  insertPlan.run(
    'free',
    'Free Explorer',
    'Discover Bengaluru cafes, save favourites, check laptops, seating, study, noise & sockets.',
    0,
    0,
    'Free Forever',
    freeFeatures,
    1,
    now
  );
  insertPlan.run(
    'plus',
    'Cafe Desk Plus (Monthly)',
    'Complete menus & prices, budget filters, verified Wi-Fi speeds, comparisons & deals.',
    79,
    30,
    'Most Popular',
    plusMonthlyFeatures,
    2,
    now
  );
  insertPlan.run(
    'premium',
    'Cafe Desk Plus (Annual)',
    'Full Cafe Desk Plus access all year — save 47% over monthly billing.',
    499,
    365,
    'Best Value · Save 47%',
    plusAnnualFeatures,
    3,
    now
  );

  // Non-destructively upgrade old default 3-tier rows if they still match prior default seed values
  db.prepare(
    `UPDATE subscription_plans
     SET tagline = ?, features_json = ?, updated_at = ?
     WHERE id = 'free' AND tagline IN (
       'Search and locate Bengaluru cafes with live directions.',
       'Search Bengaluru cafes with laptops, seating, studying, noise level & charging sockets.'
     )`
  ).run(
    'Discover Bengaluru cafes, save favourites, check laptops, seating, study, noise & sockets.',
    freeFeatures,
    now
  );
  db.prepare(
    `UPDATE subscription_plans
     SET name = ?, tagline = ?, price_inr = 79, interval_days = 30, badge_text = 'Most Popular', features_json = ?, updated_at = ?
     WHERE id = 'plus' AND (price_inr = 99 OR name = 'Cafe Explorer Plus')`
  ).run(
    'Cafe Desk Plus (Monthly)',
    'Complete menus & prices, budget filters, verified Wi-Fi speeds, comparisons & deals.',
    plusMonthlyFeatures,
    now
  );
  db.prepare(
    `UPDATE subscription_plans
     SET name = ?, tagline = ?, price_inr = 499, interval_days = 365, badge_text = 'Best Value · Save 47%', features_json = ?, updated_at = ?
     WHERE id = 'premium' AND (price_inr = 149 OR name = 'Cafe Desk Premium')`
  ).run(
    'Cafe Desk Plus (Annual)',
    'Full Cafe Desk Plus access all year — save 47% over monthly billing.',
    plusAnnualFeatures,
    now
  );

  // Ensure at least one recommended plan highlight is set if none exists yet
  const recCount = db
    .prepare('SELECT COUNT(*) as cnt FROM subscription_plans WHERE is_recommended = 1')
    .get() as { cnt: number };
  if (recCount.cnt === 0) {
    db.exec("UPDATE subscription_plans SET is_recommended = 1 WHERE id = 'plus'");
  }

  // Backfill plan permissions_json if uninitialized
  const planPermRows = db
    .prepare('SELECT id, price_inr, permissions_json FROM subscription_plans')
    .all() as Array<{ id: string; price_inr: number; permissions_json: string }>;
  const updPerm = db.prepare('UPDATE subscription_plans SET permissions_json = ? WHERE id = ?');
  for (const pr of planPermRows) {
    if (!pr.permissions_json || pr.permissions_json.trim() === '{}' || pr.permissions_json.trim() === '') {
      const isPaid = pr.id !== 'free' && Number(pr.price_inr) > 0;
      updPerm.run(JSON.stringify(isPaid ? DEFAULT_PAID_PERMISSIONS : DEFAULT_FREE_PERMISSIONS), pr.id);
    }
  }

  db.exec('UPDATE cafes SET created_at = updated_at WHERE created_at IS NULL');

  // One-time backfill of structured menu_items from legacy menu_services_json where menu_items is empty for that cafe
  const cafesWithMenuJson = db
    .prepare(
      `SELECT c.id, c.menu_services_json
       FROM cafes c
       WHERE c.menu_services_json IS NOT NULL
         AND c.menu_services_json != '[]'
         AND c.menu_services_json != ''
         AND NOT EXISTS (SELECT 1 FROM menu_items m WHERE m.cafe_id = c.id)`
    )
    .all() as Array<{ id: string; menu_services_json: string }>;

  if (cafesWithMenuJson.length > 0) {
    const insMenu = db.prepare(
      `INSERT INTO menu_items
       (cafe_id, name, category, description, price_inr, photo_url, available, dietary, is_bestseller, is_featured, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '', 1, 'na', 0, 0, ?, ?, ?)`
    );
    for (const c of cafesWithMenuJson) {
      const items = safeParseJson<Array<{ name?: string; price?: string; category?: string; description?: string }>>(
        c.menu_services_json,
        []
      );
      items.forEach((it, idx) => {
        const cleanName = String(it?.name || '').trim();
        if (!cleanName) return;
        const parsedPrice = Number(String(it?.price || '').replace(/[^\d.]/g, ''));
        const priceInr = Number.isFinite(parsedPrice) && parsedPrice > 0 ? Math.round(parsedPrice) : 0;
        insMenu.run(
          c.id,
          cleanName,
          String(it?.category || 'Coffee').trim() || 'Coffee',
          String(it?.description || '').trim(),
          priceInr,
          idx,
          now,
          now
        );
      });
    }
  }

  dbInstance = db;
  return db;
}

function safeParseJson<T>(raw: unknown, fallback: T): T {
  try {
    if (typeof raw !== 'string' || !raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function listMenuItemsFromDb(cafeId?: string): MenuItemRecord[] {
  const db = getDb();
  const rows = cafeId
    ? (db
        .prepare(
          'SELECT * FROM menu_items WHERE cafe_id = ? ORDER BY sort_order ASC, is_bestseller DESC, id ASC'
        )
        .all(cafeId) as Array<Record<string, unknown>>)
    : (db
        .prepare('SELECT * FROM menu_items ORDER BY cafe_id ASC, sort_order ASC, is_bestseller DESC, id ASC')
        .all() as Array<Record<string, unknown>>);

  return rows.map((r) => {
    const d = String(r.dietary || 'na');
    const dietary: DietaryType =
      d === 'veg' || d === 'non_veg' || d === 'vegan' ? d : 'na';
    const rawDiscount = r.discount_price_inr;
    const parsedDiscount =
      rawDiscount !== null && rawDiscount !== undefined && rawDiscount !== ''
        ? Number(rawDiscount)
        : null;
    const priceInr = Number(r.price_inr ?? 0);
    const discountPriceInr =
      parsedDiscount !== null && Number.isFinite(parsedDiscount) && parsedDiscount >= 0 && parsedDiscount < priceInr
        ? parsedDiscount
        : null;
    return {
      id: Number(r.id),
      cafe_id: String(r.cafe_id),
      name: String(r.name),
      category: String(r.category || 'Coffee'),
      description: String(r.description || ''),
      price_inr: priceInr,
      discount_price_inr: discountPriceInr,
      photo_url: String(r.photo_url || ''),
      available: Boolean(r.available ?? 1),
      dietary,
      is_bestseller: Boolean(r.is_bestseller),
      is_featured: Boolean(r.is_featured),
      sort_order: Number(r.sort_order ?? 0),
      created_at: Number(r.created_at ?? 0),
      updated_at: Number(r.updated_at ?? 0),
    };
  });
}

export function syncCafeMenuServicesFromItems(db: DatabaseSync, cafeId: string): void {
  const rows = db
    .prepare(
      'SELECT name, category, description, price_inr, discount_price_inr, available FROM menu_items WHERE cafe_id = ? ORDER BY sort_order ASC, is_bestseller DESC, id ASC'
    )
    .all(cafeId) as Array<{
    name: string;
    category: string;
    description: string;
    price_inr: number;
    discount_price_inr: number | null;
    available: number;
  }>;
  const serialized = JSON.stringify(
    rows
      .filter((r) => Boolean(r.available))
      .map((r) => {
        const effPrice =
          r.discount_price_inr !== null && r.discount_price_inr !== undefined && r.discount_price_inr < r.price_inr
            ? r.discount_price_inr
            : r.price_inr;
        return {
          name: r.name,
          price: effPrice > 0 ? `₹${effPrice}` : '',
          category: r.category,
          description: r.description,
        };
      })
  );
  db.prepare('UPDATE cafes SET menu_services_json = ?, updated_at = ? WHERE id = ?').run(
    serialized,
    Date.now(),
    cafeId
  );
}

export function listLocationsFromDb(includeUnpublished = false): LocationItem[] {
  const db = getDb();
  const where = includeUnpublished
    ? ''
    : "WHERE published = 1 AND COALESCE(merged_into_id, '') = ''";
  const rows = db
    .prepare(`SELECT * FROM cafes ${where} ORDER BY display_order ASC, featured DESC, verified DESC, name ASC`)
    .all() as Array<Record<string, unknown>>;

  const allMenuItems = listMenuItemsFromDb();
  const menuByCafe = new Map<string, MenuItemRecord[]>();
  for (const item of allMenuItems) {
    const arr = menuByCafe.get(item.cafe_id) ?? [];
    arr.push(item);
    menuByCafe.set(item.cafe_id, arr);
  }

  return rows.map((row) => {
    const photosApproved = Boolean(row.photos_approved);
    const rawPhotos = safeParseJson<string[]>(row.photos_json, []);
    const rawInteriorPhotos = safeParseJson<string[]>(row.interior_photos_json, []);
    const rawExteriorPhotos = safeParseJson<string[]>(row.exterior_photos_json, []);
    const toNullableInt = (val: unknown): number | null => {
      if (val === null || val === undefined || val === '') return null;
      const n = Number(val);
      return Number.isFinite(n) ? n : null;
    };
    const toNullableFloat = (val: unknown): number | null => {
      if (val === null || val === undefined || val === '') return null;
      const n = Number(val);
      return Number.isFinite(n) ? n : null;
    };
    const toNullableStr = (val: unknown): string | null => {
      if (val === null || val === undefined || String(val).trim() === '') return null;
      return String(val);
    };

    const rawNoise = toNullableInt(row.noise_level);
    const wifiMbps = toNullableInt(row.wifi_mbps);
    const socketsCount = toNullableInt(row.sockets_count);
    const socketsClaimed = Boolean(row.sockets_claimed);
    const avgCost = toNullableInt(row.avg_cost_per_person);
    const modes = safeParseJson<LocationItem['modes']>(row.modes_json, ['work']);
    const bestFor = safeParseJson<string[]>(row.best_for_json, []);
    const claims = safeParseJson<string[]>(row.claims_json, []);
    const laptopFriendly = Boolean(row.laptop_friendly);

    let wifiAvailable = parseAmenityState(row.wifi_available);
    if (wifiAvailable === 'unknown') {
      const claimsText = claims.join(' ').toLowerCase();
      if ((wifiMbps !== null && wifiMbps > 0) || /wifi|wi-fi|internet/.test(claimsText)) {
        wifiAvailable = 'yes';
      }
    }

    let chargingSockets = parseAmenityState(row.charging_sockets);
    if (chargingSockets === 'unknown') {
      if ((socketsCount !== null && socketsCount > 0) || socketsClaimed) {
        chargingSockets = 'yes';
      }
    }

    let suitableForWorking = parseAmenityState(row.suitable_for_working);
    if (suitableForWorking === 'unknown' && (modes.includes('work') || laptopFriendly)) {
      suitableForWorking = 'yes';
    }

    let suitableForStudying = parseAmenityState(row.suitable_for_studying);
    if (
      suitableForStudying === 'unknown' &&
      (modes.includes('calm') || bestFor.some((b) => /study|read|deep/i.test(b)))
    ) {
      suitableForStudying = 'yes';
    }

    const priceRange = String(row.price_range || '').trim() || derivePriceRangeLabel(avgCost);

    return {
      id: String(row.id),
      slug: String(row.slug || row.id),
      name: String(row.name),
      category: String(row.category || 'Cafe'),
      city: String(row.city || 'Bengaluru'),
      area: String(row.area),
      address: String(row.address),
      phone: String(row.phone || ''),
      map_link: String(row.map_link),
      website_url: String(row.website_url || ''),
      menu_url: String(row.menu_url || ''),
      instagram_url: String(row.instagram_url || ''),
      other_social_links: String(row.other_social_links || ''),
      place_id: String(row.place_id || ''),
      lat: toNullableFloat(row.lat),
      lng: toNullableFloat(row.lng),
      timings: String(row.timings),
      description: String(row.description || row.verdict || ''),
      photos: includeUnpublished || photosApproved ? rawPhotos : [],
      interior_photos: includeUnpublished || photosApproved ? rawInteriorPhotos : [],
      exterior_photos: includeUnpublished || photosApproved ? rawExteriorPhotos : [],
      photos_approved: photosApproved,
      wifi_available: wifiAvailable,
      wifi_mbps: wifiMbps,
      wifi_password: String(row.wifi_password || ''),
      charging_sockets: chargingSockets,
      sockets_count: socketsCount,
      sockets_claimed: socketsClaimed,
      comfortable_seating: parseAmenityState(row.comfortable_seating),
      seating_info: String(row.seating_info || ''),
      ambience: String(row.ambience || ''),
      outdoor_seating: parseAmenityState(row.outdoor_seating),
      suitable_for_studying: suitableForStudying,
      suitable_for_working: suitableForWorking,
      noise_level:
        rawNoise !== null && rawNoise >= 1 && rawNoise <= 5
          ? (rawNoise as 1 | 2 | 3 | 4 | 5)
          : null,
      avg_cost_per_person: avgCost,
      price_range: priceRange,
      coffee_price: toNullableStr(row.coffee_price),
      tea_price: toNullableStr(row.tea_price),
      snacks_price: toNullableStr(row.snacks_price),
      meals_price: toNullableStr(row.meals_price),
      popular_items: safeParseJson<string[]>(row.popular_items_json, []),
      rating: toNullableFloat(row.rating),
      rating_count: toNullableInt(row.rating_count),
      min_spend: toNullableStr(row.min_spend),
      laptop_friendly: laptopFriendly,
      time_limit: toNullableStr(row.time_limit),
      modes,
      facilities: safeParseJson<string[]>(row.facilities_json, []),
      offers: safeParseJson<string[]>(row.offers_json, []),
      subscriber_benefits: safeParseJson<string[]>(row.subscriber_benefits_json, []),
      menu_services: safeParseJson<LocationItem['menu_services']>(row.menu_services_json, []),
      menu_items: menuByCafe.get(String(row.id)) ?? [],
      best_for: bestFor,
      verdict: String(row.verdict),
      avoid_if: toNullableStr(row.avoid_if),
      student_discount: toNullableStr(row.student_discount),
      verified: Boolean(row.verified),
      featured: Boolean(row.featured),
      published: Boolean(row.published ?? 1),
      display_order: Number(row.display_order ?? 0),
      last_verified_date: toNullableStr(row.last_verified_date),
      claims,
      source_name: String(row.source_name || ''),
      source_url: String(row.source_url || ''),
      source_type: ((): CafeSourceType => {
        const rawSourceType = String(row.source_type || '').trim();
        if (
          rawSourceType === 'cafedesk_verified' ||
          rawSourceType === 'google_places' ||
          rawSourceType === 'community_updated'
        ) {
          return rawSourceType;
        }
        if (/google/i.test(String(row.source_name || '')) && !row.verified) {
          return 'google_places';
        }
        return 'cafedesk_verified';
      })(),
      merged_into_id: String(row.merged_into_id || '').trim() || null,
      sample: Boolean(row.sample),
      access_rule: (['inherit', 'free_public', 'subscription_required', 'specific_plans'].includes(
        String(row.access_rule || '')
      )
        ? String(row.access_rule)
        : 'inherit') as CafeAccessRule,
      allowed_plan_ids: safeParseJson<string[]>(row.allowed_plan_ids_json, []),
      locked_sections_override: safeParseJson<Partial<Record<AccessSectionKey, SectionOverrideMode>>>(
        row.locked_sections_override_json,
        {}
      ),
      created_at: toNullableInt(row.created_at) ?? toNullableInt(row.updated_at) ?? undefined,
      updated_at: toNullableInt(row.updated_at) ?? undefined,
    };
  });
}

export function getSiteSettingsFromDb(): SiteSettings {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM site_settings').all() as Array<{
    key: string;
    value: string;
  }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const out: Record<string, unknown> = {};
  for (const [k, defVal] of Object.entries(DEFAULT_SITE_SETTINGS)) {
    const raw = map.get(k);
    if (raw === undefined) {
      out[k] = defVal;
      continue;
    }
    if (typeof defVal === 'boolean') {
      out[k] = raw === 'true' || raw === '1';
    } else if (typeof defVal === 'number') {
      const n = Number(raw);
      out[k] = Number.isFinite(n) ? n : defVal;
    } else if (typeof defVal === 'object') {
      out[k] = safeParseJson(raw, defVal);
    } else {
      out[k] = raw;
    }
  }
  return out as unknown as SiteSettings;
}

export function listNavigationFromDb(includeHidden = false): NavigationItem[] {
  const db = getDb();
  const where = includeHidden ? '' : 'WHERE visible = 1';
  const rows = db
    .prepare(`SELECT * FROM navigation_items ${where} ORDER BY location ASC, sort_order ASC, id ASC`)
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    location: r.location === 'footer' ? 'footer' : 'header',
    label: String(r.label),
    url: String(r.url),
    sort_order: Number(r.sort_order),
    visible: Boolean(r.visible),
    is_external: Boolean(r.is_external),
  }));
}

export function listTestimonialsFromDb(includeUnpublished = false): TestimonialItem[] {
  const db = getDb();
  const where = includeUnpublished ? '' : 'WHERE published = 1';
  const rows = db
    .prepare(`SELECT * FROM testimonials ${where} ORDER BY id DESC`)
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    author_name: String(r.author_name),
    author_role: String(r.author_role),
    branch_name: String(r.branch_name),
    quote: String(r.quote),
    verified_visit_date: String(r.verified_visit_date),
    published: Boolean(r.published),
    created_at: Number(r.created_at),
  }));
}

export function listMediaFromDb(): MediaAsset[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM media_assets ORDER BY created_at DESC, id DESC')
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    filename: String(r.filename),
    original_name: String(r.original_name),
    mime_type: String(r.mime_type),
    size_bytes: Number(r.size_bytes),
    url: String(r.url),
    alt_text: String(r.alt_text),
    description: String(r.description || ''),
    category: String(r.category || 'General'),
    created_at: Number(r.created_at),
  }));
}

export function recordActivity(
  actor: string,
  action: string,
  target: string,
  previousValue = '',
  newValue = ''
): void {
  const db = getDb();
  db.prepare(
    'INSERT INTO activity_logs (actor, action, target, previous_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    actor,
    action,
    target,
    String(previousValue || '').slice(0, 500),
    String(newValue || '').slice(0, 500),
    Date.now()
  );
}

export function listPlansFromDb(includeInactive = false): SubscriptionPlan[] {
  const db = getDb();
  const where = includeInactive ? '' : 'WHERE active = 1';
  const rows = db
    .prepare(`SELECT * FROM subscription_plans ${where} ORDER BY sort_order ASC`)
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => {
    const id = String(r.id) as PlanTier;
    const priceInr = Number(r.price_inr);
    const isPaid = id !== 'free' && priceInr > 0;
    const rawPerms = safeParseJson<Record<string, unknown>>(r.permissions_json, {});
    return {
      id,
      name: String(r.name),
      tagline: String(r.tagline),
      price_inr: priceInr,
      interval_days: Number(r.interval_days),
      badge_text: String(r.badge_text || ''),
      promo_note: String(r.promo_note || ''),
      usage_limits: String(r.usage_limits || ''),
      is_recommended: Boolean(r.is_recommended),
      features: safeParseJson<string[]>(r.features_json, []),
      permissions: normalizePlanPermissions(rawPerms, isPaid),
      cafe_access_scope: r.cafe_access_scope === 'specific' ? 'specific' : 'all',
      sort_order: Number(r.sort_order),
      active: Boolean(r.active),
      updated_at: Number(r.updated_at),
    };
  });
}

export function getUserEffectiveSubscription(userId: number): UserSubscription {
  const db = getDb();
  const now = Date.now();
  const row = db
    .prepare(
      `SELECT us.*, sp.name as plan_name, sp.price_inr, sp.permissions_json
       FROM user_subscriptions us
       LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
       WHERE us.user_id = ?`
    )
    .get(userId) as Record<string, unknown> | undefined;

  if (!row) {
    db.prepare(
      `INSERT INTO user_subscriptions (user_id, plan_id, subscribed_price_inr, status, started_at, expires_at, auto_renew, updated_at)
       VALUES (?, 'free', 0, 'active', ?, NULL, 0, ?)`
    ).run(userId, now, now);
    const freePlan = db
      .prepare("SELECT name, price_inr, permissions_json FROM subscription_plans WHERE id = 'free'")
      .get() as { name: string; price_inr: number; permissions_json?: string } | undefined;
    const created = db
      .prepare('SELECT * FROM user_subscriptions WHERE user_id = ?')
      .get(userId) as Record<string, unknown>;
    return {
      id: Number(created.id),
      user_id: userId,
      plan_id: 'free',
      plan_name: freePlan?.name || 'Free Explorer',
      price_inr: freePlan?.price_inr ?? 0,
      subscribed_price_inr: 0,
      status: 'active',
      started_at: now,
      expires_at: null,
      auto_renew: false,
      cancelled_at: null,
      expired: false,
      expired_from_plan: null,
      expired_from_plan_name: null,
      expired_at: null,
      suspended_at: null,
      effective_active: false,
      permissions: normalizePlanPermissions(
        safeParseJson(freePlan?.permissions_json, {}),
        false
      ),
      updated_at: now,
    };
  }

  const expiresAt = row.expires_at !== null && row.expires_at !== undefined ? Number(row.expires_at) : null;
  const planId = String(row.plan_id) as PlanTier;
  let status = String(row.status) as UserSubscription['status'];
  let expiredAt = row.expired_at !== null && row.expired_at !== undefined ? Number(row.expired_at) : null;
  let expiredFromPlan = String(row.expired_from_plan || '').trim() || null;

  // Transition expired paid subscriptions to 'expired' WITHOUT erasing which plan expired
  if (planId !== 'free' && expiresAt !== null && expiresAt <= now && status !== 'expired' && status !== 'suspended') {
    status = 'expired';
    expiredAt = expiredAt ?? now;
    expiredFromPlan = expiredFromPlan || planId;
    db.prepare(
      `UPDATE user_subscriptions
       SET status = 'expired',
           expired_at = ?,
           expired_from_plan = ?,
           auto_renew = 0,
           updated_at = ?
       WHERE user_id = ?`
    ).run(expiredAt, expiredFromPlan, now, userId);
    db.prepare(
      `INSERT INTO subscription_history (user_id, action, from_plan, to_plan, note, created_at)
       VALUES (?, 'expired', ?, ?, 'Subscription billing period ended — premium access revoked', ?)`
    ).run(userId, planId, planId, now);
  }

  const isExpired =
    status === 'expired' || (planId !== 'free' && expiresAt !== null && expiresAt <= now);
  const isSuspended = status === 'suspended';
  const planPrice = Number(row.price_inr ?? 0);
  const isPaidPlan = planId !== 'free' && planPrice >= 0;
  const isEffectiveActive =
    isPaidPlan &&
    planId !== 'free' &&
    !isExpired &&
    !isSuspended &&
    (status === 'active' || status === 'cancelled') &&
    (expiresAt === null || expiresAt > now);

  if (isExpired && !expiredFromPlan && planId !== 'free') {
    expiredFromPlan = planId;
  }

  let expiredFromPlanName: string | null = null;
  if (expiredFromPlan) {
    const prevPlan = db
      .prepare('SELECT name FROM subscription_plans WHERE id = ?')
      .get(expiredFromPlan) as { name?: string } | undefined;
    expiredFromPlanName = prevPlan?.name || (row.plan_name ? String(row.plan_name) : expiredFromPlan);
  }

  const subscribedPrice =
    row.subscribed_price_inr !== null && row.subscribed_price_inr !== undefined
      ? Number(row.subscribed_price_inr)
      : planPrice;

  const permissions = isEffectiveActive
    ? normalizePlanPermissions(safeParseJson(row.permissions_json, {}), true)
    : { ...DEFAULT_FREE_PERMISSIONS };

  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    plan_id: planId,
    plan_name: String(row.plan_name || (planId === 'free' ? 'Free Explorer' : planId)),
    price_inr: planPrice,
    subscribed_price_inr: subscribedPrice,
    status: isExpired ? 'expired' : status,
    started_at: Number(row.started_at),
    expires_at: expiresAt,
    auto_renew: Boolean(row.auto_renew),
    cancelled_at: row.cancelled_at !== null && row.cancelled_at !== undefined ? Number(row.cancelled_at) : null,
    expired: isExpired,
    expired_from_plan: expiredFromPlan,
    expired_from_plan_name: expiredFromPlanName,
    expired_at: isExpired ? expiredAt ?? expiresAt ?? Number(row.updated_at) : null,
    suspended_at:
      row.suspended_at !== null && row.suspended_at !== undefined ? Number(row.suspended_at) : null,
    effective_active: isEffectiveActive,
    permissions,
    updated_at: Number(row.updated_at),
  };
}

export function logPlacesApiCall(entry: {
  endpoint: string;
  queryText?: string;
  statusCode: number;
  cached?: boolean;
  resultCount?: number;
  errorMessage?: string;
}): void {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO places_api_logs (endpoint, query_text, status_code, cached, result_count, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entry.endpoint.slice(0, 80),
      String(entry.queryText || '').slice(0, 200),
      entry.statusCode,
      entry.cached ? 1 : 0,
      entry.resultCount ?? 0,
      String(entry.errorMessage || '').slice(0, 300),
      Date.now()
    );
  } catch {
    // Logging must never crash API requests
  }
}

export function getPlacesApiStatsFromDb(hasServerKey: boolean): PlacesApiUsageSummary {
  const db = getDb();
  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  const totals = db
    .prepare(
      `SELECT
        COUNT(*) AS total_calls,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS calls_24h,
        SUM(CASE WHEN created_at >= ? AND cached = 1 THEN 1 ELSE 0 END) AS cache_hits_24h,
        SUM(CASE WHEN created_at >= ? AND status_code >= 400 THEN 1 ELSE 0 END) AS errors_24h
       FROM places_api_logs`
    )
    .get(since24h, since24h, since24h) as Record<string, unknown> | undefined;

  const lastErrRow = db
    .prepare(
      `SELECT error_message FROM places_api_logs
       WHERE status_code >= 400 AND error_message != ''
       ORDER BY id DESC LIMIT 1`
    )
    .get() as { error_message?: string } | undefined;

  const recentRows = db
    .prepare(
      `SELECT id, endpoint, query_text, status_code, cached, result_count, error_message, created_at
       FROM places_api_logs
       ORDER BY id DESC
       LIMIT 25`
    )
    .all() as Array<Record<string, unknown>>;

  return {
    has_server_key: hasServerKey,
    total_calls: Number(totals?.total_calls ?? 0),
    calls_24h: Number(totals?.calls_24h ?? 0),
    cache_hits_24h: Number(totals?.cache_hits_24h ?? 0),
    errors_24h: Number(totals?.errors_24h ?? 0),
    last_error: String(lastErrRow?.error_message || ''),
    recent_logs: recentRows.map((r) => ({
      id: Number(r.id),
      endpoint: String(r.endpoint),
      query_text: String(r.query_text || ''),
      status_code: Number(r.status_code),
      cached: Boolean(r.cached),
      result_count: Number(r.result_count ?? 0),
      error_message: String(r.error_message || ''),
      created_at: Number(r.created_at),
    })),
  };
}

export function createCommunityCorrectionInDb(input: {
  cafeKey: string;
  cafeName: string;
  issueType: string;
  details: string;
  suggestedValue: string;
  reporterName: string;
  reporterEmail: string;
  userId?: number | null;
}): CommunityCorrectionRecord {
  const db = getDb();
  const now = Date.now();
  const res = db
    .prepare(
      `INSERT INTO community_corrections
        (cafe_key, cafe_name, issue_type, details, suggested_value, reporter_name, reporter_email, user_id, status, admin_note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', ?, ?)`
    )
    .run(
      input.cafeKey,
      input.cafeName,
      input.issueType,
      input.details,
      input.suggestedValue,
      input.reporterName,
      input.reporterEmail,
      input.userId ?? null,
      now,
      now
    );

  return {
    id: Number(res.lastInsertRowid),
    cafe_key: input.cafeKey,
    cafe_name: input.cafeName,
    issue_type: input.issueType,
    details: input.details,
    suggested_value: input.suggestedValue,
    reporter_name: input.reporterName,
    reporter_email: input.reporterEmail,
    status: 'pending',
    admin_note: '',
    created_at: now,
    updated_at: now,
  };
}

export function listCommunityCorrectionsFromDb(): CommunityCorrectionRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM community_corrections ORDER BY id DESC LIMIT 200')
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    cafe_key: String(r.cafe_key),
    cafe_name: String(r.cafe_name),
    issue_type: String(r.issue_type),
    details: String(r.details || ''),
    suggested_value: String(r.suggested_value || ''),
    reporter_name: String(r.reporter_name || ''),
    reporter_email: String(r.reporter_email || ''),
    status: (['pending', 'approved', 'rejected', 'resolved'].includes(String(r.status))
      ? String(r.status)
      : 'pending') as CommunityCorrectionRecord['status'],
    admin_note: String(r.admin_note || ''),
    created_at: Number(r.created_at),
    updated_at: Number(r.updated_at),
  }));
}

export function getUserAchievementsFromDb(userId: number): ExplorerAchievementStatus[] {
  const db = getDb();
  const savedCountRow = db
    .prepare('SELECT COUNT(*) AS cnt FROM saved_cafes WHERE user_id = ?')
    .get(userId) as { cnt?: number };
  const collectionItemCountRow = db
    .prepare(
      `SELECT COUNT(ci.cafe_key) AS cnt
       FROM collection_items ci
       JOIN user_collections uc ON uc.id = ci.collection_id
       WHERE uc.user_id = ?`
    )
    .get(userId) as { cnt?: number };
  const viewsCountRow = db
    .prepare("SELECT COUNT(*) AS cnt FROM explorer_events WHERE user_id = ? AND event_type = 'view_place'")
    .get(userId) as { cnt?: number };
  const compareCountRow = db
    .prepare("SELECT COUNT(*) AS cnt FROM explorer_events WHERE user_id = ? AND event_type IN ('compare_places', 'work_mood')")
    .get(userId) as { cnt?: number };
  const correctionsCountRow = db
    .prepare('SELECT COUNT(*) AS cnt FROM community_corrections WHERE user_id = ?')
    .get(userId) as { cnt?: number };

  const savedCount = Number(savedCountRow?.cnt ?? 0);
  const collectionCount = Number(collectionItemCountRow?.cnt ?? 0);
  const viewsCount = Number(viewsCountRow?.cnt ?? 0);
  const compareCount = Number(compareCountRow?.cnt ?? 0);
  const correctionsCount = Number(correctionsCountRow?.cnt ?? 0);

  const progressMap: Record<string, number> = {
    first_save: savedCount,
    cafe_explorer: viewsCount,
    helpful_reviewer: correctionsCount,
    local_guide: collectionCount,
    workspace_explorer: compareCount,
  };

  const now = Date.now();
  for (const badge of EXPLORER_BADGES) {
    const prog = progressMap[badge.id] ?? 0;
    if (prog >= badge.target) {
      db.prepare(
        `INSERT OR IGNORE INTO user_achievements (user_id, badge_id, unlocked_at, meta_json)
         VALUES (?, ?, ?, '{}')`
      ).run(userId, badge.id, now);
    }
  }

  const unlockedRows = db
    .prepare('SELECT badge_id, unlocked_at FROM user_achievements WHERE user_id = ?')
    .all(userId) as Array<{ badge_id: string; unlocked_at: number }>;
  const unlockedByBadge = new Map(unlockedRows.map((r) => [r.badge_id, Number(r.unlocked_at)]));

  return EXPLORER_BADGES.map((badge) => {
    const progress = Math.min(badge.target, progressMap[badge.id] ?? 0);
    const unlockedAt = unlockedByBadge.get(badge.id) ?? null;
    return {
      id: badge.id,
      title: badge.title,
      description: badge.description,
      unlocked: unlockedAt !== null || progress >= badge.target,
      unlocked_at: unlockedAt,
      progress,
      target: badge.target,
    };
  });
}

export function recordExplorerEventInDb(
  userId: number,
  eventType: 'view_place' | 'compare_places' | 'work_mood',
  targetKey: string
): ExplorerAchievementStatus[] {
  const db = getDb();
  const cleanTarget = String(targetKey || '').trim().slice(0, 120) || 'default';
  db.prepare(
    `INSERT OR IGNORE INTO explorer_events (user_id, event_type, target_key, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(userId, eventType, cleanTarget, Date.now());
  return getUserAchievementsFromDb(userId);
}



import type { CafeMode } from '../config/constants';

export type DietaryType = 'veg' | 'non_veg' | 'vegan' | 'na';

export type CafeSourceType = 'cafedesk_verified' | 'google_places' | 'community_updated';

export interface MenuServiceItem {
  name: string;
  price: string;
  category: string;
  description: string;
}

export interface MenuItemRecord {
  id: number;
  cafe_id: string;
  name: string;
  category: string;
  description: string;
  price_inr: number;
  discount_price_inr?: number | null;
  photo_url: string;
  available: boolean;
  dietary: DietaryType;
  is_bestseller: boolean;
  is_featured: boolean;
  sort_order: number;
  created_at?: number;
  updated_at?: number;
}

export type AmenityState = 'yes' | 'no' | 'unknown';

export type AccessSectionKey =
  | 'wifi_details'
  | 'power_sockets'
  | 'workspace_details'
  | 'food_menu'
  | 'menu_pricing'
  | 'amenities'
  | 'subscriber_benefits'
  | 'booking';

export type SectionAccessRequirement = 'public' | 'subscription';
export type CafeAccessRule = 'inherit' | 'free_public' | 'subscription_required' | 'specific_plans';
export type SectionOverrideMode = 'inherit' | 'public' | 'subscription';

export interface AccessControlSettings {
  default_rule: 'subscription_required' | 'free_public';
  sections: Record<AccessSectionKey, SectionAccessRequirement>;
  free_cafe_preview_note: string;
}

export interface CafeAccessInfo {
  hasAccess: boolean;
  viewerState: 'guest' | 'free' | 'expired' | 'suspended' | 'subscribed' | 'admin';
  cafeRule: CafeAccessRule;
  allowedPlanIds: string[];
  unlockedSections: Record<AccessSectionKey, boolean>;
  lockedSections: AccessSectionKey[];
  lockReason: 'none' | 'guest' | 'no_subscription' | 'plan_restricted' | 'expired' | 'suspended';
}

export type FeatureFlagKey =
  | 'smart_nl_search'
  | 'quality_scores'
  | 'visit_companion'
  | 'menu_intelligence'
  | 'community_reviews'
  | 'community_photos'
  | 'public_collections'
  | 'personalisation'
  | 'cafe_following'
  | 'notifications'
  | 'owner_portal'
  | 'promotions'
  | 'bookings'
  | 'live_google_places';

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export interface ScoringConfig {
  work_ready_weights: {
    wifi: number;
    sockets: number;
    seating: number;
    noise: number;
    affordability: number;
    workspace_fit: number;
  };
  confidence_weights: {
    verified_badge: number;
    recency: number;
    completeness: number;
    photos_verified: number;
    source_attribution: number;
  };
}

export interface CafeReviewSummary {
  average_rating: number | null;
  review_count: number;
  verified_wifi_reports: number;
  verified_socket_reports: number;
}

export interface LocationItem {
  id: string;
  slug: string;
  name: string;
  category?: string;
  city: string;
  area: string;
  address: string;
  phone: string;
  map_link: string;
  website_url: string;
  menu_url: string;
  instagram_url: string;
  other_social_links?: string;
  place_id: string;
  lat: number | null;
  lng: number | null;
  timings: string;
  description: string;
  photos: string[];
  interior_photos?: string[];
  exterior_photos?: string[];
  photos_approved: boolean;
  wifi_available: AmenityState;
  wifi_mbps: number | null;
  wifi_password?: string;
  charging_sockets: AmenityState;
  sockets_count: number | null;
  sockets_claimed: boolean;
  comfortable_seating: AmenityState;
  seating_info?: string;
  ambience?: string;
  outdoor_seating?: AmenityState;
  family_friendly?: AmenityState;
  suitable_for_studying: AmenityState;
  suitable_for_working: AmenityState;
  noise_level: 1 | 2 | 3 | 4 | 5 | null;
  avg_cost_per_person: number | null;
  price_range: string;
  coffee_price: string | null;
  tea_price: string | null;
  snacks_price: string | null;
  desserts_price?: string | null;
  meals_price: string | null;
  popular_items: string[];
  rating: number | null;
  rating_count: number | null;
  min_spend: string | null;
  laptop_friendly: boolean;
  time_limit: string | null;
  modes: CafeMode[];
  facilities: string[];
  offers: string[];
  subscriber_benefits?: string[];
  menu_services: MenuServiceItem[];
  menu_items?: MenuItemRecord[];
  best_for: string[];
  verdict: string;
  avoid_if: string | null;
  student_discount: string | null;
  verified: boolean;
  featured: boolean;
  published: boolean;
  display_order: number;
  last_verified_date: string | null;
  claims: string[];
  source_name: string;
  source_url: string;
  source_type?: CafeSourceType;
  owner_verified?: boolean;
  claimed_by_owner_id?: number | null;
  data_source_notes?: string;
  review_summary?: CafeReviewSummary;
  merged_into_id?: string | null;
  opening_hours_list?: string[];
  price_level_label?: string;
  isLiveGooglePlace?: boolean;
  sample: boolean;
  access_rule?: CafeAccessRule;
  allowed_plan_ids?: string[];
  locked_sections_override?: Partial<Record<AccessSectionKey, SectionOverrideMode>>;
  access?: CafeAccessInfo;
  created_at?: number;
  updated_at?: number;
}

export interface CommunityCorrectionRecord {
  id: number;
  cafe_key: string;
  cafe_name: string;
  issue_type: string;
  details: string;
  suggested_value: string;
  reporter_name: string;
  reporter_email: string;
  status: 'pending' | 'approved' | 'rejected' | 'resolved';
  admin_note: string;
  created_at: number;
  updated_at?: number;
}

export interface ExplorerAchievementStatus {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlocked_at: number | null;
  progress: number;
  target: number;
}

export interface PlacesApiUsageSummary {
  has_server_key: boolean;
  total_calls: number;
  calls_24h: number;
  cache_hits_24h: number;
  errors_24h: number;
  last_error: string;
  recent_logs: Array<{
    id: number;
    endpoint: string;
    query_text: string;
    status_code: number;
    cached: boolean;
    result_count: number;
    error_message: string;
    created_at: number;
  }>;
}

export type HomepageSectionKey =
  | 'hero'
  | 'announcements'
  | 'locations'
  | 'experience'
  | 'services'
  | 'offers'
  | 'testimonials'
  | 'contact_cta';

export interface HomepageSectionConfig {
  key: HomepageSectionKey;
  label: string;
  visible: boolean;
  order: number;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  detail: string;
  badge: string;
  link: string;
  active: boolean;
}

export interface ServiceItem {
  title: string;
  description: string;
  highlight: string;
}

export interface FacilityItem {
  name: string;
  detail: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface EditorialGalleryItem {
  url: string;
  alt: string;
  caption: string;
}

export interface SiteSettings {
  brand_name: string;
  brand_tagline: string;
  logo_url: string;
  favicon_url: string;
  accent_color: string;
  business_legal_name: string;
  business_city: string;
  business_address: string;
  footer_copyright: string;
  analytics_id: string;

  contact_email: string;
  contact_phone: string;
  whatsapp_number: string;
  whatsapp_display: string;
  instagram_url: string;
  instagram_handle: string;
  twitter_url: string;
  linkedin_url: string;

  hero_kicker: string;
  hero_tagline: string;
  hero_subtitle: string;
  hero_image_url: string;
  hero_bg_image_url: string;
  hero_cta_primary_label: string;
  hero_cta_primary_link: string;
  hero_cta_secondary_label: string;
  hero_cta_secondary_link: string;
  hero_cta_tertiary_label: string;
  hero_cta_tertiary_link: string;

  homepage_sections: HomepageSectionConfig[];

  banner_enabled: boolean;
  banner_text: string;
  banner_cta_label: string;
  banner_link: string;
  banner_start_at?: string;
  banner_end_at?: string;
  cafe_of_the_day_slug?: string;
  announcements: AnnouncementItem[];

  pricing_headline?: string;
  pricing_subtitle?: string;

  about_heading: string;
  about_lead: string;
  about_story: string;
  about_image_url: string;
  services_heading: string;
  services_subtitle: string;
  services_image_url: string;
  services_items: ServiceItem[];
  facilities_items: FacilityItem[];
  faqs_items: FaqItem[];
  contact_heading: string;
  contact_subtitle: string;
  contact_hours: string;
  contact_map_url: string;
  editorial_gallery: EditorialGalleryItem[];

  seo_home_title: string;
  seo_home_description: string;
  seo_locations_title: string;
  seo_locations_description: string;
  seo_about_title: string;
  seo_about_description: string;
  seo_contact_title: string;
  seo_contact_description: string;
  seo_og_image: string;
  seo_allow_indexing: boolean;
  google_site_verification?: string;

  currency_code: string;
  currency_symbol: string;
  bookings_enabled: boolean;
  booking_lead_hours: number;
  booking_max_guests: number;
  booking_policy_note: string;
  notify_new_booking: boolean;
  notify_new_customer: boolean;
  notify_new_payment: boolean;
  notify_new_suggestion: boolean;
  notification_email: string;
  access_control?: AccessControlSettings;
  feature_flags?: FeatureFlags;
  scoring_config?: ScoringConfig;
}

export interface NavigationItem {
  id: number;
  location: 'header' | 'footer';
  label: string;
  url: string;
  sort_order: number;
  visible: boolean;
  is_external: boolean;
}

export interface TestimonialItem {
  id: number;
  author_name: string;
  author_role: string;
  branch_name: string;
  quote: string;
  verified_visit_date: string;
  published: boolean;
  created_at: number;
}

export interface MediaAsset {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  alt_text: string;
  description: string;
  category: string;
  created_at: number;
}

export interface CafeReviewRecord {
  id: number;
  cafe_id: string;
  cafe_key: string;
  cafe_name: string;
  user_id: number;
  author_name: string;
  rating: number;
  visit_purpose: string;
  wifi_confirmed: AmenityState;
  sockets_confirmed: AmenityState;
  noise_observed: number | null;
  review_text: string;
  helpful_count: number;
  moderation_status: 'pending' | 'approved' | 'rejected';
  created_at: number;
  updated_at: number;
}

export interface CommunityContributionRecord {
  id: number;
  cafe_id: string;
  cafe_key: string;
  cafe_name: string;
  user_id: number;
  contributor_name: string;
  contribution_type: 'photo' | 'menu_price' | 'facility_update';
  payload: Record<string, unknown>;
  photo_url: string;
  points_awarded: number;
  moderation_status: 'pending' | 'approved' | 'rejected';
  reviewer_note: string;
  created_at: number;
  updated_at: number;
}

export interface UserPreferencesRecord {
  user_id: number;
  favourite_areas: string[];
  favourite_categories: string[];
  preferred_max_budget: number | null;
  personalisation_enabled: boolean;
  public_profile_enabled: boolean;
  save_visit_history: boolean;
  updated_at: number;
}

export interface UserNotificationRecord {
  id: number;
  user_id: number;
  cafe_key: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: number;
}

export interface VisitChecklistRecord {
  cafe_key: string;
  items: {
    check_hours: boolean;
    check_menu_budget: boolean;
    check_wifi_sockets: boolean;
    save_directions: boolean;
  };
  notes: string;
  feedback_submitted: boolean;
  visited_at: number | null;
  updated_at: number;
}

export interface CafeClaimRequestRecord {
  id: number;
  cafe_id: string;
  cafe_name: string;
  user_id: number;
  owner_name: string;
  phone: string;
  email: string;
  verification_proof: string;
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string;
  created_at: number;
  reviewed_at: number | null;
}

export interface OwnerChangeRequestRecord {
  id: number;
  cafe_id: string;
  cafe_name?: string;
  user_id: number;
  change_type: 'cafe_info' | 'menu_update' | 'offer' | 'photo';
  payload: Record<string, unknown>;
  summary: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string;
  created_at: number;
  reviewed_at: number | null;
}

export interface CafePromotionRecord {
  id: number;
  cafe_id: string;
  cafe_name: string;
  owner_user_id: number;
  title: string;
  badge_label: string;
  placement: 'homepage' | 'category' | 'city';
  area: string;
  budget_inr: number;
  starts_at: number;
  ends_at: number;
  status: 'pending' | 'active' | 'paused' | 'ended' | 'rejected';
  created_at: number;
}

export interface PublicBootstrapResponse {
  locations: LocationItem[];
  settings: SiteSettings;
  navigation: NavigationItem[];
  testimonials: TestimonialItem[];
  media: MediaAsset[];
  active_promotions?: CafePromotionRecord[];
}

export type BengaluruRegionName =
  | 'North Bengaluru'
  | 'South Bengaluru'
  | 'East Bengaluru'
  | 'West Bengaluru'
  | 'Central Bengaluru'
  | 'Outer Bengaluru';

export type DiscoveryLocalityStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed';

export interface LocalitySubzoneDef {
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export interface LocalityRecord {
  id: number;
  slug: string;
  name: string;
  region: BengaluruRegionName;
  city: string;
  alt_spellings: string[];
  local_names: string[];
  keywords: string[];
  lat: number;
  lng: number;
  radius_meters: number;
  subzones: LocalitySubzoneDef[];
  active: boolean;
  admin_approved: boolean;
  discovery_status: DiscoveryLocalityStatus;
  last_discovery_at: number | null;
  discovery_progress: number;
  categories_completed: string[];
  categories_failed: string[];
  discovered_count: number;
  unique_place_count: number;
  duplicate_count: number;
  coverage_notes: string;
  last_error: string;
  retry_count: number;
  next_retry_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface LocalitySuggestionRecord {
  id: number;
  name: string;
  region: BengaluruRegionName;
  alt_spellings: string[];
  notes: string;
  suggested_by_email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: number;
  reviewed_at: number | null;
}

export interface DiscoveryPlaceRefRecord {
  place_id: string;
  primary_locality_id: number | null;
  locality_name?: string;
  locality_slug?: string;
  region?: BengaluruRegionName;
  secondary_locality_ids: number[];
  cafedesk_category: string;
  primary_type: string;
  types: string[];
  source_query_tags: string[];
  discovered_categories: string[];
  match_confidence: number;
  duplicate_review_status: 'clean' | 'needs_review' | 'merged' | 'distinct_branch';
  possible_duplicate_of_cafe_id: string;
  possible_duplicate_of_place_id: string;
  promoted_cafe_id: string;
  discovery_count: number;
  first_discovered_at: number;
  last_seen_at: number;
  active: boolean;
  // Ephemeral hydrated display fields from places_transient_cache (< 24h TTL)
  cached_display?: {
    name: string;
    address: string;
    areaLabel: string;
    lat: number;
    lng: number;
    rating: number | null;
    ratingCount: number | null;
    openingHours: string[];
    priceLevelLabel: string;
    websiteUrl: string;
    phone: string;
    viewMapUrl: string;
    mapLink: string;
    photos: string[];
    cachedAt: number;
  } | null;
}

export interface DiscoverySettingsRecord {
  scheduler_enabled: boolean;
  paused: boolean;
  interval_minutes: number;
  daily_call_cap: number;
  max_calls_per_run: number;
  pages_per_query_cap: number;
  stale_after_days: number;
  include_nearby_distance_sweep: boolean;
  updated_at: number;
}

export interface DiscoveryJobRecord {
  id: number;
  scope: 'locality' | 'region' | 'all' | 'retry_failed' | 'refresh' | 'scheduled';
  target_key: string;
  status: 'running' | 'completed' | 'paused' | 'failed' | 'budget_stopped';
  calls_made: number;
  cache_hits: number;
  places_seen: number;
  new_places: number;
  duplicates_flagged: number;
  failed_queries: number;
  estimated_cost_usd: number;
  error_summary: string;
  started_at: number;
  finished_at: number | null;
}

export interface DiscoveryJobLogRecord {
  id: number;
  job_id: number;
  locality_slug: string;
  query_label: string;
  endpoint: string;
  page_num: number;
  results_count: number;
  new_count: number;
  status_code: number;
  error_message: string;
  created_at: number;
}

export interface RegionCoverageStat {
  region: BengaluruRegionName;
  total_localities: number;
  active_localities: number;
  completed_localities: number;
  partial_localities: number;
  failed_localities: number;
  pending_localities: number;
  unique_places_indexed: number;
  curated_cafes_count: number;
  avg_progress: number;
}

export interface LocalityCoverageOverview {
  regions: RegionCoverageStat[];
  localities: LocalityRecord[];
  suggestions: LocalitySuggestionRecord[];
  settings: DiscoverySettingsRecord;
  recent_jobs: DiscoveryJobRecord[];
  recent_logs: DiscoveryJobLogRecord[];
  usage: {
    has_server_key: boolean;
    calls_24h: number;
    daily_call_cap: number;
    estimated_cost_24h_usd: number;
    transient_cache_entries: number;
    expired_cache_entries: number;
    total_indexed_refs: number;
    duplicates_needing_review: number;
    paused: boolean;
  };
  quality_report: {
    total_localities: number;
    fully_covered_count: number;
    partial_or_failed_count: number;
    unsearched_count: number;
    total_unique_place_refs: number;
    total_curated_cafes: number;
    category_breakdown: Array<{ category: string; count: number }>;
    incomplete_localities: Array<{
      slug: string;
      name: string;
      region: string;
      status: string;
      progress: number;
      failed_categories: string[];
      last_error: string;
    }>;
    honesty_note: string;
  };
}


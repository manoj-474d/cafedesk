import type { CafeMode } from '../config/constants';

export type DietaryType = 'veg' | 'non_veg' | 'vegan' | 'na';

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
  charging_sockets: AmenityState;
  sockets_count: number | null;
  sockets_claimed: boolean;
  comfortable_seating: AmenityState;
  seating_info?: string;
  ambience?: string;
  outdoor_seating?: AmenityState;
  suitable_for_studying: AmenityState;
  suitable_for_working: AmenityState;
  noise_level: 1 | 2 | 3 | 4 | 5 | null;
  avg_cost_per_person: number | null;
  price_range: string;
  coffee_price: string | null;
  tea_price: string | null;
  snacks_price: string | null;
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
  sample: boolean;
  created_at?: number;
  updated_at?: number;
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

export interface PublicBootstrapResponse {
  locations: LocationItem[];
  settings: SiteSettings;
  navigation: NavigationItem[];
  testimonials: TestimonialItem[];
  media: MediaAsset[];
}

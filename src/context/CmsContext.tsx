import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type {
  AmenityState,
  LocationItem,
  MediaAsset,
  NavigationItem,
  PublicBootstrapResponse,
  SiteSettings,
  TestimonialItem,
} from '../types/cms';
import { CAFES } from '../data/cafes';
import { SITE_CONFIG } from '../config/constants';

const FALLBACK_SETTINGS: SiteSettings = {
  brand_name: 'Cafe Desk',
  brand_tagline: 'Bengaluru Cafe Discovery Platform',
  logo_url: '',
  favicon_url: '',
  accent_color: '#B45309',
  business_legal_name: 'Cafe Desk · Bengaluru Cafe Discovery',
  business_city: 'Bengaluru',
  business_address: 'Bengaluru, Karnataka',
  footer_copyright: '© 2026 Cafe Desk. Bengaluru cafe discovery for coffee, study, and work.',
  analytics_id: '',
  contact_email: SITE_CONFIG.contactEmail,
  contact_phone: SITE_CONFIG.whatsappDisplay,
  whatsapp_number: SITE_CONFIG.whatsappNumber,
  whatsapp_display: SITE_CONFIG.whatsappDisplay,
  instagram_url: SITE_CONFIG.instagramUrl,
  instagram_handle: SITE_CONFIG.instagramHandle,
  twitter_url: 'https://x.com/cafedesk_space',
  linkedin_url: 'https://linkedin.com/company/cafedesk',
  hero_kicker: 'Bengaluru · Cafe & Workspace Discovery Platform',
  hero_tagline: 'Find Your Perfect Cafe in Bengaluru.',
  hero_subtitle:
    "Discover Bengaluru's cafes for affordable coffee, tea, study, casual meetings, and laptop work.",
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
  banner_text: 'Discover Bengaluru cafes by budget (₹50–₹500+), Wi-Fi, sockets, food & live distance.',
  banner_cta_label: 'Open Cafe Map',
  banner_link: '/locations?view=map',
  announcements: [],
  about_heading: 'Built for people who choose a cafe by its coffee, budget, and focus.',
  about_lead:
    'Cafe Desk began in Bengaluru with a simple goal: help students, freelancers, and remote workers discover nearby cafes using practical details that standard food apps miss.',
  about_story: '',
  about_image_url: '/src/assets/images/editorial_team_meeting_1794976060148.jpg',
  services_heading: 'Everything you check before visiting or bringing your laptop.',
  services_subtitle:
    'Whether you need affordable tea and coffee under ₹200, reachable wall sockets for a workday, or nearby cafes in your neighborhood.',
  services_image_url: '/src/assets/images/editorial_workspace_lounge_1794976060874.jpg',
  services_items: [],
  facilities_items: [],
  faqs_items: [],
  contact_heading: 'Questions, cafe suggestions, or data updates.',
  contact_subtitle:
    'Share feedback, suggest a great Bengaluru cafe, or reach our editorial team via email or WhatsApp.',
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
    'Discover nearby Bengaluru cafes for coffee, tea, studying, casual meetings, and remote working. Compare budgets (₹50–₹500+), Wi-Fi, sockets, noise, and directions.',
  seo_locations_title: 'Explore Bengaluru Cafes & Interactive Map | Cafe Desk',
  seo_locations_description:
    'Find cafes near you across Indiranagar, Koramangala, Jayanagar, Banashankari, Malleshwaram, Yelahanka & more. Filter by budget, food, Wi-Fi, sockets, and quietness.',
  seo_about_title: 'About Cafe Desk & Discovery Standards',
  seo_about_description:
    'Learn how Cafe Desk helps Bengaluru students and remote workers find reliable cafes with honest workspace and pricing info.',
  seo_contact_title: 'Contact & Cafe Updates – Cafe Desk',
  seo_contact_description: 'Reach the Cafe Desk team or suggest cafe updates in Bengaluru.',
  seo_og_image: '/src/assets/images/hero_cafedesk_interior_1794976059561.jpg',
  seo_allow_indexing: true,
};

const FALLBACK_NAV: NavigationItem[] = [
  { id: 1, location: 'header', label: 'Explore Cafes', url: '/locations', sort_order: 1, visible: true, is_external: false },
  { id: 2, location: 'header', label: 'Cafe Map', url: '/locations?view=map', sort_order: 2, visible: true, is_external: false },
  { id: 3, location: 'header', label: 'About', url: '/about', sort_order: 3, visible: true, is_external: false },
  { id: 4, location: 'header', label: 'Contact', url: '/contact', sort_order: 4, visible: true, is_external: false },
];

function derivePriceRange(avgCost: number | null): string {
  if (avgCost === null) return '';
  if (avgCost <= 100) return '₹50–₹100';
  if (avgCost <= 200) return '₹100–₹200';
  if (avgCost <= 300) return '₹200–₹300';
  if (avgCost <= 500) return '₹300–₹500';
  return '₹500+';
}

const FALLBACK_LOCATIONS: LocationItem[] = CAFES.map((c, idx) => {
  const chargingSockets: AmenityState =
    (c.sockets_count !== null && c.sockets_count > 0) || c.sockets_claimed ? 'yes' : 'unknown';
  const facilitiesList: string[] = [];
  if (c.wifi_available === 'yes') facilitiesList.push('Customer Wi-Fi available');
  if (c.sockets_claimed) facilitiesList.push('Power sockets reported by public sources');
  if (c.laptop_friendly) facilitiesList.push('Laptop-friendly seating');
  if (c.modes.includes('budget')) facilitiesList.push('Budget-friendly cafe menu');

  return {
    ...c,
    slug: c.id,
    city: 'Bengaluru',
    phone: '',
    place_id: '',
    lat: null,
    lng: null,
    verdict: c.claims[0] ?? 'Bengaluru cafe listed from official website & public sources.',
    description: c.claims.join(' · '),
    photos: c.photos,
    photos_approved: c.photos.length > 0,
    wifi_available: c.wifi_available,
    charging_sockets: chargingSockets,
    comfortable_seating: c.laptop_friendly || c.modes.includes('plan') ? 'yes' : 'unknown',
    suitable_for_studying:
      c.modes.includes('calm') || c.best_for.some((b) => /study|read|deep/i.test(b))
        ? 'yes'
        : 'unknown',
    suitable_for_working: c.modes.includes('work') || c.laptop_friendly ? 'yes' : 'unknown',
    price_range: derivePriceRange(c.avg_cost_per_person),
    coffee_price: c.coffee_price ?? null,
    tea_price: c.tea_price ?? null,
    snacks_price: c.snacks_price ?? null,
    meals_price: c.meals_price ?? null,
    rating: null,
    rating_count: null,
    facilities: facilitiesList,
    offers: [],
    menu_services: [],
    published: true,
    display_order: idx + 1,
    sample: false,
  };
});

interface CmsContextValue {
  locations: LocationItem[];
  settings: SiteSettings;
  navigation: NavigationItem[];
  testimonials: TestimonialItem[];
  media: MediaAsset[];
  loading: boolean;
  refreshCms: () => Promise<void>;
}

const CmsContext = createContext<CmsContextValue>({
  locations: FALLBACK_LOCATIONS,
  settings: FALLBACK_SETTINGS,
  navigation: FALLBACK_NAV,
  testimonials: [],
  media: [],
  loading: true,
  refreshCms: async () => {},
});

export function CmsProvider({ children }: { children: React.ReactNode }) {
  const [locations, setLocations] = useState<LocationItem[]>(FALLBACK_LOCATIONS);
  const [settings, setSettings] = useState<SiteSettings>(FALLBACK_SETTINGS);
  const [navigation, setNavigation] = useState<NavigationItem[]>(FALLBACK_NAV);
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshCms = useCallback(async () => {
    try {
      const res = await fetch('/api/public/bootstrap', { credentials: 'include' });
      if (!res.ok) return;
      const data = (await res.json()) as PublicBootstrapResponse;
      if (Array.isArray(data.locations)) setLocations(data.locations);
      if (data.settings) setSettings({ ...FALLBACK_SETTINGS, ...data.settings });
      if (Array.isArray(data.navigation)) setNavigation(data.navigation);
      if (Array.isArray(data.testimonials)) setTestimonials(data.testimonials);
      if (Array.isArray(data.media)) setMedia(data.media);
    } catch {
      // Keep fallback data on transient network errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCms();
    void fetch('/api/analytics/visit', { method: 'POST', credentials: 'include' }).catch(() => {});
  }, [refreshCms]);

  useEffect(() => {
    if (settings.accent_color) {
      document.documentElement.style.setProperty('--brand-accent', settings.accent_color);
    }
    if (settings.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = settings.favicon_url;
    }
  }, [settings.accent_color, settings.favicon_url]);

  return (
    <CmsContext.Provider
      value={{
        locations,
        settings,
        navigation,
        testimonials,
        media,
        loading,
        refreshCms,
      }}
    >
      {children}
    </CmsContext.Provider>
  );
}

export function useCms() {
  return useContext(CmsContext);
}

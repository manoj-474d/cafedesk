import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Coffee,
  Compass,
  IndianRupee,
  Laptop,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Plug,
  PlusCircle,
  Quote,
  Search,
  SlidersHorizontal,
  Sparkles,
  VolumeX,
  Wifi,
} from 'lucide-react';
import {
  BENGALURU_AREAS,
  BROWSING_MODES,
  HOME_QUICK_FILTERS,
} from '../config/constants';
import { useCms } from '../context/CmsContext';
import { useAuth } from '../context/AuthContext';
import { useDiscovery } from '../context/DiscoveryContext';
import { buildWhatsAppUrl, getCafeDetailRoute, useDocumentMeta } from '../utils/cafeHelpers';
import {
  CURATED_COLLECTIONS,
  isGoodForDates,
  isHiddenGem,
  isRecentlyAddedCafe,
  isTrendingCafe,
} from '../utils/cafeRecommendations';
import { CafeAutocompleteSearch } from '../components/CafeAutocompleteSearch';
import { InteractiveCafeMap } from '../components/InteractiveCafeMap';
import { LocationCard } from '../components/LocationCard';
import { ResilientPhoto } from '../components/ResilientPhoto';
import type { HomepageSectionKey } from '../types/cms';

export function HomePage() {
  const { locations, settings, testimonials } = useCms();
  const { authenticated, hasPlus, user } = useAuth();
  const {
    userLocation,
    requestUserLocation,
    getEffectiveLocation,
    nearbyPlaces,
    nearbyLoading,
    discoverCafesByAreaText,
  } = useDiscovery();
  const navigate = useNavigate();

  useDocumentMeta(settings.seo_home_title, settings.seo_home_description, {
    ogImage: settings.seo_og_image,
    allowIndexing: settings.seo_allow_indexing,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchArea, setSearchArea] = useState('');
  const [searchMode, setSearchMode] = useState('');
  const [activeAreaTab, setActiveAreaTab] = useState('All');
  const [spotlightTab, setSpotlightTab] = useState<
    'trending' | 'hidden-gems' | 'laptop' | 'study' | 'budget' | 'coffee' | 'dates' | 'recent'
  >('trending');
  const [mapFocusCenter, setMapFocusCenter] = useState<{ lat: number; lng: number } | null>(null);

  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterState, setNewsletterState] = useState<'idle' | 'submitting' | 'sent' | 'error'>(
    'idle'
  );
  const [newsletterMsg, setNewsletterMsg] = useState('');

  const effectiveLocations = useMemo(
    () => locations.map((loc) => getEffectiveLocation(loc)),
    [locations, getEffectiveLocation]
  );

  const filteredHomeLocations = useMemo(() => {
    const pool =
      activeAreaTab === 'All'
        ? effectiveLocations
        : effectiveLocations.filter((l) =>
            `${l.area} ${l.address}`.toLowerCase().includes(activeAreaTab.toLowerCase())
          );

    const sorted = [...pool].sort((a, b) => {
      if (userLocation) {
        const da = a.distanceKm ?? Number.MAX_SAFE_INTEGER;
        const db = b.distanceKm ?? Number.MAX_SAFE_INTEGER;
        if (da !== db) return da - db;
      }
      return Number(b.featured) - Number(a.featured);
    });
    return sorted.slice(0, 6);
  }, [effectiveLocations, activeAreaTab, userLocation]);

  const spotlightCafes = useMemo(() => {
    const filtered = effectiveLocations.filter((l) => {
      switch (spotlightTab) {
        case 'trending':
          return isTrendingCafe(l);
        case 'hidden-gems':
          return isHiddenGem(l);
        case 'laptop':
          return l.laptop_friendly;
        case 'study':
          return l.suitable_for_studying === 'yes' || l.modes.includes('calm');
        case 'budget':
          return (
            l.modes.includes('budget') ||
            (l.avg_cost_per_person !== null && l.avg_cost_per_person <= 220)
          );
        case 'coffee':
          return Boolean(
            l.coffee_price ||
              /coffee|espresso|latte|kaapi|brew/i.test(
                `${l.verdict} ${l.popular_items.join(' ')}`
              )
          );
        case 'dates':
          return isGoodForDates(l);
        case 'recent':
          return isRecentlyAddedCafe(l);
        default:
          return true;
      }
    });
    return (filtered.length > 0 ? filtered : effectiveLocations).slice(0, 3);
  }, [effectiveLocations, spotlightTab]);

  const sponsoredCafes = useMemo(
    () => effectiveLocations.filter((l) => l.featured).slice(0, 3),
    [effectiveLocations]
  );

  const activeAnnouncements = settings.announcements.filter((a) => a.active);

  const orderedSections = useMemo(() => {
    return [...settings.homepage_sections]
      .filter((s) => s.visible)
      .sort((a, b) => a.order - b.order);
  }, [settings.homepage_sections]);

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
      params.set('live', '1');
    }
    if (searchArea) params.set('area', searchArea);
    if (searchMode) params.set('mode', searchMode);
    const qs = params.toString();
    navigate(qs ? `/locations?${qs}` : '/locations');
  };

  const handleFindNearMe = async () => {
    await requestUserLocation();
    navigate('/locations?nearby=1');
  };

  const handleAreaSelect = (areaName: string) => {
    setActiveAreaTab(areaName);
    if (areaName === 'All') {
      setMapFocusCenter(null);
      return;
    }
    const matchWithCoords = effectiveLocations.find(
      (l) =>
        l.area.toLowerCase().includes(areaName.toLowerCase()) &&
        l.lat !== null &&
        l.lng !== null
    );
    if (matchWithCoords && matchWithCoords.lat !== null && matchWithCoords.lng !== null) {
      setMapFocusCenter({ lat: matchWithCoords.lat, lng: matchWithCoords.lng });
    }
  };

  const handleDiscoverAreaOnMaps = async (areaName: string) => {
    const center = await discoverCafesByAreaText(areaName);
    if (center) {
      setMapFocusCenter(center);
    }
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newsletterEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setNewsletterState('error');
      setNewsletterMsg('Please enter a valid email address.');
      return;
    }

    setNewsletterState('submitting');
    setNewsletterMsg('');
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'newsletter',
          contactInfo: trimmed,
          notes: 'Weekly Bengaluru cafe dispatch opt-in from homepage',
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setNewsletterState('error');
        setNewsletterMsg(data.error || 'Could not save subscription.');
        return;
      }
      setNewsletterState('sent');
      setNewsletterMsg('Thank you — you are subscribed to our weekly Bengaluru cafe updates.');
      setNewsletterEmail('');
    } catch {
      setNewsletterState('error');
      setNewsletterMsg('Network error. Please try again.');
    }
  };

  const waConciergeUrl = buildWhatsAppUrl(
    `Hi ${settings.brand_name}! I'd like help finding a work or study cafe in Bengaluru.`,
    settings.whatsapp_number
  );

  const renderSection = (key: HomepageSectionKey) => {
    switch (key) {
      case 'hero': {
        const heroHeading =
          !settings.hero_tagline || settings.hero_tagline === 'Find Your Perfect Cafe in Bengaluru.'
            ? 'Find Your Perfect Workspace.'
            : settings.hero_tagline;
        const heroSub =
          !settings.hero_subtitle ||
          settings.hero_subtitle.startsWith("Discover Bengaluru's cafes for affordable coffee")
            ? 'Discover cafes to work, study, meet and relax.'
            : settings.hero_subtitle;

        return (
          <section
            key="hero"
            className="relative bg-[#1c1613] text-[#faf7f2] overflow-hidden"
          >
            {settings.hero_image_url && (
              <div className="absolute inset-0 pointer-events-none">
                <img
                  src={settings.hero_image_url}
                  alt=""
                  className="w-full h-full object-cover opacity-25"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#1c1613]/85 via-[#1c1613]/80 to-[#1c1613]" />
              </div>
            )}

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-10 sm:pt-14 sm:pb-14">
              <div className="max-w-3xl space-y-4 sm:space-y-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f59e0b]">
                  {settings.hero_kicker || 'Bengaluru Work & Study Cafes'}
                </p>

                <h1 className="font-serif-display text-3xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.08] tracking-tight text-white">
                  {heroHeading}
                </h1>

                <p className="text-base sm:text-lg text-[#d6cbba] leading-relaxed max-w-xl">
                  {heroSub}
                </p>

                {/* Primary Action Buttons */}
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleFindNearMe}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
                  >
                    <LocateFixed className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{settings.hero_cta_secondary_label || 'Find Near Me'}</span>
                  </button>

                  <Link
                    to={settings.hero_cta_primary_link || '/locations'}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-white hover:bg-[#faf7f2] text-[#1c1613] text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
                  >
                    <span>{settings.hero_cta_primary_label || 'Explore Cafes'}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </Link>

                  <Link
                    to="/finder"
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-[#f59e0b] shrink-0" aria-hidden="true" />
                    <span>Cafe Finder</span>
                  </Link>

                  <Link
                    to={settings.hero_cta_tertiary_link || '/locations?view=map'}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    <MapIcon className="w-4 h-4 text-[#f59e0b] shrink-0" aria-hidden="true" />
                    <span>{settings.hero_cta_tertiary_label || 'Explore Map'}</span>
                  </Link>
                </div>
              </div>

              {/* Integrated Warm Search Card */}
              <div className="mt-7 sm:mt-9 rounded-2xl bg-white text-[#1c1613] border border-[#e6ddd0] shadow-xl p-4 sm:p-6 space-y-4">
                <form
                  onSubmit={handleQuickSearch}
                  aria-label="Quick cafe discovery search"
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                >
                  <div className="sm:col-span-5">
                    <label
                      htmlFor="home-search-q"
                      className="block text-xs font-medium text-[#5c4e45] mb-1.5"
                    >
                      Search cafe, area, or coffee spot
                    </label>
                    <CafeAutocompleteSearch
                      id="home-search-q"
                      value={searchQuery}
                      onChange={setSearchQuery}
                      onSubmitQuery={(q) =>
                        navigate(`/locations?q=${encodeURIComponent(q)}&live=1`)
                      }
                      placeholder='Try "Third Wave", "Indiranagar", "study"...'
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:col-span-5 gap-3">
                    <div>
                      <label
                        htmlFor="home-search-area"
                        className="block text-xs font-medium text-[#5c4e45] mb-1.5"
                      >
                        Area
                      </label>
                      <select
                        id="home-search-area"
                        value={searchArea}
                        onChange={(e) => setSearchArea(e.target.value)}
                        className="w-full h-12 px-3 rounded-xl bg-[#faf7f2] border border-[#d6cbba] text-xs sm:text-sm font-medium text-[#1c1613]"
                      >
                        <option value="">All Bengaluru</option>
                        {BENGALURU_AREAS.map((areaName) => (
                          <option key={areaName} value={areaName}>
                            {areaName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="home-search-mode"
                        className="block text-xs font-medium text-[#5c4e45] mb-1.5"
                      >
                        Purpose
                      </label>
                      <select
                        id="home-search-mode"
                        value={searchMode}
                        onChange={(e) => setSearchMode(e.target.value)}
                        className="w-full h-12 px-3 rounded-xl bg-[#faf7f2] border border-[#d6cbba] text-xs sm:text-sm font-medium text-[#1c1613]"
                      >
                        <option value="">All purposes</option>
                        {BROWSING_MODES.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full h-12 px-4 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Search</span>
                    </button>
                  </div>
                </form>

                {/* Quick Filter Chips */}
                <div className="pt-3 border-t border-[#e6ddd0] flex items-center gap-2 overflow-x-auto snap-x snap-mandatory no-scrollbar sm:flex-wrap pb-0.5">
                  <span className="text-xs font-medium text-[#5c4e45] shrink-0">
                    Quick filters:
                  </span>
                  {HOME_QUICK_FILTERS.map((qf) => {
                    const iconProps = {
                      className: 'w-3.5 h-3.5 text-[#b45309] shrink-0',
                      'aria-hidden': true as const,
                    };
                    const IconEl =
                      qf.id === 'coffee' ? (
                        <Coffee {...iconProps} />
                      ) : qf.id === 'wifi' ? (
                        <Wifi {...iconProps} />
                      ) : qf.id === 'work' ? (
                        <Laptop {...iconProps} />
                      ) : qf.id === 'sockets' ? (
                        <Plug {...iconProps} />
                      ) : qf.id === 'budget' ? (
                        <IndianRupee {...iconProps} />
                      ) : (
                        <VolumeX {...iconProps} />
                      );

                    return (
                      <Link
                        key={qf.id}
                        to={qf.to}
                        className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-full bg-[#faf7f2] hover:bg-[#fef3c7] border border-[#e6ddd0] text-xs font-medium text-[#1c1613] transition-colors shrink-0 snap-start"
                      >
                        {IconEl}
                        <span>{qf.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        );
      }

      case 'announcements':
        if (activeAnnouncements.length === 0) return null;
        return (
          <section
            key="announcements"
            aria-label="Announcements and updates"
            className="bg-[#f3ede3] border-b border-[#e6ddd0]"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeAnnouncements.map((ann) => (
                  <Link
                    key={ann.id}
                    to={ann.link || '/locations'}
                    className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-white border border-[#e6ddd0] hover:border-[#b45309]/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] text-[10px] font-semibold uppercase tracking-wider">
                        {ann.badge || 'Discovery Guide'}
                      </span>
                      <h2 className="font-serif-display text-lg font-bold text-[#1c1613]">
                        {ann.title}
                      </h2>
                      <p className="text-sm text-[#5c4e45]">{ann.detail}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#b45309] shrink-0 mt-1" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        );

      case 'locations':
        return (
          <div key="locations">
            {/* Instant Mood Discovery & Collections */}
            <section
              aria-labelledby="home-locations-heading"
              className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12"
            >
              {/* Compact Explore Cafe Option */}
              <div className="flex items-center justify-start">
                <Link
                  to="/locations"
                  className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-sm font-semibold transition-colors"
                >
                  <span>Explore Cafe</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>

              {/* Smart Discovery Tabs */}
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2.5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309] mb-1">
                      Instant Discovery Modes
                    </p>
                    <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#1c1613]">
                      Pick what fits your mood today
                    </h2>
                  </div>
                  <Link
                    to="/finder"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b45309] hover:underline self-start sm:self-auto"
                  >
                    <Compass className="w-4 h-4" aria-hidden="true" />
                    <span>Interactive Cafe Finder &rarr;</span>
                  </Link>
                </div>

                <div className="flex overflow-x-auto no-scrollbar gap-2 -mx-4 px-4 pb-1 md:mx-0 md:px-0 md:flex-wrap">
                  {[
                    { id: 'trending' as const, label: 'Trending' },
                    { id: 'hidden-gems' as const, label: 'Hidden Gems' },
                    { id: 'laptop' as const, label: 'Laptop-Friendly' },
                    { id: 'study' as const, label: 'Quiet Study' },
                    { id: 'budget' as const, label: 'Budget Under ₹200' },
                    { id: 'coffee' as const, label: 'Coffee & Tea Picks' },
                    { id: 'dates' as const, label: 'Meetings & Dates' },
                    { id: 'recent' as const, label: 'Recently Added' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSpotlightTab(tab.id)}
                      className={`min-h-[40px] px-4 py-2 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                        spotlightTab === tab.id
                          ? 'bg-[#1c1613] text-white border-[#1c1613]'
                          : 'bg-white text-[#5c4e45] border-[#e6ddd0] hover:border-[#b45309] hover:text-[#1c1613]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex overflow-x-auto snap-x snap-mandatory gap-5 -mx-4 px-4 pb-2 no-scrollbar md:mx-0 md:px-0 md:grid md:grid-cols-3 md:gap-6">
                  {spotlightCafes.map((loc) => (
                    <div
                      key={`spot-${loc.id}`}
                      className="min-w-[85vw] sm:min-w-[330px] md:min-w-0 snap-start flex flex-col"
                    >
                      <LocationCard location={loc} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Curated Bengaluru Collections */}
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309] mb-1">
                    Curated Collections
                  </p>
                  <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#1c1613]">
                    Editorial Bengaluru cafe trails
                  </h2>
                </div>
                <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 -mx-4 px-4 pb-2 no-scrollbar md:mx-0 md:px-0 md:grid md:grid-cols-2 lg:grid-cols-5 md:gap-4">
                  {CURATED_COLLECTIONS.map((col) => {
                    const count = effectiveLocations.filter(col.match).length;
                    return (
                      <div
                        key={col.id}
                        className="min-w-[74vw] sm:min-w-[240px] md:min-w-0 snap-start flex"
                      >
                        <Link
                          to={col.to}
                          className="w-full p-5 rounded-2xl bg-white border border-[#e6ddd0] hover:border-[#b45309]/50 shadow-xs flex flex-col justify-between space-y-4 transition-colors"
                        >
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1b4d3e]">
                              {col.areaLabel}
                            </span>
                            <h3 className="font-serif-display text-lg font-bold text-[#1c1613] leading-snug">
                              {col.title}
                            </h3>
                            <p className="text-xs text-[#5c4e45] leading-relaxed">
                              {col.subtitle}
                            </p>
                          </div>
                          <div className="pt-3 border-t border-[#e6ddd0] flex items-center justify-between text-xs font-semibold text-[#b45309]">
                            <span className="font-mono-data">{count} cafes</span>
                            <ArrowRight className="w-4 h-4" aria-hidden="true" />
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sponsored Partner Spotlight */}
              {sponsoredCafes.length > 0 && (
                <div className="p-5 sm:p-7 rounded-2xl bg-[#f3ede3] border border-[#e6ddd0] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#b45309] mb-1">
                        Sponsored · Partner Placement
                      </p>
                      <h2 className="font-serif-display text-xl sm:text-2xl font-bold text-[#1c1613]">
                        Featured partner cafes in Bengaluru
                      </h2>
                    </div>
                    <Link
                      to="/owners"
                      className="text-xs font-semibold text-[#b45309] hover:underline underline-offset-4"
                    >
                      Feature your cafe on Cafe Desk &rarr;
                    </Link>
                  </div>
                  <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 -mx-2 px-2 pb-1 no-scrollbar md:mx-0 md:px-0 md:grid md:grid-cols-3 md:gap-4">
                    {sponsoredCafes.map((sp) => (
                      <Link
                        key={`sp-${sp.id}`}
                        to={getCafeDetailRoute(sp.slug, authenticated)}
                        className="min-w-[78vw] sm:min-w-[280px] md:min-w-0 snap-start p-4 rounded-xl bg-white border border-[#e6ddd0] hover:border-[#b45309]/50 space-y-1.5 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-semibold text-[#b45309]">Sponsored</span>
                          <span className="font-medium text-[#5c4e45]">{sp.area}</span>
                        </div>
                        <p className="font-serif-display text-lg font-bold text-[#1c1613]">
                          {sp.name}
                        </p>
                        <p className="text-xs text-[#5c4e45] line-clamp-2">{sp.verdict}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Directory by Locality Section */}
            <section className="bg-[#f3ede3]/60 border-y border-[#e6ddd0]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className="space-y-2 max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
                      Bengaluru Cafe Directory
                    </p>
                    <h2
                      id="home-locations-heading"
                      className="font-serif-display text-3xl sm:text-4xl font-bold text-[#1c1613]"
                    >
                      Explore cafes by Bengaluru locality
                    </h2>
                    <p className="text-sm sm:text-base text-[#5c4e45]">
                      Browse affordable tea &amp; coffee shops, bakery cafes, and Wi-Fi work spots.
                      Compare food budgets, charging sockets, and official cafe links.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {hasPlus && user && (
                      <Link
                        to="/account"
                        className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-1.5 rounded-xl bg-white border border-[#e6ddd0] text-xs font-semibold text-[#1c1613] hover:border-[#b45309] whitespace-nowrap"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                        <span>For You ({user.name.split(' ')[0]})</span>
                      </Link>
                    )}
                    <Link
                      to="/locations"
                      className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
                    >
                      <span>Browse all {locations.length} cafes</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                {/* Neighbourhood Quick-Jump Bar */}
                <div className="flex overflow-x-auto no-scrollbar gap-2 -mx-4 px-4 pb-1 md:mx-0 md:px-0 md:flex-wrap">
                  {['All', ...BENGALURU_AREAS].map((areaName) => (
                    <button
                      key={areaName}
                      type="button"
                      onClick={() => handleAreaSelect(areaName)}
                      className={`min-h-[40px] px-4 py-2 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                        activeAreaTab === areaName
                          ? 'bg-[#1c1613] text-white border-[#1c1613]'
                          : 'bg-white text-[#5c4e45] border-[#e6ddd0] hover:border-[#b45309] hover:text-[#1c1613]'
                      }`}
                    >
                      {areaName === 'All' ? 'All Bengaluru' : areaName}
                    </button>
                  ))}
                </div>

                {filteredHomeLocations.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#e6ddd0] p-6 sm:p-8 text-center space-y-3">
                    <p className="text-base font-semibold text-[#1c1613]">
                      No curated listings yet in {activeAreaTab}
                    </p>
                    <p className="text-sm text-[#5c4e45]">
                      Search Google Maps live to discover cafes around {activeAreaTab}, or suggest
                      your favourite spot.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 pt-1">
                      <button
                        type="button"
                        disabled={nearbyLoading}
                        onClick={() => handleDiscoverAreaOnMaps(activeAreaTab)}
                        className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#1b4d3e] hover:bg-[#133a2e] text-white text-xs font-semibold transition-colors"
                      >
                        <MapPin className="w-4 h-4" aria-hidden="true" />
                        <span>
                          {nearbyLoading
                            ? 'Searching Google Maps...'
                            : `Discover Live Cafes in ${activeAreaTab}`}
                        </span>
                      </button>
                      <Link
                        to={`/submit?area=${encodeURIComponent(activeAreaTab)}`}
                        className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] text-[#1c1613] text-xs font-semibold"
                      >
                        <PlusCircle className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
                        <span>Suggest a {activeAreaTab} Cafe</span>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="flex overflow-x-auto snap-x snap-mandatory gap-5 -mx-4 px-4 pb-2 no-scrollbar md:mx-0 md:px-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6">
                    {filteredHomeLocations.map((loc) => (
                      <div
                        key={loc.id}
                        className="min-w-[85vw] sm:min-w-[330px] md:min-w-0 snap-start flex flex-col"
                      >
                        <LocationCard location={loc} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Interactive Bengaluru Map Section */}
                <div className="pt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-serif-display text-2xl font-bold text-[#1c1613]">
                      Interactive Bengaluru Cafe Map
                    </h3>
                    <Link
                      to="/locations?view=map"
                      className="text-xs font-semibold text-[#b45309] hover:underline underline-offset-4"
                    >
                      Open full map explorer &rarr;
                    </Link>
                  </div>
                  <InteractiveCafeMap
                    curatedLocations={effectiveLocations}
                    googleCafes={nearbyPlaces}
                    userLocation={userLocation}
                    focusCenter={mapFocusCenter}
                    selectedArea={activeAreaTab === 'All' ? '' : activeAreaTab}
                    onSelectArea={(val) => handleAreaSelect(val || 'All')}
                    onRequestNearMe={handleFindNearMe}
                    heightClassName="h-[380px]"
                  />
                </div>
              </div>
            </section>
          </div>
        );

      case 'experience':
        if (!settings.editorial_gallery || settings.editorial_gallery.length === 0) return null;
        return (
          <section
            key="experience"
            aria-labelledby="home-experience-heading"
            className="bg-[#faf7f2]"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 sm:mb-10">
                <div className="space-y-1.5 max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
                    Craft &amp; Atmosphere
                  </p>
                  <h2
                    id="home-experience-heading"
                    className="font-serif-display text-3xl sm:text-4xl font-bold text-[#1c1613]"
                  >
                    Specialty coffee meets quiet productivity
                  </h2>
                </div>
                <Link
                  to="/about"
                  className="text-sm font-semibold text-[#b45309] hover:underline underline-offset-4 whitespace-nowrap"
                >
                  About our directory &rarr;
                </Link>
              </div>

              <div className="flex overflow-x-auto snap-x snap-mandatory gap-5 -mx-4 px-4 pb-2 no-scrollbar md:mx-0 md:px-0 md:grid md:grid-cols-3 md:gap-6">
                {settings.editorial_gallery.map((item, idx) => (
                  <div
                    key={`${item.url}-${idx}`}
                    className="min-w-[82vw] sm:min-w-[300px] md:min-w-0 snap-start"
                  >
                    <figure className="bg-white rounded-2xl border border-[#e6ddd0] overflow-hidden shadow-xs">
                      <ResilientPhoto
                        src={item.url}
                        alt={item.alt}
                        className="w-full aspect-[4/3]"
                        imgClassName="w-full h-full object-cover"
                      />
                      {item.caption && (
                        <figcaption className="p-4 text-sm font-semibold text-[#1c1613] border-t border-[#e6ddd0]">
                          {item.caption}
                        </figcaption>
                      )}
                    </figure>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );

      case 'services':
        return (
          <section
            key="services"
            aria-labelledby="home-services-heading"
            className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
              <div className="lg:col-span-5">
                <ResilientPhoto
                  src={settings.services_image_url}
                  alt="Remote worker enjoying sunlit window desk with power outlets and specialty cold brew"
                  className="w-full h-full min-h-[300px] rounded-2xl border border-[#e6ddd0] shadow-xs"
                  imgClassName="w-full h-full object-cover"
                />
              </div>

              <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1b4d3e]">
                    Discovery Standards
                  </p>
                  <h2
                    id="home-services-heading"
                    className="font-serif-display text-3xl sm:text-4xl font-bold text-[#1c1613]"
                  >
                    {settings.services_heading}
                  </h2>
                  <p className="text-base text-[#5c4e45] leading-relaxed">
                    {settings.services_subtitle}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {settings.services_items.map((srv) => (
                    <div
                      key={srv.title}
                      className="p-5 rounded-2xl bg-white border border-[#e6ddd0] space-y-2 h-full"
                    >
                      <h3 className="font-serif-display text-lg font-bold text-[#1c1613]">
                        {srv.title}
                      </h3>
                      <p className="text-sm text-[#5c4e45] leading-relaxed">{srv.description}</p>
                      {srv.highlight && (
                        <p className="text-xs font-semibold text-[#1b4d3e] pt-1">
                          {srv.highlight}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {settings.facilities_items.length > 0 && (
                  <div className="pt-4 border-t border-[#e6ddd0] grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {settings.facilities_items.map((fac) => (
                      <div key={fac.name} className="flex items-start gap-2.5">
                        <CheckCircle2
                          className="w-4 h-4 text-[#1b4d3e] shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-sm font-semibold text-[#1c1613]">{fac.name}</p>
                          <p className="text-xs text-[#5c4e45]">{fac.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        );

      case 'offers':
        return (
          <section
            key="offers"
            aria-labelledby="home-offers-heading"
            className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12"
          >
            <div className="rounded-3xl bg-[#1c1613] text-[#faf7f2] p-6 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#f59e0b]">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Browse by Mood &amp; Membership</span>
                </div>
                <h2
                  id="home-offers-heading"
                  className="font-serif-display text-2xl sm:text-4xl font-bold text-white"
                >
                  Choose your ideal coffeehouse setting
                </h2>
                <p className="text-sm sm:text-base text-[#d6cbba] max-w-xl leading-relaxed">
                  Filter instantly for fast Wi-Fi work sessions, budget-friendly study coffee,
                  quiet reading corners, or unlock verified Wi-Fi credentials &amp; menu pricing.
                </p>
                <div className="pt-1">
                  <Link
                    to="/pricing"
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-sm font-semibold transition-colors"
                  >
                    <span>View Membership Plans</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BROWSING_MODES.map((m) => (
                  <Link
                    key={m.id}
                    to={`/locations?mode=${m.id}`}
                    className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 transition-colors space-y-1"
                  >
                    <p className="font-serif-display text-lg font-bold text-white">{m.title}</p>
                    <p className="text-xs text-[#d6cbba] leading-snug">{m.subtitle}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        );

      case 'testimonials':
        if (testimonials.length === 0) return null;
        return (
          <section
            key="testimonials"
            aria-labelledby="home-testimonials-heading"
            className="bg-[#f3ede3]/70 border-y border-[#e6ddd0]"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
              <div className="space-y-2 max-w-2xl mb-8 sm:mb-10">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
                  Community Notes
                </p>
                <h2
                  id="home-testimonials-heading"
                  className="font-serif-display text-2xl sm:text-4xl font-bold text-[#1c1613]"
                >
                  Stories from Bengaluru students &amp; remote workers
                </h2>
              </div>

              <div className="flex overflow-x-auto snap-x snap-mandatory gap-5 -mx-4 px-4 pb-2 no-scrollbar md:mx-0 md:px-0 md:grid md:grid-cols-3 md:gap-6">
                {testimonials.map((t) => (
                  <div
                    key={t.id}
                    className="min-w-[82vw] sm:min-w-[300px] md:min-w-0 snap-start flex"
                  >
                    <blockquote className="w-full p-5 sm:p-6 rounded-2xl bg-white border border-[#e6ddd0] flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <Quote className="w-5 h-5 text-[#b45309]" aria-hidden="true" />
                        <p className="text-sm text-[#1c1613] leading-relaxed">{t.quote}</p>
                      </div>
                      <footer className="pt-3 border-t border-[#e6ddd0] text-xs">
                        <p className="font-semibold text-[#1c1613]">{t.author_name}</p>
                        <p className="text-[#5c4e45]">
                          {[t.author_role, t.branch_name, t.verified_visit_date]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </footer>
                    </blockquote>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );

      case 'contact_cta':
        return (
          <section
            key="contact_cta"
            aria-labelledby="home-contact-cta"
            className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">
              <div className="lg:col-span-6 p-7 sm:p-10 rounded-2xl bg-[#f3ede3] border border-[#e6ddd0] flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1b4d3e]">
                    Community Directory
                  </p>
                  <h2
                    id="home-contact-cta"
                    className="font-serif-display text-2xl sm:text-3xl font-bold text-[#1c1613]"
                  >
                    Know a Great Bengaluru Work or Study Cafe?
                  </h2>
                  <p className="text-sm sm:text-base text-[#5c4e45] leading-relaxed">
                    Help fellow students and remote workers by sharing updated Wi-Fi details, socket
                    availability, or beverage pricing from your favourite neighbourhood cafe.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/submit"
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-sm font-semibold transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" aria-hidden="true" />
                    <span>Suggest or Update a Cafe</span>
                  </Link>
                  <Link
                    to="/locations?view=map"
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-white border border-[#e6ddd0] text-[#1c1613] text-sm font-semibold hover:border-[#b45309] transition-colors"
                  >
                    <MapIcon className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
                    <span>Explore Interactive Map</span>
                  </Link>
                  <a
                    href={waConciergeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-white border border-[#e6ddd0] text-[#1c1613] text-sm font-semibold hover:border-[#1b4d3e] transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
                    <span>WhatsApp Us</span>
                  </a>
                </div>
              </div>

              <div className="lg:col-span-6 p-7 sm:p-10 rounded-2xl bg-white border border-[#e6ddd0] flex flex-col justify-between space-y-6">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
                    Weekly Cafe Dispatch
                  </p>
                  <h3 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#1c1613]">
                    Receive newly discovered cafes &amp; student perks
                  </h3>
                  <p className="text-sm text-[#5c4e45]">
                    One curated Bengaluru email whenever new work-ready cafes or menu guides are
                    published.
                  </p>
                </div>

                {newsletterState === 'sent' ? (
                  <div
                    role="status"
                    className="p-4 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-sm font-medium text-[#1b4d3e]"
                  >
                    {newsletterMsg}
                  </div>
                ) : (
                  <form onSubmit={handleNewsletterSubmit} noValidate className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <label htmlFor="home-newsletter-email" className="sr-only">
                        Email address
                      </label>
                      <input
                        id="home-newsletter-email"
                        type="email"
                        required
                        value={newsletterEmail}
                        onChange={(e) => setNewsletterEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="flex-1 h-12 px-4 rounded-xl bg-[#faf7f2] border border-[#d6cbba] text-sm text-[#1c1613]"
                      />
                      <button
                        type="submit"
                        disabled={newsletterState === 'submitting'}
                        className="h-12 px-6 rounded-xl bg-[#1c1613] hover:bg-[#b45309] disabled:opacity-60 text-white text-sm font-semibold whitespace-nowrap transition-colors"
                      >
                        {newsletterState === 'submitting' ? 'Saving...' : 'Subscribe'}
                      </button>
                    </div>
                    {newsletterState === 'error' && newsletterMsg && (
                      <p role="alert" className="text-xs font-medium text-[#b91c1c]">
                        {newsletterMsg}
                      </p>
                    )}
                  </form>
                )}
              </div>
            </div>
          </section>
        );
    }
  };

  return <div>{orderedSections.map((section) => renderSection(section.key))}</div>;
}

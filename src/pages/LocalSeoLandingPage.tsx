import React, { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  HelpCircle,
  IndianRupee,
  MapPin,
  PlusCircle,
  Sparkles,
  Wifi,
} from 'lucide-react';
import {
  filterCafesForSeoPage,
  LOCAL_SEO_PAGES,
  resolveSeoPageByPath,
} from '../config/seoPages';
import { LOCAL_GUIDES } from '../config/guides';
import { useAuth } from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import { googleDiscoveryToLocationItem, useDiscovery } from '../context/DiscoveryContext';
import { trackAnalyticsEvent } from '../utils/analytics';
import { deduplicateCafeItems, useDocumentMeta } from '../utils/cafeHelpers';
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildItemListSchema,
} from '../utils/seoSchemas';
import { LocationCard } from '../components/LocationCard';
import { NotFoundPage } from './NotFoundPage';

export function LocalSeoLandingPage() {
  const { pathname } = useLocation();
  const pageDef = resolveSeoPageByPath(pathname);

  const { locations, settings } = useCms();
  const { authenticated } = useAuth();
  const {
    getEffectiveLocation,
    nearbyPlaces,
    nearbyLoading,
    discoverCafesByAreaText,
    searchLiveCafesInBengaluru,
  } = useDiscovery();

  const effectiveLocations = useMemo(
    () => locations.map((loc) => getEffectiveLocation(loc)),
    [locations, getEffectiveLocation]
  );

  const matchingCafes = useMemo(
    () => (pageDef ? filterCafesForSeoPage(effectiveLocations, pageDef) : []),
    [effectiveLocations, pageDef]
  );

  const liveExtras = useMemo(() => {
    if (!pageDef || nearbyPlaces.length === 0) return [];
    const converted = nearbyPlaces.map((gp) => googleDiscoveryToLocationItem(gp));
    const merged = deduplicateCafeItems(matchingCafes, converted);
    return merged.slice(matchingCafes.length, matchingCafes.length + 6);
  }, [pageDef, nearbyPlaces, matchingCafes]);

  const baseOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://cafedesk.space';

  const schemas = useMemo(() => {
    if (!pageDef) return [];
    return [
      buildBreadcrumbSchema(baseOrigin, [
        { name: 'Home', path: '/' },
        { name: 'Discover Bengaluru', path: '/discover' },
        { name: pageDef.h1, path: pageDef.path },
      ]),
      buildItemListSchema(baseOrigin, pageDef.h1, pageDef.metaDescription, matchingCafes),
      buildFaqSchema(pageDef.faqs),
    ].filter(Boolean) as Array<Record<string, unknown>>;
  }, [baseOrigin, pageDef, matchingCafes]);

  useDocumentMeta(
    pageDef ? pageDef.title : `Page Not Found | ${settings.brand_name}`,
    pageDef ? pageDef.metaDescription : 'Requested Bengaluru cafe guide was not found.',
    {
      canonicalPath: pageDef?.path,
      ogImage: settings.seo_og_image,
      allowIndexing: Boolean(pageDef && settings.seo_allow_indexing && matchingCafes.length > 0),
      schemas,
      googleSiteVerification: settings.google_site_verification,
    }
  );

  useEffect(() => {
    if (pageDef) {
      trackAnalyticsEvent('landing_page_view', {
        page_slug: pageDef.slug,
        matched_count: matchingCafes.length,
      });
    }
  }, [pageDef?.slug, matchingCafes.length]);

  if (!pageDef) {
    return <NotFoundPage />;
  }

  const wifiCount = matchingCafes.filter((c) => c.wifi_available === 'yes').length;
  const studyCount = matchingCafes.filter((c) => c.suitable_for_studying === 'yes').length;
  const costs = matchingCafes
    .map((c) => c.avg_cost_per_person)
    .filter((n): n is number => typeof n === 'number' && n > 0);
  const minCost = costs.length > 0 ? Math.min(...costs) : null;
  const maxCost = costs.length > 0 ? Math.max(...costs) : null;

  const relatedPages = pageDef.relatedSlugs
    .map((slug) => LOCAL_SEO_PAGES.find((p) => p.slug === slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const relatedGuides = LOCAL_GUIDES.slice(0, 3);

  const handleLoadLive = () => {
    if (pageDef.liveSearchArea) {
      void discoverCafesByAreaText(pageDef.liveSearchArea, 'all', 'Bengaluru');
      return;
    }
    void searchLiveCafesInBengaluru(pageDef.liveSearchQuery, { city: 'Bengaluru' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-24 md:pb-16 space-y-10">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-[#5c4e45]">
        <Link to="/" className="hover:text-[#1c1613] font-medium">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <Link to="/discover" className="hover:text-[#1c1613] font-medium">
          Discover Bengaluru
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-semibold text-[#1c1613] truncate">{pageDef.kicker}</span>
      </nav>

      {/* Editorial Intro Header */}
      <header className="bg-white rounded-3xl border border-[#e6ddd0] p-6 sm:p-10 space-y-6">
        <div className="space-y-3 max-w-4xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{pageDef.kicker}</span>
          </div>
          <h1 className="font-serif-display text-3xl sm:text-5xl font-bold text-[#1c1613] leading-[1.1] tracking-tight">
            {pageDef.h1}
          </h1>
          <p className="text-sm sm:text-lg text-[#5c4e45] leading-relaxed">{pageDef.intro}</p>
        </div>

        {/* Verified Fact Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-[#faf7f2] border border-[#e6ddd0]">
            <p className="text-[11px] font-medium text-[#5c4e45]">Curated Listings</p>
            <p className="font-mono-data text-xl font-bold text-[#1c1613] mt-0.5">
              {matchingCafes.length}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#faf7f2] border border-[#e6ddd0]">
            <p className="text-[11px] font-medium text-[#5c4e45] inline-flex items-center gap-1">
              <IndianRupee className="w-3 h-3 text-[#b45309]" aria-hidden="true" />
              <span>Typical Spend</span>
            </p>
            <p className="font-mono-data text-xl font-bold text-[#1c1613] mt-0.5">
              {minCost !== null && maxCost !== null
                ? minCost === maxCost
                  ? `~₹${minCost}`
                  : `₹${minCost}–₹${maxCost}`
                : 'Varies'}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#faf7f2] border border-[#e6ddd0]">
            <p className="text-[11px] font-medium text-[#5c4e45] inline-flex items-center gap-1">
              <Wifi className="w-3 h-3 text-[#1b4d3e]" aria-hidden="true" />
              <span>Confirmed Wi-Fi</span>
            </p>
            <p className="font-mono-data text-xl font-bold text-[#1b4d3e] mt-0.5">{wifiCount}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#faf7f2] border border-[#e6ddd0]">
            <p className="text-[11px] font-medium text-[#5c4e45]">Study-Friendly</p>
            <p className="font-mono-data text-xl font-bold text-[#1c1613] mt-0.5">{studyCount}</p>
          </div>
        </div>

        {/* Highlights Checklist */}
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#e6ddd0]">
          {pageDef.highlights.map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs sm:text-sm text-[#5c4e45]">
              <CheckCircle2 className="w-4 h-4 text-[#1b4d3e] shrink-0 mt-0.5" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {/* Quick Budget & Intent Shortcuts */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {[
            { label: 'Under ₹100', to: '/cafes-under-100-in-bengaluru' },
            { label: 'Under ₹200', to: '/cafes-under-200-in-bengaluru' },
            { label: 'Tea & Chai Shops', to: '/tea-shops-in-bengaluru' },
            { label: 'Coffee Shops', to: '/coffee-shops-in-bengaluru' },
            { label: 'Bakery & Snacks', to: '/snacks-and-bakeries-in-bengaluru' },
            { label: 'Study Cafes', to: '/study-cafes-in-bengaluru' },
            { label: 'Work & Wi-Fi', to: '/work-friendly-cafes-in-bengaluru' },
          ].map((chip) => {
            const active = chip.to === pageDef.path;
            return (
              <Link
                key={chip.to}
                to={chip.to}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors inline-flex items-center ${
                  active
                    ? 'bg-[#1c1613] text-white border-[#1c1613]'
                    : 'bg-[#faf7f2] text-[#5c4e45] border-[#e6ddd0] hover:border-[#b45309] hover:text-[#1c1613]'
                }`}
              >
                {chip.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Curated Matching Cafes Vertical Grid */}
      <section aria-labelledby="curated-results-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="curated-results-heading"
              className="font-serif-display text-2xl sm:text-3xl font-bold text-[#1c1613]"
            >
              Verified Listings ({matchingCafes.length})
            </h2>
            <p className="text-xs sm:text-sm text-[#5c4e45]">
              Sorted by curated verification and suitability. Tap any cafe for full amenities,
              prices, and Google Maps directions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={nearbyLoading}
              onClick={handleLoadLive}
              className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-[#1b4d3e] hover:bg-[#133a2e] disabled:opacity-60 text-white text-xs font-semibold transition-colors"
            >
              <Compass className="w-4 h-4" aria-hidden="true" />
              <span>
                {nearbyLoading
                  ? 'Searching Google Maps...'
                  : `Load Live Google Places${pageDef.liveSearchArea ? ` in ${pageDef.liveSearchArea}` : ''}`}
              </span>
            </button>
            <Link
              to={`/discover${pageDef.liveSearchArea ? `?area=${encodeURIComponent(pageDef.liveSearchArea)}` : ''}`}
              className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-white border border-[#e6ddd0] hover:border-[#b45309] text-xs font-semibold text-[#1c1613]"
            >
              <span>Open Interactive Map</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {matchingCafes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matchingCafes.map((cafe) => (
              <LocationCard key={cafe.id} location={cafe} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#e6ddd0] p-8 text-center space-y-3">
            <p className="font-serif-display text-xl font-bold text-[#1c1613]">
              No curated cafes match this exact filter yet
            </p>
            <p className="text-sm text-[#5c4e45] max-w-lg mx-auto">
              Tap &quot;Load Live Google Places&quot; above to fetch real neighbourhood spots from
              Google Maps, or explore all Bengaluru cafes.
            </p>
            <Link
              to="/discover"
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] text-white text-xs font-semibold"
            >
              <span>Browse All Bengaluru Cafes</span>
            </Link>
          </div>
        )}

        {/* Live Google Places Append Section */}
        {liveExtras.length > 0 && (
          <div className="pt-6 border-t border-[#e6ddd0] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-serif-display text-xl font-bold text-[#1c1613] inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
                <span>Additional Live Local Spots from Google Maps</span>
              </h3>
              <span className="text-xs text-[#5c4e45]">
                Work specs unverified until field-checked
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveExtras.map((loc) => (
                <LocationCard key={loc.id} location={loc} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Frequently Asked Questions (Matching FAQPage JSON-LD) */}
      {pageDef.faqs.length > 0 && (
        <section
          aria-labelledby="seo-faq-heading"
          className="bg-white rounded-3xl border border-[#e6ddd0] p-6 sm:p-8 space-y-5"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#b45309]" aria-hidden="true" />
            <h2
              id="seo-faq-heading"
              className="font-serif-display text-2xl font-bold text-[#1c1613]"
            >
              Frequently Asked Questions
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pageDef.faqs.map((faq) => (
              <div
                key={faq.question}
                className="p-4 rounded-2xl bg-[#faf7f2] border border-[#e6ddd0] space-y-1.5"
              >
                <h3 className="text-sm font-bold text-[#1c1613]">{faq.question}</h3>
                <p className="text-xs sm:text-sm text-[#5c4e45] leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related Localities, Guides & Owner Claim CTA */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#e6ddd0] p-6 space-y-4">
          <h2 className="font-serif-display text-xl font-bold text-[#1c1613]">
            Explore Nearby Areas &amp; Related Guides
          </h2>
          <div className="flex flex-wrap gap-2">
            {relatedPages.map((rp) => (
              <Link
                key={rp.path}
                to={rp.path}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] hover:border-[#b45309] text-xs font-semibold text-[#1c1613] inline-flex items-center gap-1.5"
              >
                <span>{rp.kicker}</span>
                <ArrowRight className="w-3 h-3 text-[#b45309]" aria-hidden="true" />
              </Link>
            ))}
          </div>

          <div className="pt-3 border-t border-[#e6ddd0] space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#1b4d3e] inline-flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Editorial Local Guides</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {relatedGuides.map((g) => (
                <Link
                  key={g.slug}
                  to={`/guides/${g.slug}`}
                  className="p-3 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] hover:border-[#b45309] transition-colors space-y-1"
                >
                  <p className="text-[10px] font-semibold text-[#b45309] uppercase">
                    {g.category}
                  </p>
                  <p className="text-xs font-bold text-[#1c1613] line-clamp-2">{g.title}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#1c1613] text-[#faf7f2] rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#f59e0b]">
              Cafe Owners &amp; Community
            </p>
            <h2 className="font-serif-display text-2xl font-bold text-white">
              {authenticated ? 'Know a spot missing here?' : 'Run a cafe or spotted updated prices?'}
            </h2>
            <p className="text-xs sm:text-sm text-[#d6cbba] leading-relaxed">
              Submit a Bengaluru coffee shop, chai stall, bakery, or update opening hours and menu
              pricing for verified inclusion.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              to="/submit"
              className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold"
            >
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              <span>Suggest or Update a Cafe</span>
            </Link>
            <Link
              to="/owners"
              className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
            >
              <span>For Cafe Owners</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

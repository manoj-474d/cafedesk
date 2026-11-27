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
  Lock,
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
  BENGALURU_CENTER,
  BROWSING_MODES,
  BUDGET_BRACKETS,
  DISCOVERY_CATEGORY_TABS,
  HOME_QUICK_FILTERS,
} from '../config/constants';
import { useCms } from '../context/CmsContext';
import { useAuth } from '../context/AuthContext';
import { googleDiscoveryToLocationItem, useDiscovery } from '../context/DiscoveryContext';
import {
  buildWhatsAppUrl,
  deduplicateCafeItems,
  getCafeDetailRoute,
  matchesDiscoveryCategoryTab,
  useDocumentMeta,
} from '../utils/cafeHelpers';
import {
  CURATED_COLLECTIONS,
  isGoodForDates,
  isHiddenGem,
  isRecentlyAddedCafe,
  isTrendingCafe,
} from '../utils/cafeRecommendations';
import {
  compareCafesBudgetFirst,
  extractCafeMenuEntries,
  getCafeBrandKey,
  getCafeLowestVerifiedMenuPrice,
  interleaveDifferentBrands,
  matchCafeToFoodSearch,
  type ParsedMenuEntry,
} from '../utils/smartFoodSearch';
import { LOCAL_GUIDES } from '../config/guides';
import { LOCAL_SEO_PAGES } from '../config/seoPages';
import { buildOrganizationSchema, buildWebSiteSchema } from '../utils/seoSchemas';
import { CafeAutocompleteSearch } from '../components/CafeAutocompleteSearch';
import { InteractiveCafeMap } from '../components/InteractiveCafeMap';
import { LocationCard } from '../components/LocationCard';
import { ResilientPhoto } from '../components/ResilientPhoto';
import type { HomepageSectionKey, LocationItem } from '../types/cms';

export function HomePage() {
  const { locations, settings, testimonials } = useCms();
  const { authenticated, hasPlus, hasPermission, openUpgradeModal, user } = useAuth();
  const menuPricingUnlocked =
    settings.access_control?.sections?.menu_pricing === 'public' ||
    hasPermission('menu_pricing');
  const {
    userLocation,
    requestUserLocation,
    getEffectiveLocation,
    nearbyPlaces,
    nearbyLoading,
    discoverCafesNear,
    discoverCafesByAreaText,
  } = useDiscovery();
  const navigate = useNavigate();

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cafedesk.space';
  useDocumentMeta(settings.seo_home_title, settings.seo_home_description, {
    canonicalPath: '/',
    ogImage: settings.seo_og_image,
    allowIndexing: settings.seo_allow_indexing,
    googleSiteVerification: settings.google_site_verification,
    schemas: [
      buildOrganizationSchema(origin, settings),
      buildWebSiteSchema(origin, settings.brand_name),
    ],
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchArea, setSearchArea] = useState('');
  const [searchMode, setSearchMode] = useState('');
  const [customMaxBudget, setCustomMaxBudget] = useState('');
  const [activeAreaTab, setActiveAreaTab] = useState('All');
  const [spotlightTab, setSpotlightTab] = useState<
    'budget' | 'coffee' | 'trending' | 'hidden-gems' | 'laptop' | 'study' | 'dates' | 'recent'
  >('budget');
  const [mapFocusCenter, setMapFocusCenter] = useState<{ lat: number; lng: number } | null>(null);

  const [homeDirLimit, setHomeDirLimit] = useState(12);

  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterState, setNewsletterState] = useState<'idle' | 'submitting' | 'sent' | 'error'>(
    'idle'
  );
  const [newsletterMsg, setNewsletterMsg] = useState('');

  const effectiveLocations = useMemo(
    () => locations.map((loc) => getEffectiveLocation(loc)),
    [locations, getEffectiveLocation]
  );

  const liveConvertedPlaces = useMemo(
    () => nearbyPlaces.map((gp) => googleDiscoveryToLocationItem(gp)),
    [nearbyPlaces]
  );

  const combinedLocalCafes = useMemo(
    () => deduplicateCafeItems(effectiveLocations, liveConvertedPlaces),
    [effectiveLocations, liveConvertedPlaces]
  );

  const { budgetDiscoveryShelves, usedHomeCafeIds, usedHomeBrandKeys } = useMemo(() => {
    type ShelfCard = {
      loc: LocationItem & { distanceKm?: number | null };
      matchedItems?: ParsedMenuEntry[];
    };
    type DiscoveryShelf = {
      id: string;
      eyebrow: string;
      title: string;
      subtitle: string;
      to: string;
      showLiveButton?: boolean;
      cards: ShelfCard[];
    };

    const usedIds = new Set<string>();
    const usedBrands = new Set<string>();

    const isAvailable = (loc: LocationItem): boolean => {
      if (usedIds.has(loc.id)) return false;
      const bk = getCafeBrandKey(loc.name);
      if (bk && usedBrands.has(bk)) return false;
      return true;
    };

    const markUsed = (loc: LocationItem) => {
      usedIds.add(loc.id);
      const bk = getCafeBrandKey(loc.name);
      if (bk) usedBrands.add(bk);
    };

    const takeUnique = (
      candidates: Array<{ loc: LocationItem & { distanceKm?: number | null }; matchedItems?: ParsedMenuEntry[] }>,
      maxCount: number
    ): ShelfCard[] => {
      const picked: ShelfCard[] = [];
      for (const item of candidates) {
        if (picked.length >= maxCount) break;
        if (!isAvailable(item.loc)) continue;
        markUsed(item.loc);
        picked.push({ loc: item.loc, matchedItems: item.matchedItems });
      }
      return picked;
    };

    // Master list: server already orders lowest-budget -> upper-budget; compareCafesBudgetFirst refines when prices are unlocked
    const indexMap = new Map<string, number>();
    effectiveLocations.forEach((loc, idx) => indexMap.set(loc.id, idx));

    const sortPreservingBudget = (a: LocationItem, b: LocationItem) => {
      if (menuPricingUnlocked) {
        return compareCafesBudgetFirst(a, b);
      }
      return (indexMap.get(a.id) ?? 9999) - (indexMap.get(b.id) ?? 9999);
    };

    const sortedCurated = [...effectiveLocations].sort(sortPreservingBudget);

    // Optional live Google Places shelf (only places not duplicating curated brands)
    const liveOnlyCards: ShelfCard[] = takeUnique(
      liveConvertedPlaces
        .filter((gp) => gp.isLiveGooglePlace)
        .map((loc) => ({ loc })),
      3
    );

    // 1. Tea & Chai Corners
    const teaShelfCards = takeUnique(
      sortedCurated
        .map((loc) => {
          const match = matchCafeToFoodSearch(loc, 'tea');
          const matched = menuPricingUnlocked
            ? match.matchedItems.filter((m) => m.priceInr !== null && m.priceInr <= 30)
            : match.matchedItems;
          return {
            loc,
            matchedItems: matched,
            matchedOk: menuPricingUnlocked
              ? matched.length > 0
              : match.matched && /tea|chai|kaapi/i.test(`${loc.name} ${loc.category || ''} ${loc.popular_items.join(' ')}`),
            minTea: matched.length && matched[0].priceInr !== null ? Math.min(...matched.map((i) => i.priceInr ?? 999)) : 999,
          };
        })
        .filter((x) => x.matchedOk)
        .sort((a, b) => sortPreservingBudget(a.loc, b.loc) || a.minTea - b.minTea),
      3
    );

    // 2. Bakeries & Quick Snacks
    const bakerySnackCards = takeUnique(
      sortedCurated
        .map((loc) => {
          const entries = extractCafeMenuEntries(loc);
          const matched = menuPricingUnlocked
            ? entries.filter((e) => e.priceInr !== null && e.priceInr <= 50)
            : entries.filter((e) =>
                /bakery|puff|bun|cake|pastry|snack|samosa|vada|biscuit/i.test(`${e.name} ${e.category}`)
              );
          const isBakeryOrSnack =
            /bakery|snack/i.test(`${loc.name} ${loc.category || ''} ${loc.verdict}`) ||
            matched.length > 0;
          const withinTier = !menuPricingUnlocked || (loc.avg_cost_per_person ?? 999) <= 150;
          return { loc, matchedItems: matched, ok: isBakeryOrSnack && withinTier };
        })
        .filter((x) => x.ok)
        .sort((a, b) => sortPreservingBudget(a.loc, b.loc)),
      3
    );

    // 3. Student-Friendly Chai & Casual Food
    const studentValueCards = takeUnique(
      sortedCurated
        .map((loc) => {
          const entries = extractCafeMenuEntries(loc);
          const matched = menuPricingUnlocked
            ? entries.filter((e) => e.priceInr !== null && e.priceInr <= 100).sort((a, b) => (a.priceInr ?? 999) - (b.priceInr ?? 999))
            : entries;
          const ok = menuPricingUnlocked
            ? matched.length > 0 && (loc.avg_cost_per_person ?? 999) <= 175
            : loc.modes.includes('budget') || loc.best_for.some((b) => /student|budget|quick/i.test(b));
          return { loc, matchedItems: matched, ok };
        })
        .filter((x) => x.ok)
        .sort((a, b) => sortPreservingBudget(a.loc, b.loc)),
      3
    );

    // 4. Coffee Shops & Filter Kaapi
    const coffeeKaapiCards = takeUnique(
      sortedCurated
        .map((loc) => ({ loc, match: matchCafeToFoodSearch(loc, 'coffee') }))
        .filter(
          (x) =>
            (!menuPricingUnlocked || (x.loc.avg_cost_per_person ?? 999) <= 190) &&
            (x.match.matched || /coffee|kaapi|brew/i.test(`${x.loc.name} ${x.loc.verdict}`))
        )
        .sort((a, b) => sortPreservingBudget(a.loc, b.loc))
        .map((x) => ({ loc: x.loc, matchedItems: x.match.matchedItems })),
      3
    );

    // 5. Burgers, Fries & Casual Hangouts
    const hangoutCards = takeUnique(
      sortedCurated
        .filter(
          (loc) =>
            (!menuPricingUnlocked || (loc.avg_cost_per_person ?? 999) <= 230) &&
            /burger|sandwich|fries|maggi|shake|hangout|tea|snack/i.test(
              `${loc.name} ${loc.category || ''} ${loc.popular_items.join(' ')} ${loc.verdict}`
            )
        )
        .map((loc) => ({
          loc,
          matchedItems: menuPricingUnlocked
            ? extractCafeMenuEntries(loc).filter((e) => e.priceInr !== null && e.priceInr <= 150)
            : extractCafeMenuEntries(loc),
        })),
      3
    );

    // 6. Breakfast & Neighbourhood Bites
    const breakfastCards = takeUnique(
      sortedCurated
        .filter((loc) => !menuPricingUnlocked || (loc.avg_cost_per_person ?? 999) <= 255)
        .map((loc) => ({
          loc,
          matchedItems: menuPricingUnlocked
            ? extractCafeMenuEntries(loc)
                .filter((e) => e.priceInr !== null && e.priceInr <= 120)
                .sort((a, b) => (a.priceInr ?? 999) - (b.priceInr ?? 999))
            : extractCafeMenuEntries(loc),
        })),
      3
    );

    // 7. Everyday Neighbourhood Cafes & Bakeries
    const everydayWorkCafes = takeUnique(
      sortedCurated
        .filter((loc) => !menuPricingUnlocked || (loc.avg_cost_per_person ?? 999) <= 275)
        .map((loc) => ({ loc })),
      3
    );

    // 8. Everyday Coffee & Study Hangouts
    const midBudgetCafes = takeUnique(
      sortedCurated
        .filter((loc) => !menuPricingUnlocked || (loc.avg_cost_per_person ?? 999) <= 310)
        .map((loc) => ({ loc })),
      3
    );

    // 9. Specialty Roasters & Quiet Study Lounges
    const specialtyRoasters = takeUnique(
      sortedCurated
        .filter((loc) => !menuPricingUnlocked || (loc.avg_cost_per_person ?? 999) <= 360)
        .map((loc) => ({ loc })),
      3
    );

    // 10. All Remaining Unique Bengaluru Cafes (preserving lowest-to-upper budget order)
    const remainingUpperCafes = takeUnique(
      sortedCurated.map((loc) => ({ loc })),
      sortedCurated.length
    );

    const shelves: DiscoveryShelf[] = [
      ...(liveOnlyCards.length > 0
        ? [
            {
              id: 'live-google-places',
              eyebrow: 'Live Google Maps Discovery',
              title: 'Live Local Cafes & Tea Shops Near You',
              subtitle: 'Real-time local spots fetched from Google Maps around your selected area.',
              to: '/discover?nearby=1',
              showLiveButton: true,
              cards: liveOnlyCards,
            },
          ]
        : []),
      {
        id: 'tea-under-30',
        eyebrow: menuPricingUnlocked
          ? 'Lowest Budget · From ₹15 · ₹100–₹150 Avg'
          : 'Neighbourhood Chai & Tea Spots',
        title: menuPricingUnlocked
          ? 'Tea Under ₹30 & Neighbourhood Chai Corners'
          : 'Local Tea & Neighbourhood Chai Corners',
        subtitle: menuPricingUnlocked
          ? 'Verified ginger tea, masala chai, and dum tea starting at ₹15 across Bengaluru.'
          : 'Popular ginger tea, masala chai, and dum tea spots across Bengaluru. Subscribe from ₹79/mo to unlock item prices.',
        to: menuPricingUnlocked ? '/discover?q=Tea+under+%E2%82%B930' : '/discover?q=Tea',
        showLiveButton: liveOnlyCards.length === 0,
        cards: teaShelfCards,
      },
      {
        id: 'bakery-snacks-under-50',
        eyebrow: menuPricingUnlocked
          ? 'Budget Tier · From ₹30 · ₹100 Avg'
          : 'Local Bakeries & Quick Bites',
        title: menuPricingUnlocked
          ? 'Bakeries & Quick Snacks Under ₹50'
          : 'Iyengar Bakeries & Quick Snack Corners',
        subtitle:
          'Classic Iyengar bakeries, khara buns, puffs, and local tea counters across Bengaluru.',
        to: menuPricingUnlocked
          ? '/discover?category=bakery&budget=under-50'
          : '/discover?category=bakery',
        cards: bakerySnackCards,
      },
      {
        id: 'student-food-under-100',
        eyebrow: menuPricingUnlocked
          ? 'Student Value · From ₹27 · ₹150 Avg'
          : 'Student Value Spots',
        title: menuPricingUnlocked
          ? 'Student-Friendly Chai & Food Under ₹100'
          : 'Student-Friendly Chai & Casual Food',
        subtitle:
          'Kullad chai, bun maska, snacks, and cold coffee pockets popular near Bengaluru colleges.',
        to: menuPricingUnlocked ? '/discover?budget=under-100' : '/discover?mode=budget',
        cards: studentValueCards,
      },
      {
        id: 'affordable-coffee-shops',
        eyebrow: menuPricingUnlocked
          ? 'Everyday Brews · From ₹48 · ₹150–₹175 Avg'
          : 'Everyday Filter Kaapi & Espresso',
        title: menuPricingUnlocked
          ? 'Affordable Coffee Shops & Filter Kaapi'
          : 'Local Coffee Shops & Filter Kaapi',
        subtitle:
          'Authentic South Indian filter kaapi and neighbourhood espresso spots across Bengaluru.',
        to: menuPricingUnlocked
          ? '/discover?category=coffee&budget=under-200'
          : '/discover?category=coffee',
        cards: coffeeKaapiCards,
      },
      {
        id: 'budget-burgers-hangouts',
        eyebrow: menuPricingUnlocked
          ? 'Pocket-Friendly Eats · ₹180–₹200 Avg'
          : 'Burgers, Sandwiches & Shakes',
        title: 'Burgers, Fries & Casual Hangouts',
        subtitle:
          'Local cafes serving burgers, quick bites, milkshakes, and casual student meals.',
        to: menuPricingUnlocked
          ? '/discover?category=snacks&budget=under-200'
          : '/discover?category=snacks',
        cards: hangoutCards,
      },
      {
        id: 'budget-breakfast-bites',
        eyebrow: menuPricingUnlocked
          ? 'Value Eats & Local Bites · From ₹13 · ₹200–₹250 Avg'
          : 'Breakfast & Local Bites',
        title: menuPricingUnlocked
          ? 'Budget Eats, Chai & Neighbourhood Breakfast'
          : 'Neighbourhood Breakfast & Quick Eats',
        subtitle:
          'Breakfast plates, Osmania biscuits, local snacks, and casual bites across Bengaluru.',
        to: menuPricingUnlocked ? '/discover?budget=under-300' : '/discover',
        cards: breakfastCards,
      },
      {
        id: 'coffee-under-50-bakeries',
        eyebrow: menuPricingUnlocked
          ? 'Everyday Brews & Bakes · Coffee From ₹40 · ₹250 Avg'
          : 'Everyday Brews & Bakes',
        title: menuPricingUnlocked
          ? 'Coffee Under ₹50, Bakeries & Everyday Cafes'
          : 'Filter Coffee, Bakeries & Everyday Cafes',
        subtitle:
          'Filter coffee, freshly baked treats, and dependable neighbourhood seating.',
        to: menuPricingUnlocked ? '/discover?q=Coffee+under+%E2%82%B950' : '/discover?q=Coffee',
        cards: everydayWorkCafes,
      },
      {
        id: 'mid-budget-cafes',
        eyebrow: menuPricingUnlocked
          ? 'Mid-Budget Tier · ₹250–₹300 Avg'
          : 'Work & Study Hangouts',
        title: menuPricingUnlocked
          ? 'Mid-Budget Coffee & Study Hangouts'
          : 'Everyday Coffee & Study Hangouts',
        subtitle: 'Balanced all-round cafes for laptop work, catchups, and steady Wi-Fi.',
        to: menuPricingUnlocked ? '/discover?budget=under-300' : '/discover',
        cards: midBudgetCafes,
      },
      {
        id: 'specialty-coffee-workspaces',
        eyebrow: menuPricingUnlocked
          ? 'Specialty Coffee Tier · ₹300–₹350 Avg'
          : 'Specialty Coffee & Desk Cafes',
        title: 'Specialty Roasters & Quiet Workspaces',
        subtitle:
          'Pour-overs, measured high-speed Wi-Fi, and dedicated desk seating across Bengaluru.',
        to: '/discover?category=workspaces',
        cards: specialtyRoasters,
      },
      {
        id: 'upper-budget-roasteries',
        eyebrow: menuPricingUnlocked
          ? 'Upper-Budget Tier · ₹350–₹550 Avg'
          : 'Craft Roasteries & All-Day Cafes',
        title: menuPricingUnlocked
          ? 'Upper-Budget Craft Roasteries & All-Day Cafes'
          : 'Craft Roasteries & All-Day Cafes',
        subtitle:
          'Single-origin roasteries, slow-bar coffeehouses, and full-day artisanal kitchens.',
        to: menuPricingUnlocked ? '/discover?budget=300-plus' : '/discover',
        cards: remainingUpperCafes,
      },
    ];

    return {
      budgetDiscoveryShelves: shelves.filter((s) => s.cards.length > 0),
      usedHomeCafeIds: usedIds,
      usedHomeBrandKeys: usedBrands,
    };
  }, [effectiveLocations, liveConvertedPlaces, menuPricingUnlocked]);

  const areaSortedLocations = useMemo(() => {
    if (activeAreaTab === 'All') return [];
    const pool = combinedLocalCafes.filter((l) =>
      `${l.area} ${l.address}`.toLowerCase().includes(activeAreaTab.toLowerCase())
    );

    const sorted = [...pool].sort((a, b) => {
      if (userLocation) {
        const da = a.distanceKm ?? Number.MAX_SAFE_INTEGER;
        const db = b.distanceKm ?? Number.MAX_SAFE_INTEGER;
        if (da !== db) return da - db;
      }
      return compareCafesBudgetFirst(a, b);
    });
    return interleaveDifferentBrands(sorted);
  }, [combinedLocalCafes, activeAreaTab, userLocation]);

  const filteredHomeLocations = useMemo(
    () => areaSortedLocations.slice(0, homeDirLimit),
    [areaSortedLocations, homeDirLimit]
  );

  const areaSummaryTiles = useMemo(() => {
    return BENGALURU_AREAS.map((areaName) => {
      const matches = effectiveLocations.filter((l) =>
        `${l.area} ${l.address}`.toLowerCase().includes(areaName.toLowerCase())
      );
      const prices = matches
        .map((l) => l.avg_cost_per_person ?? getCafeLowestVerifiedMenuPrice(l))
        .filter((p): p is number => p !== null && p > 0);
      return {
        areaName,
        count: matches.length,
        minAvg: prices.length > 0 ? Math.min(...prices) : null,
      };
    }).filter((t) => t.count > 0);
  }, [effectiveLocations]);

  const discoveryModeSummaries = useMemo(() => {
    const modeDefs = [
      {
        id: 'budget' as const,
        label: 'Budget Under ₹200',
        subtitle: 'Tea stalls, bakeries & student-friendly bites',
        to: '/discover?budget=under-200',
        match: (l: LocationItem) =>
          l.modes.includes('budget') ||
          (l.avg_cost_per_person !== null && l.avg_cost_per_person <= 200),
      },
      {
        id: 'coffee' as const,
        label: 'Coffee & Tea Picks',
        subtitle: 'Verified filter kaapi, chai & espresso spots',
        to: '/discover?category=coffee',
        match: (l: LocationItem) =>
          Boolean(
            l.coffee_price ||
              l.tea_price ||
              /coffee|espresso|latte|kaapi|tea|chai/i.test(`${l.verdict} ${l.popular_items.join(' ')}`)
          ),
      },
      {
        id: 'hidden-gems' as const,
        label: 'Hidden Local Gems',
        subtitle: 'Independent bakeries & neighbourhood counters',
        to: '/discover?collection=hidden-gems',
        match: isHiddenGem,
      },
      {
        id: 'study' as const,
        label: 'Quiet Study Spots',
        subtitle: 'Calm corners suited for reading & exam prep',
        to: '/discover?mode=calm',
        match: (l: LocationItem) => l.suitable_for_studying === 'yes' || l.modes.includes('calm'),
      },
      {
        id: 'laptop' as const,
        label: 'Laptop-Friendly Work',
        subtitle: 'Power sockets, steady Wi-Fi & work tables',
        to: '/discover?workFriendly=1',
        match: (l: LocationItem) => l.laptop_friendly,
      },
      {
        id: 'trending' as const,
        label: 'Trending Spots',
        subtitle: 'Highly rated Bengaluru favourites right now',
        to: '/discover?collection=trending',
        match: isTrendingCafe,
      },
      {
        id: 'dates' as const,
        label: 'Meetings & Catchups',
        subtitle: 'Warm seating for casual meetings & friends',
        to: '/discover?collection=dates',
        match: isGoodForDates,
      },
      {
        id: 'recent' as const,
        label: 'Recently Verified',
        subtitle: 'Freshly audited menus, speeds & pricing',
        to: '/discover?sort=recent',
        match: isRecentlyAddedCafe,
      },
    ];
    return modeDefs.map((m) => ({
      ...m,
      count: effectiveLocations.filter(m.match).length,
    }));
  }, [effectiveLocations]);

  const spotlightModeMeta = discoveryModeSummaries.find((m) => m.id === spotlightTab) ?? discoveryModeSummaries[0];

  const sponsoredCafes = useMemo(
    () =>
      [...effectiveLocations]
        .filter(
          (l) =>
            l.featured &&
            !usedHomeCafeIds.has(l.id) &&
            !usedHomeBrandKeys.has(getCafeBrandKey(l.name))
        )
        .sort(compareCafesBudgetFirst)
        .slice(0, 3),
    [effectiveLocations, usedHomeCafeIds, usedHomeBrandKeys]
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
    navigate(qs ? `/discover?${qs}` : '/discover');
  };

  const handleFindNearMe = async () => {
    await requestUserLocation();
    navigate('/discover?nearby=1');
  };

  const handleAreaSelect = (areaName: string) => {
    setActiveAreaTab(areaName);
    setHomeDirLimit(12);
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
          !settings.hero_tagline ||
          settings.hero_tagline === 'Find Your Perfect Cafe in Bengaluru.' ||
          settings.hero_tagline === 'Find Your Perfect Workspace.'
            ? 'Affordable Cafes, Tea Shops & Workspaces.'
            : settings.hero_tagline;
        const heroSub =
          !settings.hero_subtitle ||
          settings.hero_subtitle.startsWith("Discover Bengaluru's cafes for affordable coffee") ||
          settings.hero_subtitle === 'Discover cafes to work, study, meet and relax.'
            ? menuPricingUnlocked
              ? 'Find budget-friendly chai under ₹30, filter coffee, local bakeries, snacks, and laptop-ready cafes across Bengaluru.'
              : 'Find local chai corners, filter coffee, bakeries, snacks, and laptop-ready cafes across Bengaluru. Unlock item prices starting at ₹79/mo.'
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
                  {settings.hero_kicker && settings.hero_kicker !== 'Bengaluru Work & Study Cafes'
                    ? settings.hero_kicker
                    : 'Bengaluru Budget Cafes, Food & Workspaces'}
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
                    to="/discover"
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
                    to="/discover?view=map"
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
                  aria-label="Smart food and cafe discovery search"
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                >
                  <div className="sm:col-span-5">
                    <label
                      htmlFor="home-search-q"
                      className="block text-xs font-medium text-[#5c4e45] mb-1.5"
                    >
                      Search food item, tea, coffee, snacks, cafe, or locality
                    </label>
                    <CafeAutocompleteSearch
                      id="home-search-q"
                      value={searchQuery}
                      onChange={setSearchQuery}
                      onSubmitQuery={(q) =>
                        navigate(`/discover?q=${encodeURIComponent(q)}&live=1`)
                      }
                      placeholder={
                        menuPricingUnlocked
                          ? 'Try "Tea under ₹30 near me", "Burger under ₹100"...'
                          : 'Search "Cafe Latte", "Masala Chai", "Burger", or area...'
                      }
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

                {/* Quick Filter Chips — Wrapped cleanly (No Horizontal Scroll) */}
                <div className="pt-3 border-t border-[#e6ddd0] flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-[#5c4e45] mr-1">
                    Quick filters:
                  </span>
                  {HOME_QUICK_FILTERS.map((qf) => {
                    const iconProps = {
                      className: 'w-3.5 h-3.5 text-[#b45309] shrink-0',
                      'aria-hidden': true as const,
                    };
                    const IconEl =
                      qf.id === 'coffee' || qf.id === 'tea' ? (
                        <Coffee {...iconProps} />
                      ) : qf.id === 'workspaces' ? (
                        <Laptop {...iconProps} />
                      ) : qf.id === 'budget' ? (
                        <IndianRupee {...iconProps} />
                      ) : qf.id === 'wifi' ? (
                        <Wifi {...iconProps} />
                      ) : qf.id === 'sockets' ? (
                        <Plug {...iconProps} />
                      ) : (
                        <Sparkles {...iconProps} />
                      );

                    const safeLabel =
                      menuPricingUnlocked
                        ? qf.label
                        : qf.id === 'tea'
                        ? 'Tea & Chai'
                        : qf.id === 'coffee'
                        ? 'Coffee & Kaapi'
                        : qf.id === 'snacks'
                        ? 'Snacks & Bakeries'
                        : qf.id === 'budget'
                        ? 'Budget Spots'
                        : qf.label;

                    const safeTo =
                      menuPricingUnlocked
                        ? qf.to
                        : qf.id === 'tea'
                        ? '/discover?q=Tea'
                        : qf.id === 'coffee'
                        ? '/discover?q=Coffee'
                        : qf.id === 'snacks'
                        ? '/discover?category=snacks'
                        : qf.id === 'budget'
                        ? '/discover?mode=budget'
                        : qf.to;

                    return (
                      <Link
                        key={qf.id}
                        to={safeTo}
                        className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-full bg-[#faf7f2] hover:bg-[#fef3c7] border border-[#e6ddd0] text-xs font-medium text-[#1c1613] transition-colors"
                      >
                        {IconEl}
                        <span>{safeLabel}</span>
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
            {/* Local Discovery Categories + Find My Work Mood + Budget Finder + Collections */}
            <section
              aria-labelledby="home-locations-heading"
              className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12"
            >
              {/* Compact Explore Cafe Option + Local Food & Workspace Category Shortcuts */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    to="/discover"
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-sm font-semibold transition-colors"
                  >
                    <span>Explore Cafe</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                  <Link
                    to="/discover?nearby=1"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1b4d3e] hover:underline"
                  >
                    <LocateFixed className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Discover live shops &amp; cafes nearby &rarr;</span>
                  </Link>
                </div>

                <div className="bg-white rounded-2xl border border-[#e6ddd0] p-4 sm:p-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
                    Browse Real Local Spots via CafeDesk &amp; Google Maps
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
                    {DISCOVERY_CATEGORY_TABS.map((cat) => (
                      <Link
                        key={cat.id}
                        to={cat.id === 'all' ? '/discover' : `/discover?category=${cat.id}`}
                        className="min-h-[42px] px-2.5 py-2 rounded-xl bg-[#faf7f2] hover:bg-[#fef3c7] border border-[#e6ddd0] hover:border-[#b45309]/50 text-xs font-semibold text-[#1c1613] flex items-center justify-center text-center transition-colors"
                      >
                        {cat.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* Budget Finder Bar + Custom Max Budget Input */}
              <div className="bg-[#f3ede3] rounded-2xl border border-[#e6ddd0] p-4 sm:p-5 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1b4d3e]">
                      <span>Item &amp; Cafe Budget Finder</span>
                      {!menuPricingUnlocked && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] normal-case tracking-normal font-semibold">
                          <Lock className="w-3 h-3" aria-hidden="true" />
                          Plus ₹79/mo
                        </span>
                      )}
                    </p>
                    <p className="font-serif-display text-lg sm:text-xl font-bold text-[#1c1613]">
                      {menuPricingUnlocked
                        ? 'Filter by verified price or set your own max budget'
                        : 'Unlock item prices & exact ₹ budget filters with Cafe Desk Plus (₹79/mo)'}
                    </p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!menuPricingUnlocked) {
                        openUpgradeModal({
                          featureName: 'Menu Item & Budget Price Filters',
                          requiredPlan: 'plus',
                          description:
                            'Unlock verified INR prices for specific menu items and exact ₹ budget filters starting with Cafe Desk Plus (₹79/month).',
                        });
                        return;
                      }
                      const val = Number(customMaxBudget);
                      if (Number.isFinite(val) && val > 0) {
                        navigate(`/discover?maxPrice=${Math.round(val)}`);
                      }
                    }}
                    className="flex items-center gap-2 shrink-0"
                  >
                    <label htmlFor="home-custom-max-budget" className="sr-only">
                      Custom max budget in rupees
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#5c4e45]">
                        ₹
                      </span>
                      <input
                        id="home-custom-max-budget"
                        type="number"
                        min={10}
                        max={2000}
                        value={customMaxBudget}
                        onChange={(e) => setCustomMaxBudget(e.target.value)}
                        placeholder={menuPricingUnlocked ? 'Max ₹ (e.g. 80)' : 'Plus ₹79+'}
                        className="w-36 h-10 pl-7 pr-3 rounded-xl bg-white border border-[#d6cbba] text-xs font-semibold text-[#1c1613] placeholder:text-[#8c7a6b]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="h-10 px-4 rounded-xl bg-[#1c1613] hover:bg-[#b45309] text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                    >
                      {!menuPricingUnlocked && <Lock className="w-3 h-3" aria-hidden="true" />}
                      <span>{menuPricingUnlocked ? 'Go' : 'Unlock'}</span>
                    </button>
                  </form>
                </div>

                <div className="flex flex-wrap gap-2">
                  {BUDGET_BRACKETS.map((b) =>
                    menuPricingUnlocked ? (
                      <Link
                        key={b.id}
                        to={`/discover?budget=${b.id}`}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#1c1613] hover:text-white border border-[#e6ddd0] text-xs font-semibold text-[#1c1613] inline-flex items-center transition-colors"
                      >
                        {b.label}
                      </Link>
                    ) : (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() =>
                          openUpgradeModal({
                            featureName: 'Menu Item & Budget Price Filters',
                            requiredPlan: 'plus',
                            description:
                              'Unlock verified INR prices for specific menu items and exact ₹ budget filters starting with Cafe Desk Plus (₹79/month).',
                          })
                        }
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white hover:border-[#b45309] border border-[#e6ddd0] text-xs font-semibold text-[#5c4e45] inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Lock className="w-3 h-3 text-[#b45309]" aria-hidden="true" />
                        <span>{b.label}</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* 12 Budget-First Local Discovery Sections (Vertical Grids Only) */}
              <div className="space-y-10">
                {budgetDiscoveryShelves.map((shelf) => (
                  <div key={shelf.id} id={shelf.id} className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2.5 border-b border-[#e6ddd0] pb-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b45309] mb-0.5">
                          {shelf.eyebrow}
                        </p>
                        <h2 className="font-serif-display text-2xl sm:text-[1.75rem] font-bold text-[#1c1613]">
                          {shelf.title}
                        </h2>
                        <p className="text-xs sm:text-sm text-[#5c4e45] mt-0.5">{shelf.subtitle}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {shelf.showLiveButton && (
                          <button
                            type="button"
                            disabled={nearbyLoading}
                            onClick={() =>
                              void discoverCafesNear(
                                userLocation ?? BENGALURU_CENTER,
                                userLocation ? 'Near You' : 'Bengaluru',
                                5000,
                                'all'
                              )
                            }
                            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-[#ecfdf5] hover:bg-[#d1fae5] border border-[#a7f3d0] text-[#1b4d3e] text-xs font-semibold transition-colors disabled:opacity-60"
                          >
                            <LocateFixed className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {nearbyLoading
                                ? 'Loading...'
                                : nearbyPlaces.length > 0
                                ? `Live Places (${nearbyPlaces.length})`
                                : 'Load Live Google Places'}
                            </span>
                          </button>
                        )}
                        <Link
                          to={shelf.to}
                          className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-[#d6cbba] hover:border-[#b45309] text-xs font-semibold text-[#1c1613] transition-colors whitespace-nowrap"
                        >
                          <span>See all</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                      {shelf.cards.map(({ loc, matchedItems }) => (
                        <div key={`${shelf.id}-${loc.id}`} className="flex flex-col">
                          <LocationCard location={loc} matchedMenuItems={matchedItems} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Instant Discovery Mode Shortcuts — Zero Duplicate Cafe Cards */}
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

                <div className="flex flex-wrap gap-2">
                  {discoveryModeSummaries.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSpotlightTab(tab.id)}
                      className={`min-h-[40px] px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${
                        spotlightTab === tab.id
                          ? 'bg-[#1c1613] text-white border-[#1c1613]'
                          : 'bg-white text-[#5c4e45] border-[#e6ddd0] hover:border-[#b45309] hover:text-[#1c1613]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {spotlightModeMeta && (
                  <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#e6ddd0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#b45309]">
                        {spotlightModeMeta.count} Bengaluru spots match this filter
                      </p>
                      <h3 className="font-serif-display text-xl font-bold text-[#1c1613]">
                        {spotlightModeMeta.label}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#5c4e45]">
                        {spotlightModeMeta.subtitle} — sorted from lowest price to upper budget.
                      </p>
                    </div>
                    <Link
                      to={spotlightModeMeta.to}
                      className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs sm:text-sm font-semibold transition-colors shrink-0 whitespace-nowrap"
                    >
                      <span>View {spotlightModeMeta.label}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Curated Bengaluru Collections — Vertical Responsive Grid */}
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309] mb-1">
                    Curated Collections
                  </p>
                  <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#1c1613]">
                    Editorial Bengaluru cafe trails
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {CURATED_COLLECTIONS.map((col) => {
                    const count = effectiveLocations.filter(col.match).length;
                    return (
                      <Link
                        key={col.id}
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
                    );
                  })}
                </div>
              </div>

              {/* Sponsored Partner Spotlight — Vertical Grid */}
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {sponsoredCafes.map((sp) => (
                      <Link
                        key={`sp-${sp.id}`}
                        to={getCafeDetailRoute(sp.slug, authenticated)}
                        className="p-4 rounded-xl bg-white border border-[#e6ddd0] hover:border-[#b45309]/50 space-y-1.5 transition-colors"
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

            {/* Directory by Locality Section — Vertical Scrolling Only */}
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
                      to="/discover"
                      className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
                    >
                      <span>Open Full Discovery ({locations.length}+)</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                {/* Neighbourhood Quick-Jump Bar — Wrapped Cleanly */}
                <div className="flex flex-wrap gap-2">
                  {['All', ...BENGALURU_AREAS].map((areaName) => (
                    <button
                      key={areaName}
                      type="button"
                      onClick={() => handleAreaSelect(areaName)}
                      className={`min-h-[40px] px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${
                        activeAreaTab === areaName
                          ? 'bg-[#1c1613] text-white border-[#1c1613]'
                          : 'bg-white text-[#5c4e45] border-[#e6ddd0] hover:border-[#b45309] hover:text-[#1c1613]'
                      }`}
                    >
                      {areaName === 'All' ? 'All Bengaluru' : areaName}
                    </button>
                  ))}
                </div>

                <p className="text-xs sm:text-sm text-[#5c4e45]">
                  {activeAreaTab === 'All'
                    ? 'Every curated Bengaluru cafe is listed once above from lowest price to upper budget. Select any neighbourhood below to filter cafes in that area.'
                    : `Showing ${areaSortedLocations.length} cafes in ${activeAreaTab}, ordered from lowest price to upper budget.`}
                </p>

                {activeAreaTab === 'All' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                    {areaSummaryTiles.map((tile) => (
                      <button
                        key={tile.areaName}
                        type="button"
                        onClick={() => handleAreaSelect(tile.areaName)}
                        className="p-4 rounded-2xl bg-white border border-[#e6ddd0] hover:border-[#b45309] text-left flex flex-col justify-between gap-2 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-serif-display text-base font-bold text-[#1c1613]">
                            {tile.areaName}
                          </span>
                          <ArrowRight className="w-4 h-4 text-[#b45309] shrink-0" aria-hidden="true" />
                        </div>
                        <p className="text-xs text-[#5c4e45]">
                          {tile.count} {tile.count === 1 ? 'cafe' : 'cafes'}
                          {menuPricingUnlocked && tile.minAvg !== null ? ` · From ₹${tile.minAvg} avg` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : filteredHomeLocations.length === 0 ? (
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
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                      {filteredHomeLocations.map((loc) => (
                        <div key={loc.id} className="flex flex-col">
                          <LocationCard location={loc} />
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {areaSortedLocations.length > filteredHomeLocations.length && (
                        <button
                          type="button"
                          onClick={() => setHomeDirLimit((n) => n + 12)}
                          className="inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 rounded-xl bg-white border border-[#d6cbba] hover:border-[#b45309] text-[#1c1613] text-xs sm:text-sm font-semibold transition-colors"
                        >
                          Load More Cafes ({areaSortedLocations.length - filteredHomeLocations.length} more)
                        </button>
                      )}
                      <Link
                        to={`/discover?area=${encodeURIComponent(activeAreaTab)}`}
                        className="inline-flex items-center gap-2 min-h-[44px] px-6 py-2.5 rounded-xl bg-[#1c1613] hover:bg-[#312722] text-white text-xs sm:text-sm font-semibold transition-colors"
                      >
                        <span>Explore All {activeAreaTab} &amp; Live Google Places</span>
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Interactive Bengaluru Map Section */}
                <div className="pt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-serif-display text-2xl font-bold text-[#1c1613]">
                      Interactive Bengaluru Cafe Map
                    </h3>
                    <Link
                      to="/discover?view=map"
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

                {/* Crawl-Friendly Bengaluru Neighbourhoods, Category Guides & Editorial Index */}
                <div className="pt-6 border-t border-[#e6ddd0] space-y-5">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1b4d3e] mb-1">
                        Bengaluru Local SEO Guides
                      </p>
                      <h3 className="font-serif-display text-2xl font-bold text-[#1c1613]">
                        Browse Bengaluru neighbourhoods &amp; cafe categories
                      </h3>
                    </div>
                    <Link
                      to="/guides"
                      className="text-xs font-semibold text-[#b45309] hover:underline underline-offset-4"
                    >
                      Read all editorial guides ({LOCAL_GUIDES.length}) &rarr;
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl border border-[#e6ddd0] p-4 sm:p-5 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#b45309]">
                        Category &amp; Budget Guides
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {LOCAL_SEO_PAGES.filter((p) => p.group !== 'locality')
                          .slice(0, 10)
                          .map((p) => (
                            <Link
                              key={p.slug}
                              to={p.path}
                              className="px-3 py-1.5 rounded-full bg-[#faf7f2] hover:bg-[#fef3c7] border border-[#e6ddd0] text-xs font-medium text-[#1c1613] transition-colors"
                            >
                              {p.kicker}
                            </Link>
                          ))}
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-[#e6ddd0] p-4 sm:p-5 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#1b4d3e]">
                        Popular Bengaluru Neighbourhoods
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {LOCAL_SEO_PAGES.filter((p) => p.group === 'locality')
                          .slice(0, 12)
                          .map((p) => (
                            <Link
                              key={p.slug}
                              to={p.path}
                              className="px-3 py-1.5 rounded-full bg-[#faf7f2] hover:bg-[#ecfdf5] border border-[#e6ddd0] text-xs font-medium text-[#1c1613] transition-colors"
                            >
                              {p.kicker}
                            </Link>
                          ))}
                      </div>
                    </div>
                  </div>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
                {settings.editorial_gallery.map((item, idx) => (
                  <div key={`${item.url}-${idx}`}>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
                {testimonials.map((t) => (
                  <div key={t.id} className="flex">
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

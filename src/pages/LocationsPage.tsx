import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Bookmark,
  Compass,
  GitCompareArrows,
  Globe,
  Heart,
  Images,
  List,
  LocateFixed,
  Lock,
  Map as MapIcon,
  MapPin,
  Navigation,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  Wifi,
  X,
} from 'lucide-react';
import {
  BENGALURU_AREAS,
  BROWSING_MODES,
  BUDGET_BRACKETS,
  DISCOVERY_BUSINESS_CATEGORIES,
  DISCOVERY_CATEGORY_TABS,
  SUPPORTED_CITIES,
  WORK_MOODS,
  type BudgetBracketId,
  type CafeMode,
  type DiscoveryBusinessCategoryId,
  type DiscoveryCategoryTabId,
  type WorkMoodId,
} from '../config/constants';
import { locationToLibrarySnapshot, useAuth } from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import {
  googleDiscoveryToLocationItem,
  useDiscovery,
} from '../context/DiscoveryContext';
import {
  buildGoogleMapsDirectionsUrl,
  deduplicateCafeItems,
  formatDistanceKm,
  getCafeDetailRoute,
  getCafeSourceMeta,
  isCafeOpenNow,
  matchesBudgetBracket,
  matchesDiscoveryCategoryTab,
  matchesWorkMood,
  useDocumentMeta,
} from '../utils/cafeHelpers';
import {
  isGoodForDates,
  isHiddenGem,
  isOutdoorFriendly,
  isTrendingCafe,
} from '../utils/cafeRecommendations';
import { CafeAutocompleteSearch } from '../components/CafeAutocompleteSearch';
import { InteractiveCafeMap } from '../components/InteractiveCafeMap';
import { LocationCard } from '../components/LocationCard';
import { ResilientPhoto } from '../components/ResilientPhoto';
import { LOCAL_SEO_PAGES } from '../config/seoPages';
import { trackAnalyticsEvent } from '../utils/analytics';
import { buildBreadcrumbSchema, buildItemListSchema } from '../utils/seoSchemas';

type SortOption =
  | 'distance'
  | 'featured'
  | 'rating'
  | 'reviews'
  | 'wifi'
  | 'cheapest'
  | 'quietest'
  | 'recent';

type ViewMode = 'split' | 'list' | 'map';

function CardSkeletonPlaceholder() {
  return (
    <div className="bg-white rounded-2xl border border-[#e6ddd0] overflow-hidden animate-pulse">
      <div className="aspect-[16/10] bg-[#efe7da]" />
      <div className="p-4 sm:p-5 space-y-3">
        <div className="h-3 w-28 bg-[#efe7da] rounded" />
        <div className="h-5 w-3/4 bg-[#efe7da] rounded" />
        <div className="h-3.5 w-full bg-[#efe7da] rounded" />
        <div className="h-3.5 w-2/3 bg-[#efe7da] rounded" />
        <div className="pt-3 border-t border-[#e6ddd0] flex justify-between">
          <div className="h-8 w-24 bg-[#efe7da] rounded-xl" />
          <div className="h-8 w-20 bg-[#efe7da] rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function LocationsPage() {
  const { locations, settings } = useCms();
  const {
    authenticated,
    subscription,
    isSubscribed,
    isExpired,
    isSuspended,
    expiredPlanName,
    hasPermission,
    openCheckout,
    openUpgradeModal,
    isCafeSaved,
    isCafeFavourite,
    toggleSaveCafe,
    compareList,
    toggleCompareCafe,
  } = useAuth();

  const canViewPricing =
    settings.access_control?.sections?.menu_pricing === 'public' ||
    hasPermission('menu_pricing');
  const canViewWifi =
    settings.access_control?.sections?.wifi_details === 'public' ||
    hasPermission('wifi_details');
  const canViewSockets =
    settings.access_control?.sections?.power_sockets === 'public' ||
    hasPermission('power_sockets');
  const canViewWorkspace =
    settings.access_control?.sections?.workspace_details === 'public' ||
    hasPermission('workspace_details');
  const canCompare = isSubscribed && hasPermission('compare');

  const {
    userLocation,
    geoStatus,
    geoError,
    requestUserLocation,
    clearUserLocation,
    getEffectiveLocation,
    nearbyPlaces,
    nearbyLoading,
    loadingMoreNearby,
    nearbyHasMore,
    nearbyLabel,
    placesNotice,
    clearPlacesNotice,
    discoverCafesNear,
    discoverCafesByAreaText,
    searchLiveCafesInBengaluru,
    loadMoreLiveCafes,
    placesReady,
  } = useDiscovery();
  const [searchParams, setSearchParams] = useSearchParams();

  const FILTERS_STORAGE_KEY = 'cafedesk_locations_filters_v1';
  const readStoredFilters = (): Record<string, unknown> => {
    try {
      const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  };
  const stored = useMemo(() => readStoredFilters(), []);

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (searchParams.get('view') === 'map') return 'map';
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return 'list';
    return 'split';
  });
  const [query, setQuery] = useState(
    () => searchParams.get('q') ?? (typeof stored.q === 'string' ? stored.q : '')
  );
  const [selectedCity, setSelectedCity] = useState<string>(
    () => searchParams.get('city') ?? (typeof stored.city === 'string' ? stored.city : 'Bengaluru')
  );
  const [area, setArea] = useState(
    () => searchParams.get('area') ?? (typeof stored.area === 'string' ? stored.area : '')
  );
  const [categoryTab, setCategoryTab] = useState<DiscoveryCategoryTabId | ''>(
    () =>
      (searchParams.get('category') as DiscoveryCategoryTabId) ||
      (typeof stored.categoryTab === 'string' ? (stored.categoryTab as DiscoveryCategoryTabId) : 'all')
  );
  const [businessCategory, setBusinessCategory] = useState<DiscoveryBusinessCategoryId | ''>(
    () =>
      (searchParams.get('bizCategory') as DiscoveryBusinessCategoryId) ||
      (typeof stored.businessCategory === 'string'
        ? (stored.businessCategory as DiscoveryBusinessCategoryId)
        : '')
  );
  const [workMood, setWorkMood] = useState<WorkMoodId | ''>(
    () =>
      (searchParams.get('mood') as WorkMoodId) ||
      (typeof stored.workMood === 'string' ? (stored.workMood as WorkMoodId) : '')
  );
  const [mode, setMode] = useState<string>(
    () => searchParams.get('mode') ?? (typeof stored.mode === 'string' ? stored.mode : '')
  );
  const [budget, setBudget] = useState<BudgetBracketId | ''>(
    () =>
      (searchParams.get('budget') as BudgetBracketId) ||
      (typeof stored.budget === 'string' ? (stored.budget as BudgetBracketId) : '')
  );
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(() =>
    typeof stored.maxDistanceKm === 'number' ? stored.maxDistanceKm : 0
  );
  const [minWifi, setMinWifi] = useState<number>(() =>
    typeof stored.minWifi === 'number' ? stored.minWifi : 0
  );
  const [minRating, setMinRating] = useState<number>(() =>
    typeof stored.minRating === 'number' ? stored.minRating : 0
  );

  const [wifiOnly, setWifiOnly] = useState(
    () => searchParams.get('wifi') === '1' || Boolean(stored.wifiOnly)
  );
  const [laptopFriendlyOnly, setLaptopFriendlyOnly] = useState(
    () => searchParams.get('workFriendly') === '1' || Boolean(stored.laptopFriendlyOnly)
  );
  const [socketsOnly, setSocketsOnly] = useState(
    () => searchParams.get('sockets') === '1' || Boolean(stored.socketsOnly)
  );
  const [quietOnly, setQuietOnly] = useState(
    () => searchParams.get('quiet') === '1' || Boolean(stored.quietOnly)
  );
  const [comfortableOnly, setComfortableOnly] = useState(() => Boolean(stored.comfortableOnly));
  const [studyOnly, setStudyOnly] = useState(() => Boolean(stored.studyOnly));
  const [workOnly, setWorkOnly] = useState(
    () => searchParams.get('workFriendly') === '1' || Boolean(stored.workOnly)
  );
  const [meetingOnly, setMeetingOnly] = useState(
    () => searchParams.get('meeting') === '1' || Boolean(stored.meetingOnly)
  );
  const [teaCoffeeOnly, setTeaCoffeeOnly] = useState(
    () => searchParams.get('teaCoffee') === '1' || Boolean(stored.teaCoffeeOnly)
  );
  const [bakerySnacksOnly, setBakerySnacksOnly] = useState(
    () => searchParams.get('bakerySnacks') === '1' || Boolean(stored.bakerySnacksOnly)
  );
  const [burgersSandwichesOnly, setBurgersSandwichesOnly] = useState(
    () => searchParams.get('burgersSandwiches') === '1' || Boolean(stored.burgersSandwichesOnly)
  );
  const [openNowOnly, setOpenNowOnly] = useState(() => Boolean(stored.openNowOnly));
  const [verifiedOnly, setVerifiedOnly] = useState(() => Boolean(stored.verifiedOnly));
  const [outdoorOnly, setOutdoorOnly] = useState(
    () => searchParams.get('outdoor') === '1' || Boolean(stored.outdoorOnly)
  );
  const [collectionFilter, setCollectionFilter] = useState(
    () => searchParams.get('collection') ?? (typeof stored.collectionFilter === 'string' ? stored.collectionFilter : '')
  );
  const [atmosphere, setAtmosphere] = useState<'any' | 'quiet' | 'lively'>(() =>
    stored.atmosphere === 'quiet' || stored.atmosphere === 'lively' ? stored.atmosphere : 'any'
  );

  const [sortBy, setSortBy] = useState<SortOption>(() =>
    searchParams.get('nearby') === '1'
      ? 'distance'
      : typeof stored.sortBy === 'string'
      ? (stored.sortBy as SortOption)
      : 'featured'
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [focusCenter, setFocusCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [visibleCuratedCount, setVisibleCuratedCount] = useState(9);

  const autoNearbyTriggeredRef = useRef(false);
  const autoLiveQueryTriggeredRef = useRef(false);

  useEffect(() => {
    if (searchParams.get('view') === 'map') {
      setViewMode('map');
    } else if (typeof window !== 'undefined' && window.innerWidth < 1024 && viewMode === 'split') {
      setViewMode('list');
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({
          q: query,
          city: selectedCity,
          area,
          categoryTab,
          businessCategory,
          workMood,
          mode,
          budget,
          maxDistanceKm,
          minWifi,
          minRating,
          wifiOnly,
          laptopFriendlyOnly,
          socketsOnly,
          quietOnly,
          comfortableOnly,
          studyOnly,
          workOnly,
          meetingOnly,
          teaCoffeeOnly,
          bakerySnacksOnly,
          burgersSandwichesOnly,
          openNowOnly,
          verifiedOnly,
          outdoorOnly,
          collectionFilter,
          atmosphere,
          sortBy,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }, [
    query,
    selectedCity,
    area,
    categoryTab,
    businessCategory,
    workMood,
    mode,
    budget,
    maxDistanceKm,
    minWifi,
    minRating,
    wifiOnly,
    laptopFriendlyOnly,
    socketsOnly,
    quietOnly,
    comfortableOnly,
    studyOnly,
    workOnly,
    meetingOnly,
    teaCoffeeOnly,
    bakerySnacksOnly,
    burgersSandwichesOnly,
    openNowOnly,
    verifiedOnly,
    outdoorOnly,
    collectionFilter,
    atmosphere,
    sortBy,
  ]);

  useEffect(() => {
    if (searchParams.get('nearby') !== '1' || autoNearbyTriggeredRef.current) return;
    autoNearbyTriggeredRef.current = true;

    (async () => {
      const point = userLocation ?? (await requestUserLocation());
      if (point) {
        setSortBy('distance');
        setFocusCenter(point);
        void discoverCafesNear(point, 'Near You', 5000);
      }
    })();
  }, [searchParams, userLocation, requestUserLocation, discoverCafesNear]);

  useEffect(() => {
    const liveParam = searchParams.get('live');
    const qParam = (searchParams.get('q') ?? '').trim();
    const catParam = (searchParams.get('category') ?? '').trim();
    const moodParam = (searchParams.get('mood') ?? '').trim();

    if (autoLiveQueryTriggeredRef.current) return;
    if (liveParam === '1' && qParam.length >= 2) {
      autoLiveQueryTriggeredRef.current = true;
      void searchLiveCafesInBengaluru(qParam, {
        category: catParam || undefined,
        locality: area || undefined,
        city: selectedCity,
      });
    } else if (catParam && catParam !== 'all' && nearbyPlaces.length === 0) {
      const catMeta = DISCOVERY_CATEGORY_TABS.find((t) => t.id === catParam);
      if (catMeta) {
        autoLiveQueryTriggeredRef.current = true;
        void searchLiveCafesInBengaluru(catMeta.placesQuery, {
          category: catMeta.id,
          locality: area || undefined,
          city: selectedCity,
        });
      }
    } else if (moodParam && nearbyPlaces.length === 0) {
      const moodMeta = WORK_MOODS.find((m) => m.id === moodParam);
      if (moodMeta) {
        autoLiveQueryTriggeredRef.current = true;
        void searchLiveCafesInBengaluru(moodMeta.searchHint, {
          locality: area || undefined,
          city: selectedCity,
        });
      }
    }
  }, [placesReady, searchParams, area, selectedCity, nearbyPlaces.length, searchLiveCafesInBengaluru]);

  const effectiveLocations = useMemo(
    () => locations.map((loc) => getEffectiveLocation(loc)),
    [locations, getEffectiveLocation]
  );

  const areaOptions = useMemo(() => {
    const merged = new Set<string>(BENGALURU_AREAS);
    locations.forEach((l) => {
      if (l.area) merged.add(l.area);
    });
    return Array.from(merged).sort();
  }, [locations]);

  const syncQueryParams = (updates: {
    q?: string;
    city?: string;
    area?: string;
    category?: string;
    bizCategory?: string;
    mood?: string;
    mode?: string;
    budget?: string;
  }) => {
    const next = new URLSearchParams(searchParams);
    const nextQ = updates.q !== undefined ? updates.q : query;
    const nextCity = updates.city !== undefined ? updates.city : selectedCity;
    const nextArea = updates.area !== undefined ? updates.area : area;
    const nextCat = updates.category !== undefined ? updates.category : categoryTab;
    const nextBiz = updates.bizCategory !== undefined ? updates.bizCategory : businessCategory;
    const nextMood = updates.mood !== undefined ? updates.mood : workMood;
    const nextMode = updates.mode !== undefined ? updates.mode : mode;
    const nextBudget = updates.budget !== undefined ? updates.budget : budget;

    if (nextQ.trim()) next.set('q', nextQ.trim());
    else next.delete('q');
    if (nextCity && nextCity !== 'Bengaluru') next.set('city', nextCity);
    else next.delete('city');
    if (nextArea) next.set('area', nextArea);
    else next.delete('area');
    if (nextCat && nextCat !== 'all') next.set('category', nextCat);
    else next.delete('category');
    if (nextBiz) next.set('bizCategory', nextBiz);
    else next.delete('bizCategory');
    if (nextMood) next.set('mood', nextMood);
    else next.delete('mood');
    if (nextMode) next.set('mode', nextMode);
    else next.delete('mode');
    if (nextBudget) next.set('budget', nextBudget);
    else next.delete('budget');
    setSearchParams(next, { replace: true });
  };

  const handleFindNearMe = async () => {
    const point = await requestUserLocation();
    if (point) {
      setSortBy('distance');
      setFocusCenter(point);
      const radiusMeters = maxDistanceKm > 0 ? maxDistanceKm * 1000 : 5000;
      void discoverCafesNear(point, 'Near You', radiusMeters, categoryTab || 'all');
    }
  };

  const handleDistanceChange = async (km: number) => {
    setMaxDistanceKm(km);
    if (km > 0 && !userLocation) {
      const point = await requestUserLocation();
      if (point) {
        setSortBy('distance');
        setFocusCenter(point);
        void discoverCafesNear(point, 'Near You', km * 1000, categoryTab || 'all');
      }
    } else if (km > 0 && userLocation) {
      setSortBy('distance');
      void discoverCafesNear(userLocation, 'Near You', km * 1000, categoryTab || 'all');
    }
  };

  const handleDiscoverAreaLive = async (targetArea?: string, targetCategory?: string) => {
    const label = (targetArea !== undefined ? targetArea : area) || selectedCity || 'Bengaluru';
    const center = await discoverCafesByAreaText(
      label,
      targetCategory !== undefined ? targetCategory : categoryTab || 'all',
      selectedCity
    );
    if (center) {
      setFocusCenter(center);
    }
  };

  const handleSelectCategoryTab = (nextCat: DiscoveryCategoryTabId) => {
    setCategoryTab(nextCat);
    setBusinessCategory('');
    setVisibleCuratedCount(9);
    syncQueryParams({ category: nextCat, bizCategory: '' });
    const tabMeta = DISCOVERY_CATEGORY_TABS.find((t) => t.id === nextCat);
    if (tabMeta) {
      void searchLiveCafesInBengaluru(tabMeta.placesQuery, {
        category: nextCat,
        locality: area || undefined,
        city: selectedCity,
        radiusMeters: maxDistanceKm > 0 ? maxDistanceKm * 1000 : 5000,
      });
    }
  };

  const handleSelectWorkMood = (nextMood: WorkMoodId | '') => {
    const updated = workMood === nextMood ? '' : nextMood;
    setWorkMood(updated);
    setVisibleCuratedCount(9);
    syncQueryParams({ mood: updated });
    if (updated) {
      const meta = WORK_MOODS.find((m) => m.id === updated);
      if (meta) {
        void searchLiveCafesInBengaluru(meta.searchHint, {
          locality: area || undefined,
          city: selectedCity,
          radiusMeters: maxDistanceKm > 0 ? maxDistanceKm * 1000 : 5000,
        });
      }
    }
  };

  const resetAll = () => {
    setQuery('');
    setSelectedCity('Bengaluru');
    setArea('');
    setCategoryTab('all');
    setBusinessCategory('');
    setWorkMood('');
    setMode('');
    setBudget('');
    setMaxDistanceKm(0);
    setMinWifi(0);
    setMinRating(0);
    setWifiOnly(false);
    setLaptopFriendlyOnly(false);
    setSocketsOnly(false);
    setQuietOnly(false);
    setComfortableOnly(false);
    setStudyOnly(false);
    setWorkOnly(false);
    setMeetingOnly(false);
    setTeaCoffeeOnly(false);
    setBakerySnacksOnly(false);
    setBurgersSandwichesOnly(false);
    setOpenNowOnly(false);
    setVerifiedOnly(false);
    setOutdoorOnly(false);
    setCollectionFilter('');
    setAtmosphere('any');
    setSortBy('featured');
    setFocusCenter(null);
    setVisibleCuratedCount(9);
    try {
      sessionStorage.removeItem(FILTERS_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setSearchParams({}, { replace: true });
  };

  const filteredLocations = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = effectiveLocations.filter((loc) => {
      if (selectedCity && selectedCity !== 'All India') {
        const cityHay = `${loc.city} ${loc.address}`.toLowerCase();
        if (!cityHay.includes(selectedCity.toLowerCase())) return false;
      }
      if (area) {
        const hayArea = `${loc.area} ${loc.address}`.toLowerCase();
        if (!hayArea.includes(area.toLowerCase())) return false;
      }
      if (categoryTab && categoryTab !== 'all' && !matchesDiscoveryCategoryTab(loc, categoryTab)) {
        return false;
      }
      if (businessCategory) {
        const bizMeta = DISCOVERY_BUSINESS_CATEGORIES.find((b) => b.id === businessCategory);
        if (bizMeta && !matchesDiscoveryCategoryTab(loc, bizMeta.tabId)) {
          return false;
        }
      }
      if (workMood && !matchesWorkMood(loc, workMood)) {
        return false;
      }
      if (mode && !loc.modes.includes(mode as CafeMode)) return false;
      if (canViewPricing && budget && !matchesBudgetBracket(loc.avg_cost_per_person, loc.price_range, budget)) {
        return false;
      }
      if (maxDistanceKm > 0 && userLocation) {
        if (loc.distanceKm === null || loc.distanceKm > maxDistanceKm) return false;
      }
      if (canViewWifi && wifiOnly) {
        const hasWifi = loc.wifi_available === 'yes' || (loc.wifi_mbps !== null && loc.wifi_mbps > 0);
        if (!hasWifi) return false;
      }
      if (canViewWifi && minWifi > 0 && (loc.wifi_mbps === null || loc.wifi_mbps < minWifi)) return false;
      if (minRating > 0 && (loc.rating === null || loc.rating < minRating)) return false;

      if (canViewWorkspace && laptopFriendlyOnly && !loc.laptop_friendly) return false;
      if (canViewSockets && socketsOnly) {
        const hasPlugs =
          loc.charging_sockets === 'yes' ||
          loc.sockets_claimed ||
          (loc.sockets_count !== null && loc.sockets_count > 0);
        if (!hasPlugs) return false;
      }
      if (canViewWorkspace && quietOnly && (loc.noise_level === null || loc.noise_level > 2)) return false;
      if (canViewWorkspace && atmosphere === 'quiet' && (loc.noise_level === null || loc.noise_level > 2)) return false;
      if (
        canViewWorkspace &&
        atmosphere === 'lively' &&
        (loc.noise_level === null || loc.noise_level < 3) &&
        !loc.modes.includes('plan')
      ) {
        return false;
      }
      if (outdoorOnly && !isOutdoorFriendly(loc)) return false;
      if (collectionFilter === 'dates' && !isGoodForDates(loc)) return false;
      if (collectionFilter === 'hidden-gems' && !isHiddenGem(loc)) return false;
      if (collectionFilter === 'trending' && !isTrendingCafe(loc)) return false;
      if (collectionFilter === 'outdoor' && !isOutdoorFriendly(loc)) return false;

      if (canViewWorkspace && comfortableOnly && loc.comfortable_seating !== 'yes') return false;
      if (canViewWorkspace && studyOnly && loc.suitable_for_studying !== 'yes' && !loc.modes.includes('calm')) {
        return false;
      }
      if (canViewWorkspace && workOnly && loc.suitable_for_working !== 'yes' && !loc.modes.includes('work')) {
        return false;
      }

      const itemText = [
        loc.category || '',
        loc.popular_items.join(' '),
        loc.best_for.join(' '),
        loc.claims.join(' '),
        loc.description,
        loc.verdict,
      ].join(' ');

      if (
        canViewWorkspace &&
        meetingOnly &&
        !loc.modes.includes('plan') &&
        !/meeting|meetup|friend|catchup|hangout|conversation|discussion|group/i.test(itemText)
      ) {
        return false;
      }
      if (
        canViewPricing &&
        teaCoffeeOnly &&
        !loc.tea_price &&
        !loc.coffee_price &&
        !/tea|chai|coffee|espresso|cappuccino|latte|kaapi|brew|mocha|americano/i.test(itemText)
      ) {
        return false;
      }
      if (
        canViewPricing &&
        bakerySnacksOnly &&
        !loc.snacks_price &&
        !/puff|croissant|cake|pastry|pastries|bakery|bun|toast|muffin|fries|maggi|snack|cookie|biscuit|donut|waffle|samosa|vada|pakoda|dilpasand|khara/i.test(
          itemText
        )
      ) {
        return false;
      }
      if (
        canViewPricing &&
        burgersSandwichesOnly &&
        !/burger|sandwich|toastie|panini|roll|sub|slider/i.test(itemText)
      ) {
        return false;
      }

      if (openNowOnly && !isCafeOpenNow(loc.timings)) return false;
      if (verifiedOnly && !loc.verified) return false;

      if (q) {
        const hay = [
          loc.name,
          loc.category || '',
          loc.area,
          loc.city,
          loc.address,
          loc.verdict,
          loc.description,
          loc.claims.join(' '),
          loc.popular_items.join(' '),
          loc.facilities.join(' '),
          loc.source_name,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'distance' && userLocation) {
        return (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER);
      }
      if (sortBy === 'rating') return (b.rating ?? -1) - (a.rating ?? -1);
      if (sortBy === 'reviews') return (b.rating_count ?? -1) - (a.rating_count ?? -1);
      if (sortBy === 'wifi' && canViewWifi) return (b.wifi_mbps ?? -1) - (a.wifi_mbps ?? -1);
      if (sortBy === 'cheapest' && canViewPricing) {
        return (
          (a.avg_cost_per_person ?? Number.MAX_SAFE_INTEGER) -
          (b.avg_cost_per_person ?? Number.MAX_SAFE_INTEGER)
        );
      }
      if (sortBy === 'quietest' && canViewWorkspace) return (a.noise_level ?? 99) - (b.noise_level ?? 99);
      if (sortBy === 'recent') {
        const da = a.last_verified_date ? Date.parse(a.last_verified_date) || 0 : 0;
        const db = b.last_verified_date ? Date.parse(b.last_verified_date) || 0 : 0;
        return db - da;
      }
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [
    effectiveLocations,
    canViewPricing,
    canViewWifi,
    canViewSockets,
    canViewWorkspace,
    selectedCity,
    area,
    categoryTab,
    businessCategory,
    workMood,
    mode,
    budget,
    maxDistanceKm,
    userLocation,
    wifiOnly,
    minWifi,
    minRating,
    laptopFriendlyOnly,
    socketsOnly,
    quietOnly,
    atmosphere,
    outdoorOnly,
    collectionFilter,
    comfortableOnly,
    studyOnly,
    workOnly,
    meetingOnly,
    teaCoffeeOnly,
    bakerySnacksOnly,
    burgersSandwichesOnly,
    openNowOnly,
    verifiedOnly,
    query,
    sortBy,
  ]);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cafedesk.space';
  useDocumentMeta(settings.seo_locations_title, settings.seo_locations_description, {
    canonicalPath: '/discover',
    ogImage: settings.seo_og_image,
    allowIndexing: settings.seo_allow_indexing,
    googleSiteVerification: settings.google_site_verification,
    schemas: [
      buildBreadcrumbSchema(origin, [
        { name: 'Home', path: '/' },
        { name: 'Discover Cafes', path: '/discover' },
      ]),
      buildItemListSchema(
        origin,
        'Bengaluru Cafes & Workspaces',
        settings.seo_locations_description,
        filteredLocations
      ),
    ],
  });

  const paginatedCuratedLocations = useMemo(
    () => filteredLocations.slice(0, visibleCuratedCount),
    [filteredLocations, visibleCuratedCount]
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (!placesReady || trimmed.length < 3 || filteredLocations.length > 0) return;
    if (nearbyLabel.trim().toLowerCase() === trimmed.toLowerCase()) return;

    const timer = window.setTimeout(() => {
      void searchLiveCafesInBengaluru(trimmed, {
        category: categoryTab || undefined,
        locality: area || undefined,
        city: selectedCity,
      });
    }, 550);
    return () => window.clearTimeout(timer);
  }, [
    placesReady,
    query,
    filteredLocations.length,
    nearbyLabel,
    categoryTab,
    area,
    selectedCity,
    searchLiveCafesInBengaluru,
  ]);

  const filteredGooglePlaces = useMemo(() => {
    const curatedAsKeys = filteredLocations.map((l) => ({
      id: l.id,
      place_id: l.place_id,
      name: l.name,
      area: l.area,
      lat: l.lat,
      lng: l.lng,
    }));
    const liveAsLocations = nearbyPlaces
      .filter((gc) => {
        if (maxDistanceKm > 0 && gc.distanceKm !== null && gc.distanceKm > maxDistanceKm) {
          return false;
        }
        if (minRating > 0 && (gc.rating === null || gc.rating < minRating)) return false;
        return true;
      })
      .map((gc) => ({
        gc,
        item: googleDiscoveryToLocationItem(gc),
      }));

    // Deduplicate live Google results against curated locations
    const merged = deduplicateCafeItems(
      curatedAsKeys,
      liveAsLocations.map((x) => ({
        id: x.item.id,
        place_id: x.item.place_id,
        name: x.item.name,
        area: x.item.area,
        lat: x.item.lat,
        lng: x.item.lng,
      }))
    );
    const allowedLiveIds = new Set(merged.slice(curatedAsKeys.length).map((m) => m.id));

    return liveAsLocations
      .filter((x) => allowedLiveIds.has(x.item.id))
      .map((x) => x.gc)
      .sort((a, b) => {
        if (sortBy === 'distance' && userLocation) {
          return (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER);
        }
        if (sortBy === 'rating') return (b.rating ?? -1) - (a.rating ?? -1);
        if (sortBy === 'reviews') return (b.ratingCount ?? -1) - (a.ratingCount ?? -1);
        return 0;
      });
  }, [nearbyPlaces, filteredLocations, maxDistanceKm, minRating, sortBy, userLocation]);

  const filterControlsBody = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#e6ddd0]">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: '', label: 'All Cafes' },
            { id: 'trending', label: 'Trending' },
            { id: 'hidden-gems', label: 'Hidden Gems' },
            { id: 'outdoor', label: 'Outdoor Corners' },
            { id: 'dates', label: 'Dates & Catchups' },
          ].map((colChip) => (
            <button
              key={colChip.id || 'all'}
              type="button"
              onClick={() => setCollectionFilter(colChip.id)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                collectionFilter === colChip.id
                  ? 'bg-[#1c1613] text-white border-[#1c1613]'
                  : 'bg-[#faf7f2] text-[#5c4e45] border-[#e6ddd0] hover:border-[#b45309] hover:text-[#1c1613]'
              }`}
            >
              {colChip.label}
            </button>
          ))}
        </div>
        <Link
          to="/finder"
          className="text-xs font-semibold text-[#b45309] hover:underline whitespace-nowrap"
        >
          Need tailored picks? Open Cafe Finder &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="sm:col-span-2">
          <label htmlFor="loc-q" className="block text-xs font-medium text-[#5c4e45] mb-1.5">
            Search cafe, tea stall, bakery, snacks, street, or locality
          </label>
          <div className="flex gap-2 items-center">
            <div className="flex-1 min-w-0">
              <CafeAutocompleteSearch
                id="loc-q"
                value={query}
                onChange={(val) => {
                  setQuery(val);
                  syncQueryParams({ q: val });
                }}
                onSubmitQuery={(q) => {
                  trackAnalyticsEvent('search_query', {
                    query: q,
                    city: selectedCity,
                    area: area || 'all',
                  });
                  void searchLiveCafesInBengaluru(q, {
                    category: categoryTab || undefined,
                    locality: area || undefined,
                    city: selectedCity,
                  });
                }}
                placeholder="Search Coffee, Tea, Indiranagar, Koramangala, Bakery..."
              />
            </div>
            <button
              type="button"
              disabled={nearbyLoading}
              onClick={() => {
                const liveQ =
                  query.trim() ||
                  DISCOVERY_CATEGORY_TABS.find((t) => t.id === categoryTab)?.placesQuery ||
                  'cafes coffee tea';
                trackAnalyticsEvent('search_query', {
                  query: liveQ,
                  city: selectedCity,
                  area: area || 'all',
                });
                void searchLiveCafesInBengaluru(liveQ, {
                  category: categoryTab || undefined,
                  locality: area || undefined,
                  city: selectedCity,
                });
              }}
              className="h-12 px-4 rounded-xl bg-[#1b4d3e] hover:bg-[#133a2e] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{nearbyLoading ? 'Searching...' : 'Search Live'}</span>
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="loc-city" className="block text-xs font-medium text-[#5c4e45] mb-1.5">
            City / Region
          </label>
          <select
            id="loc-city"
            value={selectedCity}
            onChange={(e) => {
              setSelectedCity(e.target.value);
              syncQueryParams({ city: e.target.value });
            }}
            className="w-full h-12 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
          >
            {SUPPORTED_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="All India">Any Indian City</option>
          </select>
        </div>

        <div>
          <label htmlFor="loc-area" className="block text-xs font-medium text-[#5c4e45] mb-1.5">
            Locality / Area (or type any location)
          </label>
          <input
            id="loc-area"
            list="cafedesk-area-options"
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              syncQueryParams({ area: e.target.value });
            }}
            placeholder="e.g. Indiranagar, Whitefield..."
            className="w-full h-12 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
          />
          <datalist id="cafedesk-area-options">
            {areaOptions.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor="loc-biz-cat" className="block text-xs font-medium text-[#5c4e45] mb-1.5">
            Place Category (13 Local Types)
          </label>
          <select
            id="loc-biz-cat"
            value={businessCategory}
            onChange={(e) => {
              const nextBiz = e.target.value as DiscoveryBusinessCategoryId | '';
              setBusinessCategory(nextBiz);
              const meta = DISCOVERY_BUSINESS_CATEGORIES.find((b) => b.id === nextBiz);
              if (meta) {
                setCategoryTab(meta.tabId);
                syncQueryParams({ bizCategory: nextBiz, category: meta.tabId });
                void searchLiveCafesInBengaluru(meta.placesQuery, {
                  category: meta.tabId,
                  locality: area || undefined,
                  city: selectedCity,
                });
              } else {
                syncQueryParams({ bizCategory: '' });
              }
            }}
            className="w-full h-12 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
          >
            <option value="">All 13 Place Categories</option>
            {DISCOVERY_BUSINESS_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="loc-dist" className="block text-xs font-medium text-[#5c4e45] mb-1.5">
            Smart Nearby Radius
          </label>
          <select
            id="loc-dist"
            value={maxDistanceKm}
            onChange={(e) => handleDistanceChange(Number(e.target.value))}
            className="w-full h-12 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
          >
            <option value={0}>Any distance</option>
            <option value={1}>Within 1 km</option>
            <option value={3}>Within 3 km</option>
            <option value={5}>Within 5 km</option>
            <option value={10}>Within 10 km</option>
          </select>
        </div>

        <div>
          <label htmlFor="loc-mode" className="block text-xs font-medium text-[#5c4e45] mb-1.5">
            Purpose / Atmosphere
          </label>
          <select
            id="loc-mode"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              syncQueryParams({ mode: e.target.value });
            }}
            className="w-full h-12 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
          >
            <option value="">Any purpose</option>
            {BROWSING_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="loc-budget"
            className="flex items-center justify-between text-xs font-medium text-[#5c4e45] mb-1.5"
          >
            <span>Budget Per Person</span>
            {!canViewPricing && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#b45309]">
                <Lock className="w-3 h-3" aria-hidden="true" />
                {isExpired ? 'Expired' : 'Subscribers'}
              </span>
            )}
          </label>
          <select
            id="loc-budget"
            value={canViewPricing ? budget : ''}
            onChange={(e) => {
              if (!canViewPricing) {
                openUpgradeModal({
                  featureName: 'Budget Per Person Filter',
                  requiredPlan: 'plus',
                  description:
                    'Filter cafes by average spend per person and compare full food & beverage prices with an active Cafe Desk subscription.',
                });
                return;
              }
              const val = e.target.value as BudgetBracketId | '';
              setBudget(val);
              syncQueryParams({ budget: val });
            }}
            className="w-full h-12 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
          >
            <option value="">Any budget</option>
            {BUDGET_BRACKETS.map((b) => (
              <option key={b.id} value={b.id}>
                {canViewPricing ? b.label : `🔒 ${b.label}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="loc-wifi"
            className="flex items-center justify-between text-xs font-medium text-[#5c4e45] mb-1.5"
          >
            <span>Minimum Wi-Fi Speed</span>
            {!canViewWifi && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#b45309]">
                <Lock className="w-3 h-3" aria-hidden="true" />
                {isExpired ? 'Expired' : 'Subscribers'}
              </span>
            )}
          </label>
          <select
            id="loc-wifi"
            value={canViewWifi ? minWifi : 0}
            onChange={(e) => {
              if (!canViewWifi) {
                openUpgradeModal({
                  featureName: 'Minimum Wi-Fi Speed Filter',
                  requiredPlan: 'plus',
                  description:
                    'Filter cafes by measured Wi-Fi speeds (50+, 80+, 100+ Mbps) with an active Cafe Desk subscription.',
                });
                return;
              }
              setMinWifi(Number(e.target.value));
            }}
            className="w-full h-12 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
          >
            <option value={0}>Any speed</option>
            <option value={50}>{canViewWifi ? '50+ Mbps (Measured)' : '🔒 50+ Mbps (Subscribers)'}</option>
            <option value={80}>{canViewWifi ? '80+ Mbps (Measured)' : '🔒 80+ Mbps (Subscribers)'}</option>
            <option value={100}>{canViewWifi ? '100+ Mbps (Measured)' : '🔒 100+ Mbps (Subscribers)'}</option>
          </select>
        </div>

        <div>
          <label htmlFor="loc-rating" className="block text-xs font-medium text-[#5c4e45] mb-1.5">
            Google Rating
          </label>
          <select
            id="loc-rating"
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            className="w-full h-12 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
          >
            <option value={0}>Any rating</option>
            <option value={4.0}>4.0+ stars</option>
            <option value={4.5}>4.5+ stars</option>
          </select>
        </div>
      </div>

      {/* Amenity & Suitability Filter Chips */}
      <div className="pt-3 border-t border-[#e6ddd0] space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'Laptop-friendly', checked: laptopFriendlyOnly, onChange: setLaptopFriendlyOnly, allowed: canViewWorkspace },
            { label: 'Comfortable seating', checked: comfortableOnly, onChange: setComfortableOnly, allowed: canViewWorkspace },
            { label: 'Suitable for studying', checked: studyOnly, onChange: setStudyOnly, allowed: canViewWorkspace },
            { label: 'Quiet environment', checked: quietOnly, onChange: setQuietOnly, allowed: canViewWorkspace },
            { label: 'Charging sockets', checked: socketsOnly, onChange: setSocketsOnly, allowed: canViewSockets },
            { label: 'Outdoor seating', checked: outdoorOnly, onChange: setOutdoorOnly, allowed: true },
            { label: 'Wi-Fi available', checked: wifiOnly, onChange: setWifiOnly, allowed: canViewWifi },
            { label: 'Suitable for working', checked: workOnly, onChange: setWorkOnly, allowed: canViewWorkspace },
            { label: 'Meeting-friendly', checked: meetingOnly, onChange: setMeetingOnly, allowed: canViewWorkspace },
            { label: 'Tea & coffee', checked: teaCoffeeOnly, onChange: setTeaCoffeeOnly, allowed: canViewPricing },
            { label: 'Bakery & snacks', checked: bakerySnacksOnly, onChange: setBakerySnacksOnly, allowed: canViewPricing },
            { label: 'Burgers & sandwiches', checked: burgersSandwichesOnly, onChange: setBurgersSandwichesOnly, allowed: canViewPricing },
            { label: 'Open now', checked: openNowOnly, onChange: setOpenNowOnly, allowed: true },
            { label: 'Verified in person', checked: verifiedOnly, onChange: setVerifiedOnly, allowed: true },
          ].map((item) => {
            const locked = !item.allowed;
            const active = !locked && item.checked;
            return (
              <button
                key={item.label}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (locked) {
                    openUpgradeModal({
                      featureName: `${item.label} Filter`,
                      requiredPlan: 'plus',
                    });
                    return;
                  }
                  item.onChange(!item.checked);
                }}
                className={`inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-[#1b4d3e] text-white border-[#1b4d3e]'
                    : 'bg-[#faf7f2] text-[#5c4e45] border-[#e6ddd0] hover:border-[#b45309] hover:text-[#1c1613]'
                }`}
              >
                {locked && <Lock className="w-3 h-3 text-[#b45309]" aria-hidden="true" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
          <select
            aria-label="Atmosphere vibe"
            value={canViewWorkspace ? atmosphere : 'any'}
            onChange={(e) => {
              if (!canViewWorkspace) {
                openUpgradeModal({
                  featureName: 'Atmosphere & Noise Filters',
                  requiredPlan: 'plus',
                });
                return;
              }
              setAtmosphere(e.target.value as 'any' | 'quiet' | 'lively');
            }}
            className="h-10 px-3.5 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-xs font-medium text-[#1c1613]"
          >
            <option value="any">Any Vibe</option>
            <option value="quiet">{canViewWorkspace ? 'Quiet Acoustics' : '🔒 Quiet Acoustics (Plus)'}</option>
            <option value="lively">{canViewWorkspace ? 'Lively Buzz' : '🔒 Lively Buzz (Plus)'}</option>
          </select>

          <label htmlFor="loc-sort" className="text-xs font-medium text-[#5c4e45]">
            Sort by
          </label>
          <select
            id="loc-sort"
            value={sortBy}
            onChange={(e) => {
              const nextSort = e.target.value as SortOption;
              if (nextSort === 'wifi' && !canViewWifi) {
                openUpgradeModal({ featureName: 'Sort by Fastest Wi-Fi', requiredPlan: 'plus' });
                return;
              }
              if (nextSort === 'cheapest' && !canViewPricing) {
                openUpgradeModal({ featureName: 'Sort by Lowest Budget', requiredPlan: 'plus' });
                return;
              }
              if (nextSort === 'quietest' && !canViewWorkspace) {
                openUpgradeModal({ featureName: 'Sort by Quietest First', requiredPlan: 'plus' });
                return;
              }
              setSortBy(nextSort);
            }}
            className="h-10 px-3.5 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-xs sm:text-sm font-semibold text-[#1c1613]"
          >
            <option value="distance" disabled={!userLocation}>
              Nearest First {!userLocation ? '(Requires GPS)' : ''}
            </option>
            <option value="featured">Recommended</option>
            <option value="rating">Highest Rated</option>
            <option value="reviews">Most Reviewed</option>
            <option value="wifi">{canViewWifi ? 'Fastest Wi-Fi' : '🔒 Fastest Wi-Fi (Plus)'}</option>
            <option value="cheapest">{canViewPricing ? 'Budget Friendly' : '🔒 Budget Friendly (Plus)'}</option>
            <option value="quietest">{canViewWorkspace ? 'Quietest First' : '🔒 Quietest First (Plus)'}</option>
            <option value="recent">Recently Verified</option>
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5 sm:space-y-6">
      {/* Header + GPS & View Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#e6ddd0] pb-5 sm:pb-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
            <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Bengaluru Cafe Discovery</span>
          </div>
          <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#1c1613]">
            Find cafes in Bengaluru
          </h1>
          <p className="text-xs sm:text-base text-[#5c4e45]">
            Compare neighbourhood coffee spots, Wi-Fi workspaces, live distance, charging sockets,
            and official menus.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleFindNearMe}
            disabled={geoStatus === 'requesting'}
            className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-[#1b4d3e] hover:bg-[#133a2e] disabled:opacity-60 text-white text-xs font-semibold transition-colors"
          >
            <LocateFixed className="w-4 h-4" aria-hidden="true" />
            <span>
              {geoStatus === 'requesting'
                ? 'Detecting...'
                : userLocation
                ? 'Refresh GPS'
                : 'Find Near Me'}
            </span>
          </button>

          <div
            role="group"
            aria-label="View mode"
            className="inline-flex items-center p-1 rounded-xl bg-[#f3ede3] border border-[#e6ddd0]"
          >
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`hidden lg:inline-flex items-center gap-1 min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'split'
                  ? 'bg-white text-[#1c1613] shadow-xs'
                  : 'text-[#5c4e45] hover:text-[#1c1613]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1 min-h-[36px] px-3.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-[#1c1613] shadow-xs'
                  : 'text-[#5c4e45] hover:text-[#1c1613]'
              }`}
            >
              <List className="w-3.5 h-3.5" aria-hidden="true" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`inline-flex items-center gap-1 min-h-[36px] px-3.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'map'
                  ? 'bg-white text-[#1c1613] shadow-xs'
                  : 'text-[#5c4e45] hover:text-[#1c1613]'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Map</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="md:hidden inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-[#b45309] text-white text-xs font-semibold"
          >
            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            <span>Filters</span>
          </button>

          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#e6ddd0] text-xs font-semibold text-[#5c4e45] hover:text-[#1c1613]"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Mobile Always-Accessible Search Bar */}
      <div className="md:hidden space-y-2.5">
        <CafeAutocompleteSearch
          id="loc-q-mobile"
          value={query}
          onChange={(val) => {
            setQuery(val);
            syncQueryParams({ q: val });
          }}
          onSubmitQuery={(q) =>
            void searchLiveCafesInBengaluru(q, {
              category: categoryTab || undefined,
              locality: area || undefined,
              city: selectedCity,
            })
          }
          placeholder="Search coffee, tea stall, bakery, Indiranagar..."
          inputClassName="w-full h-12 pl-10 pr-10 rounded-xl border border-[#d6cbba] bg-white text-sm text-[#1c1613] shadow-xs"
        />
      </div>

      {/* Top Category Bar (Vertical Wrapping Grid — Zero Horizontal Carousel) */}
      <div className="space-y-3 bg-white rounded-2xl border border-[#e6ddd0] p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#b45309]">
            Local Discovery Categories
          </span>
          <span className="text-[11px] text-[#5c4e45]">
            {selectedCity} {area ? `· ${area}` : ''}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {DISCOVERY_CATEGORY_TABS.map((tab) => {
            const active = (categoryTab || 'all') === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectCategoryTab(tab.id)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-[#1c1613] text-white border-[#1c1613]'
                    : 'bg-[#faf7f2] text-[#5c4e45] border-[#e6ddd0] hover:border-[#b45309] hover:text-[#1c1613]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Find My Work Mood + Budget Finder Row */}
        <div className="pt-2.5 border-t border-[#e6ddd0] flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1b4d3e] mr-1">
            Work Mood:
          </span>
          {WORK_MOODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleSelectWorkMood(m.id)}
              className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                workMood === m.id
                  ? 'bg-[#1b4d3e] text-white border-[#1b4d3e]'
                  : 'bg-white text-[#5c4e45] border-[#e6ddd0] hover:border-[#1b4d3e] hover:text-[#1c1613]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="pt-2.5 border-t border-[#e6ddd0] flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5c4e45] mr-1">
            Budget:
          </span>
          {BUDGET_BRACKETS.map((b) => {
            const active = canViewPricing && budget === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  if (!canViewPricing) {
                    openUpgradeModal({ featureName: 'Budget Per Person Filter', requiredPlan: 'plus' });
                    return;
                  }
                  const next = budget === b.id ? '' : b.id;
                  setBudget(next);
                  syncQueryParams({ budget: next });
                }}
                className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-[#b45309] text-white border-[#b45309]'
                    : 'bg-white text-[#5c4e45] border-[#e6ddd0] hover:border-[#b45309] hover:text-[#1c1613]'
                }`}
              >
                {canViewPricing ? b.label : `🔒 ${b.label}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Places Notice / Key Status Alert */}
      {placesNotice && (
        <div
          role="status"
          className="px-4 py-3 rounded-2xl border border-[#fde68a] bg-[#fffbeb] text-[#92400e] text-xs flex flex-wrap items-center justify-between gap-2"
        >
          <span className="font-medium">{placesNotice}</span>
          <button
            type="button"
            onClick={clearPlacesNotice}
            className="font-semibold underline underline-offset-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Expired / Suspended Subscription Banner */}
      {(isExpired || isSuspended) && (
        <div
          role="alert"
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isSuspended
              ? 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
              : 'bg-[#fffbeb] border-[#fde68a] text-[#92400e]'
          }`}
        >
          <div className="flex items-start gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-sm">
                {isSuspended
                  ? 'Your subscription access is suspended'
                  : 'Your subscription has expired'}
              </p>
              <p className="opacity-90 mt-0.5">
                {isSuspended
                  ? 'Premium Wi-Fi, socket, menu, and booking details are locked. Contact support or visit Account for status.'
                  : `${expiredPlanName || 'Your Cafe Desk plan'} has ended. Renew your subscription to unlock Wi-Fi details, sockets, menus, pricing filters, and bookings.`}
              </p>
            </div>
          </div>
          {isExpired ? (
            <button
              type="button"
              onClick={() => openCheckout(subscription?.expired_from_plan || 'plus')}
              className="shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Renew Subscription</span>
            </button>
          ) : (
            <Link
              to="/account"
              className="shrink-0 inline-flex items-center min-h-[40px] px-4 py-2 rounded-xl bg-[#1c1613] text-white text-xs font-semibold"
            >
              View Account
            </Link>
          )}
        </div>
      )}

      {/* GPS Status Banner */}
      {(userLocation || geoError) && (
        <div
          className={`px-4 py-3 rounded-2xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
            geoError
              ? 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
              : 'bg-[#ecfdf5] border-[#a7f3d0] text-[#1b4d3e]'
          }`}
        >
          <span className="font-medium">
            {geoError
              ? geoError
              : 'GPS location active — showing distances in km and nearby Bengaluru cafes.'}
          </span>
          {userLocation && (
            <button
              type="button"
              onClick={clearUserLocation}
              className="font-semibold underline underline-offset-4"
            >
              Clear GPS filter
            </button>
          )}
        </div>
      )}

      {/* Desktop Inline Filter Panel */}
      <section
        aria-label="Cafe discovery filters"
        className="hidden md:block bg-white rounded-2xl border border-[#e6ddd0] p-5"
      >
        {filterControlsBody}
      </section>

      {/* Mobile Slide-Up Filter Sheet Modal */}
      {mobileFiltersOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filter Bengaluru cafes"
          className="md:hidden fixed inset-0 z-50 bg-[#1c1613]/60 backdrop-blur-xs flex items-end justify-center"
          onClick={() => setMobileFiltersOpen(false)}
        >
          <div
            className="w-full max-h-[88vh] flex flex-col rounded-t-3xl bg-white border-t border-[#e6ddd0] shadow-2xl animate-sheet-up pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-2.5 pb-1 flex justify-center">
              <span className="w-10 h-1 rounded-full bg-[#d6cbba]" />
            </div>
            <div className="px-5 py-3 border-b border-[#e6ddd0] flex items-center justify-between gap-3">
              <div>
                <h2 className="font-serif-display text-lg font-bold text-[#1c1613]">
                  Filter Bengaluru Cafes
                </h2>
                <p className="text-xs text-[#5c4e45]">
                  Refine by neighbourhood, budget, Wi-Fi, or seating
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
                className="w-9 h-9 rounded-lg border border-[#e6ddd0] bg-[#faf7f2] text-[#1c1613] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">{filterControlsBody}</div>
            <div className="px-5 py-3.5 border-t border-[#e6ddd0] bg-[#faf7f2] flex items-center gap-3">
              <button
                type="button"
                onClick={resetAll}
                className="min-h-[44px] px-4 rounded-xl bg-white border border-[#e6ddd0] text-xs font-semibold text-[#1c1613]"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors"
              >
                Show {filteredLocations.length}{' '}
                {filteredLocations.length === 1 ? 'Cafe' : 'Cafes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary + Live Area Discovery Trigger */}
      <h2 className="sr-only">Curated Bengaluru Cafes and Workspaces</h2>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#5c4e45]">
        <p>
          Showing{' '}
          <strong className="text-[#1c1613] font-mono-data">{filteredLocations.length}</strong>{' '}
          curated {filteredLocations.length === 1 ? 'cafe' : 'cafes'}
          {area ? ` in ${area}` : ' across Bengaluru'}
          {filteredGooglePlaces.length > 0 && (
            <>
              {' '}
              +{' '}
              <strong className="text-[#1b4d3e] font-mono-data">
                {filteredGooglePlaces.length}
              </strong>{' '}
              live on Google Maps
            </>
          )}
        </p>

        <button
          type="button"
          disabled={nearbyLoading}
          onClick={() => handleDiscoverAreaLive()}
          className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white border border-[#e6ddd0] hover:border-[#b45309] text-xs font-semibold text-[#1c1613] transition-colors"
        >
          <MapPin className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
          <span>
            {nearbyLoading
              ? 'Loading live cafes...'
              : `Discover live cafes in ${area || 'Bengaluru'} via Google Maps`}
          </span>
        </button>
      </div>

      {/* Main Split / List / Map Workspace */}
      {viewMode === 'map' && (
        <InteractiveCafeMap
          curatedLocations={filteredLocations}
          googleCafes={filteredGooglePlaces}
          userLocation={userLocation}
          focusCenter={focusCenter}
          selectedArea={area}
          onSelectArea={(val) => {
            setArea(val);
            syncQueryParams({ area: val });
          }}
          onRequestNearMe={handleFindNearMe}
          onSearchThisArea={(center) => {
            setFocusCenter(center);
            void discoverCafesNear(center, 'Map Area', 4000, categoryTab || 'all');
          }}
          heightClassName="h-[62vh] min-h-[420px] sm:h-[560px]"
        />
      )}

      {viewMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-6">
            {filteredLocations.length === 0 ? (
              nearbyLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <CardSkeletonPlaceholder />
                  <CardSkeletonPlaceholder />
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#e6ddd0] p-10 text-center space-y-3">
                  <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
                    No curated cafes match these filters
                  </h2>
                  <p className="text-sm text-[#5c4e45]">
                    Try relaxing your Wi-Fi speed or amenity filters, or search live cafes in{' '}
                    {area || 'this neighbourhood'} via Google Maps.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={resetAll}
                      className="min-h-[44px] px-5 py-2 rounded-xl bg-[#1c1613] text-white text-xs font-semibold"
                    >
                      Clear all filters
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDiscoverAreaLive()}
                      className="min-h-[44px] px-5 py-2 rounded-xl bg-[#1b4d3e] text-white text-xs font-semibold"
                    >
                      Discover live cafes in {area || 'Bengaluru'}
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {paginatedCuratedLocations.map((loc) => (
                    <LocationCard key={loc.id} location={loc} />
                  ))}
                </div>
                {filteredLocations.length > paginatedCuratedLocations.length && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCuratedCount((c) => c + 9)}
                      className="min-h-[44px] px-6 py-2.5 rounded-xl bg-white border border-[#d6cbba] hover:border-[#b45309] text-xs sm:text-sm font-semibold text-[#1c1613]"
                    >
                      Show More Curated Cafes ({filteredLocations.length - paginatedCuratedLocations.length} more)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 lg:sticky lg:top-20">
            <InteractiveCafeMap
              curatedLocations={filteredLocations}
              googleCafes={filteredGooglePlaces}
              userLocation={userLocation}
              focusCenter={focusCenter}
              selectedArea={area}
              onSelectArea={(val) => {
                setArea(val);
                syncQueryParams({ area: val });
              }}
              onRequestNearMe={handleFindNearMe}
              onSearchThisArea={(center) => {
                setFocusCenter(center);
                void discoverCafesNear(center, 'Map Area', 4000, categoryTab || 'all');
              }}
              heightClassName="h-[540px]"
            />
          </div>
        </div>
      )}

      {viewMode === 'list' &&
        (filteredLocations.length === 0 ? (
          nearbyLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <CardSkeletonPlaceholder />
              <CardSkeletonPlaceholder />
              <CardSkeletonPlaceholder />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#e6ddd0] p-12 text-center space-y-3">
              <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
                No curated cafes match these filters
              </h2>
              <p className="text-sm text-[#5c4e45]">
                Try relaxing your minimum Wi-Fi or budget filters, or inspect live Google Places results below.
              </p>
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] text-white text-sm font-semibold"
              >
                Clear all filters
              </button>
            </div>
          )
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedCuratedLocations.map((loc) => (
                <LocationCard key={loc.id} location={loc} />
              ))}
            </div>
            {filteredLocations.length > paginatedCuratedLocations.length && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCuratedCount((c) => c + 9)}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-white border border-[#d6cbba] hover:border-[#b45309] text-xs sm:text-sm font-semibold text-[#1c1613]"
                >
                  Show More Curated Cafes ({filteredLocations.length - paginatedCuratedLocations.length} more)
                </button>
              </div>
            )}
          </div>
        ))}

      {/* Skeleton Loader Row when Searching Live Google Places */}
      {nearbyLoading && filteredGooglePlaces.length === 0 && (
        <div className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <CardSkeletonPlaceholder />
          <CardSkeletonPlaceholder />
          <CardSkeletonPlaceholder />
        </div>
      )}

      {/* Live Google Maps Discovery Cards */}
      {filteredGooglePlaces.length > 0 && (
        <section
          aria-labelledby="nearby-google-heading"
          className="pt-8 border-t border-[#e6ddd0] space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#1b4d3e] mb-1">
                Live From Google Maps
              </p>
              <h2
                id="nearby-google-heading"
                className="font-serif-display text-2xl font-bold text-[#1c1613]"
              >
                Cafes across Bengaluru {nearbyLabel ? `for "${nearbyLabel}"` : 'nearby'}
              </h2>
            </div>
            <span className="text-xs text-[#5c4e45]">
              Work specs (Wi-Fi &amp; sockets) shown honestly as Not verified until field-audited
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredGooglePlaces.map((gc) => {
              const distText = formatDistanceKm(gc.distanceKm);
              const detailPath = getCafeDetailRoute(
                `google:${encodeURIComponent(gc.placeId)}`,
                authenticated
              );
              const locItem = googleDiscoveryToLocationItem(gc);
              const sourceMeta = getCafeSourceMeta(locItem);
              const directionsUrl = buildGoogleMapsDirectionsUrl(locItem);
              const snapshot = locationToLibrarySnapshot(locItem);
              const saved = isCafeSaved(snapshot.key);
              const favourited = isCafeFavourite(snapshot.key);
              const inCompare = compareList.some((c) => c.id === locItem.id);

              return (
                <article
                  key={gc.id}
                  className="bg-white rounded-2xl border border-[#e6ddd0] shadow-xs overflow-hidden flex flex-col justify-between hover:border-[#b45309]/40 transition-colors"
                >
                  <div>
                    <Link
                      to={detailPath}
                      className="block relative aspect-[16/10] bg-[#f3ede3] overflow-hidden"
                    >
                      {gc.photos[0] ? (
                        <>
                          <ResilientPhoto
                            src={gc.photos[0]}
                            alt={`${gc.name} in ${gc.areaLabel}`}
                            className="w-full h-full"
                            imgClassName="w-full h-full object-cover"
                          />
                          {gc.photos.length > 1 && (
                            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1c1613]/80 text-white text-[11px] font-mono-data font-medium">
                              <Images className="w-3 h-3 text-[#f59e0b]" aria-hidden="true" />
                              <span>{gc.photos.length}</span>
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full p-4 flex flex-col justify-between">
                          <span className="text-[11px] font-mono-data uppercase font-medium text-[#5c4e45]">
                            {gc.areaLabel} · Google Places
                          </span>
                          <p className="font-serif-display text-lg font-bold text-[#1c1613] line-clamp-1">
                            {gc.name}
                          </p>
                        </div>
                      )}
                      <span
                        className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${sourceMeta.badgeClass}`}
                      >
                        {sourceMeta.shortLabel}
                      </span>
                    </Link>

                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#1b4d3e] truncate">
                          {gc.areaLabel}
                          {gc.categoryLabel ? ` · ${gc.categoryLabel}` : ''}
                        </span>
                        {distText && (
                          <span className="inline-flex items-center gap-1 font-mono-data font-semibold text-[#1b4d3e] shrink-0">
                            <Navigation className="w-3 h-3" aria-hidden="true" />
                            {distText}
                          </span>
                        )}
                      </div>

                      <h3 className="font-serif-display text-lg font-bold text-[#1c1613] leading-snug">
                        <Link to={detailPath} className="hover:text-[#b45309] transition-colors">
                          {gc.name}
                        </Link>
                      </h3>

                      <p className="text-xs text-[#5c4e45] line-clamp-2">{gc.address}</p>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs pt-0.5">
                        {gc.rating !== null ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#1c1613]">
                            <Star
                              className="w-3.5 h-3.5 text-[#d97706] fill-[#d97706]"
                              aria-hidden="true"
                            />
                            <span className="font-mono-data">{gc.rating.toFixed(1)}</span>
                            {gc.ratingCount !== null && (
                              <span className="text-[#5c4e45] font-normal">({gc.ratingCount})</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[#5c4e45]">Not rated yet</span>
                        )}
                        {gc.priceLevelLabel && (
                          <>
                            <span aria-hidden="true">·</span>
                            {canViewPricing ? (
                              <span className="font-semibold text-[#1c1613]">
                                {gc.priceLevelLabel}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  openUpgradeModal({
                                    featureName: 'Price Level & Budget Details',
                                    requiredPlan: 'plus',
                                  })
                                }
                                className="inline-flex items-center gap-1 font-semibold text-[#b45309] hover:underline"
                              >
                                <Lock className="w-3 h-3" aria-hidden="true" />
                                <span>{isExpired ? 'Renew to Unlock' : 'Subscribers Only'}</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      <div className="pt-2 border-t border-[#e6ddd0] flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#5c4e45]">
                        <span>Wi-Fi: Not verified</span>
                        <span>·</span>
                        <span>Sockets: Not verified</span>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-4 space-y-2.5">
                    <div className="pt-2 border-t border-[#e6ddd0] flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void toggleSaveCafe(snapshot, false)}
                          className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border font-medium ${
                            saved
                              ? 'bg-[#fef3c7] border-[#f59e0b]/50 text-[#92400e]'
                              : 'bg-[#faf7f2] border-[#e6ddd0] text-[#5c4e45]'
                          }`}
                        >
                          <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{saved ? 'Saved' : 'Save'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleSaveCafe(snapshot, true)}
                          aria-label={favourited ? 'Remove favourite' : 'Mark favourite'}
                          className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border ${
                            favourited
                              ? 'bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]'
                              : 'bg-[#faf7f2] border-[#e6ddd0] text-[#5c4e45]'
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 ${favourited ? 'fill-[#b91c1c]' : ''}`}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCompareCafe(locItem)}
                        className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border font-medium ${
                          inCompare
                            ? 'bg-[#1b4d3e] border-[#1b4d3e] text-white'
                            : 'bg-[#faf7f2] border-[#e6ddd0] text-[#5c4e45]'
                        }`}
                      >
                        {!canCompare ? (
                          <Lock className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                        ) : (
                          <GitCompareArrows className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>{inCompare ? 'Comparing' : 'Compare'}</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-[#e6ddd0] flex flex-wrap items-center justify-between gap-2 text-xs">
                      {gc.websiteUrl ? (
                        <a
                          href={gc.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-[#5c4e45] hover:text-[#1c1613]"
                        >
                          <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Website</span>
                        </a>
                      ) : (
                        <span className="text-[#5c4e45]">Google Places Discovery</span>
                      )}

                      <div className="flex items-center gap-3">
                        {directionsUrl ? (
                          <a
                            href={directionsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-[#1b4d3e] hover:text-[#143a2e]"
                          >
                            <span>Directions</span>
                            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="text-[#5c4e45]/60 font-medium">No Directions</span>
                        )}
                        <Link
                          to={detailPath}
                          className="font-semibold text-[#b45309] hover:underline underline-offset-4"
                        >
                          Details &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {nearbyHasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={loadingMoreNearby}
                onClick={() => void loadMoreLiveCafes()}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#1b4d3e] hover:bg-[#133a2e] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold transition-colors"
              >
                {loadingMoreNearby ? 'Loading More Places...' : 'Load More Local Places'}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Bengaluru Local Guides & Neighbourhood Landing Links */}
      <section
        aria-label="Explore Bengaluru cafe guides by area and category"
        className="pt-6 border-t border-[#e6ddd0] space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif-display text-lg font-bold text-[#1c1613]">
            Explore by Bengaluru Area &amp; Budget Guide
          </h2>
          <Link to="/guides" className="text-xs font-semibold text-[#b45309] hover:underline">
            View editorial guides &rarr;
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {LOCAL_SEO_PAGES.slice(0, 14).map((p) => (
            <Link
              key={p.slug}
              to={p.path}
              className="px-3 py-1.5 rounded-full bg-white hover:bg-[#fef3c7] border border-[#e6ddd0] text-xs font-medium text-[#1c1613] transition-colors"
            >
              {p.kicker}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

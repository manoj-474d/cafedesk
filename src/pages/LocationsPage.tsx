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
  Sparkles,
  Star,
  Wifi,
  X,
} from 'lucide-react';
import {
  BENGALURU_AREAS,
  BENGALURU_REGIONS,
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
import type { BengaluruRegionName } from '../types/cms';
import { locationToLibrarySnapshot, useAuth } from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import {
  googleDiscoveryToLocationItem,
  useDiscovery,
  type GoogleDiscoveryCafe,
} from '../context/DiscoveryContext';
import {
  buildGoogleMapsDirectionsUrl,
  deduplicateCafeItems,
  formatDistanceKm,
  getCafeDetailRoute,
  getCafeSourceMeta,
  isCafeOpenNow,
  matchesDiscoveryCategoryTab,
  matchesWorkMood,
  useDocumentMeta,
} from '../utils/cafeHelpers';
import {
  isFamilyFriendlyCafe,
  isGoodForDates,
  isHiddenGem,
  isOutdoorFriendly,
  isTrendingCafe,
} from '../utils/cafeRecommendations';
import { computeWorkReadyScore } from '../utils/cafeScoring';
import {
  compareCafesBudgetFirst,
  extractCafeMenuEntries,
  getCafeLowestVerifiedMenuPrice,
  interleaveDifferentBrands,
  matchCafeToFoodSearch,
  matchesBudgetAndPriceFilter,
  normalizeFoodText,
  parseSmartFoodQuery,
  resolveBudgetRangeFromSelection,
  type ParsedMenuEntry,
  type SmartSearchMatchResult,
} from '../utils/smartFoodSearch';
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
  | 'work_ready'
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
  const { locations, settings, isFeatureEnabled } = useCms();
  const smartSearchEnabled = isFeatureEnabled('smart_nl_search');
  const livePlacesEnabled = isFeatureEnabled('live_google_places');
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

  // Food item names are public, while INR pricing & exact price filters require Plus (from Rs 79/mo)
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
    localities,
    localitiesByRegion,
    localityPlaces,
    localityLoading,
    activeLocalityMeta,
    loadLocalityPlaces,
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
  const [selectedRegion, setSelectedRegion] = useState<BengaluruRegionName | ''>(
    () =>
      (searchParams.get('region') as BengaluruRegionName) ||
      (typeof stored.region === 'string' ? (stored.region as BengaluruRegionName) : '')
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
  const [customMaxPrice, setCustomMaxPrice] = useState<string>(
    () =>
      searchParams.get('maxPrice') ??
      (typeof stored.customMaxPrice === 'string' ? stored.customMaxPrice : '')
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
  const [familyOnly, setFamilyOnly] = useState(
    () => searchParams.get('family') === '1' || Boolean(stored.familyOnly)
  );
  const [collectionFilter, setCollectionFilter] = useState(
    () => searchParams.get('collection') ?? (typeof stored.collectionFilter === 'string' ? stored.collectionFilter : '')
  );
  const [atmosphere, setAtmosphere] = useState<'any' | 'quiet' | 'lively'>(() =>
    stored.atmosphere === 'quiet' || stored.atmosphere === 'lively' ? stored.atmosphere : 'any'
  );

  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const sortParam = searchParams.get('sort') as SortOption | null;
    if (sortParam) return sortParam;
    if (searchParams.get('nearby') === '1') return 'distance';
    return typeof stored.sortBy === 'string' ? (stored.sortBy as SortOption) : 'featured';
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [focusCenter, setFocusCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [visibleCuratedCount, setVisibleCuratedCount] = useState(9);

  // Suggest Missing Bengaluru Neighbourhood modal state
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestName, setSuggestName] = useState('');
  const [suggestRegion, setSuggestRegion] = useState<BengaluruRegionName>('North Bengaluru');
  const [suggestAlt, setSuggestAlt] = useState('');
  const [suggestNotes, setSuggestNotes] = useState('');
  const [suggestSubmitting, setSuggestSubmitting] = useState(false);
  const [suggestResult, setSuggestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const autoNearbyTriggeredRef = useRef(false);
  const autoLiveQueryTriggeredRef = useRef(false);
  const lastNearMeQueryRef = useRef('');
  const lastWrittenSearchRef = useRef(searchParams.toString());

  useEffect(() => {
    if (searchParams.get('view') === 'map') {
      setViewMode('map');
    } else if (typeof window !== 'undefined' && window.innerWidth < 1024 && viewMode === 'split') {
      setViewMode('list');
    }
  }, [searchParams]);

  useEffect(() => {
    const currentStr = searchParams.toString();
    if (currentStr === lastWrittenSearchRef.current) return;
    lastWrittenSearchRef.current = currentStr;
    const nextQ = searchParams.get('q');
    if (nextQ !== null) setQuery(nextQ);
    const nextBudget = searchParams.get('budget');
    if (nextBudget !== null) setBudget(nextBudget as BudgetBracketId);
    const nextMaxPrice = searchParams.get('maxPrice');
    if (nextMaxPrice !== null) setCustomMaxPrice(nextMaxPrice);
    const nextCat = searchParams.get('category');
    if (nextCat !== null) setCategoryTab(nextCat as DiscoveryCategoryTabId);
    const nextRegion = searchParams.get('region');
    if (nextRegion !== null) setSelectedRegion(nextRegion as BengaluruRegionName);
    const nextArea = searchParams.get('area');
    if (nextArea !== null) setArea(nextArea);
    const nextMode = searchParams.get('mode');
    if (nextMode !== null) setMode(nextMode);
    const nextSort = searchParams.get('sort') as SortOption | null;
    if (nextSort) setSortBy(nextSort);
  }, [searchParams]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({
          q: query,
          city: selectedCity,
          region: selectedRegion,
          area,
          categoryTab,
          businessCategory,
          workMood,
          mode,
          budget,
          customMaxPrice,
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
          familyOnly,
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
    selectedRegion,
    area,
    categoryTab,
    businessCategory,
    workMood,
    mode,
    budget,
    customMaxPrice,
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
    familyOnly,
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
    localities.forEach((l) => merged.add(l.name));
    locations.forEach((l) => {
      if (l.area) merged.add(l.area);
    });
    return Array.from(merged).sort();
  }, [locations, localities]);

  // Load locality-wise indexed & cached Google Places whenever an area is selected
  useEffect(() => {
    if (selectedCity !== 'Bengaluru' || !area.trim()) {
      return;
    }
    let cancelled = false;
    void loadLocalityPlaces(area.trim(), { warm: true }).then((res) => {
      if (!cancelled && res.locality) {
        setFocusCenter({ lat: res.locality.lat, lng: res.locality.lng });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [area, selectedCity, loadLocalityPlaces]);

  const syncQueryParams = (updates: {
    q?: string;
    city?: string;
    region?: string;
    area?: string;
    category?: string;
    bizCategory?: string;
    mood?: string;
    mode?: string;
    budget?: string;
    maxPrice?: string;
  }) => {
    const next = new URLSearchParams(searchParams);
    const nextQ = updates.q !== undefined ? updates.q : query;
    const nextCity = updates.city !== undefined ? updates.city : selectedCity;
    const nextRegion = updates.region !== undefined ? updates.region : selectedRegion;
    const nextArea = updates.area !== undefined ? updates.area : area;
    const nextCat = updates.category !== undefined ? updates.category : categoryTab;
    const nextBiz = updates.bizCategory !== undefined ? updates.bizCategory : businessCategory;
    const nextMood = updates.mood !== undefined ? updates.mood : workMood;
    const nextMode = updates.mode !== undefined ? updates.mode : mode;
    const nextBudget = updates.budget !== undefined ? updates.budget : budget;
    const nextMaxPrice = updates.maxPrice !== undefined ? updates.maxPrice : customMaxPrice;

    if (nextQ.trim()) next.set('q', nextQ.trim());
    else next.delete('q');
    if (nextCity && nextCity !== 'Bengaluru') next.set('city', nextCity);
    else next.delete('city');
    if (nextRegion) next.set('region', nextRegion);
    else next.delete('region');
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
    if (nextMaxPrice.trim()) next.set('maxPrice', nextMaxPrice.trim());
    else next.delete('maxPrice');
    lastWrittenSearchRef.current = next.toString();
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
    setSelectedRegion('');
    setArea('');
    setCategoryTab('all');
    setBusinessCategory('');
    setWorkMood('');
    setMode('');
    setBudget('');
    setCustomMaxPrice('');
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
    setFamilyOnly(false);
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
    lastWrittenSearchRef.current = '';
    setSearchParams({}, { replace: true });
  };

  const parsedQuery = useMemo(
    () =>
      smartSearchEnabled
        ? parseSmartFoodQuery(query, localities)
        : parseSmartFoodQuery('', localities),
    [query, smartSearchEnabled, localities]
  );

  // Automatically request GPS when user types an explicit "near me" query
  useEffect(() => {
    if (!parsedQuery.nearMe || userLocation) return;
    if (lastNearMeQueryRef.current === parsedQuery.raw) return;
    lastNearMeQueryRef.current = parsedQuery.raw;
    void requestUserLocation().then((pt) => {
      if (pt) {
        setFocusCenter(pt);
      }
    });
  }, [parsedQuery.nearMe, parsedQuery.raw, userLocation, requestUserLocation]);

  const effectiveCustomMaxPrice = useMemo(() => {
    const n = Number(customMaxPrice.trim());
    return customMaxPrice.trim() && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }, [customMaxPrice]);

  const budgetRange = useMemo(
    () => resolveBudgetRangeFromSelection(budget, effectiveCustomMaxPrice, parsedQuery),
    [budget, effectiveCustomMaxPrice, parsedQuery]
  );

  const regionMatchTerms = useMemo(() => {
    if (!selectedRegion) return null;
    const regionLocs = localitiesByRegion[selectedRegion] || [];
    const terms = new Set<string>();
    for (const l of regionLocs) {
      terms.add(l.name.toLowerCase());
      l.alt_spellings.forEach((a) => terms.add(a.toLowerCase()));
      l.local_names.forEach((n) => terms.add(n.toLowerCase()));
    }
    return Array.from(terms).filter((t) => t.length >= 3);
  }, [selectedRegion, localitiesByRegion]);

  const activeAreaTerms = useMemo(() => {
    const eff = (area || parsedQuery.detectedLocality || '').trim().toLowerCase();
    if (!eff) return null;
    const matchedLoc = localities.find(
      (l) =>
        l.name.toLowerCase() === eff ||
        l.slug === eff ||
        l.alt_spellings.some((a) => a.toLowerCase() === eff) ||
        l.local_names.some((n) => n.toLowerCase() === eff)
    );
    if (!matchedLoc) return [eff];
    return Array.from(
      new Set([
        matchedLoc.name.toLowerCase(),
        ...matchedLoc.alt_spellings.map((a) => a.toLowerCase()),
        ...matchedLoc.local_names.map((n) => n.toLowerCase()),
      ])
    ).filter((t) => t.length >= 3);
  }, [area, parsedQuery.detectedLocality, localities]);

  const { filteredLocations, matchMap } = useMemo(() => {
    const map = new Map<string, SmartSearchMatchResult>();
    const effectiveCity =
      selectedCity && selectedCity !== 'Bengaluru'
        ? selectedCity
        : parsedQuery.detectedCity || selectedCity;
    const effectiveOpenNow = openNowOnly || parsedQuery.openNow;

    const list = effectiveLocations.filter((loc) => {
      if (effectiveCity && effectiveCity !== 'All India') {
        const cityHay = `${loc.city} ${loc.address}`.toLowerCase();
        if (!cityHay.includes(effectiveCity.toLowerCase())) return false;
      }
      if (regionMatchTerms && regionMatchTerms.length > 0 && !activeAreaTerms) {
        const hayRegion = `${loc.area} ${loc.address}`.toLowerCase();
        if (!regionMatchTerms.some((t) => hayRegion.includes(t))) return false;
      }
      if (activeAreaTerms && activeAreaTerms.length > 0) {
        const hayArea = `${loc.area} ${loc.address}`.toLowerCase();
        if (!activeAreaTerms.some((t) => hayArea.includes(t))) return false;
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
      if ((familyOnly || parsedQuery.familyFriendly) && !isFamilyFriendlyCafe(loc)) return false;
      if (collectionFilter === 'dates' && !isGoodForDates(loc)) return false;
      if (collectionFilter === 'family' && !isFamilyFriendlyCafe(loc)) return false;
      if (collectionFilter === 'hidden-gems' && !isHiddenGem(loc)) return false;
      if (collectionFilter === 'trending' && !isTrendingCafe(loc)) return false;
      if (collectionFilter === 'outdoor' && !isOutdoorFriendly(loc)) return false;

      // Apply explicit NL facility filters cleanly
      if (parsedQuery.wifiRequired) {
        const hasWifi = loc.wifi_available === 'yes' || (loc.wifi_mbps !== null && loc.wifi_mbps > 0);
        if (!hasWifi) return false;
      }
      if (parsedQuery.socketsRequired) {
        const hasPlugs =
          loc.charging_sockets === 'yes' ||
          loc.sockets_claimed ||
          (loc.sockets_count !== null && loc.sockets_count > 0);
        if (!hasPlugs) return false;
      }
      if (parsedQuery.outdoorRequired && !isOutdoorFriendly(loc)) return false;
      if (parsedQuery.quietStudyRequired) {
        const isQuietStudy =
          loc.suitable_for_studying === 'yes' ||
          loc.modes.includes('calm') ||
          (loc.noise_level !== null && loc.noise_level <= 2);
        if (!isQuietStudy) return false;
      }
      if (parsedQuery.workFriendlyRequired) {
        const isWork =
          loc.laptop_friendly ||
          loc.suitable_for_working === 'yes' ||
          loc.modes.includes('work');
        if (!isWork) return false;
      }

      if (canViewWorkspace && comfortableOnly && loc.comfortable_seating !== 'yes') return false;
      if (canViewWorkspace && studyOnly && loc.suitable_for_studying !== 'yes' && !loc.modes.includes('calm')) {
        return false;
      }
      if (canViewWorkspace && workOnly && loc.suitable_for_working !== 'yes' && !loc.modes.includes('work')) {
        return false;
      }

      const menuEntries = extractCafeMenuEntries(loc);
      const menuHay = normalizeFoodText(
        menuEntries.map((m) => `${m.name} ${m.category} ${m.description}`).join(' ')
      );
      const itemText = [
        loc.category || '',
        loc.popular_items.join(' '),
        loc.best_for.join(' '),
        loc.claims.join(' '),
        loc.description,
        loc.verdict,
        menuHay,
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
        teaCoffeeOnly &&
        !loc.tea_price &&
        !loc.coffee_price &&
        !/tea|chai|coffee|espresso|cappuccino|latte|kaapi|brew|mocha|americano/i.test(itemText)
      ) {
        return false;
      }
      if (
        bakerySnacksOnly &&
        !loc.snacks_price &&
        !/puff|croissant|cake|pastry|pastries|bakery|bun|toast|muffin|fries|maggi|snack|cookie|biscuit|donut|waffle|samosa|vada|pakoda|dilpasand|khara/i.test(
          itemText
        )
      ) {
        return false;
      }
      if (
        burgersSandwichesOnly &&
        !/burger|sandwich|toastie|panini|roll|sub|slider/i.test(itemText)
      ) {
        return false;
      }

      if (effectiveOpenNow && !isCafeOpenNow(loc.timings)) return false;
      if (verifiedOnly && !loc.verified) return false;

      // Smart Food & NL Query Match
      const smartMatch = matchCafeToFoodSearch(loc, parsedQuery);
      map.set(loc.id, smartMatch);
      if ((parsedQuery.cleanFoodQuery || parsedQuery.intentTags.length > 0) && !smartMatch.matched) {
        return false;
      }

      // Intent tag filters extracted from natural language queries
      if (parsedQuery.intentTags.includes('budget')) {
        const low = getCafeLowestVerifiedMenuPrice(loc);
        const isBudget =
          loc.modes.includes('budget') ||
          (loc.avg_cost_per_person !== null && loc.avg_cost_per_person <= 225) ||
          (low !== null && low <= 100);
        if (!isBudget) return false;
      }
      if (parsedQuery.intentTags.includes('student')) {
        const isStudent =
          loc.best_for.some((b) => /student|college/i.test(b)) ||
          loc.modes.includes('budget') ||
          (loc.avg_cost_per_person !== null && loc.avg_cost_per_person <= 220);
        if (!isStudent) return false;
      }
      if (parsedQuery.intentTags.includes('study')) {
        if (
          loc.suitable_for_studying !== 'yes' &&
          !loc.modes.includes('calm') &&
          (loc.noise_level === null || loc.noise_level > 2)
        ) {
          return false;
        }
      }
      if (parsedQuery.intentTags.includes('work')) {
        if (
          !loc.laptop_friendly &&
          loc.suitable_for_working !== 'yes' &&
          !loc.modes.includes('work') &&
          loc.wifi_available !== 'yes' &&
          loc.charging_sockets !== 'yes'
        ) {
          return false;
        }
      }
      if (parsedQuery.intentTags.includes('hidden_gem') && !isHiddenGem(loc)) {
        return false;
      }

      // Item-level & cafe-level budget check (only when pricing is unlocked)
      if (canViewPricing && (budgetRange.minInr !== null || budgetRange.maxInr !== null)) {
        let chipMatchedItems: ParsedMenuEntry[] = [];
        if (!parsedQuery.isFoodQuery) {
          if (teaCoffeeOnly) {
            chipMatchedItems = menuEntries.filter((e) =>
              /\b(tea|chai|kullad|coffee|kaapi|espresso|latte|cappuccino|mocha)\b/i.test(
                `${e.name} ${e.category}`
              )
            );
          } else if (bakerySnacksOnly) {
            chipMatchedItems = menuEntries.filter((e) =>
              /\b(puff|bun|maggi|snack|snacks|bakery|cake|pastry|fries|vada|samosa|biscuit|toast)\b/i.test(
                `${e.name} ${e.category}`
              )
            );
          } else if (burgersSandwichesOnly) {
            chipMatchedItems = menuEntries.filter((e) =>
              /\b(burger|sandwich|toastie|panini|roll|sub)\b/i.test(`${e.name} ${e.category}`)
            );
          }
        }
        const effectiveMatchedItems = parsedQuery.isFoodQuery
          ? smartMatch.matchedItems
          : chipMatchedItems;
        const itemFilterActive = Boolean(
          parsedQuery.isFoodQuery || teaCoffeeOnly || bakerySnacksOnly || burgersSandwichesOnly
        );

        if (
          !matchesBudgetAndPriceFilter(loc, {
            minInr: budgetRange.minInr,
            maxInr: budgetRange.maxInr,
            matchedItems: effectiveMatchedItems,
            itemFilterActive,
            categoryFilter: categoryTab,
          })
        ) {
          return false;
        }
      }

      return true;
    });

    const sorted = [...list].sort((a, b) => {
      if ((sortBy === 'distance' || (parsedQuery.nearMe && sortBy === 'featured')) && userLocation) {
        const da = a.distanceKm ?? Number.MAX_SAFE_INTEGER;
        const db = b.distanceKm ?? Number.MAX_SAFE_INTEGER;
        if (Math.abs(da - db) > 0.25) return da - db;
      }
      if (sortBy === 'work_ready') {
        const wa = computeWorkReadyScore(a, settings.scoring_config).score ?? -1;
        const wb = computeWorkReadyScore(b, settings.scoring_config).score ?? -1;
        if (wb !== wa) return wb - wa;
      }
      if (sortBy === 'rating') return (b.rating ?? -1) - (a.rating ?? -1);
      if (sortBy === 'reviews') return (b.rating_count ?? -1) - (a.rating_count ?? -1);
      if (sortBy === 'wifi' && canViewWifi) return (b.wifi_mbps ?? -1) - (a.wifi_mbps ?? -1);
      if (sortBy === 'cheapest' && canViewPricing) {
        const pa =
          map.get(a.id)?.lowestMatchedPriceInr ??
          getCafeLowestVerifiedMenuPrice(a) ??
          a.avg_cost_per_person ??
          Number.MAX_SAFE_INTEGER;
        const pb =
          map.get(b.id)?.lowestMatchedPriceInr ??
          getCafeLowestVerifiedMenuPrice(b) ??
          b.avg_cost_per_person ??
          Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return pa - pb;
        return compareCafesBudgetFirst(a, b, map);
      }
      if (sortBy === 'quietest' && canViewWorkspace) return (a.noise_level ?? 99) - (b.noise_level ?? 99);
      if (sortBy === 'recent') {
        const da = a.last_verified_date ? Date.parse(a.last_verified_date) || 0 : 0;
        const db = b.last_verified_date ? Date.parse(b.last_verified_date) || 0 : 0;
        return db - da;
      }
      return compareCafesBudgetFirst(a, b, map);
    });

    const ordered =
      sortBy === 'featured' || sortBy === 'cheapest'
        ? interleaveDifferentBrands(sorted, 10)
        : sorted;

    return { filteredLocations: ordered, matchMap: map };
  }, [
    effectiveLocations,
    settings.scoring_config,
    canViewPricing,
    canViewWifi,
    canViewSockets,
    canViewWorkspace,
    selectedCity,
    regionMatchTerms,
    activeAreaTerms,
    categoryTab,
    businessCategory,
    workMood,
    mode,
    budgetRange.minInr,
    budgetRange.maxInr,
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
    familyOnly,
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
    parsedQuery,
    sortBy,
  ]);

  const fallbackAlternatives = useMemo(() => {
    if (filteredLocations.length > 0) return [];
    const effectiveArea = area || parsedQuery.detectedLocality;
    let pool = effectiveLocations.filter((loc) =>
      effectiveArea
        ? `${loc.area} ${loc.address}`.toLowerCase().includes(effectiveArea.toLowerCase())
        : true
    );
    if (pool.length === 0 && (parsedQuery.cleanFoodQuery || parsedQuery.canonicalConcepts.length > 0)) {
      const relaxedParsed = {
        ...parsedQuery,
        maxBudgetInr: null,
        wifiRequired: false,
        socketsRequired: false,
      };
      pool = effectiveLocations.filter((loc) => matchCafeToFoodSearch(loc, relaxedParsed).matched);
    }
    if (pool.length === 0) {
      pool = [...effectiveLocations];
    }
    return interleaveDifferentBrands([...pool].sort((a, b) => compareCafesBudgetFirst(a, b)), 6).slice(0, 3);
  }, [filteredLocations.length, effectiveLocations, area, parsedQuery]);

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
      const liveText = parsedQuery.cleanFoodQuery || trimmed;
      void searchLiveCafesInBengaluru(liveText, {
        category: categoryTab || undefined,
        locality: area || parsedQuery.detectedLocality || undefined,
        city: parsedQuery.detectedCity || selectedCity,
      });
    }, 550);
    return () => window.clearTimeout(timer);
  }, [
    placesReady,
    query,
    parsedQuery.cleanFoodQuery,
    parsedQuery.detectedLocality,
    parsedQuery.detectedCity,
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

    // Combine locality-indexed places (when an area is active) + interactive search nearbyPlaces
    const combinedRaw: GoogleDiscoveryCafe[] = [];
    const seenPlaceIds = new Set<string>();

    if (area.trim() && localityPlaces.length > 0) {
      for (const lp of localityPlaces) {
        if (!lp.isLiveGooglePlace || !lp.place_id) continue;
        if (seenPlaceIds.has(lp.place_id)) continue;
        seenPlaceIds.add(lp.place_id);
        combinedRaw.push({
          id: lp.id,
          placeId: lp.place_id,
          name: lp.name,
          areaLabel: lp.area || area,
          address: lp.address,
          lat: lp.lat ?? 12.9716,
          lng: lp.lng ?? 77.5946,
          rating: lp.rating,
          ratingCount: lp.rating_count,
          websiteUrl: lp.website_url || '',
          mapLink: lp.map_link,
          viewMapUrl: lp.source_url || lp.map_link,
          phone: lp.phone || '',
          photos: lp.photos || [],
          openingHours: lp.opening_hours_list || [],
          priceLevelLabel: lp.price_level_label || lp.price_range || '',
          categoryLabel: lp.category || 'Cafe',
          distanceKm: getEffectiveLocation(lp).distanceKm,
          sourceType: 'google_places',
        });
      }
    }

    for (const np of nearbyPlaces) {
      if (np.placeId && seenPlaceIds.has(np.placeId)) continue;
      if (np.placeId) seenPlaceIds.add(np.placeId);
      combinedRaw.push(np);
    }

    const liveAsLocations = combinedRaw
      .filter((gc) => {
        if (maxDistanceKm > 0 && gc.distanceKm !== null && gc.distanceKm > maxDistanceKm) {
          return false;
        }
        if (minRating > 0 && (gc.rating === null || gc.rating < minRating)) return false;
        const item = googleDiscoveryToLocationItem(gc);
        if (categoryTab && categoryTab !== 'all' && !matchesDiscoveryCategoryTab(item, categoryTab)) {
          return false;
        }
        if (parsedQuery.cleanFoodQuery) {
          const hay = `${gc.name} ${gc.categoryLabel || ''} ${gc.address} ${gc.areaLabel}`.toLowerCase();
          if (!hay.includes(parsedQuery.cleanFoodQuery.toLowerCase())) {
            // Also allow category keyword synonyms (tea/coffee/bakery/juice/dessert)
            const tokens = parsedQuery.cleanFoodQuery.toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
            if (tokens.length > 0 && !tokens.some((t) => hay.includes(t))) {
              return false;
            }
          }
        }
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
  }, [
    nearbyPlaces,
    localityPlaces,
    area,
    filteredLocations,
    maxDistanceKm,
    minRating,
    categoryTab,
    parsedQuery.cleanFoodQuery,
    sortBy,
    userLocation,
  ]);

  const filterControlsBody = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#e6ddd0]">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: '', label: 'All Cafes' },
            { id: 'family', label: 'Family-Friendly' },
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

        {selectedCity === 'Bengaluru' && (
          <div>
            <label htmlFor="loc-region" className="block text-xs font-medium text-[#5c4e45] mb-1.5">
              Bengaluru Region
            </label>
            <select
              id="loc-region"
              value={selectedRegion}
              onChange={(e) => {
                const nextReg = e.target.value as BengaluruRegionName | '';
                setSelectedRegion(nextReg);
                setArea('');
                syncQueryParams({ region: nextReg, area: '' });
              }}
              className="w-full h-12 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
            >
              <option value="">All 6 Bengaluru Regions</option>
              {BENGALURU_REGIONS.map((reg) => (
                <option key={reg} value={reg}>
                  {reg} ({(localitiesByRegion[reg] || []).length})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label htmlFor="loc-area" className="block text-xs font-medium text-[#5c4e45]">
              Neighbourhood / Locality
            </label>
            <button
              type="button"
              onClick={() => {
                setSuggestResult(null);
                setSuggestOpen(true);
              }}
              className="text-[11px] font-semibold text-[#b45309] hover:underline whitespace-nowrap"
            >
              + Missing area?
            </button>
          </div>
          {selectedCity === 'Bengaluru' ? (
            <select
              id="loc-area"
              value={area}
              onChange={(e) => {
                const nextArea = e.target.value;
                setArea(nextArea);
                syncQueryParams({ area: nextArea });
              }}
              className="w-full h-12 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
            >
              <option value="">
                {selectedRegion ? `All ${selectedRegion}` : `All ${localities.length}+ Neighbourhoods`}
              </option>
              {(selectedRegion ? [selectedRegion] : BENGALURU_REGIONS).map((reg) => {
                const items = localitiesByRegion[reg] || [];
                if (items.length === 0) return null;
                return (
                  <optgroup key={reg} label={reg}>
                    {items.map((loc) => (
                      <option key={loc.slug} value={loc.name}>
                        {loc.name}
                        {loc.unique_place_count > 0 ? ` (${loc.unique_place_count}+)` : ''}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          ) : (
            <>
              <input
                id="loc-area"
                list="cafedesk-area-options"
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  syncQueryParams({ area: e.target.value });
                }}
                placeholder="Type any locality..."
                className="w-full h-12 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
              />
              <datalist id="cafedesk-area-options">
                {areaOptions.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </>
          )}
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
            className="block text-xs font-medium text-[#5c4e45] mb-1.5"
          >
            Item / Cafe Budget
          </label>
          <div className="flex gap-2">
            <select
              id="loc-budget"
              value={budget}
              onChange={(e) => {
                const val = e.target.value as BudgetBracketId | '';
                setBudget(val);
                if (val) {
                  setCustomMaxPrice('');
                  syncQueryParams({ budget: val, maxPrice: '' });
                } else {
                  syncQueryParams({ budget: '' });
                }
              }}
              className="flex-1 min-w-0 h-12 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
            >
              <option value="">Any budget</option>
              {BUDGET_BRACKETS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            <div className="relative w-24 shrink-0">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#5c4e45]">
                ₹
              </span>
              <input
                type="number"
                min={10}
                max={2000}
                aria-label="Custom max budget in rupees"
                value={customMaxPrice}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomMaxPrice(val);
                  if (val.trim()) {
                    setBudget('');
                    syncQueryParams({ maxPrice: val, budget: '' });
                  } else {
                    syncQueryParams({ maxPrice: '' });
                  }
                }}
                placeholder="Max"
                className="w-full h-12 pl-6 pr-2 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-xs font-semibold text-[#1c1613]"
              />
            </div>
          </div>
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
            { label: 'Family-friendly', checked: familyOnly, onChange: setFamilyOnly, allowed: true },
            { label: 'Comfortable seating', checked: comfortableOnly, onChange: setComfortableOnly, allowed: canViewWorkspace },
            { label: 'Suitable for studying', checked: studyOnly, onChange: setStudyOnly, allowed: canViewWorkspace },
            { label: 'Quiet environment', checked: quietOnly, onChange: setQuietOnly, allowed: canViewWorkspace },
            { label: 'Charging sockets', checked: socketsOnly, onChange: setSocketsOnly, allowed: canViewSockets },
            { label: 'Outdoor seating', checked: outdoorOnly, onChange: setOutdoorOnly, allowed: true },
            { label: 'Wi-Fi available', checked: wifiOnly, onChange: setWifiOnly, allowed: canViewWifi },
            { label: 'Suitable for working', checked: workOnly, onChange: setWorkOnly, allowed: canViewWorkspace },
            { label: 'Meeting-friendly', checked: meetingOnly, onChange: setMeetingOnly, allowed: canViewWorkspace },
            { label: 'Tea & coffee', checked: teaCoffeeOnly, onChange: setTeaCoffeeOnly, allowed: true },
            { label: 'Bakery & snacks', checked: bakerySnacksOnly, onChange: setBakerySnacksOnly, allowed: true },
            { label: 'Burgers & sandwiches', checked: burgersSandwichesOnly, onChange: setBurgersSandwichesOnly, allowed: true },
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
            <option value="featured">Lowest Price to Upper Budget</option>
            <option value="work_ready">Highest Work-Ready Score</option>
            <option value="cheapest">Cheapest Matched Item First</option>
            <option value="rating">Highest Rated</option>
            <option value="reviews">Most Reviewed</option>
            <option value="wifi">{canViewWifi ? 'Fastest Wi-Fi' : '🔒 Fastest Wi-Fi (Plus)'}</option>
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
          {!canViewPricing && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] text-[10px] font-semibold">
              <Lock className="w-2.5 h-2.5" aria-hidden="true" />
              <span>Plus ₹79/mo</span>
            </span>
          )}
          {BUDGET_BRACKETS.map((b) => {
            const active = canViewPricing && budget === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  if (!canViewPricing) {
                    openUpgradeModal({
                      featureName: 'Menu Item & Budget Price Filters',
                      requiredPlan: 'plus',
                      description:
                        'Unlock verified INR prices for specific menu items and exact ₹ budget filters starting with Cafe Desk Plus (₹79/month).',
                    });
                    return;
                  }
                  const next = budget === b.id ? '' : b.id;
                  setBudget(next);
                  if (next) setCustomMaxPrice('');
                  syncQueryParams({ budget: next, maxPrice: next ? '' : customMaxPrice });
                }}
                className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-semibold border inline-flex items-center gap-1 transition-colors ${
                  active
                    ? 'bg-[#b45309] text-white border-[#b45309]'
                    : 'bg-white text-[#5c4e45] border-[#e6ddd0] hover:border-[#b45309] hover:text-[#1c1613]'
                }`}
              >
                {!canViewPricing && <Lock className="w-2.5 h-2.5 text-[#b45309]" aria-hidden="true" />}
                <span>{b.label}</span>
              </button>
            );
          })}
          <div className="flex items-center gap-1.5 ml-auto">
            <label htmlFor="quick-custom-max-price" className="text-[11px] font-medium text-[#5c4e45]">
              Custom Max ₹:
            </label>
            <input
              id="quick-custom-max-price"
              type="number"
              min={10}
              max={2000}
              value={canViewPricing ? customMaxPrice : ''}
              onFocus={() => {
                if (!canViewPricing) {
                  openUpgradeModal({
                    featureName: 'Custom Budget Price Filter',
                    requiredPlan: 'plus',
                    description:
                      'Unlock verified INR item prices and custom ₹ budget filtering starting with Cafe Desk Plus (₹79/month).',
                  });
                }
              }}
              onChange={(e) => {
                if (!canViewPricing) return;
                const val = e.target.value;
                setCustomMaxPrice(val);
                if (val.trim()) {
                  setBudget('');
                  syncQueryParams({ maxPrice: val, budget: '' });
                } else {
                  syncQueryParams({ maxPrice: '' });
                }
              }}
              placeholder={canViewPricing ? 'e.g. 80' : 'Plus ₹79+'}
              className="w-24 h-8 px-2.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-xs font-semibold text-[#1c1613]"
            />
          </div>
        </div>
      </div>

      {/* Smart Query Understanding Bar */}
      {(parsedQuery.isFoodQuery ||
        parsedQuery.maxBudgetInr !== null ||
        parsedQuery.minBudgetInr !== null ||
        parsedQuery.detectedLocality ||
        parsedQuery.nearMe ||
        parsedQuery.openNow ||
        parsedQuery.wifiRequired ||
        parsedQuery.socketsRequired ||
        parsedQuery.familyFriendly ||
        parsedQuery.outdoorRequired ||
        parsedQuery.quietStudyRequired ||
        parsedQuery.workFriendlyRequired ||
        parsedQuery.intentTags.length > 0 ||
        effectiveCustomMaxPrice !== null) && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-2xl border border-[#fde68a] bg-[#fffbeb] text-xs text-[#1c1613] flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 font-semibold text-[#b45309]">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Understood from search:</span>
            </span>
            <span className="font-medium text-[#5c4e45]">
              {[
                parsedQuery.cleanFoodQuery ? `Food / Query: "${parsedQuery.cleanFoodQuery}"` : '',
                canViewPricing && budgetRange.maxInr !== null
                  ? `Budget <= ₹${budgetRange.maxInr}`
                  : !canViewPricing && (parsedQuery.maxBudgetInr !== null || budgetRange.maxInr !== null)
                  ? 'INR price filter requires Plus ₹79+'
                  : '',
                canViewPricing && budgetRange.minInr !== null
                  ? `Budget >= ₹${budgetRange.minInr}`
                  : '',
                area || parsedQuery.detectedLocality
                  ? `Locality: ${area || parsedQuery.detectedLocality}`
                  : '',
                parsedQuery.nearMe ? 'Near me' : '',
                openNowOnly || parsedQuery.openNow ? 'Open now' : '',
                parsedQuery.wifiRequired ? 'Wi-Fi required' : '',
                parsedQuery.socketsRequired ? 'Charging points' : '',
                parsedQuery.familyFriendly ? 'Family-friendly' : '',
                parsedQuery.outdoorRequired ? 'Outdoor seating' : '',
                parsedQuery.quietStudyRequired ? 'Quiet / Study' : '',
                parsedQuery.workFriendlyRequired ? 'Laptop-friendly' : '',
                parsedQuery.intentTags.includes('student') ? 'Student-friendly' : '',
                parsedQuery.intentTags.includes('budget') ? 'Budget-first' : '',
                parsedQuery.intentTags.includes('breakfast') ? 'Breakfast' : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
          <button
            type="button"
            onClick={resetAll}
            className="text-xs font-semibold text-[#b45309] hover:underline"
          >
            Clear
          </button>
        </div>
      )}

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

      {/* Locality Coverage Transparency Banner */}
      {selectedCity === 'Bengaluru' && area.trim() && activeLocalityMeta && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#f3ede3] border border-[#e6ddd0] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
              <span className="px-2.5 py-0.5 rounded-full bg-[#1b4d3e] text-white">
                {activeLocalityMeta.region}
              </span>
              <span className="text-[#5c4e45] font-mono-data">
                Coverage:{' '}
                {activeLocalityMeta.last_discovery_at
                  ? `Scanned ${new Date(activeLocalityMeta.last_discovery_at).toLocaleDateString('en-IN')}`
                  : localityLoading
                  ? 'Scanning neighbourhood...'
                  : 'Initial scan queued'}
                {activeLocalityMeta.discovery_progress > 0
                  ? ` · ${activeLocalityMeta.discovery_progress}%`
                  : ''}
              </span>
            </div>
            <h2 className="font-serif-display text-lg sm:text-xl font-bold text-[#1c1613]">
              {activeLocalityMeta.name} — {filteredLocations.length} CafeDesk verified &amp;{' '}
              {filteredGooglePlaces.length} Google Places spots
            </h2>
            <p className="text-xs text-[#5c4e45]">
              {activeLocalityMeta.local_names.length > 0
                ? `Also covers: ${activeLocalityMeta.local_names.join(', ')}. `
                : ''}
              Includes independent cafes, tea shops, bakeries &amp; juice corners discovered via Google Places API (New); unlisted street stalls may not appear.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={nearbyLoading}
              onClick={() => handleDiscoverAreaLive()}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-[#d6cbba] hover:border-[#b45309] text-xs font-semibold text-[#1c1613]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${nearbyLoading ? 'animate-spin' : ''}`} />
              <span>Scan Fresh Live Places</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSuggestResult(null);
                setSuggestRegion(activeLocalityMeta.region);
                setSuggestOpen(true);
              }}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-[#e6ddd0] text-xs font-semibold text-[#5c4e45] hover:text-[#1c1613]"
            >
              <span>Suggest Sub-Area</span>
            </button>
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
          {area ? ` in ${area}` : selectedRegion ? ` in ${selectedRegion}` : ' across Bengaluru'}
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
              nearbyLoading || localityLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <CardSkeletonPlaceholder />
                  <CardSkeletonPlaceholder />
                </div>
              ) : filteredGooglePlaces.length > 0 ? (
                <div className="bg-white rounded-2xl border border-[#e6ddd0] p-6 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#1b4d3e]">
                    Google Places Neighbourhood Discovery
                  </p>
                  <h2 className="font-serif-display text-xl font-bold text-[#1c1613]">
                    {filteredGooglePlaces.length} local spots found in{' '}
                    {area || parsedQuery.detectedLocality || selectedRegion || 'Bengaluru'}
                  </h2>
                  <p className="text-xs text-[#5c4e45]">
                    No CafeDesk field-audited listings match these filters yet — scroll to the Live
                    Google Places cards below or click any blue pin on the map.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-[#e6ddd0] p-8 sm:p-10 text-center space-y-3">
                    <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
                      No exact cafe match for all selected filters
                    </h2>
                    <p className="text-sm text-[#5c4e45]">
                      Try relaxing your budget ceiling or facility filters, scan Google Maps live, or
                      suggest a missing Bengaluru neighbourhood.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={resetAll}
                        className="min-h-[44px] px-5 py-2 rounded-xl bg-[#1c1613] text-white text-xs font-semibold"
                      >
                        Clear all filters
                      </button>
                      {livePlacesEnabled && (
                        <button
                          type="button"
                          onClick={() => handleDiscoverAreaLive()}
                          className="min-h-[44px] px-5 py-2 rounded-xl bg-[#1b4d3e] text-white text-xs font-semibold"
                        >
                          Discover live cafes in {area || parsedQuery.detectedLocality || 'Bengaluru'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSuggestResult(null);
                          setSuggestOpen(true);
                        }}
                        className="min-h-[44px] px-5 py-2 rounded-xl bg-[#faf7f2] border border-[#d6cbba] text-[#1c1613] text-xs font-semibold"
                      >
                        Suggest Missing Neighbourhood
                      </button>
                    </div>
                  </div>
                  {fallbackAlternatives.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#b45309]">
                        Closest Recommended Alternatives
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {fallbackAlternatives.map((alt) => (
                          <LocationCard key={`alt-split-${alt.id}`} location={alt} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {paginatedCuratedLocations.map((loc) => (
                    <LocationCard
                      key={loc.id}
                      location={loc}
                      matchedMenuItems={matchMap.get(loc.id)?.matchedItems}
                    />
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
          nearbyLoading || localityLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <CardSkeletonPlaceholder />
              <CardSkeletonPlaceholder />
              <CardSkeletonPlaceholder />
            </div>
          ) : filteredGooglePlaces.length > 0 ? (
            <div className="bg-white rounded-2xl border border-[#e6ddd0] p-6 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#1b4d3e]">
                Google Places Neighbourhood Discovery
              </p>
              <h2 className="font-serif-display text-xl font-bold text-[#1c1613]">
                {filteredGooglePlaces.length} local spots found in{' '}
                {area || parsedQuery.detectedLocality || selectedRegion || 'Bengaluru'}
              </h2>
              <p className="text-xs text-[#5c4e45]">
                Showing live Google Places-discovered cafes, tea shops, bakeries, and beverage corners below.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-[#e6ddd0] p-10 text-center space-y-3">
                <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
                  No exact cafe match for all selected filters
                </h2>
                <p className="text-sm text-[#5c4e45]">
                  Try relaxing your budget ceiling or facility filters, search Google Maps live, or suggest a missing Bengaluru locality.
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={resetAll}
                    className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] text-white text-sm font-semibold"
                  >
                    Clear all filters
                  </button>
                  {livePlacesEnabled && (
                    <button
                      type="button"
                      onClick={() => handleDiscoverAreaLive()}
                      className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1b4d3e] text-white text-sm font-semibold"
                    >
                      Search Google Maps
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSuggestResult(null);
                      setSuggestOpen(true);
                    }}
                    className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d6cbba] text-[#1c1613] text-sm font-semibold"
                  >
                    Suggest Neighbourhood
                  </button>
                </div>
              </div>
              {fallbackAlternatives.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#b45309]">
                    Closest Recommended Alternatives
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {fallbackAlternatives.map((alt) => (
                      <LocationCard key={`alt-list-${alt.id}`} location={alt} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedCuratedLocations.map((loc) => (
                <LocationCard
                  key={loc.id}
                  location={loc}
                  matchedMenuItems={matchMap.get(loc.id)?.matchedItems}
                />
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
      {(nearbyLoading || localityLoading) && filteredGooglePlaces.length === 0 && (
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
                Powered by Google · Live Google Places Discovery
              </p>
              <h2
                id="nearby-google-heading"
                className="font-serif-display text-2xl font-bold text-[#1c1613]"
              >
                Local spots in {area || nearbyLabel || selectedRegion || 'Bengaluru'}
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
                        {canViewPricing && gc.priceLevelLabel && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#1c1613]">
                              {gc.priceLevelLabel}
                            </span>
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
        className="pt-6 border-t border-[#e6ddd0] space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif-display text-lg font-bold text-[#1c1613]">
            Explore by Bengaluru Area &amp; Budget Guide
          </h2>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setSuggestResult(null);
                setSuggestOpen(true);
              }}
              className="text-xs font-semibold text-[#1b4d3e] hover:underline"
            >
              + Suggest Missing Bengaluru Locality
            </button>
            <Link to="/guides" className="text-xs font-semibold text-[#b45309] hover:underline">
              View editorial guides &rarr;
            </Link>
          </div>
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

      {/* Suggest Missing Bengaluru Neighbourhood Modal */}
      {suggestOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Suggest a missing Bengaluru neighbourhood"
          className="fixed inset-0 z-50 bg-[#1c1613]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSuggestOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-[#e6ddd0] shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#b45309]">
                  Bengaluru Coverage Expansion
                </p>
                <h3 className="font-serif-display text-xl font-bold text-[#1c1613]">
                  Suggest a Missing Neighbourhood
                </h3>
                <p className="text-xs text-[#5c4e45] mt-1">
                  Don&apos;t see your residential area, layout, or outer Bengaluru hub? Submit it
                  for admin approval and automated Google Places discovery.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setSuggestOpen(false)}
                className="w-9 h-9 rounded-lg border border-[#e6ddd0] bg-[#faf7f2] text-[#1c1613] flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!suggestName.trim()) return;
                setSuggestSubmitting(true);
                setSuggestResult(null);
                try {
                  const res = await fetch('/api/localities/suggest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: suggestName.trim(),
                      region: suggestRegion,
                      alt_spellings: suggestAlt.trim(),
                      notes: suggestNotes.trim(),
                    }),
                  });
                  const data = (await res.json()) as { message?: string; error?: string };
                  if (!res.ok) {
                    setSuggestResult({ ok: false, text: data.error || 'Could not submit locality.' });
                  } else {
                    setSuggestResult({
                      ok: true,
                      text:
                        data.message ||
                        'Submitted! Once approved by an admin, automated discovery will index cafes & tea shops here.',
                    });
                    setSuggestName('');
                    setSuggestAlt('');
                    setSuggestNotes('');
                  }
                } catch {
                  setSuggestResult({ ok: false, text: 'Network error submitting suggestion.' });
                } finally {
                  setSuggestSubmitting(false);
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-[#1c1613] mb-1">
                  Locality / Neighbourhood Name *
                </label>
                <input
                  type="text"
                  required
                  value={suggestName}
                  onChange={(e) => setSuggestName(e.target.value)}
                  placeholder="e.g. Doddaballapur Road, Attibele, Bagalur..."
                  className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1c1613] mb-1">
                  Bengaluru Region
                </label>
                <select
                  value={suggestRegion}
                  onChange={(e) => setSuggestRegion(e.target.value as BengaluruRegionName)}
                  className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
                >
                  {BENGALURU_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#1c1613] mb-1">
                  Alternate Spellings / Local Names (optional)
                </label>
                <input
                  type="text"
                  value={suggestAlt}
                  onChange={(e) => setSuggestAlt(e.target.value)}
                  placeholder="e.g. Bagalur Cross, Hunasamaranahalli"
                  className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1c1613] mb-1">
                  Notes / Landmarks (optional)
                </label>
                <textarea
                  rows={2}
                  value={suggestNotes}
                  onChange={(e) => setSuggestNotes(e.target.value)}
                  placeholder="Near college campus, metro station, or main road..."
                  className="w-full p-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
                />
              </div>

              {suggestResult && (
                <div
                  className={`p-3 rounded-xl border font-semibold ${
                    suggestResult.ok
                      ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#166534]'
                      : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
                  }`}
                >
                  {suggestResult.text}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSuggestOpen(false)}
                  className="min-h-[42px] px-4 rounded-xl border border-[#e6ddd0] bg-white text-[#5c4e45] font-semibold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={suggestSubmitting || !suggestName.trim()}
                  className="min-h-[42px] px-5 rounded-xl bg-[#b45309] hover:bg-[#92400e] disabled:opacity-60 text-white font-semibold"
                >
                  {suggestSubmitting ? 'Submitting...' : 'Submit Locality'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

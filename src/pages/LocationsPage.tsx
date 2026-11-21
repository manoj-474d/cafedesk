import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
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
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  Wifi,
} from 'lucide-react';
import {
  BENGALURU_AREAS,
  BROWSING_MODES,
  BUDGET_BRACKETS,
  type BudgetBracketId,
  type CafeMode,
} from '../config/constants';
import { locationToLibrarySnapshot, useAuth } from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import {
  googleDiscoveryToLocationItem,
  useDiscovery,
} from '../context/DiscoveryContext';
import {
  formatDistanceKm,
  getCafeDetailRoute,
  isCafeOpenNow,
  matchesBudgetBracket,
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

type SortOption =
  | 'distance'
  | 'featured'
  | 'rating'
  | 'wifi'
  | 'cheapest'
  | 'quietest'
  | 'recent';

type ViewMode = 'split' | 'list' | 'map';

export function LocationsPage() {
  const { locations, settings } = useCms();
  const {
    authenticated,
    hasPlus,
    openUpgradeModal,
    isCafeSaved,
    isCafeFavourite,
    toggleSaveCafe,
    compareList,
    toggleCompareCafe,
  } = useAuth();
  const {
    userLocation,
    geoStatus,
    geoError,
    requestUserLocation,
    clearUserLocation,
    getEffectiveLocation,
    nearbyPlaces,
    nearbyLoading,
    nearbyLabel,
    discoverCafesNear,
    discoverCafesByAreaText,
    searchLiveCafesInBengaluru,
    placesReady,
  } = useDiscovery();
  const [searchParams, setSearchParams] = useSearchParams();

  useDocumentMeta(settings.seo_locations_title, settings.seo_locations_description, {
    ogImage: settings.seo_og_image,
    allowIndexing: settings.seo_allow_indexing,
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    searchParams.get('view') === 'map' ? 'map' : 'split'
  );
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [area, setArea] = useState(searchParams.get('area') ?? '');
  const [mode, setMode] = useState<string>(searchParams.get('mode') ?? '');
  const [budget, setBudget] = useState<BudgetBracketId | ''>(
    (searchParams.get('budget') as BudgetBracketId) || ''
  );
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(0);
  const [minWifi, setMinWifi] = useState<number>(0);
  const [minRating, setMinRating] = useState<number>(0);

  const [wifiOnly, setWifiOnly] = useState(searchParams.get('wifi') === '1');
  const [laptopFriendlyOnly, setLaptopFriendlyOnly] = useState(
    searchParams.get('workFriendly') === '1'
  );
  const [socketsOnly, setSocketsOnly] = useState(searchParams.get('sockets') === '1');
  const [quietOnly, setQuietOnly] = useState(searchParams.get('quiet') === '1');
  const [comfortableOnly, setComfortableOnly] = useState(false);
  const [studyOnly, setStudyOnly] = useState(false);
  const [workOnly, setWorkOnly] = useState(searchParams.get('workFriendly') === '1');
  const [meetingOnly, setMeetingOnly] = useState(searchParams.get('meeting') === '1');
  const [teaCoffeeOnly, setTeaCoffeeOnly] = useState(searchParams.get('teaCoffee') === '1');
  const [bakerySnacksOnly, setBakerySnacksOnly] = useState(
    searchParams.get('bakerySnacks') === '1'
  );
  const [burgersSandwichesOnly, setBurgersSandwichesOnly] = useState(
    searchParams.get('burgersSandwiches') === '1'
  );
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [outdoorOnly, setOutdoorOnly] = useState(searchParams.get('outdoor') === '1');
  const [collectionFilter, setCollectionFilter] = useState(searchParams.get('collection') ?? '');
  const [atmosphere, setAtmosphere] = useState<'any' | 'quiet' | 'lively'>('any');

  const [sortBy, setSortBy] = useState<SortOption>(() =>
    searchParams.get('nearby') === '1' ? 'distance' : 'featured'
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [focusCenter, setFocusCenter] = useState<{ lat: number; lng: number } | null>(null);

  const autoNearbyTriggeredRef = useRef(false);
  const autoLiveQueryTriggeredRef = useRef(false);

  // Trigger GPS + nearby search automatically when navigated via "Find Near Me" (?nearby=1)
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

  // Trigger live Bengaluru Google Places search automatically if navigated with ?live=1&q=...
  useEffect(() => {
    if (!placesReady || autoLiveQueryTriggeredRef.current) return;
    const liveParam = searchParams.get('live');
    const qParam = (searchParams.get('q') ?? '').trim();
    if (liveParam === '1' && qParam.length >= 2) {
      autoLiveQueryTriggeredRef.current = true;
      void searchLiveCafesInBengaluru(qParam);
    }
  }, [placesReady, searchParams, searchLiveCafesInBengaluru]);

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
    area?: string;
    mode?: string;
    budget?: string;
  }) => {
    const next = new URLSearchParams(searchParams);
    const nextQ = updates.q !== undefined ? updates.q : query;
    const nextArea = updates.area !== undefined ? updates.area : area;
    const nextMode = updates.mode !== undefined ? updates.mode : mode;
    const nextBudget = updates.budget !== undefined ? updates.budget : budget;

    if (nextQ.trim()) next.set('q', nextQ.trim());
    else next.delete('q');
    if (nextArea) next.set('area', nextArea);
    else next.delete('area');
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
      void discoverCafesNear(point, 'Near You', radiusMeters);
    }
  };

  const handleDistanceChange = async (km: number) => {
    setMaxDistanceKm(km);
    if (km > 0 && !userLocation) {
      const point = await requestUserLocation();
      if (point) {
        setSortBy('distance');
        setFocusCenter(point);
        void discoverCafesNear(point, 'Near You', km * 1000);
      }
    } else if (km > 0 && userLocation) {
      setSortBy('distance');
      void discoverCafesNear(userLocation, 'Near You', km * 1000);
    }
  };

  const handleDiscoverAreaLive = async (targetArea?: string) => {
    const label = targetArea || area || 'Bengaluru';
    const center = await discoverCafesByAreaText(label);
    if (center) {
      setFocusCenter(center);
    }
  };

  const resetAll = () => {
    setQuery('');
    setArea('');
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
    setSearchParams({}, { replace: true });
  };

  const filteredLocations = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = effectiveLocations.filter((loc) => {
      if (area) {
        const hayArea = `${loc.area} ${loc.address}`.toLowerCase();
        if (!hayArea.includes(area.toLowerCase())) return false;
      }
      if (mode && !loc.modes.includes(mode as CafeMode)) return false;
      if (hasPlus && budget && !matchesBudgetBracket(loc.avg_cost_per_person, loc.price_range, budget)) {
        return false;
      }
      if (maxDistanceKm > 0 && userLocation) {
        if (loc.distanceKm === null || loc.distanceKm > maxDistanceKm) return false;
      }
      if (hasPlus && wifiOnly) {
        const hasWifi = loc.wifi_available === 'yes' || (loc.wifi_mbps !== null && loc.wifi_mbps > 0);
        if (!hasWifi) return false;
      }
      if (hasPlus && minWifi > 0 && (loc.wifi_mbps === null || loc.wifi_mbps < minWifi)) return false;
      if (minRating > 0 && (loc.rating === null || loc.rating < minRating)) return false;

      if (laptopFriendlyOnly && !loc.laptop_friendly) return false;
      if (socketsOnly) {
        const hasPlugs =
          loc.charging_sockets === 'yes' ||
          loc.sockets_claimed ||
          (loc.sockets_count !== null && loc.sockets_count > 0);
        if (!hasPlugs) return false;
      }
      if (quietOnly && (loc.noise_level === null || loc.noise_level > 2)) return false;
      if (atmosphere === 'quiet' && (loc.noise_level === null || loc.noise_level > 2)) return false;
      if (atmosphere === 'lively' && (loc.noise_level === null || loc.noise_level < 3) && !loc.modes.includes('plan')) {
        return false;
      }
      if (outdoorOnly && !isOutdoorFriendly(loc)) return false;
      if (collectionFilter === 'dates' && !isGoodForDates(loc)) return false;
      if (collectionFilter === 'hidden-gems' && !isHiddenGem(loc)) return false;
      if (collectionFilter === 'trending' && !isTrendingCafe(loc)) return false;
      if (collectionFilter === 'outdoor' && !isOutdoorFriendly(loc)) return false;

      if (comfortableOnly && loc.comfortable_seating !== 'yes') return false;
      if (studyOnly && loc.suitable_for_studying !== 'yes' && !loc.modes.includes('calm')) {
        return false;
      }
      if (hasPlus && workOnly && loc.suitable_for_working !== 'yes' && !loc.modes.includes('work')) {
        return false;
      }

      const itemText = [
        loc.popular_items.join(' '),
        loc.best_for.join(' '),
        loc.claims.join(' '),
        loc.description,
        loc.verdict,
      ].join(' ');

      if (
        hasPlus &&
        meetingOnly &&
        !loc.modes.includes('plan') &&
        !/meeting|meetup|friend|catchup|hangout|conversation|discussion|group/i.test(itemText)
      ) {
        return false;
      }
      if (
        hasPlus &&
        teaCoffeeOnly &&
        !loc.tea_price &&
        !loc.coffee_price &&
        !/tea|chai|coffee|espresso|cappuccino|latte|kaapi|brew|mocha|americano/i.test(itemText)
      ) {
        return false;
      }
      if (
        hasPlus &&
        bakerySnacksOnly &&
        !loc.snacks_price &&
        !/puff|croissant|cake|pastry|pastries|bakery|bun|toast|muffin|fries|maggi|snack|cookie|biscuit|donut|waffle|samosa|vada|pakoda|dilpasand|khara/i.test(
          itemText
        )
      ) {
        return false;
      }
      if (
        hasPlus &&
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
          loc.area,
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
      if (sortBy === 'wifi' && hasPlus) return (b.wifi_mbps ?? -1) - (a.wifi_mbps ?? -1);
      if (sortBy === 'cheapest' && hasPlus) {
        return (
          (a.avg_cost_per_person ?? Number.MAX_SAFE_INTEGER) -
          (b.avg_cost_per_person ?? Number.MAX_SAFE_INTEGER)
        );
      }
      if (sortBy === 'quietest') return (a.noise_level ?? 99) - (b.noise_level ?? 99);
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
    hasPlus,
    area,
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

  // Automatically query live Bengaluru places if curated matches are zero for a specific search
  useEffect(() => {
    const trimmed = query.trim();
    if (!placesReady || trimmed.length < 3 || filteredLocations.length > 0) return;
    if (nearbyLabel.trim().toLowerCase() === trimmed.toLowerCase()) return;

    const timer = window.setTimeout(() => {
      void searchLiveCafesInBengaluru(trimmed);
    }, 550);
    return () => window.clearTimeout(timer);
  }, [placesReady, query, filteredLocations.length, nearbyLabel, searchLiveCafesInBengaluru]);

  const filteredGooglePlaces = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fetchedForCurrentQuery = Boolean(q && nearbyLabel.trim().toLowerCase() === q);
    return nearbyPlaces.filter((gc) => {
      if (maxDistanceKm > 0 && gc.distanceKm !== null && gc.distanceKm > maxDistanceKm) {
        return false;
      }
      if (minRating > 0 && (gc.rating === null || gc.rating < minRating)) return false;
      if (!fetchedForCurrentQuery && q && !`${gc.name} ${gc.address} ${gc.areaLabel}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [nearbyPlaces, nearbyLabel, maxDistanceKm, minRating, query]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      {/* Header + GPS & View Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#e6ddd0] pb-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
            <Wifi className="w-3.5 h-3.5 text-[#1b4d3e]" aria-hidden="true" />
            <span>Bengaluru Cafe Discovery</span>
          </div>
          <h1 className="font-serif-display text-3xl sm:text-5xl font-bold text-[#1c1613]">
            Find cafes in Bengaluru
          </h1>
          <p className="text-sm sm:text-base text-[#5c4e45]">
            Compare affordable neighbourhood tea &amp; coffee spots, bakery cafes, Wi-Fi workspaces,
            live distance, charging sockets, and official menu links.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleFindNearMe}
            disabled={geoStatus === 'requesting'}
            className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-lg bg-[#1b4d3e] hover:bg-[#163f33] disabled:opacity-60 text-white text-xs font-semibold transition-colors"
          >
            <LocateFixed className="w-4 h-4" aria-hidden="true" />
            <span>
              {geoStatus === 'requesting'
                ? 'Detecting location...'
                : userLocation
                ? 'Refresh My Location'
                : 'Find Near Me'}
            </span>
          </button>

          <div
            role="group"
            aria-label="View mode"
            className="inline-flex items-center p-1 rounded-lg bg-[#f3ede3] border border-[#e6ddd0]"
          >
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                viewMode === 'split'
                  ? 'bg-white text-[#1c1613] shadow-sm'
                  : 'text-[#5c4e45] hover:text-[#1c1613]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-[#1c1613] shadow-sm'
                  : 'text-[#5c4e45] hover:text-[#1c1613]'
              }`}
            >
              <List className="w-3.5 h-3.5" aria-hidden="true" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                viewMode === 'map'
                  ? 'bg-white text-[#1c1613] shadow-sm'
                  : 'text-[#5c4e45] hover:text-[#1c1613]'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Map</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            className="md:hidden inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-lg border border-[#d6cbba] bg-white text-xs font-semibold text-[#1c1613]"
          >
            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            <span>{mobileFiltersOpen ? 'Hide filters' : 'Filters'}</span>
          </button>

          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-lg border border-[#d6cbba] bg-white hover:bg-[#f3ede3] text-xs font-semibold text-[#1c1613] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* GPS Status Banner */}
      {(userLocation || geoError) && (
        <div
          className={`px-4 py-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
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

      {/* Search & Discovery Filter Panel */}
      <section
        aria-label="Cafe discovery filters"
        className={`rounded-2xl border border-[#e6ddd0] bg-white p-5 space-y-4 ${
          mobileFiltersOpen ? 'block' : 'hidden md:block'
        }`}
      >
        {/* Quick Curated Collection Chips + Interactive Cafe Finder Link */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-[#f3ede3]">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
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
            <label htmlFor="loc-q" className="block text-xs font-semibold text-[#5c4e45] mb-1">
              Search any Bengaluru cafe, street, item, or locality
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
                  onSubmitQuery={(q) => void searchLiveCafesInBengaluru(q)}
                  placeholder="Search Third Wave, CCD, Indiranagar, tea, coffee, burgers..."
                  inputClassName="w-full h-11 pl-9 pr-9 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
                />
              </div>
              {query.trim().length >= 2 && (
                <button
                  type="button"
                  disabled={nearbyLoading}
                  onClick={() => void searchLiveCafesInBengaluru(query)}
                  className="h-11 px-3.5 rounded-lg bg-[#1b4d3e] hover:bg-[#163f33] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <Search className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{nearbyLoading ? 'Searching...' : 'Search Live'}</span>
                </button>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="loc-area" className="block text-xs font-semibold text-[#5c4e45] mb-1">
              Bengaluru Locality
            </label>
            <select
              id="loc-area"
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                syncQueryParams({ area: e.target.value });
              }}
              className="w-full h-11 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
            >
              <option value="">All Bengaluru Areas</option>
              {areaOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="loc-dist" className="block text-xs font-semibold text-[#5c4e45] mb-1">
              Distance From Me
            </label>
            <select
              id="loc-dist"
              value={maxDistanceKm}
              onChange={(e) => handleDistanceChange(Number(e.target.value))}
              className="w-full h-11 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
            >
              <option value={0}>Any distance</option>
              <option value={2}>Within 2 km</option>
              <option value={5}>Within 5 km</option>
              <option value={10}>Within 10 km</option>
            </select>
          </div>

          <div>
            <label htmlFor="loc-mode" className="block text-xs font-semibold text-[#5c4e45] mb-1">
              Purpose / Atmosphere
            </label>
            <select
              id="loc-mode"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                syncQueryParams({ mode: e.target.value });
              }}
              className="w-full h-11 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
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
              className="flex items-center justify-between text-xs font-semibold text-[#5c4e45] mb-1"
            >
              <span>Budget Per Person</span>
              {!hasPlus && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#b45309]">
                  <Lock className="w-3 h-3" aria-hidden="true" />
                  Plus ₹79
                </span>
              )}
            </label>
            <select
              id="loc-budget"
              value={hasPlus ? budget : ''}
              onChange={(e) => {
                if (!hasPlus) {
                  openUpgradeModal({
                    featureName: 'Budget Per Person Filter',
                    requiredPlan: 'plus',
                    description:
                      'Filter cafes by average spend per person and compare full food & beverage prices with Cafe Desk Plus (₹79/mo or ₹499/yr).',
                  });
                  return;
                }
                const val = e.target.value as BudgetBracketId | '';
                setBudget(val);
                syncQueryParams({ budget: val });
              }}
              className="w-full h-11 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
            >
              <option value="">Any budget</option>
              {BUDGET_BRACKETS.map((b) => (
                <option key={b.id} value={b.id}>
                  {hasPlus ? b.label : `🔒 ${b.label}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="loc-wifi"
              className="flex items-center justify-between text-xs font-semibold text-[#5c4e45] mb-1"
            >
              <span>Minimum Wi-Fi Speed</span>
              {!hasPlus && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#b45309]">
                  <Lock className="w-3 h-3" aria-hidden="true" />
                  Plus ₹79
                </span>
              )}
            </label>
            <select
              id="loc-wifi"
              value={hasPlus ? minWifi : 0}
              onChange={(e) => {
                if (!hasPlus) {
                  openUpgradeModal({
                    featureName: 'Minimum Wi-Fi Speed Filter',
                    requiredPlan: 'plus',
                    description:
                      'Filter cafes by measured Wi-Fi speeds (50+, 80+, 100+ Mbps) with Cafe Desk Plus (₹79/mo or ₹499/yr).',
                  });
                  return;
                }
                setMinWifi(Number(e.target.value));
              }}
              className="w-full h-11 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
            >
              <option value={0}>Any speed</option>
              <option value={50}>{hasPlus ? '50+ Mbps (Measured)' : '🔒 50+ Mbps (Plus)'}</option>
              <option value={80}>{hasPlus ? '80+ Mbps (Measured)' : '🔒 80+ Mbps (Plus)'}</option>
              <option value={100}>{hasPlus ? '100+ Mbps (Measured)' : '🔒 100+ Mbps (Plus)'}</option>
            </select>
          </div>

          <div>
            <label htmlFor="loc-rating" className="block text-xs font-semibold text-[#5c4e45] mb-1">
              Google Rating
            </label>
            <select
              id="loc-rating"
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="w-full h-11 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
            >
              <option value={0}>Any rating</option>
              <option value={4.0}>4.0+ stars</option>
              <option value={4.5}>4.5+ stars</option>
            </select>
          </div>
        </div>

        {/* Amenity & Suitability Filter Toggles */}
        <div className="pt-3 border-t border-[#e6ddd0] flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {[
              { label: 'Laptop-friendly', checked: laptopFriendlyOnly, onChange: setLaptopFriendlyOnly, tierReq: 'free' as const },
              { label: 'Comfortable seating', checked: comfortableOnly, onChange: setComfortableOnly, tierReq: 'free' as const },
              { label: 'Suitable for studying', checked: studyOnly, onChange: setStudyOnly, tierReq: 'free' as const },
              { label: 'Quiet environment', checked: quietOnly, onChange: setQuietOnly, tierReq: 'free' as const },
              { label: 'Charging sockets', checked: socketsOnly, onChange: setSocketsOnly, tierReq: 'free' as const },
              { label: 'Outdoor seating', checked: outdoorOnly, onChange: setOutdoorOnly, tierReq: 'free' as const },
              { label: 'Wi-Fi available', checked: wifiOnly, onChange: setWifiOnly, tierReq: 'plus' as const },
              { label: 'Suitable for working', checked: workOnly, onChange: setWorkOnly, tierReq: 'plus' as const },
              { label: 'Meeting-friendly', checked: meetingOnly, onChange: setMeetingOnly, tierReq: 'plus' as const },
              { label: 'Tea & coffee', checked: teaCoffeeOnly, onChange: setTeaCoffeeOnly, tierReq: 'plus' as const },
              { label: 'Bakery & snacks', checked: bakerySnacksOnly, onChange: setBakerySnacksOnly, tierReq: 'plus' as const },
              { label: 'Burgers & sandwiches', checked: burgersSandwichesOnly, onChange: setBurgersSandwichesOnly, tierReq: 'plus' as const },
              { label: 'Open now', checked: openNowOnly, onChange: setOpenNowOnly, tierReq: 'free' as const },
              { label: 'Verified in person', checked: verifiedOnly, onChange: setVerifiedOnly, tierReq: 'free' as const },
            ].map((item) => {
              const requiredTier: 'plus' | null =
                item.tierReq === 'plus' && !hasPlus ? 'plus' : null;
              const locked = requiredTier !== null;
              return (
                <label
                  key={item.label}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[#1c1613] cursor-pointer min-h-[34px]"
                >
                  <input
                    type="checkbox"
                    checked={!locked && item.checked}
                    onChange={(e) => {
                      if (requiredTier) {
                        openUpgradeModal({
                          featureName: `${item.label} Filter`,
                          requiredPlan: 'plus',
                        });
                        return;
                      }
                      item.onChange(e.target.checked);
                    }}
                    className="w-4 h-4 accent-[#b45309] rounded"
                  />
                  <span>{item.label}</span>
                  {requiredTier && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#faf7f2] border border-[#e6ddd0] text-[10px] font-bold text-[#b45309]">
                      <Lock className="w-2.5 h-2.5" aria-hidden="true" />
                      Plus
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <select
              aria-label="Atmosphere vibe"
              value={atmosphere}
              onChange={(e) => setAtmosphere(e.target.value as 'any' | 'quiet' | 'lively')}
              className="h-10 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-xs font-semibold text-[#1c1613]"
            >
              <option value="any">Any Vibe</option>
              <option value="quiet">Quiet Acoustics</option>
              <option value="lively">Lively Buzz</option>
            </select>

            <label htmlFor="loc-sort" className="text-xs font-semibold text-[#5c4e45]">
              Sort by
            </label>
            <select
              id="loc-sort"
              value={sortBy}
              onChange={(e) => {
                const nextSort = e.target.value as SortOption;
                if (nextSort === 'wifi' && !hasPlus) {
                  openUpgradeModal({
                    featureName: 'Sort by Fastest Wi-Fi',
                    requiredPlan: 'plus',
                  });
                  return;
                }
                if (nextSort === 'cheapest' && !hasPlus) {
                  openUpgradeModal({
                    featureName: 'Sort by Lowest Budget',
                    requiredPlan: 'plus',
                  });
                  return;
                }
                setSortBy(nextSort);
              }}
              className="h-10 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm font-medium text-[#1c1613]"
            >
              <option value="distance" disabled={!userLocation}>
                Closest First {!userLocation ? '(Requires GPS)' : ''}
              </option>
              <option value="featured">Recommended</option>
              <option value="rating">Highest Rated</option>
              <option value="wifi">{hasPlus ? 'Fastest Wi-Fi' : '🔒 Fastest Wi-Fi (Plus)'}</option>
              <option value="cheapest">{hasPlus ? 'Lowest Budget' : '🔒 Lowest Budget (Plus)'}</option>
              <option value="quietest">Quietest First</option>
              <option value="recent">Recently Verified</option>
            </select>
          </div>
        </div>
      </section>

      {/* Results Summary + Live Area Discovery Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#5c4e45]">
        <p>
          Showing <strong className="text-[#1c1613] font-mono-data">{filteredLocations.length}</strong>{' '}
          curated {filteredLocations.length === 1 ? 'cafe' : 'cafes'}
          {area ? ` in ${area}` : ' across Bengaluru'}
          {filteredGooglePlaces.length > 0 && (
            <>
              {' '}
              + <strong className="text-[#1b4d3e] font-mono-data">{filteredGooglePlaces.length}</strong>{' '}
              live on Google Maps
            </>
          )}
        </p>

        <button
          type="button"
          disabled={nearbyLoading}
          onClick={() => handleDiscoverAreaLive()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-[#d6cbba] hover:border-[#b45309] text-xs font-semibold text-[#1c1613] transition-colors"
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
          heightClassName="h-[560px]"
        />
      )}

      {viewMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-6">
            {filteredLocations.length === 0 ? (
              <div className="rounded-2xl border border-[#e6ddd0] bg-white p-10 text-center space-y-3">
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
                    className="min-h-[42px] px-4 py-2 rounded-lg bg-[#1c1613] text-white text-xs font-semibold"
                  >
                    Clear all filters
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDiscoverAreaLive()}
                    className="min-h-[42px] px-4 py-2 rounded-lg bg-[#1b4d3e] text-white text-xs font-semibold"
                  >
                    Discover live cafes in {area || 'Bengaluru'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredLocations.map((loc) => (
                  <LocationCard key={loc.id} location={loc} />
                ))}
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
              heightClassName="h-[540px]"
            />
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        filteredLocations.length === 0 ? (
          <div className="rounded-2xl border border-[#e6ddd0] bg-white p-12 text-center space-y-3">
            <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
              No curated cafes match these filters
            </h2>
            <p className="text-sm text-[#5c4e45]">
              Try relaxing your minimum Wi-Fi or budget filters.
            </p>
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg bg-[#1c1613] text-white text-sm font-semibold"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLocations.map((loc) => (
              <LocationCard key={loc.id} location={loc} />
            ))}
          </div>
        )
      )}

      {/* Live Google Maps Discovery Cards */}
      {filteredGooglePlaces.length > 0 && (
        <section
          aria-labelledby="nearby-google-heading"
          className="pt-6 border-t border-[#e6ddd0] space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1b4d3e]">
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
              const snapshot = locationToLibrarySnapshot(locItem);
              const saved = isCafeSaved(snapshot.key);
              const favourited = isCafeFavourite(snapshot.key);
              const inCompare = compareList.some((c) => c.id === locItem.id);

              return (
                <article
                  key={gc.id}
                  className="bg-white rounded-2xl border border-[#e6ddd0] overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    <Link to={detailPath} className="block relative aspect-[16/10] bg-[#f3ede3] overflow-hidden">
                      {gc.photos[0] ? (
                        <>
                          <ResilientPhoto
                            src={gc.photos[0]}
                            alt={`${gc.name} in ${gc.areaLabel}`}
                            className="w-full h-full"
                            imgClassName="w-full h-full object-cover"
                          />
                          {gc.photos.length > 1 && (
                            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1c1613]/75 text-white text-[11px] font-mono-data">
                              <Images className="w-3 h-3" aria-hidden="true" />
                              <span>{gc.photos.length}</span>
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full p-4 flex flex-col justify-between bg-gradient-to-br from-[#f3ede3] to-[#e6ddd0]">
                          <span className="text-[11px] font-mono-data uppercase text-[#5c4e45]">
                            {gc.areaLabel} · Google Maps
                          </span>
                          <p className="font-serif-display text-lg font-bold text-[#1c1613] line-clamp-1">
                            {gc.name}
                          </p>
                        </div>
                      )}
                    </Link>

                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-[#5c4e45]">
                        <span className="font-semibold text-[#1b4d3e] truncate">
                          {gc.areaLabel}
                        </span>
                        {distText && (
                          <span className="inline-flex items-center gap-1 font-mono-data font-semibold text-[#1c1613] shrink-0">
                            <Navigation className="w-3 h-3 text-[#1b4d3e]" aria-hidden="true" />
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
                            {hasPlus ? (
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
                                <span>Budget · Plus</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      <div className="pt-2 border-t border-[#f3ede3] flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#5c4e45]">
                        <span>Wi-Fi: Not verified</span>
                        <span>·</span>
                        <span>Sockets: Not verified</span>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-4 space-y-2.5">
                    <div className="pt-2 border-t border-[#f3ede3] flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void toggleSaveCafe(snapshot, false)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border font-semibold ${
                            saved
                              ? 'bg-[#1c1613] text-white border-[#1c1613]'
                              : 'bg-[#faf7f2] text-[#5c4e45] border-[#e6ddd0] hover:border-[#b45309]'
                          }`}
                        >
                          <Bookmark className="w-3 h-3" aria-hidden="true" />
                          <span>{saved ? 'Saved' : 'Save'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleSaveCafe(snapshot, true)}
                          aria-label={favourited ? 'Remove favourite' : 'Mark favourite'}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border font-semibold ${
                            favourited
                              ? 'bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]'
                              : 'bg-[#faf7f2] text-[#5c4e45] border-[#e6ddd0] hover:border-[#b45309]'
                          }`}
                        >
                          <Heart className={`w-3 h-3 ${favourited ? 'fill-[#b91c1c]' : ''}`} aria-hidden="true" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCompareCafe(locItem)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border font-semibold ${
                          inCompare
                            ? 'bg-[#1b4d3e] text-white border-[#1b4d3e]'
                            : 'bg-[#faf7f2] text-[#5c4e45] border-[#e6ddd0] hover:border-[#b45309]'
                        }`}
                      >
                        {!hasPlus ? (
                          <Lock className="w-3 h-3 text-[#b45309]" aria-hidden="true" />
                        ) : (
                          <GitCompareArrows className="w-3 h-3" aria-hidden="true" />
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
                          className="inline-flex items-center gap-1 font-semibold text-[#5c4e45] hover:text-[#1c1613]"
                        >
                          <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Website</span>
                        </a>
                      ) : (
                        <span className="text-[#5c4e45]">Google Places</span>
                      )}

                      <div className="flex items-center gap-3">
                        <a
                          href={gc.mapLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[#5c4e45] hover:text-[#1c1613]"
                        >
                          <span>Directions</span>
                          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </a>
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
        </section>
      )}
    </div>
  );
}

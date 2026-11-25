import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Armchair,
  Award,
  BookOpen,
  Bookmark,
  Briefcase,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Copy,
  Flag,
  FolderPlus,
  GitCompareArrows,
  Globe,
  GraduationCap,
  Heart,
  Images,
  Instagram,
  Laptop,
  Loader2,
  LocateFixed,
  Lock,
  MapPin,
  Maximize2,
  MessageCircle,
  Navigation,
  Phone,
  Plug,
  RefreshCw,
  Share2,
  Sparkles,
  Star,
  Sun,
  Tag,
  Utensils,
  Volume2,
  Wifi,
  X,
} from 'lucide-react';
import { getNoiseSummary, NOISE_LABELS } from '../config/constants';
import { getUserSessionHeaders, locationToLibrarySnapshot, useAuth } from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import {
  googleDiscoveryToLocationItem,
  useDiscovery,
  type GoogleDiscoveryCafe,
} from '../context/DiscoveryContext';
import type { AccessSectionKey, AmenityState, LocationItem } from '../types/cms';
import {
  buildWhatsAppUrl,
  formatDistanceKm,
  getCafeOpenStatus,
  getStartingPriceLabel,
  getWorkspaceTypesForCafe,
  useDocumentMeta,
} from '../utils/cafeHelpers';
import {
  isOutdoorFriendly,
  recordRecentlyViewedSlug,
} from '../utils/cafeRecommendations';
import { InteractiveCafeMap } from '../components/InteractiveCafeMap';
import { LocationCard } from '../components/LocationCard';
import { PremiumLockCard } from '../components/PremiumLockCard';
import { ResilientPhoto } from '../components/ResilientPhoto';

function formatAmenityLabel(state: AmenityState, yesText: string, noText: string): string {
  if (state === 'yes') return yesText;
  if (state === 'no') return noText;
  return 'Not verified yet';
}

export function LocationDetailPage() {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const lookupKey = slug ?? id ?? '';
  const isGoogleRoute = lookupKey.startsWith('google:');
  const googlePlaceId = useMemo(
    () => (isGoogleRoute ? decodeURIComponent(lookupKey.slice(7)) : ''),
    [isGoogleRoute, lookupKey]
  );

  const { locations, settings } = useCms();
  const {
    loading: authLoading,
    authenticated,
    user,
    subscription,
    tier,
    isSubscribed,
    isExpired,
    isSuspended,
    expiredPlanName,
    hasPermission,
    plans,
    openCheckout,
    openUpgradeModal,
    isCafeSaved,
    isCafeFavourite,
    toggleSaveCafe,
    collections,
    addCafeToCollection,
    compareList,
    toggleCompareCafe,
  } = useAuth();
  const {
    userLocation,
    requestUserLocation,
    enrichLocationFromPlaces,
    getEffectiveLocation,
    livePlaceCache,
    fetchGooglePlaceDetails,
    placesReady,
  } = useDiscovery();

  const [serverCafe, setServerCafe] = useState<LocationItem | null>(null);
  const [serverLoading, setServerLoading] = useState<boolean>(() => !isGoogleRoute);

  const contextLocation = useMemo(
    () => (isGoogleRoute ? undefined : locations.find((l) => l.slug === lookupKey || l.id === lookupKey)),
    [locations, lookupKey, isGoogleRoute]
  );

  const baseLocation = serverCafe ?? contextLocation;

  const [fetchedGooglePlace, setFetchedGooglePlace] = useState<GoogleDiscoveryCafe | null>(null);
  const [loadingGooglePlace, setLoadingGooglePlace] = useState(false);
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(false);
  const [collectionAddedNotice, setCollectionAddedNotice] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);
  const [copiedWifiPass, setCopiedWifiPass] = useState(false);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookName, setBookName] = useState('');
  const [bookEmail, setBookEmail] = useState('');
  const [bookPhone, setBookPhone] = useState('');
  const [bookWorkspace, setBookWorkspace] = useState('Laptop Desk');
  const [bookDate, setBookDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bookSlot, setBookSlot] = useState('09:00 AM - 12:00 PM');
  const [bookGuests, setBookGuests] = useState(1);
  const [bookNotes, setBookNotes] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccessRef, setBookingSuccessRef] = useState('');

  useEffect(() => {
    if (user) {
      setBookName((prev) => prev || user.name || '');
      setBookEmail((prev) => prev || user.email || '');
    }
  }, [user]);

  useEffect(() => {
    if (isGoogleRoute) {
      setServerLoading(false);
      setServerCafe(null);
      return;
    }
    if (!lookupKey) return;
    let cancelled = false;
    setServerLoading(true);

    void fetch(`/api/cafes/${encodeURIComponent(lookupKey)}`, {
      credentials: 'include',
      headers: getUserSessionHeaders(),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const ct = res.headers.get('content-type') || '';
          if (!ct.includes('application/json')) return;
          const data = (await res.json()) as { cafe?: LocationItem };
          if (!cancelled && data.cafe) {
            setServerCafe(data.cafe);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setServerLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lookupKey, isGoogleRoute, authenticated, isSubscribed, isExpired, isSuspended, tier]);

  useEffect(() => {
    if (baseLocation && authenticated) {
      recordRecentlyViewedSlug(baseLocation.slug);
      void enrichLocationFromPlaces(baseLocation);
    }
  }, [baseLocation, authenticated, enrichLocationFromPlaces]);

  useEffect(() => {
    if (!isGoogleRoute || !googlePlaceId || !authenticated) return;
    let cancelled = false;
    setLoadingGooglePlace(true);
    void fetchGooglePlaceDetails(googlePlaceId).then((res) => {
      if (!cancelled) {
        if (res) setFetchedGooglePlace(res);
        setLoadingGooglePlace(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isGoogleRoute, googlePlaceId, placesReady, authenticated, fetchGooglePlaceDetails]);

  const activeGooglePlace = isGoogleRoute
    ? fetchedGooglePlace ?? livePlaceCache[googlePlaceId] ?? null
    : null;

  const location = useMemo(() => {
    if (baseLocation) return getEffectiveLocation(baseLocation);
    if (activeGooglePlace) return googleDiscoveryToLocationItem(activeGooglePlace);
    return undefined;
  }, [baseLocation, activeGooglePlace, getEffectiveLocation]);

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const [openSections, setOpenSections] = useState({
    menu: true,
    amenities: false,
    reviews: false,
    plans: false,
    map: true,
  });
  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const approvedPhotosList =
    location && location.photos_approved ? location.photos : [];

  useEffect(() => {
    setActivePhotoIdx(0);
    setLightboxOpen(false);
    setCollectionMenuOpen(false);
    setCollectionAddedNotice('');
    setBookingOpen(false);
    setBookingError('');
    setBookingSuccessRef('');
  }, [lookupKey]);

  useEffect(() => {
    if (!lightboxOpen || approvedPhotosList.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowRight') {
        setActivePhotoIdx((i) => (i + 1) % approvedPhotosList.length);
      } else if (e.key === 'ArrowLeft') {
        setActivePhotoIdx(
          (i) => (i - 1 + approvedPhotosList.length) % approvedPhotosList.length
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxOpen, approvedPhotosList.length]);

  const metaDescription = location
    ? [
        location.verdict || location.claims[0] || `${location.name} in ${location.area}`,
        location.wifi_mbps !== null
          ? `Wi-Fi ${location.wifi_mbps} Mbps`
          : location.wifi_available === 'yes'
          ? 'Wi-Fi available'
          : 'Wi-Fi unverified',
        location.avg_cost_per_person !== null ? `Avg ₹${location.avg_cost_per_person}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Explore work and study cafes in Bengaluru.';

  useDocumentMeta(
    location
      ? `${location.name} – ${location.area}, Bengaluru | ${settings.brand_name}`
      : isGoogleRoute && loadingGooglePlace
      ? `Loading Cafe Details – ${settings.brand_name}`
      : `Location Not Found – ${settings.brand_name}`,
    metaDescription,
    {
      ogImage:
        location && location.photos_approved && location.photos.length > 0
          ? location.photos[0]
          : settings.seo_og_image,
      allowIndexing: settings.seo_allow_indexing,
    }
  );

  if (authLoading || (!isGoogleRoute && serverLoading && !location)) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-24 text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#b45309] mx-auto" aria-hidden="true" />
        <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#1c1613]">
          Loading cafe workspace guide...
        </h1>
      </div>
    );
  }

  if (isGoogleRoute && !authenticated && !activeGooglePlace) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 space-y-6">
        <Link
          to="/locations"
          className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-full bg-white border border-[#e6ddd0] text-sm font-medium text-[#1c1613]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Bengaluru cafe explorer</span>
        </Link>
        <PremiumLockCard
          title="Live Google Maps Cafe Details"
          description="Sign in and activate a Cafe Desk subscription to view live Google Maps cafe details, hours, photos, and directions."
          lockReason="guest"
        />
      </div>
    );
  }

  if (!location && isGoogleRoute && (loadingGooglePlace || !placesReady)) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-24 text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#b45309] mx-auto" aria-hidden="true" />
        <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#1c1613]">
          Loading live Bengaluru cafe details...
        </h1>
        <p className="text-sm text-[#5c4e45]">
          Fetching real photographs, address, opening hours, and directions from Google Maps.
        </p>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center space-y-4">
        <div className="bg-white rounded-2xl border border-[#e6ddd0] p-8 space-y-4">
          <h1 className="font-serif-display text-3xl font-bold text-[#1c1613]">Cafe not found</h1>
          <p className="text-sm text-[#5c4e45]">
            This cafe listing may have been moved or unpublished.
          </p>
          <Link
            to="/locations"
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Explore all Bengaluru cafes</span>
          </Link>
        </div>
      </div>
    );
  }

  const openStatus = getCafeOpenStatus(location.timings);
  const approvedPhotos = location.photos_approved ? location.photos : [];
  const safePhotoIdx =
    approvedPhotos.length > 0 ? Math.min(activePhotoIdx, approvedPhotos.length - 1) : 0;
  const distText = formatDistanceKm(location.distanceKm);
  const noiseSummary = getNoiseSummary(location.noise_level);
  const structuredMenuItems = location.menu_items ?? [];
  const hasAnyFoodPrices = Boolean(
    location.coffee_price ||
      location.tea_price ||
      location.snacks_price ||
      location.meals_price ||
      location.popular_items.length > 0 ||
      structuredMenuItems.length > 0 ||
      location.menu_services.length > 0
  );
  const liveOpeningHours =
    'openingHours' in location && Array.isArray(location.openingHours)
      ? location.openingHours
      : [];

  const defaultUnlocked: Record<AccessSectionKey, boolean> = {
    wifi_details: isSubscribed,
    power_sockets: isSubscribed,
    workspace_details: isSubscribed,
    food_menu: isSubscribed,
    menu_pricing: isSubscribed,
    amenities: isSubscribed,
    subscriber_benefits: isSubscribed,
    booking: isSubscribed,
  };
  const accessInfo = location.access;
  const unlocked = accessInfo?.unlockedSections ?? defaultUnlocked;
  const lockReason =
    accessInfo?.lockReason && accessInfo.lockReason !== 'none'
      ? accessInfo.lockReason
      : !authenticated
      ? 'guest'
      : isSuspended
      ? 'suspended'
      : isExpired
      ? 'expired'
      : 'no_subscription';
  const allowedPlanIds = accessInfo?.allowedPlanIds ?? [];
  const renewPlanId =
    (subscription?.expired_from_plan &&
    plans.some((p) => p.id === subscription.expired_from_plan && p.active)
      ? subscription.expired_from_plan
      : plans.find((p) => p.id !== 'free' && p.active && p.is_recommended)?.id ||
        plans.find((p) => p.id !== 'free' && p.active)?.id) || 'plus';

  const collectionsAllowed = hasPermission('collections');
  const compareAllowed = hasPermission('compare');

  const cafeSnapshot = locationToLibrarySnapshot(location);
  const saved = isCafeSaved(cafeSnapshot.key);
  const favourited = isCafeFavourite(cafeSnapshot.key);
  const inCompare = compareList.some((c) => c.id === location.id);
  const outdoorFriendly = isOutdoorFriendly(location);
  const workspaceTypes = getWorkspaceTypesForCafe(location);
  const startingPrice = unlocked.menu_pricing ? getStartingPriceLabel(location) : 'Subscribers Only';

  const handleSaveToggle = async (favouriteMode: boolean) => {
    await toggleSaveCafe(cafeSnapshot, favouriteMode);
  };

  const handleShareCafe = async () => {
    const shareUrl = window.location.href;
    const shareTitle = `${location.name} (${location.area}, Bengaluru) | ${settings.brand_name}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      window.setTimeout(() => setCopiedShare(false), 2500);
    } catch {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedShare(true);
        window.setTimeout(() => setCopiedShare(false), 2500);
      } catch {
        // ignore clipboard denial
      }
    }
  };

  const handleCopyWifiPassword = async () => {
    if (!location.wifi_password) return;
    try {
      await navigator.clipboard.writeText(location.wifi_password);
      setCopiedWifiPass(true);
      window.setTimeout(() => setCopiedWifiPass(false), 2200);
    } catch {
      // ignore clipboard errors
    }
  };

  const similarCafes = useMemo(() => {
    if (!location) return [];
    const currentModes = new Set(location.best_for.map((m) => m.toLowerCase()));
    return locations
      .filter((c) => c.id !== location.id && c.slug !== location.slug)
      .map((c) => getEffectiveLocation(c))
      .sort((a, b) => {
        const aArea = a.area.toLowerCase() === location.area.toLowerCase() ? 3 : 0;
        const bArea = b.area.toLowerCase() === location.area.toLowerCase() ? 3 : 0;
        const aMode = a.best_for.some((m) => currentModes.has(m.toLowerCase())) ? 1 : 0;
        const bMode = b.best_for.some((m) => currentModes.has(m.toLowerCase())) ? 1 : 0;
        const scoreDiff = bArea + bMode - (aArea + aMode);
        if (scoreDiff !== 0) return scoreDiff;
        return (b.rating ?? 0) - (a.rating ?? 0);
      })
      .slice(0, 4);
  }, [locations, location, getEffectiveLocation]);

  const handleGalleryTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleGalleryTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || approvedPhotos.length <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const dx = endX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) {
      setActivePhotoIdx((safePhotoIdx + 1) % approvedPhotos.length);
    } else {
      setActivePhotoIdx((safePhotoIdx - 1 + approvedPhotos.length) % approvedPhotos.length);
    }
  };

  const waUrl = buildWhatsAppUrl(
    `Hi ${settings.brand_name}! Sharing feedback or asking a question about ${location.name} (${location.area}, ${location.city}).`,
    settings.whatsapp_number
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-10 pb-28 md:pb-14 space-y-8 sm:space-y-10">
      <nav aria-label="Breadcrumb">
        <Link
          to="/locations"
          className="inline-flex items-center gap-2 min-h-[40px] px-4 py-1.5 rounded-full bg-white border border-[#e6ddd0] text-xs sm:text-sm font-medium text-[#5c4e45] hover:text-[#1c1613] hover:border-[#b45309] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Bengaluru explorer</span>
        </Link>
      </nav>

      {/* Expired or Suspended Subscription Alert Banner */}
      {isExpired && (
        <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#991b1b] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-[#991b1b]">Your subscription has expired</p>
              <p className="text-xs text-[#5c4e45]">
                {expiredPlanName ? `Your ${expiredPlanName} plan has ended. ` : ''}
                Renew your subscription to restore access to Wi-Fi speeds &amp; passwords, socket
                locations, food menus, prices, and booking.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openCheckout(renewPlanId)}
            className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold shrink-0 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Renew Subscription</span>
          </button>
        </div>
      )}

      {isSuspended && (
        <div className="rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#b45309] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-[#92400e]">Subscription suspended</p>
              <p className="text-xs text-[#5c4e45]">
                Your subscription access is currently suspended. Protected cafe details are locked.
              </p>
            </div>
          </div>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center min-h-[42px] px-4 py-2 rounded-xl bg-[#1c1613] text-white text-xs font-semibold shrink-0"
          >
            Contact Support
          </Link>
        </div>
      )}

      {/* Branch Header */}
      <header className="grid grid-cols-1 lg:grid-cols-12 gap-7 sm:gap-8 items-start">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="px-2.5 py-1 rounded-full bg-[#fef3c7] text-[#92400e]">
              {location.city} · {location.area}
            </span>
            {distText && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#ecfdf5] text-[#1b4d3e] font-mono-data">
                <Navigation className="w-3 h-3" aria-hidden="true" />
                {distText}
              </span>
            )}
            <span
              className={`px-2.5 py-1 rounded-full ${
                openStatus === 'open'
                  ? 'bg-[#ecfdf5] text-[#1b4d3e]'
                  : openStatus === 'closed'
                  ? 'bg-[#fef2f2] text-[#991b1b]'
                  : 'bg-[#f3ede3] text-[#5c4e45]'
              }`}
            >
              {openStatus === 'open'
                ? 'Open now'
                : openStatus === 'closed'
                ? 'Closed now'
                : 'Check hours'}
            </span>
            {location.verified ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#e6ddd0] text-[#1b4d3e]">
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                Verified Cafe
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#e6ddd0] text-[#5c4e45]">
                <Clock className="w-3 h-3 text-[#b45309]" aria-hidden="true" />
                Public Listing
              </span>
            )}
            {location.featured && (
              <span className="px-2.5 py-1 rounded-full bg-[#1c1613] text-[#f59e0b]">Featured</span>
            )}
          </div>

          <h1 className="font-serif-display text-3xl sm:text-5xl font-bold text-[#1c1613] leading-[1.1] tracking-tight">
            {location.name}
          </h1>

          {/* Rating & Address */}
          <div className="flex flex-wrap items-center gap-2.5 text-sm text-[#5c4e45]">
            {location.rating !== null ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-[#e6ddd0] font-semibold text-[#1c1613]">
                <Star className="w-4 h-4 text-[#d97706] fill-[#d97706]" aria-hidden="true" />
                <span className="font-mono-data">{location.rating.toFixed(1)}</span>
                {location.rating_count !== null && (
                  <span className="text-[#5c4e45] font-normal text-xs">
                    ({location.rating_count})
                  </span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs">
                <Star className="w-4 h-4 text-[#d97706]" aria-hidden="true" />
                Not rated yet
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span>{location.address}</span>
          </div>

          <p className="text-base sm:text-lg text-[#5c4e45] leading-relaxed">
            {location.description || location.verdict || location.claims[0]}
          </p>

          {/* Direct Discovery & Cafe Platform Links */}
          <div className="flex flex-wrap gap-2.5 pt-1">
            <a
              href={location.map_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-sm font-semibold transition-colors"
            >
              <MapPin className="w-4 h-4" aria-hidden="true" />
              <span>Get Directions</span>
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            </a>

            {unlocked.amenities && location.website_url && (
              <a
                href={location.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1c1613] hover:bg-[#312722] text-white text-sm font-semibold transition-colors"
              >
                <Globe className="w-4 h-4" aria-hidden="true" />
                <span>Visit Website</span>
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </a>
            )}

            {unlocked.food_menu && location.menu_url && (
              <a
                href={location.menu_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-[#e6ddd0] hover:border-[#b45309] text-[#1c1613] text-sm font-semibold transition-colors"
              >
                <Utensils className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
                <span>View Menu</span>
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </a>
            )}

            {unlocked.amenities && location.instagram_url && (
              <a
                href={location.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-[#e6ddd0] hover:border-[#b45309] text-[#1c1613] text-sm font-semibold transition-colors"
              >
                <Instagram className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
                <span>Instagram</span>
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </a>
            )}

            {unlocked.amenities && location.phone && (
              <a
                href={`tel:${location.phone.replace(/\s+/g, '')}`}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-[#1b4d3e] text-sm font-semibold"
              >
                <Phone className="w-4 h-4" aria-hidden="true" />
                <span>Call Cafe</span>
              </a>
            )}
          </div>

          {/* Save / Favourite / Collection / Compare / Share Strip */}
          <div className="flex flex-wrap items-center gap-2 pt-1 relative">
            <button
              type="button"
              onClick={() => void handleSaveToggle(false)}
              className={`inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                saved
                  ? 'bg-[#fef3c7] border-[#f59e0b]/50 text-[#92400e]'
                  : 'bg-white border-[#e6ddd0] text-[#1c1613] hover:border-[#b45309]'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${saved ? 'fill-[#92400e]' : ''}`} aria-hidden="true" />
              <span>{saved ? 'Saved to Library' : 'Save Cafe'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSaveToggle(true)}
              className={`inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                favourited
                  ? 'bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]'
                  : 'bg-white border-[#e6ddd0] text-[#1c1613] hover:border-[#b45309]'
              }`}
            >
              <Heart
                className={`w-4 h-4 ${favourited ? 'fill-[#b91c1c] text-[#b91c1c]' : ''}`}
                aria-hidden="true"
              />
              <span>{favourited ? 'Favourited' : 'Favourite'}</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!collectionsAllowed) {
                    openUpgradeModal({
                      featureName: 'Personal Cafe Collections',
                      requiredPlan: 'plus',
                      description: isExpired
                        ? 'Your subscription has expired. Renew your plan to organize cafes into custom collections.'
                        : 'Organize Bengaluru cafes into custom lists like "Indiranagar Deep Work" or "Budget Study Spots".',
                    });
                    return;
                  }
                  setCollectionMenuOpen((v) => !v);
                }}
                className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#e6ddd0] hover:border-[#b45309] text-[#1c1613] text-xs font-semibold transition-colors"
              >
                {!collectionsAllowed ? (
                  <Lock className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                ) : (
                  <FolderPlus className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
                )}
                <span>Add to Collection</span>
              </button>

              {collectionsAllowed && collectionMenuOpen && (
                <div className="absolute left-0 mt-2 w-64 rounded-2xl bg-white border border-[#e6ddd0] shadow-xl p-2 z-30 space-y-1">
                  {collections.length === 0 ? (
                    <div className="p-2.5 text-xs text-[#5c4e45] space-y-2">
                      <p>You haven&apos;t created a cafe collection yet.</p>
                      <Link
                        to="/account"
                        className="inline-block font-semibold text-[#b45309] hover:underline"
                      >
                        Create one in My Account &rarr;
                      </Link>
                    </div>
                  ) : (
                    collections.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={async () => {
                          await addCafeToCollection(col.id, cafeSnapshot);
                          setCollectionMenuOpen(false);
                          setCollectionAddedNotice(`Added to "${col.name}"`);
                        }}
                        className="w-full min-h-[40px] text-left px-3 py-2 rounded-xl hover:bg-[#faf7f2] text-xs font-semibold text-[#1c1613] flex items-center justify-between"
                      >
                        <span className="truncate">{col.name}</span>
                        <span className="text-[11px] text-[#5c4e45] font-mono-data">
                          {col.items.length}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => toggleCompareCafe(location)}
              className={`inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                inCompare
                  ? 'bg-[#1b4d3e] border-[#1b4d3e] text-white'
                  : 'bg-white border-[#e6ddd0] text-[#1c1613] hover:border-[#b45309]'
              }`}
            >
              {!compareAllowed ? (
                <Lock className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
              ) : (
                <GitCompareArrows className="w-4 h-4" aria-hidden="true" />
              )}
              <span>{inCompare ? 'Added to Compare' : 'Compare Cafe'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleShareCafe()}
              className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-xl bg-white border border-[#e6ddd0] hover:border-[#b45309] text-[#1c1613] text-xs font-semibold transition-colors"
            >
              <Share2 className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
              <span>{copiedShare ? 'Link copied!' : 'Share'}</span>
            </button>

            {collectionAddedNotice && (
              <span className="text-xs font-semibold text-[#1b4d3e]">
                {collectionAddedNotice}
              </span>
            )}
          </div>
        </div>

        {/* Real Cafe Photo Gallery */}
        <div className="lg:col-span-5">
          {approvedPhotos.length > 0 ? (
            <div className="space-y-3">
              <div
                className="relative group rounded-2xl overflow-hidden border border-[#e6ddd0] bg-[#f3ede3] touch-pan-y shadow-xs"
                onTouchStart={handleGalleryTouchStart}
                onTouchEnd={handleGalleryTouchEnd}
              >
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="block w-full text-left cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b45309]"
                  aria-label={`Open full-size photo gallery for ${location.name}`}
                >
                  <ResilientPhoto
                    key={approvedPhotos[safePhotoIdx]}
                    src={approvedPhotos[safePhotoIdx]}
                    alt={`${location.name} (${location.area}) photograph ${safePhotoIdx + 1} of ${approvedPhotos.length}`}
                    className="w-full aspect-[4/3] group-hover:scale-105 transition-transform duration-500"
                    priority
                  />
                </button>

                {approvedPhotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePhotoIdx(
                          (safePhotoIdx - 1 + approvedPhotos.length) % approvedPhotos.length
                        );
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-[#1c1613] border border-[#e6ddd0] shadow-sm hover:bg-white flex items-center justify-center transition-colors"
                      aria-label="Previous cafe photo"
                    >
                      <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePhotoIdx((safePhotoIdx + 1) % approvedPhotos.length);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-[#1c1613] border border-[#e6ddd0] shadow-sm hover:bg-white flex items-center justify-center transition-colors"
                      aria-label="Next cafe photo"
                    >
                      <ChevronRight className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </>
                )}

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c1613]/80 text-white text-xs font-mono-data font-medium">
                    <Images className="w-3.5 h-3.5 text-[#f59e0b]" aria-hidden="true" />
                    <span>
                      {safePhotoIdx + 1} / {approvedPhotos.length}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="pointer-events-auto inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1 rounded-lg bg-white/95 hover:bg-white text-[#1c1613] border border-[#e6ddd0] shadow-xs text-xs font-semibold transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Expand</span>
                  </button>
                </div>
              </div>

              {approvedPhotos.length > 1 && (
                <div
                  className="grid grid-cols-5 gap-2"
                  role="tablist"
                  aria-label={`${location.name} photo thumbnails`}
                >
                  {approvedPhotos.map((photoUrl, idx) => {
                    const isActive = idx === safePhotoIdx;
                    return (
                      <button
                        key={photoUrl}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-label={`View ${location.name} photo ${idx + 1}`}
                        onClick={() => setActivePhotoIdx(idx)}
                        className={`relative aspect-[4/3] rounded-xl overflow-hidden border transition-all focus:outline-none ${
                          isActive
                            ? 'border-[#b45309] ring-2 ring-[#b45309] opacity-100'
                            : 'border-[#e6ddd0] opacity-75 hover:opacity-100'
                        }`}
                      >
                        <ResilientPhoto
                          src={photoUrl}
                          alt={`${location.name} gallery thumbnail ${idx + 1}`}
                          className="w-full h-full"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-[4/3] rounded-2xl border border-[#e6ddd0] bg-white p-7 flex flex-col justify-between text-[#1c1613]">
              <div className="flex items-center justify-between text-xs text-[#5c4e45]">
                <span className="font-mono-data uppercase font-medium">
                  {location.city} · {location.area}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] font-semibold">
                  Verified Data
                </span>
              </div>
              <div className="space-y-2">
                <p className="font-serif-display text-2xl font-bold">{location.name}</p>
                <p className="text-sm text-[#5c4e45] leading-relaxed">
                  Real cafe photographs are sourced only from official cafe websites, official
                  Instagram pages, or verified field visits.
                </p>
              </div>
              <p className="text-xs text-[#5c4e45] font-mono-data">{location.timings}</p>
            </div>
          )}
        </div>
      </header>

      {/* Workspace, Study & Budget Specs */}
      <section aria-labelledby="specs-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="specs-heading" className="font-serif-display text-2xl sm:text-3xl font-bold text-[#1c1613]">
            Workspace, Wi-Fi &amp; Budget Details
          </h2>
          {plans.length > 0 && (
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-full bg-white border border-[#e6ddd0] text-xs font-semibold text-[#1c1613] hover:border-[#b45309] transition-colors"
            >
              <Award className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
              <span>View Membership Plans</span>
            </Link>
          )}
        </div>

        {!unlocked.wifi_details &&
        !unlocked.power_sockets &&
        !unlocked.workspace_details &&
        !unlocked.menu_pricing ? (
          <PremiumLockCard
            title="Wi-Fi, Power Sockets & Workspace Specs"
            description="Verified Wi-Fi speeds, Wi-Fi passwords, charging socket availability, acoustic noise ratings, seating capacity, and average budget are reserved for active subscribers."
            previewHints={[
              'Wi-Fi speed & credentials',
              'Power socket availability & locations',
              'Acoustic noise & desk suitability',
              'Average spend per person',
            ]}
            lockReason={lockReason}
            allowedPlanIds={allowedPlanIds}
          />
        ) : (
          <>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {unlocked.wifi_details ? (
                <div className="bg-white rounded-2xl border border-[#e6ddd0] p-5 space-y-2">
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#5c4e45]">
                    <Wifi className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
                    <span>Wi-Fi Speed</span>
                  </dt>
                  <dd className="text-xs font-semibold text-[#1b4d3e]">
                    {location.wifi_available === 'yes'
                      ? 'Wi-Fi Available'
                      : location.wifi_available === 'no'
                      ? 'No Wi-Fi'
                      : 'Availability not verified'}
                  </dd>
                  <p className="font-mono-data text-lg sm:text-xl font-bold text-[#1c1613]">
                    {location.wifi_mbps !== null ? `${location.wifi_mbps} Mbps` : 'Speed not verified'}
                  </p>
                  {location.wifi_password && (
                    <div className="pt-2 mt-1 border-t border-[#e6ddd0] flex items-center justify-between gap-2 text-xs">
                      <span className="text-[#5c4e45]">
                        Pass:{' '}
                        <code className="font-mono-data font-bold text-[#1c1613]">
                          {location.wifi_password}
                        </code>
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyWifiPassword()}
                        className="inline-flex items-center gap-1 min-h-[30px] px-2.5 py-0.5 rounded-lg bg-[#faf7f2] border border-[#e6ddd0] text-[11px] font-semibold text-[#1c1613] hover:border-[#b45309]"
                      >
                        {copiedWifiPass ? (
                          <Check className="w-3 h-3 text-[#1b4d3e]" aria-hidden="true" />
                        ) : (
                          <Copy className="w-3 h-3" aria-hidden="true" />
                        )}
                        <span>{copiedWifiPass ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <PremiumLockCard
                  compact
                  title="Wi-Fi Details & Password"
                  lockReason={lockReason}
                  allowedPlanIds={allowedPlanIds}
                />
              )}

              {unlocked.power_sockets ? (
                <div className="bg-white rounded-2xl border border-[#e6ddd0] p-5 space-y-1.5">
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#5c4e45]">
                    <Plug className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
                    <span>Charging Sockets</span>
                  </dt>
                  <dd className="font-mono-data text-lg sm:text-xl font-bold text-[#1c1613] pt-1">
                    {location.sockets_count !== null
                      ? `${location.sockets_count} available`
                      : location.charging_sockets === 'yes' || location.sockets_claimed
                      ? 'Sockets available'
                      : location.charging_sockets === 'no'
                      ? 'Not available'
                      : 'Not verified'}
                  </dd>
                </div>
              ) : (
                <PremiumLockCard
                  compact
                  title="Power Socket Info"
                  lockReason={lockReason}
                  allowedPlanIds={allowedPlanIds}
                />
              )}

              {unlocked.workspace_details ? (
                <div className="bg-white rounded-2xl border border-[#e6ddd0] p-5 space-y-1.5">
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#5c4e45]">
                    <Volume2 className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
                    <span>Noise Level</span>
                  </dt>
                  <dd className="text-base font-semibold pt-1 text-[#1c1613]">
                    {location.noise_level !== null
                      ? `${noiseSummary} · ${NOISE_LABELS[location.noise_level]}`
                      : 'Not measured yet'}
                  </dd>
                </div>
              ) : (
                <PremiumLockCard
                  compact
                  title="Workspace Acoustics"
                  lockReason={lockReason}
                  allowedPlanIds={allowedPlanIds}
                />
              )}

              {unlocked.menu_pricing ? (
                <div className="bg-white rounded-2xl border border-[#e6ddd0] p-5 space-y-1.5">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-[#5c4e45]">
                    Price Range &amp; Budget
                  </dt>
                  <dd className="font-mono-data text-lg sm:text-xl font-bold text-[#1c1613] pt-1">
                    {location.price_range ||
                      (location.avg_cost_per_person !== null
                        ? `₹${location.avg_cost_per_person} avg`
                        : startingPrice)}
                  </dd>
                  {location.price_range && location.avg_cost_per_person !== null && (
                    <p className="text-xs text-[#5c4e45] font-mono-data">
                      {startingPrice} · ~₹{location.avg_cost_per_person} per person
                    </p>
                  )}
                </div>
              ) : (
                <PremiumLockCard
                  compact
                  title="Budget & Menu Pricing"
                  lockReason={lockReason}
                  allowedPlanIds={allowedPlanIds}
                />
              )}
            </dl>

            {/* Study & Work Readiness Row */}
            {unlocked.workspace_details ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl border border-[#e6ddd0] p-4 space-y-1">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-[#5c4e45]">
                      <Briefcase className="w-3.5 h-3.5 text-[#1b4d3e]" aria-hidden="true" />
                      <span>Working</span>
                    </p>
                    <p className="text-sm font-semibold text-[#1c1613]">
                      {formatAmenityLabel(
                        location.suitable_for_working,
                        'Suitable for remote work',
                        'Better for casual visits'
                      )}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-[#e6ddd0] p-4 space-y-1">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-[#5c4e45]">
                      <BookOpen className="w-3.5 h-3.5 text-[#1b4d3e]" aria-hidden="true" />
                      <span>Studying</span>
                    </p>
                    <p className="text-sm font-semibold text-[#1c1613]">
                      {formatAmenityLabel(
                        location.suitable_for_studying,
                        'Good for focused study',
                        'Not ideal for study'
                      )}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-[#e6ddd0] p-4 space-y-1">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-[#5c4e45]">
                      <Armchair className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                      <span>Seating</span>
                    </p>
                    <p className="text-sm font-semibold text-[#1c1613]">
                      {location.seating_info
                        ? location.seating_info
                        : formatAmenityLabel(
                            location.comfortable_seating,
                            'Comfortable seating',
                            'Compact seating'
                          )}
                    </p>
                    {location.ambience && (
                      <p className="text-[11px] text-[#5c4e45]">{location.ambience}</p>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-[#e6ddd0] p-4 space-y-1">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-[#5c4e45]">
                      <Laptop className="w-3.5 h-3.5 text-[#1b4d3e]" aria-hidden="true" />
                      <span>Laptops</span>
                    </p>
                    <p className="text-sm font-semibold text-[#1c1613]">
                      {location.laptop_friendly ? 'Laptop-friendly' : 'Not verified / Short visits'}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-[#e6ddd0] p-4 space-y-1">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-[#5c4e45]">
                      <Sun className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                      <span>Outdoor Seating</span>
                    </p>
                    <p className="text-sm font-semibold text-[#1c1613]">
                      {outdoorFriendly
                        ? 'Outdoor / garden seating available'
                        : 'Outdoor seating not verified'}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-[#e6ddd0] p-4 space-y-1">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-[#5c4e45]">
                      <Clock className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                      <span>Hours &amp; Stay</span>
                    </p>
                    <p className="text-xs font-semibold text-[#1c1613] leading-snug">
                      {location.timings}
                    </p>
                    <p className="text-[11px] text-[#5c4e45]">
                      {location.min_spend ? `Min spend ${location.min_spend}` : 'No min spend noted'} ·{' '}
                      {location.time_limit || 'No time limit reported'}
                    </p>
                  </div>
                </div>

                {/* Workspace Options & Seat Availability */}
                <div className="bg-white rounded-2xl border border-[#e6ddd0] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#1b4d3e]">
                      Workspace Options &amp; Seat Availability
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {workspaceTypes.map((wt) => (
                        <span
                          key={wt}
                          className="px-3 py-1 rounded-full bg-[#faf7f2] border border-[#e6ddd0] text-xs font-medium text-[#1c1613]"
                        >
                          {wt}
                        </span>
                      ))}
                      {location.seating_info && (
                        <span className="px-3 py-1 rounded-full bg-[#ecfdf5] text-[#1b4d3e] text-xs font-semibold">
                          {location.seating_info}
                        </span>
                      )}
                    </div>
                  </div>

                  {settings.bookings_enabled && unlocked.booking && (
                    <button
                      type="button"
                      onClick={() => {
                        setBookingOpen(true);
                        document
                          .getElementById('reserve-workspace-card')
                          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className="shrink-0 inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors"
                    >
                      <CalendarCheck className="w-4 h-4" aria-hidden="true" />
                      <span>Check Available Seats &amp; Book</span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <PremiumLockCard
                title="Cafe Workspace Seating & Hours Policy"
                description="Detailed seating capacity, minimum spend policies, time limits, and study/work ratings are unlocked with an active subscription."
                lockReason={lockReason}
                allowedPlanIds={allowedPlanIds}
              />
            )}
          </>
        )}

        {/* Live Google Weekly Opening Hours */}
        {liveOpeningHours.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#e6ddd0] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#5c4e45] mb-2">
              Weekly Opening Hours (Google Maps)
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1 text-xs text-[#1c1613]">
              {liveOpeningHours.map((line) => (
                <li key={line} className="font-medium">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Main Column + Location Map Pin & Platform Links Aside */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6 sm:space-y-8">
          {/* Food & Beverage Menu & Prices */}
          <section className="bg-white rounded-2xl border border-[#e6ddd0] p-5 sm:p-8 space-y-5">
            <button
              type="button"
              onClick={() => toggleSection('menu')}
              aria-expanded={openSections.menu}
              className="md:hidden w-full min-h-[44px] flex items-center justify-between gap-2 text-left"
            >
              <span className="inline-flex items-center gap-2 font-serif-display text-xl font-bold text-[#1c1613]">
                <Coffee className="w-5 h-5 text-[#b45309] shrink-0" aria-hidden="true" />
                <span>Food &amp; Beverage Menu</span>
              </span>
              <ChevronDown
                className={`w-5 h-5 text-[#5c4e45] shrink-0 transition-transform ${
                  openSections.menu ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            <div className="hidden md:flex items-center justify-between gap-2">
              <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
                Food &amp; Beverage Menu &amp; Prices
              </h2>
              <Coffee className="w-5 h-5 text-[#b45309]" aria-hidden="true" />
            </div>

            <div className={`${openSections.menu ? 'block' : 'hidden'} md:block space-y-5`}>
              {!unlocked.food_menu ? (
                <PremiumLockCard
                  title="Full Food & Beverage Menu & Prices"
                  description="Sign in with an active subscription to browse full coffee, tea, snacks, and meal menus with verified INR pricing."
                  previewHints={[
                    'Coffee, tea & snacks price bands',
                    'Full itemised menu & dietary tags',
                    'Popular items & combo specials',
                  ]}
                  lockReason={lockReason}
                  allowedPlanIds={allowedPlanIds}
                />
              ) : hasAnyFoodPrices ? (
                <>
                  {!unlocked.menu_pricing && (
                    <PremiumLockCard
                      compact
                      title="Menu Pricing Locked"
                      description="Menu items are visible on your plan, while full INR prices require an active plan with pricing access."
                      lockReason={lockReason}
                      allowedPlanIds={allowedPlanIds}
                    />
                  )}

                  {unlocked.menu_pricing &&
                    (location.coffee_price ||
                      location.tea_price ||
                      location.snacks_price ||
                      location.meals_price) && (
                      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {location.coffee_price && (
                          <div className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0]">
                            <dt className="text-xs font-medium text-[#5c4e45]">Coffee</dt>
                            <dd className="font-mono-data text-sm font-bold text-[#1c1613] mt-0.5">
                              {location.coffee_price}
                            </dd>
                          </div>
                        )}
                        {location.tea_price && (
                          <div className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0]">
                            <dt className="text-xs font-medium text-[#5c4e45]">Tea</dt>
                            <dd className="font-mono-data text-sm font-bold text-[#1c1613] mt-0.5">
                              {location.tea_price}
                            </dd>
                          </div>
                        )}
                        {location.snacks_price && (
                          <div className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0]">
                            <dt className="text-xs font-medium text-[#5c4e45]">Snacks</dt>
                            <dd className="font-mono-data text-sm font-bold text-[#1c1613] mt-0.5">
                              {location.snacks_price}
                            </dd>
                          </div>
                        )}
                        {location.meals_price && (
                          <div className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0]">
                            <dt className="text-xs font-medium text-[#5c4e45]">Meals</dt>
                            <dd className="font-mono-data text-sm font-bold text-[#1c1613] mt-0.5">
                              {location.meals_price}
                            </dd>
                          </div>
                        )}
                      </dl>
                    )}

                  {location.popular_items.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#5c4e45]">
                        Popular Items
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {location.popular_items.map((item) => (
                          <span
                            key={item}
                            className="px-3 py-1 rounded-full bg-[#faf7f2] border border-[#e6ddd0] text-xs font-medium text-[#1c1613]"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {structuredMenuItems.length > 0 ? (
                    <div className="divide-y divide-[#e6ddd0] pt-2 border-t border-[#e6ddd0]">
                      {structuredMenuItems.map((item) => (
                        <div
                          key={item.id}
                          className={`py-3.5 flex items-start justify-between gap-4 ${
                            item.available ? '' : 'opacity-60'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            {item.photo_url && (
                              <img
                                src={item.photo_url}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                className="w-14 h-14 rounded-xl object-cover border border-[#e6ddd0] shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                                <span className="uppercase tracking-wider text-[#b45309]">
                                  {item.category}
                                </span>
                                {item.dietary !== 'na' && (
                                  <span
                                    className={
                                      item.dietary === 'non_veg'
                                        ? 'text-[#b91c1c]'
                                        : 'text-[#1b4d3e]'
                                    }
                                  >
                                    · {item.dietary === 'non_veg' ? 'Non-Veg' : item.dietary === 'vegan' ? 'Vegan' : 'Veg'}
                                  </span>
                                )}
                                {item.is_bestseller && (
                                  <span className="text-[#b45309]">· Bestseller</span>
                                )}
                                {item.is_featured && (
                                  <span className="text-[#1d4ed8]">· Featured</span>
                                )}
                                {!item.available && (
                                  <span className="text-[#b91c1c]">· Currently unavailable</span>
                                )}
                              </div>
                              <p className="text-base font-semibold text-[#1c1613]">{item.name}</p>
                              {item.description && (
                                <p className="text-sm text-[#5c4e45] mt-0.5">{item.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="font-mono-data text-sm font-bold text-[#1c1613] shrink-0 text-right">
                            {!unlocked.menu_pricing ? (
                              <span className="inline-flex items-center gap-1 text-xs text-[#b45309]">
                                <Lock className="w-3 h-3" aria-hidden="true" />
                                <span>Locked</span>
                              </span>
                            ) : item.discount_price_inr !== null &&
                              item.discount_price_inr !== undefined &&
                              item.discount_price_inr < item.price_inr ? (
                              <>
                                <span className="text-[#1b4d3e]">₹{item.discount_price_inr}</span>
                                <del className="text-[#5c4e45] font-normal ml-1.5 text-xs">
                                  ₹{item.price_inr}
                                </del>
                              </>
                            ) : (
                              <span>₹{item.price_inr}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    location.menu_services.length > 0 && (
                      <div className="divide-y divide-[#e6ddd0] pt-2 border-t border-[#e6ddd0]">
                        {location.menu_services.map((item, idx) => (
                          <div
                            key={`${item.name}-${idx}`}
                            className="py-3 flex items-start justify-between gap-4"
                          >
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-[#b45309]">
                                {item.category}
                              </p>
                              <p className="text-base font-semibold text-[#1c1613]">{item.name}</p>
                              {item.description && (
                                <p className="text-sm text-[#5c4e45] mt-0.5">{item.description}</p>
                              )}
                            </div>
                            {unlocked.menu_pricing && item.price ? (
                              <span className="font-mono-data text-sm font-bold text-[#1c1613] shrink-0">
                                {item.price}
                              </span>
                            ) : !unlocked.menu_pricing ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#b45309] shrink-0">
                                <Lock className="w-3 h-3" aria-hidden="true" />
                                <span>Locked</span>
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </>
              ) : (
                <p className="text-sm text-[#5c4e45]">
                  Detailed beverage and food prices have not been verified yet for this cafe.
                </p>
              )}
            </div>
          </section>

          {/* Facilities & Best For */}
          {!unlocked.amenities ? (
            <PremiumLockCard
              title="Amenities, Atmosphere & Facilities"
              description="Full facility checklists, acoustic notes, and official platform links are reserved for active subscribers."
              previewHints={['Full facilities & power backup info', 'Work & study suitability tags']}
              lockReason={lockReason}
              allowedPlanIds={allowedPlanIds}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-[#e6ddd0] p-5 sm:p-8 space-y-5">
              <button
                type="button"
                onClick={() => toggleSection('amenities')}
                aria-expanded={openSections.amenities}
                className="md:hidden w-full min-h-[44px] flex items-center justify-between gap-2 text-left"
              >
                <span className="font-serif-display text-xl font-bold text-[#1c1613]">
                  Amenities &amp; Atmosphere
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-[#5c4e45] shrink-0 transition-transform ${
                    openSections.amenities ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              <div className={`${openSections.amenities ? 'block' : 'hidden'} md:block space-y-5`}>
                {location.facilities.length > 0 && (
                  <div>
                    <h2 className="hidden md:block font-serif-display text-xl font-bold text-[#1c1613] mb-3">
                      Amenities &amp; Atmosphere
                    </h2>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-[#1c1613]">
                      {location.facilities.map((fac) => (
                        <li key={fac} className="flex items-center gap-2 font-medium">
                          <CheckCircle2
                            className="w-4 h-4 text-[#1b4d3e] shrink-0"
                            aria-hidden="true"
                          />
                          <span>{fac}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-4 border-t border-[#e6ddd0]">
                  <h2 className="font-serif-display text-xl font-bold text-[#1c1613] mb-2">
                    Best For
                  </h2>
                  <p className="text-sm text-[#5c4e45]">{location.best_for.join(' · ')}</p>
                </div>

                {location.avoid_if && (
                  <div className="pt-4 border-t border-[#e6ddd0] flex items-start gap-2.5 text-sm">
                    <AlertTriangle
                      className="w-4 h-4 text-[#b45309] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <p className="text-[#5c4e45]">
                      <strong className="text-[#1c1613]">Good to know:</strong> {location.avoid_if}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reviews, Ratings & Community Verdict */}
          <section className="bg-white rounded-2xl border border-[#e6ddd0] p-5 sm:p-8 space-y-4">
            <button
              type="button"
              onClick={() => toggleSection('reviews')}
              aria-expanded={openSections.reviews}
              className="md:hidden w-full min-h-[44px] flex items-center justify-between gap-2 text-left"
            >
              <span className="inline-flex items-center gap-2 font-serif-display text-xl font-bold text-[#1c1613]">
                <Star className="w-5 h-5 text-[#d97706] fill-[#d97706] shrink-0" aria-hidden="true" />
                <span>Reviews &amp; Verdict</span>
              </span>
              <ChevronDown
                className={`w-5 h-5 text-[#5c4e45] shrink-0 transition-transform ${
                  openSections.reviews ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            <div className="hidden md:flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-[#d97706] fill-[#d97706]" aria-hidden="true" />
                <h2 className="font-serif-display text-xl font-bold text-[#1c1613]">
                  Reviews &amp; Community Verdict
                </h2>
              </div>
              {location.rating !== null ? (
                <span className="font-mono-data text-sm font-semibold text-[#1c1613]">
                  {location.rating.toFixed(1)} / 5
                  {location.rating_count !== null ? ` (${location.rating_count} reviews)` : ''}
                </span>
              ) : (
                <span className="text-xs font-medium text-[#5c4e45]">Community verified guide</span>
              )}
            </div>

            <div className={`${openSections.reviews ? 'block' : 'hidden'} md:block space-y-4`}>
              {location.verdict && (
                <p className="text-sm text-[#1c1613] leading-relaxed bg-[#faf7f2] p-4 rounded-xl border border-[#e6ddd0]">
                  {location.verdict}
                </p>
              )}

              {location.claims.length > 0 && (
                <ul className="space-y-2 text-sm text-[#5c4e45]">
                  {location.claims.map((claim, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#b45309] font-bold" aria-hidden="true">
                        ·
                      </span>
                      <span>{claim}</span>
                    </li>
                  ))}
                </ul>
              )}

              {location.source_name && (
                <div className="pt-3 border-t border-[#e6ddd0] text-xs text-[#5c4e45]">
                  Source:{' '}
                  {location.source_url ? (
                    <a
                      href={location.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-[#1c1613] hover:text-[#b45309] underline underline-offset-4"
                    >
                      <span>{location.source_name}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  ) : (
                    <strong className="text-[#1c1613]">{location.source_name}</strong>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Cafe Desk Membership & Subscription Plans */}
          {plans.length > 0 && (
            <section className="bg-white rounded-2xl border border-[#e6ddd0] p-5 sm:p-8 space-y-4">
              <button
                type="button"
                onClick={() => toggleSection('plans')}
                aria-expanded={openSections.plans}
                className="md:hidden w-full min-h-[44px] flex items-center justify-between gap-2 text-left"
              >
                <span className="inline-flex items-center gap-2 font-serif-display text-xl font-bold text-[#1c1613]">
                  <Award className="w-5 h-5 text-[#b45309] shrink-0" aria-hidden="true" />
                  <span>Membership Plans</span>
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-[#5c4e45] shrink-0 transition-transform ${
                    openSections.plans ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              <div className="hidden md:flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#b45309]">
                    <Award className="w-4 h-4" aria-hidden="true" />
                    <span>Membership &amp; Subscription Plans</span>
                  </div>
                  <h2 className="font-serif-display text-xl font-bold text-[#1c1613]">
                    Unlock extra workspace perks &amp; cafe offers
                  </h2>
                </div>
                <Link
                  to="/pricing"
                  className="text-xs font-semibold text-[#b45309] hover:underline underline-offset-4"
                >
                  Compare all plans &rarr;
                </Link>
              </div>

              <div className={`${openSections.plans ? 'grid' : 'hidden'} md:grid grid-cols-1 sm:grid-cols-3 gap-3`}>
                {plans.slice(0, 3).map((plan) => {
                  const isCurrent = isSubscribed && tier === plan.id;
                  const isExpiredPlan = isExpired && subscription?.expired_from_plan === plan.id;
                  return (
                    <div
                      key={plan.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${
                        isCurrent
                          ? 'bg-[#ecfdf5] border-[#a7f3d0]'
                          : 'bg-[#faf7f2] border-[#e6ddd0]'
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-[#1c1613]">{plan.name}</p>
                        <p className="font-mono-data text-lg font-bold text-[#b45309]">
                          {plan.price_inr === 0 ? 'Free' : `₹${plan.price_inr}`}
                          <span className="text-[11px] font-medium text-[#5c4e45]">
                            {plan.price_inr > 0
                              ? plan.interval_days >= 360
                                ? '/yr'
                                : '/mo'
                              : ''}
                          </span>
                        </p>
                        <p className="text-[11px] text-[#5c4e45] line-clamp-2">{plan.tagline}</p>
                      </div>
                      {isCurrent ? (
                        <span className="text-[11px] font-semibold text-[#1b4d3e]">
                          Current Plan
                        </span>
                      ) : plan.price_inr > 0 ? (
                        <button
                          type="button"
                          onClick={() => openCheckout(plan.id)}
                          className="w-full min-h-[40px] py-2 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors"
                        >
                          {isExpiredPlan ? 'Renew Plan' : 'Select Plan'}
                        </button>
                      ) : (
                        <span className="text-[11px] font-medium text-[#5c4e45]">
                          {isSubscribed ? 'Included' : 'Current Tier'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Subscriber Benefits, Student Perks & Offers */}
          {!unlocked.subscriber_benefits ? (
            <PremiumLockCard
              title="Subscriber Benefits, Perks & Offers"
              description="Unlock member-only workspace perks, partner discounts, student deals, and cafe offers with an active Cafe Desk subscription."
              previewHints={['Member-only partner offers', 'Student & creator discounts']}
              lockReason={lockReason}
              allowedPlanIds={allowedPlanIds}
            />
          ) : (
            ((location.subscriber_benefits && location.subscriber_benefits.length > 0) ||
              location.student_discount ||
              location.offers.length > 0) && (
              <div className="p-6 rounded-2xl bg-[#ecfdf5] border border-[#a7f3d0] space-y-3">
                <div className="flex items-center gap-2 text-[#1b4d3e] font-semibold text-sm">
                  <GraduationCap className="w-4 h-4" aria-hidden="true" />
                  <span>Subscriber Benefits, Student Perks &amp; Offers</span>
                </div>
                {location.subscriber_benefits && location.subscriber_benefits.length > 0 && (
                  <ul className="space-y-1.5 pt-1 text-sm text-[#1c1613]">
                    {location.subscriber_benefits.map((perk, idx) => (
                      <li key={idx} className="flex items-center gap-2 font-medium">
                        <Sparkles className="w-3.5 h-3.5 text-[#b45309] shrink-0" aria-hidden="true" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {location.student_discount && (
                  <p className="text-sm text-[#1c1613] font-medium">{location.student_discount}</p>
                )}
                {location.offers.length > 0 && (
                  <ul className="space-y-1.5 pt-1 text-sm text-[#5c4e45]">
                    {location.offers.map((offer, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-[#b45309] shrink-0" aria-hidden="true" />
                        <span>{offer}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          )}

          <div>
            <Link
              to={`/submit?cafe=${encodeURIComponent(location.name)}`}
              className="inline-flex items-center gap-2 min-h-[40px] text-xs font-medium text-[#5c4e45] hover:text-[#1c1613] underline underline-offset-4"
            >
              <Flag className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
              <span>Report outdated Wi-Fi, price, or opening hours for this cafe</span>
            </Link>
          </div>
        </div>

        {/* Right Aside: Location Map Pin & Direct Platform Connections */}
        <aside className="lg:col-span-5 space-y-6 lg:sticky lg:top-20">
          {/* Interactive Map Pin Card */}
          <div className="bg-white rounded-2xl border border-[#e6ddd0] overflow-hidden">
            <div className="p-5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-serif-display text-xl font-bold text-[#1c1613]">
                  Location &amp; Distance
                </h2>
                {distText ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ecfdf5] text-[#1b4d3e] font-mono-data text-xs font-semibold">
                    <Navigation className="w-3 h-3" aria-hidden="true" />
                    {distText}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => requestUserLocation()}
                    className="inline-flex items-center gap-1 min-h-[34px] text-xs font-semibold text-[#b45309] hover:underline"
                  >
                    <LocateFixed className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Check distance</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-[#5c4e45] leading-relaxed">{location.address}</p>
            </div>

            <InteractiveCafeMap
              curatedLocations={[location]}
              userLocation={userLocation}
              focusCenter={
                location.lat !== null && location.lng !== null
                  ? { lat: location.lat, lng: location.lng }
                  : null
              }
              onRequestNearMe={() => requestUserLocation()}
              heightClassName="h-[260px]"
            />
          </div>

          {/* Connect With Cafe Official Channels */}
          <div className="bg-white rounded-2xl border border-[#e6ddd0] p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="font-serif-display text-xl font-bold text-[#1c1613]">
                Connect With {location.name}
              </h2>
              <p className="text-xs text-[#5c4e45]">
                Open official cafe platforms directly for menus, photos, or directions.
              </p>
            </div>

            <div className="space-y-2.5">
              <a
                href={location.map_link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-sm font-semibold inline-flex items-center justify-between transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                  Get Directions
                </span>
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </a>

              {unlocked.amenities && location.website_url && (
                <a
                  href={location.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] hover:border-[#b45309] text-[#1c1613] text-sm font-semibold inline-flex items-center justify-between transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
                    Visit Official Website
                  </span>
                  <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                </a>
              )}

              {unlocked.food_menu && location.menu_url && (
                <a
                  href={location.menu_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] hover:border-[#b45309] text-[#1c1613] text-sm font-semibold inline-flex items-center justify-between transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
                    View Menu
                  </span>
                  <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                </a>
              )}

              {unlocked.amenities && location.instagram_url && (
                <a
                  href={location.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] hover:border-[#b45309] text-[#1c1613] text-sm font-semibold inline-flex items-center justify-between transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Instagram className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
                    Instagram Profile
                  </span>
                  <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                </a>
              )}

              {unlocked.amenities && location.phone && (
                <a
                  href={`tel:${location.phone.replace(/\s+/g, '')}`}
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] hover:border-[#1b4d3e] text-[#1c1613] text-sm font-semibold inline-flex items-center justify-between transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
                    Call {location.phone}
                  </span>
                </a>
              )}

              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] hover:border-[#1b4d3e] text-[#1c1613] text-sm font-semibold inline-flex items-center justify-between transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
                  Suggest correction on WhatsApp
                </span>
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>

            {unlocked.amenities &&
              (!location.website_url || !location.menu_url || !location.instagram_url) && (
                <p className="pt-2 border-t border-[#e6ddd0] text-xs text-[#5c4e45]">
                  Missing an official link?{' '}
                  <Link
                    to={`/submit?cafe=${encodeURIComponent(location.name)}`}
                    className="font-semibold text-[#b45309] hover:underline"
                  >
                    Suggest an update &rarr;
                  </Link>
                </p>
              )}
          </div>

          {/* Workspace Reservation Card */}
          {settings.bookings_enabled && (
            <div
              id="reserve-workspace-card"
              className="bg-white rounded-2xl border border-[#e6ddd0] p-6 space-y-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#1b4d3e]">
                  <CalendarCheck className="w-4 h-4" aria-hidden="true" />
                  <span>Workspace Reservation</span>
                </div>
                <h2 className="font-serif-display text-xl font-bold text-[#1c1613]">
                  Reserve a Workspace / Seat
                </h2>
                <p className="text-xs text-[#5c4e45]">
                  {settings.booking_policy_note ||
                    'Book a laptop desk, quiet study seat, or meeting table with instant reference confirmation.'}
                </p>
              </div>

              {!unlocked.booking ? (
                <PremiumLockCard
                  compact
                  title="Booking Available for Subscribers"
                  description="Activate an active subscription to reserve laptop desks, quiet study seats, or meeting booths."
                  lockReason={lockReason}
                  allowedPlanIds={allowedPlanIds}
                />
              ) : bookingSuccessRef ? (
                <div className="p-4 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] space-y-2 text-xs text-[#1c1613]">
                  <p className="font-semibold flex items-center gap-1.5 text-[#1b4d3e]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Booking Request Received!</span>
                  </p>
                  <p>
                    Reference:{' '}
                    <span className="font-mono-data font-bold">{bookingSuccessRef}</span> for{' '}
                    {location.name} on {bookDate} ({bookSlot}).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingSuccessRef('');
                      setBookingOpen(true);
                    }}
                    className="font-semibold text-[#1b4d3e] underline underline-offset-2"
                  >
                    Make another reservation
                  </button>
                </div>
              ) : !bookingOpen ? (
                <button
                  type="button"
                  onClick={() => setBookingOpen(true)}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1c1613] hover:bg-[#b45309] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <CalendarCheck className="w-4 h-4" aria-hidden="true" />
                  <span>Book a Desk or Seat</span>
                </button>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBookingBusy(true);
                    setBookingError('');
                    try {
                      const res = await fetch('/api/bookings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...getUserSessionHeaders() },
                        credentials: 'include',
                        body: JSON.stringify({
                          cafe_id: location.id,
                          cafe_name: location.name,
                          customer_name: bookName,
                          customer_email: bookEmail,
                          customer_phone: bookPhone,
                          workspace_type: bookWorkspace,
                          booking_date: bookDate,
                          time_slot: bookSlot,
                          guests_count: bookGuests,
                          notes: bookNotes,
                        }),
                      });
                      const data = (await res.json().catch(() => ({}))) as {
                        ok?: boolean;
                        booking?: { booking_ref?: string };
                        error?: string;
                        code?: string;
                      };
                      if (!res.ok) {
                        setBookingError(data.error || 'Could not submit reservation.');
                        if (
                          res.status === 403 &&
                          (data.code === 'SUBSCRIPTION_REQUIRED' ||
                            data.code === 'SUBSCRIPTION_EXPIRED')
                        ) {
                          openCheckout(renewPlanId);
                        }
                        return;
                      }
                      setBookingSuccessRef(data.booking?.booking_ref || 'CONFIRMED');
                      setBookingOpen(false);
                      setBookNotes('');
                    } catch {
                      setBookingError('Network error submitting reservation.');
                    } finally {
                      setBookingBusy(false);
                    }
                  }}
                  className="space-y-3 text-xs pt-3 border-t border-[#e6ddd0]"
                >
                  {bookingError && (
                    <div className="p-2.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] font-medium">
                      {bookingError}
                    </div>
                  )}

                  <div>
                    <label className="block font-medium text-[#5c4e45] mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={bookName}
                      onChange={(e) => setBookName(e.target.value)}
                      placeholder="Your name"
                      className="w-full h-11 px-3 rounded-xl bg-[#faf7f2] border border-[#d6cbba] text-xs text-[#1c1613]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-medium text-[#5c4e45] mb-1">Email *</label>
                      <input
                        type="email"
                        required={!bookPhone.trim()}
                        value={bookEmail}
                        onChange={(e) => setBookEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full h-11 px-3 rounded-xl bg-[#faf7f2] border border-[#d6cbba] text-xs text-[#1c1613]"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-[#5c4e45] mb-1">Phone</label>
                      <input
                        type="tel"
                        value={bookPhone}
                        onChange={(e) => setBookPhone(e.target.value)}
                        placeholder="+91 98..."
                        className="w-full h-11 px-3 rounded-xl bg-[#faf7f2] border border-[#d6cbba] text-xs text-[#1c1613]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-medium text-[#5c4e45] mb-1">Date *</label>
                      <input
                        type="date"
                        required
                        min={new Date().toISOString().slice(0, 10)}
                        value={bookDate}
                        onChange={(e) => setBookDate(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl bg-[#faf7f2] border border-[#d6cbba] text-xs font-mono-data text-[#1c1613]"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-[#5c4e45] mb-1">Time Slot *</label>
                      <select
                        value={bookSlot}
                        onChange={(e) => setBookSlot(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl bg-[#faf7f2] border border-[#d6cbba] text-xs text-[#1c1613]"
                      >
                        <option value="09:00 AM - 12:00 PM">09:00 AM - 12:00 PM</option>
                        <option value="12:00 PM - 03:00 PM">12:00 PM - 03:00 PM</option>
                        <option value="03:00 PM - 06:00 PM">03:00 PM - 06:00 PM</option>
                        <option value="06:00 PM - 09:00 PM">06:00 PM - 09:00 PM</option>
                        <option value="Full Day (09:00 AM - 07:00 PM)">Full Day (9 AM - 7 PM)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-medium text-[#5c4e45] mb-1">Workspace</label>
                      <select
                        value={bookWorkspace}
                        onChange={(e) => setBookWorkspace(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl bg-[#faf7f2] border border-[#d6cbba] text-xs text-[#1c1613]"
                      >
                        <option value="Laptop Desk">Laptop Desk</option>
                        <option value="Quiet Study Zone">Quiet Study Zone</option>
                        <option value="Meeting Booth">Meeting Booth</option>
                        <option value="Casual & Budget Seating">Casual &amp; Budget Seating</option>
                        <option value="Window Bar Counter">Window Bar Counter</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-[#5c4e45] mb-1">
                        Seats (Max {settings.booking_max_guests || 8})
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={settings.booking_max_guests || 8}
                        value={bookGuests}
                        onChange={(e) => setBookGuests(Number(e.target.value))}
                        className="w-full h-11 px-3 rounded-xl bg-[#faf7f2] border border-[#d6cbba] text-xs font-mono-data text-[#1c1613]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-[#5c4e45] mb-1">
                      Preferences / Socket Note
                    </label>
                    <input
                      type="text"
                      value={bookNotes}
                      onChange={(e) => setBookNotes(e.target.value)}
                      placeholder="Near power socket, quiet corner..."
                      className="w-full h-11 px-3 rounded-xl bg-[#faf7f2] border border-[#d6cbba] text-xs text-[#1c1613]"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setBookingOpen(false)}
                      className="min-h-[42px] px-4 rounded-xl border border-[#e6ddd0] bg-[#faf7f2] text-[#1c1613] font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={bookingBusy}
                      className="flex-1 min-h-[42px] px-4 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white font-semibold transition-colors"
                    >
                      {bookingBusy ? 'Submitting...' : 'Confirm Reservation'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Similar Bengaluru Cafes Strip */}
      {similarCafes.length > 0 && (
        <section
          aria-labelledby="similar-cafes-heading"
          className="pt-6 border-t border-[#e6ddd0] space-y-4"
        >
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
                Keep Exploring
              </p>
              <h2
                id="similar-cafes-heading"
                className="font-serif-display text-2xl sm:text-3xl font-bold text-[#1c1613]"
              >
                Similar Workspaces Nearby
              </h2>
            </div>
            <Link
              to="/locations"
              className="text-xs font-semibold text-[#b45309] hover:underline whitespace-nowrap shrink-0"
            >
              Browse All &rarr;
            </Link>
          </div>
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible">
            {similarCafes.map((cafe) => (
              <div
                key={cafe.id}
                className="w-[82vw] max-w-[300px] md:w-auto md:max-w-none shrink-0 snap-start"
              >
                <LocationCard location={cafe} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sticky Mobile Bottom Action Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e6ddd0] px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] flex items-center gap-2 shadow-[0_-4px_16px_rgba(28,22,19,0.08)]">
        <a
          href={location.map_link}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[44px] px-3 rounded-xl border border-[#e6ddd0] bg-[#faf7f2] text-[#1c1613] text-xs font-semibold inline-flex items-center justify-center gap-1.5 shrink-0"
        >
          <MapPin className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
          <span>Directions</span>
        </a>

        <button
          type="button"
          onClick={() => void handleSaveToggle(false)}
          aria-label={saved ? 'Remove saved cafe' : 'Save cafe'}
          className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
            saved
              ? 'bg-[#fef3c7] border-[#f59e0b]/50 text-[#92400e]'
              : 'bg-[#faf7f2] border-[#e6ddd0] text-[#1c1613]'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${saved ? 'fill-[#92400e]' : ''}`} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => void handleShareCafe()}
          aria-label="Share cafe"
          className="w-11 h-11 rounded-xl border border-[#e6ddd0] bg-[#faf7f2] text-[#1c1613] flex items-center justify-center shrink-0"
        >
          {copiedShare ? (
            <Check className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
          ) : (
            <Share2 className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
          )}
        </button>

        {settings.bookings_enabled && unlocked.booking ? (
          <button
            type="button"
            onClick={() => {
              setBookingOpen(true);
              document
                .getElementById('reserve-workspace-card')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className="flex-1 min-h-[44px] px-3 rounded-xl bg-[#b45309] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <CalendarCheck className="w-4 h-4" aria-hidden="true" />
            <span>Book Desk</span>
          </button>
        ) : !unlocked.wifi_details || !unlocked.food_menu ? (
          <button
            type="button"
            onClick={() =>
              openUpgradeModal({
                featureName: 'Full Cafe Specs & Menus',
                requiredPlan: 'plus',
                description:
                  'Unlock verified Wi-Fi passwords, power outlet counts, food menus, and workspace details for this cafe.',
              })
            }
            className="flex-1 min-h-[44px] px-3 rounded-xl bg-[#b45309] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Unlock Cafe Access</span>
          </button>
        ) : unlocked.amenities && location.website_url ? (
          <a
            href={location.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-h-[44px] px-3 rounded-xl bg-[#1c1613] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <Globe className="w-4 h-4" aria-hidden="true" />
            <span>Visit Website</span>
          </a>
        ) : (
          <Link
            to="/pricing"
            className="flex-1 min-h-[44px] px-3 rounded-xl bg-[#1c1613] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <Award className="w-4 h-4 text-[#f59e0b]" aria-hidden="true" />
            <span>View Plans</span>
          </Link>
        )}
      </div>

      {/* Full-Screen Photo Lightbox Modal */}
      {lightboxOpen && approvedPhotos.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${location.name} photo gallery`}
          className="fixed inset-0 z-50 bg-[#1c1613]/92 backdrop-blur-sm flex flex-col justify-between p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="flex items-center justify-between gap-4 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0">
              <p className="font-serif-display text-lg font-bold truncate">{location.name}</p>
              <p className="text-xs text-white/75">
                {location.area}, {location.city} · Photo {safePhotoIdx + 1} of{' '}
                {approvedPhotos.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors shrink-0"
              aria-label="Close photo gallery"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div
            className="relative flex-1 flex items-center justify-center my-4 min-h-0 touch-pan-y"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleGalleryTouchStart}
            onTouchEnd={handleGalleryTouchEnd}
          >
            {approvedPhotos.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setActivePhotoIdx(
                    (safePhotoIdx - 1 + approvedPhotos.length) % approvedPhotos.length
                  )
                }
                className="absolute left-2 sm:left-4 z-10 w-11 h-11 rounded-xl bg-black/55 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-6 h-6" aria-hidden="true" />
              </button>
            )}

            <img
              src={approvedPhotos[safePhotoIdx]}
              alt={`${location.name} (${location.area}) view ${safePhotoIdx + 1}`}
              referrerPolicy="no-referrer"
              className="max-h-[72vh] max-w-full w-auto object-contain rounded-xl shadow-2xl select-none"
            />

            {approvedPhotos.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setActivePhotoIdx((safePhotoIdx + 1) % approvedPhotos.length)
                }
                className="absolute right-2 sm:right-4 z-10 w-11 h-11 rounded-xl bg-black/55 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                aria-label="Next photo"
              >
                <ChevronRight className="w-6 h-6" aria-hidden="true" />
              </button>
            )}
          </div>

          {approvedPhotos.length > 1 && (
            <div
              className="flex items-center justify-center gap-2 overflow-x-auto py-1 no-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              {approvedPhotos.map((photoUrl, idx) => (
                <button
                  key={photoUrl}
                  type="button"
                  onClick={() => setActivePhotoIdx(idx)}
                  aria-label={`Select photo ${idx + 1}`}
                  className={`w-16 h-12 rounded-md overflow-hidden border shrink-0 transition-all ${
                    idx === safePhotoIdx
                      ? 'ring-2 ring-[#f59e0b] border-[#f59e0b] opacity-100'
                      : 'border-white/25 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={photoUrl}
                    alt={`${location.name} thumbnail ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

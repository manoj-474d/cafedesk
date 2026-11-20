import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Armchair,
  BookOpen,
  Bookmark,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
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
  Share2,
  Star,
  Sun,
  Tag,
  Utensils,
  Volume2,
  Wifi,
  X,
} from 'lucide-react';
import { getNoiseSummary, NOISE_LABELS } from '../config/constants';
import { locationToLibrarySnapshot, useAuth } from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import {
  googleDiscoveryToLocationItem,
  useDiscovery,
  type GoogleDiscoveryCafe,
} from '../context/DiscoveryContext';
import type { AmenityState } from '../types/cms';
import {
  buildWhatsAppUrl,
  formatDistanceKm,
  getCafeOpenStatus,
  useDocumentMeta,
} from '../utils/cafeHelpers';
import {
  isOutdoorFriendly,
  recordRecentlyViewedSlug,
} from '../utils/cafeRecommendations';
import { InteractiveCafeMap } from '../components/InteractiveCafeMap';
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
    hasPlus,
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

  const baseLocation = useMemo(
    () => (isGoogleRoute ? undefined : locations.find((l) => l.slug === lookupKey || l.id === lookupKey)),
    [locations, lookupKey, isGoogleRoute]
  );

  const [fetchedGooglePlace, setFetchedGooglePlace] = useState<GoogleDiscoveryCafe | null>(null);
  const [loadingGooglePlace, setLoadingGooglePlace] = useState(false);
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(false);
  const [collectionAddedNotice, setCollectionAddedNotice] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);

  // Lazy-enrich & record recently viewed once per curated branch view
  useEffect(() => {
    if (baseLocation) {
      recordRecentlyViewedSlug(baseLocation.slug);
      void enrichLocationFromPlaces(baseLocation);
    }
  }, [baseLocation, enrichLocationFromPlaces]);

  // Fetch full place details when navigating to /locations/google:<placeId>
  useEffect(() => {
    if (!isGoogleRoute || !googlePlaceId) return;
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
  }, [isGoogleRoute, googlePlaceId, placesReady, fetchGooglePlaceDetails]);

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

  const approvedPhotosList =
    location && location.photos_approved ? location.photos : [];

  useEffect(() => {
    setActivePhotoIdx(0);
    setLightboxOpen(false);
    setCollectionMenuOpen(false);
    setCollectionAddedNotice('');
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

  if (!location && isGoogleRoute && (loadingGooglePlace || !placesReady)) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-24 text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#b45309] mx-auto" aria-hidden="true" />
        <h1 className="font-serif-display text-2xl font-bold text-[#1c1613]">
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
        <h1 className="font-serif-display text-3xl font-bold text-[#1c1613]">
          Cafe not found
        </h1>
        <p className="text-sm text-[#5c4e45]">
          This cafe listing may have been moved or unpublished.
        </p>
        <Link
          to="/locations"
          className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#1c1613] text-white text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Explore all Bengaluru cafes</span>
        </Link>
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

  const cafeSnapshot = locationToLibrarySnapshot(location);
  const saved = isCafeSaved(cafeSnapshot.key);
  const favourited = isCafeFavourite(cafeSnapshot.key);
  const inCompare = compareList.some((c) => c.id === location.id);
  const outdoorFriendly = isOutdoorFriendly(location);

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

  const waUrl = buildWhatsAppUrl(
    `Hi ${settings.brand_name}! Sharing feedback or asking a question about ${location.name} (${location.area}, ${location.city}).`,
    settings.whatsapp_number
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
      <nav aria-label="Breadcrumb">
        <Link
          to="/locations"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#5c4e45] hover:text-[#1c1613] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Bengaluru cafe explorer</span>
        </Link>
      </nav>

      {/* Branch Header */}
      <header className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-medium text-[#5c4e45]">
            <span className="uppercase tracking-wider font-semibold text-[#b45309]">
              {location.city} · {location.area}
            </span>
            {distText && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-semibold text-[#1b4d3e] font-mono-data">
                  <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
                  {distText}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span
              className={`font-semibold ${
                openStatus === 'open'
                  ? 'text-[#1b4d3e]'
                  : openStatus === 'closed'
                  ? 'text-[#7c2d12]'
                  : 'text-[#5c4e45]'
              }`}
            >
              {openStatus === 'open'
                ? 'Open now'
                : openStatus === 'closed'
                ? 'Closed now'
                : 'Check hours on Maps'}
            </span>
            <span aria-hidden="true">·</span>
            {location.verified ? (
              <span className="inline-flex items-center gap-1 text-[#1b4d3e] font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                Verified by Cafe Desk
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[#5c4e45] font-semibold">
                <Clock className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                Public source listing
              </span>
            )}
            {location.featured && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#b45309] font-semibold">Sponsored · Featured</span>
              </>
            )}
          </div>

          <h1 className="font-serif-display text-3xl sm:text-5xl font-bold text-[#1c1613] leading-tight">
            {location.name}
          </h1>

          {/* Rating & Address */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-[#5c4e45]">
            {location.rating !== null ? (
              <span className="inline-flex items-center gap-1 font-semibold text-[#1c1613]">
                <Star className="w-4 h-4 text-[#d97706] fill-[#d97706]" aria-hidden="true" />
                <span className="font-mono-data">{location.rating.toFixed(1)}</span>
                {location.rating_count !== null && (
                  <span className="text-[#5c4e45] font-normal">
                    ({location.rating_count} reviews)
                  </span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#5c4e45]">
                <Star className="w-4 h-4 text-[#cbd5e1]" aria-hidden="true" />
                Not rated yet
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span>{location.address}</span>
          </div>

          <p className="text-base sm:text-lg text-[#5c4e45] leading-relaxed">
            {location.description || location.verdict || location.claims[0]}
          </p>

          {/* Direct Discovery & Cafe Platform Links (Zero Table Booking) */}
          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href={location.map_link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ backgroundColor: settings.accent_color || '#b45309' }}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-95 transition-opacity"
            >
              <MapPin className="w-4 h-4" aria-hidden="true" />
              <span>Get Directions</span>
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            </a>

            {location.website_url && (
              <a
                href={location.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#1c1613] hover:bg-[#312722] text-white text-sm font-semibold transition-colors"
              >
                <Globe className="w-4 h-4" aria-hidden="true" />
                <span>Visit Official Website</span>
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </a>
            )}

            {location.menu_url && (
              <a
                href={location.menu_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg bg-white border border-[#d6cbba] hover:bg-[#f3ede3] text-[#1c1613] text-sm font-semibold transition-colors"
              >
                <Utensils className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
                <span>View Menu</span>
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </a>
            )}

            {location.instagram_url && (
              <a
                href={location.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg bg-white border border-[#d6cbba] hover:bg-[#f3ede3] text-[#1c1613] text-sm font-semibold transition-colors"
              >
                <Instagram className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
                <span>Instagram</span>
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </a>
            )}

            {location.phone && (
              <a
                href={`tel:${location.phone.replace(/\s+/g, '')}`}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg bg-white border border-[#d6cbba] hover:bg-[#f3ede3] text-[#1c1613] text-sm font-semibold transition-colors"
              >
                <Phone className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
                <span>Call Cafe</span>
              </a>
            )}
          </div>

          {/* Free Save / Favourite / Share + Plus Collection / Compare Action Strip */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1 relative">
            <button
              type="button"
              onClick={() => void toggleSaveCafe(cafeSnapshot, false)}
              className={`inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                saved
                  ? 'bg-[#1c1613] text-white border-[#1c1613]'
                  : 'bg-white border-[#d6cbba] text-[#1c1613] hover:border-[#b45309]'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{saved ? 'Saved to Library' : 'Save Cafe'}</span>
            </button>

            <button
              type="button"
              onClick={() => void toggleSaveCafe(cafeSnapshot, true)}
              className={`inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                favourited
                  ? 'bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]'
                  : 'bg-white border-[#d6cbba] text-[#1c1613] hover:border-[#b45309]'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${favourited ? 'fill-[#b91c1c]' : ''}`} aria-hidden="true" />
              <span>{favourited ? 'Favourited' : 'Favourite'}</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!hasPlus) {
                    openUpgradeModal({
                      featureName: 'Personal Cafe Collections',
                      requiredPlan: 'plus',
                      description:
                        'Organize Bengaluru cafes into custom lists like "Indiranagar Deep Work" or "Budget Study Spots".',
                    });
                    return;
                  }
                  setCollectionMenuOpen((v) => !v);
                }}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-lg bg-white border border-[#d6cbba] hover:border-[#b45309] text-[#1c1613] text-xs font-semibold transition-colors"
              >
                {!hasPlus ? (
                  <Lock className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                ) : (
                  <FolderPlus className="w-3.5 h-3.5 text-[#1b4d3e]" aria-hidden="true" />
                )}
                <span>Add to Collection</span>
              </button>

              {hasPlus && collectionMenuOpen && (
                <div className="absolute left-0 mt-1.5 w-60 rounded-xl bg-white border border-[#e6ddd0] shadow-lg p-2 z-30 space-y-1">
                  {collections.length === 0 ? (
                    <div className="p-2 text-xs text-[#5c4e45] space-y-2">
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
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#faf7f2] text-xs font-semibold text-[#1c1613] flex items-center justify-between"
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
              className={`inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                inCompare
                  ? 'bg-[#1b4d3e] text-white border-[#1b4d3e]'
                  : 'bg-white border-[#d6cbba] text-[#1c1613] hover:border-[#b45309]'
              }`}
            >
              {!hasPlus ? (
                <Lock className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
              ) : (
                <GitCompareArrows className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{inCompare ? 'Added to Compare' : 'Compare Cafe'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleShareCafe()}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-lg bg-white border border-[#d6cbba] hover:border-[#b45309] text-[#1c1613] text-xs font-semibold transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
              <span>{copiedShare ? 'Link copied!' : 'Share'}</span>
            </button>

            {collectionAddedNotice && (
              <span className="text-xs font-semibold text-[#1b4d3e]">
                {collectionAddedNotice}
              </span>
            )}
          </div>
        </div>

        {/* Interactive Real Cafe Photo Gallery */}
        <div className="lg:col-span-5">
          {approvedPhotos.length > 0 ? (
            <div className="space-y-3">
              <div className="relative group rounded-2xl overflow-hidden border border-[#e6ddd0] bg-[#ebe2d4]">
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
                    className="w-full aspect-[4/3]"
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
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-[#1c1613]/70 hover:bg-[#1c1613]/90 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-[#1c1613]/70 hover:bg-[#1c1613]/90 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                      aria-label="Next cafe photo"
                    >
                      <ChevronRight className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </>
                )}

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1c1613]/75 backdrop-blur-sm text-white text-xs font-mono-data">
                    <Images className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {safePhotoIdx + 1} / {approvedPhotos.length}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1c1613]/75 hover:bg-[#1c1613]/90 backdrop-blur-sm text-white text-xs font-medium transition-colors"
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
                        className={`relative aspect-[4/3] rounded-lg overflow-hidden border transition-all focus:outline-none ${
                          isActive
                            ? 'ring-2 ring-[#b45309] border-[#b45309] opacity-100'
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
            <div className="aspect-[4/3] rounded-2xl border border-[#e6ddd0] bg-[#f3ede3] p-7 flex flex-col justify-between text-[#1c1613]">
              <div className="flex items-center justify-between text-xs text-[#5c4e45]">
                <span className="font-mono-data uppercase">{location.city} · {location.area}</span>
                <span className="px-2 py-0.5 rounded bg-white/70 border border-[#d6cbba] font-semibold">
                  Placeholder
                </span>
              </div>
              <div className="space-y-2">
                <p className="font-serif-display text-2xl font-bold">{location.name}</p>
                <p className="text-sm text-[#5c4e45] leading-relaxed">
                  Real cafe photographs are sourced only from official cafe websites, official
                  Instagram pages, or verified field visits — never generated or fabricated.
                </p>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {['Interior & Seating', 'Workspace & Plugs', 'Coffee & Menu'].map((slot) => (
                    <div
                      key={slot}
                      className="px-2.5 py-2 rounded-lg bg-white/60 border border-[#d6cbba] text-[11px] font-medium text-[#5c4e45] text-center"
                    >
                      {slot}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-[#5c4e45] font-mono-data">{location.timings}</p>
            </div>
          )}
        </div>
      </header>

      {/* Workspace, Study & Budget Specs */}
      <section aria-labelledby="specs-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="specs-heading" className="font-serif-display text-2xl font-bold text-[#1c1613]">
            Workspace, Wi-Fi &amp; Budget Details
          </h2>
          {!hasPlus && (
            <button
              type="button"
              onClick={() =>
                openUpgradeModal({
                  featureName: 'Wi-Fi Speed & Work Readiness',
                  requiredPlan: 'plus',
                  description:
                    'Unlock Wi-Fi availability, measured speeds (Mbps), and remote work suitability across Bengaluru cafes.',
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#faf7f2] border border-[#d6cbba] hover:border-[#b45309] text-xs font-semibold text-[#b45309]"
            >
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Unlock Plus Specs (₹79/mo)</span>
            </button>
          )}
        </div>

        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-white border border-[#e6ddd0] space-y-1">
            <dt className="flex items-center gap-2 text-xs font-semibold text-[#5c4e45]">
              <Wifi className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
              <span>Wi-Fi Availability &amp; Speed</span>
            </dt>
            {hasPlus ? (
              <>
                <dd className="text-sm font-bold text-[#1b4d3e]">
                  Wi-Fi Available:{' '}
                  {location.wifi_available === 'yes'
                    ? 'Yes'
                    : location.wifi_available === 'no'
                    ? 'No'
                    : 'Not verified'}
                </dd>
                <p
                  className={`font-mono-data text-base sm:text-lg font-bold ${
                    location.wifi_mbps === null ? 'text-[#5c4e45]' : 'text-[#1c1613]'
                  }`}
                >
                  {location.wifi_mbps !== null
                    ? `Wi-Fi Speed: ${location.wifi_mbps} Mbps`
                    : 'Wi-Fi Speed: Not verified'}
                </p>
              </>
            ) : (
              <button
                type="button"
                onClick={() =>
                  openUpgradeModal({
                    featureName: 'Wi-Fi Availability & Speeds',
                    requiredPlan: 'plus',
                  })
                }
                className="pt-1 text-left inline-flex items-center gap-1.5 text-sm font-bold text-[#b45309] hover:underline"
              >
                <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Plus ₹79/mo</span>
              </button>
            )}
          </div>

          <div className="p-5 rounded-xl bg-white border border-[#e6ddd0] space-y-1">
            <dt className="flex items-center gap-2 text-xs font-semibold text-[#5c4e45]">
              <Plug className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
              <span>Charging Sockets</span>
            </dt>
            <dd
              className={`font-mono-data text-lg sm:text-xl font-bold ${
                location.sockets_count === null && location.charging_sockets !== 'yes'
                  ? 'text-[#5c4e45]'
                  : 'text-[#1c1613]'
              }`}
            >
              {location.sockets_count !== null
                ? `${location.sockets_count} available`
                : location.charging_sockets === 'yes' || location.sockets_claimed
                ? 'Sockets available'
                : location.charging_sockets === 'no'
                ? 'Not available'
                : 'Not verified'}
            </dd>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[#e6ddd0] space-y-1">
            <dt className="flex items-center gap-2 text-xs font-semibold text-[#5c4e45]">
              <Volume2 className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
              <span>Noise Level</span>
            </dt>
            <dd
              className={`text-base font-bold pt-1 ${
                location.noise_level === null ? 'text-[#5c4e45]' : 'text-[#1c1613]'
              }`}
            >
              {location.noise_level !== null
                ? `${noiseSummary} · ${NOISE_LABELS[location.noise_level]}`
                : 'Not measured yet'}
            </dd>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[#e6ddd0] space-y-1">
            <dt className="text-xs font-semibold text-[#5c4e45]">Price Range &amp; Budget</dt>
            {hasPlus ? (
              <>
                <dd
                  className={`font-mono-data text-lg sm:text-xl font-bold ${
                    !location.price_range && location.avg_cost_per_person === null
                      ? 'text-[#5c4e45]'
                      : 'text-[#1c1613]'
                  }`}
                >
                  {location.price_range ||
                    (location.avg_cost_per_person !== null
                      ? `₹${location.avg_cost_per_person} avg`
                      : 'Not measured yet')}
                </dd>
                {location.price_range && location.avg_cost_per_person !== null && (
                  <p className="text-xs text-[#5c4e45] font-mono-data">
                    ~₹{location.avg_cost_per_person} per person
                  </p>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() =>
                  openUpgradeModal({
                    featureName: 'Price Range & Average Budget',
                    requiredPlan: 'plus',
                  })
                }
                className="pt-1 text-left inline-flex items-center gap-1.5 text-sm font-bold text-[#b45309] hover:underline"
              >
                <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Plus ₹79/mo</span>
              </button>
            )}
          </div>
        </dl>

        {/* Study & Work Readiness Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white border border-[#e6ddd0] space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#5c4e45]">
              <Briefcase className="w-3.5 h-3.5 text-[#1b4d3e]" aria-hidden="true" />
              <span>Working</span>
            </p>
            {hasPlus ? (
              <p className="text-sm font-semibold text-[#1c1613]">
                {formatAmenityLabel(
                  location.suitable_for_working,
                  'Suitable for remote work',
                  'Better for casual visits'
                )}
              </p>
            ) : (
              <button
                type="button"
                onClick={() =>
                  openUpgradeModal({ featureName: 'Work Suitability Details', requiredPlan: 'plus' })
                }
                className="inline-flex items-center gap-1 text-xs font-bold text-[#b45309] hover:underline"
              >
                <Lock className="w-3 h-3" aria-hidden="true" />
                <span>Plus ₹79</span>
              </button>
            )}
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#e6ddd0] space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#5c4e45]">
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

          <div className="p-4 rounded-xl bg-white border border-[#e6ddd0] space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#5c4e45]">
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

          <div className="p-4 rounded-xl bg-white border border-[#e6ddd0] space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#5c4e45]">
              <Laptop className="w-3.5 h-3.5 text-[#1b4d3e]" aria-hidden="true" />
              <span>Laptops</span>
            </p>
            <p className="text-sm font-semibold text-[#1c1613]">
              {location.laptop_friendly ? 'Laptop-friendly' : 'Not verified / Short visits'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#e6ddd0] space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#5c4e45]">
              <Sun className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
              <span>Outdoor Seating</span>
            </p>
            <p className="text-sm font-semibold text-[#1c1613]">
              {outdoorFriendly ? 'Outdoor / garden seating available' : 'Outdoor seating not verified'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#e6ddd0] space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#5c4e45]">
              <Clock className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
              <span>Hours &amp; Stay</span>
            </p>
            <p className="text-xs font-semibold text-[#1c1613] leading-snug">
              {location.timings}
            </p>
            <p className="text-[11px] text-[#5c4e45]">
              {hasPlus
                ? location.min_spend
                  ? `Min spend ${location.min_spend}`
                  : 'No min spend noted'
                : 'Min spend: Plus'}{' '}
              · {location.time_limit || 'No time limit reported'}
            </p>
          </div>
        </div>

        {/* Live Google Weekly Opening Hours */}
        {liveOpeningHours.length > 0 && (
          <div className="p-4 rounded-xl bg-white border border-[#e6ddd0]">
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
        <div className="lg:col-span-7 space-y-8">
          {/* Food & Beverage Prices */}
          <section className="p-6 sm:p-8 rounded-2xl bg-white border border-[#e6ddd0] space-y-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
                  Food &amp; Beverage Prices
                </h2>
                {!hasPlus && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#faf7f2] border border-[#e6ddd0] text-[11px] font-bold text-[#b45309]">
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    Plus ₹79
                  </span>
                )}
              </div>
              <Coffee className="w-5 h-5 text-[#b45309]" aria-hidden="true" />
            </div>

            {!hasPlus ? (
              <div className="p-5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] space-y-3">
                {location.popular_items.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5c4e45]">
                      Menu Preview (Popular Items)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {location.popular_items.slice(0, 4).map((item) => (
                        <span
                          key={item}
                          className="px-2.5 py-1 rounded-md bg-white border border-[#e6ddd0] text-xs font-medium text-[#1c1613]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-sm text-[#5c4e45] leading-relaxed">
                  Upgrade to <strong className="text-[#1c1613]">Cafe Desk Plus (₹79/month or ₹499/year)</strong>{' '}
                  to view full coffee, tea, snack, and meal prices plus average budget per person
                  across Bengaluru cafes.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    openUpgradeModal({
                      featureName: 'Food & Beverage Prices',
                      requiredPlan: 'plus',
                      description:
                        'Compare coffee, tea, snacks, and meal pricing plus popular menu picks across Bengaluru cafes.',
                    })
                  }
                  className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-lg bg-[#b45309] hover:opacity-95 text-white text-xs font-semibold"
                >
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Unlock Full Menu &amp; Budget (Plus ₹79/mo)</span>
                </button>
              </div>
            ) : hasAnyFoodPrices ? (
              <>
                {(location.coffee_price ||
                  location.tea_price ||
                  location.snacks_price ||
                  location.meals_price) && (
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {location.coffee_price && (
                      <div className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0]">
                        <dt className="text-xs font-semibold text-[#5c4e45]">Coffee</dt>
                        <dd className="font-mono-data text-sm font-bold text-[#1c1613] mt-0.5">
                          {location.coffee_price}
                        </dd>
                      </div>
                    )}
                    {location.tea_price && (
                      <div className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0]">
                        <dt className="text-xs font-semibold text-[#5c4e45]">Tea</dt>
                        <dd className="font-mono-data text-sm font-bold text-[#1c1613] mt-0.5">
                          {location.tea_price}
                        </dd>
                      </div>
                    )}
                    {location.snacks_price && (
                      <div className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0]">
                        <dt className="text-xs font-semibold text-[#5c4e45]">Snacks</dt>
                        <dd className="font-mono-data text-sm font-bold text-[#1c1613] mt-0.5">
                          {location.snacks_price}
                        </dd>
                      </div>
                    )}
                    {location.meals_price && (
                      <div className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0]">
                        <dt className="text-xs font-semibold text-[#5c4e45]">Meals</dt>
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
                          className="px-3 py-1 rounded-lg bg-[#f3ede3] border border-[#e6ddd0] text-xs font-semibold text-[#1c1613]"
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
                              className="w-14 h-14 rounded-lg object-cover border border-[#e6ddd0] shrink-0"
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
                                      ? 'text-[#991b1b]'
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
                                <span className="text-[#991b1b]">· Currently unavailable</span>
                              )}
                            </div>
                            <p className="text-base font-bold text-[#1c1613]">{item.name}</p>
                            {item.description && (
                              <p className="text-sm text-[#5c4e45] mt-0.5">{item.description}</p>
                            )}
                          </div>
                        </div>
                        <span className="font-mono-data text-sm font-bold text-[#1c1613] shrink-0">
                          ₹{item.price_inr}
                        </span>
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
                            <p className="text-base font-bold text-[#1c1613]">{item.name}</p>
                            {item.description && (
                              <p className="text-sm text-[#5c4e45] mt-0.5">{item.description}</p>
                            )}
                          </div>
                          {item.price && (
                            <span className="font-mono-data text-sm font-bold text-[#1c1613] shrink-0">
                              {item.price}
                            </span>
                          )}
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
          </section>

          {/* Facilities & Best For */}
          <div className="p-6 sm:p-8 rounded-2xl bg-white border border-[#e6ddd0] space-y-5">
            {location.facilities.length > 0 && (
              <div>
                <h2 className="font-serif-display text-xl font-bold text-[#1c1613] mb-3">
                  Amenities &amp; Atmosphere
                </h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-[#1c1613]">
                  {location.facilities.map((fac) => (
                    <li key={fac} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#1b4d3e] shrink-0" aria-hidden="true" />
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
                <AlertTriangle className="w-4 h-4 text-[#b45309] shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-[#5c4e45]">
                  <strong className="text-[#1c1613]">Good to know:</strong> {location.avoid_if}
                </p>
              </div>
            )}
          </div>

          {/* Public Source Claims & Attribution */}
          {(location.claims.length > 0 || location.source_name) && (
            <section className="p-6 sm:p-8 rounded-2xl bg-white border border-[#e6ddd0] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-serif-display text-xl font-bold text-[#1c1613]">
                  What Public Sources Say
                </h2>
                {!location.verified && (
                  <span className="text-xs font-semibold text-[#b45309]">
                    Unverified · Field audit pending
                  </span>
                )}
              </div>

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
            </section>
          )}

          {/* Student Perks & Offers */}
          {(location.student_discount || location.offers.length > 0) && (
            <div className="p-6 rounded-2xl bg-[#f3ede3] border border-[#e6ddd0] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[#1b4d3e] font-semibold text-sm">
                  <GraduationCap className="w-4 h-4" aria-hidden="true" />
                  <span>Student Perks &amp; Location Offers</span>
                </div>
                {!hasPlus && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#e6ddd0] text-[11px] font-bold text-[#b45309]">
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    Plus ₹79
                  </span>
                )}
              </div>
              {hasPlus ? (
                <>
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
                </>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs text-[#5c4e45]">
                    Student discounts and exclusive cafe offers are available on Cafe Desk Plus
                    (₹79/mo or ₹499/yr).
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      openUpgradeModal({
                        featureName: 'Exclusive Cafe Offers & Student Perks',
                        requiredPlan: 'plus',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#b45309] text-white text-xs font-semibold"
                  >
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Unlock Offers (Plus ₹79/mo)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div>
            <Link
              to={`/submit?cafe=${encodeURIComponent(location.name)}`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#5c4e45] hover:text-[#1c1613] underline underline-offset-4"
            >
              <Flag className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Report outdated Wi-Fi, price, or opening hours for this cafe</span>
            </Link>
          </div>
        </div>

        {/* Right Aside: Location Map Pin & Direct Platform Connections */}
        <aside className="lg:col-span-5 space-y-6 lg:sticky lg:top-20">
          {/* Interactive Map Pin Card */}
          <div className="rounded-2xl bg-white border border-[#e6ddd0] overflow-hidden">
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-serif-display text-xl font-bold text-[#1c1613]">
                  Location &amp; Distance
                </h2>
                {distText ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#ecfdf5] text-[#1b4d3e] text-xs font-mono-data font-semibold">
                    <Navigation className="w-3 h-3" aria-hidden="true" />
                    {distText}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => requestUserLocation()}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#b45309] hover:underline"
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
          <div className="p-6 rounded-2xl bg-white border border-[#e6ddd0] space-y-4">
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
                style={{ backgroundColor: settings.accent_color || '#b45309' }}
                className="w-full min-h-[42px] px-4 py-2 rounded-lg text-white text-sm font-semibold inline-flex items-center justify-between hover:opacity-95 transition-opacity"
              >
                <span className="inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                  Get Directions
                </span>
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </a>

              {location.website_url && (
                <a
                  href={location.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-[#faf7f2] border border-[#d6cbba] hover:bg-[#f3ede3] text-[#1c1613] text-sm font-semibold inline-flex items-center justify-between transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
                    Visit Official Website
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-[#5c4e45]" aria-hidden="true" />
                </a>
              )}

              {location.menu_url && (
                <a
                  href={location.menu_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-[#faf7f2] border border-[#d6cbba] hover:bg-[#f3ede3] text-[#1c1613] text-sm font-semibold inline-flex items-center justify-between transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
                    View Menu
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-[#5c4e45]" aria-hidden="true" />
                </a>
              )}

              {location.instagram_url && (
                <a
                  href={location.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-[#faf7f2] border border-[#d6cbba] hover:bg-[#f3ede3] text-[#1c1613] text-sm font-semibold inline-flex items-center justify-between transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <Instagram className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
                    Instagram Profile
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-[#5c4e45]" aria-hidden="true" />
                </a>
              )}

              {location.phone && (
                <a
                  href={`tel:${location.phone.replace(/\s+/g, '')}`}
                  className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-[#faf7f2] border border-[#d6cbba] hover:bg-[#f3ede3] text-[#1c1613] text-sm font-semibold inline-flex items-center justify-between transition-colors"
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
                className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-[#faf7f2] border border-[#d6cbba] hover:bg-[#f3ede3] text-[#1c1613] text-sm font-semibold inline-flex items-center justify-between transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
                  Suggest correction on WhatsApp
                </span>
                <ArrowUpRight className="w-4 h-4 text-[#5c4e45]" aria-hidden="true" />
              </a>
            </div>

            {(!location.website_url || !location.menu_url || !location.instagram_url) && (
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
        </aside>
      </div>

      {/* Full-Screen Photo Lightbox Modal */}
      {lightboxOpen && approvedPhotos.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${location.name} photo gallery`}
          className="fixed inset-0 z-50 bg-[#1c1613]/92 backdrop-blur-sm flex flex-col justify-between p-4 sm:p-6"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="flex items-center justify-between gap-4 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="font-serif-display text-lg font-bold">{location.name}</p>
              <p className="text-xs text-white/75">
                {location.area}, {location.city} · Photo {safePhotoIdx + 1} of{' '}
                {approvedPhotos.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="w-10 h-10 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
              aria-label="Close photo gallery"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div
            className="relative flex-1 flex items-center justify-center my-4 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            {approvedPhotos.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setActivePhotoIdx(
                    (safePhotoIdx - 1 + approvedPhotos.length) % approvedPhotos.length
                  )
                }
                className="absolute left-2 sm:left-4 z-10 w-11 h-11 rounded-lg bg-black/55 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-6 h-6" aria-hidden="true" />
              </button>
            )}

            <img
              src={approvedPhotos[safePhotoIdx]}
              alt={`${location.name} (${location.area}) view ${safePhotoIdx + 1}`}
              referrerPolicy="no-referrer"
              className="max-h-[75vh] max-w-full w-auto object-contain rounded-xl shadow-2xl"
            />

            {approvedPhotos.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setActivePhotoIdx((safePhotoIdx + 1) % approvedPhotos.length)
                }
                className="absolute right-2 sm:right-4 z-10 w-11 h-11 rounded-lg bg-black/55 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                aria-label="Next photo"
              >
                <ChevronRight className="w-6 h-6" aria-hidden="true" />
              </button>
            )}
          </div>

          {approvedPhotos.length > 1 && (
            <div
              className="flex items-center justify-center gap-2 overflow-x-auto py-1"
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

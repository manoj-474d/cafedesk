import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Bookmark,
  Check,
  CheckCircle2,
  Clock,
  GitCompareArrows,
  Globe,
  Heart,
  Images,
  Instagram,
  Laptop,
  Lock,
  MapPin,
  Navigation,
  Plug,
  Share2,
  Star,
  Utensils,
  Volume2,
  Wifi,
} from 'lucide-react';
import { getNoiseSummary } from '../config/constants';
import { locationToLibrarySnapshot, useAuth } from '../context/AuthContext';
import { useDiscovery } from '../context/DiscoveryContext';
import type { LocationItem } from '../types/cms';
import {
  formatDistanceKm,
  getCafeDetailRoute,
  getCafeOpenStatus,
  getStartingPriceLabel,
  getWorkspaceTypesForCafe,
} from '../utils/cafeHelpers';
import { isOutdoorFriendly } from '../utils/cafeRecommendations';
import { ResilientPhoto } from './ResilientPhoto';

interface LocationCardProps {
  location: LocationItem & { distanceKm?: number | null };
  matchScore?: number;
  matchReasons?: string[];
}

export function LocationCard({
  location,
  matchScore,
  matchReasons,
}: LocationCardProps) {
  const { getEffectiveLocation } = useDiscovery();
  const {
    authenticated,
    isSubscribed,
    isExpired,
    hasPermission,
    openUpgradeModal,
    isCafeSaved,
    isCafeFavourite,
    toggleSaveCafe,
    compareList,
    toggleCompareCafe,
  } = useAuth();
  const [copiedShare, setCopiedShare] = useState(false);

  const loc = location.distanceKm !== undefined ? location : getEffectiveLocation(location);

  const unlocked = loc.access?.unlockedSections;
  const wifiUnlocked = unlocked ? unlocked.wifi_details : isSubscribed;
  const socketsUnlocked = unlocked ? unlocked.power_sockets : isSubscribed;
  const workspaceUnlocked = unlocked ? unlocked.workspace_details : isSubscribed;
  const menuPricingUnlocked = unlocked ? unlocked.menu_pricing : isSubscribed;
  const amenitiesUnlocked = unlocked ? unlocked.amenities : isSubscribed;
  const compareAllowed = hasPermission('compare');

  const detailRoute = getCafeDetailRoute(loc.slug, authenticated);
  const startingPrice = menuPricingUnlocked ? getStartingPriceLabel(loc) : 'Plus';
  const workspaceTypes = getWorkspaceTypesForCafe(loc);
  const openStatus = getCafeOpenStatus(loc.timings);
  const approvedPhoto =
    loc.photos_approved && loc.photos.length > 0 ? loc.photos[0] : undefined;
  const distText = formatDistanceKm(loc.distanceKm);
  const noiseSummary = getNoiseSummary(loc.noise_level);
  const outdoorFriendly = isOutdoorFriendly(loc);
  const cafeKey = loc.slug || loc.id;
  const saved = isCafeSaved(cafeKey);
  const favourited = isCafeFavourite(cafeKey);
  const inCompare = compareList.some((c) => c.id === loc.id);
  const snapshot = locationToLibrarySnapshot(loc);

  const wifiDisplay =
    loc.wifi_mbps !== null
      ? `${loc.wifi_mbps} Mbps`
      : loc.wifi_available === 'yes'
      ? 'Wi-Fi Ready'
      : loc.wifi_available === 'no'
      ? 'No Wi-Fi'
      : 'Unverified';

  const socketsDisplay =
    loc.sockets_count !== null
      ? `${loc.sockets_count} plugs`
      : loc.charging_sockets === 'yes' || loc.sockets_claimed
      ? 'Plugs available'
      : loc.charging_sockets === 'no'
      ? 'No plugs'
      : 'Plugs unverified';

  const noiseDisplay = noiseSummary ?? 'Ambient';

  const costDisplay = loc.price_range
    ? loc.avg_cost_per_person !== null
      ? `${loc.price_range} (₹${loc.avg_cost_per_person})`
      : loc.price_range
    : loc.avg_cost_per_person !== null
    ? `₹${loc.avg_cost_per_person} avg`
    : 'Budget unverified';

  const promptSubscription = (featureName: string, description: string) => {
    openUpgradeModal({
      featureName,
      requiredPlan: 'plus',
      description: isExpired
        ? `Your subscription has expired. Renew your Cafe Desk plan to unlock ${featureName.toLowerCase()}.`
        : description,
    });
  };

  const handleSaveToggle = async (asFavourite: boolean) => {
    await toggleSaveCafe(snapshot, asFavourite);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/locations/${encodeURIComponent(loc.slug)}`;
    const shareData = {
      title: `${loc.name} · Cafe Desk`,
      text: `Check out ${loc.name} in ${loc.area}, Bengaluru on Cafe Desk.`,
      url: shareUrl,
    };
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      window.setTimeout(() => setCopiedShare(false), 2000);
    } catch {
      // Ignore cancelled share sheet
    }
  };

  const summaryHighlights = [
    ...workspaceTypes,
    ...(workspaceUnlocked && outdoorFriendly ? ['Outdoor Seating'] : []),
    ...loc.popular_items.slice(0, 2),
  ];

  return (
    <article className="group bg-white rounded-2xl border border-[#e6ddd0] hover:border-[#b45309]/40 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col">
      {/* Header Photo */}
      <div className="relative">
        <Link
          to={detailRoute}
          className="block relative aspect-[16/10] overflow-hidden bg-[#f3ede3]"
        >
          {approvedPhoto ? (
            <ResilientPhoto
              key={approvedPhoto}
              src={approvedPhoto}
              alt={`${loc.name} in ${loc.area}, ${loc.city}`}
              className="w-full h-full"
              imgClassName="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-[#f3ede3] p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="font-mono-data uppercase tracking-wider font-medium text-[#5c4e45]">
                  {loc.city}
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-[#1c1613]">
                  <MapPin className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                  {loc.area}
                </span>
              </div>
              <div>
                <p className="font-serif-display text-lg font-bold text-[#1c1613] line-clamp-1">
                  {loc.name}
                </p>
                <p className="text-xs text-[#5c4e45] mt-0.5">Official cafe snapshot</p>
              </div>
            </div>
          )}

          {/* Subtle Top-Left Badges */}
          <div className="absolute top-3 left-3 right-14 flex flex-wrap items-center gap-1.5 pointer-events-none">
            {wifiUnlocked && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs text-[#1c1613] border border-[#e6ddd0] font-mono-data text-[11px] font-semibold shadow-xs">
                <Wifi className="w-3 h-3 text-[#1b4d3e]" aria-hidden="true" />
                <span>{wifiDisplay}</span>
              </span>
            )}
            {menuPricingUnlocked && startingPrice && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs text-[#1c1613] border border-[#e6ddd0] font-mono-data text-[11px] font-semibold shadow-xs">
                <span>{startingPrice}</span>
              </span>
            )}
          </div>

          {/* Photo Counter */}
          {loc.photos.length > 1 && (
            <div className="absolute bottom-3 left-3 pointer-events-none">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1c1613]/80 text-white font-mono-data text-[11px] font-medium">
                <Images className="w-3 h-3 text-[#f59e0b]" aria-hidden="true" />
                <span>{loc.photos.length}</span>
              </span>
            </div>
          )}
        </Link>

        {/* Top-Right Floating Heart Button */}
        <button
          type="button"
          onClick={() => void handleSaveToggle(true)}
          aria-label={favourited ? `Remove ${loc.name} from favourites` : `Favourite ${loc.name}`}
          className={`absolute top-3 right-3 z-10 inline-flex items-center justify-center w-10 h-10 rounded-full border shadow-xs transition-colors ${
            favourited
              ? 'bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]'
              : 'bg-white/95 border-[#e6ddd0] text-[#5c4e45] hover:text-[#b45309]'
          }`}
        >
          <Heart className={`w-4 h-4 ${favourited ? 'fill-[#b91c1c]' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {/* Card Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        {/* Locality & Distance */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5c4e45] mb-1.5">
          <span className="truncate font-medium">
            {loc.area} · {loc.city}
          </span>
          {distText && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[#1b4d3e] font-mono-data text-[11px] font-semibold">
              <Navigation className="w-2.5 h-2.5" aria-hidden="true" />
              {distText}
            </span>
          )}
        </div>

        <h3 className="font-serif-display text-lg sm:text-xl font-bold text-[#1c1613] leading-snug mb-1">
          <Link to={detailRoute} className="hover:text-[#b45309] transition-colors">
            {loc.name}
          </Link>
        </h3>

        <p className="text-xs text-[#5c4e45] truncate mb-2.5">
          {loc.address || `${loc.area}, ${loc.city}`}
        </p>

        {/* Rating, Verification & Featured */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#5c4e45] mb-3">
          {loc.rating !== null ? (
            <span className="inline-flex items-center gap-1 font-semibold text-[#1c1613]">
              <Star className="w-3.5 h-3.5 text-[#d97706] fill-[#d97706]" aria-hidden="true" />
              <span className="font-mono-data">{loc.rating.toFixed(1)}</span>
              {loc.rating_count !== null && (
                <span className="text-[#5c4e45] font-normal font-mono-data">
                  ({loc.rating_count})
                </span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Star className="w-3.5 h-3.5 opacity-40" aria-hidden="true" />
              <span>Unrated</span>
            </span>
          )}

          <span aria-hidden="true">·</span>

          {loc.verified ? (
            <span className="inline-flex items-center gap-1 text-[#1b4d3e] font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
              Public
            </span>
          )}

          {loc.featured && (
            <>
              <span aria-hidden="true">·</span>
              <span className="px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] text-[10px] font-semibold">
                Featured
              </span>
            </>
          )}
        </div>

        <p className="text-sm text-[#5c4e45] leading-relaxed line-clamp-2 mb-3">
          {loc.verdict || loc.claims[0] || loc.description}
        </p>

        {typeof matchScore === 'number' && (
          <p className="mb-2.5 text-xs text-[#1b4d3e] font-semibold">
            <span className="font-mono-data">{matchScore}% match</span>
            {matchReasons && matchReasons.length > 0 && (
              <span className="text-[#5c4e45] font-normal">
                {' · '}
                {matchReasons.slice(0, 2).join(' · ')}
              </span>
            )}
          </p>
        )}

        {summaryHighlights.length > 0 && (
          <p className="text-xs text-[#5c4e45] mb-3 line-clamp-1">
            {summaryHighlights.join(' · ')}
          </p>
        )}

        {/* Work Spec Grid (Strictly Gated) */}
        <dl className="grid grid-cols-2 gap-y-2 gap-x-3 pt-3 border-t border-[#e6ddd0] text-xs mt-auto">
          <div className="flex items-center gap-1.5 min-w-0">
            <Wifi className="w-3.5 h-3.5 text-[#1b4d3e] shrink-0" aria-hidden="true" />
            {wifiUnlocked ? (
              <dd className="font-mono-data font-medium text-[#1c1613] truncate">{wifiDisplay}</dd>
            ) : (
              <button
                type="button"
                onClick={() =>
                  promptSubscription(
                    'Wi-Fi Availability & Speeds',
                    'Unlock verified Wi-Fi availability, measured Mbps speeds, and Wi-Fi credentials with a Cafe Desk subscription.'
                  )
                }
                className="inline-flex items-center gap-1 text-[#b45309] font-medium hover:underline truncate text-left"
              >
                <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{isExpired ? 'Expired' : 'Wi-Fi · Plus'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <Plug className="w-3.5 h-3.5 text-[#1b4d3e] shrink-0" aria-hidden="true" />
            {socketsUnlocked ? (
              <dd className="font-mono-data font-medium text-[#1c1613] truncate">
                {socketsDisplay}
              </dd>
            ) : (
              <button
                type="button"
                onClick={() =>
                  promptSubscription(
                    'Power Socket Availability',
                    'Unlock charging socket counts and plug desk locations with a Cafe Desk subscription.'
                  )
                }
                className="inline-flex items-center gap-1 text-[#b45309] font-medium hover:underline truncate text-left"
              >
                <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{isExpired ? 'Expired' : 'Plugs · Plus'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            {loc.laptop_friendly ? (
              <Laptop className="w-3.5 h-3.5 text-[#5c4e45] shrink-0" aria-hidden="true" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-[#5c4e45] shrink-0" aria-hidden="true" />
            )}
            {workspaceUnlocked ? (
              <dd className="font-medium text-[#1c1613] truncate">
                {noiseDisplay}
                {loc.laptop_friendly ? ' · Laptop' : ''}
              </dd>
            ) : (
              <button
                type="button"
                onClick={() =>
                  promptSubscription(
                    'Workspace & Acoustic Details',
                    'Unlock noise ratings, seating details, and laptop work suitability with a Cafe Desk subscription.'
                  )
                }
                className="inline-flex items-center gap-1 text-[#b45309] font-medium hover:underline truncate text-left"
              >
                <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="truncate">Noise · Plus</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            {menuPricingUnlocked ? (
              <dd className="font-mono-data font-medium text-[#1c1613] truncate">{costDisplay}</dd>
            ) : (
              <button
                type="button"
                onClick={() =>
                  promptSubscription(
                    'Menu & Budget Pricing',
                    'Unlock coffee, tea, snacks, and average cost per person with a Cafe Desk subscription.'
                  )
                }
                className="inline-flex items-center gap-1 text-[#b45309] font-medium hover:underline truncate text-left"
              >
                <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="truncate">Menu · Plus</span>
              </button>
            )}
          </div>
        </dl>

        {/* Actions Row */}
        <div className="mt-3 pt-3 border-t border-[#e6ddd0] flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleSaveToggle(false)}
              className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border font-medium transition-colors ${
                saved
                  ? 'bg-[#fef3c7] border-[#f59e0b]/50 text-[#92400e]'
                  : 'bg-[#faf7f2] border-[#e6ddd0] text-[#5c4e45] hover:text-[#1c1613]'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${saved ? 'fill-[#92400e]' : ''}`} aria-hidden="true" />
              <span>{saved ? 'Saved' : 'Save'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleShare()}
              aria-label={`Share ${loc.name}`}
              className="inline-flex items-center justify-center min-w-[40px] min-h-[40px] px-2.5 rounded-xl border border-[#e6ddd0] bg-[#faf7f2] text-[#5c4e45] hover:text-[#1c1613] transition-colors"
            >
              {copiedShare ? (
                <Check className="w-3.5 h-3.5 text-[#1b4d3e]" aria-hidden="true" />
              ) : (
                <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => toggleCompareCafe(loc)}
            className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border font-medium transition-colors ${
              inCompare
                ? 'bg-[#1b4d3e] border-[#1b4d3e] text-white'
                : 'bg-[#faf7f2] border-[#e6ddd0] text-[#5c4e45] hover:text-[#1c1613]'
            }`}
          >
            {!compareAllowed ? (
              <Lock className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
            ) : (
              <GitCompareArrows className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{inCompare ? 'Comparing' : 'Compare'}</span>
          </button>
        </div>

        {/* Footer CTA & Quick Links */}
        <div className="mt-3 pt-3 border-t border-[#e6ddd0] flex flex-wrap items-center justify-between gap-2 text-xs">
          {amenitiesUnlocked ? (
            <div className="flex flex-wrap items-center gap-2.5 text-[#5c4e45]">
              {openStatus !== 'unknown' && (
                <span
                  className={`font-semibold ${
                    openStatus === 'open' ? 'text-[#1b4d3e]' : 'text-[#b91c1c]'
                  }`}
                >
                  {openStatus === 'open' ? 'Open now' : 'Closed'}
                </span>
              )}
              {loc.website_url && (
                <a
                  href={loc.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[#1c1613]"
                >
                  <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Web</span>
                </a>
              )}
              {loc.menu_url && loc.menu_url !== loc.website_url && (
                <a
                  href={loc.menu_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[#1c1613]"
                >
                  <Utensils className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Menu</span>
                </a>
              )}
              {loc.instagram_url && (
                <a
                  href={loc.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[#1c1613]"
                  aria-label={`${loc.name} Instagram`}
                >
                  <Instagram className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              )}
              {loc.map_link && (
                <a
                  href={loc.map_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 hover:text-[#1c1613]"
                >
                  <span>Maps</span>
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          ) : (
            <span className="text-[#5c4e45] inline-flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#b45309]" aria-hidden="true" />
              <span>Wi-Fi &amp; menus locked</span>
            </span>
          )}

          <Link
            to={detailRoute}
            className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 rounded-xl bg-[#1c1613] hover:bg-[#b45309] text-white text-xs font-semibold transition-colors ml-auto"
          >
            <span>Explore</span>
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

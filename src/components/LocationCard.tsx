import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Bookmark,
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
import { ResilientPhoto } from './ResilientPhoto';
import { isOutdoorFriendly } from '../utils/cafeRecommendations';

interface LocationCardProps {
  location: LocationItem & { distanceKm?: number | null };
  matchScore?: number;
  matchReasons?: string[];
}

export function LocationCard({ location, matchScore, matchReasons }: LocationCardProps) {
  const { getEffectiveLocation } = useDiscovery();
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
  const loc = location.distanceKm !== undefined ? location : getEffectiveLocation(location);

  const detailRoute = getCafeDetailRoute(loc.slug, authenticated);
  const startingPrice = getStartingPriceLabel(loc);
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
      ? `Wi-Fi: Yes · ${loc.wifi_mbps} Mbps`
      : loc.wifi_available === 'yes'
      ? 'Wi-Fi: Yes · Speed not verified'
      : loc.wifi_available === 'no'
      ? 'Wi-Fi: No'
      : 'Wi-Fi: Not verified';

  const socketsDisplay =
    loc.sockets_count !== null
      ? `${loc.sockets_count} sockets`
      : loc.charging_sockets === 'yes' || loc.sockets_claimed
      ? 'Charging sockets'
      : loc.charging_sockets === 'no'
      ? 'No sockets'
      : 'Sockets not verified';

  const noiseDisplay = noiseSummary ?? 'Noise unmeasured';

  const costDisplay = loc.price_range
    ? loc.avg_cost_per_person !== null
      ? `${loc.price_range} (₹${loc.avg_cost_per_person} avg)`
      : loc.price_range
    : loc.avg_cost_per_person !== null
    ? `₹${loc.avg_cost_per_person} avg`
    : 'Budget unverified';

  return (
    <article className="group bg-white rounded-2xl border border-[#e6ddd0] overflow-hidden flex flex-col transition-shadow hover:shadow-md">
      <Link to={detailRoute} className="block relative aspect-[16/10] overflow-hidden">
        {approvedPhoto ? (
          <>
            <ResilientPhoto
              key={approvedPhoto}
              src={approvedPhoto}
              alt={`${loc.name} in ${loc.area}, ${loc.city}`}
              className="w-full h-full"
              imgClassName="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            {loc.photos.length > 1 && (
              <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1c1613]/75 backdrop-blur-sm text-white text-[11px] font-mono-data font-medium">
                <Images className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{loc.photos.length} photos</span>
              </span>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#f3ede3] via-[#ece3d5] to-[#e2d5c1] p-5 flex flex-col justify-between text-[#1c1613]">
            <div className="flex items-center justify-between text-xs text-[#5c4e45] gap-2">
              <span className="font-mono-data uppercase tracking-wider">{loc.city}</span>
              <span className="inline-flex items-center gap-1 font-semibold">
                <MapPin className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                {loc.area}
              </span>
            </div>
            <div>
              <p className="font-serif-display text-xl font-bold text-[#1c1613] line-clamp-1">
                {loc.name}
              </p>
              <p className="text-xs text-[#5c4e45] mt-1">
                Placeholder · Real cafe photos added from official cafe sources
              </p>
            </div>
          </div>
        )}
      </Link>

      <div className="p-5 flex-1 flex flex-col">
        {/* Locality, Distance & Starting Price */}
        <div className="flex items-center justify-between gap-2 text-xs text-[#5c4e45] mb-1.5">
          <span className="truncate font-medium">
            {loc.area} · {loc.city}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {distText && (
              <span className="inline-flex items-center gap-1 font-semibold text-[#1b4d3e] font-mono-data">
                <Navigation className="w-3 h-3" aria-hidden="true" />
                {distText}
              </span>
            )}
            <span className="font-mono-data font-semibold text-[#1c1613] whitespace-nowrap">
              {startingPrice}
            </span>
          </div>
        </div>

        <h3 className="font-serif-display text-xl font-bold text-[#1c1613] leading-snug mb-1">
          <Link to={detailRoute} className="hover:text-[#b45309] transition-colors">
            {loc.name}
          </Link>
        </h3>

        <p className="text-xs text-[#5c4e45] truncate mb-2">
          {authenticated && loc.address ? loc.address : `${loc.area}, ${loc.city}`}
        </p>

        {/* Rating, Verification & Featured Line */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-[#5c4e45] mb-3">
          {loc.rating !== null ? (
            <span className="inline-flex items-center gap-1 text-[#1c1613] font-semibold">
              <Star className="w-3.5 h-3.5 text-[#d97706] fill-[#d97706]" aria-hidden="true" />
              <span className="font-mono-data">{loc.rating.toFixed(1)}</span>
              {loc.rating_count !== null && (
                <span className="text-[#5c4e45] font-normal">({loc.rating_count})</span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[#5c4e45]">
              <Star className="w-3.5 h-3.5 text-[#cbd5e1]" aria-hidden="true" />
              <span>Not rated yet</span>
            </span>
          )}

          <span aria-hidden="true">·</span>

          {loc.verified ? (
            <span className="inline-flex items-center gap-1 text-[#1b4d3e] font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[#5c4e45] font-semibold">
              <Clock className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
              Public listing
            </span>
          )}

          {loc.featured && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#b45309] font-semibold">Sponsored · Featured</span>
            </>
          )}
        </div>

        <p className="text-sm text-[#5c4e45] leading-relaxed line-clamp-2 mb-3">
          {loc.verdict || loc.claims[0] || loc.description}
        </p>

        {/* Match Score & Reason Badges when shown from Cafe Finder */}
        {typeof matchScore === 'number' && (
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-[#ecfdf5] border border-[#a7f3d0] text-[11px] font-mono-data font-bold text-[#1b4d3e]">
              {matchScore}% match
            </span>
            {matchReasons?.slice(0, 2).map((reason) => (
              <span
                key={reason}
                className="px-2 py-0.5 rounded-md bg-[#faf7f2] border border-[#e6ddd0] text-[11px] font-medium text-[#5c4e45]"
              >
                {reason}
              </span>
            ))}
          </div>
        )}

        {/* Available Workspace Types & Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {workspaceTypes.map((wt) => (
            <span
              key={wt}
              className="px-2 py-0.5 rounded-md bg-[#f3ede3] border border-[#e6ddd0] text-[11px] font-semibold text-[#1c1613]"
            >
              {wt}
            </span>
          ))}
          {outdoorFriendly && (
            <span className="px-2 py-0.5 rounded-md bg-[#ecfdf5] border border-[#a7f3d0] text-[11px] font-semibold text-[#1b4d3e]">
              Outdoor Seating
            </span>
          )}
          {loc.popular_items.slice(0, 2).map((item) => (
            <span
              key={item}
              className="px-2 py-0.5 rounded-md bg-[#faf7f2] border border-[#e6ddd0] text-[11px] font-medium text-[#5c4e45]"
            >
              {item}
            </span>
          ))}
        </div>

        {/* Tabular Discovery Spec Strip (Gated by Subscription Tier) */}
        <dl className="grid grid-cols-2 gap-y-2 gap-x-3 pt-3.5 border-t border-[#e6ddd0] text-xs mt-auto">
          <div className="flex items-center gap-1.5 text-[#1c1613]">
            <Wifi className="w-3.5 h-3.5 text-[#1b4d3e] shrink-0" aria-hidden="true" />
            {hasPlus ? (
              <dd
                className={`font-medium truncate ${
                  loc.wifi_mbps === null && loc.wifi_available !== 'yes' ? 'text-[#5c4e45]' : ''
                }`}
              >
                {wifiDisplay}
              </dd>
            ) : (
              <button
                type="button"
                onClick={() =>
                  openUpgradeModal({
                    featureName: 'Wi-Fi Availability & Speeds',
                    requiredPlan: 'plus',
                  })
                }
                className="inline-flex items-center gap-1 text-[#b45309] font-semibold hover:underline truncate"
              >
                <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>Wi-Fi · Plus ₹79</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[#1c1613]">
            <Plug className="w-3.5 h-3.5 text-[#1b4d3e] shrink-0" aria-hidden="true" />
            <dd
              className={`font-medium truncate ${
                loc.sockets_count === null && loc.charging_sockets !== 'yes' && !loc.sockets_claimed
                  ? 'text-[#5c4e45]'
                  : ''
              }`}
            >
              {socketsDisplay}
            </dd>
          </div>

          <div className="flex items-center gap-1.5 text-[#1c1613]">
            {loc.laptop_friendly ? (
              <Laptop className="w-3.5 h-3.5 text-[#b45309] shrink-0" aria-hidden="true" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-[#b45309] shrink-0" aria-hidden="true" />
            )}
            <dd className="font-medium truncate">
              {noiseDisplay}
              {loc.laptop_friendly ? ' · Laptop-ok' : ''}
            </dd>
          </div>

          <div className="flex items-center gap-1.5 text-[#1c1613]">
            {hasPlus ? (
              <dd
                className={`font-mono-data font-semibold truncate ${
                  !loc.price_range && loc.avg_cost_per_person === null ? 'text-[#5c4e45]' : ''
                }`}
              >
                {costDisplay}
              </dd>
            ) : (
              <dd className="font-mono-data font-semibold truncate text-[#1c1613]">
                {startingPrice}
              </dd>
            )}
          </div>
        </dl>

        {/* Actions Bar: Free Save / Favourite + Plus Side-by-Side Compare */}
        <div className="mt-3 pt-2.5 border-t border-[#f3ede3] flex items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void toggleSaveCafe(snapshot, false)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border transition-colors font-semibold ${
                saved
                  ? 'bg-[#1c1613] text-white border-[#1c1613]'
                  : 'bg-[#faf7f2] text-[#5c4e45] border-[#e6ddd0] hover:border-[#b45309] hover:text-[#1c1613]'
              }`}
            >
              <Bookmark className="w-3 h-3" aria-hidden="true" />
              <span>{saved ? 'Saved' : 'Save'}</span>
            </button>

            <button
              type="button"
              onClick={() => void toggleSaveCafe(snapshot, true)}
              aria-label={favourited ? 'Remove favourite' : 'Mark favourite'}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border transition-colors font-semibold ${
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
            onClick={() => toggleCompareCafe(loc)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border transition-colors font-semibold ${
              inCompare
                ? 'bg-[#1b4d3e] text-white border-[#1b4d3e]'
                : 'bg-[#faf7f2] text-[#5c4e45] border-[#e6ddd0] hover:border-[#b45309] hover:text-[#1c1613]'
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

        {/* Footer CTA & Quick Links */}
        <div className="mt-3 pt-3 border-t border-[#e6ddd0] flex flex-wrap items-center justify-between gap-2 text-xs">
          {authenticated ? (
            <div className="flex flex-wrap items-center gap-2.5 text-[#5c4e45]">
              {openStatus !== 'unknown' && (
                <span
                  className={`font-semibold ${
                    openStatus === 'open' ? 'text-[#1b4d3e]' : 'text-[#7c2d12]'
                  }`}
                >
                  {openStatus === 'open' ? 'Open now' : 'Closed now'}
                </span>
              )}
              {loc.website_url && (
                <a
                  href={loc.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold hover:text-[#1c1613]"
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
                  className="inline-flex items-center gap-1 font-semibold hover:text-[#1c1613]"
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
                  className="inline-flex items-center gap-1 font-semibold hover:text-[#1c1613]"
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
                  className="inline-flex items-center gap-0.5 font-semibold hover:text-[#1c1613]"
                >
                  <span>Maps</span>
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          ) : (
            <span className="text-[#5c4e45] font-medium">Menus, seats &amp; booking inside</span>
          )}

          <Link
            to={detailRoute}
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-[#1c1613] hover:bg-[#b45309] text-white text-xs font-semibold transition-colors ml-auto"
          >
            <span>View Cafe</span>
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

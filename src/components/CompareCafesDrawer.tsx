import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, GitCompareArrows, Navigation, Star, Trash2, X } from 'lucide-react';
import { getNoiseSummary } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { useDiscovery } from '../context/DiscoveryContext';
import {
  buildGoogleMapsDirectionsUrl,
  formatDistanceKm,
  getCafeSourceMeta,
} from '../utils/cafeHelpers';

export function CompareCafesDrawer() {
  const { pathname } = useLocation();
  const { getEffectiveLocation } = useDiscovery();
  const {
    isSubscribed,
    hasPermission,
    compareList,
    compareModalOpen,
    setCompareModalOpen,
    removeCompareCafe,
    clearCompare,
  } = useAuth();

  if (!hasPermission('compare') || compareList.length === 0) return null;

  const isDetailRoute = /^\/(?:locations|cafe|discover)\/[^/]+/.test(pathname);
  const enrichedList = compareList.map((item) => getEffectiveLocation(item));

  return (
    <>
      {/* Sticky Bottom Tray */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-2xl rounded-2xl bg-[#1c1613] text-[#faf7f2] border border-[#3d312a] shadow-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2.5 ${
          isDetailRoute
            ? 'bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-4'
            : 'bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-4'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <GitCompareArrows className="w-4 h-4 text-[#f59e0b] shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white">
              Cafe Battle ({enrichedList.length}/3 selected)
            </p>
            <p className="text-[11px] text-[#d6cbba] truncate">
              {enrichedList.map((c) => c.name).join(' vs ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCompareModalOpen(true)}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors"
          >
            Compare ({enrichedList.length})
          </button>
          <button
            type="button"
            onClick={clearCompare}
            aria-label="Clear Cafe Battle tray"
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Side-by-Side Cafe Battle Modal */}
      {compareModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cafe Battle comparison"
          className="fixed inset-0 z-50 bg-[#1c1613]/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setCompareModalOpen(false)}
        >
          <div
            className="w-full max-w-5xl max-h-[90vh] overflow-auto rounded-t-3xl sm:rounded-2xl bg-[#faf7f2] border border-[#e6ddd0] shadow-2xl text-[#1c1613] animate-sheet-up pb-[env(safe-area-inset-bottom)] sm:pb-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 p-4 sm:p-5 bg-[#1c1613] text-white flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#f59e0b]">
                  Cafe Battle · Side-by-Side (Up to 3 Places)
                </p>
                <h2 className="font-serif-display text-xl sm:text-2xl font-bold">
                  Compare Rating, Distance, Prices &amp; Work Fit
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCompareModalOpen(false)}
                aria-label="Close comparison"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shrink-0 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Stacked Comparison Cards */}
            <div className="md:hidden p-4 space-y-3">
              {enrichedList.map((c) => {
                const wifiOk = c.access?.unlockedSections?.wifi_details ?? isSubscribed;
                const socketsOk = c.access?.unlockedSections?.power_sockets ?? isSubscribed;
                const workOk = c.access?.unlockedSections?.workspace_details ?? isSubscribed;
                const priceOk = c.access?.unlockedSections?.menu_pricing ?? isSubscribed;
                const sourceMeta = getCafeSourceMeta(c);
                const dirUrl = buildGoogleMapsDirectionsUrl(c);
                const distLabel = formatDistanceKm(c.distanceKm);

                return (
                  <article
                    key={c.id}
                    className="rounded-2xl bg-white border border-[#e6ddd0] p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sourceMeta.badgeClass}`}>
                            {sourceMeta.label}
                          </span>
                          {c.category && (
                            <span className="px-2 py-0.5 rounded-full bg-[#faf7f2] border border-[#e6ddd0] text-[10px] font-medium text-[#5c4e45]">
                              {c.category}
                            </span>
                          )}
                        </div>
                        <Link
                          to={`/locations/${c.slug}`}
                          onClick={() => setCompareModalOpen(false)}
                          className="font-serif-display text-lg font-bold text-[#1c1613] hover:text-[#b45309]"
                        >
                          {c.name}
                        </Link>
                        <p className="text-xs text-[#5c4e45]">
                          {c.area}
                          {distLabel ? ` · ${distLabel}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCompareCafe(c.id)}
                        aria-label={`Remove ${c.name}`}
                        className="w-9 h-9 rounded-lg border border-[#e6ddd0] bg-[#faf7f2] text-[#5c4e45] hover:text-[#b91c1c] flex items-center justify-center shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0]">
                        <p className="text-[10px] font-semibold uppercase text-[#5c4e45]">Rating</p>
                        <p className="font-semibold mt-0.5 inline-flex items-center gap-1">
                          <Star className="w-3 h-3 text-[#d97706] fill-[#d97706]" aria-hidden="true" />
                          <span>{c.rating !== null ? `${c.rating.toFixed(1)}` : 'Not rated'}</span>
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0]">
                        <p className="text-[10px] font-semibold uppercase text-[#5c4e45]">Wi-Fi</p>
                        <p className="font-semibold mt-0.5">
                          {!wifiOk
                            ? 'Subscribers only'
                            : c.wifi_mbps !== null
                            ? `${c.wifi_mbps} Mbps`
                            : c.wifi_available === 'yes'
                            ? 'Available'
                            : 'Not verified'}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0]">
                        <p className="text-[10px] font-semibold uppercase text-[#5c4e45]">Sockets &amp; Noise</p>
                        <p className="font-semibold mt-0.5">
                          {!socketsOk || !workOk
                            ? 'Subscribers only'
                            : `${
                                c.sockets_count !== null
                                  ? `${c.sockets_count} sockets`
                                  : c.charging_sockets === 'yes' || c.sockets_claimed
                                  ? 'Plugs yes'
                                  : 'Plugs unverified'
                              } · ${getNoiseSummary(c.noise_level) ?? 'Not verified'}`}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0]">
                        <p className="text-[10px] font-semibold uppercase text-[#5c4e45]">
                          Price Range
                        </p>
                        <p className="font-mono-data font-bold mt-0.5">
                          {!priceOk
                            ? 'Subscribers only'
                            : c.avg_cost_per_person !== null
                            ? `₹${c.avg_cost_per_person}`
                            : c.price_range || 'Not available'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                      <span className="text-[#5c4e45] truncate">{c.timings || 'Hours not available'}</span>
                      {dirUrl ? (
                        <a
                          href={dirUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl bg-[#b45309] text-white font-semibold shrink-0"
                        >
                          <span>Directions</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-[#8c7a6b]">Directions unavailable</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Desktop Comparison Table */}
            <div className="hidden md:block p-5 overflow-x-auto bg-white">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#e6ddd0]">
                    <th className="py-3 pr-4 font-semibold text-[#5c4e45] w-44">Feature</th>
                    {enrichedList.map((cafe) => {
                      const sourceMeta = getCafeSourceMeta(cafe);
                      return (
                        <th key={cafe.id} className="py-3 px-3 min-w-[200px] align-top">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${sourceMeta.badgeClass}`}
                              >
                                {sourceMeta.label}
                              </span>
                              <div>
                                <Link
                                  to={`/locations/${cafe.slug}`}
                                  onClick={() => setCompareModalOpen(false)}
                                  className="font-serif-display text-base font-bold text-[#1c1613] hover:text-[#b45309]"
                                >
                                  {cafe.name}
                                </Link>
                              </div>
                              <p className="text-xs font-normal text-[#5c4e45]">
                                {cafe.area}
                                {cafe.category ? ` · ${cafe.category}` : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCompareCafe(cafe.id)}
                              aria-label={`Remove ${cafe.name}`}
                              className="p-1.5 rounded-lg text-[#5c4e45] hover:text-[#b91c1c]"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6ddd0] text-[#1c1613]">
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#5c4e45]">Distance &amp; Rating</td>
                    {enrichedList.map((c) => {
                      const distLabel = formatDistanceKm(c.distanceKm);
                      return (
                        <td key={c.id} className="py-3 px-3 font-medium">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-[#d97706] fill-[#d97706]" aria-hidden="true" />
                              {c.rating !== null ? c.rating.toFixed(1) : 'Not rated'}
                              {c.rating_count !== null ? ` (${c.rating_count})` : ''}
                            </span>
                            {distLabel && (
                              <span className="inline-flex items-center gap-1 text-xs text-[#1b4d3e] font-mono-data">
                                <Navigation className="w-3 h-3" aria-hidden="true" />
                                {distLabel}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#5c4e45]">Facilities &amp; Wi-Fi</td>
                    {enrichedList.map((c) => {
                      const wifiOk = c.access?.unlockedSections?.wifi_details ?? isSubscribed;
                      const sockOk = c.access?.unlockedSections?.power_sockets ?? isSubscribed;
                      return (
                        <td key={c.id} className="py-3 px-3 font-medium">
                          {!wifiOk || !sockOk
                            ? 'Subscribers only'
                            : `${
                                c.wifi_mbps !== null
                                  ? `${c.wifi_mbps} Mbps`
                                  : c.wifi_available === 'yes'
                                  ? 'Wi-Fi yes'
                                  : 'Wi-Fi not verified'
                              } · ${
                                c.sockets_count !== null
                                  ? `${c.sockets_count} sockets`
                                  : c.charging_sockets === 'yes' || c.sockets_claimed
                                  ? 'Plugs available'
                                  : 'Plugs not verified'
                              }`}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#5c4e45]">Workspace Suitability</td>
                    {enrichedList.map((c) => {
                      const ok = c.access?.unlockedSections?.workspace_details ?? isSubscribed;
                      return (
                        <td key={c.id} className="py-3 px-3">
                          {!ok
                            ? 'Subscribers only'
                            : `${getNoiseSummary(c.noise_level) ?? 'Noise not verified'} · ${
                                c.laptop_friendly ? 'Laptop-friendly' : 'Suitability not verified'
                              }`}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#5c4e45]">Price &amp; Beverages</td>
                    {enrichedList.map((c) => {
                      const ok = c.access?.unlockedSections?.menu_pricing ?? isSubscribed;
                      return (
                        <td key={c.id} className="py-3 px-3 space-y-0.5 text-xs">
                          {!ok ? (
                            <span className="text-[#b45309] font-medium">Subscribers only</span>
                          ) : (
                            <>
                              <div className="font-mono-data font-semibold text-sm">
                                {c.avg_cost_per_person !== null
                                  ? `₹${c.avg_cost_per_person} avg`
                                  : c.price_range || 'Not available'}
                              </div>
                              {c.coffee_price && <div>Coffee: {c.coffee_price}</div>}
                              {c.tea_price && <div>Tea: {c.tea_price}</div>}
                              {c.snacks_price && <div>Snacks: {c.snacks_price}</div>}
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#5c4e45]">Opening Hours &amp; Maps</td>
                    {enrichedList.map((c) => {
                      const dirUrl = buildGoogleMapsDirectionsUrl(c);
                      return (
                        <td key={c.id} className="py-3 px-3 space-y-1">
                          <p className="text-xs text-[#5c4e45]">{c.timings || 'Hours not available'}</p>
                          {dirUrl ? (
                            <a
                              href={dirUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#b45309] hover:underline"
                            >
                              <span>Directions</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-[#8c7a6b]">Directions unavailable</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, GitCompareArrows, Trash2, X } from 'lucide-react';
import { getNoiseSummary } from '../config/constants';
import { useAuth } from '../context/AuthContext';

export function CompareCafesDrawer() {
  const { pathname } = useLocation();
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

  const isDetailRoute = /^\/(?:locations|cafe)\/[^/]+/.test(pathname);

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
              Comparing {compareList.length} {compareList.length === 1 ? 'cafe' : 'cafes'}
            </p>
            <p className="text-[11px] text-[#d6cbba] truncate">
              {compareList.map((c) => c.name).join(' vs ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCompareModalOpen(true)}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors"
          >
            Compare
          </button>
          <button
            type="button"
            onClick={clearCompare}
            aria-label="Clear comparison tray"
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Side-by-Side Comparison Modal */}
      {compareModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Compare cafes side by side"
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
                  Cafe Desk Plus Comparison
                </p>
                <h2 className="font-serif-display text-xl sm:text-2xl font-bold">
                  Side-by-Side Cafe Specs
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
              {compareList.map((c) => {
                const wifiOk = c.access?.unlockedSections?.wifi_details ?? isSubscribed;
                const socketsOk = c.access?.unlockedSections?.power_sockets ?? isSubscribed;
                const workOk = c.access?.unlockedSections?.workspace_details ?? isSubscribed;
                const priceOk = c.access?.unlockedSections?.menu_pricing ?? isSubscribed;
                return (
                  <article
                    key={c.id}
                    className="rounded-2xl bg-white border border-[#e6ddd0] p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to={`/locations/${c.slug}`}
                          onClick={() => setCompareModalOpen(false)}
                          className="font-serif-display text-lg font-bold text-[#1c1613] hover:text-[#b45309]"
                        >
                          {c.name}
                        </Link>
                        <p className="text-xs text-[#5c4e45]">{c.area}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCompareCafe(c.id)}
                        aria-label={`Remove ${c.name}`}
                        className="w-9 h-9 rounded-lg border border-[#e6ddd0] bg-[#faf7f2] text-[#5c4e45] hover:text-[#b91c1c] flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
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
                        <p className="text-[10px] font-semibold uppercase text-[#5c4e45]">Sockets</p>
                        <p className="font-semibold mt-0.5">
                          {!socketsOk
                            ? 'Subscribers only'
                            : c.sockets_count !== null
                            ? `${c.sockets_count} sockets`
                            : c.charging_sockets === 'yes' || c.sockets_claimed
                            ? 'Available'
                            : 'Not verified'}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0]">
                        <p className="text-[10px] font-semibold uppercase text-[#5c4e45]">Noise</p>
                        <p className="font-semibold mt-0.5">
                          {!workOk
                            ? 'Subscribers only'
                            : getNoiseSummary(c.noise_level) ?? 'Not measured'}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0]">
                        <p className="text-[10px] font-semibold uppercase text-[#5c4e45]">
                          Avg Budget
                        </p>
                        <p className="font-mono-data font-bold mt-0.5">
                          {!priceOk
                            ? 'Subscribers only'
                            : c.avg_cost_per_person !== null
                            ? `₹${c.avg_cost_per_person}`
                            : c.price_range || 'Not verified'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                      <span className="text-[#5c4e45] truncate">{c.timings}</span>
                      {c.map_link && (
                        <a
                          href={c.map_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl bg-[#b45309] text-white font-semibold shrink-0"
                        >
                          <span>Directions</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
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
                    <th className="py-3 pr-4 font-semibold text-[#5c4e45] w-40">Feature</th>
                    {compareList.map((cafe) => (
                      <th key={cafe.id} className="py-3 px-3 min-w-[180px] align-top">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link
                              to={`/locations/${cafe.slug}`}
                              onClick={() => setCompareModalOpen(false)}
                              className="font-serif-display text-base font-bold text-[#1c1613] hover:text-[#b45309]"
                            >
                              {cafe.name}
                            </Link>
                            <p className="text-xs font-normal text-[#5c4e45]">{cafe.area}</p>
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
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6ddd0] text-[#1c1613]">
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#5c4e45]">Wi-Fi &amp; Speed</td>
                    {compareList.map((c) => {
                      const ok = c.access?.unlockedSections?.wifi_details ?? isSubscribed;
                      return (
                        <td key={c.id} className="py-3 px-3 font-medium">
                          {!ok
                            ? 'Subscribers only'
                            : c.wifi_mbps !== null
                            ? `Yes · ${c.wifi_mbps} Mbps`
                            : c.wifi_available === 'yes'
                            ? 'Yes · Not verified'
                            : 'Not verified'}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#5c4e45]">Charging Sockets</td>
                    {compareList.map((c) => {
                      const ok = c.access?.unlockedSections?.power_sockets ?? isSubscribed;
                      return (
                        <td key={c.id} className="py-3 px-3 font-medium">
                          {!ok
                            ? 'Subscribers only'
                            : c.sockets_count !== null
                            ? `${c.sockets_count} sockets`
                            : c.charging_sockets === 'yes' || c.sockets_claimed
                            ? 'Available'
                            : 'Not verified'}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#5c4e45]">Noise &amp; Laptop</td>
                    {compareList.map((c) => {
                      const ok = c.access?.unlockedSections?.workspace_details ?? isSubscribed;
                      return (
                        <td key={c.id} className="py-3 px-3">
                          {!ok
                            ? 'Subscribers only'
                            : `${getNoiseSummary(c.noise_level) ?? 'Not measured'} · ${
                                c.laptop_friendly ? 'Laptop-friendly' : 'Casual'
                              }`}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#5c4e45]">Avg Budget / Person</td>
                    {compareList.map((c) => {
                      const ok = c.access?.unlockedSections?.menu_pricing ?? isSubscribed;
                      return (
                        <td key={c.id} className="py-3 px-3 font-mono-data font-semibold">
                          {!ok
                            ? 'Subscribers only'
                            : c.avg_cost_per_person !== null
                            ? `₹${c.avg_cost_per_person}`
                            : c.price_range || 'Not verified'}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#5c4e45]">Coffee / Tea / Snacks</td>
                    {compareList.map((c) => {
                      const ok = c.access?.unlockedSections?.menu_pricing ?? isSubscribed;
                      return (
                        <td key={c.id} className="py-3 px-3 space-y-0.5 text-xs">
                          {!ok ? (
                            <span className="text-[#b45309] font-medium">Subscribers only</span>
                          ) : (
                            <>
                              {c.coffee_price && <div>Coffee: {c.coffee_price}</div>}
                              {c.tea_price && <div>Tea: {c.tea_price}</div>}
                              {c.snacks_price && <div>Snacks: {c.snacks_price}</div>}
                              {!c.coffee_price && !c.tea_price && !c.snacks_price && (
                                <span className="text-[#5c4e45]">Not verified</span>
                              )}
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-[#5c4e45]">Timings &amp; Maps</td>
                    {compareList.map((c) => (
                      <td key={c.id} className="py-3 px-3 space-y-1">
                        <p className="text-xs text-[#5c4e45]">{c.timings}</p>
                        <a
                          href={c.map_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#b45309] hover:underline"
                        >
                          <span>Directions</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      </td>
                    ))}
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

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, GitCompareArrows, Trash2, X } from 'lucide-react';
import { getNoiseSummary } from '../config/constants';
import { useAuth } from '../context/AuthContext';

export function CompareCafesDrawer() {
  const {
    hasPlus,
    compareList,
    compareModalOpen,
    setCompareModalOpen,
    removeCompareCafe,
    clearCompare,
  } = useAuth();

  if (!hasPlus || compareList.length === 0) return null;

  return (
    <>
      {/* Sticky Bottom Tray */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl rounded-2xl bg-[#1c1613] text-[#faf7f2] border border-[#3a2f2a] shadow-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <GitCompareArrows className="w-4 h-4 text-[#f59e0b] shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-white">
              Comparing {compareList.length} {compareList.length === 1 ? 'cafe' : 'cafes'}
            </p>
            <p className="text-[11px] text-[#faf7f2]/75 truncate">
              {compareList.map((c) => c.name).join(' vs ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCompareModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors"
          >
            Compare Side-by-Side
          </button>
          <button
            type="button"
            onClick={clearCompare}
            aria-label="Clear comparison tray"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Side-by-Side Comparison Modal */}
      {compareModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Compare cafes side by side"
          className="fixed inset-0 z-50 bg-[#1c1613]/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setCompareModalOpen(false)}
        >
          <div
            className="w-full max-w-5xl max-h-[88vh] overflow-auto rounded-2xl bg-[#faf7f2] border border-[#e6ddd0] shadow-2xl text-[#1c1613]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 p-5 bg-[#1c1613] text-white flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#f59e0b]">
                  Cafe Desk Plus Comparison
                </p>
                <h2 className="font-serif-display text-2xl font-bold">
                  Side-by-Side Cafe Specs
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCompareModalOpen(false)}
                aria-label="Close comparison"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-x-auto">
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
                            className="p-1 text-[#5c4e45] hover:text-[#991b1b]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6ddd0]">
                  <tr>
                    <td className="py-3 pr-4 font-semibold text-[#5c4e45]">Wi-Fi &amp; Speed</td>
                    {compareList.map((c) => (
                      <td key={c.id} className="py-3 px-3 font-medium">
                        {c.wifi_mbps !== null
                          ? `Yes · ${c.wifi_mbps} Mbps`
                          : c.wifi_available === 'yes'
                          ? 'Yes · Not verified'
                          : 'Not verified'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-semibold text-[#5c4e45]">Charging Sockets</td>
                    {compareList.map((c) => (
                      <td key={c.id} className="py-3 px-3 font-medium">
                        {c.sockets_count !== null
                          ? `${c.sockets_count} sockets`
                          : c.charging_sockets === 'yes' || c.sockets_claimed
                          ? 'Available'
                          : 'Not verified'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-semibold text-[#5c4e45]">Noise &amp; Laptop</td>
                    {compareList.map((c) => (
                      <td key={c.id} className="py-3 px-3">
                        {getNoiseSummary(c.noise_level) ?? 'Not measured'} ·{' '}
                        {c.laptop_friendly ? 'Laptop-friendly' : 'Casual'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-semibold text-[#5c4e45]">Avg Budget / Person</td>
                    {compareList.map((c) => (
                      <td key={c.id} className="py-3 px-3 font-mono-data font-bold">
                        {c.avg_cost_per_person !== null
                          ? `₹${c.avg_cost_per_person}`
                          : c.price_range || 'Not verified'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-semibold text-[#5c4e45]">Coffee / Tea / Snacks</td>
                    {compareList.map((c) => (
                      <td key={c.id} className="py-3 px-3 space-y-0.5 text-xs">
                        {c.coffee_price && <div>Coffee: {c.coffee_price}</div>}
                        {c.tea_price && <div>Tea: {c.tea_price}</div>}
                        {c.snacks_price && <div>Snacks: {c.snacks_price}</div>}
                        {!c.coffee_price && !c.tea_price && !c.snacks_price && (
                          <span className="text-[#5c4e45]">Not verified</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-semibold text-[#5c4e45]">Timings &amp; Maps</td>
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

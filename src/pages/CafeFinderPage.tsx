import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Briefcase,
  Coffee,
  Compass,
  Heart,
  IndianRupee,
  Laptop,
  LocateFixed,
  Lock,
  Map as MapIcon,
  Plug,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Users,
  Utensils,
  Volume2,
  Wifi,
} from 'lucide-react';
import { BENGALURU_AREAS } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import { useDiscovery } from '../context/DiscoveryContext';
import { getCafeDetailRoute, useDocumentMeta } from '../utils/cafeHelpers';
import {
  isHiddenGem,
  isOutdoorFriendly,
  scoreCafeMatch,
  type FinderAtmosphere,
  type FinderBudgetFilter,
  type FinderPreferences,
  type FinderPurpose,
} from '../utils/cafeRecommendations';
import { LocationCard } from '../components/LocationCard';

const DEFAULT_PREFS: FinderPreferences = {
  purpose: 'all',
  area: '',
  nearMeOnly: false,
  budget: 'any',
  atmosphere: 'any',
  laptopFriendly: false,
  wifiRequired: false,
  chargingSockets: false,
  outdoorSeating: false,
};

const PURPOSE_OPTIONS: Array<{
  id: FinderPurpose;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'all', label: 'Anything', icon: Sparkles },
  { id: 'working', label: 'Remote Work', icon: Briefcase },
  { id: 'studying', label: 'Studying', icon: BookOpen },
  { id: 'meeting', label: 'Meetings', icon: Users },
  { id: 'relaxing', label: 'Relaxing', icon: Sun },
  { id: 'date', label: 'Coffee Date', icon: Heart },
  { id: 'coffee', label: 'Great Coffee', icon: Coffee },
  { id: 'food', label: 'Food & Bakery', icon: Utensils },
];

export function CafeFinderPage() {
  const { locations, settings } = useCms();
  const { authenticated, hasPlus, hasPermission, openUpgradeModal } = useAuth();
  const canFilterPricing =
    settings.access_control?.sections?.menu_pricing === 'public' ||
    hasPermission('menu_pricing');
  const canFilterWifi =
    settings.access_control?.sections?.wifi_details === 'public' ||
    hasPermission('wifi_details');
  const canFilterSockets =
    settings.access_control?.sections?.power_sockets === 'public' ||
    hasPermission('power_sockets');
  const canFilterWorkspace =
    settings.access_control?.sections?.workspace_details === 'public' ||
    hasPermission('workspace_details');
  const { userLocation, geoStatus, requestUserLocation, getEffectiveLocation } = useDiscovery();

  useDocumentMeta(
    `Interactive Cafe Finder – ${settings.brand_name}`,
    'Answer a few quick preferences to discover your best-matched Bengaluru cafe for work, study, dates, or affordable coffee.',
    {
      ogImage: settings.seo_og_image,
      allowIndexing: settings.seo_allow_indexing,
    }
  );

  const [prefs, setPrefs] = useState<FinderPreferences>(DEFAULT_PREFS);
  const [hiddenGemsOnly, setHiddenGemsOnly] = useState(false);

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

  const handleToggleNearMe = async () => {
    if (prefs.nearMeOnly) {
      setPrefs((p) => ({ ...p, nearMeOnly: false }));
      return;
    }
    const point = userLocation ?? (await requestUserLocation());
    if (point) {
      setPrefs((p) => ({ ...p, nearMeOnly: true }));
    }
  };

  const applyPreset = (presetId: string) => {
    setHiddenGemsOnly(false);
    if (presetId === 'deep-work') {
      setPrefs({
        ...DEFAULT_PREFS,
        purpose: 'working',
        atmosphere: canFilterWorkspace ? 'quiet' : 'any',
        laptopFriendly: canFilterWorkspace,
        chargingSockets: canFilterSockets,
        wifiRequired: canFilterWifi,
      });
    } else if (presetId === 'quiet-study') {
      setPrefs({
        ...DEFAULT_PREFS,
        purpose: 'studying',
        atmosphere: canFilterWorkspace ? 'quiet' : 'any',
        laptopFriendly: canFilterWorkspace,
        chargingSockets: canFilterSockets,
      });
    } else if (presetId === 'coffee-date') {
      setPrefs({
        ...DEFAULT_PREFS,
        purpose: 'date',
        atmosphere: 'any',
      });
    } else if (presetId === 'budget-under-200') {
      if (!canFilterPricing) {
        openUpgradeModal({
          featureName: 'Budget Matching Filter (Under ₹200)',
          requiredPlan: 'plus',
          description:
            'Filter cafes by average spend per person and compare full tea, coffee, and food prices with an active subscription.',
        });
        return;
      }
      setPrefs({
        ...DEFAULT_PREFS,
        budget: 'under-200',
      });
    } else if (presetId === 'hidden-gems') {
      setPrefs(DEFAULT_PREFS);
      setHiddenGemsOnly(true);
    } else if (presetId === 'outdoor-breeze') {
      setPrefs({
        ...DEFAULT_PREFS,
        purpose: 'relaxing',
        outdoorSeating: true,
      });
    }
  };

  const rankedMatches = useMemo(() => {
    let pool = effectiveLocations;

    if (hiddenGemsOnly) {
      const gems = pool.filter((l) => isHiddenGem(l));
      if (gems.length > 0) pool = gems;
    }

    if (prefs.area) {
      const areaMatches = pool.filter((l) =>
        `${l.area} ${l.address}`.toLowerCase().includes(prefs.area.toLowerCase())
      );
      if (areaMatches.length > 0) pool = areaMatches;
    }

    if (prefs.outdoorSeating) {
      const outdoor = pool.filter((l) => isOutdoorFriendly(l));
      if (outdoor.length > 0) pool = outdoor;
    }

    const scored = pool.map((loc) => scoreCafeMatch(loc, prefs, hasPlus && canFilterWifi));
    return scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (prefs.nearMeOnly && userLocation) {
        return (
          (a.location.distanceKm ?? Number.MAX_SAFE_INTEGER) -
          (b.location.distanceKm ?? Number.MAX_SAFE_INTEGER)
        );
      }
      return (b.location.rating ?? 0) - (a.location.rating ?? 0);
    });
  }, [effectiveLocations, prefs, hiddenGemsOnly, hasPlus, canFilterWifi, userLocation]);

  const topPick = rankedMatches[0] ?? null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#e6ddd0] pb-6">
        <div className="space-y-2.5 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] font-semibold text-[#1b4d3e]">
            <Compass className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Interactive Recommendation Engine</span>
          </span>
          <h1 className="font-serif-display text-3xl sm:text-5xl font-semibold text-[#1c1613] leading-tight">
            Find your ideal Bengaluru cafe in seconds
          </h1>
          <p className="text-sm sm:text-base text-[#57493f] leading-relaxed">
            Pick what you are visiting for, your neighbourhood, seating vibe, and power needs — we
            rank curated Bengaluru cafes with transparent match reasons.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setPrefs(DEFAULT_PREFS);
              setHiddenGemsOnly(false);
            }}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-white border border-[#d6cbba] text-xs font-semibold text-[#1c1613] hover:bg-[#faf7f2] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset Finder</span>
          </button>
          <Link
            to="/locations?view=map"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors"
          >
            <MapIcon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Open Map Explorer</span>
          </Link>
        </div>
      </header>

      {/* Quick Presets */}
      <section aria-label="Quick finder presets" className="space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#57493f]">
          1-Click Quick Scenarios
        </p>
        <div className="flex flex-wrap gap-2.5">
          {[
            { id: 'deep-work', label: 'Deep Work & Sockets' },
            { id: 'quiet-study', label: 'Quiet Study' },
            { id: 'coffee-date', label: 'Coffee Date' },
            { id: 'budget-under-200', label: canFilterPricing ? 'Budget Under ₹200' : 'Budget Under ₹200 (Plus)' },
            { id: 'hidden-gems', label: 'Hidden Gems' },
            { id: 'outdoor-breeze', label: 'Outdoor Seating' },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-full bg-white border border-[#d6cbba] hover:border-[#b45309] hover:bg-[#faf7f2] text-xs font-semibold text-[#1c1613] transition-colors shrink-0 snap-start whitespace-nowrap"
            >
              {preset.id === 'budget-under-200' && !canFilterPricing && (
                <Lock className="w-3 h-3 text-[#b45309]" aria-hidden="true" />
              )}
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Preference Builder */}
      <section
        aria-label="Cafe preference controls"
        className="rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-6 space-y-6 shadow-xs"
      >
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#57493f]">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
            <span>1. What are you visiting for?</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {PURPOSE_OPTIONS.map(({ id, label, icon: Icon }) => {
              const active = prefs.purpose === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, purpose: id }))}
                  className={`flex flex-col items-center justify-center gap-1.5 min-h-[68px] px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#1c1613] text-[#faf7f2] border-[#1c1613]'
                      : 'bg-[#faf7f2] text-[#1c1613] border-[#e6ddd0] hover:border-[#b45309] hover:bg-white'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${active ? 'text-[#f59e0b]' : 'text-[#b45309]'}`}
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-[#e6ddd0]">
          {/* Locality */}
          <div>
            <label
              htmlFor="finder-area"
              className="block text-xs font-semibold text-[#57493f] mb-1.5"
            >
              2. Preferred Locality
            </label>
            <select
              id="finder-area"
              value={prefs.area}
              onChange={(e) => setPrefs((p) => ({ ...p, area: e.target.value }))}
              className="w-full h-11 px-3 rounded-lg bg-[#faf7f2] border border-[#d6cbba] text-sm font-medium text-[#1c1613] focus:outline-none focus:border-[#b45309]"
            >
              <option value="">All Bengaluru Areas</option>
              {areaOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Near Me GPS */}
          <div>
            <span className="block text-xs font-semibold text-[#57493f] mb-1.5">
              3. Distance Priority
            </span>
            <button
              type="button"
              onClick={() => void handleToggleNearMe()}
              disabled={geoStatus === 'requesting'}
              className={`w-full h-11 px-3.5 rounded-lg border text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                prefs.nearMeOnly
                  ? 'bg-[#1b4d3e] border-[#1b4d3e] text-white'
                  : 'bg-[#faf7f2] border-[#d6cbba] text-[#1c1613] hover:border-[#b45309]'
              }`}
            >
              <LocateFixed className="w-4 h-4" aria-hidden="true" />
              <span>
                {geoStatus === 'requesting'
                  ? 'Locating...'
                  : prefs.nearMeOnly
                  ? 'Near Me Active'
                  : 'Prioritize Closest to Me'}
              </span>
            </button>
          </div>

          {/* Atmosphere */}
          <div>
            <label
              htmlFor="finder-atmosphere"
              className="flex items-center gap-1.5 text-xs font-semibold text-[#57493f] mb-1.5"
            >
              <Volume2 className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
              <span>4. Atmosphere &amp; Noise</span>
            </label>
            <select
              id="finder-atmosphere"
              value={prefs.atmosphere}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, atmosphere: e.target.value as FinderAtmosphere }))
              }
              className="w-full h-11 px-3 rounded-lg bg-[#faf7f2] border border-[#d6cbba] text-sm font-medium text-[#1c1613] focus:outline-none focus:border-[#b45309]"
            >
              <option value="any">Any noise level</option>
              <option value="quiet">Quiet &amp; Peaceful (Focus / Reading)</option>
              <option value="lively">Lively &amp; Social (Chatter / Catchups)</option>
            </select>
          </div>

          {/* Budget */}
          <div>
            <label
              htmlFor="finder-budget"
              className="flex items-center justify-between text-xs font-semibold text-[#57493f] mb-1.5"
            >
              <span className="inline-flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-[#1b4d3e]" aria-hidden="true" />
                <span>5. Typical Budget</span>
              </span>
              {!canFilterPricing && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#b45309]">
                  <Lock className="w-3 h-3" aria-hidden="true" />
                  Subscribers
                </span>
              )}
            </label>
            <select
              id="finder-budget"
              value={canFilterPricing ? prefs.budget : 'any'}
              onChange={(e) => {
                if (!canFilterPricing) {
                  openUpgradeModal({
                    featureName: 'Budget Matching Filter',
                    requiredPlan: 'plus',
                    description:
                      'Filter cafes by average spend per person and compare food & beverage menus with an active Cafe Desk subscription.',
                  });
                  return;
                }
                setPrefs((p) => ({ ...p, budget: e.target.value as FinderBudgetFilter }));
              }}
              className="w-full h-11 px-3 rounded-lg bg-[#faf7f2] border border-[#d6cbba] text-sm font-medium text-[#1c1613] focus:outline-none focus:border-[#b45309]"
            >
              <option value="any">Any budget</option>
              <option value="under-200">{canFilterPricing ? 'Under ₹200 / person' : '🔒 Under ₹200 (Subscribers)'}</option>
              <option value="200-350">{canFilterPricing ? '₹200 – ₹350 / person' : '🔒 ₹200 – ₹350 (Subscribers)'}</option>
              <option value="350-plus">{canFilterPricing ? '₹350+ / Specialty dining' : '🔒 ₹350+ (Subscribers)'}</option>
            </select>
          </div>
        </div>

        {/* Workspace & Seating Pill Toggles */}
        <div className="pt-4 border-t border-[#e6ddd0] flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (!canFilterWorkspace) {
                openUpgradeModal({ featureName: 'Workspace Seating Filters', requiredPlan: 'plus' });
                return;
              }
              setPrefs((p) => ({ ...p, laptopFriendly: !p.laptopFriendly }));
            }}
            className={`inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full border text-xs font-semibold transition-colors ${
              canFilterWorkspace && prefs.laptopFriendly
                ? 'bg-[#1c1613] text-[#faf7f2] border-[#1c1613]'
                : 'bg-[#faf7f2] text-[#1c1613] border-[#d6cbba] hover:border-[#b45309]'
            }`}
          >
            <Laptop className="w-4 h-4" aria-hidden="true" />
            <span>Laptop-friendly</span>
            {!canFilterWorkspace && <Lock className="w-3 h-3" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!canFilterSockets) {
                openUpgradeModal({ featureName: 'Power Socket Filter', requiredPlan: 'plus' });
                return;
              }
              setPrefs((p) => ({ ...p, chargingSockets: !p.chargingSockets }));
            }}
            className={`inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full border text-xs font-semibold transition-colors ${
              canFilterSockets && prefs.chargingSockets
                ? 'bg-[#1b4d3e] text-white border-[#1b4d3e]'
                : 'bg-[#faf7f2] text-[#1c1613] border-[#d6cbba] hover:border-[#b45309]'
            }`}
          >
            <Plug className="w-4 h-4" aria-hidden="true" />
            <span>Charging sockets</span>
            {!canFilterSockets && <Lock className="w-3 h-3" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={() => setPrefs((p) => ({ ...p, outdoorSeating: !p.outdoorSeating }))}
            className={`inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full border text-xs font-semibold transition-colors ${
              prefs.outdoorSeating
                ? 'bg-[#b45309] text-white border-[#b45309]'
                : 'bg-[#faf7f2] text-[#1c1613] border-[#d6cbba] hover:border-[#b45309]'
            }`}
          >
            <Sun className="w-4 h-4" aria-hidden="true" />
            <span>Outdoor / garden</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!canFilterWifi) {
                openUpgradeModal({
                  featureName: 'Wi-Fi Availability & Speed Filter',
                  requiredPlan: 'plus',
                  description:
                    'Filter cafes by verified customer Wi-Fi availability and measured Mbps speeds with an active subscription.',
                });
                return;
              }
              setPrefs((p) => ({ ...p, wifiRequired: !p.wifiRequired }));
            }}
            className={`inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full border text-xs font-semibold transition-colors ${
              canFilterWifi && prefs.wifiRequired
                ? 'bg-[#1b4d3e] text-white border-[#1b4d3e]'
                : 'bg-[#faf7f2] text-[#1c1613] border-[#d6cbba] hover:border-[#b45309]'
            }`}
          >
            <Wifi className="w-4 h-4" aria-hidden="true" />
            <span>Wi-Fi required</span>
            {!canFilterWifi && <Lock className="w-3 h-3" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={() => setHiddenGemsOnly((v) => !v)}
            className={`inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full border text-xs font-semibold transition-colors ${
              hiddenGemsOnly
                ? 'bg-[#b45309] text-white border-[#b45309]'
                : 'bg-[#faf7f2] text-[#1c1613] border-[#d6cbba] hover:border-[#b45309]'
            }`}
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>Hidden gems only</span>
          </button>
        </div>
      </section>

      {/* Top Match Summary Banner */}
      {topPick && (
        <div className="rounded-2xl bg-[#1c1613] text-[#faf7f2] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#3a2f28]">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] font-semibold text-[#f59e0b]">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Top Recommended Match · {topPick.score}% Fit</span>
            </span>
            <h2 className="font-serif-display text-2xl sm:text-3xl font-semibold text-white">
              {topPick.location.name} ({topPick.location.area})
            </h2>
            <p className="text-xs sm:text-sm text-[#e6ddd0]">
              {topPick.reasons.length > 0
                ? topPick.reasons.join(' · ')
                : topPick.location.verdict || topPick.location.description}
            </p>
          </div>
          <Link
            to={getCafeDetailRoute(topPick.location.slug, authenticated)}
            className="inline-flex items-center justify-center shrink-0 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs sm:text-sm font-semibold transition-colors"
          >
            Explore {topPick.location.name} &rarr;
          </Link>
        </div>
      )}

      {/* Ranked Results Grid */}
      <section aria-label="Matched cafes" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#57493f]">
          <p>
            Showing top{' '}
            <strong className="font-mono-data text-[#1c1613]">
              {Math.min(18, rankedMatches.length)}
            </strong>{' '}
            of{' '}
            <strong className="font-mono-data text-[#1c1613]">
              {rankedMatches.length}
            </strong>{' '}
            ranked Bengaluru cafes
          </p>
          <Link
            to="/locations"
            className="text-xs font-semibold text-[#b45309] hover:text-[#92400e] hover:underline"
          >
            Switch to full directory + live Google search &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rankedMatches.slice(0, 18).map((result) => (
            <LocationCard
              key={result.location.id}
              location={result.location}
              matchScore={result.score}
              matchReasons={result.reasons}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

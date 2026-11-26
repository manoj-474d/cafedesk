import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  GitMerge,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  XCircle,
} from 'lucide-react';
import {
  BENGALURU_AREAS,
  CORRECTION_ISSUE_TYPES,
  DISCOVERY_CATEGORY_TABS,
  SUPPORTED_CITIES,
} from '../../config/constants';
import type {
  CommunityCorrectionRecord,
  LocationItem,
  PlacesApiUsageSummary,
} from '../../types/cms';
import { getCafeSourceMeta } from '../../utils/cafeHelpers';

interface AdminDiscoveryTabProps {
  csrfToken: string;
  locations: LocationItem[];
  onRefreshLocations: () => Promise<void>;
  onCorrectionsChanged?: () => Promise<void>;
}

interface AdminPlaceSearchItem {
  id: string;
  placeId: string;
  name: string;
  areaLabel: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  ratingCount: number | null;
  websiteUrl: string;
  mapLink: string;
  viewMapUrl: string;
  phone: string;
  photos: string[];
  openingHours: string[];
  priceLevelLabel: string;
  primaryType: string;
  types: string[];
  categoryLabel: string;
  alreadyImported: boolean;
}

const ISSUE_LABEL_MAP = new Map<string, string>(
  CORRECTION_ISSUE_TYPES.map((item) => [item.id, item.label])
);

export function AdminDiscoveryTab({
  csrfToken,
  locations,
  onRefreshLocations,
  onCorrectionsChanged,
}: AdminDiscoveryTabProps) {
  // 1. Places API Diagnostics State
  const [usage, setUsage] = useState<PlacesApiUsageSummary | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // 2. Live Google Places Search & Import State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLocality, setSearchLocality] = useState('Indiranagar');
  const [searchCity, setSearchCity] = useState('Bengaluru');
  const [searchCategory, setSearchCategory] = useState('all');
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [searchResults, setSearchResults] = useState<AdminPlaceSearchItem[]>([]);
  const [lastQueryText, setLastQueryText] = useState('');
  const [searchError, setSearchError] = useState('');
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState('');

  // 3. Community Corrections State
  const [corrections, setCorrections] = useState<CommunityCorrectionRecord[]>([]);
  const [loadingCorrections, setLoadingCorrections] = useState(false);
  const [correctionFilter, setCorrectionFilter] = useState<
    'pending' | 'approved' | 'resolved' | 'rejected' | 'all'
  >('pending');
  const [adminNotesById, setAdminNotesById] = useState<Record<number, string>>({});
  const [moderatingId, setModeratingId] = useState<number | null>(null);
  const [moderationMsg, setModerationMsg] = useState('');

  // 4. Duplicate Merger State
  const [primaryId, setPrimaryId] = useState('');
  const [duplicateId, setDuplicateId] = useState('');
  const [merging, setMerging] = useState(false);
  const [mergeFeedback, setMergeFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const loadUsage = useCallback(async () => {
    setLoadingUsage(true);
    try {
      const res = await fetch('/api/admin/places/usage', { credentials: 'include' });
      if (res.ok) {
        setUsage((await res.json()) as PlacesApiUsageSummary);
      }
    } finally {
      setLoadingUsage(false);
    }
  }, []);

  const loadCorrections = useCallback(async () => {
    setLoadingCorrections(true);
    try {
      const res = await fetch('/api/admin/corrections', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { corrections?: CommunityCorrectionRecord[] };
        if (Array.isArray(data.corrections)) {
          setCorrections(data.corrections);
        }
      }
    } finally {
      setLoadingCorrections(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadUsage(), loadCorrections()]);
  }, [loadUsage, loadCorrections]);

  const handlePlacesSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchingPlaces(true);
    setSearchError('');
    setImportMessage('');
    try {
      const res = await fetch('/api/admin/places/search', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          query: searchQuery,
          locality: searchLocality,
          city: searchCity,
          category: searchCategory,
        }),
      });
      const data = (await res.json()) as {
        places?: AdminPlaceSearchItem[];
        textQuery?: string;
        error?: string;
      };
      if (!res.ok) {
        setSearchError(data.error || 'Could not search Google Places.');
        return;
      }
      setSearchResults(Array.isArray(data.places) ? data.places : []);
      setLastQueryText(data.textQuery || '');
      void loadUsage();
    } catch {
      setSearchError('Network error contacting Places search endpoint.');
    } finally {
      setSearchingPlaces(false);
    }
  };

  const handleImportPlace = async (place: AdminPlaceSearchItem, verified: boolean) => {
    setImportingId(place.placeId);
    setImportMessage('');
    setSearchError('');
    try {
      const res = await fetch('/api/admin/places/import', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          place,
          city: searchCity || 'Bengaluru',
          category: place.categoryLabel || 'Cafe',
          published: true,
          verified,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setSearchError(data.error || `Failed to import ${place.name}.`);
        return;
      }
      setSearchResults((prev) =>
        prev.map((item) =>
          item.placeId === place.placeId ? { ...item, alreadyImported: true } : item
        )
      );
      setImportMessage(
        verified
          ? `Imported "${place.name}" as CafeDesk Verified listing.`
          : `Imported "${place.name}" as Google Places Discovery listing.`
      );
      await onRefreshLocations();
    } catch {
      setSearchError(`Network error importing ${place.name}.`);
    } finally {
      setImportingId(null);
    }
  };

  const handleModerateCorrection = async (
    item: CommunityCorrectionRecord,
    status: 'approved' | 'resolved' | 'rejected',
    applyToCafe: boolean
  ) => {
    setModeratingId(item.id);
    setModerationMsg('');
    try {
      const res = await fetch(`/api/admin/corrections/${item.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          status,
          adminNote: adminNotesById[item.id] ?? item.admin_note ?? '',
          applyToCafe,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setModerationMsg(err.error || 'Could not update report.');
        return;
      }
      setModerationMsg(
        applyToCafe
          ? `Approved & updated "${item.cafe_name}" from community report.`
          : `Marked report #${item.id} as ${status}.`
      );
      await loadCorrections();
      if (applyToCafe) {
        await onRefreshLocations();
      }
      if (onCorrectionsChanged) {
        await onCorrectionsChanged();
      }
    } finally {
      setModeratingId(null);
    }
  };

  const handleMergeCafes = async (e: React.FormEvent) => {
    e.preventDefault();
    setMergeFeedback(null);
    if (!primaryId || !duplicateId || primaryId === duplicateId) {
      setMergeFeedback({ ok: false, text: 'Select two different listings before merging.' });
      return;
    }
    setMerging(true);
    try {
      const res = await fetch('/api/admin/cafes/merge', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ primaryId, duplicateId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setMergeFeedback({ ok: false, text: data.error || 'Merge failed.' });
        return;
      }
      setMergeFeedback({
        ok: true,
        text: 'Duplicate listing merged into primary record and unpublished.',
      });
      setDuplicateId('');
      await onRefreshLocations();
    } catch {
      setMergeFeedback({ ok: false, text: 'Network error merging listings.' });
    } finally {
      setMerging(false);
    }
  };

  const pendingCount = corrections.filter((c) => c.status === 'pending').length;
  const filteredCorrections = useMemo(() => {
    if (correctionFilter === 'all') return corrections;
    return corrections.filter((c) => c.status === correctionFilter);
  }, [corrections, correctionFilter]);

  const sortedLocations = useMemo(
    () =>
      [...locations].sort((a, b) =>
        `${a.name} ${a.area}`.localeCompare(`${b.name} ${b.area}`)
      ),
    [locations]
  );

  const primaryLoc = sortedLocations.find((l) => l.id === primaryId) ?? null;
  const duplicateLoc = sortedLocations.find((l) => l.id === duplicateId) ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0f172a]">
            Google Places Discovery &amp; Community Moderation
          </h2>
          <p className="text-xs text-[#64748b]">
            Import real-world cafes, tea stalls, bakeries &amp; local eateries from Google Places API (New), monitor API cache/usage, merge duplicates, and moderate community corrections.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void Promise.all([loadUsage(), loadCorrections()])}
          className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] hover:bg-white text-xs font-semibold text-[#0f172a] shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingUsage || loadingCorrections ? 'animate-spin' : ''}`} />
          <span>Refresh Diagnostics</span>
        </button>
      </div>

      {/* 1. Google Places API Usage & Health Diagnostics */}
      <section className="bg-white p-5 rounded-xl border border-[#e2e8f0] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#16a34a]" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-[#0f172a]">
              Google Places API (New) Usage &amp; Cost Guardrails
            </h3>
          </div>
          {usage && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                usage.has_server_key
                  ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#16a34a]'
                  : 'bg-[#fef2f2] border-[#fecaca] text-[#dc2626]'
              }`}
            >
              {usage.has_server_key ? 'Server Places Key Configured' : 'Missing Places API Key'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
            <p className="text-[#64748b]">Total Calls</p>
            <p className="font-mono-data text-xl font-bold text-[#0f172a] mt-0.5 tabular-nums">
              {usage?.total_calls ?? '—'}
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
            <p className="text-[#64748b]">Calls (24h)</p>
            <p className="font-mono-data text-xl font-bold text-[#0f172a] mt-0.5 tabular-nums">
              {usage?.calls_24h ?? '—'}
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0]">
            <p className="text-[#16a34a]">Cache Hits (24h)</p>
            <p className="font-mono-data text-xl font-bold text-[#166534] mt-0.5 tabular-nums">
              {usage?.cache_hits_24h ?? '—'}
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
            <p className="text-[#64748b]">Errors (24h)</p>
            <p
              className={`font-mono-data text-xl font-bold mt-0.5 tabular-nums ${
                (usage?.errors_24h ?? 0) > 0 ? 'text-[#dc2626]' : 'text-[#0f172a]'
              }`}
            >
              {usage?.errors_24h ?? '—'}
            </p>
          </div>
        </div>

        {usage?.last_error && (
          <div className="p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-xs text-[#991b1b] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Latest API Notice:</span> {usage.last_error}
            </div>
          </div>
        )}

        {usage && usage.recent_logs.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowLogs((v) => !v)}
              className="text-xs font-semibold text-[#b45309] hover:underline"
            >
              {showLogs
                ? 'Hide recent Places API call logs'
                : `Show recent ${usage.recent_logs.length} Places API call logs`}
            </button>
            {showLogs && (
              <div className="mt-3 overflow-x-auto border border-[#e2e8f0] rounded-lg">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#475569]">
                      <th className="py-2 px-3">Endpoint</th>
                      <th className="py-2 px-3">Query</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Cache</th>
                      <th className="py-2 px-3">Results</th>
                      <th className="py-2 px-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {usage.recent_logs.slice(0, 15).map((log) => (
                      <tr key={log.id}>
                        <td className="py-2 px-3 font-mono-data text-[#0f172a]">{log.endpoint}</td>
                        <td className="py-2 px-3 text-[#475569] max-w-[240px] truncate">
                          {log.query_text}
                        </td>
                        <td
                          className={`py-2 px-3 font-mono-data font-semibold ${
                            log.status_code >= 400 ? 'text-[#dc2626]' : 'text-[#16a34a]'
                          }`}
                        >
                          {log.status_code}
                        </td>
                        <td className="py-2 px-3">{log.cached ? 'HIT' : 'LIVE'}</td>
                        <td className="py-2 px-3 font-mono-data">{log.result_count}</td>
                        <td className="py-2 px-3 font-mono-data text-[#64748b]">
                          {new Date(log.created_at).toLocaleTimeString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2. Google Places Live Search & Import */}
      <section className="bg-white p-5 rounded-xl border border-[#e2e8f0] space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-[#0f172a]">
            Search &amp; Import Real Businesses from Google Places
          </h3>
        </div>

        <form onSubmit={handlePlacesSearch} className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
          <div className="sm:col-span-4">
            <label className="block font-semibold text-[#475569] mb-1">
              Business / Keyword Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. Filter Coffee, Third Wave, Bakery..."
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block font-semibold text-[#475569] mb-1">Locality / Area</label>
            <input
              type="text"
              list="admin-places-localities"
              value={searchLocality}
              onChange={(e) => setSearchLocality(e.target.value)}
              placeholder="Indiranagar, Jayanagar..."
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
            />
            <datalist id="admin-places-localities">
              {BENGALURU_AREAS.map((area) => (
                <option key={area} value={area} />
              ))}
            </datalist>
          </div>
          <div className="sm:col-span-2">
            <label className="block font-semibold text-[#475569] mb-1">City</label>
            <input
              type="text"
              list="admin-places-cities"
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
            />
            <datalist id="admin-places-cities">
              {SUPPORTED_CITIES.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </div>
          <div className="sm:col-span-2">
            <label className="block font-semibold text-[#475569] mb-1">Category</label>
            <select
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
              className="w-full h-10 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
            >
              {DISCOVERY_CATEGORY_TABS.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-1 flex items-end">
            <button
              type="submit"
              disabled={searchingPlaces}
              className="w-full h-10 px-3 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
            >
              {searchingPlaces ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span className="sm:hidden">Search Places</span>
            </button>
          </div>
        </form>

        {lastQueryText && (
          <p className="text-[11px] text-[#64748b] font-mono-data">
            Query executed: &ldquo;{lastQueryText}&rdquo; ({searchResults.length} results)
          </p>
        )}

        {searchError && (
          <div className="p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-xs text-[#991b1b] font-semibold">
            {searchError}
          </div>
        )}

        {importMessage && (
          <div className="p-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-xs text-[#166534] font-semibold">
            {importMessage}
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {searchResults.map((place) => (
              <div
                key={place.placeId}
                className="rounded-xl border border-[#e2e8f0] p-4 bg-[#f8fafc] flex flex-col justify-between gap-3 text-xs"
              >
                <div className="flex gap-3">
                  {place.photos[0] ? (
                    <img
                      src={place.photos[0]}
                      alt={place.name}
                      className="w-20 h-20 rounded-lg object-cover border border-[#cbd5e1] shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-[#e2e8f0] text-[#64748b] flex items-center justify-center shrink-0 text-[10px] font-semibold text-center px-1">
                      No photo
                    </div>
                  )}
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-white border border-[#cbd5e1] text-[10px] font-semibold text-[#334155]">
                        {place.categoryLabel}
                      </span>
                      {place.rating !== null && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-mono-data font-semibold text-[#b45309]">
                          <Star className="w-3 h-3 fill-[#b45309]" />
                          {place.rating}
                          {place.ratingCount ? ` (${place.ratingCount})` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-[#0f172a] truncate">{place.name}</p>
                    <p className="text-[#475569] line-clamp-2">{place.address}</p>
                    <p className="font-mono-data text-[10px] text-[#64748b] truncate">
                      {place.areaLabel} · {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#e2e8f0]">
                  <a
                    href={place.viewMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#475569] hover:text-[#0f172a]"
                  >
                    <span>Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  {place.alreadyImported ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-[#16a34a] font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Already in Catalog</span>
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={importingId === place.placeId}
                        onClick={() => void handleImportPlace(place, false)}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-[#0f172a] font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Import Discovery</span>
                      </button>
                      <button
                        type="button"
                        disabled={importingId === place.placeId}
                        onClick={() => void handleImportPlace(place, true)}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Import Verified</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Community Corrections Moderation Queue */}
      <section className="bg-white p-5 rounded-xl border border-[#e2e8f0] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#0f172a]">
              Community Corrections Queue ({pendingCount} pending)
            </h3>
            <p className="text-xs text-[#64748b]">
              Approve &amp; apply address, hours, phone, category, or closed-business reports submitted by visitors.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(['pending', 'approved', 'resolved', 'rejected', 'all'] as const).map((statusKey) => (
              <button
                key={statusKey}
                type="button"
                onClick={() => setCorrectionFilter(statusKey)}
                className={`px-3 py-1.5 rounded-lg font-semibold border capitalize ${
                  correctionFilter === statusKey
                    ? 'bg-[#0f172a] text-white border-[#0f172a]'
                    : 'bg-[#f8fafc] text-[#475569] border-[#e2e8f0]'
                }`}
              >
                {statusKey}
              </button>
            ))}
          </div>
        </div>

        {moderationMsg && (
          <div className="p-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-xs font-semibold text-[#166534]">
            {moderationMsg}
          </div>
        )}

        {filteredCorrections.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] text-center text-xs text-[#64748b]">
            No {correctionFilter === 'all' ? '' : correctionFilter} community correction reports right now.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCorrections.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-[#e2e8f0] p-4 bg-[#f8fafc] space-y-3 text-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-[#0f172a]">{item.cafe_name}</span>
                      <span className="px-2 py-0.5 rounded bg-[#fef3c7] border border-[#fde68a] text-[#92400e] font-semibold text-[11px]">
                        {ISSUE_LABEL_MAP.get(item.issue_type) || item.issue_type}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize border ${
                          item.status === 'pending'
                            ? 'bg-white border-[#cbd5e1] text-[#334155]'
                            : item.status === 'rejected'
                            ? 'bg-[#fef2f2] border-[#fecaca] text-[#dc2626]'
                            : 'bg-[#ecfdf5] border-[#a7f3d0] text-[#16a34a]'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748b] mt-0.5">
                      Reported by {item.reporter_name || 'Guest'}
                      {item.reporter_email ? ` (${item.reporter_email})` : ''} ·{' '}
                      {new Date(item.created_at).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <span className="font-mono-data text-[10px] text-[#64748b]">
                    #{item.id} · {item.cafe_key}
                  </span>
                </div>

                {item.suggested_value && (
                  <p className="p-2.5 rounded-lg bg-white border border-[#e2e8f0] text-[#0f172a]">
                    <span className="font-semibold text-[#475569]">Suggested fix:</span>{' '}
                    {item.suggested_value}
                  </p>
                )}

                {item.details && <p className="text-[#334155] leading-relaxed">{item.details}</p>}

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-[#e2e8f0]">
                  <input
                    type="text"
                    value={adminNotesById[item.id] ?? item.admin_note ?? ''}
                    onChange={(e) =>
                      setAdminNotesById((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder="Admin moderation note (optional)..."
                    className="flex-1 h-9 px-3 rounded-lg border border-[#cbd5e1] bg-white text-xs"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={moderatingId === item.id}
                      onClick={() => void handleModerateCorrection(item, 'approved', true)}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve &amp; Apply</span>
                    </button>
                    <button
                      type="button"
                      disabled={moderatingId === item.id}
                      onClick={() => void handleModerateCorrection(item, 'resolved', false)}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-[#0f172a] font-semibold disabled:opacity-50"
                    >
                      Mark Resolved
                    </button>
                    <button
                      type="button"
                      disabled={moderatingId === item.id}
                      onClick={() => void handleModerateCorrection(item, 'rejected', false)}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#fecaca] bg-[#fef2f2] hover:bg-[#fee2e2] text-[#dc2626] font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Duplicate Cafe Merger Tool */}
      <section className="bg-white p-5 rounded-xl border border-[#e2e8f0] space-y-4">
        <div className="flex items-center gap-2">
          <GitMerge className="w-4 h-4 text-[#0f172a]" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold text-[#0f172a]">Merge Duplicate Listings</h3>
            <p className="text-xs text-[#64748b]">
              Copy missing Place ID, coordinates, phone, and website into the primary listing, then archive &amp; unpublish the duplicate.
            </p>
          </div>
        </div>

        <form onSubmit={handleMergeCafes} className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
          <div className="sm:col-span-5">
            <label className="block font-semibold text-[#475569] mb-1">
              Primary Listing (Keep)
            </label>
            <select
              value={primaryId}
              onChange={(e) => setPrimaryId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-semibold"
            >
              <option value="">Select primary cafe...</option>
              {sortedLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.area}) — {getCafeSourceMeta(loc).label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-5">
            <label className="block font-semibold text-[#475569] mb-1">
              Duplicate Listing (Merge &amp; Archive)
            </label>
            <select
              value={duplicateId}
              onChange={(e) => setDuplicateId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-semibold"
            >
              <option value="">Select duplicate cafe...</option>
              {sortedLocations
                .filter((loc) => loc.id !== primaryId)
                .map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.area}) — {loc.published ? 'Published' : 'Draft'}
                  </option>
                ))}
            </select>
          </div>

          <div className="sm:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={merging || !primaryId || !duplicateId || primaryId === duplicateId}
              className="w-full h-10 px-3 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-50 text-white font-semibold"
            >
              {merging ? 'Merging...' : 'Merge'}
            </button>
          </div>
        </form>

        {(primaryLoc || duplicateLoc) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {[
              { title: 'Primary (Kept)', loc: primaryLoc },
              { title: 'Duplicate (Unpublished)', loc: duplicateLoc },
            ].map(({ title, loc }) => (
              <div
                key={title}
                className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] space-y-1"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
                  {title}
                </p>
                {loc ? (
                  <>
                    <p className="font-semibold text-[#0f172a]">{loc.name}</p>
                    <p className="text-[#475569]">
                      {loc.area} · {loc.address}
                    </p>
                    <p className="font-mono-data text-[10px] text-[#64748b]">
                      Place ID: {loc.place_id || '—'} · Coords:{' '}
                      {loc.lat !== null && loc.lng !== null ? `${loc.lat}, ${loc.lng}` : '—'}
                    </p>
                  </>
                ) : (
                  <p className="text-[#64748b]">Not selected</p>
                )}
              </div>
            ))}
          </div>
        )}

        {mergeFeedback && (
          <div
            className={`p-3 rounded-lg border text-xs font-semibold ${
              mergeFeedback.ok
                ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#166534]'
                : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
            }`}
          >
            {mergeFeedback.text}
          </div>
        )}
      </section>
    </div>
  );
}

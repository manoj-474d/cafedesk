import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Edit3,
  ExternalLink,
  GitMerge,
  Loader2,
  MapPin,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  BENGALURU_AREAS,
  BENGALURU_REGIONS,
  CORRECTION_ISSUE_TYPES,
  DISCOVERY_CATEGORY_TABS,
  STANDARD_BUSINESS_CATEGORIES,
  SUPPORTED_CITIES,
} from '../../config/constants';
import type {
  BengaluruRegionName,
  CommunityCorrectionRecord,
  DiscoveryPlaceRefRecord,
  DiscoverySettingsRecord,
  LocalityCoverageOverview,
  LocalityRecord,
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

type DiscoverySubTab = 'coverage' | 'places_review' | 'manual_search' | 'moderation';

const ISSUE_LABEL_MAP = new Map<string, string>(
  CORRECTION_ISSUE_TYPES.map((item) => [item.id, item.label])
);

const STATUS_BADGE_MAP: Record<string, string> = {
  completed: 'bg-[#ecfdf5] border-[#a7f3d0] text-[#16a34a]',
  partial: 'bg-[#fffbeb] border-[#fde68a] text-[#b45309]',
  running: 'bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]',
  failed: 'bg-[#fef2f2] border-[#fecaca] text-[#dc2626]',
  pending: 'bg-[#f8fafc] border-[#cbd5e1] text-[#475569]',
};

export function AdminDiscoveryTab({
  csrfToken,
  locations,
  onRefreshLocations,
  onCorrectionsChanged,
}: AdminDiscoveryTabProps) {
  const [subTab, setSubTab] = useState<DiscoverySubTab>('coverage');

  // 0. Bengaluru Locality Coverage & Engine State
  const [overview, setOverview] = useState<(LocalityCoverageOverview & { running?: boolean }) | null>(
    null
  );
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [engineFeedback, setEngineFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [runningScope, setRunningScope] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<DiscoverySettingsRecord | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showJobLogs, setShowJobLogs] = useState(false);

  // Locality table filters & editor modal
  const [locSearch, setLocSearch] = useState('');
  const [locRegionFilter, setLocRegionFilter] = useState<BengaluruRegionName | ''>('');
  const [locStatusFilter, setLocStatusFilter] = useState('');
  const [editingLocality, setEditingLocality] = useState<LocalityRecord | null>(null);
  const [addingLocality, setAddingLocality] = useState(false);
  const [locForm, setLocForm] = useState({
    name: '',
    region: 'North Bengaluru' as BengaluruRegionName,
    alt_spellings: '',
    local_names: '',
    keywords: '',
    lat: '13.0452',
    lng: '77.5476',
    radius_meters: '2800',
    coverage_notes: '',
  });
  const [savingLocality, setSavingLocality] = useState(false);

  // Discovered Places Review Queue State
  const [discoveredPlaces, setDiscoveredPlaces] = useState<DiscoveryPlaceRefRecord[]>([]);
  const [loadingPlacesQueue, setLoadingPlacesQueue] = useState(false);
  const [queueRegion, setQueueRegion] = useState('');
  const [queueLocalityId, setQueueLocalityId] = useState('');
  const [queueCategory, setQueueCategory] = useState('');
  const [queueDupStatus, setQueueDupStatus] = useState('');
  const [updatingPlaceId, setUpdatingPlaceId] = useState<string | null>(null);

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

  const loadCoverage = useCallback(async () => {
    setLoadingCoverage(true);
    try {
      const res = await fetch('/api/admin/localities/coverage', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as LocalityCoverageOverview & { running?: boolean };
        setOverview(data);
        if (data.settings) setSettingsDraft(data.settings);
      }
    } finally {
      setLoadingCoverage(false);
    }
  }, []);

  const loadDiscoveredQueue = useCallback(async () => {
    setLoadingPlacesQueue(true);
    try {
      const params = new URLSearchParams();
      if (queueRegion) params.set('region', queueRegion);
      if (queueLocalityId) params.set('localityId', queueLocalityId);
      if (queueCategory) params.set('category', queueCategory);
      if (queueDupStatus) params.set('duplicateStatus', queueDupStatus);
      const res = await fetch(`/api/admin/discovery/places?${params.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as { places?: DiscoveryPlaceRefRecord[] };
        setDiscoveredPlaces(Array.isArray(data.places) ? data.places : []);
      }
    } finally {
      setLoadingPlacesQueue(false);
    }
  }, [queueRegion, queueLocalityId, queueCategory, queueDupStatus]);

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
    void Promise.all([loadCoverage(), loadUsage(), loadCorrections()]);
  }, [loadCoverage, loadUsage, loadCorrections]);

  useEffect(() => {
    if (subTab === 'places_review') {
      void loadDiscoveredQueue();
    }
  }, [subTab, loadDiscoveredQueue]);

  // --- Bengaluru Locality Engine Handlers ---

  const handleRunDiscovery = async (
    scope: 'locality' | 'region' | 'all' | 'retry_failed' | 'refresh',
    target = ''
  ) => {
    setRunningScope(`${scope}:${target}`);
    setEngineFeedback(null);
    try {
      const res = await fetch('/api/admin/discovery/run', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ scope, target }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        job?: {
          calls_made: number;
          places_seen: number;
          new_places: number;
          duplicates_flagged: number;
          status: string;
        };
      };
      if (!res.ok || data.error) {
        setEngineFeedback({
          ok: false,
          text: data.error || 'Discovery job could not complete.',
        });
      } else if (data.job) {
        setEngineFeedback({
          ok: true,
          text: `Sweep (${data.job.status}): ${data.job.calls_made} API calls · ${data.job.places_seen} places scanned · ${data.job.new_places} new indexed · ${data.job.duplicates_flagged} potential duplicates flagged.`,
        });
      }
      await Promise.all([loadCoverage(), loadUsage()]);
    } catch {
      setEngineFeedback({ ok: false, text: 'Network error triggering discovery job.' });
    } finally {
      setRunningScope(null);
    }
  };

  const handleTogglePause = async (paused: boolean) => {
    setEngineFeedback(null);
    const res = await fetch('/api/admin/discovery/pause', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ paused }),
    });
    if (res.ok) {
      setEngineFeedback({
        ok: true,
        text: paused ? 'Automated locality discovery paused.' : 'Automated locality discovery resumed.',
      });
      await loadCoverage();
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsDraft) return;
    setSavingSettings(true);
    setEngineFeedback(null);
    try {
      const res = await fetch('/api/admin/discovery/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(settingsDraft),
      });
      if (res.ok) {
        setEngineFeedback({ ok: true, text: 'Discovery schedule & API budget caps saved.' });
        await loadCoverage();
      } else {
        setEngineFeedback({ ok: false, text: 'Failed to update discovery settings.' });
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePurgeExpiredCache = async () => {
    const res = await fetch('/api/admin/discovery/cache-purge', {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': csrfToken },
    });
    if (res.ok) {
      const data = (await res.json()) as { removed?: number };
      setEngineFeedback({
        ok: true,
        text: `Purged ${data.removed ?? 0} expired Google Places cache entries (< 24h ToS ceiling).`,
      });
      await loadCoverage();
    }
  };

  const handleToggleLocalityActive = async (loc: LocalityRecord) => {
    const res = await fetch(`/api/admin/localities/${loc.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ active: !loc.active }),
    });
    if (res.ok) {
      await loadCoverage();
    }
  };

  const openAddLocalityModal = () => {
    setEditingLocality(null);
    setAddingLocality(true);
    setLocForm({
      name: '',
      region: 'North Bengaluru',
      alt_spellings: '',
      local_names: '',
      keywords: '',
      lat: '13.0452',
      lng: '77.5476',
      radius_meters: '2800',
      coverage_notes: '',
    });
  };

  const openEditLocalityModal = (loc: LocalityRecord) => {
    setAddingLocality(false);
    setEditingLocality(loc);
    setLocForm({
      name: loc.name,
      region: loc.region,
      alt_spellings: loc.alt_spellings.join(', '),
      local_names: loc.local_names.join(', '),
      keywords: loc.keywords.join(', '),
      lat: String(loc.lat),
      lng: String(loc.lng),
      radius_meters: String(loc.radius_meters),
      coverage_notes: loc.coverage_notes || '',
    });
  };

  const handleSaveLocality = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLocality(true);
    try {
      const url = editingLocality
        ? `/api/admin/localities/${editingLocality.id}`
        : '/api/admin/localities';
      const method = editingLocality ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          name: locForm.name.trim(),
          region: locForm.region,
          alt_spellings: locForm.alt_spellings,
          local_names: locForm.local_names,
          keywords: locForm.keywords,
          lat: Number(locForm.lat),
          lng: Number(locForm.lng),
          radius_meters: Number(locForm.radius_meters) || 2800,
          coverage_notes: locForm.coverage_notes.trim(),
        }),
      });
      if (res.ok) {
        setAddingLocality(false);
        setEditingLocality(null);
        setEngineFeedback({
          ok: true,
          text: `${editingLocality ? 'Updated' : 'Added'} Bengaluru locality "${locForm.name.trim()}".`,
        });
        await loadCoverage();
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setEngineFeedback({ ok: false, text: err.error || 'Could not save locality.' });
      }
    } finally {
      setSavingLocality(false);
    }
  };

  const handleModerateSuggestion = async (
    id: number,
    status: 'approved' | 'rejected'
  ) => {
    const res = await fetch(`/api/admin/locality-suggestions/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setEngineFeedback({
        ok: true,
        text: `Locality suggestion #${id} ${status}.`,
      });
      await loadCoverage();
    }
  };

  const handleUpdateDiscoveredPlace = async (
    placeId: string,
    payload: {
      action?: 'promote';
      cafedesk_category?: string;
      duplicate_review_status?: string;
      active?: boolean;
    }
  ) => {
    setUpdatingPlaceId(placeId);
    try {
      const res = await fetch(`/api/admin/discovery/places/${encodeURIComponent(placeId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        if (payload.action === 'promote') {
          await onRefreshLocations();
        }
        await Promise.all([loadDiscoveredQueue(), loadCoverage()]);
      }
    } finally {
      setUpdatingPlaceId(null);
    }
  };

  // --- Existing Handlers ---

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
  const pendingSuggestions = useMemo(
    () => (overview?.suggestions || []).filter((s) => s.status === 'pending'),
    [overview?.suggestions]
  );

  const filteredLocalities = useMemo(() => {
    const list = overview?.localities || [];
    const q = locSearch.trim().toLowerCase();
    return list.filter((l) => {
      if (locRegionFilter && l.region !== locRegionFilter) return false;
      if (locStatusFilter && l.discovery_status !== locStatusFilter) return false;
      if (q) {
        const hay = `${l.name} ${l.region} ${l.alt_spellings.join(' ')} ${l.local_names.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [overview?.localities, locSearch, locRegionFilter, locStatusFilter]);

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
      {/* Header + Sub-Navigation */}
      <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#0f172a]">
              Bengaluru Locality Discovery &amp; Google Places Coverage System
            </h2>
            <p className="text-xs text-[#64748b]">
              Automated multi-query discovery across all 6 Bengaluru regions, 24h ToS-safe cache,
              branch-safe duplicate detection, and community moderation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void Promise.all([loadCoverage(), loadUsage(), loadCorrections()])}
            className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] hover:bg-white text-xs font-semibold text-[#0f172a] shrink-0 whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                loadingCoverage || loadingUsage || loadingCorrections ? 'animate-spin' : ''
              }`}
            />
            <span>Refresh All</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-[#e2e8f0]">
          {[
            {
              id: 'coverage' as const,
              label: `Locality Engine (${overview?.localities.length ?? 49})`,
            },
            {
              id: 'places_review' as const,
              label: `Quality Report & Places (${overview?.usage.total_indexed_refs ?? 0})`,
              badge: overview?.usage.duplicates_needing_review || 0,
            },
            {
              id: 'manual_search' as const,
              label: 'Manual Search & API Health',
            },
            {
              id: 'moderation' as const,
              label: 'Corrections & Merger',
              badge: pendingCount,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-semibold border inline-flex items-center gap-2 transition-colors whitespace-nowrap ${
                subTab === tab.id
                  ? 'bg-[#0f172a] text-white border-[#0f172a]'
                  : 'bg-[#f8fafc] text-[#475569] border-[#e2e8f0] hover:border-[#94a3b8]'
              }`}
            >
              <span>{tab.label}</span>
              {Boolean(tab.badge) && (
                <span className="px-1.5 py-0.5 rounded bg-[#b45309] text-white text-[10px] font-mono-data">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {engineFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
            engineFeedback.ok
              ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#166534]'
              : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
          }`}
        >
          <span>{engineFeedback.text}</span>
          <button type="button" onClick={() => setEngineFeedback(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-TAB 1: BENGALURU LOCALITY COVERAGE & AUTOMATED ENGINE            */}
      {/* ==================================================================== */}
      {subTab === 'coverage' && (
        <div className="space-y-6">
          {/* Top KPIs + Engine Budget Guardrails */}
          {overview && (
            <section className="bg-white p-5 rounded-xl border border-[#e2e8f0] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-[#0f172a]" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-[#0f172a]">
                    Discovery Engine Controls &amp; Cost Guardrails
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold border ${
                      overview.usage.paused
                        ? 'bg-[#fffbeb] border-[#fde68a] text-[#b45309]'
                        : overview.running
                        ? 'bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]'
                        : 'bg-[#ecfdf5] border-[#a7f3d0] text-[#16a34a]'
                    }`}
                  >
                    {overview.usage.paused
                      ? 'Paused'
                      : overview.running
                      ? 'Sweep Running'
                      : 'Ready'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleTogglePause(!overview.usage.paused)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] hover:bg-white text-xs font-semibold text-[#0f172a] inline-flex items-center gap-1.5"
                  >
                    {overview.usage.paused ? (
                      <>
                        <Play className="w-3.5 h-3.5 text-[#16a34a]" />
                        <span>Resume</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5 text-[#b45309]" />
                        <span>Pause</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePurgeExpiredCache()}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] hover:bg-white text-xs font-semibold text-[#0f172a] inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#64748b]" />
                    <span>Purge Expired Cache ({overview.usage.expired_cache_entries})</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Calls (24h / Cap)</p>
                  <p className="font-mono-data text-lg font-bold text-[#0f172a] mt-0.5 tabular-nums">
                    {overview.usage.calls_24h} / {overview.usage.daily_call_cap}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Est. 24h Cost</p>
                  <p className="font-mono-data text-lg font-bold text-[#0f172a] mt-0.5 tabular-nums">
                    ${overview.usage.estimated_cost_24h_usd.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0]">
                  <p className="text-[#16a34a]">Indexed Places</p>
                  <p className="font-mono-data text-lg font-bold text-[#166534] mt-0.5 tabular-nums">
                    {overview.usage.total_indexed_refs}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Transient Cache (&lt;24h)</p>
                  <p className="font-mono-data text-lg font-bold text-[#0f172a] mt-0.5 tabular-nums">
                    {overview.usage.transient_cache_entries}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#fffbeb] border border-[#fde68a]">
                  <p className="text-[#92400e]">Dupes for Review</p>
                  <p className="font-mono-data text-lg font-bold text-[#b45309] mt-0.5 tabular-nums">
                    {overview.usage.duplicates_needing_review}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Server Key</p>
                  <p className="font-semibold text-sm text-[#0f172a] mt-1">
                    {overview.usage.has_server_key ? 'Configured' : 'Missing'}
                  </p>
                </div>
              </div>

              {settingsDraft && (
                <form
                  onSubmit={handleSaveSettings}
                  className="pt-3 border-t border-[#e2e8f0] grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs items-end"
                >
                  <label className="flex items-center gap-2 col-span-2 sm:col-span-1 h-10">
                    <input
                      type="checkbox"
                      checked={settingsDraft.scheduler_enabled}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          scheduler_enabled: e.target.checked,
                        })
                      }
                      className="rounded border-[#cbd5e1]"
                    />
                    <span className="font-semibold text-[#0f172a]">Auto Cron</span>
                  </label>
                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">Daily Call Cap</label>
                    <input
                      type="number"
                      min={10}
                      max={2000}
                      value={settingsDraft.daily_call_cap}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          daily_call_cap: Number(e.target.value),
                        })
                      }
                      className="w-full h-10 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">Calls / Run</label>
                    <input
                      type="number"
                      min={5}
                      max={300}
                      value={settingsDraft.max_calls_per_run}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          max_calls_per_run: Number(e.target.value),
                        })
                      }
                      className="w-full h-10 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">Pages / Query</label>
                    <input
                      type="number"
                      min={1}
                      max={3}
                      value={settingsDraft.pages_per_query_cap}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          pages_per_query_cap: Number(e.target.value),
                        })
                      }
                      className="w-full h-10 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">Interval (min)</label>
                    <input
                      type="number"
                      min={5}
                      max={1440}
                      value={settingsDraft.interval_minutes}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          interval_minutes: Number(e.target.value),
                        })
                      }
                      className="w-full h-10 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                    />
                  </div>
                  <label className="flex items-center gap-2 h-10">
                    <input
                      type="checkbox"
                      checked={settingsDraft.include_nearby_distance_sweep}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          include_nearby_distance_sweep: e.target.checked,
                        })
                      }
                      className="rounded border-[#cbd5e1]"
                    />
                    <span className="font-semibold text-[#475569]">Distance Sweep</span>
                  </label>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="h-10 px-3 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white font-semibold disabled:opacity-60"
                  >
                    {savingSettings ? 'Saving...' : 'Save Caps'}
                  </button>
                </form>
              )}
            </section>
          )}

          {/* 6-Region Coverage Grid + Batch Actions */}
          {overview && (
            <section className="bg-white p-5 rounded-xl border border-[#e2e8f0] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#0f172a]">
                    6 Bengaluru Regions — Coverage &amp; Batch Discovery
                  </h3>
                  <p className="text-xs text-[#64748b]">
                    Each locality runs 10 targeted queries (Cafes, Coffee, Tea, Bakeries, Juice,
                    Desserts, Independent, Budget, Local Filter Coffee &amp; Nearby Distance Sweep).
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    disabled={Boolean(runningScope)}
                    onClick={() => void handleRunDiscovery('all')}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#b45309] hover:bg-[#92400e] disabled:opacity-60 text-white font-semibold whitespace-nowrap"
                  >
                    {runningScope === 'all:' ? 'Running...' : 'Run All Pending (Capped)'}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(runningScope)}
                    onClick={() => void handleRunDiscovery('retry_failed')}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] hover:bg-white text-[#0f172a] font-semibold whitespace-nowrap"
                  >
                    Retry Failed / Partial
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(runningScope)}
                    onClick={() => void handleRunDiscovery('refresh')}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] hover:bg-white text-[#0f172a] font-semibold whitespace-nowrap"
                  >
                    Refresh Oldest
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {overview.regions.map((reg) => (
                  <div
                    key={reg.region}
                    className="p-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-[#0f172a]">{reg.region}</span>
                      <button
                        type="button"
                        disabled={Boolean(runningScope)}
                        onClick={() => void handleRunDiscovery('region', reg.region)}
                        className="min-h-[32px] px-2.5 py-1 rounded-lg bg-white border border-[#cbd5e1] hover:border-[#b45309] text-[11px] font-semibold text-[#0f172a] disabled:opacity-50"
                      >
                        {runningScope === `region:${reg.region}` ? 'Running...' : 'Discover Region'}
                      </button>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#e2e8f0] overflow-hidden">
                      <div
                        className="h-full bg-[#1b4d3e] transition-all"
                        style={{ width: `${reg.avg_progress}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 text-[11px] text-[#475569] font-mono-data tabular-nums">
                      <span>
                        {reg.completed_localities}/{reg.active_localities} done ·{' '}
                        {reg.partial_localities} partial
                      </span>
                      <span>
                        {reg.unique_places_indexed} Google · {reg.curated_cafes_count} curated
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Pending User-Suggested Localities Queue */}
          {pendingSuggestions.length > 0 && (
            <section className="bg-white p-5 rounded-xl border border-[#fde68a] space-y-3">
              <h3 className="text-sm font-semibold text-[#92400e]">
                Pending Neighbourhood Suggestions ({pendingSuggestions.length})
              </h3>
              <div className="space-y-2">
                {pendingSuggestions.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-lg bg-[#fffbeb] border border-[#fde68a] flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#0f172a]">
                        {s.name}{' '}
                        <span className="font-normal text-[#64748b]">({s.region})</span>
                      </p>
                      {s.alt_spellings.length > 0 && (
                        <p className="text-[#475569]">Alt: {s.alt_spellings.join(', ')}</p>
                      )}
                      {s.notes && <p className="text-[#64748b]">{s.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleModerateSuggestion(s.id, 'approved')}
                        className="min-h-[36px] px-3 rounded-lg bg-[#16a34a] text-white font-semibold"
                      >
                        Approve &amp; Activate
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleModerateSuggestion(s.id, 'rejected')}
                        className="min-h-[36px] px-3 rounded-lg border border-[#fecaca] bg-white text-[#dc2626] font-semibold"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bengaluru Locality Master Table */}
          <section className="bg-white p-5 rounded-xl border border-[#e2e8f0] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#0f172a]">
                  Bengaluru Locality Master Database ({filteredLocalities.length})
                </h3>
                <p className="text-xs text-[#64748b]">
                  Includes residential &amp; outer Bengaluru areas (Jalahalli, Hesaraghatta,
                  Nagasandra, Peenya, Chikkabanavara, RR Nagar, Kengeri, Whitefield, etc.).
                </p>
              </div>
              <button
                type="button"
                onClick={openAddLocalityModal}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Locality</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <input
                type="text"
                value={locSearch}
                onChange={(e) => setLocSearch(e.target.value)}
                placeholder="Search locality, alt spelling, or local name..."
                className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
              />
              <select
                value={locRegionFilter}
                onChange={(e) => setLocRegionFilter(e.target.value as BengaluruRegionName | '')}
                className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-semibold"
              >
                <option value="">All 6 Regions</option>
                {BENGALURU_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={locStatusFilter}
                onChange={(e) => setLocStatusFilter(e.target.value)}
                className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-semibold"
              >
                <option value="">All Discovery Statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="partial">Partial</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="overflow-x-auto border border-[#e2e8f0] rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#475569]">
                    <th className="py-2.5 px-3">Locality</th>
                    <th className="py-2.5 px-3">Region</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Progress</th>
                    <th className="py-2.5 px-3">Places</th>
                    <th className="py-2.5 px-3">Dupes</th>
                    <th className="py-2.5 px-3">Last Scan</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {filteredLocalities.map((loc) => (
                    <tr key={loc.id} className={!loc.active ? 'opacity-55 bg-[#f8fafc]' : ''}>
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-[#0f172a]">{loc.name}</p>
                        {loc.alt_spellings.length > 0 && (
                          <p className="text-[10px] text-[#64748b] truncate max-w-[200px]">
                            {loc.alt_spellings.slice(0, 3).join(', ')}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[#475569] whitespace-nowrap">
                        {loc.region.replace(' Bengaluru', '')}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[10px] font-semibold capitalize ${
                            STATUS_BADGE_MAP[loc.discovery_status] || STATUS_BADGE_MAP.pending
                          }`}
                        >
                          {loc.discovery_status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono-data tabular-nums">
                        {loc.discovery_progress}% ({loc.categories_completed.length}/10)
                      </td>
                      <td className="py-2.5 px-3 font-mono-data font-semibold tabular-nums text-[#0f172a]">
                        {loc.unique_place_count}
                      </td>
                      <td className="py-2.5 px-3 font-mono-data tabular-nums text-[#64748b]">
                        {loc.duplicate_count}
                      </td>
                      <td className="py-2.5 px-3 font-mono-data text-[11px] text-[#64748b] whitespace-nowrap">
                        {loc.last_discovery_at
                          ? new Date(loc.last_discovery_at).toLocaleDateString('en-IN')
                          : 'Never'}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={Boolean(runningScope) || !loc.active}
                            onClick={() => void handleRunDiscovery('locality', loc.slug)}
                            className="px-2.5 py-1 rounded bg-[#1b4d3e] hover:bg-[#133a2e] disabled:opacity-50 text-white text-[11px] font-semibold"
                          >
                            {runningScope === `locality:${loc.slug}` ? '...' : 'Scan'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditLocalityModal(loc)}
                            aria-label={`Edit ${loc.name}`}
                            className="p-1.5 rounded border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-[#475569]"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleLocalityActive(loc)}
                            className="px-2 py-1 rounded border border-[#cbd5e1] bg-white text-[11px] font-semibold text-[#475569]"
                          >
                            {loc.active ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Recent Discovery Jobs & Query Logs */}
          {overview && overview.recent_jobs.length > 0 && (
            <section className="bg-white p-5 rounded-xl border border-[#e2e8f0] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#0f172a]">Recent Discovery Jobs</h3>
                <button
                  type="button"
                  onClick={() => setShowJobLogs((v) => !v)}
                  className="text-xs font-semibold text-[#b45309] hover:underline"
                >
                  {showJobLogs ? 'Hide per-query logs' : `Show query logs (${overview.recent_logs.length})`}
                </button>
              </div>
              <div className="overflow-x-auto border border-[#e2e8f0] rounded-lg">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#475569]">
                      <th className="py-2 px-3">Scope</th>
                      <th className="py-2 px-3">Target</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Calls</th>
                      <th className="py-2 px-3">New</th>
                      <th className="py-2 px-3">Est Cost</th>
                      <th className="py-2 px-3">Started</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9] font-mono-data tabular-nums">
                    {overview.recent_jobs.slice(0, 10).map((job) => (
                      <tr key={job.id}>
                        <td className="py-2 px-3 uppercase">{job.scope}</td>
                        <td className="py-2 px-3">{job.target_key || '—'}</td>
                        <td className="py-2 px-3 font-semibold">{job.status}</td>
                        <td className="py-2 px-3">{job.calls_made}</td>
                        <td className="py-2 px-3 text-[#16a34a]">{job.new_places}</td>
                        <td className="py-2 px-3">${job.estimated_cost_usd.toFixed(3)}</td>
                        <td className="py-2 px-3 text-[#64748b]">
                          {new Date(job.started_at).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {showJobLogs && overview.recent_logs.length > 0 && (
                <div className="overflow-x-auto border border-[#e2e8f0] rounded-lg">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#475569]">
                        <th className="py-2 px-3">Locality</th>
                        <th className="py-2 px-3">Query</th>
                        <th className="py-2 px-3">Page</th>
                        <th className="py-2 px-3">Found</th>
                        <th className="py-2 px-3">New</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9] font-mono-data tabular-nums">
                      {overview.recent_logs.slice(0, 25).map((log) => (
                        <tr key={log.id}>
                          <td className="py-2 px-3">{log.locality_slug}</td>
                          <td className="py-2 px-3">{log.query_label}</td>
                          <td className="py-2 px-3">{log.page_num}</td>
                          <td className="py-2 px-3">{log.results_count}</td>
                          <td className="py-2 px-3">{log.new_count}</td>
                          <td
                            className={`py-2 px-3 ${
                              log.status_code >= 400 ? 'text-[#dc2626]' : 'text-[#16a34a]'
                            }`}
                          >
                            {log.status_code}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-TAB 2: QUALITY REPORT & DISCOVERED PLACES REVIEW QUEUE           */}
      {/* ==================================================================== */}
      {subTab === 'places_review' && (
        <div className="space-y-6">
          {overview && (
            <section className="bg-white p-5 rounded-xl border border-[#e2e8f0] space-y-4">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0f172a]">
                  Coverage Completeness &amp; Quality Report
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Total Localities</p>
                  <p className="font-mono-data text-lg font-bold text-[#0f172a] tabular-nums">
                    {overview.quality_report.total_localities}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0]">
                  <p className="text-[#16a34a]">Fully Covered</p>
                  <p className="font-mono-data text-lg font-bold text-[#166534] tabular-nums">
                    {overview.quality_report.fully_covered_count}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#fffbeb] border border-[#fde68a]">
                  <p className="text-[#92400e]">Partial / Failed</p>
                  <p className="font-mono-data text-lg font-bold text-[#b45309] tabular-nums">
                    {overview.quality_report.partial_or_failed_count}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Pending Scan</p>
                  <p className="font-mono-data text-lg font-bold text-[#0f172a] tabular-nums">
                    {overview.quality_report.unsearched_count}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Indexed Place Refs</p>
                  <p className="font-mono-data text-lg font-bold text-[#0f172a] tabular-nums">
                    {overview.quality_report.total_unique_place_refs}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Curated Cafes</p>
                  <p className="font-mono-data text-lg font-bold text-[#0f172a] tabular-nums">
                    {overview.quality_report.total_curated_cafes}
                  </p>
                </div>
              </div>

              {overview.quality_report.category_breakdown.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {overview.quality_report.category_breakdown.map((b) => (
                    <span
                      key={b.category}
                      className="px-2.5 py-1 rounded bg-[#f8fafc] border border-[#e2e8f0] font-medium text-[#0f172a]"
                    >
                      {b.category}: <strong className="font-mono-data">{b.count}</strong>
                    </span>
                  ))}
                </div>
              )}

              <p className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] text-xs text-[#475569]">
                {overview.quality_report.honesty_note}
              </p>
            </section>
          )}

          {/* Discovered Places Moderation & Reclassification Queue */}
          <section className="bg-white p-5 rounded-xl border border-[#e2e8f0] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#0f172a]">
                  Discovered Places Index &amp; Duplicate Review Queue
                </h3>
                <p className="text-xs text-[#64748b]">
                  Reclassify businesses across 8 standardized categories, resolve potential
                  same-building duplicates (different chain branches remain separate), or promote
                  into CafeDesk catalog.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadDiscoveredQueue()}
                className="min-h-[36px] px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
              >
                Reload Queue
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <select
                value={queueRegion}
                onChange={(e) => setQueueRegion(e.target.value)}
                className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-semibold"
              >
                <option value="">All Regions</option>
                {BENGALURU_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={queueLocalityId}
                onChange={(e) => setQueueLocalityId(e.target.value)}
                className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-semibold"
              >
                <option value="">All Localities</option>
                {(overview?.localities || []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.unique_place_count})
                  </option>
                ))}
              </select>
              <select
                value={queueCategory}
                onChange={(e) => setQueueCategory(e.target.value)}
                className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-semibold"
              >
                <option value="">All 8 Categories</option>
                {STANDARD_BUSINESS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={queueDupStatus}
                onChange={(e) => setQueueDupStatus(e.target.value)}
                className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-semibold"
              >
                <option value="">All Duplicate States</option>
                <option value="needs_review">Needs Review</option>
                <option value="clean">Clean</option>
                <option value="distinct_branch">Distinct Branch</option>
                <option value="merged">Merged</option>
              </select>
            </div>

            {loadingPlacesQueue ? (
              <div className="p-8 text-center text-xs text-[#64748b]">
                Loading discovered businesses...
              </div>
            ) : discoveredPlaces.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] text-center text-xs text-[#64748b]">
                No indexed places match the selected filters yet. Run discovery on a locality in the
                Locality Engine tab to populate businesses here.
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#e2e8f0] rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#475569]">
                      <th className="py-2.5 px-3">Business &amp; Address</th>
                      <th className="py-2.5 px-3">Locality</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Dup Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {discoveredPlaces.map((ref) => (
                      <tr key={ref.place_id}>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-[#0f172a]">
                            {ref.cached_display?.name || ref.place_id}
                          </p>
                          <p className="text-[11px] text-[#64748b] truncate max-w-[260px]">
                            {ref.cached_display?.address || 'Transient display cache expired (<24h ToS)'}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-[#475569] whitespace-nowrap">
                          {ref.locality_name || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            aria-label="Category"
                            disabled={updatingPlaceId === ref.place_id}
                            value={ref.cafedesk_category}
                            onChange={(e) =>
                              void handleUpdateDiscoveredPlace(ref.place_id, {
                                cafedesk_category: e.target.value,
                              })
                            }
                            className="h-8 px-2 rounded border border-[#cbd5e1] bg-white text-[11px] font-semibold"
                          >
                            {STANDARD_BUSINESS_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              ref.duplicate_review_status === 'needs_review'
                                ? 'bg-[#fffbeb] border-[#fde68a] text-[#b45309]'
                                : ref.duplicate_review_status === 'merged'
                                ? 'bg-[#fef2f2] border-[#fecaca] text-[#dc2626]'
                                : 'bg-[#ecfdf5] border-[#a7f3d0] text-[#16a34a]'
                            }`}
                          >
                            {ref.duplicate_review_status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {ref.duplicate_review_status === 'needs_review' && (
                              <>
                                <button
                                  type="button"
                                  disabled={updatingPlaceId === ref.place_id}
                                  onClick={() =>
                                    void handleUpdateDiscoveredPlace(ref.place_id, {
                                      duplicate_review_status: 'distinct_branch',
                                    })
                                  }
                                  className="px-2 py-1 rounded border border-[#cbd5e1] bg-white text-[11px] font-semibold"
                                >
                                  Keep Branch
                                </button>
                                <button
                                  type="button"
                                  disabled={updatingPlaceId === ref.place_id}
                                  onClick={() =>
                                    void handleUpdateDiscoveredPlace(ref.place_id, {
                                      duplicate_review_status: 'merged',
                                    })
                                  }
                                  className="px-2 py-1 rounded border border-[#fecaca] bg-[#fef2f2] text-[#dc2626] text-[11px] font-semibold"
                                >
                                  Mark Merged
                                </button>
                              </>
                            )}
                            {ref.promoted_cafe_id ? (
                              <span className="text-[11px] font-semibold text-[#16a34a]">
                                In Catalog
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={
                                  updatingPlaceId === ref.place_id || !ref.cached_display
                                }
                                onClick={() =>
                                  void handleUpdateDiscoveredPlace(ref.place_id, {
                                    action: 'promote',
                                    cafedesk_category: ref.cafedesk_category,
                                  })
                                }
                                className="px-2.5 py-1 rounded bg-[#b45309] hover:bg-[#92400e] disabled:opacity-50 text-white text-[11px] font-semibold"
                              >
                                Promote
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-TAB 3: MANUAL GOOGLE PLACES SEARCH & API HEALTH                  */}
      {/* ==================================================================== */}
      {subTab === 'manual_search' && (
        <div className="space-y-6">
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
                  placeholder="Jalahalli, Hesaraghatta, Indiranagar..."
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
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-TAB 4: COMMUNITY CORRECTIONS & MERGE DUPLICATE LISTINGS          */}
      {/* ==================================================================== */}
      {subTab === 'moderation' && (
        <div className="space-y-6">
          {/* 3. Community Corrections Moderation Queue */}
          <section className="bg-white p-5 rounded-xl border border-[#e2e8f0] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#0f172a]">
                  Community Corrections Queue ({pendingCount} pending)
                </h3>
                <p className="text-xs text-[#64748b]">
                  Approve &amp; apply address, hours, phone, category, or closed-business reports
                  submitted by visitors.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {(['pending', 'approved', 'resolved', 'rejected', 'all'] as const).map(
                  (statusKey) => (
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
                  )
                )}
              </div>
            </div>

            {moderationMsg && (
              <div className="p-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-xs font-semibold text-[#166534]">
                {moderationMsg}
              </div>
            )}

            {filteredCorrections.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] text-center text-xs text-[#64748b]">
                No {correctionFilter === 'all' ? '' : correctionFilter} community correction reports
                right now.
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
                  Copy missing Place ID, coordinates, phone, and website into the primary listing,
                  then archive &amp; unpublish the duplicate.
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
      )}

      {/* Add / Edit Bengaluru Locality Modal */}
      {(addingLocality || editingLocality) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bengaluru Locality Editor"
          className="fixed inset-0 z-50 bg-[#0f172a]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            setAddingLocality(false);
            setEditingLocality(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white border border-[#e2e8f0] shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-[#0f172a]">
                {editingLocality
                  ? `Edit Locality: ${editingLocality.name}`
                  : 'Add Bengaluru Locality'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setAddingLocality(false);
                  setEditingLocality(null);
                }}
                className="w-8 h-8 rounded-lg border border-[#e2e8f0] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLocality} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Locality Name *</label>
                  <input
                    type="text"
                    required
                    value={locForm.name}
                    onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Region *</label>
                  <select
                    value={locForm.region}
                    onChange={(e) =>
                      setLocForm({ ...locForm, region: e.target.value as BengaluruRegionName })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-semibold"
                  >
                    {BENGALURU_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Latitude *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={locForm.lat}
                    onChange={(e) => setLocForm({ ...locForm, lat: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Longitude *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={locForm.lng}
                    onChange={(e) => setLocForm({ ...locForm, lng: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Radius (m)</label>
                  <input
                    type="number"
                    min={500}
                    max={15000}
                    value={locForm.radius_meters}
                    onChange={(e) => setLocForm({ ...locForm, radius_meters: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  Alternative Spellings (comma separated)
                </label>
                <input
                  type="text"
                  value={locForm.alt_spellings}
                  onChange={(e) => setLocForm({ ...locForm, alt_spellings: e.target.value })}
                  placeholder="hessaraghatta, hesargatta"
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  Common Local Names / Landmarks (comma separated)
                </label>
                <input
                  type="text"
                  value={locForm.local_names}
                  onChange={(e) => setLocForm({ ...locForm, local_names: e.target.value })}
                  placeholder="Soladevanahalli, Chikkasandra"
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  Search Keywords &amp; Coverage Notes
                </label>
                <input
                  type="text"
                  value={locForm.keywords}
                  onChange={(e) => setLocForm({ ...locForm, keywords: e.target.value })}
                  placeholder="tea, bakery, student cafe"
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddingLocality(false);
                    setEditingLocality(null);
                  }}
                  className="min-h-[40px] px-4 rounded-lg border border-[#cbd5e1] bg-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLocality}
                  className="min-h-[40px] px-5 rounded-lg bg-[#0f172a] text-white font-semibold disabled:opacity-60"
                >
                  {savingLocality ? 'Saving...' : 'Save Locality'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

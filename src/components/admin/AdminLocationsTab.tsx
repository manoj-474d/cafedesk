import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Image as ImageIcon,
  MapPin,
  Plus,
  Search,
  Star,
  Trash2,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import type { CafeMode } from '../../config/constants';
import type { AmenityState, LocationItem, MediaAsset, MenuServiceItem } from '../../types/cms';
import { MediaPickerModal } from './MediaPickerModal';

interface AdminLocationsTabProps {
  locations: LocationItem[];
  media: MediaAsset[];
  csrfToken: string;
  onMediaUploaded: (item: MediaAsset) => void;
  onRefreshLocations: () => Promise<void>;
}

const PAGE_SIZE = 15;

const EMPTY_LOCATION: LocationItem = {
  id: '',
  slug: '',
  name: '',
  category: 'Work Cafe',
  city: 'Bengaluru',
  area: '',
  address: '',
  phone: '',
  map_link: '',
  website_url: '',
  menu_url: '',
  instagram_url: '',
  other_social_links: '',
  place_id: '',
  lat: null,
  lng: null,
  timings: 'Check on Google Maps',
  description: '',
  photos: [],
  interior_photos: [],
  exterior_photos: [],
  photos_approved: false,
  wifi_available: 'unknown',
  wifi_mbps: null,
  charging_sockets: 'unknown',
  sockets_count: null,
  sockets_claimed: false,
  comfortable_seating: 'unknown',
  seating_info: '',
  ambience: '',
  outdoor_seating: 'unknown',
  suitable_for_studying: 'unknown',
  suitable_for_working: 'unknown',
  noise_level: null,
  avg_cost_per_person: null,
  price_range: '',
  coffee_price: null,
  tea_price: null,
  snacks_price: null,
  meals_price: null,
  popular_items: [],
  rating: null,
  rating_count: null,
  min_spend: null,
  laptop_friendly: true,
  time_limit: null,
  modes: ['work'],
  facilities: [],
  offers: [],
  menu_services: [],
  best_for: ['Solo laptop work'],
  verdict: '',
  avoid_if: null,
  student_discount: null,
  verified: false,
  featured: false,
  published: true,
  display_order: 12,
  last_verified_date: null,
  claims: [],
  source_name: '',
  source_url: '',
  sample: false,
};

export function AdminLocationsTab({
  locations,
  media,
  csrfToken,
  onMediaUploaded,
  onRefreshLocations,
}: AdminLocationsTabProps) {
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('All');
  const [areaFilter, setAreaFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'inactive'>('all');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<LocationItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [photoTarget, setPhotoTarget] = useState<
    'photos' | 'interior_photos' | 'exterior_photos' | null
  >(null);

  const [previewLoc, setPreviewLoc] = useState<LocationItem | null>(null);
  const [confirmDeleteLoc, setConfirmDeleteLoc] = useState<LocationItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [facilitiesText, setFacilitiesText] = useState('');
  const [offersText, setOffersText] = useState('');
  const [bestForText, setBestForText] = useState('');
  const [claimsText, setClaimsText] = useState('');
  const [popularItemsText, setPopularItemsText] = useState('');

  const cities = useMemo(
    () => ['All', ...Array.from(new Set(locations.map((l) => l.city).filter(Boolean)))],
    [locations]
  );

  const areas = useMemo(
    () =>
      [
        'All',
        ...Array.from(new Set(locations.map((l) => l.area).filter(Boolean))).sort((a, b) =>
          a.localeCompare(b)
        ),
      ] as string[],
    [locations]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return locations.filter((loc) => {
      if (cityFilter !== 'All' && loc.city !== cityFilter) return false;
      if (areaFilter !== 'All' && loc.area !== areaFilter) return false;
      if (statusFilter === 'published' && !loc.published) return false;
      if (statusFilter === 'inactive' && loc.published) return false;
      if (!q) return true;
      return `${loc.name} ${loc.area} ${loc.city} ${loc.category ?? ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [locations, cityFilter, areaFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedLocations = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const openEditor = (loc: LocationItem | null) => {
    setErrorMsg('');
    if (!loc) {
      setIsNew(true);
      setEditing({ ...EMPTY_LOCATION, display_order: locations.length + 1 });
      setFacilitiesText('');
      setOffersText('');
      setBestForText(EMPTY_LOCATION.best_for.join(', '));
      setClaimsText('');
      setPopularItemsText('');
    } else {
      setIsNew(false);
      setEditing({
        ...EMPTY_LOCATION,
        ...loc,
        interior_photos: loc.interior_photos ?? [],
        exterior_photos: loc.exterior_photos ?? [],
        outdoor_seating: loc.outdoor_seating ?? 'unknown',
      });
      setFacilitiesText(loc.facilities.join(', '));
      setOffersText(loc.offers.join('\n'));
      setBestForText(loc.best_for.join(', '));
      setClaimsText((loc.claims ?? []).join('\n'));
      setPopularItemsText((loc.popular_items ?? []).join(', '));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setErrorMsg('');

    const payload: LocationItem = {
      ...editing,
      facilities: facilitiesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      offers: offersText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      best_for: bestForText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      claims: claimsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      popular_items: popularItemsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      const url = isNew ? '/api/admin/cafes' : `/api/admin/cafes/${encodeURIComponent(editing.id)}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not save location.');
        return;
      }
      await onRefreshLocations();
      setEditing(null);
    } catch {
      setErrorMsg('Network error saving location.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickToggle = async (
    loc: LocationItem,
    field: 'published' | 'featured' | 'verified'
  ) => {
    await fetch(`/api/admin/cafes/${encodeURIComponent(loc.id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({ ...loc, [field]: !loc[field] }),
    });
    await onRefreshLocations();
  };

  const confirmAndDelete = async () => {
    if (!confirmDeleteLoc) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/cafes/${encodeURIComponent(confirmDeleteLoc.id)}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken },
        credentials: 'include',
      });
      setConfirmDeleteLoc(null);
      await onRefreshLocations();
    } finally {
      setDeleting(false);
    }
  };

  const toggleMode = (m: CafeMode) => {
    if (!editing) return;
    const exists = editing.modes.includes(m);
    const next = exists ? editing.modes.filter((x) => x !== m) : [...editing.modes, m];
    setEditing({ ...editing, modes: next.length > 0 ? next : ['work'] });
  };

  const addMenuItem = () => {
    if (!editing) return;
    const nextItem: MenuServiceItem = {
      name: '',
      price: '₹180',
      category: 'Coffee',
      description: '',
    };
    setEditing({ ...editing, menu_services: [...editing.menu_services, nextItem] });
  };

  const renderPhotoList = (
    target: 'photos' | 'interior_photos' | 'exterior_photos',
    title: string,
    hint: string
  ) => {
    if (!editing) return null;
    const list = (editing[target] ?? []) as string[];
    return (
      <div className="p-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold text-[#0f172a]">{title}</p>
            <p className="text-[#64748b]">{hint}</p>
          </div>
          <button
            type="button"
            onClick={() => setPhotoTarget(target)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0f172a] text-white font-semibold"
          >
            <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add / Upload Photo</span>
          </button>
        </div>

        {list.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {list.map((pUrl, i) => (
              <div
                key={`${target}-${pUrl}-${i}`}
                className="relative rounded-lg overflow-hidden border border-[#cbd5e1] bg-white"
              >
                <img
                  src={pUrl}
                  alt={`${title} ${i + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full aspect-[4/3] object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      ...editing,
                      [target]: list.filter((_, idx) => idx !== i),
                    })
                  }
                  aria-label="Remove photo"
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0f172a]">Cafe Listings Manager</h2>
          <p className="text-xs text-[#64748b]">
            Manage {locations.length} Bengaluru cafes, seating, ambience, interior/exterior photos, menus, and publication status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openEditor(null)}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold whitespace-nowrap"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add New Cafe</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {cities.length > 2 &&
            cities.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCityFilter(c);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  cityFilter === c
                    ? 'bg-[#0f172a] text-white border-[#0f172a]'
                    : 'bg-white text-[#475569] border-[#e2e8f0] hover:text-[#0f172a]'
                }`}
              >
                {c}
              </button>
            ))}

          <select
            aria-label="Filter by locality"
            value={areaFilter}
            onChange={(e) => {
              setAreaFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold text-[#0f172a]"
          >
            {areas.map((a) => (
              <option key={a} value={a}>
                {a === 'All' ? 'All Localities' : a}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'published' | 'inactive');
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold text-[#0f172a]"
          >
            <option value="all">All Statuses ({locations.length})</option>
            <option value="published">
              Active / Published ({locations.filter((l) => l.published).length})
            </option>
            <option value="inactive">
              Inactive / Draft ({locations.filter((l) => !l.published).length})
            </option>
          </select>
        </div>

        <div className="relative w-full lg:w-72">
          <Search
            className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search cafes, localities, category..."
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
          />
        </div>
      </div>

      {/* Locations Table */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#475569] font-semibold">
              <th className="py-3 px-4">Order</th>
              <th className="py-3 px-4">Cafe &amp; Locality</th>
              <th className="py-3 px-4">Specs</th>
              <th className="py-3 px-4">Photos</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {pagedLocations.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#64748b]">
                  No cafes match the current filters.
                </td>
              </tr>
            ) : (
              pagedLocations.map((loc) => (
                <tr key={loc.id} className="hover:bg-[#f8fafc]">
                  <td className="py-3 px-4 font-mono-data text-[#64748b]">{loc.display_order}</td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-[#0f172a] text-sm">{loc.name}</p>
                    <p className="text-[#64748b]">
                      {loc.area}, {loc.city} · /{loc.slug}
                      {loc.category ? ` · ${loc.category}` : ''}
                    </p>
                  </td>
                  <td className="py-3 px-4 font-mono-data text-[#334155] whitespace-nowrap">
                    {loc.wifi_mbps !== null ? `${loc.wifi_mbps} Mbps` : 'WiFi —'} ·{' '}
                    {loc.sockets_count !== null
                      ? `${loc.sockets_count} plugs`
                      : loc.sockets_claimed
                      ? 'Plugs claimed'
                      : 'Plugs —'}{' '}
                    · {loc.avg_cost_per_person !== null ? `₹${loc.avg_cost_per_person}` : '₹ —'}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {loc.photos.length === 0 ? (
                      <span className="text-[#64748b]">None uploaded</span>
                    ) : loc.photos_approved ? (
                      <span className="text-[#16a34a] font-semibold">
                        {loc.photos.length} approved
                      </span>
                    ) : (
                      <span className="text-[#d97706] font-semibold">
                        {loc.photos.length} awaiting approval
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleQuickToggle(loc, 'published')}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold ${
                          loc.published
                            ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#16a34a]'
                            : 'bg-[#f1f5f9] border-[#cbd5e1] text-[#64748b]'
                        }`}
                      >
                        {loc.published ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{loc.published ? 'Published' : 'Draft'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickToggle(loc, 'verified')}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold ${
                          loc.verified
                            ? 'bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]'
                            : 'bg-white border-[#cbd5e1] text-[#64748b]'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickToggle(loc, 'featured')}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold ${
                          loc.featured
                            ? 'bg-[#fef3c7] border-[#fde68a] text-[#b45309]'
                            : 'bg-white border-[#cbd5e1] text-[#64748b]'
                        }`}
                      >
                        <Star className="w-3 h-3" />
                        <span>Featured</span>
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewLoc(loc)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#e2e8f0] bg-white hover:bg-[#f1f5f9] text-[#475569] font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditor(loc)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-[#0f172a] font-semibold"
                      >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteLoc(loc)}
                        aria-label={`Delete ${loc.name}`}
                        className="p-1.5 rounded-md border border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        {filtered.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between text-xs">
            <span className="text-[#64748b] font-mono-data">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} cafes
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded border border-[#cbd5e1] bg-white disabled:opacity-40 font-semibold"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <span className="font-mono-data font-semibold px-2">
                Page {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded border border-[#cbd5e1] bg-white disabled:opacity-40 font-semibold"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live Preview Modal */}
      {previewLoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${previewLoc.name}`}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base text-[#0f172a]">{previewLoc.name}</h3>
                <p className="text-xs text-[#64748b]">
                  {previewLoc.area}, {previewLoc.city} · {previewLoc.published ? 'Published' : 'Draft'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewLoc(null)}
                aria-label="Close preview"
                className="w-9 h-9 rounded-lg border border-[#e2e8f0] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {previewLoc.photos.length > 0 && (
                <img
                  src={previewLoc.photos[0]}
                  alt={previewLoc.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-52 object-cover rounded-xl border border-[#e2e8f0]"
                />
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Wi-Fi</p>
                  <p className="font-semibold text-[#0f172a] mt-0.5 inline-flex items-center gap-1">
                    <Wifi className="w-3.5 h-3.5 text-[#1b4d3e]" />
                    {previewLoc.wifi_mbps ? `${previewLoc.wifi_mbps} Mbps` : previewLoc.wifi_available}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Sockets</p>
                  <p className="font-semibold text-[#0f172a] mt-0.5 inline-flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-[#b45309]" />
                    {previewLoc.sockets_count !== null
                      ? `${previewLoc.sockets_count} plugs`
                      : previewLoc.charging_sockets}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Avg Spend</p>
                  <p className="font-mono-data font-semibold text-[#0f172a] mt-0.5">
                    {previewLoc.avg_cost_per_person ? `₹${previewLoc.avg_cost_per_person}` : previewLoc.price_range || '—'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                  <p className="text-[#64748b]">Timings</p>
                  <p className="font-semibold text-[#0f172a] mt-0.5 truncate">{previewLoc.timings}</p>
                </div>
              </div>

              {(previewLoc.ambience || previewLoc.seating_info) && (
                <div className="p-3.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] space-y-1">
                  {previewLoc.ambience && (
                    <p>
                      <span className="font-semibold text-[#0f172a]">Ambience:</span>{' '}
                      {previewLoc.ambience}
                    </p>
                  )}
                  {previewLoc.seating_info && (
                    <p>
                      <span className="font-semibold text-[#0f172a]">Seating:</span>{' '}
                      {previewLoc.seating_info}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <p className="font-semibold text-[#0f172a] inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#64748b]" />
                  <span>Address</span>
                </p>
                <p className="text-[#475569]">{previewLoc.address || 'No address added.'}</p>
              </div>

              {previewLoc.description && (
                <p className="text-[#334155] leading-relaxed">{previewLoc.description}</p>
              )}

              {previewLoc.menu_services.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-semibold text-[#0f172a]">
                    Menu Snapshot ({previewLoc.menu_services.length} items)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {previewLoc.menu_services.slice(0, 6).map((m, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2 rounded-lg border border-[#e2e8f0] flex items-center justify-between gap-2"
                      >
                        <span className="font-medium text-[#0f172a] truncate">{m.name}</span>
                        <span className="font-mono-data font-semibold text-[#b45309] shrink-0">
                          {m.price}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
              <Link
                to={`/locations/${previewLoc.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1b4d3e] hover:underline"
              >
                <span>Open Public Cafe Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => {
                  const target = previewLoc;
                  setPreviewLoc(null);
                  openEditor(target);
                }}
                className="h-9 px-4 rounded-lg bg-[#0f172a] text-white text-xs font-semibold"
              >
                Edit Cafe Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteLoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm cafe deletion"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#0f172a]">Delete Cafe Listing?</h3>
            <p className="text-xs text-[#475569] leading-relaxed">
              Are you sure you want to permanently remove{' '}
              <span className="font-semibold text-[#0f172a]">{confirmDeleteLoc.name}</span> (
              {confirmDeleteLoc.area}) and its menu items? This action is recorded in the audit log
              and cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteLoc(null)}
                disabled={deleting}
                className="h-9 px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmAndDelete()}
                disabled={deleting}
                className="h-9 px-4 rounded-lg bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-60 text-white text-xs font-semibold"
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Editor Modal */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isNew ? 'Add Cafe' : `Edit ${editing.name}`}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl border border-[#e2e8f0] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl"
          >
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <h3 className="font-semibold text-base text-[#0f172a]">
                {isNew ? 'Add New Cafe Listing' : `Edit Cafe: ${editing.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close editor"
                className="w-9 h-9 rounded-lg border border-[#e2e8f0] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {errorMsg && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] font-semibold"
                >
                  {errorMsg}
                </div>
              )}

              {/* Identity, Category & City */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[#475569] mb-1">Cafe Name *</label>
                  <input
                    type="text"
                    required
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Category</label>
                  <input
                    type="text"
                    value={editing.category ?? ''}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    placeholder="e.g. Specialty Coffee, Bakery Cafe"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">URL Slug</label>
                  <input
                    type="text"
                    value={editing.slug}
                    onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                    placeholder="auto-generated"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#475569] mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={editing.city}
                    onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">
                    Area / Locality *
                  </label>
                  <input
                    type="text"
                    required
                    value={editing.area}
                    onChange={(e) => setEditing({ ...editing, area: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={editing.phone}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Opening Hours *</label>
                  <input
                    type="text"
                    required
                    value={editing.timings}
                    onChange={(e) => setEditing({ ...editing, timings: e.target.value })}
                    placeholder="8:00 AM – 11:00 PM"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Full Address</label>
                  <input
                    type="text"
                    value={editing.address}
                    onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Google Maps Link</label>
                  <input
                    type="url"
                    value={editing.map_link}
                    onChange={(e) => setEditing({ ...editing, map_link: e.target.value })}
                    placeholder="https://maps.google.com/..."
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">
                    Official Website URL
                  </label>
                  <input
                    type="url"
                    value={editing.website_url}
                    onChange={(e) => setEditing({ ...editing, website_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Online Menu URL</label>
                  <input
                    type="url"
                    value={editing.menu_url}
                    onChange={(e) => setEditing({ ...editing, menu_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Instagram URL</label>
                  <input
                    type="url"
                    value={editing.instagram_url}
                    onChange={(e) => setEditing({ ...editing, instagram_url: e.target.value })}
                    placeholder="https://instagram.com/..."
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">
                    Other Social Links (Zomato / Linktree / Swiggy)
                  </label>
                  <input
                    type="text"
                    value={editing.other_social_links ?? ''}
                    onChange={(e) =>
                      setEditing({ ...editing, other_social_links: e.target.value })
                    }
                    placeholder="https://..."
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                  />
                </div>
              </div>

              {/* Seating & Ambience */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">
                    Seating Information
                  </label>
                  <input
                    type="text"
                    value={editing.seating_info ?? ''}
                    onChange={(e) => setEditing({ ...editing, seating_info: e.target.value })}
                    placeholder="e.g. 40 seats, communal oak tables & booths"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">
                    Ambience &amp; Environment
                  </label>
                  <input
                    type="text"
                    value={editing.ambience ?? ''}
                    onChange={(e) => setEditing({ ...editing, ambience: e.target.value })}
                    placeholder="e.g. Sunlit acoustic loft with mellow jazz"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">
                    Outdoor Seating
                  </label>
                  <select
                    value={editing.outdoor_seating ?? 'unknown'}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        outdoor_seating: e.target.value as AmenityState,
                      })
                    }
                    className="w-full h-10 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  >
                    <option value="unknown">Unverified</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>

              {/* Coordinates, Place ID & Ratings */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editing.lat ?? ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        lat: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    placeholder="12.9716"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editing.lng ?? ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        lng: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    placeholder="77.5946"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Google Place ID</label>
                  <input
                    type="text"
                    value={editing.place_id}
                    onChange={(e) => setEditing({ ...editing, place_id: e.target.value })}
                    placeholder="Optional"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Rating (1–5)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={editing.rating ?? ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        rating: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    placeholder="Unrated"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Rating Count</label>
                  <input
                    type="number"
                    value={editing.rating_count ?? ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        rating_count: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    placeholder="Count"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
              </div>

              {/* Amenity Tri-State Controls */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {(
                  [
                    ['wifi_available', 'Wi-Fi Available'],
                    ['charging_sockets', 'Charging Sockets'],
                    ['comfortable_seating', 'Comfortable Seating'],
                    ['suitable_for_studying', 'Suitable Studying'],
                    ['suitable_for_working', 'Suitable Working'],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field}>
                    <label className="block font-semibold text-[#475569] mb-1">{label}</label>
                    <select
                      value={editing[field]}
                      onChange={(e) =>
                        setEditing({ ...editing, [field]: e.target.value as AmenityState })
                      }
                      className="w-full h-10 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                    >
                      <option value="unknown">Unverified</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Price Range</label>
                  <input
                    type="text"
                    value={editing.price_range}
                    onChange={(e) => setEditing({ ...editing, price_range: e.target.value })}
                    placeholder="e.g. ₹200–₹400"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Coffee Price</label>
                  <input
                    type="text"
                    value={editing.coffee_price ?? ''}
                    onChange={(e) =>
                      setEditing({ ...editing, coffee_price: e.target.value || null })
                    }
                    placeholder="₹160–₹240"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Tea Price</label>
                  <input
                    type="text"
                    value={editing.tea_price ?? ''}
                    onChange={(e) => setEditing({ ...editing, tea_price: e.target.value || null })}
                    placeholder="₹120–₹180"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Snacks Price</label>
                  <input
                    type="text"
                    value={editing.snacks_price ?? ''}
                    onChange={(e) =>
                      setEditing({ ...editing, snacks_price: e.target.value || null })
                    }
                    placeholder="₹180–₹280"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Meals Price</label>
                  <input
                    type="text"
                    value={editing.meals_price ?? ''}
                    onChange={(e) =>
                      setEditing({ ...editing, meals_price: e.target.value || null })
                    }
                    placeholder="₹300–₹480"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  Popular Menu Items (comma-separated)
                </label>
                <input
                  type="text"
                  value={popularItemsText}
                  onChange={(e) => setPopularItemsText(e.target.value)}
                  placeholder="e.g. Pour Over, Almond Croissant, Cold Brew"
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>

              {/* Cafe Photographs */}
              <div className="space-y-3">
                {renderPhotoList(
                  'photos',
                  'Primary Cafe Photographs (Cover & Gallery)',
                  'Branch photos display publicly when approved below.'
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {renderPhotoList(
                    'interior_photos',
                    'Interior Seating Photos',
                    'Optional workspace and seating photography.'
                  )}
                  {renderPhotoList(
                    'exterior_photos',
                    'Exterior & Entrance Photos',
                    'Optional storefront photography.'
                  )}
                </div>

                <label className="inline-flex items-center gap-2 font-semibold text-[#0f172a] cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={editing.photos_approved}
                    onChange={(e) =>
                      setEditing({ ...editing, photos_approved: e.target.checked })
                    }
                    className="accent-[#16a34a]"
                  />
                  <span>Approve uploaded cafe photos for public display</span>
                </label>
              </div>

              {/* Workspace Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">WiFi (Mbps)</label>
                  <input
                    type="number"
                    placeholder="Unmeasured"
                    value={editing.wifi_mbps ?? ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        wifi_mbps: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Sockets Count</label>
                  <input
                    type="number"
                    placeholder="Unmeasured"
                    value={editing.sockets_count ?? ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        sockets_count: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Noise (1–5)</label>
                  <select
                    value={editing.noise_level ?? ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        noise_level:
                          e.target.value === ''
                            ? null
                            : (Number(e.target.value) as 1 | 2 | 3 | 4 | 5),
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  >
                    <option value="">Unmeasured</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}/5
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Avg Spend (₹)</label>
                  <input
                    type="number"
                    placeholder="Unverified"
                    value={editing.avg_cost_per_person ?? ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        avg_cost_per_person: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Verified Date</label>
                  <input
                    type="text"
                    placeholder="e.g. 18 Nov 2026"
                    value={editing.last_verified_date ?? ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        last_verified_date: e.target.value.trim() ? e.target.value : null,
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Display Order</label>
                  <input
                    type="number"
                    value={editing.display_order}
                    onChange={(e) =>
                      setEditing({ ...editing, display_order: Number(e.target.value) })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
              </div>

              {/* Descriptions, Source Claims & Offers */}
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">
                    One-Line Verdict Summary
                  </label>
                  <input
                    type="text"
                    value={editing.verdict}
                    onChange={(e) => setEditing({ ...editing, verdict: e.target.value })}
                    placeholder="Leave blank to use first public claim or add field verdict"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">
                    Full Description
                  </label>
                  <textarea
                    rows={3}
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    className="w-full p-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">
                      Facilities (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={facilitiesText}
                      onChange={(e) => setFacilitiesText(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">
                      Best For Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={bestForText}
                      onChange={(e) => setBestForText(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">
                      Student Discount
                    </label>
                    <input
                      type="text"
                      value={editing.student_discount ?? ''}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          student_discount: e.target.value || null,
                        })
                      }
                      placeholder="Optional"
                      className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">Avoid If Note</label>
                    <input
                      type="text"
                      value={editing.avoid_if ?? ''}
                      onChange={(e) =>
                        setEditing({ ...editing, avoid_if: e.target.value || null })
                      }
                      placeholder="Optional"
                      className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">Source Name</label>
                    <input
                      type="text"
                      value={editing.source_name}
                      onChange={(e) => setEditing({ ...editing, source_name: e.target.value })}
                      placeholder="e.g. eChai, Curly Tales"
                      className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">Source URL</label>
                    <input
                      type="url"
                      value={editing.source_url}
                      onChange={(e) => setEditing({ ...editing, source_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">
                      Public Source Claims (one per line)
                    </label>
                    <textarea
                      rows={2}
                      value={claimsText}
                      onChange={(e) => setClaimsText(e.target.value)}
                      placeholder="What public sources report..."
                      className="w-full p-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#475569] mb-1">
                      Location-Specific Offers (one per line)
                    </label>
                    <textarea
                      rows={2}
                      value={offersText}
                      onChange={(e) => setOffersText(e.target.value)}
                      placeholder="e.g. 15% off espresso for students Mon–Thu"
                      className="w-full p-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                    />
                  </div>
                </div>
              </div>

              {/* Menu & Services Quick Inline List */}
              <div className="space-y-3 border-t border-[#e2e8f0] pt-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#0f172a]">
                    Quick Menu &amp; Services ({editing.menu_services.length})
                  </p>
                  <button
                    type="button"
                    onClick={addMenuItem}
                    className="px-3 py-1 rounded-md border border-[#cbd5e1] hover:bg-[#f1f5f9] font-semibold"
                  >
                    + Add Menu Item
                  </button>
                </div>
                {editing.menu_services.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => {
                        const next = [...editing.menu_services];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setEditing({ ...editing, menu_services: next });
                      }}
                      placeholder="Item name"
                      className="col-span-4 h-9 px-2.5 rounded-md border border-[#cbd5e1] bg-[#f8fafc]"
                    />
                    <input
                      type="text"
                      value={item.category}
                      onChange={(e) => {
                        const next = [...editing.menu_services];
                        next[idx] = { ...next[idx], category: e.target.value };
                        setEditing({ ...editing, menu_services: next });
                      }}
                      placeholder="Category"
                      className="col-span-2 h-9 px-2.5 rounded-md border border-[#cbd5e1] bg-[#f8fafc]"
                    />
                    <input
                      type="text"
                      value={item.price}
                      onChange={(e) => {
                        const next = [...editing.menu_services];
                        next[idx] = { ...next[idx], price: e.target.value };
                        setEditing({ ...editing, menu_services: next });
                      }}
                      placeholder="₹ Price"
                      className="col-span-2 h-9 px-2.5 rounded-md border border-[#cbd5e1] bg-[#f8fafc]"
                    />
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => {
                        const next = [...editing.menu_services];
                        next[idx] = { ...next[idx], description: e.target.value };
                        setEditing({ ...editing, menu_services: next });
                      }}
                      placeholder="Short note"
                      className="col-span-3 h-9 px-2.5 rounded-md border border-[#cbd5e1] bg-[#f8fafc]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          menu_services: editing.menu_services.filter((_, i) => i !== idx),
                        })
                      }
                      aria-label="Remove menu item"
                      className="col-span-1 h-9 rounded-md border border-[#fecaca] text-[#dc2626] flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Modes & Flags */}
              <div className="flex flex-wrap items-center gap-6 pt-3 border-t border-[#e2e8f0]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#475569]">Modes:</span>
                  {(['work', 'budget', 'calm', 'plan'] as CafeMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMode(m)}
                      className={`px-2.5 py-1 rounded-md border font-semibold capitalize ${
                        editing.modes.includes(m)
                          ? 'bg-[#0f172a] text-white border-[#0f172a]'
                          : 'bg-white text-[#475569] border-[#cbd5e1]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.published}
                    onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                    className="accent-[#16a34a]"
                  />
                  <span>Published publicly</span>
                </label>

                <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.verified}
                    onChange={(e) => setEditing({ ...editing, verified: e.target.checked })}
                    className="accent-[#1d4ed8]"
                  />
                  <span>Verified audit</span>
                </label>

                <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.featured}
                    onChange={(e) => setEditing({ ...editing, featured: e.target.checked })}
                    className="accent-[#b45309]"
                  />
                  <span>Featured listing</span>
                </label>

                <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.laptop_friendly}
                    onChange={(e) =>
                      setEditing({ ...editing, laptop_friendly: e.target.checked })
                    }
                    className="accent-[#0f172a]"
                  />
                  <span>Laptop friendly</span>
                </label>

                <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.sockets_claimed}
                    onChange={(e) =>
                      setEditing({ ...editing, sockets_claimed: e.target.checked })
                    }
                    className="accent-[#0f172a]"
                  />
                  <span>Sockets claimed by sources</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-10 px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-60 text-white text-xs font-semibold"
              >
                {saving ? 'Saving...' : isNew ? 'Create Cafe' : 'Save Cafe'}
              </button>
            </div>
          </form>

          <MediaPickerModal
            open={photoTarget !== null}
            onClose={() => setPhotoTarget(null)}
            media={media}
            csrfToken={csrfToken}
            onMediaUploaded={onMediaUploaded}
            defaultCategory="Branch Photos"
            title={
              photoTarget === 'interior_photos'
                ? 'Select Interior Seating Photo'
                : photoTarget === 'exterior_photos'
                ? 'Select Exterior / Entrance Photo'
                : 'Select Real Cafe Photograph'
            }
            onSelect={(url) => {
              if (!photoTarget || !editing) return;
              const current = (editing[photoTarget] ?? []) as string[];
              if (!current.includes(url)) {
                setEditing({ ...editing, [photoTarget]: [...current, url] });
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

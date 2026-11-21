import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  CheckCircle2,
  Coffee,
  Edit3,
  Image as ImageIcon,
  Layers,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { DietaryType, LocationItem, MediaAsset, MenuItemRecord } from '../../types/cms';
import { MediaPickerModal } from './MediaPickerModal';

const MENU_CATEGORIES = [
  'Coffee',
  'Tea',
  'Cold beverages',
  'Other beverages',
  'Snacks',
  'Bakery',
  'Burgers',
  'Sandwiches',
  'Desserts',
  'Breakfast',
  'Other food',
];

interface AdminMenuTabProps {
  locations: LocationItem[];
  media: MediaAsset[];
  csrfToken: string;
  onMediaUploaded: (item: MediaAsset) => void;
  onRefreshLocations: () => Promise<void>;
}

interface MenuDraftForm {
  id?: number;
  cafe_id: string;
  name: string;
  category: string;
  description: string;
  price_inr: number;
  discount_price_inr: number | '';
  photo_url: string;
  available: boolean;
  dietary: DietaryType;
  is_bestseller: boolean;
  is_featured: boolean;
  sort_order: number;
}

const EMPTY_MENU_FORM: MenuDraftForm = {
  cafe_id: '',
  name: '',
  category: 'Coffee',
  description: '',
  price_inr: 150,
  discount_price_inr: '',
  photo_url: '',
  available: true,
  dietary: 'veg',
  is_bestseller: false,
  is_featured: false,
  sort_order: 0,
};

interface BulkRow {
  name: string;
  category: string;
  price_inr: number;
  dietary: DietaryType;
  description: string;
}

export function AdminMenuTab({
  locations,
  media,
  csrfToken,
  onMediaUploaded,
  onRefreshLocations,
}: AdminMenuTabProps) {
  const [selectedCafeId, setSelectedCafeId] = useState<string>(locations[0]?.id ?? '');
  const [items, setItems] = useState<MenuItemRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [priceSort, setPriceSort] = useState<'default' | 'asc' | 'desc'>('default');
  const [inlinePrices, setInlinePrices] = useState<Record<number, number>>({});
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [editing, setEditing] = useState<MenuDraftForm | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([
    { name: '', category: 'Coffee', price_inr: 140, dietary: 'veg', description: '' },
    { name: '', category: 'Snacks', price_inr: 120, dietary: 'veg', description: '' },
  ]);

  const [confirmDeleteItem, setConfirmDeleteItem] = useState<MenuItemRecord | null>(null);

  useEffect(() => {
    if (!selectedCafeId && locations.length > 0) {
      setSelectedCafeId(locations[0].id);
    }
  }, [locations, selectedCafeId]);

  const loadMenuItems = useCallback(async () => {
    if (!selectedCafeId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/menu?cafeId=${encodeURIComponent(selectedCafeId)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as { items?: MenuItemRecord[] };
        const loaded = Array.isArray(data.items) ? data.items : [];
        setItems(loaded);
        const mapped: Record<number, number> = {};
        loaded.forEach((it) => {
          mapped[it.id] = it.price_inr;
        });
        setInlinePrices(mapped);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCafeId]);

  useEffect(() => {
    void loadMenuItems();
  }, [loadMenuItems]);

  const selectedCafe = useMemo(
    () => locations.find((l) => l.id === selectedCafeId),
    [locations, selectedCafeId]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter((it) => {
      if (catFilter !== 'All' && it.category.toLowerCase() !== catFilter.toLowerCase()) return false;
      if (q && !`${it.name} ${it.category} ${it.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (priceSort === 'asc') return [...list].sort((a, b) => a.price_inr - b.price_inr);
    if (priceSort === 'desc') return [...list].sort((a, b) => b.price_inr - a.price_inr);
    return list;
  }, [items, search, catFilter, priceSort]);

  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setErrorMsg('');
    setNotice('');
    try {
      const isEdit = Boolean(editing.id);
      const url = isEdit ? `/api/admin/menu/${editing.id}` : '/api/admin/menu';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = {
        ...editing,
        cafe_id: selectedCafeId,
        discount_price_inr:
          editing.discount_price_inr === '' || editing.discount_price_inr === null
            ? null
            : Number(editing.discount_price_inr),
      };
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; items?: MenuItemRecord[] };
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not save menu item.');
        return;
      }
      if (Array.isArray(data.items)) setItems(data.items);
      setEditing(null);
      setNotice(isEdit ? `Updated "${editing.name}".` : `Added "${editing.name}" to menu.`);
      await Promise.all([loadMenuItems(), onRefreshLocations()]);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickPriceSave = async (item: MenuItemRecord) => {
    const nextPrice = Math.max(0, Math.round(Number(inlinePrices[item.id] ?? item.price_inr)));
    setNotice('');
    setErrorMsg('');
    const res = await fetch(`/api/admin/menu/${item.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({ price_inr: nextPrice }),
    });
    if (res.ok) {
      setNotice(`Updated price for "${item.name}" to ₹${nextPrice}.`);
      await Promise.all([loadMenuItems(), onRefreshLocations()]);
    }
  };

  const handleToggleAvailable = async (item: MenuItemRecord) => {
    setNotice('');
    const res = await fetch(`/api/admin/menu/${item.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({ available: !item.available }),
    });
    if (res.ok) {
      setNotice(`Marked "${item.name}" as ${!item.available ? 'available' : 'out of stock'}.`);
      await Promise.all([loadMenuItems(), onRefreshLocations()]);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = bulkRows.filter((r) => r.name.trim().length > 0);
    if (valid.length === 0) {
      setErrorMsg('Enter at least one item name before bulk saving.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/menu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          cafe_id: selectedCafeId,
          items: valid.map((r, idx) => ({
            name: r.name.trim(),
            category: r.category,
            price_inr: r.price_inr,
            dietary: r.dietary,
            description: r.description.trim(),
            available: true,
            sort_order: items.length + idx,
          })),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || 'Bulk menu upload failed.');
        return;
      }
      setBulkOpen(false);
      setBulkRows([
        { name: '', category: 'Coffee', price_inr: 140, dietary: 'veg', description: '' },
        { name: '', category: 'Snacks', price_inr: 120, dietary: 'veg', description: '' },
      ]);
      setNotice(`Added ${valid.length} menu items to ${selectedCafe?.name ?? 'cafe'}.`);
      await Promise.all([loadMenuItems(), onRefreshLocations()]);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteItem) return;
    const target = confirmDeleteItem;
    setConfirmDeleteItem(null);
    const res = await fetch(`/api/admin/menu/${target.id}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrfToken },
      credentials: 'include',
    });
    if (res.ok) {
      setNotice(`Deleted "${target.name}" from menu.`);
      await Promise.all([loadMenuItems(), onRefreshLocations()]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0f172a]">Menu &amp; Food Price Manager</h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            Manage cafe beverages, snacks, INR prices, dietary indicators, photos, and live availability synced to public cafe pages.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!selectedCafeId}
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#0f172a] text-xs font-semibold"
          >
            <Layers className="w-4 h-4" />
            <span>Bulk Add Items</span>
          </button>
          <button
            type="button"
            disabled={!selectedCafeId}
            onClick={() =>
              setEditing({ ...EMPTY_MENU_FORM, cafe_id: selectedCafeId, sort_order: items.length })
            }
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Add Menu Item</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-xs font-semibold text-[#1b4d3e] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-xs font-semibold text-[#991b1b]">
          {errorMsg}
        </div>
      )}

      {/* Cafe Selector & Filters */}
      <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-4">
          <label className="block text-[11px] font-semibold text-[#475569] mb-1">
            Select Cafe ({locations.length})
          </label>
          <select
            value={selectedCafeId}
            onChange={(e) => setSelectedCafeId(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} · {loc.area} ({loc.menu_items?.length ?? loc.menu_services.length} items)
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block text-[11px] font-semibold text-[#475569] mb-1">
            Search Items
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search coffee, croissant..."
              className="w-full h-10 pl-8 pr-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
            />
          </div>
        </div>

        <div className="md:col-span-3">
          <label className="block text-[11px] font-semibold text-[#475569] mb-1">
            Category
          </label>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
          >
            <option value="All">All Categories</option>
            {MENU_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <button
            type="button"
            onClick={() =>
              setPriceSort((prev) => (prev === 'default' ? 'asc' : prev === 'asc' ? 'desc' : 'default'))
            }
            className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>
              {priceSort === 'asc' ? 'Price: Low-High' : priceSort === 'desc' ? 'Price: High-Low' : 'Sort Price'}
            </span>
          </button>
        </div>
      </div>

      {/* Menu List: Desktop Table + Mobile Stacked Cards */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-xs text-[#64748b]">Loading menu items...</p>
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Coffee className="w-7 h-7 text-[#b45309] mx-auto" />
            <p className="text-sm font-semibold text-[#0f172a]">No menu items found for this view</p>
            <p className="text-xs text-[#64748b]">
              Add individual dishes &amp; beverages or use Bulk Add to populate this cafe&apos;s menu.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#475569] font-semibold">
                    <th className="py-3 px-4">Item</th>
                    <th className="py-3 px-4">Category &amp; Dietary</th>
                    <th className="py-3 px-4">Price / Offer (₹ INR)</th>
                    <th className="py-3 px-4">Highlights</th>
                    <th className="py-3 px-4">Availability</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {filteredItems.map((item) => {
                    const draftPrice = inlinePrices[item.id] ?? item.price_inr;
                    const dirtyPrice = draftPrice !== item.price_inr;
                    const hasDiscount =
                      item.discount_price_inr !== null &&
                      item.discount_price_inr !== undefined &&
                      item.discount_price_inr < item.price_inr;
                    return (
                      <tr key={item.id} className="hover:bg-[#f8fafc]">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {item.photo_url ? (
                              <img
                                src={item.photo_url}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-md object-cover border border-[#e2e8f0] shrink-0"
                              />
                            ) : null}
                            <div>
                              <p className="font-semibold text-[#0f172a] text-sm">{item.name}</p>
                              {item.description && (
                                <p className="text-[11px] text-[#64748b] max-w-xs truncate">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-[#0f172a]">{item.category}</span>
                          {item.dietary !== 'na' && (
                            <span className="text-[#64748b]">
                              {' '}
                              · {item.dietary === 'non_veg' ? 'Non-Veg' : item.dietary === 'vegan' ? 'Vegan' : 'Veg'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              value={draftPrice}
                              onChange={(e) =>
                                setInlinePrices((prev) => ({
                                  ...prev,
                                  [item.id]: Number(e.target.value),
                                }))
                              }
                              aria-label={`Price for ${item.name}`}
                              className="w-20 h-8 px-2 rounded border border-[#cbd5e1] bg-white font-mono-data tabular-nums text-xs font-bold"
                            />
                            {dirtyPrice && (
                              <button
                                type="button"
                                onClick={() => void handleQuickPriceSave(item)}
                                className="h-8 px-2.5 rounded bg-[#0f172a] text-white text-[11px] font-semibold"
                              >
                                Save
                              </button>
                            )}
                          </div>
                          {hasDiscount && (
                            <p className="font-mono-data text-[11px] font-semibold text-[#1b4d3e] mt-1">
                              Offer: ₹{item.discount_price_inr}{' '}
                              <del className="text-[#94a3b8] font-normal">₹{item.price_inr}</del>
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#475569] whitespace-nowrap">
                          {[
                            item.is_bestseller ? 'Bestseller' : null,
                            item.is_featured ? 'Featured' : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Standard'}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => void handleToggleAvailable(item)}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold border ${
                              item.available
                                ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#16a34a]'
                                : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
                            }`}
                          >
                            {item.available ? 'Available' : 'Unavailable'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setEditing({
                                  id: item.id,
                                  cafe_id: item.cafe_id,
                                  name: item.name,
                                  category: item.category,
                                  description: item.description,
                                  price_inr: item.price_inr,
                                  discount_price_inr:
                                    item.discount_price_inr !== null &&
                                    item.discount_price_inr !== undefined
                                      ? item.discount_price_inr
                                      : '',
                                  photo_url: item.photo_url,
                                  available: item.available,
                                  dietary: item.dietary,
                                  is_bestseller: item.is_bestseller,
                                  is_featured: item.is_featured,
                                  sort_order: item.sort_order,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-[#0f172a] font-semibold"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteItem(item)}
                              aria-label={`Delete ${item.name}`}
                              className="p-1.5 rounded-md border border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="md:hidden divide-y divide-[#e2e8f0]">
              {filteredItems.map((item) => {
                const draftPrice = inlinePrices[item.id] ?? item.price_inr;
                const dirtyPrice = draftPrice !== item.price_inr;
                const hasDiscount =
                  item.discount_price_inr !== null &&
                  item.discount_price_inr !== undefined &&
                  item.discount_price_inr < item.price_inr;
                return (
                  <div key={item.id} className="p-4 space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {item.photo_url && (
                          <img
                            src={item.photo_url}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-lg object-cover border border-[#e2e8f0] shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-[#0f172a]">{item.name}</p>
                          <p className="text-[#64748b]">
                            {item.category}
                            {item.dietary !== 'na'
                              ? ` · ${item.dietary === 'non_veg' ? 'Non-Veg' : item.dietary === 'vegan' ? 'Vegan' : 'Veg'}`
                              : ''}
                          </p>
                          {hasDiscount && (
                            <p className="font-mono-data text-[#1b4d3e] font-semibold mt-0.5">
                              Offer: ₹{item.discount_price_inr}{' '}
                              <del className="text-[#94a3b8] font-normal">₹{item.price_inr}</del>
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleToggleAvailable(item)}
                        className={`min-h-[36px] px-2.5 py-1 rounded text-[11px] font-semibold border shrink-0 ${
                          item.available
                            ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#16a34a]'
                            : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
                        }`}
                      >
                        {item.available ? 'Available' : 'Out'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[#475569] font-semibold">Regular ₹</span>
                      <input
                        type="number"
                        min={0}
                        value={draftPrice}
                        onChange={(e) =>
                          setInlinePrices((prev) => ({
                            ...prev,
                            [item.id]: Number(e.target.value),
                          }))
                        }
                        aria-label={`Price for ${item.name}`}
                        className="w-24 h-11 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data font-bold"
                      />
                      {dirtyPrice && (
                        <button
                          type="button"
                          onClick={() => void handleQuickPriceSave(item)}
                          className="min-h-[44px] px-3 rounded-lg bg-[#0f172a] text-white font-semibold"
                        >
                          Save
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            id: item.id,
                            cafe_id: item.cafe_id,
                            name: item.name,
                            category: item.category,
                            description: item.description,
                            price_inr: item.price_inr,
                            discount_price_inr:
                              item.discount_price_inr !== null &&
                              item.discount_price_inr !== undefined
                                ? item.discount_price_inr
                                : '',
                            photo_url: item.photo_url,
                            available: item.available,
                            dietary: item.dietary,
                            is_bestseller: item.is_bestseller,
                            is_featured: item.is_featured,
                            sort_order: item.sort_order,
                          })
                        }
                        className="ml-auto min-h-[44px] px-3.5 rounded-lg border border-[#cbd5e1] bg-white font-semibold text-[#0f172a] inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteItem(item)}
                        aria-label={`Delete ${item.name}`}
                        className="min-h-[44px] min-w-[44px] rounded-lg border border-[#fecaca] text-[#dc2626] flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Single Item Modal */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editing.id ? 'Edit Menu Item' : 'Add Menu Item'}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveSingle}
            className="bg-white rounded-2xl border border-[#e2e8f0] max-w-xl w-full overflow-hidden shadow-xl"
          >
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <h3 className="font-semibold text-base text-[#0f172a]">
                {editing.id ? `Edit ${editing.name}` : `Add Menu Item · ${selectedCafe?.name ?? ''}`}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close modal"
                className="w-8 h-8 rounded-lg border border-[#e2e8f0] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[#475569] mb-1">Item Name *</label>
                  <input
                    type="text"
                    required
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="e.g. Filter Kaapi / Iced Pour Over"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Category *</label>
                  <select
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  >
                    {MENU_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Regular Price (₹ INR) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editing.price_inr}
                    onChange={(e) => setEditing({ ...editing, price_inr: Number(e.target.value) })}
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">
                    Discounted Price (₹ INR · optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Leave empty for no discount"
                    value={editing.discount_price_inr}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        discount_price_inr: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Dietary Indicator</label>
                  <select
                    value={editing.dietary}
                    onChange={(e) =>
                      setEditing({ ...editing, dietary: e.target.value as DietaryType })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  >
                    <option value="veg">Veg</option>
                    <option value="non_veg">Non-Veg</option>
                    <option value="vegan">Vegan</option>
                    <option value="na">Not Applicable / Beverage</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) =>
                      setEditing({ ...editing, sort_order: Number(e.target.value) })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">Short Description</label>
                <textarea
                  rows={2}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Optional tasting notes or portion details"
                  className="w-full p-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">Item Photo (optional)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editing.photo_url}
                    onChange={(e) => setEditing({ ...editing, photo_url: e.target.value })}
                    placeholder="https://... or /uploads/..."
                    className="flex-1 h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="inline-flex items-center gap-1 h-10 px-3 rounded-lg border border-[#cbd5e1] font-semibold"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Pick</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-2">
                <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.available}
                    onChange={(e) => setEditing({ ...editing, available: e.target.checked })}
                    className="accent-[#16a34a]"
                  />
                  <span>Available</span>
                </label>
                <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.is_bestseller}
                    onChange={(e) => setEditing({ ...editing, is_bestseller: e.target.checked })}
                    className="accent-[#b45309]"
                  />
                  <span>Bestseller</span>
                </label>
                <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.is_featured}
                    onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })}
                    className="accent-[#1d4ed8]"
                  />
                  <span>Featured Special</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-9 px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-5 rounded-lg bg-[#0f172a] text-white text-xs font-semibold"
              >
                {saving ? 'Saving...' : 'Save Menu Item'}
              </button>
            </div>
          </form>

          <MediaPickerModal
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            media={media}
            csrfToken={csrfToken}
            onMediaUploaded={onMediaUploaded}
            defaultCategory="Menu & Beverages"
            title="Select Menu Item Photo"
            onSelect={(url) => setEditing({ ...editing, photo_url: url })}
          />
        </div>
      )}

      {/* Bulk Multi-Item Add Modal */}
      {bulkOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bulk add menu items"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleBulkSubmit}
            className="bg-white rounded-2xl border border-[#e2e8f0] max-w-3xl w-full overflow-hidden shadow-xl"
          >
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <h3 className="font-semibold text-base text-[#0f172a]">
                Bulk Add Menu Items · {selectedCafe?.name ?? ''}
              </h3>
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                className="w-8 h-8 rounded-lg border border-[#e2e8f0] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto text-xs">
              {bulkRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Item name *"
                    value={row.name}
                    onChange={(e) => {
                      const next = [...bulkRows];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setBulkRows(next);
                    }}
                    className="col-span-4 h-9 px-2.5 rounded border border-[#cbd5e1] bg-[#f8fafc]"
                  />
                  <select
                    value={row.category}
                    onChange={(e) => {
                      const next = [...bulkRows];
                      next[idx] = { ...next[idx], category: e.target.value };
                      setBulkRows(next);
                    }}
                    className="col-span-3 h-9 px-2 rounded border border-[#cbd5e1] bg-[#f8fafc]"
                  >
                    {MENU_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    placeholder="₹"
                    value={row.price_inr}
                    onChange={(e) => {
                      const next = [...bulkRows];
                      next[idx] = { ...next[idx], price_inr: Number(e.target.value) };
                      setBulkRows(next);
                    }}
                    className="col-span-2 h-9 px-2 rounded border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                  <select
                    value={row.dietary}
                    onChange={(e) => {
                      const next = [...bulkRows];
                      next[idx] = { ...next[idx], dietary: e.target.value as DietaryType };
                      setBulkRows(next);
                    }}
                    className="col-span-2 h-9 px-2 rounded border border-[#cbd5e1] bg-[#f8fafc]"
                  >
                    <option value="veg">Veg</option>
                    <option value="non_veg">Non-Veg</option>
                    <option value="vegan">Vegan</option>
                    <option value="na">N/A</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setBulkRows(bulkRows.filter((_, i) => i !== idx))}
                    disabled={bulkRows.length <= 1}
                    className="col-span-1 h-9 rounded border border-[#fecaca] text-[#dc2626] flex items-center justify-center disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setBulkRows([
                    ...bulkRows,
                    { name: '', category: 'Coffee', price_inr: 150, dietary: 'veg', description: '' },
                  ])
                }
                className="text-xs font-semibold text-[#b45309] hover:underline"
              >
                + Add another row
              </button>
            </div>
            <div className="px-6 py-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                className="h-9 px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-5 rounded-lg bg-[#0f172a] text-white text-xs font-semibold"
              >
                {saving ? 'Adding...' : 'Add All Menu Items'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete menu item"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#0f172a]">Delete Menu Item?</h3>
            <p className="text-xs text-[#475569] leading-relaxed">
              Are you sure you want to permanently remove{' '}
              <strong className="text-[#0f172a]">{confirmDeleteItem.name}</strong> (₹
              {confirmDeleteItem.price_inr}) from this cafe&apos;s menu?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                className="h-9 px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="h-9 px-4 rounded-lg bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-semibold"
              >
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

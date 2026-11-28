import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Bookmark,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  Coffee,
  Heart,
  Loader2,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Tag,
  Upload,
  Wifi,
} from 'lucide-react';
import { getUserAuthHeaders, resolveApiUrl, useAuth } from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import type {
  CafeClaimRequestRecord,
  CafePromotionRecord,
  OwnerChangeRequestRecord,
} from '../types/cms';
import { useDocumentMeta } from '../utils/cafeHelpers';

interface OwnedCafeSummary {
  id: string;
  slug: string;
  name: string;
  area: string;
  address: string;
  timings: string;
  phone: string;
  website_url: string;
  menu_url: string;
  instagram_url: string;
  wifi_available: string;
  wifi_mbps: number | null;
  charging_sockets: string;
  sockets_count: number | null;
  avg_cost_per_person: number | null;
  coffee_price: string;
  tea_price: string;
  snacks_price: string;
  desserts_price: string;
  meals_price: string;
  offers: string[];
  photos: string[];
  verified: boolean;
  owner_verified: boolean;
  last_verified_date: string;
  engagement: {
    savesCount: number;
    followersCount: number;
    reviewsCount: number;
    bookingsCount: number;
  };
}

interface PortalPayload {
  promotionsEnabled: boolean;
  ownerProfile: {
    id: number;
    user_id: number;
    business_name: string;
    owner_name: string;
    phone: string;
    email: string;
    plan_tier: string;
    status: string;
  };
  ownedCafes: OwnedCafeSummary[];
  claims: CafeClaimRequestRecord[];
  changeRequests: OwnerChangeRequestRecord[];
  promotions: CafePromotionRecord[];
  directoryOptions: Array<{
    id: string;
    slug: string;
    name: string;
    area: string;
    isClaimed: boolean;
    claimedByYou: boolean;
  }>;
}

export function PartnerPortalPage() {
  const { settings, isFeatureEnabled } = useCms();
  const { loading: authLoading, authenticated, user } = useAuth();

  useDocumentMeta(
    `Cafe Owner Partner Portal | ${settings.brand_name}`,
    'Claim your Bengaluru cafe listing, manage menus and workspace facilities, track engagement, and request transparent promotions.',
    { allowIndexing: false }
  );

  const [portal, setPortal] = useState<PortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState<'listings' | 'claim' | 'promotions' | 'history'>('listings');

  // Claim form state
  const [claimCafeId, setClaimCafeId] = useState('');
  const [claimOwnerName, setClaimOwnerName] = useState('');
  const [claimPhone, setClaimPhone] = useState('');
  const [claimEmail, setClaimEmail] = useState('');
  const [claimProof, setClaimProof] = useState('');
  const [claimNotes, setClaimNotes] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimMsg, setClaimMsg] = useState('');
  const [claimErr, setClaimErr] = useState('');

  // Edit / Change request form state
  const [selectedCafeId, setSelectedCafeId] = useState('');
  const [editTab, setEditTab] = useState<'cafe_info' | 'menu_update' | 'offer' | 'photo'>('cafe_info');
  const [editTimings, setEditTimings] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editWifiAvail, setEditWifiAvail] = useState('yes');
  const [editWifiMbps, setEditWifiMbps] = useState('');
  const [editSocketsAvail, setEditSocketsAvail] = useState('yes');
  const [editSocketsCount, setEditSocketsCount] = useState('');
  const [editAvgCost, setEditAvgCost] = useState('');
  const [editTeaPrice, setEditTeaPrice] = useState('');
  const [editCoffeePrice, setEditCoffeePrice] = useState('');
  const [editSnacksPrice, setEditSnacksPrice] = useState('');
  const [editDessertsPrice, setEditDessertsPrice] = useState('');
  const [editOfferText, setEditOfferText] = useState('');
  const [editPhotoDataUrl, setEditPhotoDataUrl] = useState('');
  const [editPhotoCaption, setEditPhotoCaption] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editMsg, setEditMsg] = useState('');
  const [editErr, setEditErr] = useState('');

  // Promotion form state
  const [promoCafeId, setPromoCafeId] = useState('');
  const [promoTitle, setPromoTitle] = useState('');
  const [promoPlacement, setPromoPlacement] = useState<'homepage' | 'category' | 'city'>('homepage');
  const [promoBudget, setPromoBudget] = useState('1499');
  const [promoDays, setPromoDays] = useState('30');
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMsg, setPromoMsg] = useState('');
  const [promoErr, setPromoErr] = useState('');

  const loadPortal = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(resolveApiUrl('/api/owner/portal'), {
        credentials: 'include',
        headers: await getUserAuthHeaders(),
      });
      const data = (await res.json().catch(() => ({}))) as PortalPayload & { error?: string };
      if (!res.ok) {
        setLoadError(data.error || 'Could not load Partner Portal.');
        setPortal(null);
        return;
      }
      setPortal(data);
      if (data.ownedCafes.length > 0) {
        setSelectedCafeId((prev) => prev || data.ownedCafes[0].id);
        setPromoCafeId((prev) => prev || data.ownedCafes[0].id);
      } else {
        setActiveTab('claim');
      }
      if (data.directoryOptions.length > 0) {
        const firstUnclaimed = data.directoryOptions.find((d) => !d.isClaimed);
        setClaimCafeId((prev) => prev || firstUnclaimed?.id || data.directoryOptions[0].id);
      }
    } catch {
      setLoadError('Network error loading Partner Portal.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      setClaimOwnerName((p) => p || user.name || '');
      setClaimEmail((p) => p || user.email || '');
      setClaimPhone((p) => p || user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && authenticated) {
      void loadPortal();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, authenticated, loadPortal]);

  // Populate editor fields when switching owned cafe
  useEffect(() => {
    const cafe = portal?.ownedCafes.find((c) => c.id === selectedCafeId);
    if (!cafe) return;
    setEditTimings(cafe.timings);
    setEditPhone(cafe.phone);
    setEditWebsite(cafe.website_url);
    setEditWifiAvail(cafe.wifi_available || 'unknown');
    setEditWifiMbps(cafe.wifi_mbps !== null ? String(cafe.wifi_mbps) : '');
    setEditSocketsAvail(cafe.charging_sockets || 'unknown');
    setEditSocketsCount(cafe.sockets_count !== null ? String(cafe.sockets_count) : '');
    setEditAvgCost(cafe.avg_cost_per_person !== null ? String(cafe.avg_cost_per_person) : '');
    setEditTeaPrice(cafe.tea_price || '');
    setEditCoffeePrice(cafe.coffee_price || '');
    setEditSnacksPrice(cafe.snacks_price || '');
    setEditDessertsPrice(cafe.desserts_price || '');
  }, [selectedCafeId, portal]);

  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#b45309] mx-auto" />
        <p className="text-sm text-[#5c4e45]">Loading Cafe Owner Partner Portal…</p>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent('/partner-portal')}`} replace />;
  }

  if (!isFeatureEnabled('owner_portal') || loadError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <Building2 className="w-10 h-10 text-[#b45309] mx-auto" />
        <h1 className="font-serif-display text-3xl font-bold text-[#1c1613]">
          Cafe Owner Partner Portal
        </h1>
        <p className="text-sm text-[#5c4e45]">
          {loadError || 'Partner Portal is currently paused by platform administrators.'}
        </p>
        <Link
          to="/owners"
          className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] text-white text-xs font-semibold"
        >
          View Owner Information
        </Link>
      </div>
    );
  }

  const ownedCafes = portal?.ownedCafes || [];
  const selectedCafe = ownedCafes.find((c) => c.id === selectedCafeId) || ownedCafes[0] || null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <header className="rounded-2xl bg-white border border-[#e6ddd0] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#b45309]">
            <Building2 className="w-4 h-4" />
            <span>CafeDesk Partner Ecosystem</span>
          </div>
          <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#1c1613]">
            Cafe Owner Portal
          </h1>
          <p className="text-sm text-[#5c4e45] max-w-2xl">
            Claim your Bengaluru cafe listing, verify business details, submit menu &amp; facility updates for moderation, and track real community engagement.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/account"
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#faf7f2] border border-[#d6cbba] hover:border-[#b45309] text-xs font-semibold text-[#1c1613] inline-flex items-center"
          >
            My Account
          </Link>
          <Link
            to="/owners"
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1c1613] text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <span>Partner Plans</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav aria-label="Partner portal sections" className="flex flex-wrap gap-2">
        {[
          { id: 'listings' as const, label: `My Cafes (${ownedCafes.length})` },
          { id: 'claim' as const, label: `Claim a Cafe (${portal?.claims.length || 0})` },
          { id: 'promotions' as const, label: 'Sponsored Spotlights' },
          { id: 'history' as const, label: `Change Requests (${portal?.changeRequests.length || 0})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              activeTab === tab.id
                ? 'bg-[#1c1613] border-[#1c1613] text-white'
                : 'bg-white border-[#e6ddd0] text-[#1c1613] hover:border-[#b45309]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* TAB 1: My Claimed Cafes & Updates */}
      {activeTab === 'listings' && (
        <div className="space-y-6">
          {ownedCafes.length === 0 ? (
            <div className="rounded-2xl bg-white border border-dashed border-[#d6cbba] p-8 sm:p-10 text-center space-y-4">
              <ShieldCheck className="w-10 h-10 text-[#b45309] mx-auto" />
              <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
                No Verified Cafe Ownership Yet
              </h2>
              <p className="text-sm text-[#5c4e45] max-w-md mx-auto">
                Submit a cafe ownership claim with proof of business ownership. Once verified by a CafeDesk administrator, you can update menus, upload official photos, and track engagement here.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('claim')}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold"
              >
                Claim Your Cafe Listing
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownedCafes.map((cafe) => (
                  <div
                    key={cafe.id}
                    onClick={() => setSelectedCafeId(cafe.id)}
                    className={`rounded-2xl border p-5 cursor-pointer transition-colors space-y-3 ${
                      selectedCafe?.id === cafe.id
                        ? 'bg-white border-[#b45309] ring-1 ring-[#b45309]'
                        : 'bg-white border-[#e6ddd0] hover:border-[#b45309]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-[#b45309]">{cafe.area}</p>
                        <h3 className="font-serif-display text-xl font-bold text-[#1c1613]">
                          {cafe.name}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#ecfdf5] border border-[#bbf7d0] text-[#1b4d3e] text-[10px] font-semibold">
                        Owner Verified
                      </span>
                    </div>

                    <dl className="grid grid-cols-4 gap-2 pt-2 border-t border-[#e6ddd0] text-center font-mono-data tabular-nums">
                      <div>
                        <dt className="text-[10px] text-[#5c4e45] uppercase">Saves</dt>
                        <dd className="text-sm font-bold text-[#1c1613]">{cafe.engagement.savesCount}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] text-[#5c4e45] uppercase">Followers</dt>
                        <dd className="text-sm font-bold text-[#1c1613]">{cafe.engagement.followersCount}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] text-[#5c4e45] uppercase">Reviews</dt>
                        <dd className="text-sm font-bold text-[#1c1613]">{cafe.engagement.reviewsCount}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] text-[#5c4e45] uppercase">Bookings</dt>
                        <dd className="text-sm font-bold text-[#1c1613]">{cafe.engagement.bookingsCount}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>

              {selectedCafe && (
                <section className="rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-7 space-y-5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6ddd0] pb-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#1b4d3e]">
                        Moderated Listing Editor
                      </p>
                      <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
                        Submit Update for {selectedCafe.name}
                      </h2>
                      <p className="text-xs text-[#5c4e45]">
                        Updates go through quick admin approval before publishing. Cafe followers receive update notifications automatically.
                      </p>
                    </div>
                    <Link
                      to={`/cafe/${encodeURIComponent(selectedCafe.slug)}`}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] text-xs font-semibold text-[#1c1613] inline-flex items-center gap-1"
                    >
                      <span>View Live Listing</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {[
                      { id: 'cafe_info' as const, label: 'Business & Facilities', icon: Wifi },
                      { id: 'menu_update' as const, label: 'Menu & Prices', icon: Coffee },
                      { id: 'offer' as const, label: 'Member Offers', icon: Tag },
                      { id: 'photo' as const, label: 'Upload Official Photo', icon: Camera },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setEditTab(t.id);
                          setEditMsg('');
                          setEditErr('');
                        }}
                        className={`min-h-[40px] px-3.5 py-2 rounded-xl font-semibold border inline-flex items-center gap-1.5 ${
                          editTab === t.id
                            ? 'bg-[#b45309] border-[#b45309] text-white'
                            : 'bg-[#faf7f2] border-[#e6ddd0] text-[#1c1613]'
                        }`}
                      >
                        <t.icon className="w-3.5 h-3.5" />
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>

                  {editErr && (
                    <p role="alert" className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-xs font-medium">
                      {editErr}
                    </p>
                  )}
                  {editMsg && (
                    <p className="p-3 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-[#1b4d3e] text-xs font-medium">
                      {editMsg}
                    </p>
                  )}

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setEditBusy(true);
                      setEditErr('');
                      setEditMsg('');
                      try {
                        const body =
                          editTab === 'cafe_info'
                            ? {
                                changeType: 'cafe_info',
                                timings: editTimings,
                                phone: editPhone,
                                website_url: editWebsite,
                                wifi_available: editWifiAvail,
                                wifi_mbps: editWifiMbps ? Number(editWifiMbps) : undefined,
                                charging_sockets: editSocketsAvail,
                                sockets_count: editSocketsCount ? Number(editSocketsCount) : undefined,
                              }
                            : editTab === 'menu_update'
                            ? {
                                changeType: 'menu_update',
                                avg_cost_per_person: editAvgCost ? Number(editAvgCost) : undefined,
                                tea_price: editTeaPrice,
                                coffee_price: editCoffeePrice,
                                snacks_price: editSnacksPrice,
                                desserts_price: editDessertsPrice,
                              }
                            : editTab === 'offer'
                            ? {
                                changeType: 'offer',
                                offerText: editOfferText,
                                offers: selectedCafe.offers,
                              }
                            : {
                                changeType: 'photo',
                                photoDataUrl: editPhotoDataUrl,
                                caption: editPhotoCaption,
                              };

                        const res = await fetch(
                          resolveApiUrl(
                            `/api/owner/listings/${encodeURIComponent(selectedCafe.id)}/request-change`
                          ),
                          {
                            method: 'POST',
                            credentials: 'include',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(await getUserAuthHeaders()),
                            },
                            body: JSON.stringify(body),
                          }
                        );
                        const data = (await res.json().catch(() => ({}))) as {
                          error?: string;
                          message?: string;
                        };
                        if (!res.ok) {
                          setEditErr(data.error || 'Could not submit change request.');
                          return;
                        }
                        setEditMsg(data.message || 'Change request queued for admin review.');
                        setEditOfferText('');
                        setEditPhotoDataUrl('');
                        setEditPhotoCaption('');
                        await loadPortal();
                      } catch {
                        setEditErr('Network error submitting change request.');
                      } finally {
                        setEditBusy(false);
                      }
                    }}
                    className="space-y-4 text-xs"
                  >
                    {editTab === 'cafe_info' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-semibold text-[#5c4e45] mb-1">Opening Hours</label>
                          <input
                            type="text"
                            value={editTimings}
                            onChange={(e) => setEditTimings(e.target.value)}
                            className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#5c4e45] mb-1">Contact Phone</label>
                          <input
                            type="text"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#5c4e45] mb-1">Website URL</label>
                          <input
                            type="url"
                            value={editWebsite}
                            onChange={(e) => setEditWebsite(e.target.value)}
                            className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#5c4e45] mb-1">Wi-Fi Available</label>
                          <select
                            value={editWifiAvail}
                            onChange={(e) => setEditWifiAvail(e.target.value)}
                            className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                            <option value="unknown">Unknown</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-[#5c4e45] mb-1">Wi-Fi Speed (Mbps)</label>
                          <input
                            type="number"
                            min={0}
                            max={2000}
                            value={editWifiMbps}
                            onChange={(e) => setEditWifiMbps(e.target.value)}
                            className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] font-mono-data text-[#1c1613]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#5c4e45] mb-1">Charging Sockets Count</label>
                          <input
                            type="number"
                            min={0}
                            max={200}
                            value={editSocketsCount}
                            onChange={(e) => setEditSocketsCount(e.target.value)}
                            className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] font-mono-data text-[#1c1613]"
                          />
                        </div>
                      </div>
                    )}

                    {editTab === 'menu_update' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-semibold text-[#5c4e45] mb-1">Avg Spend / Person (₹)</label>
                          <input
                            type="number"
                            min={20}
                            max={5000}
                            value={editAvgCost}
                            onChange={(e) => setEditAvgCost(e.target.value)}
                            className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] font-mono-data text-[#1c1613]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#5c4e45] mb-1">Tea / Chai Range</label>
                          <input
                            type="text"
                            value={editTeaPrice}
                            onChange={(e) => setEditTeaPrice(e.target.value)}
                            placeholder="e.g. ₹25 – ₹60"
                            className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#5c4e45] mb-1">Coffee Range</label>
                          <input
                            type="text"
                            value={editCoffeePrice}
                            onChange={(e) => setEditCoffeePrice(e.target.value)}
                            placeholder="e.g. ₹90 – ₹220"
                            className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#5c4e45] mb-1">Snacks Range</label>
                          <input
                            type="text"
                            value={editSnacksPrice}
                            onChange={(e) => setEditSnacksPrice(e.target.value)}
                            placeholder="e.g. ₹60 – ₹180"
                            className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#5c4e45] mb-1">Desserts Range</label>
                          <input
                            type="text"
                            value={editDessertsPrice}
                            onChange={(e) => setEditDessertsPrice(e.target.value)}
                            placeholder="e.g. ₹140 – ₹260"
                            className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
                          />
                        </div>
                      </div>
                    )}

                    {editTab === 'offer' && (
                      <div className="space-y-2.5">
                        <label className="block font-semibold text-[#5c4e45]">
                          Add Offer or Student / Plus Member Perk
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={120}
                          value={editOfferText}
                          onChange={(e) => setEditOfferText(e.target.value)}
                          placeholder="e.g. 15% off weekday filter coffee for CafeDesk Plus members"
                          className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
                        />
                        {selectedCafe.offers.length > 0 && (
                          <p className="text-[11px] text-[#5c4e45]">
                            Current offers: {selectedCafe.offers.join(' · ')}
                          </p>
                        )}
                      </div>
                    )}

                    {editTab === 'photo' && (
                      <div className="space-y-3">
                        <label className="min-h-[44px] px-4 py-2.5 rounded-xl border border-dashed border-[#b45309] bg-[#faf7f2] font-semibold flex items-center justify-center gap-2 cursor-pointer text-[#1c1613]">
                          <Upload className="w-4 h-4 text-[#b45309]" />
                          <span>{editPhotoDataUrl ? 'Change Photo' : 'Upload Official Cafe Photo (PNG/JPG/WebP)'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              const reader = new FileReader();
                              reader.onload = () => setEditPhotoDataUrl(String(reader.result || ''));
                              reader.readAsDataURL(f);
                            }}
                          />
                        </label>
                        {editPhotoDataUrl && (
                          <img
                            src={editPhotoDataUrl}
                            alt="Official upload preview"
                            className="h-44 w-auto object-cover rounded-xl border border-[#e6ddd0]"
                          />
                        )}
                        <input
                          type="text"
                          value={editPhotoCaption}
                          onChange={(e) => setEditPhotoCaption(e.target.value)}
                          placeholder="Photo caption (e.g. Quiet upper loft work corner)"
                          className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={editBusy || (editTab === 'photo' && !editPhotoDataUrl)}
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] disabled:opacity-60 text-white font-semibold transition-colors"
                    >
                      {editBusy ? 'Submitting...' : 'Submit Update for Approval'}
                    </button>
                  </form>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: Claim a Cafe Listing */}
      {activeTab === 'claim' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setClaimBusy(true);
              setClaimErr('');
              setClaimMsg('');
              try {
                const res = await fetch(resolveApiUrl('/api/owner/claims'), {
                  method: 'POST',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(await getUserAuthHeaders()),
                  },
                  body: JSON.stringify({
                    cafeId: claimCafeId,
                    ownerName: claimOwnerName,
                    phone: claimPhone,
                    email: claimEmail,
                    verificationProof: claimProof,
                    notes: claimNotes,
                  }),
                });
                const data = (await res.json().catch(() => ({}))) as {
                  error?: string;
                  message?: string;
                };
                if (!res.ok) {
                  setClaimErr(data.error || 'Could not submit ownership claim.');
                  return;
                }
                setClaimMsg(data.message || 'Ownership claim submitted.');
                setClaimProof('');
                setClaimNotes('');
                await loadPortal();
              } catch {
                setClaimErr('Network error submitting claim.');
              } finally {
                setClaimBusy(false);
              }
            }}
            className="lg:col-span-7 rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-6 space-y-4 text-xs shadow-xs"
          >
            <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
              Claim a Bengaluru Cafe Listing
            </h2>
            {claimErr && (
              <p role="alert" className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] font-medium">
                {claimErr}
              </p>
            )}
            {claimMsg && (
              <p className="p-3 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-[#1b4d3e] font-medium">
                {claimMsg}
              </p>
            )}

            <div>
              <label className="block font-semibold text-[#5c4e45] mb-1">Select Cafe *</label>
              <select
                value={claimCafeId}
                onChange={(e) => setClaimCafeId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
              >
                {(portal?.directoryOptions || []).map((opt) => (
                  <option key={opt.id} value={opt.id} disabled={opt.isClaimed && !opt.claimedByYou}>
                    {opt.name} ({opt.area}){opt.claimedByYou ? ' · Owned by You' : opt.isClaimed ? ' · Claimed' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-[#5c4e45] mb-1">Owner / Manager Name *</label>
                <input
                  type="text"
                  required
                  value={claimOwnerName}
                  onChange={(e) => setClaimOwnerName(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#5c4e45] mb-1">Business Phone *</label>
                <input
                  type="tel"
                  required
                  value={claimPhone}
                  onChange={(e) => setClaimPhone(e.target.value)}
                  placeholder="+91 98..."
                  className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#5c4e45] mb-1">Business Email</label>
                <input
                  type="email"
                  value={claimEmail}
                  onChange={(e) => setClaimEmail(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#5c4e45] mb-1">
                Verification Proof (GSTIN / Official Instagram / Google Business link) *
              </label>
              <input
                type="text"
                required
                value={claimProof}
                onChange={(e) => setClaimProof(e.target.value)}
                placeholder="e.g. Official Instagram handle @mycafe_blr + GST or Google Business verification"
                className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#5c4e45] mb-1">Notes (Optional)</label>
              <textarea
                rows={2}
                value={claimNotes}
                onChange={(e) => setClaimNotes(e.target.value)}
                placeholder="Role at cafe, branch details..."
                className="w-full p-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
              />
            </div>

            <button
              type="submit"
              disabled={claimBusy}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] disabled:opacity-60 text-white font-semibold"
            >
              {claimBusy ? 'Submitting...' : 'Submit Ownership Claim'}
            </button>
          </form>

          <div className="lg:col-span-5 rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-6 space-y-3 shadow-xs">
            <h3 className="font-serif-display text-xl font-bold text-[#1c1613]">
              Your Submitted Claims
            </h3>
            {(portal?.claims.length || 0) === 0 ? (
              <p className="text-xs text-[#5c4e45]">No ownership claims submitted yet.</p>
            ) : (
              <ul className="space-y-2.5 text-xs">
                {portal!.claims.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-[#e6ddd0] bg-[#faf7f2] p-3.5 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#1c1613]">{c.cafe_name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          c.status === 'approved'
                            ? 'bg-[#ecfdf5] text-[#1b4d3e]'
                            : c.status === 'rejected'
                            ? 'bg-[#fef2f2] text-[#991b1b]'
                            : 'bg-[#fffbeb] text-[#92400e]'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <p className="text-[#5c4e45]">{c.verification_proof}</p>
                    {c.admin_note && <p className="text-[#1c1613] font-medium">Admin note: {c.admin_note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Transparent Sponsored Promotions */}
      {activeTab === 'promotions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPromoBusy(true);
              setPromoErr('');
              setPromoMsg('');
              try {
                const res = await fetch(resolveApiUrl('/api/owner/promotions'), {
                  method: 'POST',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(await getUserAuthHeaders()),
                  },
                  body: JSON.stringify({
                    cafeId: promoCafeId,
                    title: promoTitle,
                    placement: promoPlacement,
                    budgetInr: Number(promoBudget),
                    durationDays: Number(promoDays),
                  }),
                });
                const data = (await res.json().catch(() => ({}))) as {
                  error?: string;
                  message?: string;
                };
                if (!res.ok) {
                  setPromoErr(data.error || 'Could not request promotion.');
                  return;
                }
                setPromoMsg(data.message || 'Promotion request queued.');
                setPromoTitle('');
                await loadPortal();
              } catch {
                setPromoErr('Network error requesting promotion.');
              } finally {
                setPromoBusy(false);
              }
            }}
            className="lg:col-span-7 rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-6 space-y-4 text-xs shadow-xs"
          >
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 font-semibold text-[#b45309] uppercase tracking-wider">
                <Megaphone className="w-4 h-4" />
                <span>Transparent Paid Spotlight</span>
              </div>
              <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
                Promote Your Verified Cafe
              </h2>
              <p className="text-[#5c4e45]">
                Every promoted slot displays an explicit <strong>Sponsored</strong> label. Paid promotions never alter customer ratings, Work-Ready Score, or Information Confidence Score.
              </p>
            </div>

            {ownedCafes.length === 0 ? (
              <p className="p-3 rounded-xl bg-[#fffbeb] border border-[#fde68a] text-[#92400e]">
                Claim and verify ownership of a cafe listing first before requesting a Sponsored Spotlight.
              </p>
            ) : (
              <>
                {promoErr && (
                  <p role="alert" className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] font-medium">
                    {promoErr}
                  </p>
                )}
                {promoMsg && (
                  <p className="p-3 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-[#1b4d3e] font-medium">
                    {promoMsg}
                  </p>
                )}
                <div>
                  <label className="block font-semibold text-[#5c4e45] mb-1">Verified Cafe *</label>
                  <select
                    value={promoCafeId}
                    onChange={(e) => setPromoCafeId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
                  >
                    {ownedCafes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.area})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#5c4e45] mb-1">Campaign Headline *</label>
                  <input
                    type="text"
                    required
                    minLength={5}
                    maxLength={120}
                    value={promoTitle}
                    onChange={(e) => setPromoTitle(e.target.value)}
                    placeholder="e.g. Morning Filter Kaapi + Quiet Loft Desks in Indiranagar"
                    className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-[#5c4e45] mb-1">Placement</label>
                    <select
                      value={promoPlacement}
                      onChange={(e) =>
                        setPromoPlacement(e.target.value as 'homepage' | 'category' | 'city')
                      }
                      className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] text-[#1c1613]"
                    >
                      <option value="homepage">Homepage Spotlight</option>
                      <option value="category">Category Discovery</option>
                      <option value="city">Bengaluru Citywide</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-[#5c4e45] mb-1">Budget (INR ₹)</label>
                    <input
                      type="number"
                      min={499}
                      max={100000}
                      value={promoBudget}
                      onChange={(e) => setPromoBudget(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] font-mono-data text-[#1c1613]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#5c4e45] mb-1">Duration (Days)</label>
                    <input
                      type="number"
                      min={7}
                      max={90}
                      value={promoDays}
                      onChange={(e) => setPromoDays(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-[#d6cbba] bg-[#faf7f2] font-mono-data text-[#1c1613]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={promoBusy}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white font-semibold"
                >
                  {promoBusy ? 'Submitting...' : 'Submit Promotion Request'}
                </button>
              </>
            )}
          </form>

          <div className="lg:col-span-5 rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-6 space-y-3 shadow-xs">
            <h3 className="font-serif-display text-xl font-bold text-[#1c1613]">
              Your Promotions
            </h3>
            {(portal?.promotions.length || 0) === 0 ? (
              <p className="text-xs text-[#5c4e45]">No promotion campaigns requested yet.</p>
            ) : (
              <ul className="space-y-2.5 text-xs">
                {portal!.promotions.map((p) => (
                  <li key={p.id} className="rounded-xl border border-[#e6ddd0] bg-[#faf7f2] p-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#1c1613]">{p.title}</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] text-[10px] font-semibold uppercase">
                        {p.status}
                      </span>
                    </div>
                    <p className="font-mono-data text-[#5c4e45]">
                      {p.cafe_name} · ₹{p.budget_inr} · {p.placement}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Change Request Log */}
      {activeTab === 'history' && (
        <section className="rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-6 space-y-4 shadow-xs">
          <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
            Submitted Change Requests
          </h2>
          {(portal?.changeRequests.length || 0) === 0 ? (
            <p className="text-xs text-[#5c4e45]">No listing updates submitted yet.</p>
          ) : (
            <div className="space-y-2.5 text-xs">
              {portal!.changeRequests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-xl border border-[#e6ddd0] bg-[#faf7f2] p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[#1c1613]">
                      {req.cafe_name || req.cafe_id} ·{' '}
                      <span className="capitalize">{req.change_type.replace('_', ' ')}</span>
                    </p>
                    <p className="text-[#5c4e45]">{req.summary}</p>
                    {req.admin_note && (
                      <p className="text-[#1b4d3e] font-medium">Reviewer note: {req.admin_note}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        req.status === 'approved'
                          ? 'bg-[#ecfdf5] text-[#1b4d3e]'
                          : req.status === 'rejected'
                          ? 'bg-[#fef2f2] text-[#991b1b]'
                          : 'bg-[#fffbeb] text-[#92400e]'
                      }`}
                    >
                      {req.status}
                    </span>
                    <span className="font-mono-data text-[#5c4e45]">
                      {new Date(req.created_at).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

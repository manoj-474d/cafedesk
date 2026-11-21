import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Info,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { PlanTier, SubscriptionPlan } from '../../types/subscription';
import type { AdminSubscriptionOverviewPayload } from './AdminSubscriptionsTab';

const PLAN_PRESETS = [
  {
    label: 'Daily Pass (₹49 / 1d)',
    name: 'Daily Work Pass',
    price_inr: 49,
    interval_days: 1,
    badge_text: 'Day Pass',
    promo_note: '24-hour full workspace & menu access',
    usage_limits: 'Up to 10 cafe comparisons/day',
    tagline: 'Instant 1-day pass for full Wi-Fi speeds, menu prices & deals.',
    features:
      'Full food & beverage menus & INR prices\nVerified Wi-Fi speeds & socket audits\nCompare up to 4 cafes side-by-side\nValid for 24 hours',
  },
  {
    label: 'Weekly Pass (₹149 / 7d)',
    name: 'Weekly Remote Pass',
    price_inr: 149,
    interval_days: 7,
    badge_text: '7-Day Sprint',
    promo_note: 'Popular with remote sprints & travellers',
    usage_limits: 'Unlimited comparisons & saved lists',
    tagline: 'Ideal for a workation week across Bengaluru coffee neighbourhoods.',
    features:
      'Full food & beverage menus & INR prices\nVerified Wi-Fi speeds & quiet study filters\nCompare up to 4 cafes side-by-side\nExclusive partner cafe discounts',
  },
  {
    label: 'Student Plan (₹49 / 30d)',
    name: 'Student Scholar Plan',
    price_inr: 49,
    interval_days: 30,
    badge_text: 'Student Saver',
    promo_note: 'Built for Bengaluru college & exam prep',
    usage_limits: '30-day cycle · 5 custom study collections',
    tagline: 'Affordable monthly access to quiet study cafes, plug counts & budget snacks.',
    features:
      'Budget & student-friendly filter presets\nFull snack, chai & filter coffee menu prices\nVerified study ambience & power socket counts\nStudent cafe discount perks',
  },
  {
    label: 'Monthly Pro (₹99 / 30d)',
    name: 'Cafe Desk Pro Monthly',
    price_inr: 99,
    interval_days: 30,
    badge_text: 'Pro Monthly',
    promo_note: 'Full feature access',
    usage_limits: 'Unlimited collections, alerts & bookings',
    tagline: 'Complete discovery suite for daily remote workers & founders.',
    features:
      'Everything in Free Explorer\nFull food & beverage prices + avg spend\nVerified Wi-Fi Mbps speeds & meeting booths\nUnlimited collections & priority seat requests',
  },
  {
    label: 'Annual Saver (₹499 / 365d)',
    name: 'Annual Workspace Pass',
    price_inr: 499,
    interval_days: 365,
    badge_text: 'Best Value',
    promo_note: 'Save over 45% vs monthly billing',
    usage_limits: 'Unlimited access for 365 days',
    tagline: 'Year-round access to Bengaluru’s complete verified cafe workspace directory.',
    features:
      'Everything in Pro Monthly for 365 days\nExclusive partner cafe perks & offers\nUnlimited custom collections & comparisons',
  },
];

export function AdminPlansTab({ csrfToken }: { csrfToken: string }) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [editingPlans, setEditingPlans] = useState<Record<string, SubscriptionPlan>>({});
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  // Create custom plan modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState(149);
  const [newPlanInterval, setNewPlanInterval] = useState(30);
  const [newPlanBadge, setNewPlanBadge] = useState('New');
  const [newPlanPromo, setNewPlanPromo] = useState('');
  const [newPlanLimits, setNewPlanLimits] = useState('');
  const [newPlanRecommended, setNewPlanRecommended] = useState(false);
  const [newPlanTagline, setNewPlanTagline] = useState('');
  const [newPlanFeatures, setNewPlanFeatures] = useState(
    'Unlimited cafe comparisons\nPriority Wi-Fi speed insights\nSaved collections across Bengaluru'
  );
  const [creating, setCreating] = useState(false);

  // Delete plan confirmation modal
  const [confirmDeletePlan, setConfirmDeletePlan] = useState<SubscriptionPlan | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/subscriptions/overview', { credentials: 'include' });
      if (res.ok) {
        const payload = (await res.json()) as AdminSubscriptionOverviewPayload;
        setPlans(payload.plans);
        const mapped: Record<string, SubscriptionPlan> = {};
        payload.plans.forEach((p) => {
          mapped[p.id] = { ...p };
        });
        setEditingPlans(mapped);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const handleSavePlan = async (planId: PlanTier) => {
    const draft = editingPlans[planId];
    if (!draft) return;
    setSavingId(planId);
    setStatusMsg('');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/subscriptions/plans/${encodeURIComponent(planId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        setStatusMsg(`Saved pricing, promo note & features for ${draft.name}.`);
        await loadPlans();
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(err.error || 'Failed to save subscription plan.');
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateCustomPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setStatusMsg('');
    setErrorMsg('');
    try {
      const features = newPlanFeatures
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch('/api/admin/subscriptions/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newPlanName,
          price_inr: Number(newPlanPrice),
          interval_days: Number(newPlanInterval),
          badge_text: newPlanBadge,
          promo_note: newPlanPromo,
          usage_limits: newPlanLimits,
          is_recommended: newPlanRecommended,
          tagline: newPlanTagline,
          features,
          active: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not create custom plan.');
        return;
      }
      setCreateOpen(false);
      setNewPlanName('');
      setNewPlanPromo('');
      setNewPlanLimits('');
      setNewPlanRecommended(false);
      setNewPlanTagline('');
      setStatusMsg(`Created custom plan "${newPlanName}". Live on public Pricing page.`);
      await loadPlans();
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!confirmDeletePlan) return;
    const target = confirmDeletePlan;
    setDeletingId(target.id);
    setStatusMsg('');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/subscriptions/plans/${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken },
        credentials: 'include',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not delete subscription plan.');
        setConfirmDeletePlan(null);
        return;
      }
      setConfirmDeletePlan(null);
      setStatusMsg(`Deleted plan "${target.name}".`);
      await loadPlans();
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && plans.length === 0) {
    return (
      <div className="p-8 rounded-xl border border-[#e2e8f0] bg-white text-sm text-[#64748b]">
        Loading subscription plan definitions...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Subscription Plan Settings</h1>
          <p className="text-xs text-[#64748b]">
            Create unlimited Daily, Weekly, Monthly, Student, Annual, or Custom plans, edit prices, usage limits, and highlighted cards.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadPlans()}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Custom Plan</span>
          </button>
        </div>
      </div>

      <div className="p-3.5 rounded-xl border border-[#e2e8f0] bg-white text-xs text-[#475569] flex items-center gap-2.5">
        <Info className="w-4 h-4 text-[#b45309] shrink-0" />
        <span>
          Price updates apply to new checkouts immediately without altering existing subscribers&apos; locked{' '}
          <code className="font-mono-data bg-[#f8fafc] px-1 rounded">subscribed_price_inr</code>.
          All active plans sync automatically to the public Pricing page.
        </span>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-xs font-semibold text-[#1b4d3e] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-xs font-semibold text-[#991b1b] flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {plans.map((p) => {
          const pid = p.id;
          const draft = editingPlans[pid] ?? p;
          return (
            <div
              key={pid}
              className={`p-5 rounded-xl border bg-white space-y-4 flex flex-col justify-between ${
                draft.is_recommended ? 'border-[#b45309] ring-1 ring-[#b45309]/25' : 'border-[#e2e8f0]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#b45309] font-mono-data">
                    ID: {pid}
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f172a] cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={pid === 'free'}
                        checked={pid === 'free' ? true : Boolean(draft.active)}
                        onChange={(e) =>
                          setEditingPlans((prev) => ({
                            ...prev,
                            [pid]: { ...draft, active: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 rounded border-[#cbd5e1] accent-[#1b4d3e]"
                      />
                      <span
                        className={draft.active || pid === 'free' ? 'text-[#1b4d3e]' : 'text-[#991b1b]'}
                      >
                        {draft.active || pid === 'free' ? 'Active' : 'Disabled'}
                      </span>
                    </label>
                    {pid !== 'free' && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeletePlan(p)}
                        aria-label={`Delete plan ${draft.name}`}
                        className="p-1.5 rounded-md border border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#0f172a] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.is_recommended)}
                    onChange={(e) =>
                      setEditingPlans((prev) => ({
                        ...prev,
                        [pid]: { ...draft, is_recommended: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 rounded border-[#cbd5e1] accent-[#b45309]"
                  />
                  <span className="inline-flex items-center gap-1 text-[#b45309]">
                    <Sparkles className="w-3.5 h-3.5" />
                    Highlight as Recommended Plan
                  </span>
                </label>

                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    Plan Name
                  </label>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) =>
                      setEditingPlans((prev) => ({
                        ...prev,
                        [pid]: { ...draft, name: e.target.value },
                      }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">
                      Price (₹ INR)
                    </label>
                    <input
                      type="number"
                      min={0}
                      disabled={pid === 'free'}
                      value={draft.price_inr}
                      onChange={(e) =>
                        setEditingPlans((prev) => ({
                          ...prev,
                          [pid]: { ...draft, price_inr: Number(e.target.value) },
                        }))
                      }
                      className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] font-mono-data text-xs disabled:bg-[#f1f5f9]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">
                      Interval (Days)
                    </label>
                    <input
                      type="number"
                      min={0}
                      disabled={pid === 'free'}
                      value={draft.interval_days}
                      onChange={(e) =>
                        setEditingPlans((prev) => ({
                          ...prev,
                          [pid]: { ...draft, interval_days: Number(e.target.value) },
                        }))
                      }
                      className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] font-mono-data text-xs disabled:bg-[#f1f5f9]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">
                      Badge Label
                    </label>
                    <input
                      type="text"
                      value={draft.badge_text}
                      onChange={(e) =>
                        setEditingPlans((prev) => ({
                          ...prev,
                          [pid]: { ...draft, badge_text: e.target.value },
                        }))
                      }
                      className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">
                      Promo Note
                    </label>
                    <input
                      type="text"
                      value={draft.promo_note ?? ''}
                      onChange={(e) =>
                        setEditingPlans((prev) => ({
                          ...prev,
                          [pid]: { ...draft, promo_note: e.target.value },
                        }))
                      }
                      placeholder="e.g. Save 47%"
                      className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    Usage Limits (optional)
                  </label>
                  <input
                    type="text"
                    value={draft.usage_limits ?? ''}
                    onChange={(e) =>
                      setEditingPlans((prev) => ({
                        ...prev,
                        [pid]: { ...draft, usage_limits: e.target.value },
                      }))
                    }
                    placeholder="e.g. Unlimited comparisons · 10 collections"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    Tagline
                  </label>
                  <input
                    type="text"
                    value={draft.tagline}
                    onChange={(e) =>
                      setEditingPlans((prev) => ({
                        ...prev,
                        [pid]: { ...draft, tagline: e.target.value },
                      }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    Features (one per line)
                  </label>
                  <textarea
                    rows={5}
                    value={draft.features.join('\n')}
                    onChange={(e) =>
                      setEditingPlans((prev) => ({
                        ...prev,
                        [pid]: {
                          ...draft,
                          features: e.target.value.split('\n').map((s) => s.trim()),
                        },
                      }))
                    }
                    className="w-full p-2.5 rounded-lg border border-[#cbd5e1] text-xs"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={savingId === pid}
                onClick={() => void handleSavePlan(pid)}
                className="w-full min-h-[44px] py-2.5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-60 text-white text-xs font-semibold"
              >
                {savingId === pid ? 'Saving...' : `Save ${draft.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Create Custom Plan Modal */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create custom subscription plan"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleCreateCustomPlan}
            className="bg-white rounded-2xl border border-[#e2e8f0] max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl"
          >
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0f172a]">Create New Custom Plan</h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Close modal"
                className="w-9 h-9 rounded-lg border border-[#e2e8f0] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto">
              {/* Quick-Fill Presets */}
              <div className="space-y-1.5">
                <p className="font-semibold text-[#475569]">Quick-Fill Presets:</p>
                <div className="flex flex-wrap gap-1.5">
                  {PLAN_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setNewPlanName(preset.name);
                        setNewPlanPrice(preset.price_inr);
                        setNewPlanInterval(preset.interval_days);
                        setNewPlanBadge(preset.badge_text);
                        setNewPlanPromo(preset.promo_note);
                        setNewPlanLimits(preset.usage_limits);
                        setNewPlanTagline(preset.tagline);
                        setNewPlanFeatures(preset.features);
                      }}
                      className="px-2.5 py-1.5 rounded-md border border-[#cbd5e1] bg-[#f8fafc] hover:bg-[#f1f5f9] font-semibold text-[#0f172a]"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">Plan Name *</label>
                <input
                  type="text"
                  required
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  placeholder="e.g. Daily Pass / Weekly Remote Pass / Student Scholar"
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Price (₹ INR) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newPlanPrice}
                    onChange={(e) => setNewPlanPrice(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">
                    Billing Interval (Days) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newPlanInterval}
                    onChange={(e) => setNewPlanInterval(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] font-mono-data"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Badge Label</label>
                  <input
                    type="text"
                    value={newPlanBadge}
                    onChange={(e) => setNewPlanBadge(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Promo Note</label>
                  <input
                    type="text"
                    value={newPlanPromo}
                    onChange={(e) => setNewPlanPromo(e.target.value)}
                    placeholder="e.g. Limited Offer"
                    className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  Usage Limits (optional)
                </label>
                <input
                  type="text"
                  value={newPlanLimits}
                  onChange={(e) => setNewPlanLimits(e.target.value)}
                  placeholder="e.g. Unlimited comparisons · 5 saved collections"
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">Tagline</label>
                <input
                  type="text"
                  value={newPlanTagline}
                  onChange={(e) => setNewPlanTagline(e.target.value)}
                  placeholder="Short description for Pricing page"
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>

              <label className="inline-flex items-center gap-2 font-semibold text-[#0f172a] cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPlanRecommended}
                  onChange={(e) => setNewPlanRecommended(e.target.checked)}
                  className="w-4 h-4 accent-[#b45309]"
                />
                <span>Highlight as Recommended Plan on Pricing page</span>
              </label>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  Features (one per line) *
                </label>
                <textarea
                  rows={4}
                  required
                  value={newPlanFeatures}
                  onChange={(e) => setNewPlanFeatures(e.target.value)}
                  className="w-full p-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="min-h-[44px] px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="min-h-[44px] px-4 rounded-lg bg-[#0f172a] text-white text-xs font-semibold"
              >
                {creating ? 'Creating...' : 'Create Plan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Plan Confirmation Modal */}
      {confirmDeletePlan && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete subscription plan"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#0f172a]">Delete Subscription Plan?</h3>
            <p className="text-xs text-[#475569] leading-relaxed">
              Delete <strong className="text-[#0f172a]">{confirmDeletePlan.name}</strong> (
              <code className="font-mono-data">{confirmDeletePlan.id}</code>)? Any current users on
              this plan will be moved safely to Free Explorer. Plans with historical payment receipts
              cannot be deleted (disable them instead).
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={deletingId === confirmDeletePlan.id}
                onClick={() => setConfirmDeletePlan(null)}
                className="min-h-[44px] px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId === confirmDeletePlan.id}
                onClick={() => void handleDeletePlan()}
                className="min-h-[44px] px-4 rounded-lg bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-semibold"
              >
                {deletingId === confirmDeletePlan.id ? 'Deleting...' : 'Delete Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

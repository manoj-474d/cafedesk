import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Info, Plus, RefreshCw, ShieldAlert, X } from 'lucide-react';
import type { PlanTier, SubscriptionPlan } from '../../types/subscription';
import type { AdminSubscriptionOverviewPayload } from './AdminSubscriptionsTab';

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
  const [newPlanTagline, setNewPlanTagline] = useState('');
  const [newPlanFeatures, setNewPlanFeatures] = useState(
    'Unlimited cafe comparisons\nPriority Wi-Fi speed insights\nSaved collections across Bengaluru'
  );
  const [creating, setCreating] = useState(false);

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
      setNewPlanTagline('');
      setStatusMsg(`Created custom plan "${newPlanName}". Live on public Pricing page.`);
      await loadPlans();
    } finally {
      setCreating(false);
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
            Edit prices, billing intervals, badges, promo notes, features, or launch new custom membership tiers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadPlans()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold"
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
              className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#b45309] font-mono-data">
                    ID: {pid}
                  </span>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#0f172a] cursor-pointer">
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
                </div>

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
                    className="w-full h-9 px-3 rounded-lg border border-[#cbd5e1] text-xs font-semibold"
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
                      className="w-full h-9 px-3 rounded-lg border border-[#cbd5e1] font-mono-data text-xs disabled:bg-[#f1f5f9]"
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
                      className="w-full h-9 px-3 rounded-lg border border-[#cbd5e1] font-mono-data text-xs disabled:bg-[#f1f5f9]"
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
                      className="w-full h-9 px-3 rounded-lg border border-[#cbd5e1] text-xs"
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
                      className="w-full h-9 px-3 rounded-lg border border-[#cbd5e1] text-xs"
                    />
                  </div>
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
                    className="w-full h-9 px-3 rounded-lg border border-[#cbd5e1] text-xs"
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
                className="w-full py-2.5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-60 text-white text-xs font-semibold"
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
            className="bg-white rounded-2xl border border-[#e2e8f0] max-w-lg w-full overflow-hidden shadow-xl"
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

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#475569] mb-1">Plan Name *</label>
                <input
                  type="text"
                  required
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  placeholder="e.g. Cafe Desk Quarterly Pass"
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">Price (₹ INR) *</label>
                  <input
                    type="number"
                    min={1}
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
                <label className="block font-semibold text-[#475569] mb-1">Tagline</label>
                <input
                  type="text"
                  value={newPlanTagline}
                  onChange={(e) => setNewPlanTagline(e.target.value)}
                  placeholder="Short description for Pricing page"
                  className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
                />
              </div>

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
                className="h-9 px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="h-9 px-4 rounded-lg bg-[#0f172a] text-white text-xs font-semibold"
              >
                {creating ? 'Creating...' : 'Create Plan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

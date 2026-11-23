import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crown,
  Download,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type {
  AdminUserDetailsPayload,
  PaymentRecord,
  PlanTier,
  SubscriptionPlan,
  UserProfile,
  UserSubscription,
} from '../../types/subscription';

export interface AdminSubscriberUser extends UserProfile {
  subscription: UserSubscription;
  total_spent_inr: number;
  last_payment_at?: number | null;
  last_payment_status?: string | null;
}

export interface AdminSubscriptionOverviewPayload {
  plans: SubscriptionPlan[];
  users: AdminSubscriberUser[];
  payments: PaymentRecord[];
  revenueSeries: Array<{ date: string; amount_inr: number }>;
  metrics: {
    totalUsers: number;
    activePaidUsers: number;
    activeSubs: number;
    cancelledSubs: number;
    expiredSubs: number;
    suspendedSubs?: number;
    countsByPlan: Record<string, number>;
    totalRevenueInr: number;
    monthRevenueInr: number;
    yearRevenueInr: number;
    mrrInr: number;
    refundedInr: number;
    paidCount: number;
    failedPayments: number;
    pendingPayments: number;
    refundedCount: number;
  };
}

const PAGE_SIZE = 15;

function formatDate(ts?: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function escapeCsv(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function AdminSubscriptionsTab({ csrfToken }: { csrfToken: string }) {
  const [data, setData] = useState<AdminSubscriptionOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [subStatusFilter, setSubStatusFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [detailPayload, setDetailPayload] = useState<AdminUserDetailsPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/subscriptions/overview', { credentials: 'include' });
      if (res.ok) {
        const payload = (await res.json()) as AdminSubscriptionOverviewPayload;
        setData(payload);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openDetails = async (userId: number) => {
    setDetailLoading(true);
    setDetailPayload(null);
    try {
      const res = await fetch(`/api/admin/subscriptions/users/${userId}/details`, {
        credentials: 'include',
      });
      if (res.ok) {
        setDetailPayload((await res.json()) as AdminUserDetailsPayload);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubscriptionAction = async (
    userId: number,
    action: 'activate' | 'suspend' | 'revoke' | 'extend',
    extra?: { planId?: PlanTier; durationDays?: number; note?: string }
  ) => {
    setStatusMsg('');
    setErrorMsg('');
    const res = await fetch(`/api/admin/subscriptions/users/${userId}/subscription-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({
        action,
        planId: extra?.planId,
        durationDays: extra?.durationDays ?? 30,
        note: extra?.note,
      }),
    });
    if (res.ok) {
      const actionLabel =
        action === 'activate'
          ? 'Activated'
          : action === 'extend'
          ? 'Extended'
          : action === 'suspend'
          ? 'Suspended'
          : 'Revoked / Expired';
      setStatusMsg(`${actionLabel} subscription for user #${userId}.`);
      await loadData();
      if (detailPayload?.user.id === userId) {
        await openDetails(userId);
      }
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setErrorMsg(err.error || 'Failed to update subscription status.');
    }
  };

  const handleChangeUserPlan = async (userId: number, planId: PlanTier) => {
    setStatusMsg('');
    setErrorMsg('');
    const targetPlan = data?.plans.find((p) => p.id === planId);
    const durationDays =
      planId === 'free' ? 30 : Math.max(1, targetPlan?.interval_days || 30);

    const res = await fetch(`/api/admin/subscriptions/users/${userId}/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({ planId, durationDays }),
    });
    if (res.ok) {
      setStatusMsg(`Updated user #${userId} subscription to ${targetPlan?.name || planId}.`);
      await loadData();
      if (detailPayload?.user.id === userId) {
        await openDetails(userId);
      }
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setErrorMsg(err.error || 'Failed to update user plan.');
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.users.filter((u) => {
      if (planFilter !== 'all' && u.subscription.plan_id !== planFilter) return false;
      if (subStatusFilter !== 'all' && u.subscription.status !== subStatusFilter) return false;
      if (paymentStatusFilter !== 'all') {
        const payStatus = u.last_payment_status || 'none';
        if (payStatus !== paymentStatusFilter) return false;
      }
      if (!q) return true;
      return `${u.id} ${u.name} ${u.email} ${u.subscription.plan_name} ${u.subscription.plan_id}`
        .toLowerCase()
        .includes(q);
    });
  }, [data, search, planFilter, subStatusFilter, paymentStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedUsers = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = [
      'User ID',
      'Name',
      'Email',
      'Plan ID',
      'Plan Name',
      'Subscribed Price (INR)',
      'Start Date',
      'Expiry Date',
      'Last Payment Status',
      'Subscription Status',
      'Auto Renew',
      'Total Spent (INR)',
    ];
    const rows = filtered.map((u) => [
      u.id,
      u.name,
      u.email,
      u.subscription.plan_id,
      u.subscription.plan_name,
      u.subscription.subscribed_price_inr ?? u.subscription.price_inr,
      formatDate(u.subscription.started_at),
      u.subscription.expires_at ? formatDate(u.subscription.expires_at) : 'No expiry',
      u.last_payment_status || 'none',
      u.subscription.status,
      u.subscription.auto_renew ? 'Yes' : 'No',
      u.total_spent_inr,
    ]);
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cafedesk-subscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <div className="p-8 rounded-xl border border-[#e2e8f0] bg-white text-sm text-[#64748b]">
        Loading subscription accounts, billing cycles, and active members...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Subscription Management</h1>
          <p className="text-xs text-[#64748b]">
            Track active subscribers, billing renewals, locked-in subscription prices, and manual plan adjustments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] disabled:opacity-40 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
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

      {/* Prominent Active Subscribers & Breakdown Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-[#b45309]/40 bg-white space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
            <span>Active Paid Subscribers</span>
            <Crown className="w-4 h-4 text-[#b45309]" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#b45309]">
            {data.metrics.activeSubs}
          </p>
          <p className="text-xs text-[#64748b] font-mono-data tabular-nums">
            MRR: ₹{data.metrics.mrrInr} · {data.metrics.cancelledSubs} cancelled ·{' '}
            {data.metrics.expiredSubs} expired · {data.metrics.suspendedSubs ?? 0} suspended
          </p>
        </div>

        <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
            <span>Total Member Accounts</span>
            <Users className="w-4 h-4 text-[#0f172a]" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#0f172a]">
            {data.metrics.totalUsers}
          </p>
          <p className="text-xs text-[#64748b] font-mono-data tabular-nums">
            {data.metrics.countsByPlan.free ?? 0} on Free Explorer
          </p>
        </div>

        {data.plans
          .filter((p) => p.id !== 'free')
          .slice(0, 2)
          .map((plan) => (
            <div key={plan.id} className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
                <span className="truncate">{plan.name}</span>
                <Sparkles className="w-4 h-4 text-[#1b4d3e] shrink-0" />
              </div>
              <p className="font-mono-data tabular-nums text-2xl font-bold text-[#1b4d3e]">
                {data.metrics.countsByPlan[plan.id] ?? 0}
              </p>
              <p className="text-xs text-[#64748b] font-mono-data tabular-nums">
                ₹{plan.price_inr} / {plan.interval_days} days
              </p>
            </div>
          ))}
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search ID, name, email, plan..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
          />
        </div>

        <select
          aria-label="Filter by plan"
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
        >
          <option value="all">All Plans ({data.users.length})</option>
          {data.plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({data.metrics.countsByPlan[p.id] ?? 0})
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by subscription status"
          value={subStatusFilter}
          onChange={(e) => {
            setSubStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
        >
          <option value="all">All Sub Statuses</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
          <option value="past_due">Past Due</option>
        </select>

        <select
          aria-label="Filter by last payment status"
          value={paymentStatusFilter}
          onChange={(e) => {
            setPaymentStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
        >
          <option value="all">All Payment Statuses</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="created">Pending</option>
          <option value="refunded">Refunded</option>
          <option value="none">No Payment</option>
        </select>
      </div>

      {/* Subscriptions List: Desktop Table + Mobile Cards */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#475569] font-semibold">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Subscriber</th>
                <th className="py-3 px-4">Plan &amp; Price</th>
                <th className="py-3 px-4">Start / Expiry</th>
                <th className="py-3 px-4">Last Payment</th>
                <th className="py-3 px-4">Sub Status &amp; Renewal</th>
                <th className="py-3 px-4">Switch Plan</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {pagedUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#64748b]">
                    No subscriber records match this filter.
                  </td>
                </tr>
              ) : (
                pagedUsers.map((u) => {
                  const subPrice = u.subscription.subscribed_price_inr ?? u.subscription.price_inr;
                  return (
                    <tr key={u.id} className="hover:bg-[#f8fafc]">
                      <td className="py-3 px-4 font-mono-data text-[#64748b]">#{u.id}</td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#0f172a]">{u.name}</p>
                        <p className="text-[#64748b]">{u.email}</p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold ${
                            u.subscription.plan_id === 'premium'
                              ? 'bg-[#1c1613] text-[#f59e0b]'
                              : u.subscription.plan_id !== 'free'
                              ? 'bg-amber-50 text-[#b45309]'
                              : 'bg-[#f1f5f9] text-[#475569]'
                          }`}
                        >
                          {u.subscription.plan_name || u.subscription.plan_id}
                        </span>
                        <p className="font-mono-data tabular-nums text-[#334155] mt-1">
                          ₹{subPrice}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-mono-data whitespace-nowrap text-[#334155]">
                        <p>Start: {formatDate(u.subscription.started_at)}</p>
                        <p className="text-[#64748b]">
                          Exp:{' '}
                          {u.subscription.expires_at
                            ? formatDate(u.subscription.expires_at)
                            : 'Free / Lifetime'}
                        </p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {u.last_payment_at ? (
                          <>
                            <p className="font-mono-data text-[#0f172a]">
                              {formatDate(u.last_payment_at)}
                            </p>
                            <p className="capitalize font-semibold text-[#64748b]">
                              {u.last_payment_status} · Total ₹{u.total_spent_inr}
                            </p>
                          </>
                        ) : (
                          <span className="text-[#94a3b8]">No payment</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold capitalize ${
                            u.subscription.status === 'active'
                              ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#16a34a]'
                              : u.subscription.status === 'suspended'
                              ? 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
                              : u.subscription.status === 'expired'
                              ? 'bg-amber-50 border-amber-200 text-[#92400e]'
                              : u.subscription.status === 'cancelled'
                              ? 'bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]'
                              : 'bg-[#f1f5f9] border-[#cbd5e1] text-[#475569]'
                          }`}
                        >
                          {u.subscription.status}
                        </span>
                        <p className="text-[11px] text-[#64748b] mt-1">
                          {u.subscription.plan_id === 'free'
                            ? 'Free tier'
                            : u.subscription.status === 'expired'
                            ? 'Expired · locked'
                            : u.subscription.status === 'suspended'
                            ? 'Suspended · locked'
                            : u.subscription.auto_renew
                            ? `Auto-renew · ${formatDate(u.subscription.expires_at)}`
                            : 'Auto-renew off'}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          aria-label={`Change plan for ${u.email}`}
                          value={u.subscription.plan_id}
                          onChange={(e) =>
                            void handleChangeUserPlan(u.id, e.target.value as PlanTier)
                          }
                          className="h-8 px-2 rounded border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
                        >
                          {data.plans.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (₹{p.price_inr})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              void handleSubscriptionAction(
                                u.id,
                                u.subscription.effective_active ? 'extend' : 'activate',
                                { durationDays: 30 }
                              )
                            }
                            className="px-2 py-1 rounded border border-[#a7f3d0] bg-[#ecfdf5] text-[#16a34a] font-semibold"
                          >
                            {u.subscription.effective_active ? '+30d' : 'Activate'}
                          </button>
                          {u.subscription.effective_active && (
                            <button
                              type="button"
                              onClick={() => void handleSubscriptionAction(u.id, 'suspend')}
                              className="px-2 py-1 rounded border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c] font-semibold"
                            >
                              Suspend
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void openDetails(u.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] font-semibold text-[#0f172a]"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Stacked Cards */}
        <div className="md:hidden divide-y divide-[#e2e8f0]">
          {pagedUsers.length === 0 ? (
            <p className="p-8 text-center text-xs text-[#64748b]">
              No subscriber records match this filter.
            </p>
          ) : (
            pagedUsers.map((u) => {
              const subPrice = u.subscription.subscribed_price_inr ?? u.subscription.price_inr;
              return (
                <div key={u.id} className="p-4 space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-[#0f172a]">
                        {u.name} <span className="font-mono-data text-xs text-[#64748b]">#{u.id}</span>
                      </p>
                      <p className="text-[#64748b] truncate">{u.email}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded border text-[11px] font-semibold capitalize shrink-0 ${
                        u.subscription.status === 'active'
                          ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#16a34a]'
                          : u.subscription.status === 'cancelled'
                          ? 'bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]'
                          : 'bg-[#f1f5f9] border-[#cbd5e1] text-[#475569]'
                      }`}
                    >
                      {u.subscription.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[#475569] font-mono-data">
                    <span>
                      {u.subscription.plan_name || u.subscription.plan_id} · ₹{subPrice}
                    </span>
                    <span>
                      {u.subscription.expires_at
                        ? `Exp ${formatDate(u.subscription.expires_at)}`
                        : 'Free / Lifetime'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Change plan for ${u.email}`}
                      value={u.subscription.plan_id}
                      onChange={(e) =>
                        void handleChangeUserPlan(u.id, e.target.value as PlanTier)
                      }
                      className="flex-1 h-11 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
                    >
                      {data.plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (₹{p.price_inr})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void openDetails(u.id)}
                      className="min-h-[44px] px-4 rounded-lg border border-[#cbd5e1] bg-white font-semibold text-[#0f172a] inline-flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between text-xs">
            <span className="text-[#64748b] font-mono-data">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} subscriptions
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

      {/* Subscription Detail Modal */}
      {(detailLoading || detailPayload) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Subscription details"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0f172a]">
                {detailPayload
                  ? `Subscription Profile: ${detailPayload.user.name}`
                  : 'Loading subscriber profile...'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setDetailPayload(null);
                  setDetailLoading(false);
                }}
                aria-label="Close subscription details"
                className="w-9 h-9 rounded-lg border border-[#e2e8f0] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailLoading || !detailPayload ? (
              <div className="p-8 text-center text-xs text-[#64748b]">Loading details...</div>
            ) : (
              <div className="p-6 overflow-y-auto space-y-5 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                    <p className="text-[#64748b]">Active Plan</p>
                    <p className="font-semibold text-[#0f172a] mt-0.5">
                      {detailPayload.subscription?.plan_name || 'Free Explorer'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                    <p className="text-[#64748b]">Subscribed Price</p>
                    <p className="font-mono-data font-semibold text-[#0f172a] mt-0.5">
                      ₹
                      {detailPayload.subscription?.subscribed_price_inr ??
                        detailPayload.subscription?.price_inr ??
                        0}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                    <p className="text-[#64748b]">Started</p>
                    <p className="font-mono-data text-[#0f172a] mt-0.5">
                      {formatDate(detailPayload.subscription?.started_at)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                    <p className="text-[#64748b]">Expires / Renews</p>
                    <p className="font-mono-data text-[#0f172a] mt-0.5">
                      {detailPayload.subscription?.expires_at
                        ? formatDate(detailPayload.subscription.expires_at)
                        : 'No expiry'}
                    </p>
                  </div>
                </div>

                {/* Admin Subscription Controls */}
                <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#0f172a]">
                    Manual Access Controls (Status: <span className="capitalize">{detailPayload.subscription?.status || 'free'}</span>)
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void handleSubscriptionAction(detailPayload.user.id, 'activate', {
                          durationDays: 30,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-[#16a34a] text-white font-semibold"
                    >
                      Activate (+30d)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void handleSubscriptionAction(detailPayload.user.id, 'extend', {
                          durationDays: 30,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-[#0f172a] text-white font-semibold"
                    >
                      Extend (+30d)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void handleSubscriptionAction(detailPayload.user.id, 'suspend')
                      }
                      className="px-3 py-1.5 rounded-lg bg-[#dc2626] text-white font-semibold"
                    >
                      Suspend
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void handleSubscriptionAction(detailPayload.user.id, 'revoke')
                      }
                      className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-[#92400e] font-semibold"
                    >
                      Expire Now
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-[#0f172a]">Payment Transactions</h4>
                  {detailPayload.payments.length === 0 ? (
                    <p className="text-[#64748b]">No payment records.</p>
                  ) : (
                    <div className="divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-lg">
                      {detailPayload.payments.map((p) => (
                        <div key={p.id} className="px-3 py-2 flex items-center justify-between gap-2">
                          <div>
                            <span className="font-mono-data font-semibold text-[#0f172a]">
                              {p.receipt_number}
                            </span>
                            <span className="text-[#64748b] ml-2">
                              {p.plan_name || p.plan_id} · {p.method.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono-data">
                            <span className="font-bold">₹{p.amount_inr}</span>
                            <span className="capitalize font-semibold text-[#475569]">
                              {p.status}
                            </span>
                            <span className="text-[#64748b]">{formatDate(p.created_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-[#0f172a]">Subscription History</h4>
                  {detailPayload.history.length === 0 ? (
                    <p className="text-[#64748b]">No subscription state changes recorded.</p>
                  ) : (
                    <div className="divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-lg">
                      {detailPayload.history.map((h) => (
                        <div key={h.id} className="px-3 py-2 flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[#0f172a] capitalize">
                              {h.action.replace('_', ' ')} ({h.from_plan} → {h.to_plan})
                            </p>
                            {h.note && <p className="text-[#64748b]">{h.note}</p>}
                          </div>
                          <span className="font-mono-data text-[#64748b] shrink-0">
                            {formatDate(h.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

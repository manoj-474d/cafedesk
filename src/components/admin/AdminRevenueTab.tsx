import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  IndianRupee,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import type { PaymentRecord } from '../../types/subscription';
import type { AdminSubscriptionOverviewPayload } from './AdminSubscriptionsTab';

const PAGE_SIZE = 20;

function escapeCsv(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function AdminRevenueTab({ csrfToken }: { csrfToken: string }) {
  const [data, setData] = useState<AdminSubscriptionOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentRecord['status']>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmRefundPayment, setConfirmRefundPayment] = useState<PaymentRecord | null>(null);
  const [refunding, setRefunding] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/subscriptions/overview', { credentials: 'include' });
      if (res.ok) {
        setData((await res.json()) as AdminSubscriptionOverviewPayload);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleConfirmRefund = async () => {
    if (!confirmRefundPayment) return;
    setRefunding(true);
    setStatusMsg('');
    setErrorMsg('');
    try {
      const res = await fetch(
        `/api/admin/subscriptions/payments/${confirmRefundPayment.id}/refund`,
        {
          method: 'POST',
          headers: { 'x-csrf-token': csrfToken },
          credentials: 'include',
        }
      );
      if (res.ok) {
        setStatusMsg(
          `Refund issued for ${confirmRefundPayment.receipt_number} (₹${confirmRefundPayment.amount_inr}). User reverted to Free Explorer.`
        );
        setConfirmRefundPayment(null);
        await loadData();
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(err.error || 'Failed to issue refund.');
      }
    } finally {
      setRefunding(false);
    }
  };

  const filteredPayments = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const fromTs = fromDate ? Date.parse(`${fromDate}T00:00:00`) : null;
    const toTs = toDate ? Date.parse(`${toDate}T23:59:59.999`) : null;

    return data.payments.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (fromTs && p.created_at < fromTs) return false;
      if (toTs && p.created_at > toTs) return false;
      if (!q) return true;
      return `${p.receipt_number} ${p.user_name ?? ''} ${p.user_email ?? ''} ${p.plan_name ?? p.plan_id} ${p.provider_payment_id}`
        .toLowerCase()
        .includes(q);
    });
  }, [data, search, statusFilter, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedPayments = filteredPayments.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const exportCsv = () => {
    if (!filteredPayments.length) return;
    const headers = [
      'Receipt Number',
      'User Name',
      'User Email',
      'Plan',
      'Amount (INR)',
      'Method',
      'Provider',
      'Status',
      'Date',
    ];
    const rows = filteredPayments.map((p) => [
      p.receipt_number,
      p.user_name ?? '',
      p.user_email ?? '',
      p.plan_name ?? p.plan_id,
      p.amount_inr,
      p.method,
      p.provider,
      p.status,
      new Date(p.created_at).toISOString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cafedesk-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <div className="p-8 rounded-xl border border-[#e2e8f0] bg-white text-sm text-[#64748b]">
        Loading revenue metrics and payment transactions...
      </div>
    );
  }

  if (!data) return null;

  const series = data.revenueSeries ?? [];
  const maxDayRev = Math.max(100, ...series.map((d) => d.amount_inr));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Payments &amp; Revenue</h1>
          <p className="text-xs text-[#64748b]">
            Real-time Razorpay &amp; subscription billing ledger, MRR, 30-day trend, and refund controls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredPayments.length === 0}
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

      {/* Revenue Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
            <span>Total Gross Revenue</span>
            <IndianRupee className="w-4 h-4 text-[#1b4d3e]" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#0f172a]">
            ₹{data.metrics.totalRevenueInr.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-[#64748b] font-mono-data tabular-nums">
            {data.metrics.paidCount} successful charges
          </p>
        </div>

        <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
            <span>Monthly Recurring (MRR)</span>
            <TrendingUp className="w-4 h-4 text-[#b45309]" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#b45309]">
            ₹{data.metrics.mrrInr.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-[#64748b] font-mono-data tabular-nums">
            {data.metrics.activeSubs} active paying plans
          </p>
        </div>

        <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <p className="text-xs font-medium text-[#64748b]">30-Day / 12-Month Revenue</p>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#1b4d3e]">
            ₹{data.metrics.monthRevenueInr.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-[#64748b] font-mono-data tabular-nums">
            Year total: ₹{data.metrics.yearRevenueInr.toLocaleString('en-IN')}
          </p>
        </div>

        <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
            <span>Refunds, Pending &amp; Failed</span>
            <CreditCard className="w-4 h-4 text-[#475569]" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#0f172a]">
            ₹{data.metrics.refundedInr.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-[#64748b] font-mono-data tabular-nums">
            {data.metrics.refundedCount} refunded · {data.metrics.pendingPayments} pending ·{' '}
            {data.metrics.failedPayments} failed
          </p>
        </div>
      </div>

      {/* 30-Day Revenue Trend SVG Chart */}
      <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#0f172a]">
              Daily Paid Revenue Trend (Last 30 Days)
            </h2>
            <p className="text-xs text-[#64748b]">Aggregated from completed payment records.</p>
          </div>
          <span className="font-mono-data text-xs font-semibold text-[#1b4d3e]">
            ₹{data.metrics.monthRevenueInr.toLocaleString('en-IN')} / 30d
          </span>
        </div>

        <svg
          viewBox="0 0 600 120"
          className="w-full h-36 overflow-visible"
          role="img"
          aria-label="30-day revenue bar chart"
        >
          {series.map((d, idx) => {
            const barWidth = 600 / Math.max(1, series.length);
            const h = Math.max(3, Math.round((d.amount_inr / maxDayRev) * 95));
            const x = idx * barWidth + 2;
            const y = 100 - h;
            return (
              <g key={d.date}>
                <rect
                  x={x}
                  y={y}
                  width={Math.max(4, barWidth - 5)}
                  height={h}
                  rx={2}
                  fill={d.amount_inr > 0 ? '#1b4d3e' : '#e2e8f0'}
                >
                  <title>{`${d.date}: ₹${d.amount_inr}`}</title>
                </rect>
              </g>
            );
          })}
        </svg>
        {series.length > 0 && (
          <div className="flex justify-between text-[11px] font-mono-data text-[#64748b]">
            <span>{series[0].date}</span>
            <span>{series[Math.floor(series.length / 2)].date}</span>
            <span>{series[series.length - 1].date}</span>
          </div>
        )}
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
            placeholder="Receipt, user, or payment ID..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
          />
        </div>

        <select
          aria-label="Filter by payment status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as 'all' | PaymentRecord['status']);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
        >
          <option value="all">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="created">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>

        <input
          type="date"
          aria-label="From date"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-mono-data"
        />

        <input
          type="date"
          aria-label="To date"
          value={toDate}
          onChange={(e) => {
            setToDate(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-mono-data"
        />
      </div>

      {/* Transactions Table */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white overflow-x-auto">
        {pagedPayments.length === 0 ? (
          <p className="text-xs text-[#64748b] py-8 text-center">
            No payment transactions match this filter.
          </p>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#475569] font-semibold">
                <th className="py-3 px-4">Receipt</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {pagedPayments.map((p) => (
                <tr key={p.id} className="hover:bg-[#f8fafc]">
                  <td className="py-3 px-4 font-mono-data font-semibold text-[#0f172a]">
                    {p.receipt_number}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-[#0f172a]">{p.user_name}</p>
                    <p className="text-[#64748b]">{p.user_email}</p>
                  </td>
                  <td className="py-3 px-4">{p.plan_name || p.plan_id}</td>
                  <td className="py-3 px-4 font-mono-data tabular-nums font-bold">
                    ₹{p.amount_inr}
                  </td>
                  <td className="py-3 px-4 uppercase font-mono-data">{p.method}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold capitalize ${
                        p.status === 'paid'
                          ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#16a34a]'
                          : p.status === 'refunded'
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : p.status === 'failed'
                          ? 'bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]'
                          : 'bg-[#f1f5f9] border-[#cbd5e1] text-[#475569]'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono-data text-[#64748b] whitespace-nowrap">
                    {new Date(p.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {p.status === 'paid' ? (
                      <button
                        type="button"
                        onClick={() => setConfirmRefundPayment(p)}
                        className="px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 font-semibold"
                      >
                        Issue Refund
                      </button>
                    ) : (
                      <span className="text-[#94a3b8]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {filteredPayments.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between text-xs">
            <span className="text-[#64748b] font-mono-data">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filteredPayments.length)} of {filteredPayments.length}{' '}
              payments
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

      {/* Refund Confirmation Modal */}
      {confirmRefundPayment && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm subscription refund"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#0f172a]">Issue Payment Refund?</h3>
            <p className="text-xs text-[#475569] leading-relaxed">
              Refund{' '}
              <span className="font-mono-data font-bold text-[#0f172a]">
                ₹{confirmRefundPayment.amount_inr}
              </span>{' '}
              for receipt{' '}
              <span className="font-mono-data font-semibold text-[#0f172a]">
                {confirmRefundPayment.receipt_number}
              </span>{' '}
              ({confirmRefundPayment.user_email})? This will mark the payment refunded and revert
              the customer to Free Explorer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={refunding}
                onClick={() => setConfirmRefundPayment(null)}
                className="h-9 px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={refunding}
                onClick={() => void handleConfirmRefund()}
                className="h-9 px-4 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold"
              >
                {refunding ? 'Refunding...' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

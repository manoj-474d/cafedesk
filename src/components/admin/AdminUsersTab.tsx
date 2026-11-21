import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bookmark,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FolderHeart,
  History,
  MessageSquare,
  Phone,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  AdminUserDetailsPayload,
  AdminUserDirectoryPayload,
  AdminUserDirectoryUser,
} from '../../types/subscription';

const PAGE_SIZE = 15;

function formatDateTime(ts?: number | null): string {
  if (!ts) return 'Never';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getIstTodayStartMs(): number {
  const now = Date.now();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now + istOffsetMs);
  istDate.setUTCHours(0, 0, 0, 0);
  return istDate.getTime() - istOffsetMs;
}

export function AdminUsersTab({ csrfToken }: { csrfToken: string }) {
  const [data, setData] = useState<AdminUserDirectoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveConnected, setLiveConnected] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [detailPayload, setDetailPayload] = useState<AdminUserDetailsPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AdminUserDirectoryUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users/directory', { credentials: 'include' });
      if (res.ok) {
        setData((await res.json()) as AdminUserDirectoryPayload);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Real-time SSE updates when customers sign up, verify email, log in, or change status
  useEffect(() => {
    const es = new EventSource('/api/admin/users/stream', { withCredentials: true });
    es.addEventListener('ready', () => {
      setLiveConnected(true);
    });
    es.addEventListener('directory_change', () => {
      void loadData();
    });
    es.onerror = () => {
      setLiveConnected(false);
    };
    return () => {
      es.close();
      setLiveConnected(false);
    };
  }, [loadData]);

  const handleToggleSuspend = async (user: AdminUserDirectoryUser) => {
    setStatusMsg('');
    setErrorMsg('');
    const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';
    const res = await fetch(`/api/admin/subscriptions/users/${user.id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      setStatusMsg(
        `${user.email} is now ${nextStatus === 'suspended' ? 'disabled' : 'active'}.`
      );
      await loadData();
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setErrorMsg(err.error || 'Could not update user account status.');
    }
  };

  const handleDeleteUser = async () => {
    if (!confirmDeleteUser) return;
    setDeleting(true);
    setStatusMsg('');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/subscriptions/users/${confirmDeleteUser.id}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken },
        credentials: 'include',
      });
      if (res.ok) {
        setStatusMsg(`Deleted customer account ${confirmDeleteUser.email}.`);
        setConfirmDeleteUser(null);
        await loadData();
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(err.error || 'Failed to delete user account.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const openDetails = async (userId: number) => {
    setDetailLoading(true);
    setDetailPayload(null);
    try {
      const res = await fetch(`/api/admin/users/directory/${userId}/details`, {
        credentials: 'include',
      });
      if (res.ok) {
        setDetailPayload((await res.json()) as AdminUserDetailsPayload);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const exportCsvUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (verifiedFilter !== 'all') params.set('verified', verifiedFilter);
    if (planFilter !== 'all') params.set('plan', planFilter);
    if (dateRangeFilter !== 'all') params.set('range', dateRangeFilter);
    const qs = params.toString();
    return `/api/admin/users/directory/export.csv${qs ? `?${qs}` : ''}`;
  }, [search, statusFilter, verifiedFilter, planFilter, dateRangeFilter]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const todayStart = getIstTodayStartMs();
    const now = Date.now();
    return data.users.filter((u) => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (verifiedFilter === 'verified' && !u.email_verified) return false;
      if (verifiedFilter === 'unverified' && u.email_verified) return false;
      if (planFilter !== 'all' && u.subscription.plan_id !== planFilter) return false;
      if (dateRangeFilter === 'today' && u.created_at < todayStart) return false;
      if (dateRangeFilter === 'week' && u.created_at < now - 7 * 24 * 60 * 60 * 1000) return false;
      if (dateRangeFilter === 'month' && u.created_at < now - 30 * 24 * 60 * 60 * 1000) return false;
      if (!q) return true;
      return `${u.id} ${u.supabase_id || ''} ${u.name} ${u.email} ${u.phone || ''} ${u.auth_provider}`
        .toLowerCase()
        .includes(q);
    });
  }, [data, search, statusFilter, verifiedFilter, dateRangeFilter, planFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedUsers = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (loading && !data) {
    return (
      <div className="p-8 rounded-xl border border-[#e2e8f0] bg-white text-sm text-[#64748b]">
        Loading registered customer directory...
      </div>
    );
  }

  if (!data) return null;

  const { analytics } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-[#0f172a]">Users &amp; Customer Management</h1>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                liveConnected
                  ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#1b4d3e]'
                  : 'bg-[#f8fafc] border-[#cbd5e1] text-[#64748b]'
              }`}
            >
              <Radio className="w-3 h-3" />
              <span>{liveConnected ? 'Live Updates' : 'Connecting...'}</span>
            </span>
            {data.supabaseConfigured && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#eef2ff] border border-[#c7d2fe] text-[#3730a3]">
                Supabase Synced
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748b] mt-0.5">
            Track user signups, email verifications, login timestamps, bookings, subscriptions, and account status across {analytics.totalUsers} registered users.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={exportCsvUrl}
            download
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Users CSV</span>
          </a>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
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

      {/* User Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748b]">
            <span>Total Users</span>
            <Users className="w-3.5 h-3.5 text-[#0f172a]" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#0f172a]">
            {analytics.totalUsers}
          </p>
          <p className="text-[11px] text-[#64748b]">All accounts</p>
        </div>

        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748b]">
            <span>New Today</span>
            <UserPlus className="w-3.5 h-3.5 text-[#b45309]" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#b45309]">
            {analytics.newToday}
          </p>
          <p className="text-[11px] text-[#64748b]">Registered today</p>
        </div>

        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748b]">
            <span>This Week</span>
            <Clock className="w-3.5 h-3.5 text-[#0f172a]" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#0f172a]">
            {analytics.newThisWeek}
          </p>
          <p className="text-[11px] text-[#64748b]">Last 7 days</p>
        </div>

        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748b]">
            <span>This Month</span>
            <CalendarCheck className="w-3.5 h-3.5 text-[#0f172a]" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#0f172a]">
            {analytics.newThisMonth}
          </p>
          <p className="text-[11px] text-[#64748b]">Last 30 days</p>
        </div>

        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748b]">
            <span>Verified Emails</span>
            <UserCheck className="w-3.5 h-3.5 text-[#1b4d3e]" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#1b4d3e]">
            {analytics.verifiedUsers}
          </p>
          <p className="text-[11px] text-[#64748b]">{analytics.unverifiedUsers} unverified</p>
        </div>

        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748b]">
            <span>Active Users</span>
            <Activity className="w-3.5 h-3.5 text-[#1b4d3e]" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#1b4d3e]">
            {analytics.activeUsers}
          </p>
          <p className="text-[11px] text-[#b91c1c]">{analytics.suspendedUsers} disabled</p>
        </div>
      </div>

      {/* Recent User Registrations Strip */}
      {data.recentRegistrations.length > 0 && (
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#475569]">
              Recent User Registrations
            </h2>
            <span className="text-[11px] text-[#64748b]">Newest members first</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {data.recentRegistrations.slice(0, 6).map((u) => (
              <button
                key={`recent-${u.id}`}
                type="button"
                onClick={() => void openDetails(u.id)}
                className="text-left p-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] hover:border-[#b45309] transition-colors flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#0f172a] truncate">{u.name}</p>
                  <p className="text-[11px] text-[#64748b] truncate">{u.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-white border border-[#e2e8f0] text-[10px] font-semibold uppercase text-[#475569]">
                    {u.auth_provider}
                  </span>
                  <p className="text-[10px] font-mono-data text-[#64748b] mt-0.5">
                    {new Date(u.created_at).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, email, phone, or ID..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
          />
        </div>

        <select
          aria-label="Filter by registration date"
          value={dateRangeFilter}
          onChange={(e) => {
            setDateRangeFilter(e.target.value as 'all' | 'today' | 'week' | 'month');
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
        >
          <option value="all">All Registration Dates</option>
          <option value="today">Registered Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
        </select>

        <select
          aria-label="Filter by verification status"
          value={verifiedFilter}
          onChange={(e) => {
            setVerifiedFilter(e.target.value as 'all' | 'verified' | 'unverified');
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
        >
          <option value="all">All Verification</option>
          <option value="verified">Email Verified</option>
          <option value="unverified">Unverified Only</option>
        </select>

        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Filter by account status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'active' | 'suspended');
              setPage(1);
            }}
            className="h-10 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Disabled</option>
          </select>

          <select
            aria-label="Filter by plan"
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
          >
            <option value="all">All Plans</option>
            {data.plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users List: Desktop Table + Mobile Cards */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#475569] font-semibold">
                <th className="py-3 px-4">User ID</th>
                <th className="py-3 px-4">Full Name &amp; Phone</th>
                <th className="py-3 px-4">Email &amp; Verification</th>
                <th className="py-3 px-4">Auth Method</th>
                <th className="py-3 px-4">Registered</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {pagedUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#64748b]">
                    No user accounts match the current filters.
                  </td>
                </tr>
              ) : (
                pagedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#f8fafc]">
                    <td className="py-3 px-4 font-mono-data text-[#475569] whitespace-nowrap">
                      <p className="font-semibold text-[#0f172a]">#{u.id}</p>
                      {u.supabase_id && (
                        <p
                          title={u.supabase_id}
                          className="text-[10px] text-[#64748b] truncate max-w-[90px]"
                        >
                          {u.supabase_id.slice(0, 8)}…
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#0f172a]">{u.name}</p>
                      <p className="text-[11px] text-[#64748b] inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{u.phone || 'Not provided'}</span>
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-[#0f172a] font-medium">{u.email}</p>
                      <span
                        className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          u.email_verified
                            ? 'bg-[#ecfdf5] text-[#1b4d3e]'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {u.email_verified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded bg-[#f1f5f9] text-[#334155] font-semibold capitalize">
                        {u.auth_provider === 'google' ? 'Google' : 'Email'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono-data text-[#475569] whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3 px-4 font-mono-data text-[#475569] whitespace-nowrap">
                      {formatDateTime(u.last_login_at)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-semibold text-[#0f172a]">{u.subscription.plan_name}</p>
                      <p className="text-[11px] text-[#64748b]">{u.bookings_count} bookings</p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold capitalize ${
                          u.status === 'suspended'
                            ? 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
                            : 'bg-[#ecfdf5] border-[#a7f3d0] text-[#1b4d3e]'
                        }`}
                      >
                        {u.status === 'suspended' ? 'Disabled' : 'Active'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void openDetails(u.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Details</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleSuspend(u)}
                          className={`px-2.5 py-1.5 rounded font-semibold ${
                            u.status === 'suspended'
                              ? 'bg-[#ecfdf5] text-[#1b4d3e] hover:bg-[#d1fae5]'
                              : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                          }`}
                        >
                          {u.status === 'suspended' ? 'Reactivate' : 'Disable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteUser(u)}
                          aria-label={`Delete user ${u.email}`}
                          className="p-1.5 rounded border border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2]"
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
        </div>

        {/* Mobile Stacked Cards */}
        <div className="md:hidden divide-y divide-[#e2e8f0]">
          {pagedUsers.length === 0 ? (
            <p className="p-8 text-center text-xs text-[#64748b]">
              No user accounts match the current filters.
            </p>
          ) : (
            pagedUsers.map((u) => (
              <div key={u.id} className="p-4 space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-[#0f172a]">
                      {u.name} <span className="font-mono-data text-xs text-[#64748b]">#{u.id}</span>
                    </p>
                    <p className="text-[#64748b] truncate">{u.email}</p>
                    <p className="text-[11px] text-[#475569] mt-0.5">
                      {u.phone || 'No phone'} · {u.auth_provider === 'google' ? 'Google' : 'Email'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${
                        u.status === 'suspended'
                          ? 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
                          : 'bg-[#ecfdf5] border-[#a7f3d0] text-[#1b4d3e]'
                      }`}
                    >
                      {u.status === 'suspended' ? 'Disabled' : 'Active'}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        u.email_verified
                          ? 'bg-[#ecfdf5] text-[#1b4d3e]'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {u.email_verified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#475569] bg-[#f8fafc] p-2.5 rounded-lg border border-[#e2e8f0]">
                  <span>
                    Plan: <strong className="text-[#0f172a]">{u.subscription.plan_name}</strong>
                  </span>
                  <span className="text-right font-mono-data">
                    Joined {new Date(u.created_at).toLocaleDateString('en-IN')}
                  </span>
                  <span className="col-span-2 font-mono-data">
                    Last login: {formatDateTime(u.last_login_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void openDetails(u.id)}
                    className="flex-1 min-h-[44px] px-3 rounded-lg border border-[#cbd5e1] bg-white font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Details</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleSuspend(u)}
                    className={`flex-1 min-h-[44px] px-3 rounded-lg font-semibold ${
                      u.status === 'suspended'
                        ? 'bg-[#ecfdf5] text-[#1b4d3e]'
                        : 'bg-amber-50 text-amber-900'
                    }`}
                  >
                    {u.status === 'suspended' ? 'Reactivate' : 'Disable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteUser(u)}
                    aria-label={`Delete user ${u.email}`}
                    className="min-h-[44px] min-w-[44px] rounded-lg border border-[#fecaca] text-[#dc2626] flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between text-xs">
            <span className="text-[#64748b] font-mono-data">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} users
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

      {/* User Detail Modal (zero passwords or secrets exposed) */}
      {(detailLoading || detailPayload) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="User profile details"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0f172a]">
                  {detailPayload ? detailPayload.user.name : 'Loading user...'}
                </h3>
                {detailPayload && (
                  <p className="text-xs text-[#64748b]">
                    User #{detailPayload.user.id}
                    {detailPayload.user.supabase_id
                      ? ` · Supabase ${detailPayload.user.supabase_id.slice(0, 8)}…`
                      : ''}{' '}
                    · {detailPayload.user.email}
                    {detailPayload.user.phone ? ` · ${detailPayload.user.phone}` : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailPayload(null);
                  setDetailLoading(false);
                }}
                aria-label="Close user details"
                className="w-9 h-9 rounded-lg border border-[#e2e8f0] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailLoading || !detailPayload ? (
              <div className="p-8 text-center text-xs text-[#64748b]">Loading user records...</div>
            ) : (
              <div className="p-6 overflow-y-auto space-y-5 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                    <p className="text-[#64748b]">Account Status</p>
                    <p className="font-semibold capitalize text-[#0f172a] mt-0.5">
                      {detailPayload.user.status === 'suspended' ? 'Disabled' : 'Active'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                    <p className="text-[#64748b]">Email &amp; Auth Method</p>
                    <p className="font-semibold text-[#0f172a] mt-0.5">
                      {detailPayload.user.email_verified ? 'Verified' : 'Unverified'} ·{' '}
                      {detailPayload.user.auth_provider === 'google' ? 'Google' : 'Email'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                    <p className="text-[#64748b]">Last Login</p>
                    <p className="font-mono-data text-[#0f172a] mt-0.5">
                      {formatDateTime(detailPayload.user.last_login_at)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                    <p className="text-[#64748b]">Subscription Plan</p>
                    <p className="font-semibold text-[#0f172a] mt-0.5">
                      {detailPayload.subscription?.plan_name || 'Free Explorer'}
                    </p>
                  </div>
                </div>

                {/* Account Activity & Login Events */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#0f172a] inline-flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#0f172a]" />
                    <span>Account Activity &amp; Logins ({detailPayload.loginEvents?.length ?? 0})</span>
                  </h4>
                  {!detailPayload.loginEvents || detailPayload.loginEvents.length === 0 ? (
                    <p className="text-[#64748b]">No recent login events recorded yet.</p>
                  ) : (
                    <div className="divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-lg max-h-40 overflow-y-auto">
                      {detailPayload.loginEvents.map((ev) => (
                        <div key={ev.id} className="px-3 py-2 flex items-center justify-between gap-2">
                          <div>
                            <span className="font-semibold capitalize text-[#0f172a]">
                              {ev.event_type.replace('_', ' ')}
                            </span>
                            <span className="text-[#64748b] ml-2">
                              via {ev.provider === 'google' ? 'Google' : 'Email'}
                              {ev.ip_address ? ` · IP ${ev.ip_address}` : ''}
                            </span>
                          </div>
                          <span className="font-mono-data text-[#475569] shrink-0">
                            {formatDateTime(ev.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Saved Cafes & Collections */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-[#e2e8f0] space-y-2">
                    <h4 className="font-semibold text-[#0f172a] inline-flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-[#b45309]" />
                      <span>Saved &amp; Favourite Cafes ({detailPayload.savedCafes.length})</span>
                    </h4>
                    {detailPayload.savedCafes.length === 0 ? (
                      <p className="text-[#64748b]">No saved cafes yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {detailPayload.savedCafes.slice(0, 8).map((sc) => (
                          <li key={sc.id} className="flex items-center justify-between gap-2">
                            <span className="font-medium text-[#0f172a] truncate">
                              {sc.snapshot.name}
                            </span>
                            <span className="text-[#64748b] shrink-0">
                              {sc.snapshot.area}
                              {sc.is_favourite ? ' ★' : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="p-4 rounded-xl border border-[#e2e8f0] space-y-2">
                    <h4 className="font-semibold text-[#0f172a] inline-flex items-center gap-1.5">
                      <FolderHeart className="w-3.5 h-3.5 text-[#1b4d3e]" />
                      <span>Collections ({detailPayload.collections.length})</span>
                    </h4>
                    {detailPayload.collections.length === 0 ? (
                      <p className="text-[#64748b]">No custom collections created.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {detailPayload.collections.map((col) => (
                          <li key={col.id} className="flex items-center justify-between gap-2">
                            <span className="font-medium text-[#0f172a] truncate">{col.name}</span>
                            <span className="font-mono-data text-[#64748b] shrink-0">
                              {col.items.length} cafes
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Booking History */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#0f172a] inline-flex items-center gap-1.5">
                    <CalendarCheck className="w-3.5 h-3.5 text-[#1b4d3e]" />
                    <span>Booking History ({detailPayload.bookings?.length ?? 0})</span>
                  </h4>
                  {!detailPayload.bookings || detailPayload.bookings.length === 0 ? (
                    <p className="text-[#64748b]">No workspace bookings submitted by this user.</p>
                  ) : (
                    <div className="divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-lg">
                      {detailPayload.bookings.map((b) => (
                        <div key={b.id} className="px-3 py-2 flex items-center justify-between gap-2">
                          <div>
                            <span className="font-mono-data font-semibold text-[#0f172a]">
                              {b.booking_ref}
                            </span>
                            <span className="text-[#475569] ml-2">
                              {b.cafe_name} · {b.workspace_type}
                            </span>
                          </div>
                          <span className="font-mono-data text-[#475569] shrink-0">
                            {b.booking_date} · <span className="capitalize font-semibold">{b.status}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subscription History */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#0f172a] inline-flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#b45309]" />
                    <span>Subscription History ({detailPayload.history.length})</span>
                  </h4>
                  {detailPayload.history.length === 0 ? (
                    <p className="text-[#64748b]">No subscription changes logged.</p>
                  ) : (
                    <div className="divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-lg max-h-40 overflow-y-auto">
                      {detailPayload.history.map((h) => (
                        <div key={h.id} className="px-3 py-2 flex items-center justify-between gap-2">
                          <span className="text-[#0f172a]">{h.note || `${h.action}: ${h.to_plan}`}</span>
                          <span className="font-mono-data text-[#64748b] shrink-0">
                            {new Date(h.created_at).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Feedback & Suggestions */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#0f172a] inline-flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[#b45309]" />
                    <span>Feedback &amp; Suggestions ({detailPayload.feedback?.length ?? 0})</span>
                  </h4>
                  {!detailPayload.feedback || detailPayload.feedback.length === 0 ? (
                    <p className="text-[#64748b]">No suggestions or enquiries recorded for this email.</p>
                  ) : (
                    <div className="divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-lg">
                      {detailPayload.feedback.map((fb) => (
                        <div key={`${fb.source}-${fb.id}`} className="px-3 py-2 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#0f172a]">{fb.title}</span>
                            <span className="capitalize text-[11px] font-semibold text-[#b45309]">
                              {fb.category} · {fb.status.replace('_', ' ')}
                            </span>
                          </div>
                          {fb.details && <p className="text-[#64748b] line-clamp-2">{fb.details}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payments */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#0f172a]">
                    Payments ({detailPayload.payments.length})
                  </h4>
                  {detailPayload.payments.length === 0 ? (
                    <p className="text-[#64748b]">No payment records for this user.</p>
                  ) : (
                    <div className="divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-lg">
                      {detailPayload.payments.map((p) => (
                        <div key={p.id} className="px-3 py-2 flex items-center justify-between gap-2">
                          <span className="font-mono-data font-semibold">
                            {p.receipt_number} · {p.plan_name || p.plan_id}
                          </span>
                          <span className="font-mono-data">
                            ₹{p.amount_inr} · <span className="capitalize">{p.status}</span> ·{' '}
                            {new Date(p.created_at).toLocaleDateString('en-IN')}
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

      {/* Delete User Confirmation Modal */}
      {confirmDeleteUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm user deletion"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#0f172a]">Delete Customer Account?</h3>
            <p className="text-xs text-[#475569] leading-relaxed">
              Permanently delete account{' '}
              <span className="font-semibold text-[#0f172a]">
                {confirmDeleteUser.name} ({confirmDeleteUser.email})
              </span>
              ? Their profile, saved cafes, collections, and active sessions will be removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteUser(null)}
                className="h-9 px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDeleteUser()}
                className="h-9 px-4 rounded-lg bg-[#dc2626] text-white text-xs font-semibold"
              >
                {deleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

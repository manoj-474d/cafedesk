import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FolderHeart,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { AdminUserDetailsPayload } from '../../types/subscription';
import type { AdminSubscriptionOverviewPayload, AdminSubscriberUser } from './AdminSubscriptionsTab';

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

export function AdminUsersTab({ csrfToken }: { csrfToken: string }) {
  const [data, setData] = useState<AdminSubscriptionOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [detailPayload, setDetailPayload] = useState<AdminUserDetailsPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AdminSubscriberUser | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleToggleSuspend = async (user: AdminSubscriberUser) => {
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
      setStatusMsg(`${user.email} is now ${nextStatus}.`);
      await loadData();
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setErrorMsg(err.error || 'Could not update user status.');
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

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.users.filter((u) => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (planFilter !== 'all' && u.subscription.plan_id !== planFilter) return false;
      if (!q) return true;
      return `${u.id} ${u.name} ${u.email} ${u.auth_provider}`.toLowerCase().includes(q);
    });
  }, [data, search, statusFilter, planFilter]);

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

  const suspendedCount = data.users.filter((u) => u.status === 'suspended').length;
  const verifiedCount = data.users.filter((u) => u.email_verified).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">User Management</h1>
          <p className="text-xs text-[#64748b]">
            Inspect customer profiles, saved cafes, authentication history, and account status across {data.users.length} accounts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
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

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
            <span>Total Registered Users</span>
            <Users className="w-4 h-4 text-[#0f172a]" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#0f172a]">
            {data.users.length}
          </p>
          <p className="text-xs text-[#64748b]">{verifiedCount} email verified</p>
        </div>
        <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <p className="text-xs font-medium text-[#64748b]">Active Accounts</p>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#1b4d3e]">
            {data.users.length - suspendedCount}
          </p>
          <p className="text-xs text-[#64748b]">Permitted to sign in &amp; upgrade</p>
        </div>
        <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
          <p className="text-xs font-medium text-[#64748b]">Suspended Accounts</p>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#b91c1c]">
            {suspendedCount}
          </p>
          <p className="text-xs text-[#64748b]">Blocked from session tokens</p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search ID, name, or email..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
          />
        </div>

        <select
          aria-label="Filter by account status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as 'all' | 'active' | 'suspended');
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
        >
          <option value="all">All Account Statuses</option>
          <option value="active">Active Only</option>
          <option value="suspended">Suspended Only</option>
        </select>

        <select
          aria-label="Filter by plan"
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
        >
          <option value="all">All Subscription Plans</option>
          {data.plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#475569] font-semibold">
              <th className="py-3 px-4">ID</th>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Registered</th>
              <th className="py-3 px-4">Current Plan</th>
              <th className="py-3 px-4">Last Login</th>
              <th className="py-3 px-4">Account Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {pagedUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#64748b]">
                  No user accounts match the current search.
                </td>
              </tr>
            ) : (
              pagedUsers.map((u) => (
                <tr key={u.id} className="hover:bg-[#f8fafc]">
                  <td className="py-3 px-4 font-mono-data text-[#64748b]">#{u.id}</td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-[#0f172a]">{u.name}</p>
                    <p className="text-[#64748b]">
                      {u.email}{' '}
                      <span className="uppercase text-[10px] font-mono-data">
                        ({u.auth_provider})
                      </span>
                    </p>
                  </td>
                  <td className="py-3 px-4 font-mono-data text-[#475569] whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <p className="font-semibold text-[#0f172a]">{u.subscription.plan_name}</p>
                    <p className="text-[11px] text-[#64748b] capitalize">
                      Sub: {u.subscription.status}
                    </p>
                  </td>
                  <td className="py-3 px-4 font-mono-data text-[#475569] whitespace-nowrap">
                    {formatDateTime(u.last_login_at)}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold capitalize ${
                        u.status === 'suspended'
                          ? 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
                          : 'bg-[#ecfdf5] border-[#a7f3d0] text-[#1b4d3e]'
                      }`}
                    >
                      {u.status}
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
                        {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
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

      {/* User Detail Modal (strictly zero passwords or secrets) */}
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
                    User #{detailPayload.user.id} · {detailPayload.user.email} ·{' '}
                    {detailPayload.user.auth_provider.toUpperCase()} auth
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
                      {detailPayload.user.status}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                    <p className="text-[#64748b]">Email Verified</p>
                    <p className="font-semibold text-[#0f172a] mt-0.5">
                      {detailPayload.user.email_verified ? 'Verified' : 'Pending'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                    <p className="text-[#64748b]">Last Login</p>
                    <p className="font-mono-data text-[#0f172a] mt-0.5">
                      {formatDateTime(detailPayload.user.last_login_at)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                    <p className="text-[#64748b]">Plan</p>
                    <p className="font-semibold text-[#0f172a] mt-0.5">
                      {detailPayload.subscription?.plan_name || 'Free Explorer'}
                    </p>
                  </div>
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
              ? Their saved cafes, collections, and active sessions will be deleted.
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

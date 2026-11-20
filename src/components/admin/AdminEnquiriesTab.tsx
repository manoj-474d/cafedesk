import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Download,
  Mail,
  MessageSquare,
  Search,
  Trash2,
} from 'lucide-react';

export interface SubmissionRecord {
  id: number;
  type: string;
  cafeName: string;
  area: string;
  contactName: string;
  contactInfo: string;
  plan: string;
  payload: Record<string, string | undefined>;
  status: 'new' | 'reviewed' | 'resolved' | 'archived';
  createdAt: number;
}

interface AdminEnquiriesTabProps {
  submissions: SubmissionRecord[];
  csrfToken: string;
  onRefreshSubmissions: () => Promise<void>;
}

const TYPE_LABELS: Record<string, string> = {
  contact_enquiry: 'Contact Enquiry',
  owner_enquiry: 'Partner / Owner',
  cafe_suggest: 'Suggest Cafe',
  cafe_update: 'Verify Update',
  newsletter: 'Newsletter',
  table_booking: 'Legacy Archive',
};

const STATUS_BADGE: Record<SubmissionRecord['status'], string> = {
  new: 'bg-[#fef3c7] text-[#b45309] border-[#fde68a]',
  reviewed: 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]',
  resolved: 'bg-[#ecfdf5] text-[#15803d] border-[#bbf7d0]',
  archived: 'bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]',
};

export function AdminEnquiriesTab({
  submissions,
  csrfToken,
  onRefreshSubmissions,
}: AdminEnquiriesTabProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmDeleteEnquiry, setConfirmDeleteEnquiry] = useState<SubmissionRecord | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return submissions.filter((s) => {
      if (typeFilter !== 'all' && s.type !== typeFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        s.cafeName,
        s.area,
        s.contactName,
        s.contactInfo,
        s.plan,
        s.payload?.notes ?? '',
        s.payload?.email ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [submissions, search, typeFilter, statusFilter]);

  const handleStatusChange = async (id: number, status: SubmissionRecord['status']) => {
    setBusyId(id);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setErrorMsg(d.error || 'Could not update enquiry status.');
        return;
      }
      await onRefreshSubmissions();
    } catch {
      setErrorMsg('Network error updating status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setBusyId(id);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken },
        credentials: 'include',
      });
      if (!res.ok) {
        setErrorMsg('Could not delete enquiry.');
        return;
      }
      setConfirmDeleteEnquiry(null);
      await onRefreshSubmissions();
    } catch {
      setErrorMsg('Network error deleting enquiry.');
    } finally {
      setBusyId(null);
    }
  };

  const newCount = submissions.filter((s) => s.status === 'new').length;

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0f172a]">
            Contact &amp; Enquiry Manager ({submissions.length})
          </h2>
          <p className="text-xs text-[#64748b]">
            Review guest messages, cafe suggestions, listing updates, partner enquiries, and newsletter
            subscribers.{' '}
            <span className="font-semibold text-[#b45309] font-mono-data">
              {newCount} unread
            </span>
          </p>
        </div>

        <a
          href="/api/admin/submissions/export"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Export CSV</span>
        </a>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="px-4 py-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-xs font-semibold text-[#b91c1c]"
        >
          {errorMsg}
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
        <div className="md:col-span-6 relative">
          <Search
            className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by guest name, branch, email, phone, or notes..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
          />
        </div>

        <div className="md:col-span-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by enquiry type"
            className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
          >
            <option value="all">All Types</option>
            <option value="contact_enquiry">Contact Enquiries</option>
            <option value="owner_enquiry">Partner / Owner Leads</option>
            <option value="cafe_suggest">Cafe Suggestions</option>
            <option value="cafe_update">Verification Updates</option>
            <option value="newsletter">Newsletter Signups</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by enquiry status"
            className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc]"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="resolved">Resolved</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Enquiries List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-10 text-center space-y-2">
          <MessageSquare className="w-6 h-6 text-[#94a3b8] mx-auto" aria-hidden="true" />
          <p className="text-sm font-semibold text-[#0f172a]">No enquiries match your filters</p>
          <p className="text-xs text-[#64748b]">
            Contact messages, cafe suggestions, listing updates, and partner enquiries appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="bg-white rounded-xl border border-[#e2e8f0] p-5 space-y-3"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                    <span className="font-mono-data text-[#64748b]">#{item.id}</span>
                    <span className="px-2 py-0.5 rounded bg-[#f1f5f9] text-[#0f172a] border border-[#e2e8f0]">
                      {TYPE_LABELS[item.type] || item.type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border capitalize ${
                        STATUS_BADGE[item.status] || STATUS_BADGE.new
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="text-[#64748b] font-mono-data">
                      {new Date(item.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-[#0f172a]">
                    {item.contactName || item.contactInfo || 'Anonymous Guest'}
                    {item.cafeName ? ` · ${item.cafeName}` : ''}
                    {item.area ? ` (${item.area})` : ''}
                  </h3>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#475569]">
                    {item.contactInfo && (
                      <span className="inline-flex items-center gap-1 font-mono-data">
                        <Mail className="w-3.5 h-3.5 text-[#64748b]" aria-hidden="true" />
                        {item.contactInfo}
                      </span>
                    )}
                    {item.payload?.email && item.payload.email !== item.contactInfo && (
                      <span className="font-mono-data">{item.payload.email}</span>
                    )}
                    {item.plan && (
                      <span className="text-[#b45309] font-semibold">Plan: {item.plan}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={item.status}
                    disabled={busyId === item.id}
                    onChange={(e) =>
                      handleStatusChange(item.id, e.target.value as SubmissionRecord['status'])
                    }
                    aria-label={`Change status for submission ${item.id}`}
                    className="h-9 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
                  >
                    <option value="new">New</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="resolved">Resolved</option>
                    <option value="archived">Archived</option>
                  </select>

                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => setConfirmDeleteEnquiry(item)}
                    aria-label={`Delete enquiry ${item.id}`}
                    className="h-9 w-9 rounded-lg border border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2] flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {(item.payload?.preferredDate ||
                item.payload?.preferredTime ||
                item.payload?.guestsCount ||
                item.payload?.wifiAndSockets ||
                item.payload?.mapOrAddress ||
                item.payload?.notes) && (
                <div className="p-3.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] text-xs space-y-2">
                  {(item.payload.preferredDate ||
                    item.payload.preferredTime ||
                    item.payload.guestsCount) && (
                    <div className="flex flex-wrap items-center gap-4 text-[#0f172a] font-semibold">
                      {item.payload.preferredDate && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                          Date: {item.payload.preferredDate}
                        </span>
                      )}
                      {item.payload.preferredTime && (
                        <span>Time: {item.payload.preferredTime}</span>
                      )}
                      {item.payload.guestsCount && (
                        <span>Guests: {item.payload.guestsCount}</span>
                      )}
                    </div>
                  )}

                  {item.payload.wifiAndSockets && (
                    <p className="text-[#475569]">
                      <span className="font-semibold text-[#0f172a]">Workspace specs:</span>{' '}
                      {item.payload.wifiAndSockets}
                    </p>
                  )}

                  {item.payload.mapOrAddress && (
                    <p className="text-[#475569] break-all">
                      <span className="font-semibold text-[#0f172a]">Map / Address:</span>{' '}
                      {item.payload.mapOrAddress}
                    </p>
                  )}

                  {item.payload.notes && (
                    <p className="text-[#334155] whitespace-pre-line leading-relaxed">
                      {item.payload.notes}
                    </p>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {confirmDeleteEnquiry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm enquiry deletion"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#0f172a]">Delete Enquiry?</h3>
            <p className="text-xs text-[#475569]">
              Permanently remove enquiry #{confirmDeleteEnquiry.id} from{' '}
              <span className="font-semibold text-[#0f172a]">
                {confirmDeleteEnquiry.contactName ||
                  confirmDeleteEnquiry.contactInfo ||
                  confirmDeleteEnquiry.cafeName ||
                  'Visitor'}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busyId === confirmDeleteEnquiry.id}
                onClick={() => setConfirmDeleteEnquiry(null)}
                className="h-9 px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === confirmDeleteEnquiry.id}
                onClick={() => void handleDelete(confirmDeleteEnquiry.id)}
                className="h-9 px-4 rounded-lg bg-[#dc2626] text-white text-xs font-semibold"
              >
                {busyId === confirmDeleteEnquiry.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

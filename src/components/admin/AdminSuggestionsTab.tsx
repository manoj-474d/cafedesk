import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Mail,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  FeatureSuggestion,
  SuggestionCategory,
  SuggestionStatus,
} from '../../types/subscription';

const CATEGORY_OPTIONS: SuggestionCategory[] = [
  'New Feature',
  'Improvement',
  'Cafe Information',
  'Bug',
  'Other',
];

const STATUS_OPTIONS: Array<{ value: SuggestionStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'planned', label: 'Planned' },
  { value: 'implemented', label: 'Implemented' },
  { value: 'rejected', label: 'Rejected' },
];

function getStatusBadgeClass(status: SuggestionStatus): string {
  if (status === 'implemented') return 'bg-[#ecfdf5] text-[#1b4d3e] border-[#a7f3d0]';
  if (status === 'planned') return 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]';
  if (status === 'under_review') return 'bg-[#fffbeb] text-[#b45309] border-[#fde68a]';
  if (status === 'rejected') return 'bg-[#fef2f2] text-[#991b1b] border-[#fecaca]';
  return 'bg-[#1c1613] text-[#f59e0b] border-[#1c1613]';
}

export function AdminSuggestionsTab({
  suggestions,
  csrfToken,
  onRefreshSuggestions,
}: {
  suggestions: FeatureSuggestion[];
  csrfToken: string;
  onRefreshSuggestions: () => Promise<void>;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | SuggestionCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SuggestionStatus>('all');
  const [drafts, setDrafts] = useState<
    Record<number, { status: SuggestionStatus; admin_notes: string }>
  >({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<FeatureSuggestion | null>(null);
  const PAGE_SIZE = 10;

  const counts = useMemo(() => {
    return {
      total: suggestions.length,
      newCount: suggestions.filter((s) => s.status === 'new').length,
      reviewCount: suggestions.filter((s) => s.status === 'under_review').length,
      plannedCount: suggestions.filter((s) => s.status === 'planned').length,
      implementedCount: suggestions.filter((s) => s.status === 'implemented').length,
    };
  }, [suggestions]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return suggestions.filter((s) => {
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (q) {
        const hay = `${s.title} ${s.details} ${s.email} ${s.admin_notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [suggestions, searchQuery, categoryFilter, statusFilter]);

  const getDraft = (s: FeatureSuggestion) =>
    drafts[s.id] ?? { status: s.status, admin_notes: s.admin_notes };

  const handleSave = async (s: FeatureSuggestion) => {
    const draft = getDraft(s);
    setBusyId(s.id);
    setNotice('');
    try {
      const res = await fetch(`/api/admin/suggestions/${s.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        setNotice(`Updated "${s.title}" to ${draft.status.replace('_', ' ')}.`);
        await onRefreshSuggestions();
      }
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedSuggestions = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleDelete = async (s: FeatureSuggestion) => {
    setBusyId(s.id);
    setNotice('');
    try {
      const res = await fetch(`/api/admin/suggestions/${s.id}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken },
        credentials: 'include',
      });
      if (res.ok) {
        setConfirmDeleteItem(null);
        setNotice(`Deleted suggestion "${s.title}".`);
        await onRefreshSuggestions();
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">User Suggestions &amp; Ideas</h1>
        <p className="text-xs text-[#64748b] mt-1">
          Review feature requests, cafe info updates, and feedback submitted via the floating
          &ldquo;Suggest an Idea&rdquo; button.
        </p>
      </div>

      {/* Summary Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Ideas', value: counts.total, color: 'text-[#0f172a]' },
          { label: 'New', value: counts.newCount, color: 'text-[#b45309]' },
          { label: 'Under Review', value: counts.reviewCount, color: 'text-[#b45309]' },
          { label: 'Planned', value: counts.plannedCount, color: 'text-[#1d4ed8]' },
          { label: 'Implemented', value: counts.implementedCount, color: 'text-[#1b4d3e]' },
        ].map((card) => (
          <div key={card.label} className="p-4 rounded-xl bg-white border border-[#e2e8f0]">
            <p className="text-xs font-medium text-[#64748b]">{card.label}</p>
            <p className={`font-mono-data text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-xs font-semibold text-[#1b4d3e] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search suggestions, details, or email..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
          />
        </div>

        <select
          aria-label="Filter by suggestion category"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value as 'all' | SuggestionCategory);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
        >
          <option value="all">All Categories</option>
          {CATEGORY_OPTIONS.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by suggestion status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as 'all' | SuggestionStatus);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((st) => (
            <option key={st.value} value={st.value}>
              {st.label}
            </option>
          ))}
        </select>
      </div>

      {/* Suggestions List */}
      {filtered.length === 0 ? (
        <div className="p-10 rounded-xl bg-white border border-[#e2e8f0] text-center space-y-2">
          <Lightbulb className="w-7 h-7 text-[#b45309] mx-auto" />
          <p className="text-sm font-semibold text-[#0f172a]">No suggestions match this filter</p>
          <p className="text-xs text-[#64748b]">
            Feedback sent from the public &ldquo;Suggest an Idea&rdquo; button appears here immediately.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pagedSuggestions.map((s) => {
            const draft = getDraft(s);
            return (
              <div
                key={s.id}
                className="p-5 rounded-xl bg-white border border-[#e2e8f0] space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#f1f5f9] text-[#0f172a] text-[11px] font-semibold">
                        {s.category}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded border text-[11px] font-semibold capitalize ${getStatusBadgeClass(
                          s.status
                        )}`}
                      >
                        {s.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-mono-data text-[#64748b]">
                        {new Date(s.created_at).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-[#0f172a]">{s.title}</h2>
                  </div>

                  <div className="inline-flex items-center gap-1.5 text-xs text-[#64748b]">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{s.email ? s.email : 'Anonymous visitor'}</span>
                  </div>
                </div>

                <p className="text-sm text-[#334155] leading-relaxed whitespace-pre-wrap bg-[#f8fafc] p-3.5 rounded-lg border border-[#e2e8f0]">
                  {s.details}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-1">
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                      Workflow Status
                    </label>
                    <select
                      value={draft.status}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [s.id]: { ...draft, status: e.target.value as SuggestionStatus },
                        }))
                      }
                      className="w-full h-9 px-2.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-6">
                    <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                      Admin Notes
                    </label>
                    <textarea
                      rows={2}
                      value={draft.admin_notes}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [s.id]: { ...draft, admin_notes: e.target.value },
                        }))
                      }
                      placeholder="Internal triage note or roadmap priority..."
                      className="w-full p-2 rounded-lg border border-[#cbd5e1] bg-white text-xs"
                    />
                  </div>

                  <div className="md:col-span-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={busyId === s.id}
                      onClick={() => void handleSave(s)}
                      className="h-9 px-3.5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Update</span>
                    </button>
                    <button
                      type="button"
                      disabled={busyId === s.id}
                      onClick={() => setConfirmDeleteItem(s)}
                      aria-label={`Delete suggestion ${s.title}`}
                      className="h-9 px-2.5 rounded-lg border border-[#fecaca] bg-[#fef2f2] hover:bg-[#fee2e2] text-[#991b1b] text-xs font-semibold inline-flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length > PAGE_SIZE && (
            <div className="px-4 py-3 rounded-xl border border-[#e2e8f0] bg-white flex items-center justify-between text-xs">
              <span className="text-[#64748b] font-mono-data">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} suggestions
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
      )}

      {confirmDeleteItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm suggestion deletion"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#0f172a]">Delete Suggestion?</h3>
            <p className="text-xs text-[#475569]">
              Permanently delete &ldquo;
              <span className="font-semibold text-[#0f172a]">{confirmDeleteItem.title}</span>
              &rdquo;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busyId === confirmDeleteItem.id}
                onClick={() => setConfirmDeleteItem(null)}
                className="h-9 px-4 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === confirmDeleteItem.id}
                onClick={() => void handleDelete(confirmDeleteItem)}
                className="h-9 px-4 rounded-lg bg-[#dc2626] text-white text-xs font-semibold"
              >
                {busyId === confirmDeleteItem.id ? 'Deleting...' : 'Delete Suggestion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { AuditLogEntry } from '../../types/subscription';

const PAGE_SIZE = 25;

function escapeCsv(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function AdminAuditTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [actors, setActors] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (actorFilter) params.set('actor', actorFilter);
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as {
          logs?: AuditLogEntry[];
          actors?: string[];
        };
        setLogs(data.logs ?? []);
        setActors(data.actors ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [search, actorFilter]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedLogs = logs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const exportCsv = () => {
    if (!logs.length) return;
    const headers = ['ID', 'Actor', 'Action', 'Target', 'Previous Value', 'New Value', 'Timestamp'];
    const rows = logs.map((l) => [
      l.id,
      l.actor,
      l.action,
      l.target,
      l.previous_value,
      l.new_value,
      new Date(l.created_at).toISOString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cafedesk-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Owner Activity &amp; Audit Logs</h1>
          <p className="text-xs text-[#64748b]">
            Immutable trail of cafe edits, menu price changes, subscription overrides, refunds, and security events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] disabled:opacity-40 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => void loadLogs()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search action, target, previous or new value..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
          />
        </div>

        <select
          aria-label="Filter by admin actor"
          value={actorFilter}
          onChange={(e) => {
            setActorFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs font-semibold"
        >
          <option value="">All Admin Actors</option>
          {actors.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {/* Audit Table & Mobile Cards */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#64748b]">Loading audit records...</div>
        ) : pagedLogs.length === 0 ? (
          <div className="p-8 text-center space-y-1">
            <Activity className="w-6 h-6 text-[#64748b] mx-auto" />
            <p className="text-xs font-semibold text-[#0f172a]">No audit events match this filter</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#475569] font-semibold">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target</th>
                    <th className="py-3 px-4">Change Diff (Previous → New)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {pagedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#f8fafc]">
                      <td className="py-3 px-4 font-mono-data text-[#64748b] whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#0f172a] whitespace-nowrap">
                        {log.actor}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#0f172a]">{log.action}</td>
                      <td className="py-3 px-4 text-[#475569]">{log.target || '—'}</td>
                      <td className="py-3 px-4">
                        {log.previous_value || log.new_value ? (
                          <div className="flex flex-wrap items-center gap-1.5 font-mono-data text-[11px]">
                            {log.previous_value && (
                              <span className="px-1.5 py-0.5 rounded bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]">
                                {log.previous_value}
                              </span>
                            )}
                            {log.previous_value && log.new_value && (
                              <span className="text-[#64748b]">→</span>
                            )}
                            {log.new_value && (
                              <span className="px-1.5 py-0.5 rounded bg-[#ecfdf5] text-[#1b4d3e] border border-[#a7f3d0]">
                                {log.new_value}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#94a3b8]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-[#e2e8f0]">
              {pagedLogs.map((log) => (
                <div key={log.id} className="p-4 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-[#0f172a]">{log.actor}</span>
                    <span className="font-mono-data text-[11px] text-[#64748b] shrink-0">
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="font-medium text-[#0f172a]">{log.action}</p>
                  {log.target && <p className="text-[#475569]">Target: {log.target}</p>}
                  {(log.previous_value || log.new_value) && (
                    <div className="flex flex-wrap items-center gap-1.5 font-mono-data text-[11px] pt-0.5">
                      {log.previous_value && (
                        <span className="px-1.5 py-0.5 rounded bg-[#fef2f2] text-[#991b1b] border border-[#fecaca] break-all">
                          {log.previous_value}
                        </span>
                      )}
                      {log.previous_value && log.new_value && (
                        <span className="text-[#64748b]">→</span>
                      )}
                      {log.new_value && (
                        <span className="px-1.5 py-0.5 rounded bg-[#ecfdf5] text-[#1b4d3e] border border-[#a7f3d0] break-all">
                          {log.new_value}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {logs.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between text-xs">
            <span className="text-[#64748b] font-mono-data">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, logs.length)} of {logs.length} audit events
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
    </div>
  );
}

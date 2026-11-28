import React, { useState } from 'react';
import { Bell, Building2, Check, FileEdit, ShieldCheck, X } from 'lucide-react';
import { resolveApiUrl } from '../../context/AuthContext';

export interface AdminClaimQueueItem {
  id: number;
  cafe_id: string;
  cafe_name: string;
  user_id: number;
  owner_name: string;
  phone: string;
  email: string;
  verification_proof: string;
  notes: string;
  status: string;
  admin_note: string;
  created_at: number;
  reviewed_at: number | null;
}

export interface AdminOwnerChangeQueueItem {
  id: number;
  cafe_id: string;
  cafe_name: string;
  user_id: number;
  owner_user_name: string;
  owner_user_email: string;
  change_type: string;
  payload: Record<string, unknown>;
  summary: string;
  status: string;
  admin_note: string;
  created_at: number;
  reviewed_at: number | null;
}

interface AdminOwnerClaimsTabProps {
  claims: AdminClaimQueueItem[];
  ownerChanges: AdminOwnerChangeQueueItem[];
  csrfToken: string;
  onRefresh: () => Promise<void>;
}

export function AdminOwnerClaimsTab({
  claims,
  ownerChanges,
  csrfToken,
  onRefresh,
}: AdminOwnerClaimsTabProps) {
  const [subTab, setSubTab] = useState<'claims' | 'changes'>('claims');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleClaimDecision = async (id: number, status: 'approved' | 'rejected') => {
    setBusyKey(`claim-${id}`);
    setFeedback('');
    setErrorMsg('');
    try {
      const res = await fetch(resolveApiUrl(`/api/admin/claims/${id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(d.error || 'Could not update claim.');
      } else {
        setFeedback(`Ownership claim #${id} marked ${status}.`);
        await onRefresh();
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleOwnerChangeDecision = async (id: number, status: 'approved' | 'rejected') => {
    setBusyKey(`change-${id}`);
    setFeedback('');
    setErrorMsg('');
    try {
      const res = await fetch(resolveApiUrl(`/api/admin/owner-changes/${id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ status }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        error?: string;
        followersNotified?: number;
      };
      if (!res.ok) {
        setErrorMsg(d.error || 'Could not process owner change request.');
      } else {
        setFeedback(
          status === 'approved'
            ? `Owner update #${id} applied to live listing (${d.followersNotified ?? 0} cafe followers notified).`
            : `Owner update #${id} rejected.`
        );
        await onRefresh();
      }
    } finally {
      setBusyKey(null);
    }
  };

  const pendingClaims = claims.filter((c) => c.status === 'pending').length;
  const pendingChanges = ownerChanges.filter((o) => o.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b45309]">
          Partner Verification &amp; Moderation
        </p>
        <h1 className="font-serif-display text-3xl font-bold text-[#0f172a]">
          Cafe Ownership Claims &amp; Listing Updates
        </h1>
        <p className="text-xs text-[#475569] mt-0.5">
          Verify cafe owners before granting portal editing rights, and review menu/facility changes
          before pushing alerts to cafe followers.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubTab('claims')}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-2 border transition-colors ${
            subTab === 'claims'
              ? 'bg-[#1c1613] text-white border-[#1c1613]'
              : 'bg-white text-[#0f172a] border-[#e2e8f0] hover:border-[#b45309]'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Ownership Claims ({claims.length})</span>
          {pendingClaims > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-[#b45309] text-white text-[10px] font-mono-data">
              {pendingClaims}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubTab('changes')}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-2 border transition-colors ${
            subTab === 'changes'
              ? 'bg-[#1c1613] text-white border-[#1c1613]'
              : 'bg-white text-[#0f172a] border-[#e2e8f0] hover:border-[#b45309]'
          }`}
        >
          <FileEdit className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Owner Change Requests ({ownerChanges.length})</span>
          {pendingChanges > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-[#b45309] text-white text-[10px] font-mono-data">
              {pendingChanges}
            </span>
          )}
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-[#ecfdf5] border border-[#bbf7d0] text-xs font-medium text-[#1b4d3e]"
        >
          {feedback}
        </div>
      )}
      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs font-medium text-[#991b1b]"
        >
          {errorMsg}
        </div>
      )}

      {subTab === 'claims' ? (
        <div className="space-y-3">
          {claims.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-8 text-center text-xs text-[#475569]">
              No ownership claim requests yet.
            </div>
          ) : (
            claims.map((claim) => (
              <div
                key={claim.id}
                className="bg-white rounded-2xl border border-[#e2e8f0] p-5 flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-sm text-[#0f172a]">{claim.cafe_name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                        claim.status === 'approved'
                          ? 'bg-[#ecfdf5] text-[#1b4d3e]'
                          : claim.status === 'rejected'
                          ? 'bg-[#fef2f2] text-[#991b1b]'
                          : 'bg-[#fffbeb] text-[#92400e]'
                      }`}
                    >
                      {claim.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#475569]">
                    Applicant: <strong>{claim.owner_name}</strong> · {claim.phone} · {claim.email}
                  </p>
                  <p className="text-xs text-[#0f172a] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-3 py-2">
                    <strong>Verification Proof:</strong> {claim.verification_proof}
                  </p>
                  {claim.notes && <p className="text-xs text-[#475569]">Notes: {claim.notes}</p>}
                </div>

                {claim.status === 'pending' && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyKey === `claim-${claim.id}`}
                      onClick={() => void handleClaimDecision(claim.id, 'approved')}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#1b4d3e] hover:bg-[#143a2f] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Verify &amp; Approve</span>
                    </button>
                    <button
                      type="button"
                      disabled={busyKey === `claim-${claim.id}`}
                      onClick={() => void handleClaimDecision(claim.id, 'rejected')}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] hover:bg-[#fee2e2] text-[#991b1b] text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {ownerChanges.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-8 text-center text-xs text-[#475569]">
              No owner change requests submitted yet.
            </div>
          ) : (
            ownerChanges.map((reqItem) => (
              <div
                key={reqItem.id}
                className="bg-white rounded-2xl border border-[#e2e8f0] p-5 flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-sm text-[#0f172a]">{reqItem.cafe_name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#eff6ff] text-[#1e40af] text-[11px] font-semibold">
                      {reqItem.change_type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                        reqItem.status === 'approved'
                          ? 'bg-[#ecfdf5] text-[#1b4d3e]'
                          : reqItem.status === 'rejected'
                          ? 'bg-[#fef2f2] text-[#991b1b]'
                          : 'bg-[#fffbeb] text-[#92400e]'
                      }`}
                    >
                      {reqItem.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#475569]">
                    Requested by <strong>{reqItem.owner_user_name || reqItem.owner_user_email}</strong>{' '}
                    · {reqItem.summary}
                  </p>
                  {typeof reqItem.payload?.photoUrl === 'string' && reqItem.payload.photoUrl && (
                    <a
                      href={reqItem.payload.photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block w-32 h-24 rounded-xl overflow-hidden border border-[#e2e8f0]"
                    >
                      <img
                        src={reqItem.payload.photoUrl}
                        alt={`Owner upload for ${reqItem.cafe_name}`}
                        className="w-full h-full object-cover"
                      />
                    </a>
                  )}
                  <pre className="text-[11px] font-mono-data bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3 overflow-x-auto text-[#0f172a]">
                    {JSON.stringify(reqItem.payload, null, 2)}
                  </pre>
                </div>

                {reqItem.status === 'pending' && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyKey === `change-${reqItem.id}`}
                      onClick={() => void handleOwnerChangeDecision(reqItem.id, 'approved')}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#1b4d3e] hover:bg-[#143a2f] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Apply &amp; Notify Followers</span>
                    </button>
                    <button
                      type="button"
                      disabled={busyKey === `change-${reqItem.id}`}
                      onClick={() => void handleOwnerChangeDecision(reqItem.id, 'rejected')}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] hover:bg-[#fee2e2] text-[#991b1b] text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

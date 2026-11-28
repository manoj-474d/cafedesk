import React, { useState } from 'react';
import {
  Camera,
  Check,
  FileText,
  IndianRupee,
  Megaphone,
  MessageSquare,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { resolveApiUrl } from '../../context/AuthContext';

export interface AdminReviewQueueItem {
  id: number;
  cafe_id: string;
  cafe_key: string;
  cafe_name: string;
  user_id: number;
  author_name: string;
  rating: number;
  visit_purpose: string;
  wifi_confirmed: string;
  sockets_confirmed: string;
  noise_observed: number | null;
  review_text: string;
  helpful_count: number;
  moderation_status: string;
  created_at: number;
}

export interface AdminContributionQueueItem {
  id: number;
  cafe_id: string;
  cafe_key: string;
  cafe_name: string;
  user_id: number;
  contributor_name: string;
  contribution_type: string;
  payload: Record<string, unknown>;
  photo_url: string;
  points_awarded: number;
  moderation_status: string;
  reviewer_note: string;
  created_at: number;
}

export interface AdminPromotionQueueItem {
  id: number;
  cafe_id: string;
  cafe_name: string;
  owner_user_id: number;
  title: string;
  badge_label: string;
  placement: string;
  area: string;
  budget_inr: number;
  starts_at: number;
  ends_at: number;
  status: string;
  created_at: number;
}

interface AdminModerationTabProps {
  reviews: AdminReviewQueueItem[];
  contributions: AdminContributionQueueItem[];
  promotions: AdminPromotionQueueItem[];
  csrfToken: string;
  onRefresh: () => Promise<void>;
}

export function AdminModerationTab({
  reviews,
  contributions,
  promotions,
  csrfToken,
  onRefresh,
}: AdminModerationTabProps) {
  const [subTab, setSubTab] = useState<'reviews' | 'contributions' | 'promotions'>('reviews');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>(
    'pending'
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleReviewAction = async (
    id: number,
    moderation_status: 'approved' | 'rejected' | 'pending'
  ) => {
    setBusyKey(`rev-${id}`);
    setErrorMsg('');
    setFeedback('');
    try {
      const res = await fetch(resolveApiUrl(`/api/admin/reviews/${id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ moderation_status }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(d.error || 'Could not update review status.');
      } else {
        setFeedback(`Review #${id} marked ${moderation_status}.`);
        await onRefresh();
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleContributionAction = async (
    id: number,
    moderation_status: 'approved' | 'rejected' | 'pending'
  ) => {
    setBusyKey(`contrib-${id}`);
    setErrorMsg('');
    setFeedback('');
    try {
      const res = await fetch(resolveApiUrl(`/api/admin/contributions/${id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ moderation_status }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(d.error || 'Could not update contribution status.');
      } else {
        setFeedback(
          moderation_status === 'approved'
            ? `Contribution #${id} approved (+20 bonus points credited).`
            : `Contribution #${id} marked ${moderation_status}.`
        );
        await onRefresh();
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handlePromotionStatus = async (
    id: number,
    status: 'active' | 'paused' | 'rejected' | 'ended'
  ) => {
    setBusyKey(`promo-${id}`);
    setErrorMsg('');
    setFeedback('');
    try {
      const res = await fetch(resolveApiUrl(`/api/admin/promotions/${id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(d.error || 'Could not update promotion status.');
      } else {
        setFeedback(`Promotion #${id} updated to ${status}.`);
        await onRefresh();
      }
    } finally {
      setBusyKey(null);
    }
  };

  const pendingReviewsCount = reviews.filter((r) => r.moderation_status === 'pending').length;
  const pendingContribsCount = contributions.filter((c) => c.moderation_status === 'pending').length;
  const pendingPromosCount = promotions.filter((p) => p.status === 'pending').length;

  const filteredReviews = reviews.filter((r) =>
    statusFilter === 'all' ? true : r.moderation_status === statusFilter
  );
  const filteredContribs = contributions.filter((c) =>
    statusFilter === 'all' ? true : c.moderation_status === statusFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b45309]">
            Community &amp; Sponsored Queue
          </p>
          <h1 className="font-serif-display text-3xl font-bold text-[#0f172a]">
            Community Moderation &amp; Promotions
          </h1>
          <p className="text-xs text-[#475569] mt-0.5">
            Approve genuine reviews, verify uploaded photos (+20 contributor pts), and manage
            transparent Sponsored spotlight placements.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubTab('reviews')}
            className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-2 border transition-colors ${
              subTab === 'reviews'
                ? 'bg-[#1c1613] text-white border-[#1c1613]'
                : 'bg-white text-[#0f172a] border-[#e2e8f0] hover:border-[#b45309]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reviews ({reviews.length})</span>
            {pendingReviewsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-[#b45309] text-white text-[10px] font-mono-data">
                {pendingReviewsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('contributions')}
            className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-2 border transition-colors ${
              subTab === 'contributions'
                ? 'bg-[#1c1613] text-white border-[#1c1613]'
                : 'bg-white text-[#0f172a] border-[#e2e8f0] hover:border-[#b45309]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Photos &amp; Menu Updates ({contributions.length})</span>
            {pendingContribsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-[#b45309] text-white text-[10px] font-mono-data">
                {pendingContribsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('promotions')}
            className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-2 border transition-colors ${
              subTab === 'promotions'
                ? 'bg-[#1c1613] text-white border-[#1c1613]'
                : 'bg-white text-[#0f172a] border-[#e2e8f0] hover:border-[#b45309]'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sponsored Offers ({promotions.length})</span>
            {pendingPromosCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-[#b45309] text-white text-[10px] font-mono-data">
                {pendingPromosCount}
              </span>
            )}
          </button>
        </div>

        {subTab !== 'promotions' && (
          <div className="flex items-center gap-1.5 bg-white border border-[#e2e8f0] rounded-xl p-1 text-xs">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`min-h-[32px] px-3 rounded-lg font-semibold capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-[#b45309] text-white'
                    : 'text-[#475569] hover:text-[#0f172a]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}
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

      {/* REVIEWS QUEUE */}
      {subTab === 'reviews' && (
        <div className="space-y-3">
          {filteredReviews.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-8 text-center text-xs text-[#475569]">
              No reviews match the &ldquo;{statusFilter}&rdquo; filter.
            </div>
          ) : (
            filteredReviews.map((rev) => (
              <div
                key={rev.id}
                className="bg-white rounded-2xl border border-[#e2e8f0] p-5 flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-sm text-[#0f172a]">{rev.cafe_name}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] font-mono-data font-semibold">
                      <Star className="w-3 h-3 fill-[#d97706] text-[#d97706]" aria-hidden="true" />
                      {rev.rating}/5
                    </span>
                    <span className="text-[#475569]">
                      by <strong>{rev.author_name}</strong> ·{' '}
                      {new Date(rev.created_at).toLocaleDateString('en-IN')}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                        rev.moderation_status === 'approved'
                          ? 'bg-[#ecfdf5] text-[#1b4d3e]'
                          : rev.moderation_status === 'rejected'
                          ? 'bg-[#fef2f2] text-[#991b1b]'
                          : 'bg-[#fffbeb] text-[#92400e]'
                      }`}
                    >
                      {rev.moderation_status}
                    </span>
                  </div>
                  <p className="text-sm text-[#0f172a] leading-relaxed">{rev.review_text}</p>
                  <p className="text-xs text-[#475569]">
                    Purpose: {rev.visit_purpose} · Wi-Fi check: {rev.wifi_confirmed} · Sockets check:{' '}
                    {rev.sockets_confirmed}
                    {rev.noise_observed ? ` · Noise ${rev.noise_observed}/5` : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {rev.moderation_status !== 'approved' && (
                    <button
                      type="button"
                      disabled={busyKey === `rev-${rev.id}`}
                      onClick={() => void handleReviewAction(rev.id, 'approved')}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#1b4d3e] hover:bg-[#143a2f] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Approve</span>
                    </button>
                  )}
                  {rev.moderation_status !== 'rejected' && (
                    <button
                      type="button"
                      disabled={busyKey === `rev-${rev.id}`}
                      onClick={() => void handleReviewAction(rev.id, 'rejected')}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] hover:bg-[#fee2e2] text-[#991b1b] text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Reject</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* COMMUNITY CONTRIBUTIONS QUEUE */}
      {subTab === 'contributions' && (
        <div className="space-y-3">
          {filteredContribs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-8 text-center text-xs text-[#475569]">
              No community contributions match the &ldquo;{statusFilter}&rdquo; filter.
            </div>
          ) : (
            filteredContribs.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-[#e2e8f0] p-5 flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                <div className="flex flex-col sm:flex-row gap-4 min-w-0">
                  {item.photo_url && (
                    <a
                      href={item.photo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-28 h-20 rounded-xl overflow-hidden border border-[#e2e8f0] shrink-0 bg-[#f8fafc]"
                    >
                      <img
                        src={item.photo_url}
                        alt={`Community photo for ${item.cafe_name}`}
                        className="w-full h-full object-cover"
                      />
                    </a>
                  )}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-sm text-[#0f172a]">{item.cafe_name}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#eff6ff] text-[#1e40af] text-[11px] font-semibold">
                        {item.contribution_type === 'photo' ? (
                          <Camera className="w-3 h-3" aria-hidden="true" />
                        ) : item.contribution_type === 'menu_price' ? (
                          <IndianRupee className="w-3 h-3" aria-hidden="true" />
                        ) : (
                          <FileText className="w-3 h-3" aria-hidden="true" />
                        )}
                        {item.contribution_type.replace('_', ' ')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                          item.moderation_status === 'approved'
                            ? 'bg-[#ecfdf5] text-[#1b4d3e]'
                            : item.moderation_status === 'rejected'
                            ? 'bg-[#fef2f2] text-[#991b1b]'
                            : 'bg-[#fffbeb] text-[#92400e]'
                        }`}
                      >
                        {item.moderation_status}
                      </span>
                    </div>
                    <p className="text-xs text-[#475569]">
                      Submitted by <strong>{item.contributor_name}</strong> ·{' '}
                      {new Date(item.created_at).toLocaleDateString('en-IN')} · Points credited:{' '}
                      <strong className="font-mono-data">{item.points_awarded}</strong>
                    </p>
                    <pre className="text-[11px] font-mono-data bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-2.5 overflow-x-auto text-[#0f172a]">
                      {JSON.stringify(item.payload, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {item.moderation_status !== 'approved' && (
                    <button
                      type="button"
                      disabled={busyKey === `contrib-${item.id}`}
                      onClick={() => void handleContributionAction(item.id, 'approved')}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#1b4d3e] hover:bg-[#143a2f] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Approve (+20 pts)</span>
                    </button>
                  )}
                  {item.moderation_status !== 'rejected' && (
                    <button
                      type="button"
                      disabled={busyKey === `contrib-${item.id}`}
                      onClick={() => void handleContributionAction(item.id, 'rejected')}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] hover:bg-[#fee2e2] text-[#991b1b] text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Reject</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TRANSPARENT SPONSORED PROMOTIONS */}
      {subTab === 'promotions' && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-[#fffbeb] border border-[#fde68a] text-xs text-[#92400e] flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              Sponsored spotlights carry a clear disclosure badge on the homepage and never affect
              organic Work-Ready Scores, Confidence Scores, or customer star ratings.
            </p>
          </div>
          {promotions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-8 text-center text-xs text-[#475569]">
              No sponsored promotion requests submitted yet.
            </div>
          ) : (
            promotions.map((promo) => (
              <div
                key={promo.id}
                className="bg-white rounded-2xl border border-[#e2e8f0] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-sm text-[#0f172a]">{promo.cafe_name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] font-semibold">
                      {promo.badge_label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#0f172a] font-mono-data">
                      ₹{promo.budget_inr} · {promo.placement}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[#1b4d3e] font-semibold capitalize">
                      {promo.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[#0f172a]">{promo.title}</p>
                  <p className="text-xs font-mono-data text-[#475569]">
                    {promo.area || 'Bengaluru'} · Window:{' '}
                    {new Date(promo.starts_at).toLocaleDateString('en-IN')} –{' '}
                    {new Date(promo.ends_at).toLocaleDateString('en-IN')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {promo.status !== 'active' && (
                    <button
                      type="button"
                      disabled={busyKey === `promo-${promo.id}`}
                      onClick={() => void handlePromotionStatus(promo.id, 'active')}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#1b4d3e] hover:bg-[#143a2f] text-white text-xs font-semibold"
                    >
                      Activate
                    </button>
                  )}
                  {promo.status === 'active' && (
                    <button
                      type="button"
                      disabled={busyKey === `promo-${promo.id}`}
                      onClick={() => void handlePromotionStatus(promo.id, 'paused')}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs font-semibold"
                    >
                      Pause
                    </button>
                  )}
                  {promo.status !== 'rejected' && (
                    <button
                      type="button"
                      disabled={busyKey === `promo-${promo.id}`}
                      onClick={() => void handlePromotionStatus(promo.id, 'rejected')}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-xs font-semibold"
                    >
                      Reject
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

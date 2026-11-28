import React, { useState } from 'react';
import { Activity, CheckCircle2, Cpu, Database, Save, Sliders, ToggleRight } from 'lucide-react';
import { DEFAULT_FEATURE_FLAGS, DEFAULT_SCORING_CONFIG } from '../../config/constants';
import type { FeatureFlags, ScoringConfig, SiteSettings } from '../../types/cms';

export interface AdminSystemHealthPayload {
  sqliteQuickCheck: boolean;
  uploadsWritable: boolean;
  googleMapsConfigured: boolean;
  razorpayConfigured: boolean;
  supabaseConfigured: boolean;
  enabledFlagsCount: number;
  totalFlagsCount: number;
  placesStats?: {
    has_server_key: boolean;
    total_calls: number;
    calls_24h: number;
    cache_hits_24h: number;
    errors_24h: number;
    last_error: string;
  };
  tableCounts: Record<string, number>;
  checkedAt: number;
}

interface AdminSystemControlsTabProps {
  settings: SiteSettings;
  systemHealth: AdminSystemHealthPayload | null;
  onSaveSettings: (next: SiteSettings) => Promise<boolean>;
  onRefreshSystem: () => Promise<void>;
}

const FEATURE_FLAG_META: Array<{ key: keyof FeatureFlags; label: string; desc: string }> = [
  {
    key: 'smart_nl_search',
    label: 'Natural-Language Discovery Search',
    desc: 'Understands budget, food category, locality & spelling synonyms.',
  },
  {
    key: 'quality_scores',
    label: 'Independent Work-Ready & Confidence Scores',
    desc: 'Shows separated objective scores on cards and detail pages.',
  },
  {
    key: 'visit_companion',
    label: 'Personal Visit Companion Checklist',
    desc: 'Interactive pre-visit checklist and personal note synced to user account.',
  },
  {
    key: 'menu_intelligence',
    label: 'Menu Intelligence & Category Comparison',
    desc: 'Compare coffee, tea, snacks, desserts & meals with source provenance.',
  },
  {
    key: 'community_reviews',
    label: 'Community Reviews & Facility Verification',
    desc: 'Allows signed-in members to post reviews and check Wi-Fi/plugs.',
  },
  {
    key: 'community_photos',
    label: 'Community Photo & Price Contributions',
    desc: 'Allows photo/price uploads moderated in Admin before going live.',
  },
  {
    key: 'public_collections',
    label: 'Shareable Public Cafe Collections',
    desc: 'Lets Plus subscribers publish read-only /collections/:slug links.',
  },
  {
    key: 'personalisation',
    label: 'Discovery Personalisation & Preferences',
    desc: 'Tailors homepage & account picks to user favourite areas & budget.',
  },
  {
    key: 'cafe_following',
    label: 'Cafe Following',
    desc: 'Lets visitors follow cafes on detail pages and manage follows in Account.',
  },
  {
    key: 'notifications',
    label: 'Follower Update Notifications Inbox',
    desc: 'Delivers owner-approved cafe updates to followers in their account inbox.',
  },
  {
    key: 'owner_portal',
    label: 'Cafe Owner Partner Portal (/partner-portal)',
    desc: 'Allows cafe owners to claim listings and submit moderated updates.',
  },
  {
    key: 'promotions',
    label: 'Transparent Sponsored Placements',
    desc: 'Displays clearly disclosed Sponsored cafe highlights on homepage.',
  },
  {
    key: 'bookings',
    label: 'Workspace Seat Bookings',
    desc: 'Enables subscriber seat reservation requests on supported cafes.',
  },
  {
    key: 'live_google_places',
    label: 'Live Google Places Discovery',
    desc: 'Queries live Google Maps Places API when browsing or searching areas.',
  },
];

export function AdminSystemControlsTab({
  settings,
  systemHealth,
  onSaveSettings,
  onRefreshSystem,
}: AdminSystemControlsTabProps) {
  const [flags, setFlags] = useState<FeatureFlags>(() => ({
    ...DEFAULT_FEATURE_FLAGS,
    ...(settings.feature_flags || {}),
  }));
  const [scoring, setScoring] = useState<ScoringConfig>(() => ({
    work_ready_weights: {
      ...DEFAULT_SCORING_CONFIG.work_ready_weights,
      ...(settings.scoring_config?.work_ready_weights || {}),
    },
    confidence_weights: {
      ...DEFAULT_SCORING_CONFIG.confidence_weights,
      ...(settings.scoring_config?.confidence_weights || {}),
    },
  }));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    setErrMsg('');
    const ok = await onSaveSettings({
      ...settings,
      feature_flags: flags,
      scoring_config: scoring,
    });
    setSaving(false);
    if (ok) {
      setSaveMsg('Feature controls and scoring weights saved live.');
      await onRefreshSystem();
    } else {
      setErrMsg('Failed to save settings (Full Admin access required).');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b45309]">
            Command Centre Configuration
          </p>
          <h1 className="font-serif-display text-3xl font-bold text-[#0f172a]">
            Feature Controls, Scoring Weights &amp; System Health
          </h1>
          <p className="text-xs text-[#475569] mt-0.5">
            Toggle CafeDesk 2.0 platform capabilities live, tune quality scoring formulas, and
            inspect live infrastructure health.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onRefreshSystem()}
          className="min-h-[40px] px-4 rounded-xl bg-white border border-[#cbd5e1] hover:border-[#b45309] text-xs font-semibold text-[#0f172a] inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Activity className="w-3.5 h-3.5 text-[#1b4d3e]" aria-hidden="true" />
          <span>Refresh Diagnostics</span>
        </button>
      </div>

      {/* System Health Diagnostics */}
      <section className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
          <h2 className="font-serif-display text-xl font-bold text-[#0f172a]">
            Live System Health &amp; Service Readiness
          </h2>
        </div>

        {!systemHealth ? (
          <p className="text-xs text-[#475569]">Loading live diagnostics...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              {[
                { label: 'SQLite DB', ok: systemHealth.sqliteQuickCheck },
                { label: 'Uploads Disk', ok: systemHealth.uploadsWritable },
                { label: 'Google Maps API', ok: systemHealth.googleMapsConfigured },
                { label: 'Razorpay Keys', ok: systemHealth.razorpayConfigured },
                { label: 'Supabase Auth', ok: systemHealth.supabaseConfigured },
                {
                  label: `Flags (${systemHealth.enabledFlagsCount}/${systemHealth.totalFlagsCount})`,
                  ok: systemHealth.enabledFlagsCount > 0,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className={`rounded-xl border p-3 flex items-center justify-between gap-2 ${
                    s.ok
                      ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#1b4d3e]'
                      : 'bg-[#fffbeb] border-[#fde68a] text-[#92400e]'
                  }`}
                >
                  <span className="font-semibold">{s.label}</span>
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
              {Object.entries(systemHealth.tableCounts).map(([key, val]) => (
                <div
                  key={key}
                  className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 text-center"
                >
                  <p className="font-mono-data text-lg font-bold text-[#0f172a] tabular-nums">
                    {val}
                  </p>
                  <p className="text-[11px] text-[#475569] capitalize">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </p>
                </div>
              ))}
            </div>

            {systemHealth.placesStats && (
              <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3.5 text-xs flex flex-wrap items-center gap-4 text-[#0f172a]">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Cpu className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                  Places API Telemetry (24h):
                </span>
                <span className="font-mono-data">
                  Calls: <strong>{systemHealth.placesStats.calls_24h}</strong>
                </span>
                <span className="font-mono-data">
                  Cache hits: <strong>{systemHealth.placesStats.cache_hits_24h}</strong>
                </span>
                <span className="font-mono-data">
                  Errors: <strong>{systemHealth.placesStats.errors_24h}</strong>
                </span>
                <span className="font-mono-data">
                  All-time: <strong>{systemHealth.placesStats.total_calls}</strong>
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Feature Toggles */}
        <section className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ToggleRight className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
            <h2 className="font-serif-display text-xl font-bold text-[#0f172a]">
              Feature Control Switches (Live Runtime)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FEATURE_FLAG_META.map((item) => {
              const checked = flags[item.key] !== false;
              return (
                <label
                  key={item.key}
                  className={`rounded-xl border p-3.5 flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                    checked ? 'bg-[#f8fafc] border-[#cbd5e1]' : 'bg-[#fef2f2]/40 border-[#fecaca]'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-[#0f172a]">{item.label}</p>
                    <p className="text-[11px] text-[#475569]">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setFlags((prev) => ({ ...prev, [item.key]: e.target.checked }))
                    }
                    className="w-5 h-5 accent-[#1b4d3e] shrink-0 mt-0.5"
                  />
                </label>
              );
            })}
          </div>
        </section>

        {/* Independent Quality Score Weights */}
        <section className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
              <h2 className="font-serif-display text-xl font-bold text-[#0f172a]">
                Independent Quality Scoring Rules
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                setScoring({
                  work_ready_weights: { ...DEFAULT_SCORING_CONFIG.work_ready_weights },
                  confidence_weights: { ...DEFAULT_SCORING_CONFIG.confidence_weights },
                })
              }
              className="text-xs font-semibold text-[#b45309] hover:underline"
            >
              Reset Defaults
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3 rounded-xl border border-[#e2e8f0] p-4 bg-[#f8fafc]">
              <p className="text-xs font-bold uppercase tracking-wider text-[#1b4d3e]">
                A · Work-Ready Score Weights (0–100 scale)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {(
                  Object.keys(scoring.work_ready_weights) as Array<
                    keyof ScoringConfig['work_ready_weights']
                  >
                ).map((k) => (
                  <label key={k} className="space-y-1">
                    <span className="block font-semibold text-[#475569] capitalize">
                      {k.replace('_', ' ')}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scoring.work_ready_weights[k]}
                      onChange={(e) =>
                        setScoring((prev) => ({
                          ...prev,
                          work_ready_weights: {
                            ...prev.work_ready_weights,
                            [k]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          },
                        }))
                      }
                      className="w-full h-10 px-3 rounded-lg bg-white border border-[#cbd5e1] font-mono-data text-[#0f172a]"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-[#e2e8f0] p-4 bg-[#f8fafc]">
              <p className="text-xs font-bold uppercase tracking-wider text-[#b45309]">
                B · Information Confidence Weights (0–100 scale)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {(
                  Object.keys(scoring.confidence_weights) as Array<
                    keyof ScoringConfig['confidence_weights']
                  >
                ).map((k) => (
                  <label key={k} className="space-y-1">
                    <span className="block font-semibold text-[#475569] capitalize">
                      {k.replace('_', ' ')}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scoring.confidence_weights[k]}
                      onChange={(e) =>
                        setScoring((prev) => ({
                          ...prev,
                          confidence_weights: {
                            ...prev.confidence_weights,
                            [k]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          },
                        }))
                      }
                      className="w-full h-10 px-3 rounded-lg bg-white border border-[#cbd5e1] font-mono-data text-[#0f172a]"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {saveMsg && (
          <div
            role="status"
            className="p-3.5 rounded-xl bg-[#ecfdf5] border border-[#bbf7d0] text-xs font-medium text-[#1b4d3e]"
          >
            {saveMsg}
          </div>
        )}
        {errMsg && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs font-medium text-[#991b1b]"
          >
            {errMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          <span>{saving ? 'Saving System Controls...' : 'Save Feature Controls & Scoring'}</span>
        </button>
      </form>
    </div>
  );
}

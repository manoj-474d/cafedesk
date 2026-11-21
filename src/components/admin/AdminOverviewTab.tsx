import React, { useState } from 'react';
import {
  Activity,
  Building2,
  CalendarCheck,
  Coffee,
  Crown,
  Eye,
  Inbox,
  IndianRupee,
  Laptop,
  Lightbulb,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';

export interface OverviewStats {
  totalVisitors: number;
  totalPageViews: number;
  todayVisitors: number;
  todayPageViews: number;
  totalCafes: number;
  publishedCafes: number;
  inactiveCafes: number;
  verifiedCafes: number;
  featuredCafes: number;
  newCafesThisWeek: number;
  totalMenuItems: number;
  totalUsers: number;
  freeUsers: number;
  paidUsers: number;
  activeSubs: number;
  cancelledSubs: number;
  expiredSubs: number;
  totalRevenueInr: number;
  monthRevenueInr: number;
  yearRevenueInr: number;
  mrrInr: number;
  totalSubmissions: number;
  newSubmissions: number;
  totalSuggestions: number;
  newSuggestions: number;
  totalMedia: number;
  totalAdmins: number;
  dailyChart: Array<{ date: string; page_views: number; unique_visitors: number }>;
  revenueChart: Array<{ date: string; amount_inr: number }>;
  recentPayments: Array<{
    id: number;
    receipt_number: string;
    amount_inr: number;
    status: string;
    method: string;
    created_at: number;
    user_name: string;
    user_email: string;
    plan_name: string;
  }>;
  recentUsers: Array<{
    id: number;
    name: string;
    email: string;
    status: string;
    created_at: number;
    last_login_at: number | null;
    plan_name: string;
    plan_id: string;
  }>;
  recentRenewals: Array<{
    id: number;
    action: string;
    from_plan: string;
    to_plan: string;
    note: string;
    created_at: number;
    user_name: string;
    user_email: string;
  }>;
  totalBookings?: number;
  todayBookings?: number;
  pendingBookings?: number;
  confirmedBookings?: number;
  cancelledBookings?: number;
  recentBookings?: Array<{
    id: number;
    booking_ref: string;
    customer_name: string;
    customer_email: string;
    cafe_name: string;
    workspace_type: string;
    booking_date: string;
    time_slot: string;
    guests_count: number;
    amount_inr: number;
    payment_status: string;
    status: string;
    created_at: number;
  }>;
  popularWorkspaceTypes?: Array<{ type: string; count: number }>;
  popularMenuItems?: Array<{
    id: number;
    name: string;
    category: string;
    price_inr: number;
    discount_price_inr?: number | null;
    is_bestseller: boolean | number;
    is_featured: boolean | number;
    cafe_name: string;
  }>;
  recentActivity: Array<{
    id: number;
    actor: string;
    action: string;
    target: string;
    previous_value?: string;
    new_value?: string;
    created_at: number;
  }>;
}

export function AdminOverviewTab({
  overview,
  analyticsConfigured,
  onNavigateTab,
}: {
  overview: OverviewStats | null;
  analyticsConfigured: boolean;
  onNavigateTab: (tab: string) => void;
}) {
  const [logSearch, setLogSearch] = useState('');

  if (!overview) {
    return (
      <div className="p-8 rounded-xl border border-[#e2e8f0] bg-white text-sm text-[#64748b]">
        Loading live platform metrics, revenue analytics, and audit activity...
      </div>
    );
  }

  const maxViews = Math.max(1, ...overview.dailyChart.map((d) => d.page_views));
  const maxRev = Math.max(1, ...overview.revenueChart.map((d) => d.amount_inr));
  const filteredLogs = overview.recentActivity.filter((log) => {
    const q = logSearch.trim().toLowerCase();
    if (!q) return true;
    return `${log.actor} ${log.action} ${log.target} ${log.previous_value ?? ''} ${log.new_value ?? ''}`
      .toLowerCase()
      .includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Owner Overview</h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            Live SQLite platform metrics across Bengaluru cafe listings, menus, members, subscriptions, and revenue.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#64748b]">
          <span>Today: {overview.todayVisitors} unique visitors</span>
          <span aria-hidden="true">·</span>
          <span>{overview.todayPageViews} page views</span>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
            <span>Bengaluru Cafes</span>
            <Building2 className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#0f172a]">
            {overview.publishedCafes} <span className="text-sm font-normal text-[#64748b]">/ {overview.totalCafes}</span>
          </p>
          <p className="text-xs text-[#64748b]">
            {overview.inactiveCafes} inactive · {overview.verifiedCafes} verified · {overview.featuredCafes} featured · +{overview.newCafesThisWeek} wk
          </p>
        </div>

        <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
            <span>Menu Items &amp; Catalog</span>
            <Coffee className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#0f172a]">
            {overview.totalMenuItems}
          </p>
          <p className="text-xs text-[#64748b]">
            {overview.totalMedia} library photos · {overview.totalAdmins} admin accounts
          </p>
        </div>

        <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
            <span>Registered Members &amp; Subs</span>
            <Crown className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#0f172a]">
            {overview.totalUsers}
          </p>
          <p className="text-xs text-[#64748b]">
            {overview.activeSubs} active paid · {overview.freeUsers} free · {overview.cancelledSubs} cancelled · {overview.expiredSubs} expired
          </p>
        </div>

        <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
            <span>Revenue &amp; MRR</span>
            <IndianRupee className="w-4 h-4 text-[#16a34a]" aria-hidden="true" />
          </div>
          <p className="font-mono-data tabular-nums text-2xl font-bold text-[#16a34a]">
            ₹{overview.mrrInr.toLocaleString('en-IN')}<span className="text-xs font-normal text-[#64748b]">/mo MRR</span>
          </p>
          <p className="text-xs text-[#64748b] tabular-nums">
            30d: ₹{overview.monthRevenueInr.toLocaleString('en-IN')} · Total: ₹{overview.totalRevenueInr.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Secondary Metrics Strip (including Bookings) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('bookings')}
          className="text-left p-4 rounded-xl border border-[#e2e8f0] bg-white hover:border-[#0f172a] transition-colors flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-medium text-[#64748b]">Total &amp; Today&apos;s Bookings</p>
            <p className="font-mono-data tabular-nums text-xl font-bold text-[#0f172a] mt-0.5">
              {overview.totalBookings ?? 0}{' '}
              <span className="text-xs font-semibold text-[#1b4d3e]">
                ({overview.todayBookings ?? 0} today · {overview.pendingBookings ?? 0} pending)
              </span>
            </p>
          </div>
          <CalendarCheck className="w-5 h-5 text-[#1b4d3e]" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('enquiries')}
          className="text-left p-4 rounded-xl border border-[#e2e8f0] bg-white hover:border-[#0f172a] transition-colors flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-medium text-[#64748b]">Contact &amp; Partnership Enquiries</p>
            <p className="font-mono-data tabular-nums text-xl font-bold text-[#0f172a] mt-0.5">
              {overview.totalSubmissions}{' '}
              <span className="text-xs font-semibold text-[#b45309]">({overview.newSubmissions} new)</span>
            </p>
          </div>
          <Inbox className="w-5 h-5 text-[#64748b]" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('suggestions')}
          className="text-left p-4 rounded-xl border border-[#e2e8f0] bg-white hover:border-[#0f172a] transition-colors flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-medium text-[#64748b]">User Suggestions &amp; Ideas</p>
            <p className="font-mono-data tabular-nums text-xl font-bold text-[#0f172a] mt-0.5">
              {overview.totalSuggestions}{' '}
              <span className="text-xs font-semibold text-[#b45309]">({overview.newSuggestions} pending)</span>
            </p>
          </div>
          <Lightbulb className="w-5 h-5 text-[#64748b]" aria-hidden="true" />
        </button>

        <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#64748b]">Cumulative Site Traffic</p>
            <p className="font-mono-data tabular-nums text-xl font-bold text-[#0f172a] mt-0.5">
              {overview.totalVisitors.toLocaleString('en-IN')}{' '}
              <span className="text-xs font-normal text-[#64748b]">
                visitors · {overview.totalPageViews.toLocaleString('en-IN')} views
              </span>
            </p>
          </div>
          <Users className="w-5 h-5 text-[#64748b]" aria-hidden="true" />
        </div>
      </div>

      {/* Dual Real SVG Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 14-Day Traffic SVG Chart */}
        <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#0f172a]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[#0f172a]">14-Day Traffic Trend</h2>
            </div>
            <span className="text-[11px] text-[#64748b]">
              {analyticsConfigured ? 'GA + Server Tracker' : 'Server Visit Tracker'}
            </span>
          </div>

          {overview.dailyChart.length === 0 ? (
            <p className="text-xs text-[#64748b] py-10 text-center">
              Traffic bars populate as visitors browse public pages.
            </p>
          ) : (
            <div className="space-y-2">
              <svg
                viewBox={`0 0 ${Math.max(1, overview.dailyChart.length) * 32} 120`}
                className="w-full h-32 overflow-visible"
                role="img"
                aria-label="14-day page views chart"
              >
                {overview.dailyChart.map((d, idx) => {
                  const barH = Math.max(4, Math.round((d.page_views / maxViews) * 92));
                  const x = idx * 32 + 6;
                  const y = 100 - barH;
                  return (
                    <g key={d.date}>
                      <title>{`${d.date}: ${d.page_views} views, ${d.unique_visitors} unique`}</title>
                      <rect
                        x={x}
                        y={y}
                        width={20}
                        height={barH}
                        rx={3}
                        fill="#1b4d3e"
                        opacity={0.9}
                      />
                      <text
                        x={x + 10}
                        y={114}
                        textAnchor="middle"
                        fontSize="8"
                        fill="#64748b"
                      >
                        {d.date.slice(5)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        {/* 14-Day Revenue SVG Chart */}
        <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[#0f172a]">14-Day Daily Revenue (₹)</h2>
            </div>
            <span className="text-[11px] font-mono-data tabular-nums text-[#64748b]">
              Annual: ₹{overview.yearRevenueInr.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="space-y-2">
            <svg
              viewBox={`0 0 ${Math.max(1, overview.revenueChart.length) * 32} 120`}
              className="w-full h-32 overflow-visible"
              role="img"
              aria-label="14-day revenue chart"
            >
              {overview.revenueChart.map((d, idx) => {
                const barH = d.amount_inr > 0 ? Math.max(6, Math.round((d.amount_inr / maxRev) * 92)) : 3;
                const x = idx * 32 + 6;
                const y = 100 - barH;
                return (
                  <g key={d.date}>
                    <title>{`${d.date}: ₹${d.amount_inr}`}</title>
                    <rect
                      x={x}
                      y={y}
                      width={20}
                      height={barH}
                      rx={3}
                      fill={d.amount_inr > 0 ? '#b45309' : '#e2e8f0'}
                    />
                    <text x={x + 10} y={114} textAnchor="middle" fontSize="8" fill="#64748b">
                      {d.date.slice(5)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Recent Payments, New Users, Renewals & Quick Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0f172a]">Recent Payments</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('revenue')}
              className="text-xs font-semibold text-[#b45309] hover:underline"
            >
              All &rarr;
            </button>
          </div>
          {overview.recentPayments.length === 0 ? (
            <p className="text-xs text-[#64748b] py-4">No payments recorded yet.</p>
          ) : (
            <div className="divide-y divide-[#f1f5f9] text-xs">
              {overview.recentPayments.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0f172a] truncate">{p.user_name}</p>
                    <p className="text-[11px] text-[#64748b] truncate">
                      {p.plan_name} · {p.status}
                    </p>
                  </div>
                  <span className="font-mono-data tabular-nums font-bold text-[#0f172a] shrink-0">
                    ₹{p.amount_inr}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0f172a]">Recent User Registrations</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('users')}
              className="text-xs font-semibold text-[#b45309] hover:underline"
            >
              Directory &rarr;
            </button>
          </div>
          {overview.recentUsers.length === 0 ? (
            <p className="text-xs text-[#64748b] py-4">No customer accounts yet.</p>
          ) : (
            <div className="divide-y divide-[#f1f5f9] text-xs">
              {overview.recentUsers.map((u) => (
                <div key={u.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0f172a] truncate">{u.name}</p>
                    <p className="text-[11px] text-[#64748b] truncate">{u.email}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-[#1b4d3e] shrink-0">
                    {u.plan_name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
          <h2 className="text-sm font-semibold text-[#0f172a]">Quick Management Shortcuts</h2>
          <div className="grid grid-cols-1 gap-2">
            {[
              { tab: 'bookings', label: 'Manage Seat & Desk Bookings', tag: 'Bookings' },
              { tab: 'locations', label: 'Manage Bengaluru Cafes', tag: 'Cafes' },
              { tab: 'menu', label: 'Edit Menu & Food Prices', tag: 'Menu' },
              { tab: 'subscriptions', label: 'View Active Subscribers', tag: 'Subs' },
              { tab: 'plans', label: 'Configure Pricing & Plans', tag: 'Plans' },
              { tab: 'homepage', label: 'Homepage & Cafe of the Day', tag: 'CMS' },
            ].map((item) => (
              <button
                key={item.tab}
                type="button"
                onClick={() => onNavigateTab(item.tab)}
                className="w-full text-left px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] hover:bg-[#f8fafc] text-xs font-medium text-[#0f172a] flex items-center justify-between"
              >
                <span>{item.label}</span>
                <span className="text-[11px] text-[#b45309] font-semibold">{item.tag} &rarr;</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Popular Workspace Types, Popular Food & Beverages, and Recent Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0f172a] inline-flex items-center gap-1.5">
              <Laptop className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
              <span>Popular Workspace Types</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('locations')}
              className="text-xs font-semibold text-[#b45309] hover:underline"
            >
              Cafes &rarr;
            </button>
          </div>
          {!overview.popularWorkspaceTypes || overview.popularWorkspaceTypes.length === 0 ? (
            <p className="text-xs text-[#64748b] py-4">No workspace breakdown available yet.</p>
          ) : (
            <div className="space-y-3 pt-1">
              {(() => {
                const maxWs = Math.max(
                  1,
                  ...overview.popularWorkspaceTypes.map((w) => w.count)
                );
                return overview.popularWorkspaceTypes.map((ws) => {
                  const pct = Math.max(8, Math.round((ws.count / maxWs) * 100));
                  return (
                    <div key={ws.type} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#0f172a]">{ws.type}</span>
                        <span className="font-mono-data text-[#475569]">{ws.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#f1f5f9] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#1b4d3e]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0f172a] inline-flex items-center gap-1.5">
              <Coffee className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
              <span>Popular Food &amp; Beverages</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('menu')}
              className="text-xs font-semibold text-[#b45309] hover:underline"
            >
              Menus &rarr;
            </button>
          </div>
          {!overview.popularMenuItems || overview.popularMenuItems.length === 0 ? (
            <p className="text-xs text-[#64748b] py-4">No menu items added yet.</p>
          ) : (
            <div className="divide-y divide-[#f1f5f9] text-xs">
              {overview.popularMenuItems.slice(0, 6).map((m) => (
                <div key={m.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0f172a] truncate">{m.name}</p>
                    <p className="text-[11px] text-[#64748b] truncate">
                      {m.cafe_name} · {m.category}
                      {m.is_bestseller ? ' · Bestseller' : ''}
                    </p>
                  </div>
                  <div className="font-mono-data font-bold text-[#0f172a] shrink-0 text-right">
                    {m.discount_price_inr !== null &&
                    m.discount_price_inr !== undefined &&
                    m.discount_price_inr < m.price_inr ? (
                      <>
                        <span className="text-[#1b4d3e]">₹{m.discount_price_inr}</span>
                        <del className="text-[#94a3b8] font-normal ml-1 text-[10px]">
                          ₹{m.price_inr}
                        </del>
                      </>
                    ) : (
                      <span>₹{m.price_inr}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0f172a] inline-flex items-center gap-1.5">
              <CalendarCheck className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
              <span>Recent Bookings</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('bookings')}
              className="text-xs font-semibold text-[#b45309] hover:underline"
            >
              All Bookings &rarr;
            </button>
          </div>
          {!overview.recentBookings || overview.recentBookings.length === 0 ? (
            <p className="text-xs text-[#64748b] py-4">No bookings submitted yet.</p>
          ) : (
            <div className="divide-y divide-[#f1f5f9] text-xs">
              {overview.recentBookings.map((b) => (
                <div key={b.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0f172a] truncate">
                      {b.customer_name} · <span className="font-mono-data">{b.booking_ref}</span>
                    </p>
                    <p className="text-[11px] text-[#64748b] truncate">
                      {b.cafe_name} · {b.booking_date}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize shrink-0 ${
                      b.status === 'confirmed'
                        ? 'bg-[#ecfdf5] text-[#1b4d3e]'
                        : b.status === 'cancelled'
                        ? 'bg-[#fef2f2] text-[#991b1b]'
                        : 'bg-[#fffbeb] text-[#b45309]'
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Subscription Activity */}
      {overview.recentRenewals.length > 0 && (
        <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0f172a]">Recent Subscription Activity &amp; Renewals</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('subscriptions')}
              className="text-xs font-semibold text-[#b45309] hover:underline"
            >
              Manage Subscriptions &rarr;
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {overview.recentRenewals.map((r) => (
              <div key={r.id} className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#0f172a] truncate">{r.user_name}</span>
                  <span className="uppercase text-[10px] font-bold text-[#b45309]">{r.action}</span>
                </div>
                <p className="text-[11px] text-[#475569]">{r.note}</p>
                <p className="text-[10px] font-mono-data text-[#64748b]">
                  {new Date(r.created_at).toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Audit Log Preview */}
      <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0f172a]" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-[#0f172a]">Recent Security &amp; CMS Audit Log</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-60">
              <Search
                className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Filter recent log..."
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('audit')}
              className="text-xs font-semibold text-[#b45309] hover:underline whitespace-nowrap"
            >
              Full Audit Log &rarr;
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#e2e8f0] text-[#64748b] font-semibold">
                <th className="py-2.5 pr-4">Actor</th>
                <th className="py-2.5 pr-4">Action</th>
                <th className="py-2.5 pr-4">Target</th>
                <th className="py-2.5 pr-4">Change</th>
                <th className="py-2.5 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filteredLogs.slice(0, 12).map((log) => (
                <tr key={log.id} className="hover:bg-[#f8fafc]">
                  <td className="py-2.5 pr-4 font-semibold text-[#0f172a] whitespace-nowrap">
                    {log.actor}
                  </td>
                  <td className="py-2.5 pr-4 text-[#334155]">{log.action}</td>
                  <td className="py-2.5 pr-4 text-[#475569]">{log.target}</td>
                  <td className="py-2.5 pr-4 text-[#64748b] max-w-xs truncate">
                    {log.previous_value || log.new_value
                      ? `${log.previous_value || '—'} → ${log.new_value || '—'}`
                      : '—'}
                  </td>
                  <td className="py-2.5 text-right font-mono-data tabular-nums text-[#64748b] whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

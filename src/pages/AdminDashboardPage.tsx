import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Building2,
  CalendarCheck,
  Clock,
  Coffee,
  Compass,
  CreditCard,
  Crown,
  ExternalLink,
  FileText,
  Globe,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  Lightbulb,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useCms } from '../context/CmsContext';
import { useDocumentMeta } from '../utils/cafeHelpers';
import type {
  LocationItem,
  MediaAsset,
  NavigationItem,
  SiteSettings,
  TestimonialItem,
} from '../types/cms';
import { AdminOverviewTab, type OverviewStats } from '../components/admin/AdminOverviewTab';
import { AdminHomepageTab } from '../components/admin/AdminHomepageTab';
import { AdminLocationsTab } from '../components/admin/AdminLocationsTab';
import { AdminMenuTab } from '../components/admin/AdminMenuTab';
import { AdminContentTab } from '../components/admin/AdminContentTab';
import { AdminMediaTab } from '../components/admin/AdminMediaTab';
import { AdminNavSeoTab } from '../components/admin/AdminNavSeoTab';
import {
  AdminEnquiriesTab,
  type SubmissionRecord,
} from '../components/admin/AdminEnquiriesTab';
import {
  AdminSettingsTab,
  type AdminIdentity,
  type AdminUserRecord,
} from '../components/admin/AdminSettingsTab';
import { AdminSubscriptionsTab } from '../components/admin/AdminSubscriptionsTab';
import { AdminUsersTab } from '../components/admin/AdminUsersTab';
import { AdminRevenueTab } from '../components/admin/AdminRevenueTab';
import { AdminPlansTab } from '../components/admin/AdminPlansTab';
import { AdminAuditTab } from '../components/admin/AdminAuditTab';
import { AdminSuggestionsTab } from '../components/admin/AdminSuggestionsTab';
import { AdminBookingsTab } from '../components/admin/AdminBookingsTab';
import type { BookingRecord, FeatureSuggestion } from '../types/subscription';

type TabKey =
  | 'overview'
  | 'locations'
  | 'menu'
  | 'media'
  | 'bookings'
  | 'subscriptions'
  | 'users'
  | 'revenue'
  | 'plans'
  | 'homepage'
  | 'content'
  | 'navigation'
  | 'seo'
  | 'suggestions'
  | 'enquiries'
  | 'audit'
  | 'settings';

interface NavGroup {
  heading: string;
  items: Array<{
    key: TabKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Overview',
    items: [{ key: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard }],
  },
  {
    heading: 'Catalog & Menus',
    items: [
      { key: 'locations', label: 'Cafe Management', icon: Building2 },
      { key: 'menu', label: 'Menu & Prices', icon: Coffee },
      { key: 'media', label: 'Photo Library', icon: ImageIcon },
    ],
  },
  {
    heading: 'Members & Revenue',
    items: [
      { key: 'bookings', label: 'Bookings & Seats', icon: CalendarCheck },
      { key: 'subscriptions', label: 'Subscriptions', icon: Crown },
      { key: 'users', label: 'Users & Customers', icon: Users },
      { key: 'revenue', label: 'Payments & Revenue', icon: CreditCard },
      { key: 'plans', label: 'Plan Settings', icon: Sparkles },
    ],
  },
  {
    heading: 'Website Content',
    items: [
      { key: 'homepage', label: 'Homepage & Spotlight', icon: LayoutTemplate },
      { key: 'content', label: 'Content & Pricing Copy', icon: FileText },
      { key: 'navigation', label: 'Navigation & Footer', icon: Compass },
      { key: 'seo', label: 'SEO & Indexing', icon: Globe },
    ],
  },
  {
    heading: 'Operations & Security',
    items: [
      { key: 'suggestions', label: 'User Suggestions', icon: Lightbulb },
      { key: 'enquiries', label: 'Enquiries & Inbox', icon: Inbox },
      { key: 'audit', label: 'Audit Logs', icon: Activity },
      { key: 'settings', label: 'Settings & 2FA', icon: Settings },
    ],
  },
];

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const loginPath = location.pathname.startsWith('/admin') ? '/admin/login' : '/owner/login';
  const { settings: publicSettings, refreshCms } = useCms();

  useDocumentMeta('Owner Panel – CafeDesk', 'CafeDesk Owner management panel.', {
    allowIndexing: false,
  });

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Admin datasets
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [cmsSettings, setCmsSettings] = useState<SiteSettings>(publicSettings);
  const [settingsRevision, setSettingsRevision] = useState(0);
  const [navigation, setNavigation] = useState<NavigationItem[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [suggestions, setSuggestions] = useState<FeatureSuggestion[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [teamUsers, setTeamUsers] = useState<AdminUserRecord[]>([]);

  const handleAuthStatusCheck = useCallback(
    (res: Response) => {
      if (res.status === 401) {
        navigate(loginPath, { replace: true });
        return false;
      }
      return res.ok;
    },
    [navigate, loginPath]
  );

  const loadOverview = useCallback(async () => {
    const res = await fetch('/api/admin/overview', { credentials: 'include' });
    if (handleAuthStatusCheck(res)) setOverview((await res.json()) as OverviewStats);
  }, [handleAuthStatusCheck]);

  const loadLocations = useCallback(async () => {
    const res = await fetch('/api/admin/cafes', { credentials: 'include' });
    if (handleAuthStatusCheck(res)) {
      const data = (await res.json()) as { cafes?: LocationItem[] };
      if (Array.isArray(data.cafes)) setLocations(data.cafes);
    }
  }, [handleAuthStatusCheck]);

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/admin/settings', { credentials: 'include' });
    if (handleAuthStatusCheck(res)) {
      const data = (await res.json()) as { settings?: SiteSettings };
      if (data.settings) {
        setCmsSettings(data.settings);
        setSettingsRevision((v) => v + 1);
      }
    }
  }, [handleAuthStatusCheck]);

  const loadNavigation = useCallback(async () => {
    const res = await fetch('/api/admin/navigation', { credentials: 'include' });
    if (handleAuthStatusCheck(res)) {
      const data = (await res.json()) as { navigation?: NavigationItem[] };
      if (Array.isArray(data.navigation)) setNavigation(data.navigation);
    }
  }, [handleAuthStatusCheck]);

  const loadTestimonials = useCallback(async () => {
    const res = await fetch('/api/admin/testimonials', { credentials: 'include' });
    if (handleAuthStatusCheck(res)) {
      const data = (await res.json()) as { testimonials?: TestimonialItem[] };
      if (Array.isArray(data.testimonials)) setTestimonials(data.testimonials);
    }
  }, [handleAuthStatusCheck]);

  const loadMedia = useCallback(async () => {
    const res = await fetch('/api/admin/media', { credentials: 'include' });
    if (handleAuthStatusCheck(res)) {
      const data = (await res.json()) as { media?: MediaAsset[] };
      if (Array.isArray(data.media)) setMedia(data.media);
    }
  }, [handleAuthStatusCheck]);

  const loadSubmissions = useCallback(async () => {
    const res = await fetch('/api/admin/submissions', { credentials: 'include' });
    if (handleAuthStatusCheck(res)) {
      const data = (await res.json()) as { submissions?: SubmissionRecord[] };
      if (Array.isArray(data.submissions)) setSubmissions(data.submissions);
    }
  }, [handleAuthStatusCheck]);

  const loadSuggestions = useCallback(async () => {
    const res = await fetch('/api/admin/suggestions', { credentials: 'include' });
    if (handleAuthStatusCheck(res)) {
      const data = (await res.json()) as { suggestions?: FeatureSuggestion[] };
      if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions);
    }
  }, [handleAuthStatusCheck]);

  const loadBookings = useCallback(async () => {
    const res = await fetch('/api/admin/bookings', { credentials: 'include' });
    if (handleAuthStatusCheck(res)) {
      const data = (await res.json()) as { bookings?: BookingRecord[] };
      if (Array.isArray(data.bookings)) setBookings(data.bookings);
    }
  }, [handleAuthStatusCheck]);

  const loadUsers = useCallback(
    async (role: AdminIdentity['role']) => {
      if (role !== 'super_admin' && role !== 'admin') return;
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (handleAuthStatusCheck(res)) {
        const data = (await res.json()) as { users?: AdminUserRecord[] };
        if (Array.isArray(data.users)) setTeamUsers(data.users);
      }
    },
    [handleAuthStatusCheck]
  );

  const loadAllAdminData = useCallback(
    async (role: AdminIdentity['role']) => {
      await Promise.all([
        loadOverview(),
        loadLocations(),
        loadSettings(),
        loadNavigation(),
        loadTestimonials(),
        loadMedia(),
        loadSubmissions(),
        loadSuggestions(),
        loadBookings(),
        loadUsers(role),
      ]);
    },
    [
      loadOverview,
      loadLocations,
      loadSettings,
      loadNavigation,
      loadTestimonials,
      loadMedia,
      loadSubmissions,
      loadSuggestions,
      loadBookings,
      loadUsers,
    ]
  );

  useEffect(() => {
    let active = true;
    fetch('/api/admin/status', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { authenticated?: boolean; admin?: AdminIdentity }) => {
        if (!active) return;
        if (!data.authenticated || !data.admin) {
          navigate(loginPath, { replace: true });
          return;
        }
        setAdmin(data.admin);
        setCheckingAuth(false);
        void loadAllAdminData(data.admin.role);
      })
      .catch(() => {
        if (active) navigate(loginPath, { replace: true });
      });

    return () => {
      active = false;
    };
  }, [navigate, loginPath, loadAllAdminData]);

  const handleSaveSettings = async (next: SiteSettings): Promise<boolean> => {
    if (!admin) return false;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': admin.csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(next),
      });
      if (res.status === 401) {
        navigate(loginPath, { replace: true });
        return false;
      }
      if (!res.ok) return false;
      const data = (await res.json()) as { settings: SiteSettings };
      setCmsSettings(data.settings);
      await Promise.all([refreshCms(), loadOverview()]);
      return true;
    } catch {
      return false;
    }
  };

  const handleLogout = async () => {
    if (admin) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'x-csrf-token': admin.csrfToken },
        credentials: 'include',
      }).catch(() => {});
    }
    navigate(loginPath, { replace: true });
  };

  if (checkingAuth || !admin) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <p className="text-sm font-semibold text-[#475569]">
          Verifying owner session...
        </p>
      </div>
    );
  }

  const unreadEnquiries = submissions.filter((s) => s.status === 'new').length;
  const newSuggestions = suggestions.filter((s) => s.status === 'new').length;
  const pendingBookings = bookings.filter((b) => b.status === 'pending').length;

  const sessionMinsLeft = admin.expiresAt
    ? Math.max(0, Math.round((admin.expiresAt - Date.now()) / 60000))
    : null;
  const sessionHoursLeft =
    sessionMinsLeft !== null ? `${Math.floor(sessionMinsLeft / 60)}h ${sessionMinsLeft % 60}m` : null;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col lg:flex-row">
      {/* Mobile Top Bar */}
      <header className="lg:hidden sticky top-0 z-30 h-16 px-4 bg-[#1c1613] text-[#faf7f2] flex items-center justify-between border-b border-[#3a2f2a]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle owner menu"
            aria-expanded={mobileMenuOpen}
            className="h-11 w-11 rounded-lg border border-[#3a2f2a] flex items-center justify-center"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <div>
            <span className="font-serif-display text-lg font-semibold">
              {cmsSettings.brand_name || 'CafeDesk'} Owner
            </span>
          </div>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1 min-h-[44px] px-2 text-xs font-semibold text-[#d6cbbe] hover:text-white"
        >
          <span>Live Site</span>
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </header>

      {/* Mobile Horizontal Quick-Tab Strip */}
      <div className="lg:hidden bg-[#261d19] border-b border-[#3a2f2a] px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {NAV_GROUPS.flatMap((g) => g.items).map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          const badge =
            key === 'bookings'
              ? pendingBookings
              : key === 'enquiries'
              ? unreadEnquiries
              : key === 'suggestions'
              ? newSuggestions
              : 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setActiveTab(key);
                setMobileMenuOpen(false);
              }}
              className={`min-h-[40px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? 'bg-[#b45309] text-white'
                  : 'bg-[#1c1613] text-[#d6cbbe] border border-[#3a2f2a]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{label}</span>
              {badge > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-white text-[#1c1613] text-[10px] font-bold font-mono-data tabular-nums">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`${
          mobileMenuOpen ? 'flex max-h-[calc(100vh-4rem)] overflow-y-auto' : 'hidden'
        } lg:flex lg:max-h-none lg:overflow-visible w-full lg:w-64 shrink-0 bg-[#1c1613] text-[#faf7f2] lg:min-h-screen flex-col justify-between border-r border-[#2d241f]`}
      >
        <div className="p-5 space-y-5">
          <div className="hidden lg:block space-y-1">
            <div className="flex items-center gap-2 text-[#f59e0b] text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              <span>Owner Panel</span>
            </div>
            <p className="font-serif-display text-xl font-bold text-white">
              {cmsSettings.brand_name || 'CafeDesk'}
            </p>
            <p className="text-xs text-[#c8bfb4]">
              Signed in as <span className="text-white font-semibold">{admin.displayName}</span>
            </p>
            {sessionHoursLeft && (
              <p className="text-[11px] font-mono-data text-[#9a8e80] inline-flex items-center gap-1 pt-0.5">
                <Clock className="w-3 h-3" aria-hidden="true" />
                <span>Session: {sessionHoursLeft} left</span>
              </p>
            )}
          </div>

          <nav aria-label="Owner panel sections" className="space-y-4">
            {NAV_GROUPS.map((group) => (
              <div key={group.heading} className="space-y-1">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#9a8e80]">
                  {group.heading}
                </p>
                {group.items.map(({ key, label, icon: Icon }) => {
                  const active = activeTab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setActiveTab(key);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full min-h-[44px] lg:min-h-0 flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-[#b45309] text-white'
                          : 'text-[#d6cbbe] hover:bg-[#2a211c] hover:text-white'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2.5">
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>{label}</span>
                      </span>
                      {key === 'bookings' && pendingBookings > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-white text-[#1c1613] text-[10px] font-bold font-mono-data">
                          {pendingBookings}
                        </span>
                      )}
                      {key === 'enquiries' && unreadEnquiries > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-white text-[#1c1613] text-[10px] font-bold font-mono-data">
                          {unreadEnquiries}
                        </span>
                      )}
                      {key === 'suggestions' && newSuggestions > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-white text-[#1c1613] text-[10px] font-bold font-mono-data">
                          {newSuggestions}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="p-5 border-t border-[#2d241f] space-y-2.5 text-xs">
          <Link
            to="/"
            className="w-full h-11 lg:h-10 px-3 rounded-lg border border-[#3a2f2a] text-[#faf7f2] hover:bg-[#2a211c] font-semibold inline-flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            <span>View Public Website</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full h-11 lg:h-10 px-3 rounded-lg bg-[#2a211c] hover:bg-[#3a2d26] text-[#fca5a5] font-semibold inline-flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto space-y-6">
        {activeTab === 'overview' && (
          <AdminOverviewTab
            overview={overview}
            analyticsConfigured={Boolean(cmsSettings.analytics_id)}
            onNavigateTab={(tab) => setActiveTab(tab as TabKey)}
          />
        )}

        {activeTab === 'locations' && (
          <AdminLocationsTab
            locations={locations}
            media={media}
            csrfToken={admin.csrfToken}
            onMediaUploaded={(item) => setMedia((prev) => [item, ...prev])}
            onRefreshLocations={async () => {
              await Promise.all([loadLocations(), loadOverview(), refreshCms()]);
            }}
          />
        )}

        {activeTab === 'menu' && (
          <AdminMenuTab
            locations={locations}
            media={media}
            csrfToken={admin.csrfToken}
            onMediaUploaded={(item) => setMedia((prev) => [item, ...prev])}
            onRefreshLocations={async () => {
              await Promise.all([loadLocations(), loadOverview(), refreshCms()]);
            }}
          />
        )}

        {activeTab === 'media' && (
          <AdminMediaTab
            media={media}
            csrfToken={admin.csrfToken}
            onRefreshMedia={async () => {
              await Promise.all([loadMedia(), loadOverview(), refreshCms()]);
            }}
          />
        )}

        {activeTab === 'bookings' && (
          <AdminBookingsTab
            bookings={bookings}
            locations={locations}
            csrfToken={admin.csrfToken}
            onRefreshBookings={async () => {
              await Promise.all([loadBookings(), loadOverview()]);
            }}
          />
        )}

        {activeTab === 'subscriptions' && (
          <AdminSubscriptionsTab csrfToken={admin.csrfToken} />
        )}

        {activeTab === 'users' && <AdminUsersTab csrfToken={admin.csrfToken} />}

        {activeTab === 'revenue' && <AdminRevenueTab csrfToken={admin.csrfToken} />}

        {activeTab === 'plans' && <AdminPlansTab csrfToken={admin.csrfToken} />}

        {activeTab === 'homepage' && (
          <AdminHomepageTab
            key={`hp-${settingsRevision}`}
            settings={cmsSettings}
            locations={locations}
            media={media}
            csrfToken={admin.csrfToken}
            onMediaUploaded={(item) => setMedia((prev) => [item, ...prev])}
            onSaveSettings={handleSaveSettings}
          />
        )}

        {activeTab === 'content' && (
          <AdminContentTab
            key={`ct-${settingsRevision}`}
            settings={cmsSettings}
            testimonials={testimonials}
            media={media}
            csrfToken={admin.csrfToken}
            onMediaUploaded={(item) => setMedia((prev) => [item, ...prev])}
            onSaveSettings={handleSaveSettings}
            onRefreshTestimonials={async () => {
              await Promise.all([loadTestimonials(), loadOverview(), refreshCms()]);
            }}
          />
        )}

        {(activeTab === 'navigation' || activeTab === 'seo') && (
          <AdminNavSeoTab
            key={`${activeTab}-${settingsRevision}`}
            mode={activeTab}
            navigation={navigation}
            settings={cmsSettings}
            media={media}
            csrfToken={admin.csrfToken}
            onMediaUploaded={(item) => setMedia((prev) => [item, ...prev])}
            onRefreshNavigation={async () => {
              await Promise.all([loadNavigation(), loadOverview(), refreshCms()]);
            }}
            onSaveSettings={handleSaveSettings}
          />
        )}

        {activeTab === 'suggestions' && (
          <AdminSuggestionsTab
            suggestions={suggestions}
            csrfToken={admin.csrfToken}
            onRefreshSuggestions={async () => {
              await Promise.all([loadSuggestions(), loadOverview()]);
            }}
          />
        )}

        {activeTab === 'enquiries' && (
          <AdminEnquiriesTab
            submissions={submissions}
            csrfToken={admin.csrfToken}
            onRefreshSubmissions={async () => {
              await Promise.all([loadSubmissions(), loadOverview()]);
            }}
          />
        )}

        {activeTab === 'audit' && <AdminAuditTab />}

        {activeTab === 'settings' && (
          <AdminSettingsTab
            key={`st-${settingsRevision}`}
            settings={cmsSettings}
            media={media}
            currentAdmin={admin}
            teamUsers={teamUsers}
            onMediaUploaded={(item) => setMedia((prev) => [item, ...prev])}
            onSaveSettings={handleSaveSettings}
            onRefreshUsers={async () => {
              await Promise.all([loadUsers(admin.role), loadOverview()]);
            }}
            onProfileUpdated={(displayName, email) =>
              setAdmin((prev) => (prev ? { ...prev, displayName, email } : prev))
            }
            on2FAChanged={(enabled) =>
              setAdmin((prev) => (prev ? { ...prev, twoFactorEnabled: enabled } : prev))
            }
            onFullRefresh={async () => {
              await Promise.all([loadAllAdminData(admin.role), refreshCms()]);
            }}
          />
        )}
      </main>
    </div>
  );
}

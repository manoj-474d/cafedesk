import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  Bell,
  Bookmark,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  FolderPlus,
  Globe,
  Heart,
  Lock,
  LogOut,
  MailCheck,
  Receipt,
  RefreshCw,
  Share2,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { BENGALURU_AREAS, COLLECTION_PRESETS, EXPLORER_BADGES } from '../config/constants';
import {
  getUserAuthHeaders,
  getUserSessionHeaders,
  resolveApiUrl,
  useAuth,
  type AuthResponsePayload,
} from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import { useDiscovery } from '../context/DiscoveryContext';
import { isSupabaseConfigured, supabase, syncOwnSupabaseProfile } from '../lib/supabase';
import type { ExplorerAchievementStatus } from '../types/cms';
import type { PaymentRecord, SubscriptionHistoryItem } from '../types/subscription';
import { useDocumentMeta } from '../utils/cafeHelpers';

export function AccountPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings, locations, isFeatureEnabled } = useCms();
  const { getEffectiveLocation } = useDiscovery();
  const {
    loading,
    authenticated,
    user,
    subscription,
    tier,
    isSubscribed,
    isExpired,
    isSuspended,
    expiredPlanName,
    hasPermission,
    savedCafes,
    collections,
    logout,
    applyAuthPayload,
    openCheckout,
    openUpgradeModal,
    toggleSaveCafe,
    createCollection,
    deleteCollection,
    removeCafeFromCollection,
    toggleCollectionShare,
  } = useAuth();

  const canUseCollections = isSubscribed && hasPermission('collections');
  const renewTargetPlanId =
    subscription?.expired_from_plan || (tier !== 'free' ? tier : 'plus');

  useDocumentMeta(
    `My Account – ${settings.brand_name}`,
    'Manage your Cafe Desk subscription, saved Bengaluru cafes, collections, and payment receipts.',
    { allowIndexing: false }
  );

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [history, setHistory] = useState<SubscriptionHistoryItem[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentRecord | null>(null);

  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');

  // Profile edit & email verification state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [profileSavedMsg, setProfileSavedMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSavedMsg, setPasswordSavedMsg] = useState('');
  const [passwordErrorMsg, setPasswordErrorMsg] = useState('');
  const [verifyCodeInput, setVerifyCodeInput] = useState('');
  const [devVerifyCode, setDevVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [billingBusy, setBillingBusy] = useState(false);
  const [achievements, setAchievements] = useState<ExplorerAchievementStatus[]>([]);
  const [creatingPresetName, setCreatingPresetName] = useState<string | null>(null);
  const [shareBusyId, setShareBusyId] = useState<number | null>(null);
  const [copiedShareSlug, setCopiedShareSlug] = useState<string | null>(null);
  const [pointsData, setPointsData] = useState<{
    totalPoints: number;
    ledger: Array<{
      id: number;
      points: number;
      reason: string;
      reference_type: string;
      created_at: number;
    }>;
    earnedBadges: Array<{
      id: string;
      title: string;
      description: string;
      unlocked: boolean;
    }>;
  } | null>(null);

  const [follows, setFollows] = useState<
    Array<{ id: number; cafe_key: string; cafe_name: string; created_at: number }>
  >([]);
  const [unfollowingKey, setUnfollowingKey] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<
    Array<{
      id: number;
      cafe_key: string;
      title: string;
      message: string;
      link: string;
      is_read: boolean;
      created_at: number;
    }>
  >([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifBusy, setNotifBusy] = useState(false);

  const [prefs, setPrefs] = useState<{
    favourite_areas: string[];
    favourite_categories: string[];
    preferred_max_budget: string;
    personalisation_enabled: boolean;
    public_profile_enabled: boolean;
    save_visit_history: boolean;
  }>({
    favourite_areas: [],
    favourite_categories: [],
    preferred_max_budget: '',
    personalisation_enabled: true,
    public_profile_enabled: false,
    save_visit_history: true,
  });
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [prefsSavedMsg, setPrefsSavedMsg] = useState('');
  const [prefsErrorMsg, setPrefsErrorMsg] = useState('');

  useEffect(() => {
    if (!loading && !authenticated) {
      const target = `/account${location.hash || ''}`;
      navigate(`/login?next=${encodeURIComponent(target)}`, { replace: true });
    }
  }, [loading, authenticated, location.hash, navigate]);

  useEffect(() => {
    if (!loading && authenticated && location.hash === '#saved') {
      const timer = window.setTimeout(() => {
        document.getElementById('saved')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
      return () => window.clearTimeout(timer);
    }
  }, [loading, authenticated, location.hash]);

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditPhone(user.phone || '');
    }
  }, [user]);

  const loadBillingHistory = async () => {
    try {
      const res = await fetch(resolveApiUrl('/api/billing/history'), {
        credentials: 'include',
        headers: await getUserAuthHeaders(),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = (await res.json()) as {
          payments?: PaymentRecord[];
          history?: SubscriptionHistoryItem[];
        };
        if (Array.isArray(data.payments)) setPayments(data.payments);
        if (Array.isArray(data.history)) setHistory(data.history);
      }
    } catch {
      // Non-blocking when billing backend is unavailable
    }
  };

  const loadAchievements = async () => {
    try {
      const res = await fetch(resolveApiUrl('/api/explorer/achievements'), {
        credentials: 'include',
        headers: await getUserAuthHeaders(),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = (await res.json()) as { achievements?: ExplorerAchievementStatus[] };
        if (Array.isArray(data.achievements)) {
          setAchievements(data.achievements);
        }
      }
    } catch {
      // Fall back gracefully to local milestone summary below
    }
  };

  const loadCommunityPoints = async () => {
    try {
      const res = await fetch(resolveApiUrl('/api/user/points'), {
        credentials: 'include',
        headers: await getUserAuthHeaders(),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        setPointsData(data);
      }
    } catch {
      // Non-blocking
    }
  };

  const loadPersonalisationAndInbox = async () => {
    try {
      const headers = await getUserAuthHeaders();
      const [prefRes, followRes, notifRes] = await Promise.all([
        fetch(resolveApiUrl('/api/user/preferences'), { credentials: 'include', headers }),
        fetch(resolveApiUrl('/api/user/follows'), { credentials: 'include', headers }),
        fetch(resolveApiUrl('/api/user/notifications'), { credentials: 'include', headers }),
      ]);

      if (prefRes.ok && (prefRes.headers.get('content-type') || '').includes('application/json')) {
        const pd = await prefRes.json();
        if (pd?.preferences) {
          setPrefs({
            favourite_areas: Array.isArray(pd.preferences.favourite_areas)
              ? pd.preferences.favourite_areas
              : [],
            favourite_categories: Array.isArray(pd.preferences.favourite_categories)
              ? pd.preferences.favourite_categories
              : [],
            preferred_max_budget:
              pd.preferences.preferred_max_budget !== null &&
              pd.preferences.preferred_max_budget !== undefined
                ? String(pd.preferences.preferred_max_budget)
                : '',
            personalisation_enabled: pd.preferences.personalisation_enabled !== false,
            public_profile_enabled: Boolean(pd.preferences.public_profile_enabled),
            save_visit_history: pd.preferences.save_visit_history !== false,
          });
        }
      }

      if (followRes.ok && (followRes.headers.get('content-type') || '').includes('application/json')) {
        const fd = await followRes.json();
        if (Array.isArray(fd?.follows)) setFollows(fd.follows);
      }

      if (notifRes.ok && (notifRes.headers.get('content-type') || '').includes('application/json')) {
        const nd = await notifRes.json();
        if (Array.isArray(nd?.notifications)) setNotifications(nd.notifications);
        if (typeof nd?.unreadCount === 'number') setUnreadNotifications(nd.unreadCount);
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    if (authenticated) {
      void loadBillingHistory();
      void loadAchievements();
      void loadCommunityPoints();
      void loadPersonalisationAndInbox();
    }
  }, [authenticated, tier, savedCafes.length, collections.length]);

  // Personalized recommendations based on user preferences, saved localities, or verified picks
  const recommendedCafes = useMemo(() => {
    if (!prefs.personalisation_enabled) return [];
    const savedKeys = new Set(savedCafes.map((s) => s.cafe_key));
    const preferredAreas = new Set(
      [...prefs.favourite_areas, ...savedCafes.map((s) => s.snapshot.area)].map((a) =>
        a.toLowerCase()
      )
    );
    const preferredCats = prefs.favourite_categories.map((c) => c.toLowerCase());
    const maxBudgetNum = prefs.preferred_max_budget ? Number(prefs.preferred_max_budget) : null;

    return locations
      .map((l) => getEffectiveLocation(l))
      .filter((l) => !savedKeys.has(l.slug))
      .filter((l) =>
        maxBudgetNum && l.avg_cost_per_person !== null ? l.avg_cost_per_person <= maxBudgetNum : true
      )
      .sort((a, b) => {
        const aAreaMatch = preferredAreas.has(a.area.toLowerCase()) ? 2 : 0;
        const bAreaMatch = preferredAreas.has(b.area.toLowerCase()) ? 2 : 0;
        const aHay = `${a.category || ''} ${a.verdict} ${a.best_for.join(' ')}`.toLowerCase();
        const bHay = `${b.category || ''} ${b.verdict} ${b.best_for.join(' ')}`.toLowerCase();
        const aCatMatch = preferredCats.some((c) => aHay.includes(c.split(' ')[0])) ? 1 : 0;
        const bCatMatch = preferredCats.some((c) => bHay.includes(c.split(' ')[0])) ? 1 : 0;
        const scoreDiff = bAreaMatch + bCatMatch - (aAreaMatch + aCatMatch);
        if (scoreDiff !== 0) return scoreDiff;
        return Number(b.verified) - Number(a.verified) || (b.rating ?? 0) - (a.rating ?? 0);
      })
      .slice(0, 3);
  }, [locations, savedCafes, getEffectiveLocation, prefs]);

  if (loading || !authenticated || !user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-sm text-[#57493f]">
        Loading your Cafe Desk account...
      </div>
    );
  }

  const handleRequestVerification = async () => {
    setVerifyError('');
    const res = await fetch('/api/auth/verify-email/request', {
      method: 'POST',
      credentials: 'include',
      headers: getUserSessionHeaders(),
    });
    const data = (await res.json()) as { devVerificationCode?: string; error?: string };
    if (res.ok) {
      setDevVerifyCode(data.devVerificationCode || '');
    } else {
      setVerifyError(data.error || 'Failed to generate code.');
    }
  };

  const handleConfirmVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError('');
    const res = await fetch('/api/auth/verify-email/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getUserSessionHeaders() },
      credentials: 'include',
      body: JSON.stringify({ code: verifyCodeInput }),
    });
    const data = (await res.json()) as AuthResponsePayload & { error?: string };
    if (!res.ok) {
      setVerifyError(data.error || 'Invalid code.');
      return;
    }
    applyAuthPayload(data);
    setDevVerifyCode('');
    setVerifyCodeInput('');
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSavedMsg('');
    setProfileErrorMsg('');
    if (isSupabaseConfigured && supabase && user?.supabase_id) {
      await supabase.auth
        .updateUser({
          data: { full_name: editName.trim(), phone: editPhone.trim() },
        })
        .catch(() => {});
      await syncOwnSupabaseProfile({
        id: user.supabase_id,
        fullName: editName.trim(),
        phone: editPhone.trim(),
      });
    }
    try {
      const res = await fetch(resolveApiUrl('/api/auth/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getUserSessionHeaders() },
        credentials: 'include',
        body: JSON.stringify({ name: editName, phone: editPhone }),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = (await res.json()) as AuthResponsePayload;
        applyAuthPayload(data);
        setProfileSavedMsg('Profile details updated.');
        return;
      }
      if (!ct.includes('application/json') || res.status === 404 || res.status === 405) {
        applyAuthPayload({
          authenticated: true,
          user: { ...user, name: editName.trim(), phone: editPhone.trim() },
          subscription: subscription ?? undefined,
          savedCafes,
          collections,
        });
        setProfileSavedMsg('Profile details updated.');
        return;
      }
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setProfileErrorMsg(err.error || 'Could not update profile.');
    } catch {
      if (user?.supabase_id) {
        applyAuthPayload({
          authenticated: true,
          user: { ...user, name: editName.trim(), phone: editPhone.trim() },
          subscription: subscription ?? undefined,
          savedCafes,
          collections,
        });
        setProfileSavedMsg('Profile details updated.');
      } else {
        setProfileErrorMsg('Could not update profile.');
      }
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSavedMsg('');
    setPasswordErrorMsg('');
    if (newPassword.length < 8) {
      setPasswordErrorMsg('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('New passwords do not match.');
      return;
    }
    if (isSupabaseConfigured && supabase && user?.supabase_id) {
      const { error: sbPwErr } = await supabase.auth.updateUser({ password: newPassword });
      if (sbPwErr) {
        setPasswordErrorMsg(sbPwErr.message || 'Failed to update password in Supabase.');
        return;
      }
    }
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getUserSessionHeaders() },
      credentials: 'include',
      body: JSON.stringify({
        name: user.name,
        currentPassword,
        newPassword,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as AuthResponsePayload;
      applyAuthPayload(data);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSavedMsg('Password updated successfully.');
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setPasswordErrorMsg(err.error || 'Failed to update password.');
    }
  };

  const handleCancelSubscription = async () => {
    setBillingBusy(true);
    const res = await fetch(resolveApiUrl('/api/billing/cancel'), {
      method: 'POST',
      credentials: 'include',
      headers: await getUserAuthHeaders(),
    });
    if (res.ok) {
      applyAuthPayload((await res.json()) as AuthResponsePayload);
      await loadBillingHistory();
    }
    setBillingBusy(false);
  };

  const handleResumeSubscription = async () => {
    setBillingBusy(true);
    const res = await fetch(resolveApiUrl('/api/billing/renew'), {
      method: 'POST',
      credentials: 'include',
      headers: await getUserAuthHeaders(),
    });
    if (res.ok) {
      applyAuthPayload((await res.json()) as AuthResponsePayload);
      await loadBillingHistory();
    }
    setBillingBusy(false);
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    await createCollection(newColName.trim(), newColDesc.trim());
    setNewColName('');
    setNewColDesc('');
  };

  const handleAddPresetCollection = async (preset: { name: string; description: string }) => {
    if (!canUseCollections) {
      openUpgradeModal({
        featureName: 'Preset & Personal Cafe Collections',
        requiredPlan: 'plus',
      });
      return;
    }
    const alreadyExists = collections.some(
      (c) => c.name.trim().toLowerCase() === preset.name.trim().toLowerCase()
    );
    if (alreadyExists) return;
    setCreatingPresetName(preset.name);
    try {
      await createCollection(preset.name, preset.description);
    } finally {
      setCreatingPresetName(null);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrefsBusy(true);
    setPrefsSavedMsg('');
    setPrefsErrorMsg('');
    try {
      const res = await fetch(resolveApiUrl('/api/user/preferences'), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(await getUserAuthHeaders()) },
        body: JSON.stringify({
          favourite_areas: prefs.favourite_areas,
          favourite_categories: prefs.favourite_categories,
          preferred_max_budget: prefs.preferred_max_budget ? Number(prefs.preferred_max_budget) : null,
          personalisation_enabled: prefs.personalisation_enabled,
          public_profile_enabled: prefs.public_profile_enabled,
          save_visit_history: prefs.save_visit_history,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setPrefsErrorMsg(err.error || 'Could not save preferences.');
      } else {
        setPrefsSavedMsg('Personalisation & privacy preferences saved.');
      }
    } catch {
      setPrefsErrorMsg('Network error saving preferences.');
    } finally {
      setPrefsBusy(false);
    }
  };

  const handleUnfollowCafe = async (cafeKey: string) => {
    setUnfollowingKey(cafeKey);
    try {
      const res = await fetch(resolveApiUrl(`/api/cafes/${encodeURIComponent(cafeKey)}/follow`), {
        method: 'DELETE',
        credentials: 'include',
        headers: await getUserAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.follows)) setFollows(data.follows);
      }
    } finally {
      setUnfollowingKey(null);
    }
  };

  const handleMarkNotificationsRead = async (notifId?: number) => {
    setNotifBusy(true);
    try {
      const res = await fetch(resolveApiUrl('/api/user/notifications/read'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(await getUserAuthHeaders()) },
        body: JSON.stringify(notifId ? { id: notifId } : {}),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (!notifId || n.id === notifId ? { ...n, is_read: true } : n))
        );
        setUnreadNotifications((prev) => (notifId ? Math.max(0, prev - 1) : 0));
      }
    } finally {
      setNotifBusy(false);
    }
  };

  const displayedAchievements: ExplorerAchievementStatus[] = useMemo(() => {
    if (achievements.length > 0) return achievements;
    const totalColItems = collections.reduce((sum, c) => sum + c.items.length, 0);
    return EXPLORER_BADGES.map((b) => {
      const prog =
        b.id === 'first_save'
          ? Math.min(b.target, savedCafes.length)
          : b.id === 'local_guide'
          ? Math.min(b.target, totalColItems)
          : 0;
      return {
        id: b.id,
        title: b.title,
        description: b.description,
        unlocked: prog >= b.target,
        unlocked_at: null,
        progress: prog,
        target: b.target,
      };
    });
  }, [achievements, collections, savedCafes.length]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-10">
      {/* Expired / Suspended Alert */}
      {(isExpired || isSuspended) && (
        <section
          role="alert"
          className={`rounded-2xl border p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isSuspended
              ? 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
              : 'bg-[#fffbeb] border-[#fde68a] text-[#92400e]'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <h2 className="font-serif-display text-xl font-semibold">
                {isSuspended
                  ? 'Subscription Access Suspended'
                  : 'Your subscription has expired'}
              </h2>
              <p className="text-xs sm:text-sm opacity-90">
                {isSuspended
                  ? 'Your Cafe Desk paid access has been suspended by an administrator. Premium cafe Wi-Fi, socket, menu, and booking features are locked.'
                  : `${expiredPlanName || subscription?.plan_name || 'Your paid plan'} has ended and your account is currently on Free Preview mode. Renew your subscription to restore full cafe access.`}
              </p>
            </div>
          </div>
          {isExpired && (
            <button
              type="button"
              onClick={() => openCheckout(renewTargetPlanId)}
              className="inline-flex items-center justify-center gap-2 shrink-0 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Renew Subscription</span>
            </button>
          )}
        </section>
      )}

      {/* Header Banner */}
      <header className="rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            {isSuspended ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Suspended · {subscription?.plan_name || 'Subscription'}</span>
              </span>
            ) : isExpired ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fffbeb] border border-[#fde68a] text-[#92400e] text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Expired · {expiredPlanName || subscription?.plan_name || 'Paid Plan'}</span>
              </span>
            ) : isSubscribed && tier === 'premium' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1c1613] text-[#faf7f2] text-xs font-semibold">
                <Crown className="w-3.5 h-3.5 text-[#f59e0b]" aria-hidden="true" />
                <span>
                  {subscription?.plan_name || 'Cafe Desk Plus Annual'} · ₹
                  {subscription?.price_inr ?? 499}/yr
                </span>
              </span>
            ) : isSubscribed ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fef3c7] border border-[#fde68a] text-[#92400e] text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                <span>
                  {subscription?.plan_name || 'Cafe Desk Plus'} · ₹{subscription?.price_inr ?? 79}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ecfdf5] border border-[#bbf7d0] text-[#1b4d3e] text-xs font-semibold">
                Free Explorer · ₹0 Forever
              </span>
            )}

            {user.email_verified ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ecfdf5] border border-[#bbf7d0] text-[#1b4d3e] text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Email Verified</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleRequestVerification}
                className="inline-flex items-center gap-1 min-h-[36px] text-xs font-semibold text-[#b45309] hover:underline"
              >
                <MailCheck className="w-3.5 h-3.5" />
                <span>Verify Email Now</span>
              </button>
            )}
          </div>

          <h1 className="font-serif-display text-3xl sm:text-4xl font-semibold text-[#1c1613]">
            {user.name}
          </h1>
          <p className="text-sm text-[#57493f]">
            {user.email}
            {user.phone ? ` · ${user.phone}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isSubscribed && (
            <button
              type="button"
              onClick={() => openCheckout(isExpired ? renewTargetPlanId : 'plus')}
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors"
            >
              {isExpired ? 'Renew Subscription' : 'Upgrade to Plus (₹79/mo)'}
            </button>
          )}
          <Link
            to="/locations"
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-[#faf7f2] border border-[#d6cbba] hover:border-[#b45309] text-xs font-semibold text-[#1c1613] transition-colors"
          >
            Explore Cafes
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-white border border-[#e6ddd0] hover:bg-[#fef2f2] hover:border-[#fecaca] hover:text-[#991b1b] text-xs font-semibold text-[#1c1613] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Email Verification Prompt if Requested */}
      {!user.email_verified && (devVerifyCode || verifyError) && (
        <section className="rounded-2xl bg-[#ecfdf5] border border-[#bbf7d0] p-5 space-y-3">
          <p className="text-xs font-semibold text-[#1b4d3e]">
            Confirm Email Verification · Enter code:{' '}
            {devVerifyCode && <span className="font-mono-data">{devVerifyCode}</span>}
          </p>
          {verifyError && <p className="text-xs font-medium text-[#dc2626]">{verifyError}</p>}
          <form onSubmit={handleConfirmVerification} className="flex flex-wrap gap-2.5">
            <input
              type="text"
              value={verifyCodeInput}
              onChange={(e) => setVerifyCodeInput(e.target.value)}
              placeholder="6-digit code"
              className="h-11 px-3 rounded-lg bg-white border border-[#d6cbba] font-mono-data text-sm text-[#1c1613] focus:outline-none focus:border-[#1b4d3e]"
            />
            <button
              type="submit"
              className="h-11 px-5 rounded-lg bg-[#1b4d3e] hover:bg-[#143a2f] text-white text-xs font-semibold transition-colors"
            >
              Confirm Code
            </button>
          </form>
        </section>
      )}

      {/* Subscription Status & Profile Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-6 space-y-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif-display text-2xl font-semibold text-[#1c1613]">
              Subscription Management
            </h2>
            <Link to="/pricing" className="text-xs font-semibold text-[#b45309] hover:underline">
              Compare All Plans &rarr;
            </Link>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] text-xs">
            <div>
              <dt className="text-[#57493f] font-medium">Current Plan</dt>
              <dd className="font-semibold text-sm text-[#1c1613] mt-0.5">
                {subscription?.plan_name || 'Free Explorer'}
              </dd>
            </div>
            <div>
              <dt className="text-[#57493f] font-medium">Billing Price</dt>
              <dd className="font-mono-data font-semibold text-sm text-[#1c1613] mt-0.5">
                ₹{subscription?.price_inr ?? 0}/{tier === 'premium' ? 'yr' : 'mo'}
              </dd>
            </div>
            <div>
              <dt className="text-[#57493f] font-medium">Billing Status</dt>
              <dd
                className={`font-semibold text-sm capitalize mt-0.5 ${
                  isSuspended || isExpired
                    ? 'text-[#dc2626]'
                    : isSubscribed
                    ? 'text-[#1b4d3e]'
                    : 'text-[#57493f]'
                }`}
              >
                {isSuspended
                  ? 'suspended'
                  : isExpired
                  ? 'expired'
                  : subscription?.status || 'active'}
              </dd>
            </div>
            <div>
              <dt className="text-[#57493f] font-medium">
                {isExpired
                  ? 'Expired On'
                  : subscription?.status === 'cancelled'
                  ? 'Access Ends'
                  : 'Next Renewal'}
              </dt>
              <dd className="font-mono-data font-semibold text-sm text-[#1c1613] mt-0.5">
                {subscription?.expires_at
                  ? new Date(subscription.expires_at).toLocaleDateString('en-IN')
                  : subscription?.expired_at
                  ? new Date(subscription.expired_at).toLocaleDateString('en-IN')
                  : 'Never (Free)'}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-3">
            {(!isSubscribed || tier !== 'plus') && (
              <button
                type="button"
                onClick={() => openCheckout('plus')}
                className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-[#faf7f2] border border-[#d6cbba] hover:border-[#b45309] text-xs font-semibold text-[#1c1613] transition-colors"
              >
                {isExpired && renewTargetPlanId === 'plus'
                  ? 'Renew Plus Monthly (₹79/mo)'
                  : tier === 'free'
                  ? 'Plus Monthly (₹79/mo)'
                  : 'Switch to Monthly (₹79/mo)'}
              </button>
            )}
            {(!isSubscribed || tier !== 'premium') && (
              <button
                type="button"
                onClick={() => openCheckout('premium')}
                className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors"
              >
                Plus Annual · Save 47% (₹499/yr)
              </button>
            )}
            {isSubscribed && tier !== 'free' && (
              <button
                type="button"
                onClick={() => openCheckout(tier)}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-[#1c1613] hover:bg-[#3a2f28] text-[#faf7f2] text-xs font-semibold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Renew Now (+{tier === 'premium' ? '365' : '30'} Days)</span>
              </button>
            )}
            {isSubscribed && tier !== 'free' && subscription?.status === 'active' && (
              <button
                type="button"
                disabled={billingBusy}
                onClick={handleCancelSubscription}
                className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-[#fef2f2] border border-[#fecaca] hover:bg-[#fee2e2] text-[#991b1b] text-xs font-semibold transition-colors"
              >
                Cancel Auto-Renewal
              </button>
            )}
            {isSubscribed && tier !== 'free' && subscription?.status === 'cancelled' && (
              <button
                type="button"
                disabled={billingBusy}
                onClick={handleResumeSubscription}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-[#1b4d3e] hover:bg-[#143a2f] text-white text-xs font-semibold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Resume Auto-Renewal</span>
              </button>
            )}
          </div>
        </section>

        <section className="lg:col-span-5 rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-6 space-y-5 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#ecfdf5] border border-[#bbf7d0] flex items-center justify-center text-[#1b4d3e]">
              <UserCheck className="w-4 h-4" />
            </div>
            <h2 className="font-serif-display text-2xl font-semibold text-[#1c1613]">
              Profile &amp; Security
            </h2>
          </div>

          <form onSubmit={handleUpdateName} className="space-y-3.5">
            <div>
              <label
                htmlFor="acc-name"
                className="block text-xs font-semibold text-[#57493f] mb-1"
              >
                Full Name
              </label>
              <input
                id="acc-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg bg-[#faf7f2] border border-[#d6cbba] text-sm text-[#1c1613] focus:outline-none focus:border-[#b45309]"
              />
            </div>
            <div>
              <label
                htmlFor="acc-phone"
                className="block text-xs font-semibold text-[#57493f] mb-1"
              >
                Phone Number (Optional)
              </label>
              <input
                id="acc-phone"
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full h-11 px-3.5 rounded-lg bg-[#faf7f2] border border-[#d6cbba] text-sm text-[#1c1613] focus:outline-none focus:border-[#b45309]"
              />
            </div>
            {profileErrorMsg && (
              <p className="text-xs font-medium text-[#dc2626]">{profileErrorMsg}</p>
            )}
            {profileSavedMsg && (
              <p className="text-xs font-medium text-[#1b4d3e]">{profileSavedMsg}</p>
            )}
            <button
              type="submit"
              className="inline-flex items-center justify-center min-h-[44px] px-5 py-2 rounded-lg bg-[#1c1613] hover:bg-[#3a2f28] text-[#faf7f2] text-xs font-semibold transition-colors"
            >
              Save Profile
            </button>
          </form>

          {user.auth_provider === 'email' && (
            <form
              onSubmit={handleUpdatePassword}
              className="pt-4 border-t border-[#e6ddd0] space-y-3"
            >
              <p className="text-xs font-semibold text-[#1c1613]">Change Password</p>
              <div className="space-y-2.5">
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  aria-label="Current password"
                  className="w-full h-11 px-3.5 rounded-lg bg-[#faf7f2] border border-[#d6cbba] text-xs text-[#1c1613] focus:outline-none focus:border-[#b45309]"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (8+ chars)"
                    aria-label="New password"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#faf7f2] border border-[#d6cbba] text-xs text-[#1c1613] focus:outline-none focus:border-[#b45309]"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    aria-label="Confirm new password"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#faf7f2] border border-[#d6cbba] text-xs text-[#1c1613] focus:outline-none focus:border-[#b45309]"
                  />
                </div>
              </div>
              {passwordErrorMsg && (
                <p className="text-xs font-medium text-[#dc2626]">{passwordErrorMsg}</p>
              )}
              {passwordSavedMsg && (
                <p className="text-xs font-medium text-[#1b4d3e]">{passwordSavedMsg}</p>
              )}
              <button
                type="submit"
                className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-[#faf7f2] border border-[#d6cbba] hover:border-[#b45309] text-[#1c1613] text-xs font-semibold transition-colors"
              >
                Update Password
              </button>
            </form>
          )}
        </section>
      </div>

      {/* Saved Cafes & Favourites + Personal Collections */}
      <section
        id="saved"
        className="scroll-mt-24 rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-6 space-y-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-block text-xs uppercase tracking-[0.14em] font-semibold text-[#b45309] mb-1">
              Your Cafe Desk Library
            </span>
            <h2 className="font-serif-display text-2xl sm:text-3xl font-semibold text-[#1c1613]">
              Saved Favourites &amp; Personal Collections
            </h2>
          </div>
          {!canUseCollections && (
            <button
              type="button"
              onClick={() =>
                openUpgradeModal({
                  featureName: 'Personal Custom Collections',
                  requiredPlan: 'plus',
                })
              }
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isExpired ? 'Renew for Collections' : 'Unlock Collections (Plus ₹79/mo)'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Saved & Favourites — Free for Everyone */}
          <div className="lg:col-span-6 space-y-3">
            <h3 className="text-sm font-semibold text-[#1c1613] flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-[#b45309]" />
              <span>Saved &amp; Favourites ({savedCafes.length})</span>
              <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full bg-[#ecfdf5] border border-[#bbf7d0] text-[#1b4d3e] text-[10px] font-semibold">
                Free Feature
              </span>
            </h3>
            {savedCafes.length === 0 ? (
              <div className="p-5 rounded-xl bg-[#faf7f2] border border-dashed border-[#d6cbba] text-xs text-[#57493f] space-y-2">
                <p>No saved cafes yet. Tap the heart on any Bengaluru cafe listing to bookmark it here.</p>
                <Link
                  to="/locations"
                  className="inline-flex items-center gap-1 font-semibold text-[#b45309] hover:underline"
                >
                  Browse Bengaluru cafes &rarr;
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {savedCafes.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#e6ddd0] p-3.5 bg-[#faf7f2] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/locations/${item.snapshot.slug || item.cafe_key}`}
                        className="text-sm font-semibold text-[#1c1613] hover:text-[#b45309] truncate block"
                      >
                        {item.snapshot.name}
                      </Link>
                      <p className="text-xs text-[#57493f] truncate">
                        {item.snapshot.area} · {item.snapshot.address}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.is_favourite && (
                        <Heart className="w-4 h-4 text-[#dc2626] fill-[#dc2626]" />
                      )}
                      <button
                        type="button"
                        onClick={() => void toggleSaveCafe(item.snapshot)}
                        aria-label={`Remove ${item.snapshot.name}`}
                        className="w-11 h-11 rounded-lg text-[#57493f] hover:text-[#dc2626] flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Collections — Cafe Desk Plus */}
          <div className="lg:col-span-6 space-y-4">
            <h3 className="text-sm font-semibold text-[#1c1613] flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-[#1b4d3e]" />
              <span>Personal Cafe Collections ({collections.length})</span>
            </h3>

            {!canUseCollections ? (
              <div className="rounded-xl border border-[#e6ddd0] p-5 bg-[#faf7f2] space-y-2.5">
                <p className="text-sm font-semibold text-[#1c1613]">
                  Organize cafes into unlimited custom lists like &ldquo;Indiranagar Deep Work&rdquo;
                  or &ldquo;Budget Chai Spots&rdquo;.
                </p>
                <p className="text-xs text-[#57493f]">
                  {isExpired
                    ? 'Your subscription has expired. Renew your plan to create and manage custom cafe collections.'
                    : 'Included with an active Cafe Desk subscription (from ₹79/mo).'}
                </p>
              </div>
            ) : (
              <>
                <form onSubmit={handleCreateCollection} className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    placeholder="New collection (e.g. Indiranagar Deep Work)"
                    className="flex-1 h-11 px-3.5 rounded-lg bg-[#faf7f2] border border-[#d6cbba] text-xs text-[#1c1613] focus:outline-none focus:border-[#b45309]"
                  />
                  <button
                    type="submit"
                    className="h-11 px-5 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold whitespace-nowrap transition-colors"
                  >
                    Create List
                  </button>
                </form>

                {/* 1-Click Preset Collection Templates */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#57493f]">
                    Quick Preset Lists
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {COLLECTION_PRESETS.map((preset) => {
                      const exists = collections.some(
                        (c) => c.name.trim().toLowerCase() === preset.name.trim().toLowerCase()
                      );
                      const busy = creatingPresetName === preset.name;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          disabled={exists || busy}
                          onClick={() => void handleAddPresetCollection(preset)}
                          title={preset.description}
                          className={`min-h-[36px] px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                            exists
                              ? 'bg-[#ecfdf5] border-[#bbf7d0] text-[#1b4d3e] cursor-default'
                              : 'bg-[#faf7f2] border-[#d6cbba] hover:border-[#b45309] text-[#1c1613]'
                          }`}
                        >
                          {exists ? `✓ ${preset.name}` : busy ? 'Adding...' : `+ ${preset.name}`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  {collections.map((col) => (
                    <div
                      key={col.id}
                      className="rounded-xl border border-[#e6ddd0] p-4 bg-[#faf7f2] space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[#1c1613]">{col.name}</p>
                            {col.is_public && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ecfdf5] border border-[#bbf7d0] text-[#1b4d3e] text-[10px] font-semibold">
                                <Globe className="w-3 h-3" aria-hidden="true" />
                                Public
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#57493f]">
                            {col.items.length} {col.items.length === 1 ? 'cafe' : 'cafes'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {isFeatureEnabled('public_collections') && (
                            <button
                              type="button"
                              disabled={shareBusyId === col.id}
                              onClick={async () => {
                                setShareBusyId(col.id);
                                try {
                                  await toggleCollectionShare(col.id, !col.is_public);
                                } finally {
                                  setShareBusyId(null);
                                }
                              }}
                              className="min-h-[36px] px-2.5 rounded-lg bg-white border border-[#d6cbba] hover:border-[#b45309] text-xs font-semibold text-[#1c1613] inline-flex items-center gap-1"
                            >
                              <Share2 className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                              <span>{col.is_public ? 'Make Private' : 'Make Public'}</span>
                            </button>
                          )}
                          {col.is_public && col.share_slug && (
                            <>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(
                                      `${window.location.origin}/collections/${col.share_slug}`
                                    );
                                    setCopiedShareSlug(col.share_slug || '');
                                    window.setTimeout(() => setCopiedShareSlug(null), 2000);
                                  } catch {
                                    // ignore clipboard block
                                  }
                                }}
                                className="min-h-[36px] px-2.5 rounded-lg bg-[#ecfdf5] border border-[#bbf7d0] text-xs font-semibold text-[#1b4d3e] inline-flex items-center gap-1"
                              >
                                {copiedShareSlug === col.share_slug ? (
                                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                                )}
                                <span>
                                  {copiedShareSlug === col.share_slug ? 'Copied Link' : 'Copy Link'}
                                </span>
                              </button>
                              <Link
                                to={`/collections/${col.share_slug}`}
                                className="min-h-[36px] px-2 inline-flex items-center text-xs font-semibold text-[#b45309] hover:underline"
                              >
                                View &rarr;
                              </Link>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => void deleteCollection(col.id)}
                            className="min-h-[36px] px-2.5 text-xs font-semibold text-[#dc2626] hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {col.items.length > 0 && (
                        <ul className="space-y-1.5 pt-2 border-t border-[#e6ddd0] text-xs">
                          {col.items.map((ci) => (
                            <li key={ci.cafe_key} className="flex items-center justify-between gap-2">
                              <Link
                                to={`/locations/${ci.snapshot.slug || ci.cafe_key}`}
                                className="font-medium text-[#1c1613] hover:text-[#b45309] truncate"
                              >
                                {ci.snapshot.name} ({ci.snapshot.area})
                              </Link>
                              <button
                                type="button"
                                onClick={() => removeCafeFromCollection(col.id, ci.cafe_key)}
                                className="min-h-[36px] px-2 text-[#57493f] hover:text-[#dc2626] font-medium"
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* CafeDesk Explorer Badges & Milestones */}
      <section className="rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-6 space-y-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#fef3c7] border border-[#fde68a] flex items-center justify-center text-[#b45309] shrink-0">
              <Award className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <span className="inline-block text-[11px] uppercase tracking-[0.14em] font-semibold text-[#b45309]">
                CafeDesk Explorer
              </span>
              <h2 className="font-serif-display text-2xl font-semibold text-[#1c1613]">
                Explorer Badges &amp; Milestones
              </h2>
            </div>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#ecfdf5] border border-[#bbf7d0] text-[#1b4d3e] text-xs font-semibold font-mono-data">
            {displayedAchievements.filter((a) => a.unlocked).length} / {displayedAchievements.length} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedAchievements.map((badge) => {
            const pct = badge.target > 0 ? Math.min(100, Math.round((badge.progress / badge.target) * 100)) : 0;
            return (
              <div
                key={badge.id}
                className={`rounded-xl border p-4 space-y-2.5 transition-colors ${
                  badge.unlocked
                    ? 'bg-[#ecfdf5]/60 border-[#a7f3d0]'
                    : 'bg-[#faf7f2] border-[#e6ddd0]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1c1613]">{badge.title}</p>
                    <p className="text-xs text-[#57493f] mt-0.5 leading-relaxed">
                      {badge.description}
                    </p>
                  </div>
                  {badge.unlocked ? (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1b4d3e] text-white text-[10px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      <span>Earned</span>
                    </span>
                  ) : (
                    <span className="shrink-0 font-mono-data text-[11px] font-semibold text-[#57493f]">
                      {badge.progress}/{badge.target}
                    </span>
                  )}
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#e6ddd0] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      badge.unlocked ? 'bg-[#1b4d3e]' : 'bg-[#b45309]'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {badge.unlocked_at && (
                  <p className="text-[11px] font-mono-data text-[#1b4d3e]">
                    Unlocked {new Date(badge.unlocked_at).toLocaleDateString('en-IN')}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Community Trust Points & Contributor Badges */}
        {pointsData && (
          <div className="pt-5 border-t border-[#e6ddd0] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1b4d3e]">
                  Community Contributions &amp; Trust Score
                </p>
                <p className="text-xs text-[#57493f]">
                  Earn points by reviewing cafes (+15), reporting accuracy fixes (+10), or sharing photos &amp; menu prices (+5 to +25).
                </p>
              </div>
              <span className="font-mono-data tabular-nums px-3.5 py-1.5 rounded-full bg-[#fef3c7] border border-[#fde68a] text-[#92400e] text-xs font-bold">
                {pointsData.totalPoints} Contribution Points
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {pointsData.earnedBadges.map((b) => (
                <div
                  key={b.id}
                  className={`rounded-xl border p-3.5 space-y-1 text-xs ${
                    b.unlocked
                      ? 'bg-[#ecfdf5]/60 border-[#a7f3d0]'
                      : 'bg-[#faf7f2] border-[#e6ddd0] opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#1c1613]">{b.title}</span>
                    <span
                      className={`text-[10px] font-semibold uppercase ${
                        b.unlocked ? 'text-[#1b4d3e]' : 'text-[#57493f]'
                      }`}
                    >
                      {b.unlocked ? 'Earned' : 'Locked'}
                    </span>
                  </div>
                  <p className="text-[#57493f] leading-relaxed">{b.description}</p>
                </div>
              ))}
            </div>

            {pointsData.ledger.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <p className="font-semibold text-[#57493f]">Recent Points Activity</p>
                <ul className="divide-y divide-[#e6ddd0] rounded-xl border border-[#e6ddd0] bg-[#faf7f2] px-3.5">
                  {pointsData.ledger.slice(0, 6).map((entry) => (
                    <li key={entry.id} className="py-2 flex items-center justify-between gap-3">
                      <span className="text-[#1c1613] truncate">{entry.reason}</span>
                      <span className="font-mono-data font-semibold text-[#1b4d3e] shrink-0">
                        +{entry.points} pts
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Cafe Update Notifications & Followed Cafes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {isFeatureEnabled('notifications') && (
          <section className="lg:col-span-6 rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#fef3c7] border border-[#fde68a] flex items-center justify-center text-[#b45309]">
                  <Bell className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-serif-display text-2xl font-semibold text-[#1c1613]">
                    Cafe Update Alerts
                  </h2>
                  <p className="text-xs text-[#57493f]">
                    Approved menu, hours, and facility updates from cafes you follow.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unreadNotifications > 0 && (
                  <span className="font-mono-data px-2.5 py-0.5 rounded-full bg-[#b45309] text-white text-xs font-semibold">
                    {unreadNotifications} unread
                  </span>
                )}
                {unreadNotifications > 0 && (
                  <button
                    type="button"
                    disabled={notifBusy}
                    onClick={() => void handleMarkNotificationsRead()}
                    className="min-h-[36px] px-3 rounded-lg bg-[#faf7f2] border border-[#d6cbba] hover:border-[#b45309] text-xs font-semibold text-[#1c1613]"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            {notifications.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#faf7f2] border border-dashed border-[#d6cbba] text-xs text-[#57493f]">
                No updates yet. Follow any Bengaluru cafe on its detail page to receive menu or
                facility update alerts here.
              </div>
            ) : (
              <ul className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`rounded-xl border p-3.5 text-xs space-y-1 transition-colors ${
                      n.is_read
                        ? 'bg-[#faf7f2] border-[#e6ddd0]'
                        : 'bg-[#fffbeb] border-[#fde68a]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={n.link || `/cafe/${encodeURIComponent(n.cafe_key)}`}
                        onClick={() => {
                          if (!n.is_read) void handleMarkNotificationsRead(n.id);
                        }}
                        className="font-semibold text-[#1c1613] hover:text-[#b45309]"
                      >
                        {n.title}
                      </Link>
                      <span className="font-mono-data text-[11px] text-[#57493f] shrink-0">
                        {new Date(n.created_at).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <p className="text-[#57493f] leading-relaxed">{n.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section
          className={`${
            isFeatureEnabled('notifications') ? 'lg:col-span-6' : 'lg:col-span-12'
          } rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-6 space-y-4 shadow-xs`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-serif-display text-2xl font-semibold text-[#1c1613]">
                Followed Cafes ({follows.length})
              </h2>
              <p className="text-xs text-[#57493f]">
                Get notified whenever an owner or admin updates hours, menus, or amenities.
              </p>
            </div>
            <Link to="/discover" className="text-xs font-semibold text-[#b45309] hover:underline">
              Browse Cafes &rarr;
            </Link>
          </div>

          {follows.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#faf7f2] border border-dashed border-[#d6cbba] text-xs text-[#57493f]">
              You are not following any cafes yet. Open any cafe detail page and tap{' '}
              <strong>Follow Cafe</strong>.
            </div>
          ) : (
            <ul className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {follows.map((f) => (
                <li
                  key={f.id}
                  className="rounded-xl border border-[#e6ddd0] p-3.5 bg-[#faf7f2] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/cafe/${encodeURIComponent(f.cafe_key)}`}
                      className="text-sm font-semibold text-[#1c1613] hover:text-[#b45309] truncate block"
                    >
                      {f.cafe_name}
                    </Link>
                    <p className="text-[11px] font-mono-data text-[#57493f]">
                      Following since {new Date(f.created_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={unfollowingKey === f.cafe_key}
                    onClick={() => void handleUnfollowCafe(f.cafe_key)}
                    className="min-h-[38px] px-3 rounded-lg bg-white border border-[#d6cbba] hover:border-[#dc2626] hover:text-[#dc2626] text-xs font-semibold text-[#57493f] shrink-0 transition-colors"
                  >
                    {unfollowingKey === f.cafe_key ? 'Removing...' : 'Unfollow'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Personalisation & Privacy Preferences + Owner Partner Portal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {isFeatureEnabled('personalisation') && (
          <section className="lg:col-span-8 rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-6 space-y-5 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#ecfdf5] border border-[#bbf7d0] flex items-center justify-center text-[#1b4d3e]">
                <Sliders className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-serif-display text-2xl font-semibold text-[#1c1613]">
                  Discovery Personalisation &amp; Privacy
                </h2>
                <p className="text-xs text-[#57493f]">
                  Tailor homepage picks by neighbourhood, category, and budget — or turn off tracking anytime.
                </p>
              </div>
            </div>

            <form onSubmit={handleSavePreferences} className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#1c1613]">Favourite Bengaluru Areas</p>
                <div className="flex flex-wrap gap-2">
                  {BENGALURU_AREAS.slice(0, 12).map((area) => {
                    const active = prefs.favourite_areas.includes(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() =>
                          setPrefs((p) => ({
                            ...p,
                            favourite_areas: active
                              ? p.favourite_areas.filter((a) => a !== area)
                              : [...p.favourite_areas, area],
                          }))
                        }
                        className={`min-h-[36px] px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          active
                            ? 'bg-[#1c1613] text-white border-[#1c1613]'
                            : 'bg-[#faf7f2] border-[#d6cbba] text-[#1c1613] hover:border-[#b45309]'
                        }`}
                      >
                        {active ? `✓ ${area}` : area}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#1c1613]">Favourite Cafe Categories</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Tea & Chai',
                    'Coffee',
                    'Bakeries & Snacks',
                    'Desserts',
                    'Laptop Work',
                    'Quiet Study',
                    'Family-Friendly',
                  ].map((cat) => {
                    const active = prefs.favourite_categories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setPrefs((p) => ({
                            ...p,
                            favourite_categories: active
                              ? p.favourite_categories.filter((c) => c !== cat)
                              : [...p.favourite_categories, cat],
                          }))
                        }
                        className={`min-h-[36px] px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          active
                            ? 'bg-[#b45309] text-white border-[#b45309]'
                            : 'bg-[#faf7f2] border-[#d6cbba] text-[#1c1613] hover:border-[#b45309]'
                        }`}
                      >
                        {active ? `✓ ${cat}` : cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="pref-max-budget"
                    className="block text-xs font-semibold text-[#57493f] mb-1"
                  >
                    Preferred Max Avg Spend per Visit (₹ INR)
                  </label>
                  <input
                    id="pref-max-budget"
                    type="number"
                    min={20}
                    max={5000}
                    value={prefs.preferred_max_budget}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, preferred_max_budget: e.target.value }))
                    }
                    placeholder="e.g. 200 (leave blank for any)"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#faf7f2] border border-[#d6cbba] text-sm font-mono-data text-[#1c1613] focus:outline-none focus:border-[#b45309]"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-[#e6ddd0] space-y-2.5 text-xs">
                <p className="font-semibold text-[#1c1613] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#1b4d3e]" aria-hidden="true" />
                  <span>Privacy Controls</span>
                </p>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.personalisation_enabled}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, personalisation_enabled: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[#b45309]"
                  />
                  <span className="text-[#1c1613]">
                    Enable personalised Bengaluru recommendations on my homepage and account
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.save_visit_history}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, save_visit_history: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[#b45309]"
                  />
                  <span className="text-[#1c1613]">
                    Remember recently viewed cafes on this browser
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.public_profile_enabled}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, public_profile_enabled: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[#b45309]"
                  />
                  <span className="text-[#1c1613]">
                    Show my first name on public collections &amp; verified reviews
                  </span>
                </label>
              </div>

              {prefsErrorMsg && (
                <p className="text-xs font-medium text-[#dc2626]">{prefsErrorMsg}</p>
              )}
              {prefsSavedMsg && (
                <p className="text-xs font-medium text-[#1b4d3e]">{prefsSavedMsg}</p>
              )}

              <button
                type="submit"
                disabled={prefsBusy}
                className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg bg-[#1b4d3e] hover:bg-[#143a2f] disabled:opacity-60 text-white text-xs font-semibold transition-colors"
              >
                {prefsBusy ? 'Saving Preferences...' : 'Save Preferences & Privacy'}
              </button>
            </form>
          </section>
        )}

        <section
          className={`${
            isFeatureEnabled('personalisation') ? 'lg:col-span-4' : 'lg:col-span-12'
          } rounded-2xl bg-[#1c1613] text-[#faf7f2] p-5 sm:p-6 flex flex-col justify-between gap-4 shadow-xs`}
        >
          <div className="space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#f59e0b]">
              <Building2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#f59e0b]">
              Own or Manage a Cafe?
            </p>
            <h2 className="font-serif-display text-2xl font-semibold text-white">
              Cafe Owner Partner Portal
            </h2>
            <p className="text-xs text-[#d6cbba] leading-relaxed">
              Claim your Bengaluru cafe listing, verify ownership, update Wi-Fi speeds, hours, and
              menu pricing, post customer offers, and track real engagement metrics.
            </p>
          </div>
          <Link
            to="/partner-portal"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors"
          >
            <span>Open Cafe Owner Partner Portal</span>
            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </section>
      </div>

      {/* Personalized Cafe Recommendations */}
      <section className="rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="inline-block text-xs uppercase tracking-[0.14em] font-semibold text-[#1b4d3e] mb-1">
              Personalized For You
            </span>
            <h2 className="font-serif-display text-2xl font-semibold text-[#1c1613]">
              Recommended Bengaluru Cafes
            </h2>
          </div>
          {!isSubscribed && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#fef3c7] border border-[#fde68a] text-[#92400e] text-[11px] font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>{isExpired ? 'Expired' : 'Plus ₹79'}</span>
            </span>
          )}
        </div>

        {!prefs.personalisation_enabled ? (
          <p className="text-xs text-[#57493f] p-4 rounded-xl bg-[#faf7f2] border border-[#e6ddd0]">
            Personalisation is paused in your privacy settings above. Enable it anytime to see
            recommendations matched to your areas and categories.
          </p>
        ) : isSubscribed ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendedCafes.map((cafe) => (
              <Link
                key={cafe.id}
                to={`/locations/${cafe.slug}`}
                className="rounded-xl border border-[#e6ddd0] p-4 bg-[#faf7f2] hover:border-[#b45309] space-y-1.5 transition-colors"
              >
                <p className="text-xs font-semibold text-[#b45309]">{cafe.area}</p>
                <p className="font-serif-display text-lg font-semibold text-[#1c1613]">
                  {cafe.name}
                </p>
                <p className="text-xs text-[#57493f] line-clamp-2">{cafe.verdict}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] text-xs">
            <span className="text-[#57493f]">
              {isExpired
                ? 'Your subscription has expired. Renew to restore personalized Bengaluru cafe recommendations matched to your saved areas.'
                : 'Upgrade to Cafe Desk Plus for tailored Bengaluru cafe recommendations matched to your saved areas and work preferences.'}
            </span>
            <button
              type="button"
              onClick={() => openCheckout(isExpired ? renewTargetPlanId : 'plus')}
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white font-semibold transition-colors"
            >
              {isExpired ? 'Renew Subscription' : 'Upgrade ₹79/mo'}
            </button>
          </div>
        )}
      </section>

      {/* Billing History & Receipts */}
      <section className="rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#fef3c7] border border-[#fde68a] flex items-center justify-center text-[#b45309]">
            <Receipt className="w-4 h-4" />
          </div>
          <h2 className="font-serif-display text-2xl font-semibold text-[#1c1613]">
            Billing History &amp; Receipts
          </h2>
        </div>

        {payments.length === 0 ? (
          <p className="text-xs text-[#57493f]">No subscription payments recorded yet.</p>
        ) : (
          <>
            {/* Mobile Receipt Cards */}
            <div className="md:hidden space-y-3">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-[#e6ddd0] p-4 bg-[#faf7f2] space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-[#1c1613]">
                        {p.plan_name || p.plan_id}
                      </p>
                      <p className="font-mono-data text-[11px] text-[#57493f]">
                        {p.receipt_number} · {new Date(p.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <span className="font-mono-data text-sm font-semibold text-[#1c1613] tabular-nums">
                      ₹{p.amount_inr}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#e6ddd0]">
                    <span
                      className={`font-semibold capitalize ${
                        p.status === 'paid'
                          ? 'text-[#1b4d3e]'
                          : p.status === 'refunded'
                          ? 'text-[#b45309]'
                          : 'text-[#dc2626]'
                      }`}
                    >
                      {p.status} · <span className="uppercase">{p.method}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedReceipt(p)}
                      className="min-h-[44px] px-3 font-semibold text-[#b45309] inline-flex items-center gap-1"
                    >
                      <span>View Receipt</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Billing Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs text-[#1c1613]">
                <thead>
                  <tr className="border-b border-[#e6ddd0] text-[#57493f]">
                    <th className="py-2.5 pr-4 font-semibold">Receipt</th>
                    <th className="py-2.5 pr-4 font-semibold">Plan</th>
                    <th className="py-2.5 pr-4 font-semibold">Amount</th>
                    <th className="py-2.5 pr-4 font-semibold">Method</th>
                    <th className="py-2.5 pr-4 font-semibold">Status</th>
                    <th className="py-2.5 pr-4 font-semibold">Date</th>
                    <th className="py-2.5 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6ddd0]">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 pr-4 font-mono-data font-medium">{p.receipt_number}</td>
                      <td className="py-3 pr-4 font-medium">{p.plan_name || p.plan_id}</td>
                      <td className="py-3 pr-4 font-mono-data font-semibold tabular-nums">
                        ₹{p.amount_inr}
                      </td>
                      <td className="py-3 pr-4 uppercase">{p.method}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`font-semibold capitalize ${
                            p.status === 'paid'
                              ? 'text-[#1b4d3e]'
                              : p.status === 'refunded'
                              ? 'text-[#b45309]'
                              : 'text-[#dc2626]'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono-data text-[#57493f]">
                        {new Date(p.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(p)}
                          className="font-semibold text-[#b45309] hover:underline inline-flex items-center gap-1"
                        >
                          <span>View Receipt</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {history.length > 0 && (
          <div className="pt-4 border-t border-[#e6ddd0] space-y-2">
            <p className="text-xs font-semibold text-[#57493f]">Subscription Activity</p>
            <ul className="space-y-1.5 text-xs text-[#57493f]">
              {history.slice(0, 6).map((h) => (
                <li key={h.id} className="flex flex-wrap justify-between gap-2">
                  <span>{h.note}</span>
                  <span className="font-mono-data">
                    {new Date(h.created_at).toLocaleDateString('en-IN')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Printable Receipt Modal */}
      {selectedReceipt && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#1c1613]/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white border border-[#e6ddd0] p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6 space-y-4 shadow-xl animate-sheet-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e6ddd0] pb-3">
              <div>
                <p className="font-serif-display text-xl font-semibold text-[#1c1613]">
                  {settings.brand_name} Receipt
                </p>
                <p className="text-xs font-mono-data text-[#57493f]">
                  {selectedReceipt.receipt_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                aria-label="Close receipt"
                className="w-10 h-10 rounded-lg border border-[#d6cbba] bg-[#faf7f2] hover:bg-white text-[#1c1613] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <dl className="space-y-2 text-xs text-[#1c1613]">
              <div className="flex justify-between gap-3">
                <dt className="text-[#57493f]">Billed To</dt>
                <dd className="font-semibold text-right">{user.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#57493f]">Email</dt>
                <dd className="text-right truncate">{user.email}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#57493f]">Plan</dt>
                <dd className="font-semibold text-right">
                  {selectedReceipt.plan_name || selectedReceipt.plan_id}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#57493f]">Payment Method</dt>
                <dd className="uppercase font-medium">{selectedReceipt.method}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#57493f]">Payment Reference</dt>
                <dd className="font-mono-data text-right truncate">
                  {selectedReceipt.provider_payment_id || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#57493f]">Status</dt>
                <dd className="capitalize font-semibold">{selectedReceipt.status}</dd>
              </div>
              <div className="flex justify-between pt-3 border-t border-[#e6ddd0] text-sm">
                <dt className="font-semibold">Total Amount</dt>
                <dd className="font-mono-data font-bold tabular-nums">
                  ₹{selectedReceipt.amount_inr}.00 INR
                </dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => window.print()}
              className="w-full min-h-[44px] py-2.5 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors"
            >
              Print / Save PDF Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

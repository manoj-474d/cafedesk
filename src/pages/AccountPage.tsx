import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Bookmark,
  CheckCircle2,
  Crown,
  FolderPlus,
  Heart,
  Lock,
  LogOut,
  MailCheck,
  Receipt,
  RefreshCw,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { getUserSessionHeaders, useAuth, type AuthResponsePayload } from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import { useDiscovery } from '../context/DiscoveryContext';
import { isSupabaseConfigured, supabase, syncOwnSupabaseProfile } from '../lib/supabase';
import type { PaymentRecord, SubscriptionHistoryItem } from '../types/subscription';
import { useDocumentMeta } from '../utils/cafeHelpers';

export function AccountPage() {
  const navigate = useNavigate();
  const { settings, locations } = useCms();
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

  useEffect(() => {
    if (!loading && !authenticated) {
      navigate('/login?next=/account', { replace: true });
    }
  }, [loading, authenticated, navigate]);

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditPhone(user.phone || '');
    }
  }, [user]);

  const loadBillingHistory = async () => {
    try {
      const res = await fetch('/api/billing/history', {
        credentials: 'include',
        headers: getUserSessionHeaders(),
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

  useEffect(() => {
    if (authenticated) {
      void loadBillingHistory();
    }
  }, [authenticated, tier]);

  // Personalized recommendations based on user's saved cafe localities or top verified picks
  const recommendedCafes = useMemo(() => {
    const savedKeys = new Set(savedCafes.map((s) => s.cafe_key));
    const preferredAreas = new Set(savedCafes.map((s) => s.snapshot.area.toLowerCase()));

    return locations
      .map((l) => getEffectiveLocation(l))
      .filter((l) => !savedKeys.has(l.slug))
      .sort((a, b) => {
        const aAreaMatch = preferredAreas.has(a.area.toLowerCase()) ? 1 : 0;
        const bAreaMatch = preferredAreas.has(b.area.toLowerCase()) ? 1 : 0;
        if (aAreaMatch !== bAreaMatch) return bAreaMatch - aAreaMatch;
        return Number(b.verified) - Number(a.verified) || (b.rating ?? 0) - (a.rating ?? 0);
      })
      .slice(0, 3);
  }, [locations, savedCafes, getEffectiveLocation]);

  if (loading || !authenticated || !user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-sm text-[#5c4e45]">
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
      const res = await fetch('/api/auth/profile', {
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
    const res = await fetch('/api/billing/cancel', {
      method: 'POST',
      credentials: 'include',
      headers: getUserSessionHeaders(),
    });
    if (res.ok) {
      applyAuthPayload((await res.json()) as AuthResponsePayload);
      await loadBillingHistory();
    }
    setBillingBusy(false);
  };

  const handleResumeSubscription = async () => {
    setBillingBusy(true);
    const res = await fetch('/api/billing/renew', {
      method: 'POST',
      credentials: 'include',
      headers: getUserSessionHeaders(),
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
      {/* Expired / Suspended Alert */}
      {(isExpired || isSuspended) && (
        <section
          role="alert"
          className={`rounded-2xl border p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isSuspended
              ? 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
              : 'bg-amber-50 border-amber-200 text-[#92400e]'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <h2 className="font-serif-display text-xl font-bold">
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
              className="shrink-0 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Renew Subscription</span>
            </button>
          )}
        </section>
      )}

      {/* Header Banner */}
      <header className="rounded-2xl bg-white border border-[#e6ddd0] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            {isSuspended ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fef2f2] text-[#991b1b] border border-[#fecaca] text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Suspended · {subscription?.plan_name || 'Subscription'}</span>
              </span>
            ) : isExpired ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-[#92400e] border border-amber-300 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Expired · {expiredPlanName || subscription?.plan_name || 'Paid Plan'}</span>
              </span>
            ) : isSubscribed && tier === 'premium' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1c1613] text-[#f59e0b] text-xs font-bold">
                <Crown className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{subscription?.plan_name || 'Cafe Desk Plus Annual'} · ₹{subscription?.price_inr ?? 499}/yr</span>
              </span>
            ) : isSubscribed ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#b45309] text-white text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{subscription?.plan_name || 'Cafe Desk Plus'} · ₹{subscription?.price_inr ?? 79}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f3ede3] text-[#1c1613] border border-[#e6ddd0] text-xs font-bold">
                Free Explorer · ₹0 Forever
              </span>
            )}

            {user.email_verified ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1b4d3e]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Email Verified</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleRequestVerification}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#b45309] hover:underline"
              >
                <MailCheck className="w-3.5 h-3.5" />
                <span>Verify Email Now</span>
              </button>
            )}
          </div>

          <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#1c1613]">
            {user.name}
          </h1>
          <p className="text-sm text-[#5c4e45]">
            {user.email}
            {user.phone ? ` · ${user.phone}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isSubscribed && (
            <button
              type="button"
              onClick={() => openCheckout(isExpired ? renewTargetPlanId : 'plus')}
              className="min-h-[42px] px-4 py-2 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors"
            >
              {isExpired ? 'Renew Subscription' : 'Upgrade to Cafe Desk Plus (₹79/mo)'}
            </button>
          )}
          <Link
            to="/locations"
            className="min-h-[42px] px-4 py-2 rounded-lg bg-[#faf7f2] border border-[#d6cbba] text-xs font-semibold text-[#1c1613] inline-flex items-center"
          >
            Explore Cafes
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="min-h-[42px] px-4 py-2 rounded-lg border border-[#e6ddd0] hover:bg-[#fef2f2] hover:text-[#991b1b] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Email Verification Prompt if Requested */}
      {!user.email_verified && (devVerifyCode || verifyError) && (
        <section className="rounded-2xl bg-[#ecfdf5] border border-[#a7f3d0] p-5 space-y-3">
          <p className="text-xs font-bold text-[#1b4d3e]">
            Confirm Email Verification · Enter code:{' '}
            {devVerifyCode && <span className="font-mono-data">{devVerifyCode}</span>}
          </p>
          {verifyError && <p className="text-xs font-semibold text-[#991b1b]">{verifyError}</p>}
          <form onSubmit={handleConfirmVerification} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={verifyCodeInput}
              onChange={(e) => setVerifyCodeInput(e.target.value)}
              placeholder="6-digit code"
              className="h-10 px-3 rounded-lg border border-[#a7f3d0] bg-white font-mono-data text-sm"
            />
            <button
              type="submit"
              className="h-10 px-4 rounded-lg bg-[#1b4d3e] text-white text-xs font-semibold"
            >
              Confirm Code
            </button>
          </form>
        </section>
      )}

      {/* Subscription Status & Profile Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rounded-2xl bg-white border border-[#e6ddd0] p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
              Subscription Management
            </h2>
            <Link to="/pricing" className="text-xs font-semibold text-[#b45309] hover:underline">
              Compare All Plans &rarr;
            </Link>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] text-xs">
            <div>
              <dt className="text-[#5c4e45]">Current Plan</dt>
              <dd className="font-bold text-sm text-[#1c1613] mt-0.5">
                {subscription?.plan_name || 'Free Explorer'}
              </dd>
            </div>
            <div>
              <dt className="text-[#5c4e45]">Billing Price</dt>
              <dd className="font-mono-data font-bold text-sm text-[#1c1613] mt-0.5">
                ₹{subscription?.price_inr ?? 0}/{tier === 'premium' ? 'yr' : 'mo'}
              </dd>
            </div>
            <div>
              <dt className="text-[#5c4e45]">Billing Status</dt>
              <dd
                className={`font-bold text-sm capitalize mt-0.5 ${
                  isSuspended || isExpired
                    ? 'text-[#991b1b]'
                    : isSubscribed
                    ? 'text-[#1b4d3e]'
                    : 'text-[#5c4e45]'
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
              <dt className="text-[#5c4e45]">
                {isExpired
                  ? 'Expired On'
                  : subscription?.status === 'cancelled'
                  ? 'Access Ends'
                  : 'Next Renewal'}
              </dt>
              <dd className="font-mono-data font-bold text-sm text-[#1c1613] mt-0.5">
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
                className="px-4 py-2 rounded-lg bg-[#faf7f2] border border-[#d6cbba] hover:border-[#b45309] text-xs font-semibold text-[#1c1613]"
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
                className="px-4 py-2 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold"
              >
                Plus Annual · Save 47% (₹499/yr)
              </button>
            )}
            {isSubscribed && tier !== 'free' && (
              <button
                type="button"
                onClick={() => openCheckout(tier)}
                className="px-4 py-2 rounded-lg bg-[#1c1613] hover:bg-[#312722] text-white text-xs font-semibold inline-flex items-center gap-1.5"
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
                className="px-4 py-2 rounded-lg border border-[#fecaca] text-[#991b1b] hover:bg-[#fef2f2] text-xs font-semibold"
              >
                Cancel Auto-Renewal
              </button>
            )}
            {isSubscribed && tier !== 'free' && subscription?.status === 'cancelled' && (
              <button
                type="button"
                disabled={billingBusy}
                onClick={handleResumeSubscription}
                className="px-4 py-2 rounded-lg bg-[#1b4d3e] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Resume Auto-Renewal</span>
              </button>
            )}
          </div>
        </section>

        <section className="lg:col-span-5 rounded-2xl bg-white border border-[#e6ddd0] p-6 space-y-5">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#1b4d3e]" />
            <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">Profile &amp; Security</h2>
          </div>

          <form onSubmit={handleUpdateName} className="space-y-3">
            <div>
              <label htmlFor="acc-name" className="block text-xs font-semibold text-[#5c4e45] mb-1">
                Full Name
              </label>
              <input
                id="acc-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm"
              />
            </div>
            <div>
              <label htmlFor="acc-phone" className="block text-xs font-semibold text-[#5c4e45] mb-1">
                Phone Number (Optional)
              </label>
              <input
                id="acc-phone"
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full h-10 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm"
              />
            </div>
            {profileErrorMsg && (
              <p className="text-xs font-semibold text-[#991b1b]">{profileErrorMsg}</p>
            )}
            {profileSavedMsg && (
              <p className="text-xs font-semibold text-[#1b4d3e]">{profileSavedMsg}</p>
            )}
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#1c1613] hover:bg-[#312722] text-white text-xs font-semibold"
            >
              Save Profile
            </button>
          </form>

          {user.auth_provider === 'email' && (
            <form onSubmit={handleUpdatePassword} className="pt-4 border-t border-[#e6ddd0] space-y-3">
              <p className="text-xs font-bold text-[#1c1613]">Change Password</p>
              <div className="space-y-2">
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  aria-label="Current password"
                  className="w-full h-9 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-xs"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (8+ chars)"
                    aria-label="New password"
                    className="w-full h-9 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-xs"
                  />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    aria-label="Confirm new password"
                    className="w-full h-9 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-xs"
                  />
                </div>
              </div>
              {passwordErrorMsg && (
                <p className="text-xs font-semibold text-[#991b1b]">{passwordErrorMsg}</p>
              )}
              {passwordSavedMsg && (
                <p className="text-xs font-semibold text-[#1b4d3e]">{passwordSavedMsg}</p>
              )}
              <button
                type="submit"
                className="px-4 py-2 rounded-lg border border-[#d6cbba] bg-[#faf7f2] hover:border-[#b45309] text-[#1c1613] text-xs font-semibold"
              >
                Update Password
              </button>
            </form>
          )}
        </section>
      </div>

      {/* Saved Cafes & Favourites (Free for All Members) + Personal Collections (Cafe Desk Plus) */}
      <section className="rounded-2xl bg-white border border-[#e6ddd0] p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#b45309]">
              Your Cafe Desk Library
            </p>
            <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#b45309] text-white text-xs font-semibold"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isExpired ? 'Renew Subscription for Collections' : 'Unlock Collections (Plus ₹79/mo)'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Saved & Favourites — Free for Everyone */}
          <div className="lg:col-span-6 space-y-3">
            <h3 className="text-sm font-bold text-[#1c1613] flex items-center gap-1.5">
              <Bookmark className="w-4 h-4 text-[#b45309]" />
              <span>Saved &amp; Favourites ({savedCafes.length})</span>
              <span className="ml-auto text-[11px] font-semibold text-[#1b4d3e]">Free Feature</span>
            </h3>
            {savedCafes.length === 0 ? (
              <p className="text-xs text-[#5c4e45] p-4 rounded-xl bg-[#faf7f2] border border-[#e6ddd0]">
                No saved cafes yet. Click Save or Favourite on any Bengaluru cafe listing.
              </p>
            ) : (
              <div className="space-y-2.5">
                {savedCafes.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/locations/${item.snapshot.slug || item.cafe_key}`}
                        className="text-sm font-bold text-[#1c1613] hover:text-[#b45309] truncate block"
                      >
                        {item.snapshot.name}
                      </Link>
                      <p className="text-xs text-[#5c4e45] truncate">
                        {item.snapshot.area} · {item.snapshot.address}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.is_favourite && (
                        <Heart className="w-4 h-4 text-[#b91c1c] fill-[#b91c1c]" />
                      )}
                      <button
                        type="button"
                        onClick={() => toggleSaveCafe(item.snapshot)}
                        aria-label={`Remove ${item.snapshot.name}`}
                        className="p-1.5 rounded-lg text-[#5c4e45] hover:text-[#991b1b]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Collections — Cafe Desk Plus */}
          <div className="lg:col-span-6 space-y-4">
            <h3 className="text-sm font-bold text-[#1c1613] flex items-center gap-1.5">
              <FolderPlus className="w-4 h-4 text-[#1b4d3e]" />
              <span>Personal Cafe Collections ({collections.length})</span>
            </h3>

            {!canUseCollections ? (
              <div className="p-5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] space-y-2.5">
                <p className="text-sm font-semibold text-[#1c1613]">
                  Organize cafes into unlimited custom lists like &ldquo;Indiranagar Deep Work&rdquo;
                  or &ldquo;Budget Chai Spots&rdquo;.
                </p>
                <p className="text-xs text-[#5c4e45]">
                  {isExpired
                    ? 'Your subscription has expired. Renew your plan to create and manage custom cafe collections.'
                    : 'Included with an active Cafe Desk subscription (from ₹79/mo).'}
                </p>
              </div>
            ) : (
              <>
                <form onSubmit={handleCreateCollection} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    placeholder="New collection (e.g. Indiranagar Deep Work)"
                    className="flex-1 h-10 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-xs"
                  />
                  <button
                    type="submit"
                    className="h-10 px-4 rounded-lg bg-[#1c1613] text-white text-xs font-semibold whitespace-nowrap"
                  >
                    Create List
                  </button>
                </form>

              <div className="space-y-3">
                {collections.map((col) => (
                  <div
                    key={col.id}
                    className="p-4 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-[#1c1613]">{col.name}</p>
                        <p className="text-[11px] text-[#5c4e45]">
                          {col.items.length} {col.items.length === 1 ? 'cafe' : 'cafes'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteCollection(col.id)}
                        className="text-xs text-[#991b1b] hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                    {col.items.length > 0 && (
                      <ul className="space-y-1 pt-1 border-t border-[#e6ddd0] text-xs">
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
                              className="text-[#5c4e45] hover:text-[#991b1b]"
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

      {/* Personalized Cafe Recommendations */}
      <section className="rounded-2xl bg-white border border-[#e6ddd0] p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#1b4d3e]">
              Personalized For You
            </p>
            <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
              Recommended Bengaluru Cafes
            </h2>
          </div>
          {!isSubscribed && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#b45309]">
              <Lock className="w-3.5 h-3.5" />
              <span>{isExpired ? 'Expired' : 'Plus ₹79'}</span>
            </span>
          )}
        </div>

        {isSubscribed ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendedCafes.map((cafe) => (
              <Link
                key={cafe.id}
                to={`/locations/${cafe.slug}`}
                className="p-4 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] hover:border-[#b45309] space-y-1.5 transition-colors"
              >
                <p className="text-xs font-semibold text-[#b45309]">{cafe.area}</p>
                <p className="font-serif-display text-lg font-bold text-[#1c1613]">{cafe.name}</p>
                <p className="text-xs text-[#5c4e45] line-clamp-2">{cafe.verdict}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] text-xs">
            <span className="text-[#5c4e45]">
              {isExpired
                ? 'Your subscription has expired. Renew to restore personalized Bengaluru cafe recommendations matched to your saved areas.'
                : 'Upgrade to Cafe Desk Plus for tailored Bengaluru cafe recommendations matched to your saved areas and work preferences.'}
            </span>
            <button
              type="button"
              onClick={() => openCheckout(isExpired ? renewTargetPlanId : 'plus')}
              className="px-3.5 py-2 rounded-lg bg-[#1c1613] text-white font-semibold"
            >
              {isExpired ? 'Renew Subscription' : 'Upgrade ₹79/mo'}
            </button>
          </div>
        )}
      </section>

      {/* Billing History & Receipts */}
      <section className="rounded-2xl bg-white border border-[#e6ddd0] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-[#b45309]" />
          <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
            Billing History &amp; Receipts
          </h2>
        </div>

        {payments.length === 0 ? (
          <p className="text-xs text-[#5c4e45]">No subscription payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#e6ddd0] text-[#5c4e45]">
                  <th className="py-2.5 pr-4">Receipt</th>
                  <th className="py-2.5 pr-4">Plan</th>
                  <th className="py-2.5 pr-4">Amount</th>
                  <th className="py-2.5 pr-4">Method</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 pr-4">Date</th>
                  <th className="py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6ddd0]">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 pr-4 font-mono-data font-semibold">{p.receipt_number}</td>
                    <td className="py-2.5 pr-4 font-semibold">{p.plan_name || p.plan_id}</td>
                    <td className="py-2.5 pr-4 font-mono-data">₹{p.amount_inr}</td>
                    <td className="py-2.5 pr-4 uppercase">{p.method}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`px-2 py-0.5 rounded font-semibold capitalize ${
                          p.status === 'paid'
                            ? 'bg-[#ecfdf5] text-[#1b4d3e]'
                            : p.status === 'refunded'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-[#fef2f2] text-[#991b1b]'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-mono-data text-[#5c4e45]">
                      {new Date(p.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-2.5 text-right">
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
        )}

        {history.length > 0 && (
          <div className="pt-4 border-t border-[#e6ddd0] space-y-2">
            <p className="text-xs font-semibold text-[#5c4e45]">Subscription Activity</p>
            <ul className="space-y-1.5 text-xs text-[#5c4e45]">
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
          className="fixed inset-0 z-50 bg-[#1c1613]/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-[#e6ddd0] p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e6ddd0] pb-3">
              <div>
                <p className="font-serif-display text-xl font-bold text-[#1c1613]">
                  {settings.brand_name} Receipt
                </p>
                <p className="text-xs font-mono-data text-[#5c4e45]">
                  {selectedReceipt.receipt_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                aria-label="Close receipt"
                className="p-1.5 rounded-lg hover:bg-[#faf7f2]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-[#5c4e45]">Billed To</dt>
                <dd className="font-semibold">{user.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#5c4e45]">Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#5c4e45]">Plan</dt>
                <dd className="font-semibold">
                  {selectedReceipt.plan_name || selectedReceipt.plan_id}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#5c4e45]">Payment Method</dt>
                <dd className="uppercase">{selectedReceipt.method}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#5c4e45]">Payment Reference</dt>
                <dd className="font-mono-data">{selectedReceipt.provider_payment_id || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#5c4e45]">Status</dt>
                <dd className="capitalize font-bold">{selectedReceipt.status}</dd>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#e6ddd0] text-sm">
                <dt className="font-bold">Total Amount</dt>
                <dd className="font-mono-data font-bold">₹{selectedReceipt.amount_inr}.00 INR</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => window.print()}
              className="w-full py-2.5 rounded-lg bg-[#1c1613] text-white text-xs font-semibold"
            >
              Print / Save PDF Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

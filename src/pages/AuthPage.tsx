import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useAuth, type AuthResponsePayload } from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import { isSupabaseConfigured, supabase, syncOwnSupabaseProfile } from '../lib/supabase';
import { useDocumentMeta } from '../utils/cafeHelpers';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
const PENDING_NEXT_KEY = 'cafedesk_pending_auth_next';

function validateEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePasswordClient(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Za-z]/.test(pw)) return 'Password must include at least one letter.';
  if (!/[0-9]/.test(pw)) return 'Password must include at least one number.';
  return null;
}

export function AuthPage() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const [searchParams] = useSearchParams();
  const { settings } = useCms();
  const {
    loading: authLoading,
    authError,
    clearAuthError,
    authenticated,
    applyAuthPayload,
    openCheckout,
  } = useAuth();

  const pathDefaultMode: AuthMode =
    routerLocation.pathname === '/signup'
      ? 'signup'
      : routerLocation.pathname === '/forgot-password'
      ? 'forgot'
      : 'login';
  const initialMode = (searchParams.get('mode') as AuthMode) || pathDefaultMode;
  const upgradeTarget = searchParams.get('upgrade');
  const rawNext = searchParams.get('next') || sessionStorage.getItem(PENDING_NEXT_KEY) || '';
  const nextPath = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/account';
  const isCafeRedirect = nextPath.startsWith('/locations/') || nextPath.startsWith('/cafe/');

  const [mode, setMode] = useState<AuthMode>(
    initialMode === 'signup' || initialMode === 'forgot' || initialMode === 'reset'
      ? initialMode
      : 'login'
  );
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [devResetHint, setDevResetHint] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [devVerifyHint, setDevVerifyHint] = useState('');
  const [needsVerificationPrompt, setNeedsVerificationPrompt] = useState(false);
  const [supabaseVerifyPending, setSupabaseVerifyPending] = useState(false);
  const [supabaseRecoveryActive, setSupabaseRecoveryActive] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const oauthReturning =
    Boolean(searchParams.get('code')) || window.location.hash.includes('access_token=');

  useDocumentMeta(
    mode === 'signup'
      ? `Create Account – ${settings.brand_name}`
      : `Sign In – ${settings.brand_name}`,
    'Sign in or create your Cafe Desk account to manage subscriptions, saved cafes, and personal collections.',
    { allowIndexing: false }
  );

  // Detect Supabase PASSWORD_RECOVERY event, OAuth errors/cancellations, or URL recovery params
  useEffect(() => {
    const hash = window.location.hash || '';
    const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
    const oauthErr = searchParams.get('error') || hashParams.get('error') || '';
    const oauthErrDesc =
      searchParams.get('error_description') || hashParams.get('error_description') || '';

    if (oauthErr || oauthErrDesc) {
      setGoogleLoading(false);
      setSubmitting(false);
      if (oauthErr === 'access_denied') {
        setError('Google sign-in was cancelled. You can try again or sign in with email.');
      } else {
        setError(oauthErrDesc || 'Google sign-in could not be completed. Please try again.');
      }
      const cleanedSearch = new URLSearchParams(searchParams);
      cleanedSearch.delete('error');
      cleanedSearch.delete('error_code');
      cleanedSearch.delete('error_description');
      const qs = cleanedSearch.toString();
      window.history.replaceState(
        null,
        '',
        `${routerLocation.pathname}${qs ? `?${qs}` : ''}`
      );
    }

    const isRecoveryParam =
      searchParams.get('type') === 'recovery' ||
      hash.includes('type=recovery') ||
      searchParams.get('mode') === 'reset';

    if (isRecoveryParam && isSupabaseConfigured) {
      setSupabaseRecoveryActive(true);
      setMode('reset');
      setNotice('Choose a new strong password for your Cafe Desk account.');
    }

    if (!isSupabaseConfigured || !supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSupabaseRecoveryActive(true);
        setMode('reset');
        setNotice('Choose a new strong password for your Cafe Desk account.');
      }
    });
    return () => subscription.unsubscribe();
  }, [searchParams, routerLocation.pathname]);

  useEffect(() => {
    const queryMode = searchParams.get('mode');
    if (supabaseRecoveryActive) return;
    if (routerLocation.pathname === '/signup' || queryMode === 'signup') {
      setMode('signup');
    } else if (routerLocation.pathname === '/forgot-password' || queryMode === 'forgot') {
      setMode('forgot');
    } else if (queryMode === 'login') {
      setMode('login');
    }
  }, [routerLocation.pathname, searchParams, supabaseRecoveryActive]);

  useEffect(() => {
    if (authError) {
      setError(authError);
      setGoogleLoading(false);
      setSubmitting(false);
      clearAuthError();
    }
  }, [authError, clearAuthError]);

  // If already logged in and not in verification prompt or recovery step, redirect cleanly
  useEffect(() => {
    if (authenticated && !needsVerificationPrompt && !supabaseRecoveryActive) {
      sessionStorage.removeItem(PENDING_NEXT_KEY);
      if (upgradeTarget === 'plus' || upgradeTarget === 'premium') {
        openCheckout(upgradeTarget);
        navigate('/pricing', { replace: true });
      } else {
        navigate(nextPath, { replace: true });
      }
    }
  }, [
    authenticated,
    needsVerificationPrompt,
    supabaseRecoveryActive,
    upgradeTarget,
    nextPath,
    navigate,
    openCheckout,
  ]);

  // Optional Google Identity Services button when VITE_GOOGLE_CLIENT_ID is configured (and Supabase is not used)
  useEffect(() => {
    if (
      !GOOGLE_CLIENT_ID ||
      isSupabaseConfigured ||
      !googleBtnRef.current ||
      (mode !== 'login' && mode !== 'signup')
    ) {
      return;
    }

    const scriptId = 'google-gsi-script';
    const initGsi = () => {
      const g = (window as unknown as {
        google?: {
          accounts?: {
            id?: {
              initialize: (opts: Record<string, unknown>) => void;
              renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
            };
          };
        };
      }).google;
      if (!g?.accounts?.id || !googleBtnRef.current) return;
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) return;
          setSubmitting(true);
          setError('');
          try {
            const res = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ idToken: response.credential }),
            });
            const data = (await res.json()) as AuthResponsePayload & { error?: string };
            if (!res.ok) {
              setError(data.error || 'Google sign-in failed.');
              setSubmitting(false);
              return;
            }
            applyAuthPayload(data);
            setSubmitting(false);
          } catch {
            setError('Failed to verify Google Sign-In.');
            setSubmitting(false);
          }
        },
      });
      googleBtnRef.current.innerHTML = '';
      g.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 340,
      });
    };

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = initGsi;
      document.body.appendChild(script);
    } else {
      initGsi();
    }
  }, [mode, applyAuthPayload]);

  const finishAuthNavigation = () => {
    sessionStorage.removeItem(PENDING_NEXT_KEY);
    if (upgradeTarget === 'plus' || upgradeTarget === 'premium') {
      openCheckout(upgradeTarget);
      navigate('/pricing', { replace: true });
    } else {
      navigate(nextPath, { replace: true });
    }
  };

  const exchangeSupabaseAccessToken = async (
    accessToken: string,
    extra?: { fullName?: string; phone?: string; eventType?: string }
  ): Promise<boolean> => {
    const res = await fetch('/api/auth/supabase-exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({ accessToken, ...(extra || {}) }),
    });
    const data = (await res.json()) as AuthResponsePayload & { error?: string };
    if (!res.ok) {
      setError(data.error || 'Could not synchronize your Cafe Desk session.');
      if (supabase) await supabase.auth.signOut().catch(() => {});
      return false;
    }
    applyAuthPayload(data);
    return true;
  };

  const handleSupabaseGoogleSignIn = async () => {
    if (submitting || googleLoading) return;
    if (!isSupabaseConfigured || !supabase) {
      setError('Google Sign-In is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your environment.');
      return;
    }
    setError('');
    setNotice('');
    clearAuthError();
    setGoogleLoading(true);
    sessionStorage.setItem(PENDING_NEXT_KEY, nextPath);
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login`,
        },
      });
      if (oauthErr) {
        setError(oauthErr.message || 'Google sign-in could not be started.');
        setGoogleLoading(false);
      }
    } catch {
      setError('Failed to start Google sign-in. Please try again.');
      setGoogleLoading(false);
    }
  };

  const handleResendSupabaseVerification = async () => {
    if (!isSupabaseConfigured || !supabase || !email) return;
    setResendingEmail(true);
    setError('');
    setNotice('');
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (resendErr) {
        setError(resendErr.message);
      } else {
        setNotice(`Verification link re-sent to ${email.trim()}. Check your inbox.`);
      }
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (mode !== 'reset' || !supabaseRecoveryActive) {
      if (!validateEmailFormat(trimmedEmail)) {
        setError('Please enter a valid email address.');
        return;
      }
    }

    if (mode === 'signup') {
      if (trimmedName.length < 2) {
        setError('Please enter your full name.');
        return;
      }
      if (trimmedPhone && trimmedPhone.replace(/\D/g, '').length < 7) {
        setError('Please enter a valid phone number or leave it blank.');
        return;
      }
      const pwErr = validatePasswordClient(password);
      if (pwErr) {
        setError(pwErr);
        return;
      }
      if (password !== confirmPassword) {
        setError('Password and confirm password do not match.');
        return;
      }
    }

    if (mode === 'reset') {
      const pwErr = validatePasswordClient(password);
      if (pwErr) {
        setError(pwErr);
        return;
      }
      if (password !== confirmPassword) {
        setError('New password and confirm password do not match.');
        return;
      }
    }

    setSubmitting(true);

    try {
      // ======================================================================
      // SUPABASE AUTH FLOW (when VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY set)
      // ======================================================================
      if (isSupabaseConfigured && supabase) {
        if (mode === 'login') {
          const { data: sbData, error: sbErr } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });
          if (sbErr || !sbData.session) {
            const msg = sbErr?.message || 'Invalid email or password.';
            if (/email not confirmed/i.test(msg)) {
              setSupabaseVerifyPending(true);
              setError('Please verify your email address before signing in.');
            } else {
              setError(msg);
            }
            setSubmitting(false);
            return;
          }
          await syncOwnSupabaseProfile({
            id: sbData.user.id,
            email: sbData.user.email || trimmedEmail,
          });
          const ok = await exchangeSupabaseAccessToken(sbData.session.access_token, {
            eventType: 'login',
          });
          setSubmitting(false);
          if (ok) finishAuthNavigation();
          return;
        }

        if (mode === 'signup') {
          const { data: sbData, error: sbErr } = await supabase.auth.signUp({
            email: trimmedEmail,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}`,
              data: {
                full_name: trimmedName,
                phone: trimmedPhone,
              },
            },
          });
          if (sbErr) {
            if (/already registered/i.test(sbErr.message)) {
              setError('An account with this email already exists. Please sign in.');
            } else {
              setError(sbErr.message);
            }
            setSubmitting(false);
            return;
          }

          // Supabase returns empty identities when duplicate signup protection is enabled
          if (sbData.user && Array.isArray(sbData.user.identities) && sbData.user.identities.length === 0) {
            setError('An account with this email already exists. Please sign in.');
            setSubmitting(false);
            return;
          }

          if (sbData.session?.access_token && sbData.user) {
            await syncOwnSupabaseProfile({
              id: sbData.user.id,
              fullName: trimmedName,
              email: trimmedEmail,
              phone: trimmedPhone,
            });
            const ok = await exchangeSupabaseAccessToken(sbData.session.access_token, {
              fullName: trimmedName,
              phone: trimmedPhone,
              eventType: 'signup',
            });
            setSubmitting(false);
            if (ok) finishAuthNavigation();
            return;
          }

          // Email verification enabled in Supabase -> show verification confirmation card
          setSupabaseVerifyPending(true);
          setSubmitting(false);
          return;
        }

        if (mode === 'forgot') {
          const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
            redirectTo: `${window.location.origin}/login?mode=reset&next=${encodeURIComponent(nextPath)}`,
          });
          if (resetErr) {
            setError(resetErr.message);
            setSubmitting(false);
            return;
          }
          setNotice(
            `Password reset instructions sent to ${trimmedEmail}. Open the link in your email to set a new password.`
          );
          setSubmitting(false);
          return;
        }

        if (mode === 'reset' && supabaseRecoveryActive) {
          const { data: updData, error: updErr } = await supabase.auth.updateUser({
            password,
          });
          if (updErr) {
            setError(updErr.message || 'Unable to update password.');
            setSubmitting(false);
            return;
          }
          setSupabaseRecoveryActive(false);
          setPassword('');
          setConfirmPassword('');
          const { data: sessData } = await supabase.auth.getSession();
          if (sessData.session?.access_token && updData.user) {
            const ok = await exchangeSupabaseAccessToken(sessData.session.access_token, {
              eventType: 'password_reset',
            });
            setSubmitting(false);
            if (ok) finishAuthNavigation();
            return;
          }
          setNotice('Password updated successfully. Sign in with your new password.');
          setMode('login');
          setSubmitting(false);
          return;
        }
      }

      // ======================================================================
      // BUILT-IN CAFE DESK SESSION FALLBACK (when Supabase env is unset)
      // ======================================================================
      if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: trimmedEmail, password }),
        });
        const data = (await res.json()) as AuthResponsePayload & { error?: string };
        if (!res.ok) {
          setError(data.error || 'Invalid email or password.');
          setSubmitting(false);
          return;
        }
        applyAuthPayload(data);
        setSubmitting(false);
        finishAuthNavigation();
        return;
      }

      if (mode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: trimmedName,
            phone: trimmedPhone,
            email: trimmedEmail,
            password,
            confirmPassword,
          }),
        });
        const data = (await res.json()) as AuthResponsePayload & {
          error?: string;
          devVerificationCode?: string;
        };
        if (!res.ok) {
          setError(data.error || 'Could not create account.');
          setSubmitting(false);
          return;
        }
        applyAuthPayload(data);
        setDevVerifyHint(data.devVerificationCode || '');
        setNeedsVerificationPrompt(true);
        setSubmitting(false);
        return;
      }

      if (mode === 'forgot') {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail }),
        });
        const data = (await res.json()) as {
          error?: string;
          message?: string;
          devResetCode?: string;
        };
        if (!res.ok) {
          setError(data.error || 'Unable to process reset request.');
          setSubmitting(false);
          return;
        }
        setNotice(data.message || 'Check your email for the 6-digit password reset code.');
        setDevResetHint(data.devResetCode || '');
        setMode('reset');
        setSubmitting(false);
        return;
      }

      if (mode === 'reset') {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, code: resetCode, newPassword: password }),
        });
        const data = (await res.json()) as { error?: string; message?: string };
        if (!res.ok) {
          setError(data.error || 'Reset failed.');
          setSubmitting(false);
          return;
        }
        setNotice(data.message || 'Password updated. Sign in with your new password.');
        setPassword('');
        setConfirmPassword('');
        setResetCode('');
        setDevResetHint('');
        setMode('login');
        setSubmitting(false);
      }
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-email/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = (await res.json()) as AuthResponsePayload & { error?: string };
      if (!res.ok) {
        setError(data.error || 'Invalid verification code.');
        setSubmitting(false);
        return;
      }
      applyAuthPayload(data);
      setNeedsVerificationPrompt(false);
      setSubmitting(false);
      finishAuthNavigation();
    } catch {
      setError('Verification failed. Please retry.');
      setSubmitting(false);
    }
  };

  // Supabase Email Confirmation Pending Screen
  if (supabaseVerifyPending) {
    return (
      <div className="max-w-md mx-auto px-4 py-14">
        <div className="rounded-2xl bg-white border border-[#e6ddd0] p-7 space-y-5 shadow-sm">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1b4d3e]">
              <CheckCircle2 className="w-4 h-4" />
              <span>Check Your Inbox · Email Verification Required</span>
            </div>
            <h1 className="font-serif-display text-2xl font-bold text-[#1c1613]">
              Verify your email address
            </h1>
            <p className="text-xs text-[#5c4e45] leading-relaxed">
              We&apos;ve sent a confirmation link to <strong>{email}</strong>. Click the link in
              your inbox to activate your account and unlock your Cafe Desk workspace experience.
            </p>
          </div>

          {notice && (
            <div className="p-3 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-xs font-medium text-[#1b4d3e]">
              {notice}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs font-semibold text-[#991b1b]">
              {error}
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={resendingEmail}
              onClick={() => void handleResendSupabaseVerification()}
              className="w-full min-h-[44px] rounded-lg bg-[#b45309] hover:bg-[#92400e] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resendingEmail ? 'animate-spin' : ''}`} />
              <span>{resendingEmail ? 'Sending...' : 'Resend Verification Email'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSupabaseVerifyPending(false);
                setMode('login');
                setError('');
              }}
              className="w-full min-h-[42px] rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-xs font-semibold text-[#1c1613]"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (needsVerificationPrompt) {
    return (
      <div className="max-w-md mx-auto px-4 py-14">
        <div className="rounded-2xl bg-white border border-[#e6ddd0] p-7 space-y-5 shadow-sm">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1b4d3e]">
              <CheckCircle2 className="w-4 h-4" />
              <span>Account Created · Free Explorer Plan Active</span>
            </div>
            <h1 className="font-serif-display text-2xl font-bold text-[#1c1613]">
              Verify your email address
            </h1>
            <p className="text-xs text-[#5c4e45] leading-relaxed">
              Enter the 6-digit verification code sent to <strong>{email}</strong> to secure your
              account.
            </p>
          </div>

          {devVerifyHint && (
            <div className="p-3 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-xs text-[#1b4d3e]">
              Verification code: <strong className="font-mono-data">{devVerifyHint}</strong>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs font-semibold text-[#991b1b]">
              {error}
            </div>
          )}

          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <div>
              <label htmlFor="verify-code" className="block text-xs font-semibold text-[#5c4e45] mb-1">
                6-Digit Verification Code
              </label>
              <input
                id="verify-code"
                type="text"
                required
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="123456"
                className="w-full h-11 px-3.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] font-mono-data text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-sm font-semibold"
            >
              {submitting ? 'Verifying...' : 'Verify Email & Continue'}
            </button>

            <button
              type="button"
              onClick={() => {
                setNeedsVerificationPrompt(false);
                finishAuthNavigation();
              }}
              className="w-full text-xs font-semibold text-[#5c4e45] hover:text-[#1c1613] underline underline-offset-4"
            >
              Skip for now and verify later in Account
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12 sm:py-16">
      <div className="rounded-2xl bg-white border border-[#e6ddd0] p-7 sm:p-8 space-y-6 shadow-sm">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
            {settings.brand_name} Member Access
          </p>
          <h1 className="font-serif-display text-3xl font-bold text-[#1c1613] leading-tight">
            {mode === 'forgot'
              ? 'Reset password'
              : mode === 'reset'
              ? 'Set new password'
              : isCafeRedirect
              ? 'Discover your perfect workspace.'
              : mode === 'signup'
              ? 'Create your account'
              : 'Welcome back'}
          </h1>
          <p className="text-xs sm:text-sm text-[#5c4e45] leading-relaxed">
            {mode === 'forgot' || mode === 'reset'
              ? 'Recover access to your Cafe Desk account cleanly.'
              : isCafeRedirect
              ? 'Sign in to explore cafe details, workspace availability, membership plans, menus, amenities, and booking options.'
              : mode === 'signup'
              ? 'Every new account includes Free Explorer (₹0/month) automatically.'
              : 'Access your Bengaluru cafe plans, saved cafes, and personal collections.'}
          </p>
        </div>

        {/* Mode Switcher */}
        {(mode === 'login' || mode === 'signup') && (
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[#f3ede3] border border-[#e6ddd0]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setNotice('');
              }}
              className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                mode === 'login' ? 'bg-white text-[#1c1613] shadow-sm' : 'text-[#5c4e45]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
                setNotice('');
              }}
              className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                mode === 'signup' ? 'bg-white text-[#1c1613] shadow-sm' : 'text-[#5c4e45]'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {notice && (
          <div className="p-3 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-xs font-medium text-[#1b4d3e]">
            {notice}
          </div>
        )}

        {devResetHint && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            Password reset code: <strong className="font-mono-data">{devResetHint}</strong>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs font-semibold text-[#991b1b] flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <div>
                <label htmlFor="auth-name" className="block text-xs font-semibold text-[#5c4e45] mb-1">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ananya Rao"
                  className="w-full h-11 px-3.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
                />
              </div>

              <div>
                <label htmlFor="auth-phone" className="block text-xs font-semibold text-[#5c4e45] mb-1">
                  Phone Number <span className="font-normal text-[#78685c]">(Optional)</span>
                </label>
                <div className="relative">
                  <Phone
                    className="w-4 h-4 text-[#5c4e45] absolute left-3.5 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    id="auth-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full h-11 pl-10 pr-3.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
                  />
                </div>
              </div>
            </>
          )}

          {!(mode === 'reset' && supabaseRecoveryActive) && (
            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-[#5c4e45] mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="w-4 h-4 text-[#5c4e45] absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-11 pl-10 pr-3.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
                />
              </div>
            </div>
          )}

          {mode === 'reset' && !supabaseRecoveryActive && (
            <div>
              <label htmlFor="auth-code" className="block text-xs font-semibold text-[#5c4e45] mb-1">
                6-Digit Reset Code
              </label>
              <input
                id="auth-code"
                type="text"
                required
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                placeholder="123456"
                className="w-full h-11 px-3.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] font-mono-data text-sm"
              />
            </div>
          )}

          {mode !== 'forgot' && (
            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold text-[#5c4e45] mb-1"
              >
                {mode === 'reset' ? 'New Password' : 'Password'}
              </label>
              <div className="relative">
                <KeyRound
                  className="w-4 h-4 text-[#5c4e45] absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id="auth-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars with letters & numbers"
                  className="w-full h-11 pl-10 pr-3.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
                />
              </div>
            </div>
          )}

          {(mode === 'signup' || mode === 'reset') && (
            <div>
              <label
                htmlFor="auth-confirm-password"
                className="block text-xs font-semibold text-[#5c4e45] mb-1"
              >
                {mode === 'reset' ? 'Confirm New Password' : 'Confirm Password'}
              </label>
              <div className="relative">
                <KeyRound
                  className="w-4 h-4 text-[#5c4e45] absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id="auth-confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full h-11 pl-10 pr-3.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || googleLoading || (authLoading && oauthReturning)}
            className="w-full min-h-[46px] px-5 py-2.5 rounded-lg bg-[#b45309] hover:bg-[#92400e] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'signup' ? (
              <UserPlus className="w-4 h-4" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            <span>
              {mode === 'login'
                ? 'Sign In'
                : mode === 'signup'
                ? 'Create Account'
                : mode === 'forgot'
                ? isSupabaseConfigured
                  ? 'Send Reset Link'
                  : 'Send Reset Code'
                : 'Update Password'}
            </span>
          </button>
        </form>

        {/* Google OAuth via Supabase (visible on both Login and Register views) */}
        {(mode === 'login' || mode === 'signup') && (
          <div className="space-y-4 pt-1">
            <div className="relative flex items-center justify-center" aria-hidden="true">
              <div className="w-full border-t border-[#e6ddd0]" />
              <span className="px-3 bg-white text-[11px] font-semibold uppercase tracking-[0.14em] text-[#78685c] whitespace-nowrap">
                OR CONTINUE WITH
              </span>
              <div className="w-full border-t border-[#e6ddd0]" />
            </div>

            {!isSupabaseConfigured && GOOGLE_CLIENT_ID ? (
              <div ref={googleBtnRef} className="flex justify-center" />
            ) : (
              <button
                type="button"
                disabled={submitting || googleLoading || (authLoading && oauthReturning)}
                onClick={() => void handleSupabaseGoogleSignIn()}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-[#d6cbba] bg-white hover:bg-[#faf7f2] hover:border-[#b45309]/50 active:bg-[#f3ede3] active:scale-[0.99] shadow-sm hover:shadow disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold text-[#1c1613] inline-flex items-center justify-center gap-3 transition-all"
              >
                {googleLoading || (authLoading && oauthReturning) ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-[#b45309] shrink-0" aria-hidden="true" />
                    <span>
                      {authLoading && oauthReturning
                        ? 'Completing Google sign-in...'
                        : 'Connecting to Google...'}
                    </span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#EA4335"
                        d="M12 10.2v3.9h5.4c-.2 1.2-.9 2.3-2 3l3.2 2.5c1.9-1.7 3-4.3 3-7.4 0-.7-.1-1.4-.2-2H12z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 21c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.9-1.8-5.7-4.2H3v2.6C4.6 18.7 8 21 12 21z"
                      />
                      <path
                        fill="#4A90E2"
                        d="M6.3 12.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V6.6H3C2.4 7.9 2 9.4 2 11s.4 3.1 1 4.4l3.3-2.6z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M12 5.1c1.5 0 2.8.5 3.9 1.5l2.9-2.9C17 2 14.7 1 12 1 8 1 4.6 3.3 3 6.6l3.3 2.6c.8-2.4 3.1-4.1 5.7-4.1z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-[#e6ddd0] flex flex-wrap items-center justify-between gap-2 text-xs text-[#5c4e45]">
          {mode === 'login' ? (
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setError('');
                setNotice('');
              }}
              className="font-semibold text-[#b45309] hover:underline"
            >
              Forgot password?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setSupabaseRecoveryActive(false);
                setError('');
                setNotice('');
              }}
              className="font-semibold text-[#b45309] hover:underline"
            >
              Back to Sign In
            </button>
          )}
          <Link to="/pricing" className="inline-flex items-center gap-1 hover:text-[#1c1613]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1b4d3e]" />
            <span>View Plans</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

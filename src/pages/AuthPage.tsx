import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useAuth, type AuthResponsePayload } from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import { useDocumentMeta } from '../utils/cafeHelpers';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings } = useCms();
  const { authenticated, applyAuthPayload, openCheckout } = useAuth();

  const initialMode = (searchParams.get('mode') as AuthMode) || 'login';
  const upgradeTarget = searchParams.get('upgrade');
  const nextPath = searchParams.get('next') || '/account';

  const [mode, setMode] = useState<AuthMode>(
    initialMode === 'signup' || initialMode === 'forgot' || initialMode === 'reset'
      ? initialMode
      : 'login'
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [devResetHint, setDevResetHint] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [devVerifyHint, setDevVerifyHint] = useState('');
  const [needsVerificationPrompt, setNeedsVerificationPrompt] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useDocumentMeta(
    mode === 'signup'
      ? `Create Account – ${settings.brand_name}`
      : `Sign In – ${settings.brand_name}`,
    'Sign in or create your Cafe Desk account to manage subscriptions, saved cafes, and personal collections.',
    { allowIndexing: false }
  );

  // If already logged in and not in verification prompt step, redirect cleanly
  useEffect(() => {
    if (authenticated && !needsVerificationPrompt) {
      if (upgradeTarget === 'plus' || upgradeTarget === 'premium') {
        openCheckout(upgradeTarget);
        navigate('/pricing', { replace: true });
      } else {
        navigate(nextPath, { replace: true });
      }
    }
  }, [authenticated, needsVerificationPrompt, upgradeTarget, nextPath, navigate, openCheckout]);

  // Optional Google Identity Services button when VITE_GOOGLE_CLIENT_ID is configured
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current || (mode !== 'login' && mode !== 'signup')) {
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
    if (upgradeTarget === 'plus' || upgradeTarget === 'premium') {
      openCheckout(upgradeTarget);
      navigate('/pricing', { replace: true });
    } else {
      navigate(nextPath, { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
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
          body: JSON.stringify({ name, email, password }),
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
          body: JSON.stringify({ email }),
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
          body: JSON.stringify({ email, code: resetCode, newPassword: password }),
        });
        const data = (await res.json()) as { error?: string; message?: string };
        if (!res.ok) {
          setError(data.error || 'Reset failed.');
          setSubmitting(false);
          return;
        }
        setNotice(data.message || 'Password updated. Sign in with your new password.');
        setPassword('');
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
        <div className="space-y-1.5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
            {settings.brand_name} Member Access
          </p>
          <h1 className="font-serif-display text-3xl font-bold text-[#1c1613]">
            {mode === 'login'
              ? 'Welcome back'
              : mode === 'signup'
              ? 'Create your account'
              : mode === 'forgot'
              ? 'Reset password'
              : 'Set new password'}
          </h1>
          <p className="text-xs text-[#5c4e45]">
            {mode === 'signup'
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
              }}
              className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                mode === 'signup' ? 'bg-white text-[#1c1613] shadow-sm' : 'text-[#5c4e45]'
              }`}
            >
              Sign Up Free
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
          )}

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

          {mode === 'reset' && (
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

          <button
            type="submit"
            disabled={submitting}
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
                ? 'Create Free Account'
                : mode === 'forgot'
                ? 'Send Reset Code'
                : 'Update Password'}
            </span>
          </button>
        </form>

        {/* Optional Google Sign-In when configured */}
        {GOOGLE_CLIENT_ID && (mode === 'login' || mode === 'signup') && (
          <div className="space-y-3 pt-2 border-t border-[#e6ddd0]">
            <p className="text-[11px] font-semibold text-center uppercase tracking-wider text-[#5c4e45]">
              Or continue with Google
            </p>
            <div ref={googleBtnRef} className="flex justify-center" />
          </div>
        )}

        <div className="pt-2 border-t border-[#e6ddd0] flex flex-wrap items-center justify-between gap-2 text-xs text-[#5c4e45]">
          {mode === 'login' ? (
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setError('');
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
                setError('');
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

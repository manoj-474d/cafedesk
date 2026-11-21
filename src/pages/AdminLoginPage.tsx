import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { useDocumentMeta } from '../utils/cafeHelpers';

type AuthMode = 'checking' | 'setup' | 'login' | 'reset_req' | 'reset_confirm';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dashboardPath = location.pathname.startsWith('/admin')
    ? '/admin/dashboard'
    : '/owner/dashboard';
  useDocumentMeta('Owner Sign In – CafeDesk', 'Secure CafeDesk Owner Panel.', {
    allowIndexing: false,
  });

  const [mode, setMode] = useState<AuthMode>('checking');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/admin/status', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { setupRequired?: boolean; authenticated?: boolean }) => {
        if (!active) return;
        if (data.authenticated) {
          navigate(dashboardPath, { replace: true });
          return;
        }
        setMode(data.setupRequired ? 'setup' : 'login');
      })
      .catch(() => {
        if (active) setMode('login');
      });
    return () => {
      active = false;
    };
  }, [navigate, dashboardPath]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, email, displayName, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || 'Unable to create owner account.');
        return;
      }
      navigate(dashboardPath, { replace: true });
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username,
          password,
          totpCode: requires2FA ? totpCode : undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        requires2FA?: boolean;
        message?: string;
        error?: string;
      };
      if (data.requires2FA) {
        setRequires2FA(true);
        setInfoMsg(data.message || 'Enter the 6-digit verification code from your authenticator app.');
        return;
      }
      if (!res.ok) {
        setErrorMsg(data.error || 'Invalid credentials.');
        return;
      }
      navigate(dashboardPath, { replace: true });
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setErrorMsg(data.error || 'Unable to request password reset.');
        return;
      }
      setInfoMsg(
        data.message ||
          'If an account matches, a single-use recovery code has been logged on the server.'
      );
      setMode('reset_confirm');
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/reset-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, recoveryCode, newPassword }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setErrorMsg(data.error || 'Invalid or expired recovery code.');
        return;
      }
      setInfoMsg(data.message || 'Password updated. You may now sign in.');
      setPassword('');
      setRecoveryCode('');
      setNewPassword('');
      setMode('login');
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col justify-center px-4 py-12">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569] hover:text-[#0f172a]"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to CafeDesk website</span>
          </Link>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1b4d3e]">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>Owner Portal</span>
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-1">
            <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#0f172a]">
              {mode === 'setup'
                ? 'Initial Owner Setup'
                : mode === 'reset_req' || mode === 'reset_confirm'
                ? 'Reset Owner Password'
                : 'CafeDesk Owner Sign In'}
            </h1>
            <p className="text-sm text-[#475569]">
              {mode === 'setup'
                ? 'Create the primary Owner account to manage CafeDesk.'
                : mode === 'reset_req'
                ? 'Enter your owner username or email to generate a 15-minute server recovery code.'
                : mode === 'reset_confirm'
                ? 'Enter the single-use recovery code from your server console and choose a new password.'
                : 'Sign in with your owner username or email and password.'}
            </p>
          </div>

          {infoMsg && (
            <div
              role="status"
              className="p-3.5 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-xs font-medium text-[#1b4d3e]"
            >
              {infoMsg}
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-xs font-semibold text-[#b91c1c]"
            >
              {errorMsg}
            </div>
          )}

          {mode === 'checking' && (
            <div className="py-10 text-center text-sm text-[#64748b]">
              Verifying session status...
            </div>
          )}

          {mode === 'setup' && (
            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <label htmlFor="st-user" className="block text-xs font-semibold text-[#334155] mb-1">
                  Owner Username *
                </label>
                <input
                  id="st-user"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. cafedesk_owner"
                  className="w-full h-11 px-3.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                />
              </div>

              <div>
                <label htmlFor="st-email" className="block text-xs font-semibold text-[#334155] mb-1">
                  Owner Email (optional)
                </label>
                <input
                  id="st-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@cafedesk.space"
                  className="w-full h-11 px-3.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                />
              </div>

              <div>
                <label htmlFor="st-name" className="block text-xs font-semibold text-[#334155] mb-1">
                  Display Name
                </label>
                <input
                  id="st-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="CafeDesk Owner"
                  className="w-full h-11 px-3.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                />
              </div>

              <div>
                <label htmlFor="st-pass" className="block text-xs font-semibold text-[#334155] mb-1">
                  Strong Password *
                </label>
                <input
                  id="st-pass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 10 chars, upper, lower & number"
                  className="w-full h-11 px-3.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                />
                <p className="text-[11px] text-[#64748b] mt-1">
                  Must be ≥10 characters with uppercase, lowercase, and at least one number.
                </p>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>{busy ? 'Creating account...' : 'Create Owner & Enter'}</span>
              </button>
            </form>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              {!requires2FA ? (
                <>
                  <div>
                    <label htmlFor="lg-user" className="block text-xs font-semibold text-[#334155] mb-1">
                      Username or Email *
                    </label>
                    <input
                      id="lg-user"
                      type="text"
                      required
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username or email"
                      className="w-full h-11 px-3.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="lg-pass" className="block text-xs font-semibold text-[#334155] mb-1">
                      Password *
                    </label>
                    <input
                      id="lg-pass"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full h-11 px-3.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-3 p-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#0f172a] inline-flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                      <span>Two-Factor Verification</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRequires2FA(false);
                        setTotpCode('');
                        setErrorMsg('');
                        setInfoMsg('');
                      }}
                      className="text-[11px] font-semibold text-[#475569] hover:text-[#0f172a] underline underline-offset-2"
                    >
                      Use different account
                    </button>
                  </div>
                  <p className="text-xs text-[#64748b]">
                    Signing in as <span className="font-semibold text-[#0f172a]">{username}</span>. Enter the 6-digit code from your authenticator app.
                  </p>
                  <div>
                    <label htmlFor="lg-totp" className="block text-xs font-semibold text-[#334155] mb-1">
                      Authenticator Code (6 digits) *
                    </label>
                    <input
                      id="lg-totp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      autoFocus
                      autoComplete="one-time-code"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full h-12 px-4 rounded-lg border border-[#cbd5e1] bg-white text-center text-lg tracking-[0.35em] font-mono-data font-bold"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" aria-hidden="true" />
                <span>
                  {busy
                    ? requires2FA
                      ? 'Verifying code...'
                      : 'Signing in...'
                    : requires2FA
                    ? 'Verify & Sign In'
                    : 'Sign In to Owner Panel'}
                </span>
              </button>

              {!requires2FA && (
                <div className="text-right pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setInfoMsg('');
                      setRequires2FA(false);
                      setTotpCode('');
                      setMode('reset_req');
                    }}
                    className="text-xs font-semibold text-[#475569] hover:text-[#0f172a] underline underline-offset-4"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </form>
          )}

          {mode === 'reset_req' && (
            <form onSubmit={handleResetRequest} className="space-y-4">
              <div>
                <label htmlFor="rs-user" className="block text-xs font-semibold text-[#334155] mb-1">
                  Username or Email *
                </label>
                <input
                  id="rs-user"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter owner username or email"
                  className="w-full h-11 px-3.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#0f172a] text-white text-sm font-semibold"
              >
                {busy ? 'Requesting...' : 'Generate Recovery Code'}
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-xs font-semibold text-[#475569] hover:text-[#0f172a]"
              >
                Back to sign in
              </button>
            </form>
          )}

          {mode === 'reset_confirm' && (
            <form onSubmit={handleResetConfirm} className="space-y-4">
              <div>
                <label htmlFor="rc-code" className="block text-xs font-semibold text-[#334155] mb-1">
                  Server Recovery Code *
                </label>
                <input
                  id="rc-code"
                  type="text"
                  required
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="12-character code from server log"
                  className="w-full h-11 px-3.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm font-mono-data uppercase"
                />
              </div>
              <div>
                <label htmlFor="rc-pass" className="block text-xs font-semibold text-[#334155] mb-1">
                  New Strong Password *
                </label>
                <input
                  id="rc-pass"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 10 chars, upper, lower & number"
                  className="w-full h-11 px-3.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#0f172a] text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" aria-hidden="true" />
                <span>{busy ? 'Updating...' : 'Update Password'}</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-xs font-semibold text-[#475569] hover:text-[#0f172a]"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

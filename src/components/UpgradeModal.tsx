import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Heart, Lock, RefreshCw, Sparkles, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function UpgradeModal() {
  const navigate = useNavigate();
  const {
    upgradePrompt,
    closeUpgradeModal,
    plans,
    authenticated,
    isExpired,
    isSuspended,
    expiredPlanName,
    subscription,
    openCheckout,
  } = useAuth();

  if (!upgradePrompt) return null;

  if (upgradePrompt.freeSignInOnly) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        className="fixed inset-0 z-50 bg-[#1c1613]/75 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={closeUpgradeModal}
      >
        <div
          className="w-full max-w-md rounded-2xl bg-[#faf7f2] border border-[#e6ddd0] shadow-2xl overflow-hidden text-[#1c1613]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 bg-[#1c1613] text-[#faf7f2] flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#1b4d3e] text-white text-[11px] font-bold uppercase tracking-wider">
                <Heart className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Free Explorer Feature</span>
              </div>
              <h2 id="upgrade-modal-title" className="font-serif-display text-2xl font-bold text-white">
                Sign in free to {upgradePrompt.featureName}
              </h2>
            </div>

            <button
              type="button"
              onClick={closeUpgradeModal}
              aria-label="Close modal"
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <p className="text-sm text-[#5c4e45] leading-relaxed">
              {upgradePrompt.description ||
                'Saving & favouriting Bengaluru cafes is 100% free. Create a free account or sign in so your saved spots sync across every visit.'}
            </p>

            <div className="space-y-2.5">
              <Link
                to="/login?mode=signup"
                onClick={closeUpgradeModal}
                className="w-full min-h-[46px] px-5 py-2.5 rounded-lg bg-[#1b4d3e] hover:bg-[#163f33] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span>Create Free Account</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link
                to="/login?mode=login"
                onClick={closeUpgradeModal}
                className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-white border border-[#d6cbba] hover:bg-[#f3ede3] text-[#1c1613] text-xs font-semibold inline-flex items-center justify-center transition-colors"
              >
                Already have an account? Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const plusMonthly = plans.find((p) => p.id === 'plus');
  const plusAnnual = plans.find((p) => p.id === 'premium');
  const monthlyPrice = plusMonthly?.price_inr ?? 79;
  const annualPrice = plusAnnual?.price_inr ?? 499;
  const renewPlanId = subscription?.expired_from_plan || 'plus';

  const handleCheckoutOrSignup = (planKey: string) => {
    closeUpgradeModal();
    if (authenticated) {
      openCheckout(planKey);
    } else {
      navigate(`/login?mode=signup&upgrade=${encodeURIComponent(planKey)}`);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      className="fixed inset-0 z-50 bg-[#1c1613]/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={closeUpgradeModal}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#faf7f2] border border-[#e6ddd0] shadow-2xl overflow-hidden text-[#1c1613]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 bg-[#1c1613] text-[#faf7f2] flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-white text-[11px] font-bold uppercase tracking-wider ${
                isSuspended
                  ? 'bg-[#991b1b]'
                  : isExpired
                  ? 'bg-[#d97706]'
                  : 'bg-[#b45309]'
              }`}
            >
              {isExpired || isSuspended ? (
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>
                {isSuspended
                  ? 'Subscription Suspended'
                  : isExpired
                  ? 'Subscription Expired'
                  : 'Cafe Desk Plus'}
              </span>
            </div>
            <h2 id="upgrade-modal-title" className="font-serif-display text-2xl font-bold text-white">
              {isSuspended
                ? 'Subscription Access Paused'
                : isExpired
                ? 'Renew Your Cafe Desk Subscription'
                : `Unlock ${upgradePrompt.featureName}`}
            </h2>
          </div>

          <button
            type="button"
            onClick={closeUpgradeModal}
            aria-label="Close upgrade prompt"
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-[#e6ddd0]">
            <Lock className="w-5 h-5 text-[#b45309] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-[#1c1613]">
                {isSuspended
                  ? 'Your paid subscription is currently suspended'
                  : isExpired
                  ? `Your ${expiredPlanName || 'Cafe Desk subscription'} has expired`
                  : `Included in Cafe Desk Plus — ₹${monthlyPrice}/month or ₹${annualPrice}/year`}
              </p>
              <p className="text-xs text-[#5c4e45] leading-relaxed">
                {isSuspended
                  ? 'Protected cafe details and booking access are temporarily disabled. Please review your account or contact support.'
                  : isExpired
                  ? `Renew your subscription to restore ${upgradePrompt.featureName.toLowerCase()}, Wi-Fi passwords, power sockets, complete menus, and bookings.`
                  : upgradePrompt.description ||
                    `An active paid subscription is required to access ${upgradePrompt.featureName.toLowerCase()}, Wi-Fi details, sockets, menus, pricing, and workspace booking.`}
              </p>
            </div>
          </div>

          <ul className="space-y-2 text-xs text-[#1c1613]">
            {(plusMonthly?.features ?? [
              'Complete coffee, tea, snacks & meal prices + budget per person',
              'Verified Wi-Fi speeds, passwords, socket availability & workspace details',
              'Side-by-side cafe comparison & custom personal collections',
              'Workspace seat bookings & exclusive subscriber perks',
            ])
              .slice(0, 5)
              .map((feat) => (
                <li key={feat} className="flex items-start gap-2">
                  <CheckCircle2
                    className="w-4 h-4 text-[#1b4d3e] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{feat}</span>
                </li>
              ))}
          </ul>

          <div className="space-y-2.5 pt-1">
            {isExpired ? (
              <button
                type="button"
                onClick={() => handleCheckoutOrSignup(renewPlanId)}
                className="w-full min-h-[46px] px-5 py-2.5 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                <span>Renew Now</span>
              </button>
            ) : !isSuspended ? (
              <button
                type="button"
                onClick={() => handleCheckoutOrSignup('plus')}
                className="w-full min-h-[46px] px-5 py-2.5 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span>
                  {authenticated
                    ? `Subscribe Now — Plus (₹${monthlyPrice}/mo)`
                    : `Sign in & Subscribe (₹${monthlyPrice}/mo)`}
                </span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : null}

            {!isSuspended && (
              <button
                type="button"
                onClick={() => handleCheckoutOrSignup('premium')}
                className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-[#1c1613] hover:bg-[#312722] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span>Or Save 47% with Annual Plus (₹{annualPrice}/year)</span>
              </button>
            )}

            <Link
              to="/pricing"
              onClick={closeUpgradeModal}
              className="w-full min-h-[38px] px-4 py-2 rounded-lg bg-white border border-[#d6cbba] hover:bg-[#f3ede3] text-[#1c1613] text-xs font-semibold inline-flex items-center justify-center transition-colors"
            >
              View Plans &amp; Permissions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


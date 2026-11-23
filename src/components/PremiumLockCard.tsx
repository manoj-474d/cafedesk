import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Crown, Lock, LogIn, RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { CafeAccessInfo } from '../types/cms';

interface PremiumLockCardProps {
  title: string;
  description?: string;
  previewHints?: string[];
  lockReason?: CafeAccessInfo['lockReason'];
  allowedPlanIds?: string[];
  compact?: boolean;
}

export function PremiumLockCard({
  title,
  description,
  previewHints = [],
  lockReason,
  allowedPlanIds = [],
  compact = false,
}: PremiumLockCardProps) {
  const location = useLocation();
  const {
    authenticated,
    isExpired,
    isSuspended,
    expiredPlanName,
    plans,
    subscription,
    openCheckout,
  } = useAuth();

  const resolvedReason =
    lockReason && lockReason !== 'none'
      ? lockReason
      : !authenticated
      ? 'guest'
      : isSuspended
      ? 'suspended'
      : isExpired
      ? 'expired'
      : 'no_subscription';

  const defaultPaidPlan =
    plans.find((p) => p.id !== 'free' && p.active && p.is_recommended) ||
    plans.find((p) => p.id !== 'free' && p.active);

  const renewTargetPlanId =
    (subscription?.expired_from_plan &&
    plans.some((p) => p.id === subscription.expired_from_plan && p.active)
      ? subscription.expired_from_plan
      : defaultPaidPlan?.id) || 'plus';

  const restrictedPlanNames = allowedPlanIds
    .map((pid) => plans.find((p) => p.id === pid)?.name || pid)
    .filter(Boolean);

  const loginUrl = `/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${
        resolvedReason === 'expired'
          ? 'border-[#fecaca] bg-[#fffaf9]'
          : resolvedReason === 'suspended'
          ? 'border-[#fed7aa] bg-[#fffaf5]'
          : 'border-[#e6ddd0] bg-[#fcfaf6]'
      } ${compact ? 'p-4' : 'p-6'}`}
    >
      {/* Decorative blurred teaser bars (zero sensitive data rendered) */}
      {!compact && (
        <div
          aria-hidden="true"
          className="mb-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5 select-none pointer-events-none opacity-60 blur-[3px]"
        >
          <div className="h-9 rounded-lg bg-[#ede5d8]" />
          <div className="h-9 rounded-lg bg-[#e6ddd0]" />
          <div className="hidden sm:block h-9 rounded-lg bg-[#ede5d8]" />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#1c1613] text-[#faf7f2]">
            {resolvedReason === 'expired' ? (
              <>
                <AlertTriangle className="w-3 h-3 text-[#f59e0b]" aria-hidden="true" />
                <span>Subscription Expired</span>
              </>
            ) : resolvedReason === 'suspended' ? (
              <>
                <AlertTriangle className="w-3 h-3 text-[#f59e0b]" aria-hidden="true" />
                <span>Subscription Suspended</span>
              </>
            ) : (
              <>
                <Lock className="w-3 h-3 text-[#f59e0b]" aria-hidden="true" />
                <span>Subscribers Only</span>
              </>
            )}
          </div>

          <h3 className="font-serif-display text-lg sm:text-xl font-bold text-[#1c1613]">
            {title}
          </h3>

          <p className="text-xs sm:text-sm text-[#5c4e45] leading-relaxed">
            {resolvedReason === 'expired' ? (
              <>
                Your subscription{expiredPlanName ? ` (${expiredPlanName})` : ''} has expired. Renew
                your plan to immediately restore access to Wi-Fi details, socket info, food menus,
                and pricing.
              </>
            ) : resolvedReason === 'suspended' ? (
              'Your subscription access is currently suspended. Please contact our support team to restore your membership.'
            ) : resolvedReason === 'plan_restricted' && restrictedPlanNames.length > 0 ? (
              `This section requires ${restrictedPlanNames.join(' or ')}. Upgrade your active plan to unlock.`
            ) : resolvedReason === 'guest' ? (
              description ||
              'Sign in and activate a Cafe Desk subscription to unlock verified Wi-Fi speeds, socket locations, full food & beverage pricing, and booking.'
            ) : (
              description ||
              'You are signed in on the Free Explorer tier. Subscribe to a Cafe Desk Plus plan to unlock this section.'
            )}
          </p>

          {previewHints.length > 0 && (
            <ul className="pt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5c4e45]">
              {previewHints.map((hint) => (
                <li key={hint} className="inline-flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#b45309] shrink-0" aria-hidden="true" />
                  <span>{hint}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {resolvedReason === 'expired' ? (
            <>
              <button
                type="button"
                onClick={() => openCheckout(renewTargetPlanId)}
                className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs sm:text-sm font-semibold transition-colors"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                <span>Renew Subscription</span>
              </button>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center min-h-[42px] px-3.5 py-2 rounded-lg border border-[#d6cbba] bg-white hover:bg-[#f3ede3] text-xs font-semibold text-[#1c1613]"
              >
                Compare Plans
              </Link>
            </>
          ) : resolvedReason === 'suspended' ? (
            <Link
              to="/contact"
              className="inline-flex items-center justify-center min-h-[42px] px-4 py-2 rounded-lg bg-[#1c1613] hover:bg-[#332924] text-white text-xs sm:text-sm font-semibold"
            >
              Contact Support
            </Link>
          ) : resolvedReason === 'guest' ? (
            <>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs sm:text-sm font-semibold transition-colors"
              >
                <Crown className="w-4 h-4" aria-hidden="true" />
                <span>View Plans</span>
              </Link>
              <Link
                to={loginUrl}
                className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-lg border border-[#d6cbba] bg-white hover:bg-[#f3ede3] text-xs font-semibold text-[#1c1613]"
              >
                <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sign In</span>
              </Link>
            </>
          ) : (
            <>
              {defaultPaidPlan && (
                <button
                  type="button"
                  onClick={() => openCheckout(defaultPaidPlan.id)}
                  className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs sm:text-sm font-semibold transition-colors"
                >
                  <Crown className="w-4 h-4" aria-hidden="true" />
                  <span>Unlock · ₹{defaultPaidPlan.price_inr}</span>
                </button>
              )}
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center min-h-[42px] px-3.5 py-2 rounded-lg border border-[#d6cbba] bg-white hover:bg-[#f3ede3] text-xs font-semibold text-[#1c1613]"
              >
                View All Plans
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

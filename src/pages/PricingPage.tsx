import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Crown,
  Minus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import { useDocumentMeta } from '../utils/cafeHelpers';

const COMPARISON_ROWS: Array<{
  label: string;
  free: boolean | string;
  plus: boolean | string;
}> = [
  {
    label: 'Search all Bengaluru cafes & live Google Maps autocomplete',
    free: true,
    plus: true,
  },
  {
    label: 'Nearby GPS distance, photos, addresses & Google Maps directions',
    free: true,
    plus: true,
  },
  {
    label: 'Interactive Cafe Finder (Purpose, Locality, Vibe & Quick Presets)',
    free: true,
    plus: true,
  },
  {
    label: 'Laptop-friendly status, seating, studying, noise level, sockets & ambience',
    free: true,
    plus: true,
  },
  {
    label: 'Browse curated Bengaluru collections & Cafe of the Day',
    free: true,
    plus: true,
  },
  {
    label: 'Save & bookmark favourite Bengaluru cafes',
    free: true,
    plus: true,
  },
  {
    label: 'Complete coffee, tea, snack & meal prices + average budget per person',
    free: 'Preview',
    plus: true,
  },
  {
    label: 'Verified Wi-Fi availability, measured speeds (Mbps) & work/meeting filters',
    free: false,
    plus: true,
  },
  {
    label: 'Advanced budget & food category filters',
    free: false,
    plus: true,
  },
  {
    label: 'Compare up to 4 Bengaluru cafes side-by-side',
    free: false,
    plus: true,
  },
  {
    label: 'Unlimited personal custom cafe collections & personalized recommendations',
    free: false,
    plus: true,
  },
  {
    label: 'Exclusive cafe deals, partner perks & student discounts',
    free: false,
    plus: true,
  },
];

function formatIntervalLabel(priceInr: number, intervalDays: number): string {
  if (priceInr <= 0) return '/ forever';
  if (intervalDays === 1) return '/ day';
  if (intervalDays === 7) return '/ week';
  if (intervalDays === 30) return '/ month';
  if (intervalDays === 365) return '/ year';
  return `/ ${intervalDays} days`;
}

export function PricingPage() {
  const navigate = useNavigate();
  const { settings } = useCms();
  const {
    authenticated,
    tier,
    subscription,
    isSubscribed,
    isExpired,
    isSuspended,
    expiredPlanName,
    plans,
    openCheckout,
  } = useAuth();

  const currencySymbol = settings.currency_symbol || '₹';
  const activePlans = plans.filter((p) => p.active);

  const plusMonthly = plans.find((p) => p.id === 'plus');
  const plusAnnual = plans.find((p) => p.id === 'premium');
  const monthlyPrice = plusMonthly?.price_inr ?? 79;
  const annualPrice = plusAnnual?.price_inr ?? 499;

  useDocumentMeta(
    `Plans & Pricing – ${settings.brand_name}`,
    `Explore Bengaluru cafes free forever, or upgrade to Cafe Desk memberships (${currencySymbol}${monthlyPrice}/mo or ${currencySymbol}${annualPrice}/year) for full menus, prices, budget filters, comparisons, and exclusive deals.`,
    { allowIndexing: true }
  );

  const handlePlanAction = (planId: string, priceInr: number) => {
    if (planId === 'free' || priceInr <= 0) {
      if (authenticated) navigate('/locations');
      else navigate('/login?mode=signup');
      return;
    }
    if (!authenticated) {
      navigate(`/login?mode=signup&upgrade=${encodeURIComponent(planId)}`);
      return;
    }
    openCheckout(planId);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-16 space-y-12 sm:space-y-14">
      {/* Header */}
      <header className="max-w-3xl mx-auto text-center space-y-4">
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#ecfdf5] border border-[#bbf7d0] text-xs uppercase tracking-[0.14em] font-semibold text-[#1b4d3e]">
          Simple, Transparent Memberships
        </span>
        <h1 className="font-serif-display text-3xl sm:text-5xl font-semibold text-[#1c1613] text-balance">
          {settings.pricing_headline || 'Explore Bengaluru cafes free, or unlock full menu & budget tools'}
        </h1>
        <p className="text-base sm:text-lg text-[#57493f] leading-relaxed">
          {settings.pricing_subtitle ||
            'Save favourites, check laptop readiness, seating, sockets, and noise levels free forever. Upgrade when you want full food prices, verified Wi-Fi speeds, comparisons, and deals.'}
        </p>
      </header>

      {/* Expired / Suspended Alert Banner */}
      {(isExpired || isSuspended) && (
        <div
          role="alert"
          className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isSuspended
              ? 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
              : 'bg-[#fffbeb] border-[#fde68a] text-[#92400e]'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="font-semibold text-sm">
                {isSuspended
                  ? 'Your subscription access is suspended'
                  : 'Your subscription has expired'}
              </p>
              <p className="text-xs opacity-90">
                {isSuspended
                  ? 'Paid cafe permissions are paused. Check your Account page or contact support.'
                  : `${expiredPlanName || subscription?.plan_name || 'Your previous plan'} has ended. Choose a plan below or renew immediately to restore full cafe access.`}
              </p>
            </div>
          </div>
          {isExpired && (
            <button
              type="button"
              onClick={() => openCheckout(subscription?.expired_from_plan || 'plus')}
              className="inline-flex items-center justify-center gap-2 shrink-0 min-h-[44px] px-4 py-2.5 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Renew Subscription</span>
            </button>
          )}
        </div>
      )}

      {/* Dynamic Active Membership Plans Grid */}
      <section
        aria-label="Subscription plans"
        className={`grid grid-cols-1 ${
          activePlans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'
        } gap-7 items-stretch`}
      >
        {activePlans.map((plan) => {
          const isHighlighted = Boolean(plan.is_recommended);
          const isFree = plan.id === 'free' || plan.price_inr <= 0;
          const isCurrent =
            authenticated && (isFree ? !isSubscribed : isSubscribed && tier === plan.id);
          const wasExpiredPlan = isExpired && subscription?.expired_from_plan === plan.id;
          const intervalLabel = formatIntervalLabel(plan.price_inr, plan.interval_days);

          return (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-shadow ${
                isHighlighted
                  ? 'bg-[#1c1613] text-[#faf7f2] border border-[#3a2f28] shadow-lg'
                  : 'bg-white text-[#1c1613] border border-[#e6ddd0] shadow-xs'
              }`}
            >
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                      isHighlighted
                        ? 'bg-[#b45309] text-white'
                        : isFree
                        ? 'bg-[#ecfdf5] text-[#1b4d3e] border border-[#bbf7d0]'
                        : 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]'
                    }`}
                  >
                    {isHighlighted ? (
                      plan.interval_days >= 365 ? (
                        <Crown className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      )
                    ) : null}
                    <span>{plan.badge_text || (isFree ? 'Free Forever' : 'Membership Plan')}</span>
                  </span>
                  {isCurrent && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#ecfdf5] text-[#1b4d3e] border border-[#bbf7d0] text-[11px] font-semibold">
                      Current Plan
                    </span>
                  )}
                </div>

                <div>
                  <h2 className="font-serif-display text-3xl font-semibold">{plan.name}</h2>
                  {plan.tagline && (
                    <p
                      className={`text-sm mt-1.5 leading-relaxed ${
                        isHighlighted ? 'text-[#e6ddd0]' : 'text-[#57493f]'
                      }`}
                    >
                      {plan.tagline}
                    </p>
                  )}
                </div>

                <div
                  className={`pt-4 pb-5 border-y ${
                    isHighlighted ? 'border-[#3a2f28]' : 'border-[#e6ddd0]'
                  }`}
                >
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono-data text-4xl font-bold">
                      {currencySymbol}
                      {plan.price_inr}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        isHighlighted ? 'text-[#d6cbba]' : 'text-[#57493f]'
                      }`}
                    >
                      {intervalLabel}
                    </span>
                  </div>
                  {plan.promo_note ? (
                    <p
                      className={`text-xs font-semibold mt-1 ${
                        isHighlighted ? 'text-[#f59e0b]' : 'text-[#b45309]'
                      }`}
                    >
                      {plan.promo_note}
                    </p>
                  ) : isFree ? (
                    <p
                      className={`text-xs mt-1 ${
                        isHighlighted ? 'text-[#d6cbba]' : 'text-[#57493f]'
                      }`}
                    >
                      No credit card required · Instant discovery
                    </p>
                  ) : null}
                  {plan.usage_limits && (
                    <p
                      className={`text-[11px] mt-1 ${
                        isHighlighted ? 'text-[#d6cbba]' : 'text-[#57493f]'
                      }`}
                    >
                      Limits: {plan.usage_limits}
                    </p>
                  )}
                </div>

                <ul className="space-y-2.5 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isHighlighted ? 'text-[#f59e0b]' : 'text-[#1b4d3e]'
                        }`}
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8">
                <button
                  type="button"
                  disabled={isCurrent && !isFree}
                  onClick={() => handlePlanAction(plan.id, plan.price_inr)}
                  className={`inline-flex items-center justify-center gap-2 w-full min-h-[46px] px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    isCurrent && !isFree
                      ? 'bg-[#ecfdf5] text-[#1b4d3e] border border-[#bbf7d0] cursor-default'
                      : isHighlighted
                      ? 'bg-[#b45309] hover:bg-[#92400e] text-white'
                      : 'bg-[#1c1613] hover:bg-[#3a2f28] text-[#faf7f2]'
                  }`}
                >
                  <span>
                    {isFree
                      ? authenticated
                        ? 'Explore Cafes Now'
                        : 'Get Started Free'
                      : isCurrent
                      ? 'Current Active Plan'
                      : wasExpiredPlan
                      ? `Renew ${plan.name} · ${currencySymbol}${plan.price_inr}`
                      : `Choose ${plan.name} · ${currencySymbol}${plan.price_inr}`}
                  </span>
                  {!(isCurrent && !isFree) && !isFree && (
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Feature Comparison Table */}
      <section aria-labelledby="compare-plans-heading" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="inline-block text-xs uppercase tracking-[0.14em] font-semibold text-[#b45309] mb-1">
              Detailed Breakdown
            </span>
            <h2
              id="compare-plans-heading"
              className="font-serif-display text-3xl font-semibold text-[#1c1613]"
            >
              Free vs Paid Membership Features
            </h2>
          </div>
          <p className="text-xs font-medium text-[#57493f] inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
            <span>Supports UPI, Credit Cards, Debit Cards &amp; Net Banking via Razorpay</span>
          </p>
        </div>

        {/* Mobile Feature Comparison Cards */}
        <div className="md:hidden space-y-3">
          {COMPARISON_ROWS.map((row) => (
            <div
              key={row.label}
              className="rounded-xl bg-white border border-[#e6ddd0] p-4 space-y-2.5"
            >
              <p className="text-sm font-semibold text-[#1c1613] leading-snug">{row.label}</p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#e6ddd0] text-xs">
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#faf7f2] border border-[#e6ddd0]">
                  <span className="text-[#57493f] font-medium">Free</span>
                  {row.free === true ? (
                    <Check className="w-4 h-4 text-[#1b4d3e] shrink-0" aria-label="Included" />
                  ) : row.free === false ? (
                    <Minus className="w-4 h-4 text-[#94a3b8] shrink-0" aria-label="Not included" />
                  ) : (
                    <span className="font-semibold text-[#57493f]">{row.free}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#fffbeb] border border-[#fde68a]">
                  <span className="text-[#92400e] font-semibold">Plus / Pro</span>
                  {row.plus === true ? (
                    <Check className="w-4 h-4 text-[#1b4d3e] shrink-0" aria-label="Included" />
                  ) : row.plus === false ? (
                    <Minus className="w-4 h-4 text-[#94a3b8] shrink-0" aria-label="Not included" />
                  ) : (
                    <span className="font-semibold text-[#92400e]">{row.plus}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Feature Comparison Table */}
        <div className="hidden md:block rounded-2xl bg-white border border-[#e6ddd0] overflow-x-auto shadow-xs">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e6ddd0] bg-[#faf7f2]">
                <th className="py-4 px-5 font-semibold text-[#57493f]">Feature</th>
                <th className="py-4 px-4 text-center font-semibold text-[#1c1613] min-w-[140px]">
                  Free Explorer
                  <div className="font-mono-data text-xs font-normal text-[#57493f]">
                    {currencySymbol}0 Forever
                  </div>
                </th>
                <th className="py-4 px-4 text-center font-semibold text-[#b45309] min-w-[160px]">
                  Cafe Desk Plus / Pro
                  <div className="font-mono-data text-xs font-normal text-[#57493f]">
                    From {currencySymbol}
                    {monthlyPrice}/mo · {currencySymbol}
                    {annualPrice}/yr
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6ddd0]">
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label} className="hover:bg-[#faf7f2]/60">
                  <td className="py-3.5 px-5 font-medium text-[#1c1613]">{row.label}</td>
                  {([row.free, row.plus] as Array<boolean | string>).map((val, idx) => (
                    <td key={idx} className="py-3.5 px-4 text-center">
                      {val === true ? (
                        <Check className="w-4 h-4 text-[#1b4d3e] mx-auto" aria-label="Included" />
                      ) : val === false ? (
                        <Minus className="w-4 h-4 text-[#94a3b8] mx-auto" aria-label="Not included" />
                      ) : (
                        <span className="text-xs font-semibold text-[#57493f]">{val}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Transparent Partner / Sponsored Placements Strip */}
      <section className="rounded-2xl bg-[#f3ede3] border border-[#e6ddd0] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <span className="inline-block text-xs uppercase tracking-[0.14em] font-semibold text-[#1b4d3e]">
            For Bengaluru Cafes &amp; Roasteries
          </span>
          <h2 className="font-serif-display text-2xl sm:text-3xl font-semibold text-[#1c1613]">
            Transparent Partner &amp; Featured Cafe Placements
          </h2>
          <p className="text-sm text-[#57493f]">
            Run an independent cafe in Bengaluru? Partner with Cafe Desk for verified workspace
            audits, student offers, or clearly labelled Sponsored Spotlights without altering organic
            search results.
          </p>
        </div>
        <Link
          to="/owners"
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#1c1613] hover:bg-[#3a2f28] text-[#faf7f2] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
        >
          <span>Explore Cafe Partnerships</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </section>

      <div className="text-center text-sm text-[#57493f]">
        Already have a Cafe Desk account?{' '}
        <Link
          to={authenticated ? '/account' : '/login'}
          className="font-semibold text-[#b45309] hover:text-[#92400e] hover:underline"
        >
          {authenticated ? 'Manage your subscription in Account' : 'Sign in here'}
        </Link>
      </div>
    </div>
  );
}

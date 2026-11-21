import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Crown,
  Minus,
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
  const { authenticated, tier, plans, openCheckout } = useAuth();

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-14">
      {/* Header */}
      <header className="max-w-3xl mx-auto text-center space-y-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b45309]">
          Simple, Transparent Memberships
        </p>
        <h1 className="font-serif-display text-4xl sm:text-5xl font-bold text-[#1c1613] text-balance">
          {settings.pricing_headline || 'Explore Bengaluru cafes free, or unlock full menu & budget tools'}
        </h1>
        <p className="text-base sm:text-lg text-[#5c4e45] leading-relaxed">
          {settings.pricing_subtitle ||
            'Save favourites, check laptop readiness, seating, sockets, and noise levels free forever. Upgrade when you want full food prices, verified Wi-Fi speeds, comparisons, and deals.'}
        </p>
      </header>

      {/* Dynamic Active Membership Plans Grid */}
      <section
        aria-label="Subscription plans"
        className={`grid grid-cols-1 ${
          activePlans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'
        } gap-7 items-stretch`}
      >
        {activePlans.map((plan) => {
          const isDark = Boolean(plan.is_recommended);
          const isCurrent = authenticated && tier === plan.id;
          const isFree = plan.id === 'free' || plan.price_inr <= 0;
          const intervalLabel = formatIntervalLabel(plan.price_inr, plan.interval_days);

          return (
            <div
              key={plan.id}
              className={`rounded-2xl p-7 sm:p-8 flex flex-col justify-between border transition-shadow ${
                isDark
                  ? 'bg-[#1c1613] text-[#faf7f2] border-[#1c1613] shadow-xl'
                  : 'bg-white text-[#1c1613] border-[#e6ddd0]'
              }`}
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${
                      isDark ? 'text-[#f59e0b]' : isFree ? 'text-[#1b4d3e]' : 'text-[#b45309]'
                    }`}
                  >
                    {isDark ? (
                      plan.interval_days >= 365 ? (
                        <Crown className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Sparkles className="w-4 h-4" aria-hidden="true" />
                      )
                    ) : null}
                    <span>{plan.badge_text || (isFree ? 'Free Forever' : 'Membership Plan')}</span>
                  </span>
                  {isCurrent && (
                    <span className="px-2.5 py-0.5 rounded-md bg-[#1b4d3e] text-white text-[11px] font-semibold">
                      Current Plan
                    </span>
                  )}
                </div>

                <div>
                  <h2
                    className={`font-serif-display text-3xl font-bold ${
                      isDark ? 'text-white' : 'text-[#1c1613]'
                    }`}
                  >
                    {plan.name}
                  </h2>
                  {plan.tagline && (
                    <p
                      className={`text-sm mt-1.5 leading-relaxed ${
                        isDark ? 'text-[#faf7f2]/80' : 'text-[#5c4e45]'
                      }`}
                    >
                      {plan.tagline}
                    </p>
                  )}
                </div>

                <div
                  className={`pt-4 pb-5 border-y ${
                    isDark ? 'border-white/15' : 'border-[#e6ddd0]'
                  }`}
                >
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`font-mono-data text-4xl font-bold ${
                        isDark ? 'text-white' : 'text-[#1c1613]'
                      }`}
                    >
                      {currencySymbol}
                      {plan.price_inr}
                    </span>
                    <span
                      className={`text-sm ${
                        isDark ? 'text-[#faf7f2]/75' : 'text-[#5c4e45]'
                      }`}
                    >
                      {intervalLabel}
                    </span>
                  </div>
                  {plan.promo_note ? (
                    <p
                      className={`text-xs font-medium mt-1 ${
                        isDark ? 'text-[#f59e0b]' : 'text-[#b45309]'
                      }`}
                    >
                      {plan.promo_note}
                    </p>
                  ) : isFree ? (
                    <p
                      className={`text-xs mt-1 ${
                        isDark ? 'text-[#faf7f2]/70' : 'text-[#5c4e45]'
                      }`}
                    >
                      No credit card required · Instant discovery
                    </p>
                  ) : null}
                  {plan.usage_limits && (
                    <p
                      className={`text-[11px] mt-1 font-medium ${
                        isDark ? 'text-[#faf7f2]/75' : 'text-[#5c4e45]'
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
                          isDark ? 'text-[#f59e0b]' : 'text-[#1b4d3e]'
                        }`}
                        aria-hidden="true"
                      />
                      <span className={isDark ? 'text-[#faf7f2]/92' : 'text-[#1c1613]'}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8">
                <button
                  type="button"
                  disabled={isCurrent && !isFree}
                  onClick={() => handlePlanAction(plan.id, plan.price_inr)}
                  className={`w-full min-h-[46px] px-5 py-2.5 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                    isCurrent && !isFree
                      ? 'bg-[#1b4d3e] text-white cursor-default opacity-90'
                      : isDark
                      ? 'bg-[#b45309] hover:bg-[#d97706] text-white'
                      : 'bg-[#1c1613] hover:bg-[#312722] text-white'
                  }`}
                >
                  <span>
                    {isFree
                      ? authenticated
                        ? 'Explore Cafes Now'
                        : 'Get Started Free'
                      : isCurrent
                      ? 'Current Active Plan'
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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
              Detailed Breakdown
            </p>
            <h2
              id="compare-plans-heading"
              className="font-serif-display text-3xl font-bold text-[#1c1613]"
            >
              Free vs Paid Membership Features
            </h2>
          </div>
          <p className="text-xs text-[#5c4e45] inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#1b4d3e]" aria-hidden="true" />
            <span>Supports UPI, Credit Cards, Debit Cards &amp; Net Banking via Razorpay</span>
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-[#e6ddd0] overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e6ddd0] bg-[#faf7f2]">
                <th className="py-4 px-5 font-semibold text-[#5c4e45]">Feature</th>
                <th className="py-4 px-4 text-center font-bold text-[#1c1613] min-w-[140px]">
                  Free Explorer
                  <div className="font-mono-data text-xs font-normal text-[#5c4e45]">
                    {currencySymbol}0 Forever
                  </div>
                </th>
                <th className="py-4 px-4 text-center font-bold text-[#b45309] min-w-[160px]">
                  Cafe Desk Plus / Pro
                  <div className="font-mono-data text-xs font-normal text-[#5c4e45]">
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
                        <Minus className="w-4 h-4 text-[#cbd5e1] mx-auto" aria-label="Not included" />
                      ) : (
                        <span className="text-xs font-semibold text-[#5c4e45]">{val}</span>
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
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#b45309]">
            For Bengaluru Cafes &amp; Roasteries
          </p>
          <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
            Transparent Partner &amp; Featured Cafe Placements
          </h2>
          <p className="text-sm text-[#5c4e45]">
            Run an independent cafe in Bengaluru? Partner with Cafe Desk for verified workspace
            audits, student offers, or clearly labelled Sponsored Spotlights without altering organic
            search results.
          </p>
        </div>
        <Link
          to="/owners"
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#1c1613] hover:bg-[#312722] text-white text-xs font-semibold whitespace-nowrap shrink-0"
        >
          <span>Explore Cafe Partnerships</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </section>

      <div className="text-center text-sm text-[#5c4e45]">
        Already have a Cafe Desk account?{' '}
        <Link to={authenticated ? '/account' : '/login'} className="font-semibold text-[#b45309] hover:underline">
          {authenticated ? 'Manage your subscription in Account' : 'Sign in here'}
        </Link>
      </div>
    </div>
  );
}

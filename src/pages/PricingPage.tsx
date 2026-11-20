import React, { useState } from 'react';
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

export function PricingPage() {
  const navigate = useNavigate();
  const { settings } = useCms();
  const { authenticated, tier, hasPlus, plans, openCheckout } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  useDocumentMeta(
    `Plans & Pricing – ${settings.brand_name}`,
    'Explore Bengaluru cafes free forever, or upgrade to Cafe Desk Plus (₹79/mo or ₹499/year) for full menus, prices, budget filters, comparisons, and exclusive deals.',
    { allowIndexing: true }
  );

  const freePlan = plans.find((p) => p.id === 'free');
  const plusMonthly = plans.find((p) => p.id === 'plus');
  const plusAnnual = plans.find((p) => p.id === 'premium');

  const monthlyPrice = plusMonthly?.price_inr ?? 79;
  const annualPrice = plusAnnual?.price_inr ?? 499;
  const selectedPaidPlanId = billingCycle === 'annual' ? 'premium' : 'plus';
  const activePaidPrice = billingCycle === 'annual' ? annualPrice : monthlyPrice;
  const monthlyEquivalent = Math.round(annualPrice / 12);
  const annualSavingsPct = Math.max(
    0,
    Math.round(((monthlyPrice * 12 - annualPrice) / Math.max(1, monthlyPrice * 12)) * 100)
  );

  const freeFeatures = freePlan?.features ?? [
    'Search all Bengaluru cafes by name, locality & live autocomplete',
    'Nearby GPS discovery, photos & Google Maps directions',
    'Interactive Cafe Finder & curated Bengaluru collections',
    'Laptop-friendly status, seating, studying, noise level, sockets & ambience',
    'Save & bookmark favourite Bengaluru cafes across sessions',
  ];

  const plusFeatures =
    (billingCycle === 'annual' ? plusAnnual?.features : plusMonthly?.features) ?? [
      'Everything in Free Explorer',
      'Full food & beverage menus, prices & average budget per person',
      'Verified Wi-Fi availability, measured speeds (Mbps) & work/meeting filters',
      'Advanced budget & food category filters',
      'Compare up to 4 Bengaluru cafes side-by-side',
      'Personal custom cafe collections & personalized recommendations',
      'Exclusive cafe deals, partner perks & student discounts',
    ];

  const customPlans = plans.filter(
    (p) => p.active && p.id !== 'free' && p.id !== 'plus' && p.id !== 'premium'
  );
  const activePaidObj = billingCycle === 'annual' ? plusAnnual : plusMonthly;

  const handleFreeAction = () => {
    if (authenticated) navigate('/locations');
    else navigate('/login?mode=signup');
  };

  const handlePlusAction = (targetId: string = selectedPaidPlanId) => {
    if (!authenticated) {
      navigate(`/login?mode=signup&upgrade=${targetId}`);
      return;
    }
    openCheckout(targetId);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-14">
      {/* Header + Monthly / Annual Toggle */}
      <header className="max-w-3xl mx-auto text-center space-y-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b45309]">
          Simple, Transparent Memberships
        </p>
        <h1 className="font-serif-display text-4xl sm:text-5xl font-bold text-[#1c1613] text-balance">
          {settings.pricing_headline || 'Explore Bengaluru cafes free, or unlock full menu & budget tools'}
        </h1>
        <p className="text-base sm:text-lg text-[#5c4e45] leading-relaxed">
          {settings.pricing_subtitle ||
            'Save favourites, check laptop readiness, seating, sockets, and noise levels free forever. Upgrade to Cafe Desk Plus when you want full food prices, verified Wi-Fi speeds, comparisons, and deals.'}
        </p>

        {/* Billing Cycle Toggle */}
        <div className="inline-flex items-center p-1.5 rounded-xl bg-[#f3ede3] border border-[#e6ddd0]">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              billingCycle === 'monthly'
                ? 'bg-[#1c1613] text-white shadow-sm'
                : 'text-[#5c4e45] hover:text-[#1c1613]'
            }`}
          >
            Monthly · ₹{monthlyPrice}/mo
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
              billingCycle === 'annual'
                ? 'bg-[#b45309] text-white shadow-sm'
                : 'text-[#5c4e45] hover:text-[#1c1613]'
            }`}
          >
            <span>Annual · ₹{annualPrice}/yr</span>
            {annualSavingsPct > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-bold">
                Save {annualSavingsPct}%
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Two Clear Tiers: Free Explorer vs Cafe Desk Plus */}
      <section aria-label="Subscription plans" className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* Tier 1: Free Explorer */}
        <div className="rounded-2xl p-8 bg-white text-[#1c1613] border border-[#e6ddd0] flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1b4d3e]">
                {freePlan?.badge_text || 'Free Forever'}
              </span>
              {authenticated && tier === 'free' && (
                <span className="px-2.5 py-0.5 rounded-md bg-[#1b4d3e] text-white text-[11px] font-semibold">
                  Current Plan
                </span>
              )}
            </div>

            <div>
              <h2 className="font-serif-display text-3xl font-bold text-[#1c1613]">
                {freePlan?.name || 'Free Explorer'}
              </h2>
              <p className="text-sm text-[#5c4e45] mt-1.5 leading-relaxed">
                {freePlan?.tagline ||
                  'Discover Bengaluru cafes, save favourites, and check laptops, seating, study suitability, noise level & charging sockets.'}
              </p>
            </div>

            <div className="pt-4 pb-5 border-y border-[#e6ddd0]">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono-data text-4xl font-bold">₹0</span>
                <span className="text-sm text-[#5c4e45]">/ forever</span>
              </div>
              <p className="text-xs text-[#5c4e45] mt-1">No credit card required · Instant discovery</p>
            </div>

            <ul className="space-y-2.5 text-sm">
              {freeFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <CheckCircle2
                    className="w-4 h-4 text-[#1b4d3e] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-[#1c1613]">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-8">
            <button
              type="button"
              onClick={handleFreeAction}
              className="w-full min-h-[46px] px-5 py-2.5 rounded-lg bg-[#1c1613] hover:bg-[#312722] text-white text-sm font-semibold transition-colors"
            >
              {authenticated ? 'Explore Cafes Now' : 'Get Started Free'}
            </button>
          </div>
        </div>

        {/* Tier 2: Cafe Desk Plus */}
        <div className="rounded-2xl p-8 bg-[#1c1613] text-[#faf7f2] border border-[#1c1613] shadow-xl flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#f59e0b]">
                {billingCycle === 'annual' ? (
                  <Crown className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                )}
                <span>
                  {billingCycle === 'annual'
                    ? `Best Value · Save ${annualSavingsPct}%`
                    : 'Most Popular'}
                </span>
              </span>
              {authenticated && hasPlus && (
                <span className="px-2.5 py-0.5 rounded-md bg-[#1b4d3e] text-white text-[11px] font-semibold">
                  Plus Active
                </span>
              )}
            </div>

            <div>
              <h2 className="font-serif-display text-3xl font-bold text-white">Cafe Desk Plus</h2>
              <p className="text-sm text-[#faf7f2]/80 mt-1.5 leading-relaxed">
                Complete food &amp; beverage menus, budget filters, verified Wi-Fi speeds,
                side-by-side comparisons, custom collections, and exclusive Bengaluru cafe deals.
              </p>
            </div>

            <div className="pt-4 pb-5 border-y border-white/15">
              <div className="flex items-baseline gap-2">
                <span className="font-mono-data text-4xl font-bold text-white">
                  ₹{activePaidPrice}
                </span>
                <span className="text-sm text-[#faf7f2]/75">
                  / {billingCycle === 'annual' ? 'year' : 'month'}
                </span>
              </div>
              <p className="text-xs text-[#f59e0b] font-medium mt-1">
                {activePaidObj?.promo_note
                  ? activePaidObj.promo_note
                  : billingCycle === 'annual'
                  ? `Only ₹${monthlyEquivalent}/month effective · 365 days access`
                  : `Or switch to ₹${annualPrice}/year (save ${annualSavingsPct}%)`}
              </p>
            </div>

            <ul className="space-y-2.5 text-sm">
              {plusFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <CheckCircle2
                    className="w-4 h-4 text-[#f59e0b] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-[#faf7f2]/92">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-8 space-y-2.5">
            <button
              type="button"
              disabled={authenticated && tier === selectedPaidPlanId}
              onClick={() => handlePlusAction(selectedPaidPlanId)}
              className={`w-full min-h-[46px] px-5 py-2.5 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                authenticated && tier === selectedPaidPlanId
                  ? 'bg-[#1b4d3e] text-white cursor-default opacity-90'
                  : 'bg-[#b45309] hover:bg-[#d97706] text-white'
              }`}
            >
              <span>
                {authenticated && tier === selectedPaidPlanId
                  ? `Active (${billingCycle === 'annual' ? 'Annual' : 'Monthly'} Plan)`
                  : authenticated && hasPlus
                  ? `Switch / Extend (${billingCycle === 'annual' ? `₹${annualPrice}/yr` : `₹${monthlyPrice}/mo`})`
                  : `Unlock Cafe Desk Plus · ₹${activePaidPrice}/${billingCycle === 'annual' ? 'yr' : 'mo'}`}
              </span>
              {!(authenticated && tier === selectedPaidPlanId) && (
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Additional Custom Membership Plans Added via Admin */}
      {customPlans.length > 0 && (
        <section aria-label="Additional membership options" className="space-y-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
              Additional Membership Options
            </p>
            <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#1c1613]">
              Specialized Passes &amp; Plans
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {customPlans.map((cp) => (
              <div
                key={cp.id}
                className="rounded-2xl p-6 bg-white border border-[#e6ddd0] flex flex-col justify-between space-y-5"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#b45309]">
                      {cp.badge_text || 'Membership Pass'}
                    </span>
                    {authenticated && tier === cp.id && (
                      <span className="text-xs font-bold text-[#1b4d3e]">Active</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-serif-display text-2xl font-bold text-[#1c1613]">{cp.name}</h3>
                    {cp.tagline && <p className="text-xs text-[#5c4e45] mt-1">{cp.tagline}</p>}
                  </div>
                  <div className="py-3 border-y border-[#e6ddd0]">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono-data text-3xl font-bold text-[#1c1613]">
                        ₹{cp.price_inr}
                      </span>
                      <span className="text-xs text-[#5c4e45]">/ {cp.interval_days} days</span>
                    </div>
                    {cp.promo_note && (
                      <p className="text-xs text-[#b45309] font-medium mt-1">{cp.promo_note}</p>
                    )}
                  </div>
                  <ul className="space-y-2 text-xs text-[#1c1613]">
                    {cp.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#1b4d3e] shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  disabled={authenticated && tier === cp.id}
                  onClick={() => handlePlusAction(cp.id)}
                  className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-[#1c1613] hover:bg-[#312722] disabled:bg-[#1b4d3e] text-white text-xs font-semibold"
                >
                  {authenticated && tier === cp.id ? 'Current Active Plan' : `Select ${cp.name}`}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

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
              Free vs Cafe Desk Plus
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
                  <div className="font-mono-data text-xs font-normal text-[#5c4e45]">₹0 Forever</div>
                </th>
                <th className="py-4 px-4 text-center font-bold text-[#b45309] min-w-[160px]">
                  Cafe Desk Plus
                  <div className="font-mono-data text-xs font-normal text-[#5c4e45]">
                    ₹{monthlyPrice}/mo · ₹{annualPrice}/yr
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

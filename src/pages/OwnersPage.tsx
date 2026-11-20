import React, { useState } from 'react';
import { Check, CheckCircle2, MessageCircle } from 'lucide-react';
import { BENGALURU_AREAS } from '../config/constants';
import { useCms } from '../context/CmsContext';
import { buildWhatsAppUrl, useDocumentMeta } from '../utils/cafeHelpers';

interface PlanOption {
  id: 'Free listing' | 'Verified (₹999/month)' | 'Featured (₹1,999/month)';
  name: string;
  audience: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
}

const OWNER_PLANS: PlanOption[] = [
  {
    id: 'Free listing',
    name: 'Directory Listing',
    audience: 'For independent neighborhood cafes',
    price: '₹0',
    period: 'forever',
    features: [
      'Cafe name, city, address & opening hours',
      'Google Maps directions link',
      'Standard search visibility across modes',
    ],
  },
  {
    id: 'Verified (₹999/month)',
    name: 'Verified Partner',
    audience: 'For work-friendly specialty spaces',
    price: '₹999',
    period: '/month',
    features: [
      'On-site WiFi Mbps, socket & noise audit',
      'Verified branch seal & audit timestamp',
      'Student deal & minimum spend callout',
      'Direct links to your website, menu & Instagram',
    ],
  },
  {
    id: 'Featured (₹1,999/month)',
    name: 'Featured Partner',
    audience: 'For flagship & multi-branch brands',
    price: '₹1,999',
    period: '/month',
    highlighted: true,
    features: [
      'Everything in Verified Partner plan',
      'Homepage Featured Locations showcase',
      'Priority ranking in matching city & mode searches',
      'Transparent "Sponsored · Featured" disclosure',
    ],
  },
];

export function OwnersPage() {
  const { settings } = useCms();

  useDocumentMeta(
    `Partner With Us – Cafe Owner Plans | ${settings.brand_name}`,
    'List and verify your coffee house or workspace on CafeDesk to welcome steady weekday remote workers and students.',
    { allowIndexing: settings.seo_allow_indexing }
  );

  const [selectedPlan, setSelectedPlan] = useState<PlanOption['id']>('Verified (₹999/month)');
  const [cafeName, setCafeName] = useState('');
  const [area, setArea] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handlePlanSelect = (planId: PlanOption['id']) => {
    setSelectedPlan(planId);
    const formEl = document.getElementById('owner-enquiry-form');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cafeName.trim() || !contactName.trim() || !phone.trim()) {
      setErrorMsg('Please enter your cafe name, your name, and phone number.');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'owner_enquiry',
          plan: selectedPlan,
          cafeName: cafeName.trim(),
          area: area || 'Bengaluru',
          contactName: contactName.trim(),
          contactInfo: phone.trim(),
          notes: notes.trim() || `Interested in ${selectedPlan}`,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not submit owner enquiry.');
        setStatus('error');
        return;
      }
      setStatus('sent');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  };

  const waUrl = buildWhatsAppUrl(
    `CafeDesk Partner Enquiry (${selectedPlan}) — ${cafeName} (${area || 'Bengaluru'}), Contact: ${contactName} ${phone}`,
    settings.whatsapp_number
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-14">
      <div className="max-w-3xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
          Partner With {settings.brand_name}
        </p>
        <h1 className="font-serif-display text-3xl sm:text-5xl font-bold text-[#1c1613] leading-tight">
          Welcome reliable weekday desk guests to your tables
        </h1>
        <p className="text-base text-[#5c4e45] leading-relaxed">
          Remote professionals, founders, and students actively seek dependable fiber WiFi,
          accessible wall outlets, and honest minimum-spend policies. Every featured listing carries
          a clear disclosure so guests trust every cafe listing before they visit.
        </p>
      </div>

      {/* Pricing Plans */}
      <section aria-labelledby="owner-plans-heading" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <h2 id="owner-plans-heading" className="sr-only">
          Partner Plans
        </h2>
        {OWNER_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`p-6 sm:p-7 rounded-2xl border flex flex-col justify-between ${
              plan.highlighted
                ? 'bg-[#1c1613] text-[#faf7f2] border-[#1c1613]'
                : 'bg-white text-[#1c1613] border-[#e6ddd0]'
            }`}
          >
            <div className="space-y-4">
              <div>
                <p
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    plan.highlighted ? 'text-[#f59e0b]' : 'text-[#b45309]'
                  }`}
                >
                  {plan.audience}
                </p>
                <h3 className="font-serif-display text-2xl font-bold mt-1">{plan.name}</h3>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="font-mono-data text-3xl font-bold">{plan.price}</span>
                <span
                  className={`text-xs ${
                    plan.highlighted ? 'text-[#faf7f2]/70' : 'text-[#5c4e45]'
                  }`}
                >
                  {plan.period}
                </span>
              </div>

              <ul
                className={`space-y-2.5 text-sm pt-4 border-t ${
                  plan.highlighted ? 'border-white/15 text-[#faf7f2]/90' : 'border-[#e6ddd0] text-[#5c4e45]'
                }`}
              >
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2">
                    <Check
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        plan.highlighted ? 'text-[#f59e0b]' : 'text-[#1b4d3e]'
                      }`}
                      aria-hidden="true"
                    />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => handlePlanSelect(plan.id)}
              className={`mt-6 w-full min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                selectedPlan === plan.id
                  ? 'bg-[#b45309] text-white'
                  : plan.highlighted
                  ? 'bg-white text-[#1c1613] hover:bg-[#faf7f2]'
                  : 'bg-[#f3ede3] text-[#1c1613] hover:bg-[#e6ddd0]'
              }`}
            >
              {selectedPlan === plan.id ? 'Selected in form below' : `Select ${plan.name}`}
            </button>
          </div>
        ))}
      </section>

      {/* Owner Enquiry Form */}
      <section
        id="owner-enquiry-form"
        aria-labelledby="owner-form-heading"
        className="max-w-3xl scroll-mt-24 space-y-5"
      >
        <div className="space-y-1">
          <h2 id="owner-form-heading" className="font-serif-display text-2xl sm:text-3xl font-bold text-[#1c1613]">
            Partner Enquiry Form
          </h2>
          <p className="text-sm text-[#5c4e45]">
            Submit your branch details below to save an enquiry directly with our partnerships team.
          </p>
        </div>

        {status === 'sent' ? (
          <div
            role="status"
            className="p-6 sm:p-8 rounded-2xl bg-[#ecfdf5] border border-[#a7f3d0] text-[#1b4d3e] space-y-4"
          >
            <div className="flex items-center gap-2 font-bold text-lg">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              <span>Partner enquiry received!</span>
            </div>
            <p className="text-sm">
              Thank you — our partnerships coordinator will review your enquiry for{' '}
              <strong>{cafeName}</strong> shortly.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-lg bg-[#1b4d3e] text-white text-sm font-semibold"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                <span>Fast-track on WhatsApp</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setStatus('idle');
                  setCafeName('');
                  setContactName('');
                  setPhone('');
                  setNotes('');
                }}
                className="min-h-[42px] px-4 py-2 rounded-lg border border-[#1b4d3e]/30 text-sm font-semibold"
              >
                Send another enquiry
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="p-6 sm:p-8 rounded-2xl bg-white border border-[#e6ddd0] space-y-4"
          >
            <div>
              <label htmlFor="own-plan" className="block text-xs font-semibold text-[#5c4e45] mb-1">
                Selected Plan
              </label>
              <select
                id="own-plan"
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value as PlanOption['id'])}
                className="w-full h-11 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
              >
                {OWNER_PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="own-cafe"
                  className="block text-xs font-semibold text-[#5c4e45] mb-1"
                >
                  Cafe / Brand Name *
                </label>
                <input
                  id="own-cafe"
                  type="text"
                  required
                  value={cafeName}
                  onChange={(e) => setCafeName(e.target.value)}
                  placeholder="Your cafe name"
                  className="w-full h-11 px-3.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
                />
              </div>

              <div>
                <label
                  htmlFor="own-area"
                  className="block text-xs font-semibold text-[#5c4e45] mb-1"
                >
                  City / Area
                </label>
                <select
                  id="own-area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
                >
                  <option value="">Select area</option>
                  {BENGALURU_AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                  <option value="Other city / area">Other city / area</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="own-person"
                  className="block text-xs font-semibold text-[#5c4e45] mb-1"
                >
                  Your Name *
                </label>
                <input
                  id="own-person"
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Owner or manager name"
                  className="w-full h-11 px-3.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
                />
              </div>

              <div>
                <label
                  htmlFor="own-phone"
                  className="block text-xs font-semibold text-[#5c4e45] mb-1"
                >
                  Phone / WhatsApp Number *
                </label>
                <input
                  id="own-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98..."
                  className="w-full h-11 px-3.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="own-notes" className="block text-xs font-semibold text-[#5c4e45] mb-1">
                Student offers, seating capacity, or questions
              </label>
              <textarea
                id="own-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. 45 seats, 200 Mbps fiber, 15% student coffee perk..."
                className="w-full p-3.5 rounded-lg border border-[#d6cbba] bg-[#faf7f2] text-sm text-[#1c1613]"
              />
            </div>

            {status === 'error' && errorMsg && (
              <p role="alert" className="text-xs font-semibold text-[#b91c1c]">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              style={{ backgroundColor: settings.accent_color || '#b45309' }}
              className="w-full sm:w-auto min-h-[46px] px-7 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-95 disabled:opacity-60 transition-opacity"
            >
              {status === 'submitting' ? 'Sending...' : 'Submit Partner Enquiry'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronDown, Instagram, MessageCircle } from 'lucide-react';
import { useCms } from '../context/CmsContext';
import { buildWhatsAppUrl, useDocumentMeta } from '../utils/cafeHelpers';
import { ResilientPhoto } from '../components/ResilientPhoto';

export function AboutPage() {
  const { settings } = useCms();
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  useDocumentMeta(settings.seo_about_title, settings.seo_about_description, {
    canonicalPath: '/about',
    ogImage: settings.seo_og_image,
    allowIndexing: settings.seo_allow_indexing,
    googleSiteVerification: settings.google_site_verification,
  });

  const waUrl = buildWhatsAppUrl(
    `Hi ${settings.brand_name}! Reaching out with a question about your verified workspaces.`,
    settings.whatsapp_number
  );

  return (
    <div>
      {/* About Hero Split */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-6 space-y-5">
            <span className="inline-block text-xs uppercase tracking-[0.14em] font-semibold text-[#b45309]">
              About {settings.brand_name}
            </span>
            <h1 className="font-serif-display text-3xl sm:text-5xl font-semibold text-[#1c1613] leading-tight">
              {settings.about_heading}
            </h1>
            <p className="text-base font-medium text-[#1c1613] leading-relaxed">
              {settings.about_lead}
            </p>
            <p className="text-sm sm:text-base text-[#57493f] leading-relaxed">
              {settings.about_story}
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#1b4d3e] hover:bg-[#143a2f] text-white text-sm font-semibold transition-colors"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                <span>Message on WhatsApp</span>
              </a>
              {settings.instagram_url && (
                <a
                  href={settings.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-white border border-[#d6cbba] hover:border-[#b45309] text-[#1c1613] text-sm font-semibold transition-colors"
                >
                  <Instagram className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
                  <span>{settings.instagram_handle}</span>
                </a>
              )}
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl overflow-hidden bg-white border border-[#e6ddd0] p-2 shadow-xs">
              <ResilientPhoto
                src={settings.about_image_url}
                alt="Founders having a relaxed coffee meeting inside a sunlit CafeDesk booth"
                className="w-full aspect-[16/10] rounded-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Services & Facilities */}
      {(settings.services_items.length > 0 || settings.facilities_items.length > 0) && (
        <section
          aria-labelledby="about-services-heading"
          className="bg-[#f3ede3] border-y border-[#e6ddd0] py-12 sm:py-16"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="max-w-2xl space-y-2">
              <span className="inline-block text-xs uppercase tracking-[0.14em] font-semibold text-[#1b4d3e]">
                Services &amp; Workspace Standards
              </span>
              <h2
                id="about-services-heading"
                className="font-serif-display text-3xl sm:text-4xl font-semibold text-[#1c1613]"
              >
                {settings.services_heading}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {settings.services_items.map((srv) => (
                <div
                  key={srv.title}
                  className="rounded-2xl p-5 sm:p-6 bg-white border border-[#e6ddd0] space-y-2"
                >
                  <h3 className="font-serif-display text-xl font-semibold text-[#1c1613]">
                    {srv.title}
                  </h3>
                  <p className="text-sm text-[#57493f] leading-relaxed">{srv.description}</p>
                  {srv.highlight && (
                    <p className="text-xs font-semibold text-[#1b4d3e] pt-1">{srv.highlight}</p>
                  )}
                </div>
              ))}
            </div>

            {settings.facilities_items.length > 0 && (
              <div className="rounded-2xl p-5 sm:p-8 bg-white border border-[#e6ddd0]">
                <h3 className="font-serif-display text-xl font-semibold text-[#1c1613] mb-4">
                  Standard Verified Facilities Checklist
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {settings.facilities_items.map((f) => (
                    <div key={f.name} className="flex items-start gap-2.5">
                      <CheckCircle2
                        className="w-4 h-4 text-[#1b4d3e] shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-semibold text-[#1c1613]">{f.name}</p>
                        <p className="text-xs text-[#57493f]">{f.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* FAQs */}
      {settings.faqs_items.length > 0 && (
        <section
          aria-labelledby="about-faq-heading"
          className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-6"
        >
          <div className="max-w-2xl space-y-2">
            <span className="inline-block text-xs uppercase tracking-[0.14em] font-semibold text-[#b45309]">
              Frequently Asked Questions
            </span>
            <h2
              id="about-faq-heading"
              className="font-serif-display text-3xl font-semibold text-[#1c1613]"
            >
              Everything you need to know
            </h2>
          </div>

          <div className="rounded-2xl border border-[#e6ddd0] divide-y divide-[#e6ddd0] bg-white overflow-hidden">
            {settings.faqs_items.map((faq, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div key={faq.question}>
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full min-h-[54px] px-4 sm:px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-[#faf7f2] transition-colors"
                  >
                    <span className="font-semibold text-base text-[#1c1613]">{faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#57493f] shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 sm:px-6 pb-5 text-sm text-[#57493f] leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Transparency & Legal Policies */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div id="privacy" className="rounded-2xl border border-[#e6ddd0] p-5 sm:p-6 bg-white space-y-3">
            <h2 className="font-serif-display text-xl font-semibold text-[#1c1613]">
              Transparency &amp; Privacy
            </h2>
            <p className="text-sm text-[#57493f] leading-relaxed">
              Every paid featured branch is always labelled{' '}
              <strong className="text-[#1c1613]">Sponsored · Featured</strong>. Partners cannot
              alter measured WiFi speeds, acoustic ratings, or invent customer testimonials. Enquiry
              details are stored securely for cafe directory updates and enquiries and never sold
              to third parties.
            </p>
          </div>

          <div id="terms" className="rounded-2xl border border-[#e6ddd0] p-5 sm:p-6 bg-white space-y-3">
            <h2 className="font-serif-display text-xl font-semibold text-[#1c1613]">
              Terms &amp; Data Corrections
            </h2>
            <p className="text-sm text-[#57493f] leading-relaxed">
              Cafe hours, pricing, and WiFi speeds may change locally without notice. Notice an
              update needed for any location? Use our{' '}
              <Link
                to="/submit"
                className="text-[#b45309] font-semibold underline underline-offset-4 hover:text-[#92400e]"
              >
                Submit / Report an Update
              </Link>{' '}
              form so an administrator can re-verify and publish fresh details.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

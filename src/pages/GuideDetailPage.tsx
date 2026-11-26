import React, { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  HelpCircle,
  PlusCircle,
  UserCheck,
} from 'lucide-react';
import { LOCAL_GUIDES, resolveGuideBySlug } from '../config/guides';
import { useCms } from '../context/CmsContext';
import { useDiscovery } from '../context/DiscoveryContext';
import { trackAnalyticsEvent } from '../utils/analytics';
import { useDocumentMeta } from '../utils/cafeHelpers';
import {
  buildArticleSchema,
  buildBreadcrumbSchema,
  buildFaqSchema,
} from '../utils/seoSchemas';
import { LocationCard } from '../components/LocationCard';
import { ResilientPhoto } from '../components/ResilientPhoto';
import { NotFoundPage } from './NotFoundPage';

export function GuideDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const guide = resolveGuideBySlug(slug);
  const { locations, settings } = useCms();
  const { getEffectiveLocation } = useDiscovery();

  const baseOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://cafedesk.space';

  const referencedCafes = useMemo(() => {
    if (!guide) return [];
    const bySlug = new Map(locations.map((l) => [l.slug || l.id, getEffectiveLocation(l)]));
    return guide.featuredCafeSlugs
      .map((s) => bySlug.get(s))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [guide, locations, getEffectiveLocation]);

  const schemas = useMemo(() => {
    if (!guide) return [];
    return [
      buildBreadcrumbSchema(baseOrigin, [
        { name: 'Home', path: '/' },
        { name: 'Guides', path: '/guides' },
        { name: guide.title, path: `/guides/${guide.slug}` },
      ]),
      buildArticleSchema(baseOrigin, guide, settings.brand_name),
      buildFaqSchema(guide.faqs),
    ].filter(Boolean) as Array<Record<string, unknown>>;
  }, [baseOrigin, guide, settings.brand_name]);

  useDocumentMeta(
    guide ? guide.seoTitle : `Guide Not Found | ${settings.brand_name}`,
    guide ? guide.metaDescription : 'Requested Bengaluru cafe guide could not be found.',
    {
      canonicalPath: guide ? `/guides/${guide.slug}` : undefined,
      ogType: 'article',
      ogImage: guide?.coverImage || settings.seo_og_image,
      allowIndexing: Boolean(guide && settings.seo_allow_indexing),
      schemas,
      googleSiteVerification: settings.google_site_verification,
    }
  );

  useEffect(() => {
    if (guide) {
      trackAnalyticsEvent('guide_view', { guide_slug: guide.slug });
    }
  }, [guide?.slug]);

  if (!guide) {
    return <NotFoundPage />;
  }

  const otherGuides = LOCAL_GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 3);

  return (
    <article className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-24 md:pb-16 space-y-10">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-[#5c4e45]">
        <Link to="/" className="hover:text-[#1c1613] font-medium">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <Link to="/guides" className="hover:text-[#1c1613] font-medium">
          Guides
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-semibold text-[#1c1613] truncate">{guide.category}</span>
      </nav>

      <header className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 text-xs text-[#5c4e45]">
          <span className="px-3 py-1 rounded-full bg-[#fef3c7] text-[#92400e] font-semibold">
            {guide.category}
          </span>
          <span className="inline-flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-[#1b4d3e]" aria-hidden="true" />
            {guide.authorName}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
            Updated {guide.updatedDate}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            {guide.readTimeMinutes} min read
          </span>
        </div>

        <h1 className="font-serif-display text-3xl sm:text-5xl font-bold text-[#1c1613] leading-[1.1]">
          {guide.title}
        </h1>
        <p className="text-base sm:text-lg text-[#5c4e45] leading-relaxed">{guide.summary}</p>

        <div className="rounded-3xl overflow-hidden border border-[#e6ddd0] aspect-[16/9] bg-[#f3ede3]">
          <ResilientPhoto
            src={guide.coverImage}
            alt={guide.coverAlt}
            className="w-full h-full"
            priority
          />
        </div>
      </header>

      {/* Article Body */}
      <div className="bg-white rounded-3xl border border-[#e6ddd0] p-6 sm:p-10 space-y-8">
        {guide.sections.map((section) => (
          <section key={section.heading} className="space-y-3">
            <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#1c1613]">
              {section.heading}
            </h2>
            {section.paragraphs.map((p, idx) => (
              <p key={idx} className="text-sm sm:text-base text-[#5c4e45] leading-relaxed">
                {p}
              </p>
            ))}
            {section.tips && section.tips.length > 0 && (
              <ul className="pt-2 space-y-2">
                {section.tips.map((tip) => (
                  <li
                    key={tip}
                    className="flex items-start gap-2.5 text-xs sm:text-sm text-[#1c1613] bg-[#faf7f2] p-3 rounded-xl border border-[#e6ddd0]"
                  >
                    <CheckCircle2
                      className="w-4 h-4 text-[#1b4d3e] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {/* Related Directory Links */}
        <div className="pt-4 border-t border-[#e6ddd0] space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#b45309]">
            Explore Matching Bengaluru Directories
          </p>
          <div className="flex flex-wrap gap-2">
            {guide.relatedSeoPaths.map((rp) => (
              <Link
                key={rp.path}
                to={rp.path}
                className="min-h-[38px] px-4 py-1.5 rounded-full bg-[#faf7f2] border border-[#e6ddd0] hover:border-[#b45309] text-xs font-semibold text-[#1c1613] inline-flex items-center gap-1.5"
              >
                <span>{rp.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Referenced Live Verified Cafes */}
      {referencedCafes.length > 0 && (
        <section aria-labelledby="guide-cafes-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="guide-cafes-heading"
              className="font-serif-display text-2xl sm:text-3xl font-bold text-[#1c1613]"
            >
              Featured Bengaluru Cafes in This Guide
            </h2>
            <Link
              to="/discover"
              className="text-xs font-semibold text-[#b45309] hover:underline inline-flex items-center gap-1"
            >
              <span>Browse all cafes</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {referencedCafes.map((cafe) => (
              <LocationCard key={cafe.id} location={cafe} />
            ))}
          </div>
        </section>
      )}

      {/* FAQs */}
      {guide.faqs.length > 0 && (
        <section className="bg-white rounded-3xl border border-[#e6ddd0] p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#b45309]" aria-hidden="true" />
            <h2 className="font-serif-display text-2xl font-bold text-[#1c1613]">
              Quick Questions
            </h2>
          </div>
          <div className="space-y-3">
            {guide.faqs.map((faq) => (
              <div
                key={faq.question}
                className="p-4 rounded-2xl bg-[#faf7f2] border border-[#e6ddd0] space-y-1"
              >
                <h3 className="text-sm font-bold text-[#1c1613]">{faq.question}</h3>
                <p className="text-xs sm:text-sm text-[#5c4e45]">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Owner Claim & More Guides */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#1c1613] text-[#faf7f2] rounded-3xl p-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#f59e0b]">
            Cafe Owners &amp; Community Updates
          </p>
          <h2 className="font-serif-display text-xl font-bold text-white">
            Manage or update a Bengaluru cafe listing
          </h2>
          <p className="text-xs text-[#d6cbba] leading-relaxed">
            Spot a price change or run a neighbourhood coffee or tea shop? Submit verified menu
            updates or claim your cafe details on Cafe Desk.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              to="/submit"
              className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-[#b45309] text-white text-xs font-semibold"
            >
              <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Suggest Update</span>
            </Link>
            <Link
              to="/owners"
              className="inline-flex items-center min-h-[40px] px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold"
            >
              For Owners
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-[#e6ddd0] p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif-display text-xl font-bold text-[#1c1613]">More Guides</h2>
            <Link
              to="/guides"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#b45309] hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>All Guides</span>
            </Link>
          </div>
          <ul className="space-y-2">
            {otherGuides.map((og) => (
              <li key={og.slug}>
                <Link
                  to={`/guides/${og.slug}`}
                  className="block p-3 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] hover:border-[#b45309] text-xs font-semibold text-[#1c1613]"
                >
                  {og.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

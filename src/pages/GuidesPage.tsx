import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Calendar, Clock, MapPin } from 'lucide-react';
import { LOCAL_GUIDES } from '../config/guides';
import { LOCAL_SEO_PAGES } from '../config/seoPages';
import { useCms } from '../context/CmsContext';
import { useDocumentMeta } from '../utils/cafeHelpers';
import { buildBreadcrumbSchema } from '../utils/seoSchemas';
import { ResilientPhoto } from '../components/ResilientPhoto';

export function GuidesPage() {
  const { settings } = useCms();

  const baseOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://cafedesk.space';

  const schemas = useMemo(
    () => [
      buildBreadcrumbSchema(baseOrigin, [
        { name: 'Home', path: '/' },
        { name: 'Bengaluru Cafe Guides', path: '/guides' },
      ]),
    ],
    [baseOrigin]
  );

  useDocumentMeta(
    `Bengaluru Cafe & Workspace Guides | ${settings.brand_name}`,
    'Original Bengaluru local cafe guides covering affordable chai & filter coffee spots, study cafes with Wi-Fi, bakery snacks & Metro-accessible workspaces.',
    {
      canonicalPath: '/guides',
      ogImage: settings.seo_og_image,
      allowIndexing: settings.seo_allow_indexing,
      schemas,
      googleSiteVerification: settings.google_site_verification,
    }
  );

  const featuredLocalities = LOCAL_SEO_PAGES.filter((p) => p.group === 'locality').slice(0, 10);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-24 md:pb-16 space-y-10">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#5c4e45]">
        <Link to="/" className="hover:text-[#1c1613] font-medium">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-semibold text-[#1c1613]">Bengaluru Local Guides</span>
      </nav>

      <header className="bg-white rounded-3xl border border-[#e6ddd0] p-6 sm:p-10 space-y-4">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309]">
          <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Original Bengaluru Guides</span>
        </div>
        <h1 className="font-serif-display text-3xl sm:text-5xl font-bold text-[#1c1613] leading-tight">
          Bengaluru Cafe, Budget Tea &amp; Workspace Guides
        </h1>
        <p className="text-sm sm:text-lg text-[#5c4e45] max-w-3xl leading-relaxed">
          Practical, locally researched guides built on real Bengaluru cafe menus, Wi-Fi
          verification, Namma Metro commutes, and everyday ₹50–₹300 budgets.
        </p>
      </header>

      <section aria-label="Editorial guide articles" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {LOCAL_GUIDES.map((guide) => (
          <article
            key={guide.slug}
            className="bg-white rounded-2xl border border-[#e6ddd0] overflow-hidden flex flex-col justify-between hover:border-[#b45309]/50 transition-colors"
          >
            <div>
              <Link
                to={`/guides/${guide.slug}`}
                className="block aspect-[16/10] bg-[#f3ede3] overflow-hidden"
              >
                <ResilientPhoto
                  src={guide.coverImage}
                  alt={guide.coverAlt}
                  className="w-full h-full hover:scale-105 transition-transform duration-500"
                />
              </Link>
              <div className="p-5 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                  <span className="text-[#b45309] uppercase tracking-wider">{guide.category}</span>
                  <span className="text-[#5c4e45] inline-flex items-center gap-1 font-normal">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {guide.readTimeMinutes} min read
                  </span>
                </div>
                <h2 className="font-serif-display text-xl font-bold text-[#1c1613] leading-snug">
                  <Link to={`/guides/${guide.slug}`} className="hover:text-[#b45309] transition-colors">
                    {guide.title}
                  </Link>
                </h2>
                <p className="text-xs sm:text-sm text-[#5c4e45] leading-relaxed line-clamp-3">
                  {guide.summary}
                </p>
              </div>
            </div>
            <div className="px-5 pb-5 pt-3 border-t border-[#e6ddd0] flex items-center justify-between text-xs">
              <span className="text-[#5c4e45] inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                Updated {guide.updatedDate}
              </span>
              <Link
                to={`/guides/${guide.slug}`}
                className="font-semibold text-[#b45309] inline-flex items-center gap-1 hover:underline"
              >
                <span>Read Guide</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </section>

      <section className="bg-white rounded-3xl border border-[#e6ddd0] p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
          <h2 className="font-serif-display text-xl sm:text-2xl font-bold text-[#1c1613]">
            Browse Bengaluru Localities
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {featuredLocalities.map((loc) => (
            <Link
              key={loc.path}
              to={loc.path}
              className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-[#faf7f2] border border-[#e6ddd0] hover:border-[#b45309] text-xs font-semibold text-[#1c1613]"
            >
              {loc.h1.replace(/, Bengaluru$/, '')}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

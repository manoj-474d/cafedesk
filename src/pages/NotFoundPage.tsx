import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass, MapPin } from 'lucide-react';
import { useCms } from '../context/CmsContext';
import { useDocumentMeta } from '../utils/cafeHelpers';

export function NotFoundPage() {
  const { settings } = useCms();

  useDocumentMeta(
    `Page Not Found (404) – ${settings.brand_name}`,
    'The Bengaluru cafe page or guide you requested could not be found.',
    { allowIndexing: false }
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center space-y-6">
      <div className="bg-white rounded-3xl border border-[#e6ddd0] p-8 sm:p-12 space-y-5">
        <p className="font-mono-data text-xs font-semibold uppercase tracking-[0.2em] text-[#b45309]">
          Error 404
        </p>
        <h1 className="font-serif-display text-3xl sm:text-5xl font-bold text-[#1c1613]">
          We couldn&apos;t find that page
        </h1>
        <p className="text-sm sm:text-base text-[#5c4e45] max-w-lg mx-auto">
          The cafe URL or neighbourhood guide you opened may have moved or been unpublished. Browse
          verified Bengaluru cafes below.
        </p>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1c1613] text-white text-xs sm:text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Home</span>
          </Link>
          <Link
            to="/discover"
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] text-white text-xs sm:text-sm font-semibold"
          >
            <Compass className="w-4 h-4" aria-hidden="true" />
            <span>Explore Bengaluru Cafes</span>
          </Link>
          <Link
            to="/guides"
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] text-[#1c1613] text-xs sm:text-sm font-semibold"
          >
            <span>Local Guides</span>
          </Link>
        </div>

        <div className="pt-5 border-t border-[#e6ddd0] flex flex-wrap justify-center gap-2 text-xs">
          {[
            { label: 'Koramangala', to: '/cafes-in-koramangala' },
            { label: 'Indiranagar', to: '/cafes-in-indiranagar' },
            { label: 'HSR Layout', to: '/cafes-in-hsr-layout' },
            { label: 'Affordable Cafes', to: '/affordable-cafes-in-bengaluru' },
            { label: 'Tea Shops', to: '/tea-shops-in-bengaluru' },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#faf7f2] border border-[#e6ddd0] hover:border-[#b45309] text-[#5c4e45] hover:text-[#1c1613] font-medium"
            >
              <MapPin className="w-3 h-3 text-[#b45309]" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  Check,
  FolderOpen,
  Lock,
  MapPin,
  Share2,
  Star,
  Wifi,
} from 'lucide-react';
import { resolveApiUrl, getUserAuthHeaders, useAuth } from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import type { CafeLibrarySnapshot } from '../types/subscription';
import { useDocumentMeta } from '../utils/cafeHelpers';

interface PublicSharedCollectionPayload {
  name: string;
  description: string;
  share_slug: string;
  ownerFirstName: string;
  created_at: number;
  updated_at: number;
  pricingUnlocked: boolean;
  items: Array<{
    cafe_key: string;
    added_at: number;
    snapshot: CafeLibrarySnapshot;
  }>;
}

export function SharedCollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { settings } = useCms();
  const { openUpgradeModal, isSubscribed } = useAuth();

  const [collection, setCollection] = useState<PublicSharedCollectionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError('Invalid collection link.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');

    void (async () => {
      try {
        const res = await fetch(resolveApiUrl(`/api/collections/${encodeURIComponent(slug)}`), {
          credentials: 'include',
          headers: await getUserAuthHeaders(),
        });
        const data = (await res.json().catch(() => ({}))) as {
          collection?: PublicSharedCollectionPayload;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.collection) {
          setError(data.error || 'This cafe collection could not be found or is private.');
          setCollection(null);
        } else {
          setCollection(data.collection);
        }
      } catch {
        if (!cancelled) setError('Network error loading shared cafe list.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, isSubscribed]);

  useDocumentMeta(
    collection
      ? `${collection.name} · Curated by ${collection.ownerFirstName} | ${settings.brand_name}`
      : `Shared Cafe Collection | ${settings.brand_name}`,
    collection?.description ||
      'Browse a community-curated Bengaluru cafe list shared on Cafe Desk.',
    {
      canonicalPath: slug ? `/collections/${encodeURIComponent(slug)}` : undefined,
      allowIndexing: Boolean(collection && settings.seo_allow_indexing),
    }
  );

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2200);
    } catch {
      // Ignore clipboard failures in restricted environments
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#e6ddd0] border-t-[#b45309] animate-spin mx-auto" />
        <p className="text-sm text-[#5c4e45]">Loading shared Bengaluru cafe list…</p>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-[#fef3c7] border border-[#fde68a] text-[#b45309] flex items-center justify-center mx-auto">
          <FolderOpen className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="font-serif-display text-3xl font-bold text-[#1c1613]">
          Collection Not Available
        </h1>
        <p className="text-sm text-[#5c4e45]">
          {error || 'This shared cafe list was removed or switched back to private.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/locations"
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <span>Explore Bengaluru Cafes</span>
          </Link>
          <Link
            to="/"
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white border border-[#e6ddd0] text-[#1c1613] text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/locations"
          className="inline-flex items-center gap-1.5 min-h-[40px] text-xs font-semibold text-[#5c4e45] hover:text-[#1c1613]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>All Bengaluru Cafes</span>
        </Link>
        <button
          type="button"
          onClick={() => void handleCopyShareLink()}
          className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-[#e6ddd0] hover:border-[#b45309] text-xs font-semibold text-[#1c1613] transition-colors"
        >
          {copiedUrl ? (
            <Check className="w-3.5 h-3.5 text-[#1b4d3e]" aria-hidden="true" />
          ) : (
            <Share2 className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
          )}
          <span>{copiedUrl ? 'Share Link Copied!' : 'Copy Collection Link'}</span>
        </button>
      </div>

      <header className="rounded-2xl bg-white border border-[#e6ddd0] p-6 sm:p-8 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#b45309] font-semibold uppercase tracking-[0.14em]">
          <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Public Cafe Collection · Curated by {collection.ownerFirstName}</span>
        </div>
        <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#1c1613]">
          {collection.name}
        </h1>
        {collection.description && (
          <p className="text-sm sm:text-base text-[#5c4e45] max-w-2xl leading-relaxed">
            {collection.description}
          </p>
        )}
        <p className="text-xs font-mono-data text-[#5c4e45]">
          {collection.items.length} {collection.items.length === 1 ? 'cafe' : 'cafes'} · Updated{' '}
          {new Date(collection.updated_at).toLocaleDateString('en-IN')}
        </p>

        {!collection.pricingUnlocked && (
          <div className="mt-3 p-3.5 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-[#5c4e45] inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
              <span>
                Menu &amp; spend prices are hidden on public previews. Sign in with Cafe Desk Plus (₹79/mo) to unlock verified ₹ pricing.
              </span>
            </span>
            <button
              type="button"
              onClick={() =>
                openUpgradeModal({
                  featureName: 'Verified Menu & Cost Details',
                  requiredPlan: 'plus',
                })
              }
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#b45309] hover:bg-[#92400e] text-white font-semibold"
            >
              Unlock ₹79/mo
            </button>
          </div>
        )}
      </header>

      {collection.items.length === 0 ? (
        <div className="rounded-2xl bg-white border border-dashed border-[#d6cbba] p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-[#1c1613]">No cafes added to this list yet.</p>
          <p className="text-xs text-[#5c4e45]">
            Check back soon or explore our verified Bengaluru cafe directory.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collection.items.map((item) => {
            const snap = item.snapshot;
            const detailPath = `/cafe/${encodeURIComponent(snap.slug || item.cafe_key)}`;
            return (
              <article
                key={item.cafe_key}
                className="rounded-2xl bg-white border border-[#e6ddd0] p-5 flex flex-col justify-between gap-4 hover:border-[#b45309] transition-colors"
              >
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#b45309]">{snap.area || 'Bengaluru'}</p>
                  <h2 className="font-serif-display text-xl font-bold text-[#1c1613]">
                    <Link to={detailPath} className="hover:text-[#b45309] transition-colors">
                      {snap.name}
                    </Link>
                  </h2>
                  {snap.address && (
                    <p className="text-xs text-[#5c4e45] line-clamp-2 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#8c7a6b]" />
                      <span>{snap.address}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-[#5c4e45] font-mono-data tabular-nums">
                    {snap.rating !== null && snap.rating !== undefined && (
                      <span className="inline-flex items-center gap-1 font-semibold text-[#1c1613]">
                        <Star className="w-3.5 h-3.5 text-[#d97706] fill-[#d97706]" />
                        {Number(snap.rating).toFixed(1)}
                      </span>
                    )}
                    {snap.wifi_available === 'yes' && (
                      <span className="inline-flex items-center gap-1 text-[#1b4d3e] font-semibold">
                        <Wifi className="w-3.5 h-3.5" />
                        Wi-Fi
                      </span>
                    )}
                    {collection.pricingUnlocked &&
                      snap.avg_cost_per_person !== null &&
                      snap.avg_cost_per_person !== undefined && (
                        <span>~₹{snap.avg_cost_per_person}/person</span>
                      )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#e6ddd0]">
                  <Link
                    to={detailPath}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1c1613] hover:bg-[#b45309] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>Open Cafe Guide</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                  {snap.map_link && (
                    <a
                      href={snap.map_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[40px] px-3 py-2 rounded-xl bg-[#faf7f2] border border-[#e6ddd0] hover:border-[#b45309] text-xs font-semibold text-[#1c1613] inline-flex items-center gap-1"
                    >
                      <span>Maps</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

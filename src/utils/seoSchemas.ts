import type { LocalGuideArticle } from '../config/guides';
import type { SeoPageFaq } from '../config/seoPages';
import type { LocationItem, SiteSettings } from '../types/cms';

export function toAbsoluteSeoUrl(baseUrl: string, pathOrUrl: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  if (!pathOrUrl) return `${cleanBase}/`;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${cleanBase}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

export function buildOrganizationSchema(baseUrl: string, settings: Pick<SiteSettings, 'brand_name' | 'seo_home_description' | 'instagram_url' | 'twitter_url' | 'linkedin_url' | 'contact_email' | 'seo_og_image'>) {
  const sameAs = [settings.instagram_url, settings.twitter_url, settings.linkedin_url]
    .map((u) => (u || '').trim())
    .filter((u) => /^https?:\/\//i.test(u));

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings.brand_name || 'Cafe Desk',
    url: toAbsoluteSeoUrl(baseUrl, '/'),
    description:
      settings.seo_home_description ||
      'Bengaluru cafe discovery platform for affordable coffee & tea spots, quiet study tables, and work-friendly Wi-Fi cafes.',
    logo: toAbsoluteSeoUrl(baseUrl, settings.seo_og_image || '/src/assets/images/hero_cafedesk_interior_1794976059561.jpg'),
    ...(settings.contact_email ? { email: settings.contact_email } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

export function buildWebSiteSchema(baseUrl: string, brandName = 'Cafe Desk') {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: brandName,
    url: `${cleanBase}/`,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${cleanBase}/discover?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildBreadcrumbSchema(
  baseUrl: string,
  items: Array<{ name: string; path: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: toAbsoluteSeoUrl(baseUrl, item.path),
    })),
  };
}

export function buildFaqSchema(faqs: SeoPageFaq[]) {
  if (!faqs || faqs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function buildItemListSchema(
  baseUrl: string,
  name: string,
  description: string,
  cafes: LocationItem[]
) {
  if (!cafes || cafes.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    description,
    numberOfItems: cafes.length,
    itemListElement: cafes.slice(0, 20).map((cafe, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: `${cafe.name} (${cafe.area})`,
      url: toAbsoluteSeoUrl(baseUrl, `/cafe/${encodeURIComponent(cafe.slug || cafe.id)}`),
    })),
  };
}

export function buildCafeSchema(baseUrl: string, cafe: LocationItem) {
  // Never emit curated LocalBusiness/CafeOrCoffeeShop schema for ephemeral Google-only routes
  if (cafe.isLiveGooglePlace || !cafe.name || !cafe.address) return null;

  const canonicalUrl = toAbsoluteSeoUrl(baseUrl, `/cafe/${encodeURIComponent(cafe.slug || cafe.id)}`);
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    '@id': `${canonicalUrl}#cafe`,
    name: cafe.name,
    url: canonicalUrl,
    description:
      cafe.verdict ||
      cafe.description ||
      `${cafe.name} in ${cafe.area}, ${cafe.city || 'Bengaluru'}.`,
    servesCuisine: ['Coffee', 'Tea', 'Cafe Snacks'],
    address: {
      '@type': 'PostalAddress',
      streetAddress: cafe.address,
      addressLocality: cafe.area || cafe.city || 'Bengaluru',
      addressRegion: 'Karnataka',
      addressCountry: 'IN',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
  };

  if (cafe.photos_approved && cafe.photos.length > 0) {
    schema.image = toAbsoluteSeoUrl(baseUrl, cafe.photos[0]);
  }
  if (cafe.lat !== null && cafe.lng !== null) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: cafe.lat,
      longitude: cafe.lng,
    };
  }
  if (cafe.phone) {
    schema.telephone = cafe.phone;
  }
  if (cafe.website_url && /^https?:\/\//i.test(cafe.website_url)) {
    schema.sameAs = [cafe.website_url, cafe.instagram_url]
      .map((u) => (u || '').trim())
      .filter((u) => /^https?:\/\//i.test(u));
  }
  if (cafe.price_range) {
    schema.priceRange = cafe.price_range;
  }
  // Only emit aggregateRating if real verified rating + count exist (never invent ratings!)
  if (cafe.rating !== null && cafe.rating_count !== null && cafe.rating_count > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(cafe.rating.toFixed(1)),
      reviewCount: cafe.rating_count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return schema;
}

export function buildArticleSchema(
  baseUrl: string,
  guide: LocalGuideArticle,
  brandName = 'Cafe Desk'
) {
  const url = toAbsoluteSeoUrl(baseUrl, `/guides/${guide.slug}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.metaDescription,
    image: toAbsoluteSeoUrl(baseUrl, guide.coverImage),
    datePublished: guide.publishedDate,
    dateModified: guide.updatedDate,
    author: {
      '@type': 'Organization',
      name: guide.authorName,
      url: toAbsoluteSeoUrl(baseUrl, '/about'),
    },
    publisher: {
      '@type': 'Organization',
      name: brandName,
      url: toAbsoluteSeoUrl(baseUrl, '/'),
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };
}

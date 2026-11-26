declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initializedGaId = '';

export function isValidGa4Id(id: string | undefined | null): boolean {
  if (!id) return false;
  return /^(G|AW|GT)-[A-Z0-9]{4,20}$/i.test(id.trim());
}

export function initAnalyticsIfConfigured(measurementId: string | undefined | null): boolean {
  if (typeof window === 'undefined' || !isValidGa4Id(measurementId)) return false;
  const cleanId = measurementId!.trim();
  if (initializedGaId === cleanId && typeof window.gtag === 'function') {
    return true;
  }

  initializedGaId = cleanId;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
  }
  window.gtag('js', new Date());
  window.gtag('config', cleanId, {
    send_page_view: false,
    anonymize_ip: true,
  });

  if (!document.querySelector(`script[data-ga-id="${cleanId}"]`)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cleanId)}`;
    script.setAttribute('data-ga-id', cleanId);
    document.head.appendChild(script);
  }

  return true;
}

export function trackPageView(path: string, title?: string): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function' || !initializedGaId) {
    return;
  }
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href,
  });
}

export function trackAnalyticsEvent(
  eventName:
    | 'cafe_view'
    | 'directions_click'
    | 'search_query'
    | 'membership_cta'
    | 'landing_page_view'
    | 'guide_view',
  params?: Record<string, string | number | boolean>
): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function' || !initializedGaId) {
    return;
  }
  window.gtag('event', eventName, params || {});
}

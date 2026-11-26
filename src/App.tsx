import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import { MotionConfig } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { CmsProvider } from './context/CmsContext';
import { DiscoveryProvider } from './context/DiscoveryContext';
import { LOCAL_SEO_PAGES } from './config/seoPages';
import { trackPageView } from './utils/analytics';
import { CompareCafesDrawer } from './components/CompareCafesDrawer';
import { PublicLayout } from './components/PublicLayout';
import { RazorpayCheckoutModal } from './components/RazorpayCheckoutModal';
import { SuggestIdeaModal } from './components/SuggestIdeaModal';
import { UpgradeModal } from './components/UpgradeModal';
import { HomePage } from './pages/HomePage';

// Route-split secondary pages so the mobile initial bundle stays lean and fast
const LocationsPage = lazy(() =>
  import('./pages/LocationsPage').then((m) => ({ default: m.LocationsPage }))
);
const LocationDetailPage = lazy(() =>
  import('./pages/LocationDetailPage').then((m) => ({ default: m.LocationDetailPage }))
);
const CafeFinderPage = lazy(() =>
  import('./pages/CafeFinderPage').then((m) => ({ default: m.CafeFinderPage }))
);
const AboutPage = lazy(() =>
  import('./pages/AboutPage').then((m) => ({ default: m.AboutPage }))
);
const PricingPage = lazy(() =>
  import('./pages/PricingPage').then((m) => ({ default: m.PricingPage }))
);
const AuthPage = lazy(() =>
  import('./pages/AuthPage').then((m) => ({ default: m.AuthPage }))
);
const AccountPage = lazy(() =>
  import('./pages/AccountPage').then((m) => ({ default: m.AccountPage }))
);
const ContactPage = lazy(() =>
  import('./pages/ContactPage').then((m) => ({ default: m.ContactPage }))
);
const SubmitCafePage = lazy(() =>
  import('./pages/SubmitCafePage').then((m) => ({ default: m.SubmitCafePage }))
);
const OwnersPage = lazy(() =>
  import('./pages/OwnersPage').then((m) => ({ default: m.OwnersPage }))
);
const LocalSeoLandingPage = lazy(() =>
  import('./pages/LocalSeoLandingPage').then((m) => ({ default: m.LocalSeoLandingPage }))
);
const GuidesPage = lazy(() =>
  import('./pages/GuidesPage').then((m) => ({ default: m.GuidesPage }))
);
const GuideDetailPage = lazy(() =>
  import('./pages/GuideDetailPage').then((m) => ({ default: m.GuideDetailPage }))
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);
const AdminLoginPage = lazy(() =>
  import('./pages/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage }))
);
const AdminDashboardPage = lazy(() =>
  import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function RouteTracker() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      trackPageView(`${pathname}${search}`, document.title);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [pathname, search]);
  return null;
}

function PageRouteFallback() {
  return (
    <div className="min-h-[55vh] flex flex-col items-center justify-center px-4 text-center bg-[#faf7f2] text-[#5c4e45] gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-[#e6ddd0] border-t-[#b45309] animate-spin" />
      <p className="text-xs font-medium tracking-wide">Loading Cafe Desk…</p>
    </div>
  );
}

export const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

function AppRoutes() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <RouteTracker />
      <Suspense fallback={<PageRouteFallback />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/discover" element={<LocationsPage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/locations/:slug" element={<LocationDetailPage />} />
            <Route path="/cafe/:id" element={<LocationDetailPage />} />
            <Route path="/finder" element={<CafeFinderPage />} />
            <Route path="/guides" element={<GuidesPage />} />
            <Route path="/guides/:slug" element={<GuideDetailPage />} />
            {LOCAL_SEO_PAGES.map((page) => (
              <Route key={page.path} path={page.path} element={<LocalSeoLandingPage />} />
            ))}
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/signup" element={<AuthPage />} />
            <Route path="/forgot-password" element={<AuthPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/submit" element={<SubmitCafePage />} />
            <Route path="/owners" element={<OwnersPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
        </Routes>
      </Suspense>
      <SuggestIdeaModal />
      <CompareCafesDrawer />
      <UpgradeModal />
      <RazorpayCheckoutModal />
    </BrowserRouter>
  );
}

export function App() {
  const [quotaBannerVisible, setQuotaBannerVisible] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setQuotaBannerVisible(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  const inner = (
    <MotionConfig reducedMotion="user">
      <CmsProvider>
        <AuthProvider>
          <DiscoveryProvider>
            {quotaBannerVisible && (
              <div
                role="alert"
                className="sticky top-0 z-[60] bg-[#fffbeb] border-b border-[#fde68a] text-[#92400e] px-4 py-2.5 text-xs sm:text-sm"
              >
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-[#b45309]" aria-hidden="true" />
                    <p className="truncate sm:whitespace-normal">
                      Live Google Maps quota limit reached.{' '}
                      <a
                        href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold underline underline-offset-2 text-[#1c1613]"
                      >
                        Learn how to upgrade your Maps API key
                      </a>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuotaBannerVisible(false)}
                    aria-label="Dismiss Maps quota notice"
                    className="w-7 h-7 rounded-lg hover:bg-[#fef3c7] flex items-center justify-center shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
            <AppRoutes />
          </DiscoveryProvider>
        </AuthProvider>
      </CmsProvider>
    </MotionConfig>
  );

  if (!GOOGLE_MAPS_API_KEY) {
    return inner;
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
      {inner}
    </APIProvider>
  );
}

export default App;

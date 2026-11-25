import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import { MotionConfig } from 'motion/react';
import { AuthProvider } from './context/AuthContext';
import { CmsProvider } from './context/CmsContext';
import { DiscoveryProvider } from './context/DiscoveryContext';
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
      <Suspense fallback={<PageRouteFallback />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/locations/:slug" element={<LocationDetailPage />} />
            <Route path="/cafe/:id" element={<LocationDetailPage />} />
            <Route path="/finder" element={<CafeFinderPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/signup" element={<AuthPage />} />
            <Route path="/forgot-password" element={<AuthPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/submit" element={<SubmitCafePage />} />
            <Route path="/owners" element={<OwnersPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
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
  const inner = (
    <MotionConfig reducedMotion="user">
      <CmsProvider>
        <AuthProvider>
          <DiscoveryProvider>
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

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import { MotionConfig } from 'motion/react';
import { AuthProvider } from './context/AuthContext';
import { CmsProvider } from './context/CmsContext';
import { DiscoveryProvider } from './context/DiscoveryContext';
import { PublicLayout } from './components/PublicLayout';
import { HomePage } from './pages/HomePage';
import { CafeFinderPage } from './pages/CafeFinderPage';
import { LocationsPage } from './pages/LocationsPage';
import { LocationDetailPage } from './pages/LocationDetailPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { SubmitCafePage } from './pages/SubmitCafePage';
import { OwnersPage } from './pages/OwnersPage';
import { PricingPage } from './pages/PricingPage';
import { AuthPage } from './pages/AuthPage';
import { AccountPage } from './pages/AccountPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Public Customer-Facing Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/finder" element={<CafeFinderPage />} />
          <Route path="/locations" element={<LocationsPage />} />
          <Route path="/cafes" element={<LocationsPage />} />
          <Route path="/locations/:slug" element={<LocationDetailPage />} />
          <Route path="/cafe/:id" element={<LocationDetailPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/plans" element={<PricingPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage />} />
          <Route path="/forgot-password" element={<AuthPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/submit" element={<SubmitCafePage />} />
          <Route path="/owners" element={<OwnersPage />} />
        </Route>

        {/* Administrator Portal Routes */}
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  const appTree = (
    <AuthProvider>
      <DiscoveryProvider>
        {quotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}
        <AppRoutes />
      </DiscoveryProvider>
    </AuthProvider>
  );

  return (
    <MotionConfig reducedMotion="user">
      <CmsProvider>
        {GOOGLE_MAPS_API_KEY ? (
          <APIProvider
            apiKey={GOOGLE_MAPS_API_KEY}
            libraries={['places', 'marker']}
            language="en"
            region="IN"
          >
            {appTree}
          </APIProvider>
        ) : (
          appTree
        )}
      </CmsProvider>
    </MotionConfig>
  );
}

import React, { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  Crown,
  Instagram,
  LocateFixed,
  Mail,
  Menu,
  MessageCircle,
  Phone,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import { buildWhatsAppUrl } from '../utils/cafeHelpers';
import { CompareCafesDrawer } from './CompareCafesDrawer';
import { RazorpayCheckoutModal } from './RazorpayCheckoutModal';
import { SuggestIdeaModal } from './SuggestIdeaModal';
import { UpgradeModal } from './UpgradeModal';

export function PublicLayout() {
  const { settings, navigation } = useCms();
  const { authenticated, user, tier } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const headerLinks = navigation.filter((n) => n.location === 'header' && n.visible);
  const footerLinks = navigation.filter((n) => n.location === 'footer' && n.visible);

  const waUrl = buildWhatsAppUrl(
    `Hi ${settings.brand_name}! I would like to ask about a work or study cafe in Bengaluru.`,
    settings.whatsapp_number
  );

  const nowMs = Date.now();
  const bannerStartMs = settings.banner_start_at ? Date.parse(settings.banner_start_at) : NaN;
  const bannerEndMs = settings.banner_end_at ? Date.parse(settings.banner_end_at) : NaN;
  const bannerInWindow =
    (!Number.isFinite(bannerStartMs) || nowMs >= bannerStartMs) &&
    (!Number.isFinite(bannerEndMs) || nowMs <= bannerEndMs);

  return (
    <div className="min-h-screen flex flex-col bg-[#faf7f2] text-[#1c1613]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#1c1613] focus:text-[#faf7f2] focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      {/* Optional Admin-Controlled Announcement Banner */}
      {settings.banner_enabled && settings.banner_text && bannerInWindow && (
        <div className="bg-[#1c1613] text-[#faf7f2] text-xs sm:text-sm py-2 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-center flex-wrap">
            <span className="font-medium text-[#faf7f2]/90">{settings.banner_text}</span>
            {settings.banner_link && (
              <Link
                to={settings.banner_link}
                className="font-semibold text-[#f59e0b] hover:underline whitespace-nowrap"
              >
                {settings.banner_cta_label || 'Explore Cafes'} &rarr;
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 3-Zone Top Bar Contract: [Brand Wordmark] — [Nav Links] — [Account & Primary Action] */}
      <header className="sticky top-0 z-40 bg-[#faf7f2]/95 backdrop-blur-md border-b border-[#e6ddd0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          {/* Zone 1: Single clean Brand Title */}
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0"
          >
            {settings.logo_url && (
              <img
                src={settings.logo_url}
                alt={settings.brand_name}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-md object-cover border border-[#e6ddd0]"
              />
            )}
            <span className="font-serif-display text-2xl font-bold tracking-tight text-[#1c1613]">
              {settings.brand_name}
            </span>
          </Link>

          {/* Zone 2: Dynamic Single-Line Nav Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-[#5c4e45]"
          >
            {headerLinks.map((item) =>
              item.is_external ? (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#1c1613] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
                >
                  {item.label}
                </a>
              ) : (
                <NavLink
                  key={item.id}
                  to={item.url}
                  className={({ isActive }) =>
                    `hover:text-[#1c1613] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                      isActive ? 'text-[#1c1613] font-semibold underline underline-offset-4' : ''
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              )
            )}
          </nav>

          {/* Zone 3: Member Account / Sign In + Primary Discovery CTA + Mobile Toggle */}
          <div className="flex items-center gap-2.5 shrink-0">
            {authenticated && user ? (
              <Link
                to="/account"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#d6cbba] bg-white hover:border-[#b45309] text-xs font-semibold text-[#1c1613] transition-colors whitespace-nowrap"
              >
                {tier === 'premium' ? (
                  <Crown className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                ) : tier === 'plus' ? (
                  <Sparkles className="w-3.5 h-3.5 text-[#1b4d3e]" aria-hidden="true" />
                ) : (
                  <User className="w-3.5 h-3.5 text-[#5c4e45]" aria-hidden="true" />
                )}
                <span className="max-w-[100px] truncate">{user.name.split(' ')[0]}</span>
                {tier === 'premium' || tier === 'plus' ? (
                  <span className="text-[11px] font-bold text-[#b45309] whitespace-nowrap">
                    Plus
                  </span>
                ) : null}
              </Link>
            ) : (
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#d6cbba] bg-white hover:border-[#b45309] text-xs font-semibold text-[#1c1613] transition-colors whitespace-nowrap"
              >
                <User className="w-3.5 h-3.5 text-[#5c4e45]" aria-hidden="true" />
                <span>Sign In</span>
              </Link>
            )}

            <Link
              to={settings.hero_cta_secondary_link || '/locations?nearby=1'}
              style={{ backgroundColor: settings.accent_color || '#b45309' }}
              className="hidden sm:inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
            >
              <LocateFixed className="w-4 h-4" aria-hidden="true" />
              <span>{settings.hero_cta_secondary_label || 'Find Near Me'}</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-[#e6ddd0] bg-white text-[#1c1613]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="md:hidden border-t border-[#e6ddd0] bg-[#faf7f2] px-4 py-4 space-y-2"
          >
            {headerLinks.map((item) => (
              <Link
                key={item.id}
                to={item.url}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center min-h-[44px] px-3 rounded-lg text-base font-semibold text-[#1c1613] hover:bg-[#f3ede3]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to={authenticated ? '/account' : '/login'}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 min-h-[44px] px-3 rounded-lg text-base font-semibold text-[#1c1613] hover:bg-[#f3ede3]"
            >
              <User className="w-4 h-4 text-[#b45309]" />
              <span>
                {authenticated && user
                  ? `${user.name} (${tier === 'free' ? 'FREE' : 'PLUS'})`
                  : 'Sign In / Join Free'}
              </span>
            </Link>
            <div className="pt-2">
              <Link
                to={settings.hero_cta_secondary_link || '/locations?nearby=1'}
                onClick={() => setMobileMenuOpen(false)}
                style={{ backgroundColor: settings.accent_color || '#b45309' }}
                className="flex items-center justify-center gap-2 min-h-[44px] w-full rounded-lg text-white text-sm font-semibold"
              >
                <LocateFixed className="w-4 h-4" aria-hidden="true" />
                <span>{settings.hero_cta_secondary_label || 'Find Near Me'}</span>
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      {/* Global Subscription Modals, Comparison Tray & Floating Suggestion Button */}
      <UpgradeModal />
      <RazorpayCheckoutModal />
      <CompareCafesDrawer />
      <SuggestIdeaModal />

      {/* Premium Brand Footer */}
      <footer className="bg-[#1c1613] text-[#faf7f2] border-t border-[#2e241f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            <div className="md:col-span-5 space-y-3">
              <p className="font-serif-display text-2xl font-bold text-[#faf7f2]">
                {settings.brand_name}
              </p>
              <p className="text-sm text-[#faf7f2]/75 max-w-sm leading-relaxed">
                {settings.brand_tagline}. {settings.business_address}
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-[#faf7f2]/80">
                <a
                  href={`tel:${settings.contact_phone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{settings.contact_phone}</span>
                </a>
                <a
                  href={`mailto:${settings.contact_email}`}
                  className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{settings.contact_email}</span>
                </a>
              </div>
            </div>

            <div className="md:col-span-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#faf7f2]/60">
                Explore
              </p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm text-[#faf7f2]/85">
                {footerLinks.map((item) => (
                  <li key={item.id}>
                    {item.is_external ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white transition-colors"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link to={item.url} className="hover:text-white transition-colors">
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#faf7f2]/60">
                Connect
              </p>
              <div className="flex flex-col gap-2.5 text-sm text-[#faf7f2]/85">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-white transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-[#34d399]" aria-hidden="true" />
                  <span>WhatsApp Concierge</span>
                </a>
                {settings.instagram_url && (
                  <a
                    href={settings.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 hover:text-white transition-colors"
                  >
                    <Instagram className="w-4 h-4 text-[#f59e0b]" aria-hidden="true" />
                    <span>{settings.instagram_handle || 'Instagram'}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#faf7f2]/60">
            <p>{settings.footer_copyright}</p>
            <p>{settings.business_legal_name}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Compass,
  Crown,
  Home,
  Instagram,
  Lightbulb,
  LocateFixed,
  Mail,
  Map as MapIcon,
  Menu,
  MessageCircle,
  Phone,
  Search,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCms } from '../context/CmsContext';
import { buildWhatsAppUrl } from '../utils/cafeHelpers';
import { CafeAutocompleteSearch } from './CafeAutocompleteSearch';

export function PublicLayout() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const { settings, navigation } = useCms();
  const { authenticated, user, tier, isSubscribed, isExpired, isSuspended } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState('');

  const headerLinks = navigation.filter((n) => n.location === 'header' && n.visible);
  const footerLinks = navigation.filter((n) => n.location === 'footer' && n.visible);

  // On cafe detail pages, LocationDetailPage renders its own contextual sticky bottom bar.
  const isDetailRoute = /^\/(?:locations|cafe)\/[^/]+/.test(pathname);
  const showBottomNav = !isDetailRoute;

  const isMapView =
    (pathname === '/discover' || pathname === '/locations' || pathname === '/cafes') &&
    search.includes('view=map');
  const isHomeActive = pathname === '/';
  const isExploreActive =
    ((pathname === '/discover' || pathname === '/locations' || pathname === '/cafes') &&
      !isMapView) ||
    pathname === '/finder';
  const isMapActive = isMapView;
  const isSavedActive = pathname === '/account' && hash === '#saved';
  const isAccountActive =
    (pathname === '/account' && hash !== '#saved') ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/partner-portal';

  const openSuggestModal = () => {
    setMobileMenuOpen(false);
    window.dispatchEvent(new CustomEvent('cafedesk:open-suggest-idea'));
  };

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickSearchQuery.trim();
    setQuickSearchOpen(false);
    navigate(clean ? `/discover?q=${encodeURIComponent(clean)}&live=1` : '/discover');
  };

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

  const mobileTabs = [
    {
      id: 'home',
      label: 'Home',
      to: '/',
      active: isHomeActive,
      icon: Home,
    },
    {
      id: 'explore',
      label: 'Explore',
      to: '/discover',
      active: isExploreActive,
      icon: Compass,
    },
    {
      id: 'map',
      label: 'Map',
      to: '/discover?view=map',
      active: isMapActive,
      icon: MapIcon,
    },
    {
      id: 'saved',
      label: 'Saved',
      to: authenticated ? '/account#saved' : '/login?next=%2Faccount%23saved',
      active: isSavedActive,
      icon: Bookmark,
    },
    {
      id: 'account',
      label: authenticated ? 'Account' : 'Sign In',
      to: authenticated ? '/account' : '/login',
      active: isAccountActive,
      icon: User,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#faf7f2] text-[#1c1613] overflow-x-clip">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-[#b45309] focus:text-white focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      {/* Optional Admin-Controlled Announcement Banner (hidden on mobile to preserve <=15% sticky chrome budget) */}
      {settings.banner_enabled && settings.banner_text && bannerInWindow && (
        <div
          className={`bg-[#1c1613] text-[#faf7f2] border-b border-[#312722] text-xs sm:text-sm py-2 px-4 hidden md:block`}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 sm:gap-3 text-center flex-wrap">
            <span className="font-medium text-[#faf7f2] line-clamp-1 sm:line-clamp-none">
              {settings.banner_text}
            </span>
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

      {/* Editorial Warm Top Header */}
      <header className="sticky top-0 z-40 bg-[#faf7f2]/95 backdrop-blur-md border-b border-[#e6ddd0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-3 md:gap-6">
          {/* Brand Title */}
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
                className="w-8 h-8 rounded-lg object-cover border border-[#e6ddd0] shrink-0"
              />
            )}
            <span className="font-serif-display text-xl sm:text-2xl font-bold tracking-tight text-[#1c1613]">
              {settings.brand_name}
            </span>
          </Link>

          {/* Desktop Single-Line Nav Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-5 lg:gap-6 text-sm font-medium text-[#5c4e45]"
          >
            {headerLinks.map((item) =>
              item.is_external ? (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#1c1613] transition-colors whitespace-nowrap shrink-0"
                >
                  {item.label}
                </a>
              ) : (
                <NavLink
                  key={item.id}
                  to={item.url}
                  className={({ isActive }) =>
                    `hover:text-[#1c1613] transition-colors whitespace-nowrap shrink-0 px-2.5 py-1.5 rounded-lg ${
                      isActive ? 'text-[#b45309] bg-[#fef3c7]/70 font-semibold' : ''
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              )
            )}
          </nav>

          {/* Quick Search + Account + Near Me CTA */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setQuickSearchOpen(true)}
              aria-label="Search Bengaluru cafes"
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-[#e6ddd0] bg-white text-[#5c4e45] hover:text-[#1c1613] hover:border-[#b45309] transition-colors"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
            </button>

            {authenticated && user ? (
              <Link
                to="/account"
                className="hidden sm:inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl border border-[#e6ddd0] bg-white text-xs font-semibold text-[#1c1613] hover:border-[#b45309] transition-colors whitespace-nowrap"
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover border border-[#e6ddd0] shrink-0"
                  />
                ) : isSubscribed && tier === 'premium' ? (
                  <Crown className="w-3.5 h-3.5 text-[#b45309]" aria-hidden="true" />
                ) : isSubscribed ? (
                  <Sparkles className="w-3.5 h-3.5 text-[#1b4d3e]" aria-hidden="true" />
                ) : (
                  <User className="w-3.5 h-3.5 text-[#5c4e45]" aria-hidden="true" />
                )}
                <span className="max-w-[90px] truncate">{user.name.split(' ')[0]}</span>
                {isExpired ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]">
                    Expired
                  </span>
                ) : isSuspended ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                    Paused
                  </span>
                ) : isSubscribed ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#ecfdf5] text-[#1b4d3e] border border-[#a7f3d0]">
                    Plus
                  </span>
                ) : null}
              </Link>
            ) : (
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border border-[#e6ddd0] bg-white text-xs font-semibold text-[#1c1613] hover:border-[#b45309] transition-colors whitespace-nowrap"
              >
                <User className="w-3.5 h-3.5 text-[#5c4e45]" aria-hidden="true" />
                <span>Sign In</span>
              </Link>
            )}

            <Link
              to={settings.hero_cta_secondary_link || '/locations?nearby=1'}
              className="hidden lg:inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <LocateFixed className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{settings.hero_cta_secondary_label || 'Find Near Me'}</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-[#e6ddd0] bg-white text-[#1c1613]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Secondary Menu Drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="md:hidden border-t border-[#e6ddd0] bg-[#faf7f2] px-4 py-3 space-y-1 max-h-[75vh] overflow-y-auto"
          >
            {headerLinks.map((item) => (
              <Link
                key={item.id}
                to={item.url}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center min-h-[44px] px-3 rounded-xl hover:bg-white text-sm font-medium text-[#1c1613]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/finder"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center min-h-[44px] px-3 rounded-xl text-sm font-medium text-[#1c1613] hover:bg-white"
            >
              Smart Cafe Finder
            </Link>
            <Link
              to="/guides"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center min-h-[44px] px-3 rounded-xl text-sm font-medium text-[#1c1613] hover:bg-white"
            >
              Bengaluru Local Guides
            </Link>
            <Link
              to="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center min-h-[44px] px-3 rounded-xl text-sm font-medium text-[#1c1613] hover:bg-white"
            >
              Membership Plans
            </Link>
            <Link
              to="/submit"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center min-h-[44px] px-3 rounded-xl text-sm font-medium text-[#1c1613] hover:bg-white"
            >
              Suggest a Cafe
            </Link>
            <Link
              to="/owners"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center min-h-[44px] px-3 rounded-xl text-sm font-medium text-[#1c1613] hover:bg-white"
            >
              For Cafe Owners
            </Link>
            <Link
              to="/partner-portal"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center min-h-[44px] px-3 rounded-xl text-sm font-medium text-[#b45309] hover:bg-white"
            >
              Cafe Partner Portal
            </Link>
            <button
              type="button"
              onClick={openSuggestModal}
              className="w-full flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-sm font-medium text-[#1c1613] hover:bg-white text-left"
            >
              <Lightbulb className="w-4 h-4 text-[#b45309]" aria-hidden="true" />
              <span>Suggest an Idea</span>
            </button>
            <div className="pt-2">
              <Link
                to={settings.hero_cta_secondary_link || '/locations?nearby=1'}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 min-h-[44px] w-full rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-sm font-semibold"
              >
                <LocateFixed className="w-4 h-4" aria-hidden="true" />
                <span>{settings.hero_cta_secondary_label || 'Find Near Me'}</span>
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      {/* Quick Search Modal */}
      {quickSearchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quick search Bengaluru cafes"
          className="fixed inset-0 z-50 bg-[#1c1613]/60 backdrop-blur-xs flex items-end sm:items-start sm:pt-20 justify-center p-0 sm:p-4"
          onClick={() => setQuickSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-t-2xl sm:rounded-2xl bg-white border border-[#e6ddd0] shadow-xl overflow-visible animate-sheet-up pb-[env(safe-area-inset-bottom)] sm:pb-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-[#1c1613] text-[#faf7f2] rounded-t-2xl flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#f59e0b]">
                  Quick Search
                </p>
                <h2 className="font-serif-display text-lg sm:text-xl font-bold text-white">
                  Find Your Cafe
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setQuickSearchOpen(false)}
                aria-label="Close search"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shrink-0 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickSearchSubmit} className="p-5 space-y-4">
              <CafeAutocompleteSearch
                id="layout-quick-search"
                value={quickSearchQuery}
                onChange={setQuickSearchQuery}
                onSubmitQuery={(q) => {
                  setQuickSearchOpen(false);
                  navigate(`/discover?q=${encodeURIComponent(q)}&live=1`);
                }}
              />
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Search className="w-4 h-4" />
                  <span>Search Cafes &amp; Local Spots</span>
                </button>
                <Link
                  to="/discover?nearby=1"
                  onClick={() => setQuickSearchOpen(false)}
                  className="min-h-[44px] px-4 rounded-xl bg-[#faf7f2] hover:bg-[#f3ede3] text-[#1c1613] border border-[#d6cbba] text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <LocateFixed className="w-4 h-4 text-[#b45309]" />
                  <span>Near Me</span>
                </Link>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refined Warm Espresso Footer */}
      <footer
        className={`bg-[#1c1613] text-[#faf7f2] border-t border-[#312722] ${
          showBottomNav ? 'pb-24 md:pb-0' : 'pb-28 md:pb-0'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-14">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 sm:gap-10">
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="font-serif-display text-2xl font-bold text-white">
                  {settings.brand_name}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-[#f59e0b] font-medium">
                  Bengaluru
                </span>
              </div>
              <p className="text-sm text-[#d6cbba] max-w-sm leading-relaxed">
                {settings.brand_tagline}. {settings.business_address}
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-[#d6cbba]">
                <a
                  href={`tel:${settings.contact_phone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-1.5 min-h-[36px] hover:text-white transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-[#f59e0b]" aria-hidden="true" />
                  <span>{settings.contact_phone}</span>
                </a>
                <a
                  href={`mailto:${settings.contact_email}`}
                  className="inline-flex items-center gap-1.5 min-h-[36px] hover:text-white transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-[#f59e0b]" aria-hidden="true" />
                  <span>{settings.contact_email}</span>
                </a>
              </div>
            </div>

            <div className="md:col-span-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#f59e0b]">
                Explore
              </p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm text-[#d6cbba]">
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
              <p className="text-xs font-semibold uppercase tracking-wider text-[#f59e0b]">
                Connect
              </p>
              <div className="flex flex-col gap-2 text-sm text-[#d6cbba]">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 min-h-[36px] hover:text-white transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-[#f59e0b]" aria-hidden="true" />
                  <span>WhatsApp Concierge</span>
                </a>
                {settings.instagram_url && (
                  <a
                    href={settings.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 min-h-[36px] hover:text-white transition-colors"
                  >
                    <Instagram className="w-4 h-4 text-[#f59e0b]" aria-hidden="true" />
                    <span>{settings.instagram_handle || 'Instagram'}</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={openSuggestModal}
                  className="inline-flex items-center gap-2 min-h-[36px] text-left hover:text-white transition-colors"
                >
                  <Lightbulb className="w-4 h-4 text-[#f59e0b]" aria-hidden="true" />
                  <span>Suggest an Idea</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#f59e0b]">
              Bengaluru Neighbourhoods &amp; Local Guides
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#d6cbba]">
              {[
                { label: 'Local Guides', to: '/guides' },
                { label: 'Best Cafes in Bengaluru', to: '/best-cafes-in-bengaluru' },
                { label: 'Affordable Cafes', to: '/affordable-cafes-in-bengaluru' },
                { label: 'Tea Shops', to: '/tea-shops-in-bengaluru' },
                { label: 'Coffee Shops', to: '/coffee-shops-in-bengaluru' },
                { label: 'Study Cafes', to: '/study-cafes-in-bengaluru' },
                { label: 'Work-Friendly Cafes', to: '/work-friendly-cafes-in-bengaluru' },
                { label: 'Koramangala', to: '/cafes-in-koramangala' },
                { label: 'Indiranagar', to: '/cafes-in-indiranagar' },
                { label: 'HSR Layout', to: '/cafes-in-hsr-layout' },
                { label: 'Jayanagar', to: '/cafes-in-jayanagar' },
                { label: 'Whitefield', to: '/cafes-in-whitefield' },
                { label: 'MG Road', to: '/cafes-in-mg-road' },
              ].map((seoLink) => (
                <Link key={seoLink.to} to={seoLink.to} className="hover:text-white transition-colors">
                  {seoLink.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#a89a8e]">
            <p>{settings.footer_copyright}</p>
            <p>{settings.business_legal_name}</p>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      {showBottomNav && (
        <nav
          aria-label="Mobile bottom navigation"
          className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e6ddd0] pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(28,22,19,0.06)]"
        >
          <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1">
            {mobileTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.id}
                  to={tab.to}
                  className={`flex flex-col items-center justify-center gap-1 min-h-[48px] rounded-xl text-[11px] transition-colors ${
                    tab.active
                      ? 'text-[#b45309] font-semibold'
                      : 'text-[#5c4e45] font-medium hover:text-[#1c1613]'
                  }`}
                >
                  <span
                    className={`px-3 py-1 rounded-full transition-colors ${
                      tab.active ? 'bg-[#fef3c7]' : ''
                    }`}
                  >
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span className="leading-none">{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

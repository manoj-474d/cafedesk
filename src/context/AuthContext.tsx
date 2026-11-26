import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  fetchOwnSupabaseProfile,
  isSupabaseConfigured,
  supabase,
  syncOwnSupabaseProfile,
} from '../lib/supabase';
import type { LocationItem } from '../types/cms';
import type {
  CafeLibrarySnapshot,
  PlanPermissionKey,
  PlanPermissions,
  PlanTier,
  SavedCafeRecord,
  SubscriptionPlan,
  UpgradePromptState,
  UserCollection,
  UserProfile,
  UserSubscription,
} from '../types/subscription';

const FREE_PERMISSIONS: PlanPermissions = {
  wifi_details: false,
  power_sockets: false,
  workspace_details: false,
  food_menu: false,
  menu_pricing: false,
  amenities: false,
  subscriber_benefits: false,
  booking: false,
  collections: false,
  compare: false,
};

const STATIC_SAVED_KEY_PREFIX = 'cafedesk_static_saved_';
const DEFAULT_FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free Explorer',
    tagline: 'Discover Bengaluru cafes, map views, and cafe basics',
    price_inr: 0,
    interval_days: 30,
    badge_text: 'Included Free',
    features: ['Browse curated cafes', 'Interactive Bengaluru map', 'Save favourite cafes'],
    sort_order: 1,
    active: true,
    updated_at: 0,
  },
  {
    id: 'plus',
    name: 'Cafe Desk Plus',
    tagline: 'Unlock custom collections & side-by-side comparison',
    price_inr: 79,
    interval_days: 30,
    badge_text: 'Monthly',
    features: ['Personal cafe collections', 'Compare up to 4 cafes', 'Priority booking'],
    sort_order: 2,
    active: true,
    updated_at: 0,
  },
  {
    id: 'premium',
    name: 'Cafe Desk Plus Annual',
    tagline: 'Full year access at best value',
    price_inr: 499,
    interval_days: 365,
    badge_text: 'Best Value',
    is_recommended: true,
    features: ['All Plus features for 365 days', 'Unlimited collections', 'Cafe comparison'],
    sort_order: 3,
    active: true,
    updated_at: 0,
  },
];

function loadStaticSavedCafes(userKey: string): SavedCafeRecord[] {
  try {
    const raw = localStorage.getItem(`${STATIC_SAVED_KEY_PREFIX}${userKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedCafeRecord[]) : [];
  } catch {
    return [];
  }
}

function saveStaticSavedCafes(userKey: string, items: SavedCafeRecord[]): void {
  try {
    localStorage.setItem(`${STATIC_SAVED_KEY_PREFIX}${userKey}`, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

const SESSION_TOKEN_STORAGE_KEY = 'cafedesk_user_session_token';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export function resolveApiUrl(path: string): string {
  if (!path.startsWith('/')) return path;
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export function getUserSessionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const token = localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) || '';
    if (token) headers['X-CafeDesk-Session'] = token;
  } catch {
    // Ignore storage errors
  }
  return headers;
}

export async function getUserAuthHeaders(): Promise<Record<string, string>> {
  const headers = getUserSessionHeaders();
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
    } catch {
      // Ignore auth lookup errors
    }
  }
  return headers;
}

export interface AuthResponsePayload {
  authenticated?: boolean;
  user?: UserProfile;
  subscription?: UserSubscription;
  savedCafes?: SavedCafeRecord[];
  collections?: UserCollection[];
  csrfToken?: string;
  sessionToken?: string;
}

interface AuthContextValue {
  loading: boolean;
  authError: string;
  clearAuthError: () => void;
  authenticated: boolean;
  user: UserProfile | null;
  subscription: UserSubscription | null;
  tier: PlanTier;
  isSubscribed: boolean;
  isExpired: boolean;
  isSuspended: boolean;
  expiredPlanName: string | null;
  hasPlus: boolean;
  hasPremium: boolean;
  hasPermission: (key: PlanPermissionKey) => boolean;
  plans: SubscriptionPlan[];
  razorpayEnabled: boolean;
  razorpayKeyId: string;
  savedCafes: SavedCafeRecord[];
  collections: UserCollection[];
  compareList: LocationItem[];
  compareModalOpen: boolean;
  setCompareModalOpen: (open: boolean) => void;
  toggleCompareCafe: (cafe: LocationItem) => void;
  removeCompareCafe: (id: string) => void;
  clearCompare: () => void;
  upgradePrompt: UpgradePromptState | null;
  openUpgradeModal: (prompt: UpgradePromptState) => void;
  closeUpgradeModal: () => void;
  checkoutPlan: PlanTier | null;
  openCheckout: (planId: PlanTier) => void;
  closeCheckout: () => void;
  applyAuthPayload: (payload: AuthResponsePayload) => void;
  exchangeSupabaseSession: (
    accessToken: string,
    extra?: {
      fullName?: string;
      phone?: string;
      eventType?: string;
      session?: Session | null;
      force?: boolean;
    }
  ) => Promise<boolean>;
  ensureBackendSession: () => Promise<boolean>;
  refreshAuth: () => Promise<void>;
  refreshPlans: () => Promise<void>;
  logout: () => Promise<void>;
  isCafeSaved: (cafeKey: string) => boolean;
  isCafeFavourite: (cafeKey: string) => boolean;
  toggleSaveCafe: (snapshot: CafeLibrarySnapshot, asFavourite?: boolean) => Promise<void>;
  createCollection: (name: string, description?: string) => Promise<UserCollection | null>;
  deleteCollection: (id: number) => Promise<void>;
  addCafeToCollection: (collectionId: number, snapshot: CafeLibrarySnapshot) => Promise<void>;
  removeCafeFromCollection: (collectionId: number, cafeKey: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  loading: true,
  authError: '',
  clearAuthError: () => {},
  authenticated: false,
  user: null,
  subscription: null,
  tier: 'free',
  isSubscribed: false,
  isExpired: false,
  isSuspended: false,
  expiredPlanName: null,
  hasPlus: false,
  hasPremium: false,
  hasPermission: () => false,
  plans: [],
  razorpayEnabled: false,
  razorpayKeyId: '',
  savedCafes: [],
  collections: [],
  compareList: [],
  compareModalOpen: false,
  setCompareModalOpen: () => {},
  toggleCompareCafe: () => {},
  removeCompareCafe: () => {},
  clearCompare: () => {},
  upgradePrompt: null,
  openUpgradeModal: () => {},
  closeUpgradeModal: () => {},
  checkoutPlan: null,
  openCheckout: () => {},
  closeCheckout: () => {},
  applyAuthPayload: () => {},
  exchangeSupabaseSession: async () => false,
  ensureBackendSession: async () => false,
  refreshAuth: async () => {},
  refreshPlans: async () => {},
  logout: async () => {},
  isCafeSaved: () => false,
  isCafeFavourite: () => false,
  toggleSaveCafe: async () => {},
  createCollection: async () => null,
  deleteCollection: async () => {},
  addCafeToCollection: async () => {},
  removeCafeFromCollection: async () => {},
});

export function locationToLibrarySnapshot(
  loc: LocationItem & { distanceKm?: number | null }
): CafeLibrarySnapshot {
  const isGoogle = loc.id.startsWith('google:');
  return {
    key: loc.slug || loc.id,
    source: isGoogle ? 'google' : 'curated',
    name: loc.name,
    area: loc.area,
    address: loc.address,
    slug: loc.slug,
    place_id: loc.place_id || undefined,
    photo: loc.photos_approved && loc.photos.length > 0 ? loc.photos[0] : undefined,
    map_link: loc.map_link,
    website_url: loc.website_url || undefined,
    rating: loc.rating,
    avg_cost_per_person: loc.avg_cost_per_person,
    wifi_available: loc.wifi_available,
    wifi_mbps: loc.wifi_mbps,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [savedCafes, setSavedCafes] = useState<SavedCafeRecord[]>([]);
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [compareList, setCompareList] = useState<LocationItem[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePromptState | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanTier | null>(null);

  const lastAuthSigRef = useRef<string | null>(null);
  const exchangedTokenRef = useRef<string>('');
  const inFlightExchangeRef = useRef<{ token: string; promise: Promise<boolean> } | null>(null);

  const clearAuthError = useCallback(() => setAuthError(''), []);

  const nowMs = Date.now();
  const isExpired = Boolean(
    user &&
      subscription &&
      (subscription.expired ||
        subscription.status === 'expired' ||
        (subscription.plan_id !== 'free' &&
          subscription.expires_at !== null &&
          subscription.expires_at <= nowMs))
  );
  const isSuspended = Boolean(
    user && (user.status === 'suspended' || subscription?.status === 'suspended')
  );
  const isSubscribed = Boolean(
    user &&
      subscription &&
      subscription.plan_id !== 'free' &&
      !isExpired &&
      !isSuspended &&
      (subscription.effective_active !== undefined
        ? subscription.effective_active
        : (subscription.status === 'active' || subscription.status === 'cancelled') &&
          (!subscription.expires_at || subscription.expires_at > nowMs))
  );

  const tier: PlanTier = isSubscribed && subscription ? subscription.plan_id : 'free';
  const hasPlus = isSubscribed;
  const hasPremium = isSubscribed;
  const expiredPlanName = isExpired
    ? subscription?.expired_from_plan_name || subscription?.plan_name || null
    : null;

  const hasPermission = useCallback(
    (key: PlanPermissionKey): boolean => {
      if (!isSubscribed || !subscription) return false;
      if (subscription.permissions) {
        return Boolean(subscription.permissions[key]);
      }
      return true;
    },
    [isSubscribed, subscription]
  );

  const applyAuthPayload = useCallback((payload: AuthResponsePayload) => {
    const nextAuthed = Boolean(payload.authenticated && payload.user);
    if (nextAuthed && payload.user) {
      if (payload.sessionToken) {
        try {
          localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, payload.sessionToken);
        } catch {
          // Ignore storage quota errors
        }
      }
      setUser(payload.user);
      setSubscription(payload.subscription ?? null);
      setSavedCafes(Array.isArray(payload.savedCafes) ? payload.savedCafes : []);
      setCollections(Array.isArray(payload.collections) ? payload.collections : []);
    } else {
      try {
        localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
      setUser(null);
      setSubscription(null);
      setSavedCafes([]);
      setCollections([]);
    }
    const nextSig = nextAuthed
      ? `1|${payload.subscription?.plan_id || 'free'}|${payload.subscription?.status || 'active'}|${payload.subscription?.effective_active ? 1 : 0}|${payload.subscription?.expires_at ?? 'null'}`
      : '0';
    if (lastAuthSigRef.current !== null && lastAuthSigRef.current !== nextSig) {
      window.dispatchEvent(new Event('cafedesk:auth-changed'));
    }
    lastAuthSigRef.current = nextSig;
  }, []);

  const refreshPlans = useCallback(async () => {
    try {
      const res = await fetch(resolveApiUrl('/api/plans'));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as {
          plans?: SubscriptionPlan[];
          razorpayEnabled?: boolean;
          razorpayKeyId?: string;
        };
        if (Array.isArray(data.plans)) setPlans(data.plans);
        setRazorpayEnabled(Boolean(data.razorpayEnabled));
        setRazorpayKeyId(data.razorpayKeyId || '');
        return;
      }
      setPlans((prev) => (prev.length > 0 ? prev : DEFAULT_FALLBACK_PLANS));
    } catch {
      setPlans((prev) => (prev.length > 0 ? prev : DEFAULT_FALLBACK_PLANS));
    }
  }, []);

  const buildPayloadFromSupabaseSession = useCallback(
    async (
      session: Session,
      extra?: { fullName?: string; phone?: string }
    ): Promise<{ payload: AuthResponsePayload | null; suspendedError?: string }> => {
      const sbUser = session.user;
      const meta = (sbUser?.user_metadata || {}) as Record<string, unknown>;
      const appMeta = (sbUser?.app_metadata || {}) as Record<string, unknown>;
      const email = String(sbUser?.email || meta.email || '').trim().toLowerCase();
      if (!sbUser?.id || !email) {
        return { payload: null };
      }

      const provider: 'email' | 'google' = appMeta.provider === 'google' ? 'google' : 'email';
      const baseName =
        (extra?.fullName || '').trim() ||
        String(meta.full_name || meta.name || email.split('@')[0] || 'Cafe Desk Member').trim();
      const basePhone = (extra?.phone || '').trim() || String(meta.phone || sbUser.phone || '').trim();
      const baseAvatar = String(meta.avatar_url || meta.picture || '').trim();

      await syncOwnSupabaseProfile({
        id: sbUser.id,
        fullName: baseName,
        email,
        phone: basePhone,
        avatarUrl: baseAvatar,
        authProvider: provider,
      });

      const remoteProfile = await fetchOwnSupabaseProfile(sbUser.id);
      if (remoteProfile?.account_status === 'suspended') {
        return {
          payload: null,
          suspendedError: 'Your account has been suspended by an administrator. Please contact support.',
        };
      }

      const now = Date.now();
      const createdAtMs = sbUser.created_at ? new Date(sbUser.created_at).getTime() || now : now;
      const resolvedName = String(remoteProfile?.full_name || baseName).trim() || 'Cafe Desk Member';
      const resolvedPhone = String(remoteProfile?.phone || basePhone).trim();
      const resolvedAvatar = String(remoteProfile?.avatar_url || baseAvatar).trim();

      let resolvedSub: UserSubscription = {
        id: 0,
        user_id: 0,
        plan_id: 'free',
        plan_name: 'Free Explorer',
        price_inr: 0,
        subscribed_price_inr: 0,
        status: 'active',
        started_at: createdAtMs,
        expires_at: null,
        auto_renew: false,
        cancelled_at: null,
        expired: false,
        effective_active: false,
        permissions: { ...FREE_PERMISSIONS },
        updated_at: now,
      };

      if (supabase) {
        try {
          const { data: sbSub } = await supabase
            .from('user_subscriptions')
            .select('plan_id, subscribed_price_inr, status, started_at, expires_at, auto_renew, cancelled_at, expired_at, expired_from_plan, suspended_at, updated_at')
            .eq('user_id', sbUser.id)
            .maybeSingle();
          if (sbSub) {
            const subPlanId = String(sbSub.plan_id || 'free') as PlanTier;
            const subExpiresMs = sbSub.expires_at ? new Date(sbSub.expires_at).getTime() : null;
            const rawStatus = String(sbSub.status || 'active') as UserSubscription['status'];
            const subExpired =
              rawStatus === 'expired' ||
              (subPlanId !== 'free' && subExpiresMs !== null && subExpiresMs <= now);
            const subSuspended = rawStatus === 'suspended';
            const subActive =
              subPlanId !== 'free' &&
              !subExpired &&
              !subSuspended &&
              (rawStatus === 'active' || rawStatus === 'cancelled') &&
              (subExpiresMs === null || subExpiresMs > now);
            resolvedSub = {
              id: 0,
              user_id: 0,
              plan_id: subPlanId,
              plan_name: subPlanId === 'free' ? 'Free Explorer' : subPlanId,
              price_inr: Number(sbSub.subscribed_price_inr ?? 0),
              subscribed_price_inr: Number(sbSub.subscribed_price_inr ?? 0),
              status: subExpired ? 'expired' : rawStatus,
              started_at: sbSub.started_at ? new Date(sbSub.started_at).getTime() : createdAtMs,
              expires_at: subExpiresMs,
              auto_renew: Boolean(sbSub.auto_renew),
              cancelled_at: sbSub.cancelled_at ? new Date(sbSub.cancelled_at).getTime() : null,
              expired: subExpired,
              expired_from_plan: sbSub.expired_from_plan ? String(sbSub.expired_from_plan) : null,
              expired_at: sbSub.expired_at ? new Date(sbSub.expired_at).getTime() : null,
              suspended_at: sbSub.suspended_at ? new Date(sbSub.suspended_at).getTime() : null,
              effective_active: subActive,
              permissions: subActive
                ? {
                    wifi_details: true,
                    power_sockets: true,
                    workspace_details: true,
                    food_menu: true,
                    menu_pricing: true,
                    amenities: true,
                    subscriber_benefits: true,
                    booking: true,
                    collections: true,
                    compare: true,
                  }
                : { ...FREE_PERMISSIONS },
              updated_at: sbSub.updated_at ? new Date(sbSub.updated_at).getTime() : now,
            };
          }
        } catch {
          // Migration 002 table may not exist yet — keep strict Free Explorer defaults
        }
      }

      return {
        payload: {
          authenticated: true,
          user: {
            id: 0,
            supabase_id: sbUser.id,
            name: resolvedName,
            email,
            phone: resolvedPhone,
            avatar_url: resolvedAvatar,
            auth_provider: provider,
            email_verified: Boolean(
              remoteProfile?.email_verified || sbUser.email_confirmed_at || provider === 'google'
            ),
            status: 'active',
            last_login_at: now,
            created_at: createdAtMs,
          },
          subscription: resolvedSub,
          savedCafes: loadStaticSavedCafes(sbUser.id),
          collections: [],
        },
      };
    },
    []
  );

  const exchangeSupabaseSession = useCallback(
    async (
      accessToken: string,
      extra?: {
        fullName?: string;
        phone?: string;
        eventType?: string;
        session?: Session | null;
        force?: boolean;
      }
    ): Promise<boolean> => {
      if (!accessToken) return false;
      if (!extra?.force && exchangedTokenRef.current === accessToken) return true;
      if (inFlightExchangeRef.current?.token === accessToken) {
        return await inFlightExchangeRef.current.promise;
      }

      const promise = (async (): Promise<boolean> => {
        const tryDirectSupabaseFallback = async (): Promise<boolean> => {
          if (!supabase) return false;
          let activeSession = extra?.session ?? null;
          if (!activeSession || activeSession.access_token !== accessToken) {
            const { data } = await supabase.auth.getSession();
            activeSession = data.session;
          }
          if (!activeSession?.user) return false;

          const { payload, suspendedError } = await buildPayloadFromSupabaseSession(
            activeSession,
            extra
          );
          if (suspendedError) {
            exchangedTokenRef.current = accessToken;
            setAuthError(suspendedError);
            await supabase.auth.signOut().catch(() => {});
            applyAuthPayload({ authenticated: false });
            return false;
          }
          if (payload?.authenticated && payload.user) {
            exchangedTokenRef.current = accessToken;
            setAuthError('');
            applyAuthPayload(payload);
            return true;
          }
          return false;
        };

        try {
          const res = await fetch(resolveApiUrl('/api/auth/supabase-exchange'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getUserSessionHeaders(),
              Authorization: `Bearer ${accessToken}`,
            },
            credentials: 'include',
            body: JSON.stringify({
              accessToken,
              fullName: extra?.fullName,
              phone: extra?.phone,
              eventType: extra?.eventType,
            }),
          });
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            exchangedTokenRef.current = accessToken;
            setAuthError('');
            const data = (await res.json()) as AuthResponsePayload;
            applyAuthPayload(data);
            return Boolean(data.authenticated && data.user);
          }

          if (res.status === 401 || res.status === 403) {
            const errBody = contentType.includes('application/json')
              ? ((await res.json().catch(() => ({}))) as { error?: string })
              : {};
            exchangedTokenRef.current = accessToken;
            setAuthError(
              errBody.error || 'Google authentication session could not be verified.'
            );
            if (supabase) await supabase.auth.signOut().catch(() => {});
            applyAuthPayload({ authenticated: false });
            return false;
          }

          // When deployed as static frontend (e.g. Cloudflare Pages returning 404/405/text/html for /api/*)
          // or transient gateway failure, complete sign-in directly from the verified Supabase session.
          const fallbackOk = await tryDirectSupabaseFallback();
          if (fallbackOk) return true;

          const errBody = contentType.includes('application/json')
            ? ((await res.json().catch(() => ({}))) as { error?: string })
            : {};
          setAuthError(
            errBody.error || 'Could not complete Google sign-in. Please try again.'
          );
          return false;
        } catch {
          const fallbackOk = await tryDirectSupabaseFallback();
          if (fallbackOk) return true;
          setAuthError('Network error while completing sign-in. Please try again.');
          return false;
        } finally {
          if (inFlightExchangeRef.current?.token === accessToken) {
            inFlightExchangeRef.current = null;
          }
        }
      })();

      inFlightExchangeRef.current = { token: accessToken, promise };
      return await promise;
    },
    [applyAuthPayload, buildPayloadFromSupabaseSession]
  );

  const refreshAuth = useCallback(async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        const initResult = await supabase.auth.initialize();
        if (initResult?.error) {
          setAuthError(
            initResult.error.message || 'Google sign-in could not be completed. Please try again.'
          );
        }
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.access_token) {
          const ok = await exchangeSupabaseSession(sessionData.session.access_token, {
            eventType: 'session_resume',
            session: sessionData.session,
          });
          if (ok) {
            if (
              window.location.search.includes('code=') ||
              window.location.hash.includes('access_token=')
            ) {
              const cleaned = new URLSearchParams(window.location.search);
              cleaned.delete('code');
              cleaned.delete('state');
              const qs = cleaned.toString();
              window.history.replaceState(
                null,
                '',
                `${window.location.pathname}${qs ? `?${qs}` : ''}`
              );
            }
            return;
          }
        }
      }
      const res = await fetch(resolveApiUrl('/api/auth/me'), {
        credentials: 'include',
        headers: await getUserAuthHeaders(),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as AuthResponsePayload;
        applyAuthPayload(data);
      } else {
        applyAuthPayload({ authenticated: false });
      }
    } catch {
      applyAuthPayload({ authenticated: false });
    } finally {
      setLoading(false);
    }
  }, [applyAuthPayload, exchangeSupabaseSession]);

  useEffect(() => {
    void Promise.all([refreshAuth(), refreshPlans()]);
  }, [refreshAuth, refreshPlans]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const {
      data: { subscription: sbSub },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
        session?.access_token
      ) {
        void exchangeSupabaseSession(session.access_token, {
          eventType: event === 'SIGNED_IN' ? 'login' : 'token_refresh',
          session,
        }).then((ok) => {
          if (
            ok &&
            (window.location.search.includes('code=') ||
              window.location.hash.includes('access_token='))
          ) {
            const cleaned = new URLSearchParams(window.location.search);
            cleaned.delete('code');
            cleaned.delete('state');
            const qs = cleaned.toString();
            window.history.replaceState(
              null,
              '',
              `${window.location.pathname}${qs ? `?${qs}` : ''}`
            );
          }
        });
      } else if (event === 'SIGNED_OUT') {
        exchangedTokenRef.current = '';
      }
    });
    return () => {
      sbSub.unsubscribe();
    };
  }, [exchangeSupabaseSession]);

  const ensureBackendSession = useCallback(async (): Promise<boolean> => {
    const existingHeaders = getUserSessionHeaders();
    if (existingHeaders['X-CafeDesk-Session']) return true;
    if (!isSupabaseConfigured || !supabase) return Boolean(user);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) return false;
      return await exchangeSupabaseSession(accessToken, {
        eventType: 'checkout_session_sync',
        session: data.session,
        force: true,
      });
    } catch {
      return false;
    }
  }, [exchangeSupabaseSession, user]);

  const logout = useCallback(async () => {
    exchangedTokenRef.current = '';
    const sessionHeaders = getUserSessionHeaders();
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    await fetch(resolveApiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: sessionHeaders,
    }).catch(() => {});
    applyAuthPayload({ authenticated: false });
    setCompareList([]);
  }, [applyAuthPayload]);

  const openUpgradeModal = useCallback((prompt: UpgradePromptState) => {
    setUpgradePrompt(prompt);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setUpgradePrompt(null);
  }, []);

  const openCheckout = useCallback((planId: PlanTier) => {
    setUpgradePrompt(null);
    setCheckoutPlan(planId);
  }, []);

  const closeCheckout = useCallback(() => {
    setCheckoutPlan(null);
  }, []);

  const isCafeSaved = useCallback(
    (cafeKey: string) => savedCafes.some((s) => s.cafe_key === cafeKey),
    [savedCafes]
  );

  const isCafeFavourite = useCallback(
    (cafeKey: string) => savedCafes.some((s) => s.cafe_key === cafeKey && s.is_favourite),
    [savedCafes]
  );

  const toggleSaveCafe = useCallback(
    async (snapshot: CafeLibrarySnapshot, asFavourite = false) => {
      if (!user) {
        openUpgradeModal({
          featureName: asFavourite ? 'Favourite Cafes' : 'Save Cafes',
          requiredPlan: 'plus',
          freeSignInOnly: true,
          description:
            'Create a free Cafe Desk account or sign in to bookmark and save your favourite Bengaluru cafes across devices.',
        });
        return;
      }

      const existing = savedCafes.find((s) => s.cafe_key === snapshot.key);
      const staticUserKey = user.supabase_id || String(user.id || '');
      if (existing && (!asFavourite || existing.is_favourite)) {
        try {
          const res = await fetch(resolveApiUrl(`/api/user/saved/${encodeURIComponent(snapshot.key)}`), {
            method: 'DELETE',
            credentials: 'include',
            headers: getUserSessionHeaders(),
          });
          const ct = res.headers.get('content-type') || '';
          if (res.ok && ct.includes('application/json')) {
            const data = (await res.json()) as {
              savedCafes: SavedCafeRecord[];
              collections: UserCollection[];
            };
            setSavedCafes(data.savedCafes);
            setCollections(data.collections);
            return;
          }
        } catch {
          // Fall through to static storage update
        }
        const nextSaved = savedCafes.filter((s) => s.cafe_key !== snapshot.key);
        setSavedCafes(nextSaved);
        if (staticUserKey) saveStaticSavedCafes(staticUserKey, nextSaved);
        return;
      }

      try {
        const res = await fetch(resolveApiUrl('/api/user/saved'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getUserSessionHeaders() },
          credentials: 'include',
          body: JSON.stringify({
            cafeKey: snapshot.key,
            snapshot,
            isFavourite: asFavourite ? true : Boolean(existing?.is_favourite),
          }),
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = (await res.json()) as {
            savedCafes: SavedCafeRecord[];
            collections: UserCollection[];
          };
          setSavedCafes(data.savedCafes);
          setCollections(data.collections);
          return;
        }
      } catch {
        // Fall through to static storage update
      }
      const nextFav = asFavourite ? true : Boolean(existing?.is_favourite);
      const nextSaved: SavedCafeRecord[] = existing
        ? savedCafes.map((s) =>
            s.cafe_key === snapshot.key ? { ...s, snapshot, is_favourite: nextFav } : s
          )
        : [
            {
              id: Date.now(),
              user_id: user.id,
              cafe_key: snapshot.key,
              cafe_source: snapshot.source,
              snapshot,
              is_favourite: nextFav,
              created_at: Date.now(),
            },
            ...savedCafes,
          ];
      setSavedCafes(nextSaved);
      if (staticUserKey) saveStaticSavedCafes(staticUserKey, nextSaved);
    },
    [user, savedCafes, openUpgradeModal]
  );

  const createCollection = useCallback(
    async (name: string, description = ''): Promise<UserCollection | null> => {
      if (!hasPermission('collections')) {
        openUpgradeModal({
          featureName: 'Personal Cafe Collections',
          requiredPlan: 'plus',
          description: isExpired
            ? 'Your subscription has expired. Renew your plan to create and manage personal cafe collections.'
            : 'Organize Bengaluru cafes into custom lists like "Indiranagar Deep Work" or "Budget Chai Spots" with an active Cafe Desk Plus subscription.',
        });
        return null;
      }
      const res = await fetch(resolveApiUrl('/api/user/collections'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getUserSessionHeaders() },
        credentials: 'include',
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        savedCafes: SavedCafeRecord[];
        collections: UserCollection[];
      };
      setSavedCafes(data.savedCafes);
      setCollections(data.collections);
      return data.collections[0] ?? null;
    },
    [hasPermission, isExpired, openUpgradeModal]
  );

  const deleteCollection = useCallback(async (id: number) => {
    const res = await fetch(resolveApiUrl(`/api/user/collections/${id}`), {
      method: 'DELETE',
      credentials: 'include',
      headers: getUserSessionHeaders(),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        savedCafes: SavedCafeRecord[];
        collections: UserCollection[];
      };
      setSavedCafes(data.savedCafes);
      setCollections(data.collections);
    }
  }, []);

  const addCafeToCollection = useCallback(
    async (collectionId: number, snapshot: CafeLibrarySnapshot) => {
      if (!hasPermission('collections')) {
        openUpgradeModal({
          featureName: 'Personal Cafe Collections',
          requiredPlan: 'plus',
        });
        return;
      }
      const res = await fetch(resolveApiUrl(`/api/user/collections/${collectionId}/items`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getUserSessionHeaders() },
        credentials: 'include',
        body: JSON.stringify({ cafeKey: snapshot.key, snapshot }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          savedCafes: SavedCafeRecord[];
          collections: UserCollection[];
        };
        setSavedCafes(data.savedCafes);
        setCollections(data.collections);
      }
    },
    [hasPermission, openUpgradeModal]
  );

  const removeCafeFromCollection = useCallback(
    async (collectionId: number, cafeKey: string) => {
      const res = await fetch(
        resolveApiUrl(`/api/user/collections/${collectionId}/items/${encodeURIComponent(cafeKey)}`),
        {
          method: 'DELETE',
          credentials: 'include',
          headers: getUserSessionHeaders(),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          savedCafes: SavedCafeRecord[];
          collections: UserCollection[];
        };
        setSavedCafes(data.savedCafes);
        setCollections(data.collections);
      }
    },
    []
  );

  const toggleCompareCafe = useCallback(
    (cafe: LocationItem) => {
      if (!hasPermission('compare')) {
        openUpgradeModal({
          featureName: 'Cafe Battle — Compare Up to 3 Places',
          requiredPlan: 'plus',
          description: isExpired
            ? 'Your subscription has expired. Renew your plan to compare cafe prices, Wi-Fi speeds, and power sockets side-by-side.'
            : 'Compare up to 3 places side-by-side across rating, distance, price, hours, facilities, and workspace suitability with Cafe Desk Plus.',
        });
        return;
      }
      setCompareList((prev) => {
        const exists = prev.some((c) => c.id === cafe.id);
        if (exists) return prev.filter((c) => c.id !== cafe.id);
        if (prev.length >= 1) {
          void fetch(resolveApiUrl('/api/explorer/event'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getUserSessionHeaders(),
            },
            credentials: 'include',
            body: JSON.stringify({ eventType: 'compare_places', targetKey: cafe.id }),
          }).catch(() => {});
        }
        if (prev.length >= 3) return [...prev.slice(1), cafe];
        return [...prev, cafe];
      });
    },
    [hasPermission, isExpired, openUpgradeModal]
  );

  const removeCompareCafe = useCallback((id: string) => {
    setCompareList((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clearCompare = useCallback(() => {
    setCompareList([]);
    setCompareModalOpen(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        loading,
        authError,
        clearAuthError,
        authenticated: Boolean(user),
        user,
        subscription,
        tier,
        isSubscribed,
        isExpired,
        isSuspended,
        expiredPlanName,
        hasPlus,
        hasPremium,
        hasPermission,
        plans,
        razorpayEnabled,
        razorpayKeyId,
        savedCafes,
        collections,
        compareList,
        compareModalOpen,
        setCompareModalOpen,
        toggleCompareCafe,
        removeCompareCafe,
        clearCompare,
        upgradePrompt,
        openUpgradeModal,
        closeUpgradeModal,
        checkoutPlan,
        openCheckout,
        closeCheckout,
        applyAuthPayload,
        exchangeSupabaseSession,
        ensureBackendSession,
        refreshAuth,
        refreshPlans,
        logout,
        isCafeSaved,
        isCafeFavourite,
        toggleSaveCafe,
        createCollection,
        deleteCollection,
        addCafeToCollection,
        removeCafeFromCollection,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

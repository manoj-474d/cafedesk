import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { LocationItem } from '../types/cms';
import type {
  CafeLibrarySnapshot,
  PlanTier,
  SavedCafeRecord,
  SubscriptionPlan,
  UpgradePromptState,
  UserCollection,
  UserProfile,
  UserSubscription,
} from '../types/subscription';

export interface AuthResponsePayload {
  authenticated?: boolean;
  user?: UserProfile;
  subscription?: UserSubscription;
  savedCafes?: SavedCafeRecord[];
  collections?: UserCollection[];
  csrfToken?: string;
}

interface AuthContextValue {
  loading: boolean;
  authenticated: boolean;
  user: UserProfile | null;
  subscription: UserSubscription | null;
  tier: PlanTier;
  hasPlus: boolean;
  hasPremium: boolean;
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
  authenticated: false,
  user: null,
  subscription: null,
  tier: 'free',
  hasPlus: false,
  hasPremium: false,
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

  const lastAuthedRef = useRef<boolean | null>(null);
  const exchangedTokenRef = useRef<string>('');

  const tier: PlanTier =
    user && subscription && subscription.status !== 'expired' ? subscription.plan_id : 'free';
  // Unified Cafe Desk Plus access: any active non-free plan (Monthly, Annual, or custom paid plan) unlocks Plus features
  const hasPlus = tier !== 'free';
  const hasPremium = hasPlus;

  const applyAuthPayload = useCallback((payload: AuthResponsePayload) => {
    const nextAuthed = Boolean(payload.authenticated && payload.user);
    if (nextAuthed && payload.user) {
      setUser(payload.user);
      setSubscription(payload.subscription ?? null);
      setSavedCafes(Array.isArray(payload.savedCafes) ? payload.savedCafes : []);
      setCollections(Array.isArray(payload.collections) ? payload.collections : []);
    } else {
      setUser(null);
      setSubscription(null);
      setSavedCafes([]);
      setCollections([]);
    }
    if (lastAuthedRef.current !== null && lastAuthedRef.current !== nextAuthed) {
      window.dispatchEvent(new Event('cafedesk:auth-changed'));
    }
    lastAuthedRef.current = nextAuthed;
  }, []);

  const refreshPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/plans');
      if (res.ok) {
        const data = (await res.json()) as {
          plans?: SubscriptionPlan[];
          razorpayEnabled?: boolean;
          razorpayKeyId?: string;
        };
        if (Array.isArray(data.plans)) setPlans(data.plans);
        setRazorpayEnabled(Boolean(data.razorpayEnabled));
        setRazorpayKeyId(data.razorpayKeyId || '');
      }
    } catch {
      // Keep existing plans
    }
  }, []);

  const exchangeSupabaseSession = useCallback(
    async (accessToken: string, extra?: { fullName?: string; phone?: string; eventType?: string }) => {
      if (!accessToken || exchangedTokenRef.current === accessToken) return;
      exchangedTokenRef.current = accessToken;
      try {
        const res = await fetch('/api/auth/supabase-exchange', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: 'include',
          body: JSON.stringify({
            accessToken,
            ...(extra || {}),
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as AuthResponsePayload;
          applyAuthPayload(data);
        } else if (res.status === 403 && supabase) {
          await supabase.auth.signOut().catch(() => {});
          applyAuthPayload({ authenticated: false });
        }
      } catch {
        // Fallback silently; regular refreshAuth covers local session
      }
    },
    [applyAuthPayload]
  );

  const refreshAuth = useCallback(async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.access_token) {
          await exchangeSupabaseSession(sessionData.session.access_token, {
            eventType: 'session_resume',
          });
        }
      }
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
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
        });
      } else if (event === 'SIGNED_OUT') {
        exchangedTokenRef.current = '';
      }
    });
    return () => {
      sbSub.unsubscribe();
    };
  }, [exchangeSupabaseSession]);

  const logout = useCallback(async () => {
    exchangedTokenRef.current = '';
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
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
      if (existing && (!asFavourite || existing.is_favourite)) {
        const res = await fetch(`/api/user/saved/${encodeURIComponent(snapshot.key)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.ok) {
          const data = (await res.json()) as {
            savedCafes: SavedCafeRecord[];
            collections: UserCollection[];
          };
          setSavedCafes(data.savedCafes);
          setCollections(data.collections);
        }
        return;
      }

      const res = await fetch('/api/user/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cafeKey: snapshot.key,
          snapshot,
          isFavourite: asFavourite ? true : Boolean(existing?.is_favourite),
        }),
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
    [user, savedCafes, openUpgradeModal]
  );

  const createCollection = useCallback(
    async (name: string, description = ''): Promise<UserCollection | null> => {
      if (!hasPlus) {
        openUpgradeModal({
          featureName: 'Personal Cafe Collections',
          requiredPlan: 'plus',
          description:
            'Organize Bengaluru cafes into custom lists like "Indiranagar Deep Work" or "Budget Chai Spots" with Cafe Desk Plus.',
        });
        return null;
      }
      const res = await fetch('/api/user/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    [hasPlus, openUpgradeModal]
  );

  const deleteCollection = useCallback(async (id: number) => {
    const res = await fetch(`/api/user/collections/${id}`, {
      method: 'DELETE',
      credentials: 'include',
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
      if (!hasPlus) {
        openUpgradeModal({
          featureName: 'Personal Cafe Collections',
          requiredPlan: 'plus',
        });
        return;
      }
      const res = await fetch(`/api/user/collections/${collectionId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    [hasPlus, openUpgradeModal]
  );

  const removeCafeFromCollection = useCallback(
    async (collectionId: number, cafeKey: string) => {
      const res = await fetch(
        `/api/user/collections/${collectionId}/items/${encodeURIComponent(cafeKey)}`,
        {
          method: 'DELETE',
          credentials: 'include',
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
      if (!hasPlus) {
        openUpgradeModal({
          featureName: 'Compare Multiple Cafes Side-by-Side',
          requiredPlan: 'plus',
          description:
            'Compare menu prices, average budget, Wi-Fi speed, charging sockets, and noise level across up to 4 Bengaluru cafes with Cafe Desk Plus.',
        });
        return;
      }
      setCompareList((prev) => {
        const exists = prev.some((c) => c.id === cafe.id);
        if (exists) return prev.filter((c) => c.id !== cafe.id);
        if (prev.length >= 4) return [...prev.slice(1), cafe];
        return [...prev, cafe];
      });
    },
    [hasPlus, openUpgradeModal]
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
        authenticated: Boolean(user),
        user,
        subscription,
        tier,
        hasPlus,
        hasPremium,
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

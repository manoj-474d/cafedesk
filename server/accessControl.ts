import type {
  AccessControlSettings,
  AccessSectionKey,
  CafeAccessInfo,
  CafeAccessRule,
  LocationItem,
  SiteSettings,
} from '../src/types/cms.ts';
import type { PlanPermissions, UserSubscription } from '../src/types/subscription.ts';
import {
  DEFAULT_ACCESS_CONTROL,
  DEFAULT_FREE_PERMISSIONS,
  DEFAULT_PAID_PERMISSIONS,
  getDb,
  getUserEffectiveSubscription,
} from './db.ts';

export const ACCESS_SECTION_KEYS: AccessSectionKey[] = [
  'wifi_details',
  'power_sockets',
  'workspace_details',
  'food_menu',
  'menu_pricing',
  'amenities',
  'subscriber_benefits',
  'booking',
];

export interface ViewerAccessContext {
  viewerState: 'guest' | 'free' | 'expired' | 'suspended' | 'subscribed' | 'admin';
  hasActiveSubscription: boolean;
  planId: string | null;
  planName: string | null;
  permissions: PlanPermissions;
  subscription: UserSubscription | null;
}

export function normalizeAccessControlSettings(raw: unknown): AccessControlSettings {
  const base: AccessControlSettings = {
    default_rule: DEFAULT_ACCESS_CONTROL.default_rule,
    sections: { ...DEFAULT_ACCESS_CONTROL.sections },
    free_cafe_preview_note: DEFAULT_ACCESS_CONTROL.free_cafe_preview_note,
  };
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  if (obj.default_rule === 'free_public' || obj.default_rule === 'subscription_required') {
    base.default_rule = obj.default_rule;
  }
  if (typeof obj.free_cafe_preview_note === 'string' && obj.free_cafe_preview_note.trim()) {
    base.free_cafe_preview_note = obj.free_cafe_preview_note.trim().slice(0, 320);
  }
  if (obj.sections && typeof obj.sections === 'object') {
    const secObj = obj.sections as Record<string, unknown>;
    for (const key of ACCESS_SECTION_KEYS) {
      if (secObj[key] === 'public' || secObj[key] === 'subscription') {
        base.sections[key] = secObj[key] as 'public' | 'subscription';
      }
    }
  }
  return base;
}

export function resolveViewerAccessContext(opts: {
  userId?: number | null;
  isAdmin?: boolean;
}): ViewerAccessContext {
  if (opts.isAdmin) {
    return {
      viewerState: 'admin',
      hasActiveSubscription: true,
      planId: 'admin',
      planName: 'Administrator',
      permissions: { ...DEFAULT_PAID_PERMISSIONS },
      subscription: null,
    };
  }

  if (!opts.userId) {
    return {
      viewerState: 'guest',
      hasActiveSubscription: false,
      planId: null,
      planName: null,
      permissions: { ...DEFAULT_FREE_PERMISSIONS },
      subscription: null,
    };
  }

  const db = getDb();
  const userRow = db
    .prepare('SELECT status FROM users WHERE id = ?')
    .get(opts.userId) as { status?: string } | undefined;

  if (!userRow || userRow.status === 'suspended') {
    return {
      viewerState: 'suspended',
      hasActiveSubscription: false,
      planId: null,
      planName: null,
      permissions: { ...DEFAULT_FREE_PERMISSIONS },
      subscription: null,
    };
  }

  const sub = getUserEffectiveSubscription(opts.userId);

  if (sub.status === 'suspended') {
    return {
      viewerState: 'suspended',
      hasActiveSubscription: false,
      planId: sub.plan_id,
      planName: sub.plan_name,
      permissions: { ...DEFAULT_FREE_PERMISSIONS },
      subscription: sub,
    };
  }

  if (sub.expired || sub.status === 'expired') {
    return {
      viewerState: 'expired',
      hasActiveSubscription: false,
      planId: sub.plan_id,
      planName: sub.plan_name,
      permissions: { ...DEFAULT_FREE_PERMISSIONS },
      subscription: sub,
    };
  }

  if (sub.effective_active) {
    return {
      viewerState: 'subscribed',
      hasActiveSubscription: true,
      planId: sub.plan_id,
      planName: sub.plan_name,
      permissions: sub.permissions ? { ...sub.permissions } : { ...DEFAULT_PAID_PERMISSIONS },
      subscription: sub,
    };
  }

  return {
    viewerState: 'free',
    hasActiveSubscription: false,
    planId: sub.plan_id,
    planName: sub.plan_name,
    permissions: { ...DEFAULT_FREE_PERMISSIONS },
    subscription: sub,
  };
}

export function evaluateCafeAccess(
  cafe: LocationItem,
  viewer: ViewerAccessContext,
  settings: SiteSettings
): CafeAccessInfo {
  const cafeRule: CafeAccessRule = cafe.access_rule || 'inherit';
  const allowedPlanIds = Array.isArray(cafe.allowed_plan_ids) ? cafe.allowed_plan_ids : [];
  const globalAccess = normalizeAccessControlSettings(settings.access_control);
  const sectionOverrides = cafe.locked_sections_override || {};

  const unlockedSections: Record<AccessSectionKey, boolean> = {
    wifi_details: false,
    power_sockets: false,
    workspace_details: false,
    food_menu: false,
    menu_pricing: false,
    amenities: false,
    subscriber_benefits: false,
    booking: false,
  };

  if (viewer.viewerState === 'admin') {
    for (const key of ACCESS_SECTION_KEYS) {
      unlockedSections[key] = true;
    }
    return {
      hasAccess: true,
      viewerState: 'admin',
      cafeRule,
      allowedPlanIds,
      unlockedSections,
      lockedSections: [],
      lockReason: 'none',
    };
  }

  const planAllowedForCafe =
    cafeRule !== 'specific_plans' ||
    allowedPlanIds.length === 0 ||
    (viewer.planId !== null && allowedPlanIds.includes(viewer.planId));

  for (const sec of ACCESS_SECTION_KEYS) {
    const override = sectionOverrides[sec];
    let requiresSub: boolean;

    if (override === 'public') {
      requiresSub = false;
    } else if (override === 'subscription') {
      requiresSub = true;
    } else if (cafeRule === 'free_public') {
      requiresSub = false;
    } else if (cafeRule === 'subscription_required' || cafeRule === 'specific_plans') {
      requiresSub = true;
    } else {
      // 'inherit' from global settings
      requiresSub =
        globalAccess.default_rule === 'subscription_required'
          ? globalAccess.sections[sec] !== 'public'
          : globalAccess.sections[sec] === 'subscription';
    }

    if (!requiresSub) {
      unlockedSections[sec] = true;
    } else {
      unlockedSections[sec] =
        viewer.hasActiveSubscription &&
        planAllowedForCafe &&
        Boolean(viewer.permissions[sec]);
    }
  }

  const lockedSections = ACCESS_SECTION_KEYS.filter((k) => !unlockedSections[k]);
  const hasAccess =
    cafeRule === 'free_public' ||
    (viewer.hasActiveSubscription &&
      planAllowedForCafe &&
      ACCESS_SECTION_KEYS.some((k) => unlockedSections[k]));

  let lockReason: CafeAccessInfo['lockReason'] = 'none';
  if (lockedSections.length > 0 && !hasAccess) {
    if (viewer.viewerState === 'guest') {
      lockReason = 'guest';
    } else if (viewer.viewerState === 'expired') {
      lockReason = 'expired';
    } else if (viewer.viewerState === 'suspended') {
      lockReason = 'suspended';
    } else if (viewer.viewerState === 'subscribed' && !planAllowedForCafe) {
      lockReason = 'plan_restricted';
    } else {
      lockReason = 'no_subscription';
    }
  } else if (lockedSections.length > 0 && viewer.viewerState === 'subscribed') {
    lockReason = 'plan_restricted';
  }

  return {
    hasAccess,
    viewerState: viewer.viewerState,
    cafeRule,
    allowedPlanIds,
    unlockedSections,
    lockedSections,
    lockReason,
  };
}

export function sanitizeCafeForAccess(
  cafe: LocationItem,
  viewer: ViewerAccessContext,
  settings: SiteSettings
): LocationItem {
  const access = evaluateCafeAccess(cafe, viewer, settings);
  if (viewer.viewerState === 'admin') {
    return { ...cafe, access };
  }

  const u = access.unlockedSections;
  const out: LocationItem = {
    ...cafe,
    // Keep public preview details intact: id, slug, name, category, city, area, address, map_link, lat, lng, timings, description, photos (cover), verdict, rating, rating_count, modes, verified, featured
    access,
  };

  // Never expose internal access override config publicly (only summarized `access`)
  delete out.access_rule;
  delete out.allowed_plan_ids;
  delete out.locked_sections_override;

  if (!u.wifi_details) {
    out.wifi_available = 'unknown';
    out.wifi_mbps = null;
    out.wifi_password = '';
  }

  if (!u.power_sockets) {
    out.charging_sockets = 'unknown';
    out.sockets_count = null;
    out.sockets_claimed = false;
  }

  if (!u.workspace_details) {
    out.comfortable_seating = 'unknown';
    out.seating_info = '';
    out.ambience = '';
    out.outdoor_seating = 'unknown';
    out.suitable_for_studying = 'unknown';
    out.suitable_for_working = 'unknown';
    out.noise_level = null;
    out.min_spend = null;
    out.laptop_friendly = false;
    out.time_limit = null;
    out.avoid_if = null;
    out.best_for = [];
    out.claims = [];
  }

  if (!u.food_menu) {
    out.popular_items = [];
    out.menu_services = [];
    out.menu_items = [];
    out.menu_url = '';
  } else if (!u.menu_pricing) {
    out.menu_services = (out.menu_services || []).map((m) => ({ ...m, price: '' }));
    out.menu_items = (out.menu_items || []).map((m) => ({
      ...m,
      price_inr: 0,
      discount_price_inr: null,
    }));
  }

  if (!u.menu_pricing) {
    out.avg_cost_per_person = null;
    out.price_range = '';
    out.coffee_price = null;
    out.tea_price = null;
    out.snacks_price = null;
    out.meals_price = null;
  }

  if (!u.amenities) {
    out.facilities = [];
    out.website_url = '';
    out.instagram_url = '';
    out.other_social_links = '';
    out.phone = '';
  }

  if (!u.subscriber_benefits) {
    out.offers = [];
    out.student_discount = null;
    out.subscriber_benefits = [];
  }

  return out;
}

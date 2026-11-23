import type { LocationItem } from './cms';

export type PlanTier = 'free' | 'plus' | 'premium' | (string & {});

export type PlanPermissionKey =
  | 'wifi_details'
  | 'power_sockets'
  | 'workspace_details'
  | 'food_menu'
  | 'menu_pricing'
  | 'amenities'
  | 'subscriber_benefits'
  | 'booking'
  | 'collections'
  | 'compare';

export type PlanPermissions = Record<PlanPermissionKey, boolean>;

export interface SubscriptionPlan {
  id: PlanTier;
  name: string;
  tagline: string;
  price_inr: number;
  interval_days: number;
  badge_text: string;
  promo_note?: string;
  usage_limits?: string;
  is_recommended?: boolean;
  features: string[];
  permissions?: PlanPermissions;
  cafe_access_scope?: 'all' | 'specific';
  sort_order: number;
  active: boolean;
  updated_at: number;
}

export interface UserProfile {
  id: number;
  supabase_id?: string | null;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  auth_provider: 'email' | 'google';
  email_verified: boolean;
  status: 'active' | 'suspended';
  last_login_at?: number | null;
  created_at: number;
}

export interface UserSubscription {
  id: number;
  user_id: number;
  plan_id: PlanTier;
  plan_name: string;
  price_inr: number;
  subscribed_price_inr?: number;
  status: 'active' | 'cancelled' | 'expired' | 'past_due' | 'suspended';
  started_at: number;
  expires_at: number | null;
  auto_renew: boolean;
  cancelled_at: number | null;
  expired?: boolean;
  expired_from_plan?: string | null;
  expired_from_plan_name?: string | null;
  expired_at?: number | null;
  suspended_at?: number | null;
  effective_active?: boolean;
  permissions?: PlanPermissions;
  updated_at: number;
}

export interface PaymentRecord {
  id: number;
  receipt_number: string;
  user_id: number;
  user_name?: string;
  user_email?: string;
  plan_id: PlanTier;
  plan_name?: string;
  amount_inr: number;
  currency: string;
  method: 'upi' | 'card' | 'netbanking' | 'admin_grant' | 'test';
  provider: 'razorpay' | 'razorpay_test';
  provider_order_id: string;
  provider_payment_id: string;
  status: 'created' | 'paid' | 'failed' | 'refunded';
  failure_reason: string;
  refunded_at: number | null;
  created_at: number;
}

export interface SubscriptionHistoryItem {
  id: number;
  user_id: number;
  action: string;
  from_plan: string;
  to_plan: string;
  note: string;
  created_at: number;
}

export interface CafeLibrarySnapshot {
  key: string;
  source: 'curated' | 'google';
  name: string;
  area: string;
  address: string;
  slug?: string;
  place_id?: string;
  photo?: string;
  map_link: string;
  website_url?: string;
  rating?: number | null;
  avg_cost_per_person?: number | null;
  wifi_available?: LocationItem['wifi_available'];
  wifi_mbps?: number | null;
}

export interface SavedCafeRecord {
  id: number;
  user_id: number;
  cafe_key: string;
  cafe_source: 'curated' | 'google';
  snapshot: CafeLibrarySnapshot;
  is_favourite: boolean;
  created_at: number;
}

export interface CollectionCafeItem {
  cafe_key: string;
  snapshot: CafeLibrarySnapshot;
  added_at: number;
}

export interface UserCollection {
  id: number;
  user_id: number;
  name: string;
  description: string;
  items: CollectionCafeItem[];
  created_at: number;
}

export interface UpgradePromptState {
  featureName: string;
  requiredPlan: 'plus' | 'premium';
  description?: string;
  freeSignInOnly?: boolean;
}

export type SuggestionCategory =
  | 'New Feature'
  | 'Improvement'
  | 'Cafe Information'
  | 'Bug'
  | 'Other';

export type SuggestionStatus =
  | 'new'
  | 'under_review'
  | 'planned'
  | 'implemented'
  | 'rejected';

export interface FeatureSuggestion {
  id: number;
  title: string;
  category: SuggestionCategory;
  details: string;
  email: string;
  status: SuggestionStatus;
  admin_notes: string;
  created_at: number;
  updated_at: number;
}

export interface AuditLogEntry {
  id: number;
  actor: string;
  action: string;
  target: string;
  previous_value: string;
  new_value: string;
  created_at: number;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type BookingPaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'pay_at_cafe';

export interface BookingRecord {
  id: number;
  booking_ref: string;
  user_id: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  cafe_id: string;
  cafe_name: string;
  workspace_type: string;
  booking_date: string;
  time_slot: string;
  guests_count: number;
  amount_inr: number;
  payment_status: BookingPaymentStatus;
  status: BookingStatus;
  notes: string;
  created_at: number;
  updated_at: number;
}

export interface CustomerFeedbackItem {
  id: number;
  source: 'suggestion' | 'submission';
  category: string;
  title: string;
  details: string;
  status: string;
  admin_notes: string;
  created_at: number;
}

export interface UserLoginEvent {
  id: number;
  event_type: string;
  provider: string;
  ip_address: string;
  user_agent: string;
  created_at: number;
}

export interface AdminUserDetailsPayload {
  user: UserProfile;
  subscription: UserSubscription | null;
  payments: PaymentRecord[];
  history: SubscriptionHistoryItem[];
  savedCafes: SavedCafeRecord[];
  collections: UserCollection[];
  bookings?: BookingRecord[];
  feedback?: CustomerFeedbackItem[];
  loginEvents?: UserLoginEvent[];
}

export interface AdminUserDirectoryUser extends UserProfile {
  subscription: UserSubscription;
  total_spent_inr: number;
  bookings_count: number;
  last_payment_at: number | null;
  last_payment_status: string;
}

export interface AdminUserDirectoryPayload {
  supabaseConfigured: boolean;
  analytics: {
    totalUsers: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
    verifiedUsers: number;
    unverifiedUsers: number;
    activeUsers: number;
    suspendedUsers: number;
  };
  recentRegistrations: AdminUserDirectoryUser[];
  users: AdminUserDirectoryUser[];
  plans: SubscriptionPlan[];
}

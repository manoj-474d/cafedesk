import { DEFAULT_SCORING_CONFIG } from '../config/constants';
import type { LocationItem, ScoringConfig } from '../types/cms';
import {
  extractCafeMenuEntries,
  normalizeFoodText,
  type ParsedMenuEntry,
} from './smartFoodSearch';

export interface ScoreFactorBreakdown {
  key: string;
  label: string;
  points: number;
  maxPoints: number;
  status: 'verified' | 'partial' | 'unverified' | 'negative';
  detail: string;
}

export interface WorkReadyScoreResult {
  score: number | null;
  insufficientData: boolean;
  label: string;
  verifiedFactorCount: number;
  breakdown: ScoreFactorBreakdown[];
}

export interface ProvenanceBadgeItem {
  label: string;
  kind: 'verified' | 'owner' | 'community' | 'google' | 'unverified';
}

export interface InformationConfidenceResult {
  score: number;
  tier: 'High' | 'Moderate' | 'Low';
  lastVerifiedLabel: string;
  provenanceTags: ProvenanceBadgeItem[];
  breakdown: ScoreFactorBreakdown[];
}

export type MenuIntelligenceBucket =
  | 'Tea'
  | 'Coffee'
  | 'Breakfast'
  | 'Snacks'
  | 'Desserts'
  | 'Meals';

export interface MenuIntelligenceEntry extends ParsedMenuEntry {
  bucket: MenuIntelligenceBucket;
  priceStatus: 'confirmed' | 'estimate' | 'missing';
}

export interface MenuBucketSummary {
  bucket: MenuIntelligenceBucket;
  entries: MenuIntelligenceEntry[];
  confirmedLowestInr: number | null;
  confirmedHighestInr: number | null;
  confirmedAvgInr: number | null;
  confirmedCount: number;
  estimateCount: number;
  missingCount: number;
  bandText: string | null;
}

export interface CafeMenuIntelligence {
  buckets: MenuBucketSummary[];
  totalItems: number;
  confirmedPricedCount: number;
  estimateOnlyCount: number;
  missingPriceCount: number;
  sourceLabel: string;
  updatedLabel: string;
}

export function formatVerifiedDateLabel(raw: string | null | undefined): string {
  if (!raw) return 'Not verified yet';
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return String(raw);
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(parsed));
  } catch {
    return String(raw);
  }
}

export function computeWorkReadyScore(
  loc: LocationItem,
  scoringConfig?: ScoringConfig
): WorkReadyScoreResult {
  const weights = scoringConfig?.work_ready_weights ?? DEFAULT_SCORING_CONFIG.work_ready_weights;
  const breakdown: ScoreFactorBreakdown[] = [];
  let verifiedSignals = 0;

  // 1. Wi-Fi evaluation
  let wifiPoints = 0;
  let wifiStatus: ScoreFactorBreakdown['status'] = 'unverified';
  let wifiDetail = 'Wi-Fi not verified yet';
  if (loc.wifi_available === 'yes' || (loc.wifi_mbps !== null && loc.wifi_mbps > 0)) {
    verifiedSignals += 1;
    if (loc.wifi_mbps !== null && loc.wifi_mbps >= 80) {
      wifiPoints = weights.wifi;
      wifiStatus = 'verified';
      wifiDetail = `Measured ${loc.wifi_mbps} Mbps`;
    } else if (loc.wifi_mbps !== null && loc.wifi_mbps >= 40) {
      wifiPoints = Math.round(weights.wifi * 0.85);
      wifiStatus = 'verified';
      wifiDetail = `Measured ${loc.wifi_mbps} Mbps`;
    } else if (loc.wifi_mbps !== null && loc.wifi_mbps > 0) {
      wifiPoints = Math.round(weights.wifi * 0.65);
      wifiStatus = 'partial';
      wifiDetail = `${loc.wifi_mbps} Mbps reported`;
    } else {
      wifiPoints = Math.round(weights.wifi * 0.65);
      wifiStatus = 'partial';
      wifiDetail = 'Customer Wi-Fi available (speed unmeasured)';
    }
  } else if (loc.wifi_available === 'no') {
    verifiedSignals += 1;
    wifiStatus = 'negative';
    wifiDetail = 'No customer Wi-Fi';
  }
  breakdown.push({
    key: 'wifi',
    label: 'Wi-Fi Reliability',
    points: wifiPoints,
    maxPoints: weights.wifi,
    status: wifiStatus,
    detail: wifiDetail,
  });

  // 2. Charging sockets
  let socketsPoints = 0;
  let socketsStatus: ScoreFactorBreakdown['status'] = 'unverified';
  let socketsDetail = 'Charging sockets not verified';
  if (loc.sockets_count !== null && loc.sockets_count > 0) {
    verifiedSignals += 1;
    if (loc.sockets_count >= 12) {
      socketsPoints = weights.sockets;
      socketsStatus = 'verified';
    } else if (loc.sockets_count >= 4) {
      socketsPoints = Math.round(weights.sockets * 0.8);
      socketsStatus = 'verified';
    } else {
      socketsPoints = Math.round(weights.sockets * 0.55);
      socketsStatus = 'partial';
    }
    socketsDetail = `${loc.sockets_count} power sockets recorded`;
  } else if (loc.charging_sockets === 'yes' || loc.sockets_claimed) {
    verifiedSignals += 1;
    socketsPoints = Math.round(weights.sockets * 0.72);
    socketsStatus = 'partial';
    socketsDetail = 'Power sockets available near tables';
  } else if (loc.charging_sockets === 'no') {
    verifiedSignals += 1;
    socketsStatus = 'negative';
    socketsDetail = 'Limited or no power sockets';
  }
  breakdown.push({
    key: 'sockets',
    label: 'Charging Points',
    points: socketsPoints,
    maxPoints: weights.sockets,
    status: socketsStatus,
    detail: socketsDetail,
  });

  // 3. Seating comfort
  let seatingPoints = 0;
  let seatingStatus: ScoreFactorBreakdown['status'] = 'unverified';
  let seatingDetail = 'Seating comfort not verified';
  if (loc.comfortable_seating === 'yes' || loc.seating_info) {
    verifiedSignals += 1;
    seatingPoints =
      loc.comfortable_seating === 'yes' && loc.seating_info
        ? weights.seating
        : Math.round(weights.seating * 0.78);
    seatingStatus = loc.comfortable_seating === 'yes' ? 'verified' : 'partial';
    seatingDetail = loc.seating_info || 'Comfortable seating for extended stays';
  } else if (loc.comfortable_seating === 'no') {
    verifiedSignals += 1;
    seatingPoints = Math.round(weights.seating * 0.25);
    seatingStatus = 'negative';
    seatingDetail = 'Compact / quick-turn seating';
  }
  breakdown.push({
    key: 'seating',
    label: 'Desk & Seating Comfort',
    points: seatingPoints,
    maxPoints: weights.seating,
    status: seatingStatus,
    detail: seatingDetail,
  });

  // 4. Noise environment
  let noisePoints = 0;
  let noiseStatus: ScoreFactorBreakdown['status'] = 'unverified';
  let noiseDetail = 'Noise level not measured yet';
  if (loc.noise_level !== null) {
    verifiedSignals += 1;
    if (loc.noise_level <= 2) {
      noisePoints = weights.noise;
      noiseStatus = 'verified';
      noiseDetail = 'Quiet acoustic setting';
    } else if (loc.noise_level === 3) {
      noisePoints = Math.round(weights.noise * 0.72);
      noiseStatus = 'partial';
      noiseDetail = 'Moderate cafe hum';
    } else {
      noisePoints = Math.round(weights.noise * 0.35);
      noiseStatus = 'negative';
      noiseDetail = 'Busy & lively sound levels';
    }
  }
  breakdown.push({
    key: 'noise',
    label: 'Acoustic Calm',
    points: noisePoints,
    maxPoints: weights.noise,
    status: noiseStatus,
    detail: noiseDetail,
  });

  // 5. Affordability for sessions
  let affordPoints = 0;
  let affordStatus: ScoreFactorBreakdown['status'] = 'unverified';
  let affordDetail = 'Session spend not verified';
  if (loc.avg_cost_per_person !== null && loc.avg_cost_per_person > 0) {
    if (loc.avg_cost_per_person <= 220) {
      affordPoints = weights.affordability;
      affordStatus = 'verified';
      affordDetail = `Pocket-friendly (~₹${loc.avg_cost_per_person}/visit)`;
    } else if (loc.avg_cost_per_person <= 380) {
      affordPoints = Math.round(weights.affordability * 0.75);
      affordStatus = 'partial';
      affordDetail = `Moderate (~₹${loc.avg_cost_per_person}/visit)`;
    } else {
      affordPoints = Math.round(weights.affordability * 0.45);
      affordStatus = 'partial';
      affordDetail = `Upper-tier (~₹${loc.avg_cost_per_person}/visit)`;
    }
  }
  breakdown.push({
    key: 'affordability',
    label: 'Budget Sustainability',
    points: affordPoints,
    maxPoints: weights.affordability,
    status: affordStatus,
    detail: affordDetail,
  });

  // 6. Workspace & study suitability
  let fitPoints = 0;
  let fitStatus: ScoreFactorBreakdown['status'] = 'unverified';
  let fitDetail = 'Workspace policy not verified';
  if (loc.laptop_friendly || loc.suitable_for_working === 'yes' || loc.suitable_for_studying === 'yes') {
    verifiedSignals += 1;
    const checks = [
      loc.laptop_friendly,
      loc.suitable_for_working === 'yes',
      loc.suitable_for_studying === 'yes',
    ].filter(Boolean).length;
    fitPoints = Math.round(weights.workspace_fit * (checks >= 2 ? 1 : 0.72));
    fitStatus = 'verified';
    fitDetail =
      loc.suitable_for_working === 'yes' && loc.suitable_for_studying === 'yes'
        ? 'Verified for both laptop work & studying'
        : loc.suitable_for_studying === 'yes'
        ? 'Suited for studying & reading'
        : 'Laptop-friendly tables';
  } else if (loc.suitable_for_working === 'no' && loc.suitable_for_studying === 'no') {
    verifiedSignals += 1;
    fitStatus = 'negative';
    fitDetail = 'Short-stay / non-work venue';
  }
  breakdown.push({
    key: 'workspace_fit',
    label: 'Work & Study Fit',
    points: fitPoints,
    maxPoints: weights.workspace_fit,
    status: fitStatus,
    detail: fitDetail,
  });

  // Never fabricate a Work-Ready score on unverified Google Places or incomplete listings
  if (verifiedSignals < 2) {
    return {
      score: null,
      insufficientData: true,
      label: 'Workspace specs not verified yet',
      verifiedFactorCount: verifiedSignals,
      breakdown,
    };
  }

  const maxTotal =
    weights.wifi +
    weights.sockets +
    weights.seating +
    weights.noise +
    weights.affordability +
    weights.workspace_fit;
  const rawEarned = breakdown.reduce((sum, item) => sum + item.points, 0);
  const normalized = maxTotal > 0 ? Math.min(100, Math.max(0, Math.round((rawEarned / maxTotal) * 100))) : 0;

  const label =
    normalized >= 80
      ? 'Excellent for Work & Study'
      : normalized >= 60
      ? 'Good All-Round Workspace'
      : normalized >= 40
      ? 'Casual / Short Sessions'
      : 'Quick Stop / Social Spot';

  return {
    score: normalized,
    insufficientData: false,
    label,
    verifiedFactorCount: verifiedSignals,
    breakdown,
  };
}

export function computeInformationConfidenceScore(
  loc: LocationItem,
  scoringConfig?: ScoringConfig
): InformationConfidenceResult {
  const weights = scoringConfig?.confidence_weights ?? DEFAULT_SCORING_CONFIG.confidence_weights;
  const breakdown: ScoreFactorBreakdown[] = [];

  // 1. Editorial / Owner verification
  let verPoints = 0;
  let verStatus: ScoreFactorBreakdown['status'] = 'unverified';
  let verDetail = 'Pending independent field verification';
  if (loc.verified && loc.owner_verified) {
    verPoints = weights.verified_badge;
    verStatus = 'verified';
    verDetail = 'Both CafeDesk editorial & owner verified';
  } else if (loc.verified) {
    verPoints = Math.round(weights.verified_badge * 0.9);
    verStatus = 'verified';
    verDetail = 'Verified by CafeDesk editorial team';
  } else if (loc.owner_verified) {
    verPoints = Math.round(weights.verified_badge * 0.72);
    verStatus = 'partial';
    verDetail = 'Confirmed by claimed cafe owner';
  } else if (loc.source_type === 'community_updated') {
    verPoints = Math.round(weights.verified_badge * 0.5);
    verStatus = 'partial';
    verDetail = 'Community-submitted update pending editorial audit';
  }
  breakdown.push({
    key: 'verified_badge',
    label: 'Verification Status',
    points: verPoints,
    maxPoints: weights.verified_badge,
    status: verStatus,
    detail: verDetail,
  });

  // 2. Recency of last verification
  let recencyPoints = 0;
  let recencyStatus: ScoreFactorBreakdown['status'] = 'unverified';
  let recencyDetail = 'No recent verification date recorded';
  const lastVerifiedLabel = formatVerifiedDateLabel(loc.last_verified_date);
  if (loc.last_verified_date) {
    const ts = Date.parse(loc.last_verified_date);
    if (!Number.isNaN(ts)) {
      const ageDays = Math.max(0, Math.floor((Date.now() - ts) / 86400000));
      if (ageDays <= 45) {
        recencyPoints = weights.recency;
        recencyStatus = 'verified';
        recencyDetail = `Verified ${ageDays}d ago (${lastVerifiedLabel})`;
      } else if (ageDays <= 180) {
        recencyPoints = Math.round(weights.recency * 0.78);
        recencyStatus = 'verified';
        recencyDetail = `Verified within 6 months (${lastVerifiedLabel})`;
      } else if (ageDays <= 365) {
        recencyPoints = Math.round(weights.recency * 0.55);
        recencyStatus = 'partial';
        recencyDetail = `Last verified ${lastVerifiedLabel}`;
      } else {
        recencyPoints = Math.round(weights.recency * 0.35);
        recencyStatus = 'partial';
        recencyDetail = `Older check (${lastVerifiedLabel}) — refresh recommended`;
      }
    }
  }
  breakdown.push({
    key: 'recency',
    label: 'Data Freshness',
    points: recencyPoints,
    maxPoints: weights.recency,
    status: recencyStatus,
    detail: recencyDetail,
  });

  // 3. Field completeness
  const completenessChecks = [
    Boolean(loc.address && loc.address.length > 6),
    Boolean(loc.timings && loc.timings !== 'Check hours'),
    loc.lat !== null && loc.lng !== null,
    Boolean(
      (loc.menu_items && loc.menu_items.length > 0) ||
        loc.popular_items.length > 0 ||
        loc.tea_price ||
        loc.coffee_price
    ),
    loc.avg_cost_per_person !== null || loc.popular_items.length > 0,
    loc.wifi_available !== 'unknown',
    loc.charging_sockets !== 'unknown' || loc.sockets_count !== null,
    loc.noise_level !== null,
    loc.facilities.length > 0,
    Boolean(loc.phone || loc.website_url || loc.instagram_url),
  ];
  const filledCount = completenessChecks.filter(Boolean).length;
  const completenessPoints = Math.round(
    (filledCount / completenessChecks.length) * weights.completeness
  );
  breakdown.push({
    key: 'completeness',
    label: 'Profile Completeness',
    points: completenessPoints,
    maxPoints: weights.completeness,
    status: filledCount >= 7 ? 'verified' : filledCount >= 4 ? 'partial' : 'unverified',
    detail: `${filledCount} of ${completenessChecks.length} key fields populated`,
  });

  // 4. Approved photos
  let photoPoints = 0;
  let photoStatus: ScoreFactorBreakdown['status'] = 'unverified';
  let photoDetail = 'No verified cafe photos yet';
  if (loc.photos_approved && loc.photos.length >= 3) {
    photoPoints = weights.photos_verified;
    photoStatus = 'verified';
    photoDetail = `${loc.photos.length} approved photos`;
  } else if (loc.photos_approved && loc.photos.length > 0) {
    photoPoints = Math.round(weights.photos_verified * 0.72);
    photoStatus = 'partial';
    photoDetail = `${loc.photos.length} approved photo${loc.photos.length === 1 ? '' : 's'}`;
  }
  breakdown.push({
    key: 'photos_verified',
    label: 'Visual Proof',
    points: photoPoints,
    maxPoints: weights.photos_verified,
    status: photoStatus,
    detail: photoDetail,
  });

  // 5. Source attribution & community confirmations
  let srcPoints = 0;
  let srcStatus: ScoreFactorBreakdown['status'] = 'unverified';
  let srcDetail = 'Source attribution missing';
  const communityReports =
    (loc.review_summary?.verified_wifi_reports ?? 0) +
    (loc.review_summary?.verified_socket_reports ?? 0);
  if (loc.source_name && loc.source_url) {
    srcPoints = weights.source_attribution;
    srcStatus = 'verified';
    srcDetail = `Attributed to ${loc.source_name}`;
  } else if (loc.source_name || communityReports > 0) {
    srcPoints = Math.round(weights.source_attribution * 0.7);
    srcStatus = 'partial';
    srcDetail = loc.source_name
      ? `Source: ${loc.source_name}`
      : `${communityReports} community facility check(s)`;
  }
  breakdown.push({
    key: 'source_attribution',
    label: 'Source Attribution',
    points: srcPoints,
    maxPoints: weights.source_attribution,
    status: srcStatus,
    detail: srcDetail,
  });

  const maxTotal =
    weights.verified_badge +
    weights.recency +
    weights.completeness +
    weights.photos_verified +
    weights.source_attribution;
  const rawEarned = breakdown.reduce((sum, item) => sum + item.points, 0);
  const score = maxTotal > 0 ? Math.min(100, Math.max(0, Math.round((rawEarned / maxTotal) * 100))) : 0;

  const tier: InformationConfidenceResult['tier'] =
    score >= 75 ? 'High' : score >= 45 ? 'Moderate' : 'Low';

  const provenanceTags: ProvenanceBadgeItem[] = [];
  if (loc.verified) {
    provenanceTags.push({ label: 'CafeDesk Verified', kind: 'verified' });
  }
  if (loc.owner_verified) {
    provenanceTags.push({ label: 'Owner-Verified', kind: 'owner' });
  }
  if (loc.source_type === 'community_updated' || (loc.review_summary?.review_count ?? 0) > 0) {
    provenanceTags.push({ label: 'Community-Contributed', kind: 'community' });
  }
  if (loc.source_type === 'google_places' || loc.isLiveGooglePlace) {
    provenanceTags.push({ label: 'Google Places Feed', kind: 'google' });
  }
  if (provenanceTags.length === 0) {
    provenanceTags.push({ label: 'Unverified Listing', kind: 'unverified' });
  }

  return {
    score,
    tier,
    lastVerifiedLabel,
    provenanceTags,
    breakdown,
  };
}

function classifyMenuBucket(entry: ParsedMenuEntry): MenuIntelligenceBucket {
  const hay = normalizeFoodText(`${entry.category} ${entry.name} ${entry.description}`);
  if (/\b(tea|chai|kullad|matcha|irani chai|green tea|iced tea)\b/.test(hay)) return 'Tea';
  if (/\b(coffee|kaapi|espresso|latte|cappuccino|americano|mocha|cortado|cold brew|frappe|pour over)\b/.test(hay)) {
    return 'Coffee';
  }
  if (/\b(dessert|cake|pastry|cheesecake|brownie|tiramisu|donut|waffle|gelato|ice cream|muffin|cookie|sweet)\b/.test(hay)) {
    return 'Desserts';
  }
  if (/\b(breakfast|tiffin|idli|dosa|poha|upma|omelette|toast|bun maska|bagel|shakshuka|pancake)\b/.test(hay)) {
    return 'Breakfast';
  }
  if (/\b(meal|meals|pasta|pizza|biryani|rice|thali|bowl|noodle|parotta|wrap|roll|combo|sub)\b/.test(hay)) {
    return 'Meals';
  }
  return 'Snacks';
}

export function buildCafeMenuIntelligence(loc: LocationItem): CafeMenuIntelligence {
  const rawEntries = extractCafeMenuEntries(loc);
  const bucketsOrder: MenuIntelligenceBucket[] = [
    'Tea',
    'Coffee',
    'Breakfast',
    'Snacks',
    'Desserts',
    'Meals',
  ];
  const bandLookup: Record<MenuIntelligenceBucket, string | null> = {
    Tea: loc.tea_price || null,
    Coffee: loc.coffee_price || null,
    Breakfast: null,
    Snacks: loc.snacks_price || null,
    Desserts: loc.desserts_price || null,
    Meals: loc.meals_price || null,
  };

  const bucketMap = new Map<MenuIntelligenceBucket, MenuIntelligenceEntry[]>();
  bucketsOrder.forEach((b) => bucketMap.set(b, []));

  for (const entry of rawEntries) {
    const bucket = classifyMenuBucket(entry);
    const priceStatus: MenuIntelligenceEntry['priceStatus'] =
      entry.priceInr !== null && entry.priceInr > 0
        ? entry.source === 'band_item'
          ? 'estimate'
          : 'confirmed'
        : 'missing';
    bucketMap.get(bucket)!.push({
      ...entry,
      bucket,
      priceStatus,
    });
  }

  let confirmedPricedCount = 0;
  let estimateOnlyCount = 0;
  let missingPriceCount = 0;

  const buckets: MenuBucketSummary[] = bucketsOrder
    .map((bucket) => {
      const entries = bucketMap.get(bucket)!;
      const confirmedPrices = entries
        .filter((e) => e.priceStatus === 'confirmed' && e.priceInr !== null)
        .map((e) => e.priceInr as number);
      const estimates = entries.filter((e) => e.priceStatus === 'estimate');
      const missing = entries.filter((e) => e.priceStatus === 'missing');

      confirmedPricedCount += confirmedPrices.length;
      estimateOnlyCount += estimates.length;
      missingPriceCount += missing.length;

      const confirmedAvgInr =
        confirmedPrices.length > 0
          ? Math.round(confirmedPrices.reduce((a, b) => a + b, 0) / confirmedPrices.length)
          : null;

      return {
        bucket,
        entries,
        confirmedLowestInr: confirmedPrices.length > 0 ? Math.min(...confirmedPrices) : null,
        confirmedHighestInr: confirmedPrices.length > 0 ? Math.max(...confirmedPrices) : null,
        confirmedAvgInr,
        confirmedCount: confirmedPrices.length,
        estimateCount: estimates.length,
        missingCount: missing.length,
        bandText: bandLookup[bucket],
      };
    })
    .filter((b) => b.entries.length > 0 || Boolean(b.bandText));

  const sourceLabel = loc.owner_verified
    ? 'Owner-Verified Menu & CafeDesk Audit'
    : loc.source_name || (loc.isLiveGooglePlace ? 'Google Places Listing' : 'CafeDesk Field Check');

  return {
    buckets,
    totalItems: rawEntries.length,
    confirmedPricedCount,
    estimateOnlyCount,
    missingPriceCount,
    sourceLabel,
    updatedLabel: formatVerifiedDateLabel(loc.last_verified_date),
  };
}

import { BENGALURU_AREAS, BUDGET_BRACKETS, DEFAULT_BENGALURU_LOCALITIES, SUPPORTED_CITIES } from '../config/constants';
import type { LocalityRecord, LocationItem } from '../types/cms';

export interface ParsedMenuEntry {
  name: string;
  category: string;
  description: string;
  priceInr: number | null;
  source: 'menu_item' | 'menu_service' | 'popular_item' | 'band_item';
}

export interface ParsedSmartQuery {
  raw: string;
  cleanFoodQuery: string;
  foodTerms: string[];
  canonicalConcepts: string[];
  isFoodQuery: boolean;
  maxBudgetInr: number | null;
  minBudgetInr: number | null;
  detectedLocality: string;
  detectedCity: string;
  nearMe: boolean;
  openNow: boolean;
  wifiRequired: boolean;
  socketsRequired: boolean;
  familyFriendly: boolean;
  outdoorRequired: boolean;
  quietStudyRequired: boolean;
  workFriendlyRequired: boolean;
  intentTags: Array<'budget' | 'student' | 'breakfast' | 'study' | 'work' | 'snacks' | 'hidden_gem' | 'family' | 'dessert'>;
}

export interface SmartSearchMatchResult {
  matched: boolean;
  score: number;
  matchedVia: 'menu_item' | 'menu_category' | 'food_offering' | 'cafe_name' | 'locality' | 'none';
  matchedItems: ParsedMenuEntry[];
  lowestMatchedPriceInr: number | null;
  hasUnpricedMatchedItemsOnly: boolean;
}

const FOOD_CONCEPT_SYNONYMS: Record<string, string[]> = {
  tea: [
    'tea',
    'chai',
    'kullad tea',
    'kulhad tea',
    'kullad',
    'kulhad',
    'ginger tea',
    'adrak chai',
    'adrak tea',
    'masala chai',
    'masala tea',
    'dum tea',
    'dum chai',
    'elaichi chai',
    'elaichi tea',
    'tulsi ginger tea',
    'ayurvedic tea',
    'iced tea',
    'matcha',
    'matcha latte',
    'rose chai',
    'chocolate chai',
    'irani chai',
    'green tea',
  ],
  coffee: [
    'coffee',
    'kaapi',
    'filter coffee',
    'filter kaapi',
    'mysore filter coffee',
    'espresso',
    'cappuccino',
    'latte',
    'cafe latte',
    'flat white',
    'americano',
    'mocha',
    'cortado',
    'pour over',
    'pour-over',
    'v60',
    'manual brew',
    'cold coffee',
    'cold brew',
    'iced coffee',
    'shrappe',
    'shakerato',
    'vietnamese',
  ],
  'cold coffee': [
    'cold coffee',
    'iced coffee',
    'shrappe',
    'cold brew',
    'vietnamese iced coffee',
    'vietnamese cold brew',
    'shakerato',
    'frappe',
  ],
  burger: ['burger', 'burgers', 'aloo tikki burger', 'veggie burger', 'veg burger', 'slider', 'sliders'],
  sandwich: [
    'sandwich',
    'sandwiches',
    'toastie',
    'toasties',
    'cheese toastie',
    'veg paneer sandwich',
    'cheese corn sandwich',
    'grilled sandwich',
    'panini',
    'sub',
  ],
  pizza: ['pizza', 'pizzas', 'sourdough pizza', 'flatbread'],
  'french fries': ['french fries', 'fries', 'salted fries', 'salted french fries', 'peri peri fries'],
  milkshake: ['milkshake', 'milkshakes', 'shake', 'shakes', 'shrappe', 'smoothie', 'smoothies'],
  juice: ['juice', 'juices', 'fresh juice', 'cooler', 'lemonade', 'iced tea', 'cafe beverages', 'beverage'],
  dosa: ['dosa', 'dosas', 'masala dosa', 'set dosa'],
  maggi: ['maggi', 'maggie', 'plain maggi', 'cheese maggi', 'double masala maggi', 'egg maggi', 'noodles'],
  samosa: ['samosa', 'samosas', 'mini samosas'],
  'vada pav': ['vada pav', 'vadapav', 'batata vada pav', 'batata vada', 'vada'],
  idli: ['idli', 'idlis', 'idly'],
  parotta: ['parotta', 'paratha', 'poratta', 'porotta', 'parotta roll', 'poratta rolls', 'rolls', 'roll', 'wrap', 'wraps'],
  breakfast: [
    'breakfast',
    'tiffin',
    'morning',
    'poha',
    'upma',
    'bread butter',
    'bun maska',
    'maska bun',
    'bun jam',
    'bread omelette',
    'bread toast omelette',
    'bread toast',
    'avocado toast',
    'shakshuka',
    'bagel',
    'bagels',
  ],
  snacks: [
    'snack',
    'snacks',
    'quick bites',
    'puff',
    'puffs',
    'veg puff',
    'paneer puff',
    'mushroom puff',
    'egg puff',
    'maddur vada',
    'garlic toast',
    'onion rings',
    'kara bun',
    'cream bun',
    'korean bun',
    'waffle',
    'waffles',
    'biscuit',
    'biscuits',
    'osmania biscuit',
    'biscotti',
    'chaat',
  ],
  bakery: [
    'bakery',
    'puff',
    'puffs',
    'croissant',
    'croissants',
    'bun',
    'kara bun',
    'bun maska',
    'maska bun',
    'korean bun',
    'dilpasand',
    'cake',
    'cakes',
    'banana cake',
    'marble cake',
    'honey cake',
    'pastry',
    'pastries',
    'donut',
    'donuts',
    'biscuit',
    'biscuits',
    'pie',
    'pies',
    'quiche',
    'tartine',
  ],
  dessert: [
    'dessert',
    'desserts',
    'cake',
    'cakes',
    'pastry',
    'pastries',
    'cheesecake',
    'tiramisu',
    'brownie',
    'brownies',
    'plum cake',
    'chocolate cake',
    'muffin',
    'muffins',
    'cookie',
    'cookies',
    'pancake',
    'pancakes',
    'crepe',
    'churros',
    'donut',
    'donuts',
    'waffle',
    'waffles',
    'ice cream',
    'gelato',
    'sweet',
  ],
};

const ALL_FOOD_TOKENS: string[] = Array.from(
  new Set(
    Object.entries(FOOD_CONCEPT_SYNONYMS).flatMap(([concept, terms]) => [
      concept,
      ...terms.flatMap((t) => [t, ...t.split(/\s+/)]),
    ])
  )
).filter((t) => t.length >= 3);

const SPELLING_VARIANTS: Array<[RegExp, string]> = [
  [/\bkulhad\b/g, 'kullad'],
  [/\bmaggie\b/g, 'maggi'],
  [/\bporatta\b/g, 'parotta'],
  [/\bporotta\b/g, 'parotta'],
  [/\bparatha\b/g, 'parotta'],
  [/\bvadapav\b/g, 'vada pav'],
  [/\bmacha\b/g, 'matcha'],
  [/\bsandwitch(es)?\b/g, 'sandwich'],
  [/\bcappucino\b/g, 'cappuccino'],
  [/\bcapuccino\b/g, 'cappuccino'],
  [/\bexpresso\b/g, 'espresso'],
  [/\bchay\b/g, 'chai'],
  [/\bmaska bun\b/g, 'bun maska'],
  [/\bkhara bun\b/g, 'kara bun'],
  [/\bidly\b/g, 'idli'],
  [/\bcheescake\b/g, 'cheesecake'],
  [/\bbrownee(s)?\b/g, 'brownie'],
  [/\bwafle(s)?\b/g, 'waffle'],
  [/\bcroisant(s)?\b/g, 'croissant'],
  [/\btiramissu\b/g, 'tiramisu'],
  [/\bpanir\b/g, 'paneer'],
  [/\bmasla\b/g, 'masala'],
  [/\bkapi\b/g, 'kaapi'],
  [/\bdeserts?\b/g, 'dessert'],
];

export function normalizeFoodText(raw: string): string {
  let out = String(raw || '')
    .toLowerCase()
    .replace(/₹/g, ' rs ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [pattern, replacement] of SPELLING_VARIANTS) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function stemSingularWord(word: string): string {
  const w = word.trim();
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith('ches') || w.endsWith('shes') || w.endsWith('ses') || w.endsWith('xes')) {
    return w.slice(0, -2);
  }
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n];
}

function fuzzyWordMatch(token: string, targetWord: string): boolean {
  const a = stemSingularWord(token);
  const b = stemSingularWord(targetWord);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 3 && (b.startsWith(a) || a.startsWith(b))) return true;
  if (a.length >= 4 && b.length >= 4) {
    const maxDist = Math.max(a.length, b.length) >= 7 ? 2 : 1;
    return levenshteinDistance(a, b) <= maxDist;
  }
  return false;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LOCALITY_ALIASES: Array<{ match: RegExp; area: string }> = [
  { match: /\bhsr(\s+layout)?\b/i, area: 'HSR Layout' },
  { match: /\bbtm(\s+layout)?\b/i, area: 'BTM Layout' },
  { match: /\b(electronic\s*city|e[\s-]*city)\b/i, area: 'Electronic City' },
  { match: /\bmg\s*road\b/i, area: 'MG Road' },
  { match: /\bjp\s*nagar\b/i, area: 'JP Nagar' },
  { match: /\bchurch\s*street\b/i, area: 'Church Street' },
  { match: /\bvijay\s*nagar\b/i, area: 'Vijayanagar' },
  { match: /\bkoramang[ae]?la\b/i, area: 'Koramangala' },
  { match: /\bind[iy]?ranagar\b/i, area: 'Indiranagar' },
  { match: /\bjay[ae]?nagar\b/i, area: 'Jayanagar' },
  { match: /\bbanashank[ae]?ri\b/i, area: 'Banashankari' },
  { match: /\bwhitef[ie]+ld\b/i, area: 'Whitefield' },
  { match: /\bmalles[hw]*aram\b/i, area: 'Malleshwaram' },
  { match: /\bmarath[ah]*alli\b/i, area: 'Marathahalli' },
  { match: /\bhess?[ae]?r[ae]?g[ha]*tt?a\b/i, area: 'Hesaraghatta' },
  { match: /\bjalahalli(\s+(east|west|cross))?\b/i, area: 'Jalahalli' },
  { match: /\bnagasandra\b/i, area: 'Nagasandra' },
  { match: /\bpeenya(\s+(industrial|1st|2nd))?\b/i, area: 'Peenya' },
  { match: /\b(t\.?\s*)?dasarahalli\b/i, area: 'Dasarahalli' },
  { match: /\bbagal[au]gunte\b/i, area: 'Bagalagunte' },
  { match: /\bchikk?aban[ae]?[vw]ara\b/i, area: 'Chikkabanavara' },
  { match: /\babbigere?\b/i, area: 'Abbigere' },
  { match: /\bvidyaranya\s*pura\b/i, area: 'Vidyaranyapura' },
  { match: /\b(new\s+)?bel\s*(road|rd)\b/i, area: 'BEL Road' },
  { match: /\bsahakara?\s*nagar\b/i, area: 'Sahakara Nagar' },
  { match: /\b(rajarajeshwari|r\.?\s*r\.?)\s*nagar\b/i, area: 'RR Nagar' },
  { match: /\bnagar[ae]?bhavi\b/i, area: 'Nagarbhavi' },
  { match: /\bk\.?\s*r\.?\s*puram\b/i, area: 'KR Puram' },
  { match: /\bkrishnarajapura\b/i, area: 'KR Puram' },
  { match: /\bsarjapur(\s+road)?\b/i, area: 'Sarjapur Road' },
  ...DEFAULT_BENGALURU_LOCALITIES.flatMap((loc) =>
    [loc.name, ...loc.altSpellings, ...loc.localNames]
      .filter((t) => t.trim().length >= 3)
      .map((term) => ({
        match: new RegExp(`\\b${escapeRe(term)}\\b`, 'i'),
        area: loc.name,
      }))
  ),
  ...BENGALURU_AREAS.map((area) => ({
    match: new RegExp(`\\b${escapeRe(area)}\\b`, 'i'),
    area,
  })),
];

export function parseSmartFoodQuery(
  rawQuery: string,
  extraLocalities?: LocalityRecord[]
): ParsedSmartQuery {
  const raw = String(rawQuery || '').trim();
  let working = raw;
  const intentTags = new Set<ParsedSmartQuery['intentTags'][number]>();

  // 1. Price extraction
  let maxBudgetInr: number | null = null;
  let minBudgetInr: number | null = null;

  const underMatch = working.match(
    /\b(?:under|below|less\s+than|within|upto|up\s+to|max|<=?)\s*(?:₹|rs\.?|inr)?\s*(\d{2,4})\b/i
  );
  if (underMatch) {
    const val = Number(underMatch[1]);
    if (Number.isFinite(val) && val > 0) maxBudgetInr = val;
    working = working.replace(underMatch[0], ' ');
  } else {
    const symbolUnder = working.match(/<\s*(?:₹|rs\.?)\s*(\d{2,4})\b/i);
    if (symbolUnder) {
      maxBudgetInr = Number(symbolUnder[1]);
      working = working.replace(symbolUnder[0], ' ');
    }
  }

  const aboveMatch = working.match(
    /(?:(?:₹|rs\.?|inr)?\s*(\d{2,4})\s*(?:\+|and\s+above|above|onwards)|\b(?:above|over|min|>=?)\s*(?:₹|rs\.?|inr)?\s*(\d{2,4})\b)/i
  );
  if (aboveMatch && !underMatch) {
    const val = Number(aboveMatch[1] || aboveMatch[2]);
    if (Number.isFinite(val) && val > 0) minBudgetInr = val;
    working = working.replace(aboveMatch[0], ' ');
  }

  // 2. Near me / Open now
  let nearMe = false;
  const nearMePattern = /\b(near\s+me|nearby|around\s+me|close\s+to\s+me|near\s+my\s+college|near\s+my\s+hostel|near\s+college)\b/i;
  if (nearMePattern.test(working)) {
    nearMe = true;
    if (/college|hostel/i.test(working)) intentTags.add('student');
    working = working.replace(nearMePattern, ' ');
  }

  let openNow = false;
  const openNowPattern = /\b(open\s+now|open\s+right\s+now|currently\s+open)\b/i;
  if (openNowPattern.test(working)) {
    openNow = true;
    working = working.replace(openNowPattern, ' ');
  }

  // 3. Locality & City detection (static aliases -> dynamic DB localities -> fuzzy typo match)
  let detectedLocality = '';
  for (const alias of LOCALITY_ALIASES) {
    const m = working.match(alias.match);
    if (m) {
      detectedLocality = alias.area;
      working = working.replace(
        new RegExp(`\\b(?:in|at|near|around)?\\s*${escapeRe(m[0])}`, 'i'),
        ' '
      );
      break;
    }
  }

  if (!detectedLocality && extraLocalities && extraLocalities.length > 0) {
    for (const loc of extraLocalities) {
      const terms = [loc.name, ...loc.alt_spellings, ...loc.local_names].filter((t) => t.length >= 3);
      for (const t of terms) {
        const re = new RegExp(`\\b${escapeRe(t)}\\b`, 'i');
        const m = working.match(re);
        if (m) {
          detectedLocality = loc.name;
          working = working.replace(
            new RegExp(`\\b(?:in|at|near|around)?\\s*${escapeRe(m[0])}`, 'i'),
            ' '
          );
          break;
        }
      }
      if (detectedLocality) break;
    }
  }

  if (!detectedLocality) {
    const words = working
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 6);
    const candidateNames = Array.from(
      new Set([
        ...BENGALURU_AREAS,
        ...(extraLocalities ? extraLocalities.map((l) => l.name) : []),
      ])
    );
    for (const w of words) {
      for (const areaName of candidateNames) {
        const lowerArea = areaName.toLowerCase();
        if (lowerArea.length >= 6 && !lowerArea.includes(' ') && levenshteinDistance(w, lowerArea) <= 2) {
          detectedLocality = areaName;
          working = working.replace(new RegExp(`\\b(?:in|at|near|around)?\\s*${escapeRe(w)}`, 'i'), ' ');
          break;
        }
      }
      if (detectedLocality) break;
    }
  }

  let detectedCity = '';
  for (const city of SUPPORTED_CITIES) {
    const cityRe = new RegExp(
      `\\b(?:in|at|around)?\\s*${city === 'Bengaluru' ? '(?:bengaluru|bangalore)' : city}\\b`,
      'i'
    );
    if (cityRe.test(working)) {
      detectedCity = city;
      working = working.replace(cityRe, ' ');
      break;
    }
  }

  // 4. Natural-language facility & intent extraction
  let wifiRequired = false;
  let socketsRequired = false;
  let familyFriendly = false;
  let outdoorRequired = false;
  let quietStudyRequired = false;
  let workFriendlyRequired = false;

  if (/\b(with\s+)?(good\s+|fast\s+)?(wi[\s-]?fi|internet)\b/i.test(working)) {
    wifiRequired = true;
    intentTags.add('work');
    working = working.replace(/\b(with\s+)?(good\s+|fast\s+)?(wi[\s-]?fi|internet)\b/gi, ' ');
  }

  if (/\b(with\s+)?(charging\s*(?:points?|ports?|sockets?|plugs?)|power\s*(?:sockets?|outlets?|plugs?)|plug\s*points?|sockets?|plugs?)\b/i.test(working)) {
    socketsRequired = true;
    intentTags.add('work');
    working = working.replace(
      /\b(with\s+)?(charging\s*(?:points?|ports?|sockets?|plugs?)|power\s*(?:sockets?|outlets?|plugs?)|plug\s*points?|sockets?|plugs?)\b/gi,
      ' '
    );
  }

  if (/\b(family[\s-]?friendly|for\s+famil(?:y|ies)|with\s+kids?|kid[\s-]?friendly|parents?)\b/i.test(working)) {
    familyFriendly = true;
    intentTags.add('family');
    working = working.replace(/\b(family[\s-]?friendly|for\s+famil(?:y|ies)|with\s+kids?|kid[\s-]?friendly|parents?)\b/gi, ' ');
  }

  if (/\b(outdoor\s+seating|outdoor|garden\s+seating|garden|patio|terrace|rooftop)\b/i.test(working)) {
    outdoorRequired = true;
    working = working.replace(/\b(outdoor\s+seating|outdoor|garden\s+seating|garden|patio|terrace|rooftop)\b/gi, ' ');
  }

  if (/\b(quiet|calm|peaceful|studying|study|reading|exam\s*prep)\b/i.test(working)) {
    quietStudyRequired = true;
    intentTags.add('study');
    working = working.replace(/\b(for\s+)?(quiet|calm|peaceful|studying|study|reading|exam\s*prep)\b/gi, ' ');
  }

  if (/\b(laptop[\s-]?friendly|for\s+working|work[\s-]?friendly|remote\s*work|work\s*cafe|coworking)\b/i.test(working)) {
    workFriendlyRequired = true;
    intentTags.add('work');
    working = working.replace(/\b(laptop[\s-]?friendly|for\s+working|work[\s-]?friendly|remote\s*work|work\s*cafe|coworking)\b/gi, ' ');
  }

  if (/\b(affordable|cheap|budget|budget-friendly|pocket-friendly|pocket\s+friendly|low\s+cost|economical|inexpensive)\b/i.test(working)) {
    intentTags.add('budget');
    working = working.replace(/\b(affordable|cheap|budget-friendly|budget|pocket-friendly|pocket\s+friendly|low\s+cost|economical|inexpensive)\b/gi, ' ');
  }
  if (/\b(student|students|college)\b/i.test(working)) {
    intentTags.add('student');
    working = working.replace(/\b(student-friendly|students?|college)\b/gi, ' ');
  }
  if (/\bhidden\s*gems?\b/i.test(working)) {
    intentTags.add('hidden_gem');
    working = working.replace(/\bhidden\s*gems?\b/gi, ' ');
  }

  // Strip natural-language filler nouns and connectors
  const stripped = normalizeFoodText(
    working
      .replace(
        /\b(find|show|give|search|looking|look|me|cafes?|coffee\s*shops?|tea\s*shops?|tea\s*stalls?|shops?|stalls?|places?|spots?|centres?|centers?|eateries|restaurants?|best|good|great|nice|top|for|in|at|with|and|or|near|from|to|the|a|an)\b/gi,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim()
  );

  // Restore core food concept if stripping left empty (e.g. "coffee shops under ₹100")
  let cleanFoodQuery = stripped;
  const rawNorm = normalizeFoodText(raw);
  if (!cleanFoodQuery) {
    if (/\b(coffee|kaapi)\b/i.test(rawNorm)) cleanFoodQuery = 'coffee';
    else if (/\b(tea|chai)\b/i.test(rawNorm)) cleanFoodQuery = 'tea';
    else if (/\b(bakery|bakes|pastry|pastries)\b/i.test(rawNorm)) cleanFoodQuery = 'bakery';
    else if (/\b(dessert|desserts|cake|brownie|waffle|ice cream)\b/i.test(rawNorm)) {
      cleanFoodQuery = 'dessert';
      intentTags.add('dessert');
    } else if (/\b(snack|snacks)\b/i.test(rawNorm)) cleanFoodQuery = 'snacks';
  }

  if (/\b(breakfast|morning|tiffin)\b/i.test(rawNorm)) {
    intentTags.add('breakfast');
    if (!cleanFoodQuery) cleanFoodQuery = 'breakfast';
  }
  if (/\bsnacks?\b/i.test(rawNorm)) {
    intentTags.add('snacks');
    if (!cleanFoodQuery) cleanFoodQuery = 'snacks';
  }
  if (/\b(dessert|desserts|cheesecake|brownie|waffle|pastry|gelato)\b/i.test(rawNorm)) {
    intentTags.add('dessert');
  }

  const foodTerms = cleanFoodQuery
    .split(/\s+/)
    .map((t) => stemSingularWord(t))
    .filter((t) => t.length >= 2);

  // Determine matched canonical food concepts
  const canonicalConcepts: string[] = [];
  if (cleanFoodQuery) {
    for (const [concept, aliases] of Object.entries(FOOD_CONCEPT_SYNONYMS)) {
      const hitAlias = aliases.some(
        (al) =>
          cleanFoodQuery === al ||
          cleanFoodQuery.includes(al) ||
          (cleanFoodQuery.length >= 3 && al.includes(cleanFoodQuery)) ||
          foodTerms.some((ft) =>
            al.split(/\s+/).some((aw) => fuzzyWordMatch(ft, aw))
          )
      );
      if (hitAlias) canonicalConcepts.push(concept);
    }
  }

  const isFoodQuery =
    canonicalConcepts.length > 0 ||
    foodTerms.some((ft) => ALL_FOOD_TOKENS.some((tok) => fuzzyWordMatch(ft, tok)));

  return {
    raw,
    cleanFoodQuery,
    foodTerms,
    canonicalConcepts,
    isFoodQuery,
    maxBudgetInr,
    minBudgetInr,
    detectedLocality,
    detectedCity,
    nearMe,
    openNow,
    wifiRequired,
    socketsRequired,
    familyFriendly,
    outdoorRequired,
    quietStudyRequired,
    workFriendlyRequired,
    intentTags: Array.from(intentTags),
  };
}

function parseLowestPriceFromString(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const matches = Array.from(String(raw).matchAll(/₹\s*(\d{1,4})/g)).map((m) => Number(m[1]));
  const valid = matches.filter((n) => Number.isFinite(n) && n > 0);
  if (valid.length === 0) return null;
  return Math.min(...valid);
}

function parseBandLineItems(raw: string | null | undefined, category: string): ParsedMenuEntry[] {
  if (!raw) return [];
  const entries: ParsedMenuEntry[] = [];
  const str = String(raw);
  const parenMatch = str.match(/\(([^)]+)\)/);
  const bandMinPrice = parseLowestPriceFromString(str);

  if (parenMatch) {
    const parts = parenMatch[1].split(/[,/&]/).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      const explicitPrice = parseLowestPriceFromString(part);
      const cleanName = part.replace(/₹\s*\d+(?:\s*[–-]\s*₹?\s*\d+)?/g, '').trim();
      if (!cleanName || cleanName.length < 2) continue;
      entries.push({
        name: cleanName,
        category,
        description: str,
        priceInr: explicitPrice,
        source: 'band_item',
      });
    }
  }

  // Only include category fallback entry when an explicit verified price band exists
  if (bandMinPrice !== null && entries.every((e) => e.priceInr === null)) {
    entries.push({
      name: category,
      category,
      description: str,
      priceInr: bandMinPrice,
      source: 'band_item',
    });
  }
  return entries;
}

export function extractCafeMenuEntries(
  loc: Pick<
    LocationItem,
    | 'menu_items'
    | 'menu_services'
    | 'popular_items'
    | 'tea_price'
    | 'coffee_price'
    | 'snacks_price'
    | 'meals_price'
  > &
    Partial<Pick<LocationItem, 'desserts_price'>>
): ParsedMenuEntry[] {
  const byKey = new Map<string, ParsedMenuEntry>();

  const upsert = (entry: ParsedMenuEntry) => {
    const cleanName = entry.name.trim();
    if (!cleanName) return;
    const key = normalizeFoodText(cleanName);
    if (!key) return;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...entry, name: cleanName });
      return;
    }
    // Prefer entry with verified price
    if (existing.priceInr === null && entry.priceInr !== null) {
      byKey.set(key, { ...entry, name: cleanName });
    }
  };

  for (const item of loc.menu_items ?? []) {
    if (item.available === false) continue;
    const eff =
      item.discount_price_inr !== null &&
      item.discount_price_inr !== undefined &&
      item.discount_price_inr > 0 &&
      item.discount_price_inr < item.price_inr
        ? item.discount_price_inr
        : item.price_inr;
    upsert({
      name: item.name,
      category: item.category || 'Menu',
      description: item.description || '',
      priceInr: Number.isFinite(eff) && eff > 0 ? Math.round(eff) : null,
      source: 'menu_item',
    });
  }

  for (const svc of loc.menu_services ?? []) {
    const price = parseLowestPriceFromString(svc.price);
    upsert({
      name: svc.name,
      category: svc.category || 'Menu',
      description: svc.description || '',
      priceInr: price,
      source: 'menu_service',
    });
  }

  for (const pop of loc.popular_items ?? []) {
    const price = parseLowestPriceFromString(pop);
    const cleanName = pop.replace(/\([^)]*₹[^)]*\)/g, '').trim();
    if (!cleanName) continue;
    upsert({
      name: cleanName,
      category: 'Popular',
      description: pop,
      priceInr: price,
      source: 'popular_item',
    });
  }

  for (const entry of parseBandLineItems(loc.tea_price, 'Tea')) upsert(entry);
  for (const entry of parseBandLineItems(loc.coffee_price, 'Coffee')) upsert(entry);
  for (const entry of parseBandLineItems(loc.snacks_price, 'Snacks')) upsert(entry);
  for (const entry of parseBandLineItems(loc.desserts_price, 'Desserts')) upsert(entry);
  for (const entry of parseBandLineItems(loc.meals_price, 'Meals')) upsert(entry);

  return Array.from(byKey.values());
}

function entryMatchesSearch(
  entry: ParsedMenuEntry,
  cleanQuery: string,
  foodTerms: string[],
  canonicalConcepts: string[]
): number {
  const normName = normalizeFoodText(entry.name);
  const normCat = normalizeFoodText(entry.category);
  const normDesc = normalizeFoodText(entry.description);
  const nameWords = normName.split(/\s+/).filter(Boolean);
  const catWords = normCat.split(/\s+/).filter(Boolean);
  const descWords = normDesc.split(/\s+/).filter(Boolean);

  if (!cleanQuery && foodTerms.length === 0) return 0;

  // 1. Direct phrase match in item name
  if (cleanQuery && normName === cleanQuery) return 140;
  if (cleanQuery && normName.includes(cleanQuery)) return 120;

  // 2. Synonym / concept phrase match in item name or category
  const expandedAliases = canonicalConcepts.flatMap(
    (c) => FOOD_CONCEPT_SYNONYMS[c] ?? [c]
  );

  // Special case: avoid matching hot tea for "cold coffee" or vice versa unnecessarily
  for (const alias of expandedAliases) {
    if (normName === alias || normName.includes(alias)) return 110;
  }

  // 3. Token & typo matching in item name
  if (
    foodTerms.length > 0 &&
    foodTerms.every((ft) => nameWords.some((nw) => fuzzyWordMatch(ft, nw)))
  ) {
    return 100;
  }

  // 4. Category match (e.g. searching "Tea" matches items in Tea category, or "Bakery" matches Bakery items)
  if (
    cleanQuery &&
    (normCat === cleanQuery ||
      catWords.some((cw) => fuzzyWordMatch(cleanQuery, cw)) ||
      canonicalConcepts.some((c) => catWords.some((cw) => fuzzyWordMatch(c, cw))))
  ) {
    // Do not treat Milkshake or Coffee as Tea unless explicitly tea
    if (canonicalConcepts.includes('tea') && normCat === 'coffee') return 0;
    return 80;
  }

  // 5. Description match
  if (cleanQuery && normDesc.includes(cleanQuery)) return 55;
  if (
    foodTerms.length > 0 &&
    foodTerms.every((ft) => descWords.some((dw) => fuzzyWordMatch(ft, dw)))
  ) {
    return 45;
  }
  for (const alias of expandedAliases) {
    if (alias.length >= 4 && normDesc.includes(alias)) return 40;
  }

  return 0;
}

export function matchCafeToFoodSearch(
  loc: LocationItem & { distanceKm?: number | null },
  queryOrParsed: string | ParsedSmartQuery
): SmartSearchMatchResult {
  const parsed =
    typeof queryOrParsed === 'string' ? parseSmartFoodQuery(queryOrParsed) : queryOrParsed;

  const menuEntries = extractCafeMenuEntries(loc);
  const { cleanFoodQuery, foodTerms, canonicalConcepts, isFoodQuery } = parsed;

  if (!cleanFoodQuery && parsed.intentTags.length === 0) {
    return {
      matched: true,
      score: 10,
      matchedVia: 'none',
      matchedItems: [],
      lowestMatchedPriceInr: null,
      hasUnpricedMatchedItemsOnly: false,
    };
  }

  // Score menu entries
  const scoredEntries: Array<{ entry: ParsedMenuEntry; score: number }> = [];
  for (const entry of menuEntries) {
    const sc = entryMatchesSearch(entry, cleanFoodQuery, foodTerms, canonicalConcepts);
    if (sc > 0) scoredEntries.push({ entry, score: sc });
  }

  // Handle breakfast/snacks intent tags even without a direct word
  if (scoredEntries.length === 0 && parsed.intentTags.includes('breakfast')) {
    for (const entry of menuEntries) {
      const sc = entryMatchesSearch(
        entry,
        'breakfast',
        ['breakfast'],
        ['breakfast']
      );
      if (sc > 0) scoredEntries.push({ entry, score: sc });
    }
  }

  scoredEntries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const pa = a.entry.priceInr ?? Number.MAX_SAFE_INTEGER;
    const pb = b.entry.priceInr ?? Number.MAX_SAFE_INTEGER;
    return pa - pb;
  });

  const matchedItems = scoredEntries.map((x) => x.entry);
  const pricedMatched = matchedItems.filter((m) => m.priceInr !== null);
  const lowestMatchedPriceInr =
    pricedMatched.length > 0
      ? Math.min(...pricedMatched.map((m) => m.priceInr as number))
      : null;

  if (matchedItems.length > 0) {
    const topScore = scoredEntries[0].score;
    return {
      matched: true,
      score: topScore + (lowestMatchedPriceInr !== null && lowestMatchedPriceInr <= 100 ? 15 : 0),
      matchedVia: topScore >= 95 ? 'menu_item' : topScore >= 75 ? 'menu_category' : 'food_offering',
      matchedItems,
      lowestMatchedPriceInr,
      hasUnpricedMatchedItemsOnly: pricedMatched.length === 0,
    };
  }

  // Check verified food claims/offering text (EXCLUDING cafe business name!) when isFoodQuery is true
  const nonNameOfferingText = normalizeFoodText(
    [
      loc.claims.join(' '),
      loc.description,
      loc.verdict,
      loc.best_for.join(' '),
      loc.tea_price ? 'tea chai' : '',
      loc.coffee_price ? 'coffee espresso kaapi' : '',
      loc.snacks_price ? 'snacks puff sandwich' : '',
      loc.meals_price ? 'meals food' : '',
    ].join(' ')
  );

  if (isFoodQuery) {
    const offeringWords = nonNameOfferingText.split(/\s+/).filter(Boolean);
    const expandedAliases = canonicalConcepts.flatMap((c) => FOOD_CONCEPT_SYNONYMS[c] ?? [c]);
    const offeringHit =
      (cleanFoodQuery && nonNameOfferingText.includes(cleanFoodQuery)) ||
      expandedAliases.some((al) => al.length >= 3 && nonNameOfferingText.includes(al)) ||
      (foodTerms.length > 0 &&
        foodTerms.every((ft) => offeringWords.some((ow) => fuzzyWordMatch(ft, ow))));

    // STRICT RULE: Never match on cafe business name when user is searching for a food or beverage!
    if (offeringHit) {
      return {
        matched: true,
        score: 35,
        matchedVia: 'food_offering',
        matchedItems: [],
        lowestMatchedPriceInr: null,
        hasUnpricedMatchedItemsOnly: false,
      };
    }

    return {
      matched: false,
      score: 0,
      matchedVia: 'none',
      matchedItems: [],
      lowestMatchedPriceInr: null,
      hasUnpricedMatchedItemsOnly: false,
    };
  }

  // Non-food query (e.g. searching a brand name like "Third Wave", "Blue Tokai", "Suto", or area/vibe)
  const normName = normalizeFoodText(loc.name);
  const normArea = normalizeFoodText(`${loc.area} ${loc.address} ${loc.city}`);
  const normMeta = normalizeFoodText(
    `${loc.category || ''} ${loc.claims.join(' ')} ${loc.best_for.join(' ')} ${loc.facilities.join(' ')} ${loc.source_name}`
  );

  if (cleanFoodQuery && normName.includes(cleanFoodQuery)) {
    return {
      matched: true,
      score: 65,
      matchedVia: 'cafe_name',
      matchedItems: [],
      lowestMatchedPriceInr: null,
      hasUnpricedMatchedItemsOnly: false,
    };
  }
  const nameWords = normName.split(/\s+/).filter(Boolean);
  if (
    foodTerms.length > 0 &&
    foodTerms.every((ft) => nameWords.some((nw) => fuzzyWordMatch(ft, nw)))
  ) {
    return {
      matched: true,
      score: 60,
      matchedVia: 'cafe_name',
      matchedItems: [],
      lowestMatchedPriceInr: null,
      hasUnpricedMatchedItemsOnly: false,
    };
  }
  if (cleanFoodQuery && (normArea.includes(cleanFoodQuery) || normMeta.includes(cleanFoodQuery))) {
    return {
      matched: true,
      score: 40,
      matchedVia: 'locality',
      matchedItems: [],
      lowestMatchedPriceInr: null,
      hasUnpricedMatchedItemsOnly: false,
    };
  }
  if (!cleanFoodQuery && parsed.intentTags.length > 0) {
    return {
      matched: true,
      score: 25,
      matchedVia: 'food_offering',
      matchedItems: [],
      lowestMatchedPriceInr: null,
      hasUnpricedMatchedItemsOnly: false,
    };
  }

  return {
    matched: false,
    score: 0,
    matchedVia: 'none',
    matchedItems: [],
    lowestMatchedPriceInr: null,
    hasUnpricedMatchedItemsOnly: false,
  };
}

export function resolveBudgetRangeFromSelection(
  bracketId: string,
  customMaxPrice: number | null,
  parsedQuery?: ParsedSmartQuery
): { minInr: number | null; maxInr: number | null } {
  let minInr: number | null = parsedQuery?.minBudgetInr ?? null;
  let maxInr: number | null =
    customMaxPrice !== null && Number.isFinite(customMaxPrice) && customMaxPrice > 0
      ? customMaxPrice
      : parsedQuery?.maxBudgetInr ?? null;

  if (bracketId) {
    if (bracketId === 'under-30') maxInr = Math.min(maxInr ?? 30, 30);
    else if (bracketId === 'under-50') maxInr = Math.min(maxInr ?? 50, 50);
    else if (bracketId === 'under-100') maxInr = Math.min(maxInr ?? 100, 100);
    else if (bracketId === 'under-150') maxInr = Math.min(maxInr ?? 150, 150);
    else if (bracketId === 'under-200') maxInr = Math.min(maxInr ?? 200, 200);
    else if (bracketId === 'under-300') maxInr = Math.min(maxInr ?? 300, 300);
    else if (bracketId === '300-plus' || bracketId === '500+') {
      minInr = Math.max(minInr ?? 0, bracketId === '500+' ? 500 : 300);
    } else {
      const legacy = BUDGET_BRACKETS.find((b) => b.id === bracketId);
      if (legacy) {
        minInr = Math.max(minInr ?? 0, legacy.min);
        if (legacy.max !== null) maxInr = Math.min(maxInr ?? legacy.max, legacy.max);
      } else if (bracketId === '50-100') {
        minInr = 50;
        maxInr = 100;
      } else if (bracketId === '100-200') {
        minInr = 100;
        maxInr = 200;
      } else if (bracketId === '200-300') {
        minInr = 200;
        maxInr = 300;
      } else if (bracketId === '200-500') {
        minInr = 200;
        maxInr = 500;
      } else if (bracketId === '300-500') {
        minInr = 300;
        maxInr = 500;
      }
    }
  }

  return { minInr, maxInr };
}

export function getCafeLowestVerifiedMenuPrice(loc: LocationItem): number | null {
  const entries = extractCafeMenuEntries(loc)
    .map((e) => e.priceInr)
    .filter((p): p is number => p !== null && p > 0);
  if (entries.length > 0) return Math.min(...entries);

  const bandMins = [
    parseLowestPriceFromString(loc.tea_price),
    parseLowestPriceFromString(loc.coffee_price),
    parseLowestPriceFromString(loc.snacks_price),
    parseLowestPriceFromString(loc.desserts_price),
    parseLowestPriceFromString(loc.meals_price),
  ].filter((p): p is number => p !== null && p > 0);
  if (bandMins.length > 0) return Math.min(...bandMins);

  return null;
}

export function matchesBudgetAndPriceFilter(
  loc: LocationItem,
  opts: {
    minInr: number | null;
    maxInr: number | null;
    matchedItems?: ParsedMenuEntry[];
    itemFilterActive?: boolean;
    categoryFilter?: string;
  }
): boolean {
  const { minInr, maxInr, matchedItems = [], itemFilterActive = false, categoryFilter = '' } = opts;
  if (minInr === null && maxInr === null) return true;

  const checkPrice = (p: number | null): boolean => {
    if (p === null || !Number.isFinite(p) || p <= 0) return false;
    if (minInr !== null && p < minInr) return false;
    if (maxInr !== null && p > maxInr) return false;
    return true;
  };

  // Item-level budget filtering when a food/beverage search or food category is active
  if (itemFilterActive) {
    const pricedItems = matchedItems.filter((m) => m.priceInr !== null && m.priceInr > 0);
    if (pricedItems.length === 0) return false; // Strict rule: exclude unpriced items
    return pricedItems.some((m) => checkPrice(m.priceInr));
  }

  if (categoryFilter && categoryFilter !== 'all' && categoryFilter !== 'workspaces') {
    const entries = extractCafeMenuEntries(loc).filter((e) => {
      const hay = normalizeFoodText(`${e.category} ${e.name} ${e.description}`);
      if (categoryFilter === 'tea') return /\b(tea|chai|kullad|matcha)\b/.test(hay);
      if (categoryFilter === 'coffee') return /\b(coffee|kaapi|espresso|cappuccino|latte|cold brew)\b/.test(hay);
      if (categoryFilter === 'snacks') return /\b(snack|puff|burger|sandwich|maggi|fries|samosa|vada|bun)\b/.test(hay);
      if (categoryFilter === 'bakery') return /\b(bakery|puff|croissant|bun|cake|pastry|donut|biscuit)\b/.test(hay);
      if (categoryFilter === 'juice') return /\b(juice|shake|smoothie|iced tea|cooler)\b/.test(hay);
      if (categoryFilter === 'desserts') return /\b(dessert|cake|pastry|donut|waffle|cheesecake)\b/.test(hay);
      return true;
    });
    const pricedCat = entries.filter((e) => e.priceInr !== null && e.priceInr > 0);
    if (pricedCat.length > 0) {
      return pricedCat.some((e) => checkPrice(e.priceInr));
    }
    return false;
  }

  // Whole-cafe budget check: prefer lowest verified menu item when maxInr <= 150, else avg_cost_per_person / menu price
  const lowestMenu = getCafeLowestVerifiedMenuPrice(loc);
  const avg = loc.avg_cost_per_person;

  if (maxInr !== null && maxInr <= 150) {
    // Strictly require a verified menu item or verified avg spend within ceiling
    if (lowestMenu !== null) return checkPrice(lowestMenu);
    if (avg !== null) return checkPrice(avg);
    return false;
  }

  if (minInr !== null && minInr >= 300) {
    if (avg !== null) return checkPrice(avg);
    if (lowestMenu !== null) return checkPrice(lowestMenu);
    return false;
  }

  if (avg !== null && checkPrice(avg)) return true;
  if (lowestMenu !== null && checkPrice(lowestMenu)) return true;
  return false;
}

export function getCafeBrandKey(name: string): string {
  return normalizeFoodText(name)
    .replace(/\b(koramangala|indiranagar|hsr layout|whitefield|jayanagar|marathahalli|electronic city|mg road|rajajinagar|malleshwaram|church street|btm layout|jp nagar|banashankari|basavanagudi|vijayanagar|yelahanka|hennur|bengaluru|bangalore)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function interleaveDifferentBrands<T extends { name: string }>(
  items: T[],
  lookahead = 8
): T[] {
  if (items.length <= 2) return [...items];
  const remaining = [...items];
  const result: T[] = [];

  while (remaining.length > 0) {
    const prevBrand = result.length > 0 ? getCafeBrandKey(result[result.length - 1].name) : '';
    let pickIdx = 0;
    if (prevBrand && getCafeBrandKey(remaining[0].name) === prevBrand) {
      const limit = Math.min(remaining.length, lookahead + 1);
      for (let i = 1; i < limit; i++) {
        if (getCafeBrandKey(remaining[i].name) !== prevBrand) {
          pickIdx = i;
          break;
        }
      }
    }
    const [picked] = remaining.splice(pickIdx, 1);
    result.push(picked);
  }
  return result;
}

export function getBudgetFirstSortScore(loc: LocationItem): number {
  const lowestMenu = getCafeLowestVerifiedMenuPrice(loc);
  const avg = loc.avg_cost_per_person;

  let score = 0;
  if (loc.modes.includes('budget')) score += 45;
  if (avg !== null) {
    if (avg <= 120) score += 75;
    else if (avg <= 175) score += 60;
    else if (avg <= 225) score += 45;
    else if (avg <= 275) score += 20;
    else if (avg >= 450) score -= 45;
    else if (avg >= 350) score -= 30;
  }
  if (lowestMenu !== null) {
    if (lowestMenu <= 30) score += 55;
    else if (lowestMenu <= 50) score += 42;
    else if (lowestMenu <= 100) score += 25;
  }
  if (loc.verified) score += 8;
  return score;
}

export function compareCafesBudgetFirst(
  a: LocationItem & { distanceKm?: number | null },
  b: LocationItem & { distanceKm?: number | null },
  matchMap?: Map<string, SmartSearchMatchResult>
): number {
  if (matchMap) {
    const ma = matchMap.get(a.id);
    const mb = matchMap.get(b.id);
    if (ma && mb && (ma.matchedVia !== 'none' || mb.matchedVia !== 'none')) {
      if (ma.score !== mb.score) {
        return mb.score - ma.score;
      }
      const pa = ma.lowestMatchedPriceInr ?? null;
      const pb = mb.lowestMatchedPriceInr ?? null;
      if (pa !== null && pb !== null && pa !== pb) {
        return pa - pb;
      }
    }
  }

  // Primary progression: lowest average spend per person -> upper budget
  const avgA = a.avg_cost_per_person ?? getCafeLowestVerifiedMenuPrice(a) ?? Number.MAX_SAFE_INTEGER;
  const avgB = b.avg_cost_per_person ?? getCafeLowestVerifiedMenuPrice(b) ?? Number.MAX_SAFE_INTEGER;
  if (avgA !== avgB) return avgA - avgB;

  // Tie-break within identical avg spend by lowest verified menu item price
  const lowA = getCafeLowestVerifiedMenuPrice(a) ?? Number.MAX_SAFE_INTEGER;
  const lowB = getCafeLowestVerifiedMenuPrice(b) ?? Number.MAX_SAFE_INTEGER;
  if (lowA !== lowB) return lowA - lowB;

  if (a.verified !== b.verified) return a.verified ? -1 : 1;
  if ((b.rating ?? -1) !== (a.rating ?? -1)) return (b.rating ?? -1) - (a.rating ?? -1);
  if (a.display_order !== b.display_order) return a.display_order - b.display_order;
  return a.name.localeCompare(b.name);
}

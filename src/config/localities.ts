/**
 * ============================================================================
 * Bengaluru Locality Master Database & Category Classification Definitions
 * Covers North, South, East, West, Central & Outer Bengaluru neighbourhoods,
 * alternative spellings, local names, sub-zones, and 8 standardized categories.
 * ============================================================================
 */

export type BengaluruRegion =
  | 'North Bengaluru'
  | 'South Bengaluru'
  | 'East Bengaluru'
  | 'West Bengaluru'
  | 'Central Bengaluru'
  | 'Outer Bengaluru';

export const BENGALURU_REGIONS: BengaluruRegion[] = [
  'North Bengaluru',
  'South Bengaluru',
  'East Bengaluru',
  'West Bengaluru',
  'Central Bengaluru',
  'Outer Bengaluru',
];

export type StandardBusinessCategory =
  | 'Cafe'
  | 'Coffee shop'
  | 'Tea shop'
  | 'Bakery'
  | 'Juice and beverage shop'
  | 'Dessert shop'
  | 'Restaurant'
  | 'Other food and beverage business';

export const STANDARD_BUSINESS_CATEGORIES: StandardBusinessCategory[] = [
  'Cafe',
  'Coffee shop',
  'Tea shop',
  'Bakery',
  'Juice and beverage shop',
  'Dessert shop',
  'Restaurant',
  'Other food and beverage business',
];

export interface LocalitySubzone {
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export interface BengaluruLocalitySeed {
  slug: string;
  name: string;
  region: BengaluruRegion;
  altSpellings: string[];
  localNames: string[];
  keywords: string[];
  lat: number;
  lng: number;
  radiusMeters: number;
  subzones: LocalitySubzone[];
}

export interface LocalityQueryDefinition {
  id: string;
  label: string;
  mode: 'text' | 'nearby';
  buildTextQuery?: (localityName: string) => string;
  includedType?: string;
  includedPrimaryTypes?: string[];
  categoryHint: StandardBusinessCategory;
}

export const LOCALITY_SEARCH_QUERIES: LocalityQueryDefinition[] = [
  {
    id: 'cafes',
    label: 'Cafes',
    mode: 'text',
    buildTextQuery: (loc) => `Cafes in ${loc}, Bengaluru`,
    includedType: 'cafe',
    categoryHint: 'Cafe',
  },
  {
    id: 'coffee_shops',
    label: 'Coffee shops',
    mode: 'text',
    buildTextQuery: (loc) => `Coffee shops in ${loc}, Bengaluru`,
    includedType: 'coffee_shop',
    categoryHint: 'Coffee shop',
  },
  {
    id: 'tea_shops',
    label: 'Tea shops',
    mode: 'text',
    buildTextQuery: (loc) => `Tea shops and chai stalls in ${loc}, Bengaluru`,
    categoryHint: 'Tea shop',
  },
  {
    id: 'bakeries',
    label: 'Bakeries',
    mode: 'text',
    buildTextQuery: (loc) => `Bakeries in ${loc}, Bengaluru`,
    includedType: 'bakery',
    categoryHint: 'Bakery',
  },
  {
    id: 'juice_shops',
    label: 'Juice shops',
    mode: 'text',
    buildTextQuery: (loc) => `Juice shops and beverage corners in ${loc}, Bengaluru`,
    includedType: 'juice_shop',
    categoryHint: 'Juice and beverage shop',
  },
  {
    id: 'dessert_shops',
    label: 'Dessert shops',
    mode: 'text',
    buildTextQuery: (loc) => `Dessert shops and ice cream parlours in ${loc}, Bengaluru`,
    includedType: 'dessert_shop',
    categoryHint: 'Dessert shop',
  },
  {
    id: 'small_independent_cafes',
    label: 'Small independent cafes',
    mode: 'text',
    buildTextQuery: (loc) => `Small independent cafes in ${loc}, Bengaluru`,
    categoryHint: 'Cafe',
  },
  {
    id: 'budget_cafes',
    label: 'Budget cafes',
    mode: 'text',
    buildTextQuery: (loc) => `Budget affordable cafes and snacks in ${loc}, Bengaluru`,
    categoryHint: 'Cafe',
  },
  {
    id: 'local_coffee_shops',
    label: 'Local coffee shops',
    mode: 'text',
    buildTextQuery: (loc) => `Local filter coffee shops in ${loc}, Bengaluru`,
    categoryHint: 'Coffee shop',
  },
  {
    id: 'food_and_beverage_nearby',
    label: 'Food & beverage (distance sweep)',
    mode: 'nearby',
    includedPrimaryTypes: [
      'cafe',
      'coffee_shop',
      'tea_house',
      'bakery',
      'juice_shop',
      'dessert_shop',
      'ice_cream_shop',
      'sandwich_shop',
      'snack_bar',
      'breakfast_restaurant',
    ],
    categoryHint: 'Other food and beverage business',
  },
];

export const DEFAULT_BENGALURU_LOCALITIES: BengaluruLocalitySeed[] = [
  // ======================== NORTH BENGALURU ========================
  {
    slug: 'jalahalli',
    name: 'Jalahalli',
    region: 'North Bengaluru',
    altSpellings: ['jalahalli east', 'jalahalli west', 'jalahalli cross'],
    localNames: ['Jalahalli Cross', 'Jalahalli East', 'Jalahalli West', 'BEL Colony'],
    keywords: ['jalahalli', 'jalahalli cross', 'tea shop', 'bakery', 'coffee'],
    lat: 13.0452,
    lng: 77.5476,
    radiusMeters: 2800,
    subzones: [
      { label: 'Jalahalli West & Cross', lat: 13.0498, lng: 77.5305, radiusMeters: 1800 },
      { label: 'Jalahalli East & Gangamma Circle', lat: 13.0585, lng: 77.5522, radiusMeters: 1800 },
    ],
  },
  {
    slug: 'hesaraghatta',
    name: 'Hesaraghatta',
    region: 'North Bengaluru',
    altSpellings: ['hessaraghatta', 'hesargatta', 'hesarghatta', 'hesaraghatta main road'],
    localNames: ['Hesaraghatta Main Road', 'Hesaraghatta Lake', 'Chikkasandra', 'Soladevanahalli'],
    keywords: ['hesaraghatta', 'hessaraghatta', 'tea', 'bakery', 'juice', 'highway cafe'],
    lat: 13.1394,
    lng: 77.4783,
    radiusMeters: 3800,
    subzones: [
      { label: 'Hesaraghatta Village & Main Rd', lat: 13.1394, lng: 77.4783, radiusMeters: 2500 },
      { label: 'Soladevanahalli & Acharya Rd', lat: 13.0846, lng: 77.4847, radiusMeters: 2200 },
    ],
  },
  {
    slug: 'nagasandra',
    name: 'Nagasandra',
    region: 'North Bengaluru',
    altSpellings: ['nagasandra metro', 'nelagadranahalli'],
    localNames: ['Nagasandra Metro', 'Tumkur Road Nagasandra', 'HMT Layout Nagasandra'],
    keywords: ['nagasandra', 'metro', 'tea', 'coffee', 'bakery'],
    lat: 13.0481,
    lng: 77.4998,
    radiusMeters: 2400,
    subzones: [],
  },
  {
    slug: 'peenya',
    name: 'Peenya',
    region: 'North Bengaluru',
    altSpellings: ['peenya industrial area', 'peenya 2nd stage', 'peenya 1st stage', 'peenya dasarahalli'],
    localNames: ['Peenya Industrial Area', 'Peenya 2nd Stage', 'SRS Road Peenya'],
    keywords: ['peenya', 'industrial area', 'tea stall', 'bakery', 'budget snacks'],
    lat: 13.0285,
    lng: 77.5197,
    radiusMeters: 3200,
    subzones: [
      { label: 'Peenya 1st Stage & Metro', lat: 13.0332, lng: 77.5332, radiusMeters: 1800 },
      { label: 'Peenya 2nd Stage', lat: 13.0168, lng: 77.5082, radiusMeters: 1800 },
    ],
  },
  {
    slug: 'dasarahalli',
    name: 'Dasarahalli',
    region: 'North Bengaluru',
    altSpellings: ['t dasarahalli', 't. dasarahalli', 'dasarahalli metro'],
    localNames: ['T. Dasarahalli', 'Dasarahalli Main Road', 'Chokkasandra'],
    keywords: ['dasarahalli', 't dasarahalli', 'bakery', 'tea', 'coffee'],
    lat: 13.0434,
    lng: 77.5131,
    radiusMeters: 2400,
    subzones: [],
  },
  {
    slug: 'bagalagunte',
    name: 'Bagalagunte',
    region: 'North Bengaluru',
    altSpellings: ['bagalkunte', 'bagalgunte'],
    localNames: ['Bagalagunte Main Road', 'MEI Layout', 'Mallasandra'],
    keywords: ['bagalagunte', 'bagalkunte', 'mei layout', 'tea', 'bakery'],
    lat: 13.0631,
    lng: 77.5067,
    radiusMeters: 2400,
    subzones: [],
  },
  {
    slug: 'chikkabanavara',
    name: 'Chikkabanavara',
    region: 'North Bengaluru',
    altSpellings: ['chikkabanwara', 'chikbanavara', 'chikkabanavara lake'],
    localNames: ['Chikkabanavara Railway Station', 'Sapthagiri College Rd', 'Ganapathi Nagar'],
    keywords: ['chikkabanavara', 'student cafe', 'tea', 'bakery', 'juice'],
    lat: 13.0819,
    lng: 77.5015,
    radiusMeters: 2600,
    subzones: [],
  },
  {
    slug: 'abbigere',
    name: 'Abbigere',
    region: 'North Bengaluru',
    altSpellings: ['abbigeri', 'abbigere main road'],
    localNames: ['Abbigere Cross', 'Kereguddadahalli', 'Lakshmipura Cross'],
    keywords: ['abbigere', 'abbigeri', 'bakery', 'tea shop', 'coffee'],
    lat: 13.0774,
    lng: 77.5236,
    radiusMeters: 2500,
    subzones: [],
  },
  {
    slug: 'vidyaranyapura',
    name: 'Vidyaranyapura',
    region: 'North Bengaluru',
    altSpellings: ['vidyaranya pura', 'vidyaranyapura main road', 'tin factory'],
    localNames: ['BEL Layout Vidyaranyapura', 'NTI Layout', 'MS Palya'],
    keywords: ['vidyaranyapura', 'ms palya', 'bel layout', 'coffee', 'bakery'],
    lat: 13.0825,
    lng: 77.5582,
    radiusMeters: 2800,
    subzones: [],
  },
  {
    slug: 'yelahanka',
    name: 'Yelahanka',
    region: 'North Bengaluru',
    altSpellings: ['yelahanka new town', 'yelahanka old town', 'yelahanka satellite town'],
    localNames: ['Yelahanka New Town', 'Yelahanka Old Town', 'NES Office Rd', 'Allalasandra'],
    keywords: ['yelahanka', 'new town', 'cafes', 'coffee', 'study'],
    lat: 13.1007,
    lng: 77.5963,
    radiusMeters: 3500,
    subzones: [
      { label: 'Yelahanka New Town & Mother Dairy', lat: 13.0973, lng: 77.5812, radiusMeters: 2000 },
      { label: 'Yelahanka Old Town & Kogilu', lat: 13.1045, lng: 77.6095, radiusMeters: 2000 },
    ],
  },
  {
    slug: 'mathikere',
    name: 'Mathikere',
    region: 'North Bengaluru',
    altSpellings: ['mattikere', 'mathikere main road', 'gokula'],
    localNames: ['Mathikere Extension', 'MSR Nagar', 'Ramaiah Rd'],
    keywords: ['mathikere', 'msr nagar', 'ramaiah', 'student cafe', 'tea'],
    lat: 13.0334,
    lng: 77.5641,
    radiusMeters: 2400,
    subzones: [],
  },
  {
    slug: 'bel-road',
    name: 'BEL Road',
    region: 'North Bengaluru',
    altSpellings: ['new bel road', 'new bel rd', 'bel circle'],
    localNames: ['New BEL Road', 'RMV 2nd Stage', 'Devasandra'],
    keywords: ['bel road', 'new bel road', 'coffee', 'cafes', 'study'],
    lat: 13.0382,
    lng: 77.5718,
    radiusMeters: 2300,
    subzones: [],
  },
  {
    slug: 'hebbal',
    name: 'Hebbal',
    region: 'North Bengaluru',
    altSpellings: ['hebbal flyover', 'hebbal ring road', 'kempapura'],
    localNames: ['Hebbal Kempapura', 'Esteem Mall Rd', 'Bhadrappa Layout'],
    keywords: ['hebbal', 'coffee', 'bakery', 'tea', 'work cafe'],
    lat: 13.0358,
    lng: 77.5970,
    radiusMeters: 3000,
    subzones: [],
  },
  {
    slug: 'jakkur',
    name: 'Jakkur',
    region: 'North Bengaluru',
    altSpellings: ['jakkur aerodrome', 'jakkur plantation', 'rachenahalli'],
    localNames: ['Jakkur Main Road', 'Amruthahalli', 'Shivanahalli'],
    keywords: ['jakkur', 'amruthahalli', 'cafes', 'bakery', 'tea'],
    lat: 13.0785,
    lng: 77.6064,
    radiusMeters: 2800,
    subzones: [],
  },
  {
    slug: 'sahakara-nagar',
    name: 'Sahakara Nagar',
    region: 'North Bengaluru',
    altSpellings: ['sahakarnagar', 'sahakar nagar', 'kodigehalli'],
    localNames: ['Sahakara Nagar Main Rd', 'CQAL Layout', 'Kodigehalli'],
    keywords: ['sahakara nagar', 'sahakarnagar', 'cafes', 'coffee', 'bakery'],
    lat: 13.0623,
    lng: 77.5871,
    radiusMeters: 2500,
    subzones: [],
  },
  {
    slug: 'hennur',
    name: 'Hennur',
    region: 'North Bengaluru',
    altSpellings: ['hennur road', 'hennur cross', 'hbr layout', 'kothanur'],
    localNames: ['Hennur Main Road', 'HBR Layout', 'Kothanur'],
    keywords: ['hennur', 'hbr layout', 'cafes', 'roastery', 'bakery'],
    lat: 13.0442,
    lng: 77.6386,
    radiusMeters: 3000,
    subzones: [],
  },
  {
    slug: 'thanisandra',
    name: 'Thanisandra',
    region: 'North Bengaluru',
    altSpellings: ['thanisandra main road', 'manyata', 'nagawara'],
    localNames: ['Thanisandra Main Rd', 'Nagawara', 'Manyata Tech Park'],
    keywords: ['thanisandra', 'nagawara', 'manyata', 'coffee', 'tea'],
    lat: 13.0587,
    lng: 77.6317,
    radiusMeters: 2800,
    subzones: [],
  },
  {
    slug: 'kalyan-nagar',
    name: 'Kalyan Nagar',
    region: 'North Bengaluru',
    altSpellings: ['hrbr layout', 'kalyannagar', 'kammanahalli'],
    localNames: ['HRBR Layout', 'CMR Road', 'Kammanahalli'],
    keywords: ['kalyan nagar', 'hrbr layout', 'cmr road', 'kammanahalli', 'cafes'],
    lat: 13.0221,
    lng: 77.6414,
    radiusMeters: 2600,
    subzones: [],
  },

  // ======================== WEST BENGALURU ========================
  {
    slug: 'rajajinagar',
    name: 'Rajajinagar',
    region: 'West Bengaluru',
    altSpellings: ['rajaji nagar', 'dr rajkumar road'],
    localNames: ['Rajajinagar 1st–6th Block', 'Bashyam Circle', 'Oriyon Mall Rd'],
    keywords: ['rajajinagar', 'rajaji nagar', 'filter coffee', 'bakery', 'cafe'],
    lat: 12.9982,
    lng: 77.5530,
    radiusMeters: 2800,
    subzones: [],
  },
  {
    slug: 'vijayanagar',
    name: 'Vijayanagar',
    region: 'West Bengaluru',
    altSpellings: ['vijaya nagar', 'chandra layout', 'attiguppe'],
    localNames: ['Vijayanagar Club Rd', 'Chandra Layout', 'RPC Layout'],
    keywords: ['vijayanagar', 'vijaya nagar', 'chandra layout', 'tea', 'bakery'],
    lat: 12.9719,
    lng: 77.5330,
    radiusMeters: 2800,
    subzones: [],
  },
  {
    slug: 'nagarbhavi',
    name: 'Nagarbhavi',
    region: 'West Bengaluru',
    altSpellings: ['nagarabhavi', 'nagarbhavi 2nd stage', 'bda complex nagarbhavi'],
    localNames: ['Nagarbhavi 1st & 2nd Stage', 'Papareddypalya', 'Annapoorneshwari Nagar'],
    keywords: ['nagarbhavi', 'nagarabhavi', 'student cafe', 'tea', 'coffee'],
    lat: 12.9592,
    lng: 77.5082,
    radiusMeters: 3000,
    subzones: [],
  },
  {
    slug: 'malleshwaram',
    name: 'Malleshwaram',
    region: 'West Bengaluru',
    altSpellings: ['malleswaram', 'sampige road', 'margosa road'],
    localNames: ['Sampige Road', 'Margosa Road', '8th Cross Malleshwaram'],
    keywords: ['malleshwaram', 'malleswaram', 'filter coffee', 'bakery', 'tea'],
    lat: 13.0055,
    lng: 77.5692,
    radiusMeters: 2400,
    subzones: [],
  },
  {
    slug: 'yeshwanthpur',
    name: 'Yeshwanthpur',
    region: 'West Bengaluru',
    altSpellings: ['yesvantpur', 'yeshwantpur'],
    localNames: ['Yeshwanthpur Circle', 'Triveni Road', 'BMTC Bus Stand Rd'],
    keywords: ['yeshwanthpur', 'yesvantpur', 'tea', 'bakery', 'coffee'],
    lat: 13.0250,
    lng: 77.5504,
    radiusMeters: 2500,
    subzones: [],
  },
  {
    slug: 'rr-nagar',
    name: 'RR Nagar',
    region: 'West Bengaluru',
    altSpellings: ['rajarajeshwari nagar', 'r r nagar', 'rajarajeshwarinagar'],
    localNames: ['Rajarajeshwari Nagar', 'BEML Layout', 'Ideal Homes'],
    keywords: ['rr nagar', 'rajarajeshwari nagar', 'cafes', 'coffee', 'bakery'],
    lat: 12.9279,
    lng: 77.5150,
    radiusMeters: 3200,
    subzones: [
      { label: 'RR Nagar Arch & Ideal Homes', lat: 12.9279, lng: 77.5150, radiusMeters: 2000 },
      { label: 'BEML Layout & Global Village Rd', lat: 12.9125, lng: 77.5092, radiusMeters: 2000 },
    ],
  },
  {
    slug: 'kengeri',
    name: 'Kengeri',
    region: 'West Bengaluru',
    altSpellings: ['kengeri satellite town', 'kengeri upanagara', 'kommaghatta'],
    localNames: ['Kengeri Satellite Town', 'Mysore Road Kengeri', 'Bande Mutt'],
    keywords: ['kengeri', 'satellite town', 'tea', 'bakery', 'coffee'],
    lat: 12.9141,
    lng: 77.4857,
    radiusMeters: 3400,
    subzones: [
      { label: 'Kengeri Bus Terminal & Town', lat: 12.9141, lng: 77.4857, radiusMeters: 2100 },
      { label: 'Kengeri Satellite Town', lat: 12.9228, lng: 77.4792, radiusMeters: 2100 },
    ],
  },

  // ======================== SOUTH BENGALURU ========================
  {
    slug: 'banashankari',
    name: 'Banashankari',
    region: 'South Bengaluru',
    altSpellings: ['bsk', 'banashankari 2nd stage', 'banashankari 3rd stage', 'kathriguppe'],
    localNames: ['Banashankari 2nd & 3rd Stage', 'Kathriguppe', 'Padmanabhanagar'],
    keywords: ['banashankari', 'bsk', 'kathriguppe', 'coffee', 'bakery'],
    lat: 12.9255,
    lng: 77.5468,
    radiusMeters: 3200,
    subzones: [
      { label: 'Banashankari 2nd Stage & BDA', lat: 12.9261, lng: 77.5612, radiusMeters: 2000 },
      { label: 'Banashankari 3rd Stage & Kathriguppe', lat: 12.9252, lng: 77.5418, radiusMeters: 2000 },
    ],
  },
  {
    slug: 'jp-nagar',
    name: 'JP Nagar',
    region: 'South Bengaluru',
    altSpellings: ['j p nagar', 'j.p. nagar', 'jayaprakash nagar'],
    localNames: ['JP Nagar 1st–7th Phase', 'Mini Forest Rd', 'Puttenahalli'],
    keywords: ['jp nagar', 'j p nagar', 'cafes', 'coffee', 'study'],
    lat: 12.9063,
    lng: 77.5857,
    radiusMeters: 3400,
    subzones: [
      { label: 'JP Nagar 1st–4th Phase', lat: 12.9102, lng: 77.5892, radiusMeters: 2000 },
      { label: 'JP Nagar 5th–7th Phase', lat: 12.8935, lng: 77.5815, radiusMeters: 2200 },
    ],
  },
  {
    slug: 'jayanagar',
    name: 'Jayanagar',
    region: 'South Bengaluru',
    altSpellings: ['jaya nagar', 'jayanagar 4th block', 'jayanagar 3rd block'],
    localNames: ['Jayanagar 3rd & 4th Block', '11th Main Jayanagar', 'South End Circle'],
    keywords: ['jayanagar', 'filter coffee', 'cafes', 'bakery', 'study'],
    lat: 12.9299,
    lng: 77.5824,
    radiusMeters: 2800,
    subzones: [],
  },
  {
    slug: 'basavanagudi',
    name: 'Basavanagudi',
    region: 'South Bengaluru',
    altSpellings: ['gandhi bazaar', 'dvg road', 'nr colony', 'bull temple road'],
    localNames: ['Gandhi Bazaar', 'DVG Road', 'NR Colony'],
    keywords: ['basavanagudi', 'gandhi bazaar', 'dvg road', 'filter coffee', 'bakery'],
    lat: 12.9422,
    lng: 77.5738,
    radiusMeters: 2400,
    subzones: [],
  },
  {
    slug: 'btm-layout',
    name: 'BTM Layout',
    region: 'South Bengaluru',
    altSpellings: ['btm', 'btm 1st stage', 'btm 2nd stage', 'madiwala'],
    localNames: ['BTM 1st & 2nd Stage', 'Udupi Garden Rd', 'Madiwala'],
    keywords: ['btm layout', 'btm', 'chai', 'budget cafe', 'tea'],
    lat: 12.9166,
    lng: 77.6101,
    radiusMeters: 2800,
    subzones: [],
  },
  {
    slug: 'hsr-layout',
    name: 'HSR Layout',
    region: 'South Bengaluru',
    altSpellings: ['hsr', 'hsr sector 1', 'hsr sector 2', '27th main hsr'],
    localNames: ['27th Main HSR', '19th Main HSR', 'Agara'],
    keywords: ['hsr layout', 'hsr', '27th main', 'work cafe', 'coffee'],
    lat: 12.9121,
    lng: 77.6446,
    radiusMeters: 3000,
    subzones: [
      { label: 'HSR Sector 1 & 27th Main', lat: 12.9145, lng: 77.6495, radiusMeters: 1900 },
      { label: 'HSR Sector 2 & 3', lat: 12.9052, lng: 77.6401, radiusMeters: 1900 },
    ],
  },
  {
    slug: 'koramangala',
    name: 'Koramangala',
    region: 'South Bengaluru',
    altSpellings: ['koramangala 4th block', 'koramangala 5th block', 'koramangala 8th block'],
    localNames: ['Koramangala 4th–8th Block', '80 Feet Road', 'Sony World Junction'],
    keywords: ['koramangala', '80 feet road', 'cafes', 'specialty coffee', 'work'],
    lat: 12.9352,
    lng: 77.6245,
    radiusMeters: 2900,
    subzones: [
      { label: 'Koramangala 4th & 5th Block', lat: 12.9344, lng: 77.6202, radiusMeters: 1700 },
      { label: 'Koramangala 1st & 8th Block', lat: 12.9369, lng: 77.6305, radiusMeters: 1700 },
    ],
  },
  {
    slug: 'bommanahalli',
    name: 'Bommanahalli',
    region: 'South Bengaluru',
    altSpellings: ['hongasandra', 'begur road', 'roopena agrahara'],
    localNames: ['Bommanahalli Junction', 'Hongasandra', 'Begur Road'],
    keywords: ['bommanahalli', 'hongasandra', 'tea shop', 'bakery', 'juice'],
    lat: 12.9038,
    lng: 77.6246,
    radiusMeters: 2800,
    subzones: [],
  },

  // ======================== EAST BENGALURU ========================
  {
    slug: 'indiranagar',
    name: 'Indiranagar',
    region: 'East Bengaluru',
    altSpellings: ['indira nagar', '100 feet road', '12th main indiranagar', 'cmh road'],
    localNames: ['100 Feet Road', '12th Main Indiranagar', 'HAL 2nd Stage'],
    keywords: ['indiranagar', '100 feet road', '12th main', 'coffee', 'cafes'],
    lat: 12.9784,
    lng: 77.6408,
    radiusMeters: 2800,
    subzones: [
      { label: '12th Main & 100 Feet Rd', lat: 12.9718, lng: 77.6412, radiusMeters: 1700 },
      { label: 'CMH Rd & Defence Colony', lat: 12.9789, lng: 77.6392, radiusMeters: 1700 },
    ],
  },
  {
    slug: 'domlur',
    name: 'Domlur',
    region: 'East Bengaluru',
    altSpellings: ['domlur layout', 'egl', 'embassy golf links'],
    localNames: ['Domlur 2nd Stage', 'EGL Road', 'Kodihalli'],
    keywords: ['domlur', 'egl', 'cafes', 'coffee', 'tea'],
    lat: 12.9609,
    lng: 77.6387,
    radiusMeters: 2200,
    subzones: [],
  },
  {
    slug: 'banaswadi',
    name: 'Banaswadi',
    region: 'East Bengaluru',
    altSpellings: ['omber layout', 'omr banaswadi', 'ramamurthy nagar'],
    localNames: ['Banaswadi Main Rd', 'Subbayyanapalya', 'OMBR Layout'],
    keywords: ['banaswadi', 'ombr layout', 'bakery', 'tea', 'coffee'],
    lat: 13.0104,
    lng: 77.6512,
    radiusMeters: 2800,
    subzones: [],
  },
  {
    slug: 'kr-puram',
    name: 'KR Puram',
    region: 'East Bengaluru',
    altSpellings: ['k r puram', 'krishnarajapura', 'tin factory'],
    localNames: ['Krishnarajapura', 'Tin Factory', 'TC Palya'],
    keywords: ['kr puram', 'krishnarajapura', 'tea shop', 'bakery', 'coffee'],
    lat: 13.0012,
    lng: 77.6961,
    radiusMeters: 3400,
    subzones: [
      { label: 'KR Puram Hanging Bridge & Tin Factory', lat: 12.9958, lng: 77.6745, radiusMeters: 2000 },
      { label: 'KR Puram Market & TC Palya', lat: 13.0124, lng: 77.7052, radiusMeters: 2200 },
    ],
  },
  {
    slug: 'marathahalli',
    name: 'Marathahalli',
    region: 'East Bengaluru',
    altSpellings: ['marathalli', 'brookefield', 'kundalahalli', 'munnekollal'],
    localNames: ['Marathahalli Bridge', 'Brookefield', 'Kundalahalli'],
    keywords: ['marathahalli', 'brookefield', 'chai', 'tea', 'cafes'],
    lat: 12.9591,
    lng: 77.6974,
    radiusMeters: 3300,
    subzones: [
      { label: 'Marathahalli Junction & Innovative Rd', lat: 12.9569, lng: 77.7011, radiusMeters: 2000 },
      { label: 'Brookefield & Kundalahalli', lat: 12.9665, lng: 77.7160, radiusMeters: 2000 },
    ],
  },
  {
    slug: 'bellandur',
    name: 'Bellandur',
    region: 'East Bengaluru',
    altSpellings: ['ecospace', 'ecoworld', 'green glen layout', 'ibblur'],
    localNames: ['Bellandur Gate', 'Green Glen Layout', 'Ecospace Rd'],
    keywords: ['bellandur', 'green glen', 'cafes', 'coffee', 'work'],
    lat: 12.9260,
    lng: 77.6762,
    radiusMeters: 3000,
    subzones: [],
  },
  {
    slug: 'whitefield',
    name: 'Whitefield',
    region: 'East Bengaluru',
    altSpellings: ['itpl', 'kadugodi', 'hope farm', 'varthur main road'],
    localNames: ['ITPL Main Road', 'Hope Farm', 'Kadugodi', 'Siddapura'],
    keywords: ['whitefield', 'itpl', 'hope farm', 'cafes', 'coffee'],
    lat: 12.9698,
    lng: 77.7499,
    radiusMeters: 4200,
    subzones: [
      { label: 'Whitefield Main Rd & Forum Rd', lat: 12.9648, lng: 77.7478, radiusMeters: 2300 },
      { label: 'ITPL & Hoodi', lat: 12.9885, lng: 77.7282, radiusMeters: 2200 },
      { label: 'Hope Farm & Kadugodi', lat: 12.9896, lng: 77.7568, radiusMeters: 2100 },
    ],
  },

  // ======================== CENTRAL BENGALURU ========================
  {
    slug: 'mg-road',
    name: 'MG Road',
    region: 'Central Bengaluru',
    altSpellings: ['mahatma gandhi road', 'brigade road', 'trinity'],
    localNames: ['MG Road Metro', 'Brigade Road', 'Barton Centre'],
    keywords: ['mg road', 'brigade road', 'coffee', 'cafes', 'work'],
    lat: 12.9756,
    lng: 77.6066,
    radiusMeters: 2000,
    subzones: [],
  },
  {
    slug: 'church-street',
    name: 'Church Street',
    region: 'Central Bengaluru',
    altSpellings: ['st marks road', 'lavelle road', 'rest house crescent'],
    localNames: ['Church Street', 'St Marks Road', 'Lavelle Road'],
    keywords: ['church street', 'st marks road', 'book cafe', 'espresso', 'desserts'],
    lat: 12.9751,
    lng: 77.6038,
    radiusMeters: 1800,
    subzones: [],
  },
  {
    slug: 'ulsoor',
    name: 'Ulsoor',
    region: 'Central Bengaluru',
    altSpellings: ['halasuru', 'ulsoor lake', 'cambridge layout'],
    localNames: ['Halasuru', 'Ulsoor Lake', 'Cambridge Layout'],
    keywords: ['ulsoor', 'halasuru', 'cambridge layout', 'coffee', 'bakery'],
    lat: 12.9817,
    lng: 77.6285,
    radiusMeters: 2200,
    subzones: [],
  },
  {
    slug: 'frazer-town',
    name: 'Frazer Town',
    region: 'Central Bengaluru',
    altSpellings: ['pulikeshi nagar', 'mosque road', 'cox town', 'benson town'],
    localNames: ['Pulikeshi Nagar', 'Mosque Road', 'Cox Town'],
    keywords: ['frazer town', 'mosque road', 'bakery', 'tea', 'desserts'],
    lat: 12.9985,
    lng: 77.6145,
    radiusMeters: 2400,
    subzones: [],
  },
  {
    slug: 'sadashivanagar',
    name: 'Sadashivanagar',
    region: 'Central Bengaluru',
    altSpellings: ['sadashiv nagar', 'sankey tank', 'palace orchards'],
    localNames: ['Sadashivanagar', 'Sankey Tank Rd', 'Mekhri Circle'],
    keywords: ['sadashivanagar', 'sankey tank', 'cafes', 'coffee', 'study'],
    lat: 13.0068,
    lng: 77.5812,
    radiusMeters: 2200,
    subzones: [],
  },

  // ======================== OUTER BENGALURU ========================
  {
    slug: 'electronic-city',
    name: 'Electronic City',
    region: 'Outer Bengaluru',
    altSpellings: ['e-city', 'ecity', 'electronic city phase 1', 'electronic city phase 2'],
    localNames: ['Electronic City Phase 1', 'Electronic City Phase 2', 'Neeladri Nagar'],
    keywords: ['electronic city', 'neeladri nagar', 'e-city', 'tea', 'cafes'],
    lat: 12.8452,
    lng: 77.6602,
    radiusMeters: 4200,
    subzones: [
      { label: 'Phase 1 & Neeladri Nagar', lat: 12.8456, lng: 77.6512, radiusMeters: 2300 },
      { label: 'Phase 2 & Konappana Agrahara', lat: 12.8435, lng: 77.6745, radiusMeters: 2200 },
    ],
  },
  {
    slug: 'sarjapur-road',
    name: 'Sarjapur Road',
    region: 'Outer Bengaluru',
    altSpellings: ['sarjapur', 'kaikondrahalli', 'haralur', 'carmelaram'],
    localNames: ['Kaikondrahalli', 'Kasavanahalli', 'Haralur Road', 'Doddakannelli'],
    keywords: ['sarjapur road', 'kaikondrahalli', 'haralur', 'cafes', 'bakery'],
    lat: 12.9082,
    lng: 77.6845,
    radiusMeters: 4200,
    subzones: [
      { label: 'Kaikondrahalli & Haralur', lat: 12.9125, lng: 77.6738, radiusMeters: 2200 },
      { label: 'Doddakannelli & Carmelaram', lat: 12.9052, lng: 77.7052, radiusMeters: 2200 },
    ],
  },
  {
    slug: 'devanahalli',
    name: 'Devanahalli',
    region: 'Outer Bengaluru',
    altSpellings: ['devanahalli town', 'kempegowda airport road', 'bial road'],
    localNames: ['Devanahalli Town', 'Airport Road', 'Sadahalli'],
    keywords: ['devanahalli', 'airport road', 'tea', 'coffee', 'bakery'],
    lat: 13.2473,
    lng: 77.7139,
    radiusMeters: 3800,
    subzones: [],
  },
  {
    slug: 'hoskote',
    name: 'Hoskote',
    region: 'Outer Bengaluru',
    altSpellings: ['hoskote town', 'old madras road hoskote'],
    localNames: ['Hoskote Cross', 'Old Madras Road'],
    keywords: ['hoskote', 'tea shop', 'bakery', 'coffee'],
    lat: 13.0706,
    lng: 77.7982,
    radiusMeters: 3500,
    subzones: [],
  },
];

export function slugifyLocalityName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function classifyGooglePlaceCategory(
  primaryType?: string | null,
  types: string[] = [],
  name = ''
): StandardBusinessCategory {
  const pt = String(primaryType || '').toLowerCase().trim();
  const joinedTypes = [pt, ...types.map((t) => String(t).toLowerCase())].join(' ');
  const lowerName = String(name || '').toLowerCase();

  // Order tea shop checks early so small chai stalls / tea houses classify cleanly
  if (
    pt === 'tea_house' ||
    /\b(tea|chai|chaat|kulhad|irani chai|tea stall|tea shop|tea point|tea day)\b/.test(lowerName)
  ) {
    return 'Tea shop';
  }
  if (
    pt === 'juice_shop' ||
    joinedTypes.includes('juice') ||
    /\b(juice|smoothie|lassi|milkshake|fresh juice|sugarcane|shake)\b/.test(lowerName)
  ) {
    return 'Juice and beverage shop';
  }
  if (
    pt === 'bakery' ||
    pt === 'pastry_shop' ||
    pt === 'cake_shop' ||
    joinedTypes.includes('bakery') ||
    /\b(bakery|bakes|bakers|iyengar|patisserie|puffs|cakes|croissant|boulangerie)\b/.test(lowerName)
  ) {
    return 'Bakery';
  }
  if (
    pt === 'dessert_shop' ||
    pt === 'ice_cream_shop' ||
    pt === 'donut_shop' ||
    joinedTypes.includes('dessert') ||
    joinedTypes.includes('ice_cream') ||
    /\b(ice cream|gelato|waffle|dessert|brownie|donut|sweet|kulfi)\b/.test(lowerName)
  ) {
    return 'Dessert shop';
  }
  if (
    pt === 'coffee_shop' ||
    pt === 'coffee_roastery' ||
    joinedTypes.includes('coffee_shop') ||
    joinedTypes.includes('coffee_roastery') ||
    /\b(coffee|kaapi|espresso|roasters|roastery|brew|latte)\b/.test(lowerName)
  ) {
    return 'Coffee shop';
  }
  if (pt === 'cafe' || joinedTypes.includes('cafe') || /\b(cafe|café|bistro|chai & snacks)\b/.test(lowerName)) {
    return 'Cafe';
  }
  if (
    pt === 'restaurant' ||
    pt === 'breakfast_restaurant' ||
    pt === 'indian_restaurant' ||
    pt === 'south_indian_restaurant' ||
    joinedTypes.includes('restaurant')
  ) {
    return 'Restaurant';
  }
  return 'Other food and beverage business';
}

export function findStaticLocalityMatch(text: string): BengaluruLocalitySeed | null {
  const clean = String(text || '').toLowerCase().trim();
  if (!clean) return null;
  for (const loc of DEFAULT_BENGALURU_LOCALITIES) {
    if (clean === loc.name.toLowerCase() || clean === loc.slug) return loc;
    if (loc.altSpellings.some((a) => clean === a.toLowerCase())) return loc;
    if (loc.localNames.some((n) => clean === n.toLowerCase())) return loc;
  }
  for (const loc of DEFAULT_BENGALURU_LOCALITIES) {
    const candidates = [loc.name, ...loc.altSpellings, ...loc.localNames];
    if (candidates.some((c) => clean.includes(c.toLowerCase()))) return loc;
  }
  return null;
}

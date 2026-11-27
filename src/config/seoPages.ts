import type { LocationItem } from '../types/cms';

export interface SeoPageFaq {
  question: string;
  answer: string;
}

export interface SeoLandingPageDef {
  slug: string; // e.g. 'best-cafes-in-bengaluru'
  path: string; // e.g. '/best-cafes-in-bengaluru'
  group: 'category' | 'locality' | 'budget';
  title: string;
  metaDescription: string;
  h1: string;
  kicker: string;
  intro: string;
  highlights: string[];
  areaKeywords?: string[];
  categoryFilter?:
    | 'all'
    | 'coffee'
    | 'tea'
    | 'snacks'
    | 'juice'
    | 'study'
    | 'work'
    | 'wifi'
    | 'budget'
    | 'breakfast';
  maxAvgCost?: number;
  requiresWifi?: boolean;
  requiresStudy?: boolean;
  requiresWork?: boolean;
  liveSearchQuery: string;
  liveSearchArea?: string;
  relatedSlugs: string[];
  faqs: SeoPageFaq[];
}

export const LOCAL_SEO_PAGES: SeoLandingPageDef[] = [
  // =========================================================================
  // BENGALURU CATEGORY, WORKSPACE & BUDGET LANDING PAGES
  // =========================================================================
  {
    slug: 'best-cafes-in-bengaluru',
    path: '/best-cafes-in-bengaluru',
    group: 'category',
    title: 'Best Cafes in Bengaluru – Work, Study & Coffee | Cafe Desk',
    metaDescription:
      'Compare curated cafes across Indiranagar, Koramangala, HSR Layout, Jayanagar & Whitefield with verified Wi-Fi, sockets, budget estimates & directions.',
    h1: 'Best Cafes in Bengaluru for Coffee, Study & Remote Work',
    kicker: 'Bengaluru Curated Directory',
    intro:
      'From specialty roasters with confirmed Wi-Fi in Indiranagar and Koramangala to affordable neighbourhood chai and filter kaapi stops across Jayanagar and Malleshwaram, browse Bengaluru cafes with honest amenity data and real Google Maps directions.',
    highlights: [
      'Covers 18 Bengaluru neighbourhoods including Indiranagar, Koramangala, HSR Layout, Whitefield, Jayanagar & MG Road.',
      'Verified Wi-Fi availability and laptop suitability clearly separated from unverified casual spots.',
      'Direct links to cafe websites, menus, Instagram, and turn-by-turn Google Maps routes.',
    ],
    categoryFilter: 'all',
    liveSearchQuery: 'best cafes in bengaluru',
    relatedSlugs: [
      'affordable-cafes-in-bengaluru',
      'work-friendly-cafes-in-bengaluru',
      'study-cafes-in-bengaluru',
      'cafes-in-koramangala',
      'cafes-in-indiranagar',
    ],
    faqs: [
      {
        question: 'How does Cafe Desk select cafes in Bengaluru?',
        answer:
          'Cafe Desk lists verified neighbourhood coffee shops, specialty roasters, bakery cafes, and tea stops from official cafe websites, field checks, and public menu records — never inventing ratings or Wi-Fi speeds.',
      },
      {
        question: 'Can I find both budget tea spots and specialty work cafes here?',
        answer:
          'Yes. Bengaluru listings range from ₹100–₹175 tea and filter coffee corners to quiet third-wave coffee workspaces with Wi-Fi and charging sockets.',
      },
      {
        question: 'Does Cafe Desk show live nearby cafes across Bengaluru?',
        answer:
          'Yes. You can browse curated listings below or click Discover Live Places to load nearby Bengaluru businesses via Google Maps.',
      },
    ],
  },
  {
    slug: 'affordable-cafes-in-bengaluru',
    path: '/affordable-cafes-in-bengaluru',
    group: 'budget',
    title: 'Affordable Cafes in Bengaluru (₹50–₹250 Guide) | Cafe Desk',
    metaDescription:
      'Find affordable cafes in Bengaluru for students & everyday coffee runs. Browse budget tea shops, filter kaapi corners, bakeries & snack cafes under ₹250.',
    h1: 'Affordable & Budget-Friendly Cafes in Bengaluru (₹50–₹250)',
    kicker: 'Budget Bengaluru Cafes',
    intro:
      'Looking for cheap cafes in Bengaluru without paying ₹400+ for a single visit? Explore verified neighbourhood tea houses, filter coffee joints, student bakeries, and budget work cafes with transparent per-person cost estimates.',
    highlights: [
      'Curated spots with average spends from ₹100 to ₹250 per person across East, South, North & West Bengaluru.',
      'Includes Tea Day, Chai Sutta Bar, Hatti Kaapi, Iyengar Bakeries, and budget laptop-friendly picks like Brewz Coffee and Cafe Medley.',
      'Filter even tighter by Cafes Under ₹100 or Cafes Under ₹200 for quick everyday breaks.',
    ],
    categoryFilter: 'budget',
    maxAvgCost: 250,
    liveSearchQuery: 'affordable budget cafes in bengaluru',
    relatedSlugs: [
      'cafes-under-100-in-bengaluru',
      'cafes-under-200-in-bengaluru',
      'budget-coffee-shops-in-bengaluru',
      'tea-shops-in-bengaluru',
      'affordable-cafes-in-indiranagar',
    ],
    faqs: [
      {
        question: 'What is the typical budget at affordable cafes in Bengaluru?',
        answer:
          'Neighbourhood tea and bakery stops in Bengaluru typically range between ₹50 and ₹175 per person, while budget sit-down coffee shops average ₹180–₹250.',
      },
      {
        question: 'Are there budget cafes in Bengaluru that also allow laptops?',
        answer:
          'Yes. Spots like Brewz Coffee in BTM Layout (₹190 avg), Cafe Medley in Koramangala (₹180 avg), and Katte Kulture in Jayanagar (₹225 avg) pair lower prices with comfortable seating.',
      },
      {
        question: 'Are menu prices on Cafe Desk guaranteed?',
        answer:
          'Displayed prices reflect verified menu snapshots and per-person estimates at the time of review; cafes may update seasonal menu pricing in-store.',
      },
    ],
  },
  {
    slug: 'cafes-under-100-in-bengaluru',
    path: '/cafes-under-100-in-bengaluru',
    group: 'budget',
    title: 'Cafes Under ₹100 in Bengaluru – Chai & Snacks | Cafe Desk',
    metaDescription:
      'Discover genuine cafes, tea stalls, and bakery snack stops in Bengaluru where chai, filter coffee, buns, and puffs cost under ₹100.',
    h1: 'Cafes, Tea Stops & Bakeries Under ₹100 in Bengaluru',
    kicker: 'Pocket-Friendly Under ₹100',
    intro:
      'Need a quick morning filter coffee, masala chai, bun maska, or khara puff under ₹100 in Bengaluru? These verified local bakeries and tea cafes keep average spend around ₹100 or less without cutting quality.',
    highlights: [
      'Ideal for students, hostelers, and daily office chai/bakery breaks.',
      'Features verified tea counters and classic Bengaluru bakeries in Banashankari, Marathahalli, Vijayanagar, Electronic City, and Yelahanka.',
      'Zero inflated minimums — quick counter seating and takeaway access.',
    ],
    categoryFilter: 'budget',
    maxAvgCost: 110,
    liveSearchQuery: 'tea stall bakery coffee under 100 in bengaluru',
    relatedSlugs: [
      'cafes-under-200-in-bengaluru',
      'tea-shops-in-bengaluru',
      'snacks-and-bakeries-in-bengaluru',
      'affordable-cafes-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Which areas in Bengaluru have the best cafes under ₹100?',
        answer:
          'Student and residential hubs such as Banashankari, Vijayanagar, Marathahalli, Yelahanka, and Electronic City offer numerous chai bars and Iyengar bakeries under ₹100.',
      },
      {
        question: 'Do ₹100 tea spots usually offer Wi-Fi and long laptop seating?',
        answer:
          'Most ultra-budget tea and bakery stops focus on fast counter service and short catch-ups rather than all-day laptop desks; check each listing’s Work Specs badge before heading out.',
      },
    ],
  },
  {
    slug: 'cafes-under-200-in-bengaluru',
    path: '/cafes-under-200-in-bengaluru',
    group: 'budget',
    title: 'Cafes Under ₹200 in Bengaluru – Coffee, Chai & Snacks | Cafe Desk',
    metaDescription:
      'Explore Bengaluru cafes under ₹200 per person for filter coffee, masala chai, sandwiches & student hangout tables across Koramangala, Indiranagar & MG Road.',
    h1: 'Best Cafes Under ₹200 in Bengaluru',
    kicker: 'Everyday Value Picks',
    intro:
      'Under ₹200 per person opens up a wide selection of Bengaluru cafes — from South Indian Filter Kaapi houses on MG Road and Chai Days in Indiranagar to laptop-ready value cafes in Koramangala and BTM Layout.',
    highlights: [
      'Covers budget sit-down spots like Cafe Medley (Koramangala) and Brewz Coffee (BTM Layout) alongside quick tea/coffee favourites.',
      'Great balance of pocket-friendly beverage combos and comfortable indoor seating.',
      'Compare travel distance and opening hours directly before visiting.',
    ],
    categoryFilter: 'budget',
    maxAvgCost: 200,
    liveSearchQuery: 'budget cafes under 200 bengaluru',
    relatedSlugs: [
      'cafes-under-100-in-bengaluru',
      'affordable-cafes-in-bengaluru',
      'budget-coffee-shops-in-bengaluru',
      'affordable-cafes-in-indiranagar',
    ],
    faqs: [
      {
        question: 'Are there laptop-friendly cafes under ₹200 in Bengaluru?',
        answer:
          'Yes. Cafe Medley in Koramangala and Brewz Coffee in BTM Layout both offer Wi-Fi and remote-work seating while keeping average per-person spend under ₹200.',
      },
      {
        question: 'What items can I typically get under ₹200?',
        answer:
          'Most spots in this bracket serve filter coffee or milk tea (₹20–₹95) paired with bun maska, puffs, Maggi, or a toasted sandwich.',
      },
    ],
  },
  {
    slug: 'budget-coffee-shops-in-bengaluru',
    path: '/budget-coffee-shops-in-bengaluru',
    group: 'budget',
    title: 'Budget Coffee Shops in Bengaluru – Kaapi & Espresso | Cafe Desk',
    metaDescription:
      'Find budget coffee shops in Bengaluru serving South Indian filter kaapi, cold coffee & pocket-friendly espresso in MG Road, Malleshwaram, Koramangala & BTM.',
    h1: 'Budget Coffee Shops in Bengaluru (Filter Kaapi to Everyday Espresso)',
    kicker: 'Value Coffee Discovery',
    intro:
      'Great coffee in Bengaluru does not require specialty pour-over pricing every day. Discover verified value coffee bars serving strong Chickmagalur filter kaapi, cold coffee, and affordable cappuccinos across MG Road, Malleshwaram, Rajajinagar, Basavanagudi, and BTM Layout.',
    highlights: [
      'Includes heritage filter coffee houses, modern regional coffee chains, and local student favourites.',
      'Compare starting coffee prices and average spend per person at a glance.',
      'Helpful for daily caffeine runs, quick catch-ups, and budget remote work sessions.',
    ],
    categoryFilter: 'coffee',
    maxAvgCost: 250,
    liveSearchQuery: 'budget coffee shops filter coffee bengaluru',
    relatedSlugs: [
      'coffee-shops-in-bengaluru',
      'affordable-cafes-in-bengaluru',
      'cafes-in-mg-road',
      'cafes-in-malleshwaram',
    ],
    faqs: [
      {
        question: 'Where can I get good budget filter coffee in central Bengaluru?',
        answer:
          'Hatti Kaapi near MG Road and Kalmane Koffees in Malleshwaram offer dependable filter coffee and snacks without specialty-cafe markups.',
      },
      {
        question: 'Do budget coffee shops offer cold coffee and iced drinks too?',
        answer:
          'Yes, most listed budget coffee cafes such as Nothing Before Coffee, Coffee Grand, and Brewz Coffee serve cold coffee alongside classic hot brews.',
      },
    ],
  },
  {
    slug: 'coffee-shops-in-bengaluru',
    path: '/coffee-shops-in-bengaluru',
    group: 'category',
    title: 'Best Coffee Shops in Bengaluru – Specialty & Local | Cafe Desk',
    metaDescription:
      'Discover Bengaluru’s top specialty coffee roasters and local filter kaapi shops across Indiranagar, Koramangala, Church Street, Jayanagar & Whitefield.',
    h1: 'Best Coffee Shops in Bengaluru: Specialty Roasters & Local Kaapi',
    kicker: 'Bengaluru Coffee Guide',
    intro:
      'Bengaluru is India’s coffee capital — home to single-origin estate roasters, experimental cold brews, and classic South Indian filter kaapi bars. Browse verified coffee shops across key neighbourhoods with Wi-Fi and budget clarity.',
    highlights: [
      'Covers specialty leaders (Araku Coffee, Blue Tokai, Third Wave, Paper & Pie, Matteo Coffea) and everyday value roasters.',
      'Clear distinction between work-desk roasteries and quick-stop kaapi counters.',
      'Live Google Maps integration helps discover newly opened neighbourhood roasters.',
    ],
    categoryFilter: 'coffee',
    liveSearchQuery: 'specialty coffee shops in bengaluru',
    relatedSlugs: [
      'best-coffee-shops-in-koramangala',
      'cafes-in-indiranagar',
      'budget-coffee-shops-in-bengaluru',
      'work-friendly-cafes-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Which Bengaluru areas have the highest concentration of specialty coffee shops?',
        answer:
          'Indiranagar (100 Feet Road & 12th Main), Koramangala (4th–8th Blocks), Church Street/MG Road, and Jayanagar are Bengaluru’s densest coffee hubs.',
      },
      {
        question: 'Do specialty coffee shops in Bengaluru provide customer Wi-Fi?',
        answer:
          'Many roasteries such as Blue Tokai, Third Wave Coffee, Paper & Pie, and Araku offer customer Wi-Fi; check individual Cafe Desk listings for confirmation.',
      },
    ],
  },
  {
    slug: 'tea-shops-in-bengaluru',
    path: '/tea-shops-in-bengaluru',
    group: 'category',
    title: 'Tea Shops & Chai Cafes in Bengaluru (₹20–₹100) | Cafe Desk',
    metaDescription:
      'Find popular tea shops, dum chai corners & ginger tea cafes in Bengaluru across Indiranagar, Marathahalli, Banashankari, Electronic City & HSR Layout.',
    h1: 'Best Tea Shops & Chai Cafes in Bengaluru',
    kicker: 'Chai & Tea Spots',
    intro:
      'Whether you crave kulhad adrak chai after class, sulaimani/dum tea near tech parks, or a relaxed kettle pot with bun maska, explore Bengaluru’s best tea shops and neighbourhood chai cafes with transparent pricing.',
    highlights: [
      'Chai prices starting as low as ₹20–₹54 at neighbourhood staples like Tea Day, Tea Time, The Tea Factory, and Chai Sutta Bar.',
      'Includes Indiranagar, HSR Layout, Marathahalli, Electronic City, Banashankari, and Vijayanagar locations.',
      'Pair masala chai with Maggi, samosas, puffs, and Osmania biscuits.',
    ],
    categoryFilter: 'tea',
    liveSearchQuery: 'tea shops chai cafes in bengaluru',
    relatedSlugs: [
      'cafes-under-100-in-bengaluru',
      'snacks-and-bakeries-in-bengaluru',
      'cafes-in-marathahalli',
      'cafes-in-electronic-city',
    ],
    faqs: [
      {
        question: 'How much does a cup of chai cost at Bengaluru tea cafes?',
        answer:
          'Quick tea shops like Tea Day, Tea Time, and The Tea Factory generally serve dum and ginger chai between ₹20 and ₹50, while sit-down chai cafes in Indiranagar range ₹55–₹100.',
      },
      {
        question: 'Are tea shops good for late evening hangouts?',
        answer:
          'Yes, most chai spots in Electronic City, Marathahalli, and HSR Layout stay lively until 10:00 PM or 11:00 PM for evening snacks and conversations.',
      },
    ],
  },
  {
    slug: 'snacks-and-bakeries-in-bengaluru',
    path: '/snacks-and-bakeries-in-bengaluru',
    group: 'category',
    title: 'Snacks & Bakery Cafes in Bengaluru – Puffs, Buns & Pastries | Cafe Desk',
    metaDescription:
      'Explore Bengaluru bakery cafes and snack spots serving veg puffs, bun maska, croissants, sandwiches & pastries in Koramangala, Rajajinagar, Vijayanagar & Yelahanka.',
    h1: 'Best Bakery Cafes & Evening Snack Spots in Bengaluru',
    kicker: 'Bakeries & Quick Bites',
    intro:
      'Bengaluru’s cafe culture runs on freshly baked puffs, bun maska, croissants, cupcakes, and toasted sandwiches. Browse verified neighbourhood bakeries alongside all-day bakery cafes for casual catch-ups and light study breaks.',
    highlights: [
      'Covers classic local Iyengar bakeries, Glen’s Bakehouse branches, The Pastry Inn, and snack-focused chai spots.',
      'Transparent snack price ranges from ₹13–₹65 biscuits & puffs up to gourmet tarts and croissants.',
      'Great for morning bakery runs, 5 PM tea breaks, and dessert meetups.',
    ],
    categoryFilter: 'snacks',
    liveSearchQuery: 'bakery snacks puff sandwich cafes bengaluru',
    relatedSlugs: [
      'tea-shops-in-bengaluru',
      'cafes-under-100-in-bengaluru',
      'budget-breakfast-cafes-in-bengaluru',
      'cafes-in-vijayanagar',
    ],
    faqs: [
      {
        question: 'What are the most affordable bakery snacks at listed Bengaluru cafes?',
        answer:
          'Local spots like Iyengar’s Bakery (Vijayanagar), The Pastry Inn (Yelahanka), Meet And Perk Up (HSR), and Chai Sutta Bar serve puffs, bun maska, and cookies starting ₹15–₹55.',
      },
      {
        question: 'Which bakery cafes are best for sit-down groups?',
        answer:
          'Glen’s Bakehouse in Koramangala and Rajajinagar as well as Paper & Pie in Indiranagar offer larger dessert displays and group-friendly tables.',
      },
    ],
  },
  {
    slug: 'juice-shops-in-bengaluru',
    path: '/juice-shops-in-bengaluru',
    group: 'category',
    title: 'Juice, Coolers & Cold Brew Cafes in Bengaluru | Cafe Desk',
    metaDescription:
      'Find Bengaluru cafes and beverage spots serving iced teas, lemonades, coolers, smoothies & cold brews — plus live nearby juice shop discovery.',
    h1: 'Fresh Coolers, Iced Drinks & Juice-Friendly Cafes in Bengaluru',
    kicker: 'Cold Beverages & Refreshers',
    intro:
      'Looking beyond hot coffee on warm Bengaluru afternoons? Discover curated cafes serving iced teas, coolers, shakes, and cold brews, or tap Live Google Maps Discovery below to uncover nearby neighbourhood fresh juice bars.',
    highlights: [
      'Includes cafes offering iced coolers, lemonades, cold coffee shakes, and herbal iced teas.',
      'One-tap Google Maps integration fetches local juice & fresh beverage shops around your street.',
      'Transparent price brackets before you stop by.',
    ],
    categoryFilter: 'juice',
    liveSearchQuery: 'fresh juice shop smoothies cold beverages bengaluru',
    relatedSlugs: [
      'tea-shops-in-bengaluru',
      'snacks-and-bakeries-in-bengaluru',
      'affordable-cafes-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Can I find dedicated fresh juice shops near me on Cafe Desk?',
        answer:
          'Yes — alongside curated beverage cafes listed here, click Discover Live Juice Shops to query Google Places directly around your chosen Bengaluru locality.',
      },
    ],
  },
  {
    slug: 'study-cafes-in-bengaluru',
    path: '/study-cafes-in-bengaluru',
    group: 'category',
    title: 'Quiet Study Cafes in Bengaluru for Students & Exams | Cafe Desk',
    metaDescription:
      'Find quiet study cafes in Bengaluru with calm acoustics, comfortable seating & Wi-Fi across Koramangala, Indiranagar, Jayanagar, JP Nagar & HSR Layout.',
    h1: 'Best Quiet Study Cafes in Bengaluru for Students & Reading',
    kicker: 'Study & Focus Cafes',
    intro:
      'Need a calm table for exam prep, reading, UPSC/CAT study blocks, or thesis writing? These curated Bengaluru study cafes have been vetted for calmer seating, laptop tolerance, and welcoming long-stay atmosphere.',
    highlights: [
      'Includes quiet-first spaces like Dialogues Cafe, Blue Tokai, Cafe Terra, Katte Kulture, and Cafe Hustle.',
      'Clear noise-level and seating labels help avoid loud Friday-night music venues.',
      'Mix of budget-friendly study tables and day-pass/cafe-style workspaces.',
    ],
    categoryFilter: 'study',
    requiresStudy: true,
    liveSearchQuery: 'quiet study cafes in bengaluru',
    relatedSlugs: [
      'work-friendly-cafes-in-bengaluru',
      'cafes-with-wifi-in-bengaluru',
      'cafes-in-jayanagar',
      'cafes-in-koramangala',
    ],
    faqs: [
      {
        question: 'Which Bengaluru areas are best for quiet student study cafes?',
        answer:
          'Jayanagar, Koramangala, Indiranagar 12th Main, JP Nagar, and HSR Layout have several calm daytime cafes well-suited to reading and laptop study.',
      },
      {
        question: 'Do study cafes in Bengaluru have time limits?',
        answer:
          'Some venues like Dialogues Cafe operate on an hourly/day model while coffeehouses like Third Wave and Blue Tokai expect a regular beverage order; Cafe Desk highlights stay expectations on each cafe page.',
      },
    ],
  },
  {
    slug: 'work-friendly-cafes-in-bengaluru',
    path: '/work-friendly-cafes-in-bengaluru',
    group: 'category',
    title: 'Work-Friendly Cafes in Bengaluru – Laptop & Wi-Fi | Cafe Desk',
    metaDescription:
      'Discover laptop-friendly work cafes in Bengaluru with confirmed Wi-Fi, desk ergonomics & remote-work seating across Indiranagar, Koramangala, HSR & Whitefield.',
    h1: 'Best Work-Friendly Cafes in Bengaluru for Remote Work & Laptops',
    kicker: 'Laptop & Remote Work',
    intro:
      'Whether you are a founder, software engineer, designer, or remote freelancer, find Bengaluru work cafes that welcome laptops, provide confirmed customer Wi-Fi, and offer practical desk seating.',
    highlights: [
      'Filtered specifically for confirmed laptop-friendly & remote-work venues across major Bengaluru tech corridors.',
      'Covers Indiranagar, Koramangala, HSR Layout, Whitefield, Church Street, Electronic City, and BTM Layout.',
      'Honest reporting: Cafe Desk displays "Not verified" whenever socket counts or exact Mbps speeds haven’t been field-measured.',
    ],
    categoryFilter: 'work',
    requiresWork: true,
    liveSearchQuery: 'work friendly laptop cafes wifi bengaluru',
    relatedSlugs: [
      'cafes-with-wifi-in-bengaluru',
      'study-cafes-in-bengaluru',
      'cafes-in-indiranagar',
      'cafes-in-whitefield',
      'cafes-in-hsr-layout',
    ],
    faqs: [
      {
        question: 'What makes a cafe truly work-friendly on Cafe Desk?',
        answer:
          'Listings shown here have confirmed laptop-friendly seating and suitable-for-working status across curated checks — rather than forcing remote workers into tiny 15-minute snack counters.',
      },
      {
        question: 'Which work cafes in Bengaluru are budget friendly?',
        answer:
          'Cafe Medley in Koramangala (₹180 avg) and Brewz Coffee in BTM Layout (₹190 avg) combine laptop-friendly seating and Wi-Fi at sub-₹200 budgets.',
      },
    ],
  },
  {
    slug: 'cafes-with-wifi-in-bengaluru',
    path: '/cafes-with-wifi-in-bengaluru',
    group: 'category',
    title: 'Cafes with Wi-Fi in Bengaluru – Verified List | Cafe Desk',
    metaDescription:
      'Browse Bengaluru cafes with confirmed customer Wi-Fi across Indiranagar, Koramangala, MG Road, Church Street, Whitefield, Jayanagar & Electronic City.',
    h1: 'Cafes with Confirmed Wi-Fi in Bengaluru',
    kicker: 'Wi-Fi Verified Discovery',
    intro:
      'Stop guessing whether a coffee shop actually offers customer internet. Every cafe listed on this page has confirmed Wi-Fi availability from official sources or field reviews, spanning budget spots to all-day roasteries.',
    highlights: [
      'Includes only listings where Wi-Fi availability is confirmed — zero guesswork or invented Mbps claims.',
      'Spans Indiranagar, Koramangala, Church Street, Whitefield, Jayanagar, JP Nagar, HSR Layout, and Electronic City.',
      'Pair Wi-Fi access with budget expectations and opening hours before commuting.',
    ],
    categoryFilter: 'wifi',
    requiresWifi: true,
    liveSearchQuery: 'cafes with wifi remote work bengaluru',
    relatedSlugs: [
      'work-friendly-cafes-in-bengaluru',
      'study-cafes-in-bengaluru',
      'best-cafes-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Why do some cafes show "Speed not verified" even when Wi-Fi is available?',
        answer:
          'Cafe Desk follows strict data integrity: we confirm Wi-Fi availability when verified, and only display an exact Mbps speed after a real on-site speed test has been logged.',
      },
    ],
  },
  {
    slug: 'budget-breakfast-cafes-in-bengaluru',
    path: '/budget-breakfast-cafes-in-bengaluru',
    group: 'budget',
    title: 'Budget Breakfast & Morning Coffee Cafes in Bengaluru | Cafe Desk',
    metaDescription:
      'Start your morning at affordable Bengaluru cafes serving filter kaapi, poha, upma, maddur vada, bun maska, eggs & croissants under ₹250.',
    h1: 'Budget Breakfast & Morning Coffee Cafes in Bengaluru',
    kicker: 'Morning Brews & Bites',
    intro:
      'Looking for an early morning filter coffee with poha, maddur vada, bun maska, or freshly baked croissants before the 10 AM standup? Explore affordable morning-friendly Bengaluru cafes with verified opening items.',
    highlights: [
      'Spotlights morning value spots like Hatti Kaapi (MG Road), Chai Days (Indiranagar), Glen’s Bakehouse, and local bakeries.',
      'Great for early commuters, Namma Metro riders, and pre-work catch-ups.',
      'Filter by price band and area distance in one tap.',
    ],
    categoryFilter: 'breakfast',
    maxAvgCost: 275,
    liveSearchQuery: 'morning breakfast coffee cafes bengaluru',
    relatedSlugs: [
      'snacks-and-bakeries-in-bengaluru',
      'budget-coffee-shops-in-bengaluru',
      'affordable-cafes-in-bengaluru',
    ],
    faqs: [
      {
        question: 'What budget breakfast options are available at listed cafes?',
        answer:
          'Depending on the venue, options include Maddur Vada, Poha, Upma, Bun Maska, Banana Cake, Bread Omelette, fresh veg puffs, and South Indian filter coffee.',
      },
    ],
  },

  // =========================================================================
  // BENGALURU LOCALITY SEO LANDING PAGES
  // =========================================================================
  {
    slug: 'cafes-in-koramangala',
    path: '/cafes-in-koramangala',
    group: 'locality',
    title: 'Best Cafes in Koramangala – Work, Wi-Fi & Coffee | Cafe Desk',
    metaDescription:
      'Explore top cafes in Koramangala, Bengaluru for remote work, studying, specialty coffee & bakery snacks — Blue Tokai, Dialogues, Cafe Medley & Glen’s Bakehouse.',
    h1: 'Best Cafes in Koramangala, Bengaluru',
    kicker: 'Koramangala Locality Guide',
    intro:
      'Koramangala is Bengaluru’s busiest startup and student cafe neighbourhood. Whether you want a budget ₹180 laptop desk at Cafe Medley, deep-work space at Dialogues Cafe, single-origin espresso at Blue Tokai, or warm puffs at Glen’s Bakehouse, compare every Koramangala pick here.',
    highlights: [
      'Home to both budget laptop cafes (₹180 avg) and quiet all-day work/study spaces with Wi-Fi.',
      'Easy bus & cab connectivity across 4th, 5th, 6th, and 8th Blocks plus Sony Signal.',
      'Direct Google Maps directions and live nearby place discovery included.',
    ],
    areaKeywords: ['Koramangala'],
    liveSearchQuery: 'cafes coffee tea in Koramangala',
    liveSearchArea: 'Koramangala',
    relatedSlugs: [
      'best-coffee-shops-in-koramangala',
      'cafes-in-hsr-layout',
      'cafes-in-btm-layout',
      'work-friendly-cafes-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Which Koramangala cafe is best for quiet studying or laptop work?',
        answer:
          'Dialogues Cafe and Blue Tokai Coffee Roasters in Koramangala are popular for quiet studying and remote work with Wi-Fi, while Cafe Medley offers a strong budget-friendly laptop alternative.',
      },
      {
        question: 'Are there budget cafes in Koramangala under ₹200?',
        answer:
          'Yes — Cafe Medley averages around ₹180 per person with Wi-Fi, and Glen’s Bakehouse offers puffs and pastries starting ₹53–₹96.',
      },
    ],
  },
  {
    slug: 'best-coffee-shops-in-koramangala',
    path: '/best-coffee-shops-in-koramangala',
    group: 'locality',
    title: 'Best Coffee Shops in Koramangala – Specialty & Budget | Cafe Desk',
    metaDescription:
      'Compare the best coffee shops in Koramangala including Blue Tokai Coffee Roasters, Cafe Medley, Dialogues & Glen’s Bakehouse with prices & Wi-Fi details.',
    h1: 'Best Coffee Shops in Koramangala, Bengaluru',
    kicker: 'Koramangala Coffee Picks',
    intro:
      'Craving single-origin pour-overs, cold brew, or an affordable cappuccino near Koramangala 4th & 8th Block? Compare Koramangala’s verified coffee houses by average spend, Wi-Fi status, and workspace suitability.',
    highlights: [
      'Verified coffee bars from ₹180/person value brews to specialty roasteries.',
      'Check seating, study friendliness, and maps pins before walking over.',
      'Load additional street-level coffee corners anytime using live Google Places.',
    ],
    areaKeywords: ['Koramangala'],
    categoryFilter: 'coffee',
    liveSearchQuery: 'best coffee shops in Koramangala',
    liveSearchArea: 'Koramangala',
    relatedSlugs: [
      'cafes-in-koramangala',
      'coffee-shops-in-bengaluru',
      'cafes-in-indiranagar',
    ],
    faqs: [
      {
        question: 'What are the best coffee shops in Koramangala with Wi-Fi?',
        answer:
          'Blue Tokai Coffee Roasters, Dialogues Cafe, and Cafe Medley in Koramangala all provide customer Wi-Fi alongside coffee.',
      },
    ],
  },
  {
    slug: 'cafes-in-indiranagar',
    path: '/cafes-in-indiranagar',
    group: 'locality',
    title: 'Best Cafes in Indiranagar – Coffee, Chai & Work | Cafe Desk',
    metaDescription:
      'Discover the best cafes in Indiranagar near 100 Feet Road & 12th Main: Araku Coffee, Paper & Pie, Third Wave, Cafe Terra & Chai Days with Wi-Fi & price info.',
    h1: 'Best Cafes in Indiranagar, Bengaluru',
    kicker: 'Indiranagar Locality Guide',
    intro:
      'Walkable tree-lined lanes off 12th Main and 100 Feet Road make Indiranagar one of Bengaluru’s premier cafe districts. Compare specialty coffee landmarks like Araku and Paper & Pie with calm study corners and budget chai bars minutes from Indiranagar Metro.',
    highlights: [
      'Walking distance from Indiranagar Namma Metro Station (Purple Line).',
      'Mix of design-led work cafes (Paper & Pie, Third Wave, Cafe Terra, Araku) and ₹150 chai stops (Chai Days).',
      'Clear pricing bands so you know whether a spot fits an everyday budget or a client meeting.',
    ],
    areaKeywords: ['Indiranagar'],
    liveSearchQuery: 'cafes coffee tea in Indiranagar',
    liveSearchArea: 'Indiranagar',
    relatedSlugs: [
      'affordable-cafes-in-indiranagar',
      'cafes-in-mg-road',
      'work-friendly-cafes-in-bengaluru',
      'study-cafes-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Which Indiranagar cafes are close to the Metro station for working?',
        answer:
          'Third Wave Coffee, Paper & Pie, Cafe Terra, Araku Coffee, and Chai Days are all within a short walk or auto ride from Indiranagar Purple Line Metro.',
      },
      {
        question: 'Are there budget tea or snack options in Indiranagar?',
        answer:
          'Yes. Chai Days in Indiranagar averages ~₹150 per person with masala chai, bun maska, and banana cake.',
      },
    ],
  },
  {
    slug: 'affordable-cafes-in-indiranagar',
    path: '/affordable-cafes-in-indiranagar',
    group: 'locality',
    title: 'Affordable Cafes in Indiranagar – Budget Chai & Coffee | Cafe Desk',
    metaDescription:
      'Find affordable cafes and budget chai spots in Indiranagar without overspending. Compare Chai Days, Cafe Terra, Third Wave & live budget local spots.',
    h1: 'Affordable Cafes & Budget Tea Spots in Indiranagar',
    kicker: 'Indiranagar on a Budget',
    intro:
      'Indiranagar is famous for upscale specialty coffee, yet you can still find smart sub-₹300 coffee and ₹94–₹150 chai stops tucked along 100 Feet Road and inner lanes. Compare budget-conscious Indiranagar cafes and discover street-level tea corners via Google Maps.',
    highlights: [
      'Chai Days keeps spend around ₹150 with chai combos, bun maska, and cakes.',
      'Cafe Terra and Third Wave Coffee offer ₹300-range work desks with Wi-Fi included.',
      'Tap Discover Live Budget Spots to uncover nearby darshinis, bakeries, and tea stalls in Indiranagar.',
    ],
    areaKeywords: ['Indiranagar'],
    maxAvgCost: 320,
    liveSearchQuery: 'affordable tea coffee bakery in Indiranagar',
    liveSearchArea: 'Indiranagar',
    relatedSlugs: [
      'cafes-in-indiranagar',
      'affordable-cafes-in-bengaluru',
      'cafes-under-200-in-bengaluru',
    ],
    faqs: [
      {
        question: 'What is the cheapest verified cafe spot listed in Indiranagar?',
        answer:
          'Chai Days averages around ₹150 per person, making it an easy stop for ginger masala chai and light snacks.',
      },
    ],
  },
  {
    slug: 'cafes-in-hsr-layout',
    path: '/cafes-in-hsr-layout',
    group: 'locality',
    title: 'Best Cafes in HSR Layout – Work, Study & Budget | Cafe Desk',
    metaDescription:
      'Explore work-friendly and budget cafes in HSR Layout, Bengaluru — Cafe Hustle, Meet And Perk Up & Third Wave Coffee with Wi-Fi & seating info.',
    h1: 'Best Cafes in HSR Layout, Bengaluru',
    kicker: 'HSR Layout Locality Guide',
    intro:
      'Packed with founders, designers, and students around 27th Main and Sector 2, HSR Layout offers reliable laptop cafes alongside affordable biscuit-and-chai hangouts. Browse verified HSR spots with Wi-Fi status and route links.',
    highlights: [
      'Work & study favourites like Cafe Hustle and Third Wave Coffee offer Wi-Fi and laptop tables.',
      'Budget pick Meet And Perk Up keeps tea at ₹53 and light snacks ₹13–₹65.',
      'Convenient access along Outer Ring Road, 27th Main, and Agara.',
    ],
    areaKeywords: ['HSR Layout', 'HSR'],
    liveSearchQuery: 'cafes coffee tea in HSR Layout',
    liveSearchArea: 'HSR Layout',
    relatedSlugs: [
      'budget-cafes-in-hsr-layout',
      'cafes-in-koramangala',
      'cafes-in-btm-layout',
      'work-friendly-cafes-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Which cafe in HSR Layout is good for focused study or startup work?',
        answer:
          'Cafe Hustle and Third Wave Coffee in HSR Layout both support remote work with confirmed Wi-Fi, with Cafe Hustle also tagged suitable for quiet study.',
      },
    ],
  },
  {
    slug: 'budget-cafes-in-hsr-layout',
    path: '/budget-cafes-in-hsr-layout',
    group: 'locality',
    title: 'Budget Cafes in HSR Layout – Tea, Snacks & Study | Cafe Desk',
    metaDescription:
      'Find budget cafes in HSR Layout under ₹250 per person — including ₹53 chai, ₹13 Osmania biscuits, bun maska & pocket-friendly study cafes.',
    h1: 'Budget Cafes in HSR Layout (₹100–₹250 Per Person)',
    kicker: 'HSR Budget Guide',
    intro:
      'Working or studying in HSR Layout on a tight daily budget? Compare verified ₹250-and-under HSR cafes like Meet And Perk Up and Cafe Hustle, plus load street-level chai stalls and bakeries across Sector 1–7.',
    highlights: [
      'Meet And Perk Up features ₹53 plain/tulsi ginger tea and ₹13–₹65 snacks.',
      'Cafe Hustle keeps average spend around ₹250 with study-friendly Wi-Fi access.',
      'Explore nearby Outer Ring Road and 27th Main quick snack stops via live search.',
    ],
    areaKeywords: ['HSR Layout', 'HSR'],
    maxAvgCost: 260,
    liveSearchQuery: 'budget cafes tea bakery in HSR Layout',
    liveSearchArea: 'HSR Layout',
    relatedSlugs: [
      'cafes-in-hsr-layout',
      'affordable-cafes-in-bengaluru',
      'tea-shops-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Can I work on a budget in HSR Layout cafes?',
        answer:
          'Yes — Cafe Hustle (~₹250 average spend) pairs study/work-friendly seating and Wi-Fi with moderate prices, while Meet And Perk Up covers quick ₹53 chai breaks.',
      },
    ],
  },
  {
    slug: 'cafes-in-whitefield',
    path: '/cafes-in-whitefield',
    group: 'locality',
    title: 'Best Cafes in Whitefield – Workspaces & Wi-Fi | Cafe Desk',
    metaDescription:
      'Discover work-friendly cafes in Whitefield, Bengaluru with confirmed Wi-Fi & laptop tables including Paper & Pie and Third Wave Coffee.',
    h1: 'Best Work Cafes & Coffee Shops in Whitefield, Bengaluru',
    kicker: 'Whitefield Locality Guide',
    intro:
      'Need a change of scenery from ITPL or Brookefield tech offices? Whitefield’s curated cafes deliver dependable customer Wi-Fi, calm study seating, and spacious tables near the Purple Line Metro corridor.',
    highlights: [
      'Both curated Whitefield picks — Paper & Pie and Third Wave Coffee — confirm Wi-Fi and laptop-friendly desks.',
      'Convenient for ITPL, Hoodi, Kadugodi, and Brookefield commuters.',
      'Discover additional Whitefield bakeries and tea corners live via Google Maps.',
    ],
    areaKeywords: ['Whitefield'],
    liveSearchQuery: 'cafes coffee work spaces in Whitefield Bengaluru',
    liveSearchArea: 'Whitefield',
    relatedSlugs: [
      'cafes-in-marathahalli',
      'work-friendly-cafes-in-bengaluru',
      'cafes-with-wifi-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Are Whitefield cafes easily reachable via Namma Metro?',
        answer:
          'Yes, the extended Purple Line Metro connects Whitefield (Kadugodi), Hope Farm, and Hoodi directly to Indiranagar and MG Road cafe hubs.',
      },
    ],
  },
  {
    slug: 'cafes-in-marathahalli',
    path: '/cafes-in-marathahalli',
    group: 'locality',
    title: 'Best Cafes & Tea Shops in Marathahalli (Under ₹150) | Cafe Desk',
    metaDescription:
      'Find affordable tea shops, chai bars & budget cafes in Marathahalli, Bengaluru — Tea Day & The Tea Factory under ₹100 per person.',
    h1: 'Budget Cafes & Tea Shops in Marathahalli, Bengaluru',
    kicker: 'Marathahalli Locality Guide',
    intro:
      'Along Outer Ring Road and Marathahalli Bridge, quick affordable tea bars dominate everyday coffee and snack runs. Check out verified ~₹100 spots like Tea Day and The Tea Factory, or load live work cafes nearby.',
    highlights: [
      'Ultra-affordable ~₹100 average spend for dum chai, iced tea, and quick evening snacks.',
      'Ideal for tech-park tea breaks along ORR, Munnekollal, and Kundalahalli.',
      'Tap Live Google Maps Discovery if you need sit-down Wi-Fi lounges near Marathahalli.',
    ],
    areaKeywords: ['Marathahalli'],
    liveSearchQuery: 'cafes tea coffee snacks in Marathahalli Bengaluru',
    liveSearchArea: 'Marathahalli',
    relatedSlugs: [
      'cafes-in-whitefield',
      'tea-shops-in-bengaluru',
      'cafes-under-100-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Are there ₹100 tea spots in Marathahalli?',
        answer:
          'Yes — Tea Day and The Tea Factory in Marathahalli both average around ₹100 per person for chai and quick bites.',
      },
    ],
  },
  {
    slug: 'cafes-in-jayanagar',
    path: '/cafes-in-jayanagar',
    group: 'locality',
    title: 'Best Cafes in Jayanagar – Study & Coffee | Cafe Desk',
    metaDescription:
      'Explore calm study cafes and neighbourhood coffee spots in Jayanagar, Bengaluru — Katte Kulture & Third Wave Coffee near Jayanagar Metro.',
    h1: 'Best Study & Neighbourhood Cafes in Jayanagar, Bengaluru',
    kicker: 'Jayanagar Locality Guide',
    intro:
      'Jayanagar’s shady avenues and Green Line Metro stops make it a favourite for South Bengaluru college students and remote workers alike. Compare study-friendly spaces like Katte Kulture and Third Wave Coffee without noisy crowds.',
    highlights: [
      'Close to Jayanagar and South End Circle Green Line Metro stations.',
      'Both curated Jayanagar cafes are study-friendly, covering ₹225 budget snacks and ₹300 Wi-Fi desks.',
      'Neighbouring Basavanagudi and JP Nagar spots are just 10 minutes away.',
    ],
    areaKeywords: ['Jayanagar'],
    liveSearchQuery: 'cafes coffee study spots in Jayanagar Bengaluru',
    liveSearchArea: 'Jayanagar',
    relatedSlugs: [
      'cafes-in-jp-nagar',
      'cafes-in-basavanagudi',
      'study-cafes-in-bengaluru',
    ],
    faqs: [
      {
        question: 'What is a good quiet study cafe in Jayanagar?',
        answer:
          'Katte Kulture offers a calm ~₹225 study atmosphere, while Third Wave Coffee Jayanagar provides confirmed Wi-Fi and laptop tables.',
      },
    ],
  },
  {
    slug: 'cafes-in-mg-road',
    path: '/cafes-in-mg-road',
    group: 'locality',
    title: 'Best Cafes on MG Road & Church Street, Bengaluru | Cafe Desk',
    metaDescription:
      'Discover cafes near MG Road & Church Street Metro — Blue Tokai, Hatti Kaapi, Matteo Coffea & Third Wave Coffee for work, filter kaapi & meetups.',
    h1: 'Best Cafes Near MG Road & Church Street, Bengaluru',
    kicker: 'Central Bengaluru & Metro Hub',
    intro:
      'Right beside MG Road and Cubbon Park Metro stations, Church Street and MG Road blend iconic laptop coffeehouses with fast ₹50–₹114 South Indian filter kaapi counters. Ideal for cross-city meetings and rainy-day espresso.',
    highlights: [
      'Steps away from MG Road Purple Line Metro — easy meetups from East, West, and South Bengaluru.',
      'Combines work-friendly roasters (Blue Tokai, Matteo Coffea, Third Wave) with budget Filter Kaapi (Hatti Kaapi).',
      'Great for central co-working, client catch-ups, and weekend reading.',
    ],
    areaKeywords: ['MG Road', 'Church Street'],
    liveSearchQuery: 'cafes coffee shops near MG Road Church Street Bengaluru',
    liveSearchArea: 'MG Road',
    relatedSlugs: [
      'cafes-in-indiranagar',
      'work-friendly-cafes-in-bengaluru',
      'budget-coffee-shops-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Which MG Road / Church Street cafe is cheapest for quick coffee and snacks?',
        answer:
          'Hatti Kaapi near MG Road serves South Indian filter kaapi and combos from ₹50–₹114 alongside snacks like maddur vada and poha.',
      },
    ],
  },
  {
    slug: 'cafes-in-electronic-city',
    path: '/cafes-in-electronic-city',
    group: 'locality',
    title: 'Best Cafes & Tea Spots in Electronic City, Bengaluru | Cafe Desk',
    metaDescription:
      'Find cafes, Wi-Fi coffee lounges & affordable chai spots in Electronic City Phase 1 & 2 — Coffee Confessions, Chai Sutta Bar & Tea Time.',
    h1: 'Best Cafes & Tea Spots in Electronic City, Bengaluru',
    kicker: 'Electronic City Locality Guide',
    intro:
      'Serving Electronic City Phase 1, Phase 2, and Neeladri Nagar commuters, these curated picks cover both laptop-friendly Wi-Fi coffee tables at Coffee Confessions and sub-₹150 chai & Maggi stops like Chai Sutta Bar and Tea Time.',
    highlights: [
      'Tea Time & Chai Sutta Bar keep chai & snacks budget-friendly (₹20–₹89).',
      'Coffee Confessions provides Wi-Fi and laptop-friendly seating for remote workdays.',
      'Quickly explore additional Neeladri Nagar cafes with live Maps search.',
    ],
    areaKeywords: ['Electronic City'],
    liveSearchQuery: 'cafes coffee tea in Electronic City Bengaluru',
    liveSearchArea: 'Electronic City',
    relatedSlugs: [
      'tea-shops-in-bengaluru',
      'cafes-in-btm-layout',
      'affordable-cafes-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Is there a laptop-friendly cafe with Wi-Fi in Electronic City?',
        answer:
          'Yes — Coffee Confessions in Electronic City lists confirmed customer Wi-Fi and laptop-friendly seating alongside a ~₹280 average budget.',
      },
    ],
  },
  {
    slug: 'cafes-in-malleshwaram',
    path: '/cafes-in-malleshwaram',
    group: 'locality',
    title: 'Best Cafes & Filter Coffee in Malleshwaram, Bengaluru | Cafe Desk',
    metaDescription:
      'Explore neighbourhood cafes and filter coffee shops in Malleshwaram, Bengaluru — Kalmane Koffees & Suto Cafe under ₹200 per person.',
    h1: 'Best Cafes & Coffee Spots in Malleshwaram, Bengaluru',
    kicker: 'Malleshwaram Locality Guide',
    intro:
      'North-West Bengaluru’s historic Malleshwaram blends heritage avenue charm with approachable local coffee shops like Kalmane Koffees and Suto Cafe — both averaging ₹175–₹200 per person.',
    highlights: [
      'Affordable ₹175–₹200 average spends near Sampige Road, 8th Cross & Mantri Square Metro.',
      'Great for morning filter coffee, cold coffee, and relaxed group snacks.',
      'Close to neighbouring Rajajinagar bakery cafes.',
    ],
    areaKeywords: ['Malleshwaram'],
    liveSearchQuery: 'cafes coffee bakery in Malleshwaram Bengaluru',
    liveSearchArea: 'Malleshwaram',
    relatedSlugs: [
      'cafes-in-rajajinagar',
      'budget-coffee-shops-in-bengaluru',
      'cafes-under-200-in-bengaluru',
    ],
    faqs: [
      {
        question: 'What are budget cafe options in Malleshwaram?',
        answer:
          'Kalmane Koffees (~₹175 avg) and Suto Cafe (~₹200 avg) offer approachable filter coffee, cold beverages, and snacks in Malleshwaram.',
      },
    ],
  },
  {
    slug: 'cafes-in-rajajinagar',
    path: '/cafes-in-rajajinagar',
    group: 'locality',
    title: 'Best Bakery & Coffee Cafes in Rajajinagar, Bengaluru | Cafe Desk',
    metaDescription:
      'Discover affordable coffee shops and bakery cafes in Rajajinagar near Green Line Metro — Coffee Grand & Glen’s Bakehouse.',
    h1: 'Best Cafes & Bakeries in Rajajinagar, Bengaluru',
    kicker: 'Rajajinagar Locality Guide',
    intro:
      'Connected directly via the Green Line Metro, Rajajinagar offers crisp value cafes like Coffee Grand (~₹150 avg) and crowd-pleasing bakery treats at Glen’s Bakehouse (~₹250 avg) for West Bengaluru students and families.',
    highlights: [
      'Accessible from Rajajinagar & Mahakavi Kuvempu Road Green Line Metro stations.',
      'Mix of ~₹150 coffee spots and fresh oven puffs, croissants & desserts.',
      'Easy links to Malleshwaram and Vijayanagar neighbourhood listings.',
    ],
    areaKeywords: ['Rajajinagar'],
    liveSearchQuery: 'cafes coffee bakery in Rajajinagar Bengaluru',
    liveSearchArea: 'Rajajinagar',
    relatedSlugs: [
      'cafes-in-malleshwaram',
      'cafes-in-vijayanagar',
      'snacks-and-bakeries-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Where can I get fresh bakery snacks and coffee in Rajajinagar?',
        answer:
          'Glen’s Bakehouse (Rajajinagar) and Coffee Grand both serve West Bengaluru visitors with accessible beverage and bakery pricing.',
      },
    ],
  },
  {
    slug: 'cafes-in-jp-nagar',
    path: '/cafes-in-jp-nagar',
    group: 'locality',
    title: 'Best Cafes in JP Nagar – Study & Budget | Cafe Desk',
    metaDescription:
      'Browse quiet study cafes and affordable espresso spots in JP Nagar, South Bengaluru — Third Wave Coffee & Cafe Aroma Express.',
    h1: 'Best Cafes in JP Nagar, Bengaluru',
    kicker: 'JP Nagar Locality Guide',
    intro:
      'Just south of Jayanagar, JP Nagar pairs calm residential lanes with both study-ready Wi-Fi coffeehouses (Third Wave Coffee) and budget quick-bite hangouts (Cafe Aroma Express).',
    highlights: [
      'Covers Green Line Metro stops near JP Nagar & Jaya Prakash Nagar.',
      'Includes quiet study-friendly seating with Wi-Fi alongside ₹250 casual cafes.',
    ],
    areaKeywords: ['JP Nagar'],
    liveSearchQuery: 'cafes coffee study in JP Nagar Bengaluru',
    liveSearchArea: 'JP Nagar',
    relatedSlugs: ['cafes-in-jayanagar', 'cafes-in-btm-layout', 'study-cafes-in-bengaluru'],
    faqs: [
      {
        question: 'Is there a study-friendly cafe with Wi-Fi in JP Nagar?',
        answer:
          'Yes — Third Wave Coffee in JP Nagar is tagged laptop-friendly, suitable for studying, and confirms customer Wi-Fi.',
      },
    ],
  },
  {
    slug: 'cafes-in-btm-layout',
    path: '/cafes-in-btm-layout',
    group: 'locality',
    title: 'Best Budget & Work Cafes in BTM Layout, Bengaluru | Cafe Desk',
    metaDescription:
      'Find affordable cafes in BTM Layout under ₹200 with Wi-Fi and student snacks — Brewz Coffee & Olive Street Food Cafe.',
    h1: 'Best Budget & Work Cafes in BTM Layout, Bengaluru',
    kicker: 'BTM Layout Locality Guide',
    intro:
      'Positioned between Koramangala, HSR Layout, and JP Nagar, BTM Layout is packed with students and job-seekers looking for affordable Wi-Fi workspaces like Brewz Coffee (~₹190 avg) and pocket-friendly eats at Olive Street Food Cafe (~₹200 avg).',
    highlights: [
      'Both curated BTM Layout cafes average ₹190–₹200 per person.',
      'Brewz Coffee includes confirmed Wi-Fi and laptop-friendly tables.',
    ],
    areaKeywords: ['BTM Layout', 'BTM'],
    liveSearchQuery: 'budget cafes coffee in BTM Layout Bengaluru',
    liveSearchArea: 'BTM Layout',
    relatedSlugs: [
      'cafes-in-koramangala',
      'cafes-in-hsr-layout',
      'cafes-under-200-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Where can students work on laptops affordably in BTM Layout?',
        answer:
          'Brewz Coffee in BTM Layout combines confirmed Wi-Fi and laptop-friendly tables with a budget-friendly ~₹190 average spend.',
      },
    ],
  },
  {
    slug: 'cafes-in-banashankari',
    path: '/cafes-in-banashankari',
    group: 'locality',
    title: 'Best Tea & Budget Cafes in Banashankari, Bengaluru | Cafe Desk',
    metaDescription:
      'Explore pocket-friendly tea shops and student hangout cafes in Banashankari, Bengaluru including Tea Day near Banashankari stages.',
    h1: 'Budget Tea & Student Cafes in Banashankari, Bengaluru',
    kicker: 'Banashankari Locality Guide',
    intro:
      'Surrounded by colleges and residential blocks, Banashankari thrives on affordable tea corners like Tea Day (~₹100 avg). Explore curated Banashankari spots and discover nearby local darshinis and bakeries via live Maps.',
    highlights: [
      'Student-friendly pricing averaging ~₹100 per visit.',
      'Minutes from Banashankari Green Line Metro and bus terminus.',
    ],
    areaKeywords: ['Banashankari'],
    liveSearchQuery: 'cafes tea coffee bakery in Banashankari Bengaluru',
    liveSearchArea: 'Banashankari',
    relatedSlugs: [
      'cafes-in-basavanagudi',
      'cafes-in-jayanagar',
      'tea-shops-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Are there cafes around Banashankari under ₹100?',
        answer:
          'Yes — Tea Day in Banashankari serves affordable chai and quick snacks averaging ~₹100 per person.',
      },
    ],
  },
  {
    slug: 'cafes-in-basavanagudi',
    path: '/cafes-in-basavanagudi',
    group: 'locality',
    title: 'Best Budget Coffee & Hangout Cafes in Basavanagudi | Cafe Desk',
    metaDescription:
      'Find affordable cold coffee, snacks & student cafes in Basavanagudi, Bengaluru including Nothing Before Coffee near Gandhi Bazaar.',
    h1: 'Coffee & Student Cafes in Basavanagudi, Bengaluru',
    kicker: 'Basavanagudi Locality Guide',
    intro:
      'Historic Basavanagudi and Gandhi Bazaar mix traditional South Bengaluru charm with lively student-priced coffee shops like Nothing Before Coffee (~₹150 avg). Check opening timings and live nearby spots below.',
    highlights: [
      'Great value ~₹150 average spend right near National College & Lalbagh Green Line Metro.',
      'Close to Jayanagar and Banashankari study spots.',
    ],
    areaKeywords: ['Basavanagudi'],
    liveSearchQuery: 'cafes coffee tea in Basavanagudi Bengaluru',
    liveSearchArea: 'Basavanagudi',
    relatedSlugs: [
      'cafes-in-jayanagar',
      'cafes-in-banashankari',
      'budget-coffee-shops-in-bengaluru',
    ],
    faqs: [
      {
        question: 'What is a popular budget coffee spot in Basavanagudi?',
        answer:
          'Nothing Before Coffee in Basavanagudi is a popular student spot with an average spend around ₹150.',
      },
    ],
  },
  {
    slug: 'cafes-in-vijayanagar',
    path: '/cafes-in-vijayanagar',
    group: 'locality',
    title: 'Best Bakery & Tea Cafes in Vijayanagar, Bengaluru | Cafe Desk',
    metaDescription:
      'Explore pocket-friendly bakeries & tea cafes in Vijayanagar, Bengaluru — Iyengar’s Bakery (₹100 avg) & Surapana Tea Cafe near Vijayanagar Metro.',
    h1: 'Best Bakery & Tea Cafes in Vijayanagar, Bengaluru',
    kicker: 'Vijayanagar Locality Guide',
    intro:
      'In West Bengaluru along the Purple Line Metro, Vijayanagar is famous for classic Iyengar bakeries serving hot puffs and sponge cake under ₹100 alongside lively chai cafes like Surapana Tea Cafe.',
    highlights: [
      'Pocket-friendly ₹100–₹150 average spend per person.',
      'Steps from Vijayanagar & Attiguppe Metro stops.',
    ],
    areaKeywords: ['Vijayanagar'],
    liveSearchQuery: 'bakery tea coffee cafes in Vijayanagar Bengaluru',
    liveSearchArea: 'Vijayanagar',
    relatedSlugs: [
      'cafes-in-rajajinagar',
      'snacks-and-bakeries-in-bengaluru',
      'cafes-under-100-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Can I find traditional Iyengar bakeries and chai spots in Vijayanagar?',
        answer:
          'Yes — Iyengar’s Bakery (~₹100 avg) and Surapana Tea Cafe (~₹150 avg) cover quick puffs, buns, and fresh chai in Vijayanagar.',
      },
    ],
  },
  {
    slug: 'cafes-in-yelahanka',
    path: '/cafes-in-yelahanka',
    group: 'locality',
    title: 'Best Bakery & Coffee Cafes in Yelahanka, Bengaluru | Cafe Desk',
    metaDescription:
      'Discover coffee shops and budget bakeries in Yelahanka New Town, North Bengaluru — Barista Coffee & The Pastry Inn.',
    h1: 'Best Cafes & Bakeries in Yelahanka, Bengaluru',
    kicker: 'North Bengaluru · Yelahanka',
    intro:
      'Serving North Bengaluru commuters and students in Yelahanka New Town, curated picks range from ₹100 bakery snacks at The Pastry Inn to relaxed espresso breaks at Barista Coffee.',
    highlights: [
      'North Bengaluru coverage spanning ₹100 pastries to ₹250 espresso sessions.',
      'Helpful for airport-corridor residents, college campuses, and weekend meetups.',
    ],
    areaKeywords: ['Yelahanka'],
    liveSearchQuery: 'cafes bakery coffee in Yelahanka Bengaluru',
    liveSearchArea: 'Yelahanka',
    relatedSlugs: [
      'cafes-in-malleshwaram',
      'snacks-and-bakeries-in-bengaluru',
      'affordable-cafes-in-bengaluru',
    ],
    faqs: [
      {
        question: 'Are there budget-friendly bakeries in Yelahanka on Cafe Desk?',
        answer:
          'Yes — The Pastry Inn averages ~₹100 per person for baked snacks alongside Barista Coffee (~₹250 avg) for coffee hangouts.',
      },
    ],
  },
];

const AREA_SLUG_MAP: Record<string, string> = {
  koramangala: '/cafes-in-koramangala',
  indiranagar: '/cafes-in-indiranagar',
  'hsr layout': '/cafes-in-hsr-layout',
  hsr: '/cafes-in-hsr-layout',
  whitefield: '/cafes-in-whitefield',
  marathahalli: '/cafes-in-marathahalli',
  jayanagar: '/cafes-in-jayanagar',
  'mg road': '/cafes-in-mg-road',
  'church street': '/cafes-in-mg-road',
  'electronic city': '/cafes-in-electronic-city',
  malleshwaram: '/cafes-in-malleshwaram',
  rajajinagar: '/cafes-in-rajajinagar',
  'jp nagar': '/cafes-in-jp-nagar',
  'btm layout': '/cafes-in-btm-layout',
  btm: '/cafes-in-btm-layout',
  banashankari: '/cafes-in-banashankari',
  basavanagudi: '/cafes-in-basavanagudi',
  vijayanagar: '/cafes-in-vijayanagar',
  yelahanka: '/cafes-in-yelahanka',
};

export function getAreaSeoRoute(areaName: string): string | null {
  const key = areaName.trim().toLowerCase();
  return AREA_SLUG_MAP[key] || null;
}

export function resolveSeoPageByPath(pathname: string): SeoLandingPageDef | undefined {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return LOCAL_SEO_PAGES.find((p) => p.path === normalized || `/${p.slug}` === normalized);
}

export function filterCafesForSeoPage(
  locations: LocationItem[],
  page: SeoLandingPageDef
): LocationItem[] {
  const filtered = locations.filter((loc) => {
    if (!loc.published) return false;

    if (page.areaKeywords && page.areaKeywords.length > 0) {
      const hayArea = `${loc.area} ${loc.address}`.toLowerCase();
      const hitArea = page.areaKeywords.some((kw) => hayArea.includes(kw.toLowerCase()));
      if (!hitArea) return false;
    }

    if (typeof page.maxAvgCost === 'number') {
      if (loc.avg_cost_per_person === null || loc.avg_cost_per_person > page.maxAvgCost) {
        return false;
      }
    }

    if (page.requiresWifi && loc.wifi_available !== 'yes') {
      return false;
    }

    if (page.requiresStudy && loc.suitable_for_studying !== 'yes') {
      return false;
    }

    if (page.requiresWork && loc.suitable_for_working !== 'yes' && !loc.laptop_friendly) {
      return false;
    }

    const hayText = [
      loc.name,
      loc.category || '',
      loc.coffee_price || '',
      loc.tea_price || '',
      loc.snacks_price || '',
      loc.meals_price || '',
      loc.popular_items.join(' '),
      loc.description,
      loc.verdict,
      loc.claims.join(' '),
    ]
      .join(' ')
      .toLowerCase();

    switch (page.categoryFilter) {
      case 'coffee':
        if (!loc.coffee_price && !/coffee|espresso|kaapi|latte|cappuccino|mocha/.test(hayText)) {
          return false;
        }
        break;
      case 'tea':
        if (!loc.tea_price && !/tea|chai/.test(hayText)) {
          return false;
        }
        break;
      case 'snacks':
        if (
          !loc.snacks_price &&
          !/bakery|pastry|puff|croissant|bun|snack|cake|biscuit|sandwich/.test(hayText)
        ) {
          return false;
        }
        break;
      case 'juice':
        if (
          !/juice|smoothie|shake|cooler|iced tea|lemonade|mocktail|cold brew/.test(hayText)
        ) {
          return false;
        }
        break;
      case 'breakfast':
        if (
          !/poha|upma|vada|bun maska|croissant|bread omelette|breakfast|bakery|filter/.test(
            hayText
          )
        ) {
          return false;
        }
        break;
      default:
        break;
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    const costA = a.avg_cost_per_person ?? Number.MAX_SAFE_INTEGER;
    const costB = b.avg_cost_per_person ?? Number.MAX_SAFE_INTEGER;
    const budgetA = a.modes.includes('budget') || costA <= 220 ? 1 : 0;
    const budgetB = b.modes.includes('budget') || costB <= 220 ? 1 : 0;
    if (budgetB !== budgetA) return budgetB - budgetA;
    if (costA !== costB) return costA - costB;
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export interface GuideFaq {
  question: string;
  answer: string;
}

export interface GuideSection {
  heading: string;
  paragraphs: string[];
  tips?: string[];
}

export interface LocalGuideArticle {
  slug: string;
  title: string;
  seoTitle: string;
  metaDescription: string;
  category: string;
  publishedDate: string; // ISO YYYY-MM-DD
  updatedDate: string; // ISO YYYY-MM-DD
  readTimeMinutes: number;
  authorName: string;
  coverImage: string;
  coverAlt: string;
  summary: string;
  featuredCafeSlugs: string[];
  relatedSeoPaths: Array<{ label: string; path: string }>;
  sections: GuideSection[];
  faqs: GuideFaq[];
}

export const LOCAL_GUIDES: LocalGuideArticle[] = [
  {
    slug: 'best-affordable-cafes-in-bengaluru',
    title: 'Best Affordable Cafes in Bengaluru (₹50–₹250 Verified Price Guide)',
    seoTitle: 'Best Affordable Cafes in Bengaluru (₹50–₹250) | Cafe Desk',
    metaDescription:
      'Skip ₹400 cappuccinos. Discover Bengaluru’s genuinely affordable cafes, chai bars, bakeries & budget work spots verified between ₹50 and ₹250 per person.',
    category: 'Budget Guides',
    publishedDate: '2026-03-10',
    updatedDate: '2026-04-12',
    readTimeMinutes: 5,
    authorName: 'CafeDesk Editorial Team',
    coverImage: '/src/assets/images/editorial_coffee_pour_1794976060659.jpg',
    coverAlt: 'Ceramic coffee cup with latte art and butter croissant on a wooden cafe table',
    summary:
      'A practical guide to keeping daily coffee, tea, and study sessions under ₹250 across Bengaluru without sacrificing seating comfort or honest menu quality.',
    featuredCafeSlugs: [
      'tea-day-banashankari',
      'iyengars-bakery-vijayanagar',
      'hatti-kaapi-mg-road',
      'cafe-medley-koramangala',
      'brewz-coffee-btm',
      'chai-days-indiranagar',
    ],
    relatedSeoPaths: [
      { label: 'Affordable Cafes in Bengaluru', path: '/affordable-cafes-in-bengaluru' },
      { label: 'Cafes Under ₹100', path: '/cafes-under-100-in-bengaluru' },
      { label: 'Cafes Under ₹200', path: '/cafes-under-200-in-bengaluru' },
    ],
    sections: [
      {
        heading: 'Where Bengaluru prices drop without losing comfort',
        paragraphs: [
          'While flagship specialty roasteries on 100 Feet Road often cross ₹400–₹550 per visit, student corridors in Banashankari, Vijayanagar, BTM Layout, Electronic City, and parts of Koramangala maintain reliable ₹50–₹200 menus.',
          'Separating quick counter spots from laptop-ready value cafes saves time: places like Cafe Medley in Koramangala (₹180 avg) and Brewz Coffee in BTM Layout (₹190 avg) let you bring a laptop with Wi-Fi under ₹200, whereas chai bars and Iyengar bakeries shine for fast 20-minute breaks.',
        ],
        tips: [
          'Look for ₹20–₹55 tea & filter kaapi counters near Metro exits like MG Road, Vijayanagar, and Indiranagar.',
          'Order snack combos (bun maska, maddur vada, puffs, or Maggi) instead of full plated brunch bowls to stay under ₹200.',
        ],
      },
      {
        heading: 'Best pockets across South, East & West Bengaluru',
        paragraphs: [
          'In South Bengaluru, Katte Kulture in Jayanagar keeps study-friendly sessions around ₹225, while Nothing Before Coffee in Basavanagudi averages ~₹150. Over in Marathahalli and Electronic City, Tea Day, Tea Time, and The Tea Factory serve dum chai and snacks near ₹100–₹150.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I actually work on a laptop at an affordable Bengaluru cafe?',
        answer:
          'Yes. Brewz Coffee (BTM Layout, ~₹190 avg) and Cafe Medley (Koramangala, ~₹180 avg) both list confirmed customer Wi-Fi and laptop-friendly desks.',
      },
      {
        question: 'Which spots are best strictly under ₹100?',
        answer:
          'Tea Day (Banashankari & Marathahalli), The Tea Factory (Marathahalli), Iyengar’s Bakery (Vijayanagar), and The Pastry Inn (Yelahanka) all average ~₹100 per person.',
      },
    ],
  },
  {
    slug: 'budget-tea-and-coffee-spots-in-bengaluru',
    title: 'Budget Tea, Filter Kaapi & Chai Spots Across Bengaluru',
    seoTitle: 'Budget Tea, Chai & Filter Kaapi Spots in Bengaluru | Cafe Desk',
    metaDescription:
      'Compare Bengaluru’s favourite chai bars and South Indian filter coffee stops from ₹20 dum tea to ₹94 masala chai across 10+ areas.',
    category: 'Tea & Coffee',
    publishedDate: '2026-03-14',
    updatedDate: '2026-04-12',
    readTimeMinutes: 4,
    authorName: 'CafeDesk Editorial Team',
    coverImage: '/src/assets/images/editorial_food_brunch_1794976061253.jpg',
    coverAlt: 'Fresh pastries and iced beverages arranged on a Bengaluru cafe table',
    summary:
      'From ₹20–₹45 dum and ginger chai in Electronic City and Marathahalli to ₹50–₹114 filter kaapi combos off MG Road, here is how locals grab great brews under ₹175.',
    featuredCafeSlugs: [
      'tea-time-ecity',
      'chai-sutta-bar-ecity',
      'hatti-kaapi-mg-road',
      'kalmane-koffees-malleshwaram',
      'tea-day-marathahalli',
      'surapana-tea-cafe-vijayanagar',
    ],
    relatedSeoPaths: [
      { label: 'Tea Shops in Bengaluru', path: '/tea-shops-in-bengaluru' },
      { label: 'Budget Coffee Shops', path: '/budget-coffee-shops-in-bengaluru' },
      { label: 'Cafes in MG Road', path: '/cafes-in-mg-road' },
    ],
    sections: [
      {
        heading: 'Chai stops vs Filter Kaapi houses',
        paragraphs: [
          'Bengaluru’s quick beverage landscape splits neatly between traditional South Indian filter coffee bars — such as Hatti Kaapi on MG Road and Kalmane Koffees in Malleshwaram — and modern masala/kulhad chai cafes like Tea Day, Tea Time, Chai Sutta Bar, and Chai Days.',
          'For commuters hopping off Namma Metro at MG Road or Indiranagar, Hatti Kaapi and Chai Days keep morning and 5 PM pitstops speedy without sacrificing hygiene or seating.',
        ],
      },
      {
        heading: 'What to order alongside your cup',
        paragraphs: [
          'Classic pairings include Maddur Vada, Poha, and biscuits at Hatti Kaapi (₹48–₹181), Osmania biscuits and bun maska at Meet And Perk Up in HSR Layout (₹13–₹65), and maska bun or Maggi at Chai Sutta Bar (₹27–₹54).',
        ],
      },
    ],
    faqs: [
      {
        question: 'Do tea shops stay open late in Bengaluru tech corridors?',
        answer:
          'Yes — Chai Sutta Bar, Tea Time, and Marathahalli chai stops frequently run late into the evening; always check individual cafe opening hours before leaving.',
      },
    ],
  },
  {
    slug: 'best-cafes-in-koramangala-for-students-and-remote-work',
    title: 'Best Cafes in Koramangala for Students & Remote Work',
    seoTitle: 'Best Cafes in Koramangala for Students & Remote Work | Cafe Desk',
    metaDescription:
      'Compare Koramangala cafes for laptop work, studying, and budget snacks: Blue Tokai, Dialogues Cafe, Cafe Medley & Glen’s Bakehouse.',
    category: 'Neighbourhood Guides',
    publishedDate: '2026-03-18',
    updatedDate: '2026-04-12',
    readTimeMinutes: 5,
    authorName: 'CafeDesk Editorial Team',
    coverImage: '/src/assets/images/editorial_workspace_lounge_1794976060874.jpg',
    coverAlt: 'Laptop workspace by a sunlit cafe window with notebook and cold brew',
    summary:
      'How to pick the right Koramangala table depending on whether you need quiet exam prep, back-to-back startup calls, or a ₹180 all-afternoon laptop coffee.',
    featuredCafeSlugs: [
      'dialogues-koramangala',
      'blue-tokai-koramangala',
      'cafe-medley-koramangala',
      'glens-bakehouse-koramangala',
    ],
    relatedSeoPaths: [
      { label: 'Cafes in Koramangala', path: '/cafes-in-koramangala' },
      { label: 'Best Coffee Shops in Koramangala', path: '/best-coffee-shops-in-koramangala' },
      { label: 'Work-Friendly Cafes in Bengaluru', path: '/work-friendly-cafes-in-bengaluru' },
    ],
    sections: [
      {
        heading: 'Matching Koramangala blocks to your workday goal',
        paragraphs: [
          'Koramangala covers everything from focused co-working cafes to bustling dessert bakeries. If uninterrupted focus or group project discussions are your priority, Dialogues Cafe and Blue Tokai Coffee Roasters both confirm customer Wi-Fi and study-friendly environments.',
          'On a leaner student budget? Cafe Medley brings average spend down near ₹180 per person while retaining laptop-friendly seating and Wi-Fi.',
        ],
        tips: [
          'Save Glen’s Bakehouse for post-work catchups, puffs (₹53–₹68), and croissants rather than long silent Zoom calls.',
          'Arrive before 11:00 AM on weekdays to grab wall-side seats near power outlets in Koramangala 4th & 8th Block.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Which Koramangala cafe has confirmed Wi-Fi and the lowest budget?',
        answer:
          'Cafe Medley in Koramangala combines confirmed Wi-Fi and laptop-friendly seating with an average spend of ~₹180 per person.',
      },
    ],
  },
  {
    slug: 'indiranagar-cafes-coffee-work-and-budget-guide',
    title: 'Indiranagar Cafes: Specialty Coffee, Quiet Study & Chai Stops',
    seoTitle: 'Indiranagar Cafes Guide: Coffee, Work & Chai | Cafe Desk',
    metaDescription:
      'Navigate Indiranagar’s cafe scene from 12th Main & 100 Feet Road — Araku Coffee, Paper & Pie, Cafe Terra, Third Wave & Chai Days.',
    category: 'Neighbourhood Guides',
    publishedDate: '2026-03-22',
    updatedDate: '2026-04-12',
    readTimeMinutes: 5,
    authorName: 'CafeDesk Editorial Team',
    coverImage: '/src/assets/images/hero_cafedesk_interior_1794976059561.jpg',
    coverAlt: 'Bright specialty coffee cafe lounge with communal wooden desks and greenery',
    summary:
      'From architectural specialty roasteries on 12th Main to ₹150 ginger chai near Indiranagar Metro, plan your work or coffee walk cleanly.',
    featuredCafeSlugs: [
      'paper-and-pie-indiranagar',
      'cafe-terra-indiranagar',
      'third-wave-indiranagar',
      'araku-indiranagar',
      'chai-days-indiranagar',
    ],
    relatedSeoPaths: [
      { label: 'Cafes in Indiranagar', path: '/cafes-in-indiranagar' },
      { label: 'Affordable Cafes in Indiranagar', path: '/affordable-cafes-in-indiranagar' },
      { label: 'Study Cafes in Bengaluru', path: '/study-cafes-in-bengaluru' },
    ],
    sections: [
      {
        heading: 'Best spots for laptop days vs client coffee',
        paragraphs: [
          'Indiranagar offers Bengaluru’s strongest density of design-forward workspaces. Paper & Pie, Cafe Terra, and Third Wave Coffee each provide confirmed customer Wi-Fi and welcoming remote-work tables, while Araku Coffee stands out on 12th Main when hosting out-of-town founders or clients.',
          'When you simply want an easy ₹94–₹100 ginger masala chai with bun maska before hopping onto the Purple Line Metro, Chai Days delivers reliable value at around ₹150 per person.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Can I reach these Indiranagar cafes easily by Namma Metro?',
        answer:
          'Yes — Indiranagar Metro Station (Purple Line) places 100 Feet Road and 12th Main cafes within a 5–12 minute walk or quick auto ride.',
      },
    ],
  },
  {
    slug: 'hsr-layout-cafes-for-freelancers-and-founders',
    title: 'HSR Layout Cafes for Freelancers, Founders & Deep Work',
    seoTitle: 'HSR Layout Cafes for Freelancers & Founders | Cafe Desk',
    metaDescription:
      'Explore HSR Layout work cafes and budget tea counters including Cafe Hustle, Third Wave Coffee & Meet And Perk Up.',
    category: 'Neighbourhood Guides',
    publishedDate: '2026-03-26',
    updatedDate: '2026-04-12',
    readTimeMinutes: 4,
    authorName: 'CafeDesk Editorial Team',
    coverImage: '/src/assets/images/editorial_team_meeting_1794976060148.jpg',
    coverAlt: 'Two coworkers discussing notes over espresso cups in a wooden cafe booth',
    summary:
      'Why HSR Layout Sector 1 & 27th Main remain go-to remote work spots — and where to grab ₹53 tea between sprints.',
    featuredCafeSlugs: ['cafe-hustle-hsr', 'third-wave-hsr', 'meet-and-perk-up-hsr'],
    relatedSeoPaths: [
      { label: 'Cafes in HSR Layout', path: '/cafes-in-hsr-layout' },
      { label: 'Budget Cafes in HSR Layout', path: '/budget-cafes-in-hsr-layout' },
      { label: 'Cafes with Wi-Fi in Bengaluru', path: '/cafes-with-wifi-in-bengaluru' },
    ],
    sections: [
      {
        heading: 'Balancing deep-work desks and ₹53 chai breaks',
        paragraphs: [
          'HSR Layout’s startup density means cafes here understand laptop workers. Cafe Hustle combines confirmed Wi-Fi with study- and work-friendly seating around ~₹250 per person, and Third Wave Coffee HSR anchors longer work sessions along main roads.',
          'Between work blocks, Meet And Perk Up serves plain or tulsi ginger tea at ₹53 alongside ₹13–₹65 Osmania biscuits and bun maska.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Which HSR cafe works best for both studying and solo remote work?',
        answer:
          'Cafe Hustle in HSR Layout is tagged suitable for both studying and working with confirmed Wi-Fi.',
      },
    ],
  },
  {
    slug: 'top-study-cafes-in-bengaluru-with-wifi',
    title: 'Quiet Study Cafes in Bengaluru with Confirmed Wi-Fi',
    seoTitle: 'Quiet Study Cafes in Bengaluru with Wi-Fi | Cafe Desk',
    metaDescription:
      'Find calm Bengaluru study cafes with confirmed customer Wi-Fi across Jayanagar, Koramangala, Indiranagar, JP Nagar & Whitefield.',
    category: 'Work & Study',
    publishedDate: '2026-03-30',
    updatedDate: '2026-04-12',
    readTimeMinutes: 5,
    authorName: 'CafeDesk Editorial Team',
    coverImage: '/src/assets/images/editorial_workspace_lounge_1794976060874.jpg',
    coverAlt: 'Quiet window cafe seat with laptop, notebook, and iced coffee',
    summary:
      'Stop wasting commute time on loud music cafes. These Bengaluru spots confirm customer Wi-Fi and study-friendly seating for focused reading and exam prep.',
    featuredCafeSlugs: [
      'dialogues-koramangala',
      'blue-tokai-koramangala',
      'third-wave-jayanagar',
      'third-wave-jp-nagar',
      'cafe-terra-indiranagar',
      'cafe-hustle-hsr',
    ],
    relatedSeoPaths: [
      { label: 'Study Cafes in Bengaluru', path: '/study-cafes-in-bengaluru' },
      { label: 'Cafes with Wi-Fi in Bengaluru', path: '/cafes-with-wifi-in-bengaluru' },
      { label: 'Cafes in Jayanagar', path: '/cafes-in-jayanagar' },
    ],
    sections: [
      {
        heading: 'What separates a real study cafe from a casual hangout',
        paragraphs: [
          'True study cafes share three practical traits: steady customer Wi-Fi, calm weekday acoustics without club-volume speakers, and tables big enough for both a 14-inch laptop and a physical notebook.',
          'South and Central picks like Third Wave Coffee (Jayanagar & JP Nagar), Blue Tokai (MG Road & Koramangala), Dialogues Cafe, and Cafe Terra (Indiranagar) consistently attract solo readers and researchers during weekday mornings and afternoons.',
        ],
        tips: [
          'Check noise badges and hours before Friday 6 PM when weekend social crowds arrive.',
          'Carry a lightweight extension or verify plug access when staying past 2 hours.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Are there quiet study cafes near Jayanagar and JP Nagar?',
        answer:
          'Yes — Third Wave Coffee in both Jayanagar and JP Nagar confirms Wi-Fi and study-friendly seating, while Katte Kulture in Jayanagar offers a calm ~₹225 alternative.',
      },
    ],
  },
  {
    slug: 'best-bakery-and-snack-cafes-in-bengaluru',
    title: 'Best Bakery & Evening Snack Cafes in Bengaluru (Puffs, Buns & Coffee)',
    seoTitle: 'Best Bakery & Snack Cafes in Bengaluru | Cafe Desk',
    metaDescription:
      'From ₹15–₹50 local Iyengar bakery puffs to Glen’s Bakehouse croissants & donuts — discover Bengaluru’s best bakery and snack cafes.',
    category: 'Food & Bakeries',
    publishedDate: '2026-04-04',
    updatedDate: '2026-04-12',
    readTimeMinutes: 4,
    authorName: 'CafeDesk Editorial Team',
    coverImage: '/src/assets/images/editorial_food_brunch_1794976061253.jpg',
    coverAlt: 'Freshly baked cardamom buns, tartine, and iced coffee on a cafe table',
    summary:
      'Bengaluru’s love affair with crisp veg puffs, bun maska, donuts, and fresh pastries spans classic local bakeries and bustling evening bakehouses.',
    featuredCafeSlugs: [
      'iyengars-bakery-vijayanagar',
      'the-pastry-inn-yelahanka',
      'glens-bakehouse-koramangala',
      'glens-bakehouse-rajajinagar',
      'meet-and-perk-up-hsr',
    ],
    relatedSeoPaths: [
      { label: 'Snacks & Bakeries in Bengaluru', path: '/snacks-and-bakeries-in-bengaluru' },
      { label: 'Cafes Under ₹100', path: '/cafes-under-100-in-bengaluru' },
      { label: 'Cafes in Rajajinagar', path: '/cafes-in-rajajinagar' },
    ],
    sections: [
      {
        heading: 'Neighbourhood bakeries vs Sit-down Bakehouses',
        paragraphs: [
          'Every Bengaluru neighbourhood relies on two beloved formats: old-school bakery counters like Iyengar’s Bakery in Vijayanagar or The Pastry Inn in Yelahanka (averaging ~₹100 for fresh puffs, dilpasand, and sponge cake), and sit-down evening bakehouses like Glen’s Bakehouse in Koramangala and Rajajinagar (puffs ₹53–₹68, donuts ₹83, croissants ₹96).',
        ],
      },
    ],
    faqs: [
      {
        question: 'When is the best time to visit Bengaluru bakery cafes for warm puffs?',
        answer:
          'Fresh batches typically come out around 9:30–11:00 AM for morning snacks and again between 4:30–6:30 PM for evening tea.',
      },
    ],
  },
  {
    slug: 'work-friendly-cafes-near-bengaluru-metro-stations',
    title: 'Work-Friendly Cafes Near Namma Metro Stations (Purple & Green Lines)',
    seoTitle: 'Work-Friendly Cafes Near Namma Metro Stations | Cafe Desk',
    metaDescription:
      'Skip Outer Ring Road traffic. Discover Wi-Fi work cafes and filter kaapi stops near Indiranagar, MG Road, Jayanagar, Whitefield & Rajajinagar Metro.',
    category: 'Commute & Metro',
    publishedDate: '2026-04-08',
    updatedDate: '2026-04-12',
    readTimeMinutes: 5,
    authorName: 'CafeDesk Editorial Team',
    coverImage: '/src/assets/images/hero_cafedesk_interior_1794976059561.jpg',
    coverAlt: 'Bright cafe interior near Bengaluru Metro with oak communal tables',
    summary:
      'Pair Namma Metro’s Purple and Green Lines with nearby Wi-Fi coffeehouses and budget stops to beat cross-city Bengaluru traffic.',
    featuredCafeSlugs: [
      'blue-tokai-mg-road',
      'third-wave-church-street',
      'paper-and-pie-indiranagar',
      'third-wave-jayanagar',
      'paper-and-pie-whitefield',
      'hatti-kaapi-mg-road',
    ],
    relatedSeoPaths: [
      { label: 'Cafes in MG Road & Church Street', path: '/cafes-in-mg-road' },
      { label: 'Cafes in Indiranagar', path: '/cafes-in-indiranagar' },
      { label: 'Cafes in Jayanagar', path: '/cafes-in-jayanagar' },
      { label: 'Cafes in Whitefield', path: '/cafes-in-whitefield' },
    ],
    sections: [
      {
        heading: 'Purple Line cafe stops (Whitefield -> Indiranagar -> MG Road -> Vijayanagar)',
        paragraphs: [
          'East-to-West commuters can step off at Kadugodi/Whitefield for Paper & Pie or Third Wave Coffee, stop at Indiranagar for Cafe Terra, Paper & Pie, or Chai Days, meet colleagues centrally at MG Road for Blue Tokai, Matteo Coffea, or Hatti Kaapi, and finish in West Bengaluru at Vijayanagar for quick bakery snacks.',
        ],
      },
      {
        heading: 'Green Line study stops (Malleshwaram -> Rajajinagar -> Jayanagar -> JP Nagar)',
        paragraphs: [
          'Along the Green Line, Mantri Square/Malleshwaram connects easily to Kalmane Koffees and Suto Cafe, Rajajinagar brings Glen’s Bakehouse and Coffee Grand within easy reach, and South Bengaluru stops at Lalbagh/Jayanagar/JP Nagar unlock calm daytime study tables.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Which Namma Metro station has the most work-friendly cafes nearby?',
        answer:
          'Indiranagar (Purple Line) and MG Road / Cubbon Park (Purple Line) offer the highest walkability to verified Wi-Fi work cafes.',
      },
    ],
  },
];

export function resolveGuideBySlug(slug: string): LocalGuideArticle | undefined {
  return LOCAL_GUIDES.find((g) => g.slug === slug);
}

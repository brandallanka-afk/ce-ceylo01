import type {LanguageCode} from '../types/commerce';

export const translations: Record<
  LanguageCode,
  {
    corporateName: string;
    announcement: string;
    nav: {
      ceyvana: string;
      ceylomira: string;
      handCrafts: string;
      about: string;
      contact: string;
      wholesale: string;
      portfolio: string;
      stories: string;
      privacy: string;
      terms: string;
      home: string;
      cart: string;
    };
    hero: {
      eyebrow: string;
      title: string;
      subtitle: string;
      ctaCeyvana: string;
      ctaCeylomira: string;
    };
    home: {
      housesHeading: string;
      housesSubheading: string;
      exploreStore: string;
      comingSoon: string;
      featuredHeading: string;
      featuredSubheading: string;
      provenanceHeading: string;
      provenanceBody: string;
      provenancePoints: string[];
      readAbout: string;
      wholesaleCta: string;
      storiesHeading: string;
      viewAllStories: string;
    };
    store: {
      searchPlaceholder: string;
      allCategories: string;
      sortFeatured: string;
      sortPriceLow: string;
      sortPriceHigh: string;
      showingCount: string;
      noProductsTitle: string;
      noProductsBody: string;
      clearFilters: string;
      previous: string;
      next: string;
      fromPrice: string;
      addToCart: string;
      viewProduct: string;
      inStock: string;
      lowStock: string;
      outOfStock: string;
    };
    pdp: {
      backToStore: string;
      packSize: string;
      quantity: string;
      addToCart: string;
      addedFeedback: string;
      whatsappEnquiry: string;
      skuLabel: string;
      weightLabel: string;
      originLabel: string;
      tastingNotesLabel: string;
      stockAvailable: string;
      shippingNotice: string;
    };
    cart: {
      title: string;
      emptyTitle: string;
      emptyBody: string;
      browseCeyvana: string;
      browseCeylomira: string;
      subtotal: string;
      shippingEstimate: string;
      shippingRegionLabel: string;
      regionLocal: string;
      regionInternational: string;
      freeDeliveryNote: string;
      demoNotice: string;
      whatsappOrder: string;
      viewFullCart: string;
      continueShopping: string;
      remove: string;
      totalWeight: string;
      estimatedTotal: string;
    };
    handCrafts: {
      eyebrow: string;
      title: string;
      body: string;
      pillars: {title: string; desc: string}[];
      notifyCta: string;
      backHome: string;
    };
    about: {
      eyebrow: string;
      title: string;
      lead: string;
      sections: {title: string; body: string}[];
      metrics: {value: string; label: string}[];
    };
    stories: {
      eyebrow: string;
      title: string;
      subtitle: string;
      readMore: string;
      closeArticle: string;
      minRead: string;
    };
    contact: {
      eyebrow: string;
      title: string;
      subtitle: string;
      whatsappCardTitle: string;
      whatsappCardBody: string;
      whatsappBtn: string;
      formTitle: string;
      inquiryType: string;
      typeWholesale: string;
      typeExport: string;
      typeGeneral: string;
      brandInterest: string;
      fullName: string;
      company: string;
      email: string;
      phone: string;
      country: string;
      message: string;
      submitBtn: string;
      successTitle: string;
      successBody: string;
    };
    footer: {
      tagline: string;
      brandsTitle: string;
      corporateTitle: string;
      connectTitle: string;
      whatsappLabel: string;
      emailLabel: string;
      locationLabel: string;
      phaseNotice: string;
      copyright: string;
    };
  }
> = {
  en: {
    corporateName: 'CEYLON HERITAGE',
    announcement: 'Single-origin Sri Lankan spices & highland tea · Islandwide & international enquiries',
    nav: {
      ceyvana: 'Ceyvana',
      ceylomira: 'Ceylomira',
      handCrafts: 'Hand Crafts',
      about: 'About',
      contact: 'Contact',
      wholesale: 'Wholesale',
      portfolio: 'Portfolios',
      stories: 'News & Stories',
      privacy: 'Privacy Policy',
      terms: 'Terms & Conditions',
      home: 'Home',
      cart: 'Cart',
    },
    hero: {
      eyebrow: 'A Legacy of Authentic Ceylon Excellence · Colombo · Matale · Nuwara Eliya',
      title: 'The Essence of Ceylon, Crafted by Origin.',
      subtitle:
        'Discover the authentic flavours and timeless heritage of Ceylon through our distinguished premium brands—Ceyvana pure island spices and Ceylomira high-grown estate teas.',
      ctaCeyvana: 'Shop Ceyvana Spices',
      ctaCeylomira: 'Shop Ceylomira Tea',
    },
    home: {
      housesHeading: 'Our Brand Houses',
      housesSubheading: 'Distinct Sri Lankan identities united under one commitment to origin purity.',
      exploreStore: 'Enter Store',
      comingSoon: 'Coming Soon',
      featuredHeading: 'Featured Harvests',
      featuredSubheading: 'Small-batch spices and single-region teas available in sealed retail packs.',
      provenanceHeading: 'Direct from Sri Lankan Gardens to Global Tables',
      provenanceBody:
        'Every Ceyvana spice and Ceylomira tea lot is traced to its harvest district, cold-milled or estate-packed to protect natural essential oils, and graded for domestic kitchens and international buyers.',
      provenancePoints: [
        '100% single-origin Sri Lankan harvests with zero artificial colorings or fillers.',
        'Configurable retail pack sizes alongside bulk export quotations.',
        'Direct WhatsApp support in English and Sinhala for local & overseas orders.',
      ],
      readAbout: 'Read Our Story',
      wholesaleCta: 'Wholesale & Export Enquiries',
      storiesHeading: 'Journal & Harvest Notes',
      viewAllStories: 'All Stories',
    },
    store: {
      searchPlaceholder: 'Search products, origins, or SKUs...',
      allCategories: 'All',
      sortFeatured: 'Featured',
      sortPriceLow: 'Price: Low to High',
      sortPriceHigh: 'Price: High to Low',
      showingCount: 'Showing {count} items',
      noProductsTitle: 'No matching harvests found',
      noProductsBody: 'Try clearing your search term or selecting another category.',
      clearFilters: 'Reset Filters',
      previous: 'Previous',
      next: 'Next',
      fromPrice: 'From',
      addToCart: 'Add to Cart',
      viewProduct: 'Select Size',
      inStock: 'In Stock',
      lowStock: 'Limited Batch',
      outOfStock: 'Out of Stock',
    },
    pdp: {
      backToStore: 'Back to Store',
      packSize: 'Pack Size',
      quantity: 'Quantity',
      addToCart: 'Add to Cart',
      addedFeedback: 'Added to Cart',
      whatsappEnquiry: 'Enquire via WhatsApp',
      skuLabel: 'Variant SKU',
      weightLabel: 'Net Weight',
      originLabel: 'Harvest Origin',
      tastingNotesLabel: 'Aroma & Profile',
      stockAvailable: '{count} packs ready',
      shippingNotice: 'Sealed barrier pouches for Sri Lankan delivery and international export.',
    },
    cart: {
      title: 'Shopping Cart',
      emptyTitle: 'Your shopping cart is empty',
      emptyBody: 'Explore Ceyvana Ceylon spices or Ceylomira highland teas to add packs to your cart.',
      browseCeyvana: 'Explore Ceyvana',
      browseCeylomira: 'Explore Ceylomira',
      subtotal: 'Subtotal',
      shippingEstimate: 'Estimated Shipping',
      shippingRegionLabel: 'Delivery Destination',
      regionLocal: 'Sri Lanka (Islandwide Courier)',
      regionInternational: 'International Air Express',
      freeDeliveryNote: 'Complimentary Sri Lanka delivery on orders over LKR 15,000.',
      demoNotice:
        'Cart items persist across sessions. All product prices, stock availability, and delivery totals are validated server-side at checkout.',
      whatsappOrder: 'Enquire via WhatsApp',
      viewFullCart: 'Proceed to Checkout',
      continueShopping: 'Continue Browsing',
      remove: 'Remove',
      totalWeight: 'Total Net Weight',
      estimatedTotal: 'Estimated Total',
    },
    handCrafts: {
      eyebrow: 'Future Brand House · Coming Soon',
      title: 'Ceylon Hand Crafts',
      body: 'We are collaborating with master artisans across Sri Lanka to prepare a dedicated home for traditional woodwork, brasswork, and handloom crafts. No products are listed yet while curation and quality standards are finalized.',
      pillars: [
        {
          title: 'Heritage Wood & Laksha',
          desc: 'Sustainably sourced timber turning and traditional lacquer craft from Matale and Kandy workshops.',
        },
        {
          title: 'Artisanal Brass & Clay',
          desc: 'Hand-cast brass lamps and rural earthenware crafted by generational Sri Lankan families.',
        },
        {
          title: 'Woven Handloom',
          desc: 'Natural-dyed cotton weaves honoring regional textile patterns and fair artisan compensation.',
        },
      ],
      notifyCta: 'Register Wholesale / Launch Interest',
      backHome: 'Return to Home',
    },
    about: {
      eyebrow: 'About Ceylon Heritage House',
      title: 'Stewards of Sri Lankan Spices, Tea, and Craft',
      lead: 'Founded to bring genuine single-origin Sri Lankan agricultural and artisanal goods to modern households and international trade buyers with complete transparency.',
      sections: [
        {
          title: '01. Ceyvana — Uncompromising Spice Purity',
          body: 'From Alba-grade cinnamon quills in Matara to cold-milled sun-dried chillies and slow-roasted curry blends, Ceyvana preserves volatile aromatic oils without artificial dyes, anti-caking agents, or imported substitutes.',
        },
        {
          title: '02. Ceylomira — High-Grown Tea Integrity',
          body: 'Ceylomira partners with mountain tea estates in Nuwara Eliya, Dimbula, and Uva. Every BOPF and infused blend is packed swiftly after firing to preserve briskness and bright amber clarity.',
        },
        {
          title: '03. Preparing Ceylon Hand Crafts',
          body: 'Our corporate architecture is engineered to welcome Sri Lankan artisanal crafts as a third independent house, supporting rural craftsmanship without compromising brand focus.',
        },
      ],
      metrics: [
        {value: '100%', label: 'Single-Origin Sri Lankan Crops'},
        {value: '2026', label: 'Unified Multi-Brand Platform'},
        {value: '200g–25kg', label: 'Retail & Export Pack Formats'},
        {value: 'EN / සිං', label: 'Bilingual Customer Support'},
      ],
    },
    stories: {
      eyebrow: 'News & Stories',
      title: 'Field Notes from the Island',
      subtitle: 'Harvest dispatches, roasting craft, and estate stories from our spice gardens and tea hills.',
      readMore: 'Read Story',
      closeArticle: 'Close Article',
      minRead: 'min read',
    },
    contact: {
      eyebrow: 'Contact & Wholesale',
      title: 'Retail Enquiries & Export Quotations',
      subtitle: 'Connect with our Colombo desk for retail orders, distributor partnerships, or custom export packaging.',
      whatsappCardTitle: 'Direct WhatsApp Desk',
      whatsappCardBody:
        'Prefer quick personal assistance in English or Sinhala? Message our sales desk directly on WhatsApp for retail orders and export rate cards.',
      whatsappBtn: 'Chat on WhatsApp',
      formTitle: 'Send an Enquiry',
      inquiryType: 'Enquiry Type',
      typeWholesale: 'Wholesale & Distributor',
      typeExport: 'International Export Quotation',
      typeGeneral: 'General / Retail Support',
      brandInterest: 'Brand of Interest',
      fullName: 'Full Name',
      company: 'Company / Store (Optional)',
      email: 'Email Address',
      phone: 'Phone / WhatsApp Number',
      country: 'Country',
      message: 'Message & Product Quantities',
      submitBtn: 'Submit Enquiry',
      successTitle: 'Enquiry Recorded (Phase 1 Preview)',
      successBody:
        'Thank you. Your enquiry details are validated. You can also send this request directly via WhatsApp for immediate response.',
    },
    footer: {
      tagline: 'Unified multi-brand corporate house for authentic Ceylon spices, highland tea, and future artisanal crafts.',
      brandsTitle: 'Brand Houses',
      corporateTitle: 'Corporate',
      connectTitle: 'Connect',
      whatsappLabel: 'WhatsApp Sales Desk',
      emailLabel: 'export@ceylonheritage.lk',
      locationLabel: 'Colombo, Sri Lanka',
      phaseNotice: 'Single-origin Ceylon Commerce Platform · Colombo, Sri Lanka.',
      copyright: '© 2026 Ceylon Heritage House. All rights reserved.',
    },
  },
  si: {
    corporateName: 'CEYLON HERITAGE',
    announcement: 'පිරිසිදු ලංකා කුළුබඩු සහ කඳුකර තේ · දිවයින පුරා සහ විදේශීය ඇණවුම් සඳහා',
    nav: {
      ceyvana: 'සෙයිවානා',
      ceylomira: 'සෙයිලෝමිරා',
      handCrafts: 'අත්කම්',
      about: 'අප ගැන',
      contact: 'සම්බන්ධ වන්න',
      wholesale: 'තොග ඇණවුම්',
      portfolio: 'නාමාවලි',
      stories: 'පුවත් සහ ලිපි',
      privacy: 'රහස්‍යතා ප්‍රතිපත්තිය',
      terms: 'කොන්දේසි',
      home: 'මුල් පිටුව',
      cart: 'කරත්තය',
    },
    hero: {
      eyebrow: 'සත්‍ය ලංකා විශිෂ්ටත්වයේ උරුමය · කොළඹ · මාතලේ · නුවරඑළිය',
      title: 'හෙළ දිවයිනේ අසමසම රසය සහ උරුමය.',
      subtitle:
        'ශ්‍රී ලංකාවේ ගොවිපළවල් සහ කඳුකර තේ වතු වලින් සෘජුවම ලබාගන්නා සෙයිවානා පිරිසිදු කුළුබඩු සහ සෙයිලෝමිරා උසස් තේ සන්නාම හරහා සැබෑ ලංකා උරුමය අත්විඳින්න.',
      ctaCeyvana: 'සෙයිවානා කුළුබඩු',
      ctaCeylomira: 'සෙයිලෝමිරා තේ',
    },
    home: {
      housesHeading: 'අපගේ සන්නාම',
      housesSubheading: 'පිරිසිදු දේශීය අනන්‍යතාවයෙන් යුත් එකම ආයතනික වහලක් යට.',
      exploreStore: 'වෙළඳසැලට පිවිසෙන්න',
      comingSoon: 'ළඟදීම',
      featuredHeading: 'විශේෂිත නිෂ්පාදන',
      featuredSubheading: 'නැවුම් බව සුරැකෙන ඇසුරුම් වලින් යුත් කුළුබඩු සහ තේ.',
      provenanceHeading: 'ශ්‍රී ලංකාවේ වතු යායේ සිට ඔබේ මේසයට',
      provenanceBody:
        'සෙයිවානා කුළුබඩු සහ සෙයිලෝමිරා තේ නිෂ්පාදන කෘතිම වර්ණක හෝ රසකාරක වලින් තොරව, ස්වභාවික සුවඳ සහ ගුණාත්මකභාවය ආරක්ෂා වන පරිදි සකසා ඇත.',
      provenancePoints: [
        '100% පිරිසිදු ශ්‍රී ලාංකික අස්වැන්න සහ කෘතිම ද්‍රව්‍ය වලින් තොර බව.',
        'ඔබේ අවශ්‍යතාවය අනුව විවිධ බර ප්‍රමාණ වලින් ඇසුරුම්.',
        'දේශීය සහ විදේශීය ඇණවුම් සඳහා සිංහල සහ ඉංග්‍රීසි WhatsApp සේවාව.',
      ],
      readAbout: 'අපගේ කතාව කියවන්න',
      wholesaleCta: 'තොග සහ අපනයන විමසීම්',
      storiesHeading: 'ලිපි සහ පුවත්',
      viewAllStories: 'සියලු ලිපි',
    },
    store: {
      searchPlaceholder: 'නිෂ්පාදන, ප්‍රදේශ හෝ SKU සොයන්න...',
      allCategories: 'සියල්ල',
      sortFeatured: 'විශේෂිත',
      sortPriceLow: 'මිල: අඩු සිට වැඩි',
      sortPriceHigh: 'මිල: වැඩි සිට අඩු',
      showingCount: 'නිෂ්පාදන {count} ක් පෙන්වයි',
      noProductsTitle: 'නිෂ්පාදන හමු නොවීය',
      noProductsBody: 'කරුණාකර වෙනත් වචනයක් හෝ කාණ්ඩයක් තෝරා උත්සාහ කරන්න.',
      clearFilters: 'පෙරහන් ඉවත් කරන්න',
      previous: 'පෙර',
      next: 'ඊළඟ',
      fromPrice: 'මිල',
      addToCart: 'කරත්තයට එක් කරන්න',
      viewProduct: 'ප්‍රමාණය තෝරන්න',
      inStock: 'තොග ඇත',
      lowStock: 'සීමිත තොග',
      outOfStock: 'තොග අවසන්',
    },
    pdp: {
      backToStore: 'වෙළඳසැල වෙත',
      packSize: 'ඇසුරුම් ප්‍රමාණය',
      quantity: 'ප්‍රමාණය',
      addToCart: 'කරත්තයට එක් කරන්න',
      addedFeedback: 'එක් කරන ලදී',
      whatsappEnquiry: 'WhatsApp මගින් විමසන්න',
      skuLabel: 'SKU කේතය',
      weightLabel: 'ශුද්ධ බර',
      originLabel: 'නිෂ්පාදිත ප්‍රදේශය',
      tastingNotesLabel: 'සුවඳ සහ රසය',
      stockAvailable: 'ඇසුරුම් {count} ක් ඇත',
      shippingNotice: 'දිවයින පුරා සහ විදේශීය බෙදාහැරීම් සඳහා සුරක්ෂිත ඇසුරුම්.',
    },
    cart: {
      title: 'සාප්පු කරත්තය',
      emptyTitle: 'ඔබේ සාප්පු කරත්තය හිස්ය',
      emptyBody: 'සෙයිවානා කුළුබඩු හෝ සෙයිලෝමිරා තේ තෝරා කරත්තයට එක් කරන්න.',
      browseCeyvana: 'සෙයිවානා බලන්න',
      browseCeylomira: 'සෙයිලෝමිරා බලන්න',
      subtotal: 'එකතුව',
      shippingEstimate: 'ඇස්තමේන්තුගත ප්‍රවාහන ගාස්තුව',
      shippingRegionLabel: 'බෙදාහරින කලාපය',
      regionLocal: 'ශ්‍රී ලංකාව තුළ (Courier)',
      regionInternational: 'විදේශීය ගුවන් තැපැල්',
      freeDeliveryNote: 'රු. 15,000 ට වැඩි දේශීය ඇණවුම් සඳහා ප්‍රවාහනය නොමිලේ.',
      demoNotice:
        'සාප්පු කරත්තයේ දත්ත සුරැකේ. මිල ගණන් සහ තොග ප්‍රමාණයන් ඇණවුම් කිරීමේදී සේවාදායකය මගින් සත්‍යාපනය කෙරේ.',
      whatsappOrder: 'WhatsApp මගින් විමසන්න',
      viewFullCart: 'ඇණවුම සම්පූර්ණ කරන්න',
      continueShopping: 'තවත් නිෂ්පාදන බලන්න',
      remove: 'ඉවත් කරන්න',
      totalWeight: 'මුළු බර',
      estimatedTotal: 'මුළු එකතුව',
    },
    handCrafts: {
      eyebrow: 'ඉදිරි සන්නාමය · ළඟදීම',
      title: 'ලංකා අත්කම් නිර්මාණ',
      body: 'ශ්‍රී ලංකාවේ දක්ෂ ශිල්පීන්ගේ සාම්ප්‍රදායික ලී කැටයම්, පිත්තල නිර්මාණ සහ අත්යන්ත්‍ර රෙදිපිළි එකතුවක් ළඟදීම හඳුන්වා දීමට නියමිතය.',
      pillars: [
        {
          title: 'සාම්ප්‍රදායික ලී සහ ලාක්ෂා',
          desc: 'මාතලේ සහ මහනුවර ශිල්පීන්ගේ සියුම් ලී කැටයම් සහ ලාක්ෂා කලාව.',
        },
        {
          title: 'පිත්තල සහ මැටි නිර්මාණ',
          desc: 'පාරම්පරික ශිල්පීන් අතින් නිමවන පිත්තල පහන් සහ කලාත්මක මැටි භාණ්ඩ.',
        },
        {
          title: 'අත්යන්ත්‍ර රෙදිපිළි',
          desc: 'ස්වභාවික වර්ණක යොදා වියන ලද දේශීය කපු රෙදිපිළි.',
        },
      ],
      notifyCta: 'තොග සහ ආරම්භක විමසීම්',
      backHome: 'මුල් පිටුවට',
    },
    about: {
      eyebrow: 'අපගේ ආයතනය ගැන',
      title: 'ශ්‍රී ලාංකික කුළුබඩු, තේ සහ අත්කම් උරුමය',
      lead: 'ශ්‍රී ලංකාවේ පිරිසිදු කෘෂිකාර්මික හා අත්කම් නිෂ්පාදන දේශීය හා ජාත්‍යන්තර පාරිභෝගිකයන් වෙත විශ්වාසනීයව ලබාදීම අපගේ අරමුණයි.',
      sections: [
        {
          title: '01. සෙයිවානා — පිරිසිදු කුළුබඩු',
          body: 'මාතර කුරුඳු වල සිට වියළි කලාපයේ මිරිස් සහ මාතලේ ගම්මිරිස් දක්වා සෑම කුළුබඩුවක්ම කෘතිම ද්‍රව්‍ය වලින් තොරව සැකසේ.',
        },
        {
          title: '02. සෙයිලෝමිරා — උසස් කඳුකර තේ',
          body: 'නුවරඑළිය, දිඹුල සහ ඌව වතු යායන්ගෙන් ලබාගන්නා තේ දළු නැවුම් බව සුරැකෙන පරිදි ඇසුරුම් කෙරේ.',
        },
        {
          title: '03. ලංකා අත්කම්',
          body: 'දේශීය කලා ශිල්පීන් බලගැන්වීම සඳහා නුදුරේදීම තුන්වන සන්නාමය ලෙස අත්කම් අංශය එක්වේ.',
        },
      ],
      metrics: [
        {value: '100%', label: 'පිරිසිදු දේශීය අස්වැන්න'},
        {value: '2026', label: 'ඒකාබද්ධ වෙළඳ වේදිකාව'},
        {value: '200g–25kg', label: 'සිල්ලර සහ අපනයන ඇසුරුම්'},
        {value: 'EN / සිං', label: 'ද්විභාෂා පාරිභෝගික සේවාව'},
      ],
    },
    stories: {
      eyebrow: 'පුවත් සහ ලිපි',
      title: 'වතු යායෙන් සහ මුළුතැන්ගෙයින්',
      subtitle: 'අස්වනු නෙළීම, තුනපහ සැකසීම සහ කඳුකර තේ වතු පිළිබඳ විශේෂ ලිපි.',
      readMore: 'ලිපිය කියවන්න',
      closeArticle: 'වසන්න',
      minRead: 'මිනිත්තු කියවීම',
    },
    contact: {
      eyebrow: 'සම්බන්ධ වන්න',
      title: 'සිල්ලර සහ අපනයන විමසීම්',
      subtitle: 'තොග ඇණවුම්, අපනයන මිල ගණන් හෝ සිල්ලර ඇණවුම් සඳහා අප හා සම්බන්ධ වන්න.',
      whatsappCardTitle: 'WhatsApp සේවාව',
      whatsappCardBody: 'සිංහලෙන් හෝ ඉංග්‍රීසියෙන් ඉක්මන් තොරතුරු ලබාගැනීමට අපගේ WhatsApp අංකයට පණිවිඩයක් යවන්න.',
      whatsappBtn: 'WhatsApp මගින් සම්බන්ධ වන්න',
      formTitle: 'පණිවිඩයක් යවන්න',
      inquiryType: 'විමසීම් වර්ගය',
      typeWholesale: 'තොග සහ බෙදාහැරීම්',
      typeExport: 'විදේශීය අපනයන මිල ගණන්',
      typeGeneral: 'සාමාන්‍ය විමසීම්',
      brandInterest: 'අදාළ සන්නාමය',
      fullName: 'සම්පූර්ණ නම',
      company: 'ආයතනය (අත්‍යවශ්‍ය නොවේ)',
      email: 'විද්‍යුත් තැපෑල',
      phone: 'දුරකථන / WhatsApp අංකය',
      country: 'රට',
      message: 'පණිවිඩය සහ අවශ්‍ය ප්‍රමාණයන්',
      submitBtn: 'විමසීම යවන්න',
      successTitle: 'විමසීම සටහන් විය',
      successBody: 'ස්තූතියි. ඉක්මන් ප්‍රතිචාරයක් සඳහා ඔබට WhatsApp හරහාද මෙය යොමු කළ හැක.',
    },
    footer: {
      tagline: 'ශ්‍රී ලංකාවේ පිරිසිදු කුළුබඩු, කඳුකර තේ සහ අත්කම් නිර්මාණ එකම ආයතනික නාමයක් යටතේ.',
      brandsTitle: 'සන්නාම',
      corporateTitle: 'ආයතනික',
      connectTitle: 'සම්බන්ධ වන්න',
      whatsappLabel: 'WhatsApp විකුණුම් අංශය',
      emailLabel: 'export@ceylonheritage.lk',
      locationLabel: 'කොළඹ, ශ්‍රී ලංකාව',
      phaseNotice: 'පිරිසිදු ශ්‍රී ලාංකික කුළුබඩු සහ තේ වේදිකාව · කොළඹ.',
      copyright: '© 2026 Ceylon Heritage House. සියලුම හිමිකම් ඇවිරිණි.',
    },
  },
};

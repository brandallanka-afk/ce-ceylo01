import type {LanguageCode} from '../types/commerce';
import type {FaqEntry} from '../utils/seo';

export function getHomeFaqs(lang: LanguageCode): FaqEntry[] {
  if (lang === 'si') {
    return [
      {
        question: 'සෙයිවානා (Ceyvana) සහ සෙයිලෝමිරා (Ceylomira) නිෂ්පාදන සෘජුවම ශ්‍රී ලංකාවෙන් ලබා ගන්නේද?',
        answer:
          'ඔව්. සියලුම සෙයිවානා කුළුබඩු මාතර, ගාල්ල, මාතලේ, මහනුවර, කුරුණෑගල, අනුරාධපුර සහ වව්නියාව ප්‍රදේශවලින්ද, සෙයිලෝමිරා තේ නුවරඑළිය, දිඹුල සහ හපුතලේ/ඌව වතුවලින්ද ලබාගෙන ශ්‍රී ලංකාවේදී ඇසුරුම් කෙරේ.',
      },
      {
        question: 'ඇණවුම් තහවුරු කිරීම සහ බැංකු හුවමාරු පරීක්ෂාව ක්‍රියාත්මක වන්නේ කෙසේද?',
        answer:
          'පිටවීමේදී (Checkout) සියලු මිල ගණන්, තොග සහ බෙදාහැරීමේ ගාස්තු සේවාදායකය හරහා පරීක්ෂා කෙරේ. බැංකු හුවමාරු ඇණවුම් අපගේ ගිණුම් අංශය මගින් ගෙවීම තහවුරු කරන තෙක් පරීක්ෂාව යටතේ තබා ගැනේ.',
      },
      {
        question: 'මට LKR සහ USD මුදල් ඒකක අතර මාරු විය හැකිද?',
        answer:
          'ඔව්. ශ්‍රී ලංකා රුපියල් (LKR) සහ ඇමරිකානු ඩොලර් (USD) මිල ගණන් ශීර්ෂයේ මුදල් තේරීම මගින් මාරු කළ හැකි අතර, ඇණවුම් වෙළඳපොළ අගයන් පරිපාලක විසින් වින්‍යාස කරනු ලැබේ.',
      },
      {
        question: 'හස්ත කර්මාන්ත (Hand Crafts) අංශය විවෘත වන්නේ කවදාද?',
        answer:
          'ශ්‍රී ලාංකේය ලී කැටයම්, පිත්තල සහ අත්යන්ත්‍ර රෙදිපිළි එක් කරන හස්ත කර්මාන්ත සන්නාමය දැනට සූදානම් වෙමින් පවතින අතර, ඉදිරියේදී වෙළඳපොළට හඳුන්වා දෙනු ලැබේ.',
      },
    ];
  }

  return [
    {
      question: 'Are Ceyvana spices and Ceylomira teas sourced directly in Sri Lanka?',
      answer:
        'Yes. Ceyvana harvests single-origin spices from Matara, Galle, Matale, Kandy, Kurunegala, Anuradhapura, and Vavuniya, while Ceylomira packs single-estate Ceylon teas from Nuwara Eliya, Dimbula, and Haputale (Uva).',
    },
    {
      question: 'How does order validation and Bank Transfer verification work?',
      answer:
        'At checkout, item prices, pack weights, stock quantities, and delivery rates are verified server-side. Orders placed via Bank Transfer remain in pending verification until our accounts desk confirms receipt of your reference or slip.',
    },
    {
      question: 'Does opening a WhatsApp order message automatically confirm my purchase?',
      answer:
        'No. WhatsApp provides a convenient summary handoff to our Colombo trade desk, while official confirmation is issued only after stock and payment verification.',
    },
    {
      question: 'Which currencies and languages are supported?',
      answer:
        'The platform supports English and Sinhala storefronts with bilingual product information, alongside administrator-configured Sri Lankan Rupee (LKR) and US Dollar (USD) checkout.',
    },
  ];
}

export function getCeyvanaFaqs(lang: LanguageCode): FaqEntry[] {
  if (lang === 'si') {
    return [
      {
        question: 'සෙයිලෝන් කුරුඳු (Cinnamomum verum) සහ කැසියා කුරුඳු අතර වෙනස කුමක්ද?',
        answer:
          'මාතර සහ ගාල්ල ප්‍රදේශවලින් ලබාගන්නා සත්‍ය සෙයිලෝන් කුරුඳු තුනී පොතු ස්ථර වලින් යුක්ත වන අතර මෘදු පැණි රසයක් සහ ඉතා අඩු කූමරින් (coumarin) මට්ටමක් ඇත.',
      },
      {
        question: 'සෙයිවානා කුළුබඩු නැවුම්ව තබා ගැනීමට ඇසුරුම් කරන්නේ කෙසේද?',
        answer:
          'සියලුම සෙයිවානා කුළුබඩු 50g සිට 500g දක්වා වාතය ඇතුළු නොවන බාධක ඇසුරුම්වල කුඩා කාණ්ඩ වශයෙන් මුද්‍රා තබා ඇත.',
      },
      {
        question: 'සම්පූර්ණ කුළුබඩු සහ කුඩු කළ මිශ්‍රණ දෙකම තිබේද?',
        answer:
          'ඔව්. සම්පූර්ණ Alba කුරුඳු, මාතලේ කළු ගම්මිරිස්, මහනුවර කරාබු නැටි සහ කරදමුංගු සමඟ අනුරාධපුර රතු මිරිස් සහ බැදපු තුනපහ මිශ්‍රණ ලබා ගත හැක.',
      },
      {
        question: 'කුළුබඩු ගබඩා කළ යුත්තේ කෙසේද?',
        answer:
          'සෘජු හිරු එළියෙන් සහ තෙතමනයෙන් ඈත්ව සිසිල් අඳුරු ස්ථානයක වාතය නොයන භාජනයක තබා ගැනීමෙන් ස්වාභාවික තෙල් සහ සුවඳ ආරක්ෂා වේ.',
      },
    ];
  }

  return [
    {
      question: 'What makes Ceylon Cinnamon (Cinnamomum verum) different from Cassia?',
      answer:
        'True Ceylon Cinnamon harvested in Matara and Galle is rolled from thin, papery inner bark layers with delicate citrus-sweet aroma and naturally minimal coumarin compared with thicker, harsher Cassia bark.',
    },
    {
      question: 'Which Sri Lankan growing regions supply Ceyvana spices?',
      answer:
        'Ceyvana sources Alba cinnamon and cloves from Matara, Galle, and Kandy; black peppercorns and green cardamom from Matale; turmeric and nutmeg from Kurunegala; and sun-dried chillies from Anuradhapura and Vavuniya.',
    },
    {
      question: 'How should I store whole spices and roasted spice blends?',
      answer:
        'Keep sealed pouches or jars in a cool, dry cupboard away from direct heat and steam. Reseal tightly after each use to preserve essential oils.',
    },
    {
      question: 'Can spice houses or restaurants enquire for bulk export sacks?',
      answer:
        'Yes. Select any product pack format or submit an International & Wholesale Enquiry with your required quantities and barrier-packaging preference.',
    },
  ];
}

export function getCeylomiraFaqs(lang: LanguageCode): FaqEntry[] {
  if (lang === 'si') {
    return [
      {
        question: 'උස්බිම් (High-Grown) සහ මධ්‍යම කඳුකර සෙයිලෝන් තේ අතර වෙනස කුමක්ද?',
        answer:
          'නුවරඑළිය සහ දිඹුල වැනි මීටර් 1,200ට ඉහළ උස්බිම් තේ දීප්තිමත් පැහැයක් සහ මල් සුවඳක් ගෙන දෙන අතර, ඌව සහ මහනුවර තේ වඩාත් ගැඹුරු ශක්තිමත් රසයක් ලබා දෙයි.',
      },
      {
        question: 'BOPF, OPA සහ Pekoe තේ ශ්‍රේණි වෙනස් වන්නේ කෙසේද?',
        answer:
          'BOPF යනු ඉක්මන් ශක්තිමත් කහට රසයක් ලබා දෙන කුඩා කොළ ශ්‍රේණියක් වන අතර, Pekoe සහ OPA යනු සුමට සුවඳවත් රසයක් සඳහා සුදුසු සම්පූර්ණ රෝල් කළ තේ දළු වේ.',
      },
      {
        question: 'සෙයිලෝමිරා කළු තේ සහ කොළ තේ සෑදීමට සුදුසු ජල උෂ්ණත්වය කුමක්ද?',
        answer:
          'කළු තේ සඳහා 95°C නැවුම් උතුරන ජලය විනාඩි 3–4ක් ද, හරිත තේ (Green Tea) සඳහා 80°C ජලය විනාඩි 2–3ක් ද තැම්බීම සුදුසුය.',
      },
      {
        question: 'තේ වල කෘත්‍රිම රසකාරක අඩංගු වේද?',
        answer:
          'නැත. සෙයිලෝමිරා තේ 100% පිරිසිදු ශ්‍රී ලාංකේය තේ දළු වලින් සමන්විත වන අතර සුදුසු විට ස්වාභාවික මසාලා කුළුබඩු හෝ ඉඟුරු පමණක් එක් කෙරේ.',
      },
    ];
  }

  return [
    {
      question: 'How do Nuwara Eliya, Dimbula, and Uva Ceylon tea estates differ in flavour?',
      answer:
        'Nuwara Eliya (above 1,800m) yields pale golden infusions with crisp floral notes; Dimbula offers balanced briskness suited to milk or lemon; Uva seasonal harvests develop distinctive aromatic spice and brisk depth.',
    },
    {
      question: 'What is the difference between BOPF, Pekoe, and OPA leaf grades?',
      answer:
        'BOPF (Broken Orange Pekoe Fannings) brews quickly for strong, full-bodied tea with milk. Pekoe (curled leaves) and OPA (long wiry whole leaves) infuse more gently for nuanced single-cup black tea.',
    },
    {
      question: 'How should Ceylomira black, green, and spiced teas be brewed?',
      answer:
        'Use freshly boiled water at 95–98°C for 3–4 minutes for Ceylon black teas and chai blends, and cooler 80°C water for 2–3 minutes for Highland Green Tea to prevent bitterness.',
    },
    {
      question: 'Are Ceylomira teas blended with tea from outside Sri Lanka?',
      answer:
        'No. Every Ceylomira blend is unblended single-origin Sri Lankan tea packed at source to protect estate character.',
    },
  ];
}

export function getWholesaleFaqs(lang: LanguageCode): FaqEntry[] {
  if (lang === 'si') {
    return [
      {
        question: 'අපනයන ඇණවුම් සඳහා අවම ඇණවුම් ප්‍රමාණය (MOQ) කොපමණද?',
        answer:
          'සාමාන්‍යයෙන් අපනයන SKU සඳහා අවම ඒකක 25 සිට ආරම්භ වේ. මිශ්‍ර අත්හදා බැලීමේ තොග ඇණවුම් විමසුම්ද සලකා බලනු ලැබේ.',
      },
      {
        question: 'විදේශීය නැව්ගත කිරීමේ කාලසීමාවන් සහ රේගු ගාස්තු පිළිබඳව කල්තියා පොරොන්දු දෙනවාද?',
        answer:
          'නැත. නිශ්චිත ගමනාන්ත රට, භාණ්ඩ බර සහ ගුවන්/නාවික කාලසටහන් පරීක්ෂා කිරීමෙන් පසුව නිල ලිඛිත මිල ගණනක් මගින් පමණක් ගාස්තු සහ කොන්දේසි දැනුම් දෙනු ලැබේ.',
      },
      {
        question: 'පුද්ගලික ලේබල් (Private Label) හෝ තොග ඇසුරුම් ලබා ගත හැකිද?',
        answer:
          'ඔව්. 1kg නයිට්‍රජන් මුද්‍රා තැබූ මලු, 5kg බහු-ස්ථර මලු සහ 25kg තොග අපනයන පෙට්ටි මෙන්ම සුදුසු MOQ යටතේ Private Label විකල්ප පවතී.',
      },
      {
        question: 'විමසුම් යොමු අංකයෙන් මගේ මිල ගණන් පරීක්ෂා කරන්නේ කෙසේද?',
        answer:
          'විමසුම යොමු කළ පසු ලැබෙන INT-xxxx යොමු අංකය සහ ව්‍යාපාරික විද්‍යුත් තැපෑල හෝ Tracking Token භාවිතයෙන් ටැබ් 3 හිදී පරිපාලක පිළිතුරු බැලිය හැක.',
      },
    ];
  }

  return [
    {
      question: 'What are the typical minimum order quantities (MOQs) for international buyers?',
      answer:
        'Configured export MOQs generally start at 25 units per SKU, with consolidated multi-SKU trial cartons considered for qualified importers, distributors, and specialty retailers.',
    },
    {
      question: 'Are international transit times or customs duties guaranteed online?',
      answer:
        'No. Final freight quotes, transit schedules, and any destination customs duties or import requirements are verified and communicated per destination through a written quotation.',
    },
    {
      question: 'How are export currencies calculated on this platform?',
      answer:
        'Currency values use administrator-configured exchange rates (LKR and USD) rather than unverified external conversion rates.',
    },
    {
      question: 'How can importers track submitted enquiries and country quotations?',
      answer:
        'Each submitted enquiry generates a unique INT reference and tracking token. Use the Track Enquiry tab with your reference and business email to view official trade desk responses.',
    },
  ];
}

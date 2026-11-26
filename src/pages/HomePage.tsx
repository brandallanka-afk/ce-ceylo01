import {useEffect} from 'react';
import {ArrowRight, FileText, Globe} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import CeyvanaBrandStatement from '../components/CeyvanaBrandStatement';
import FaqSection from '../components/FaqSection';
import ProductCard from '../components/ProductCard';
import SafeImage from '../components/SafeImage';
import {useStore} from '../context/StoreContext';
import {getHomeFaqs} from '../data/faqs';
import storiesData from '../data/stories.json';
import type {NewsStory} from '../types/commerce';
import {buildPagePath, updatePageSeo} from '../utils/seo';

const stories = storiesData as NewsStory[];

export default function HomePage() {
  const {
    lang,
    t,
    navigate,
    catalogBrands: brands,
    catalogProducts: products,
    availableLanguages,
  } = useStore();

  useEffect(() => {
    updatePageSeo({
      title:
        lang === 'si'
          ? 'සෙයිවානා සහ සෙයිලෝමිරා | ශ්‍රී ලංකාවේ පිරිසිදු කුළුබඩු සහ තේ'
          : 'Ceyvana & Ceylomira | Premium Ceylon Spices & Ceylon Tea from Sri Lanka',
      description:
        lang === 'si'
          ? 'මාතර, මාතලේ, නුවරඑළිය සහ දිඹුල ප්‍රදේශවලින් සෘජුවම ගෙන එන සෙයිවානා කුළුබඩු සහ සෙයිලෝමිරා උසස් තේ.'
          : 'Discover single-origin Ceyvana Ceylon Spices (Matara, Matale, Kandy) and Ceylomira high-grown Ceylon Tea (Nuwara Eliya, Dimbula, Uva) packed in Sri Lanka.',
      page: 'home',
      lang,
      availableLangCodes: availableLanguages.map((l) => l.code),
    });
  }, [lang, availableLanguages]);

  const ceyvanaBrand = brands.find((b) => b.id === 'ceyvana');
  const ceylomiraBrand = brands.find((b) => b.id === 'ceylomira');
  const handCraftsBrand = brands.find((b) => b.id === 'hand-crafts');
  const featuredProducts = products.filter((p) => p.featured && !p.isArchived).slice(0, 6);
  const leadStory = stories[0];
  const secondaryStories = stories.slice(1, 3);

  const openBrandPortfolio = (brandHash: 'ceyvana' | 'ceylomira') => {
    window.history.replaceState(null, '', `#${brandHash}`);
    navigate('portfolio');
    window.location.hash = brandHash;
  };

  const signatureCollections = [
    {
      index: '01',
      house: 'CEYVANA',
      target: 'ceyvana' as const,
      title: lang === 'si' ? 'Alba කුරුඳු සහ සම්පූර්ණ කුළුබඩු' : 'Alba Quills & Whole Spices',
      note:
        lang === 'si'
          ? 'මාතර කුරුඳු සහ මාතලේ කළු ගම්මිරිස් ඇට.'
          : 'Southern Alba cinnamon quills, Matale peppercorns, and heirloom turmeric.',
      image: '/src/assets/images/product_cinnamon_pepper_1795545291338.jpg',
    },
    {
      index: '02',
      house: 'CEYVANA',
      target: 'ceyvana' as const,
      title: lang === 'si' ? 'බැදපු සහ අමු තුනපහ මිශ්‍රණ' : 'Heritage Curry & Chilli Blends',
      note:
        lang === 'si'
          ? 'කුඩා ප්‍රමාණ වලින් බැද අඹරන ලද තුනපහ සහ රතු මිරිස්.'
          : 'Small-batch dark roasted curry spices and cold-milled sun-cured red chillies.',
      image: '/src/assets/images/product_curry_blends_1795545291347.jpg',
    },
    {
      index: '03',
      house: 'CEYLOMIRA',
      target: 'ceylomira' as const,
      title: lang === 'si' ? 'කඳුකර කළු තේ සහ පිකෝ' : 'Highland Estate Black & Pekoe Teas',
      note:
        lang === 'si'
          ? 'නුවරඑළිය සහ ඌව වතු යායන්හි උසස් තේ දළු.'
          : 'Crisp Nuwara Eliya BOPF black teas and seasonal Uva whole-leaf Pekoe.',
      image: '/src/assets/images/brand_ceylomira_tea_1795545290271.jpg',
    },
  ];

  return (
    <div className="bg-[#151312] text-[#F3EBDD]">
      {/* 1. Corporate Hero: Royal Charcoal #151312, Warm Ivory #F3EBDD, Antique Gold #C6A46A */}
      <section className="relative bg-[#151312] text-[#F3EBDD] border-b border-[#C6A46A]/25 overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-6 px-6 sm:px-10 lg:px-12 py-14 sm:py-20 lg:py-28 flex flex-col justify-center space-y-6 relative z-10">
            <div className="space-y-3">
              <div className="w-12 h-px bg-[#C6A46A]" aria-hidden="true" />
              <p className="text-[11px] tracking-[0.22em] text-[#C6A46A] uppercase font-medium">
                {t.hero.eyebrow}
              </p>
            </div>

            <h1 className="font-display text-[2.45rem] sm:text-[3.4rem] lg:text-[4.15rem] font-medium leading-[1.03] tracking-[-0.015em] text-balance text-[#F3EBDD]">
              {t.hero.title}
            </h1>

            <p className="text-sm sm:text-base text-[#D2C6B5] max-w-lg leading-relaxed">
              {t.hero.subtitle}
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                type="button"
                onClick={() => navigate('ceyvana')}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 text-xs sm:text-sm font-medium tracking-[0.06em] bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[44px]"
              >
                <span>{t.hero.ctaCeyvana}</span>
                <ArrowRight className="w-4 h-4 text-[#151312]" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => navigate('ceylomira')}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-xs sm:text-sm font-medium tracking-[0.06em] border border-[#C6A46A]/60 text-[#F3EBDD] bg-transparent rounded hover:border-[#C6A46A] hover:bg-[#C6A46A]/10 transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[44px]"
              >
                <span>{t.hero.ctaCeylomira}</span>
              </button>
            </div>

            <div className="pt-3 flex flex-wrap items-center gap-5">
              <button
                type="button"
                onClick={() => navigate('ceyvana')}
                aria-label={t.nav.ceyvana}
                className="cursor-pointer rounded focus-visible:outline-none"
              >
                <BrandLogo brandId="ceyvana" size="sm" eager />
              </button>
              <span className="h-8 w-px bg-[#C6A46A]/35" aria-hidden="true" />
              <button
                type="button"
                onClick={() => navigate('ceylomira')}
                aria-label={t.nav.ceylomira}
                className="cursor-pointer rounded focus-visible:outline-none"
              >
                <BrandLogo brandId="ceylomira" size="sm" eager />
              </button>
            </div>

            <div className="pt-4 border-t border-[#C6A46A]/20 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#A99B88]">
              <a
                href={buildPagePath('portfolio', {lang})}
                onClick={(e) => {
                  e.preventDefault();
                  navigate('portfolio');
                }}
                className="text-[#D2C6B5] hover:text-[#C6A46A] transition-colors duration-150 underline underline-offset-4 decoration-[#C6A46A]/50"
              >
                {lang === 'si' ? 'නිල PDF නාමාවලි' : 'Official Product Portfolios (PDF)'}
              </a>
              <span className="text-[#C6A46A]/45" aria-hidden="true">
                ·
              </span>
              <a
                href={buildPagePath('wholesale', {lang})}
                onClick={(e) => {
                  e.preventDefault();
                  navigate('wholesale');
                }}
                className="text-[#D2C6B5] hover:text-[#C6A46A] transition-colors duration-150 underline underline-offset-4 decoration-[#C6A46A]/50"
              >
                {t.home.wholesaleCta}
              </a>
            </div>
          </div>

          <div className="lg:col-span-6 relative min-h-[290px] sm:min-h-[400px] lg:min-h-[600px]">
            <SafeImage
              src="/src/assets/images/hero_royal_ceylon_luxury_1795705254348.jpg"
              alt={
                lang === 'si'
                  ? 'සත්‍ය සෙයිලෝන් කුරුඳු, කළු ගම්මිරිස්, මිරිස් සහ උසස් තේ එකතුව'
                  : 'Authentic Ceylon Alba cinnamon quills, black peppercorns, dried chillies, and amber Ceylon tea'
              }
              eager
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="w-full h-full object-cover"
              aspectClass="w-full h-full"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#151312] via-transparent to-[#151312]/45 lg:bg-gradient-to-r lg:from-[#151312] lg:via-[#151312]/30 lg:to-transparent"
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      {/* 2. Bespoke Independent Brand House Showcases on Deep Onyx (#211C1A) */}
      <section className="bg-[#211C1A] border-b border-[#C6A46A]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#C6A46A]/25">
            <div className="space-y-2">
              <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-[#C6A46A]">
                01 · {lang === 'si' ? 'ශ්‍රී ලාංකේය සන්නාම' : 'Our Heritage Houses'}
              </p>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.85rem] font-medium text-[#F3EBDD] leading-tight">
                {t.home.housesHeading}
              </h2>
            </div>
            <p className="text-sm text-[#D2C6B5] max-w-md leading-relaxed">
              {t.home.housesSubheading}
            </p>
          </div>

          {/* Brand 01: CEYVANA — Dark Chocolate (#30211D), Deep Burgundy (#501C2B), Antique Gold (#C6A46A) */}
          {ceyvanaBrand && (
            <article className="bg-[#30211D] text-[#F3EBDD] border border-[#C6A46A]/35 rounded-md overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch luxury-card-shadow">
              <div className="lg:col-span-7 relative min-h-[300px] sm:min-h-[380px] lg:min-h-[470px] bg-[#151312]">
                <SafeImage
                  src="/src/assets/images/showcase_ceyvana_editorial_1795705254796.jpg"
                  alt={`${ceyvanaBrand.name[lang]} — ${ceyvanaBrand.tagline[lang]}`}
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  className="w-full h-full object-cover"
                  aspectClass="w-full h-full"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#30211D]/65 via-transparent to-transparent lg:bg-gradient-to-l lg:from-[#30211D]/75 lg:via-transparent lg:to-transparent"
                  aria-hidden="true"
                />
              </div>

              <div className="lg:col-span-5 p-7 sm:p-10 lg:p-11 flex flex-col justify-between gap-7 bg-gradient-to-b from-[#30211D] to-[#501C2B]/85">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular tracking-[0.16em] uppercase">
                    <span className="text-[#C6A46A]">{ceyvanaBrand.tagline[lang]}</span>
                    <span className="text-[#A99B88]">Matara · Matale</span>
                  </div>
                  <div className="luxury-rule" aria-hidden="true" />
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <BrandLogo brandId="ceyvana" size="lg" />
                  </div>
                  <h3 className="font-display text-3xl sm:text-4xl font-medium tracking-wide text-[#F3EBDD]">
                    {ceyvanaBrand.name[lang]}
                  </h3>
                  <CeyvanaBrandStatement variant="showcase" className="pt-0.5" />
                  <p className="text-sm sm:text-base text-[#D2C6B5] leading-relaxed">
                    {ceyvanaBrand.description[lang]}
                  </p>

                  {/* Retail kraft pouch packaging preview framed on dark */}
                  <div className="pt-3 flex items-center gap-4 border-t border-[#C6A46A]/20">
                    <div className="w-20 aspect-[4/3] rounded overflow-hidden border border-[#C6A46A]/45 bg-[#151312] shrink-0">
                      <SafeImage
                        src="/src/assets/images/product_cinnamon_pepper_1795545291338.jpg"
                        alt={
                          lang === 'si'
                            ? 'සෙයිවානා මුල් කුළුබඩු ඇසුරුම'
                            : 'Authentic Ceyvana retail kraft pouch packaging with Ceylon cinnamon and peppercorns'
                        }
                        sizes="96px"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs font-mono-tabular text-[#A99B88] leading-relaxed">
                      {lang === 'si'
                        ? 'නැවුම් බව සුරැකෙන මුද්‍රා තැබූ සිල්ලර සහ අපනයන ඇසුරුම්.'
                        : 'Alba Cinnamon · Sun-Cured Chilli · Sealed kraft barrier pouches.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[#C6A46A]/25">
                  <a
                    href={buildPagePath('ceyvana', {lang})}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('ceyvana');
                    }}
                    className="inline-flex items-center gap-2 px-5 py-3 text-xs font-medium tracking-[0.08em] bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] transition-colors duration-150 min-h-[44px]"
                  >
                    <span>{t.home.exploreStore}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#151312]" aria-hidden="true" />
                  </a>
                  <button
                    type="button"
                    onClick={() => openBrandPortfolio('ceyvana')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C6A46A] hover:text-[#F3EBDD] transition-colors duration-150 cursor-pointer min-h-[44px]"
                  >
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{lang === 'si' ? 'PDF නාමාවලිය' : 'Portfolio PDF'}</span>
                  </button>
                </div>
              </div>
            </article>
          )}

          {/* Brand 02: CEYLOMIRA — Deep Emerald (#123D32), Forest Green (#1C493C), Antique Gold (#C6A46A) */}
          {ceylomiraBrand && (
            <article className="bg-[#123D32] text-[#F3EBDD] border border-[#C6A46A]/35 rounded-md overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch luxury-card-shadow">
              <div className="order-2 lg:order-1 lg:col-span-5 p-7 sm:p-10 lg:p-11 flex flex-col justify-between gap-7 bg-gradient-to-b from-[#123D32] to-[#1C493C]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular tracking-[0.16em] uppercase">
                    <span className="text-[#C6A46A]">{ceylomiraBrand.tagline[lang]}</span>
                    <span className="text-[#A99B88]">1,500m+ Estates</span>
                  </div>
                  <div
                    className="h-px bg-gradient-to-r from-[#C6A46A]/70 via-[#C6A46A]/25 to-transparent"
                    aria-hidden="true"
                  />
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <BrandLogo brandId="ceylomira" size="lg" />
                  </div>
                  <h3 className="font-display text-3xl sm:text-4xl font-medium tracking-wide text-[#F3EBDD]">
                    {ceylomiraBrand.name[lang]}
                  </h3>
                  <p className="text-sm sm:text-base text-[#D2C6B5] leading-relaxed">
                    {ceylomiraBrand.description[lang]}
                  </p>

                  <div className="pt-3 border-t border-[#C6A46A]/25 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-[#A99B88]">
                        {lang === 'si' ? 'වගා කලාප' : 'Estates'}
                      </span>
                      <span className="font-medium text-[#F3EBDD]">Nuwara Eliya · Uva</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-[#A99B88]">
                        {lang === 'si' ? 'ශ්‍රේණි' : 'Grades'}
                      </span>
                      <span className="font-medium text-[#F3EBDD]">BOPF · Pekoe · Ginger</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[#C6A46A]/25">
                  <a
                    href={buildPagePath('ceylomira', {lang})}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('ceylomira');
                    }}
                    className="inline-flex items-center gap-2 px-5 py-3 text-xs font-medium tracking-[0.08em] bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] transition-colors duration-150 min-h-[44px]"
                  >
                    <span>{t.home.exploreStore}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#151312]" aria-hidden="true" />
                  </a>
                  <button
                    type="button"
                    onClick={() => openBrandPortfolio('ceylomira')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C6A46A] hover:text-[#F3EBDD] transition-colors duration-150 cursor-pointer min-h-[44px]"
                  >
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{lang === 'si' ? 'PDF නාමාවලිය' : 'Portfolio PDF'}</span>
                  </button>
                </div>
              </div>

              <div className="order-1 lg:order-2 lg:col-span-7 relative min-h-[300px] sm:min-h-[380px] lg:min-h-[470px] bg-[#151312]">
                <SafeImage
                  src="/src/assets/images/showcase_ceylomira_editorial_1795705255087.jpg"
                  alt={`${ceylomiraBrand.name[lang]} — ${ceylomiraBrand.tagline[lang]}`}
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  className="w-full h-full object-cover"
                  aspectClass="w-full h-full"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#123D32]/55 via-transparent to-transparent lg:bg-gradient-to-r lg:from-[#123D32]/60 lg:via-transparent lg:to-transparent"
                  aria-hidden="true"
                />
              </div>
            </article>
          )}

          {/* Brand 03: CEYLON HAND CRAFTS — Dark Natural Wood (#2A2522 / #4E3424 accent) & Antique Gold */}
          {handCraftsBrand && (
            <div className="bg-[#2A2522] border border-[#C6A46A]/30 rounded-md p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 luxury-card-shadow">
              <div className="space-y-1.5 max-w-2xl">
                <p className="text-[11px] font-medium tracking-[0.18em] uppercase text-[#C6A46A]">
                  {handCraftsBrand.tagline[lang]}
                </p>
                <h3 className="font-display text-2xl sm:text-3xl font-medium text-[#F3EBDD]">
                  {handCraftsBrand.name[lang]}
                </h3>
                <p className="text-sm text-[#D2C6B5] leading-relaxed">
                  {handCraftsBrand.description[lang]}
                </p>
              </div>
              <div className="shrink-0">
                <a
                  href={buildPagePath('hand-crafts', {lang})}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('hand-crafts');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-3 text-xs font-medium tracking-[0.06em] border border-[#C6A46A]/55 bg-transparent text-[#F3EBDD] rounded hover:border-[#C6A46A] hover:bg-[#C6A46A]/10 transition-colors duration-150 whitespace-nowrap min-h-[44px]"
                >
                  <span>{t.home.comingSoon}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#C6A46A]" aria-hidden="true" />
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. Signature Collections Index on Royal Charcoal (#151312) */}
      <section className="bg-[#151312] text-[#F3EBDD] border-b border-[#C6A46A]/20 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#C6A46A]/20 pb-5">
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-[#C6A46A]">
                02 · {lang === 'si' ? 'විශේෂිත එකතු' : 'Signature Collections'}
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-medium text-[#F3EBDD]">
                {lang === 'si' ? 'සම්ප්‍රදායික අස්වැන්න කාණ්ඩ' : 'Curated Harvest Categories'}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#D2C6B5] max-w-md">
              {lang === 'si'
                ? 'සිල්ලර හා අපනයන ප්‍රමිතියෙන් ඇසුරුම් කළ සුවිශේෂී කුළුබඩු සහ තේ කාණ්ඩ.'
                : 'Single-district spices, stone-milled curry blends, and high-grown teas prepared for kitchen and trade.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {signatureCollections.map((col) => (
              <button
                key={col.index}
                type="button"
                onClick={() => navigate(col.target)}
                className="group text-left bg-[#211C1A] border border-[#C6A46A]/25 hover:border-[#C6A46A]/70 rounded-md overflow-hidden grid grid-cols-12 items-stretch transition-colors duration-150 cursor-pointer luxury-card-shadow"
              >
                <div className="col-span-5 bg-[#1C1917] overflow-hidden min-h-[140px]">
                  <SafeImage
                    src={col.image}
                    alt={col.title}
                    sizes="(max-width: 1024px) 40vw, 15vw"
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
                    aspectClass="w-full h-full"
                  />
                </div>
                <div className="col-span-7 p-5 flex flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-mono-tabular tracking-[0.18em] uppercase text-[#C6A46A]">
                        {col.index} · {col.house}
                      </p>
                      <BrandLogo brandId={col.target} size="2xs" sheen={false} animated={false} />
                    </div>
                    <h3 className="font-display text-xl font-medium text-[#F3EBDD] leading-snug group-hover:text-[#C6A46A] transition-colors">
                      {col.title}
                    </h3>
                    <p className="text-xs text-[#D2C6B5] line-clamp-2 leading-relaxed">
                      {col.note}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase text-[#C6A46A]">
                    <span>{t.home.exploreStore}</span>
                    <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Product Highlights on Product Section Surface (#1C1917) */}
      <section className="bg-[#1C1917] border-b border-[#C6A46A]/20 py-16 sm:py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 pb-5 border-b border-[#C6A46A]/20">
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-[#C6A46A]">
                03 · {lang === 'si' ? 'නිෂ්පාදන එකතුව' : 'Product Highlights'}
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-medium text-[#F3EBDD]">
                {t.home.featuredHeading}
              </h2>
              <p className="text-sm text-[#D2C6B5] max-w-2xl">{t.home.featuredSubheading}</p>
            </div>

            <div className="flex items-center gap-4 text-xs tracking-wider uppercase font-medium">
              <button
                type="button"
                onClick={() => navigate('ceyvana')}
                className="text-[#C6A46A] hover:underline underline-offset-4 cursor-pointer whitespace-nowrap min-h-[44px]"
              >
                {t.nav.ceyvana}
              </button>
              <span className="text-[#C6A46A]/45" aria-hidden="true">
                /
              </span>
              <button
                type="button"
                onClick={() => navigate('ceylomira')}
                className="text-[#C6A46A] hover:underline underline-offset-4 cursor-pointer whitespace-nowrap min-h-[44px]"
              >
                {t.nav.ceylomira}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* 5. Craftsmanship, Origin & Our Story on Premium Feature Section (#25201D) */}
      <section className="bg-[#25201D] border-b border-[#C6A46A]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28 space-y-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-stretch">
            <div className="lg:col-span-6 rounded-md overflow-hidden bg-[#151312] border border-[#C6A46A]/30 min-h-[280px] lg:min-h-[440px] luxury-card-shadow">
              <SafeImage
                src="/src/assets/images/story_ceylon_highlands_1795545292272.jpg"
                alt={
                  lang === 'si'
                    ? 'උදෑසන මීදුමෙන් වැසුණු ශ්‍රී ලංකාවේ කඳුකර තේ සහ කුළුබඩු වතු'
                    : 'Misty Sri Lankan highland tea gardens and spice estates at sunrise'
                }
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="w-full h-full object-cover"
                aspectClass="w-full h-full"
              />
            </div>

            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div className="space-y-2">
                <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-[#C6A46A]">
                  04 · {lang === 'si' ? 'උපත සහ කලාව' : 'Craftsmanship & Origin'}
                </p>
                <h2 className="font-display text-3xl sm:text-4xl font-medium text-[#F3EBDD] text-balance leading-tight">
                  {t.home.provenanceHeading}
                </h2>
              </div>

              <p className="text-sm sm:text-base text-[#D2C6B5] leading-relaxed">
                {t.home.provenanceBody}
              </p>

              <ol className="divide-y divide-[#C6A46A]/20 border-y border-[#C6A46A]/20">
                {t.home.provenancePoints.map((point, idx) => (
                  <li key={point} className="py-3.5 flex items-baseline gap-4 text-sm text-[#F3EBDD]">
                    <span className="font-mono-tabular text-xs font-medium text-[#C6A46A] shrink-0">
                      0{idx + 1}
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ol>

              <div className="pt-2 flex flex-wrap gap-3.5">
                <button
                  type="button"
                  onClick={() => navigate('about')}
                  className="inline-flex items-center gap-2 px-5 py-3 text-xs font-medium tracking-[0.06em] border border-[#C6A46A]/55 text-[#F3EBDD] rounded hover:border-[#C6A46A] hover:bg-[#C6A46A]/10 transition-colors duration-150 cursor-pointer min-h-[44px]"
                >
                  <span>{t.home.readAbout}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#C6A46A]" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('wholesale')}
                  className="inline-flex items-center gap-2 px-5 py-3 text-xs font-medium tracking-[0.06em] bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] transition-colors duration-150 cursor-pointer min-h-[44px]"
                >
                  <span>{t.home.wholesaleCta}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Our Story & Journal Asymmetric Editorial Layout */}
          {leadStory && (
            <div className="pt-14 border-t border-[#C6A46A]/25 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-[#C6A46A]">
                    05 · {lang === 'si' ? 'අපේ කතාව සහ සටහන්' : 'Our Story & Field Notes'}
                  </p>
                  <h2 className="font-display text-3xl sm:text-4xl font-medium text-[#F3EBDD]">
                    {t.home.storiesHeading}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('stories')}
                  className="self-start sm:self-auto text-xs font-medium tracking-wider uppercase text-[#C6A46A] hover:text-[#F3EBDD] underline underline-offset-4 decoration-[#C6A46A]/60 cursor-pointer whitespace-nowrap min-h-[44px]"
                >
                  {t.home.viewAllStories}
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <article className="lg:col-span-6 bg-[#211C1A] border border-[#C6A46A]/22 rounded-md overflow-hidden flex flex-col luxury-card-shadow">
                  <div className="aspect-[16/10] bg-[#151312] overflow-hidden">
                    <SafeImage
                      src={leadStory.image}
                      alt={leadStory.title[lang] || leadStory.title.en}
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="w-full h-full object-cover"
                      aspectClass="w-full h-full"
                    />
                  </div>
                  <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-2.5">
                      <p className="text-[11px] font-mono-tabular tracking-wider uppercase text-[#A99B88]">
                        <span className="text-[#C6A46A]">{leadStory.brandTag[lang]}</span> · {leadStory.publishedAt}
                      </p>
                      <h3 className="font-display text-2xl sm:text-3xl font-medium text-[#F3EBDD] leading-snug">
                        {leadStory.title[lang]}
                      </h3>
                      <p className="text-sm text-[#D2C6B5] leading-relaxed line-clamp-3">
                        {leadStory.excerpt[lang]}
                      </p>
                    </div>
                    <a
                      href={buildPagePath('stories', {lang})}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('stories');
                      }}
                      className="self-start inline-flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase text-[#C6A46A] hover:text-[#F3EBDD] hover:underline underline-offset-4"
                    >
                      <span>{t.stories.readMore}</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </article>

                <div className="lg:col-span-6 flex flex-col justify-between gap-6">
                  {secondaryStories.map((story) => (
                    <article
                      key={story.id}
                      className="flex-1 bg-[#211C1A] border border-[#C6A46A]/22 rounded-md overflow-hidden grid grid-cols-1 sm:grid-cols-12 items-stretch luxury-card-shadow"
                    >
                      <div className="sm:col-span-5 aspect-[4/3] sm:aspect-auto bg-[#151312] overflow-hidden">
                        <SafeImage
                          src={story.image}
                          alt={story.title[lang] || story.title.en}
                          sizes="(max-width: 640px) 100vw, 22vw"
                          className="w-full h-full object-cover"
                          aspectClass="w-full h-full"
                        />
                      </div>
                      <div className="sm:col-span-7 p-5 sm:p-6 flex flex-col justify-between gap-3">
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-mono-tabular tracking-wider uppercase text-[#A99B88]">
                            <span className="text-[#C6A46A]">{story.brandTag[lang]}</span> · {story.publishedAt}
                          </p>
                          <h3 className="font-display text-xl font-medium text-[#F3EBDD] leading-snug">
                            {story.title[lang]}
                          </h3>
                          <p className="text-xs text-[#D2C6B5] line-clamp-2 leading-relaxed">
                            {story.excerpt[lang]}
                          </p>
                        </div>
                        <a
                          href={buildPagePath('stories', {lang})}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate('stories');
                          }}
                          className="self-start text-xs font-medium tracking-wider uppercase text-[#C6A46A] hover:text-[#F3EBDD] hover:underline underline-offset-4"
                        >
                          {t.stories.readMore}
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 6. International Wholesale & Official Catalogue Request Split Band on Royal Charcoal (#151312) */}
      <section className="bg-[#151312] text-[#F3EBDD] py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 bg-[#211C1A] border border-[#C6A46A]/25 rounded-md p-7 sm:p-9 flex flex-col justify-between gap-6 luxury-card-shadow">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.2em] uppercase text-[#C6A46A]">
                <Globe className="w-4 h-4" aria-hidden="true" />
                <span>
                  {lang === 'si' ? 'ජාත්‍යන්තර තොග සහ අපනයන' : 'International Wholesale & Export'}
                </span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-medium text-[#F3EBDD]">
                {lang === 'si'
                  ? 'ආනයනකරුවන් සහ බෙදාහරින්නන් සඳහා අපනයන මිල ගණන්'
                  : 'Global Importer & Distributor Quotations'}
              </h2>
              <p className="text-sm text-[#D2C6B5] leading-relaxed">
                {lang === 'si'
                  ? 'බහු රටවල් සඳහා අපනයන පිරිවිතර, MOQ සහ නාවික මිල ගණන් ඉල්ලුම් කරන්න.'
                  : 'Submit destination requirements, download country export specification sheets, and track written wholesale quotations.'}
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => navigate('wholesale')}
                className="inline-flex items-center gap-2 px-5 py-3 text-xs font-medium tracking-[0.06em] border border-[#C6A46A]/55 text-[#F3EBDD] rounded hover:border-[#C6A46A] hover:bg-[#C6A46A]/10 transition-colors duration-150 cursor-pointer min-h-[44px]"
              >
                <span>{t.home.wholesaleCta}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#C6A46A]" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 bg-[#2A2522] border border-[#C6A46A]/35 rounded-md p-7 sm:p-9 flex flex-col justify-between gap-6 luxury-card-shadow">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.2em] uppercase text-[#C6A46A]">
                <FileText className="w-4 h-4" aria-hidden="true" />
                <span>
                  {lang === 'si' ? 'නිල නාමාවලි ඉල්ලීම' : 'Official Catalogue Request (PDF)'}
                </span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-medium text-[#F3EBDD]">
                {lang === 'si'
                  ? 'සෙයිවානා සහ සෙයිලෝමිරා PDF නිෂ්පාදන නාමාවලි'
                  : 'Preview Brand Portfolios or Request Trade Dossiers'}
              </h2>
              <p className="text-sm text-[#D2C6B5] leading-relaxed">
                {lang === 'si'
                  ? 'ඉංග්‍රීසි සහ සිංහල භාෂාවලින් වෙන් වෙන් සන්නාම නාමාවලි පරීක්ෂා කරන්න හෝ ඉල්ලුම් කරන්න.'
                  : 'Access controlled English & Sinhala Product Portfolio PDFs separately for Ceyvana and Ceylomira or submit a custom dossier request.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('portfolio')}
                className="inline-flex items-center gap-2 px-5 py-3 text-xs font-medium tracking-[0.06em] bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] transition-colors duration-150 cursor-pointer min-h-[44px]"
              >
                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{lang === 'si' ? 'PDF නාමාවලි බලන්න' : 'Open Product Portfolios'}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('contact')}
                className="inline-flex items-center gap-2 px-5 py-3 text-xs font-medium tracking-[0.06em] text-[#C6A46A] hover:text-[#F3EBDD] transition-colors duration-150 cursor-pointer min-h-[44px]"
              >
                <span>{t.nav.contact}</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <FaqSection
        title={lang === 'si' ? 'නිතර අසන පැණ' : 'Frequently Asked Questions'}
        subtitle={
          lang === 'si'
            ? 'සෙයිවානා කුළුබඩු, සෙයිලෝමිරා තේ, ඇසුරුම් සහ ඇණවුම් ක්‍රියාවලිය පිළිබඳ නිවැරදි තොරතුරු.'
            : 'Verified origin, packaging, currency, and WhatsApp ordering information for Ceyvana and Ceylomira.'
        }
        faqs={getHomeFaqs(lang)}
        surfaceClass="bg-[#211C1A]"
      />
    </div>
  );
}

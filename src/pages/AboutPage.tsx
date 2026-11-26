import {useEffect} from 'react';
import BrandLogo from '../components/BrandLogo';
import Breadcrumbs from '../components/Breadcrumbs';
import CeyvanaBrandStatement from '../components/CeyvanaBrandStatement';
import SafeImage from '../components/SafeImage';
import {useStore} from '../context/StoreContext';
import {buildPagePath, updatePageSeo} from '../utils/seo';

export default function AboutPage() {
  const {t, lang, navigate, availableLanguages} = useStore();

  useEffect(() => {
    updatePageSeo({
      title:
        lang === 'si'
          ? 'අප ගැන | සෙයිලෝන් හෙරිටේජ් හවුස් — සෙයිවානා සහ සෙයිලෝමිරා'
          : 'About Us | Ceylon Heritage House — Sri Lankan Spices & Tea',
      description:
        lang === 'si'
          ? 'මාතර, මාතලේ, මහනුවර සහ නුවරඑළිය වගා කලාප සම්බන්ධ කරන සෙයිලෝන් හෙරිටේජ් හවුස්, සෙයිවානා සහ සෙයිලෝමිරා ආයතනය පිළිබඳව.'
          : 'Learn about Ceylon Heritage House in Sri Lanka, uniting Ceyvana single-origin spices and Ceylomira high-grown estate teas.',
      page: 'about',
      lang,
      availableLangCodes: availableLanguages.map((l) => l.code),
    });
  }, [lang, availableLanguages]);

  return (
    <div className="bg-[#151312] text-[#F3EBDD]">
      <section className="bg-[#151312] text-[#F3EBDD] py-16 lg:py-24 border-b border-[#C6A46A]/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
          <Breadcrumbs tone="light" items={[{label: t.nav.home, page: 'home'}, {label: t.nav.about}]} />
          <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-[#C6A46A]">
            {t.about.eyebrow}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-medium text-[#F3EBDD] max-w-3xl text-balance leading-tight">
            {t.about.title}
          </h1>
          <p className="text-sm sm:text-base text-[#D2C6B5] max-w-2xl leading-relaxed">{t.about.lead}</p>
        </div>
      </section>

      {/* Dark Onyx Metrics Strip */}
      <section className="border-b border-[#C6A46A]/25 bg-[#211C1A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-9 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {t.about.metrics.map((m) => (
            <div key={m.label}>
              <p className="font-display text-3xl sm:text-4xl font-medium text-[#C6A46A] font-mono-tabular">
                {m.value}
              </p>
              <p className="text-xs text-[#A99B88] mt-1">{m.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#1C1917]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          <div className="lg:col-span-6 space-y-8">
            {t.about.sections.map((sec) => (
              <div key={sec.title} className="space-y-2.5 pb-6 border-b border-[#C6A46A]/20">
                <h2 className="font-display text-2xl sm:text-3xl font-medium text-[#F3EBDD]">
                  {sec.title}
                </h2>
                <p className="text-sm sm:text-base text-[#D2C6B5] leading-relaxed">{sec.body}</p>
              </div>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <a
                href={buildPagePath('ceyvana', {lang})}
                onClick={(e) => {
                  e.preventDefault();
                  navigate('ceyvana');
                }}
                className="p-5 bg-[#30211D]/80 border border-[#C6A46A]/45 rounded-md hover:border-[#C6A46A] transition-all flex flex-col justify-between items-start gap-3"
              >
                <div className="space-y-3">
                  <BrandLogo brandId="ceyvana" size="sm" />
                  <CeyvanaBrandStatement variant="compact" />
                </div>
                <span className="text-xs font-medium tracking-wider uppercase text-[#C6A46A] pt-1">
                  {t.nav.ceyvana}
                </span>
              </a>
              <a
                href={buildPagePath('ceylomira', {lang})}
                onClick={(e) => {
                  e.preventDefault();
                  navigate('ceylomira');
                }}
                className="p-4 bg-[#123D32]/80 border border-[#C6A46A]/45 rounded-md hover:border-[#C6A46A] transition-all flex flex-col items-start gap-3"
              >
                <BrandLogo brandId="ceylomira" size="sm" />
                <span className="text-xs font-medium tracking-wider uppercase text-[#F3EBDD]">
                  {t.nav.ceylomira}
                </span>
              </a>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-6">
            <div className="aspect-[16/10] rounded-md overflow-hidden bg-[#211C1A] border border-[#C6A46A]/30 luxury-card-shadow">
              <SafeImage
                src="/src/assets/images/story_ceylon_highlands_1795545292272.jpg"
                alt={lang === 'si' ? 'ශ්‍රී ලංකාවේ කඳුකර තේ වතු' : 'Sri Lankan highland tea estates'}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="w-full h-full object-cover"
                aspectClass="w-full h-full"
              />
            </div>
            <div className="aspect-[16/10] rounded-md overflow-hidden bg-[#211C1A] border border-[#C6A46A]/30 luxury-card-shadow">
              <SafeImage
                src="/src/assets/images/showcase_ceyvana_editorial_1795705254796.jpg"
                alt={lang === 'si' ? 'සෙයිවානා සෙයිලෝන් කුළුබඩු එකතුව' : 'Ceyvana Ceylon spice collection'}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="w-full h-full object-cover"
                aspectClass="w-full h-full"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

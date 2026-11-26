import {useEffect} from 'react';
import {ArrowRight} from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
import SafeImage from '../components/SafeImage';
import {useStore} from '../context/StoreContext';
import {updatePageSeo} from '../utils/seo';

export default function HandCraftsPage() {
  const {t, lang, navigate, availableLanguages} = useStore();

  useEffect(() => {
    updatePageSeo({
      title:
        lang === 'si'
          ? 'සෙයිලෝන් හස්ත කර්මාන්ත (ළඟදීම) | සෙයිලෝන් හෙරිටේජ් හවුස්'
          : 'Ceylon Hand Crafts (Coming Soon) | Ceylon Heritage House',
      description:
        lang === 'si'
          ? 'ශ්‍රී ලාංකේය පාරම්පරික ලී කැටයම්, පිත්තල සහ අත්යන්ත්‍ර රෙදිපිළි එකතුව ළඟදීම පැමිණේ.'
          : 'Future home of authentic Sri Lankan woodwork, brasscraft, and handloom textiles. Currently in preparation.',
      page: 'hand-crafts',
      lang,
      availableLangCodes: availableLanguages.map((l) => l.code),
    });
  }, [lang, availableLanguages]);

  return (
    <div className="bg-[#151312] text-[#F3EBDD]">
      {/* Dark Natural Wood (#4E3424 -> #30211D), Royal Charcoal, Antique Gold */}
      <section className="bg-gradient-to-br from-[#4E3424] via-[#30211D] to-[#151312] text-[#F3EBDD] border-b border-[#C6A46A]/30">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 px-6 sm:px-10 py-16 lg:py-20 flex flex-col justify-center space-y-5">
            <Breadcrumbs
              tone="light"
              items={[{label: t.nav.home, page: 'home'}, {label: t.nav.handCrafts}]}
            />
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#C6A46A]">
              {t.handCrafts.eyebrow}
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-medium text-[#F3EBDD]">
              {t.handCrafts.title}
            </h1>
            <p className="text-sm sm:text-base text-[#D2C6B5] max-w-xl leading-relaxed">
              {t.handCrafts.body}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('contact')}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] transition-colors duration-150 cursor-pointer min-h-[44px]"
              >
                <span>{t.handCrafts.notifyCta}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => navigate('home')}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium border border-[#C6A46A]/55 text-[#F3EBDD] rounded-md hover:border-[#C6A46A] hover:bg-[#C6A46A]/10 transition-colors duration-150 cursor-pointer min-h-[44px]"
              >
                {t.handCrafts.backHome}
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 min-h-[240px] bg-[#151312]">
            <SafeImage
              src="/src/assets/images/story_ceylon_highlands_1795545292272.jpg"
              alt={
                lang === 'si'
                  ? 'ශ්‍රී ලාංකේය හස්ත කර්මාන්ත උරුමය'
                  : 'Sri Lankan highland landscape honoring artisanal craft origins'
              }
              eager
              sizes="(max-width: 1024px) 100vw, 42vw"
              className="w-full h-full object-cover"
              aspectClass="w-full h-full"
            />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {t.handCrafts.pillars.map((pillar, idx) => (
            <div
              key={pillar.title}
              className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-md p-6 sm:p-7 space-y-3 luxury-card-shadow"
            >
              <p className="text-[11px] font-mono-tabular font-medium tracking-[0.2em] text-[#C6A46A]">
                0{idx + 1}
              </p>
              <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                {pillar.title}
              </h2>
              <p className="text-sm text-[#D2C6B5] leading-relaxed">{pillar.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

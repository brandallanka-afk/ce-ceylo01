import {useEffect, useState} from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import SafeImage from '../components/SafeImage';
import {useStore} from '../context/StoreContext';
import storiesData from '../data/stories.json';
import type {NewsStory} from '../types/commerce';
import {setArticleStructuredData, updatePageSeo} from '../utils/seo';

const stories = storiesData as NewsStory[];

export default function StoriesPage() {
  const {lang, t, availableLanguages} = useStore();
  const [activeId, setActiveId] = useState<string | null>(stories[0]?.id ?? null);
  const activeStory = stories.find((s) => s.id === activeId) ?? null;

  useEffect(() => {
    updatePageSeo({
      title:
        lang === 'si'
          ? 'පුවත් සහ කතා | සෙයිලෝන් හෙරිටේජ් හවුස්'
          : 'News & Harvest Stories | Ceylon Heritage House',
      description:
        lang === 'si'
          ? 'සෙයිවානා කුළුබඩු උයන් සහ සෙයිලෝමිරා කඳුකර තේ වතුවලින් ගෙන එන අස්වැන්න හා ක්ෂේත්‍ර සටහන්.'
          : 'Field notes and harvest dispatches from Ceyvana Sri Lankan spice gardens and Ceylomira highland tea estates.',
      page: 'stories',
      lang,
      ogType: 'article',
      image: activeStory?.image,
      availableLangCodes: availableLanguages.map((l) => l.code),
    });
    setArticleStructuredData(activeStory, lang);
    return () => setArticleStructuredData(null, lang);
  }, [lang, activeStory, availableLanguages]);

  return (
    <div className="bg-[#1C1917] text-[#F3EBDD]">
      <section className="bg-[#151312] text-[#F3EBDD] py-14 lg:py-20 border-b border-[#C6A46A]/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <Breadcrumbs tone="light" items={[{label: t.nav.home, page: 'home'}, {label: t.stories.title}]} />
          <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-[#C6A46A]">
            {t.stories.eyebrow}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-medium text-[#F3EBDD]">
            {t.stories.title}
          </h1>
          <p className="text-sm sm:text-base text-[#D2C6B5] max-w-2xl leading-relaxed">
            {t.stories.subtitle}
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-12">
        {activeStory && (
          <article className="bg-[#211C1A] border border-[#C6A46A]/35 rounded-md overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch luxury-card-shadow">
            <div className="lg:col-span-6 min-h-[260px] bg-[#151312]">
              <SafeImage
                src={activeStory.image}
                alt={activeStory.title[lang] || activeStory.title.en}
                eager
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="w-full h-full object-cover"
                aspectClass="w-full h-full"
              />
            </div>
            <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-center space-y-4">
              <div className="text-[11px] font-mono-tabular tracking-wider uppercase text-[#A99B88]">
                <span className="text-[#C6A46A]">{activeStory.brandTag[lang]}</span>
                <span aria-hidden="true"> · </span>
                <span>{activeStory.publishedAt}</span>
                <span aria-hidden="true"> · </span>
                <span>
                  {activeStory.readTimeMinutes} {t.stories.minRead}
                </span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-medium text-[#F3EBDD] leading-tight">
                {activeStory.title[lang]}
              </h2>
              <p className="text-sm sm:text-base text-[#D2C6B5] leading-relaxed">
                {activeStory.body[lang]}
              </p>
            </div>
          </article>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {stories.map((story) => {
            const isCurrent = story.id === activeId;
            return (
              <article
                key={story.id}
                className={`bg-[#211C1A] border rounded-md overflow-hidden flex flex-col transition-colors luxury-card-shadow ${
                  isCurrent
                    ? 'border-[#C6A46A] ring-1 ring-[#C6A46A]/45'
                    : 'border-[#C6A46A]/20 hover:border-[#C6A46A]/50'
                }`}
              >
                <div className="aspect-[16/10] bg-[#151312] overflow-hidden">
                  <SafeImage
                    src={story.image}
                    alt={story.title[lang] || story.title.en}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="w-full h-full object-cover"
                    aspectClass="w-full h-full"
                  />
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-mono-tabular tracking-wider uppercase text-[#A99B88] mb-2">
                      <span className="text-[#C6A46A]">{story.brandTag[lang]}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{story.publishedAt}</span>
                    </div>
                    <h3 className="font-display text-xl font-medium text-[#F3EBDD] leading-snug mb-2">
                      {story.title[lang]}
                    </h3>
                    <p className="text-xs text-[#D2C6B5] leading-relaxed">{story.excerpt[lang]}</p>
                  </div>
                  <button
                    type="button"
                    aria-pressed={isCurrent}
                    onClick={() => setActiveId(story.id)}
                    className="self-start text-xs font-medium tracking-wider uppercase text-[#C6A46A] hover:text-[#F3EBDD] hover:underline underline-offset-4 cursor-pointer min-h-[36px]"
                  >
                    {t.stories.readMore}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

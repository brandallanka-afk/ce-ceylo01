import {useEffect, useMemo, useState} from 'react';
import {FileText, Search} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import Breadcrumbs from '../components/Breadcrumbs';
import CeyvanaBrandStatement from '../components/CeyvanaBrandStatement';
import FaqSection from '../components/FaqSection';
import ProductCard from '../components/ProductCard';
import SafeImage from '../components/SafeImage';
import {useStore} from '../context/StoreContext';
import {getCeylomiraFaqs, getCeyvanaFaqs} from '../data/faqs';
import {updatePageSeo} from '../utils/seo';

const PAGE_SIZE = 6;

interface BrandStorePageProps {
  brandId: 'ceyvana' | 'ceylomira';
}

export default function BrandStorePage({brandId}: BrandStorePageProps) {
  const {
    lang,
    t,
    navigate,
    catalogBrands: brands,
    catalogProducts: allProducts,
    availableLanguages,
  } = useStore();
  const [search, setSearch] = useState('');
  const [categorySlug, setCategorySlug] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');
  const [page, setPage] = useState(1);

  const brand = brands.find((b) => b.id === brandId) ?? brands[0];
  const brandProducts = useMemo(
    () => allProducts.filter((p) => p.brandId === brandId && !p.isArchived),
    [allProducts, brandId],
  );

  useEffect(() => {
    setSearch('');
    setCategorySlug('all');
    setSortBy('featured');
    setPage(1);
  }, [brandId]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    brandProducts.forEach((p) => {
      if (!map.has(p.categorySlug)) {
        map.set(p.categorySlug, p.category[lang] || p.category.en);
      }
    });
    return Array.from(map.entries()).map(([slug, label]) => ({slug, label}));
  }, [brandProducts, lang]);

  useEffect(() => {
    const activeCat = categories.find((c) => c.slug === categorySlug);
    const titlePrefix = activeCat
      ? `${activeCat.label} — ${brand.name[lang] || brand.name.en}`
      : `${brand.name[lang] || brand.name.en} — ${brand.tagline[lang] || brand.tagline.en}`;
    const desc = activeCat
      ? lang === 'si'
        ? `${brand.name.si} වෙතින් ${activeCat.label} එකතුව. ශ්‍රී ලංකාවෙන් සෘජුවම ඇසුරුම් කළ නිෂ්පාදන.`
        : `Explore authentic ${activeCat.label} from ${brand.name.en}, packed at origin in Sri Lanka.`
      : brand.description[lang] || brand.description.en;

    updatePageSeo({
      title: `${titlePrefix} | Ceylon Heritage House`,
      description: desc,
      page: brandId,
      lang,
      image: brand.heroImage,
      availableLangCodes: availableLanguages.map((l) => l.code),
    });
  }, [brandId, brand, lang, categorySlug, categories, availableLanguages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = brandProducts.filter((p) => {
      const matchesCat = categorySlug === 'all' || p.categorySlug === categorySlug;
      if (!matchesCat) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        p.name.en.toLowerCase().includes(q) ||
        p.name.si.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.origin.en.toLowerCase().includes(q) ||
        p.variants.some((v) => v.variantSku.toLowerCase().includes(q))
      );
    });

    if (sortBy === 'price-asc') {
      return [...list].sort((a, b) => a.variants[0].priceLkr - b.variants[0].priceLkr);
    }
    if (sortBy === 'price-desc') {
      return [...list].sort((a, b) => b.variants[0].priceLkr - a.variants[0].priceLkr);
    }
    return [...list].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  }, [brandProducts, categorySlug, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const isCeyvana = brandId === 'ceyvana';
  const showcaseImage = isCeyvana
    ? '/src/assets/images/showcase_ceyvana_editorial_1795705254796.jpg'
    : '/src/assets/images/showcase_ceylomira_editorial_1795705255087.jpg';

  // Enforce luxury dark heritage palette regardless of cached Firestore surface hex
  const headerPrimary = isCeyvana ? '#30211D' : '#123D32';
  const headerAccent = '#C6A46A';
  const actionButtonBg = isCeyvana ? '#501C2B' : '#123D32';

  return (
    <div className="bg-[#1C1917] text-[#F3EBDD]">
      {/* Distinct Dark Brand Header Banner */}
      <section
        style={{backgroundColor: headerPrimary}}
        className="relative text-[#F3EBDD] border-b border-[#C6A46A]/30 overflow-hidden"
      >
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-6 px-6 sm:px-10 py-14 lg:py-20 flex flex-col justify-center space-y-5 relative z-10">
            <Breadcrumbs
              tone="light"
              items={[
                {label: t.nav.home, page: 'home'},
                {label: brand.name[lang] || brand.name.en},
              ]}
            />
            <div className="space-y-3">
              <div>
                <BrandLogo brandId={brandId} size="lg" eager />
              </div>
              <p
                style={{color: headerAccent}}
                className="text-[11px] font-medium tracking-[0.22em] uppercase"
              >
                {brand.tagline[lang]}
              </p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-medium text-[#F3EBDD] leading-tight">
                {brand.name[lang]}
              </h1>
              {isCeyvana && <CeyvanaBrandStatement variant="hero" className="pt-1" />}
            </div>
            <p className="text-sm sm:text-base text-[#D2C6B5] max-w-xl leading-relaxed">
              {brand.description[lang]}
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  window.history.replaceState(null, '', `#${brandId}`);
                  navigate('portfolio');
                  window.location.hash = brandId;
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium tracking-[0.06em] border border-[#C6A46A]/55 bg-[#151312]/60 text-[#F3EBDD] rounded hover:border-[#C6A46A] hover:bg-[#151312]/90 transition-colors duration-150 cursor-pointer min-h-[44px]"
              >
                <FileText className="w-3.5 h-3.5 text-[#C6A46A]" aria-hidden="true" />
                <span>
                  {lang === 'si' ? 'නිෂ්පාදන නාමාවලිය (PDF)' : 'Product Portfolio (PDF)'}
                </span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 relative min-h-[250px] sm:min-h-[320px] lg:min-h-[380px] bg-[#151312]">
            <SafeImage
              src={showcaseImage}
              alt={`${brand.name[lang]} — ${brand.tagline[lang]}`}
              eager
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="w-full h-full object-cover"
              aspectClass="w-full h-full"
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `linear-gradient(90deg, ${headerPrimary} 0%, transparent 45%)`,
              }}
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      {/* Dark Architectural Filter & Search Toolbar + Product Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-8">
        {isCeyvana && (
          <div className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-md px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 luxury-card-shadow">
            <CeyvanaBrandStatement variant="collection" showEyebrow />
            <p className="text-xs sm:text-sm text-[#D2C6B5] max-w-md leading-relaxed">
              {lang === 'si'
                ? 'මාතර, මාතලේ සහ මහනුවර වතු යායන්ගෙන් නෙළා පිරිසිදු කර ඇසුරුම් කළ අපගේ කුළුබඩු එකතුව ගවේෂණය කරන්න.'
                : 'Explore single-origin whole spices and stone-milled Ceylon blends harvested across Matara, Matale, and Kandy spice gardens.'}
            </p>
          </div>
        )}
        <div className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-md p-5 sm:p-6 space-y-5 luxury-card-shadow">
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <label htmlFor="store-search" className="sr-only">
                {t.store.searchPlaceholder}
              </label>
              <Search
                className="w-4 h-4 text-[#A99B88] absolute left-3.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                id="store-search"
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t.store.searchPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded focus:outline-none focus:border-[#C6A46A] min-h-[44px]"
              />
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="store-sort" className="sr-only">
                Sort products
              </label>
              <select
                id="store-sort"
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as 'featured' | 'price-asc' | 'price-desc')
                }
                className="px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] rounded text-[#F3EBDD] focus:outline-none focus:border-[#C6A46A] cursor-pointer min-h-[44px]"
              >
                <option value="featured">{t.store.sortFeatured}</option>
                <option value="price-asc">{t.store.sortPriceLow}</option>
                <option value="price-desc">{t.store.sortPriceHigh}</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#C6A46A]/20">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Categories">
              <button
                type="button"
                aria-pressed={categorySlug === 'all'}
                onClick={() => {
                  setCategorySlug('all');
                  setPage(1);
                }}
                style={
                  categorySlug === 'all'
                    ? {backgroundColor: actionButtonBg, color: '#F3EBDD'}
                    : undefined
                }
                className={`px-3.5 py-2 text-xs font-medium tracking-wide rounded border transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[38px] ${
                  categorySlug === 'all'
                    ? 'border-[#C6A46A]/65 font-semibold'
                    : 'bg-[#2A2522] text-[#F3EBDD] border-[#3B332E] hover:border-[#C6A46A]/60'
                }`}
              >
                {t.store.allCategories}
              </button>
              {categories.map((cat) => {
                const active = categorySlug === cat.slug;
                return (
                  <button
                    key={cat.slug}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setCategorySlug(cat.slug);
                      setPage(1);
                    }}
                    style={
                      active ? {backgroundColor: actionButtonBg, color: '#F3EBDD'} : undefined
                    }
                    className={`px-3.5 py-2 text-xs font-medium tracking-wide rounded border transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[38px] ${
                      active
                        ? 'border-[#C6A46A]/65 font-semibold'
                        : 'bg-[#2A2522] text-[#F3EBDD] border-[#3B332E] hover:border-[#C6A46A]/60'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-[#A99B88] font-mono-tabular">
              {t.store.showingCount.replace('{count}', String(filtered.length))}
            </p>
          </div>
        </div>

        {/* Product Grid */}
        {paginated.length === 0 ? (
          <div className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-md p-12 text-center space-y-3">
            <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
              {t.store.noProductsTitle}
            </h2>
            <p className="text-sm text-[#D2C6B5]">{t.store.noProductsBody}</p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategorySlug('all');
                setPage(1);
              }}
              className="mt-2 px-5 py-2.5 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] cursor-pointer min-h-[44px]"
            >
              {t.store.clearFilters}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {paginated.map((product) => (
              <ProductCard key={product.id} product={product} accentHex={actionButtonBg} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 text-xs font-medium border border-[#C6A46A]/35 bg-[#211C1A] text-[#F3EBDD] hover:bg-[#2A2522] rounded disabled:opacity-40 cursor-pointer min-h-[40px]"
            >
              {t.store.previous}
            </button>
            <span className="text-xs font-mono-tabular text-[#A99B88]">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-4 py-2 text-xs font-medium border border-[#C6A46A]/35 bg-[#211C1A] text-[#F3EBDD] hover:bg-[#2A2522] rounded disabled:opacity-40 cursor-pointer min-h-[40px]"
            >
              {t.store.next}
            </button>
          </div>
        )}
      </section>

      <FaqSection
        title={
          isCeyvana
            ? lang === 'si'
              ? 'සෙයිවානා කුළුබඩු පිළිබඳ පොදු ප්‍රශ්න'
              : 'Ceyvana Spices — Origin & Usage Questions'
            : lang === 'si'
              ? 'සෙයිලෝමිරා තේ පිළිබඳ පොදු ප්‍රශ්න'
              : 'Ceylomira Ceylon Tea — Grades & Brewing Questions'
        }
        faqs={isCeyvana ? getCeyvanaFaqs(lang) : getCeylomiraFaqs(lang)}
        surfaceClass="bg-[#211C1A]"
      />
    </div>
  );
}

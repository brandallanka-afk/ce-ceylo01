import {FormEvent, useEffect, useMemo, useState} from 'react';
import {
  BookOpen,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Lock,
  MessageCircle,
  Send,
  X,
} from 'lucide-react';
import BrandLogo, {isOfficialLogoBrand} from '../components/BrandLogo';
import Breadcrumbs from '../components/Breadcrumbs';
import CeyvanaBrandStatement from '../components/CeyvanaBrandStatement';
import {useStore} from '../context/StoreContext';
import {
  fetchPublishedPortfolios,
  generateCustomPublicPortfolioPdfBlob,
  submitCatalogueRequest,
  triggerBlobFileDownload,
  type PublishedPortfolioItem,
} from '../services/commerceApi';
import type {CatalogueRequestRecord, CommerceSettingsConfig} from '../types/admin';
import type {BrandId} from '../types/commerce';
import {buildWhatsAppLink, resolveBrandWhatsappNumber} from '../utils/currency';
import {updatePageSeo} from '../utils/seo';

function resolveInitialBrand(): BrandId {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace('#', '').trim().toLowerCase();
    if (hash === 'ceyvana' || hash === 'ceylomira' || hash === 'hand-crafts') {
      return hash;
    }
  }
  return 'ceyvana';
}

export default function PortfolioPage() {
  const {
    lang,
    t,
    currency,
    availableCurrencies,
    availableLanguages,
    catalogBrands,
    catalogProducts,
    commerceConfig,
    navigate,
  } = useStore();

  const [selectedBrand, setSelectedBrand] = useState<BrandId>(resolveInitialBrand);
  const [docLang, setDocLang] = useState<'en' | 'si'>(lang === 'si' ? 'si' : 'en');
  const [docCurrency, setDocCurrency] = useState<string>(currency);

  const [published, setPublished] = useState<PublishedPortfolioItem[]>([]);
  const [portfolioSettings, setPortfolioSettings] = useState<
    CommerceSettingsConfig['portfolioSettings'] | undefined
  >(commerceConfig?.portfolioSettings);
  const [loadingPublished, setLoadingPublished] = useState(true);
  const [feedbackError, setFeedbackError] = useState('');

  // Custom public catalogue builder state
  const [customScope, setCustomScope] = useState<'all' | 'categories' | 'products'>('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [generatingCustom, setGeneratingCustom] = useState(false);

  // Inline PDF preview state (either URL from server or Blob object URL)
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewIsBlob, setPreviewIsBlob] = useState(false);

  // Catalogue assistance / registration request form state
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqCountry, setReqCountry] = useState('Sri Lanka');
  const [reqCompany, setReqCompany] = useState('');
  const [reqWhatsapp, setReqWhatsapp] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);
  const [reqResult, setReqResult] = useState<CatalogueRequestRecord | null>(null);

  useEffect(() => {
    setDocLang(lang === 'si' ? 'si' : 'en');
  }, [lang]);

  useEffect(() => {
    setDocCurrency(currency);
  }, [currency]);

  useEffect(() => {
    updatePageSeo({
      title:
        lang === 'si'
          ? 'නිෂ්පාදන නාමාවලි (PDF) | සෙයිවානා සහ සෙයිලෝමිරා | Ceylon Heritage House'
          : 'Product Portfolios (PDF) | Ceyvana & Ceylomira | Ceylon Heritage House',
      description:
        lang === 'si'
          ? 'සෙයිවානා කුළුබඩු සහ සෙයිලෝමිරා තේ සන්නාම සඳහා නිල PDF නිෂ්පාදන නාමාවලි බලන්න, බාගත කරන්න හෝ ඉල්ලුම් කරන්න.'
          : 'Preview and download brand-specific official Product Portfolio PDFs for Ceyvana Ceylon Spices and Ceylomira Highland Tea in English and Sinhala.',
      page: 'portfolio',
      lang,
      availableLangCodes: availableLanguages.map((l) => l.code),
    });
  }, [lang, availableLanguages]);

  useEffect(() => {
    let active = true;
    setLoadingPublished(true);
    fetchPublishedPortfolios()
      .then((res) => {
        if (!active) return;
        setPublished(res.portfolios || []);
        if (res.portfolioSettings) {
          setPortfolioSettings(res.portfolioSettings);
        }
      })
      .catch(() => {
        // Keep graceful fallback
      })
      .finally(() => {
        if (active) setLoadingPublished(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Cleanup any blob object URL on close or unmount
  useEffect(() => {
    return () => {
      if (previewUrl && previewIsBlob) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, previewIsBlob]);

  const closePreview = () => {
    if (previewUrl && previewIsBlob) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl('');
    setPreviewTitle('');
    setPreviewIsBlob(false);
  };

  // Reset scope selections when changing brand so cross-brand selection is impossible
  useEffect(() => {
    setSelectedCategories([]);
    setSelectedProductIds([]);
    setCustomScope('all');
    setFeedbackError('');
    closePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrand]);

  const activeBrandConfig = catalogBrands.find((b) => b.id === selectedBrand);
  const isHandCraftsLocked =
    selectedBrand === 'hand-crafts' && activeBrandConfig?.status !== 'active';

  const brandProducts = useMemo(
    () => catalogProducts.filter((p) => p.brandId === selectedBrand && !p.isArchived),
    [catalogProducts, selectedBrand],
  );

  const brandCategories = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of brandProducts) {
      if (!map.has(p.categorySlug)) {
        map.set(p.categorySlug, p.category[lang] || p.category.en);
      }
    }
    return Array.from(map.entries()).map(([slug, label]) => ({slug, label}));
  }, [brandProducts, lang]);

  const brandPublishedEditions = useMemo(
    () => published.filter((item) => item.brandId === selectedBrand),
    [published, selectedBrand],
  );

  const requireReg = Boolean(portfolioSettings?.requireRegistrationForPublicDownload);
  const allowCustomSelection = portfolioSettings?.allowCustomPublicCatalogSelection !== false;

  const handleOpenPublishedPreview = (item: PublishedPortfolioItem) => {
    if (requireReg) {
      setFeedbackError(
        lang === 'si'
          ? 'නාමාවලිය බාගත කිරීමට පෙර පහත පෝරමය හරහා ඔබගේ විස්තර ලියාපදිංචි කරන්න.'
          : 'Registration is currently required by the administrator before public PDF download. Please submit the request form below.',
      );
      return;
    }
    setFeedbackError('');
    if (previewUrl && previewIsBlob) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewTitle(`${item.title} (${item.version})`);
    setPreviewUrl(`${item.pdfUrl}?preview=1`);
    setPreviewIsBlob(false);
  };

  const handleDownloadPublished = async (item: PublishedPortfolioItem) => {
    setFeedbackError('');
    try {
      const resp = await fetch(item.pdfUrl);
      if (resp.status === 403) {
        const err = (await resp.json().catch(() => ({}))) as {error?: string};
        setFeedbackError(
          err.error ||
            'Public downloads require submitting the Catalogue Request form below.',
        );
        return;
      }
      if (!resp.ok) {
        throw new Error('Unable to download published PDF.');
      }
      const blob = await resp.blob();
      const safeName = `${item.brandId}-portfolio-${item.language}-${item.version}.pdf`;
      triggerBlobFileDownload(blob, safeName);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'PDF download failed.');
    }
  };

  const handleCustomPortfolioAction = async (mode: 'preview' | 'download') => {
    setFeedbackError('');
    if (isHandCraftsLocked || brandProducts.length === 0) {
      setFeedbackError('No active products available for this brand.');
      return;
    }
    if (customScope === 'categories' && selectedCategories.length === 0) {
      setFeedbackError(
        lang === 'si'
          ? 'කරුණාකර අවම වශයෙන් එක් කාණ්ඩයක්වත් තෝරන්න.'
          : 'Please select at least one category for a custom category portfolio.',
      );
      return;
    }
    if (customScope === 'products' && selectedProductIds.length === 0) {
      setFeedbackError(
        lang === 'si'
          ? 'කරුණාකර අවම වශයෙන් එක් නිෂ්පාදනයක්වත් තෝරන්න.'
          : 'Please select at least one product for a custom product portfolio.',
      );
      return;
    }

    setGeneratingCustom(true);
    try {
      const blob = await generateCustomPublicPortfolioPdfBlob({
        brandId: selectedBrand,
        language: docLang,
        currency: docCurrency,
        scope: customScope,
        categorySlugs: customScope === 'categories' ? selectedCategories : undefined,
        productIds: customScope === 'products' ? selectedProductIds : undefined,
        preview: mode === 'preview',
      });
      if (mode === 'download') {
        const fileName = `${selectedBrand}-custom-portfolio-${docLang}.pdf`;
        triggerBlobFileDownload(blob, fileName);
      } else {
        if (previewUrl && previewIsBlob) {
          URL.revokeObjectURL(previewUrl);
        }
        const url = URL.createObjectURL(blob);
        setPreviewTitle(
          `${activeBrandConfig?.name[docLang] || selectedBrand.toUpperCase()} — ${docLang === 'si' ? 'අභිරුචි නාමාවලිය' : 'Custom Selection Preview'}`,
        );
        setPreviewUrl(url);
        setPreviewIsBlob(true);
      }
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Failed to generate portfolio PDF.');
    } finally {
      setGeneratingCustom(false);
    }
  };

  const handleRequestSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedbackError('');
    setSubmittingReq(true);
    try {
      const saved = await submitCatalogueRequest({
        brandId: selectedBrand,
        language: docLang,
        customerName: reqName.trim(),
        email: reqEmail.trim(),
        country: reqCountry.trim(),
        companyName: reqCompany.trim() || undefined,
        whatsappNumber: reqWhatsapp.trim() || undefined,
        scope: customScope,
        requestedCategories: customScope === 'categories' ? selectedCategories : undefined,
        requestedProducts: customScope === 'products' ? selectedProductIds : undefined,
        notes: reqNotes.trim() || undefined,
      });
      setReqResult(saved);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Failed to submit catalogue request.');
    } finally {
      setSubmittingReq(false);
    }
  };

  const brandWhatsapp = resolveBrandWhatsappNumber(selectedBrand, commerceConfig);

  return (
    <div className="bg-[#1C1917] text-[#F3EBDD] min-h-screen">
      {/* Editorial Hero Header */}
      <section className="bg-[#151312] text-[#F3EBDD] border-b border-[#C6A46A]/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-4">
          <Breadcrumbs
            tone="light"
            items={[
              {label: t.nav.home, page: 'home'},
              {label: t.nav.portfolio},
            ]}
          />
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-[#C6A46A]">
            {lang === 'si'
              ? 'නිල සන්නාම නාමාවලි · PDF ප්‍රකාශන'
              : 'Brand Catalogue Editions · Luxury Ceylon Dossier'}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-medium text-[#F3EBDD]">
            {lang === 'si' ? 'නිෂ්පාදන නාමාවලි (PDF)' : 'Product Portfolios & Catalogues'}
          </h1>
          <p className="text-sm sm:text-base text-[#D2C6B5] max-w-2xl leading-relaxed">
            {lang === 'si'
              ? 'සෙයිවානා කුළුබඩු සහ සෙයිලෝමිරා තේ සන්නාම සඳහා වෙන් වෙන් වශයෙන් සකස් කළ වෘත්තීය PDF නාමාවලි පරීක්ෂා කර බාගත කරන්න.'
              : 'Each Ceylon Heritage house maintains its own independent Product Portfolio PDF. Select a brand below to preview official editions, assemble a custom product selection, or request trade assistance.'}
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Step 1: Brand Isolation Selector + Document Options */}
        <section className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-lg p-6 space-y-5 luxury-card-shadow">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#C6A46A]/20 pb-4">
            <div>
              <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                {lang === 'si'
                  ? '1. සන්නාමය සහ භාෂාව තෝරන්න'
                  : '1. Select Brand House & Document Format'}
              </h2>
              <p className="text-xs text-[#A99B88] mt-0.5">
                {lang === 'si'
                  ? 'සෑම PDF නාමාවලියක්ම තෝරාගත් සන්නාමයට පමණක් සීමා වේ.'
                  : 'Brand integrity guarantee: Ceyvana and Ceylomira portfolios are strictly separated.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center border border-[#C6A46A]/35 rounded-md overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setDocLang('en')}
                  className={`px-3 py-2 font-medium cursor-pointer ${
                    docLang === 'en'
                      ? 'bg-[#C6A46A] text-[#151312]'
                      : 'bg-[#2A2522] text-[#D2C6B5] hover:text-[#F3EBDD]'
                  }`}
                >
                  English PDF
                </button>
                <button
                  type="button"
                  onClick={() => setDocLang('si')}
                  className={`px-3 py-2 font-medium cursor-pointer ${
                    docLang === 'si'
                      ? 'bg-[#C6A46A] text-[#151312]'
                      : 'bg-[#2A2522] text-[#D2C6B5] hover:text-[#F3EBDD]'
                  }`}
                >
                  සිංහල PDF
                </button>
              </div>

              <select
                aria-label="Document currency"
                value={docCurrency}
                onChange={(e) => setDocCurrency(e.target.value)}
                className="px-3 py-2 text-xs font-mono-tabular bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md"
              >
                {availableCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['ceyvana', 'ceylomira', 'hand-crafts'] as BrandId[]).map((bId) => {
              const bCfg = catalogBrands.find((b) => b.id === bId);
              const isSelected = selectedBrand === bId;
              const isComingSoon = bId === 'hand-crafts' && bCfg?.status !== 'active';

              return (
                <button
                  key={bId}
                  type="button"
                  onClick={() => setSelectedBrand(bId)}
                  className={`text-left p-5 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#2A2522] border-[#C6A46A] ring-1 ring-[#C6A46A]/65'
                      : 'bg-[#151312] border-[#3B332E] hover:border-[#C6A46A]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-widest text-[#C6A46A]">
                      {isComingSoon
                        ? lang === 'si'
                          ? 'ළඟදීම'
                          : 'Future Brand House'
                        : lang === 'si'
                          ? 'සක්‍රීය සන්නාමය'
                          : 'Active Brand House'}
                    </span>
                    <span className="text-[11px] font-mono-tabular text-[#A99B88]">
                      {bId.toUpperCase()}
                    </span>
                  </div>
                  {isOfficialLogoBrand(bId) && (
                    <div className="mt-3 mb-1">
                      <BrandLogo brandId={bId} size="md" sheen={isSelected} />
                    </div>
                  )}
                  <p className="font-display text-2xl font-medium text-[#F3EBDD] mt-2">
                    {bCfg?.name[lang] || bId}
                  </p>
                  <p className="text-xs text-[#D2C6B5] mt-1 line-clamp-2">
                    {bCfg?.tagline[lang] || bCfg?.tagline.en}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {feedbackError && (
          <div className="p-4 bg-[#501C2B]/60 border border-[#C6A46A]/45 text-[#F3B0B6] text-sm rounded-lg">
            {feedbackError}
          </div>
        )}

        {/* Future Brand Coming Soon Guard */}
        {isHandCraftsLocked ? (
          <section className="bg-[#211C1A] border border-[#C6A46A]/35 rounded-lg p-8 text-center space-y-4">
            <BookOpen className="w-8 h-8 text-[#C6A46A] mx-auto" />
            <h2 className="font-display text-3xl font-medium text-[#F3EBDD]">
              {lang === 'si'
                ? 'ලංකා අත්කම් නාමාවලිය ළඟදීම'
                : 'Ceylon Hand Crafts Portfolio — Coming Soon'}
            </h2>
            <p className="text-sm text-[#D2C6B5] max-w-xl mx-auto">
              {lang === 'si'
                ? 'අත්කම් එකතුව තවමත් සකසමින් පවතී. නිකුත් වූ වහාම දැනගැනීමට පහත පෝරමය හරහා ලියාපදිංචි විය හැකිය.'
                : 'Our artisanal woodwork, brassware, and handloom line is currently under curation. You may register early interest using the Catalogue Assistance form below without mixing with Ceyvana or Ceylomira catalogues.'}
            </p>
            <div>
              <button
                type="button"
                onClick={() => navigate('hand-crafts')}
                className="px-5 py-2.5 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] cursor-pointer"
              >
                {lang === 'si' ? 'අත්කම් පිටුවට යන්න' : 'View Hand Crafts Preview'}
              </button>
            </div>
          </section>
        ) : (
          <>
            {selectedBrand === 'ceyvana' && (
              <section className="bg-[#30211D]/85 border border-[#C6A46A]/40 rounded-lg p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6 luxury-card-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  <BrandLogo brandId="ceyvana" size="sm" />
                  <div className="hidden sm:block h-10 w-px bg-[#C6A46A]/30" aria-hidden="true" />
                  <CeyvanaBrandStatement variant="editorial" showEyebrow />
                </div>
                <p className="text-xs text-[#D2C6B5] max-w-sm leading-relaxed">
                  {lang === 'si'
                    ? 'සෙයිවානා නිල PDF නාමාවලි තුළ මාතර, මාතලේ සහ මහනුවර වගා කලාපීය කුළුබඩු පිරිවිතර ඇතුළත් වේ.'
                    : 'Official Ceyvana spice dossiers pair regional Sri Lankan harvest provenance with origin-sealed retail and trade specifications.'}
                </p>
              </section>
            )}

            {/* Step 2: Official Published Admin Editions */}
            <section className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-lg p-6 space-y-5 luxury-card-shadow">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#C6A46A]/20 pb-4">
                <div>
                  <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                    {lang === 'si'
                      ? '2. නිල ප්‍රකාශිත නාමාවලි සංස්කරණ'
                      : '2. Official Published Portfolio Editions'}
                  </h2>
                  <p className="text-xs text-[#A99B88] mt-0.5">
                    {lang === 'si'
                      ? 'පරිපාලක විසින් අනුමත කර ප්‍රකාශයට පත් කරන ලද නාමාවලි.'
                      : 'Curated, versioned PDF editions verified and published for this brand.'}
                  </p>
                </div>
                {requireReg && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F3B0B6] bg-[#501C2B]/60 border border-[#C6A46A]/35 px-3 py-1.5 rounded">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Registration Required for Direct Download</span>
                  </span>
                )}
              </div>

              {loadingPublished ? (
                <p className="text-sm text-[#A99B88] py-4">
                  {lang === 'si' ? 'නාමාවලි පූරණය වෙමින්...' : 'Loading published editions...'}
                </p>
              ) : brandPublishedEditions.length === 0 ? (
                <div className="p-5 bg-[#151312] border border-[#3B332E] rounded-md text-sm text-[#D2C6B5]">
                  {lang === 'si'
                    ? 'මෙම සන්නාමය සඳහා දැනට ප්‍රකාශිත නිල නාමාවලි සංස්කරණ නොමැත. පහතින් ඔබටම අභිරුචි නාමාවලියක් සකසා ගත හැක.'
                    : 'No admin-published fixed editions are posted for this brand yet. Use the Custom Portfolio Builder below to preview or download an up-to-date retail PDF immediately.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {brandPublishedEditions.map((item) => (
                    <div
                      key={item.id}
                      className="p-5 bg-[#151312] border border-[#C6A46A]/25 rounded-lg flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular text-[#C6A46A]">
                          <span>
                            {item.version} · {item.language.toUpperCase()} · {item.currency}
                          </span>
                          <span className="text-[#A99B88]">
                            {item.pageCount} pages · {Math.max(1, Math.round(item.fileSizeBytes / 1024))} KB
                          </span>
                        </div>
                        <h3 className="font-display text-xl font-medium text-[#F3EBDD]">
                          {item.title}
                        </h3>
                        <p className="text-xs text-[#A99B88]">
                          {item.productCount} products ·{' '}
                          {item.orientation === 'landscape' ? 'A4 Landscape' : 'A4 Portrait'} · Updated{' '}
                          {item.generatedAt.slice(0, 10)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2.5 pt-2 border-t border-[#C6A46A]/20">
                        <button
                          type="button"
                          onClick={() => handleOpenPublishedPreview(item)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[#C6A46A]/55 bg-transparent text-[#F3EBDD] rounded-md hover:border-[#C6A46A] hover:bg-[#C6A46A]/10 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#C6A46A]" />
                          <span>{lang === 'si' ? 'පෙරදසුන' : 'Preview PDF'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDownloadPublished(item)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{lang === 'si' ? 'PDF බාගත කරන්න' : 'Download PDF'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Step 3: Custom Public Portfolio Builder (Non-Wholesale Strictly Enforced) */}
            {allowCustomSelection && (
              <section className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-lg p-6 space-y-5 luxury-card-shadow">
                <div className="border-b border-[#C6A46A]/20 pb-4">
                  <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                    {lang === 'si'
                      ? '3. ඔබේම PDF නාමාවලිය සකසන්න'
                      : '3. Build Custom Brand Portfolio PDF'}
                  </h2>
                  <p className="text-xs text-[#D2C6B5] mt-0.5">
                    {lang === 'si'
                      ? 'මුළු සන්නාමයම හෝ ඔබ කැමති කාණ්ඩ සහ නිෂ්පාදන පමණක් තෝරා PDF එකක් සාදන්න.'
                      : `Generate an instant non-confidential retail PDF for ${activeBrandConfig?.name[docLang] || selectedBrand} covering all items, selected categories, or specific products.`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 text-xs">
                  {(
                    [
                      {id: 'all', en: 'Full Brand Catalogue', si: 'මුළු සන්නාම නාමාවලිය'},
                      {id: 'categories', en: 'Selected Categories', si: 'තෝරාගත් කාණ්ඩ'},
                      {id: 'products', en: 'Selected Products', si: 'තෝරාගත් නිෂ්පාදන'},
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCustomScope(opt.id)}
                      className={`px-4 py-2 font-medium rounded-md border cursor-pointer ${
                        customScope === opt.id
                          ? 'bg-[#C6A46A] text-[#151312] border-[#C6A46A]'
                          : 'bg-[#2A2522] text-[#D2C6B5] border-[#3B332E] hover:border-[#C6A46A] hover:text-[#F3EBDD]'
                      }`}
                    >
                      {lang === 'si' ? opt.si : opt.en}
                    </button>
                  ))}
                </div>

                {customScope === 'categories' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-4 bg-[#151312] border border-[#3B332E] rounded-md">
                    {brandCategories.map((cat) => {
                      const checked = selectedCategories.includes(cat.slug);
                      return (
                        <label
                          key={cat.slug}
                          className="flex items-center gap-2.5 p-2.5 bg-[#2A2522] border border-[#3B332E] rounded text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            className="accent-[#C6A46A]"
                            onChange={(e) => {
                              setSelectedCategories((prev) =>
                                e.target.checked
                                  ? [...prev, cat.slug]
                                  : prev.filter((s) => s !== cat.slug),
                              );
                            }}
                          />
                          <span className="font-medium text-[#F3EBDD]">{cat.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {customScope === 'products' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-4 bg-[#151312] border border-[#3B332E] rounded-md max-h-72 overflow-y-auto">
                    {brandProducts.map((p) => {
                      const checked = selectedProductIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex items-center gap-2.5 p-2.5 bg-[#2A2522] border border-[#3B332E] rounded text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            className="accent-[#C6A46A]"
                            onChange={(e) => {
                              setSelectedProductIds((prev) =>
                                e.target.checked
                                  ? [...prev, p.id]
                                  : prev.filter((id) => id !== p.id),
                              );
                            }}
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-[#F3EBDD] truncate">
                              {p.name[docLang] || p.name.en}
                            </p>
                            <p className="text-[11px] font-mono-tabular text-[#A99B88]">
                              {p.sku} · {p.category[docLang] || p.category.en}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    disabled={generatingCustom}
                    onClick={() => void handleCustomPortfolioAction('preview')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium border border-[#C6A46A]/55 bg-transparent text-[#F3EBDD] rounded-md hover:border-[#C6A46A] hover:bg-[#C6A46A]/10 disabled:opacity-50 cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-[#C6A46A]" />
                    <span>
                      {generatingCustom
                        ? 'Preparing PDF...'
                        : lang === 'si'
                          ? 'PDF පෙරදසුන'
                          : 'Preview Custom PDF'}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={generatingCustom}
                    onClick={() => void handleCustomPortfolioAction('download')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] disabled:opacity-50 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>
                      {generatingCustom
                        ? 'Generating PDF...'
                        : lang === 'si'
                          ? 'අභිරුචි PDF බාගත කරන්න'
                          : 'Download Custom PDF'}
                    </span>
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        {/* Inline PDF Preview Viewer */}
        {previewUrl && (
          <section className="bg-[#211C1A] border-2 border-[#C6A46A] rounded-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 bg-[#151312] text-[#F3EBDD]">
              <div className="flex items-center gap-2 text-xs font-medium">
                <FileText className="w-4 h-4 text-[#C6A46A]" />
                <span>{previewTitle}</span>
              </div>
              <button
                type="button"
                onClick={closePreview}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-[#C6A46A]/45 rounded hover:bg-[#2A2522] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close Preview</span>
              </button>
            </div>
            <iframe
              title={previewTitle || 'Product Portfolio PDF Preview'}
              src={previewUrl}
              className="w-full h-[640px] bg-[#1C1917]"
            />
          </section>
        )}

        {/* Step 4: Catalogue Assistance / Registration Request Form */}
        <section className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-lg p-6 lg:p-8 space-y-5 luxury-card-shadow">
          <div className="border-b border-[#C6A46A]/20 pb-4">
            <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
              {lang === 'si'
                ? 'නිල නාමාවලියක් හෝ තොග මිල ලැයිස්තුවක් ඉල්ලන්න'
                : 'Request an Official Catalogue or Trade Edition'}
            </h2>
            <p className="text-xs text-[#D2C6B5] mt-0.5">
              {lang === 'si'
                ? 'අභිරුචි අපනයන නාමාවලියක් හෝ ලියාපදිංචි බාගත කිරීමේ ප්‍රවේශයක් අවශ්‍ය නම් පහත තොරතුරු එවන්න.'
                : 'Need a tailored trade dossier, wholesale quotation pack, or registration-verified edition? Submit your details for direct follow-up.'}
            </p>
          </div>

          {reqResult ? (
            <div className="p-6 bg-[#123D32] border border-[#C6A46A]/45 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-[#86EFAC] font-medium">
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {lang === 'si' ? 'නාමාවලි ඉල්ලීම සටහන් විය' : 'Catalogue Request Recorded'} ·{' '}
                  <span className="font-mono-tabular">{reqResult.requestRef}</span>
                </span>
              </div>
              <p className="text-xs text-[#D2C6B5]">
                {lang === 'si'
                  ? 'අපගේ කණ්ඩායම ඔබගේ ඉල්ලීම පරීක්ෂා කර අදාළ නිෂ්පාදන නාමාවලිය යොමු කරනු ඇත.'
                  : 'Our brand desk has received your request. You may also share this reference directly via WhatsApp for immediate dispatch.'}
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <a
                  href={buildWhatsAppLink(
                    `Hello ${activeBrandConfig?.name.en || selectedBrand} Desk,\nI submitted Catalogue Request Ref: ${reqResult.requestRef} (${reqResult.brandId.toUpperCase()} · ${reqResult.language.toUpperCase()}).\nName: ${reqResult.customerName}\nCountry: ${reqResult.country}`,
                    brandWhatsapp,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Share via WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={() => setReqResult(null)}
                  className="px-4 py-2 text-xs border border-[#C6A46A]/55 bg-transparent text-[#F3EBDD] rounded-md cursor-pointer"
                >
                  Submit Another Request
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRequestSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={reqName}
                    onChange={(e) => setReqName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={reqEmail}
                    onChange={(e) => setReqEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    Country *
                  </label>
                  <input
                    type="text"
                    required
                    value={reqCountry}
                    onChange={(e) => setReqCountry(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    Company / Organization (Optional)
                  </label>
                  <input
                    type="text"
                    value={reqCompany}
                    onChange={(e) => setReqCompany(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    WhatsApp / Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={reqWhatsapp}
                    onChange={(e) => setReqWhatsapp(e.target.value)}
                    placeholder="+94 77 ..."
                    className="w-full px-3 py-2 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                  Notes &amp; Requested Details
                </label>
                <textarea
                  rows={3}
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  placeholder="Share packaging format, destination country, or custom assortment preferences..."
                  className="w-full px-3 py-2 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded-md focus:outline-none focus:border-[#C6A46A]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-xs text-[#A99B88]">
                  Selected Scope:{' '}
                  <span className="font-medium uppercase text-[#C6A46A]">{selectedBrand}</span> ·{' '}
                  {docLang.toUpperCase()} · {customScope}
                </p>
                <button
                  type="submit"
                  disabled={submittingReq}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {submittingReq
                      ? 'Submitting...'
                      : lang === 'si'
                        ? 'නාමාවලි ඉල්ලීම යවන්න'
                        : 'Submit Catalogue Request'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

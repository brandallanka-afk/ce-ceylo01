import {useEffect, useState} from 'react';
import {ArrowLeft, Check, MessageCircle, Minus, Plus} from 'lucide-react';
import BrandLogo, {isOfficialLogoBrand} from '../components/BrandLogo';
import Breadcrumbs from '../components/Breadcrumbs';
import FaqSection from '../components/FaqSection';
import SafeImage from '../components/SafeImage';
import {useStore} from '../context/StoreContext';
import {getCeylomiraFaqs, getCeyvanaFaqs} from '../data/faqs';
import {submitServerOrder} from '../services/commerceApi';
import {
  buildSingleProductWhatsAppMessage,
  buildWhatsAppLink,
  formatMoney,
  resolveBrandWhatsappNumber,
} from '../utils/currency';
import {setProductStructuredData, updatePageSeo} from '../utils/seo';

interface ProductDetailPageProps {
  slug?: string;
}

export default function ProductDetailPage({slug}: ProductDetailPageProps) {
  const {
    lang,
    currency,
    t,
    navigate,
    addToCart,
    catalogProducts: products,
    commerceConfig,
    availableLanguages,
  } = useStore();
  const product = products.find((p) => p.slug === slug) ?? products[0];

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeImage, setActiveImage] = useState(product.mainImage);
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const [waOpen, setWaOpen] = useState(false);
  const [waName, setWaName] = useState('');
  const [waPhone, setWaPhone] = useState('');
  const [waAddress, setWaAddress] = useState('');
  const [waNotes, setWaNotes] = useState('');
  const [waBusy, setWaBusy] = useState(false);
  const [waError, setWaError] = useState('');
  const [waSavedRef, setWaSavedRef] = useState<string | null>(null);

  useEffect(() => {
    setSelectedIdx(0);
    setActiveImage(product.mainImage);
    setQty(1);
    setJustAdded(false);
    setWaSavedRef(null);
    setWaError('');
  }, [product]);

  useEffect(() => {
    const brandTitle = product.brandId === 'ceyvana' ? 'Ceyvana' : 'Ceylomira';
    const seoTitle =
      lang === 'si'
        ? `${product.name.si} (${product.origin.si}) | ${brandTitle}`
        : product.seoTitle || `${product.name.en} | ${brandTitle}`;
    const seoDesc =
      lang === 'si'
        ? `${product.description.si} ${product.tastingNotes.si}`
        : product.seoDescription || product.description.en;

    updatePageSeo({
      title: seoTitle,
      description: seoDesc,
      page: 'product',
      productSlug: product.slug,
      lang,
      ogType: 'product',
      image: product.mainImage,
      availableLangCodes: availableLanguages.map((l) => l.code),
    });
    setProductStructuredData(product, lang, currency);
    return () => setProductStructuredData(null);
  }, [product, lang, currency, availableLanguages]);

  const variant = product.variants[selectedIdx] ?? product.variants[0];
  const isCeyvana = product.brandId === 'ceyvana';
  const brandLabel = isCeyvana ? 'CEYVANA' : 'CEYLOMIRA';
  const accentBg = isCeyvana ? '#501C2B' : '#123D32';

  const brandWhatsappNumber = resolveBrandWhatsappNumber(product.brandId, commerceConfig);
  const unitPriceStr = formatMoney(variant.priceLkr, variant.priceUsd, currency);
  const lineTotalStr = formatMoney(variant.priceLkr * qty, variant.priceUsd * qty, currency);

  const whatsappMessage = buildSingleProductWhatsAppMessage({
    brandId: product.brandId,
    productName: product.name[lang] || product.name.en,
    packSize: variant.label,
    sku: variant.variantSku,
    quantity: qty,
    displayedUnitPrice: unitPriceStr,
    displayedLineTotal: lineTotalStr,
    orderRef: waSavedRef || undefined,
    customerName: waName.trim() || undefined,
    phone: waPhone.trim() || undefined,
    address: waAddress.trim() || undefined,
    notes: waNotes.trim() || undefined,
    lang,
  });

  const handleAdd = () => {
    addToCart(product, variant, qty);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  };

  const handleSaveWhatsappOrder = async () => {
    if (waBusy) return;
    setWaError('');
    if (waName.trim().length < 2 || waPhone.trim().length < 6 || waAddress.trim().length < 4) {
      setWaError(
        lang === 'si'
          ? 'කරුණාකර ඔබේ නම, දුරකථන අංකය සහ බෙදාහැරීමේ ලිපිනය ඇතුළත් කරන්න.'
          : 'Please enter your name, contact number, and delivery address.',
      );
      return;
    }
    setWaBusy(true);
    try {
      const created = await submitServerOrder({
        idempotencyKey: `wa-pdp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        currency,
        customerName: waName.trim(),
        email: '',
        phone: waPhone.trim(),
        country: 'Sri Lanka',
        address: waAddress.trim(),
        city: 'Direct Dispatch',
        postalCode: '00000',
        orderNotes: waNotes.trim() || undefined,
        deliveryMethod: 'local_standard',
        paymentMethod: 'whatsapp_order',
        items: [{productId: product.id, variantSku: variant.variantSku, qty}],
      });
      setWaSavedRef(created.orderRef);
    } catch (err) {
      setWaError(err instanceof Error ? err.message : 'Unable to prepare WhatsApp order.');
    } finally {
      setWaBusy(false);
    }
  };

  return (
    <div className="bg-[#151312] text-[#F3EBDD]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16 space-y-6">
        <Breadcrumbs
          items={[
            {label: t.nav.home, page: 'home'},
            {
              label: isCeyvana ? t.nav.ceyvana : t.nav.ceylomira,
              page: isCeyvana ? 'ceyvana' : 'ceylomira',
            },
            {label: product.name[lang] || product.name.en},
          ]}
        />

        <button
          type="button"
          onClick={() => navigate(isCeyvana ? 'ceyvana' : 'ceylomira')}
          className="inline-flex items-center gap-2 text-xs font-medium tracking-wider uppercase text-[#D2C6B5] hover:text-[#C6A46A] cursor-pointer min-h-[44px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>
            {t.pdp.backToStore} · {brandLabel}
          </span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* Left: Sticky Dark Luxury Gallery */}
          <div className="lg:col-span-6 lg:sticky lg:top-24 space-y-4">
            <div className="aspect-[4/3] bg-[#1C1917] border border-[#C6A46A]/30 rounded-md overflow-hidden luxury-card-shadow">
              <SafeImage
                src={activeImage}
                alt={`${product.name[lang] || product.name.en} — ${product.origin[lang] || product.origin.en}`}
                eager
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="w-full h-full object-cover"
                aspectClass="w-full h-full"
              />
            </div>

            {product.gallery.length > 1 && (
              <div className="flex items-center gap-3">
                {product.gallery.map((imgUrl, idx) => (
                  <button
                    key={imgUrl + idx}
                    type="button"
                    onClick={() => setActiveImage(imgUrl)}
                    className={`w-24 aspect-[4/3] rounded overflow-hidden border transition-opacity duration-150 cursor-pointer bg-[#1C1917] ${
                      activeImage === imgUrl
                        ? 'border-[#C6A46A] ring-1 ring-[#C6A46A] opacity-100'
                        : 'border-[#3B332E] opacity-65 hover:opacity-100'
                    }`}
                  >
                    <SafeImage
                      src={imgUrl}
                      alt={`${product.name[lang]} view ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Contiguous Purchase Dossier on Deep Onyx (#211C1A) */}
          <div className="lg:col-span-6 bg-[#211C1A] border border-[#C6A46A]/25 rounded-md p-6 sm:p-8 lg:p-10 space-y-6 luxury-card-shadow">
            <div className="space-y-2.5 border-b border-[#C6A46A]/25 pb-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] font-medium tracking-[0.2em] text-[#C6A46A] uppercase">
                  {brandLabel} · {product.category[lang]}
                </p>
                {isOfficialLogoBrand(product.brandId) && (
                  <BrandLogo brandId={product.brandId} size="sm" eager />
                )}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.6rem] font-medium text-[#F3EBDD] text-balance leading-tight">
                {product.name[lang]}
              </h1>
              <div className="pt-2 flex items-baseline justify-between gap-4">
                <span className="text-2xl sm:text-3xl font-medium font-mono-tabular text-[#C6A46A]">
                  {formatMoney(variant.priceLkr, variant.priceUsd, currency)}
                </span>
                <span className="text-xs font-mono-tabular text-[#A99B88]">
                  {t.pdp.stockAvailable.replace('{count}', String(variant.stockQuantity))}
                </span>
              </div>
            </div>

            <p className="text-sm sm:text-base text-[#D2C6B5] leading-relaxed">
              {product.description[lang]}
            </p>

            {/* Pack Size Variant Selection */}
            <div className="space-y-2.5">
              <label className="block text-[11px] font-medium tracking-[0.16em] uppercase text-[#D2C6B5]">
                {t.pdp.packSize}
              </label>
              <div className="flex flex-wrap gap-2.5">
                {product.variants.map((v, idx) => {
                  const selected = idx === selectedIdx;
                  return (
                    <button
                      key={v.variantSku}
                      type="button"
                      onClick={() => {
                        setSelectedIdx(idx);
                        setQty(1);
                      }}
                      className={`px-4 py-2.5 rounded border text-sm font-mono-tabular transition-colors duration-150 cursor-pointer min-h-[44px] ${
                        selected
                          ? 'bg-[#C6A46A] text-[#151312] border-[#C6A46A] font-medium'
                          : 'bg-[#2A2522] text-[#D2C6B5] border-[#3B332E] hover:border-[#C6A46A]/65 hover:text-[#F3EBDD]'
                      }`}
                    >
                      {v.label} · {formatMoney(v.priceLkr, v.priceUsd, currency)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity & Cart Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <div className="inline-flex items-center justify-between sm:justify-start border border-[#3B332E] bg-[#2A2522] rounded">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="w-11 h-11 inline-flex items-center justify-center hover:bg-[#362F2A] text-[#F3EBDD] transition-colors cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 text-sm font-mono-tabular font-semibold text-[#F3EBDD]">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(variant.stockQuantity, q + 1))}
                  aria-label="Increase quantity"
                  className="w-11 h-11 inline-flex items-center justify-center hover:bg-[#362F2A] text-[#F3EBDD] transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAdd}
                disabled={!variant.available || variant.stockQuantity <= 0}
                style={{backgroundColor: accentBg}}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 text-xs sm:text-sm font-medium tracking-[0.06em] text-[#F3EBDD] border border-[#C6A46A]/50 rounded hover:brightness-110 disabled:opacity-40 transition-all duration-150 cursor-pointer min-h-[44px]"
              >
                {justAdded ? (
                  <>
                    <Check className="w-4 h-4 text-[#C6A46A]" aria-hidden="true" />
                    <span>{t.pdp.addedFeedback}</span>
                  </>
                ) : (
                  <span>{t.pdp.addToCart}</span>
                )}
              </button>
            </div>

            {/* WhatsApp-First Direct Ordering Module */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setWaOpen((v) => !v)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-medium tracking-[0.06em] border border-[#C6A46A]/55 text-[#F3EBDD] rounded hover:border-[#C6A46A] hover:bg-[#C6A46A]/10 transition-colors duration-150 min-h-[44px] cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-[#C6A46A]" aria-hidden="true" />
                  <span>{t.pdp.whatsappEnquiry}</span>
                </button>
                <a
                  href={buildWhatsAppLink(whatsappMessage, brandWhatsappNumber)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-medium tracking-[0.06em] bg-[#2A2522] border border-[#C6A46A]/35 text-[#F3EBDD] rounded hover:bg-[#352F2B] transition-colors duration-150 min-h-[44px]"
                >
                  <span>Quick Open WhatsApp</span>
                </a>
              </div>

              {waOpen && (
                <div className="bg-[#1C1917] border border-[#C6A46A]/30 rounded p-4 space-y-3">
                  <p className="text-xs font-medium text-[#C6A46A]">
                    Direct WhatsApp Order Request ({brandLabel})
                  </p>
                  {waError && (
                    <p className="text-xs text-[#F3B0B6] bg-[#501C2B]/60 border border-[#C6A46A]/30 rounded px-3 py-2">
                      {waError}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      placeholder="Your full name *"
                      value={waName}
                      onChange={(e) => setWaName(e.target.value)}
                      className="px-3 py-2.5 text-xs bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded focus:outline-none focus:border-[#C6A46A] min-h-[40px]"
                    />
                    <input
                      type="tel"
                      placeholder="Contact / WhatsApp number *"
                      value={waPhone}
                      onChange={(e) => setWaPhone(e.target.value)}
                      className="px-3 py-2.5 text-xs bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded focus:outline-none focus:border-[#C6A46A] min-h-[40px]"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Delivery address *"
                    value={waAddress}
                    onChange={(e) => setWaAddress(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded focus:outline-none focus:border-[#C6A46A] min-h-[40px]"
                  />
                  <input
                    type="text"
                    placeholder="Additional instructions (optional)"
                    value={waNotes}
                    onChange={(e) => setWaNotes(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded focus:outline-none focus:border-[#C6A46A] min-h-[40px]"
                  />
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={waBusy}
                      onClick={() => void handleSaveWhatsappOrder()}
                      className="px-4 py-2.5 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] cursor-pointer disabled:opacity-50 min-h-[40px]"
                    >
                      {waBusy ? 'Preparing Order...' : 'Record New Order & Generate Message'}
                    </button>
                    {waSavedRef && (
                      <a
                        href={buildWhatsAppLink(whatsappMessage, brandWhatsappNumber)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium bg-[#123D32] border border-[#C6A46A]/55 text-[#F3EBDD] rounded min-h-[40px]"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-[#C6A46A]" aria-hidden="true" />
                        <span>Open WhatsApp ({waSavedRef})</span>
                      </a>
                    )}
                  </div>
                  <p className="text-[11px] text-[#A99B88]">
                    Opening WhatsApp records your order as New (pending team verification) and never auto-confirms payment or dispatch.
                  </p>
                </div>
              )}
            </div>

            {/* Technical Product Specifications Table */}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-6 border-t border-[#C6A46A]/20 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-[#C6A46A] font-medium">
                  {t.pdp.skuLabel}
                </dt>
                <dd className="font-mono-tabular font-medium text-[#F3EBDD] mt-0.5">
                  {variant.variantSku}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-[#C6A46A] font-medium">
                  {t.pdp.weightLabel}
                </dt>
                <dd className="font-mono-tabular font-medium text-[#F3EBDD] mt-0.5">
                  {variant.weightGrams}g
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-[#C6A46A] font-medium">
                  {t.pdp.originLabel}
                </dt>
                <dd className="font-medium text-[#F3EBDD] mt-0.5">{product.origin[lang]}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-[#C6A46A] font-medium">
                  {t.pdp.tastingNotesLabel}
                </dt>
                <dd className="text-[#D2C6B5] mt-0.5">{product.tastingNotes[lang]}</dd>
              </div>
              {product.ingredients && (product.ingredients[lang] || product.ingredients.en) && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-[#C6A46A] font-medium">
                    Ingredients
                  </dt>
                  <dd className="text-[#D2C6B5] mt-0.5">
                    {product.ingredients[lang] || product.ingredients.en}
                  </dd>
                </div>
              )}
              {product.storageInstructions &&
                (product.storageInstructions[lang] || product.storageInstructions.en) && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-[#C6A46A] font-medium">
                      Storage Instructions
                    </dt>
                    <dd className="text-[#D2C6B5] mt-0.5">
                      {product.storageInstructions[lang] || product.storageInstructions.en}
                    </dd>
                  </div>
                )}
              {product.packagingType &&
                (product.packagingType[lang] || product.packagingType.en) && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-[#C6A46A] font-medium">
                      Packaging Type
                    </dt>
                    <dd className="text-[#D2C6B5] mt-0.5">
                      {product.packagingType[lang] || product.packagingType.en}
                    </dd>
                  </div>
                )}
              {product.exportSpecs?.shelfLife && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-[#C6A46A] font-medium">
                    Shelf Life
                  </dt>
                  <dd className="text-[#D2C6B5] mt-0.5">{product.exportSpecs.shelfLife}</dd>
                </div>
              )}
            </dl>

            <p className="text-xs text-[#A99B88] bg-[#25201D] border border-[#C6A46A]/20 rounded p-3.5">
              {t.pdp.shippingNotice}
            </p>
          </div>
        </div>
      </div>

      <FaqSection
        title={
          isCeyvana
            ? lang === 'si'
              ? 'සෙයිවානා කුළුබඩු උපදෙස්'
              : 'Ceyvana Origin & Storage Questions'
            : lang === 'si'
              ? 'සෙයිලෝමිරා තේ සැකසීමේ උපදෙස්'
              : 'Ceylomira Origin & Brewing Questions'
        }
        faqs={isCeyvana ? getCeyvanaFaqs(lang) : getCeylomiraFaqs(lang)}
        surfaceClass="bg-[#211C1A]"
      />
    </div>
  );
}

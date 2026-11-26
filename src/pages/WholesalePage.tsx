import {FormEvent, useEffect, useMemo, useState} from 'react';
import {
  CheckCircle2,
  Copy,
  FileDown,
  Globe,
  MessageCircle,
  Search,
} from 'lucide-react';
import BrandLogo, {isOfficialLogoBrand} from '../components/BrandLogo';
import Breadcrumbs from '../components/Breadcrumbs';
import FaqSection from '../components/FaqSection';
import {useStore} from '../context/StoreContext';
import {getWholesaleFaqs} from '../data/faqs';
import {
  type ExportCatalogResponse,
  fetchExportCatalog,
  submitInternationalEnquiry,
  type TrackedEnquiryResult,
  trackInternationalEnquiry,
} from '../services/commerceApi';
import type {InternationalEnquiryRecord} from '../types/admin';
import type {InternationalBusinessType, Product} from '../types/commerce';
import {
  buildWhatsAppLink,
  formatMoney,
  formatSingleCurrency,
} from '../utils/currency';
import {updatePageSeo} from '../utils/seo';

type WholesaleTab = 'enquiry' | 'catalogue' | 'track';

const BUSINESS_TYPES: InternationalBusinessType[] = [
  'Importer',
  'Distributor',
  'Wholesaler',
  'Retailer',
  'Private Label Buyer',
  'Other',
];

const DEFAULT_PACKAGING_OPTIONS = [
  '1kg nitrogen-flushed foil pouch',
  '5kg multi-wall barrier sack',
  '25kg bulk export master carton / kraft sack',
  'Private label retail tins / pouches (MOQ applies)',
  'Consolidated multi-SKU courier carton',
];

function escapeHtml(raw: unknown): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function downloadHtmlBlob(filename: string, html: string) {
  const blob = new Blob([html], {type: 'text/html;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function WholesalePage() {
  const {
    lang,
    t,
    navigate,
    currency,
    availableCurrencies,
    availableLanguages,
    catalogProducts,
    commerceConfig,
  } = useStore();
  const isSi = lang === 'si';

  const [activeTab, setActiveTab] = useState<WholesaleTab>('enquiry');
  const [exportCatalog, setExportCatalog] = useState<ExportCatalogResponse | null>(null);
  const [catalogBrandFilter, setCatalogBrandFilter] = useState<'all' | 'ceyvana' | 'ceylomira'>('all');
  const [policyCountryPreview, setPolicyCountryPreview] = useState('United Kingdom');

  // Enquiry Form State
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('United Kingdom');
  const [destinationCountry, setDestinationCountry] = useState('United Kingdom');
  const [website, setWebsite] = useState('');
  const [businessType, setBusinessType] = useState<InternationalBusinessType>('Importer');
  const [brandScope, setBrandScope] = useState('Ceyvana & Ceylomira');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [requiredQuantities, setRequiredQuantities] = useState('50 units / 25kg trial order');
  const [packagingRequirements, setPackagingRequirements] = useState(
    DEFAULT_PACKAGING_OPTIONS[0],
  );
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdEnquiry, setCreatedEnquiry] = useState<InternationalEnquiryRecord | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  // Enquiry Tracking State
  const [trackRef, setTrackRef] = useState('');
  const [trackCred, setTrackCred] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState('');
  const [trackedResult, setTrackedResult] = useState<TrackedEnquiryResult | null>(null);

  useEffect(() => {
    updatePageSeo({
      title: isSi
        ? 'ජාත්‍යන්තර තොග සහ අපනයන වෙළඳාම | සෙයිලෝන් හෙරිටේජ් හවුස්'
        : 'International Wholesale & Export Commerce | Ceylon Heritage House',
      description: isSi
        ? 'විදේශීය ගැනුම්කරුවන් සඳහා සෙයිවානා කුළුබඩු සහ සෙයිලෝමිරා තේ අපනයන පිරිවිතර, MOQ සහ මිල ගණන් ඉල්ලීම්.'
        : 'Submit international buyer enquiries, download Ceylon spice and tea export specifications, review country shipping policies, and track wholesale quotations.',
      page: 'wholesale',
      lang,
      availableLangCodes: availableLanguages.map((l) => l.code),
    });
  }, [lang, isSi, availableLanguages]);

  useEffect(() => {
    void fetchExportCatalog()
      .then((res) => setExportCatalog(res))
      .catch(() => {
        // Fallback smoothly to StoreContext catalogProducts & commerceConfig
      });
  }, []);

  const packagingChoices = useMemo(() => {
    const configured = commerceConfig?.exportConfig?.packagingFormats;
    return configured && configured.length > 0 ? configured : DEFAULT_PACKAGING_OPTIONS;
  }, [commerceConfig]);

  const internationalRates = useMemo(() => {
    return (
      exportCatalog?.internationalRates ??
      commerceConfig?.shipping.internationalRates ??
      []
    );
  }, [exportCatalog, commerceConfig]);

  const exportProducts = useMemo(() => {
    const base = exportCatalog?.products?.length ? exportCatalog.products : catalogProducts;
    return base.filter((p) => !p.isArchived && p.exportable !== false);
  }, [exportCatalog, catalogProducts]);

  const filteredExportProducts = useMemo(() => {
    if (catalogBrandFilter === 'all') {
      return exportProducts;
    }
    return exportProducts.filter((p) => p.brandId === catalogBrandFilter);
  }, [exportProducts, catalogBrandFilter]);

  const resolveCountryPolicy = (targetCountry: string): string | undefined => {
    const trimmed = targetCountry.trim().toLowerCase();
    if (!trimmed) return undefined;
    const exact = internationalRates.find((r) => r.country.toLowerCase() === trimmed);
    if (exact?.policyNote) return exact.policyNote;
    const fallback = internationalRates.find(
      (r) => r.country.toLowerCase() === 'rest of world',
    );
    return fallback?.policyNote;
  };

  const activeDestinationPolicy = resolveCountryPolicy(destinationCountry);
  const previewPolicy = resolveCountryPolicy(policyCountryPreview);
  const usdToLkrRate = commerceConfig?.shipping.usdToLkrRate || 300;
  const activeCurrencyCfg = availableCurrencies.find((c) => c.code === currency);

  const toggleProductInterest = (productName: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productName)
        ? prev.filter((item) => item !== productName)
        : [...prev, productName],
    );
  };

  const handleSubmitEnquiry = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (website.trim() && !/^https?:\/\/.+/i.test(website.trim())) {
      setFormError('Website must begin with https:// or http:// (or leave blank).');
      return;
    }

    setSubmitting(true);
    try {
      const created = await submitInternationalEnquiry({
        type: 'export',
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        country: country.trim(),
        website: website.trim() || undefined,
        businessType,
        brandInterest: brandScope,
        productInterests: selectedProducts,
        requiredQuantities: requiredQuantities.trim(),
        packagingRequirements: packagingRequirements.trim(),
        destinationCountry: destinationCountry.trim(),
        message: message.trim(),
      });

      // Best-effort Firestore mirror (without throwing if client offline or restricted)
      try {
        const {submitPublicEnquiry} = await import('../services/firestoreService');
        await submitPublicEnquiry({
          type: 'export',
          enquiryRef: created.enquiryRef,
          brandInterest: created.brandInterest,
          contactName: created.contactName,
          companyName: created.companyName,
          email: created.email,
          phone: created.phone,
          country: created.country,
          destinationCountry: created.destinationCountry,
          website: created.website,
          businessType: created.businessType,
          productInterests: created.productInterests,
          requiredQuantities: created.requiredQuantities,
          packagingRequirements: created.packagingRequirements,
          volumeBand: created.requiredQuantities,
          message: created.message,
        });
      } catch {
        // Authoritative backend persistence succeeded
      }

      setCreatedEnquiry(created);
      setTrackRef(created.enquiryRef);
      setTrackCred(created.trackingToken);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to submit international buyer enquiry.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackLookup = async (e: FormEvent) => {
    e.preventDefault();
    setTrackError('');
    setTrackedResult(null);
    if (!trackRef.trim() || !trackCred.trim()) {
      setTrackError('Enter both your Enquiry Reference and Business Email or Tracking Token.');
      return;
    }
    setTrackLoading(true);
    try {
      const result = await trackInternationalEnquiry(trackRef.trim(), trackCred.trim());
      setTrackedResult(result);
    } catch (err) {
      setTrackError(err instanceof Error ? err.message : 'Enquiry lookup failed.');
    } finally {
      setTrackLoading(false);
    }
  };

  const formatExportRate = (usdAmount: number): string => {
    return formatMoney(
      Math.round(usdAmount * usdToLkrRate),
      usdAmount,
      currency,
      availableCurrencies,
    );
  };

  const handleDownloadProductSpec = (product: Product) => {
    const exportUsd = product.exportPriceUsd ?? product.variants[0]?.priceUsd ?? 10;
    const rateInActive = formatExportRate(exportUsd);
    const moq = product.moqUnits ?? commerceConfig?.exportConfig?.defaultMoqUnits ?? 25;
    const bulkPacks = (
      product.bulkPackSizes && product.bulkPackSizes.length > 0
        ? product.bulkPackSizes
        : packagingChoices
    )
      .map((s) => `<li>${escapeHtml(s)}</li>`)
      .join('');

    const variantRows = product.variants
      .map(
        (v) =>
          `<tr><td>${escapeHtml(v.variantSku)}</td><td>${escapeHtml(v.label)}</td><td>${v.weightGrams}g</td><td>$${v.priceUsd.toFixed(2)}</td><td>LKR ${v.priceLkr.toLocaleString('en-US')}</td></tr>`,
      )
      .join('');

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(product.name.en)} — Export Specification Sheet</title>
<style>
  body { font-family: Georgia, serif; color: #1E1D1B; background: #FAF8F4; margin: 40px auto; max-width: 820px; padding: 0 24px; line-height: 1.55; }
  h1, h2 { margin-bottom: 8px; }
  .meta { font-family: monospace; font-size: 13px; color: #555; border-bottom: 1px solid #D8D1C4; padding-bottom: 12px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; background: #fff; }
  th, td { border: 1px solid #D8D1C4; padding: 8px 10px; text-align: left; }
  th { background: #F2EDE2; }
  .note { background: #fff; border: 1px solid #D8D1C4; padding: 14px; font-size: 13px; margin-top: 20px; }
</style>
</head>
<body>
  <p style="text-transform:uppercase;letter-spacing:2px;font-size:11px;color:#7A1F28;">Ceylon Heritage House · Export Product Specification Sheet</p>
  <h1>${escapeHtml(product.name.en)}</h1>
  <div class="meta">Brand: ${escapeHtml(product.brandId.toUpperCase())} | Master SKU: ${escapeHtml(product.sku)} | Origin: ${escapeHtml(product.origin.en)} | Export Reference: USD ${exportUsd.toFixed(2)} (${escapeHtml(rateInActive)})</div>
  <p>${escapeHtml(product.description.en)}</p>
  <p><strong>Tasting &amp; Aromatic Profile:</strong> ${escapeHtml(product.tastingNotes.en)}</p>
  <h2>Product Specifications</h2>
  <ul>
    <li><strong>Grade / Botanical Profile:</strong> ${escapeHtml(product.exportSpecs?.botanicalOrGrade || 'Single-origin Ceylon grade')}</li>
    <li><strong>Indicative Shelf Life:</strong> ${escapeHtml(product.exportSpecs?.shelfLife || '24 months in sealed barrier storage')}</li>
    <li><strong>Minimum Order Quantity (MOQ):</strong> ${moq} units (mixed-SKU trade trial enquiries considered)</li>
    <li><strong>Packaging Notes:</strong> ${escapeHtml(product.exportSpecs?.packagingNote || 'Moisture-barrier export packing')}</li>
  </ul>
  <h2>Available Packaging Sizes</h2>
  <ul>${bulkPacks}</ul>
  <h2>Standard Pack Variants</h2>
  <table>
    <thead><tr><th>SKU</th><th>Size</th><th>Net Weight</th><th>Retail Ref (USD)</th><th>Retail Ref (LKR)</th></tr></thead>
    <tbody>${variantRows}</tbody>
  </table>
  <div class="note">
    <strong>Trade &amp; Customs Notice:</strong> Commercial invoices and packing lists are prepared per confirmed order. Final transit times, freight charges, and any destination customs duties or import requirements depend on destination regulations and confirmed carrier booking. Export prices shown are indicative references subject to official written quotation.
  </div>
</body>
</html>`;

    downloadHtmlBlob(`${product.slug}-export-spec.html`, html);
  };

  const handleDownloadFullCatalogue = () => {
    const rows = exportProducts
      .map((p) => {
        const expUsd = p.exportPriceUsd ?? p.variants[0]?.priceUsd ?? 10;
        const moq = p.moqUnits ?? commerceConfig?.exportConfig?.defaultMoqUnits ?? 25;
        const packs = (p.bulkPackSizes?.length ? p.bulkPackSizes : packagingChoices).join(', ');
        return `<tr>
          <td>${escapeHtml(p.brandId.toUpperCase())}</td>
          <td><strong>${escapeHtml(p.name.en)}</strong><br/><small>${escapeHtml(p.sku)}</small></td>
          <td>${escapeHtml(p.origin.en)}</td>
          <td>${escapeHtml(p.exportSpecs?.botanicalOrGrade || 'Standard Ceylon Grade')}</td>
          <td>${moq} units</td>
          <td>$${expUsd.toFixed(2)}</td>
          <td>${escapeHtml(packs)}</td>
        </tr>`;
      })
      .join('');

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Ceylon Heritage House — Export Product Catalogue</title>
<style>
  body { font-family: Georgia, serif; color: #1E1D1B; background: #FAF8F4; margin: 36px auto; max-width: 1020px; padding: 0 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; background: #fff; }
  th, td { border: 1px solid #D8D1C4; padding: 10px; text-align: left; vertical-align: top; }
  th { background: #1E1D1B; color: #FAF8F4; }
  .note { margin-top: 20px; padding: 14px; background: #fff; border: 1px solid #D8D1C4; font-size: 13px; }
</style>
</head>
<body>
  <h1>Ceylon Heritage House — Ceyvana &amp; Ceylomira Export Catalogue</h1>
  <p>Generated ${new Date().toISOString().slice(0, 10)} · Indicative FOB Colombo USD reference rates (subject to written confirmation based on volume and packaging).</p>
  <table>
    <thead>
      <tr><th>Brand</th><th>Product &amp; SKU</th><th>Origin</th><th>Grade / Botanical</th><th>MOQ</th><th>Export Ref (USD)</th><th>Bulk Packaging Formats</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="note">
    <strong>Shipping &amp; Currency Policy:</strong> Multi-currency displays reflect administrator-configured exchange rates (${escapeHtml(commerceConfig?.exportConfig?.fxServiceNote || 'no unverified live auto-rates assumed')}). International transit times and destination customs duties are confirmed strictly upon formal quotation.
  </div>
</body>
</html>`;

    downloadHtmlBlob(`ceylon-heritage-export-catalogue-${new Date().toISOString().slice(0, 10)}.html`, html);
  };

  const whatsappSummary = createdEnquiry
    ? `International Buyer Enquiry (${createdEnquiry.enquiryRef})\nCompany: ${createdEnquiry.companyName}\nType: ${createdEnquiry.businessType}\nContact: ${createdEnquiry.contactName}\nDestination: ${createdEnquiry.destinationCountry}\nBrands: ${createdEnquiry.brandInterest}\nProducts: ${createdEnquiry.productInterests.join(', ') || 'General'}\nQuantities: ${createdEnquiry.requiredQuantities}\nPackaging: ${createdEnquiry.packagingRequirements}\n\n(Note: Quotation is pending official written review from the Ceylon Heritage export desk.)`
    : `Wholesale & Export Quotation Request\nCompany: ${companyName || 'N/A'}\nBusiness Type: ${businessType}\nContact: ${contactName || 'Trade Buyer'}\nDestination: ${destinationCountry}\nBrands: ${brandScope}\nQuantities: ${requiredQuantities}\nPackaging: ${packagingRequirements}`;

  const whatsappExportUrl = buildWhatsAppLink(whatsappSummary, commerceConfig?.whatsappNumber);

  return (
    <div className="bg-[#1C1917] text-[#F3EBDD]">
      {/* Hero Banner */}
      <section className="bg-[#151312] text-[#F3EBDD] py-14 lg:py-20 border-b border-[#C6A46A]/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
          <Breadcrumbs tone="light" items={[{label: t.nav.home, page: 'home'}, {label: t.nav.wholesale}]} />
          <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-[#C6A46A]">
            {isSi ? 'ජාත්‍යන්තර වෙළඳ සහ අපනයන අංශය' : 'International Commerce & Export Desk'}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-medium text-[#F3EBDD] max-w-3xl text-balance leading-tight">
            {isSi
              ? 'විදේශීය ගැනුම්කරුවන් සහ තොග අපනයන සේවා'
              : 'Global Trade Enquiries, Export Specs & Country Quotations'}
          </h1>
          <p className="text-sm sm:text-base text-[#D2C6B5] max-w-2xl leading-relaxed">
            {isSi
              ? 'ආනයනකරුවන්, බෙදාහරින්නන් සහ පුද්ගලික ලේබල් ගැනුම්කරුවන් සඳහා සෙයිවානා කුළුබඩු සහ සෙයිලෝමිරා තේ අපනයන මිල ගණන්.'
              : 'Built for importers, distributors, retailers, wholesalers, and private-label partners sourcing single-origin Ceyvana spices and Ceylomira tea directly from Sri Lanka.'}
          </p>

          {/* Sub-navigation Tabs */}
          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('enquiry')}
              className={`px-4 py-2.5 text-xs font-medium tracking-[0.06em] rounded border transition-colors cursor-pointer min-h-[40px] ${
                activeTab === 'enquiry'
                  ? 'bg-[#C6A46A] text-[#151312] border-[#C6A46A]'
                  : 'bg-[#211C1A] border-[#C6A46A]/35 text-[#F3EBDD] hover:border-[#C6A46A]'
              }`}
            >
              {isSi ? 'විදේශීය ගැනුම්කරු විමසුම' : '1. Buyer Enquiry & Quotation'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('catalogue')}
              className={`px-4 py-2.5 text-xs font-medium tracking-[0.06em] rounded border transition-colors cursor-pointer min-h-[40px] ${
                activeTab === 'catalogue'
                  ? 'bg-[#C6A46A] text-[#151312] border-[#C6A46A]'
                  : 'bg-[#211C1A] border-[#C6A46A]/35 text-[#F3EBDD] hover:border-[#C6A46A]'
              }`}
            >
              {isSi ? 'අපනයන නාමාවලිය සහ පිරිවිතර' : '2. Export Catalogue & Spec Sheets'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('track')}
              className={`px-4 py-2.5 text-xs font-medium tracking-[0.06em] rounded border transition-colors cursor-pointer min-h-[40px] ${
                activeTab === 'track'
                  ? 'bg-[#C6A46A] text-[#151312] border-[#C6A46A]'
                  : 'bg-[#211C1A] border-[#C6A46A]/35 text-[#F3EBDD] hover:border-[#C6A46A]'
              }`}
            >
              {isSi ? 'විමසුම් තත්ත්වය පරීක්ෂා කරන්න' : '3. Track Enquiry & Quotation'}
            </button>
          </div>
        </div>
      </section>

      {/* TAB 1: INTERNATIONAL BUYER ENQUIRY FORM */}
      {activeTab === 'enquiry' && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-lg p-6 space-y-4 luxury-card-shadow">
              <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                {isSi ? 'අපනයන සූදානම සහ ප්‍රතිපත්ති' : 'Export Supply & Currency Policy'}
              </h2>
              <ul className="space-y-3 text-sm text-[#D2C6B5]">
                <li>
                  <strong className="font-medium text-[#F3EBDD]">Packaging Formats:</strong>{' '}
                  {packagingChoices.join(' · ')}
                </li>
                <li>
                  <strong className="font-medium text-[#F3EBDD]">Trade Documentation:</strong> Commercial
                  invoice, packing list, and export dispatch records prepared per confirmed
                  shipment requirements.
                </li>
                <li>
                  <strong className="font-medium text-[#F3EBDD]">MOQ &amp; Currency Guidance:</strong>{' '}
                  {commerceConfig?.exportConfig?.ratePolicyNote ||
                    'Indicative export rates depend on pack format and destination.'}{' '}
                  Active display currency:{' '}
                  <span className="font-mono-tabular font-medium text-[#C6A46A]">{currency}</span> (
                  {activeCurrencyCfg?.ratePerUsd
                    ? `1 USD = ${activeCurrencyCfg.ratePerUsd} ${currency} configured`
                    : 'admin configured'}
                  ).
                </li>
                <li>
                  <strong className="font-medium text-[#F3EBDD]">Shipping &amp; Customs Notice:</strong> Freight
                  quotations are issued per destination. We do not guarantee transit times or
                  destination import duties prior to carrier and customs verification.
                </li>
              </ul>
            </div>

            <div className="bg-[#123D32] text-[#F3EBDD] border border-[#C6A46A]/40 rounded-lg p-6 space-y-4 luxury-card-shadow">
              <div className="flex items-center gap-2.5">
                <MessageCircle className="w-5 h-5 text-[#C6A46A]" aria-hidden="true" />
                <h3 className="font-display text-2xl font-medium text-[#F3EBDD]">
                  {isSi ? 'WhatsApp අපනයන සම්බන්ධතාව' : 'Colombo Trade Desk on WhatsApp'}
                </h3>
              </div>
              <p className="text-sm text-[#D2C6B5] leading-relaxed">
                {isSi
                  ? 'තොග විමසුම් සඳහා WhatsApp හරහා සම්බන්ධ විය හැක. නිල ලිඛිත මිල ගණන් තහවුරු කිරීමෙන් පසුව පමණක් ඇණවුම් ස්ථිර වේ.'
                  : 'Discuss packaging options and seasonal harvest availability directly. Quotations are only binding after official review from our export team.'}
              </p>
              <a
                href={whatsappExportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] transition-colors"
              >
                {isSi ? 'WhatsApp මගින් විමසන්න' : 'Message Export Desk'}
              </a>
            </div>
          </div>

          <div className="lg:col-span-7 bg-[#211C1A] border border-[#C6A46A]/25 rounded-lg p-6 sm:p-8 luxury-card-shadow">
            {createdEnquiry ? (
              <div className="py-4 space-y-5">
                <div className="flex items-center gap-2.5 text-[#86EFAC]">
                  <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                  <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                    {isSi
                      ? 'ජාත්‍යන්තර විමසුම සටහන් විය'
                      : 'International Buyer Enquiry Recorded'}
                  </h2>
                </div>

                <div className="bg-[#151312] border border-[#C6A46A]/30 rounded-md p-4 space-y-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-[#A99B88]">Enquiry Reference Number</p>
                      <p className="font-mono-tabular text-lg font-medium text-[#C6A46A]">
                        {createdEnquiry.enquiryRef}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          `Ref: ${createdEnquiry.enquiryRef} | Token: ${createdEnquiry.trackingToken}`,
                        );
                        setCopiedRef(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#C6A46A]/45 bg-[#2A2522] text-[#F3EBDD] rounded hover:bg-[#352F2B] cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#C6A46A]" />
                      <span>{copiedRef ? 'Copied' : 'Copy Ref & Token'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-[#A99B88]">
                    Tracking Token:{' '}
                    <span className="font-mono-tabular font-medium text-[#F3EBDD]">
                      {createdEnquiry.trackingToken}
                    </span>
                  </p>
                  <p className="text-xs text-[#A99B88]">
                    Destination: {createdEnquiry.destinationCountry} · Business Type:{' '}
                    {createdEnquiry.businessType}
                  </p>
                </div>

                <p className="text-xs text-[#D2C6B5] leading-relaxed">
                  Keep your Enquiry Reference Number and business email or tracking token to check
                  administrator responses and country-specific quotations. Opening WhatsApp does not
                  confirm pricing or shipment allocation.
                </p>

                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('track')}
                    className="px-5 py-2.5 text-sm font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] cursor-pointer"
                  >
                    Track This Enquiry
                  </button>
                  <a
                    href={whatsappExportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 text-sm font-medium bg-[#123D32] border border-[#C6A46A]/55 text-[#F3EBDD] rounded-md hover:brightness-110"
                  >
                    Follow Up on WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => setCreatedEnquiry(null)}
                    className="px-5 py-2.5 text-sm font-medium border border-[#C6A46A]/50 text-[#F3EBDD] rounded-md hover:bg-[#C6A46A]/10 cursor-pointer"
                  >
                    Submit Another Enquiry
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitEnquiry} className="space-y-5">
                <div>
                  <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                    {isSi
                      ? 'ජාත්‍යන්තර ගැනුම්කරු මිල ගණන් පෝරමය'
                      : 'International Buyer & Wholesale Enquiry Form'}
                  </h2>
                  <p className="text-xs text-[#A99B88] mt-1">
                    Receive a traceable reference number and tailored destination quotation from
                    our trade team.
                  </p>
                </div>

                {formError && (
                  <div className="p-3 text-xs bg-[#501C2B]/60 border border-[#C6A46A]/40 text-[#F3B0B6] rounded-md">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="intl-company"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      Company Name *
                    </label>
                    <input
                      id="intl-company"
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="intl-contact"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      Contact Person *
                    </label>
                    <input
                      id="intl-contact"
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="intl-email"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      Business Email *
                    </label>
                    <input
                      id="intl-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="intl-country"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      Buyer Country *
                    </label>
                    <input
                      id="intl-country"
                      type="text"
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="intl-phone"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      Phone / WhatsApp
                    </label>
                    <input
                      id="intl-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="intl-website"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      Website (Optional — https:// or http://)
                    </label>
                    <input
                      id="intl-website"
                      type="url"
                      placeholder="https://company.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="intl-btype"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      Business Type *
                    </label>
                    <select
                      id="intl-btype"
                      value={businessType}
                      onChange={(e) =>
                        setBusinessType(e.target.value as InternationalBusinessType)
                      }
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    >
                      {BUSINESS_TYPES.map((bt) => (
                        <option key={bt} value={bt}>
                          {bt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="intl-brand"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      Brand Focus
                    </label>
                    <select
                      id="intl-brand"
                      value={brandScope}
                      onChange={(e) => setBrandScope(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    >
                      <option value="Ceyvana & Ceylomira">Ceyvana &amp; Ceylomira</option>
                      <option value="Ceyvana Spices">Ceyvana Spices</option>
                      <option value="Ceylomira Tea">Ceylomira Tea</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="intl-dest"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      Destination Country *
                    </label>
                    <input
                      id="intl-dest"
                      type="text"
                      list="export-destination-list"
                      required
                      value={destinationCountry}
                      onChange={(e) => setDestinationCountry(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    />
                    <datalist id="export-destination-list">
                      {internationalRates
                        .filter((r) => r.enabled)
                        .map((r) => (
                          <option key={r.country} value={r.country} />
                        ))}
                    </datalist>
                  </div>
                </div>

                {activeDestinationPolicy && (
                  <div className="p-3 text-xs bg-[#151312] border border-[#C6A46A]/25 rounded-md text-[#D2C6B5]">
                    <strong className="text-[#C6A46A]">
                      Shipping Policy ({destinationCountry}):
                    </strong>{' '}
                    {activeDestinationPolicy}
                  </div>
                )}

                <div>
                  <span className="block text-xs font-medium text-[#D2C6B5] mb-2">
                    Product Interests (Select products of interest)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 bg-[#151312] border border-[#3B332E] rounded-md">
                    {exportProducts.map((p) => {
                      const label = p.name.en;
                      const moq =
                        p.moqUnits ?? commerceConfig?.exportConfig?.defaultMoqUnits ?? 25;
                      return (
                        <label
                          key={p.id}
                          className="flex items-start gap-2 text-xs cursor-pointer py-0.5 text-[#F3EBDD]"
                        >
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(label)}
                            onChange={() => toggleProductInterest(label)}
                            className="mt-0.5 accent-[#C6A46A]"
                          />
                          <span>
                            <span className="font-medium text-[#F3EBDD]">{label}</span>{' '}
                            <span className="text-[#D2C6B5] font-mono-tabular">
                              (MOQ {moq})
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="intl-qty"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      Required Quantities *
                    </label>
                    <input
                      id="intl-qty"
                      type="text"
                      required
                      value={requiredQuantities}
                      onChange={(e) => setRequiredQuantities(e.target.value)}
                      placeholder="e.g. 100kg mixed grades or 200 retail tins"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="intl-pack"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      Packaging Requirements *
                    </label>
                    <input
                      id="intl-pack"
                      type="text"
                      list="export-packaging-list"
                      required
                      value={packagingRequirements}
                      onChange={(e) => setPackagingRequirements(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    />
                    <datalist id="export-packaging-list">
                      {packagingChoices.map((fmt) => (
                        <option key={fmt} value={fmt} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="intl-message"
                    className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                  >
                    Shipping Port, Incoterm Preference &amp; Message *
                  </label>
                  <textarea
                    id="intl-message"
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Share destination port or airport, private label artwork status, or sampling questions..."
                    className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 text-sm font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Submitting Enquiry...' : 'Submit International Enquiry'}
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {/* TAB 2: EXPORT CATALOGUE & DOWNLOADABLE PRODUCT INFORMATION SHEETS */}
      {activeTab === 'catalogue' && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#C6A46A]/25 pb-6">
            <div className="space-y-1">
              <h2 className="font-display text-3xl font-medium text-[#F3EBDD]">
                Export Product Catalogue &amp; Specifications
              </h2>
              <p className="text-sm text-[#D2C6B5]">
                Download product specification sheets, review minimum order quantities (MOQs), and
                compare indicative export pricing in{' '}
                <span className="font-mono-tabular font-medium text-[#C6A46A]">{currency}</span>.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'ceyvana', 'ceylomira'] as const).map((brandKey) => (
                <button
                  key={brandKey}
                  type="button"
                  onClick={() => setCatalogBrandFilter(brandKey)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md border cursor-pointer transition-colors ${
                    catalogBrandFilter === brandKey
                      ? brandKey === 'ceyvana'
                        ? 'bg-[#30211D] text-[#C6A46A] border-[#C6A46A] ring-1 ring-[#C6A46A]/45'
                        : brandKey === 'ceylomira'
                          ? 'bg-[#123D32] text-[#C6A46A] border-[#C6A46A] ring-1 ring-[#C6A46A]/45'
                          : 'bg-[#2A2522] text-[#C6A46A] border-[#C6A46A] ring-1 ring-[#C6A46A]/45'
                      : 'bg-[#211C1A] text-[#F3EBDD] border-[#C6A46A]/30 hover:border-[#C6A46A]'
                  }`}
                >
                  {brandKey !== 'all' && (
                    <BrandLogo brandId={brandKey} size="2xs" sheen={false} animated={false} />
                  )}
                  <span>
                    {brandKey === 'all'
                      ? 'All Brands'
                      : brandKey === 'ceyvana'
                        ? 'Ceyvana Spices'
                        : 'Ceylomira Tea'}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={handleDownloadFullCatalogue}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#123D32] border border-[#C6A46A]/55 text-[#F3EBDD] rounded-md hover:brightness-110 cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-[#C6A46A]" />
                <span>Download Full Export Catalogue</span>
              </button>
            </div>
          </div>

          {/* Country Shipping Policy Checker */}
          <div className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-lg p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center luxury-card-shadow">
            <div className="md:col-span-4 flex items-center gap-2.5">
              <Globe className="w-5 h-5 text-[#C6A46A]" />
              <div>
                <p className="text-xs font-medium text-[#F3EBDD]">
                  Destination Shipping Policy Lookup
                </p>
                <p className="text-[11px] text-[#A99B88]">
                  Admin-configured country policy notes
                </p>
              </div>
            </div>
            <div className="md:col-span-3">
              <select
                value={policyCountryPreview}
                onChange={(e) => setPolicyCountryPreview(e.target.value)}
                aria-label="Select destination country for policy lookup"
                className="w-full px-3 py-2 text-xs bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md"
              >
                {internationalRates
                  .filter((r) => r.enabled)
                  .map((r) => (
                    <option key={r.country} value={r.country}>
                      {r.country}
                    </option>
                  ))}
              </select>
            </div>
            <div className="md:col-span-5 text-xs text-[#D2C6B5]">
              {previewPolicy ||
                'Shipping quotations issued per confirmed commercial invoice and packing list. Transit times and duties vary by destination.'}
            </div>
          </div>

          {/* Export Product Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredExportProducts.map((product) => {
              const expUsd = product.exportPriceUsd ?? product.variants[0]?.priceUsd ?? 10;
              const moq =
                product.moqUnits ?? commerceConfig?.exportConfig?.defaultMoqUnits ?? 25;
              const bulkPacks =
                product.bulkPackSizes && product.bulkPackSizes.length > 0
                  ? product.bulkPackSizes
                  : packagingChoices.slice(0, 3);
              return (
                <article
                  key={product.id}
                  className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-lg p-6 flex flex-col justify-between gap-5 luxury-card-shadow"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {isOfficialLogoBrand(product.brandId) && (
                            <BrandLogo
                              brandId={product.brandId}
                              size="2xs"
                              sheen={false}
                              animated={false}
                            />
                          )}
                          <p className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#C6A46A]">
                            {product.brandId} · {product.sku}
                          </p>
                        </div>
                        <h3 className="font-display text-2xl font-medium text-[#F3EBDD]">
                          {product.name.en}
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-[#A99B88]">Export Ref / Unit</p>
                        <p className="font-mono-tabular text-base font-medium text-[#C6A46A]">
                          {formatExportRate(expUsd)}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-[#D2C6B5] leading-relaxed">
                      {product.description.en}
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#C6A46A]/20 text-xs text-[#D2C6B5]">
                      <div>
                        <span className="text-[#C6A46A]">Origin:</span>{' '}
                        <span className="font-medium text-[#F3EBDD]">{product.origin.en}</span>
                      </div>
                      <div>
                        <span className="text-[#C6A46A]">MOQ:</span>{' '}
                        <span className="font-mono-tabular font-medium text-[#F3EBDD]">
                          {moq} units
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[#C6A46A]">Grade / Botanical:</span>{' '}
                        <span className="text-[#F3EBDD]">
                          {product.exportSpecs?.botanicalOrGrade || 'Single-origin Ceylon grade'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[#C6A46A]">Bulk Packaging:</span>{' '}
                        <span className="text-[#A99B88]">{bulkPacks.join(' · ')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#C6A46A]/20">
                    <button
                      type="button"
                      onClick={() => handleDownloadProductSpec(product)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Download Spec Sheet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProducts((prev) =>
                          prev.includes(product.name.en) ? prev : [...prev, product.name.en],
                        );
                        setActiveTab('enquiry');
                      }}
                      className="px-3.5 py-2 text-xs font-medium border border-[#C6A46A]/55 text-[#F3EBDD] rounded-md hover:border-[#C6A46A] hover:bg-[#C6A46A]/10 cursor-pointer"
                    >
                      Request Quote for Item
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 3: ENQUIRY TRACKING & COUNTRY QUOTATION VIEWER */}
      {activeTab === 'track' && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-6">
          <div className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-lg p-6 sm:p-8 space-y-5 luxury-card-shadow">
            <div>
              <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                Track International Buyer Enquiry
              </h2>
              <p className="text-xs text-[#A99B88] mt-1">
                Enter your Enquiry Reference (for example INT-2026-2001) alongside your business
                email or tracking token to inspect quotation status.
              </p>
            </div>

            <form
              onSubmit={handleTrackLookup}
              className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
            >
              <div className="sm:col-span-2">
                <label htmlFor="track-ref-input" className="block text-xs font-medium text-[#D2C6B5] mb-1">
                  Enquiry Reference *
                </label>
                <input
                  id="track-ref-input"
                  type="text"
                  required
                  placeholder="INT-2026-2001"
                  value={trackRef}
                  onChange={(e) => setTrackRef(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-tabular bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded-md"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="track-cred-input" className="block text-xs font-medium text-[#D2C6B5] mb-1">
                  Business Email or Token *
                </label>
                <input
                  id="track-cred-input"
                  type="text"
                  required
                  placeholder="buyer@company.com"
                  value={trackCred}
                  onChange={(e) => setTrackCred(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded-md"
                />
              </div>
              <button
                type="submit"
                disabled={trackLoading}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] cursor-pointer h-[38px]"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{trackLoading ? 'Checking...' : 'Check Status'}</span>
              </button>
            </form>

            {trackError && (
              <div className="p-3 text-xs bg-[#501C2B]/60 border border-[#C6A46A]/40 text-[#F3B0B6] rounded-md">
                {trackError}
              </div>
            )}

            {trackedResult && (
              <div className="border-t border-[#C6A46A]/20 pt-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono-tabular text-xs text-[#C6A46A]">
                      {trackedResult.enquiryRef} · {trackedResult.businessType}
                    </p>
                    <h3 className="font-display text-2xl font-medium text-[#F3EBDD]">
                      {trackedResult.companyName} — {trackedResult.destinationCountry}
                    </h3>
                    <p className="text-xs text-[#A99B88]">
                      Contact: {trackedResult.contactName} · Brand: {trackedResult.brandInterest}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-[#A99B88]">Current Status</p>
                    <p className="font-mono-tabular text-sm font-medium uppercase text-[#86EFAC]">
                      {trackedResult.status}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#151312] border border-[#3B332E] rounded-md p-4 text-xs">
                  <div>
                    <p className="text-[#A99B88]">Requested Quantities</p>
                    <p className="font-medium text-[#F3EBDD]">{trackedResult.requiredQuantities}</p>
                  </div>
                  <div>
                    <p className="text-[#A99B88]">Packaging Format</p>
                    <p className="font-medium text-[#F3EBDD]">
                      {trackedResult.packagingRequirements}
                    </p>
                  </div>
                  {trackedResult.productInterests.length > 0 && (
                    <div className="sm:col-span-2">
                      <p className="text-[#A99B88]">Selected Products</p>
                      <p className="font-medium text-[#F3EBDD]">
                        {trackedResult.productInterests.join(', ')}
                      </p>
                    </div>
                  )}
                  {trackedResult.destinationPolicy && (
                    <div className="sm:col-span-2">
                      <p className="text-[#A99B88]">Destination Shipping Policy</p>
                      <p className="text-[#D2C6B5]">{trackedResult.destinationPolicy}</p>
                    </div>
                  )}
                </div>

                {trackedResult.adminResponse && (
                  <div className="p-4 bg-[#2A2522] border border-[#C6A46A]/50 rounded-md space-y-1 text-xs">
                    <p className="font-medium text-[#C6A46A]">Official Trade Desk Response</p>
                    <p className="text-[#D2C6B5] leading-relaxed">
                      {trackedResult.adminResponse}
                    </p>
                  </div>
                )}

                {trackedResult.quotation && (
                  <div className="p-4 bg-[#123D32] text-[#F3EBDD] border border-[#C6A46A]/45 rounded-md space-y-2 text-xs">
                    <p className="font-medium uppercase tracking-wider text-[#C6A46A]">
                      Country-Specific Quotation Record
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {typeof trackedResult.quotation.quotedAmount === 'number' && (
                        <div>
                          <p className="text-[#D2C6B5]">Product Quotation</p>
                          <p className="font-mono-tabular text-base font-medium text-[#C6A46A]">
                            {formatSingleCurrency(
                              trackedResult.quotation.quotedAmount,
                              trackedResult.quotation.currency,
                              availableCurrencies,
                            )}
                          </p>
                        </div>
                      )}
                      {typeof trackedResult.quotation.shippingEstimateAmount === 'number' && (
                        <div>
                          <p className="text-[#D2C6B5]">Freight Estimate</p>
                          <p className="font-mono-tabular text-base font-medium text-[#C6A46A]">
                            {formatSingleCurrency(
                              trackedResult.quotation.shippingEstimateAmount,
                              trackedResult.quotation.currency,
                              availableCurrencies,
                            )}
                          </p>
                        </div>
                      )}
                      {trackedResult.quotation.minOrderQty && (
                        <div>
                          <p className="text-[#D2C6B5]">Confirmed MOQ</p>
                          <p className="font-mono-tabular font-medium text-[#F3EBDD]">
                            {trackedResult.quotation.minOrderQty}
                          </p>
                        </div>
                      )}
                    </div>
                    {trackedResult.quotation.shippingPolicy && (
                      <p className="text-[#D2C6B5] pt-1">
                        Policy: {trackedResult.quotation.shippingPolicy}
                      </p>
                    )}
                    {trackedResult.quotation.validityNote && (
                      <p className="text-[#A99B88]">
                        Validity: {trackedResult.quotation.validityNote}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('home')}
              className="text-xs underline text-[#A99B88] hover:text-[#C6A46A] cursor-pointer"
            >
              Return to Corporate Storefront
            </button>
          </div>
        </section>
      )}

      <FaqSection
        title={
          isSi
            ? 'ජාත්‍යන්තර අපනයන සහ තොග වෙළඳ පොදු ප්‍රශ්න'
            : 'International Wholesale & Export Questions'
        }
        faqs={getWholesaleFaqs(lang)}
        surfaceClass="bg-[#211C1A]"
      />
    </div>
  );
}

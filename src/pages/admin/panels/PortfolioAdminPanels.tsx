import {FormEvent, useCallback, useEffect, useMemo, useState} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Mail,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import BrandLogo, {isOfficialLogoBrand} from '../../../components/BrandLogo';
import {useStore} from '../../../context/StoreContext';
import {
  fetchAdminCatalogueRequests,
  fetchAdminPortfolios,
  fetchAdminPortfolioPdfBlob,
  generateAdminPortfolio,
  triggerBlobFileDownload,
  updateAdminCatalogueRequest,
  updateAdminPortfolioStatus,
} from '../../../services/commerceApi';
import type {
  AdminSectionId,
  CatalogueRequestRecord,
  CatalogueRequestStatus,
  PortfolioCoverDesign,
  PortfolioFieldOptions,
  PortfolioOrientation,
  PortfolioRecord,
  PortfolioStatus,
} from '../../../types/admin';
import type {BrandId, CurrencyCode} from '../../../types/commerce';
import {buildWhatsAppLink, resolveBrandWhatsappNumber} from '../../../utils/currency';

interface PortfolioAdminPanelsProps {
  section: Extract<AdminSectionId, 'portfolio_generator' | 'catalogue_requests'>;
}

const DEFAULT_FIELDS: PortfolioFieldOptions = {
  sku: true,
  category: true,
  description: true,
  highlights: true,
  ingredients: true,
  origin: true,
  packSizes: true,
  packagingType: true,
  storageInstructions: true,
  shelfLife: true,
  netWeight: true,
  retailPrices: true,
  wholesalePrices: false, // Confidential OFF by default
  moq: false,
  technicalSpecs: true,
  certifications: true,
};

const FIELD_LABELS: {key: keyof PortfolioFieldOptions; label: string; confidential?: boolean}[] = [
  {key: 'sku', label: 'SKU Code'},
  {key: 'category', label: 'Category'},
  {key: 'description', label: 'Product Description'},
  {key: 'highlights', label: 'Key Benefits / Highlights'},
  {key: 'ingredients', label: 'Ingredients (if verified)'},
  {key: 'origin', label: 'Origin'},
  {key: 'packSizes', label: 'Available Pack Sizes'},
  {key: 'packagingType', label: 'Packaging Type'},
  {key: 'storageInstructions', label: 'Storage Instructions'},
  {key: 'shelfLife', label: 'Shelf Life'},
  {key: 'netWeight', label: 'Net Weight'},
  {key: 'retailPrices', label: 'Retail Prices'},
  {key: 'technicalSpecs', label: 'Technical / Export Specs'},
  {key: 'certifications', label: 'Verified Certifications'},
  {key: 'moq', label: 'Minimum Order Quantity (MOQ)'},
  {
    key: 'wholesalePrices',
    label: 'Confidential Wholesale Trade Pricing (Export USD)',
    confidential: true,
  },
];

export default function PortfolioAdminPanels({section}: PortfolioAdminPanelsProps) {
  const {catalogBrands, catalogProducts, availableCurrencies, commerceConfig} = useStore();

  // Shared feedback
  const [msg, setMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  // Generator state
  const [portfolios, setPortfolios] = useState<PortfolioRecord[]>([]);
  const [loadingPortfolios, setLoadingPortfolios] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [brandId, setBrandId] = useState<BrandId>('ceyvana');
  const [language, setLanguage] = useState<'en' | 'si'>('en');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [scope, setScope] = useState<'all' | 'categories' | 'products'>('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [coverDesign, setCoverDesign] = useState<PortfolioCoverDesign>('heritage_crest');
  const [orientation, setOrientation] = useState<PortfolioOrientation>('portrait');
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('v1.0.0');
  const [introMessage, setIntroMessage] = useState('');
  const [companyProfile, setCompanyProfile] = useState(
    'Ceylon Heritage House curates single-origin Sri Lankan spices, highland teas, and heritage goods packed at origin in Colombo, Sri Lanka.',
  );
  const [contactInfo, setContactInfo] = useState('export@ceylonheritage.lk · Colombo, Sri Lanka');
  const [websiteUrl, setWebsiteUrl] = useState('https://ceylonheritage.lk');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [fields, setFields] = useState<PortfolioFieldOptions>(DEFAULT_FIELDS);

  // Admin PDF blob preview
  const [previewBlobUrl, setPreviewBlobUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // Catalogue requests state
  const [requests, setRequests] = useState<CatalogueRequestRecord[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [reqStatusFilter, setReqStatusFilter] = useState<string>('all');
  const [reqBrandFilter, setReqBrandFilter] = useState<string>('all');
  const [selectedReq, setSelectedReq] = useState<CatalogueRequestRecord | null>(null);
  const [editReqStatus, setEditReqStatus] = useState<CatalogueRequestStatus>('reviewed');
  const [editAssignedPortfolioId, setEditAssignedPortfolioId] = useState('');
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [savingReq, setSavingReq] = useState(false);

  useEffect(() => {
    setWhatsappNumber(resolveBrandWhatsappNumber(brandId, commerceConfig));
    setSelectedCategories([]);
    setSelectedProductIds([]);
  }, [brandId, commerceConfig]);

  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  const closeBlobPreview = () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewBlobUrl('');
    setPreviewTitle('');
  };

  const loadPortfolios = useCallback(async () => {
    setLoadingPortfolios(true);
    try {
      const list = await fetchAdminPortfolios();
      setPortfolios(list);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Unable to load portfolios.');
    } finally {
      setLoadingPortfolios(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const [reqList, portList] = await Promise.all([
        fetchAdminCatalogueRequests(),
        fetchAdminPortfolios(),
      ]);
      setRequests(reqList);
      setPortfolios(portList);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Unable to load catalogue requests.');
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    setMsg('');
    setErrMsg('');
    if (section === 'portfolio_generator') {
      void loadPortfolios();
    } else {
      void loadRequests();
    }
  }, [section, loadPortfolios, loadRequests]);

  const brandProducts = useMemo(
    () => catalogProducts.filter((p) => p.brandId === brandId && !p.isArchived),
    [catalogProducts, brandId],
  );

  const brandCategories = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of brandProducts) {
      if (!map.has(p.categorySlug)) {
        map.set(p.categorySlug, p.category.en);
      }
    }
    return Array.from(map.entries()).map(([slug, label]) => ({slug, label}));
  }, [brandProducts]);

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    setMsg('');
    setErrMsg('');

    if (scope === 'categories' && selectedCategories.length === 0) {
      setErrMsg('Select at least one category before generating a category-scoped portfolio.');
      return;
    }
    if (scope === 'products' && selectedProductIds.length === 0) {
      setErrMsg('Select at least one product before generating a product-scoped portfolio.');
      return;
    }

    setGenerating(true);
    try {
      const created = await generateAdminPortfolio({
        brandId,
        language,
        currency,
        title: title.trim() || undefined,
        version: version.trim() || undefined,
        scope,
        categorySlugs: scope === 'categories' ? selectedCategories : undefined,
        productIds: scope === 'products' ? selectedProductIds : undefined,
        coverDesign,
        orientation,
        introMessage: introMessage.trim() || undefined,
        companyProfile: companyProfile.trim() || undefined,
        contactInfo: contactInfo.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        whatsappNumber: whatsappNumber.trim() || undefined,
        fields,
        productsOverride: catalogProducts,
      });
      setPortfolios((prev) => [created, ...prev]);
      setMsg(
        `Generated ${created.version} (${created.pageCount} pages, ${Math.max(1, Math.round(created.fileSizeBytes / 1024))} KB) as Draft.`,
      );
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'PDF generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusChange = async (id: string, nextStatus: PortfolioStatus) => {
    setMsg('');
    setErrMsg('');
    try {
      const updated = await updateAdminPortfolioStatus(id, nextStatus);
      setPortfolios((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setMsg(`Updated ${updated.title} (${updated.version}) status to ${updated.status}.`);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Unable to update portfolio status.');
    }
  };

  const handlePreviewPortfolio = async (item: PortfolioRecord) => {
    setErrMsg('');
    try {
      const blob = await fetchAdminPortfolioPdfBlob(item.id, true);
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
      setPreviewBlobUrl(URL.createObjectURL(blob));
      setPreviewTitle(`${item.title} (${item.version}) — ${item.status.toUpperCase()}`);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Unable to preview portfolio PDF.');
    }
  };

  const handleDownloadPortfolio = async (item: PortfolioRecord) => {
    setErrMsg('');
    try {
      const blob = await fetchAdminPortfolioPdfBlob(item.id, false);
      triggerBlobFileDownload(blob, `${item.brandId}-portfolio-${item.language}-${item.version}.pdf`);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Unable to download portfolio PDF.');
    }
  };

  if (section === 'portfolio_generator') {
    return (
      <div className="space-y-6 text-[#F3EBDD]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {isOfficialLogoBrand(brandId) && (
              <BrandLogo brandId={brandId} size="sm" key={brandId} />
            )}
            <div>
              <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">
                Product Portfolio PDF Generator
              </h1>
              <p className="text-sm text-[#D2C6B5]">
                Generate brand-isolated, versioned English &amp; Sinhala A4 PDFs with granular trade visibility controls.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadPortfolios()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[#3B332E] bg-[#211C1A] text-[#F3EBDD] rounded-md hover:border-[#C6A46A] hover:bg-[#2A2522] cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#C6A46A]" />
            <span>Refresh List</span>
          </button>
        </div>

        {msg && <div className="p-3 text-sm bg-[#123D32]/50 border border-[#86EFAC]/40 text-[#86EFAC] rounded-md">{msg}</div>}
        {errMsg && <div className="p-3 text-sm bg-[#501C2B]/40 border border-[#F3B0B6]/40 text-[#F3B0B6] rounded-md">{errMsg}</div>}

        {/* Generator Form */}
        <form onSubmit={handleGenerate} className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Brand House *</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value as BrandId)}
                className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              >
                {(['ceyvana', 'ceylomira', 'hand-crafts'] as BrandId[]).map((id) => {
                  const b = catalogBrands.find((item) => item.id === id);
                  return (
                    <option key={id} value={id}>
                      {b ? `${b.name.en} (${b.status})` : id}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Language *</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'en' | 'si')}
                className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              >
                <option value="en">English (EN)</option>
                <option value="si">Sinhala (SI — Noto Sinhala Unicode)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Display Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              >
                {availableCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Catalog Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as 'all' | 'categories' | 'products')}
                className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              >
                <option value="all">All Brand Products ({brandProducts.length})</option>
                <option value="categories">Specific Categories</option>
                <option value="products">Selected Products</option>
              </select>
            </div>
          </div>

          {scope === 'categories' && (
            <div className="p-4 bg-[#151312] border border-[#3B332E] rounded-md space-y-2">
              <p className="text-xs font-semibold text-[#C6A46A]">Select Categories ({brandId.toUpperCase()} only)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {brandCategories.map((cat) => (
                  <label key={cat.slug} className="flex items-center gap-2 text-xs bg-[#2A2522] text-[#F3EBDD] p-2 rounded border border-[#3B332E] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.slug)}
                      onChange={(e) =>
                        setSelectedCategories((prev) =>
                          e.target.checked ? [...prev, cat.slug] : prev.filter((s) => s !== cat.slug),
                        )
                      }
                      className="accent-[#C6A46A]"
                    />
                    <span>{cat.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {scope === 'products' && (
            <div className="p-4 bg-[#151312] border border-[#3B332E] rounded-md space-y-2 max-h-56 overflow-y-auto">
              <p className="text-xs font-semibold text-[#C6A46A]">Select Products ({brandId.toUpperCase()} only)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {brandProducts.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-xs bg-[#2A2522] text-[#F3EBDD] p-2 rounded border border-[#3B332E] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(p.id)}
                      onChange={(e) =>
                        setSelectedProductIds((prev) =>
                          e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                        )
                      }
                      className="accent-[#C6A46A]"
                    />
                    <span className="truncate">{p.name.en} ({p.sku})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Edition Title (Optional override)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${brandId.toUpperCase()} Product Portfolio`}
                className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Cover Design</label>
              <select
                value={coverDesign}
                onChange={(e) => setCoverDesign(e.target.value as PortfolioCoverDesign)}
                className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              >
                <option value="heritage_crest">Heritage Crest (Editorial Cover)</option>
                <option value="editorial_split">Editorial Split</option>
                <option value="gallery_minimal">Gallery Minimal</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Orientation</label>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as PortfolioOrientation)}
                  className="w-full px-2.5 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                >
                  <option value="portrait">A4 Portrait</option>
                  <option value="landscape">A4 Landscape</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Version</label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="v1.0.0"
                  className="w-full px-2.5 py-2 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Brand Introductory Message</label>
              <textarea
                rows={2}
                value={introMessage}
                onChange={(e) => setIntroMessage(e.target.value)}
                placeholder="Optional custom introductory note for this portfolio edition..."
                className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Company Profile Summary</label>
              <textarea
                rows={2}
                value={companyProfile}
                onChange={(e) => setCompanyProfile(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Contact Details</label>
              <input
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Website URL</label>
              <input
                type="text"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Brand WhatsApp Number</label>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              />
            </div>
          </div>

          {/* Field Visibility Controls */}
          <div className="border-t border-[#3B332E] pt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#C6A46A]">
                Included Specification Fields (Empty / Unverified fields are omitted cleanly)
              </p>
              {fields.wholesalePrices && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-[#501C2B]/40 border border-[#F3B0B6]/40 text-[#F3B0B6] rounded">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Confidential Trade Pricing Enabled — Review before Publishing</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              {FIELD_LABELS.map((item) => (
                <label
                  key={item.key}
                  className={`flex items-center gap-2 p-2.5 rounded border cursor-pointer ${
                    item.confidential
                      ? 'bg-[#501C2B]/30 border-[#C6A46A]/60 sm:col-span-2'
                      : 'bg-[#2A2522] border-[#3B332E]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={fields[item.key]}
                    onChange={(e) =>
                      setFields((prev) => ({...prev, [item.key]: e.target.checked}))
                    }
                    className="accent-[#C6A46A]"
                  />
                  <span className={item.confidential ? 'font-semibold text-[#F3B0B6]' : 'text-[#F3EBDD]'}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={generating || brandProducts.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-4 h-4" />
              <span>{generating ? 'Generating Versioned PDF...' : 'Generate Draft PDF'}</span>
            </button>
          </div>
        </form>

        {/* Inline Admin PDF Preview Frame */}
        {previewBlobUrl && (
          <div className="bg-[#211C1A] border border-[#C6A46A]/70 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0D0C0B] text-[#F3EBDD] border-b border-[#3B332E] text-xs">
              <span className="font-medium">{previewTitle}</span>
              <button
                type="button"
                onClick={closeBlobPreview}
                className="inline-flex items-center gap-1 px-2.5 py-1 border border-[#3B332E] rounded hover:border-[#C6A46A] cursor-pointer whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close Preview</span>
              </button>
            </div>
            <iframe
              title={previewTitle || 'Admin PDF Preview'}
              src={previewBlobUrl}
              className="w-full h-[600px] bg-[#151312]"
            />
          </div>
        )}

        {/* Versioned Portfolios Ledger */}
        <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#2A2522] border-b border-[#3B332E] text-[#C6A46A] uppercase">
              <tr>
                <th className="px-4 py-3">Edition &amp; Version</th>
                <th className="px-4 py-3">Brand / Lang</th>
                <th className="px-4 py-3">Specs</th>
                <th className="px-4 py-3">Status &amp; Sync</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3B332E]">
              {loadingPortfolios ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#A99B88]">
                    Loading portfolio editions...
                  </td>
                </tr>
              ) : portfolios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#A99B88]">
                    No portfolio PDFs generated yet. Use the form above to build your first edition.
                  </td>
                </tr>
              ) : (
                portfolios.map((item) => (
                  <tr key={item.id} className="hover:bg-[#2A2522]/45">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#F3EBDD] text-sm">{item.title}</p>
                      <p className="font-mono-tabular text-[11px] text-[#A99B88]">
                        {item.version} · Generated {item.generatedAt.slice(0, 10)}
                      </p>
                    </td>
                    <td className="px-4 py-3 uppercase font-mono-tabular text-[#D2C6B5]">
                      {item.brandId} · {item.language} · {item.currency}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-[#D2C6B5]">
                      {item.productCount} items · {item.pageCount}p ·{' '}
                      {Math.max(1, Math.round(item.fileSizeBytes / 1024))} KB
                      {item.fields.wholesalePrices && (
                        <span className="block text-[10px] text-[#F3B0B6] font-semibold mt-0.5">
                          INCLUDES WHOLESALE PRICING
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 space-y-1">
                      <span
                        className={`inline-block px-2 py-0.5 text-[11px] font-semibold uppercase rounded border ${
                          item.status === 'published'
                            ? 'bg-[#123D32] text-[#86EFAC] border-[#1C493C]'
                            : item.status === 'unpublished'
                              ? 'bg-[#501C2B]/60 text-[#F3B0B6] border-[#7A1F28]'
                              : 'bg-[#2A2522] text-[#C6A46A] border-[#C6A46A]/60'
                        }`}
                      >
                        {item.status}
                      </span>
                      {item.needsRegeneration && (
                        <div className="flex items-center gap-1 text-[11px] text-[#C6A46A] font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Catalog changed — Update recommended</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => void handlePreviewPortfolio(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#3B332E] bg-[#2A2522] text-[#F3EBDD] rounded hover:border-[#C6A46A] cursor-pointer"
                      >
                        <Eye className="w-3 h-3 text-[#C6A46A]" />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDownloadPortfolio(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#3B332E] bg-[#2A2522] text-[#F3EBDD] rounded hover:border-[#C6A46A] cursor-pointer"
                      >
                        <Download className="w-3 h-3 text-[#C6A46A]" />
                        <span>PDF</span>
                      </button>
                      {item.status !== 'published' ? (
                        <button
                          type="button"
                          onClick={() => void handleStatusChange(item.id, 'published')}
                          className="px-2.5 py-1.5 bg-[#123D32] border border-[#1C493C] text-[#F3EBDD] hover:bg-[#1C493C] rounded cursor-pointer"
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleStatusChange(item.id, 'unpublished')}
                          className="px-2.5 py-1.5 bg-[#501C2B] border border-[#7A1F28] text-[#F3EBDD] hover:bg-[#6E1924] rounded cursor-pointer"
                        >
                          Unpublish
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 19. Catalogue Requests Panel
  const filteredRequests = requests.filter((r) => {
    if (reqStatusFilter !== 'all' && r.status !== reqStatusFilter) return false;
    if (reqBrandFilter !== 'all' && r.brandId !== reqBrandFilter) return false;
    return true;
  });

  const publishedForSelectedBrand = selectedReq
    ? portfolios.filter((p) => p.status === 'published' && p.brandId === selectedReq.brandId)
    : [];

  return (
    <div className="space-y-6 text-[#F3EBDD]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">
            Customer Catalogue Requests
          </h1>
          <p className="text-sm text-[#D2C6B5]">
            Track public PDF portfolio requests, assign official published versions, and share downloads via WhatsApp or email.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRequests()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[#3B332E] bg-[#211C1A] text-[#F3EBDD] rounded-md hover:border-[#C6A46A] hover:bg-[#2A2522] cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#C6A46A]" />
          <span>Refresh</span>
        </button>
      </div>

      {msg && <div className="p-3 text-sm bg-[#123D32]/50 border border-[#86EFAC]/40 text-[#86EFAC] rounded-md">{msg}</div>}
      {errMsg && <div className="p-3 text-sm bg-[#501C2B]/40 border border-[#F3B0B6]/40 text-[#F3B0B6] rounded-md">{errMsg}</div>}

      {/* Filters */}
      <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-4 flex flex-wrap gap-3">
        <select
          value={reqBrandFilter}
          onChange={(e) => setReqBrandFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
        >
          <option value="all">All Brands</option>
          <option value="ceyvana">Ceyvana</option>
          <option value="ceylomira">Ceylomira</option>
          <option value="hand-crafts">Hand Crafts</option>
        </select>
        <select
          value={reqStatusFilter}
          onChange={(e) => setReqStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="sent">Sent</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#2A2522] border-b border-[#3B332E] text-[#C6A46A] uppercase">
            <tr>
              <th className="px-4 py-3">Request Ref</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Brand &amp; Scope</th>
              <th className="px-4 py-3">Assigned Version</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3B332E]">
            {loadingRequests ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#A99B88]">
                  Loading requests...
                </td>
              </tr>
            ) : filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#A99B88]">
                  No catalogue requests match the current filters.
                </td>
              </tr>
            ) : (
              filteredRequests.map((req) => (
                <tr key={req.id} className={selectedReq?.id === req.id ? 'bg-[#2A2522]' : 'hover:bg-[#2A2522]/45'}>
                  <td className="px-4 py-3 font-mono-tabular font-medium text-[#C6A46A]">
                    {req.requestRef}
                    <span className="block text-[11px] font-normal text-[#A99B88]">
                      {req.createdAt.slice(0, 10)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#F3EBDD]">{req.customerName}</p>
                    <p className="text-[11px] text-[#A99B88]">
                      {req.email} · {req.country}
                    </p>
                  </td>
                  <td className="px-4 py-3 uppercase font-mono-tabular text-[#D2C6B5]">
                    {req.brandId} · {req.language} · {req.scope}
                  </td>
                  <td className="px-4 py-3 font-mono-tabular text-[#F3EBDD]">
                    {req.assignedPortfolioVersion || '—'}
                  </td>
                  <td className="px-4 py-3 uppercase font-medium text-[#C6A46A]">{req.status}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReq(req);
                        setEditReqStatus(req.status);
                        setEditAssignedPortfolioId(req.assignedPortfolioId || '');
                        setEditAdminNotes(req.adminNotes || '');
                      }}
                      className="px-3 py-1 bg-[#C6A46A] text-[#151312] font-medium rounded hover:bg-[#D4B47B] cursor-pointer whitespace-nowrap"
                    >
                      Respond
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Selected Request Drawer */}
      {selectedReq && (
        <div className="bg-[#211C1A] border border-[#C6A46A]/40 rounded-lg p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#3B332E] pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                {isOfficialLogoBrand(selectedReq.brandId) && (
                  <BrandLogo brandId={selectedReq.brandId} size="xs" sheen={false} />
                )}
                <p className="text-xs font-mono-tabular text-[#C6A46A]">
                  {selectedReq.requestRef} · {selectedReq.createdAt.slice(0, 16).replace('T', ' ')}Z
                </p>
              </div>
              <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                {selectedReq.customerName}
                {selectedReq.companyName ? ` (${selectedReq.companyName})` : ''}
              </h2>
              <p className="text-xs text-[#D2C6B5] mt-1">
                Email: {selectedReq.email} · Country: {selectedReq.country}
                {selectedReq.whatsappNumber ? ` · WhatsApp: ${selectedReq.whatsappNumber}` : ''}
              </p>
              {selectedReq.notes && (
                <p className="text-xs bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded p-3 mt-2">
                  Customer Notes: {selectedReq.notes}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedReq(null)}
              className="px-3 py-1.5 text-xs border border-[#3B332E] bg-[#2A2522] text-[#F3EBDD] rounded hover:border-[#C6A46A] cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
          </div>

          <form
            onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              setSavingReq(true);
              setMsg('');
              setErrMsg('');
              try {
                const updated = await updateAdminCatalogueRequest(selectedReq.id, {
                  status: editReqStatus,
                  assignedPortfolioId: editAssignedPortfolioId || undefined,
                  adminNotes: editAdminNotes.trim() || undefined,
                });
                setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
                setSelectedReq(updated);
                setMsg(`Updated catalogue request ${updated.requestRef} (${updated.status}).`);
              } catch (err) {
                setErrMsg(err instanceof Error ? err.message : 'Unable to save request response.');
              } finally {
                setSavingReq(false);
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-medium text-[#D2C6B5] mb-1">Request Status</label>
                <select
                  value={editReqStatus}
                  onChange={(e) => setEditReqStatus(e.target.value as CatalogueRequestStatus)}
                  className="w-full px-3 py-2 bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                >
                  <option value="new">New</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="sent">Sent</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-[#D2C6B5] mb-1">
                  Assign Published Portfolio ({selectedReq.brandId.toUpperCase()})
                </label>
                <select
                  value={editAssignedPortfolioId}
                  onChange={(e) => setEditAssignedPortfolioId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                >
                  <option value="">-- Select published version --</option>
                  {publishedForSelectedBrand.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.version} · {p.language.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Admin Notes / Response Summary</label>
              <textarea
                rows={2}
                value={editAdminNotes}
                onChange={(e) => setEditAdminNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const shareUrl = editAssignedPortfolioId
                    ? `${window.location.origin}/api/portfolios/published/${encodeURIComponent(editAssignedPortfolioId)}/pdf`
                    : `${window.location.origin}/portfolio#${selectedReq.brandId}`;
                  const waText = `Hello ${selectedReq.customerName},\nRegarding your Ceylon Heritage Catalogue Request (${selectedReq.requestRef}) for ${selectedReq.brandId.toUpperCase()}, you can access the portfolio PDF here: ${shareUrl}`;
                  const waTarget = (selectedReq.whatsappNumber || '').replace(/[^0-9]/g, '');
                  return (
                    <>
                      {waTarget && (
                        <a
                          href={buildWhatsAppLink(waText, waTarget)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#123D32] border border-[#1C493C] text-[#F3EBDD] hover:bg-[#1C493C] rounded whitespace-nowrap"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-[#C6A46A]" />
                          <span>Send via WhatsApp</span>
                        </a>
                      )}
                      <a
                        href={`mailto:${encodeURIComponent(selectedReq.email)}?subject=${encodeURIComponent(`Ceylon Heritage Product Portfolio (${selectedReq.requestRef})`)}&body=${encodeURIComponent(waText)}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#3B332E] bg-[#2A2522] text-[#F3EBDD] hover:border-[#C6A46A] rounded whitespace-nowrap"
                      >
                        <Mail className="w-3.5 h-3.5 text-[#C6A46A]" />
                        <span>Compose Email</span>
                      </a>
                    </>
                  );
                })()}
              </div>

              <button
                type="submit"
                disabled={savingReq}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] hover:bg-[#D4B47B] rounded cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{savingReq ? 'Saving...' : 'Save Request Update'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

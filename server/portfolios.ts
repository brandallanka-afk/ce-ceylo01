import crypto from 'node:crypto';
import type {
  CatalogueRequestRecord,
  CatalogueRequestStatus,
  PortfolioCoverDesign,
  PortfolioFieldOptions,
  PortfolioOrientation,
  PortfolioRecord,
  PortfolioStatus,
} from '../src/types/admin.ts';
import type {BrandId, CurrencyCode, Product} from '../src/types/commerce.ts';
import {
  DEFAULT_PORTFOLIO_FIELDS,
  generateBrandPortfolioPdf,
} from './pdfGenerator.ts';
import {
  CommerceHttpError,
  computeCatalogFingerprint,
  getAuthoritativeProducts,
  getStoreReadonly,
  recordAdminAuditLog,
  sanitizePlainText,
  savePortfolioPdfFile,
  withStoreLock,
} from './store.ts';
import type {CatalogueRequestInput, GeneratePortfolioInput} from './types.ts';

const VALID_BRANDS: BrandId[] = ['ceyvana', 'ceylomira', 'hand-crafts'];
const VALID_COVERS: PortfolioCoverDesign[] = [
  'heritage_crest',
  'editorial_split',
  'gallery_minimal',
];

function resolveBrandWhatsapp(
  brandId: BrandId,
  settings: {
    whatsappNumber: string;
    brandWhatsappNumbers?: {ceyvana?: string; ceylomira?: string; 'hand-crafts'?: string};
  },
): string {
  const brandSpecific = settings.brandWhatsappNumbers?.[brandId];
  return (brandSpecific || settings.whatsappNumber || '94770000000').replace(/[^0-9]/g, '');
}

function defaultBrandPortfolioTitle(brandId: BrandId, language: 'en' | 'si'): string {
  if (language === 'si') {
    if (brandId === 'ceyvana') return 'සෙයිවානා නිල නිෂ්පාදන නාමාවලිය';
    if (brandId === 'ceylomira') return 'සෙයිලෝමිරා නිල තේ නාමාවලිය';
    return 'ලංකා හස්ත කර්මාන්ත නාමාවලිය';
  }
  if (brandId === 'ceyvana') return 'Ceyvana Official Spice Portfolio';
  if (brandId === 'ceylomira') return 'Ceylomira Official Tea Portfolio';
  return 'Ceylon Hand Crafts Heritage Portfolio';
}

function nextSemanticVersionForBrand(
  existingPortfolios: PortfolioRecord[],
  brandId: BrandId,
  language: 'en' | 'si',
): string {
  const same = existingPortfolios.filter((p) => p.brandId === brandId && p.language === language);
  if (same.length === 0) return 'v1.0';
  let maxMinor = 0;
  for (const p of same) {
    const match = /^v1\.(\d+)/i.exec(p.version);
    if (match) {
      maxMinor = Math.max(maxMinor, Number(match[1]) || 0);
    }
  }
  return `v1.${same.length > maxMinor ? same.length : maxMinor + 1}`;
}

function filterBrandScopedProducts(params: {
  allProducts: Product[];
  brandId: BrandId;
  scope: 'all' | 'categories' | 'products';
  categorySlugs: string[];
  productIds: string[];
}): Product[] {
  // Strict single-brand isolation: never mix products from another brand
  const brandOnly = params.allProducts.filter(
    (p) => p.brandId === params.brandId && !p.isArchived,
  );
  if (params.scope === 'categories' && params.categorySlugs.length > 0) {
    const set = new Set(params.categorySlugs);
    return brandOnly.filter((p) => set.has(p.categorySlug));
  }
  if (params.scope === 'products' && params.productIds.length > 0) {
    const set = new Set(params.productIds);
    return brandOnly.filter((p) => set.has(p.id));
  }
  return brandOnly;
}

export async function listAdminPortfolios(): Promise<PortfolioRecord[]> {
  const store = getStoreReadonly();
  const allProducts = await getAuthoritativeProducts(store);

  const list = Object.values(store.portfolios).map((p) => {
    const scoped = filterBrandScopedProducts({
      allProducts,
      brandId: p.brandId,
      scope: p.scope,
      categorySlugs: p.categorySlugs,
      productIds: p.productIds,
    });
    const currentFingerprint = computeCatalogFingerprint(scoped);
    return {
      ...p,
      needsRegeneration: currentFingerprint !== p.catalogFingerprint,
    };
  });

  return list.sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)));
}

export function listPublishedPortfolios(): PortfolioRecord[] {
  const store = getStoreReadonly();
  return Object.values(store.portfolios)
    .filter((p) => p.status === 'published')
    .sort((a, b) => String(b.publishedAt || b.generatedAt).localeCompare(String(a.publishedAt || a.generatedAt)));
}

export async function generateAdminPortfolio(params: {
  input: GeneratePortfolioInput;
  actorEmail: string;
  originUrl: string;
}): Promise<PortfolioRecord> {
  const {input} = params;
  if (!VALID_BRANDS.includes(input.brandId)) {
    throw new CommerceHttpError(400, 'Please select a valid brand for portfolio generation.');
  }

  const language: 'en' | 'si' = input.language === 'si' ? 'si' : 'en';
  const scope: 'all' | 'categories' | 'products' =
    input.scope === 'categories' || input.scope === 'products' ? input.scope : 'all';
  const coverDesign: PortfolioCoverDesign = VALID_COVERS.includes(input.coverDesign as PortfolioCoverDesign)
    ? (input.coverDesign as PortfolioCoverDesign)
    : 'heritage_crest';
  const orientation: PortfolioOrientation =
    input.orientation === 'landscape' ? 'landscape' : 'portrait';

  const categorySlugs = Array.isArray(input.categorySlugs)
    ? Array.from(new Set(input.categorySlugs.map((s) => sanitizePlainText(s, 80)).filter(Boolean)))
    : [];
  const productIds = Array.isArray(input.productIds)
    ? Array.from(new Set(input.productIds.map((s) => sanitizePlainText(s, 80)).filter(Boolean)))
    : [];

  const fields: PortfolioFieldOptions = {
    ...DEFAULT_PORTFOLIO_FIELDS,
    ...(input.fields ?? {}),
    wholesalePrices: Boolean(input.fields?.wholesalePrices ?? false),
  };

  return withStoreLock(async (store) => {
    const authProducts =
      Array.isArray(input.productsOverride) && input.productsOverride.length > 0
        ? input.productsOverride
        : await getAuthoritativeProducts(store);

    const scopedProducts = filterBrandScopedProducts({
      allProducts: authProducts,
      brandId: input.brandId,
      scope,
      categorySlugs,
      productIds,
    });

    if (scopedProducts.length === 0) {
      throw new CommerceHttpError(
        400,
        `No verified products matched the selected scope for brand "${input.brandId}".`,
      );
    }

    const reqCurrency = String(input.currency || 'USD').trim().toUpperCase() as CurrencyCode;
    const currencyCfg =
      store.settings.currencies.find((c) => c.code === reqCurrency) ??
      store.settings.currencies.find((c) => c.code === 'USD');

    const seq = store.nextPortfolioSeq++;
    const year = new Date().getFullYear();
    const id = `pf-${input.brandId}-${language}-${year}-${seq}-${crypto.randomBytes(2).toString('hex')}`;
    const existingForBrand = Object.values(store.portfolios);
    const version =
      sanitizePlainText(input.version, 24) ||
      nextSemanticVersionForBrand(existingForBrand, input.brandId, language);
    const title =
      sanitizePlainText(input.title, 140) || defaultBrandPortfolioTitle(input.brandId, language);
    const whatsappNumber =
      sanitizePlainText(input.whatsappNumber, 24).replace(/[^0-9]/g, '') ||
      resolveBrandWhatsapp(input.brandId, store.settings);
    const websiteUrl = sanitizePlainText(input.websiteUrl, 160) || params.originUrl;
    const nowIso = new Date().toISOString();

    const pdfResult = await generateBrandPortfolioPdf({
      brandId: input.brandId,
      language,
      currency: currencyCfg?.code || reqCurrency,
      currencyConfig: currencyCfg,
      title,
      version,
      coverDesign,
      orientation,
      introMessage: sanitizePlainText(input.introMessage, 900),
      companyProfile: sanitizePlainText(input.companyProfile, 500),
      contactInfo: sanitizePlainText(input.contactInfo, 300),
      websiteUrl,
      whatsappNumber,
      omittedFieldNote: sanitizePlainText(input.omittedFieldNote, 240),
      fields,
      products: scopedProducts,
      generatedAtIso: nowIso,
    });

    const pdfFileName = savePortfolioPdfFile(`portfolio-${id}.pdf`, pdfResult.buffer);
    const catalogFingerprint = computeCatalogFingerprint(scopedProducts);

    const record: PortfolioRecord = {
      id,
      brandId: input.brandId,
      language,
      currency: currencyCfg?.code || reqCurrency,
      title,
      version,
      status: 'draft',
      scope,
      categorySlugs,
      productIds,
      coverDesign,
      orientation,
      introMessage: sanitizePlainText(input.introMessage, 900),
      companyProfile: sanitizePlainText(input.companyProfile, 500),
      contactInfo: sanitizePlainText(input.contactInfo, 300),
      websiteUrl,
      whatsappNumber,
      omittedFieldNote: sanitizePlainText(input.omittedFieldNote, 240) || undefined,
      fields,
      productCount: pdfResult.productCount,
      catalogFingerprint,
      pdfFileName,
      pageCount: pdfResult.pageCount,
      fileSizeBytes: pdfResult.buffer.byteLength,
      generatedBy: params.actorEmail,
      generatedAt: nowIso,
      updatedAt: nowIso,
      needsRegeneration: false,
    };

    store.portfolios[id] = record;
    recordAdminAuditLog(store, {
      actorEmail: params.actorEmail,
      action: 'portfolio_generated',
      targetType: 'portfolio',
      targetId: `${record.brandId}:${record.version}`,
      summary: `Generated ${record.language.toUpperCase()} PDF draft "${record.title}" (${record.pageCount} pages, ${record.productCount} products).`,
    });

    return record;
  });
}

export async function updateAdminPortfolioStatus(params: {
  id: string;
  status: PortfolioStatus;
  actorEmail: string;
}): Promise<PortfolioRecord> {
  if (!['draft', 'published', 'unpublished'].includes(params.status)) {
    throw new CommerceHttpError(400, 'Invalid portfolio status.');
  }

  return withStoreLock((store) => {
    const existing = store.portfolios[params.id];
    if (!existing) {
      throw new CommerceHttpError(404, 'Portfolio record not found.');
    }
    const nowIso = new Date().toISOString();
    existing.status = params.status;
    existing.updatedAt = nowIso;
    if (params.status === 'published' && !existing.publishedAt) {
      existing.publishedAt = nowIso;
    }

    recordAdminAuditLog(store, {
      actorEmail: params.actorEmail,
      action: `portfolio_${params.status}`,
      targetType: 'portfolio',
      targetId: `${existing.brandId}:${existing.version}`,
      summary: `Changed portfolio "${existing.title}" (${existing.version}) status -> ${params.status}.`,
    });
    return existing;
  });
}

export async function buildPublicCustomPortfolioPdf(params: {
  brandId: BrandId;
  language: 'en' | 'si';
  currency?: CurrencyCode;
  scope: 'all' | 'categories' | 'products';
  categorySlugs?: string[];
  productIds?: string[];
  originUrl: string;
}): Promise<{buffer: Buffer; fileName: string; pageCount: number; productCount: number}> {
  if (!VALID_BRANDS.includes(params.brandId)) {
    throw new CommerceHttpError(400, 'Please choose a valid brand.');
  }
  const store = getStoreReadonly();
  if (store.settings.portfolioSettings?.allowCustomPublicCatalogSelection === false) {
    throw new CommerceHttpError(
      403,
      'Custom category/product PDF builder is currently disabled by administrator.',
    );
  }
  if (store.settings.portfolioSettings?.requireRegistrationForPublicDownload) {
    throw new CommerceHttpError(
      403,
      'Administrator requires submitting a Catalogue Request before custom PDF download.',
    );
  }

  const authProducts = await getAuthoritativeProducts(store);
  const scoped = filterBrandScopedProducts({
    allProducts: authProducts,
    brandId: params.brandId,
    scope: params.scope,
    categorySlugs: params.categorySlugs ?? [],
    productIds: params.productIds ?? [],
  });

  if (scoped.length === 0) {
    throw new CommerceHttpError(400, 'No verified products selected for this brand.');
  }

  const language: 'en' | 'si' = params.language === 'si' ? 'si' : 'en';
  const reqCurrency = String(params.currency || 'USD').trim().toUpperCase() as CurrencyCode;
  const currencyCfg =
    store.settings.currencies.find((c) => c.code === reqCurrency && c.enabled) ??
    store.settings.currencies.find((c) => c.code === 'USD');

  const safeFields: PortfolioFieldOptions = {
    ...DEFAULT_PORTFOLIO_FIELDS,
    // Public on-demand PDFs NEVER include confidential wholesale pricing or unrequested MOQs
    wholesalePrices: false,
    moq: false,
  };

  const result = await generateBrandPortfolioPdf({
    brandId: params.brandId,
    language,
    currency: currencyCfg?.code || 'USD',
    currencyConfig: currencyCfg,
    title: defaultBrandPortfolioTitle(params.brandId, language),
    version: 'Public Edition',
    coverDesign: 'heritage_crest',
    orientation: 'portrait',
    websiteUrl: params.originUrl,
    whatsappNumber: resolveBrandWhatsapp(params.brandId, store.settings),
    fields: safeFields,
    products: scoped,
    generatedAtIso: new Date().toISOString(),
  });

  return {
    ...result,
    fileName: `${params.brandId}-portfolio-${language}.pdf`,
  };
}

export async function createCatalogueRequest(
  input: CatalogueRequestInput,
): Promise<CatalogueRequestRecord> {
  if (!VALID_BRANDS.includes(input.brandId)) {
    throw new CommerceHttpError(400, 'Please select a valid brand.');
  }
  const customerName = sanitizePlainText(input.customerName, 120);
  const email = sanitizePlainText(input.email, 180).toLowerCase();
  const country = sanitizePlainText(input.country, 80);
  const companyName = sanitizePlainText(input.companyName, 140);
  const whatsappNumber = sanitizePlainText(input.whatsappNumber, 40);
  const notes = sanitizePlainText(input.notes, 1000);
  const language: 'en' | 'si' = input.language === 'si' ? 'si' : 'en';
  const scope: 'all' | 'categories' | 'products' =
    input.scope === 'categories' || input.scope === 'products' ? input.scope : 'all';

  if (customerName.length < 2) {
    throw new CommerceHttpError(400, 'Please provide your full name.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new CommerceHttpError(400, 'Please provide a valid email address.');
  }
  if (country.length < 2) {
    throw new CommerceHttpError(400, 'Please select or enter your country.');
  }

  const requestedCategories = Array.isArray(input.requestedCategories)
    ? Array.from(new Set(input.requestedCategories.map((c) => sanitizePlainText(c, 80)).filter(Boolean))).slice(0, 20)
    : [];
  const requestedProducts = Array.isArray(input.requestedProducts)
    ? Array.from(new Set(input.requestedProducts.map((p) => sanitizePlainText(p, 120)).filter(Boolean))).slice(0, 30)
    : [];

  return withStoreLock((store) => {
    const seq = store.nextCatalogueRequestSeq++;
    const year = new Date().getFullYear();
    const requestRef = `CAT-${year}-${seq}`;
    const id = `catreq-${year}-${seq}-${crypto.randomBytes(2).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const record: CatalogueRequestRecord = {
      id,
      requestRef,
      brandId: input.brandId,
      language,
      customerName,
      email,
      country,
      companyName: companyName || undefined,
      whatsappNumber: whatsappNumber || undefined,
      scope,
      requestedCategories,
      requestedProducts,
      notes: notes || undefined,
      status: 'new',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.catalogueRequests[id] = record;
    return record;
  });
}

export function listAdminCatalogueRequests(): CatalogueRequestRecord[] {
  const store = getStoreReadonly();
  return Object.values(store.catalogueRequests).sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt)),
  );
}

export async function updateAdminCatalogueRequest(params: {
  id: string;
  actorEmail: string;
  status: CatalogueRequestStatus;
  assignedPortfolioId?: string;
  adminNotes?: string;
}): Promise<CatalogueRequestRecord> {
  if (!['new', 'reviewed', 'sent', 'archived'].includes(params.status)) {
    throw new CommerceHttpError(400, 'Invalid catalogue request status.');
  }

  return withStoreLock((store) => {
    const existing =
      store.catalogueRequests[params.id] ??
      Object.values(store.catalogueRequests).find((r) => r.requestRef === params.id);
    if (!existing) {
      throw new CommerceHttpError(404, 'Catalogue request not found.');
    }

    if (params.assignedPortfolioId) {
      const pf = store.portfolios[params.assignedPortfolioId];
      if (!pf) {
        throw new CommerceHttpError(404, 'Assigned portfolio version was not found.');
      }
      if (pf.brandId !== existing.brandId) {
        throw new CommerceHttpError(
          400,
          `Assigned portfolio (${pf.brandId}) must match requested brand (${existing.brandId}).`,
        );
      }
      if (pf.status !== 'published') {
        throw new CommerceHttpError(
          400,
          'Only a Published portfolio version may be assigned to a customer request.',
        );
      }
      existing.assignedPortfolioId = pf.id;
      existing.assignedPortfolioVersion = pf.version;
    }

    if (typeof params.adminNotes === 'string') {
      existing.adminNotes = sanitizePlainText(params.adminNotes, 1000);
    }
    existing.status = params.status;
    existing.updatedBy = params.actorEmail;
    existing.updatedAt = new Date().toISOString();

    recordAdminAuditLog(store, {
      actorEmail: params.actorEmail,
      action: 'catalogue_request_updated',
      targetType: 'catalogue_request',
      targetId: existing.requestRef,
      summary: `Updated ${existing.requestRef} -> ${existing.status}${existing.assignedPortfolioVersion ? ` (${existing.assignedPortfolioVersion})` : ''}.`,
    });

    return existing;
  });
}

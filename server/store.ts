import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AdminAuditLogEntry,
  AdminRole,
  CommerceSettingsConfig,
  CountryQuotationRecord,
  ExportProductOverride,
  InternationalEnquiryRecord,
  InternationalEnquiryStatus,
  OrderItemSnapshot,
  OrderRecord,
  OrderStatus,
  PaymentHistoryEntry,
  PaymentMethodId,
  PaymentStatus,
  ShippingStatus,
} from '../src/types/admin.ts';
import type {
  ConfiguredCurrency,
  CurrencyCode,
  InternationalBusinessType,
  Product,
} from '../src/types/commerce.ts';
import {PAYMENT_ADAPTERS} from './payments/adapters.ts';
import {
  calculateAuthoritativeShipping,
  convertUsdToConfiguredCurrency,
  resolveConfiguredCurrency,
} from './shipping.ts';
import type {
  CheckoutOrderInput,
  InternationalEnquiryInput,
  QuoteItemInput,
  ServerCommerceStore,
} from './types.ts';

const ROOT_DIR = process.cwd();
const DEFAULT_DATA_DIR = process.env.FUNCTION_TARGET
  ? '/tmp/ceylon-heritage-data'
  : path.join(ROOT_DIR, '.data');
const DATA_DIR = path.resolve(process.env.COMMERCE_DATA_DIR || DEFAULT_DATA_DIR);
const STORE_FILE = path.join(DATA_DIR, 'commerce-store.json');
const SLIPS_DIR = path.join(DATA_DIR, 'slips');
const PORTFOLIOS_DIR = path.join(DATA_DIR, 'portfolios');

const PRODUCTS_JSON_PATH = path.resolve(ROOT_DIR, 'src/data/products.json');
const FIREBASE_CONFIG_PATH = path.resolve(ROOT_DIR, 'firebase-applet-config.json');

export const BOOTSTRAP_ADMIN_EMAIL = 'brandallanka@gmail.com';

const VALID_ADMIN_ROLES: AdminRole[] = ['super_admin', 'catalog_manager', 'order_manager'];

export function sanitizePlainText(raw: unknown, maxLen: number): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, maxLen);
}

export function resolveAdminRole(store: ServerCommerceStore, rawEmail: string): AdminRole | null {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email) return null;
  if (email === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
    return 'super_admin';
  }
  const mappedRole = store.adminRolesByEmail?.[email];
  if (mappedRole && VALID_ADMIN_ROLES.includes(mappedRole)) {
    return mappedRole;
  }
  if (store.adminAllowlistEmails.some((e) => e.toLowerCase() === email)) {
    return 'super_admin';
  }
  return null;
}

export function recordAdminAuditLog(
  store: ServerCommerceStore,
  entry: Omit<AdminAuditLogEntry, 'id' | 'createdAt' | 'actorRole'> & {actorRole?: AdminRole},
): AdminAuditLogEntry {
  const actorEmail = entry.actorEmail.toLowerCase();
  const actorRole = entry.actorRole ?? resolveAdminRole(store, actorEmail) ?? 'super_admin';
  const record: AdminAuditLogEntry = {
    id: `aud-${crypto.randomUUID().slice(0, 12)}`,
    actorEmail,
    actorRole,
    action: sanitizePlainText(entry.action, 80),
    targetType: entry.targetType,
    targetId: sanitizePlainText(entry.targetId, 120),
    summary: sanitizePlainText(entry.summary, 280),
    createdAt: new Date().toISOString(),
  };
  store.auditLogs = [record, ...(store.auditLogs ?? [])].slice(0, 500);
  return record;
}

export function safeEqualToken(expected?: string | null, provided?: string | null): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const DEFAULT_COUNTRY_POLICY =
  'Shipping rates apply ex-Colombo dispatch. Import duties, destination taxes, and customs clearance charges are handled by the buyer unless expressly agreed on a formal proforma invoice. Transit times are confirmed only upon carrier booking.';

const DEFAULT_CURRENCIES: ConfiguredCurrency[] = [
  {code: 'LKR', symbol: 'LKR', name: 'Sri Lankan Rupee', ratePerUsd: 300, enabled: true, isDefault: true},
  {code: 'USD', symbol: '$', name: 'US Dollar', ratePerUsd: 1, enabled: true},
  {code: 'EUR', symbol: '€', name: 'Euro', ratePerUsd: 0.92, enabled: false},
  {code: 'GBP', symbol: '£', name: 'British Pound', ratePerUsd: 0.79, enabled: false},
  {code: 'AED', symbol: 'AED', name: 'UAE Dirham', ratePerUsd: 3.67, enabled: false},
  {code: 'AUD', symbol: 'A$', name: 'Australian Dollar', ratePerUsd: 1.54, enabled: false},
];

export const VALID_BUSINESS_TYPES: InternationalBusinessType[] = [
  'Importer',
  'Distributor',
  'Wholesaler',
  'Retailer',
  'Private Label Buyer',
  'Other',
];

const DEFAULT_COMMERCE_SETTINGS: CommerceSettingsConfig = {
  whatsappNumber: '94770000000',
  brandWhatsappNumbers: {
    ceyvana: '94770000000',
    ceylomira: '94770000000',
    'hand-crafts': '94770000000',
  },
  currencies: DEFAULT_CURRENCIES,
  exportConfig: {
    defaultMoqUnits: 25,
    packagingFormats: [
      'Retail Sealed Pouches (50g–500g)',
      '1kg Barrier Foil Pouches',
      '5kg Bulk Trade Bags',
      '25kg Multi-wall Kraft Sacks',
      'Private Label (Buyer Artwork & OEM)',
    ],
    ratePolicyNote:
      'Export pricing and MOQs serve as planning references. Final country-specific quotations include verified freight terms without unverified delivery time or customs duty promises.',
    fxServiceNote:
      'Additional currencies use administrator-configured exchange rates relative to USD until a verified exchange-rate service is connected.',
  },
  portfolioSettings: {
    requireRegistrationForPublicDownload: false,
    allowCustomPublicCatalogSelection: true,
  },
  payment: {
    whatsappOrderEnabled: true,
    bankTransferEnabled: true,
    codEnabled: false,
    slGatewayEnabled: false,
    intlGatewayEnabled: false,
    sandboxMode: true,
    bankDetails: {
      bankName: 'Commercial Bank of Ceylon PLC',
      accountName: 'Ceylon Heritage House (Pvt) Ltd',
      accountNumber: '1000482910',
      branchName: 'Colombo Fort Main Branch',
      swiftCode: 'CCEYLKLX',
      instructions:
        'Include your Order Reference (e.g., CH-2026-1003) as the transfer remark and submit your bank reference or slip below. Orders remain in Payment Verification until confirmed by our Colombo finance desk.',
    },
  },
  shipping: {
    freeShippingThresholdLkr: 15000,
    localExpressSurchargeLkr: 550,
    internationalQuoteEnabled: true,
    usdToLkrRate: 300,
    localZones: [
      {
        id: 'colombo-suburbs',
        name: 'Colombo 01–15 & Suburbs',
        baseRateLkr: 350,
        extraPerKgLkr: 100,
        enabled: true,
      },
      {
        id: 'western-province',
        name: 'Western Province (Gampaha / Kalutara)',
        baseRateLkr: 450,
        extraPerKgLkr: 150,
        enabled: true,
      },
      {
        id: 'islandwide',
        name: 'Islandwide Courier (All Other Districts)',
        baseRateLkr: 600,
        extraPerKgLkr: 180,
        enabled: true,
      },
    ],
    internationalRates: [
      {
        country: 'United Kingdom',
        baseUsd: 24,
        extraPer500gUsd: 11,
        enabled: true,
        policyNote: 'Dispatched via international air courier or commercial freight quotation. UK VAT/import clearance applies upon arrival per buyer import registration.',
      },
      {
        country: 'United States',
        baseUsd: 28,
        extraPer500gUsd: 13,
        enabled: true,
        policyNote: 'Commercial invoice & packing list provided per US import entry requirements. Buyer confirms FDA Prior Notice / broker handling before dispatch.',
      },
      {
        country: 'Australia',
        baseUsd: 22,
        extraPer500gUsd: 10,
        enabled: true,
        policyNote: 'Sealed retail & wholesale botanicals packed per commercial invoice; Australian biosecurity inspection and import charges remain buyer responsibility.',
      },
      {
        country: 'United Arab Emirates',
        baseUsd: 18,
        extraPer500gUsd: 8,
        enabled: true,
        policyNote: 'Regional air express & trade pallet quotations from Colombo. Destination municipality inspection & customs duty governed by UAE importer of record.',
      },
      {
        country: 'Singapore',
        baseUsd: 16,
        extraPer500gUsd: 7,
        enabled: true,
        policyNote: 'Consolidated air freight or courier dispatch upon confirmed quotation. Singapore GST and customs clearance handled by consignee.',
      },
      {
        country: 'India',
        baseUsd: 14,
        extraPer500gUsd: 6,
        enabled: true,
        policyNote: 'Cross-strait air courier and commercial sea/air freight options quoted upon review with importer licensing confirmation.',
      },
      {
        country: 'Germany',
        baseUsd: 25,
        extraPer500gUsd: 11,
        enabled: true,
        policyNote: 'EU EORI consignee details requested prior to commercial export dispatch. Import VAT & customs duties paid by importer upon entry.',
      },
      {
        country: 'Canada',
        baseUsd: 28,
        extraPer500gUsd: 13,
        enabled: true,
        policyNote: 'Commercial air dispatch or bulk quotation with buyer-arranged CBSA customs brokerage.',
      },
      {
        country: 'Japan',
        baseUsd: 23,
        extraPer500gUsd: 10,
        enabled: true,
        policyNote: 'Quoted with commercial specification sheets; Japanese importer confirms botanical import clearance prior to dispatch.',
      },
      {
        country: 'Rest of World',
        baseUsd: 32,
        extraPer500gUsd: 14,
        enabled: true,
        policyNote: DEFAULT_COUNTRY_POLICY,
      },
    ],
  },
};

function createInitialStore(): ServerCommerceStore {
  return {
    nextOrderSeq: 1003,
    nextEnquirySeq: 2001,
    nextPortfolioSeq: 1001,
    nextCatalogueRequestSeq: 3001,
    settings: structuredClone(DEFAULT_COMMERCE_SETTINGS),
    adminAllowlistEmails: [BOOTSTRAP_ADMIN_EMAIL],
    adminRolesByEmail: {
      [BOOTSTRAP_ADMIN_EMAIL.toLowerCase()]: 'super_admin',
    },
    auditLogs: [],
    stockOverrides: {},
    exportOverrides: {},
    orders: {},
    customers: {},
    enquiries: {},
    portfolios: {},
    catalogueRequests: {},
    idempotencyIndex: {},
    processedWebhookEvents: {},
  };
}

function ensureDirectories(): void {
  fs.mkdirSync(DATA_DIR, {recursive: true});
  fs.mkdirSync(SLIPS_DIR, {recursive: true});
  fs.mkdirSync(PORTFOLIOS_DIR, {recursive: true});
}

function mergeCurrencies(
  saved: ConfiguredCurrency[] | undefined,
  usdToLkrRate: number,
): ConfiguredCurrency[] {
  const baseList = structuredClone(DEFAULT_CURRENCIES);
  const byCode = new Map<string, ConfiguredCurrency>();
  for (const item of baseList) {
    byCode.set(item.code, item);
  }
  for (const raw of saved ?? []) {
    const code = String(raw.code || '').trim().toUpperCase();
    if (!code) continue;
    const prev = byCode.get(code);
    byCode.set(code, {
      code,
      symbol: String(raw.symbol || prev?.symbol || code).slice(0, 8),
      name: String(raw.name || prev?.name || code).slice(0, 50),
      ratePerUsd:
        code === 'USD'
          ? 1
          : code === 'LKR'
            ? Math.max(1, Number(raw.ratePerUsd) || usdToLkrRate || 300)
            : Math.max(0.0001, Number(raw.ratePerUsd) || prev?.ratePerUsd || 1),
      enabled: code === 'LKR' || code === 'USD' ? raw.enabled !== false : Boolean(raw.enabled),
      isDefault: prev?.isDefault,
    });
  }
  return Array.from(byCode.values());
}

function readStoreSync(): ServerCommerceStore {
  ensureDirectories();
  if (!fs.existsSync(STORE_FILE)) {
    const fresh = createInitialStore();
    fs.writeFileSync(STORE_FILE, JSON.stringify(fresh, null, 2), 'utf8');
    return fresh;
  }
  const raw = fs.readFileSync(STORE_FILE, 'utf8');
  const parsed = JSON.parse(raw) as Partial<ServerCommerceStore>;
  const usdToLkr = parsed.settings?.shipping?.usdToLkrRate ?? DEFAULT_COMMERCE_SETTINGS.shipping.usdToLkrRate;
  const intlRates = (parsed.settings?.shipping?.internationalRates ??
    DEFAULT_COMMERCE_SETTINGS.shipping.internationalRates).map((r) => {
    const def = DEFAULT_COMMERCE_SETTINGS.shipping.internationalRates.find(
      (d) => d.country.toLowerCase() === r.country.toLowerCase(),
    );
    return {
      ...r,
      policyNote: r.policyNote ?? def?.policyNote ?? DEFAULT_COUNTRY_POLICY,
    };
  });

  return {
    nextOrderSeq: parsed.nextOrderSeq ?? 1003,
    nextEnquirySeq: parsed.nextEnquirySeq ?? 2001,
    nextPortfolioSeq: parsed.nextPortfolioSeq ?? 1001,
    nextCatalogueRequestSeq: parsed.nextCatalogueRequestSeq ?? 3001,
    settings: {
      ...DEFAULT_COMMERCE_SETTINGS,
      ...parsed.settings,
      brandWhatsappNumbers: {
        ...DEFAULT_COMMERCE_SETTINGS.brandWhatsappNumbers!,
        ...(parsed.settings?.brandWhatsappNumbers ?? {}),
      },
      portfolioSettings: {
        ...DEFAULT_COMMERCE_SETTINGS.portfolioSettings!,
        ...(parsed.settings?.portfolioSettings ?? {}),
      },
      currencies: mergeCurrencies(parsed.settings?.currencies, usdToLkr),
      exportConfig: {
        ...DEFAULT_COMMERCE_SETTINGS.exportConfig,
        ...parsed.settings?.exportConfig,
      },
      payment: {
        ...DEFAULT_COMMERCE_SETTINGS.payment,
        ...parsed.settings?.payment,
        whatsappOrderEnabled: parsed.settings?.payment?.whatsappOrderEnabled !== false,
        bankDetails: {
          ...DEFAULT_COMMERCE_SETTINGS.payment.bankDetails,
          ...parsed.settings?.payment?.bankDetails,
        },
      },
      shipping: {
        ...DEFAULT_COMMERCE_SETTINGS.shipping,
        ...parsed.settings?.shipping,
        internationalRates: intlRates,
      },
    },
    adminAllowlistEmails: parsed.adminAllowlistEmails?.length
      ? parsed.adminAllowlistEmails
      : [BOOTSTRAP_ADMIN_EMAIL],
    adminRolesByEmail: {
      ...Object.fromEntries(
        (parsed.adminAllowlistEmails ?? []).map((e) => [String(e).toLowerCase(), 'super_admin' as AdminRole]),
      ),
      ...(parsed.adminRolesByEmail ?? {}),
      [BOOTSTRAP_ADMIN_EMAIL.toLowerCase()]: 'super_admin',
    },
    auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs.slice(0, 500) : [],
    stockOverrides: parsed.stockOverrides ?? {},
    exportOverrides: parsed.exportOverrides ?? {},
    orders: parsed.orders ?? {},
    customers: parsed.customers ?? {},
    enquiries: parsed.enquiries ?? {},
    portfolios: parsed.portfolios ?? {},
    catalogueRequests: parsed.catalogueRequests ?? {},
    idempotencyIndex: parsed.idempotencyIndex ?? {},
    processedWebhookEvents: parsed.processedWebhookEvents ?? {},
  };
}

function writeStoreSync(store: ServerCommerceStore): void {
  ensureDirectories();
  const tmpPath = `${STORE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_FILE);
}

let storeQueue: Promise<unknown> = Promise.resolve();

export function withStoreLock<T>(fn: (store: ServerCommerceStore) => Promise<T> | T): Promise<T> {
  const run = storeQueue.then(async () => {
    const current = readStoreSync();
    const result = await fn(current);
    writeStoreSync(current);
    return result;
  });
  storeQueue = run.catch(() => undefined);
  return run;
}

export function getStoreReadonly(): ServerCommerceStore {
  return readStoreSync();
}

// ---------------------------------------------------------------------------
// Authoritative Catalog Loader (Firestore Public REST + Static JSON Fallback)
// ---------------------------------------------------------------------------
interface FirestoreRestValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  arrayValue?: {values?: FirestoreRestValue[]};
  mapValue?: {fields?: Record<string, FirestoreRestValue>};
}

function decodeFirestoreValue(val: FirestoreRestValue): unknown {
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('arrayValue' in val) {
    return (val.arrayValue?.values ?? []).map(decodeFirestoreValue);
  }
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val.mapValue?.fields ?? {})) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  return undefined;
}

let catalogCache: {products: Product[]; fetchedAt: number} | null = null;

function readFallbackProducts(): Product[] {
  const raw = fs.readFileSync(PRODUCTS_JSON_PATH, 'utf8');
  return JSON.parse(raw) as Product[];
}

function computeDefaultExportUsd(product: Product): number {
  const sorted = [...product.variants].sort((a, b) => b.weightGrams - a.weightGrams);
  const largest = sorted[0] ?? product.variants[0];
  if (!largest) return 15;
  // Wholesale reference derived conservatively from largest retail pack rate per kg (~15% wholesale tier discount)
  const perKg = (largest.priceUsd / Math.max(50, largest.weightGrams)) * 1000 * 0.85;
  return Number(perKg.toFixed(2));
}

export async function getAuthoritativeProducts(store?: ServerCommerceStore): Promise<Product[]> {
  const activeStore = store ?? readStoreSync();
  const now = Date.now();
  let baseProducts: Product[] | null =
    catalogCache && now - catalogCache.fetchedAt < 15_000 ? catalogCache.products : null;

  if (!baseProducts) {
    try {
      const cfg = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_PATH, 'utf8')) as {
        projectId: string;
        firestoreDatabaseId: string;
      };
      const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/${encodeURIComponent(cfg.firestoreDatabaseId)}/documents/products?pageSize=100`;
      const resp = await fetch(url, {signal: AbortSignal.timeout(3000)});
      if (resp.ok) {
        const json = (await resp.json()) as {
          documents?: {fields?: Record<string, FirestoreRestValue>}[];
        };
        const decoded = (json.documents ?? [])
          .map((d) => decodeFirestoreValue({mapValue: {fields: d.fields ?? {}}}) as Product)
          .filter((p) => p && p.id && !p.isArchived);
        if (decoded.length > 0) {
          baseProducts = decoded;
          catalogCache = {products: decoded, fetchedAt: now};
        }
      }
    } catch {
      // Fall back to verified static catalog snapshot
    }
  }

  if (!baseProducts) {
    baseProducts = readFallbackProducts();
  }

  return baseProducts.map((p) => {
    const expOverride = activeStore.exportOverrides[p.id];
    const defaultPacks =
      p.bulkPackSizes && p.bulkPackSizes.length > 0
        ? p.bulkPackSizes
        : [
            ...p.variants.map((v) => `${v.label} Retail Barrier Pouch`),
            '1kg Trade Foil Pouch',
            '5kg Export Bulk Pouch',
          ];

    return {
      ...p,
      exportable: expOverride ? expOverride.exportable : p.exportable !== false,
      moqUnits:
        expOverride?.moqUnits ?? p.moqUnits ?? activeStore.settings.exportConfig.defaultMoqUnits,
      exportPriceUsd:
        expOverride?.exportPriceUsd ?? p.exportPriceUsd ?? computeDefaultExportUsd(p),
      bulkPackSizes:
        expOverride?.bulkPackSizes && expOverride.bulkPackSizes.length > 0
          ? expOverride.bulkPackSizes
          : defaultPacks,
      variants: p.variants.map((v) => {
        const override = activeStore.stockOverrides[v.variantSku];
        return override
          ? {
              ...v,
              stockQuantity: Math.max(0, override.stockQuantity),
              available: override.available && override.stockQuantity > 0,
            }
          : v;
      }),
    };
  });
}

export function clearCatalogCache(): void {
  catalogCache = null;
}

// ---------------------------------------------------------------------------
// Payment Slip Safe Verification & Storage
// ---------------------------------------------------------------------------
function detectMagicMime(buf: Buffer): {ext: string; mime: string} | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return {ext: 'jpg', mime: 'image/jpeg'};
  }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return {ext: 'png', mime: 'image/png'};
  }
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return {ext: 'webp', mime: 'image/webp'};
  }
  if (buf.subarray(0, 4).toString('ascii') === '%PDF') {
    return {ext: 'pdf', mime: 'application/pdf'};
  }
  return null;
}

export function savePaymentSlip(base64Input: string): string {
  ensureDirectories();
  const cleaned = base64Input.includes(',')
    ? base64Input.slice(base64Input.indexOf(',') + 1)
    : base64Input;
  const buf = Buffer.from(cleaned.trim(), 'base64');
  if (buf.length === 0 || buf.length > 2 * 1024 * 1024) {
    throw new Error('Payment slip must be a non-empty file under 2MB.');
  }
  const detected = detectMagicMime(buf);
  if (!detected) {
    throw new Error('Payment slip must be a valid JPEG, PNG, WebP, or PDF file.');
  }
  const safeFile = `slip-${crypto.randomUUID()}.${detected.ext}`;
  const resolved = path.resolve(SLIPS_DIR, safeFile);
  if (!resolved.startsWith(SLIPS_DIR + path.sep)) {
    throw new Error('Invalid payment slip path.');
  }
  fs.writeFileSync(resolved, buf);
  return safeFile;
}

export function resolveSafeSlipPath(fileName: string): string | null {
  ensureDirectories();
  const base = path.basename(fileName);
  if (!/^slip-[a-f0-9-]+\.(jpg|png|webp|pdf)$/i.test(base)) {
    return null;
  }
  const resolved = path.resolve(SLIPS_DIR, base);
  if (!resolved.startsWith(SLIPS_DIR + path.sep) || !fs.existsSync(resolved)) {
    return null;
  }
  return resolved;
}

export function savePortfolioPdfFile(fileName: string, pdfBuffer: Buffer): string {
  ensureDirectories();
  const base = path.basename(fileName);
  if (!/^portfolio-[a-z0-9-]+\.pdf$/i.test(base)) {
    throw new Error('Invalid portfolio PDF file name.');
  }
  if (!pdfBuffer || pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('Generated portfolio binary must be a valid PDF.');
  }
  const resolved = path.resolve(PORTFOLIOS_DIR, base);
  if (!resolved.startsWith(PORTFOLIOS_DIR + path.sep)) {
    throw new Error('Invalid portfolio PDF destination path.');
  }
  fs.writeFileSync(resolved, pdfBuffer);
  return base;
}

export function resolveSafePortfolioPdfPath(fileName: string): string | null {
  ensureDirectories();
  const base = path.basename(fileName);
  if (!/^portfolio-[a-z0-9-]+\.pdf$/i.test(base)) {
    return null;
  }
  const resolved = path.resolve(PORTFOLIOS_DIR, base);
  if (!resolved.startsWith(PORTFOLIOS_DIR + path.sep) || !fs.existsSync(resolved)) {
    return null;
  }
  return resolved;
}

export function computeCatalogFingerprint(products: Product[]): string {
  const canonical = [...products]
    .filter((p) => !p.isArchived)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      brandId: p.brandId,
      name: p.name,
      category: p.category,
      description: p.description,
      tastingNotes: p.tastingNotes,
      origin: p.origin,
      highlights: p.highlights,
      ingredients: p.ingredients,
      storageInstructions: p.storageInstructions,
      packagingType: p.packagingType,
      technicalSpecs: p.technicalSpecs,
      certifications: p.certifications,
      exportable: p.exportable,
      moqUnits: p.moqUnits,
      exportPriceUsd: p.exportPriceUsd,
      bulkPackSizes: p.bulkPackSizes,
      exportSpecs: p.exportSpecs,
      variants: p.variants.map((v) => ({
        sku: v.variantSku,
        label: v.label,
        g: v.weightGrams,
        lkr: v.priceLkr,
        usd: v.priceUsd,
        avail: v.available,
      })),
    }));
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Authoritative Quote & Order Creation
// ---------------------------------------------------------------------------
export async function computeOrderQuote(params: {
  items: QuoteItemInput[];
  currency: CurrencyCode;
  country: string;
  deliveryMethod: CheckoutOrderInput['deliveryMethod'];
  localZoneId?: string;
  store?: ServerCommerceStore;
}): Promise<{
  currency: CurrencyCode;
  items: OrderItemSnapshot[];
  subtotalLkr: number;
  subtotalUsd: number;
  subtotal: number;
  totalWeightGrams: number;
  shippingFee: number;
  shippingLabel: string;
  shippingPolicyNote?: string;
  freeShippingApplied: boolean;
  isQuotePending: boolean;
  totalAmount: number;
  itemCount: number;
}> {
  if (!Array.isArray(params.items) || params.items.length === 0 || params.items.length > 50) {
    throw new Error('Cart must contain between 1 and 50 items.');
  }

  const activeStore = params.store ?? readStoreSync();
  const currencyCfg = resolveConfiguredCurrency(params.currency, activeStore.settings);
  const resolvedCurrency = currencyCfg.code;
  const catalog = await getAuthoritativeProducts(activeStore);

  // Aggregate duplicate SKUs so callers cannot split qty to bypass stock guard
  const merged = new Map<string, {productId: string; variantSku: string; qty: number}>();
  for (const raw of params.items) {
    if (
      !raw ||
      typeof raw.productId !== 'string' ||
      typeof raw.variantSku !== 'string' ||
      typeof raw.qty !== 'number' ||
      !Number.isInteger(raw.qty) ||
      raw.qty < 1 ||
      raw.qty > 100
    ) {
      throw new Error('Every cart item must have a valid SKU and integer quantity between 1 and 100.');
    }
    const existing = merged.get(raw.variantSku);
    const nextQty = (existing?.qty ?? 0) + raw.qty;
    if (nextQty > 100) {
      throw new Error(`Maximum quantity per variant is 100 (${raw.variantSku}).`);
    }
    merged.set(raw.variantSku, {
      productId: raw.productId,
      variantSku: raw.variantSku,
      qty: nextQty,
    });
  }

  const resolvedItems: OrderItemSnapshot[] = [];
  let subtotalLkr = 0;
  let subtotalUsd = 0;
  let totalWeightGrams = 0;
  let itemCount = 0;

  for (const reqItem of merged.values()) {
    const product = catalog.find((p) => p.id === reqItem.productId && !p.isArchived);
    if (!product) {
      throw new Error(`Product ${reqItem.productId} is not available.`);
    }
    const variant = product.variants.find((v) => v.variantSku === reqItem.variantSku);
    if (!variant || !variant.available) {
      throw new Error(`Pack variant ${reqItem.variantSku} is currently unavailable.`);
    }
    if (variant.stockQuantity < reqItem.qty) {
      throw new Error(
        `Insufficient stock for ${product.name.en} (${variant.label}). Requested ${reqItem.qty}, only ${variant.stockQuantity} left.`,
      );
    }

    const unitPrice = convertUsdToConfiguredCurrency(
      variant.priceUsd,
      currencyCfg,
      variant.priceLkr,
    );
    subtotalLkr += variant.priceLkr * reqItem.qty;
    subtotalUsd += variant.priceUsd * reqItem.qty;
    totalWeightGrams += variant.weightGrams * reqItem.qty;
    itemCount += reqItem.qty;

    resolvedItems.push({
      productId: product.id,
      brandId: product.brandId,
      variantSku: variant.variantSku,
      name: `${product.name.en} (${variant.label})`,
      packSize: variant.label,
      weightGrams: variant.weightGrams,
      qty: reqItem.qty,
      unitPrice,
      unitPriceLkr: variant.priceLkr,
      unitPriceUsd: variant.priceUsd,
    });
  }

  subtotalUsd = Number(subtotalUsd.toFixed(2));
  const subtotal = convertUsdToConfiguredCurrency(subtotalUsd, currencyCfg, subtotalLkr);

  const shippingResult = calculateAuthoritativeShipping({
    subtotalLkr,
    totalWeightGrams,
    country: params.country || 'Sri Lanka',
    deliveryMethod: params.deliveryMethod,
    localZoneId: params.localZoneId,
    currency: resolvedCurrency,
    settings: activeStore.settings,
  });

  const totalAmount =
    resolvedCurrency === 'LKR'
      ? Math.round(subtotal + shippingResult.feeInCurrency)
      : Number((subtotal + shippingResult.feeInCurrency).toFixed(2));

  return {
    currency: resolvedCurrency,
    items: resolvedItems,
    subtotalLkr,
    subtotalUsd,
    subtotal,
    totalWeightGrams,
    shippingFee: shippingResult.feeInCurrency,
    shippingLabel: shippingResult.label,
    shippingPolicyNote: shippingResult.policyNote,
    freeShippingApplied: shippingResult.freeShippingApplied,
    isQuotePending: shippingResult.isQuotePending,
    totalAmount,
    itemCount,
  };
}

export class CommerceHttpError extends Error {
  status: number;
  details?: Record<string, unknown>;
  constructor(status: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function createServerOrder(input: CheckoutOrderInput): Promise<OrderRecord> {
  // Block raw card fields unconditionally
  const rawAny = input as unknown as Record<string, unknown>;
  if ('cardNumber' in rawAny || 'cvv' in rawAny || 'cardCvc' in rawAny) {
    throw new CommerceHttpError(400, 'Raw card details must never be submitted to this endpoint.');
  }

  if (
    !input.idempotencyKey ||
    typeof input.idempotencyKey !== 'string' ||
    input.idempotencyKey.trim().length < 8 ||
    input.idempotencyKey.trim().length > 128
  ) {
    throw new CommerceHttpError(400, 'A valid submission idempotency key is required.');
  }

  const isWhatsappQuickOrder = input.paymentMethod === 'whatsapp_order';
  const cleanName = sanitizePlainText(input.customerName, 120);
  const rawEmail = sanitizePlainText(input.email, 180).toLowerCase();
  const cleanEmail = rawEmail || (isWhatsappQuickOrder ? 'whatsapp-concierge@ceylonheritage.local' : '');
  const cleanPhone = sanitizePlainText(input.phone, 40);
  const cleanCountry = sanitizePlainText(input.country || (isWhatsappQuickOrder ? 'Sri Lanka' : ''), 80);
  const cleanAddress = sanitizePlainText(input.address, 300);
  const cleanCity = sanitizePlainText(input.city || (isWhatsappQuickOrder ? 'Direct Dispatch' : ''), 80);
  const cleanPostal = sanitizePlainText(input.postalCode || (isWhatsappQuickOrder ? '00000' : ''), 30);
  const cleanNotes = sanitizePlainText(input.orderNotes, 500);
  const cleanRef = sanitizePlainText(input.paymentReference, 120);

  if (
    cleanName.length < 2 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
    cleanPhone.length < 6 ||
    cleanCountry.length < 2 ||
    cleanAddress.length < 4 ||
    cleanCity.length < 2 ||
    cleanPostal.length < 2
  ) {
    throw new CommerceHttpError(400, 'Please complete all required customer and delivery address fields.');
  }

  const requestedCurrency = String(input.currency || 'LKR').trim().toUpperCase();

  return withStoreLock(async (store) => {
    let currency: CurrencyCode;
    try {
      currency = resolveConfiguredCurrency(requestedCurrency, store.settings).code;
    } catch (err) {
      throw new CommerceHttpError(400, err instanceof Error ? err.message : 'Unsupported currency.');
    }

    const idemKey = input.idempotencyKey.trim();
    const existingId = store.idempotencyIndex[idemKey];
    if (existingId && store.orders[existingId]) {
      throw new CommerceHttpError(409, 'Duplicate order submission prevented.', {
        existingOrderRef: store.orders[existingId].orderRef,
      });
    }

    // Validate payment method availability
    const method = input.paymentMethod;
    if (method === 'whatsapp_order') {
      if (store.settings.payment.whatsappOrderEnabled === false) {
        throw new CommerceHttpError(400, 'WhatsApp ordering is currently disabled.');
      }
    } else if (method === 'bank_transfer' && !store.settings.payment.bankTransferEnabled) {
      throw new CommerceHttpError(400, 'Bank Transfer is currently disabled.');
    } else if (method === 'cod') {
      if (!store.settings.payment.codEnabled) {
        throw new CommerceHttpError(400, 'Payment on Delivery is currently disabled by administrator.');
      }
      if (cleanCountry.toLowerCase() !== 'sri lanka') {
        throw new CommerceHttpError(400, 'Payment on Delivery is only available within Sri Lanka.');
      }
    } else if (method === 'sl_gateway' && !store.settings.payment.slGatewayEnabled) {
      throw new CommerceHttpError(400, 'Sri Lankan payment gateway is not enabled.');
    } else if (method === 'intl_gateway' && !store.settings.payment.intlGatewayEnabled) {
      throw new CommerceHttpError(400, 'International payment gateway is not enabled.');
    } else if (!['whatsapp_order', 'bank_transfer', 'cod', 'sl_gateway', 'intl_gateway'].includes(method)) {
      throw new CommerceHttpError(400, 'Unsupported payment method.');
    }

    let quote;
    try {
      quote = await computeOrderQuote({
        items: input.items,
        currency,
        country: cleanCountry,
        deliveryMethod: input.deliveryMethod,
        localZoneId: input.localZoneId,
        store,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid cart items.';
      const status = msg.includes('Insufficient stock') ? 409 : 400;
      throw new CommerceHttpError(status, msg);
    }

    let slipFile: string | undefined;
    if (input.paymentSlipBase64) {
      try {
        slipFile = savePaymentSlip(input.paymentSlipBase64);
      } catch (err) {
        throw new CommerceHttpError(
          400,
          err instanceof Error ? err.message : 'Invalid payment slip file.',
        );
      }
    }

    // Deduct stock atomically inside the lock (guaranteed >= 0)
    const catalog = await getAuthoritativeProducts(store);
    for (const item of quote.items) {
      const prod = catalog.find((p) => p.id === item.productId);
      const variant = prod?.variants.find((v) => v.variantSku === item.variantSku);
      const currentQty = variant?.stockQuantity ?? 0;
      const nextQty = currentQty - item.qty;
      if (nextQty < 0) {
        throw new CommerceHttpError(
          409,
          `Insufficient stock for ${item.name}. Available: ${currentQty}.`,
        );
      }
      store.stockOverrides[item.variantSku] = {
        stockQuantity: nextQty,
        available: nextQty > 0,
      };
    }

    const seq = store.nextOrderSeq++;
    const year = new Date().getFullYear();
    const orderRef = `CH-${year}-${seq}`;
    const orderId = `ord-${year}-${seq}-${crypto.randomBytes(2).toString('hex')}`;
    const receiptToken = crypto.randomBytes(24).toString('hex');
    const nowIso = new Date().toISOString();
    const monthKey = nowIso.slice(0, 7);

    const adapter = PAYMENT_ADAPTERS[method];
    const draftOrder: OrderRecord = {
      id: orderId,
      orderRef,
      customerId: `cust-${crypto.createHash('sha256').update(cleanEmail).digest('hex').slice(0, 12)}`,
      customerName: cleanName,
      customerEmail: cleanEmail,
      phone: cleanPhone,
      country: cleanCountry,
      address: cleanAddress,
      city: cleanCity,
      postalCode: cleanPostal,
      orderNotes: cleanNotes || undefined,
      deliveryMethod: input.deliveryMethod,
      localZoneId: input.localZoneId,
      paymentMethod: method,
      paymentReference: cleanRef || undefined,
      paymentSlipFile: slipFile,
      shippingStatus: 'not_dispatched',
      currency,
      subtotal: quote.subtotal,
      shippingFee: quote.shippingFee,
      totalAmount: quote.totalAmount,
      totalWeightGrams: quote.totalWeightGrams,
      itemCount: quote.itemCount,
      items: quote.items,
      orderStatus: 'pending',
      paymentStatus: 'pending',
      receiptToken,
      monthKey,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const paymentInit = adapter.initiatePayment(draftOrder, store.settings, {
      paymentReference: cleanRef,
      hasSlip: Boolean(slipFile),
    });

    draftOrder.paymentStatus = paymentInit.paymentStatus;
    draftOrder.orderStatus =
      method === 'whatsapp_order'
        ? 'new'
        : quote.isQuotePending
          ? 'awaiting_payment'
          : paymentInit.orderStatus;
    if (paymentInit.transactionRef && !draftOrder.paymentReference) {
      draftOrder.paymentReference = paymentInit.transactionRef;
    }

    const initialHistory: PaymentHistoryEntry = {
      id: `pay-${crypto.randomUUID().slice(0, 8)}`,
      eventType: 'order_initiated',
      method,
      status: draftOrder.paymentStatus,
      amount: draftOrder.totalAmount,
      currency,
      transactionRef: draftOrder.paymentReference,
      note: paymentInit.instructions,
      actor: 'customer_checkout',
      createdAt: nowIso,
    };
    draftOrder.paymentHistory = [initialHistory];

    // Upsert customer record safely
    const custId = draftOrder.customerId!;
    const prevCust = store.customers[custId];
    store.customers[custId] = {
      id: custId,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      country: cleanCountry,
      city: cleanCity,
      orderCount: (prevCust?.orderCount ?? 0) + 1,
      createdAt: prevCust?.createdAt ?? nowIso,
    };

    store.orders[orderId] = draftOrder;
    store.idempotencyIndex[idemKey] = orderId;

    return draftOrder;
  });
}

export async function attachBankTransferProof(params: {
  orderRef: string;
  receiptToken: string;
  paymentReference?: string;
  paymentSlipBase64?: string;
}): Promise<OrderRecord> {
  const cleanRef = String(params.paymentReference || '').trim().slice(0, 120);
  if (!cleanRef && !params.paymentSlipBase64) {
    throw new CommerceHttpError(400, 'Provide a payment reference or upload a payment slip.');
  }

  return withStoreLock((store) => {
    const order = Object.values(store.orders).find((o) => o.orderRef === params.orderRef);
    if (!order || !safeEqualToken(order.receiptToken, params.receiptToken)) {
      throw new CommerceHttpError(403, 'Invalid order receipt token.');
    }
    if (order.paymentMethod !== 'bank_transfer') {
      throw new CommerceHttpError(400, 'Payment slip submission only applies to Bank Transfer orders.');
    }
    if (order.paymentStatus === 'paid' || order.orderStatus === 'cancelled') {
      throw new CommerceHttpError(400, 'This order can no longer be updated for bank verification.');
    }

    if (params.paymentSlipBase64) {
      order.paymentSlipFile = savePaymentSlip(params.paymentSlipBase64);
    }
    if (cleanRef) {
      order.paymentReference = cleanRef;
    }

    const nowIso = new Date().toISOString();
    order.orderStatus = 'payment_verification';
    order.paymentStatus = 'pending_verification';
    order.updatedAt = nowIso;
    order.paymentHistory = [
      ...(order.paymentHistory ?? []),
      {
        id: `pay-${crypto.randomUUID().slice(0, 8)}`,
        eventType: 'bank_proof_submitted',
        method: 'bank_transfer',
        status: 'pending_verification',
        amount: order.totalAmount,
        currency: order.currency,
        transactionRef: order.paymentReference,
        note: order.paymentSlipFile ? 'Customer submitted reference & slip' : 'Customer submitted reference',
        actor: 'customer',
        createdAt: nowIso,
      },
    ];
    return order;
  });
}

export async function processVerifiedWebhook(params: {
  provider: PaymentMethodId;
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
}): Promise<{duplicate: boolean; order: OrderRecord}> {
  const adapter = PAYMENT_ADAPTERS[params.provider];
  if (!adapter?.verifyWebhook) {
    throw new CommerceHttpError(400, 'This payment method does not support webhooks.');
  }

  return withStoreLock((store) => {
    let event;
    try {
      event = adapter.verifyWebhook!(params.rawBody, params.headers, store.settings);
    } catch (err) {
      throw new CommerceHttpError(401, err instanceof Error ? err.message : 'Invalid webhook signature.');
    }

    if (store.processedWebhookEvents[event.eventId]) {
      const existingOrder = Object.values(store.orders).find(
        (o) => o.orderRef === store.processedWebhookEvents[event.eventId].orderRef,
      );
      if (existingOrder) {
        return {duplicate: true, order: existingOrder};
      }
      throw new CommerceHttpError(409, 'Duplicate webhook event rejected.');
    }

    const order = Object.values(store.orders).find((o) => o.orderRef === event.orderRef);
    if (!order) {
      throw new CommerceHttpError(404, `Order ${event.orderRef} not found.`);
    }

    if (order.currency !== event.currency || Math.abs(order.totalAmount - event.amount) > 0.01) {
      throw new CommerceHttpError(
        400,
        `Webhook amount/currency mismatch. Expected ${order.currency} ${order.totalAmount}, received ${event.currency} ${event.amount}.`,
      );
    }

    const nowIso = new Date().toISOString();
    store.processedWebhookEvents[event.eventId] = {
      orderRef: order.orderRef,
      provider: params.provider,
      processedAt: nowIso,
    };

    if (event.outcome === 'paid') {
      order.paymentStatus = 'paid';
      if (
        order.orderStatus === 'awaiting_payment' ||
        order.orderStatus === 'payment_verification' ||
        order.orderStatus === 'pending'
      ) {
        order.orderStatus = 'confirmed';
      }
    } else if (event.outcome === 'refunded') {
      order.paymentStatus = 'refunded';
      order.refundedAmount = order.totalAmount;
    } else {
      order.paymentStatus = 'failed';
      order.orderStatus = 'awaiting_payment';
    }

    order.paymentReference = event.transactionRef;
    order.updatedAt = nowIso;
    order.paymentHistory = [
      ...(order.paymentHistory ?? []),
      {
        id: `pay-${crypto.randomUUID().slice(0, 8)}`,
        eventType: `webhook_${event.outcome}`,
        method: params.provider,
        status: order.paymentStatus,
        amount: event.amount,
        currency: event.currency,
        transactionRef: event.transactionRef,
        note: event.rawSummary,
        actor: `webhook:${params.provider}`,
        createdAt: nowIso,
      },
    ];

    return {duplicate: false, order};
  });
}

export async function adminUpdateOrder(params: {
  orderId: string;
  actorEmail: string;
  orderStatus?: OrderStatus;
  shippingStatus?: ShippingStatus;
  trackingNumber?: string;
  carrier?: string;
  adminNotes?: string;
}): Promise<OrderRecord> {
  return withStoreLock(async (store) => {
    const order =
      store.orders[params.orderId] ??
      Object.values(store.orders).find((o) => o.orderRef === params.orderId);
    if (!order) {
      throw new CommerceHttpError(404, 'Order not found.');
    }

    const prevStatus = order.orderStatus;
    const nowIso = new Date().toISOString();

    if (params.orderStatus) {
      if (params.orderStatus === 'cancelled' && prevStatus !== 'cancelled') {
        const catalog = await getAuthoritativeProducts(store);
        for (const item of order.items) {
          const prod = catalog.find((p) => p.id === item.productId);
          const variant = prod?.variants.find((v) => v.variantSku === item.variantSku);
          const currentQty = variant?.stockQuantity ?? 0;
          const restored = currentQty + item.qty;
          store.stockOverrides[item.variantSku] = {
            stockQuantity: restored,
            available: restored > 0,
          };
        }
      }
      order.orderStatus = params.orderStatus;
      if (
        (params.orderStatus === 'shipped' || params.orderStatus === 'dispatched') &&
        (!order.shippingStatus || order.shippingStatus === 'not_dispatched')
      ) {
        order.shippingStatus = 'in_transit';
      }
      if (params.orderStatus === 'delivered' || params.orderStatus === 'completed') {
        order.shippingStatus = 'delivered';
      }
    }

    if (params.shippingStatus) {
      order.shippingStatus = params.shippingStatus;
    }
    if (typeof params.trackingNumber === 'string') {
      order.trackingNumber = sanitizePlainText(params.trackingNumber, 100);
    }
    if (typeof params.carrier === 'string') {
      order.carrier = sanitizePlainText(params.carrier, 80);
    }
    if (typeof params.adminNotes === 'string') {
      order.adminNotes = sanitizePlainText(params.adminNotes, 500);
    }
    order.updatedAt = nowIso;
    recordAdminAuditLog(store, {
      actorEmail: params.actorEmail,
      action: 'order_status_updated',
      targetType: 'order',
      targetId: order.orderRef,
      summary: `Order ${prevStatus} -> ${order.orderStatus}; Shipping -> ${order.shippingStatus || 'not_dispatched'}`,
    });
    return order;
  });
}

export async function adminVerifyBankTransfer(params: {
  orderId: string;
  actorEmail: string;
  decision: 'approve' | 'reject';
  transactionRef?: string;
  note?: string;
}): Promise<OrderRecord> {
  return withStoreLock((store) => {
    const order =
      store.orders[params.orderId] ??
      Object.values(store.orders).find((o) => o.orderRef === params.orderId);
    if (!order) {
      throw new CommerceHttpError(404, 'Order not found.');
    }
    if (params.decision === 'approve' && order.paymentStatus === 'paid') {
      throw new CommerceHttpError(409, 'Payment for this order has already been verified.');
    }

    const nowIso = new Date().toISOString();
    const cleanRef = (params.transactionRef || order.paymentReference || '').trim().slice(0, 120);
    if (cleanRef) {
      order.paymentReference = cleanRef;
    }

    if (params.decision === 'approve') {
      order.paymentStatus = 'paid';
      order.orderStatus = 'confirmed';
    } else {
      order.paymentStatus = 'failed';
      order.orderStatus = 'awaiting_payment';
    }
    order.updatedAt = nowIso;
    order.paymentHistory = [
      ...(order.paymentHistory ?? []),
      {
        id: `pay-${crypto.randomUUID().slice(0, 8)}`,
        eventType: params.decision === 'approve' ? 'bank_transfer_verified' : 'bank_transfer_rejected',
        method: order.paymentMethod || 'bank_transfer',
        status: order.paymentStatus,
        amount: order.totalAmount,
        currency: order.currency,
        transactionRef: cleanRef || undefined,
        note: params.note ? sanitizePlainText(params.note, 200) : undefined,
        actor: params.actorEmail,
        createdAt: nowIso,
      },
    ];
    recordAdminAuditLog(store, {
      actorEmail: params.actorEmail,
      action: params.decision === 'approve' ? 'bank_transfer_approved' : 'bank_transfer_rejected',
      targetType: 'payment',
      targetId: order.orderRef,
      summary: `${params.decision.toUpperCase()} payment ${order.currency} ${order.totalAmount}${cleanRef ? ` (Ref: ${cleanRef})` : ''}`,
    });
    return order;
  });
}

export async function adminRecordRefund(params: {
  orderId: string;
  actorEmail: string;
  amount: number;
  reason: string;
  transactionRef?: string;
}): Promise<OrderRecord> {
  if (typeof params.amount !== 'number' || !Number.isFinite(params.amount) || params.amount <= 0) {
    throw new CommerceHttpError(400, 'Refund amount must be positive.');
  }
  return withStoreLock((store) => {
    const order =
      store.orders[params.orderId] ??
      Object.values(store.orders).find((o) => o.orderRef === params.orderId);
    if (!order) {
      throw new CommerceHttpError(404, 'Order not found.');
    }
    if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'partially_refunded') {
      throw new CommerceHttpError(400, 'Only paid or partially refunded orders can be refunded.');
    }
    const prevRefunded = order.refundedAmount ?? 0;
    const nextRefunded = Number((prevRefunded + params.amount).toFixed(2));
    if (nextRefunded > order.totalAmount + 0.01) {
      throw new CommerceHttpError(400, 'Refund amount cannot exceed total paid amount.');
    }

    const nowIso = new Date().toISOString();
    order.refundedAmount = Math.min(order.totalAmount, nextRefunded);
    order.refundReason = params.reason.trim().slice(0, 240);
    const nextPaymentStatus: PaymentStatus =
      order.refundedAmount >= order.totalAmount - 0.01 ? 'refunded' : 'partially_refunded';
    order.paymentStatus = nextPaymentStatus;
    order.updatedAt = nowIso;
    order.paymentHistory = [
      ...(order.paymentHistory ?? []),
      {
        id: `pay-${crypto.randomUUID().slice(0, 8)}`,
        eventType: 'refund_recorded',
        method: order.paymentMethod || 'bank_transfer',
        status: nextPaymentStatus,
        amount: params.amount,
        currency: order.currency,
        transactionRef: params.transactionRef ? sanitizePlainText(params.transactionRef, 120) : undefined,
        note: order.refundReason,
        actor: params.actorEmail,
        createdAt: nowIso,
      },
    ];
    recordAdminAuditLog(store, {
      actorEmail: params.actorEmail,
      action: 'refund_recorded',
      targetType: 'payment',
      targetId: order.orderRef,
      summary: `Refund ${order.currency} ${params.amount} (${nextPaymentStatus}) — ${order.refundReason}`,
    });
    return order;
  });
}

// ---------------------------------------------------------------------------
// Phase 5: International Buyer Enquiries, Tracking, Country Quotations & CSV Export
// ---------------------------------------------------------------------------
export function validateOptionalWebsiteUrl(raw?: string): string | undefined {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length > 240) {
    throw new CommerceHttpError(400, 'Website URL must be 240 characters or fewer.');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new CommerceHttpError(
      400,
      'Website must be a valid URL starting with https:// or http://.',
    );
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new CommerceHttpError(
      400,
      'Only https:// or http:// website links are permitted.',
    );
  }
  return parsed.toString();
}

export async function createInternationalEnquiry(
  input: InternationalEnquiryInput,
): Promise<InternationalEnquiryRecord> {
  const companyName = sanitizePlainText(input.companyName, 140);
  const contactName = sanitizePlainText(input.contactName, 120);
  const email = sanitizePlainText(input.email, 180).toLowerCase();
  const phone = sanitizePlainText(input.phone, 40);
  const country = sanitizePlainText(input.country, 80);
  const website = validateOptionalWebsiteUrl(input.website);
  const businessType = input.businessType;
  const brandInterest = sanitizePlainText(input.brandInterest || 'Ceyvana & Ceylomira', 80);
  const requiredQuantities = sanitizePlainText(input.requiredQuantities, 160);
  const packagingRequirements = sanitizePlainText(input.packagingRequirements, 200);
  const destinationCountry = sanitizePlainText(input.destinationCountry, 80);
  const message = sanitizePlainText(input.message, 2500);

  if (companyName.length < 2) {
    throw new CommerceHttpError(400, 'Company name is required.');
  }
  if (contactName.length < 2) {
    throw new CommerceHttpError(400, 'Contact person name is required.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new CommerceHttpError(400, 'Please enter a valid business email address.');
  }
  if (country.length < 2 || destinationCountry.length < 2) {
    throw new CommerceHttpError(400, 'Origin country and destination country are required.');
  }
  if (!VALID_BUSINESS_TYPES.includes(businessType)) {
    throw new CommerceHttpError(400, 'Please select a valid business type.');
  }
  if (requiredQuantities.length < 1 || packagingRequirements.length < 2 || message.length < 5) {
    throw new CommerceHttpError(
      400,
      'Please specify required quantities, packaging requirements, and enquiry message.',
    );
  }

  const productInterests = Array.isArray(input.productInterests)
    ? Array.from(
        new Set(
          input.productInterests
            .map((p) => String(p || '').trim().slice(0, 120))
            .filter(Boolean),
        ),
      ).slice(0, 25)
    : [];

  return withStoreLock((store) => {
    const seq = store.nextEnquirySeq++;
    const year = new Date().getFullYear();
    const enquiryRef = `INT-${year}-${seq}`;
    const id = `enq-int-${year}-${seq}-${crypto.randomBytes(2).toString('hex')}`;
    const trackingToken = crypto.randomBytes(16).toString('hex');
    const nowIso = new Date().toISOString();

    const record: InternationalEnquiryRecord = {
      id,
      enquiryRef,
      trackingToken,
      type: input.type === 'wholesale' ? 'wholesale' : 'export',
      companyName,
      contactName,
      email,
      phone: phone || undefined,
      country,
      website,
      businessType,
      brandInterest,
      productInterests,
      requiredQuantities,
      packagingRequirements,
      destinationCountry,
      message,
      status: 'new',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.enquiries[id] = record;
    return record;
  });
}

export function trackInternationalEnquiry(params: {
  enquiryRef: string;
  credential: string;
}): {
  enquiryRef: string;
  companyName: string;
  contactName: string;
  businessType: InternationalBusinessType;
  brandInterest: string;
  productInterests: string[];
  requiredQuantities: string;
  packagingRequirements: string;
  destinationCountry: string;
  destinationPolicy?: string;
  status: InternationalEnquiryStatus;
  adminResponse?: string;
  respondedAt?: string;
  quotation?: CountryQuotationRecord;
  createdAt: string;
  updatedAt: string;
} {
  const refLower = String(params.enquiryRef || '').trim().toLowerCase();
  const credLower = String(params.credential || '').trim().toLowerCase();
  if (!refLower || !credLower) {
    throw new CommerceHttpError(400, 'Enquiry reference and business email or tracking token are required.');
  }

  const store = getStoreReadonly();
  const match = Object.values(store.enquiries).find(
    (e) => e.enquiryRef.toLowerCase() === refLower,
  );

  if (!match) {
    throw new CommerceHttpError(404, 'Enquiry reference not found.');
  }

  const emailMatches = match.email.toLowerCase() === credLower;
  const tokenMatches = safeEqualToken(match.trackingToken.toLowerCase(), credLower);
  if (!emailMatches && !tokenMatches) {
    throw new CommerceHttpError(403, 'Business email or tracking token does not match this enquiry.');
  }

  const countryPolicy =
    store.settings.shipping.internationalRates.find(
      (r) => r.country.toLowerCase() === match.destinationCountry.toLowerCase(),
    )?.policyNote ??
    store.settings.shipping.internationalRates.find(
      (r) => r.country.toLowerCase() === 'rest of world',
    )?.policyNote;

  return {
    enquiryRef: match.enquiryRef,
    companyName: match.companyName,
    contactName: match.contactName,
    businessType: match.businessType,
    brandInterest: match.brandInterest,
    productInterests: match.productInterests,
    requiredQuantities: match.requiredQuantities,
    packagingRequirements: match.packagingRequirements,
    destinationCountry: match.destinationCountry,
    destinationPolicy: countryPolicy,
    status: match.status,
    adminResponse: match.adminResponse,
    respondedAt: match.respondedAt,
    quotation: match.quotation,
    createdAt: match.createdAt,
    updatedAt: match.updatedAt,
  };
}

export async function adminRespondToInternationalEnquiry(params: {
  id: string;
  actorEmail: string;
  status: InternationalEnquiryStatus;
  adminResponse?: string;
  quotation?: {
    currency?: CurrencyCode;
    quotedAmount?: number;
    shippingEstimateAmount?: number;
    minOrderQty?: string;
    shippingPolicy?: string;
    validityNote?: string;
  };
}): Promise<InternationalEnquiryRecord> {
  const allowedStatuses: InternationalEnquiryStatus[] = [
    'new',
    'reviewed',
    'quoted',
    'responded',
    'archived',
  ];
  if (!allowedStatuses.includes(params.status)) {
    throw new CommerceHttpError(400, 'Invalid enquiry status.');
  }

  return withStoreLock((store) => {
    const existing =
      store.enquiries[params.id] ??
      Object.values(store.enquiries).find((e) => e.enquiryRef === params.id);
    if (!existing) {
      throw new CommerceHttpError(404, 'International enquiry not found.');
    }

    const nowIso = new Date().toISOString();
    existing.status = params.status;
    if (typeof params.adminResponse === 'string') {
      existing.adminResponse = sanitizePlainText(params.adminResponse, 2500);
      if (existing.adminResponse) {
        existing.respondedBy = params.actorEmail;
        existing.respondedAt = nowIso;
      }
    }

    if (params.quotation) {
      const currCode = params.quotation.currency
        ? resolveConfiguredCurrency(params.quotation.currency, store.settings).code
        : existing.quotation?.currency || 'USD';

      existing.quotation = {
        currency: currCode,
        quotedAmount:
          typeof params.quotation.quotedAmount === 'number' &&
          Number.isFinite(params.quotation.quotedAmount) &&
          params.quotation.quotedAmount >= 0
            ? Number(params.quotation.quotedAmount.toFixed(2))
            : undefined,
        shippingEstimateAmount:
          typeof params.quotation.shippingEstimateAmount === 'number' &&
          Number.isFinite(params.quotation.shippingEstimateAmount) &&
          params.quotation.shippingEstimateAmount >= 0
            ? Number(params.quotation.shippingEstimateAmount.toFixed(2))
            : undefined,
        minOrderQty: params.quotation.minOrderQty
          ? sanitizePlainText(params.quotation.minOrderQty, 120)
          : undefined,
        shippingPolicy: params.quotation.shippingPolicy
          ? sanitizePlainText(params.quotation.shippingPolicy, 500)
          : undefined,
        validityNote: params.quotation.validityNote
          ? sanitizePlainText(params.quotation.validityNote, 240)
          : undefined,
        quotedAt: nowIso,
      };
    }

    existing.updatedAt = nowIso;
    recordAdminAuditLog(store, {
      actorEmail: params.actorEmail,
      action: 'international_enquiry_updated',
      targetType: 'enquiry',
      targetId: existing.enquiryRef,
      summary: `Status -> ${existing.status}${existing.quotation ? `; Quoted ${existing.quotation.currency} ${existing.quotation.quotedAmount ?? 'TBD'}` : ''}`,
    });
    return existing;
  });
}

function escapeCsvCell(raw: unknown): string {
  const str = String(raw ?? '').replace(/\r\n/g, ' ').replace(/[\r\n]/g, ' ');
  // Neutralize CSV formula injection (=, +, -, @, tab, CR)
  const neutralized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export function buildInternationalEnquiriesCsv(records: InternationalEnquiryRecord[]): string {
  const headers = [
    'EnquiryRef',
    'Status',
    'CompanyName',
    'ContactName',
    'Email',
    'Phone',
    'OriginCountry',
    'DestinationCountry',
    'BusinessType',
    'Website',
    'BrandInterest',
    'ProductInterests',
    'RequiredQuantities',
    'PackagingRequirements',
    'Message',
    'QuotedCurrency',
    'QuotedAmount',
    'ShippingEstimate',
    'ConfirmedMOQ',
    'AdminResponse',
    'CreatedAt',
  ];

  const rows = records.map((r) => [
    r.enquiryRef,
    r.status,
    r.companyName,
    r.contactName,
    r.email,
    r.phone || '',
    r.country,
    r.destinationCountry,
    r.businessType,
    r.website || '',
    r.brandInterest,
    r.productInterests.join('; '),
    r.requiredQuantities,
    r.packagingRequirements,
    r.message,
    r.quotation?.currency || '',
    r.quotation?.quotedAmount ?? '',
    r.quotation?.shippingEstimateAmount ?? '',
    r.quotation?.minOrderQty || '',
    r.adminResponse || '',
    r.createdAt,
  ]);

  return [headers.join(','), ...rows.map((row) => row.map(escapeCsvCell).join(','))].join('\n');
}

export async function adminUpdateExportOverrides(
  updates: {
    productId: string;
    exportable: boolean;
    moqUnits: number;
    exportPriceUsd: number;
    bulkPackSizes: string[];
  }[],
  actorEmail = BOOTSTRAP_ADMIN_EMAIL,
): Promise<Record<string, ExportProductOverride>> {
  return withStoreLock((store) => {
    for (const u of updates) {
      if (!u.productId) continue;
      store.exportOverrides[u.productId] = {
        exportable: Boolean(u.exportable),
        moqUnits: Math.max(1, Math.round(Number(u.moqUnits) || 25)),
        exportPriceUsd: Math.max(0.1, Number(Number(u.exportPriceUsd || 10).toFixed(2))),
        bulkPackSizes: Array.isArray(u.bulkPackSizes)
          ? u.bulkPackSizes.map((s) => sanitizePlainText(s, 80)).filter(Boolean).slice(0, 10)
          : [],
      };
    }
    recordAdminAuditLog(store, {
      actorEmail,
      action: 'export_catalog_synced',
      targetType: 'export',
      targetId: `${updates.length}_products`,
      summary: `Synchronized export MOQ/pricing overrides for ${updates.length} product(s).`,
    });
    return store.exportOverrides;
  });
}


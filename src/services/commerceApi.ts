import {getAppCheckTokenHeader} from '../lib/firebaseAppCheck';
import type {
  AdminAuditLogEntry,
  AdminRole,
  AdminSessionInfo,
  CatalogueRequestRecord,
  CatalogueRequestStatus,
  CommerceSettingsConfig,
  CountryQuotationRecord,
  CustomerRecord,
  DeliveryMethodId,
  ExportSettingsConfig,
  InternationalEnquiryRecord,
  InternationalEnquiryStatus,
  InternationalRateConfig,
  OrderItemSnapshot,
  OrderRecord,
  OrderStatus,
  PaymentMethodId,
  PortfolioCoverDesign,
  PortfolioFieldOptions,
  PortfolioOrientation,
  PortfolioRecord,
  PortfolioStatus,
  ShippingStatus,
} from '../types/admin';
import type {
  BrandId,
  ConfiguredCurrency,
  CurrencyCode,
  InternationalBusinessType,
  Product,
} from '../types/commerce';

export interface PublicCommerceConfig {
  whatsappNumber: string;
  brandWhatsappNumbers?: {
    ceyvana: string;
    ceylomira: string;
    'hand-crafts': string;
  };
  portfolioSettings?: {
    requireRegistrationForPublicDownload: boolean;
    allowCustomPublicCatalogSelection: boolean;
  };
  currencies: ConfiguredCurrency[];
  exportConfig: ExportSettingsConfig;
  payment: CommerceSettingsConfig['payment'] & {
    slGatewayConfigured: boolean;
    intlGatewayConfigured: boolean;
  };
  shipping: CommerceSettingsConfig['shipping'];
  liveStockBySku: Record<string, {stockQuantity: number; available: boolean}>;
}

export interface ServerQuoteResponse {
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
}

export interface ExportCatalogResponse {
  products: Product[];
  currencies: ConfiguredCurrency[];
  exportConfig: ExportSettingsConfig;
  internationalRates: InternationalRateConfig[];
}

export interface InternationalEnquiryInputPayload {
  type?: 'wholesale' | 'export';
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  country: string;
  website?: string;
  businessType: InternationalBusinessType;
  brandInterest?: string;
  productInterests?: string[];
  requiredQuantities: string;
  packagingRequirements: string;
  destinationCountry: string;
  message: string;
}

export interface TrackedEnquiryResult {
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
}

async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const {auth} = await import('../lib/firebaseAdmin');
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Administrator sign-in required.');
  }
  const [token, appCheckHeader] = await Promise.all([
    user.getIdToken(),
    getAppCheckTokenHeader(),
  ]);
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...appCheckHeader,
  };
}

async function parseJsonOrThrow<T>(resp: Response): Promise<T> {
  const data = (await resp.json().catch(() => ({}))) as {error?: string} & T;
  if (!resp.ok) {
    throw new Error(data.error || `Request failed (${resp.status})`);
  }
  return data;
}

export async function fetchPublicCommerceConfig(): Promise<PublicCommerceConfig> {
  const resp = await fetch('/api/commerce/config');
  return parseJsonOrThrow<PublicCommerceConfig>(resp);
}

export async function fetchExportCatalog(): Promise<ExportCatalogResponse> {
  const resp = await fetch('/api/export/catalog');
  return parseJsonOrThrow<ExportCatalogResponse>(resp);
}

export async function submitInternationalEnquiry(
  payload: InternationalEnquiryInputPayload,
): Promise<InternationalEnquiryRecord> {
  const appCheckHeader = await getAppCheckTokenHeader();
  const resp = await fetch('/api/enquiries/international', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...appCheckHeader},
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow<{enquiry: InternationalEnquiryRecord}>(resp);
  return data.enquiry;
}

export async function trackInternationalEnquiry(
  enquiryRef: string,
  credential: string,
): Promise<TrackedEnquiryResult> {
  const params = new URLSearchParams({
    enquiryRef: enquiryRef.trim(),
    credential: credential.trim(),
  });
  const resp = await fetch(`/api/enquiries/track?${params.toString()}`);
  const data = await parseJsonOrThrow<{enquiry: TrackedEnquiryResult}>(resp);
  return data.enquiry;
}

export async function fetchServerOrderQuote(payload: {
  items: {productId: string; variantSku: string; qty: number}[];
  currency: CurrencyCode;
  country: string;
  deliveryMethod: DeliveryMethodId;
  localZoneId?: string;
}): Promise<ServerQuoteResponse> {
  const resp = await fetch('/api/commerce/quote', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<ServerQuoteResponse>(resp);
}

export async function submitServerOrder(payload: {
  idempotencyKey: string;
  currency: CurrencyCode;
  customerName: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  city: string;
  postalCode: string;
  orderNotes?: string;
  deliveryMethod: DeliveryMethodId;
  localZoneId?: string;
  paymentMethod: PaymentMethodId;
  paymentReference?: string;
  paymentSlipBase64?: string;
  paymentSlipName?: string;
  paymentSlipMime?: string;
  items: {productId: string; variantSku: string; qty: number}[];
}): Promise<OrderRecord> {
  const appCheckHeader = await getAppCheckTokenHeader();
  const resp = await fetch('/api/orders', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...appCheckHeader},
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow<{order: OrderRecord}>(resp);
  return data.order;
}

export async function submitBankTransferProof(payload: {
  orderRef: string;
  receiptToken: string;
  paymentReference?: string;
  paymentSlipBase64?: string;
}): Promise<OrderRecord> {
  const appCheckHeader = await getAppCheckTokenHeader();
  const resp = await fetch(`/api/orders/${encodeURIComponent(payload.orderRef)}/bank-reference`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...appCheckHeader},
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow<{order: OrderRecord}>(resp);
  return data.order;
}

export async function recordWhatsAppOrderIntent(orderRef: string, receiptToken: string): Promise<void> {
  await fetch(`/api/orders/${encodeURIComponent(orderRef)}/whatsapp-intent`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({receiptToken}),
  });
}

// ---------------------------------------------------------------------------
// Authenticated Admin Commerce & International Enquiry Endpoints
// ---------------------------------------------------------------------------
export async function fetchAdminOrders(filters: {
  q?: string;
  brand?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
} = {}): Promise<{orders: OrderRecord[]; customers: CustomerRecord[]}> {
  const headers = await getAdminAuthHeaders();
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.brand && filters.brand !== 'all') params.set('brand', filters.brand);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  const resp = await fetch(`/api/admin/orders?${params.toString()}`, {headers});
  return parseJsonOrThrow<{orders: OrderRecord[]; customers: CustomerRecord[]}>(resp);
}

export async function fetchAdminInternationalEnquiries(filters: {
  q?: string;
  status?: string;
  businessType?: string;
  country?: string;
} = {}): Promise<{enquiries: InternationalEnquiryRecord[]}> {
  const headers = await getAdminAuthHeaders();
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.businessType && filters.businessType !== 'all') {
    params.set('businessType', filters.businessType);
  }
  if (filters.country && filters.country !== 'all') params.set('country', filters.country);
  const resp = await fetch(`/api/admin/enquiries?${params.toString()}`, {headers});
  return parseJsonOrThrow<{enquiries: InternationalEnquiryRecord[]}>(resp);
}

export async function adminRespondInternationalEnquiry(
  id: string,
  payload: {
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
  },
): Promise<InternationalEnquiryRecord> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow<{enquiry: InternationalEnquiryRecord}>(resp);
  return data.enquiry;
}

export async function downloadAdminEnquiriesCsv(filters: {
  q?: string;
  status?: string;
  businessType?: string;
  country?: string;
} = {}): Promise<Blob> {
  const headers = await getAdminAuthHeaders();
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.businessType && filters.businessType !== 'all') {
    params.set('businessType', filters.businessType);
  }
  if (filters.country && filters.country !== 'all') params.set('country', filters.country);
  const resp = await fetch(`/api/admin/enquiries/export?${params.toString()}`, {
    headers: {Authorization: headers.Authorization},
  });
  if (!resp.ok) {
    throw new Error('Failed to export enquiries CSV.');
  }
  return resp.blob();
}

export async function syncServerExportPricing(
  updates: {
    productId: string;
    exportable: boolean;
    moqUnits: number;
    exportPriceUsd: number;
    bulkPackSizes: string[];
  }[],
): Promise<void> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch('/api/admin/export-sync', {
    method: 'POST',
    headers,
    body: JSON.stringify({updates}),
  });
  await parseJsonOrThrow<{ok: boolean}>(resp);
}

export async function adminUpdateOrderDetails(
  orderId: string,
  payload: {
    orderStatus?: OrderStatus;
    shippingStatus?: ShippingStatus;
    trackingNumber?: string;
    carrier?: string;
    adminNotes?: string;
  },
): Promise<OrderRecord> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow<{order: OrderRecord}>(resp);
  return data.order;
}

export async function adminVerifyOrderBankTransfer(
  orderId: string,
  payload: {decision: 'approve' | 'reject'; transactionRef?: string; note?: string},
): Promise<OrderRecord> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/verify-payment`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow<{order: OrderRecord}>(resp);
  return data.order;
}

export async function adminIssueOrderRefund(
  orderId: string,
  payload: {amount: number; reason: string; transactionRef?: string},
): Promise<OrderRecord> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/refund`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow<{order: OrderRecord}>(resp);
  return data.order;
}

export async function fetchAdminSlipObjectUrl(fileName: string): Promise<string> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch(`/api/admin/slips/${encodeURIComponent(fileName)}`, {
    headers: {Authorization: headers.Authorization},
  });
  if (!resp.ok) {
    throw new Error('Unable to load payment slip.');
  }
  const blob = await resp.blob();
  return URL.createObjectURL(blob);
}

export async function fetchAdminCommerceSettings(): Promise<{
  settings: CommerceSettingsConfig;
  slGatewayConfigured: boolean;
  intlGatewayConfigured: boolean;
}> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch('/api/admin/settings', {headers});
  return parseJsonOrThrow<{
    settings: CommerceSettingsConfig;
    slGatewayConfigured: boolean;
    intlGatewayConfigured: boolean;
  }>(resp);
}

export async function saveAdminCommerceSettings(
  settings: CommerceSettingsConfig,
): Promise<CommerceSettingsConfig> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers,
    body: JSON.stringify(settings),
  });
  const data = await parseJsonOrThrow<{settings: CommerceSettingsConfig}>(resp);
  return data.settings;
}

export async function syncServerStockOverrides(
  updates: {variantSku: string; stockQuantity: number; available: boolean}[],
): Promise<void> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch('/api/admin/stock-sync', {
    method: 'POST',
    headers,
    body: JSON.stringify({updates}),
  });
  await parseJsonOrThrow<{ok: boolean}>(resp);
}

export async function syncAdminAllowlistToServer(
  input: string[] | {email: string; role: AdminRole}[],
): Promise<void> {
  const headers = await getAdminAuthHeaders();
  const body =
    input.length > 0 && typeof input[0] === 'object' ? {entries: input} : {emails: input};
  const resp = await fetch('/api/admin/admins-sync', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  await parseJsonOrThrow<{ok: boolean}>(resp);
}

export async function fetchAdminSession(): Promise<AdminSessionInfo> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch('/api/admin/session', {headers});
  const data = await parseJsonOrThrow<{session: AdminSessionInfo}>(resp);
  return data.session;
}

export async function fetchAdminAuditLogs(filters: {
  q?: string;
  targetType?: string;
} = {}): Promise<{logs: AdminAuditLogEntry[]}> {
  const headers = await getAdminAuthHeaders();
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.targetType && filters.targetType !== 'all') {
    params.set('targetType', filters.targetType);
  }
  const resp = await fetch(`/api/admin/audit-logs?${params.toString()}`, {headers});
  return parseJsonOrThrow<{logs: AdminAuditLogEntry[]}>(resp);
}

export async function adminSimulateGatewayWebhook(payload: {
  provider: 'sl_gateway' | 'intl_gateway';
  orderRef: string;
  outcome: 'paid' | 'failed';
  eventId?: string;
}): Promise<{duplicate: boolean; order: OrderRecord; eventId: string}> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch('/api/admin/payments/simulate-webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<{duplicate: boolean; order: OrderRecord; eventId: string}>(resp);
}

// ---------------------------------------------------------------------------
// Public & Admin Product Portfolio PDF + Catalogue Request APIs
// ---------------------------------------------------------------------------
export interface PublishedPortfolioItem extends PortfolioRecord {
  pdfUrl: string;
}

export async function fetchPublishedPortfolios(): Promise<{
  portfolios: PublishedPortfolioItem[];
  portfolioSettings?: CommerceSettingsConfig['portfolioSettings'];
}> {
  const resp = await fetch('/api/portfolios/published');
  return parseJsonOrThrow<{
    portfolios: PublishedPortfolioItem[];
    portfolioSettings?: CommerceSettingsConfig['portfolioSettings'];
  }>(resp);
}

export async function generateCustomPublicPortfolioPdfBlob(payload: {
  brandId: BrandId;
  language: 'en' | 'si';
  currency: CurrencyCode;
  scope: 'all' | 'categories' | 'products';
  categorySlugs?: string[];
  productIds?: string[];
  preview?: boolean;
}): Promise<Blob> {
  const resp = await fetch('/api/portfolios/custom-pdf', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as {error?: string};
    throw new Error(err.error || 'Unable to generate custom portfolio PDF.');
  }
  return resp.blob();
}

export async function submitCatalogueRequest(payload: {
  brandId: BrandId;
  language: 'en' | 'si';
  customerName: string;
  email: string;
  country: string;
  companyName?: string;
  whatsappNumber?: string;
  scope: 'all' | 'categories' | 'products';
  requestedCategories?: string[];
  requestedProducts?: string[];
  notes?: string;
}): Promise<CatalogueRequestRecord> {
  const appCheckHeader = await getAppCheckTokenHeader();
  const resp = await fetch('/api/catalogue-requests', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...appCheckHeader},
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow<{request: CatalogueRequestRecord}>(resp);
  return data.request;
}

export async function fetchAdminPortfolios(): Promise<PortfolioRecord[]> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch('/api/admin/portfolios', {headers});
  const data = await parseJsonOrThrow<{portfolios: PortfolioRecord[]}>(resp);
  return data.portfolios;
}

export async function generateAdminPortfolio(payload: {
  brandId: BrandId;
  language: 'en' | 'si';
  currency: CurrencyCode;
  title?: string;
  version?: string;
  scope: 'all' | 'categories' | 'products';
  categorySlugs?: string[];
  productIds?: string[];
  coverDesign: PortfolioCoverDesign;
  orientation: PortfolioOrientation;
  introMessage?: string;
  companyProfile?: string;
  contactInfo?: string;
  websiteUrl?: string;
  whatsappNumber?: string;
  fields: Partial<PortfolioFieldOptions>;
  productsOverride?: Product[];
}): Promise<PortfolioRecord> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch('/api/admin/portfolios/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow<{portfolio: PortfolioRecord}>(resp);
  return data.portfolio;
}

export async function updateAdminPortfolioStatus(
  id: string,
  status: PortfolioStatus,
): Promise<PortfolioRecord> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch(`/api/admin/portfolios/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({status}),
  });
  const data = await parseJsonOrThrow<{portfolio: PortfolioRecord}>(resp);
  return data.portfolio;
}

export async function fetchAdminPortfolioPdfBlob(id: string, preview = false): Promise<Blob> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch(
    `/api/admin/portfolios/${encodeURIComponent(id)}/pdf${preview ? '?preview=1' : ''}`,
    {
      headers: {Authorization: headers.Authorization},
    },
  );
  if (!resp.ok) {
    throw new Error('Unable to load portfolio PDF.');
  }
  return resp.blob();
}

export async function fetchAdminCatalogueRequests(): Promise<CatalogueRequestRecord[]> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch('/api/admin/catalogue-requests', {headers});
  const data = await parseJsonOrThrow<{requests: CatalogueRequestRecord[]}>(resp);
  return data.requests;
}

export async function updateAdminCatalogueRequest(
  id: string,
  payload: {
    status: CatalogueRequestStatus;
    assignedPortfolioId?: string;
    adminNotes?: string;
  },
): Promise<CatalogueRequestRecord> {
  const headers = await getAdminAuthHeaders();
  const resp = await fetch(`/api/admin/catalogue-requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow<{request: CatalogueRequestRecord}>(resp);
  return data.request;
}

export function triggerBlobFileDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}



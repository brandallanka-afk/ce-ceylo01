import type {
  BrandId,
  ConfiguredCurrency,
  CurrencyCode,
  InternationalBusinessType,
  LocalizedText,
} from './commerce';

export type AdminRole = 'super_admin' | 'catalog_manager' | 'order_manager';

export type AdminSectionId =
  | 'overview'
  | 'products'
  | 'categories'
  | 'brands'
  | 'variants'
  | 'pricing'
  | 'stock'
  | 'orders'
  | 'customers'
  | 'enquiries'
  | 'intl_enquiries'
  | 'promotions'
  | 'content'
  | 'reports'
  | 'languages'
  | 'settings'
  | 'audit_logs'
  | 'portfolio_generator'
  | 'catalogue_requests';

export interface CategoryRecord {
  id: string;
  brandId: BrandId;
  slug: string;
  name: LocalizedText;
  sortOrder: number;
  isActive: boolean;
  updatedAt?: unknown;
}

export interface InventoryRecord {
  variantSku: string;
  productId: string;
  brandId: BrandId;
  label: string;
  stockQuantity: number;
  lowStockThreshold: number;
  available: boolean;
  updatedAt?: unknown;
}

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  country: string;
  city?: string;
  orderCount: number;
  createdAt?: unknown;
}

export type OrderStatus =
  | 'new'
  | 'contacted'
  | 'pending'
  | 'awaiting_payment'
  | 'payment_verification'
  | 'confirmed'
  | 'processing'
  | 'dispatched'
  | 'shipped'
  | 'completed'
  | 'delivered'
  | 'cancelled'
  | 'placed'
  | 'packed';

export type PaymentStatus =
  | 'pending'
  | 'pending_verification'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type PaymentMethodId =
  | 'whatsapp_order'
  | 'bank_transfer'
  | 'cod'
  | 'sl_gateway'
  | 'intl_gateway';

export type DeliveryMethodId =
  | 'local_standard'
  | 'local_express'
  | 'international_courier'
  | 'international_quote';

export type ShippingStatus =
  | 'not_dispatched'
  | 'label_created'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'returned';

export interface PaymentHistoryEntry {
  id: string;
  eventType: string;
  method: PaymentMethodId;
  status: PaymentStatus;
  amount: number;
  currency: CurrencyCode;
  transactionRef?: string;
  note?: string;
  actor: string;
  createdAt: string;
}

export interface OrderItemSnapshot {
  productId: string;
  brandId: BrandId;
  variantSku: string;
  name: string;
  packSize?: string;
  weightGrams?: number;
  qty: number;
  unitPrice: number;
  unitPriceLkr?: number;
  unitPriceUsd?: number;
}

export interface OrderRecord {
  id: string;
  orderRef: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  phone?: string;
  country?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  orderNotes?: string;
  deliveryMethod?: DeliveryMethodId;
  localZoneId?: string;
  paymentMethod?: PaymentMethodId;
  paymentReference?: string;
  paymentSlipFile?: string;
  shippingStatus?: ShippingStatus;
  trackingNumber?: string;
  carrier?: string;
  currency: CurrencyCode;
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  totalWeightGrams?: number;
  itemCount: number;
  items: OrderItemSnapshot[];
  paymentHistory?: PaymentHistoryEntry[];
  refundedAmount?: number;
  refundReason?: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  whatsappHandoffAt?: string;
  adminNotes?: string;
  receiptToken?: string;
  monthKey: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ShippingZoneConfig {
  id: string;
  name: string;
  baseRateLkr: number;
  extraPerKgLkr: number;
  enabled: boolean;
}

export interface InternationalRateConfig {
  country: string;
  baseUsd: number;
  extraPer500gUsd: number;
  enabled: boolean;
  /** Country-specific shipping & customs policy shown to international buyers (no unverified duties/ETA guarantees). */
  policyNote?: string;
}

export interface BankTransferInstructions {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchName: string;
  swiftCode: string;
  instructions: string;
}

export interface ExportSettingsConfig {
  defaultMoqUnits: number;
  packagingFormats: string[];
  ratePolicyNote: string;
  fxServiceNote: string;
}

export interface ExportProductOverride {
  exportable: boolean;
  moqUnits: number;
  exportPriceUsd: number;
  bulkPackSizes: string[];
}

export interface CommerceSettingsConfig {
  whatsappNumber: string;
  brandWhatsappNumbers?: {
    ceyvana: string;
    ceylomira: string;
    'hand-crafts': string;
  };
  currencies: ConfiguredCurrency[];
  exportConfig: ExportSettingsConfig;
  portfolioSettings?: {
    requireRegistrationForPublicDownload: boolean;
    allowCustomPublicCatalogSelection: boolean;
  };
  payment: {
    whatsappOrderEnabled?: boolean;
    bankTransferEnabled: boolean;
    codEnabled: boolean;
    slGatewayEnabled: boolean;
    intlGatewayEnabled: boolean;
    sandboxMode: boolean;
    bankDetails: BankTransferInstructions;
  };
  shipping: {
    freeShippingThresholdLkr: number;
    localExpressSurchargeLkr: number;
    internationalQuoteEnabled: boolean;
    usdToLkrRate: number;
    localZones: ShippingZoneConfig[];
    internationalRates: InternationalRateConfig[];
  };
}

export interface EnquiryRecord {
  id: string;
  type: 'wholesale' | 'export' | 'general';
  brandInterest?: string;
  contactName: string;
  companyName?: string;
  email: string;
  phone?: string;
  country?: string;
  volumeBand?: string;
  message: string;
  status: 'new' | 'reviewed' | 'quoted' | 'responded' | 'archived';
  createdAt?: unknown;
}

export type InternationalEnquiryStatus =
  | 'new'
  | 'reviewed'
  | 'quoted'
  | 'responded'
  | 'archived';

export interface CountryQuotationRecord {
  currency: CurrencyCode;
  quotedAmount?: number;
  shippingEstimateAmount?: number;
  minOrderQty?: string;
  shippingPolicy?: string;
  validityNote?: string;
  quotedAt: string;
}

export interface InternationalEnquiryRecord {
  id: string;
  enquiryRef: string;
  trackingToken: string;
  type: 'wholesale' | 'export';
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  country: string;
  website?: string;
  businessType: InternationalBusinessType;
  brandInterest: string;
  productInterests: string[];
  requiredQuantities: string;
  packagingRequirements: string;
  destinationCountry: string;
  message: string;
  status: InternationalEnquiryStatus;
  adminResponse?: string;
  respondedBy?: string;
  respondedAt?: string;
  quotation?: CountryQuotationRecord;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionRecord {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrderLkr: number;
  brandIds: BrandId[];
  isActive: boolean;
  expiresAt?: string;
  updatedAt?: unknown;
}

export interface SiteLanguageConfig {
  code: string;
  shortLabel: string;
  nativeLabel: string;
  enabled: boolean;
}

export interface SiteSettingsRecord {
  id: string;
  announcement: LocalizedText;
  heroTitle: LocalizedText;
  heroSubtitle: LocalizedText;
  whatsappNumber: string;
  enabledLanguages: SiteLanguageConfig[];
  freeDeliveryThresholdLkr: number;
  updatedAt?: unknown;
}

export interface AdminUserRecord {
  uid: string;
  email: string;
  displayName?: string;
  role: AdminRole;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminAuditLogEntry {
  id: string;
  actorEmail: string;
  actorRole: AdminRole;
  action: string;
  targetType:
    | 'order'
    | 'payment'
    | 'enquiry'
    | 'settings'
    | 'stock'
    | 'export'
    | 'admin_users'
    | 'catalog'
    | 'portfolio'
    | 'catalogue_request';
  targetId: string;
  summary: string;
  createdAt: string;
}

export interface AdminSessionInfo {
  email: string;
  role: AdminRole;
  mfaVerified: boolean;
  mfaRequired: boolean;
  appCheckEnforced: boolean;
}

export type PortfolioCoverDesign = 'heritage_crest' | 'editorial_split' | 'gallery_minimal';
export type PortfolioOrientation = 'portrait' | 'landscape';
export type PortfolioStatus = 'draft' | 'published' | 'unpublished';

export interface PortfolioFieldOptions {
  sku: boolean;
  category: boolean;
  description: boolean;
  highlights: boolean;
  ingredients: boolean;
  origin: boolean;
  packSizes: boolean;
  packagingType: boolean;
  storageInstructions: boolean;
  shelfLife: boolean;
  netWeight: boolean;
  retailPrices: boolean;
  wholesalePrices: boolean;
  moq: boolean;
  technicalSpecs: boolean;
  certifications: boolean;
}

export interface PortfolioRecord {
  id: string;
  brandId: BrandId;
  language: 'en' | 'si';
  currency: CurrencyCode;
  title: string;
  version: string;
  status: PortfolioStatus;
  scope: 'all' | 'categories' | 'products';
  categorySlugs: string[];
  productIds: string[];
  coverDesign: PortfolioCoverDesign;
  orientation: PortfolioOrientation;
  introMessage: string;
  companyProfile: string;
  contactInfo: string;
  websiteUrl: string;
  whatsappNumber: string;
  omittedFieldNote?: string;
  fields: PortfolioFieldOptions;
  productCount: number;
  catalogFingerprint: string;
  pdfFileName: string;
  pageCount: number;
  fileSizeBytes: number;
  generatedBy: string;
  generatedAt: string;
  publishedAt?: string;
  updatedAt: string;
  needsRegeneration?: boolean;
}

export type CatalogueRequestStatus = 'new' | 'reviewed' | 'sent' | 'archived';

export interface CatalogueRequestRecord {
  id: string;
  requestRef: string;
  brandId: BrandId;
  language: 'en' | 'si';
  customerName: string;
  email: string;
  country: string;
  companyName?: string;
  whatsappNumber?: string;
  scope: 'all' | 'categories' | 'products';
  requestedCategories: string[];
  requestedProducts: string[];
  notes?: string;
  status: CatalogueRequestStatus;
  assignedPortfolioId?: string;
  assignedPortfolioVersion?: string;
  adminNotes?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}


import type {
  AdminAuditLogEntry,
  AdminRole,
  CatalogueRequestRecord,
  CommerceSettingsConfig,
  CustomerRecord,
  DeliveryMethodId,
  ExportProductOverride,
  InternationalEnquiryRecord,
  OrderRecord,
  PaymentMethodId,
  PortfolioCoverDesign,
  PortfolioFieldOptions,
  PortfolioOrientation,
  PortfolioRecord,
} from '../src/types/admin.ts';
import type {BrandId, CurrencyCode, InternationalBusinessType} from '../src/types/commerce.ts';

export interface ServerCommerceStore {
  nextOrderSeq: number;
  nextEnquirySeq: number;
  nextPortfolioSeq: number;
  nextCatalogueRequestSeq: number;
  settings: CommerceSettingsConfig;
  adminAllowlistEmails: string[];
  adminRolesByEmail: Record<string, AdminRole>;
  auditLogs: AdminAuditLogEntry[];
  stockOverrides: Record<string, {stockQuantity: number; available: boolean}>;
  exportOverrides: Record<string, ExportProductOverride>;
  orders: Record<string, OrderRecord>;
  customers: Record<string, CustomerRecord>;
  enquiries: Record<string, InternationalEnquiryRecord>;
  portfolios: Record<string, PortfolioRecord>;
  catalogueRequests: Record<string, CatalogueRequestRecord>;
  idempotencyIndex: Record<string, string>;
  processedWebhookEvents: Record<string, {orderRef: string; provider: string; processedAt: string}>;
}

export interface QuoteItemInput {
  productId: string;
  variantSku: string;
  qty: number;
}

export interface CheckoutOrderInput {
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
  items: QuoteItemInput[];
}

export interface InternationalEnquiryInput {
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

export interface GeneratePortfolioInput {
  brandId: BrandId;
  language: 'en' | 'si';
  currency?: CurrencyCode;
  title?: string;
  version?: string;
  scope?: 'all' | 'categories' | 'products';
  categorySlugs?: string[];
  productIds?: string[];
  coverDesign?: PortfolioCoverDesign;
  orientation?: PortfolioOrientation;
  introMessage?: string;
  companyProfile?: string;
  contactInfo?: string;
  websiteUrl?: string;
  whatsappNumber?: string;
  omittedFieldNote?: string;
  fields?: Partial<PortfolioFieldOptions>;
  productsOverride?: import('../src/types/commerce.ts').Product[];
}

export interface CatalogueRequestInput {
  brandId: BrandId;
  language: 'en' | 'si';
  customerName: string;
  email: string;
  country: string;
  companyName?: string;
  whatsappNumber?: string;
  scope?: 'all' | 'categories' | 'products';
  requestedCategories?: string[];
  requestedProducts?: string[];
  notes?: string;
}

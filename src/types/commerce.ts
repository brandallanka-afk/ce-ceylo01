export type BrandId = 'ceyvana' | 'ceylomira' | 'hand-crafts';

export type LanguageCode = 'en' | 'si' | string;

export type CurrencyCode = 'LKR' | 'USD' | string;

export type InternationalBusinessType =
  | 'Importer'
  | 'Distributor'
  | 'Wholesaler'
  | 'Retailer'
  | 'Private Label Buyer'
  | 'Other';

export interface ConfiguredCurrency {
  code: string;
  symbol: string;
  name: string;
  /** Administrator-configured conversion rate per 1.00 USD (never auto-guessed). */
  ratePerUsd: number;
  enabled: boolean;
  isDefault?: boolean;
}

export type RoutePage =
  | 'home'
  | 'ceyvana'
  | 'ceylomira'
  | 'hand-crafts'
  | 'portfolio'
  | 'product'
  | 'cart'
  | 'wholesale'
  | 'about'
  | 'stories'
  | 'contact'
  | 'privacy'
  | 'terms'
  | 'admin';

export interface LocalizedText {
  en: string;
  si: string;
  [langCode: string]: string | undefined;
}

export interface BrandConfig {
  id: BrandId;
  slug: string;
  name: LocalizedText;
  tagline: LocalizedText;
  description: LocalizedText;
  status: 'active' | 'coming_soon' | 'hidden';
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
  };
  heroImage: string;
  sortOrder?: number;
}

export interface ProductVariant {
  variantSku: string;
  label: string;
  weightGrams: number;
  priceLkr: number;
  priceUsd: number;
  stockQuantity: number;
  available: boolean;
}

export interface ProductExportSpecs {
  shelfLife?: string;
  packagingNote?: string;
  botanicalOrGrade?: string;
}

export interface Product {
  id: string;
  brandId: Exclude<BrandId, 'hand-crafts'> | 'hand-crafts';
  sku: string;
  slug: string;
  name: LocalizedText;
  categorySlug: string;
  category: LocalizedText;
  description: LocalizedText;
  tastingNotes: LocalizedText;
  origin: LocalizedText;
  highlights?: LocalizedText;
  ingredients?: LocalizedText;
  storageInstructions?: LocalizedText;
  packagingType?: LocalizedText;
  technicalSpecs?: LocalizedText;
  certifications?: string[];
  mainImage: string;
  thumbnailImage?: string;
  gallery: string[];
  availability: 'in_stock' | 'low_stock' | 'out_of_stock';
  featured?: boolean;
  isArchived?: boolean;
  seoTitle: string;
  seoDescription: string;
  variants: ProductVariant[];
  exportable?: boolean;
  moqUnits?: number;
  exportPriceUsd?: number;
  bulkPackSizes?: string[];
  exportSpecs?: ProductExportSpecs;
}

export interface CartItem {
  productId: string;
  brandId: BrandId;
  productSlug: string;
  productName: LocalizedText;
  variantSku: string;
  variantLabel: string;
  weightGrams: number;
  priceLkr: number;
  priceUsd: number;
  image: string;
  quantity: number;
  maxStock: number;
}

export interface NewsStory {
  id: string;
  slug: string;
  brandTag: LocalizedText;
  publishedAt: string;
  readTimeMinutes: number;
  title: LocalizedText;
  excerpt: LocalizedText;
  body: LocalizedText;
  image: string;
}

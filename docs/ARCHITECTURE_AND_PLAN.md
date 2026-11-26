# Ceyvana & Ceylomira — Integrated Multi-Brand Platform Blueprint

## 1. Technical Architecture

A lightweight, fast-loading, multi-brand e-commerce and corporate platform built as a static-friendly React + TypeScript + Vite SPA that scales cleanly into Firebase (Firestore, Auth, Storage, and Cloud Functions) in subsequent phases without rewriting the storefront core.

- **Frontend Core**: React 19 + TypeScript + Vite 8 + Tailwind CSS v4. Zero heavy UI component libraries, zero autoplay video, route-level `React.lazy()` code splitting.
- **Multi-Brand Architecture**: Data-driven brand theming (`brandId`: `ceyvana`, `ceylomira`, `hand-crafts`, `corporate`) with isolated CSS tokens per brand, unified shopping cart, and configurable brand visibility (`active` vs `coming_soon`).
- **Internationalization & Currency**: Client-side `en` / `si` (English / Sinhala) dictionary + dual-currency display (`LKR` / `USD`).
- **Future Backend (Phase 2+ — Separate Firebase Project)**:
  - **Cloud Firestore**: Authoritative catalog, orders, inventory, enquiries, and promotions.
  - **Firebase Storage**: Product imagery with CDN caching.
  - **Firebase Authentication**: Role-based admin authentication (`super_admin`, `catalog_manager`, `order_manager`).
  - **Firebase Cloud Functions (Gen 2)**: Server-side price & stock verification, order creation, payment gateway webhook verification, and CSV export generation.
  - **Payment Provider Abstraction**: Unified `PaymentProvider` interface supporting a Sri Lankan payment gateway (e.g., PayHere / WebXPay), an international gateway (e.g., Stripe), Bank Transfer, and configurable Cash on Delivery (COD).

---

## 2. Folder Structure

```text
/
├── docs/
│   └── ARCHITECTURE_AND_PLAN.md      # Architecture, schema, security & milestones
├── public/
│   ├── robots.txt                    # Crawler directives (disallow /admin)
│   └── sitemap.xml                   # Static XML sitemap for SEO
├── src/
│   ├── assets/images/                # Local optimized studio & editorial assets
│   ├── components/
│   │   ├── CartDrawer.tsx            # Slide-over shopping cart drawer
│   │   ├── Footer.tsx                # Multi-brand corporate footer
│   │   ├── Navbar.tsx                # Slim utility bar + 3-zone header
│   │   ├── ProductCard.tsx           # Brand-consistent retail card
│   │   └── SafeImage.tsx             # Lazy-loaded image with fallback container
│   ├── context/
│   │   └── StoreContext.tsx          # Cart persistence, language, currency, routing
│   ├── data/
│   │   ├── brands.json               # Configurable brand definitions
│   │   ├── products.json             # Sample catalog (Ceyvana & Ceylomira)
│   │   └── stories.json              # News & heritage journal articles
│   ├── i18n/
│   │   └── translations.ts           # English & Sinhala UI strings
│   ├── pages/
│   │   ├── AboutPage.tsx             # Corporate heritage & sourcing standards
│   │   ├── BrandStorePage.tsx        # Ceyvana / Ceylomira themed storefronts
│   │   ├── CartPage.tsx              # Dedicated shopping cart & shipping estimator
│   │   ├── ContactPage.tsx           # WhatsApp & wholesale quotation enquiries
│   │   ├── HandCraftsPage.tsx        # Configurable "Coming Soon" brand page
│   │   ├── HomePage.tsx              # Corporate hero, brands & featured grid
│   │   ├── ProductDetailPage.tsx     # Variant selector, gallery, Schema.org JSON-LD
│   │   └── StoriesPage.tsx           # News & heritage stories
│   ├── types/
│   │   └── commerce.ts               # Core TypeScript domain models
│   ├── utils/
│   │   ├── currency.ts               # LKR / USD formatting & WhatsApp link builder
│   │   └── seo.ts                    # Dynamic title, meta & Product JSON-LD
│   ├── App.tsx                       # Route splitter with React.lazy & Suspense
│   ├── index.css                     # Tailwind v4 + brand CSS custom properties
│   └── main.tsx                      # Application entry
├── index.html                        # Root HTML, fonts & Organization JSON-LD
├── metadata.json                     # App metadata
└── package.json                      # Minimal dependency manifest
```

---

## 3. Database Schema (Cloud Firestore — Phase 2+)

All documents use `brandId` consistently for clean multi-brand isolation.

1. **`brands`** (`brandId` doc ID):
   `{ id, slug, name: {en, si}, tagline: {en, si}, status: "active" | "coming_soon" | "hidden", theme: {primary, secondary, accent}, sortOrder }`
2. **`categories`** (`categoryId` doc ID):
   `{ id, brandId, slug, name: {en, si}, sortOrder, isActive }`
3. **`products`** (`productId` doc ID):
   `{ id, brandId, categoryId, sku, slug, name: {en, si}, description: {en, si}, mainImage, gallery[], origin, availability, seoTitle, seoDescription, isArchived, variants: [{ variantSku, label, weightGrams, priceLkr, priceUsd, stockQuantity, available }] }`
4. **`inventory`** (`variantSku` doc ID — server-managed):
   `{ productId, brandId, variantSku, stockQuantity, reservedQuantity, lowStockThreshold, updatedAt }`
5. **`customers`** (`customerId` doc ID):
   `{ id, name, email, phone, country, defaultAddress, createdAt }`
6. **`orders`** (`orderId` doc ID — server-created only):
   `{ orderRef, customer: {name, email, phone, address, country}, items: [{productId, brandId, variantSku, title, unitPrice, qty}], currency, subtotal, shippingFee, discountCode, discountAmount, totalAmount, paymentMethod, paymentStatus: "pending"|"paid"|"failed"|"refunded", orderStatus: "placed"|"confirmed"|"packed"|"shipped"|"delivered"|"cancelled", createdAt }`
7. **`enquiries`** (`enquiryId` doc ID):
   `{ id, type: "wholesale"|"export"|"general", brandId, companyName, contactName, email, phone, country, message, status: "new"|"reviewed"|"quoted", createdAt }`
8. **`promotions`** (`code` doc ID):
   `{ code, type: "percentage"|"fixed", value, currency, minOrderAmount, brandIds[], expiresAt, isActive }`
9. **`siteSettings`** (`global` / `shipping` / `payments` doc IDs):
   `{ shippingRulesByCountry, freeDeliveryThresholdLkr, codEnabled, bankTransferInstructions, activeCurrencyRates }`
10. **`adminUsers`** (`uid` doc ID):
    `{ uid, email, role: "super_admin"|"catalog_manager"|"order_manager", active, createdAt }`

---

## 4. UI/UX Page Structure

- **Phase 1 (Implemented Now)**:
  - **Home**: Corporate editorial hero, Brand Houses showcase (Ceyvana, Ceylomira, Hand Crafts Coming Soon), Featured Products, Provenance & Stories.
  - **Ceyvana Store**: Earth Brown / Burgundy / Gold theme, search, category filter, pagination, variant previews.
  - **Ceylomira Store**: Emerald Green / Ivory / Copper theme, search, category filter, pagination, variant previews.
  - **Product Detail Page (PDP)**: Gallery, pack-size variant selector updating price/weight/SKU/stock, quantity stepper, Add to Cart, WhatsApp enquiry, Schema.org `Product` markup.
  - **Shopping Cart (Drawer & Full Page)**: Itemized cart, variant breakdown, quantity steppers, currency toggle, local persistence, shipping region preview.
  - **Hand Crafts (Coming Soon)**: Natural Wood / Ivory / Terracotta teaser with zero invented products.
  - **About Us**, **News & Stories**, **Contact & Wholesale Enquiries** (with WhatsApp integration).
- **Phase 2+ (Planned)**:
  - **Checkout**, **Customer Order Confirmation**, **Order Tracking**, **Privacy Policy**, **Terms & Conditions**, **Shipping & Returns**, **Admin Login**, and **Protected Admin Dashboard** (route-split under `/admin` so storefront visitors never download admin code).

---

## 5. Development Milestones

- **Phase 1 (Current Prototype)**: Multi-brand storefront architecture, English/Sinhala localization, static JSON catalog, variant-aware PDP, persistent demonstration shopping cart, SEO/Schema.org metadata, WhatsApp enquiries.
- **Phase 2 (Separate Firebase Setup & Catalog/Enquiry Persistence)**: Provision an isolated Firebase project (never touching existing production projects), deploy Firestore/Storage security rules, migrate products/settings to Firestore, persist wholesale enquiries.
- **Phase 3 (Server-Side Checkout, Orders & Payments)**: Implement Cloud Functions for order creation, server-side price/stock validation, shipping rule engine, sandbox payment provider abstraction (Sri Lankan gateway + Stripe + Bank Transfer + COD), webhook signature verification, and Order Tracking.
- **Phase 4 (Protected Admin Dashboard & Production Launch)**: Route-split `/admin` dashboard with Firebase Auth RBAC, CRUD for products/variants/stock/promotions, order status management, CSV sales exports, and custom domain deployment after explicit approval.

---

## 6. Security Plan

- **Strict Client-Trust Boundary**: Client browsers never determine final prices, shipping fees, discount values, stock availability, or payment status. All order totals are recalculated inside trusted Cloud Functions from Firestore records.
- **Firestore & Storage Rules**: Public read only on non-archived `products`, `categories`, `brands`, and public `siteSettings`. Write access on `orders`, `inventory`, `promotions`, and `adminUsers` locked strictly to Cloud Functions / verified `adminUsers` custom claims.
- **Payment Security**: Zero card/CVV storage; sandbox API keys isolated in server-side secret manager (`process.env`); HMAC/signature verification on all payment gateway webhooks with idempotent order updates.
- **Input Validation & Rate Limiting**: Schema validation (Zod/manual strict sanitization) and App Check / IP rate limiting on checkout and enquiry endpoints.

---

## 7. Estimated Dependencies

- **Phase 1 (Current)**: `react`, `react-dom`, `lucide-react` (minimal icon affordances), `tailwindcss` (build-time CSS). Zero heavy UI frameworks or animation packages.
- **Phase 2–4 Additions (Only When Needed)**: `firebase` (modular tree-shaken SDK for client Auth/Firestore), `firebase-admin` & `firebase-functions` (server-side Cloud Functions only).

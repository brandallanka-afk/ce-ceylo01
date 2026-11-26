# Phase 3 & Phase 4 — Payment & Shipping Integration Architecture

## 1. Security & Trust Boundaries
- **Server-Authoritative Totals & Stock**: Cart prices, currency conversion, shipping zones/rates, and variant stock deductions are computed exclusively on the Express backend (`server/store.ts` & `server/shipping.ts`). Client totals are never trusted.
- **Atomic Stock & Duplicate Prevention**: Orders execute inside a serialized store mutex (`withStoreLock`) with atomic writes. Duplicate submissions sharing the same `idempotencyKey` return `HTTP 409`. Cancelled orders restore variant stock atomically.
- **Card Data Isolation**: Raw card numbers (`cardNumber`) and security codes (`cvv`/`cardCvc`) are rejected at the API boundary (`HTTP 400`). Hosted gateway redirects or server-verified webhook callbacks are used once merchant credentials are configured.
- **Admin Authorization**: Administrative routes (`/api/admin/*`) verify the caller's Firebase ID token (`firebase-admin/auth` `verifyIdToken`), require `email_verified === true`, and enforce the administrator email allowlist.
- **Payment Slip Safety**: Uploaded bank transfer slips are restricted to `2MB`, verified via magic bytes (`JPG`, `PNG`, `WebP`, `PDF`), renamed with UUIDs inside `.data/slips/`, and served only to authenticated admins via confined path resolution.

## 2. Modular Payment Provider Interface (`server/payments/adapters.ts`)
Every payment option implements `PaymentProviderAdapter`:
- `bank_transfer` (`bankTransferAdapter`): **Live by default**. Displays administrator-configured bank account details, accepts optional transfer reference & slip upload, and holds orders in `awaiting_payment` / `payment_verification` until manually verified by an admin.
- `cod` (`codAdapter`): **Disabled by default**; enabled/disabled from Admin (`#admin` -> Payment & Shipping Settings) and restricted to Sri Lanka destinations.
- `sl_gateway` (`slGatewayAdapter`): Sandbox/mock adapter ready for Sri Lankan payment gateways. Verifies `x-sl-gateway-signature` (`HMAC-SHA256(rawBody, SL_GATEWAY_SECRET)`). Live mode cannot be activated unless `SL_GATEWAY_MERCHANT_ID` and `SL_GATEWAY_SECRET` are set in server environment variables.
- `intl_gateway` (`intlGatewayAdapter`): Sandbox/mock adapter ready for international payment gateways. Verifies `x-intl-signature` (`t=<unix>,v1=<HMAC-SHA256(timestamp.rawBody, INTL_GATEWAY_WEBHOOK_SECRET)>`) with a 5-minute replay tolerance and processed `eventId` deduplication.

### Webhook Endpoints
- `POST /api/payments/webhook/sl_gateway`
- `POST /api/payments/webhook/intl_gateway`

Both verify raw request body HMAC signatures before updating `paymentStatus`, `orderStatus`, and `paymentHistory`.

## 3. Shipping System (`server/shipping.ts`)
- **Local Sri Lankan Delivery**:
  - Configurable zones (`localZones[]`) with per-zone base rate (LKR) and extra-per-kg rate (LKR) calculated from total cart weight (`weightGrams * qty`).
  - Free shipping threshold (`freeShippingThresholdLkr`, default `LKR 15,000`) applies automatically to `local_standard`.
  - Priority Express option (`local_express`) adds configurable `localExpressSurchargeLkr`.
- **International Delivery**:
  - Configurable country table (`internationalRates[]`) with base USD rate + per-500g surcharge, plus fallback `Rest of World`.
  - Optional `international_quote` mode allows global buyers to place an order with `Quote Pending` shipping before final export freight invoicing.

## 4. Environment Variables (`.env`)
Keep secrets strictly in server environment variables (never exposed to `VITE_*`):
- `SL_GATEWAY_MERCHANT_ID`
- `SL_GATEWAY_SECRET`
- `INTL_GATEWAY_PUBLISHABLE_KEY`
- `INTL_GATEWAY_SECRET`
- `INTL_GATEWAY_WEBHOOK_SECRET`

Do not disable `sandboxMode` or switch adapters to live production processing until valid merchant credentials are configured and explicitly approved.

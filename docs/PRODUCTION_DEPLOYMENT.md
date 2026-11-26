# Production Deployment Guide (Independent Temporary Launch)

> **Critical Rules Before Deploying**:
> 1. **Never deploy to or modify any legacy Ceyvana website or Firebase project.**
> 2. **Deploy to temporary hosting first** (`https://<project-id>.web.app` or the AI Studio Cloud Run temporary URL). Do **not** point a custom domain or enable live payment gateway processing until explicit business approval is granted.

---

## 1. Active Project & Isolation Configuration

The platform is pre-configured cleanly via:
- `firebase-applet-config.json` & `.firebaserc`: isolated project `gen-lang-client-0899218655`
- Firestore database ID: `ai-studio-ceyvanaceylomira-e606d197-a4e9-4027-ac45-0034ca58574e`
- Bootstrap Super Admin: `brandallanka@gmail.com`

If you want to target a brand-new standalone production Firebase project created in Firebase Console:
1. Create a clean Firebase project (Blaze plan required only when deploying Cloud Functions v2 and automated Firestore backups).
2. Enable **Firestore Database** (create database ID matching `FIREBASE_DATABASE_ID` or `(default)`), **Firebase Authentication (Google provider)**, **Firebase Storage**, and **Firebase Hosting**.
3. Register the new project alias via `firebase use --add` (update `.firebaserc`) and update `firebase-applet-config.json` from Firebase Project Settings -> Web App SDK config (updating `storage.rules` database path if using a different database ID).

---

## 2. Environment Variables & Secrets

Copy `.env.example` to your secure hosting environment (AI Studio Secrets panel, Cloud Run Environment Variables, or Google Cloud Secret Manager):
- `APP_URL`: Active temporary hosting origin (e.g. `https://ais-pre-aezimfen6ipwsfen44uejf-996167933071.asia-southeast1.run.app` or `https://<project-id>.web.app`)
- `PORT`: `3000` (default) or `8080` (Cloud Run)
- `COMMERCE_DATA_DIR`: Persistent volume mount path for `.data` when hosting full-stack Node/Express
- `RATE_LIMIT_WRITE_MAX` / `RATE_LIMIT_READ_MAX`: Defaults `25` / `60` requests per minute per IP
- `ADMIN_REQUIRE_MFA`: Set to `true` after enrolling administrator TOTP MFA in **Admin Dashboard -> 15. Admin Settings** to require second-factor Firebase Auth tokens server-side
- `ENFORCE_APP_CHECK` & `VITE_RECAPTCHA_SITE_KEY`: Configure Firebase App Check reCAPTCHA v3 site key and set `ENFORCE_APP_CHECK=true` in production once Firebase App Check is activated in Firebase Console

**Payment Gateway Secrets (Keep Empty Until Merchant Approval)**:
- `SL_GATEWAY_MERCHANT_ID`
- `SL_GATEWAY_SECRET`
- `INTL_GATEWAY_PUBLISHABLE_KEY`
- `INTL_GATEWAY_SECRET`
- `INTL_GATEWAY_WEBHOOK_SECRET`

Never prefix payment secrets with `VITE_`. Never place secrets inside `src/`, `public/`, or `dist/`.

---

## 3. Build & Pre-Deployment Verification

Run the complete local verification suite before any deployment:
```bash
npm ci
npm run lint
npm run build
npm run build:functions
COMMERCE_TEST_MODE=1 npm run test:commerce
COMMERCE_TEST_MODE=1 npm run test:phase5
COMMERCE_TEST_MODE=1 npm run test:phase6
COMMERCE_TEST_MODE=1 npm run test:phase7
COMMERCE_TEST_MODE=1 npm run test:security
npx eslint firestore.rules
npx tsx firestore.rules.test.ts
```
Do not proceed with deployment if any test fails.

---

## 4. Deploying Firebase Services (Temporary Hosting URL)

### Step A: Deploy Security Rules & Composite Indexes
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### Step B: Install Cloud Functions Dependencies & Deploy Backend (Optional Serverless Hosting Path)
If hosting via Firebase Hosting + Cloud Functions instead of Node/Express Cloud Run:
```bash
npm --prefix functions install
npm run build:functions
firebase deploy --only functions
```

### Step C: Deploy Temporary Firebase Hosting
```bash
firebase deploy --only hosting
```
Firebase Hosting automatically provisions a managed SSL/TLS certificate on the temporary URL (`https://<project-id>.web.app` and `https://<project-id>.firebaseapp.com`).

### Step D: Full-Stack Node/Cloud Run Hosting Alternative (Used by AI Studio Runtime)
```bash
npm run build
NODE_ENV=production npm start
```
Express serves `dist/` with immutable caching on `/assets/**` and `/src/assets/**`, HSTS over HTTPS (`Strict-Transport-Security`), dynamic `/robots.txt`, dynamic `/sitemap.xml`, and all `/api/*` commerce routes.

---

## 5. Post-Deploy Verification Checklist

1. **SSL & Readiness**:
   - Open `https://<temporary-hosting-url>/api/health` and confirm HTTP `200`, valid TLS padlock, `sandboxMode: true`, `slGatewayConfigured: false`, and `intlGatewayConfigured: false`.
   - Inspect response headers for `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy`.
2. **Access Permissions**:
   - Confirm `GET /api/admin/orders` unauthenticated returns `HTTP 401`.
   - Sign in at `/admin` using `brandallanka@gmail.com` and verify Admin Overview loads cleanly.
   - Confirm Firebase Authentication -> **Settings -> Authorized domains** includes your active temporary hosting hostname (required for Google Sign-In popup).
3. **Production Database Initialization (Zero Fake Orders)**:
   - Inside **Admin Dashboard -> 01. Overview**, click **Initialize Catalog & Settings** once to populate `brands`, `categories`, `products`, `inventory`, and `siteSettings/global`.
   - Verify `orders` and `customers` collections start clean with **0 test orders**.

---

## 6. Connecting a Custom Domain Later (After Explicit Approval Only)

Do **not** perform these steps until the final corporate domain is selected and approved:
1. In **Firebase Console -> Hosting -> Add custom domain** (or Cloud Run Domain Mappings), enter the approved domain (`www.<domain>` and apex `<domain>`).
2. Add the verification `TXT` record and DNS `A` / `AAAA` records provided by Firebase/Google Cloud at the domain registrar.
3. Wait for automatic SSL certificate provisioning (typically 15 minutes to 24 hours; verify status shows **Connected** with valid HTTPS).
4. Add both apex and `www` hostnames under **Firebase Console -> Authentication -> Settings -> Authorized domains**.
5. Update `APP_URL` environment variable to `https://<approved-domain>` and verify `/sitemap.xml`, `/robots.txt`, and `<link rel="canonical">` tags resolve to the final domain.

---

## 7. Enabling Live Payment Gateways Later (After Merchant Approval Only)

1. Provision merchant accounts and obtain live API keys and webhook signing secrets.
2. Store credentials strictly in Cloud Secret Manager / server environment variables (`SL_GATEWAY_*`, `INTL_GATEWAY_*`).
3. Configure gateway dashboard webhook URLs pointing to:
   - `https://<active-origin>/api/payments/webhook/sl_gateway`
   - `https://<active-origin>/api/payments/webhook/intl_gateway`
4. In **Admin Dashboard -> 15. Admin Settings**, confirm `/api/health` reports `Configured`, uncheck **Sandbox / Mock Testing Mode**, enable the approved gateway, and run a low-value live verification order before general traffic.

# Security Summary

## Scope & Reviewed Files
A full-stack Phase 6–7 security review and mandatory Global Design & Security Upgrade verification was completed across:
- **Server, Payments, RBAC & Audit Engine**: `/server.ts`, `/server/store.ts`, `/server/shipping.ts`, `/server/payments/adapters.ts`, `/server/seo_security.test.ts`, `/server/launch_readiness.test.ts`, `/server/security_upgrade.test.ts`
- **Firebase Configuration, Functions & Rules**: `/firebase.json`, `/.firebaserc`, `/firestore.rules`, `/firestore.indexes.json`, `/storage.rules`, `/firestore.rules.test.ts`, `/firebase-blueprint.json`, `/functions/src/index.ts`, `/scripts/prepare-functions.mjs`
- **Client Storefront, App Check, MFA & Admin Isolation**: `/src/services/firestoreService.ts`, `/src/pages/admin/panels/OverviewPanel.tsx`, `/src/pages/admin/panels/SettingsReportsPanels.tsx`, `/src/lib/firebase.ts`, `/src/lib/firebaseAppCheck.ts`, `/src/lib/firebaseAdmin.ts`, `/src/services/commerceApi.ts`, `/src/pages/admin/AdminLayout.tsx`, `/index.html`, `/src/index.css`

## Safeguards Verified & Improvements Implemented
- **Independent Firebase Project & Launch Gating**: Configured exclusively for the isolated Firebase project (`gen-lang-client-0899218655`) and database (`ai-studio-ceyvanaceylomira-e606d197-a4e9-4027-ac45-0034ca58574e`). Live Sri Lankan and international payment gateways remain strictly disabled (`sandboxMode: true`, gateway credentials unset) until merchant accounts and credentials are approved.
- **Role-Based Access Control (RBAC) & Admin MFA**: Server endpoints in `/server.ts` enforce granular role permissions (`super_admin`, `order_manager`, `catalog_manager`) synced via `adminRolesByEmail`. Optional MFA enforcement (`ADMIN_REQUIRE_MFA=true`) verifies Firebase ID token `sign_in_second_factor` claims on the server, backed by interactive TOTP enrollment and resolver flows in `/src/pages/admin/AdminLayout.tsx` and `/src/pages/admin/panels/SettingsReportsPanels.tsx`.
- **Immutable Admin Audit Ledger**: Privileged admin actions (order verification, refunds, status updates, international quotation responses, stock syncs, commerce settings, allowlist updates, CSV exports, and sandbox webhook tests) write append-only records to `auditLogs`, exposed exclusively to `super_admin` via `GET /api/admin/audit-logs` and rendered in Admin **17. Security & Audit Logs**. Firestore `/auditLogs/{logId}` rules allow `super_admin` read and `create` only (`allow update, delete: if false;`).
- **Firebase App Check & Abuse Protection**: Optional reCAPTCHA v3 Firebase App Check (`/src/lib/firebaseAppCheck.ts`) attaches `X-Firebase-AppCheck` tokens to public checkout, bank transfer proof, and international enquiry requests when `VITE_RECAPTCHA_SITE_KEY` is configured, validated server-side via Firebase Admin `getAppCheck().verifyToken` when `ENFORCE_APP_CHECK=true`.
- **Input Sanitization & Clean Production Initialization**: Customer checkout and international buyer enquiry inputs pass through `sanitizePlainText` in `/server/store.ts` to strip embedded HTML/script markup before storage. `initializeProductionDatabase()` initializes only `brands`, `categories`, `products`, `inventory`, and `siteSettings`—with zero fake customer PII or orders.
- **Server-Side Pricing, Inventory & Payment Integrity**: All checkout quotes, subtotals, pack weights, delivery zones, currency rates, and stock deductions are recomputed atomically inside serialized locks (`withStoreLock`). Negative stock and duplicate checkout submissions are blocked via idempotency keys (`409 Conflict`). Raw card numbers and CVVs are explicitly rejected (`400 Bad Request`). Payment webhooks verify HMAC signatures and deduplicate replayed events (`409 Conflict`).
- **HTTP Security, CSP & SSL/TLS Transport Headers**: Express (`server.ts`) and Firebase Hosting (`firebase.json`) apply HSTS (`Strict-Transport-Security`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and `Cross-Origin-Opener-Policy: same-origin-allow-popups`. `/api/*` returns strict `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` and `Cache-Control: no-store`, while GET document routes return an explicit HTML `Content-Security-Policy` preserving AI Studio iframe framing compatibility and required Firebase/reCAPTCHA origins.
- **Storage, Upload & Firestore Rule Boundaries**: `storage.rules` restricts image uploads (`create, update` <= 2MB WebP/JPEG/PNG for catalog admins) and denies all client access to `/payment-slips/**`. Server-side payment slips undergo magic-byte inspection (`JPEG`, `PNG`, `WebP`, `PDF`), UUID renaming, and confined path resolution behind `requireAdminAuth`. Verified via `eslint firestore.rules` and `firestore.rules.test.ts` (all 14 invariants passing, including immutable `/auditLogs`).
- **Dependency Audit & Verification Scope**: Previously observed `bun audit` transitive advisories affect only `@grpc/grpc-js` (`1.9.16`, `1.14.7`) nested inside Firebase/Google Cloud SDK transport dependencies; the application exposes HTTP/REST endpoints only. Browser Google OAuth popup and interactive Firebase TOTP enrollment depend on live Google/Firebase identity sessions and should be verified manually once hosted on an authorized domain.

---

## PoC Verification

All security, SEO, commerce, launch-readiness, RBAC, MFA, App Check, CSP, and Firestore rule invariants can be verified locally:

1. **Build Frontend, Cloud Functions Bundle & TypeScript**:
   ```bash
   npm run lint && npm run build && npm run build:functions
   ```

2. **Run Phase 3–7 & Global Security Automated Test Suites**:
   ```bash
   COMMERCE_TEST_MODE=1 npm run test:commerce && COMMERCE_TEST_MODE=1 npm run test:phase5 && COMMERCE_TEST_MODE=1 npm run test:phase6 && COMMERCE_TEST_MODE=1 npm run test:phase7 && COMMERCE_TEST_MODE=1 npm run test:security
   ```
   - `test:commerce`: Authoritative totals, idempotency (`409`), stock restoration, COD/gateway gating, raw card rejection (`400`), HMAC webhooks, and admin `401` barrier.
   - `test:phase5`: International enquiry validation, `http/https` URL guard, tracking isolation, and CSV formula neutralization.
   - `test:phase6`: Multilingual `/sitemap.xml` and `/robots.txt`, security headers, foreign-origin `403`, constant-time tokens, and `429` rate limits.
   - `test:phase7`: `/api/health` SSL HSTS headers, zero fake customer/order seeding, sandbox gateway gating, isolated Firebase config validation, zero secret exposure in `dist/`, and bundled Cloud Function module load.
   - `test:security`: RBAC role isolation (`super_admin`, `order_manager`, `catalog_manager`), `ADMIN_REQUIRE_MFA=true` single-factor block (`403 MFA_REQUIRED`) vs 2FA allow (`200`), `ENFORCE_APP_CHECK=true` missing/bad header block (`401`) vs valid token allow (`201`), HTML/API CSP headers, XSS tag sanitization, and immutable `auditLogs` ledger integrity.

3. **Run Firestore Rules Static & Logic Verification**:
   ```bash
   npx eslint firestore.rules && npx tsx firestore.rules.test.ts
   ```

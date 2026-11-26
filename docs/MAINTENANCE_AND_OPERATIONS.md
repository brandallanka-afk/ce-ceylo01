# Maintenance, Operations & Known Limitations

## 1. Daily & Weekly Operations

### 1.1 Order & Bank Transfer Verification
1. Open `/admin` and sign in via verified Google account (`brandallanka@gmail.com` or an active admin in `adminUsers`).
2. Navigate to **08. Order Management** and filter for orders in `payment_verification` or `awaiting_payment`.
3. Inspect the customer's bank transfer reference and uploaded payment slip (served exclusively through authenticated `/api/admin/slips/:fileName`), cross-check against the company bank statement, and click **Approve Payment** or **Reject**.
4. Update `shippingStatus`, `carrier`, and `trackingNumber` upon dispatch. Cancelling an unpaid or cancelled order automatically restores variant stock on the server.

### 1.2 Catalog, Stock & International Enquiries
- **Stock Adjustments**: Update per-variant stock quantities inside **07. Stock Management** (syncs both Firestore `inventory` and server commerce stock).
- **Wholesale & Export Enquiries**: Review incoming importer/distributor requests under **16. International Enquiries**, record country-specific shipping policies and quotations (never promising unverified transit times or customs duties), or export filtered CSVs.
- **Official WhatsApp & Bank Details**: Maintain the official WhatsApp Business number, bank account transfer instructions, delivery zones, and exchange rates inside **15. Admin Settings** (never auto-guessing currency conversion rates).

### 1.3 Administrator Access Control, MFA & Audit Logs
- Add or revoke team members under **15. Admin Settings -> RBAC Admin Access** using granular roles (`super_admin`, `order_manager`, `catalog_manager`). Only verified Google emails marked `active: true` can access Firestore admin collections and `/api/admin/*` routes.
- Enroll TOTP Multi-Factor Authentication in **15. Admin Settings -> Administrator MFA & App Check Posture** before setting `ADMIN_REQUIRE_MFA=true` in production.
- Review **17. Security & Audit Logs** regularly for all privileged mutations (payment verifications, refunds, settings changes, stock updates, and allowlist changes).

---

## 2. Routine Maintenance Schedule

| Cadence | Task | Command / Location |
| :--- | :--- | :--- |
| Weekly | Export JSON snapshot backup & review low-stock variants | Admin Dashboard -> Overview & Settings |
| Monthly | Export monthly sales CSV & verify WhatsApp / shipping fees | Admin Dashboard -> 13. Monthly Reports |
| Monthly | Run automated regression, SEO & security checks | `COMMERCE_TEST_MODE=1 npm run test:commerce && npm run test:phase5 && npm run test:phase6 && npm run test:phase7 && npm run test:security` |
| Monthly | Audit `firestore.rules` & check dependency advisories | `npx eslint firestore.rules && npx tsx firestore.rules.test.ts` |
| Quarterly | Verify automated Firestore backup exports & test restore into staging | `docs/BACKUP_AND_RECOVERY.md` |

---

## 3. Known Limitations (Current Launch Baseline)

1. **Temporary Hosting URL**: No custom domain has been pointed yet; the platform runs on temporary hosting URLs until final domain selection and approval.
2. **Live Card Payment Gateways Disabled**: Sri Lankan and international payment gateway adapters remain strictly in sandbox mode (`sandboxMode: true`, gateway credentials empty). Live card payments are intentionally disabled; **Bank Transfer** is the active live checkout method (with **Payment on Delivery** configurable by admin).
3. **Commerce Ledger Storage Scope**: Checkout orders, bank transfer slip files, and international buyer enquiries persist in the Node/Express server directory (`COMMERCE_DATA_DIR`, default `.data/`). When deploying statelessly to Firebase Cloud Functions (without a persistent disk), `/tmp` storage is ephemeral per instance—for multi-instance Cloud Run or stateless Cloud Functions production scale, mount persistent disk storage or migrate `server/store.ts` mutations into Firestore transactions.
4. **WhatsApp Ordering Handoff**: Clicking **Continue via WhatsApp** constructs an itemized order summary for human confirmation on WhatsApp Business; it does not auto-confirm payment or dispatch without admin verification.
5. **Third Language Readiness**: English (`en`) and Sinhala (`si`) translations and SEO metadata are complete. Tamil (`ta`) UI slot architecture is prepared and configurable in Admin **14. Language Management**, pending human-verified Tamil product and editorial copy before enabling publicly.
6. **Admin Authentication Scope**: Admin sign-in uses Google Sign-In (`signInWithPopup`). Any newly configured hosting hostname must be listed in Firebase Console -> Authentication -> Authorized domains.

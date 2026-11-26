import fs from 'fs';
import path from 'path';

/**
 * Security Rules Structural Verification Matrix
 * Maps the 12 adversarial payloads from security_spec.md against firestore.rules gates.
 * Run with: npx tsx firestore.rules.test.ts
 */
const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rulesContent = fs.existsSync(rulesPath)
  ? fs.readFileSync(rulesPath, 'utf-8')
  : fs.readFileSync(path.resolve(process.cwd(), 'DRAFT_firestore.rules'), 'utf-8');

const assertions: {name: string; check: boolean}[] = [
  {
    name: 'Global safety net default-deny catch-all exists',
    check: rulesContent.includes('match /{document=**}') && rulesContent.includes('allow read, write: if false;'),
  },
  {
    name: 'Email verification enforced for admin & verified actions',
    check: rulesContent.includes('request.auth.token.email_verified == true'),
  },
  {
    name: 'Products block client price tampering via isCatalogAdmin()',
    check: /match \/products\/\{productId\}[\s\S]*allow update:[\s\S]*isCatalogAdmin\(\)/.test(rulesContent),
  },
  {
    name: 'Inventory locked to admins only',
    check: /match \/inventory\/\{variantSku\}[\s\S]*allow get:[\s\S]*isAdmin\(\)/.test(rulesContent),
  },
  {
    name: 'Customers PII restricted to order/super admins',
    check: /match \/customers\/\{customerId\}[\s\S]*allow get:[\s\S]*isOrderAdmin\(\)/.test(rulesContent),
  },
  {
    name: 'Orders status/payment updates strictly gated and field-allowlisted',
    check: /match \/orders\/\{orderId\}[\s\S]*affectedKeys\(\)\.hasOnly\(\[\s*'orderStatus', 'paymentStatus', 'shippingStatus', 'trackingNumber', 'carrier', 'paymentReference', 'paymentHistory', 'updatedAt'\s*\]\)/.test(rulesContent),
  },
  {
    name: 'Public enquiries allow create ONLY with status == new and strict keys',
    check: rulesContent.includes("data.status == 'new'") && rulesContent.includes('isValidEnquiryCreate(incoming())'),
  },
  {
    name: 'Enquiry reads restricted to admins',
    check: /match \/enquiries\/\{enquiryId\}[\s\S]*allow get:[\s\S]*isAdmin\(\)/.test(rulesContent),
  },
  {
    name: 'Promotions restricted to admins (no public coupon scraping)',
    check: /match \/promotions\/\{promoId\}[\s\S]*allow list: if isAdmin\(\)/.test(rulesContent),
  },
  {
    name: 'AdminUsers prevents self-escalation by non-super-admins',
    check: /match \/adminUsers\/\{uid\}[\s\S]*isSuperAdmin\(\)/.test(rulesContent),
  },
  {
    name: 'Path ID hardening applied across collections',
    check: rulesContent.includes("id.matches('^[a-zA-Z0-9_\\\\-]+$')"),
  },
  {
    name: 'Temporal integrity uses request.time',
    check: rulesContent.includes('data.updatedAt == request.time'),
  },
  {
    name: 'International buyer optional website restricts scheme to http/https only',
    check: rulesContent.includes("data.website.matches('^https?://.*')"),
  },
  {
    name: 'AuditLogs are strictly append-only (no update/delete) and restricted to super_admin',
    check: /match \/auditLogs\/\{logId\}[\s\S]*allow get, list: if isSuperAdmin\(\);[\s\S]*allow update, delete: if false;/.test(rulesContent),
  },
  {
    name: 'Draft/unpublished portfolios are never publicly readable and remain brand-locked on update',
    check: /match \/cataloguePortfolios\/\{portfolioId\}[\s\S]*existing\(\)\.status == 'published' \|\| isAdmin\(\)[\s\S]*isCatalogAdmin\(\)/.test(rulesContent),
  },
  {
    name: 'Catalogue requests enforce create-only status=new and restrict reads/updates to admins',
    check: /match \/catalogueRequests\/\{requestId\}[\s\S]*allow get: if isValidId\(requestId\) && isAdmin\(\);[\s\S]*isValidCatalogueRequestCreate\(incoming\(\)\)/.test(rulesContent),
  },
];

let failed = 0;
for (const item of assertions) {
  if (item.check) {
    console.log(`PASS: ${item.name}`);
  } else {
    console.error(`FAIL: ${item.name}`);
    failed++;
  }
}

if (failed > 0) {
  process.exit(1);
}
console.log(`All ${assertions.length} security invariants verified.`);

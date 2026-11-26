# Backup and Recovery Runbook

> **Critical Project Isolation Rule**: Never export to, overwrite, or restore against the legacy Ceyvana Firebase project. Always verify the active project ID (`gen-lang-client-0899218655` or your dedicated standalone production Firebase project ID) and Firestore database ID (`ai-studio-ceyvanaceylomira-e606d197-a4e9-4027-ac45-0034ca58574e`) before executing any command.

---

## 1. Firestore Database Backup

### 1.1 Automated Scheduled Daily Backups (Blaze Plan)
```bash
gcloud config set project gen-lang-client-0899218655

# Create a dedicated regional backup bucket (one-time)
gcloud storage buckets create gs://ceylon-heritage-backups-gen-lang-client-0899218655 \
  --location=asia-south1 \
  --uniform-bucket-level-access

# Enable daily scheduled Firestore exports with 14-day retention
gcloud firestore backups schedules create \
  --database='ai-studio-ceyvanaceylomira-e606d197-a4e9-4027-ac45-0034ca58574e' \
  --recurrence=daily \
  --retention=14d
```

### 1.2 Manual On-Demand Export (Before Catalog, Rule, or Schema Changes)
```bash
gcloud firestore export gs://ceylon-heritage-backups-gen-lang-client-0899218655/firestore/manual-$(date +%Y%m%d-%H%M) \
  --database='ai-studio-ceyvanaceylomira-e606d197-a4e9-4027-ac45-0034ca58574e' \
  --collection-ids=brands,categories,products,inventory,customers,orders,enquiries,promotions,siteSettings,adminUsers
```

### 1.3 In-App JSON Snapshot Export (Admin Dashboard)
In **Admin Dashboard -> 15. Admin Settings**, click **Export JSON Backup Snapshot** to download a client-readable JSON snapshot (`brands`, `categories`, `products`, `inventory`, `customers`, `orders`, `enquiries`, `promotions`, `siteSettings`) directly to an authorized administrator's workstation.

---

## 2. Firebase Storage Backup (Product Media)

### 2.1 Enable Object Versioning on the Media Bucket
```bash
gcloud storage buckets update gs://gen-lang-client-0899218655.firebasestorage.app --versioning
```

### 2.2 Mirror Product Media to the Backup Bucket
```bash
gcloud storage cp --recursive \
  gs://gen-lang-client-0899218655.firebasestorage.app/products \
  gs://ceylon-heritage-backups-gen-lang-client-0899218655/storage-products-$(date +%Y%m%d)
```

---

## 3. Express Commerce Ledger & Payment Slips Backup (`.data/`)

When running the Node/Express commerce backend with persistent disk storage (`COMMERCE_DATA_DIR`, default `.data/`), back up the authoritative order ledger (`commerce-store.json`) and uploaded bank transfer slips (`slips/`):
```bash
tar -czf ceylon-commerce-ledger-$(date +%Y%m%d-%H%M).tar.gz .data/commerce-store.json .data/slips/
```
Store the resulting archive in restricted-access Cloud Storage or encrypted company storage—never commit `.data/` to Git or expose payment slips publicly.

---

## 4. Source-Code Backup

1. **Git Release Tags**: Tag every verified phase and release before deployment:
   ```bash
   git add -A
   git commit -m "Release: Phase 7 production launch preparation"
   git tag -a v1.0.0-phase7 -m "Verified Phase 7 build and tests"
   git push origin main --tags
   ```
2. **Clean Offline Source Archive (Excluding Secrets & Local Data)**:
   ```bash
   git archive --format=zip --output=ceylon-heritage-source-v1.0.0.zip HEAD
   ```
   Confirm `.env*` (other than `.env.example`), `node_modules/`, and `.data/` are NOT included in any shared source archive.

---

## 5. Restoration Procedures

### 5.1 Restore Firestore from Export
1. Verify target project and database ID before importing:
   ```bash
   gcloud config get-value project
   ```
2. Import full backup or selected collections:
   ```bash
   gcloud firestore import gs://ceylon-heritage-backups-gen-lang-client-0899218655/firestore/manual-YYYYMMDD-HHMM \
     --database='ai-studio-ceyvanaceylomira-e606d197-a4e9-4027-ac45-0034ca58574e' \
     --collection-ids=brands,categories,products,inventory,siteSettings
   ```
3. Re-deploy and verify Firestore rules immediately after restoration:
   ```bash
   npx eslint firestore.rules && npx tsx firestore.rules.test.ts
   firebase deploy --only firestore:rules
   ```

### 5.2 Restore Firebase Storage Product Media
```bash
gcloud storage cp --recursive \
  gs://ceylon-heritage-backups-gen-lang-client-0899218655/storage-products-YYYYMMDD/products \
  gs://gen-lang-client-0899218655.firebasestorage.app/products
```

### 5.3 Restore Express Commerce Ledger & Slips
1. Stop the Node process briefly (`systemctl stop ...` or scale down instance).
2. Extract `.data/commerce-store.json` and `.data/slips/` into `COMMERCE_DATA_DIR`.
3. Restart the service and verify `/api/health` and `/api/commerce/config`.

### 5.4 Roll Back Hosting or Source Release
- **Firebase Hosting Instant Rollback**: In Firebase Console -> **Hosting -> Release history**, select the previous verified release and click **Rollback**.
- **Source Code Rollback**:
  ```bash
  git checkout v1.0.0-phase7
  npm ci
  npm run build && npm run build:functions
  ```

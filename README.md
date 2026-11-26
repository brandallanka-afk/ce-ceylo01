# Ceyvana & Ceylomira — Integrated Multi-Brand E-Commerce Platform

Lightweight, bilingual (`en` / `si`), SEO/AEO/GEO-optimized multi-brand corporate website and e-commerce platform for **CEYVANA (Premium Ceylon Spices)**, **CEYLOMIRA (Premium Ceylon Tea)**, and configurable **Ceylon Hand Crafts (Coming Soon)**.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4 (responsive WebP imagery, zero autoplay video, lazy-loaded routes and admin SDK isolation)
- **Backend**: Express (`server.ts`, `server/`) running natively on Node.js 22 (`node server.ts`) and wrap-ready for Firebase Cloud Functions v2 (`functions/`)
- **Firebase Project (Isolated)**: Project `gen-lang-client-0899218655`, Firestore database `ai-studio-ceyvanaceylomira-e606d197-a4e9-4027-ac45-0034ca58574e`, Google Auth RBAC, and bounded Firebase Storage rules (`storage.rules`)

## Scripts & Verification
```bash
npm install
npm run dev              # Start integrated local dev server on port 3000
npm run lint             # TypeScript type check (tsc --noEmit)
npm run build            # Build production client bundle + responsive WebP assets into dist/
npm run build:functions  # Bundle Express server into functions/lib/ for Cloud Functions v2
npm run test:commerce    # Phase 3 & 4 checkout, stock, Bank Transfer & HMAC webhook tests
npm run test:phase5      # International enquiries, currency & CSV injection tests
npm run test:phase6      # SEO sitemap/robots, security headers, CORS & rate-limit tests
npm run test:phase7      # Launch readiness, HSTS/SSL, sandbox gate & artifact checks
npx eslint firestore.rules
npx tsx firestore.rules.test.ts
```

## Documentation Index
- **Production Deployment & Custom Domain / Payment Gating**: `/docs/PRODUCTION_DEPLOYMENT.md`
- **Backup & Recovery (Firestore, Storage, Source Code, Commerce Ledger)**: `/docs/BACKUP_AND_RECOVERY.md`
- **Maintenance & Known Limitations**: `/docs/MAINTENANCE_AND_OPERATIONS.md`
- **Payment & Shipping Architecture**: `/docs/PAYMENT_AND_SHIPPING_INTEGRATION.md`
- **System Architecture & Schema**: `/docs/ARCHITECTURE_AND_PLAN.md`
- **Security Summary & Verification Walkthrough**: `/walkthrough.md`

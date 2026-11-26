import express, {type NextFunction, type Request, type Response} from 'express';
import {getApp, getApps, initializeApp} from 'firebase-admin/app';
import {getAppCheck} from 'firebase-admin/app-check';
import {getAuth, type DecodedIdToken} from 'firebase-admin/auth';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AdminRole,
  CatalogueRequestStatus,
  CommerceSettingsConfig,
  InternationalEnquiryStatus,
  OrderStatus,
  PaymentMethodId,
  PortfolioStatus,
  ShippingStatus,
} from './src/types/admin.ts';
import type {BrandId, CurrencyCode} from './src/types/commerce.ts';
import {PAYMENT_ADAPTERS} from './server/payments/adapters.ts';
import {
  buildPublicCustomPortfolioPdf,
  createCatalogueRequest,
  generateAdminPortfolio,
  listAdminCatalogueRequests,
  listAdminPortfolios,
  listPublishedPortfolios,
  updateAdminCatalogueRequest,
  updateAdminPortfolioStatus,
} from './server/portfolios.ts';
import {
  adminRecordRefund,
  adminRespondToInternationalEnquiry,
  adminUpdateExportOverrides,
  adminUpdateOrder,
  adminVerifyBankTransfer,
  attachBankTransferProof,
  BOOTSTRAP_ADMIN_EMAIL,
  buildInternationalEnquiriesCsv,
  clearCatalogCache,
  CommerceHttpError,
  computeOrderQuote,
  createInternationalEnquiry,
  createServerOrder,
  getAuthoritativeProducts,
  getStoreReadonly,
  processVerifiedWebhook,
  recordAdminAuditLog,
  resolveAdminRole,
  resolveSafePortfolioPdfPath,
  resolveSafeSlipPath,
  safeEqualToken,
  sanitizePlainText,
  trackInternationalEnquiry,
  withStoreLock,
} from './server/store.ts';
import type {
  CatalogueRequestInput,
  CheckoutOrderInput,
  GeneratePortfolioInput,
  InternationalEnquiryInput,
} from './server/types.ts';

interface RequestWithRawBody extends Request {
  rawBody?: string;
  adminEmail?: string;
  adminRole?: AdminRole;
  adminMfaVerified?: boolean;
}

export interface CreateAppSecurityOverrides {
  verifyIdToken?: (token: string) => Promise<DecodedIdToken>;
  verifyAppCheckToken?: (token: string) => Promise<unknown>;
}

function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveRequestOrigin(req: Request): string {
  if (process.env.APP_URL && /^https?:\/\//i.test(process.env.APP_URL)) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  const host = req.get('host') || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto']
    ? String(req.headers['x-forwarded-proto']).split(',')[0].trim()
    : req.protocol || 'http';
  return `${proto}://${host}`;
}

function isAllowedOriginHeader(originHeader: string, req: Request): boolean {
  try {
    const parsed = new URL(originHeader);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const reqHost = (req.get('host') || '').toLowerCase();
    if (reqHost && parsed.host.toLowerCase() === reqHost) {
      return true;
    }
    if (process.env.APP_URL) {
      try {
        const appHost = new URL(process.env.APP_URL).host.toLowerCase();
        if (parsed.host.toLowerCase() === appHost) return true;
      } catch {
        // Ignore malformed APP_URL
      }
    }
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.run.app')
    );
  } catch {
    return false;
  }
}

function createSlidingWindowRateLimiter(maxRequests: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const xff = req.headers['x-forwarded-for'];
    const clientIp =
      (typeof xff === 'string' ? xff.split(',')[0].trim() : req.ip || 'unknown') || 'unknown';
    const now = Date.now();
    const recent = (hits.get(clientIp) ?? []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'Too many requests. Please wait a moment before trying again.',
      });
      return;
    }
    recent.push(now);
    hits.set(clientIp, recent);
    // Keep memory bounded if many unique IPs hit the endpoint
    if (hits.size > 2000) {
      for (const [k, v] of hits.entries()) {
        if (v.every((ts) => now - ts >= windowMs)) hits.delete(k);
      }
    }
    next();
  };
}

const ROOT_DIR = process.cwd();
const FIREBASE_CONFIG = JSON.parse(
  fs.readFileSync(path.resolve(ROOT_DIR, 'firebase-applet-config.json'), 'utf8'),
) as {projectId: string; firestoreDatabaseId?: string};

const ACTIVE_FIREBASE_PROJECT_ID =
  (process.env.FIREBASE_PROJECT_ID || '').trim() || FIREBASE_CONFIG.projectId;
const ACTIVE_FIREBASE_DATABASE_ID =
  (process.env.FIREBASE_DATABASE_ID || '').trim() ||
  FIREBASE_CONFIG.firestoreDatabaseId ||
  '(default)';

const adminApp = getApps().length
  ? getApp()
  : initializeApp({projectId: ACTIVE_FIREBASE_PROJECT_ID});
const adminAuth = getAuth(adminApp);
const adminAppCheck = getAppCheck(adminApp);

const HTML_DOCUMENT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://www.google.com https://recaptcha.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https: blob:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com https://www.google.com https://recaptcha.net wss:",
  "frame-src 'self' blob: https://*.firebaseapp.com https://accounts.google.com https://www.google.com https://recaptcha.net",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function createApp(securityOverrides?: CreateAppSecurityOverrides) {
  const app = express();
  app.disable('x-powered-by');

  const verifyIdTokenFn =
    securityOverrides?.verifyIdToken ?? ((token: string) => adminAuth.verifyIdToken(token));
  const verifyAppCheckTokenFn =
    securityOverrides?.verifyAppCheckToken ??
    ((token: string) => adminAppCheck.verifyToken(token));

  function requireAdminAuth(allowedRoles?: AdminRole[]) {
    return async (
      req: RequestWithRawBody,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      const authHeader = req.headers.authorization || '';
      const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
      if (!match) {
        res.status(401).json({error: 'Missing administrator authorization token.'});
        return;
      }

      try {
        const decoded = await verifyIdTokenFn(match[1]);
        const email = (decoded.email || '').toLowerCase();
        if (!decoded.email_verified || !email) {
          res.status(403).json({error: 'Verified email required for admin access.'});
          return;
        }
        const store = getStoreReadonly();
        const role = resolveAdminRole(store, email);
        if (!role) {
          res.status(403).json({error: 'Account does not have active administrator permissions.'});
          return;
        }

        const firebaseClaims = decoded.firebase as Record<string, unknown> | undefined;
        const mfaVerified = Boolean(firebaseClaims?.sign_in_second_factor);
        if (process.env.ADMIN_REQUIRE_MFA === 'true' && !mfaVerified) {
          res.status(403).json({
            error: 'Multi-factor authentication (MFA) is required for administrator access.',
            code: 'MFA_REQUIRED',
          });
          return;
        }

        if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
          res.status(403).json({
            error: `Insufficient administrator role privileges (${role}) for this operation.`,
          });
          return;
        }

        req.adminEmail = email;
        req.adminRole = role;
        req.adminMfaVerified = mfaVerified;
        next();
      } catch {
        res.status(401).json({error: 'Invalid or expired Firebase ID token.'});
      }
    };
  }

  async function verifyOptionalAppCheck(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (process.env.ENFORCE_APP_CHECK !== 'true') {
      next();
      return;
    }
    const token = String(req.headers['x-firebase-appcheck'] || '').trim();
    if (!token) {
      res.status(401).json({error: 'Valid Firebase App Check token is required.'});
      return;
    }
    try {
      await verifyAppCheckTokenFn(token);
      next();
    } catch {
      res.status(401).json({error: 'Invalid or expired Firebase App Check token.'});
    }
  }

  const writeRateLimiter = createSlidingWindowRateLimiter(
    Math.max(1, Number(process.env.RATE_LIMIT_WRITE_MAX || 25)),
    60_000,
  );
  const readRateLimiter = createSlidingWindowRateLimiter(
    Math.max(1, Number(process.env.RATE_LIMIT_READ_MAX || 60)),
    60_000,
  );

  // Baseline security & SSL/TLS transport headers compatible with AI Studio iframe embedding
  app.use((req, res, next) => {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    if (req.secure || forwardedProto === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    if (req.path.startsWith('/api/')) {
      const isPdfEndpoint =
        req.path.endsWith('/pdf') || req.path === '/api/portfolios/custom-pdf';
      res.setHeader(
        'Content-Security-Policy',
        isPdfEndpoint
          ? "default-src 'none'; frame-ancestors 'self'"
          : "default-src 'none'; frame-ancestors 'none'",
      );
      res.setHeader('Cache-Control', 'no-store');
    } else if (
      req.method === 'GET' &&
      !req.path.startsWith('/assets/') &&
      !req.path.startsWith('/src/') &&
      !req.path.startsWith('/@')
    ) {
      res.setHeader('Content-Security-Policy', HTML_DOCUMENT_CSP);
    }
    next();
  });

  // Origin validation for browser state-mutating API endpoints (excluding external payment webhooks)
  app.use('/api', (req, res, next) => {
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      !req.path.startsWith('/payments/webhook/')
    ) {
      const originHeader = req.headers.origin;
      if (typeof originHeader === 'string' && !isAllowedOriginHeader(originHeader, req)) {
        res.status(403).json({error: 'Cross-origin mutation rejected.'});
        return;
      }
    }
    next();
  });

  app.use(
    express.json({
      limit: '4mb',
      verify: (req, _res, buf) => {
        (req as RequestWithRawBody).rawBody = buf.toString('utf8');
      },
    }),
  );

  // -------------------------------------------------------------------------
  // Dynamic Multilingual SEO Endpoints (robots.txt & sitemap.xml)
  // -------------------------------------------------------------------------
  app.get('/robots.txt', (req: Request, res: Response) => {
    const origin = resolveRequestOrigin(req);
    const body = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /cart',
      'Disallow: /api/',
      '',
      `Sitemap: ${origin}/sitemap.xml`,
      '',
    ].join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(body);
  });

  app.get('/sitemap.xml', async (req: Request, res: Response) => {
    try {
      const origin = resolveRequestOrigin(req);
      const store = getStoreReadonly();
      const products = (await getAuthoritativeProducts(store)).filter((p) => !p.isArchived);

      const staticEntries: {path: string; changefreq: string; priority: string}[] = [
        {path: '/', changefreq: 'weekly', priority: '1.0'},
        {path: '/ceyvana', changefreq: 'weekly', priority: '0.9'},
        {path: '/ceylomira', changefreq: 'weekly', priority: '0.9'},
        {path: '/portfolio', changefreq: 'weekly', priority: '0.9'},
        {path: '/wholesale', changefreq: 'weekly', priority: '0.8'},
        {path: '/about', changefreq: 'monthly', priority: '0.7'},
        {path: '/stories', changefreq: 'weekly', priority: '0.7'},
        {path: '/contact', changefreq: 'monthly', priority: '0.7'},
        {path: '/hand-crafts', changefreq: 'monthly', priority: '0.5'},
        {path: '/privacy', changefreq: 'yearly', priority: '0.4'},
        {path: '/terms', changefreq: 'yearly', priority: '0.4'},
      ];

      const productEntries = products.map((p) => ({
        path: `/product/${encodeURIComponent(p.slug)}`,
        changefreq: 'weekly',
        priority: '0.8',
      }));

      const allEntries = [...staticEntries, ...productEntries];
      const urlBlocks = allEntries
        .flatMap((entry) => {
          const enUrl = `${origin}${entry.path}`;
          const siPath = entry.path === '/' ? '/si' : `/si${entry.path}`;
          const siUrl = `${origin}${siPath}`;
          const alternates = [
            `    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(enUrl)}" />`,
            `    <xhtml:link rel="alternate" hreflang="si" href="${escapeXml(siUrl)}" />`,
            `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(enUrl)}" />`,
          ].join('\n');

          return [
            `  <url>\n    <loc>${escapeXml(enUrl)}</loc>\n${alternates}\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`,
            `  <url>\n    <loc>${escapeXml(siUrl)}</loc>\n${alternates}\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`,
          ];
        })
        .join('\n');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urlBlocks}\n</urlset>\n`;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=1800');
      res.send(xml);
    } catch {
      res.status(500).send('Unable to generate sitemap.');
    }
  });

  // -------------------------------------------------------------------------
  // Public Health Readiness & SSL Verification Endpoint
  // -------------------------------------------------------------------------
  app.get('/api/health', (_req: Request, res: Response) => {
    const store = getStoreReadonly();
    res.json({
      ok: true,
      service: 'ceylon-heritage-commerce',
      projectId: ACTIVE_FIREBASE_PROJECT_ID,
      databaseId: ACTIVE_FIREBASE_DATABASE_ID,
      sandboxMode: store.settings.payment.sandboxMode,
      slGatewayConfigured: PAYMENT_ADAPTERS.sl_gateway.isConfiguredForLive(),
      intlGatewayConfigured: PAYMENT_ADAPTERS.intl_gateway.isConfiguredForLive(),
      timestamp: new Date().toISOString(),
    });
  });

  // -------------------------------------------------------------------------
  // Public Commerce Configuration, Export Catalogue & Authoritative Quote
  // -------------------------------------------------------------------------
  app.get('/api/commerce/config', async (_req: Request, res: Response) => {
    try {
      const store = getStoreReadonly();
      const catalog = await getAuthoritativeProducts(store);
      const liveStockBySku: Record<string, {stockQuantity: number; available: boolean}> = {};
      for (const p of catalog) {
        for (const v of p.variants) {
          liveStockBySku[v.variantSku] = {
            stockQuantity: v.stockQuantity,
            available: v.available,
          };
        }
      }
      res.json({
        whatsappNumber: store.settings.whatsappNumber,
        brandWhatsappNumbers: store.settings.brandWhatsappNumbers,
        portfolioSettings: store.settings.portfolioSettings,
        currencies: store.settings.currencies,
        exportConfig: store.settings.exportConfig,
        payment: {
          ...store.settings.payment,
          slGatewayConfigured: PAYMENT_ADAPTERS.sl_gateway.isConfiguredForLive(),
          intlGatewayConfigured: PAYMENT_ADAPTERS.intl_gateway.isConfiguredForLive(),
        },
        shipping: store.settings.shipping,
        liveStockBySku,
      });
    } catch (err) {
      res.status(500).json({error: err instanceof Error ? err.message : 'Unable to load config.'});
    }
  });

  app.get('/api/export/catalog', async (_req: Request, res: Response) => {
    try {
      const store = getStoreReadonly();
      const products = (await getAuthoritativeProducts(store)).filter(
        (p) => !p.isArchived && p.exportable !== false,
      );
      res.json({
        products,
        currencies: store.settings.currencies.filter((c) => c.enabled),
        exportConfig: store.settings.exportConfig,
        internationalRates: store.settings.shipping.internationalRates.filter((r) => r.enabled),
      });
    } catch (err) {
      res.status(500).json({error: err instanceof Error ? err.message : 'Unable to load export catalog.'});
    }
  });

  app.post('/api/commerce/quote', readRateLimiter, async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        items?: {productId: string; variantSku: string; qty: number}[];
        currency?: CurrencyCode;
        country?: string;
        deliveryMethod?: CheckoutOrderInput['deliveryMethod'];
        localZoneId?: string;
      };
      const quote = await computeOrderQuote({
        items: body.items ?? [],
        currency: String(body.currency || 'LKR').toUpperCase(),
        country: String(body.country || 'Sri Lanka'),
        deliveryMethod: body.deliveryMethod || 'local_standard',
        localZoneId: body.localZoneId,
      });
      res.json(quote);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid quote request.';
      const status = msg.includes('Insufficient stock') ? 409 : 400;
      res.status(status).json({error: msg});
    }
  });

  // -------------------------------------------------------------------------
  // Phase 5: Public International Buyer Enquiries & Tracking
  // -------------------------------------------------------------------------
  app.post(
    '/api/enquiries/international',
    writeRateLimiter,
    verifyOptionalAppCheck,
    async (req: Request, res: Response) => {
      try {
        const record = await createInternationalEnquiry(req.body as InternationalEnquiryInput);
        res.status(201).json({enquiry: record});
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({error: err.message});
          return;
        }
        res.status(400).json({error: err instanceof Error ? err.message : 'Unable to submit enquiry.'});
      }
    },
  );

  app.get('/api/enquiries/track', readRateLimiter, (req: Request, res: Response) => {
    try {
      const enquiryRef = String(req.query.enquiryRef || '').trim();
      const credential = String(req.query.credential || req.query.email || req.query.token || '').trim();
      const tracked = trackInternationalEnquiry({enquiryRef, credential});
      res.json({enquiry: tracked});
    } catch (err) {
      if (err instanceof CommerceHttpError) {
        res.status(err.status).json({error: err.message});
        return;
      }
      res.status(400).json({error: 'Unable to track enquiry.'});
    }
  });

  // -------------------------------------------------------------------------
  // Public Product Portfolio PDFs & Customer Catalogue Requests
  // -------------------------------------------------------------------------
  app.get('/api/portfolios/published', (_req: Request, res: Response) => {
    const store = getStoreReadonly();
    const published = listPublishedPortfolios().map((p) => ({
      ...p,
      // Never expose confidential wholesale field flag summary or internal paths unnecessarily
      pdfUrl: `/api/portfolios/published/${encodeURIComponent(p.id)}/pdf`,
    }));
    res.json({
      portfolios: published,
      portfolioSettings: store.settings.portfolioSettings,
    });
  });

  app.get('/api/portfolios/published/:id/pdf', (req: Request, res: Response) => {
    const store = getStoreReadonly();
    if (store.settings.portfolioSettings?.requireRegistrationForPublicDownload) {
      res.status(403).json({
        error:
          'Public direct downloads require completing the Catalogue Request form per administrator policy.',
      });
      return;
    }
    const pf = store.portfolios[String(req.params.id || '')];
    if (!pf || pf.status !== 'published') {
      res.status(404).json({error: 'Published portfolio PDF not found.'});
      return;
    }
    const resolved = resolveSafePortfolioPdfPath(pf.pdfFileName);
    if (!resolved) {
      res.status(404).json({error: 'Portfolio PDF file is missing on disk.'});
      return;
    }
    const isPreview = req.query.preview === '1';
    const downloadName = `${pf.brandId}-portfolio-${pf.language}-${pf.version.replace(/[^a-z0-9._-]/gi, '')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${isPreview ? 'inline' : 'attachment'}; filename="${downloadName}"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(resolved);
  });

  app.post('/api/portfolios/custom-pdf', writeRateLimiter, async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        brandId?: BrandId;
        language?: 'en' | 'si';
        currency?: CurrencyCode;
        scope?: 'all' | 'categories' | 'products';
        categorySlugs?: string[];
        productIds?: string[];
        preview?: boolean;
      };
      const result = await buildPublicCustomPortfolioPdf({
        brandId: body.brandId as BrandId,
        language: body.language === 'si' ? 'si' : 'en',
        currency: body.currency,
        scope:
          body.scope === 'categories' || body.scope === 'products' ? body.scope : 'all',
        categorySlugs: body.categorySlugs,
        productIds: body.productIds,
        originUrl: resolveRequestOrigin(req),
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `${body.preview ? 'inline' : 'attachment'}; filename="${result.fileName}"`,
      );
      res.setHeader('Cache-Control', 'no-store');
      res.send(result.buffer);
    } catch (err) {
      if (err instanceof CommerceHttpError) {
        res.status(err.status).json({error: err.message});
        return;
      }
      res.status(400).json({error: err instanceof Error ? err.message : 'Unable to generate PDF.'});
    }
  });

  app.post(
    '/api/catalogue-requests',
    writeRateLimiter,
    verifyOptionalAppCheck,
    async (req: Request, res: Response) => {
      try {
        const record = await createCatalogueRequest(req.body as CatalogueRequestInput);
        res.status(201).json({request: record});
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({error: err.message});
          return;
        }
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Unable to submit catalogue request.',
        });
      }
    },
  );

  // -------------------------------------------------------------------------
  // Public Checkout & Order Creation (Server-Authoritative)
  // -------------------------------------------------------------------------
  app.post(
    '/api/orders',
    writeRateLimiter,
    verifyOptionalAppCheck,
    async (req: Request, res: Response) => {
      try {
        const order = await createServerOrder(req.body as CheckoutOrderInput);
        res.status(201).json({order});
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({error: err.message, ...(err.details ?? {})});
          return;
        }
        res.status(500).json({error: err instanceof Error ? err.message : 'Order creation failed.'});
      }
    },
  );

  app.post(
    '/api/orders/:orderRef/bank-reference',
    writeRateLimiter,
    verifyOptionalAppCheck,
    async (req: Request, res: Response) => {
      try {
        const body = req.body as {
          receiptToken?: string;
          paymentReference?: string;
          paymentSlipBase64?: string;
        };
        const order = await attachBankTransferProof({
          orderRef: String(req.params.orderRef),
          receiptToken: String(body.receiptToken || ''),
          paymentReference: body.paymentReference,
          paymentSlipBase64: body.paymentSlipBase64,
        });
        res.json({order});
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({error: err.message});
          return;
        }
        res.status(400).json({error: err instanceof Error ? err.message : 'Failed to update proof.'});
      }
    },
  );

  app.post('/api/orders/:orderRef/whatsapp-intent', writeRateLimiter, async (req: Request, res: Response) => {
    try {
      const {receiptToken} = req.body as {receiptToken?: string};
      await withStoreLock((store) => {
        const order = Object.values(store.orders).find((o) => o.orderRef === req.params.orderRef);
        if (!order || !safeEqualToken(order.receiptToken, receiptToken)) {
          throw new CommerceHttpError(403, 'Invalid receipt token.');
        }
        order.whatsappHandoffAt = new Date().toISOString();
      });
      res.json({ok: true});
    } catch (err) {
      if (err instanceof CommerceHttpError) {
        res.status(err.status).json({error: err.message});
        return;
      }
      res.status(400).json({error: 'Unable to log WhatsApp handoff.'});
    }
  });

  app.get('/api/orders/lookup', readRateLimiter, (req: Request, res: Response) => {
    const orderRef = String(req.query.orderRef || '').trim();
    const token = String(req.query.token || '').trim();
    if (!orderRef || !token) {
      res.status(400).json({error: 'Order reference and receipt token are required.'});
      return;
    }
    const store = getStoreReadonly();
    const order = Object.values(store.orders).find((o) => o.orderRef === orderRef);
    if (!order || !safeEqualToken(order.receiptToken, token)) {
      res.status(404).json({error: 'Order receipt not found.'});
      return;
    }
    res.json({order});
  });

  // -------------------------------------------------------------------------
  // Payment Gateway Webhook Endpoint (HMAC Verified)
  // -------------------------------------------------------------------------
  app.post('/api/payments/webhook/:provider', async (req: RequestWithRawBody, res: Response) => {
    const provider = req.params.provider as PaymentMethodId;
    const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
    try {
      const result = await processVerifiedWebhook({
        provider,
        rawBody,
        headers: req.headers,
      });
      res.status(result.duplicate ? 409 : 200).json({
        duplicate: result.duplicate,
        orderRef: result.order.orderRef,
        paymentStatus: result.order.paymentStatus,
        orderStatus: result.order.orderStatus,
      });
    } catch (err) {
      if (err instanceof CommerceHttpError) {
        res.status(err.status).json({error: err.message});
        return;
      }
      res.status(400).json({error: err instanceof Error ? err.message : 'Webhook rejected.'});
    }
  });

  // -------------------------------------------------------------------------
  // Admin Endpoints (Firebase ID Token + Role-Based + Optional MFA Verified)
  // -------------------------------------------------------------------------
  app.get('/api/admin/session', requireAdminAuth(), (req: RequestWithRawBody, res: Response) => {
    res.json({
      session: {
        email: req.adminEmail,
        role: req.adminRole,
        mfaVerified: Boolean(req.adminMfaVerified),
        mfaRequired: process.env.ADMIN_REQUIRE_MFA === 'true',
        appCheckEnforced: process.env.ENFORCE_APP_CHECK === 'true',
      },
    });
  });

  app.get(
    '/api/admin/audit-logs',
    requireAdminAuth(['super_admin']),
    (req: Request, res: Response) => {
      const store = getStoreReadonly();
      const q = String(req.query.q || '').trim().toLowerCase();
      const targetType = String(req.query.targetType || 'all');
      let logs = store.auditLogs ?? [];
      if (targetType !== 'all') {
        logs = logs.filter((entry) => entry.targetType === targetType);
      }
      if (q) {
        logs = logs.filter(
          (entry) =>
            entry.actorEmail.toLowerCase().includes(q) ||
            entry.action.toLowerCase().includes(q) ||
            entry.targetId.toLowerCase().includes(q) ||
            entry.summary.toLowerCase().includes(q),
        );
      }
      res.json({logs: logs.slice(0, 200)});
    },
  );

  app.get(
    '/api/admin/orders',
    requireAdminAuth(['super_admin', 'order_manager']),
    (req: Request, res: Response) => {
      const store = getStoreReadonly();
      const q = String(req.query.q || '').trim().toLowerCase();
      const brand = String(req.query.brand || 'all') as 'all' | BrandId;
      const status = String(req.query.status || 'all');
      const dateFrom = String(req.query.dateFrom || '').trim();
      const dateTo = String(req.query.dateTo || '').trim();

      let list = Object.values(store.orders).sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
      );

      if (q) {
        list = list.filter(
          (o) =>
            o.orderRef.toLowerCase().includes(q) ||
            o.customerName.toLowerCase().includes(q) ||
            (o.customerEmail || '').toLowerCase().includes(q) ||
            (o.phone || '').toLowerCase().includes(q) ||
            (o.paymentReference || '').toLowerCase().includes(q),
        );
      }
      if (brand !== 'all') {
        list = list.filter((o) => o.items.some((i) => i.brandId === brand));
      }
      if (status !== 'all') {
        list = list.filter((o) => o.orderStatus === status);
      }
      if (dateFrom) {
        list = list.filter((o) => String(o.createdAt || '').slice(0, 10) >= dateFrom);
      }
      if (dateTo) {
        list = list.filter((o) => String(o.createdAt || '').slice(0, 10) <= dateTo);
      }

      res.json({orders: list, customers: Object.values(store.customers)});
    },
  );

  app.patch(
    '/api/admin/orders/:id/status',
    requireAdminAuth(['super_admin', 'order_manager']),
    async (req: RequestWithRawBody, res: Response) => {
      try {
        const body = req.body as {
          orderStatus?: OrderStatus;
          shippingStatus?: ShippingStatus;
          trackingNumber?: string;
          carrier?: string;
          adminNotes?: string;
        };
        const updated = await adminUpdateOrder({
          orderId: String(req.params.id),
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          orderStatus: body.orderStatus,
          shippingStatus: body.shippingStatus,
          trackingNumber: body.trackingNumber,
          carrier: body.carrier,
          adminNotes: body.adminNotes,
        });
        res.json({order: updated});
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({error: err.message});
          return;
        }
        res.status(400).json({error: err instanceof Error ? err.message : 'Update failed.'});
      }
    },
  );

  app.post(
    '/api/admin/orders/:id/verify-payment',
    requireAdminAuth(['super_admin', 'order_manager']),
    async (req: RequestWithRawBody, res: Response) => {
      try {
        const body = req.body as {
          decision: 'approve' | 'reject';
          transactionRef?: string;
          note?: string;
        };
        if (body.decision !== 'approve' && body.decision !== 'reject') {
          res.status(400).json({error: 'Decision must be approve or reject.'});
          return;
        }
        const updated = await adminVerifyBankTransfer({
          orderId: String(req.params.id),
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          decision: body.decision,
          transactionRef: body.transactionRef,
          note: body.note,
        });
        res.json({order: updated});
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({error: err.message});
          return;
        }
        res.status(400).json({error: err instanceof Error ? err.message : 'Verification failed.'});
      }
    },
  );

  app.post(
    '/api/admin/orders/:id/refund',
    requireAdminAuth(['super_admin', 'order_manager']),
    async (req: RequestWithRawBody, res: Response) => {
      try {
        const body = req.body as {amount?: number; reason?: string; transactionRef?: string};
        const updated = await adminRecordRefund({
          orderId: String(req.params.id),
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          amount: Number(body.amount),
          reason: String(body.reason || 'Customer refund'),
          transactionRef: body.transactionRef,
        });
        res.json({order: updated});
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({error: err.message});
          return;
        }
        res.status(400).json({error: err instanceof Error ? err.message : 'Refund failed.'});
      }
    },
  );

  // -------------------------------------------------------------------------
  // Admin International Enquiries Management & CSV Export
  // -------------------------------------------------------------------------
  function filterEnquiriesFromQuery(req: Request) {
    const store = getStoreReadonly();
    const q = String(req.query.q || '').trim().toLowerCase();
    const status = String(req.query.status || 'all');
    const businessType = String(req.query.businessType || 'all');
    const country = String(req.query.country || 'all').toLowerCase();

    let list = Object.values(store.enquiries).sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    );
    if (q) {
      list = list.filter(
        (e) =>
          e.enquiryRef.toLowerCase().includes(q) ||
          e.companyName.toLowerCase().includes(q) ||
          e.contactName.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.destinationCountry.toLowerCase().includes(q),
      );
    }
    if (status !== 'all') {
      list = list.filter((e) => e.status === status);
    }
    if (businessType !== 'all') {
      list = list.filter((e) => e.businessType === businessType);
    }
    if (country !== 'all') {
      list = list.filter((e) => e.destinationCountry.toLowerCase() === country);
    }
    return list;
  }

  app.get(
    '/api/admin/enquiries',
    requireAdminAuth(['super_admin', 'order_manager', 'catalog_manager']),
    (req: Request, res: Response) => {
      const list = filterEnquiriesFromQuery(req);
      res.json({enquiries: list});
    },
  );

  app.get(
    '/api/admin/enquiries/export',
    requireAdminAuth(['super_admin', 'order_manager']),
    (req: RequestWithRawBody, res: Response) => {
      const list = filterEnquiriesFromQuery(req);
      const csv = buildInternationalEnquiriesCsv(list);
      void withStoreLock((store) => {
        recordAdminAuditLog(store, {
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          action: 'international_enquiries_exported',
          targetType: 'export',
          targetId: `${list.length}_records`,
          summary: `Exported ${list.length} international buyer enquiry record(s) to CSV.`,
        });
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="international-enquiries-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(csv);
    },
  );

  app.patch(
    '/api/admin/enquiries/:id',
    requireAdminAuth(['super_admin', 'order_manager']),
    async (req: RequestWithRawBody, res: Response) => {
      try {
        const body = req.body as {
          status?: InternationalEnquiryStatus;
          adminResponse?: string;
          quotation?: {
            currency?: CurrencyCode;
            quotedAmount?: number;
            shippingEstimateAmount?: number;
            minOrderQty?: string;
            shippingPolicy?: string;
            validityNote?: string;
          };
        };
        const updated = await adminRespondToInternationalEnquiry({
          id: String(req.params.id),
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          status: body.status || 'reviewed',
          adminResponse: body.adminResponse,
          quotation: body.quotation,
        });
        res.json({enquiry: updated});
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({error: err.message});
          return;
        }
        res.status(400).json({error: err instanceof Error ? err.message : 'Unable to update enquiry.'});
      }
    },
  );

  app.post(
    '/api/admin/export-sync',
    requireAdminAuth(['super_admin', 'catalog_manager']),
    async (req: RequestWithRawBody, res: Response) => {
      const {updates} = req.body as {
        updates?: {
          productId: string;
          exportable: boolean;
          moqUnits: number;
          exportPriceUsd: number;
          bulkPackSizes: string[];
        }[];
      };
      if (!Array.isArray(updates)) {
        res.status(400).json({error: 'updates array is required.'});
        return;
      }
      const exportOverrides = await adminUpdateExportOverrides(
        updates,
        req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
      );
      clearCatalogCache();
      res.json({ok: true, exportOverrides});
    },
  );

  app.get(
    '/api/admin/slips/:fileName',
    requireAdminAuth(['super_admin', 'order_manager']),
    (req: Request, res: Response) => {
      const resolved = resolveSafeSlipPath(String(req.params.fileName || ''));
      if (!resolved) {
        res.status(404).json({error: 'Payment slip not found.'});
        return;
      }
      res.sendFile(resolved);
    },
  );

  app.get(
    '/api/admin/settings',
    requireAdminAuth(['super_admin', 'catalog_manager', 'order_manager']),
    (_req: Request, res: Response) => {
      const store = getStoreReadonly();
      res.json({
        settings: store.settings,
        slGatewayConfigured: PAYMENT_ADAPTERS.sl_gateway.isConfiguredForLive(),
        intlGatewayConfigured: PAYMENT_ADAPTERS.intl_gateway.isConfiguredForLive(),
      });
    },
  );

  app.put(
    '/api/admin/settings',
    requireAdminAuth(['super_admin']),
    async (req: RequestWithRawBody, res: Response) => {
      try {
        const incoming = req.body as CommerceSettingsConfig;
        const saved = await withStoreLock((store) => {
          if (!incoming.payment.sandboxMode) {
            if (incoming.payment.slGatewayEnabled && !PAYMENT_ADAPTERS.sl_gateway.isConfiguredForLive()) {
              throw new CommerceHttpError(
                400,
                'Cannot activate live Sri Lankan gateway without server merchant credentials.',
              );
            }
            if (incoming.payment.intlGatewayEnabled && !PAYMENT_ADAPTERS.intl_gateway.isConfiguredForLive()) {
              throw new CommerceHttpError(
                400,
                'Cannot activate live international gateway without server credentials.',
              );
            }
          }

          const sanitizedCurrencies = (incoming.currencies?.length
            ? incoming.currencies
            : store.settings.currencies
          ).map((c) => {
            const code = String(c.code || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
            if (!code || code.length < 3) {
              throw new CommerceHttpError(400, 'Currency code must be a valid 3-letter ISO code.');
            }
            const rate = code === 'USD' ? 1 : Number(c.ratePerUsd);
            if (!Number.isFinite(rate) || rate <= 0) {
              throw new CommerceHttpError(
                400,
                `Administrator exchange rate for ${code} must be greater than 0.`,
              );
            }
            return {
              code,
              symbol: sanitizePlainText(c.symbol || code, 8) || code,
              name: sanitizePlainText(c.name || code, 50) || code,
              ratePerUsd: code === 'LKR' ? incoming.shipping?.usdToLkrRate || rate : rate,
              enabled: code === 'LKR' || code === 'USD' ? true : Boolean(c.enabled),
            };
          });

          const sanitizePhone = (raw?: string, fallback?: string) =>
            String(raw || fallback || '94770000000')
              .replace(/[^0-9]/g, '')
              .slice(0, 20);

          const fallbackWhatsapp = sanitizePhone(
            incoming.whatsappNumber,
            store.settings.whatsappNumber,
          );

          store.settings = {
            whatsappNumber: fallbackWhatsapp,
            brandWhatsappNumbers: {
              ceyvana: sanitizePhone(
                incoming.brandWhatsappNumbers?.ceyvana,
                store.settings.brandWhatsappNumbers?.ceyvana ?? fallbackWhatsapp,
              ),
              ceylomira: sanitizePhone(
                incoming.brandWhatsappNumbers?.ceylomira,
                store.settings.brandWhatsappNumbers?.ceylomira ?? fallbackWhatsapp,
              ),
              'hand-crafts': sanitizePhone(
                incoming.brandWhatsappNumbers?.['hand-crafts'],
                store.settings.brandWhatsappNumbers?.['hand-crafts'] ?? fallbackWhatsapp,
              ),
            },
            currencies: sanitizedCurrencies,
            exportConfig: incoming.exportConfig ?? store.settings.exportConfig,
            portfolioSettings: {
              requireRegistrationForPublicDownload: Boolean(
                incoming.portfolioSettings?.requireRegistrationForPublicDownload,
              ),
              allowCustomPublicCatalogSelection:
                incoming.portfolioSettings?.allowCustomPublicCatalogSelection !== false,
            },
            payment: {
              ...incoming.payment,
              whatsappOrderEnabled: incoming.payment?.whatsappOrderEnabled !== false,
            },
            shipping: incoming.shipping,
          };
          recordAdminAuditLog(store, {
            actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
            action: 'commerce_settings_updated',
            targetType: 'settings',
            targetId: 'global',
            summary: `Updated payment/shipping/currency config (sandboxMode=${String(incoming.payment.sandboxMode)}, cod=${String(incoming.payment.codEnabled)}).`,
          });
          return store.settings;
        });
        res.json({settings: saved});
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({error: err.message});
          return;
        }
        res.status(400).json({error: err instanceof Error ? err.message : 'Failed to save settings.'});
      }
    },
  );

  app.post(
    '/api/admin/stock-sync',
    requireAdminAuth(['super_admin', 'catalog_manager']),
    async (req: RequestWithRawBody, res: Response) => {
      const {updates} = req.body as {
        updates?: {variantSku: string; stockQuantity: number; available: boolean}[];
      };
      if (!Array.isArray(updates)) {
        res.status(400).json({error: 'updates array is required.'});
        return;
      }
      await withStoreLock((store) => {
        for (const u of updates) {
          if (u.variantSku) {
            store.stockOverrides[u.variantSku] = {
              stockQuantity: Math.max(0, Math.round(Number(u.stockQuantity) || 0)),
              available: Boolean(u.available),
            };
          }
        }
        recordAdminAuditLog(store, {
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          action: 'inventory_stock_synced',
          targetType: 'stock',
          targetId: `${updates.length}_skus`,
          summary: `Updated authoritative stock overrides for ${updates.length} SKU variant(s).`,
        });
      });
      clearCatalogCache();
      res.json({ok: true});
    },
  );

  app.post(
    '/api/admin/admins-sync',
    requireAdminAuth(['super_admin']),
    async (req: RequestWithRawBody, res: Response) => {
      const {emails, entries} = req.body as {
        emails?: string[];
        entries?: {email: string; role: AdminRole}[];
      };
      if (!Array.isArray(emails) && !Array.isArray(entries)) {
        res.status(400).json({error: 'emails or entries array required.'});
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      const roleMap: Record<string, AdminRole> = {
        [BOOTSTRAP_ADMIN_EMAIL.toLowerCase()]: 'super_admin',
      };
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          const email = String(entry?.email || '').trim().toLowerCase();
          const role = entry?.role;
          if (!emailRegex.test(email)) continue;
          roleMap[email] =
            email === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
              ? 'super_admin'
              : role === 'catalog_manager' || role === 'order_manager' || role === 'super_admin'
                ? role
                : 'order_manager';
        }
      } else if (Array.isArray(emails)) {
        for (const rawEmail of emails) {
          const email = String(rawEmail || '').trim().toLowerCase();
          if (!emailRegex.test(email)) continue;
          roleMap[email] =
            email === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ? 'super_admin' : 'super_admin';
        }
      }
      await withStoreLock((store) => {
        store.adminAllowlistEmails = Object.keys(roleMap);
        store.adminRolesByEmail = roleMap;
        recordAdminAuditLog(store, {
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          action: 'admin_allowlist_synced',
          targetType: 'admin_users',
          targetId: `${store.adminAllowlistEmails.length}_accounts`,
          summary: `Synchronized ${store.adminAllowlistEmails.length} verified admin access record(s).`,
        });
      });
      res.json({ok: true});
    },
  );

  app.post(
    '/api/admin/payments/simulate-webhook',
    requireAdminAuth(['super_admin']),
    async (req: RequestWithRawBody, res: Response) => {
      try {
        const body = req.body as {
          provider: 'sl_gateway' | 'intl_gateway';
          orderRef: string;
          outcome: 'paid' | 'failed';
          eventId?: string;
          transactionRef?: string;
        };
        const store = getStoreReadonly();
        if (!store.settings.payment.sandboxMode) {
          res.status(400).json({error: 'Sandbox simulator is only permitted in sandbox mode.'});
          return;
        }
        const order = Object.values(store.orders).find((o) => o.orderRef === body.orderRef);
        if (!order) {
          res.status(404).json({error: 'Order reference not found.'});
          return;
        }
        const adapter = PAYMENT_ADAPTERS[body.provider];
        if (!adapter?.createSandboxSignedWebhook) {
          res.status(400).json({error: 'Invalid gateway adapter.'});
          return;
        }
        const eventId = body.eventId || `evt-${Date.now()}`;
        const signed = adapter.createSandboxSignedWebhook({
          eventId,
          orderRef: order.orderRef,
          outcome: body.outcome,
          amount: order.totalAmount,
          currency: order.currency,
          transactionRef: body.transactionRef || `SBX-${Date.now()}`,
        });
        const result = await processVerifiedWebhook({
          provider: body.provider,
          rawBody: signed.payload,
          headers: signed.headers,
        });
        await withStoreLock((locked) => {
          recordAdminAuditLog(locked, {
            actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
            action: 'sandbox_webhook_simulated',
            targetType: 'payment',
            targetId: order.orderRef,
            summary: `Simulated ${body.provider} webhook (${body.outcome}) with event ${eventId}.`,
          });
        });
        res.status(result.duplicate ? 409 : 200).json({
          duplicate: result.duplicate,
          order: result.order,
          eventId,
        });
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({error: err.message});
          return;
        }
        res.status(400).json({error: err instanceof Error ? err.message : 'Simulation failed.'});
      }
    },
  );

  // -------------------------------------------------------------------------
  // Admin Portfolio Generator & Customer Catalogue Requests
  // -------------------------------------------------------------------------
  app.get(
    '/api/admin/portfolios',
    requireAdminAuth(['super_admin', 'catalog_manager', 'order_manager']),
    async (_req: Request, res: Response) => {
      try {
        const portfolios = await listAdminPortfolios();
        res.json({portfolios});
      } catch (err) {
        res.status(500).json({error: err instanceof Error ? err.message : 'Unable to load portfolios.'});
      }
    },
  );

  app.post(
    '/api/admin/portfolios/generate',
    requireAdminAuth(['super_admin', 'catalog_manager']),
    async (req: RequestWithRawBody, res: Response) => {
      try {
        const portfolio = await generateAdminPortfolio({
          input: req.body as GeneratePortfolioInput,
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          originUrl: resolveRequestOrigin(req),
        });
        res.status(201).json({portfolio});
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({error: err.message});
          return;
        }
        res.status(400).json({error: err instanceof Error ? err.message : 'Portfolio generation failed.'});
      }
    },
  );

  app.post(
    '/api/admin/portfolios/:id/status',
    requireAdminAuth(['super_admin', 'catalog_manager']),
    async (req: RequestWithRawBody, res: Response) => {
      try {
        const {status} = req.body as {status?: PortfolioStatus};
        const updated = await updateAdminPortfolioStatus({
          id: String(req.params.id),
          status: status || 'draft',
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
        });
        res.json({portfolio: updated});
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({error: err.message});
          return;
        }
        res.status(400).json({error: err instanceof Error ? err.message : 'Status update failed.'});
      }
    },
  );

  app.get(
    '/api/admin/portfolios/:id/pdf',
    requireAdminAuth(['super_admin', 'catalog_manager', 'order_manager']),
    (req: Request, res: Response) => {
      const store = getStoreReadonly();
      const pf = store.portfolios[String(req.params.id || '')];
      if (!pf) {
        res.status(404).json({error: 'Portfolio not found.'});
        return;
      }
      const resolved = resolveSafePortfolioPdfPath(pf.pdfFileName);
      if (!resolved) {
        res.status(404).json({error: 'Portfolio PDF file missing on disk.'});
        return;
      }
      const isPreview = req.query.preview === '1';
      const downloadName = `${pf.brandId}-portfolio-${pf.language}-${pf.version.replace(/[^a-z0-9._-]/gi, '')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `${isPreview ? 'inline' : 'attachment'}; filename="${downloadName}"`,
      );
      res.sendFile(resolved);
    },
  );

  app.get(
    '/api/admin/catalogue-requests',
    requireAdminAuth(['super_admin', 'catalog_manager', 'order_manager']),
    (_req: Request, res: Response) => {
      res.json({requests: listAdminCatalogueRequests()});
    },
  );

  app.patch(
    '/api/admin/catalogue-requests/:id',
    requireAdminAuth(['super_admin', 'catalog_manager', 'order_manager']),
    async (req: RequestWithRawBody, res: Response) => {
      try {
        const body = req.body as {
          status?: CatalogueRequestStatus;
          assignedPortfolioId?: string;
          adminNotes?: string;
        };
        const updated = await updateAdminCatalogueRequest({
          id: String(req.params.id),
          actorEmail: req.adminEmail || BOOTSTRAP_ADMIN_EMAIL,
          status: body.status || 'reviewed',
          assignedPortfolioId: body.assignedPortfolioId,
          adminNotes: body.adminNotes,
        });
        res.json({request: updated});
      } catch (err) {
        if (err instanceof CommerceHttpError) {
          res.status(err.status).json({error: err.message});
          return;
        }
        res.status(400).json({error: err instanceof Error ? err.message : 'Unable to update request.'});
      }
    },
  );

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({error: 'API endpoint not found.'});
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    const distDir = path.resolve(ROOT_DIR, 'dist');
    app.use(
      express.static(distDir, {
        index: false,
        setHeaders: (res, filePath) => {
          const normalized = filePath.replace(/\\/g, '/');
          if (normalized.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (normalized.includes('/assets/') || /\.(webp|woff2|js|css)$/i.test(normalized)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    app.get('*', (req, res) => {
      if (req.path.startsWith('/assets/') || req.path.startsWith('/src/assets/')) {
        res.status(404).end();
        return;
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Ceylon Heritage Commerce Server listening on port ${port}`);
  });
}

if (!process.env.COMMERCE_TEST_MODE && !process.env.FUNCTION_TARGET) {
  void startServer();
}

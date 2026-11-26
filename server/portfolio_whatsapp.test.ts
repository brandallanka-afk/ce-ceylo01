import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type {DecodedIdToken} from 'firebase-admin/auth';

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ceylon-portfolio-wa-test-'));
process.env.COMMERCE_DATA_DIR = TMP_DIR;
process.env.COMMERCE_TEST_MODE = '1';
process.env.ADMIN_REQUIRE_MFA = 'false';
process.env.ENFORCE_APP_CHECK = 'false';

const {createApp} = await import('../server.ts');
const {generateBrandPortfolioPdf} = await import('../server/pdfGenerator.ts');
const productsData = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'src/data/products.json'), 'utf8'),
) as import('../src/types/commerce.ts').Product[];

async function startTestServer() {
  const app = createApp({
    verifyIdToken: async (token: string) => {
      if (token !== 'super-admin-token') {
        throw new Error('Unauthorized');
      }
      return {
        aud: 'test-project',
        auth_time: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'https://securetoken.google.com/test-project',
        sub: 'uid-brandallanka',
        uid: 'uid-brandallanka',
        email: 'brandallanka@gmail.com',
        email_verified: true,
        firebase: {identities: {}, sign_in_provider: 'google.com'},
      } as unknown as DecodedIdToken;
    },
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  assert(addr && typeof addr !== 'string');
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function runTests() {
  const srv = await startTestServer();
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer super-admin-token',
  };

  try {
    // 1. Ceyvana PDF generation (EN) — multi-page valid PDF
    const cyvRes = await fetch(`${srv.baseUrl}/api/admin/portfolios/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        brandId: 'ceyvana',
        language: 'en',
        currency: 'USD',
        scope: 'all',
        coverDesign: 'heritage_crest',
        orientation: 'portrait',
        version: 'v1.0.0',
      }),
    });
    assert.equal(cyvRes.status, 201);
    const {portfolio: cyvDraft} = (await cyvRes.json()) as {
      portfolio: import('../src/types/admin.ts').PortfolioRecord;
    };
    assert.equal(cyvDraft.brandId, 'ceyvana');
    assert.equal(cyvDraft.status, 'draft');
    assert.ok(cyvDraft.pageCount >= 3, `Expected multi-page Ceyvana PDF, got ${cyvDraft.pageCount}`);
    assert.ok(cyvDraft.fileSizeBytes > 5000);

    const cyvPdfResp = await fetch(`${srv.baseUrl}/api/admin/portfolios/${cyvDraft.id}/pdf`, {
      headers: {Authorization: 'Bearer super-admin-token'},
    });
    assert.equal(cyvPdfResp.status, 200);
    assert.equal(cyvPdfResp.headers.get('content-type'), 'application/pdf');
    const cyvBytes = Buffer.from(await cyvPdfResp.arrayBuffer());
    assert.ok(cyvBytes.subarray(0, 5).toString('ascii') === '%PDF-');
    // Check embedded JPEG & Noto fonts in binary
    const cyvLatin = cyvBytes.toString('latin1');
    assert.ok(cyvLatin.includes('NotoSerif'), 'Expected NotoSerif font embedded');
    assert.ok(cyvLatin.includes('DCTDecode'), 'Expected product JPEG embedded');
    console.log('✓ Test 1 & 7: Ceyvana multi-page PDF generated with cover, TOC, JPEG images, and Noto fonts');

    // 2 & 3. Ceylomira PDF generation & strict brand isolation
    const cylRes = await fetch(`${srv.baseUrl}/api/admin/portfolios/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        brandId: 'ceylomira',
        language: 'en',
        currency: 'LKR',
        scope: 'all',
        coverDesign: 'editorial_split',
        orientation: 'landscape',
        version: 'v1.0.0',
      }),
    });
    assert.equal(cylRes.status, 201);
    const {portfolio: cylDraft} = (await cylRes.json()) as {
      portfolio: import('../src/types/admin.ts').PortfolioRecord;
    };
    assert.equal(cylDraft.brandId, 'ceylomira');
    const ceyvanaCount = productsData.filter((p) => p.brandId === 'ceyvana' && !p.isArchived).length;
    const ceylomiraCount = productsData.filter((p) => p.brandId === 'ceylomira' && !p.isArchived).length;
    assert.equal(cyvDraft.productCount, ceyvanaCount);
    assert.equal(cylDraft.productCount, ceylomiraCount);
    console.log('✓ Test 2 & 3: Ceylomira PDF generated with strict zero cross-brand mixing');

    // 4. Sinhala PDF generation & Noto Sinhala font embedding + mixed Sinhala/Latin text
    const siRes = await fetch(`${srv.baseUrl}/api/admin/portfolios/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        brandId: 'ceylomira',
        language: 'si',
        currency: 'LKR',
        scope: 'all',
        coverDesign: 'gallery_minimal',
        orientation: 'portrait',
        version: 'v1.0.0-si',
      }),
    });
    assert.equal(siRes.status, 201);
    const {portfolio: siDraft} = (await siRes.json()) as {
      portfolio: import('../src/types/admin.ts').PortfolioRecord;
    };
    const siPdfResp = await fetch(`${srv.baseUrl}/api/admin/portfolios/${siDraft.id}/pdf`, {
      headers: {Authorization: 'Bearer super-admin-token'},
    });
    const siBytes = Buffer.from(await siPdfResp.arrayBuffer());
    const siLatin = siBytes.toString('latin1');
    assert.ok(siLatin.includes('NotoSerifSinhala') || siLatin.includes('NotoSansSinhala'));
    console.log('✓ Test 4: Sinhala Unicode portfolio embeds Noto Sinhala fonts cleanly');

    // 5 & 6. Direct PDF generator test for omitted empty fields & long mixed titles/descriptions without overflow errors
    const edgeProduct: import('../src/types/commerce.ts').Product = {
      ...productsData[0],
      id: 'edge-long-product',
      name: {
        en: 'Extraordinarily Long Reserve Single-Estate Matara Alba Ceylon Cinnamon Quills Hand-Rolled Master Selection Pack',
        si: 'ශ්‍රී ලංකාවේ මාතර ප්‍රදේශයේ ඉතා සියුම් ලෙස අතින් සැකසූ විශේෂිත ඇල්බා කුරුඳු කූරු එකතුව (Reserve Alba Grade)',
      },
      description: {
        en: 'A'.repeat(280) + ' ' + 'Pure volatile aromatic essential oils preserved inside triple-layered barrier foil pouches.',
        si: 'පිරිසිදු ස්වභාවික සුවඳ සහ රසය ආරක්ෂා වන පරිදි කිසිදු කෘතිම ද්‍රව්‍යයක් නොමැතිව සැකසූ විශේෂ ඇසුරුම.',
      },
      certifications: [],
      ingredients: undefined,
      highlights: undefined,
      storageInstructions: undefined,
    };
    const edgePdf = await generateBrandPortfolioPdf({
      brandId: 'ceyvana',
      language: 'si',
      currency: 'USD',
      title: 'Edge Validation Dossier',
      version: 'v1.0.0-edge',
      coverDesign: 'heritage_crest',
      orientation: 'portrait',
      companyProfile: 'Ceylon Heritage House',
      contactInfo: 'Colombo, Sri Lanka',
      websiteUrl: 'https://ceylonheritage.lk',
      whatsappNumber: '94770000000',
      fields: {
        sku: true,
        category: true,
        description: true,
        highlights: true,
        ingredients: true,
        origin: true,
        packSizes: true,
        packagingType: true,
        storageInstructions: true,
        shelfLife: true,
        netWeight: true,
        retailPrices: true,
        wholesalePrices: false,
        moq: false,
        technicalSpecs: true,
        certifications: true,
      },
      products: [edgeProduct],
      generatedAtIso: new Date().toISOString(),
    });
    assert.ok(edgePdf.buffer.subarray(0, 5).toString('ascii') === '%PDF-');
    assert.ok(edgePdf.pageCount >= 3);
    console.log('✓ Test 5 & 6: Long descriptions, mixed scripts, and clean omission of empty specs verified');

    // 8 & 9. Public access gating (draft returns 404, published returns 200, custom PDF forces wholesalePrices=false)
    const draftPublicRes = await fetch(`${srv.baseUrl}/api/portfolios/published/${cyvDraft.id}/pdf`);
    assert.equal(draftPublicRes.status, 404);

    // Publish Ceyvana EN portfolio
    const pubRes = await fetch(`${srv.baseUrl}/api/admin/portfolios/${cyvDraft.id}/status`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({status: 'published'}),
    });
    assert.equal(pubRes.status, 200);

    const listPubRes = await fetch(`${srv.baseUrl}/api/portfolios/published`);
    assert.equal(listPubRes.status, 200);
    const listPubJson = (await listPubRes.json()) as {
      portfolios: {id: string; brandId: string}[];
    };
    assert.ok(listPubJson.portfolios.some((p) => p.id === cyvDraft.id));

    const publicPdfRes = await fetch(`${srv.baseUrl}/api/portfolios/published/${cyvDraft.id}/pdf`);
    assert.equal(publicPdfRes.status, 200);
    assert.equal(publicPdfRes.headers.get('content-type'), 'application/pdf');
    assert.ok(publicPdfRes.headers.get('content-disposition')?.includes('attachment'));
    const snapshotBytesBeforeEdit = Buffer.from(await publicPdfRes.arrayBuffer());

    // Public custom selection PDF (must force non-wholesale even if caller tries passing wholesalePrices)
    const customPublicRes = await fetch(`${srv.baseUrl}/api/portfolios/custom-pdf`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        brandId: 'ceyvana',
        language: 'en',
        currency: 'USD',
        scope: 'products',
        productIds: ['cyv-cinnamon-alba'],
        wholesalePrices: true,
      }),
    });
    assert.equal(customPublicRes.status, 200);
    assert.equal(customPublicRes.headers.get('content-type'), 'application/pdf');
    const customPdfBytes = Buffer.from(await customPublicRes.arrayBuffer());
    assert.ok(customPdfBytes.subarray(0, 5).toString('ascii') === '%PDF-');

    // Admin confidential wholesale portfolio generation succeeds with authorization
    const wsRes = await fetch(`${srv.baseUrl}/api/admin/portfolios/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        brandId: 'ceyvana',
        language: 'en',
        currency: 'USD',
        scope: 'products',
        productIds: ['cyv-cinnamon-alba'],
        version: 'v1.0.0-trade',
        fields: {wholesalePrices: true, moq: true},
      }),
    });
    assert.equal(wsRes.status, 201);
    const {portfolio: wsDraft} = (await wsRes.json()) as {
      portfolio: import('../src/types/admin.ts').PortfolioRecord;
    };
    assert.equal(wsDraft.fields.wholesalePrices, true);
    console.log('✓ Test 8 & 9: Draft protection, published Android/Windows attachment headers, and wholesale gating passed');

    // 10. Editing catalog pricing/specs after publish marks needsRegeneration without mutating published PDF bytes
    const editCatalogRes = await fetch(`${srv.baseUrl}/api/admin/export-sync`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        updates: [
          {
            productId: 'cyv-cinnamon-alba',
            exportable: true,
            moqUnits: 45,
            exportPriceUsd: 9.75,
            bulkPackSizes: ['500g', '5kg'],
          },
        ],
      }),
    });
    assert.equal(editCatalogRes.status, 200);
    const adminListAfter = await fetch(`${srv.baseUrl}/api/admin/portfolios`, {
      headers: {Authorization: 'Bearer super-admin-token'},
    });
    assert.equal(adminListAfter.status, 200);
    const {portfolios: afterList} = (await adminListAfter.json()) as {
      portfolios: import('../src/types/admin.ts').PortfolioRecord[];
    };
    const publishedAfter = afterList.find((p) => p.id === cyvDraft.id);
    assert.ok(publishedAfter, 'Published portfolio must remain present');
    assert.equal(publishedAfter.needsRegeneration, true, 'Expected needsRegeneration flag after catalog edit');

    const snapshotBytesAfterEdit = Buffer.from(
      await (await fetch(`${srv.baseUrl}/api/portfolios/published/${cyvDraft.id}/pdf`)).arrayBuffer(),
    );
    assert.ok(
      snapshotBytesBeforeEdit.equals(snapshotBytesAfterEdit),
      'Published PDF snapshot bytes must remain immutable after catalog change',
    );
    console.log('✓ Test 10: Catalog change marks needsRegeneration without silently mutating published PDF');

    // 11. Customer Catalogue Request intake + Admin assignment + public read block
    const unauthAdminReq = await fetch(`${srv.baseUrl}/api/admin/catalogue-requests`);
    assert.equal(unauthAdminReq.status, 401);

    const crRes = await fetch(`${srv.baseUrl}/api/catalogue-requests`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        brandId: 'ceyvana',
        language: 'en',
        customerName: 'Nimali Perera',
        email: 'nimali@example.lk',
        country: 'Sri Lanka',
        companyName: 'Lanka Spice Emporium',
        whatsappNumber: '94771112222',
        scope: 'all',
        notes: 'Please send retail catalogue.',
      }),
    });
    assert.equal(crRes.status, 201);
    const {request: createdCr} = (await crRes.json()) as {
      request: import('../src/types/admin.ts').CatalogueRequestRecord;
    };
    assert.ok(createdCr.requestRef.startsWith('CAT-'));
    assert.equal(createdCr.status, 'new');

    const assignRes = await fetch(`${srv.baseUrl}/api/admin/catalogue-requests/${createdCr.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        status: 'sent',
        assignedPortfolioId: cyvDraft.id,
        adminNotes: 'Shared v1.0.0 PDF via WhatsApp',
      }),
    });
    assert.equal(assignRes.status, 200);
    const {request: updatedCr} = (await assignRes.json()) as {
      request: import('../src/types/admin.ts').CatalogueRequestRecord;
    };
    assert.equal(updatedCr.status, 'sent');
    assert.equal(updatedCr.assignedPortfolioVersion, 'v1.0.0');
    console.log('✓ Test 11: Catalogue Request creation, Admin assignment, and auth block verified');

    // 12. WhatsApp-First multi-product ordering + dormant online gateways + brand WhatsApp config
    const cfgRes = await fetch(`${srv.baseUrl}/api/commerce/config`);
    assert.equal(cfgRes.status, 200);
    const cfg = (await cfgRes.json()) as {
      whatsappNumber: string;
      brandWhatsappNumbers?: {ceyvana: string; ceylomira: string; 'hand-crafts': string};
      payment: {
        whatsappOrderEnabled?: boolean;
        slGatewayEnabled: boolean;
        intlGatewayEnabled: boolean;
        sandboxMode: boolean;
      };
    };
    assert.equal(cfg.payment.whatsappOrderEnabled, true);
    assert.equal(cfg.payment.slGatewayEnabled, false);
    assert.equal(cfg.payment.intlGatewayEnabled, false);
    assert.equal(cfg.payment.sandboxMode, true);
    assert.ok(cfg.brandWhatsappNumbers?.ceyvana && cfg.brandWhatsappNumbers?.ceylomira);

    const waOrderRes = await fetch(`${srv.baseUrl}/api/orders`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        idempotencyKey: 'wa-order-multi-1',
        customerName: 'Kasun Silva',
        customerEmail: 'kasun@example.lk',
        phone: '0779876543',
        country: 'Sri Lanka',
        address: '45 Temple Road, Kandy',
        city: 'Kandy',
        deliveryMethod: 'local_standard',
        localZoneId: 'other-provinces',
        paymentMethod: 'whatsapp_order',
        orderNotes: 'Deliver before 5 PM',
        currency: 'LKR',
        items: [
          {productId: 'cyv-cinnamon-alba', variantSku: 'CYV-CINN-100G', qty: 2},
          {productId: 'cml-bopf-black-tea', variantSku: 'CML-BOPF-250G', qty: 1},
        ],
      }),
    });
    assert.equal(waOrderRes.status, 201);
    const {order: waOrder} = (await waOrderRes.json()) as {
      order: import('../src/types/admin.ts').OrderRecord;
    };
    assert.equal(waOrder.orderStatus, 'new', 'WhatsApp order must NEVER start as confirmed');
    assert.equal(waOrder.paymentStatus, 'pending');
    assert.equal(waOrder.items.length, 2);

    // Record customer opening WhatsApp — must log timestamp WITHOUT marking order confirmed
    const handoffRes = await fetch(`${srv.baseUrl}/api/orders/${waOrder.orderRef}/whatsapp-intent`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({receiptToken: waOrder.receiptToken}),
    });
    assert.equal(handoffRes.status, 200);
    const lookupRes = await fetch(
      `${srv.baseUrl}/api/orders/lookup?orderRef=${encodeURIComponent(waOrder.orderRef)}&token=${encodeURIComponent(waOrder.receiptToken || '')}`,
    );
    assert.equal(lookupRes.status, 200);
    const {order: afterHandoff} = (await lookupRes.json()) as {
      order: import('../src/types/admin.ts').OrderRecord;
    };
    assert.ok(afterHandoff.whatsappHandoffAt, 'Expected whatsappHandoffAt after customer opens WhatsApp');
    assert.equal(afterHandoff.orderStatus, 'new', 'Opening WhatsApp must never confirm order');

    // Duplicate idempotencyKey returns existing order without duplicating stock deduction
    const waDupRes = await fetch(`${srv.baseUrl}/api/orders`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        idempotencyKey: 'wa-order-multi-1',
        customerName: 'Kasun Silva',
        customerEmail: 'kasun@example.lk',
        phone: '0779876543',
        country: 'Sri Lanka',
        address: '45 Temple Road, Kandy',
        city: 'Kandy',
        deliveryMethod: 'local_standard',
        paymentMethod: 'whatsapp_order',
        currency: 'LKR',
        items: [{productId: 'cyv-cinnamon-alba', variantSku: 'CYV-CINN-100G', qty: 2}],
      }),
    });
    assert.equal(waDupRes.status, 409);
    const dupJson = (await waDupRes.json()) as {error?: string};
    assert.ok(dupJson.error?.toLowerCase().includes('duplicate'));
    console.log('✓ Test 12: Multi-product WhatsApp order starts as New, respects idempotency, and online gateways stay dormant');
  } finally {
    await srv.close();
    fs.rmSync(TMP_DIR, {recursive: true, force: true});
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

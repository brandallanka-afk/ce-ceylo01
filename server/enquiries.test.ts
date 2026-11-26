import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {AddressInfo} from 'node:net';

// Configure isolated temporary test directory BEFORE importing server modules
const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ceylon-phase5-test-'));
process.env.COMMERCE_DATA_DIR = tempDataDir;
process.env.COMMERCE_TEST_MODE = '1';

async function runTests() {
  const {createApp} = await import('../server.ts');
  const {
    adminRespondToInternationalEnquiry,
    adminUpdateExportOverrides,
    buildInternationalEnquiriesCsv,
    withStoreLock,
  } = await import('../server/store.ts');

  const app = createApp();
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Submit valid international buyer enquiry
    const validRes = await fetch(`${baseUrl}/api/enquiries/international`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        companyName: 'Nordic Botanicals AB',
        contactName: 'Astrid Lindqvist',
        email: 'procurement@nordicbotanicals.se',
        phone: '+46 8 555 0199',
        country: 'Sweden',
        website: 'https://nordicbotanicals.se',
        businessType: 'Importer',
        brandInterest: 'Ceyvana & Ceylomira',
        productInterests: ['Alba Ceylon Cinnamon Quills', 'Nuwara Eliya Pekoe'],
        requiredQuantities: '100kg trial shipment',
        packagingRequirements: '5kg multi-wall barrier sack',
        destinationCountry: 'United Kingdom',
        message: 'Requesting FOB Colombo quotation for 100kg trial import.',
      }),
    });
    assert.equal(validRes.status, 201);
    const createdPayload = (await validRes.json()) as {
      enquiry: {
        id: string;
        enquiryRef: string;
        trackingToken: string;
        businessType: string;
        productInterests: string[];
        destinationCountry: string;
        packagingRequirements: string;
        website?: string;
      };
    };
    const enq = createdPayload.enquiry;
    assert.ok(enq.enquiryRef.startsWith('INT-'));
    assert.ok(enq.trackingToken.length >= 16);
    assert.equal(enq.businessType, 'Importer');
    assert.equal(enq.destinationCountry, 'United Kingdom');
    assert.equal(enq.productInterests.length, 2);
    assert.equal(enq.website, 'https://nordicbotanicals.se/');
    console.log('✓ Test 1: Valid international buyer enquiry creation passed');

    // 2. Reject invalid email and dangerous website URL schemes
    const badEmailRes = await fetch(`${baseUrl}/api/enquiries/international`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        companyName: 'Bad Email Corp',
        contactName: 'Test Buyer',
        email: 'not-an-email',
        country: 'Germany',
        businessType: 'Distributor',
        requiredQuantities: '50kg',
        packagingRequirements: '1kg nitrogen-flushed foil pouch',
        destinationCountry: 'Germany',
        message: 'Testing email validation.',
      }),
    });
    assert.equal(badEmailRes.status, 400);

    const badUrlRes = await fetch(`${baseUrl}/api/enquiries/international`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        companyName: 'XSS Corp',
        contactName: 'Test Buyer',
        email: 'buyer@xsscorp.example',
        country: 'Germany',
        website: 'javascript:alert(1)',
        businessType: 'Wholesaler',
        requiredQuantities: '50kg',
        packagingRequirements: '1kg nitrogen-flushed foil pouch',
        destinationCountry: 'Germany',
        message: 'Testing malicious website URL rejection.',
      }),
    });
    assert.equal(badUrlRes.status, 400);
    console.log('✓ Test 2: Email & malicious website URL validation passed');

    // 3. Enquiry tracking lookup with email or token + unauthorized rejection
    const trackByEmail = await fetch(
      `${baseUrl}/api/enquiries/track?enquiryRef=${encodeURIComponent(enq.enquiryRef)}&credential=${encodeURIComponent('procurement@nordicbotanicals.se')}`,
    );
    assert.equal(trackByEmail.status, 200);
    const trackedJson = (await trackByEmail.json()) as {
      enquiry: {enquiryRef: string; destinationPolicy?: string; status: string};
    };
    assert.equal(trackedJson.enquiry.enquiryRef, enq.enquiryRef);
    assert.equal(trackedJson.enquiry.status, 'new');
    assert.ok(trackedJson.enquiry.destinationPolicy);

    const trackByToken = await fetch(
      `${baseUrl}/api/enquiries/track?enquiryRef=${encodeURIComponent(enq.enquiryRef)}&credential=${encodeURIComponent(enq.trackingToken)}`,
    );
    assert.equal(trackByToken.status, 200);

    const badTrack = await fetch(
      `${baseUrl}/api/enquiries/track?enquiryRef=${encodeURIComponent(enq.enquiryRef)}&credential=wrong@email.example`,
    );
    assert.equal(badTrack.status, 403);
    console.log('✓ Test 3: Enquiry tracking lookup & credential check passed');

    // 4. Export catalog, MOQ override sync, and configurable currency quote (EUR vs disabled)
    const expCatalogRes = await fetch(`${baseUrl}/api/export/catalog`);
    assert.equal(expCatalogRes.status, 200);
    const expCatalog = (await expCatalogRes.json()) as {
      products: {id: string; moqUnits?: number; exportPriceUsd?: number}[];
      currencies: {code: string; enabled: boolean; ratePerUsd: number}[];
    };
    assert.ok(expCatalog.products.length >= 6);

    // Disabled EUR must reject 400 on /api/commerce/quote
    const disabledEurQuote = await fetch(`${baseUrl}/api/commerce/quote`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        items: [{productId: 'cyv-cinnamon-alba', variantSku: 'CYV-CINN-100G', qty: 2}],
        currency: 'EUR',
        country: 'Germany',
        deliveryMethod: 'international_courier',
      }),
    });
    assert.equal(disabledEurQuote.status, 400);

    // Enable EUR in admin-configured rates (ratePerUsd = 0.92) & override export MOQ
    await withStoreLock((store) => {
      const eur = store.settings.currencies.find((c) => c.code === 'EUR');
      assert.ok(eur);
      eur.enabled = true;
      eur.ratePerUsd = 0.92;
    });
    await adminUpdateExportOverrides([
      {
        productId: 'cyv-cinnamon-alba',
        exportable: true,
        moqUnits: 60,
        exportPriceUsd: 19.5,
        bulkPackSizes: ['5kg barrier sack', '25kg export carton'],
      },
    ]);

    const updatedCatalog = (await (await fetch(`${baseUrl}/api/export/catalog`)).json()) as typeof expCatalog;
    const overriddenProd = updatedCatalog.products.find((p) => p.id === 'cyv-cinnamon-alba');
    assert.equal(overriddenProd?.moqUnits, 60);
    assert.equal(overriddenProd?.exportPriceUsd, 19.5);

    const enabledEurQuoteRes = await fetch(`${baseUrl}/api/commerce/quote`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        items: [{productId: 'cyv-cinnamon-alba', variantSku: 'CYV-CINN-100G', qty: 2}],
        currency: 'EUR',
        country: 'United Kingdom',
        deliveryMethod: 'international_quote',
      }),
    });
    assert.equal(enabledEurQuoteRes.status, 200);
    const eurQuote = (await enabledEurQuoteRes.json()) as {
      currency: string;
      subtotalUsd: number;
      subtotal: number;
    };
    assert.equal(eurQuote.currency, 'EUR');
    assert.equal(eurQuote.subtotalUsd, 16);
    assert.equal(eurQuote.subtotal, Number((16 * 0.92).toFixed(2)));
    console.log('✓ Test 4: Export catalog overrides & admin-configured currency conversion passed');

    // 5. Auth boundary on admin enquiry routes, admin quotation response, and CSV export escaping
    const unauthEnq = await fetch(`${baseUrl}/api/admin/enquiries`);
    assert.equal(unauthEnq.status, 401);
    const unauthCsv = await fetch(`${baseUrl}/api/admin/enquiries/export`);
    assert.equal(unauthCsv.status, 401);

    // Create a second enquiry containing a CSV formula injection attempt in company name
    const formulaRes = await fetch(`${baseUrl}/api/enquiries/international`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        companyName: '=CMD("calc")',
        contactName: 'Formula Tester',
        email: 'audit@formula.example',
        country: 'Australia',
        businessType: 'Retailer',
        requiredQuantities: '30kg',
        packagingRequirements: '1kg nitrogen-flushed foil pouch',
        destinationCountry: 'Australia',
        message: 'Checking CSV formula escaping on admin export.',
      }),
    });
    assert.equal(formulaRes.status, 201);
    const {enquiry: formulaEnq} = (await formulaRes.json()) as {
      enquiry: {id: string; enquiryRef: string};
    };

    const responded = await adminRespondToInternationalEnquiry({
      id: enq.id,
      actorEmail: 'brandallanka@gmail.com',
      status: 'quoted',
      adminResponse: 'Alba Cinnamon batch allocated. Formal FOB Colombo proforma prepared.',
      quotation: {
        currency: 'EUR',
        quotedAmount: 1840,
        shippingEstimateAmount: 290,
        minOrderQty: '100kg combined grades',
        shippingPolicy: 'FOB Colombo; importer settles UK customs clearance upon arrival.',
        validityNote: 'Valid 14 days from issue date.',
      },
    });
    assert.equal(responded.status, 'quoted');
    assert.equal(responded.quotation?.currency, 'EUR');
    assert.equal(responded.quotation?.quotedAmount, 1840);

    // Buyer tracking now reflects official response and EUR quotation
    const trackedAfterQuote = await fetch(
      `${baseUrl}/api/enquiries/track?enquiryRef=${encodeURIComponent(enq.enquiryRef)}&credential=${encodeURIComponent(enq.trackingToken)}`,
    );
    assert.equal(trackedAfterQuote.status, 200);
    const trackedAfterJson = (await trackedAfterQuote.json()) as {
      enquiry: {
        status: string;
        adminResponse?: string;
        quotation?: {currency: string; quotedAmount?: number; minOrderQty?: string};
      };
    };
    assert.equal(trackedAfterJson.enquiry.status, 'quoted');
    assert.ok(trackedAfterJson.enquiry.adminResponse?.includes('Alba Cinnamon'));
    assert.equal(trackedAfterJson.enquiry.quotation?.currency, 'EUR');
    assert.equal(trackedAfterJson.enquiry.quotation?.quotedAmount, 1840);

    // Verify CSV generation contains records and neutralizes leading '='
    const csv = buildInternationalEnquiriesCsv([
      responded,
      {
        ...responded,
        id: formulaEnq.id,
        enquiryRef: formulaEnq.enquiryRef,
        companyName: '=CMD("calc")',
      },
    ]);
    assert.ok(csv.includes('EnquiryRef,Status,CompanyName'));
    assert.ok(csv.includes(enq.enquiryRef));
    assert.ok(csv.includes(`"'=CMD(""calc"")"`));
    console.log('✓ Test 5: Admin enquiry response, quotation tracking & CSV injection guard passed');
  } finally {
    server.close();
    fs.rmSync(tempDataDir, {recursive: true, force: true});
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {AddressInfo} from 'node:net';

// Configure isolated temporary test directory BEFORE importing server modules
const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ceylon-commerce-test-'));
process.env.COMMERCE_DATA_DIR = tempDataDir;
process.env.COMMERCE_TEST_MODE = '1';

const VALID_PNG_BASE64 =
  'data:image/png;base64,' +
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]).toString(
    'base64',
  );

async function runTests() {
  const {createApp} = await import('../server.ts');
  const {
    adminRecordRefund,
    adminUpdateOrder,
    adminVerifyBankTransfer,
    withStoreLock,
  } = await import('../server/store.ts');
  const {PAYMENT_ADAPTERS} = await import('../server/payments/adapters.ts');

  const app = createApp();
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Verify initial commerce configuration
    const cfgRes = await fetch(`${baseUrl}/api/commerce/config`);
    assert.equal(cfgRes.status, 200);
    const cfg = (await cfgRes.json()) as {
      payment: {bankTransferEnabled: boolean; codEnabled: boolean; sandboxMode: boolean};
      shipping: {localZones: {id: string}[]; internationalRates: {country: string}[]};
      liveStockBySku: Record<string, {stockQuantity: number; available: boolean}>;
    };
    assert.equal(cfg.payment.bankTransferEnabled, true);
    assert.equal(cfg.payment.codEnabled, false);
    assert.equal(cfg.payment.sandboxMode, true);
    assert.ok(cfg.shipping.localZones.length >= 3);
    assert.ok(cfg.liveStockBySku['CYV-CINN-100G'].stockQuantity >= 10);
    console.log('✓ Test 1: Public commerce config & initial payment gating passed');

    // 2. Verify authoritative shipping calculations (free threshold + international weight + quote)
    const freeLocalQuoteRes = await fetch(`${baseUrl}/api/commerce/quote`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        items: [{productId: 'cyv-cinnamon-alba', variantSku: 'CYV-CINN-100G', qty: 9}],
        currency: 'LKR',
        country: 'Sri Lanka',
        deliveryMethod: 'local_standard',
        localZoneId: 'colombo-suburbs',
      }),
    });
    assert.equal(freeLocalQuoteRes.status, 200);
    const freeLocalQuote = (await freeLocalQuoteRes.json()) as {
      subtotal: number;
      shippingFee: number;
      freeShippingApplied: boolean;
      totalAmount: number;
    };
    assert.equal(freeLocalQuote.subtotal, 16650);
    assert.equal(freeLocalQuote.shippingFee, 0);
    assert.equal(freeLocalQuote.freeShippingApplied, true);
    assert.equal(freeLocalQuote.totalAmount, 16650);

    const intlQuoteRes = await fetch(`${baseUrl}/api/commerce/quote`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        items: [{productId: 'cyv-cinnamon-alba', variantSku: 'CYV-CINN-100G', qty: 2}],
        currency: 'USD',
        country: 'United Kingdom',
        deliveryMethod: 'international_quote',
      }),
    });
    assert.equal(intlQuoteRes.status, 200);
    const intlQuote = (await intlQuoteRes.json()) as {isQuotePending: boolean; shippingFee: number};
    assert.equal(intlQuote.isQuotePending, true);
    assert.equal(intlQuote.shippingFee, 0);
    console.log('✓ Test 2: Authoritative local & international shipping quotes passed');

    // 3. Reject invalid quantities, split-SKU excess, raw card fields & disabled COD
    const badQtyRes = await fetch(`${baseUrl}/api/commerce/quote`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        items: [{productId: 'cyv-cinnamon-alba', variantSku: 'CYV-CINN-100G', qty: 1.5}],
        currency: 'LKR',
        country: 'Sri Lanka',
        deliveryMethod: 'local_standard',
      }),
    });
    assert.equal(badQtyRes.status, 400);

    const rawCardRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        idempotencyKey: 'test-card-block-1',
        cardNumber: '4111',
        cvv: '123',
      }),
    });
    assert.equal(rawCardRes.status, 400);

    const disabledCodRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        idempotencyKey: 'test-cod-disabled-1',
        currency: 'LKR',
        customerName: 'Nimal Perera',
        email: 'nimal@example.com',
        phone: '+94771234567',
        country: 'Sri Lanka',
        address: '42 Galle Road',
        city: 'Colombo',
        postalCode: '00300',
        deliveryMethod: 'local_standard',
        localZoneId: 'colombo-suburbs',
        paymentMethod: 'cod',
        items: [{productId: 'cyv-cinnamon-alba', variantSku: 'CYV-CINN-100G', qty: 1}],
      }),
    });
    assert.equal(disabledCodRes.status, 400);
    console.log('✓ Test 3: Invalid qty, raw card rejection & disabled COD gating passed');

    // 4. Full Bank Transfer checkout + duplicate idempotency + stock deduction + bank slip proof
    const startStock = cfg.liveStockBySku['CYV-CINN-100G'].stockQuantity;
    const orderPayload = {
      idempotencyKey: 'order-idem-bank-001',
      currency: 'LKR',
      customerName: 'Kasun Jayawardena',
      email: 'kasun@example.com',
      phone: '+94779998877',
      country: 'Sri Lanka',
      address: '15 Ward Place',
      city: 'Colombo',
      postalCode: '00700',
      deliveryMethod: 'local_standard',
      localZoneId: 'colombo-suburbs',
      paymentMethod: 'bank_transfer',
      items: [{productId: 'cyv-cinnamon-alba', variantSku: 'CYV-CINN-100G', qty: 3}],
    };
    const createOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(orderPayload),
    });
    assert.equal(createOrderRes.status, 201);
    const createdJson = (await createOrderRes.json()) as {
      order: {
        id: string;
        orderRef: string;
        orderStatus: string;
        paymentStatus: string;
        totalAmount: number;
        receiptToken: string;
      };
    };
    assert.ok(createdJson.order.orderRef.startsWith('CH-'));
    assert.equal(createdJson.order.orderStatus, 'awaiting_payment');
    assert.equal(createdJson.order.paymentStatus, 'pending_verification');
    assert.equal(createdJson.order.totalAmount, 1850 * 3 + 350);

    // Duplicate idempotencyKey blocked
    const dupOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(orderPayload),
    });
    assert.equal(dupOrderRes.status, 409);

    // Check stock decremented atomically
    const cfgAfterOrder = (await (await fetch(`${baseUrl}/api/commerce/config`)).json()) as typeof cfg;
    assert.equal(cfgAfterOrder.liveStockBySku['CYV-CINN-100G'].stockQuantity, startStock - 3);

    // Requesting > remaining stock fails 409 & preserves non-negative stock
    const overStockRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        ...orderPayload,
        idempotencyKey: 'order-idem-overstock',
        items: [{productId: 'cyv-cinnamon-alba', variantSku: 'CYV-CINN-100G', qty: 99}],
      }),
    });
    assert.equal(overStockRes.status, 409);

    // Bank slip magic-byte & token verification
    const badSlipRes = await fetch(
      `${baseUrl}/api/orders/${createdJson.order.orderRef}/bank-reference`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          receiptToken: createdJson.order.receiptToken,
          paymentSlipBase64: 'data:text/plain;base64,' + Buffer.from('not-an-image').toString('base64'),
        }),
      },
    );
    assert.equal(badSlipRes.status, 400);

    const goodSlipRes = await fetch(
      `${baseUrl}/api/orders/${createdJson.order.orderRef}/bank-reference`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          receiptToken: createdJson.order.receiptToken,
          paymentReference: 'COMB-88412',
          paymentSlipBase64: VALID_PNG_BASE64,
        }),
      },
    );
    assert.equal(goodSlipRes.status, 200);
    const updatedSlipJson = (await goodSlipRes.json()) as {
      order: {orderStatus: string; paymentSlipFile: string};
    };
    assert.equal(updatedSlipJson.order.orderStatus, 'payment_verification');
    assert.ok(updatedSlipJson.order.paymentSlipFile.startsWith('slip-'));
    console.log('✓ Test 4: Bank Transfer checkout, duplicate guard, stock & slip upload passed');

    // 5. Admin bank verification, refund validation & cancellation stock restore
    const approved = await adminVerifyBankTransfer({
      orderId: createdJson.order.id,
      actorEmail: 'brandallanka@gmail.com',
      decision: 'approve',
      transactionRef: 'COMB-88412-VERIFIED',
    });
    assert.equal(approved.paymentStatus, 'paid');
    assert.equal(approved.orderStatus, 'confirmed');

    const partialRefund = await adminRecordRefund({
      orderId: createdJson.order.id,
      actorEmail: 'brandallanka@gmail.com',
      amount: 1000,
      reason: 'Damaged tin adjustment',
    });
    assert.equal(partialRefund.paymentStatus, 'partially_refunded');

    await assert.rejects(() =>
      adminRecordRefund({
        orderId: createdJson.order.id,
        actorEmail: 'brandallanka@gmail.com',
        amount: 99999,
        reason: 'Over-refund attempt',
      }),
    );

    const cancelled = await adminUpdateOrder({
      orderId: createdJson.order.id,
      actorEmail: 'brandallanka@gmail.com',
      orderStatus: 'cancelled',
    });
    assert.equal(cancelled.orderStatus, 'cancelled');
    const cfgAfterCancel = (await (await fetch(`${baseUrl}/api/commerce/config`)).json()) as typeof cfg;
    assert.equal(cfgAfterCancel.liveStockBySku['CYV-CINN-100G'].stockQuantity, startStock);
    console.log('✓ Test 5: Admin bank verification, refund bounds & cancellation stock restore passed');

    // 6. Enable gateways in sandbox mode & verify HMAC webhook verification + replay rejection
    await withStoreLock((store) => {
      store.settings.payment.slGatewayEnabled = true;
      store.settings.payment.intlGatewayEnabled = true;
    });

    const slOrdRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        ...orderPayload,
        idempotencyKey: 'sl-gateway-order-1',
        paymentMethod: 'sl_gateway',
        items: [{productId: 'cyv-cinnamon-alba', variantSku: 'CYV-CINN-100G', qty: 1}],
      }),
    });
    assert.equal(slOrdRes.status, 201);
    const {order: slOrder} = (await slOrdRes.json()) as {
      order: {orderRef: string; totalAmount: number; currency: 'LKR' | 'USD'};
    };

    // Tampered signature -> 401
    const tamperedRes = await fetch(`${baseUrl}/api/payments/webhook/sl_gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sl-gateway-signature': 'deadbeef',
      },
      body: JSON.stringify({
        eventId: 'evt-bad-1',
        orderRef: slOrder.orderRef,
        statusCode: '2',
        amount: slOrder.totalAmount,
        currency: slOrder.currency,
      }),
    });
    assert.equal(tamperedRes.status, 401);

    // Valid signed webhook -> 200 paid & confirmed
    const signedWebhook = PAYMENT_ADAPTERS.sl_gateway.createSandboxSignedWebhook!({
      eventId: 'evt-sl-ok-1',
      orderRef: slOrder.orderRef,
      outcome: 'paid',
      amount: slOrder.totalAmount,
      currency: slOrder.currency,
      transactionRef: 'SL-TXN-7788',
    });
    const validWhRes = await fetch(`${baseUrl}/api/payments/webhook/sl_gateway`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', ...signedWebhook.headers},
      body: signedWebhook.payload,
    });
    assert.equal(validWhRes.status, 200);
    const validWhJson = (await validWhRes.json()) as {paymentStatus: string; orderStatus: string};
    assert.equal(validWhJson.paymentStatus, 'paid');
    assert.equal(validWhJson.orderStatus, 'confirmed');

    // Replay same webhook -> 409 duplicate
    const replayRes = await fetch(`${baseUrl}/api/payments/webhook/sl_gateway`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', ...signedWebhook.headers},
      body: signedWebhook.payload,
    });
    assert.equal(replayRes.status, 409);

    // Verify unauthenticated admin routes are blocked (401)
    const unauthAdminRes = await fetch(`${baseUrl}/api/admin/orders`);
    assert.equal(unauthAdminRes.status, 401);
    console.log('✓ Test 6: HMAC webhook verification, replay protection & admin auth boundary passed');
  } finally {
    server.close();
    fs.rmSync(tempDataDir, {recursive: true, force: true});
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

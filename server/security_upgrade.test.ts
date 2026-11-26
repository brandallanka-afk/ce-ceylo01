import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import type {DecodedIdToken} from 'firebase-admin/auth';

const TMP_DIR = fs.mkdtempSync('/tmp/ceylon-security-upgrade-test-');
process.env.COMMERCE_DATA_DIR = TMP_DIR;
process.env.COMMERCE_TEST_MODE = '1';
process.env.ADMIN_REQUIRE_MFA = 'false';
process.env.ENFORCE_APP_CHECK = 'false';

const {createApp} = await import('../server.ts');

const TOKEN_TO_IDENTITY: Record<
  string,
  {email: string; email_verified: boolean; secondFactor?: string}
> = {
  'token-super-1fa': {
    email: 'brandallanka@gmail.com',
    email_verified: true,
  },
  'token-super-2fa': {
    email: 'brandallanka@gmail.com',
    email_verified: true,
    secondFactor: 'totp',
  },
  'token-order-1fa': {
    email: 'orders.mgr@ceyvana.test',
    email_verified: true,
  },
  'token-catalog-1fa': {
    email: 'catalog.mgr@ceyvana.test',
    email_verified: true,
  },
  'token-unverified': {
    email: 'brandallanka@gmail.com',
    email_verified: false,
  },
};

async function startSecurityTestServer() {
  const app = createApp({
    verifyIdToken: async (token: string) => {
      const identity = TOKEN_TO_IDENTITY[token];
      if (!identity) {
        throw new Error('Invalid test token');
      }
      return {
        aud: 'test-project',
        auth_time: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'https://securetoken.google.com/test-project',
        sub: `uid-${identity.email}`,
        uid: `uid-${identity.email}`,
        email: identity.email,
        email_verified: identity.email_verified,
        firebase: {
          identities: {},
          sign_in_provider: 'google.com',
          ...(identity.secondFactor ? {sign_in_second_factor: identity.secondFactor} : {}),
        },
      } as unknown as DecodedIdToken;
    },
    verifyAppCheckToken: async (token: string) => {
      if (token !== 'valid-appcheck-token') {
        throw new Error('Invalid test App Check token');
      }
      return {appId: '1:test:web:appcheck'};
    },
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  assert(addr && typeof addr !== 'string');
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function runTests() {
  const srv = await startSecurityTestServer();
  try {
    // 1. CSP Headers: strict API CSP vs iframe-safe HTML CSP
    const healthResp = await fetch(`${srv.baseUrl}/api/health`);
    assert.equal(healthResp.status, 200);
    assert.equal(
      healthResp.headers.get('content-security-policy'),
      "default-src 'none'; frame-ancestors 'none'",
    );

    const docResp = await fetch(`${srv.baseUrl}/robots.txt`);
    assert.equal(docResp.status, 200);
    const docCsp = docResp.headers.get('content-security-policy') || '';
    assert.ok(docCsp.includes("object-src 'none'"));
    assert.ok(!docCsp.includes("frame-ancestors 'none'"));
    console.log('✓ Test 1: API & document Content-Security-Policy headers verified');

    // 2. Sync RBAC admin roles as super_admin
    const unverifiedResp = await fetch(`${srv.baseUrl}/api/admin/session`, {
      headers: {Authorization: 'Bearer token-unverified'},
    });
    assert.equal(unverifiedResp.status, 403);

    const syncResp = await fetch(`${srv.baseUrl}/api/admin/admins-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-super-1fa',
      },
      body: JSON.stringify({
        entries: [
          {email: 'brandallanka@gmail.com', role: 'super_admin'},
          {email: 'orders.mgr@ceyvana.test', role: 'order_manager'},
          {email: 'catalog.mgr@ceyvana.test', role: 'catalog_manager'},
        ],
      }),
    });
    assert.equal(syncResp.status, 200);

    // Order Manager allowed on orders, blocked on audit-logs & settings PUT
    const omOrders = await fetch(`${srv.baseUrl}/api/admin/orders`, {
      headers: {Authorization: 'Bearer token-order-1fa'},
    });
    assert.equal(omOrders.status, 200);

    const omAudit = await fetch(`${srv.baseUrl}/api/admin/audit-logs`, {
      headers: {Authorization: 'Bearer token-order-1fa'},
    });
    assert.equal(omAudit.status, 403);

    const omSettingsPut = await fetch(`${srv.baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-order-1fa',
      },
      body: JSON.stringify({}),
    });
    assert.equal(omSettingsPut.status, 403);

    // Catalog Manager allowed on stock-sync, blocked on orders & audit-logs
    const cmStock = await fetch(`${srv.baseUrl}/api/admin/stock-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-catalog-1fa',
      },
      body: JSON.stringify({
        updates: [{variantSku: 'CYV-CINN-100G', stockQuantity: 42, available: true}],
      }),
    });
    assert.equal(cmStock.status, 200);

    const cmOrders = await fetch(`${srv.baseUrl}/api/admin/orders`, {
      headers: {Authorization: 'Bearer token-catalog-1fa'},
    });
    assert.equal(cmOrders.status, 403);
    console.log('✓ Test 2: Server-side RBAC granularity (super_admin / order_manager / catalog_manager) verified');

    // 3. MFA Enforcement Toggle (ADMIN_REQUIRE_MFA=true)
    process.env.ADMIN_REQUIRE_MFA = 'true';
    const mfaBlocked = await fetch(`${srv.baseUrl}/api/admin/session`, {
      headers: {Authorization: 'Bearer token-super-1fa'},
    });
    assert.equal(mfaBlocked.status, 403);
    const mfaBlockedBody = (await mfaBlocked.json()) as {code?: string};
    assert.equal(mfaBlockedBody.code, 'MFA_REQUIRED');

    const mfaAllowed = await fetch(`${srv.baseUrl}/api/admin/session`, {
      headers: {Authorization: 'Bearer token-super-2fa'},
    });
    assert.equal(mfaAllowed.status, 200);
    const mfaAllowedBody = (await mfaAllowed.json()) as {
      session: {mfaVerified: boolean; mfaRequired: boolean; role: string};
    };
    assert.equal(mfaAllowedBody.session.mfaVerified, true);
    assert.equal(mfaAllowedBody.session.mfaRequired, true);
    assert.equal(mfaAllowedBody.session.role, 'super_admin');
    process.env.ADMIN_REQUIRE_MFA = 'false';
    console.log('✓ Test 3: Optional Admin MFA enforcement gate (ADMIN_REQUIRE_MFA=true) verified');

    // 4. App Check Enforcement Toggle (ENFORCE_APP_CHECK=true) + Input Sanitization
    process.env.ENFORCE_APP_CHECK = 'true';
    const orderMissingAppCheck = await fetch(`${srv.baseUrl}/api/orders`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        customerName: '<script>alert(1)</script>Ruwan',
        email: 'ruwan@example.lk',
        phone: '+94771234567',
        country: 'Sri Lanka',
        address: '42 Flower Rd',
        city: 'Colombo',
        postalCode: '00300',
        deliveryMethod: 'local_standard',
        localZoneId: 'colombo-suburbs',
        paymentMethod: 'bank_transfer',
        currency: 'LKR',
        items: [{productId: 'cyv-cinnamon-alba', variantSku: 'CYV-CINN-100G', qty: 1}],
      }),
    });
    assert.equal(orderMissingAppCheck.status, 401);

    const orderInvalidAppCheck = await fetch(`${srv.baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Firebase-AppCheck': 'bad-token',
      },
      body: JSON.stringify({}),
    });
    assert.equal(orderInvalidAppCheck.status, 401);

    const orderValidAppCheck = await fetch(`${srv.baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Firebase-AppCheck': 'valid-appcheck-token',
      },
      body: JSON.stringify({
        customerName: '<script>alert(1)</script>Ruwan Perera',
        email: 'ruwan@example.lk',
        phone: '+94771234567',
        country: 'Sri Lanka',
        address: '42 Flower Rd <b>Colombo</b>',
        city: 'Colombo',
        postalCode: '00300',
        notes: '<img src=x onerror=alert(9)>Deliver afternoon',
        deliveryMethod: 'local_standard',
        localZoneId: 'colombo-suburbs',
        paymentMethod: 'bank_transfer',
        currency: 'LKR',
        idempotencyKey: 'sec-upgrade-order-1',
        items: [{productId: 'cyv-cinnamon-alba', variantSku: 'CYV-CINN-100G', qty: 1}],
      }),
    });
    assert.equal(orderValidAppCheck.status, 201);
    const createdOrder = (await orderValidAppCheck.json()) as {
      order: {customerName: string; address: string; notes?: string};
    };
    assert.ok(!createdOrder.order.customerName.includes('<script>'));
    assert.ok(!createdOrder.order.address.includes('<b>'));
    assert.ok(!(createdOrder.order.notes || '').includes('<img'));
    process.env.ENFORCE_APP_CHECK = 'false';
    console.log('✓ Test 4: Optional App Check enforcement & XSS tag sanitization verified');

    // 5. Immutable Admin Audit Ledger Verification
    const auditResp = await fetch(`${srv.baseUrl}/api/admin/audit-logs`, {
      headers: {Authorization: 'Bearer token-super-1fa'},
    });
    assert.equal(auditResp.status, 200);
    const auditBody = (await auditResp.json()) as {
      logs: {action: string; actorEmail: string}[];
    };
    assert.ok(auditBody.logs.some((l) => l.action === 'admin_allowlist_synced'));
    assert.ok(
      auditBody.logs.some(
        (l) =>
          l.action === 'inventory_stock_synced' && l.actorEmail === 'catalog.mgr@ceyvana.test',
      ),
    );
    console.log('✓ Test 5: Immutable admin audit ledger recorded RBAC actions accurately');
  } finally {
    await srv.close();
    fs.rmSync(TMP_DIR, {recursive: true, force: true});
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

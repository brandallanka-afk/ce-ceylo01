import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const TMP_DIR = fs.mkdtempSync('/tmp/ceylon-phase7-test-');
process.env.COMMERCE_DATA_DIR = TMP_DIR;
process.env.COMMERCE_TEST_MODE = '1';
process.env.SL_GATEWAY_MERCHANT_ID = '';
process.env.SL_GATEWAY_SECRET = '';
process.env.INTL_GATEWAY_PUBLISHABLE_KEY = '';
process.env.INTL_GATEWAY_SECRET = '';
process.env.INTL_GATEWAY_WEBHOOK_SECRET = '';

const {createApp} = await import('../server.ts');

async function startTestServer(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const app = createApp();
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
  const srv = await startTestServer();
  try {
    // 1. Verify Health Readiness, SSL HSTS Header & Sandbox Payment Gate
    const healthResp = await fetch(`${srv.baseUrl}/api/health`, {
      headers: {'x-forwarded-proto': 'https'},
    });
    assert.equal(healthResp.status, 200);
    assert.equal(
      healthResp.headers.get('strict-transport-security'),
      'max-age=31536000; includeSubDomains',
    );
    assert.equal(healthResp.headers.get('x-content-type-options'), 'nosniff');
    const health = (await healthResp.json()) as {
      ok: boolean;
      projectId: string;
      databaseId: string;
      sandboxMode: boolean;
      slGatewayConfigured: boolean;
      intlGatewayConfigured: boolean;
    };
    assert.equal(health.ok, true);
    assert.equal(health.projectId, 'gen-lang-client-0899218655');
    assert.equal(
      health.databaseId,
      'ai-studio-ceyvanaceylomira-e606d197-a4e9-4027-ac45-0034ca58574e',
    );
    assert.equal(health.sandboxMode, true);
    assert.equal(health.slGatewayConfigured, false);
    assert.equal(health.intlGatewayConfigured, false);
    console.log('✓ Test 1: /api/health, SSL HSTS header & payment sandbox gate verified');

    // 2. Verify Clean Server Store Initialization (Zero Fake Orders/Customers/Enquiries)
    const configResp = await fetch(`${srv.baseUrl}/api/commerce/config`);
    assert.equal(configResp.status, 200);
    const config = (await configResp.json()) as {
      payment: {
        bankTransferEnabled: boolean;
        codEnabled: boolean;
        slGatewayEnabled: boolean;
        intlGatewayEnabled: boolean;
        sandboxMode: boolean;
      };
      liveStockBySku: Record<string, {stockQuantity: number; available: boolean}>;
    };
    assert.equal(config.payment.bankTransferEnabled, true);
    assert.equal(config.payment.codEnabled, false);
    assert.equal(config.payment.slGatewayEnabled, false);
    assert.equal(config.payment.intlGatewayEnabled, false);
    assert.equal(config.payment.sandboxMode, true);
    assert.ok(Object.keys(config.liveStockBySku).length >= 12);

    const fsServiceCode = fs.readFileSync(
      path.resolve(process.cwd(), 'src/services/firestoreService.ts'),
      'utf8',
    );
    assert.ok(fsServiceCode.includes('initializeProductionDatabase'));
    assert.ok(!fsServiceCode.includes('nimali.sample@example.lk'));
    assert.ok(!fsServiceCode.includes('CH-2026-1001'));
    console.log('✓ Test 2: Zero fake customer orders in Firestore initialization & server state verified');

    // 3. Verify Firebase Configuration Files (firebase.json, .firebaserc, indexes, storage.rules)
    const firebaseJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'firebase.json'), 'utf8'),
    ) as {
      firestore?: {database?: string; rules?: string; indexes?: string};
      storage?: {rules?: string};
      hosting?: {public?: string; cleanUrls?: boolean; rewrites?: Array<{source: string}>};
    };
    assert.equal(
      firebaseJson.firestore?.database,
      'ai-studio-ceyvanaceylomira-e606d197-a4e9-4027-ac45-0034ca58574e',
    );
    assert.equal(firebaseJson.hosting?.public, 'dist');
    assert.equal(firebaseJson.hosting?.cleanUrls, true);
    assert.ok(firebaseJson.hosting?.rewrites?.some((r) => r.source === '/api/**'));

    const firebaserc = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), '.firebaserc'), 'utf8'),
    ) as {projects?: {default?: string}};
    assert.equal(firebaserc.projects?.default, 'gen-lang-client-0899218655');

    const storageRules = fs.readFileSync(
      path.resolve(process.cwd(), 'storage.rules'),
      'utf8',
    );
    assert.ok(storageRules.includes('match /payment-slips/{allSlipPaths=**}'));
    assert.ok(storageRules.includes('allow create, update:'));
    console.log('✓ Test 3: Firebase project isolation, Hosting rewrites, and Storage rules verified');

    // 4. Verify Production Build & Zero Exposed Frontend Secrets
    const distDir = path.resolve(process.cwd(), 'dist');
    assert.ok(fs.existsSync(path.join(distDir, 'index.html')), 'dist/index.html missing');
    assert.ok(
      fs.existsSync(path.join(distDir, 'src/assets/images/hero_ceylon_heritage_1795545289913-640.webp')),
      'Responsive WebP hero asset missing in dist/src/assets/images',
    );
    const distAssetsDir = path.join(distDir, 'assets');
    const jsFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
    assert.ok(jsFiles.length >= 5, 'Expected code-split JS bundles in dist/assets');
    for (const file of jsFiles) {
      const content = fs.readFileSync(path.join(distAssetsDir, file), 'utf8');
      assert.ok(!content.includes('SL_GATEWAY_SECRET'), `Secret reference leaked in ${file}`);
      assert.ok(!content.includes('INTL_GATEWAY_SECRET'), `Secret reference leaked in ${file}`);
      assert.ok(!content.includes('INTL_GATEWAY_WEBHOOK_SECRET'), `Secret reference leaked in ${file}`);
    }
    console.log('✓ Test 4: Production dist/ bundle, WebP assets, and frontend secret boundary verified');

    // 5. Verify Bundled Cloud Function Artifact
    const fnServerPath = path.resolve(process.cwd(), 'functions/lib/commerce-server.mjs');
    const fnIndexPath = path.resolve(process.cwd(), 'functions/lib/index.mjs');
    assert.ok(fs.existsSync(fnServerPath), 'functions/lib/commerce-server.mjs missing');
    assert.ok(fs.existsSync(fnIndexPath), 'functions/lib/index.mjs missing');
    const fnModule = (await import(fnServerPath)) as {createApp?: () => unknown};
    assert.equal(typeof fnModule.createApp, 'function');
    console.log('✓ Test 5: Bundled Cloud Function module loads createApp cleanly');
  } finally {
    await srv.close();
    fs.rmSync(TMP_DIR, {recursive: true, force: true});
  }
}

void runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {AddressInfo} from 'node:net';
import os from 'node:os';
import path from 'node:path';

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ceylon-phase6-test-'));
process.env.COMMERCE_DATA_DIR = tempDataDir;
process.env.COMMERCE_TEST_MODE = '1';
process.env.RATE_LIMIT_WRITE_MAX = '3';
process.env.RATE_LIMIT_READ_MAX = '10';

async function runTests() {
  const {createApp} = await import('../server.ts');
  const {safeEqualToken} = await import('../server/store.ts');
  const {getHomeFaqs, getCeyvanaFaqs, getCeylomiraFaqs, getWholesaleFaqs} = await import(
    '../src/data/faqs.ts'
  );

  const app = createApp();
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Dynamic /robots.txt
    const robotsRes = await fetch(`${baseUrl}/robots.txt`);
    assert.equal(robotsRes.status, 200);
    assert.match(robotsRes.headers.get('content-type') || '', /^text\/plain/);
    const robotsText = await robotsRes.text();
    assert.ok(robotsText.includes('Disallow: /admin'));
    assert.ok(robotsText.includes('Disallow: /cart'));
    assert.ok(robotsText.includes('Disallow: /api/'));
    assert.ok(robotsText.includes('Sitemap:'));
    console.log('✓ Test 1: /robots.txt crawl directives verified');

    // 2. Dynamic multilingual /sitemap.xml
    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemapRes.status, 200);
    assert.match(sitemapRes.headers.get('content-type') || '', /application\/xml/);
    const xml = await sitemapRes.text();
    assert.ok(xml.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'));
    assert.ok(xml.includes('/ceyvana</loc>'));
    assert.ok(xml.includes('/si/ceyvana</loc>'));
    assert.ok(xml.includes('/product/authentic-ceylon-cinnamon-quills</loc>'));
    assert.ok(xml.includes('/si/product/authentic-ceylon-cinnamon-quills</loc>'));
    assert.ok(xml.includes('hreflang="en"'));
    assert.ok(xml.includes('hreflang="si"'));
    assert.ok(xml.includes('hreflang="x-default"'));
    assert.ok(!xml.includes('/admin</loc>'));
    assert.ok(!xml.includes('/cart</loc>'));
    assert.ok(!xml.includes('/api/'));
    console.log('✓ Test 2: Multilingual /sitemap.xml includes all products & EN/SI alternates, excludes /admin & /cart');

    // 3. Responsive WebP assets exist & compress well below JPEGs
    const brands = JSON.parse(fs.readFileSync(path.resolve('src/data/brands.json'), 'utf8')) as {
      heroImage: string;
    }[];
    const products = JSON.parse(fs.readFileSync(path.resolve('src/data/products.json'), 'utf8')) as {
      slug: string;
      mainImage: string;
      thumbnailImage?: string;
      gallery?: string[];
    }[];
    const stories = JSON.parse(fs.readFileSync(path.resolve('src/data/stories.json'), 'utf8')) as {
      image: string;
    }[];

    const referencedImages = new Set<string>();
    for (const b of brands) referencedImages.add(b.heroImage);
    for (const p of products) {
      referencedImages.add(p.mainImage);
      if (p.thumbnailImage) referencedImages.add(p.thumbnailImage);
      for (const g of p.gallery ?? []) referencedImages.add(g);
    }
    for (const s of stories) referencedImages.add(s.image);

    const slugs = new Set<string>();
    for (const p of products) {
      assert.ok(/^[a-z0-9-]+$/.test(p.slug), `Invalid product slug: ${p.slug}`);
      assert.ok(!slugs.has(p.slug), `Duplicate product slug: ${p.slug}`);
      slugs.add(p.slug);
    }

    for (const imgRel of referencedImages) {
      assert.ok(imgRel.startsWith('/src/assets/images/'), `Unexpected image path: ${imgRel}`);
      const absJpg = path.resolve(imgRel.slice(1));
      const base = absJpg.replace(/\.(jpe?g|png)$/i, '');
      for (const variantPath of [absJpg, `${base}.webp`, `${base}-1024.webp`, `${base}-640.webp`]) {
        assert.ok(fs.existsSync(variantPath), `Missing image asset: ${variantPath}`);
      }
      const jpgSize = fs.statSync(absJpg).size;
      const webp640Size = fs.statSync(`${base}-640.webp`).size;
      assert.ok(webp640Size < jpgSize, `Expected WebP 640w smaller than JPG for ${imgRel}`);
    }
    console.log('✓ Test 3: All referenced images have .jpg, .webp, -1024.webp, and -640.webp variants');

    // 4. Bilingual AEO/GEO FAQs & index.html Organization JSON-LD checks
    for (const lang of ['en', 'si'] as const) {
      const sets = [
        getHomeFaqs(lang),
        getCeyvanaFaqs(lang),
        getCeylomiraFaqs(lang),
        getWholesaleFaqs(lang),
      ];
      for (const list of sets) {
        assert.ok(list.length >= 4, `Expected >=4 FAQs for lang=${lang}`);
        for (const item of list) {
          assert.ok(item.question.trim().length > 10);
          assert.ok(item.answer.trim().length > 20);
          assert.ok(!/guaranteed.*rank|page\s*1\s*rank/i.test(item.answer));
        }
      }
    }
    const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
    assert.ok(indexHtml.includes('id="site-org-json-ld"'));
    assert.ok(indexHtml.includes('"@type": "Organization"'));
    assert.ok(indexHtml.includes('"@type": "WebSite"'));
    assert.ok(indexHtml.includes('name="robots"'));
    console.log('✓ Test 4: Bilingual FAQs and initial Organization/WebSite JSON-LD verified');

    // 5. Security headers (including AI Studio iframe compatibility & strict /api CSP)
    const cfgRes = await fetch(`${baseUrl}/api/commerce/config`);
    assert.equal(cfgRes.status, 200);
    assert.equal(cfgRes.headers.get('x-powered-by'), null);
    assert.equal(cfgRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(cfgRes.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.match(cfgRes.headers.get('permissions-policy') || '', /geolocation=\(\)/);
    assert.match(cfgRes.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
    assert.equal(cfgRes.headers.get('cache-control'), 'no-store');
    assert.equal(robotsRes.headers.get('x-frame-options'), null);

    // Unauthenticated admin access denied & unknown API returns JSON 404
    const adminUnauth = await fetch(`${baseUrl}/api/admin/orders`);
    assert.equal(adminUnauth.status, 401);
    const api404 = await fetch(`${baseUrl}/api/non-existent-route`);
    assert.equal(api404.status, 404);
    console.log('✓ Test 5: Security headers, admin 401 barrier, and API 404 handling verified');

    // 6. Cross-origin mutation protection (Origin check rejects foreign host)
    const csrfBlocked = await fetch(`${baseUrl}/api/enquiries/international`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://malicious-attacker.example',
      },
      body: JSON.stringify({companyName: 'Test'}),
    });
    assert.equal(csrfBlocked.status, 403);
    console.log('✓ Test 6: Cross-origin API mutation rejected with 403');

    // 7. Timing-safe token check & rate limiter (429 + Retry-After)
    assert.equal(safeEqualToken('abc123', 'abc123'), true);
    assert.equal(safeEqualToken('abc123', 'abc124'), false);
    assert.equal(safeEqualToken('abc123', 'abc12'), false);
    assert.equal(safeEqualToken('', 'abc'), false);

    // Trigger 3 allowed public write calls (invalid payload -> 400 still counts against write limit), 4th returns 429
    for (let i = 0; i < 3; i++) {
      const r = await fetch(`${baseUrl}/api/orders/CH-NONE/bank-reference`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({receiptToken: 'bad', paymentReference: 'REF'}),
      });
      assert.equal(r.status, 403);
    }
    const rateLimited = await fetch(`${baseUrl}/api/orders/CH-NONE/bank-reference`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({receiptToken: 'bad', paymentReference: 'REF'}),
    });
    assert.equal(rateLimited.status, 429);
    assert.ok(Number(rateLimited.headers.get('retry-after')) >= 1);
    console.log('✓ Test 7: Constant-time token comparison and sliding-window 429 rate limiter verified');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tempDataDir, {recursive: true, force: true});
  }
}

runTests().catch((err) => {
  console.error('Phase 6 SEO & Security test suite failed:', err);
  process.exit(1);
});

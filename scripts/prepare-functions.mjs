import fs from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const FUNCTIONS_DIR = path.join(ROOT_DIR, 'functions');
const LIB_DIR = path.join(FUNCTIONS_DIR, 'lib');

fs.mkdirSync(LIB_DIR, {recursive: true});
fs.mkdirSync(path.join(FUNCTIONS_DIR, 'src/data'), {recursive: true});
fs.mkdirSync(path.join(FUNCTIONS_DIR, 'server/fonts'), {recursive: true});

// 1. Bundle server.ts into a standalone ESM artifact inside functions/lib/
await build({
  entryPoints: [path.join(ROOT_DIR, 'server.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: path.join(LIB_DIR, 'commerce-server.mjs'),
  external: ['express', 'firebase-admin', 'firebase-admin/*', 'vite', 'pdfkit'],
  banner: {
    js: '/* Bundled Express Commerce Server for Firebase Cloud Functions */',
  },
});

// 2. Copy static runtime assets expected relative to process.cwd() in functions/
fs.copyFileSync(
  path.join(ROOT_DIR, 'firebase-applet-config.json'),
  path.join(FUNCTIONS_DIR, 'firebase-applet-config.json'),
);
fs.copyFileSync(
  path.join(ROOT_DIR, 'src/data/products.json'),
  path.join(FUNCTIONS_DIR, 'src/data/products.json'),
);
if (fs.existsSync(path.join(ROOT_DIR, 'server/fonts'))) {
  for (const fontFile of fs.readdirSync(path.join(ROOT_DIR, 'server/fonts'))) {
    if (fontFile.endsWith('.ttf')) {
      fs.copyFileSync(
        path.join(ROOT_DIR, 'server/fonts', fontFile),
        path.join(FUNCTIONS_DIR, 'server/fonts', fontFile),
      );
    }
  }
}

// 3. Emit Cloud Functions v2 entrypoint wrapper importing bundled server + secrets
const indexOut = `import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {createApp} from './commerce-server.mjs';

const slGatewayMerchantId = defineSecret('SL_GATEWAY_MERCHANT_ID');
const slGatewaySecret = defineSecret('SL_GATEWAY_SECRET');
const intlGatewayPublishableKey = defineSecret('INTL_GATEWAY_PUBLISHABLE_KEY');
const intlGatewaySecret = defineSecret('INTL_GATEWAY_SECRET');
const intlGatewayWebhookSecret = defineSecret('INTL_GATEWAY_WEBHOOK_SECRET');

process.env.FUNCTION_TARGET = process.env.FUNCTION_TARGET || 'commerceApi';

const app = createApp();

export const commerceApi = onRequest(
  {
    region: 'asia-south1',
    timeoutSeconds: 60,
    memory: '256MiB',
    maxInstances: 10,
    invoker: 'public',
    secrets: [
      slGatewayMerchantId,
      slGatewaySecret,
      intlGatewayPublishableKey,
      intlGatewaySecret,
      intlGatewayWebhookSecret,
    ],
  },
  app,
);
`;

fs.writeFileSync(path.join(LIB_DIR, 'index.mjs'), indexOut, 'utf8');
console.log('Cloud Functions bundle prepared in functions/lib/');

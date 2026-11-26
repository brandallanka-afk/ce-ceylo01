import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {createApp} from './commerce-server.mjs';

const slGatewayMerchantId = defineSecret('SL_GATEWAY_MERCHANT_ID');
const slGatewaySecret = defineSecret('SL_GATEWAY_SECRET');
const intlGatewayPublishableKey = defineSecret('INTL_GATEWAY_PUBLISHABLE_KEY');
const intlGatewaySecret = defineSecret('INTL_GATEWAY_SECRET');
const intlGatewayWebhookSecret = defineSecret('INTL_GATEWAY_WEBHOOK_SECRET');

const expressApp = createApp();

/**
 * Gen 2 HTTPS Cloud Function mounting the Express Commerce, SEO, and Webhook API.
 * Gateway secrets remain unset in Secret Manager until merchant accounts are formally approved.
 */
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
  expressApp,
);

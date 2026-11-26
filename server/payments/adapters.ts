import crypto from 'node:crypto';
import type {
  CommerceSettingsConfig,
  OrderRecord,
  OrderStatus,
  PaymentMethodId,
  PaymentStatus,
} from '../../src/types/admin.ts';
import type {CurrencyCode} from '../../src/types/commerce.ts';

export interface PaymentInitiationResult {
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  transactionRef?: string;
  instructions?: string;
  requiresVerification: boolean;
}

export interface VerifiedWebhookEvent {
  eventId: string;
  provider: PaymentMethodId;
  orderRef: string;
  outcome: 'paid' | 'failed' | 'refunded';
  amount: number;
  currency: CurrencyCode;
  transactionRef: string;
  rawSummary: string;
}

export interface PaymentProviderAdapter {
  id: PaymentMethodId;
  displayName: string;
  isConfiguredForLive: () => boolean;
  initiatePayment: (
    order: OrderRecord,
    settings: CommerceSettingsConfig,
    input: {paymentReference?: string; hasSlip: boolean},
  ) => PaymentInitiationResult;
  verifyWebhook?: (
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
    settings: CommerceSettingsConfig,
  ) => VerifiedWebhookEvent;
  createSandboxSignedWebhook?: (params: {
    eventId: string;
    orderRef: string;
    outcome: 'paid' | 'failed';
    amount: number;
    currency: CurrencyCode;
    transactionRef: string;
  }) => {payload: string; headers: Record<string, string>};
}

function timingSafeCompareHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a.trim().toLowerCase(), 'utf8');
  const bufB = Buffer.from(b.trim().toLowerCase(), 'utf8');
  if (bufA.length !== bufB.length || bufA.length === 0) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function getHeaderString(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string {
  const val = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(val) ? val[0] || '' : val || '';
}

function getSlGatewaySecret(sandboxMode: boolean): string {
  const envSecret = process.env.SL_GATEWAY_SECRET?.trim();
  if (envSecret) {
    return envSecret;
  }
  if (sandboxMode) {
    // Ephemeral process-local sandbox test key; never valid for live gateway requests
    return SANDBOX_EPHEMERAL_KEYS.sl;
  }
  throw new Error('SL_GATEWAY_SECRET is not configured on the server.');
}

function getIntlWebhookSecret(sandboxMode: boolean): string {
  const envSecret = process.env.INTL_GATEWAY_WEBHOOK_SECRET?.trim();
  if (envSecret) {
    return envSecret;
  }
  if (sandboxMode) {
    return SANDBOX_EPHEMERAL_KEYS.intl;
  }
  throw new Error('INTL_GATEWAY_WEBHOOK_SECRET is not configured on the server.');
}

const SANDBOX_EPHEMERAL_KEYS = {
  sl: crypto.randomBytes(32).toString('hex'),
  intl: crypto.randomBytes(32).toString('hex'),
};

export const whatsappOrderAdapter: PaymentProviderAdapter = {
  id: 'whatsapp_order',
  displayName: 'WhatsApp Direct Concierge Order',
  isConfiguredForLive: () => true,
  initiatePayment: (_order, settings) => ({
    paymentStatus: 'pending',
    orderStatus: 'new',
    instructions: `Order recorded as New. Continue on WhatsApp (+${settings.whatsappNumber}) for concierge verification & dispatch confirmation.`,
    requiresVerification: true,
  }),
};

export const bankTransferAdapter: PaymentProviderAdapter = {
  id: 'bank_transfer',
  displayName: 'Bank Transfer / Direct Deposit',
  isConfiguredForLive: () => true,
  initiatePayment: (_order, settings, input) => {
    const hasProof = Boolean(input.paymentReference?.trim() || input.hasSlip);
    const details = settings.payment.bankDetails;
    return {
      paymentStatus: 'pending_verification',
      orderStatus: hasProof ? 'payment_verification' : 'awaiting_payment',
      transactionRef: input.paymentReference?.trim() || undefined,
      instructions: `${details.bankName} · Acc: ${details.accountNumber} (${details.accountName})`,
      requiresVerification: true,
    };
  },
};

export const codAdapter: PaymentProviderAdapter = {
  id: 'cod',
  displayName: 'Payment on Delivery (Sri Lanka)',
  isConfiguredForLive: () => true,
  initiatePayment: () => ({
    paymentStatus: 'pending',
    orderStatus: 'pending',
    instructions: 'Cash or verified mobile transfer due upon islandwide courier delivery.',
    requiresVerification: false,
  }),
};

export const slGatewayAdapter: PaymentProviderAdapter = {
  id: 'sl_gateway',
  displayName: 'Sri Lankan Payment Gateway Adapter',
  isConfiguredForLive: () =>
    Boolean(process.env.SL_GATEWAY_MERCHANT_ID?.trim() && process.env.SL_GATEWAY_SECRET?.trim()),
  initiatePayment: (order, settings) => {
    if (!settings.payment.sandboxMode && !slGatewayAdapter.isConfiguredForLive()) {
      throw new Error('Live Sri Lankan gateway requires server merchant credentials.');
    }
    return {
      paymentStatus: 'pending',
      orderStatus: 'awaiting_payment',
      transactionRef: `SL-INTENT-${order.orderRef}`,
      instructions: settings.payment.sandboxMode
        ? 'Sandbox payment intent created. Awaiting verified server webhook callback.'
        : 'Redirecting to verified Sri Lankan gateway session.',
      requiresVerification: true,
    };
  },
  verifyWebhook: (rawBody, headers, settings) => {
    const sig = getHeaderString(headers, 'x-sl-gateway-signature');
    if (!sig) {
      throw new Error('Missing Sri Lankan gateway webhook signature.');
    }
    const secret = getSlGatewaySecret(settings.payment.sandboxMode);
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!timingSafeCompareHex(sig, expected)) {
      throw new Error('Invalid Sri Lankan gateway HMAC signature.');
    }
    const body = JSON.parse(rawBody) as {
      eventId?: string;
      orderRef?: string;
      statusCode?: string;
      amount?: number;
      currency?: CurrencyCode;
      transactionRef?: string;
    };
    if (!body.eventId || !body.orderRef || typeof body.amount !== 'number' || !body.currency) {
      throw new Error('Malformed Sri Lankan gateway webhook payload.');
    }
    const outcome =
      body.statusCode === '2' ? 'paid' : body.statusCode === '-3' ? 'refunded' : 'failed';
    return {
      eventId: body.eventId,
      provider: 'sl_gateway',
      orderRef: body.orderRef,
      outcome,
      amount: body.amount,
      currency: body.currency,
      transactionRef: body.transactionRef || body.eventId,
      rawSummary: `SL Gateway statusCode=${body.statusCode}`,
    };
  },
  createSandboxSignedWebhook: (params) => {
    const payload = JSON.stringify({
      eventId: params.eventId,
      orderRef: params.orderRef,
      statusCode: params.outcome === 'paid' ? '2' : '-2',
      amount: params.amount,
      currency: params.currency,
      transactionRef: params.transactionRef,
    });
    const sig = crypto
      .createHmac('sha256', SANDBOX_EPHEMERAL_KEYS.sl)
      .update(payload)
      .digest('hex');
    return {
      payload,
      headers: {'x-sl-gateway-signature': sig},
    };
  },
};

export const intlGatewayAdapter: PaymentProviderAdapter = {
  id: 'intl_gateway',
  displayName: 'International Payment Gateway Adapter',
  isConfiguredForLive: () =>
    Boolean(
      process.env.INTL_GATEWAY_SECRET?.trim() && process.env.INTL_GATEWAY_WEBHOOK_SECRET?.trim(),
    ),
  initiatePayment: (order, settings) => {
    if (!settings.payment.sandboxMode && !intlGatewayAdapter.isConfiguredForLive()) {
      throw new Error('Live international gateway requires server credentials.');
    }
    return {
      paymentStatus: 'pending',
      orderStatus: 'awaiting_payment',
      transactionRef: `INTL-INTENT-${order.orderRef}`,
      instructions: settings.payment.sandboxMode
        ? 'Sandbox international payment intent initialized. Awaiting signed webhook.'
        : 'Hosted international payment session initialized.',
      requiresVerification: true,
    };
  },
  verifyWebhook: (rawBody, headers, settings) => {
    const headerVal = getHeaderString(headers, 'x-intl-signature');
    const parts = Object.fromEntries(
      headerVal.split(',').map((kv) => {
        const idx = kv.indexOf('=');
        return idx > 0 ? [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()] : [kv, ''];
      }),
    );
    const timestamp = Number(parts.t);
    const v1 = parts.v1 || '';
    if (!timestamp || !v1 || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) {
      throw new Error('Missing, expired, or invalid international gateway webhook timestamp.');
    }
    const secret = getIntlWebhookSecret(settings.payment.sandboxMode);
    const signedPayload = `${timestamp}.${rawBody}`;
    const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    if (!timingSafeCompareHex(v1, expected)) {
      throw new Error('Invalid international gateway HMAC signature.');
    }
    const body = JSON.parse(rawBody) as {
      eventId?: string;
      orderRef?: string;
      eventType?: string;
      amount?: number;
      currency?: CurrencyCode;
      transactionRef?: string;
    };
    if (!body.eventId || !body.orderRef || typeof body.amount !== 'number' || !body.currency) {
      throw new Error('Malformed international gateway webhook payload.');
    }
    const outcome =
      body.eventType === 'payment_intent.succeeded'
        ? 'paid'
        : body.eventType === 'charge.refunded'
          ? 'refunded'
          : 'failed';
    return {
      eventId: body.eventId,
      provider: 'intl_gateway',
      orderRef: body.orderRef,
      outcome,
      amount: body.amount,
      currency: body.currency,
      transactionRef: body.transactionRef || body.eventId,
      rawSummary: `Intl Gateway event=${body.eventType}`,
    };
  },
  createSandboxSignedWebhook: (params) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      eventId: params.eventId,
      orderRef: params.orderRef,
      eventType: params.outcome === 'paid' ? 'payment_intent.succeeded' : 'payment_intent.payment_failed',
      amount: params.amount,
      currency: params.currency,
      transactionRef: params.transactionRef,
    });
    const sig = crypto
      .createHmac('sha256', SANDBOX_EPHEMERAL_KEYS.intl)
      .update(`${timestamp}.${payload}`)
      .digest('hex');
    return {
      payload,
      headers: {'x-intl-signature': `t=${timestamp},v1=${sig}`},
    };
  },
};

export const PAYMENT_ADAPTERS: Record<PaymentMethodId, PaymentProviderAdapter> = {
  whatsapp_order: whatsappOrderAdapter,
  bank_transfer: bankTransferAdapter,
  cod: codAdapter,
  sl_gateway: slGatewayAdapter,
  intl_gateway: intlGatewayAdapter,
};

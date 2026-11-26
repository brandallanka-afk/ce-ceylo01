import type {CommerceSettingsConfig, DeliveryMethodId} from '../src/types/admin.ts';
import type {ConfiguredCurrency, CurrencyCode} from '../src/types/commerce.ts';

export interface ShippingQuoteResult {
  feeLkr: number;
  feeUsd: number;
  feeInCurrency: number;
  freeShippingApplied: boolean;
  isQuotePending: boolean;
  label: string;
  policyNote?: string;
}

export function resolveConfiguredCurrency(
  code: CurrencyCode | undefined,
  settings: CommerceSettingsConfig,
): ConfiguredCurrency {
  const requested = String(code || 'LKR').trim().toUpperCase();
  const list = settings.currencies?.length
    ? settings.currencies
    : [
        {code: 'LKR', symbol: 'LKR', name: 'Sri Lankan Rupee', ratePerUsd: settings.shipping.usdToLkrRate || 300, enabled: true},
        {code: 'USD', symbol: '$', name: 'US Dollar', ratePerUsd: 1, enabled: true},
      ];
  const found = list.find((c) => c.code.toUpperCase() === requested && c.enabled);
  if (!found) {
    throw new Error(`Currency ${requested} is not enabled by administrator.`);
  }
  return found;
}

export function convertUsdToConfiguredCurrency(
  usdAmount: number,
  currencyCfg: ConfiguredCurrency,
  lkrExact?: number,
): number {
  const code = currencyCfg.code.toUpperCase();
  if (code === 'LKR') {
    return typeof lkrExact === 'number'
      ? Math.round(lkrExact)
      : Math.round(usdAmount * Math.max(1, currencyCfg.ratePerUsd || 300));
  }
  if (code === 'USD') {
    return Number(usdAmount.toFixed(2));
  }
  const rate = Number(currencyCfg.ratePerUsd);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid administrator exchange rate configured for ${code}.`);
  }
  return Number((usdAmount * rate).toFixed(2));
}

export function calculateAuthoritativeShipping(params: {
  subtotalLkr: number;
  totalWeightGrams: number;
  country: string;
  deliveryMethod: DeliveryMethodId;
  localZoneId?: string;
  currency: CurrencyCode;
  settings: CommerceSettingsConfig;
}): ShippingQuoteResult {
  const {
    subtotalLkr,
    totalWeightGrams,
    country,
    deliveryMethod,
    localZoneId,
    currency,
    settings,
  } = params;
  const {shipping} = settings;
  const fx = Math.max(100, shipping.usdToLkrRate || 300);
  const currencyCfg = resolveConfiguredCurrency(currency, settings);
  const normalizedCountry = country.trim().toLowerCase();
  const isSriLanka = normalizedCountry === 'sri lanka' || normalizedCountry === 'lk';

  if (isSriLanka) {
    if (deliveryMethod !== 'local_standard' && deliveryMethod !== 'local_express') {
      throw new Error('Selected delivery method is not valid for Sri Lanka.');
    }

    const zone =
      shipping.localZones.find((z) => z.id === localZoneId && z.enabled) ??
      shipping.localZones.find((z) => z.enabled);

    if (!zone) {
      throw new Error('No active Sri Lankan delivery zones configured.');
    }

    const extraKg = Math.max(0, Math.ceil((totalWeightGrams - 1000) / 1000));
    const baseLkr = zone.baseRateLkr + extraKg * zone.extraPerKgLkr;
    const freeQualified =
      shipping.freeShippingThresholdLkr > 0 && subtotalLkr >= shipping.freeShippingThresholdLkr;

    let feeLkr = freeQualified ? 0 : baseLkr;
    if (deliveryMethod === 'local_express') {
      feeLkr += Math.max(0, shipping.localExpressSurchargeLkr);
    }

    const feeUsd = Number((feeLkr / fx).toFixed(2));
    return {
      feeLkr,
      feeUsd,
      feeInCurrency: convertUsdToConfiguredCurrency(feeUsd, currencyCfg, feeLkr),
      freeShippingApplied: freeQualified && deliveryMethod === 'local_standard',
      isQuotePending: false,
      label:
        deliveryMethod === 'local_express'
          ? `${zone.name} (Priority Express)`
          : `${zone.name} (Standard Courier)`,
    };
  }

  // International destinations
  if (deliveryMethod === 'local_standard' || deliveryMethod === 'local_express') {
    throw new Error('Please choose an international delivery option for destinations outside Sri Lanka.');
  }

  const matchedRate =
    shipping.internationalRates.find(
      (r) => r.enabled && r.country.toLowerCase() === normalizedCountry,
    ) ??
    shipping.internationalRates.find(
      (r) => r.enabled && r.country.toLowerCase() === 'rest of world',
    );

  if (deliveryMethod === 'international_quote') {
    if (!shipping.internationalQuoteEnabled) {
      throw new Error('International shipping quotations are currently disabled.');
    }
    return {
      feeLkr: 0,
      feeUsd: 0,
      feeInCurrency: 0,
      freeShippingApplied: false,
      isQuotePending: true,
      label: `Export Shipping Quotation (${country.trim()})`,
      policyNote: matchedRate?.policyNote,
    };
  }

  if (!matchedRate) {
    throw new Error(`No courier rate configured for ${country}. Please request a shipping quotation.`);
  }

  const halfKgUnits = Math.max(1, Math.ceil(totalWeightGrams / 500));
  const feeUsd = Number(
    (matchedRate.baseUsd + Math.max(0, halfKgUnits - 1) * matchedRate.extraPer500gUsd).toFixed(2),
  );
  const feeLkr = Math.round(feeUsd * fx);

  return {
    feeLkr,
    feeUsd,
    feeInCurrency: convertUsdToConfiguredCurrency(feeUsd, currencyCfg, feeLkr),
    freeShippingApplied: false,
    isQuotePending: false,
    label: `International Air Express (${matchedRate.country})`,
    policyNote: matchedRate.policyNote,
  };
}

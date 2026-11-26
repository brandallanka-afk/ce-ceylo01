import type {CartItem, ConfiguredCurrency, CurrencyCode, LanguageCode} from '../types/commerce';

const WHATSAPP_NUMBER = '94770000000';

let activeCurrencies: ConfiguredCurrency[] = [
  {code: 'LKR', symbol: 'LKR', name: 'Sri Lankan Rupee', ratePerUsd: 300, enabled: true, isDefault: true},
  {code: 'USD', symbol: '$', name: 'US Dollar', ratePerUsd: 1, enabled: true},
];

export function syncConfiguredCurrencies(list?: ConfiguredCurrency[]): void {
  if (Array.isArray(list) && list.length > 0) {
    activeCurrencies = list;
  }
}

export function getConfiguredCurrencies(): ConfiguredCurrency[] {
  return activeCurrencies;
}

export function formatSingleCurrency(
  amount: number,
  currency: CurrencyCode,
  currencies = activeCurrencies,
): string {
  const code = String(currency || 'LKR').toUpperCase();
  if (code === 'LKR') {
    return `LKR ${Math.round(amount).toLocaleString('en-US')}`;
  }
  if (code === 'USD') {
    return `$${amount.toFixed(2)}`;
  }
  const cfg = currencies.find((c) => c.code.toUpperCase() === code);
  const symbol = cfg?.symbol || code;
  return `${symbol} ${amount.toFixed(2)}`;
}

export function formatMoney(
  priceLkr: number,
  priceUsd: number,
  currency: CurrencyCode,
  currencies = activeCurrencies,
): string {
  const code = String(currency || 'LKR').toUpperCase();
  if (code === 'USD') {
    return `$${priceUsd.toFixed(2)}`;
  }
  if (code === 'LKR') {
    return `LKR ${Math.round(priceLkr).toLocaleString('en-US')}`;
  }
  const cfg = currencies.find((c) => c.code.toUpperCase() === code);
  if (cfg && Number.isFinite(cfg.ratePerUsd) && cfg.ratePerUsd > 0) {
    const converted = priceUsd * cfg.ratePerUsd;
    return `${cfg.symbol} ${converted.toFixed(2)}`;
  }
  return `$${priceUsd.toFixed(2)}`;
}

export function calculateShipping(
  subtotalLkr: number,
  _subtotalUsd: number,
  totalWeightGrams: number,
  region: 'local' | 'international',
): {lkr: number; usd: number} {
  if (subtotalLkr === 0) {
    return {lkr: 0, usd: 0};
  }
  if (region === 'local') {
    if (subtotalLkr >= 15000) {
      return {lkr: 0, usd: 0};
    }
    const base = 450;
    const extraKg = Math.max(0, Math.ceil((totalWeightGrams - 1000) / 1000));
    const lkr = base + extraKg * 150;
    return {lkr, usd: Number((lkr / 300).toFixed(2))};
  }
  const kg = Math.max(0.5, Math.ceil(totalWeightGrams / 500) * 0.5);
  const usd = Number((22 + Math.max(0, kg - 0.5) * 12).toFixed(2));
  const lkr = Math.round(usd * 300);
  return {lkr, usd};
}

export function resolveBrandWhatsappNumber(
  brandScope: string | undefined,
  config?: {
    whatsappNumber?: string;
    brandWhatsappNumbers?: Record<string, string | undefined>;
  } | null,
): string {
  const clean = (raw?: string) => (raw || '').replace(/[^0-9]/g, '');
  if (brandScope && brandScope !== 'mixed' && config?.brandWhatsappNumbers?.[brandScope]) {
    const specific = clean(config.brandWhatsappNumbers[brandScope]);
    if (specific) return specific;
  }
  return clean(config?.whatsappNumber) || WHATSAPP_NUMBER;
}

export function formatBrandBadgeName(brandId: string): string {
  if (brandId === 'ceyvana') return 'CEYVANA';
  if (brandId === 'ceylomira') return 'CEYLOMIRA';
  if (brandId === 'hand-crafts') return 'HAND CRAFTS';
  return brandId.toUpperCase();
}

export function buildWhatsAppLink(message: string, whatsappNumber = WHATSAPP_NUMBER): string {
  const digits = (whatsappNumber || WHATSAPP_NUMBER).replace(/[^0-9]/g, '') || WHATSAPP_NUMBER;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildCartWhatsAppMessage(
  items: CartItem[],
  currency: CurrencyCode,
  lang: LanguageCode,
  shippingLabel?: string,
  shippingFee?: number,
  customer?: {
    name?: string;
    phone?: string;
    address?: string;
    notes?: string;
    orderRef?: string;
  },
): string {
  const header =
    lang === 'si'
      ? 'ආයුබෝවන් Ceylon Heritage Desk, පහත සඳහන් ඇණවුම් විස්තර තහවුරු කර ගැනීමට කැමැත්තෙමි (ව්‍යාපාරය විසින් තහවුරු කරන තෙක් මෙය අවසන් නොවේ):'
      : 'Hello Ceylon Heritage Desk, I would like to request order confirmation for these items (pending official business confirmation):';

  const lines = items.map((item) => {
    const linePrice = formatMoney(
      item.priceLkr * item.quantity,
      item.priceUsd * item.quantity,
      currency,
    );
    const brandName = formatBrandBadgeName(item.brandId);
    const prodTitle = lang === 'si' && item.productName.si ? item.productName.si : item.productName.en;
    return `- [${brandName}] ${prodTitle} | Pack: ${item.variantLabel} | SKU: ${item.variantSku} | Qty: ${item.quantity} | ${linePrice}`;
  });

  const totalLkr = items.reduce((sum, i) => sum + i.priceLkr * i.quantity, 0);
  const totalUsd = items.reduce((sum, i) => sum + i.priceUsd * i.quantity, 0);
  const subStr = formatMoney(totalLkr, totalUsd, currency);
  const shipLine =
    typeof shippingFee === 'number'
      ? `\nDelivery (${shippingLabel || 'Standard'}): ${shippingFee === 0 ? 'Free / Quote Pending' : formatSingleCurrency(shippingFee, currency)}`
      : '';
  const code = String(currency || 'LKR').toUpperCase();
  const cfg = activeCurrencies.find((c) => c.code.toUpperCase() === code);
  const subtotalInCurr =
    code === 'LKR'
      ? totalLkr
      : code === 'USD'
        ? totalUsd
        : totalUsd * (cfg?.ratePerUsd || 1);
  const finalTotal =
    typeof shippingFee === 'number'
      ? formatSingleCurrency(subtotalInCurr + shippingFee, currency)
      : subStr;

  const customerLines: string[] = [];
  if (customer?.orderRef) customerLines.push(`Order Ref: ${customer.orderRef}`);
  if (customer?.name) customerLines.push(`Customer Name: ${customer.name}`);
  if (customer?.phone) customerLines.push(`Contact Phone: ${customer.phone}`);
  if (customer?.address) customerLines.push(`Delivery Address: ${customer.address}`);
  if (customer?.notes) customerLines.push(`Instructions: ${customer.notes}`);

  const customerBlock = customerLines.length > 0 ? `\n\n${customerLines.join('\n')}` : '';

  return `${header}\n\n${lines.join('\n')}\n\nSubtotal: ${subStr}${shipLine}\nEstimated Total: ${finalTotal}${customerBlock}`;
}

export function buildSingleProductWhatsAppMessage(params: {
  brandId: string;
  productName: string;
  packSize: string;
  sku?: string;
  quantity: number;
  displayedUnitPrice?: string;
  displayedLineTotal?: string;
  orderRef?: string;
  customerName?: string;
  phone?: string;
  address?: string;
  notes?: string;
  lang?: LanguageCode;
}): string {
  const brand = formatBrandBadgeName(params.brandId);
  const intro =
    params.lang === 'si'
      ? 'ආයුබෝවන්, පහත නිෂ්පාදන ඇණවුම සඳහා තහවුරු කිරීමක් ඉල්ලා සිටිමි (ව්‍යාපාරය විසින් තහවුරු කරන තෙක් අවසන් නොවේ):'
      : 'Hello, I would like to place a WhatsApp order request for the following item (pending official confirmation):';

  const parts = [
    intro,
    '',
    `Brand: ${brand}`,
    `Product: ${params.productName}`,
    params.sku ? `SKU: ${params.sku}` : '',
    `Pack Size: ${params.packSize}`,
    `Quantity: ${params.quantity}`,
    params.displayedLineTotal
      ? `Displayed Price: ${params.displayedLineTotal}${params.displayedUnitPrice ? ` (${params.displayedUnitPrice} each)` : ''}`
      : '',
    params.orderRef ? `Order Reference: ${params.orderRef}` : '',
    params.customerName ? `Customer Name: ${params.customerName}` : '',
    params.phone ? `Contact Number: ${params.phone}` : '',
    params.address ? `Delivery Address: ${params.address}` : '',
    params.notes ? `Additional Instructions: ${params.notes}` : '',
  ];

  return parts.filter((line, idx) => idx === 1 || Boolean(line)).join('\n');
}

export function buildOrderWhatsAppSummary(order: {
  orderRef: string;
  customerName: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  orderNotes?: string;
  currency: CurrencyCode;
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  paymentMethod?: string;
  orderStatus: string;
  items: {name: string; brandId?: string; packSize?: string; variantSku: string; qty: number; unitPrice: number}[];
}): string {
  const fmt = (val: number) => formatSingleCurrency(val, order.currency);
  const lines = order.items.map((i) => {
    const brandTag = i.brandId ? `[${formatBrandBadgeName(i.brandId)}] ` : '';
    return `- ${brandTag}${i.name} | SKU: ${i.variantSku} | Qty: ${i.qty} = ${fmt(i.unitPrice * i.qty)}`;
  });
  const addr = [order.address, order.city, order.country].filter(Boolean).join(', ');
  return [
    `Order Reference: ${order.orderRef}`,
    `Customer: ${order.customerName}${order.phone ? ` (${order.phone})` : ''}`,
    addr ? `Delivery Address: ${addr}` : '',
    order.orderNotes ? `Instructions: ${order.orderNotes}` : '',
    `Ordering Channel: ${order.paymentMethod || 'whatsapp_order'} | Status: ${order.orderStatus} (Awaiting Confirmation)`,
    '',
    ...lines,
    '',
    `Subtotal: ${fmt(order.subtotal)}`,
    `Delivery: ${order.shippingFee === 0 ? 'Free / Quote Pending' : fmt(order.shippingFee)}`,
    `Total: ${fmt(order.totalAmount)}`,
    '',
    'Please confirm stock availability and final dispatch details from your official desk.',
  ]
    .filter((l, idx) => idx === 5 || idx === 7 || idx === 11 || Boolean(l))
    .join('\n');
}

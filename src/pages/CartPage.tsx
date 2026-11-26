import {ChangeEvent, FormEvent, useEffect, useMemo, useState} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Lock,
  MessageCircle,
  Minus,
  Plus,
  Printer,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
import SafeImage from '../components/SafeImage';
import {useStore} from '../context/StoreContext';
import {
  fetchServerOrderQuote,
  recordWhatsAppOrderIntent,
  type ServerQuoteResponse,
  submitBankTransferProof,
  submitServerOrder,
} from '../services/commerceApi';
import type {DeliveryMethodId, OrderRecord, PaymentMethodId} from '../types/admin';
import {
  buildCartWhatsAppMessage,
  buildOrderWhatsAppSummary,
  buildWhatsAppLink,
  calculateShipping,
  formatMoney,
  formatSingleCurrency,
  resolveBrandWhatsappNumber,
} from '../utils/currency';
import {buildPagePath, updatePageSeo} from '../utils/seo';

const RECENT_ORDER_STORAGE_KEY = 'ceylon_recent_order_receipt_v1';
const MAX_SLIP_BYTES = 2 * 1024 * 1024;

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `chk-${crypto.randomUUID()}`;
  }
  return `chk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read selected file.'));
    reader.readAsDataURL(file);
  });
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CartPage() {
  const {
    cart,
    cartSubtotalLkr,
    cartSubtotalUsd,
    cartWeightGrams,
    currency,
    lang,
    t,
    commerceConfig,
    refreshCatalog,
    updateQuantity,
    removeFromCart,
    clearCart,
    navigate,
  } = useStore();

  const isSi = lang === 'si';

  // Checkout Form State
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryChoice, setCountryChoice] = useState('Sri Lanka');
  const [customCountry, setCustomCountry] = useState('');
  const [localZoneId, setLocalZoneId] = useState('colombo-suburbs');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethodId>('local_standard');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>('whatsapp_order');
  const [paymentReference, setPaymentReference] = useState('');
  const [slipData, setSlipData] = useState<{base64: string; name: string; mime: string} | null>(null);

  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => newIdempotencyKey());
  const [serverQuote, setServerQuote] = useState<ServerQuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Placed Order Receipt State
  const [placedOrder, setPlacedOrder] = useState<OrderRecord | null>(() => {
    try {
      const raw = sessionStorage.getItem(RECENT_ORDER_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as OrderRecord) : null;
    } catch {
      return null;
    }
  });
  const [proofRefInput, setProofRefInput] = useState('');
  const [proofSlipData, setProofSlipData] = useState<{base64: string; name: string} | null>(null);
  const [proofMsg, setProofMsg] = useState('');
  const [proofBusy, setProofBusy] = useState(false);

  useEffect(() => {
    updatePageSeo({
      title: isSi
        ? 'සාප්පු කරත්තය සහ ඇණවුම් කිරීම | සෙයිලෝන් හෙරිටේජ් හවුස්'
        : 'Shopping Cart & Checkout | Ceylon Heritage House',
      description: isSi
        ? 'ඔබ තෝරාගත් සෙයිවානා කුළුබඩු සහ සෙයිලෝමිරා තේ ඇණවුම් පරීක්ෂා කර බෙදාහැරීම සම්පූර්ණ කරන්න.'
        : 'Review your selected Ceyvana spices and Ceylomira teas, choose delivery zones, and complete your order.',
      page: 'cart',
      lang,
      noindex: true,
    });
  }, [lang, isSi]);

  const effectiveCountry =
    countryChoice === '__OTHER__' ? customCountry.trim() || 'Rest of World' : countryChoice;
  const isSriLanka = effectiveCountry.toLowerCase() === 'sri lanka';

  const enabledLocalZones = useMemo(
    () => (commerceConfig?.shipping.localZones ?? []).filter((z) => z.enabled),
    [commerceConfig],
  );
  const enabledIntlCountries = useMemo(
    () =>
      (commerceConfig?.shipping.internationalRates ?? []).filter(
        (r) => r.enabled && r.country.toLowerCase() !== 'rest of world',
      ),
    [commerceConfig],
  );

  // Sync valid defaults when switching Sri Lanka <-> International
  useEffect(() => {
    if (isSriLanka) {
      if (deliveryMethod !== 'local_standard' && deliveryMethod !== 'local_express') {
        setDeliveryMethod('local_standard');
      }
      if (enabledLocalZones.length > 0 && !enabledLocalZones.some((z) => z.id === localZoneId)) {
        setLocalZoneId(enabledLocalZones[0].id);
      }
    } else {
      if (deliveryMethod !== 'international_courier' && deliveryMethod !== 'international_quote') {
        setDeliveryMethod('international_courier');
      }
      if (paymentMethod === 'cod') {
        setPaymentMethod(
          commerceConfig?.payment.whatsappOrderEnabled !== false ? 'whatsapp_order' : 'bank_transfer',
        );
      }
    }
  }, [isSriLanka, deliveryMethod, enabledLocalZones, localZoneId, paymentMethod, commerceConfig]);

  useEffect(() => {
    if (
      commerceConfig &&
      commerceConfig.payment.whatsappOrderEnabled === false &&
      paymentMethod === 'whatsapp_order'
    ) {
      setPaymentMethod('bank_transfer');
    }
  }, [commerceConfig, paymentMethod]);

  // Refresh server-authoritative quote whenever cart or delivery inputs change
  useEffect(() => {
    if (cart.length === 0) {
      setServerQuote(null);
      setQuoteError('');
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const quote = await fetchServerOrderQuote({
          items: cart.map((c) => ({
            productId: c.productId,
            variantSku: c.variantSku,
            qty: c.quantity,
          })),
          currency,
          country: effectiveCountry,
          deliveryMethod,
          localZoneId: isSriLanka ? localZoneId : undefined,
        });
        if (!cancelled) {
          setServerQuote(quote);
          setQuoteError('');
        }
      } catch (err) {
        if (!cancelled) {
          setQuoteError(err instanceof Error ? err.message : '');
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cart, currency, effectiveCountry, deliveryMethod, localZoneId, isSriLanka]);

  // Regenerate idempotency key if customer modifies cart items
  useEffect(() => {
    setIdempotencyKey(newIdempotencyKey());
  }, [cart.length, cartSubtotalLkr, paymentMethod]);

  const fallbackShipping = calculateShipping(
    cartSubtotalLkr,
    cartSubtotalUsd,
    cartWeightGrams,
    isSriLanka ? 'local' : 'international',
  );
  const currCfg = commerceConfig?.currencies?.find(
    (c) => c.code.toUpperCase() === currency.toUpperCase(),
  );
  const fallbackSub =
    currency === 'LKR'
      ? cartSubtotalLkr
      : currency === 'USD'
        ? cartSubtotalUsd
        : Number((cartSubtotalUsd * (currCfg?.ratePerUsd || 1)).toFixed(2));
  const fallbackShipAmt =
    currency === 'LKR'
      ? fallbackShipping.lkr
      : currency === 'USD'
        ? fallbackShipping.usd
        : Number((fallbackShipping.usd * (currCfg?.ratePerUsd || 1)).toFixed(2));
  const displaySubtotal = serverQuote?.subtotal ?? fallbackSub;
  const displayShippingFee = serverQuote?.shippingFee ?? fallbackShipAmt;
  const displayTotal =
    serverQuote?.totalAmount ??
    (currency === 'LKR'
      ? Math.round(fallbackSub + fallbackShipAmt)
      : Number((fallbackSub + fallbackShipAmt).toFixed(2)));

  const fmtAmt = (amt: number) =>
    formatSingleCurrency(amt, currency, commerceConfig?.currencies);

  const bankDetails = commerceConfig?.payment.bankDetails;
  const freeThreshold = commerceConfig?.shipping.freeShippingThresholdLkr ?? 15000;
  const distinctCartBrands = Array.from(new Set(cart.map((c) => c.brandId)));
  const cartBrandScope = distinctCartBrands.length === 1 ? distinctCartBrands[0] : 'mixed';
  const whatsappNumber = resolveBrandWhatsappNumber(cartBrandScope, commerceConfig);

  const cartWhatsappUrl = buildWhatsAppLink(
    buildCartWhatsAppMessage(
      cart,
      currency,
      lang,
      serverQuote?.shippingLabel || effectiveCountry,
      displayShippingFee,
      {
        name: customerName.trim() || undefined,
        phone: phone.trim() || undefined,
        address: [address.trim(), city.trim(), effectiveCountry].filter(Boolean).join(', ') || undefined,
        notes: orderNotes.trim() || undefined,
      },
    ),
    whatsappNumber,
  );

  const handleSlipSelect = async (e: ChangeEvent<HTMLInputElement>, target: 'checkout' | 'proof') => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      const msg = 'Payment slip must be a JPEG, PNG, WebP image or PDF document.';
      if (target === 'checkout') setSubmitError(msg);
      else setProofMsg(msg);
      return;
    }
    if (file.size > MAX_SLIP_BYTES) {
      const msg = 'Payment slip exceeds 2MB maximum file size.';
      if (target === 'checkout') setSubmitError(msg);
      else setProofMsg(msg);
      return;
    }
    const base64 = await readFileAsBase64(file);
    if (target === 'checkout') {
      setSubmitError('');
      setSlipData({base64, name: file.name, mime: file.type});
    } else {
      setProofMsg('');
      setProofSlipData({base64, name: file.name});
    }
  };

  const handleCheckoutSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || submitting) {
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const created = await submitServerOrder({
        idempotencyKey,
        currency,
        customerName: customerName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        country: effectiveCountry,
        address: address.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        orderNotes: orderNotes.trim() || undefined,
        deliveryMethod,
        localZoneId: isSriLanka ? localZoneId : undefined,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        paymentSlipBase64: slipData?.base64,
        paymentSlipName: slipData?.name,
        paymentSlipMime: slipData?.mime,
        items: cart.map((c) => ({
          productId: c.productId,
          variantSku: c.variantSku,
          qty: c.quantity,
        })),
      });
      setPlacedOrder(created);
      setProofRefInput(created.paymentReference || '');
      try {
        sessionStorage.setItem(RECENT_ORDER_STORAGE_KEY, JSON.stringify(created));
      } catch {
        // Ignore storage errors
      }
      clearCart();
      setIdempotencyKey(newIdempotencyKey());
      void refreshCatalog();
      window.scrollTo({top: 0, behavior: 'smooth'});
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to place order. Please check your details.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachBankProof = async (e: FormEvent) => {
    e.preventDefault();
    if (!placedOrder || !placedOrder.receiptToken) {
      return;
    }
    setProofBusy(true);
    setProofMsg('');
    try {
      const updated = await submitBankTransferProof({
        orderRef: placedOrder.orderRef,
        receiptToken: placedOrder.receiptToken,
        paymentReference: proofRefInput.trim() || undefined,
        paymentSlipBase64: proofSlipData?.base64,
      });
      setPlacedOrder(updated);
      setProofSlipData(null);
      try {
        sessionStorage.setItem(RECENT_ORDER_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      setProofMsg(
        'Bank transfer reference and slip submitted. Your order is now in Payment Verification.',
      );
    } catch (err) {
      setProofMsg(err instanceof Error ? err.message : 'Failed to submit bank proof.');
    } finally {
      setProofBusy(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Placed Order Confirmation & Receipt View
  // ---------------------------------------------------------------------------
  if (placedOrder && cart.length === 0) {
    const orderCurrencyFmt = (val: number) =>
      formatSingleCurrency(val, placedOrder.currency, commerceConfig?.currencies);

    const orderDistinctBrands = Array.from(new Set(placedOrder.items.map((i) => i.brandId)));
    const orderWhatsappNumber = resolveBrandWhatsappNumber(
      orderDistinctBrands.length === 1 ? orderDistinctBrands[0] : 'mixed',
      commerceConfig,
    );
    const whatsappSummary = buildOrderWhatsAppSummary({
      orderRef: placedOrder.orderRef,
      customerName: placedOrder.customerName,
      phone: placedOrder.phone,
      address: placedOrder.address,
      city: placedOrder.city,
      country: placedOrder.country,
      orderNotes: placedOrder.orderNotes,
      currency: placedOrder.currency,
      subtotal: placedOrder.subtotal,
      shippingFee: placedOrder.shippingFee,
      totalAmount: placedOrder.totalAmount,
      paymentMethod: placedOrder.paymentMethod,
      orderStatus: placedOrder.orderStatus,
      items: placedOrder.items,
    });
    const orderWhatsappHref = buildWhatsAppLink(whatsappSummary, orderWhatsappNumber);

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-6 text-[#F3EBDD]">
        <div className="bg-[#211C1A] border border-[#C6A46A]/30 rounded-lg p-6 sm:p-8 space-y-6 luxury-card-shadow">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#C6A46A]/20 pb-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-[#86EFAC] text-sm font-medium">
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                <span>
                  {isSi ? 'ඇණවුම සාර්ථකව සටහන් විය' : 'Order Recorded — Awaiting Official Confirmation'}
                </span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-medium text-[#F3EBDD]">
                Order {placedOrder.orderRef}
              </h1>
              <p className="text-xs text-[#A99B88]">
                {placedOrder.customerName} · {placedOrder.customerEmail} · {placedOrder.phone}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[#C6A46A]/55 text-[#F3EBDD] rounded-md hover:border-[#C6A46A] hover:bg-[#C6A46A]/10 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#C6A46A]" />
                <span>Print Summary</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlacedOrder(null);
                  try {
                    sessionStorage.removeItem(RECENT_ORDER_STORAGE_KEY);
                  } catch {
                    // Ignore
                  }
                  navigate('ceyvana');
                }}
                className="px-3.5 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>
          </div>

          {/* Separate Order Status vs Payment Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#151312] border border-[#3B332E] rounded-md p-4 text-sm">
            <div>
              <p className="text-xs text-[#A99B88]">Order Status</p>
              <p className="font-medium text-[#C6A46A] mt-0.5">
                {formatStatusLabel(placedOrder.orderStatus)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#A99B88]">Payment Status</p>
              <p className="font-medium text-[#F3EBDD] mt-0.5">
                {formatStatusLabel(placedOrder.paymentStatus)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#A99B88]">Payment &amp; Shipping</p>
              <p className="font-medium text-[#F3EBDD] mt-0.5">
                {formatStatusLabel(placedOrder.paymentMethod || 'bank_transfer')} ·{' '}
                {formatStatusLabel(placedOrder.shippingStatus || 'not_dispatched')}
              </p>
            </div>
          </div>

          {/* Delivery Destination */}
          <div className="text-sm space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-[#C6A46A]">
              Delivery Destination
            </p>
            <p className="text-[#D2C6B5]">
              {placedOrder.address}, {placedOrder.city}, {placedOrder.postalCode},{' '}
              {placedOrder.country}
            </p>
            {placedOrder.orderNotes && (
              <p className="text-xs text-[#A99B88]">Notes: {placedOrder.orderNotes}</p>
            )}
          </div>

          {/* Itemized Price Snapshot */}
          <div className="border border-[#3B332E] rounded-md overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#151312] border-b border-[#3B332E] text-xs text-[#C6A46A]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Item &amp; Pack Size</th>
                  <th className="px-4 py-2.5 font-medium text-right">Qty</th>
                  <th className="px-4 py-2.5 font-medium text-right">Unit Price</th>
                  <th className="px-4 py-2.5 font-medium text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3B332E] bg-[#211C1A]">
                {placedOrder.items.map((item) => (
                  <tr key={item.variantSku}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-[#F3EBDD]">{item.name}</p>
                      <p className="text-[11px] font-mono-tabular text-[#A99B88]">
                        {item.brandId.toUpperCase()} · {item.variantSku}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-tabular text-[#D2C6B5]">{item.qty}</td>
                    <td className="px-4 py-2.5 text-right font-mono-tabular text-[#D2C6B5]">
                      {orderCurrencyFmt(item.unitPrice)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-tabular font-medium text-[#C6A46A]">
                      {orderCurrencyFmt(item.unitPrice * item.qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#151312] border-t border-[#3B332E] text-sm">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-[#D2C6B5]">
                    Subtotal
                  </td>
                  <td className="px-4 py-2 text-right font-mono-tabular text-[#F3EBDD]">
                    {orderCurrencyFmt(placedOrder.subtotal)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-[#D2C6B5]">
                    Delivery ({formatStatusLabel(placedOrder.deliveryMethod || 'local_standard')})
                  </td>
                  <td className="px-4 py-2 text-right font-mono-tabular text-[#F3EBDD]">
                    {placedOrder.deliveryMethod === 'international_quote'
                      ? 'Quotation Pending'
                      : placedOrder.shippingFee === 0
                        ? 'Free'
                        : orderCurrencyFmt(placedOrder.shippingFee)}
                  </td>
                </tr>
                <tr className="font-medium text-base">
                  <td colSpan={3} className="px-4 py-3 text-right text-[#F3EBDD] border-t border-[#3B332E]">
                    Order Total
                  </td>
                  <td className="px-4 py-3 text-right font-mono-tabular text-[#C6A46A] border-t border-[#3B332E]">
                    {orderCurrencyFmt(placedOrder.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Bank Transfer Instructions & Reference / Slip Submission */}
          {placedOrder.paymentMethod === 'bank_transfer' && (
            <div className="bg-[#151312] border border-[#3B332E] rounded-md p-5 space-y-4">
              <div className="space-y-1">
                <h2 className="font-medium text-base text-[#F3EBDD]">
                  Bank Transfer Verification Details
                </h2>
                <p className="text-xs text-[#A99B88]">
                  Orders remain in Pending Verification until our accounts team verifies receipt of funds.
                </p>
              </div>

              {bankDetails && (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-[#211C1A] border border-[#3B332E] rounded p-3.5">
                  <div>
                    <dt className="text-[#A99B88]">Bank</dt>
                    <dd className="font-medium text-[#F3EBDD]">{bankDetails.bankName}</dd>
                  </div>
                  <div>
                    <dt className="text-[#A99B88]">Account Name</dt>
                    <dd className="font-medium text-[#F3EBDD]">{bankDetails.accountName}</dd>
                  </div>
                  <div>
                    <dt className="text-[#A99B88]">Account Number</dt>
                    <dd className="font-mono-tabular font-medium text-[#C6A46A]">
                      {bankDetails.accountNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#A99B88]">Branch / SWIFT</dt>
                    <dd className="font-mono-tabular text-[#F3EBDD]">
                      {bankDetails.branchName} · {bankDetails.swiftCode}
                    </dd>
                  </div>
                </dl>
              )}

              {placedOrder.paymentStatus !== 'paid' && placedOrder.orderStatus !== 'cancelled' && (
                <form onSubmit={handleAttachBankProof} className="space-y-3 print:hidden">
                  {proofMsg && (
                    <div className="p-2.5 text-xs bg-[#2A2522] border border-[#C6A46A] text-[#F3EBDD] rounded">
                      {proofMsg}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="proof-bank-ref" className="block text-xs font-medium text-[#D2C6B5] mb-1">
                        Bank Transfer Reference Number
                      </label>
                      <input
                        id="proof-bank-ref"
                        type="text"
                        value={proofRefInput}
                        onChange={(e) => setProofRefInput(e.target.value)}
                        placeholder={`e.g. TXN-${placedOrder.orderRef}`}
                        className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded focus:outline-none focus:border-[#C6A46A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                        Upload Payment Slip (JPEG/PNG/WebP/PDF, max 2MB)
                      </label>
                      <label className="flex items-center gap-2 px-3 py-2 text-xs bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded cursor-pointer hover:bg-[#352F2B]">
                        <FileUp className="w-4 h-4 text-[#C6A46A]" />
                        <span className="truncate">
                          {proofSlipData?.name ||
                            (placedOrder.paymentSlipFile
                              ? `Uploaded (${placedOrder.paymentSlipFile})`
                              : 'Choose payment slip')}
                        </span>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.pdf"
                          onChange={(e) => void handleSlipSelect(e, 'proof')}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={proofBusy}
                    className="px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] cursor-pointer disabled:opacity-50"
                  >
                    {proofBusy ? 'Submitting...' : 'Submit / Update Bank Proof'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* WhatsApp Handoff with explicit non-confirmation warning */}
          <div className="border-t border-[#C6A46A]/20 pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
            <div className="space-y-1 max-w-xl">
              <p className="text-xs font-medium text-[#F3EBDD]">
                {placedOrder.paymentMethod === 'whatsapp_order'
                  ? 'Send This Official Order Summary to WhatsApp'
                  : 'Share Order Summary via Official WhatsApp Desk'}
              </p>
              <p className="text-xs text-[#A99B88] leading-relaxed">
                Note: Opening WhatsApp prepares your itemized message only and does not automatically confirm your order. Official confirmation is issued by our business team after stock and delivery verification.
              </p>
            </div>
            <a
              href={orderWhatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (placedOrder.receiptToken) {
                  void recordWhatsAppOrderIntent(placedOrder.orderRef, placedOrder.receiptToken);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium bg-[#123D32] border border-[#C6A46A]/55 text-[#F3EBDD] rounded-md hover:brightness-110 shrink-0"
            >
              <MessageCircle className="w-4 h-4 text-[#C6A46A]" />
              <span>Send {placedOrder.orderRef} via WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Empty / Active Cart View
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-6 text-[#F3EBDD]">
      <Breadcrumbs items={[{label: t.nav.home, page: 'home'}, {label: t.cart.title}]} />
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-8">
        <h1 className="font-display text-4xl font-medium text-[#F3EBDD]">{t.cart.title}</h1>
        {placedOrder && (
          <button
            type="button"
            onClick={() => clearCart()}
            className="text-xs underline underline-offset-4 text-[#C6A46A] cursor-pointer"
          >
            View Recent Receipt ({placedOrder.orderRef})
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-lg p-12 text-center space-y-4 luxury-card-shadow">
          <ShoppingBag className="w-10 h-10 text-[#C6A46A]/55 mx-auto" aria-hidden="true" />
          <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
            {t.cart.emptyTitle}
          </h2>
          <p className="text-sm text-[#D2C6B5] max-w-md mx-auto">{t.cart.emptyBody}</p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('ceyvana')}
              className="px-5 py-2.5 text-sm font-medium bg-[#501C2B] border border-[#C6A46A]/50 text-[#F3EBDD] rounded-md hover:brightness-110 cursor-pointer"
            >
              {t.cart.browseCeyvana}
            </button>
            <button
              type="button"
              onClick={() => navigate('ceylomira')}
              className="px-5 py-2.5 text-sm font-medium bg-[#123D32] border border-[#C6A46A]/50 text-[#F3EBDD] rounded-md hover:brightness-110 cursor-pointer"
            >
              {t.cart.browseCeylomira}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Cart Lines + Checkout Form */}
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-lg divide-y divide-[#C6A46A]/20 luxury-card-shadow">
              {cart.map((item) => {
                const liveStock =
                  commerceConfig?.liveStockBySku?.[item.variantSku]?.stockQuantity ?? item.maxStock;
                return (
                  <div key={item.variantSku} className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5">
                    <div className="w-28 aspect-[4/3] rounded-md overflow-hidden bg-[#151312] border border-[#3B332E] shrink-0">
                      <SafeImage
                        src={item.image}
                        alt={item.productName[lang] || item.productName.en}
                        sizes="112px"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 flex flex-col justify-between gap-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs text-[#C6A46A]">
                            {item.brandId === 'ceyvana' ? 'CEYVANA' : 'CEYLOMIRA'} ·{' '}
                            {item.variantLabel}
                          </p>
                          <h2 className="text-lg font-medium text-[#F3EBDD]">
                            <a
                              href={buildPagePath('product', {productSlug: item.productSlug, lang})}
                              onClick={(e) => {
                                e.preventDefault();
                                navigate('product', item.productSlug);
                              }}
                              className="hover:text-[#C6A46A] hover:underline underline-offset-4"
                            >
                              {item.productName[lang]}
                            </a>
                          </h2>
                          <p className="text-xs font-mono-tabular text-[#A99B88] mt-0.5">
                            {item.variantSku} · {item.weightGrams * item.quantity}g · {liveStock} available
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.variantSku)}
                          aria-label={`${t.cart.remove} ${item.productName[lang]}`}
                          className="text-xs text-[#A99B88] hover:text-[#F3B0B6] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>{t.cart.remove}</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div className="inline-flex items-center border border-[#3B332E] bg-[#2A2522] rounded-md">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.variantSku, item.quantity - 1)}
                            aria-label="Decrease quantity"
                            className="w-9 h-9 inline-flex items-center justify-center hover:bg-[#352F2B] text-[#F3EBDD] cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-3 text-sm font-mono-tabular font-medium text-[#F3EBDD]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={item.quantity >= liveStock}
                            onClick={() => updateQuantity(item.variantSku, item.quantity + 1)}
                            aria-label="Increase quantity"
                            className="w-9 h-9 inline-flex items-center justify-center hover:bg-[#352F2B] text-[#F3EBDD] disabled:opacity-35 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="text-base font-medium font-mono-tabular text-[#C6A46A]">
                          {formatMoney(
                            item.priceLkr * item.quantity,
                            item.priceUsd * item.quantity,
                            currency,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Checkout Form */}
            <form
              id="checkout-form"
              onSubmit={handleCheckoutSubmit}
              className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-lg p-6 sm:p-8 space-y-6 luxury-card-shadow"
            >
              <div className="border-b border-[#C6A46A]/20 pb-4">
                <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                  {isSi ? 'ඇණවුම් සහ බෙදාහැරීමේ විස්තර' : 'Customer & Delivery Checkout'}
                </h2>
                <p className="text-xs text-[#A99B88] mt-1">
                  All prices, stock availability, and delivery charges are verified server-side before your order is recorded.
                </p>
              </div>

              {(submitError || quoteError) && (
                <div className="p-3.5 text-sm bg-[#501C2B]/60 border border-[#C6A46A]/45 text-[#F3B0B6] rounded-md flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{submitError || quoteError}</span>
                </div>
              )}

              {/* Contact Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="chk-name" className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    Full Name *
                  </label>
                  <input
                    id="chk-name"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label htmlFor="chk-email" className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    Email Address *
                  </label>
                  <input
                    id="chk-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label htmlFor="chk-phone" className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    Phone / WhatsApp Number *
                  </label>
                  <input
                    id="chk-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+94 77 123 4567"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
              </div>

              {/* Country, Zone, Delivery Method */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="chk-country" className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    Destination Country *
                  </label>
                  <select
                    id="chk-country"
                    value={countryChoice}
                    onChange={(e) => setCountryChoice(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  >
                    <option value="Sri Lanka">Sri Lanka (Local Delivery)</option>
                    {enabledIntlCountries.map((r) => (
                      <option key={r.country} value={r.country}>
                        {r.country}
                      </option>
                    ))}
                    <option value="__OTHER__">Other Country (Rest of World)</option>
                  </select>
                </div>

                {countryChoice === '__OTHER__' && (
                  <div>
                    <label htmlFor="chk-custom-country" className="block text-xs font-medium text-[#D2C6B5] mb-1">
                      Specify Country *
                    </label>
                    <input
                      id="chk-custom-country"
                      type="text"
                      required
                      value={customCountry}
                      onChange={(e) => setCustomCountry(e.target.value)}
                      placeholder="e.g. France"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                )}

                {isSriLanka && enabledLocalZones.length > 0 && (
                  <div>
                    <label htmlFor="chk-zone" className="block text-xs font-medium text-[#D2C6B5] mb-1">
                      Sri Lankan Delivery Zone *
                    </label>
                    <select
                      id="chk-zone"
                      value={localZoneId}
                      onChange={(e) => setLocalZoneId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    >
                      {enabledLocalZones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name} (LKR {z.baseRateLkr})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label htmlFor="chk-method" className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    Delivery Method *
                  </label>
                  <select
                    id="chk-method"
                    value={deliveryMethod}
                    onChange={(e) => setDeliveryMethod(e.target.value as DeliveryMethodId)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  >
                    {isSriLanka ? (
                      <>
                        <option value="local_standard">Standard Courier (2–4 Business Days)</option>
                        <option value="local_express">Priority Express Courier</option>
                      </>
                    ) : (
                      <>
                        <option value="international_courier">International Air Express</option>
                        {(commerceConfig?.shipping.internationalQuoteEnabled ?? true) && (
                          <option value="international_quote">
                            Request Custom Shipping Quotation
                          </option>
                        )}
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Address */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-6">
                  <label htmlFor="chk-address" className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    Delivery Address *
                  </label>
                  <input
                    id="chk-address"
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, house/apt number"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label htmlFor="chk-city" className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    City *
                  </label>
                  <input
                    id="chk-city"
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label htmlFor="chk-postal" className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    Postal Code *
                  </label>
                  <input
                    id="chk-postal"
                    type="text"
                    required
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="chk-notes" className="block text-xs font-medium text-[#D2C6B5] mb-1">
                  Order Notes / Delivery Instructions
                </label>
                <textarea
                  id="chk-notes"
                  rows={2}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                />
              </div>

              {/* Payment & Ordering Method Section */}
              <div className="space-y-4 pt-4 border-t border-[#C6A46A]/20">
                <h3 className="text-sm font-medium text-[#F3EBDD]">
                  {isSi ? 'ඇණවුම් කිරීමේ සහ ගෙවීමේ ක්‍රමය' : 'Ordering & Settlement Method'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(commerceConfig?.payment.whatsappOrderEnabled ?? true) && (
                    <label
                      className={`p-3.5 border rounded-md cursor-pointer text-sm flex items-start gap-2.5 ${
                        paymentMethod === 'whatsapp_order'
                          ? 'border-[#C6A46A] bg-[#2A2522]'
                          : 'border-[#3B332E] bg-[#151312]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === 'whatsapp_order'}
                        onChange={() => setPaymentMethod('whatsapp_order')}
                        className="mt-1 accent-[#C6A46A]"
                      />
                      <div>
                        <p className="font-medium text-[#F3EBDD]">
                          Order via WhatsApp (Recommended)
                        </p>
                        <p className="text-xs text-[#A99B88] mt-0.5">
                          Records your itemized order as New and prepares your formatted WhatsApp message for direct team confirmation.
                        </p>
                      </div>
                    </label>
                  )}

                  {(commerceConfig?.payment.bankTransferEnabled ?? true) && (
                    <label
                      className={`p-3.5 border rounded-md cursor-pointer text-sm flex items-start gap-2.5 ${
                        paymentMethod === 'bank_transfer'
                          ? 'border-[#C6A46A] bg-[#2A2522]'
                          : 'border-[#3B332E] bg-[#151312]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === 'bank_transfer'}
                        onChange={() => setPaymentMethod('bank_transfer')}
                        className="mt-1 accent-[#C6A46A]"
                      />
                      <div>
                        <p className="font-medium text-[#F3EBDD]">Bank Transfer / Deposit</p>
                        <p className="text-xs text-[#A99B88] mt-0.5">
                          Submit payment reference or slip. Held in verification until confirmed.
                        </p>
                      </div>
                    </label>
                  )}

                  {commerceConfig?.payment.codEnabled && isSriLanka && (
                    <label
                      className={`p-3.5 border rounded-md cursor-pointer text-sm flex items-start gap-2.5 ${
                        paymentMethod === 'cod'
                          ? 'border-[#C6A46A] bg-[#2A2522]'
                          : 'border-[#3B332E] bg-[#151312]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === 'cod'}
                        onChange={() => setPaymentMethod('cod')}
                        className="mt-1 accent-[#C6A46A]"
                      />
                      <div>
                        <p className="font-medium text-[#F3EBDD]">Payment on Delivery (Sri Lanka)</p>
                        <p className="text-xs text-[#A99B88] mt-0.5">
                          Pay upon islandwide courier handoff.
                        </p>
                      </div>
                    </label>
                  )}

                  {commerceConfig?.payment.slGatewayEnabled && (
                    <label
                      className={`p-3.5 border rounded-md cursor-pointer text-sm flex items-start gap-2.5 ${
                        paymentMethod === 'sl_gateway'
                          ? 'border-[#C6A46A] bg-[#2A2522]'
                          : 'border-[#3B332E] bg-[#151312]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === 'sl_gateway'}
                        onChange={() => setPaymentMethod('sl_gateway')}
                        className="mt-1 accent-[#C6A46A]"
                      />
                      <div>
                        <p className="font-medium text-[#F3EBDD]">
                          Sri Lankan Payment Gateway{' '}
                          {commerceConfig.payment.sandboxMode ? '(Sandbox)' : ''}
                        </p>
                        <p className="text-xs text-[#A99B88] mt-0.5">
                          Hosted gateway session verified server-side via webhook.
                        </p>
                      </div>
                    </label>
                  )}

                  {commerceConfig?.payment.intlGatewayEnabled && (
                    <label
                      className={`p-3.5 border rounded-md cursor-pointer text-sm flex items-start gap-2.5 ${
                        paymentMethod === 'intl_gateway'
                          ? 'border-[#C6A46A] bg-[#2A2522]'
                          : 'border-[#3B332E] bg-[#151312]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === 'intl_gateway'}
                        onChange={() => setPaymentMethod('intl_gateway')}
                        className="mt-1 accent-[#C6A46A]"
                      />
                      <div>
                        <p className="font-medium text-[#F3EBDD]">
                          International Payment Gateway{' '}
                          {commerceConfig.payment.sandboxMode ? '(Sandbox)' : ''}
                        </p>
                        <p className="text-xs text-[#A99B88] mt-0.5">
                          Hosted international checkout verified via signed webhook.
                        </p>
                      </div>
                    </label>
                  )}
                </div>

                {/* Bank Transfer Instructions & Optional Slip Upload */}
                {paymentMethod === 'bank_transfer' && (
                  <div className="bg-[#151312] border border-[#3B332E] rounded-md p-4 space-y-4">
                    {bankDetails && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-[#C6A46A]">
                          Official Bank Transfer Instructions
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-[#211C1A] border border-[#3B332E] rounded p-3 text-[#F3EBDD]">
                          <p>
                            <span className="text-[#A99B88]">Bank:</span> {bankDetails.bankName}
                          </p>
                          <p>
                            <span className="text-[#A99B88]">Account:</span>{' '}
                            <span className="font-mono-tabular font-medium text-[#C6A46A]">
                              {bankDetails.accountNumber}
                            </span>
                          </p>
                          <p>
                            <span className="text-[#A99B88]">Name:</span> {bankDetails.accountName}
                          </p>
                          <p>
                            <span className="text-[#A99B88]">Branch / SWIFT:</span>{' '}
                            {bankDetails.branchName} ({bankDetails.swiftCode})
                          </p>
                        </div>
                        <p className="text-xs text-[#A99B88]">{bankDetails.instructions}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="chk-bank-ref" className="block text-xs font-medium text-[#D2C6B5] mb-1">
                          Payment Reference (Optional now, or submit after order)
                        </label>
                        <input
                          id="chk-bank-ref"
                          type="text"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder="Transfer reference / receipt ID"
                          className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] placeholder:text-[#A99B88] rounded focus:outline-none focus:border-[#C6A46A]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                          Optional Payment Slip (JPG, PNG, WebP, PDF · max 2MB)
                        </label>
                        <label className="flex items-center gap-2 px-3 py-2 text-xs bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded cursor-pointer hover:bg-[#352F2B]">
                          <FileUp className="w-4 h-4 text-[#C6A46A]" />
                          <span className="truncate">
                            {slipData ? slipData.name : 'Attach bank slip image/PDF'}
                          </span>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,.pdf"
                            onChange={(e) => void handleSlipSelect(e, 'checkout')}
                            className="sr-only"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {(paymentMethod === 'sl_gateway' || paymentMethod === 'intl_gateway') && (
                  <div className="bg-[#151312] border border-[#3B332E] rounded-md p-4 text-xs text-[#D2C6B5] space-y-1">
                    <p className="font-medium text-[#C6A46A]">
                      {commerceConfig?.payment.sandboxMode
                        ? 'Sandbox Payment Adapter Selected'
                        : 'Hosted Gateway Checkout'}
                    </p>
                    <p>
                      No card numbers or CVV are ever collected on this site. Submitting creates a verified payment intent; order payment status updates only after a signed server webhook confirmation.
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || Boolean(quoteError)}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] disabled:opacity-45 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Submitting Order...'
                    : `Place Official Order · ${fmtAmt(displayTotal)}`}
                </span>
              </button>
            </form>
          </div>

          {/* Right Summary Column */}
          <aside className="lg:col-span-4 bg-[#211C1A] border border-[#C6A46A]/25 rounded-lg p-6 space-y-5 lg:sticky lg:top-24 luxury-card-shadow">
            <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">Order Summary</h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-[#D2C6B5]">
                <span>{t.cart.totalWeight}</span>
                <span className="font-mono-tabular">
                  {serverQuote?.totalWeightGrams ?? cartWeightGrams}g
                </span>
              </div>
              <div className="flex justify-between text-[#D2C6B5]">
                <span>{t.cart.subtotal}</span>
                <span className="font-mono-tabular text-[#F3EBDD]">{fmtAmt(displaySubtotal)}</span>
              </div>
              <div className="flex justify-between gap-3 text-[#D2C6B5]">
                <span>{serverQuote?.shippingLabel || t.cart.shippingEstimate}</span>
                <span className="font-mono-tabular shrink-0 text-[#F3EBDD]">
                  {serverQuote?.isQuotePending
                    ? 'Quote Pending'
                    : displayShippingFee === 0
                      ? 'Free'
                      : fmtAmt(displayShippingFee)}
                </span>
              </div>
              {isSriLanka ? (
                <p className="text-xs text-[#86EFAC]">
                  {cartSubtotalLkr >= freeThreshold
                    ? 'Complimentary standard islandwide shipping unlocked.'
                    : `Free standard local shipping on orders over LKR ${freeThreshold.toLocaleString('en-US')}.`}
                </p>
              ) : (
                serverQuote?.shippingPolicyNote && (
                  <p className="text-[11px] text-[#A99B88] bg-[#151312] border border-[#3B332E] rounded p-2.5 leading-relaxed">
                    {serverQuote.shippingPolicyNote}
                  </p>
                )
              )}
              <div className="flex justify-between text-base font-medium text-[#F3EBDD] pt-3 border-t border-[#C6A46A]/20">
                <span>{t.cart.estimatedTotal}</span>
                <span className="font-mono-tabular text-[#C6A46A]">{fmtAmt(displayTotal)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#C6A46A]/20 space-y-3">
              <a
                href={cartWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium border border-[#C6A46A]/55 text-[#F3EBDD] rounded-md hover:border-[#C6A46A] hover:bg-[#C6A46A]/10 transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-[#C6A46A]" />
                <span>{t.cart.whatsappOrder}</span>
              </a>
              <p className="text-[11px] text-[#A99B88] leading-relaxed">
                Opening WhatsApp prepares your order summary only and does not confirm your order. Official confirmation is sent by our business team.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

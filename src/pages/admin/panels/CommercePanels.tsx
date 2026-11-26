import {FormEvent, useCallback, useEffect, useState} from 'react';
import {Copy, Download, ExternalLink, Printer, Search} from 'lucide-react';
import {useStore} from '../../../context/StoreContext';
import {
  adminIssueOrderRefund,
  adminRespondInternationalEnquiry,
  adminUpdateOrderDetails,
  adminVerifyOrderBankTransfer,
  downloadAdminEnquiriesCsv,
  fetchAdminInternationalEnquiries,
  fetchAdminOrders,
  fetchAdminSlipObjectUrl,
} from '../../../services/commerceApi';
import {
  deletePromotion,
  fetchCustomersList,
  fetchEnquiriesList,
  fetchOrdersList,
  fetchPaginated,
  savePromotion,
  updateEnquiryStatus,
  updateOrderStatuses,
} from '../../../services/firestoreService';
import type {
  AdminSectionId,
  CustomerRecord,
  EnquiryRecord,
  InternationalEnquiryRecord,
  InternationalEnquiryStatus,
  OrderRecord,
  OrderStatus,
  PromotionRecord,
  ShippingStatus,
} from '../../../types/admin';
import type {BrandId, CurrencyCode, InternationalBusinessType} from '../../../types/commerce';
import {formatSingleCurrency} from '../../../utils/currency';

interface CommercePanelsProps {
  section: Extract<
    AdminSectionId,
    'orders' | 'customers' | 'enquiries' | 'intl_enquiries' | 'promotions'
  >;
}

const INTL_STATUS_OPTIONS: {value: InternationalEnquiryStatus; label: string}[] = [
  {value: 'new', label: 'New'},
  {value: 'reviewed', label: 'Reviewed'},
  {value: 'quoted', label: 'Quoted'},
  {value: 'responded', label: 'Responded'},
  {value: 'archived', label: 'Archived'},
];

const BUSINESS_TYPE_OPTIONS: InternationalBusinessType[] = [
  'Importer',
  'Distributor',
  'Wholesaler',
  'Retailer',
  'Private Label Buyer',
  'Other',
];

const ORDER_STATUS_OPTIONS: {value: OrderStatus; label: string}[] = [
  {value: 'new', label: 'New'},
  {value: 'contacted', label: 'Contacted'},
  {value: 'confirmed', label: 'Confirmed'},
  {value: 'processing', label: 'Processing'},
  {value: 'dispatched', label: 'Dispatched'},
  {value: 'completed', label: 'Completed'},
  {value: 'cancelled', label: 'Cancelled'},
  {value: 'pending', label: 'Pending (Legacy)'},
  {value: 'awaiting_payment', label: 'Awaiting Payment'},
  {value: 'payment_verification', label: 'Payment Verification'},
  {value: 'shipped', label: 'Shipped'},
  {value: 'delivered', label: 'Delivered'},
];

const SHIPPING_STATUS_OPTIONS: {value: ShippingStatus; label: string}[] = [
  {value: 'not_dispatched', label: 'Not Dispatched'},
  {value: 'label_created', label: 'Label Created'},
  {value: 'in_transit', label: 'In Transit'},
  {value: 'out_for_delivery', label: 'Out for Delivery'},
  {value: 'delivered', label: 'Delivered'},
  {value: 'returned', label: 'Returned'},
];

function labelize(v?: string): string {
  return (v || '—').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CommercePanels({section}: CommercePanelsProps) {
  const {refreshCatalog, availableCurrencies} = useStore();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([]);
  const [intlEnquiries, setIntlEnquiries] = useState<InternationalEnquiryRecord[]>([]);
  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // International enquiries filter & review drawer state
  const [intlSearchQ, setIntlSearchQ] = useState('');
  const [intlStatusFilter, setIntlStatusFilter] = useState<string>('all');
  const [intlTypeFilter, setIntlTypeFilter] = useState<string>('all');
  const [intlCountryFilter, setIntlCountryFilter] = useState<string>('all');
  const [selectedIntl, setSelectedIntl] = useState<InternationalEnquiryRecord | null>(null);
  const [intlEditStatus, setIntlEditStatus] = useState<InternationalEnquiryStatus>('reviewed');
  const [intlResponseText, setIntlResponseText] = useState('');
  const [quoteCurrency, setQuoteCurrency] = useState<CurrencyCode>('USD');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteShippingAmount, setQuoteShippingAmount] = useState('');
  const [quoteMoq, setQuoteMoq] = useState('');
  const [quotePolicy, setQuotePolicy] = useState('');
  const [quoteValidity, setQuoteValidity] = useState('');
  const [intlSaving, setIntlSaving] = useState(false);

  // Order search & filters
  const [searchQ, setSearchQ] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Selected order details state
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [editOrderStatus, setEditOrderStatus] = useState<OrderStatus>('pending');
  const [editShippingStatus, setEditShippingStatus] = useState<ShippingStatus>('not_dispatched');
  const [editCarrier, setEditCarrier] = useState('');
  const [editTracking, setEditTracking] = useState('');
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [verifyTxRef, setVerifyTxRef] = useState('');
  const [verifyNote, setVerifyNote] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [slipPreviewUrl, setSlipPreviewUrl] = useState<string>('');
  const [slipLoading, setSlipLoading] = useState(false);

  const [newPromo, setNewPromo] = useState<PromotionRecord>({
    code: '',
    type: 'percentage',
    value: 10,
    minOrderLkr: 5000,
    brandIds: ['ceyvana', 'ceylomira'],
    isActive: true,
    expiresAt: '2026-12-31',
  });

  const loadSection = useCallback(async () => {
    setLoading(true);
    try {
      if (section === 'orders') {
        const [serverRes, fsRes] = await Promise.allSettled([
          fetchAdminOrders({
            q: searchQ,
            brand: brandFilter,
            status: statusFilter,
            dateFrom,
            dateTo,
          }),
          fetchOrdersList(30),
        ]);
        const serverOrders = serverRes.status === 'fulfilled' ? serverRes.value.orders : [];
        const fsOrders = fsRes.status === 'fulfilled' ? fsRes.value.items : [];
        const byRef = new Map<string, OrderRecord>();
        for (const o of fsOrders) byRef.set(o.orderRef, o);
        for (const o of serverOrders) byRef.set(o.orderRef, o);
        let merged = Array.from(byRef.values());
        if (searchQ.trim()) {
          const qLower = searchQ.trim().toLowerCase();
          merged = merged.filter(
            (o) =>
              o.orderRef.toLowerCase().includes(qLower) ||
              o.customerName.toLowerCase().includes(qLower) ||
              (o.customerEmail || '').toLowerCase().includes(qLower),
          );
        }
        if (brandFilter !== 'all') {
          merged = merged.filter((o) => o.items.some((i) => i.brandId === brandFilter));
        }
        if (statusFilter !== 'all') {
          merged = merged.filter((o) => o.orderStatus === statusFilter);
        }
        setOrders(merged);
      } else if (section === 'customers') {
        const [serverRes, fsRes] = await Promise.allSettled([
          fetchAdminOrders(),
          fetchCustomersList(40),
        ]);
        const serverCust = serverRes.status === 'fulfilled' ? serverRes.value.customers : [];
        const fsCust = fsRes.status === 'fulfilled' ? fsRes.value.items : [];
        const byEmail = new Map<string, CustomerRecord>();
        for (const c of fsCust) byEmail.set((c.email || c.id).toLowerCase(), c);
        for (const c of serverCust) byEmail.set((c.email || c.id).toLowerCase(), c);
        setCustomers(Array.from(byEmail.values()));
      } else if (section === 'enquiries') {
        const res = await fetchEnquiriesList(25);
        setEnquiries(res.items);
      } else if (section === 'intl_enquiries') {
        const res = await fetchAdminInternationalEnquiries({
          q: intlSearchQ,
          status: intlStatusFilter,
          businessType: intlTypeFilter,
          country: intlCountryFilter,
        });
        setIntlEnquiries(res.enquiries);
      } else if (section === 'promotions') {
        const res = await fetchPaginated<PromotionRecord>('promotions', {pageSize: 30});
        setPromotions(res.items);
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Unable to load records.');
    } finally {
      setLoading(false);
    }
  }, [
    section,
    searchQ,
    brandFilter,
    statusFilter,
    dateFrom,
    dateTo,
    intlSearchQ,
    intlStatusFilter,
    intlTypeFilter,
    intlCountryFilter,
  ]);

  useEffect(() => {
    setMsg('');
    void loadSection();
  }, [loadSection]);

  useEffect(() => {
    return () => {
      if (slipPreviewUrl) {
        URL.revokeObjectURL(slipPreviewUrl);
      }
    };
  }, [slipPreviewUrl]);

  const openOrderDetail = (ord: OrderRecord) => {
    if (slipPreviewUrl) {
      URL.revokeObjectURL(slipPreviewUrl);
      setSlipPreviewUrl('');
    }
    setSelectedOrder(ord);
    setEditOrderStatus(ord.orderStatus);
    setEditShippingStatus(ord.shippingStatus || 'not_dispatched');
    setEditCarrier(ord.carrier || '');
    setEditTracking(ord.trackingNumber || '');
    setEditAdminNotes(ord.adminNotes || '');
    setVerifyTxRef(ord.paymentReference || '');
    setVerifyNote('');
    setRefundAmount('');
    setRefundReason('');
  };

  const replaceOrderInList = (updated: OrderRecord) => {
    setSelectedOrder(updated);
    setOrders((prev) => prev.map((o) => (o.orderRef === updated.orderRef ? updated : o)));
  };

  const handleLoadSlipPreview = async (fileName: string) => {
    setSlipLoading(true);
    try {
      const url = await fetchAdminSlipObjectUrl(fileName);
      if (slipPreviewUrl) URL.revokeObjectURL(slipPreviewUrl);
      setSlipPreviewUrl(url);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Unable to load payment slip.');
    } finally {
      setSlipLoading(false);
    }
  };

  const buildOrderSummaryText = (ord: OrderRecord) => {
    const fmt = (n: number) =>
      ord.currency === 'USD' ? `$${n.toFixed(2)}` : `LKR ${n.toLocaleString()}`;
    return [
      `CEYLON HERITAGE HOUSE — ORDER SUMMARY`,
      `Order Ref: ${ord.orderRef}`,
      `Date: ${typeof ord.createdAt === 'string' ? ord.createdAt : 'Recent'}`,
      `Status: ${labelize(ord.orderStatus)} | Payment: ${labelize(ord.paymentStatus)} (${labelize(ord.paymentMethod)})`,
      `Shipping: ${labelize(ord.shippingStatus)} ${ord.trackingNumber ? `· Tracking: ${ord.trackingNumber}` : ''}`,
      ``,
      `Customer: ${ord.customerName}`,
      `Email: ${ord.customerEmail || '—'} | Phone: ${ord.phone || '—'}`,
      `Address: ${[ord.address, ord.city, ord.postalCode, ord.country].filter(Boolean).join(', ')}`,
      ``,
      `Items:`,
      ...ord.items.map((i) => `- ${i.name} [${i.variantSku}] x ${i.qty} @ ${fmt(i.unitPrice)}`),
      ``,
      `Subtotal: ${fmt(ord.subtotal)}`,
      `Shipping: ${fmt(ord.shippingFee)}`,
      `Total: ${fmt(ord.totalAmount)}`,
    ].join('\n');
  };

  if (section === 'orders') {
    return (
      <div className="space-y-6 text-[#F3EBDD]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">Order &amp; Fulfillment Management</h1>
            <p className="text-sm text-[#D2C6B5]">
              Search orders, verify bank transfers, update shipping tracking, and issue refunds.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSection()}
            className="px-4 py-2 text-xs font-medium border border-[#3B332E] bg-[#211C1A] text-[#F3EBDD] rounded-md hover:border-[#C6A46A] hover:bg-[#2A2522] cursor-pointer whitespace-nowrap"
          >
            Refresh Orders
          </button>
        </div>

        {msg && <div className="p-3 text-sm bg-[#211C1A] border border-[#C6A46A]/60 text-[#F3EBDD] rounded-md">{msg}</div>}

        {/* Filter Bar */}
        <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-[#C6A46A]/70 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search ref, customer, email, payment ref..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
            />
          </div>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
          >
            <option value="all">All Brands</option>
            <option value="ceyvana">Ceyvana</option>
            <option value="ceylomira">Ceylomira</option>
            <option value="hand-crafts">Hand Crafts</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
          >
            <option value="all">All Statuses</option>
            {ORDER_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              aria-label="Filter from date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-1/2 px-2 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
            />
            <input
              type="date"
              aria-label="Filter to date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-1/2 px-2 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
            />
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#2A2522] border-b border-[#3B332E] text-xs text-[#C6A46A]">
              <tr>
                <th className="px-4 py-3">Order Ref</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Order Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Shipping</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3B332E]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#A99B88]">
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#A99B88]">
                    No matching orders found.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord.id} className={selectedOrder?.id === ord.id ? 'bg-[#2A2522]' : 'hover:bg-[#2A2522]/45'}>
                    <td className="px-4 py-3 font-mono-tabular text-xs font-medium text-[#C6A46A]">
                      {ord.orderRef}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs text-[#F3EBDD]">{ord.customerName}</p>
                      <p className="text-[11px] text-[#A99B88]">{ord.country || 'Sri Lanka'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#D2C6B5]">{labelize(ord.paymentMethod || 'bank_transfer')}</td>
                    <td className="px-4 py-3 font-mono-tabular text-xs text-[#C6A46A]">
                      {ord.currency} {ord.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#D2C6B5]">{labelize(ord.orderStatus)}</td>
                    <td className="px-4 py-3 text-xs text-[#D2C6B5]">{labelize(ord.paymentStatus)}</td>
                    <td className="px-4 py-3 text-xs text-[#D2C6B5]">{labelize(ord.shippingStatus || 'not_dispatched')}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openOrderDetail(ord)}
                        className="px-3 py-1 text-xs font-medium bg-[#C6A46A] text-[#151312] hover:bg-[#D4B47B] rounded cursor-pointer whitespace-nowrap"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Selected Order Management Drawer */}
        {selectedOrder && (
          <div className="bg-[#211C1A] border border-[#C6A46A]/40 rounded-lg p-6 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#3B332E] pb-4">
              <div>
                <p className="text-xs font-mono-tabular text-[#C6A46A]">
                  {selectedOrder.id} · Month {selectedOrder.monthKey}
                </p>
                <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                  Order {selectedOrder.orderRef} — {selectedOrder.customerName}
                </h2>
                <p className="text-xs text-[#D2C6B5] mt-1">
                  {selectedOrder.customerEmail || '—'} · {selectedOrder.phone || '—'} ·{' '}
                  {[selectedOrder.address, selectedOrder.city, selectedOrder.postalCode, selectedOrder.country]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                {selectedOrder.whatsappHandoffAt && (
                  <p className="text-xs text-[#86EFAC] mt-1 font-medium">
                    WhatsApp Order Channel · Customer opened WhatsApp at {selectedOrder.whatsappHandoffAt.slice(0, 19).replace('T', ' ')}Z (requires manual team confirmation)
                  </p>
                )}
                {selectedOrder.orderNotes && (
                  <p className="text-xs text-[#F3B0B6] mt-1">Customer Notes: {selectedOrder.orderNotes}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(buildOrderSummaryText(selectedOrder));
                    setMsg(`Copied summary for ${selectedOrder.orderRef} to clipboard.`);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#3B332E] bg-[#2A2522] text-[#F3EBDD] rounded cursor-pointer hover:border-[#C6A46A]"
                >
                  <Copy className="w-3.5 h-3.5 text-[#C6A46A]" />
                  <span>Copy Summary</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#3B332E] bg-[#2A2522] text-[#F3EBDD] rounded cursor-pointer hover:border-[#C6A46A]"
                >
                  <Printer className="w-3.5 h-3.5 text-[#C6A46A]" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-3 py-1.5 text-xs border border-[#3B332E] bg-[#2A2522] text-[#F3EBDD] hover:border-[#C6A46A] rounded cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Line Items Snapshot */}
            <div className="border border-[#3B332E] rounded overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#2A2522] border-b border-[#3B332E] text-[#C6A46A]">
                  <tr>
                    <th className="px-3 py-2">Brand</th>
                    <th className="px-3 py-2">Product &amp; Pack Size</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Locked Unit Price</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3B332E]">
                  {selectedOrder.items.map((item) => (
                    <tr key={item.variantSku}>
                      <td className="px-3 py-2 uppercase text-[#D2C6B5]">{item.brandId}</td>
                      <td className="px-3 py-2 font-medium text-[#F3EBDD]">{item.name}</td>
                      <td className="px-3 py-2 font-mono-tabular text-[#C6A46A]">{item.variantSku}</td>
                      <td className="px-3 py-2 text-right font-mono-tabular text-[#F3EBDD]">{item.qty}</td>
                      <td className="px-3 py-2 text-right font-mono-tabular text-[#D2C6B5]">
                        {selectedOrder.currency} {item.unitPrice.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-tabular font-medium text-[#C6A46A]">
                        {selectedOrder.currency} {(item.unitPrice * item.qty).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Status & Fulfillment Controls + Bank Verification */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Fulfillment Update Form */}
              <form
                onSubmit={async (e: FormEvent) => {
                  e.preventDefault();
                  try {
                    const updated = await adminUpdateOrderDetails(selectedOrder.id, {
                      orderStatus: editOrderStatus,
                      shippingStatus: editShippingStatus,
                      carrier: editCarrier,
                      trackingNumber: editTracking,
                      adminNotes: editAdminNotes,
                    });
                    replaceOrderInList(updated);
                    try {
                      await updateOrderStatuses(selectedOrder.id, editOrderStatus, updated.paymentStatus);
                    } catch {
                      // Firestore mirror may not exist for server-only orders
                    }
                    void refreshCatalog();
                    setMsg(`Updated order & shipping details for ${updated.orderRef}.`);
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : 'Failed to update order.');
                  }
                }}
                className="bg-[#151312] border border-[#3B332E] rounded-md p-4 space-y-3"
              >
                <h3 className="text-sm font-semibold text-[#C6A46A]">
                  Order Status &amp; Shipping Tracking
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">Order Status</label>
                    <select
                      value={editOrderStatus}
                      onChange={(e) => setEditOrderStatus(e.target.value as OrderStatus)}
                      className="w-full px-2.5 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    >
                      {ORDER_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">Shipping Status</label>
                    <select
                      value={editShippingStatus}
                      onChange={(e) => setEditShippingStatus(e.target.value as ShippingStatus)}
                      className="w-full px-2.5 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    >
                      {SHIPPING_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">Carrier</label>
                    <input
                      type="text"
                      value={editCarrier}
                      onChange={(e) => setEditCarrier(e.target.value)}
                      placeholder="e.g. PromptX / DHL Express"
                      className="w-full px-2.5 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">Tracking Number</label>
                    <input
                      type="text"
                      value={editTracking}
                      onChange={(e) => setEditTracking(e.target.value)}
                      placeholder="Tracking ID"
                      className="w-full px-2.5 py-2 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">Internal Admin Notes</label>
                  <input
                    type="text"
                    value={editAdminNotes}
                    onChange={(e) => setEditAdminNotes(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] hover:bg-[#D4B47B] rounded cursor-pointer whitespace-nowrap"
                >
                  Save Order &amp; Shipping
                </button>
              </form>

              {/* Payment Verification & Refund Panel */}
              <div className="bg-[#151312] border border-[#3B332E] rounded-md p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#C6A46A]">
                    Payment Verification ({labelize(selectedOrder.paymentStatus)})
                  </h3>
                  <span className="text-xs font-mono-tabular text-[#D2C6B5]">
                    {labelize(selectedOrder.paymentMethod)}
                  </span>
                </div>

                <div className="text-xs space-y-1 text-[#D2C6B5]">
                  <p>
                    Reference:{' '}
                    <span className="font-mono-tabular font-semibold text-[#F3EBDD]">
                      {selectedOrder.paymentReference || 'Not submitted yet'}
                    </span>
                  </p>
                  {selectedOrder.paymentSlipFile && (
                    <div className="pt-1 flex items-center gap-3">
                      <button
                        type="button"
                        disabled={slipLoading}
                        onClick={() => void handleLoadSlipPreview(selectedOrder.paymentSlipFile!)}
                        className="inline-flex items-center gap-1 text-xs underline text-[#C6A46A] hover:text-[#D4B47B] cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{slipLoading ? 'Loading slip...' : 'View Uploaded Slip'}</span>
                      </button>
                    </div>
                  )}
                  {slipPreviewUrl && (
                    <div className="mt-2 p-2 bg-[#2A2522] border border-[#3B332E] rounded">
                      <a
                        href={slipPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline text-[#86EFAC]"
                      >
                        Open full slip file in viewer
                      </a>
                    </div>
                  )}
                </div>

                {/* Approve / Reject Bank Transfer */}
                {selectedOrder.paymentStatus !== 'paid' && (
                  <div className="space-y-2 border-t border-[#3B332E] pt-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={verifyTxRef}
                        onChange={(e) => setVerifyTxRef(e.target.value)}
                        placeholder="Verified bank ref"
                        className="px-2.5 py-1.5 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                      />
                      <input
                        type="text"
                        value={verifyNote}
                        onChange={(e) => setVerifyNote(e.target.value)}
                        placeholder="Verification note"
                        className="px-2.5 py-1.5 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const updated = await adminVerifyOrderBankTransfer(selectedOrder.id, {
                              decision: 'approve',
                              transactionRef: verifyTxRef,
                              note: verifyNote,
                            });
                            replaceOrderInList(updated);
                            setEditOrderStatus(updated.orderStatus);
                            setMsg(`Approved payment for ${updated.orderRef}.`);
                          } catch (err) {
                            setMsg(err instanceof Error ? err.message : 'Verification failed.');
                          }
                        }}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-[#123D32] border border-[#1C493C] text-[#F3EBDD] hover:bg-[#1C493C] rounded cursor-pointer whitespace-nowrap"
                      >
                        Verify &amp; Mark Paid
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const updated = await adminVerifyOrderBankTransfer(selectedOrder.id, {
                              decision: 'reject',
                              transactionRef: verifyTxRef,
                              note: verifyNote || 'Transfer could not be matched',
                            });
                            replaceOrderInList(updated);
                            setEditOrderStatus(updated.orderStatus);
                            setMsg(`Marked payment rejected for ${updated.orderRef}.`);
                          } catch (err) {
                            setMsg(err instanceof Error ? err.message : 'Rejection failed.');
                          }
                        }}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-[#501C2B] border border-[#7A1F28] text-[#F3EBDD] hover:bg-[#6E1924] rounded cursor-pointer whitespace-nowrap"
                      >
                        Reject Proof
                      </button>
                    </div>
                  </div>
                )}

                {/* Issue Refund (if Paid or Partially Refunded) */}
                {(selectedOrder.paymentStatus === 'paid' ||
                  selectedOrder.paymentStatus === 'partially_refunded') && (
                  <form
                    onSubmit={async (e: FormEvent) => {
                      e.preventDefault();
                      try {
                        const updated = await adminIssueOrderRefund(selectedOrder.id, {
                          amount: Number(refundAmount),
                          reason: refundReason || 'Customer refund',
                        });
                        replaceOrderInList(updated);
                        setRefundAmount('');
                        setRefundReason('');
                        setMsg(`Recorded refund for ${updated.orderRef}.`);
                      } catch (err) {
                        setMsg(err instanceof Error ? err.message : 'Refund failed.');
                      }
                    }}
                    className="space-y-2 border-t border-[#3B332E] pt-3"
                  >
                    <p className="text-[11px] font-semibold text-[#D2C6B5]">
                      Refund Tracking (Refunded so far: {selectedOrder.currency}{' '}
                      {selectedOrder.refundedAmount ?? 0})
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        placeholder={`Amount (${selectedOrder.currency})`}
                        className="w-32 px-2.5 py-1.5 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                      />
                      <input
                        type="text"
                        required
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        placeholder="Refund reason"
                        className="flex-1 px-2.5 py-1.5 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-semibold bg-[#501C2B] border border-[#7A1F28] text-[#F3EBDD] hover:bg-[#6E1924] rounded cursor-pointer whitespace-nowrap"
                      >
                        Refund
                      </button>
                    </div>
                  </form>
                )}

                {/* Payment History Audit Trail */}
                {selectedOrder.paymentHistory && selectedOrder.paymentHistory.length > 0 && (
                  <div className="border-t border-[#3B332E] pt-3 space-y-1.5">
                    <p className="text-[11px] font-semibold text-[#D2C6B5]">Payment History</p>
                    <ul className="space-y-1 text-[11px] max-h-32 overflow-y-auto">
                      {selectedOrder.paymentHistory.map((h) => (
                        <li key={h.id} className="bg-[#2A2522] border border-[#3B332E] rounded px-2.5 py-1.5 text-[#F3EBDD]">
                          <span className="font-semibold text-[#C6A46A]">{labelize(h.eventType)}</span> ·{' '}
                          <span className="font-mono-tabular">
                            {h.currency} {h.amount}
                          </span>{' '}
                          · {labelize(h.status)} · <span className="text-[#D2C6B5]">{h.actor}</span>
                          {h.note ? <p className="text-[#D2C6B5] mt-0.5">{h.note}</p> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (section === 'customers') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">Customer Management</h1>
          <p className="text-sm text-[#D2C6B5]">
            Protected PII directory accessible exclusively to verified order and super admins.
          </p>
        </div>
        <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#2A2522] border-b border-[#3B332E] text-xs text-[#C6A46A]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Country / City</th>
                <th className="px-4 py-3 text-right">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3B332E] text-[#F3EBDD]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#A99B88]">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#A99B88]">
                    No customer records yet.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-[#2A2522]/50">
                    <td className="px-4 py-3 font-medium text-[#F3EBDD]">{c.name}</td>
                    <td className="px-4 py-3 text-xs text-[#D2C6B5]">{c.email}</td>
                    <td className="px-4 py-3 font-mono-tabular text-xs text-[#F3EBDD]">
                      {c.phone || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#D2C6B5]">
                      {c.country}
                      {c.city ? ` · ${c.city}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular text-xs text-[#C6A46A]">
                      {c.orderCount ?? 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'enquiries') {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">
          Wholesale &amp; Export Enquiries
        </h1>
        {msg && (
          <div className="p-3 text-sm bg-[#211C1A] border border-[#C6A46A]/60 text-[#F3EBDD] rounded-md">
            {msg}
          </div>
        )}
        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-[#A99B88]">Loading enquiries...</p>
          ) : enquiries.length === 0 ? (
            <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-8 text-center text-sm text-[#A99B88]">
              No enquiries submitted yet. Submissions from Contact Us or Wholesale Enquiries appear here.
            </div>
          ) : (
            enquiries.map((enq) => (
              <div
                key={enq.id}
                className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-[#C6A46A] uppercase tracking-wider">
                      {enq.type} · {enq.brandInterest || 'General'} · {enq.country || 'N/A'}
                    </p>
                    <h2 className="text-base font-medium text-[#F3EBDD] mt-0.5">
                      {enq.contactName}
                      {enq.companyName ? ` (${enq.companyName})` : ''}
                    </h2>
                    <p className="text-xs text-[#D2C6B5]">
                      {enq.email} {enq.phone ? `· ${enq.phone}` : ''}
                    </p>
                  </div>
                  <select
                    value={enq.status}
                    onChange={async (e) => {
                      const next = e.target.value as EnquiryRecord['status'];
                      try {
                        await updateEnquiryStatus(enq.id, next);
                        setEnquiries((prev) =>
                          prev.map((row) => (row.id === enq.id ? {...row, status: next} : row)),
                        );
                        setMsg(`Enquiry from ${enq.contactName} marked as ${next}.`);
                      } catch (err) {
                        setMsg(err instanceof Error ? err.message : 'Failed to update enquiry.');
                      }
                    }}
                    className="px-3 py-1.5 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                  >
                    <option value="new">New</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="quoted">Quoted</option>
                  </select>
                </div>
                <p className="text-sm text-[#F3EBDD] bg-[#151312] p-3 rounded border border-[#3B332E]">
                  {enq.message}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (section === 'intl_enquiries') {
    const distinctCountries = Array.from(
      new Set(intlEnquiries.map((e) => e.destinationCountry).filter(Boolean)),
    ).sort();

    const openIntlDetail = (enq: InternationalEnquiryRecord) => {
      setSelectedIntl(enq);
      setIntlEditStatus(enq.status === 'new' ? 'reviewed' : enq.status);
      setIntlResponseText(enq.adminResponse || '');
      setQuoteCurrency(enq.quotation?.currency || 'USD');
      setQuoteAmount(
        typeof enq.quotation?.quotedAmount === 'number' ? String(enq.quotation.quotedAmount) : '',
      );
      setQuoteShippingAmount(
        typeof enq.quotation?.shippingEstimateAmount === 'number'
          ? String(enq.quotation.shippingEstimateAmount)
          : '',
      );
      setQuoteMoq(enq.quotation?.minOrderQty || enq.requiredQuantities || '');
      setQuotePolicy(enq.quotation?.shippingPolicy || '');
      setQuoteValidity(enq.quotation?.validityNote || '');
    };

    const handleExportCsv = async () => {
      try {
        const blob = await downloadAdminEnquiriesCsv({
          q: intlSearchQ,
          status: intlStatusFilter,
          businessType: intlTypeFilter,
          country: intlCountryFilter,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `international-enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setMsg('Exported international buyer enquiries CSV.');
      } catch (err) {
        setMsg(err instanceof Error ? err.message : 'Failed to export CSV.');
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">
              International Buyer Enquiries
            </h1>
            <p className="text-sm text-[#D2C6B5]">
              Review international B2B trade requests, record country-specific quotations, and
              export records as CSV.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadSection()}
              className="px-3.5 py-2 text-xs font-medium border border-[#3B332E] bg-[#2A2522] text-[#F3EBDD] rounded-md hover:border-[#C6A46A] cursor-pointer whitespace-nowrap"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void handleExportCsv()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {msg && (
          <div className="p-3 text-sm bg-[#211C1A] border border-[#C6A46A]/60 text-[#F3EBDD] rounded-md">
            {msg}
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-[#A99B88] absolute left-3 top-2.5" />
            <input
              type="text"
              value={intlSearchQ}
              onChange={(e) => setIntlSearchQ(e.target.value)}
              placeholder="Search INT ref, company, contact, destination..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
            />
          </div>
          <select
            value={intlStatusFilter}
            onChange={(e) => setIntlStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
          >
            <option value="all">All Statuses</option>
            {INTL_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={intlTypeFilter}
            onChange={(e) => setIntlTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
          >
            <option value="all">All Business Types</option>
            {BUSINESS_TYPE_OPTIONS.map((bt) => (
              <option key={bt} value={bt}>
                {bt}
              </option>
            ))}
          </select>
          <select
            value={intlCountryFilter}
            onChange={(e) => setIntlCountryFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
          >
            <option value="all">All Destinations</option>
            {distinctCountries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Enquiries Table */}
        <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#2A2522] border-b border-[#3B332E] text-xs text-[#C6A46A]">
              <tr>
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3">Company &amp; Buyer</th>
                <th className="px-4 py-3">Business Type</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Quantities</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3B332E] text-[#F3EBDD]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#A99B88]">
                    Loading international buyer enquiries...
                  </td>
                </tr>
              ) : intlEnquiries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#A99B88]">
                    No international buyer enquiries match the current filter.
                  </td>
                </tr>
              ) : (
                intlEnquiries.map((enq) => (
                  <tr
                    key={enq.id}
                    className={
                      selectedIntl?.id === enq.id
                        ? 'bg-[#2A2522]'
                        : 'hover:bg-[#2A2522]/50'
                    }
                  >
                    <td className="px-4 py-3 font-mono-tabular text-xs font-medium text-[#C6A46A]">
                      {enq.enquiryRef}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs text-[#F3EBDD]">{enq.companyName}</p>
                      <p className="text-[11px] text-[#A99B88]">
                        {enq.contactName} · {enq.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#D2C6B5]">{enq.businessType}</td>
                    <td className="px-4 py-3 text-xs text-[#F3EBDD]">{enq.destinationCountry}</td>
                    <td className="px-4 py-3 text-xs text-[#D2C6B5]">{enq.requiredQuantities}</td>
                    <td className="px-4 py-3 text-xs font-mono-tabular uppercase text-[#C6A46A]">
                      {enq.status}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openIntlDetail(enq)}
                        className="px-3 py-1 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] cursor-pointer whitespace-nowrap"
                      >
                        Review &amp; Quote
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Review & Country Quotation Editor */}
        {selectedIntl && (
          <div className="bg-[#211C1A] border border-[#C6A46A]/40 rounded-lg p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#3B332E] pb-4">
              <div className="space-y-1">
                <p className="font-mono-tabular text-xs text-[#C6A46A]">
                  {selectedIntl.enquiryRef} · Token: {selectedIntl.trackingToken} ·{' '}
                  {selectedIntl.businessType}
                </p>
                <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                  {selectedIntl.companyName} — {selectedIntl.destinationCountry}
                </h2>
                <p className="text-xs text-[#D2C6B5]">
                  {selectedIntl.contactName} · {selectedIntl.email}
                  {selectedIntl.phone ? ` · ${selectedIntl.phone}` : ''} · Origin:{' '}
                  {selectedIntl.country}
                </p>
                {selectedIntl.website && /^https?:\/\//i.test(selectedIntl.website) && (
                  <p className="text-xs text-[#D2C6B5]">
                    Website:{' '}
                    <a
                      href={selectedIntl.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[#C6A46A] hover:text-[#F3EBDD]"
                    >
                      {selectedIntl.website}
                    </a>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedIntl(null)}
                className="px-3 py-1.5 text-xs border border-[#3B332E] bg-[#2A2522] text-[#F3EBDD] rounded hover:border-[#C6A46A] cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#151312] border border-[#3B332E] rounded-md p-4 text-xs">
              <div>
                <p className="text-[#A99B88]">Brand &amp; Products</p>
                <p className="font-medium text-[#F3EBDD]">{selectedIntl.brandInterest}</p>
                <p className="text-[#D2C6B5] mt-0.5">
                  {selectedIntl.productInterests.join(', ') || 'General range'}
                </p>
              </div>
              <div>
                <p className="text-[#A99B88]">Required Quantities</p>
                <p className="font-medium text-[#F3EBDD]">{selectedIntl.requiredQuantities}</p>
              </div>
              <div>
                <p className="text-[#A99B88]">Packaging Requirements</p>
                <p className="font-medium text-[#F3EBDD]">{selectedIntl.packagingRequirements}</p>
              </div>
              <div className="sm:col-span-3 pt-2 border-t border-[#3B332E]">
                <p className="text-[#A99B88] mb-1">Buyer Message</p>
                <p className="text-[#F3EBDD] leading-relaxed">{selectedIntl.message}</p>
              </div>
            </div>

            {selectedIntl.quotation && (
              <div className="p-3 bg-[#151312] border border-[#C6A46A]/60 text-[#F3EBDD] rounded text-xs">
                <strong className="text-[#C6A46A]">
                  Recorded Quotation ({selectedIntl.quotation.currency}):
                </strong>{' '}
                {typeof selectedIntl.quotation.quotedAmount === 'number'
                  ? formatSingleCurrency(
                      selectedIntl.quotation.quotedAmount,
                      selectedIntl.quotation.currency,
                      availableCurrencies,
                    )
                  : 'N/A'}{' '}
                {typeof selectedIntl.quotation.shippingEstimateAmount === 'number'
                  ? `· Freight Est: ${formatSingleCurrency(
                      selectedIntl.quotation.shippingEstimateAmount,
                      selectedIntl.quotation.currency,
                      availableCurrencies,
                    )}`
                  : ''}
              </div>
            )}

            <form
              onSubmit={async (e: FormEvent) => {
                e.preventDefault();
                setIntlSaving(true);
                try {
                  const hasQuoteFields =
                    quoteAmount.trim() !== '' ||
                    quoteShippingAmount.trim() !== '' ||
                    quotePolicy.trim() !== '' ||
                    quoteValidity.trim() !== '' ||
                    quoteMoq.trim() !== '';

                  const updated = await adminRespondInternationalEnquiry(selectedIntl.id, {
                    status: intlEditStatus,
                    adminResponse: intlResponseText,
                    quotation: hasQuoteFields
                      ? {
                          currency: quoteCurrency,
                          quotedAmount:
                            quoteAmount.trim() !== '' ? Number(quoteAmount) : undefined,
                          shippingEstimateAmount:
                            quoteShippingAmount.trim() !== ''
                              ? Number(quoteShippingAmount)
                              : undefined,
                          minOrderQty: quoteMoq.trim() || undefined,
                          shippingPolicy: quotePolicy.trim() || undefined,
                          validityNote: quoteValidity.trim() || undefined,
                        }
                      : undefined,
                  });

                  setSelectedIntl(updated);
                  setIntlEnquiries((prev) =>
                    prev.map((row) => (row.id === updated.id ? updated : row)),
                  );
                  setMsg(`Saved response & quotation record for ${updated.enquiryRef}.`);
                } catch (err) {
                  setMsg(
                    err instanceof Error ? err.message : 'Failed to save enquiry response.',
                  );
                } finally {
                  setIntlSaving(false);
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    Enquiry Status
                  </label>
                  <select
                    value={intlEditStatus}
                    onChange={(e) =>
                      setIntlEditStatus(e.target.value as InternationalEnquiryStatus)
                    }
                    className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                  >
                    {INTL_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    Official Admin Response (Visible to buyer via Enquiry Tracking)
                  </label>
                  <textarea
                    rows={3}
                    value={intlResponseText}
                    onChange={(e) => setIntlResponseText(e.target.value)}
                    placeholder="Provide pack format availability, harvest lead expectations, or documentation notes..."
                    className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
              </div>

              <div className="border-t border-[#3B332E] pt-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#C6A46A]">
                  Country-Specific Quotation Record ({selectedIntl.destinationCountry})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                      Currency
                    </label>
                    <select
                      value={quoteCurrency}
                      onChange={(e) => setQuoteCurrency(e.target.value)}
                      className="w-full px-2.5 py-2 bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    >
                      {availableCurrencies.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} ({c.symbol})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                      Quoted Goods Amount
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={quoteAmount}
                      onChange={(e) => setQuoteAmount(e.target.value)}
                      placeholder="e.g. 1450.00"
                      className="w-full px-2.5 py-2 font-mono-tabular bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                      Freight Estimate
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={quoteShippingAmount}
                      onChange={(e) => setQuoteShippingAmount(e.target.value)}
                      placeholder="e.g. 220.00"
                      className="w-full px-2.5 py-2 font-mono-tabular bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                      Confirmed MOQ
                    </label>
                    <input
                      type="text"
                      value={quoteMoq}
                      onChange={(e) => setQuoteMoq(e.target.value)}
                      placeholder="e.g. 50kg combined"
                      className="w-full px-2.5 py-2 bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                      Destination Shipping Policy Note
                    </label>
                    <input
                      type="text"
                      value={quotePolicy}
                      onChange={(e) => setQuotePolicy(e.target.value)}
                      placeholder="e.g. FOB Colombo / CIF quoted separately; destination duties payable by importer"
                      className="w-full px-2.5 py-2 bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                      Quotation Validity Note
                    </label>
                    <input
                      type="text"
                      value={quoteValidity}
                      onChange={(e) => setQuoteValidity(e.target.value)}
                      placeholder="e.g. Valid 14 days subject to harvest batch availability"
                      className="w-full px-2.5 py-2 bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={intlSaving}
                className="px-5 py-2.5 text-xs font-medium bg-[#123D32] border border-[#1C493C] text-[#F3EBDD] rounded-md hover:bg-[#1C493C] cursor-pointer disabled:opacity-50"
              >
                {intlSaving ? 'Saving Response...' : 'Save Response & Quotation'}
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  // Promotions
  const handleAddPromo = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPromo.code.trim()) {
      return;
    }
    try {
      await savePromotion(newPromo);
      setNewPromo({...newPromo, code: ''});
      setMsg('Promotion rule saved.');
      await loadSection();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to save promotion.');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">
        Promotions &amp; Discount Codes
      </h1>
      {msg && (
        <div className="p-3 text-sm bg-[#211C1A] border border-[#C6A46A]/60 text-[#F3EBDD] rounded-md">
          {msg}
        </div>
      )}

      <form
        onSubmit={handleAddPromo}
        className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
      >
        <div>
          <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Promo Code *</label>
          <input
            type="text"
            required
            value={newPromo.code}
            onChange={(e) => setNewPromo({...newPromo, code: e.target.value.toUpperCase()})}
            placeholder="CEYLON15"
            className="w-full px-3 py-2 text-sm font-mono-tabular bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Type</label>
          <select
            value={newPromo.type}
            onChange={(e) =>
              setNewPromo({...newPromo, type: e.target.value as 'percentage' | 'fixed'})
            }
            className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed (LKR)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Value</label>
          <input
            type="number"
            min={1}
            value={newPromo.value}
            onChange={(e) => setNewPromo({...newPromo, value: Number(e.target.value)})}
            className="w-full px-3 py-2 text-sm font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Min Order (LKR)</label>
          <input
            type="number"
            min={0}
            value={newPromo.minOrderLkr}
            onChange={(e) => setNewPromo({...newPromo, minOrderLkr: Number(e.target.value)})}
            className="w-full px-3 py-2 text-sm font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] cursor-pointer h-[38px] whitespace-nowrap"
        >
          Save Promo
        </button>
      </form>

      <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#2A2522] border-b border-[#3B332E] text-xs text-[#C6A46A]">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Min LKR</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3B332E] text-[#F3EBDD]">
            {promotions.map((p) => (
              <tr key={p.code} className="hover:bg-[#2A2522]/50">
                <td className="px-4 py-3 font-mono-tabular font-medium text-[#C6A46A]">
                  {p.code}
                </td>
                <td className="px-4 py-3 font-mono-tabular text-xs text-[#F3EBDD]">
                  {p.type === 'percentage' ? `${p.value}%` : `LKR ${p.value}`}
                </td>
                <td className="px-4 py-3 font-mono-tabular text-xs text-[#D2C6B5]">
                  {p.minOrderLkr}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await savePromotion({
                          ...p,
                          brandIds: (p.brandIds || ['ceyvana']) as BrandId[],
                          isActive: !p.isActive,
                        });
                        await loadSection();
                      } catch (err) {
                        setMsg(err instanceof Error ? err.message : 'Failed to toggle promotion.');
                      }
                    }}
                    className={`px-2.5 py-1 text-xs border rounded cursor-pointer ${
                      p.isActive
                        ? 'bg-[#123D32]/60 border-[#86EFAC]/40 text-[#86EFAC]'
                        : 'bg-[#2A2522] border-[#3B332E] text-[#A99B88]'
                    }`}
                  >
                    {p.isActive ? 'Active' : 'Paused'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await deletePromotion(p.code);
                        setMsg(`Deleted promotion ${p.code}.`);
                        await loadSection();
                      } catch (err) {
                        setMsg(err instanceof Error ? err.message : 'Failed to delete promotion.');
                      }
                    }}
                    className="text-xs text-[#F3B0B6] hover:underline cursor-pointer"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

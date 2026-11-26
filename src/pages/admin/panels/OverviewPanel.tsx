import {useEffect, useState} from 'react';
import {Database, RefreshCw} from 'lucide-react';
import BrandLogo from '../../../components/BrandLogo';
import {useStore} from '../../../context/StoreContext';
import {testFirestoreConnection} from '../../../lib/firebase';
import {fetchAdminOrders} from '../../../services/commerceApi';
import {fetchPaginated, initializeProductionDatabase} from '../../../services/firestoreService';
import type {AdminSectionId, EnquiryRecord, InventoryRecord, OrderRecord} from '../../../types/admin';
import type {Product} from '../../../types/commerce';

interface OverviewPanelProps {
  onNavigateSection: (section: AdminSectionId) => void;
}

export default function OverviewPanel({onNavigateSection}: OverviewPanelProps) {
  const {refreshCatalog} = useStore();
  const [connStatus, setConnStatus] = useState<{ok: boolean; message: string} | null>(null);
  const [stats, setStats] = useState({
    products: 0,
    lowStock: 0,
    orders: 0,
    newEnquiries: 0,
  });
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');

  const loadSummary = async () => {
    setLoading(true);
    try {
      const [conn, prodRes, invRes, ordRes, enqRes, srvOrdRes] = await Promise.all([
        testFirestoreConnection(),
        fetchPaginated<Product>('products', {pageSize: 50}),
        fetchPaginated<InventoryRecord>('inventory', {pageSize: 100}),
        fetchPaginated<OrderRecord>('orders', {pageSize: 50}),
        fetchPaginated<EnquiryRecord>('enquiries', {pageSize: 50}),
        fetchAdminOrders().catch(() => ({orders: [], customers: []})),
      ]);
      const orderRefs = new Set([
        ...ordRes.items.map((o) => o.orderRef),
        ...srvOrdRes.orders.map((o) => o.orderRef),
      ]);
      setConnStatus(conn);
      setStats({
        products: prodRes.items.length,
        lowStock: invRes.items.filter(
          (i) => i.stockQuantity <= (i.lowStockThreshold || 20),
        ).length,
        orders: orderRefs.size,
        newEnquiries: enqRes.items.filter((e) => e.status === 'new').length,
      });
    } catch (err) {
      setConnStatus({
        ok: false,
        message: err instanceof Error ? err.message : 'Unable to reach Firestore',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMessage('');
    try {
      const {count} = await initializeProductionDatabase();
      setSeedMessage(
        `Initialized ${count} production documents across brands, categories, products, inventory, and siteSettings (no fake customer orders populated).`,
      );
      await Promise.all([loadSummary(), refreshCatalog()]);
    } catch (err) {
      setSeedMessage(err instanceof Error ? err.message : 'Failed to initialize database.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6 text-[#F3EBDD]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">
            Platform Overview
          </h1>
          <p className="text-sm text-[#D2C6B5] mt-1">
            Isolated Firestore workspace for Ceyvana, Ceylomira, and configurable Hand Crafts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadSummary()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium border border-[#3B332E] bg-[#211C1A] text-[#F3EBDD] rounded-md hover:border-[#C6A46A] hover:bg-[#2A2522] cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#C6A46A]" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            disabled={seeding}
            onClick={() => void handleSeed()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{seeding ? 'Initializing...' : 'Initialize Catalog & Settings'}</span>
          </button>
        </div>
      </div>

      {seedMessage && (
        <div className="p-3.5 text-sm bg-[#211C1A] border border-[#C6A46A]/60 rounded-md text-[#F3EBDD]">
          {seedMessage}
        </div>
      )}

      {connStatus && (
        <div className="p-4 bg-[#211C1A] border border-[#3B332E] rounded-lg flex items-center justify-between gap-4 text-sm">
          <span className="text-[#D2C6B5]">
            <strong className="font-medium text-[#F3EBDD]">Firestore Connection:</strong> {connStatus.message}
          </span>
          <span
            className={`text-xs font-medium ${connStatus.ok ? 'text-[#86EFAC]' : 'text-[#F3B0B6]'}`}
          >
            {connStatus.ok ? 'Verified' : 'Attention Required'}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigateSection('products')}
          className="text-left bg-[#211C1A] border border-[#3B332E] rounded-lg p-5 hover:border-[#C6A46A]/60 transition-colors cursor-pointer"
        >
          <p className="text-xs text-[#D2C6B5]">Catalog Products</p>
          <p className="font-mono-tabular text-3xl font-medium text-[#F3EBDD] mt-2">
            {loading ? '—' : stats.products}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateSection('stock')}
          className="text-left bg-[#211C1A] border border-[#3B332E] rounded-lg p-5 hover:border-[#C6A46A]/60 transition-colors cursor-pointer"
        >
          <p className="text-xs text-[#D2C6B5]">Low-Stock Variants</p>
          <p className="font-mono-tabular text-3xl font-medium text-[#F3B0B6] mt-2">
            {loading ? '—' : stats.lowStock}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateSection('orders')}
          className="text-left bg-[#211C1A] border border-[#3B332E] rounded-lg p-5 hover:border-[#C6A46A]/60 transition-colors cursor-pointer"
        >
          <p className="text-xs text-[#D2C6B5]">Orders Recorded</p>
          <p className="font-mono-tabular text-3xl font-medium text-[#C6A46A] mt-2">
            {loading ? '—' : stats.orders}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateSection('enquiries')}
          className="text-left bg-[#211C1A] border border-[#3B332E] rounded-lg p-5 hover:border-[#C6A46A]/60 transition-colors cursor-pointer"
        >
          <p className="text-xs text-[#D2C6B5]">New Wholesale / Enquiries</p>
          <p className="font-mono-tabular text-3xl font-medium text-[#86EFAC] mt-2">
            {loading ? '—' : stats.newEnquiries}
          </p>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onNavigateSection('brands')}
          className="text-left bg-[#30211D]/70 border border-[#C6A46A]/30 rounded-lg p-5 hover:border-[#C6A46A] transition-colors cursor-pointer flex items-center justify-between gap-4"
        >
          <div>
            <p className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#C6A46A]">
              Spice House · Ceyvana
            </p>
            <p className="font-display text-xl font-medium text-[#F3EBDD] mt-0.5">
              Pure Origin. Timeless Flavor.
            </p>
          </div>
          <BrandLogo brandId="ceyvana" size="sm" />
        </button>
        <button
          type="button"
          onClick={() => onNavigateSection('brands')}
          className="text-left bg-[#123D32]/70 border border-[#C6A46A]/30 rounded-lg p-5 hover:border-[#C6A46A] transition-colors cursor-pointer flex items-center justify-between gap-4"
        >
          <div>
            <p className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#C6A46A]">
              Tea House · Ceylomira
            </p>
            <p className="font-display text-xl font-medium text-[#F3EBDD] mt-0.5">
              In Every Sip, A World of Flavour.
            </p>
          </div>
          <BrandLogo brandId="ceylomira" size="sm" />
        </button>
      </div>
    </div>
  );
}

import {FormEvent, useEffect, useState} from 'react';
import {multiFactor, TotpMultiFactorGenerator} from 'firebase/auth';
import {Download, Lock, Plus, RefreshCw, ShieldAlert} from 'lucide-react';
import {useStore} from '../../../context/StoreContext';
import {auth} from '../../../lib/firebaseAdmin';
import {isClientAppCheckActive} from '../../../lib/firebaseAppCheck';
import {
  adminSimulateGatewayWebhook,
  fetchAdminAuditLogs,
  fetchAdminCommerceSettings,
  fetchAdminOrders,
  saveAdminCommerceSettings,
  syncAdminAllowlistToServer,
} from '../../../services/commerceApi';
import {
  exportDatabaseSnapshot,
  fetchOrdersList,
  fetchPaginated,
  fetchPublicSiteSettings,
  saveAdminUser,
  saveSiteSettings,
} from '../../../services/firestoreService';
import type {
  AdminAuditLogEntry,
  AdminRole,
  AdminSectionId,
  AdminSessionInfo,
  AdminUserRecord,
  CommerceSettingsConfig,
  OrderRecord,
  SiteSettingsRecord,
} from '../../../types/admin';

interface SettingsReportsPanelsProps {
  section: Extract<AdminSectionId, 'content' | 'reports' | 'languages' | 'settings' | 'audit_logs'>;
  sessionInfo?: AdminSessionInfo | null;
}

const DEFAULT_SETTINGS: SiteSettingsRecord = {
  id: 'global',
  announcement: {
    en: 'Single-origin Sri Lankan spices & highland tea · Islandwide & international enquiries',
    si: 'පිරිසිදු ලංකා කුළුබඩු සහ කඳුකර තේ · දිවයින පුරා සහ විදේශීය ඇණවුම් සඳහා',
  },
  heroTitle: {
    en: 'The Essence of Ceylon, Crafted by Origin',
    si: 'හෙළ දිවයිනේ අසමසම රසය සහ සුවඳ',
  },
  heroSubtitle: {
    en: 'Home to Ceyvana pure island spices and Ceylomira high-grown teas.',
    si: 'සෙයිවානා කුළුබඩු සහ සෙයිලෝමිරා තේ එකතුව.',
  },
  whatsappNumber: '94770000000',
  enabledLanguages: [
    {code: 'en', shortLabel: 'EN', nativeLabel: 'English', enabled: true},
    {code: 'si', shortLabel: 'සිංහල', nativeLabel: 'සිංහල', enabled: true},
    {code: 'ta', shortLabel: 'தமிழ்', nativeLabel: 'தமிழ் (Future)', enabled: false},
  ],
  freeDeliveryThresholdLkr: 15000,
};

export default function SettingsReportsPanels({
  section,
  sessionInfo,
}: SettingsReportsPanelsProps) {
  const {refreshCatalog} = useStore();
  const [settings, setSettings] = useState<SiteSettingsRecord>(DEFAULT_SETTINGS);
  const [commerce, setCommerce] = useState<CommerceSettingsConfig | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState({sl: false, intl: false});
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogEntry[]>([]);
  const [auditFilter, setAuditFilter] = useState({q: '', targetType: 'all'});
  const [totpSecretKey, setTotpSecretKey] = useState('');
  const [totpSecretObj, setTotpSecretObj] = useState<Awaited<
    ReturnType<typeof TotpMultiFactorGenerator.generateSecret>
  > | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [newAdmin, setNewAdmin] = useState<{
    uid: string;
    email: string;
    displayName: string;
    role: AdminRole;
  }>({
    uid: '',
    email: '',
    displayName: '',
    role: 'catalog_manager',
  });
  const [thirdLang, setThirdLang] = useState({code: 'ta', shortLabel: 'தமிழ்', nativeLabel: 'தமிழ்'});
  const [newCurrency, setNewCurrency] = useState({code: '', symbol: '', name: '', ratePerUsd: 1});
  const [newCountry, setNewCountry] = useState({
    country: '',
    baseUsd: 25,
    extraPer500gUsd: 11,
    policyNote: '',
  });
  const [simWebhook, setSimWebhook] = useState<{
    provider: 'sl_gateway' | 'intl_gateway';
    orderRef: string;
    outcome: 'paid' | 'failed';
  }>({
    provider: 'sl_gateway',
    orderRef: '',
    outcome: 'paid',
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setMsg('');
    const load = async () => {
      if (section === 'content' || section === 'languages' || section === 'settings') {
        const remote = await fetchPublicSiteSettings().catch(() => null);
        if (remote) {
          setSettings(remote);
        }
      }
      if (section === 'reports') {
        const [fsRes, srvRes] = await Promise.allSettled([
          fetchOrdersList(100),
          fetchAdminOrders(),
        ]);
        const fsItems = fsRes.status === 'fulfilled' ? fsRes.value.items : [];
        const srvItems = srvRes.status === 'fulfilled' ? srvRes.value.orders : [];
        const byRef = new Map<string, OrderRecord>();
        for (const o of fsItems) byRef.set(o.orderRef, o);
        for (const o of srvItems) byRef.set(o.orderRef, o);
        setOrders(Array.from(byRef.values()));
      }
      if (section === 'settings') {
        const [admRes, commRes] = await Promise.allSettled([
          fetchPaginated<AdminUserRecord>('adminUsers', {pageSize: 30}),
          fetchAdminCommerceSettings(),
        ]);
        if (admRes.status === 'fulfilled') {
          setAdmins(admRes.value.items);
        }
        if (commRes.status === 'fulfilled') {
          setCommerce(commRes.value.settings);
          setGatewayStatus({
            sl: commRes.value.slGatewayConfigured,
            intl: commRes.value.intlGatewayConfigured,
          });
        }
      }
      if (section === 'audit_logs') {
        const res = await fetchAdminAuditLogs(auditFilter).catch(() => ({logs: []}));
        setAuditLogs(res.logs);
      }
    };
    void load();
  }, [section]);

  if (section === 'audit_logs') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">
              Security &amp; Administrative Audit Logs
            </h1>
            <p className="text-sm text-[#D2C6B5]">
              Immutable ledger of payment verifications, refunds, settings changes, stock updates, and RBAC syncs.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              const res = await fetchAdminAuditLogs(auditFilter).catch(() => ({logs: []}));
              setAuditLogs(res.logs);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Logs</span>
          </button>
        </div>

        <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-4 flex flex-wrap gap-3 items-center">
          <input
            type="search"
            placeholder="Filter by email, action, order ref..."
            value={auditFilter.q}
            onChange={(e) => setAuditFilter({...auditFilter, q: e.target.value})}
            className="flex-1 min-w-[200px] px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
          />
          <select
            value={auditFilter.targetType}
            onChange={(e) => setAuditFilter({...auditFilter, targetType: e.target.value})}
            className="px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
          >
            <option value="all">All Event Types</option>
            <option value="payment">Payment Verification &amp; Refunds</option>
            <option value="order">Orders &amp; Shipping</option>
            <option value="enquiry">International Enquiries</option>
            <option value="settings">Commerce Settings</option>
            <option value="stock">Stock Sync</option>
            <option value="export">Export Operations</option>
            <option value="admin_users">Admin RBAC Sync</option>
            <option value="portfolio">Product Portfolio PDFs</option>
            <option value="catalogue_request">Catalogue Requests</option>
          </select>
          <button
            type="button"
            onClick={async () => {
              const res = await fetchAdminAuditLogs(auditFilter).catch(() => ({logs: []}));
              setAuditLogs(res.logs);
            }}
            className="px-4 py-2 text-xs font-medium border border-[#3B332E] rounded-md bg-[#2A2522] text-[#F3EBDD] hover:border-[#C6A46A] cursor-pointer whitespace-nowrap"
          >
            Apply Filter
          </button>
        </div>

        <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg overflow-hidden">
          {auditLogs.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#A99B88]">
              No administrative audit entries match the current filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#2A2522] border-b border-[#3B332E] text-[#C6A46A] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-medium">Timestamp</th>
                    <th className="px-4 py-3 font-medium">Actor</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Target</th>
                    <th className="px-4 py-3 font-medium">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3B332E] text-[#F3EBDD]">
                  {auditLogs.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#2A2522]/50">
                      <td className="px-4 py-3 font-mono-tabular whitespace-nowrap text-[#A99B88]">
                        {entry.createdAt.slice(0, 19).replace('T', ' ')}Z
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-[#F3EBDD]">{entry.actorEmail}</span>
                        <span className="block font-mono-tabular text-[11px] text-[#C6A46A]">
                          {entry.actorRole}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono-tabular whitespace-nowrap text-[#F3EBDD]">
                        {entry.action}
                      </td>
                      <td className="px-4 py-3 font-mono-tabular whitespace-nowrap text-[#A99B88]">
                        {entry.targetType}:{entry.targetId}
                      </td>
                      <td className="px-4 py-3 text-[#D2C6B5]">{entry.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (section === 'content') {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">Website Content</h1>
        {msg && (
          <div className="p-3 text-sm bg-[#211C1A] border border-[#C6A46A]/60 text-[#F3EBDD] rounded-md">
            {msg}
          </div>
        )}
        <form
          onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            try {
              await saveSiteSettings(settings);
              setMsg('Website content saved to siteSettings/global.');
            } catch (err) {
              setMsg(err instanceof Error ? err.message : 'Failed to save website content.');
            }
          }}
          className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-6 space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                Hero Headline (EN)
              </label>
              <input
                type="text"
                value={settings.heroTitle.en}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    heroTitle: {...settings.heroTitle, en: e.target.value},
                  })
                }
                className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                Hero Headline (SI)
              </label>
              <input
                type="text"
                value={settings.heroTitle.si}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    heroTitle: {...settings.heroTitle, si: e.target.value},
                  })
                }
                className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                Top Announcement (EN)
              </label>
              <input
                type="text"
                value={settings.announcement.en}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    announcement: {...settings.announcement, en: e.target.value},
                  })
                }
                className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                WhatsApp Business Number
              </label>
              <input
                type="text"
                value={settings.whatsappNumber}
                onChange={(e) => setSettings({...settings, whatsappNumber: e.target.value})}
                className="w-full px-3 py-2 text-sm font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 text-xs font-medium bg-[#123D32] border border-[#1C493C] text-[#F3EBDD] rounded-md hover:bg-[#1C493C] cursor-pointer"
          >
            Save Website Content
          </button>
        </form>
      </div>
    );
  }

  if (section === 'reports') {
    const lkrOrders = orders.filter((o) => o.currency === 'LKR' && o.orderStatus !== 'cancelled');
    const usdOrders = orders.filter((o) => o.currency === 'USD' && o.orderStatus !== 'cancelled');
    const totalLkr = lkrOrders.reduce((s, o) => s + o.totalAmount, 0);
    const totalUsd = usdOrders.reduce((s, o) => s + o.totalAmount, 0);

    const exportCsv = () => {
      const headers = [
        'OrderRef',
        'Month',
        'Customer',
        'Country',
        'PaymentMethod',
        'Currency',
        'Total',
        'OrderStatus',
        'PaymentStatus',
        'ShippingStatus',
      ];
      const csvCell = (val: unknown) => {
        const s = String(val ?? '').replace(/[\r\n]+/g, ' ');
        const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
        return `"${safe.replace(/"/g, '""')}"`;
      };
      const rows = orders.map((o) =>
        [
          o.orderRef,
          o.monthKey,
          o.customerName,
          o.country || '',
          o.paymentMethod || 'bank_transfer',
          o.currency,
          String(o.totalAmount),
          o.orderStatus,
          o.paymentStatus,
          o.shippingStatus || 'not_dispatched',
        ].map(csvCell),
      );
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ceylon-heritage-monthly-report-${new Date().toISOString().slice(0, 7)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">
              Monthly Sales Reports
            </h1>
            <p className="text-sm text-[#D2C6B5]">
              Combined storefront &amp; checkout ledger by currency (excluding cancelled orders).
            </p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-5">
            <p className="text-xs text-[#D2C6B5]">Total Recorded Orders</p>
            <p className="font-mono-tabular text-2xl font-medium text-[#F3EBDD] mt-1">
              {orders.length}
            </p>
          </div>
          <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-5">
            <p className="text-xs text-[#D2C6B5]">Local Revenue (LKR)</p>
            <p className="font-mono-tabular text-2xl font-medium text-[#C6A46A] mt-1">
              LKR {totalLkr.toLocaleString()}
            </p>
          </div>
          <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-5">
            <p className="text-xs text-[#D2C6B5]">Export Revenue (USD)</p>
            <p className="font-mono-tabular text-2xl font-medium text-[#C6A46A] mt-1">
              ${totalUsd.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'languages') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">
            Language Management
          </h1>
          <p className="text-sm text-[#D2C6B5]">
            Manage English, Sinhala, and configurable third-language rollout readiness.
          </p>
        </div>
        {msg && (
          <div className="p-3 text-sm bg-[#211C1A] border border-[#C6A46A]/60 text-[#F3EBDD] rounded-md">
            {msg}
          </div>
        )}

        <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-6 space-y-4">
          <h2 className="font-medium text-base text-[#F3EBDD]">Configured Languages</h2>
          <div className="space-y-2.5">
            {settings.enabledLanguages.map((langCfg, idx) => (
              <div
                key={langCfg.code}
                className="flex items-center justify-between p-3 bg-[#151312] border border-[#3B332E] rounded-md text-sm text-[#F3EBDD]"
              >
                <div>
                  <span className="font-mono-tabular font-semibold text-[#C6A46A] mr-2">
                    {langCfg.code}
                  </span>
                  <span>{langCfg.nativeLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = settings.enabledLanguages.map((item, i) =>
                      i === idx ? {...item, enabled: !item.enabled} : item,
                    );
                    setSettings({...settings, enabledLanguages: next});
                  }}
                  className={`px-3 py-1 text-xs border rounded cursor-pointer ${
                    langCfg.enabled
                      ? 'bg-[#123D32]/60 border-[#86EFAC]/40 text-[#86EFAC]'
                      : 'bg-[#2A2522] border-[#3B332E] text-[#A99B88]'
                  }`}
                >
                  {langCfg.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-4 border-t border-[#3B332E] items-end">
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                3rd Language Code
              </label>
              <input
                type="text"
                value={thirdLang.code}
                onChange={(e) => setThirdLang({...thirdLang, code: e.target.value.toLowerCase()})}
                className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Short Label</label>
              <input
                type="text"
                value={thirdLang.shortLabel}
                onChange={(e) => setThirdLang({...thirdLang, shortLabel: e.target.value})}
                className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Native Label</label>
              <input
                type="text"
                value={thirdLang.nativeLabel}
                onChange={(e) => setThirdLang({...thirdLang, nativeLabel: e.target.value})}
                className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (!thirdLang.code || settings.enabledLanguages.some((l) => l.code === thirdLang.code)) {
                  return;
                }
                setSettings({
                  ...settings,
                  enabledLanguages: [
                    ...settings.enabledLanguages,
                    {...thirdLang, enabled: true},
                  ],
                });
              }}
              className="px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] cursor-pointer h-[34px] whitespace-nowrap"
            >
              Add Language Slot
            </button>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await saveSiteSettings(settings);
                  void refreshCatalog();
                  setMsg('Language configuration saved and storefront updated.');
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : 'Failed to save language settings.');
                }
              }}
              className="px-5 py-2.5 text-xs font-medium bg-[#123D32] border border-[#1C493C] text-[#F3EBDD] rounded-md hover:bg-[#1C493C] cursor-pointer"
            >
              Save Language Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 15. Admin Settings: Payment Methods, Shipping Zones/Countries, RBAC & Sandbox Tester
  const handleSnapshotBackup = async () => {
    try {
      const data = await exportDatabaseSnapshot();
      const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ceylon-heritage-firestore-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg('JSON backup snapshot downloaded.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Backup export failed.');
    }
  };

  const handleSaveCommerce = async (e: FormEvent) => {
    e.preventDefault();
    if (!commerce) {
      return;
    }
    try {
      const saved = await saveAdminCommerceSettings(commerce);
      setCommerce(saved);
      void refreshCatalog();
      setMsg('Payment & Shipping configuration saved and applied to checkout.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to save commerce configuration.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">
            Payment, Shipping &amp; Admin Settings
          </h1>
          <p className="text-sm text-[#D2C6B5]">
            Configure payment methods, bank transfer instructions, local zones, international rates, and RBAC.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSnapshotBackup()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] cursor-pointer whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          <span>Export JSON Backup Snapshot</span>
        </button>
      </div>

      {msg && (
        <div className="p-3 text-sm bg-[#211C1A] border border-[#C6A46A]/60 text-[#F3EBDD] rounded-md">
          {msg}
        </div>
      )}

      {/* Payment & Shipping Controls */}
      {commerce && (
        <form onSubmit={handleSaveCommerce} className="space-y-6">
          {/* Payment Methods & Bank Instructions */}
          <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium text-base text-[#F3EBDD]">
                Payment Methods &amp; Gateway Adapters
              </h2>
              <span className="text-xs font-mono-tabular text-[#C6A46A]">
                Live Gateway Secrets: SL={gatewayStatus.sl ? 'Set' : 'Sandbox Only'} · Intl=
                {gatewayStatus.intl ? 'Set' : 'Sandbox Only'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-[#F3EBDD]">
              <label className="p-3 bg-[#151312] border border-[#3B332E] rounded flex items-center justify-between cursor-pointer hover:border-[#C6A46A]/50">
                <span className="font-medium">Bank Transfer (Live)</span>
                <input
                  type="checkbox"
                  checked={commerce.payment.bankTransferEnabled}
                  onChange={(e) =>
                    setCommerce({
                      ...commerce,
                      payment: {...commerce.payment, bankTransferEnabled: e.target.checked},
                    })
                  }
                  className="accent-[#C6A46A]"
                />
              </label>

              <label className="p-3 bg-[#151312] border border-[#3B332E] rounded flex items-center justify-between cursor-pointer hover:border-[#C6A46A]/50">
                <span className="font-medium">Payment on Delivery (Sri Lanka)</span>
                <input
                  type="checkbox"
                  checked={commerce.payment.codEnabled}
                  onChange={(e) =>
                    setCommerce({
                      ...commerce,
                      payment: {...commerce.payment, codEnabled: e.target.checked},
                    })
                  }
                  className="accent-[#C6A46A]"
                />
              </label>

              <label className="p-3 bg-[#151312] border border-[#3B332E] rounded flex items-center justify-between cursor-pointer hover:border-[#C6A46A]/50">
                <span className="font-medium">Sandbox / Mock Testing Mode</span>
                <input
                  type="checkbox"
                  checked={commerce.payment.sandboxMode}
                  onChange={(e) =>
                    setCommerce({
                      ...commerce,
                      payment: {...commerce.payment, sandboxMode: e.target.checked},
                    })
                  }
                  className="accent-[#C6A46A]"
                />
              </label>

              <label className="p-3 bg-[#151312] border border-[#3B332E] rounded flex items-center justify-between cursor-pointer hover:border-[#C6A46A]/50">
                <span className="font-medium">Sri Lankan Gateway Adapter</span>
                <input
                  type="checkbox"
                  checked={commerce.payment.slGatewayEnabled}
                  onChange={(e) =>
                    setCommerce({
                      ...commerce,
                      payment: {...commerce.payment, slGatewayEnabled: e.target.checked},
                    })
                  }
                  className="accent-[#C6A46A]"
                />
              </label>

              <label className="p-3 bg-[#151312] border border-[#3B332E] rounded flex items-center justify-between cursor-pointer hover:border-[#C6A46A]/50">
                <span className="font-medium">International Gateway Adapter</span>
                <input
                  type="checkbox"
                  checked={commerce.payment.intlGatewayEnabled}
                  onChange={(e) =>
                    setCommerce({
                      ...commerce,
                      payment: {...commerce.payment, intlGatewayEnabled: e.target.checked},
                    })
                  }
                  className="accent-[#C6A46A]"
                />
              </label>

              <label className="p-3 bg-[#151312] border border-[#3B332E] rounded flex items-center justify-between cursor-pointer hover:border-[#C6A46A]/50">
                <span className="font-medium">WhatsApp Ordering (Primary Live Channel)</span>
                <input
                  type="checkbox"
                  checked={commerce.payment.whatsappOrderEnabled !== false}
                  onChange={(e) =>
                    setCommerce({
                      ...commerce,
                      payment: {...commerce.payment, whatsappOrderEnabled: e.target.checked},
                    })
                  }
                  className="accent-[#C6A46A]"
                />
              </label>

              <div>
                <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                  Corporate Fallback WhatsApp
                </label>
                <input
                  type="text"
                  value={commerce.whatsappNumber}
                  onChange={(e) => setCommerce({...commerce, whatsappNumber: e.target.value})}
                  className="w-full px-3 py-1.5 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                />
              </div>
            </div>

            {/* Per-Brand WhatsApp Contacts & Public Portfolio Access */}
            <div className="border-t border-[#3B332E] pt-4 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#C6A46A]">
                Per-Brand WhatsApp Contacts &amp; Portfolio Access Policy
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                    Ceyvana WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={commerce.brandWhatsappNumbers?.ceyvana ?? commerce.whatsappNumber}
                    onChange={(e) =>
                      setCommerce({
                        ...commerce,
                        brandWhatsappNumbers: {
                          ceyvana: e.target.value,
                          ceylomira: commerce.brandWhatsappNumbers?.ceylomira ?? commerce.whatsappNumber,
                          'hand-crafts': commerce.brandWhatsappNumbers?.['hand-crafts'] ?? commerce.whatsappNumber,
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                    Ceylomira WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={commerce.brandWhatsappNumbers?.ceylomira ?? commerce.whatsappNumber}
                    onChange={(e) =>
                      setCommerce({
                        ...commerce,
                        brandWhatsappNumbers: {
                          ceyvana: commerce.brandWhatsappNumbers?.ceyvana ?? commerce.whatsappNumber,
                          ceylomira: e.target.value,
                          'hand-crafts': commerce.brandWhatsappNumbers?.['hand-crafts'] ?? commerce.whatsappNumber,
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                    Hand Crafts WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={commerce.brandWhatsappNumbers?.['hand-crafts'] ?? commerce.whatsappNumber}
                    onChange={(e) =>
                      setCommerce({
                        ...commerce,
                        brandWhatsappNumbers: {
                          ceyvana: commerce.brandWhatsappNumbers?.ceyvana ?? commerce.whatsappNumber,
                          ceylomira: commerce.brandWhatsappNumbers?.ceylomira ?? commerce.whatsappNumber,
                          'hand-crafts': e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#F3EBDD]">
                <label className="p-3 bg-[#151312] border border-[#3B332E] rounded flex items-center justify-between cursor-pointer hover:border-[#C6A46A]/50">
                  <span className="font-medium">Require Catalogue Request Registration Before Download</span>
                  <input
                    type="checkbox"
                    checked={Boolean(commerce.portfolioSettings?.requireRegistrationForPublicDownload)}
                    onChange={(e) =>
                      setCommerce({
                        ...commerce,
                        portfolioSettings: {
                          requireRegistrationForPublicDownload: e.target.checked,
                          allowCustomPublicCatalogSelection:
                            commerce.portfolioSettings?.allowCustomPublicCatalogSelection ?? true,
                        },
                      })
                    }
                    className="accent-[#C6A46A]"
                  />
                </label>
                <label className="p-3 bg-[#151312] border border-[#3B332E] rounded flex items-center justify-between cursor-pointer hover:border-[#C6A46A]/50">
                  <span className="font-medium">Allow Customer Custom Selection PDF Builder</span>
                  <input
                    type="checkbox"
                    checked={commerce.portfolioSettings?.allowCustomPublicCatalogSelection !== false}
                    onChange={(e) =>
                      setCommerce({
                        ...commerce,
                        portfolioSettings: {
                          requireRegistrationForPublicDownload: Boolean(
                            commerce.portfolioSettings?.requireRegistrationForPublicDownload,
                          ),
                          allowCustomPublicCatalogSelection: e.target.checked,
                        },
                      })
                    }
                    className="accent-[#C6A46A]"
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-[#3B332E] pt-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#C6A46A]">
                Bank Transfer Instructions Shown at Checkout
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={commerce.payment.bankDetails.bankName}
                    onChange={(e) =>
                      setCommerce({
                        ...commerce,
                        payment: {
                          ...commerce.payment,
                          bankDetails: {
                            ...commerce.payment.bankDetails,
                            bankName: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={commerce.payment.bankDetails.accountName}
                    onChange={(e) =>
                      setCommerce({
                        ...commerce,
                        payment: {
                          ...commerce.payment,
                          bankDetails: {
                            ...commerce.payment.bankDetails,
                            accountName: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={commerce.payment.bankDetails.accountNumber}
                    onChange={(e) =>
                      setCommerce({
                        ...commerce,
                        payment: {
                          ...commerce.payment,
                          bankDetails: {
                            ...commerce.payment.bankDetails,
                            accountNumber: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                    Branch
                  </label>
                  <input
                    type="text"
                    value={commerce.payment.bankDetails.branchName}
                    onChange={(e) =>
                      setCommerce({
                        ...commerce,
                        payment: {
                          ...commerce.payment,
                          bankDetails: {
                            ...commerce.payment.bankDetails,
                            branchName: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                    SWIFT Code
                  </label>
                  <input
                    type="text"
                    value={commerce.payment.bankDetails.swiftCode}
                    onChange={(e) =>
                      setCommerce({
                        ...commerce,
                        payment: {
                          ...commerce.payment,
                          bankDetails: {
                            ...commerce.payment.bankDetails,
                            swiftCode: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                    Instructions
                  </label>
                  <input
                    type="text"
                    value={commerce.payment.bankDetails.instructions}
                    onChange={(e) =>
                      setCommerce({
                        ...commerce,
                        payment: {
                          ...commerce.payment,
                          bankDetails: {
                            ...commerce.payment.bankDetails,
                            instructions: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Local & International Shipping Config */}
          <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-6 space-y-5">
            <h2 className="font-semibold text-base text-[#F3EBDD]">
              Local &amp; International Shipping Rules
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                  Free Local Threshold (LKR)
                </label>
                <input
                  type="number"
                  min={0}
                  value={commerce.shipping.freeShippingThresholdLkr}
                  onChange={(e) =>
                    setCommerce({
                      ...commerce,
                      shipping: {
                        ...commerce.shipping,
                        freeShippingThresholdLkr: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-2 font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                  Express Surcharge (LKR)
                </label>
                <input
                  type="number"
                  min={0}
                  value={commerce.shipping.localExpressSurchargeLkr}
                  onChange={(e) =>
                    setCommerce({
                      ...commerce,
                      shipping: {
                        ...commerce.shipping,
                        localExpressSurchargeLkr: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-2 font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                  USD to LKR Rate
                </label>
                <input
                  type="number"
                  min={100}
                  value={commerce.shipping.usdToLkrRate}
                  onChange={(e) =>
                    setCommerce({
                      ...commerce,
                      shipping: {...commerce.shipping, usdToLkrRate: Number(e.target.value)},
                    })
                  }
                  className="w-full px-3 py-2 font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                />
              </div>
              <label className="p-3 bg-[#151312] border border-[#3B332E] text-[#F3EBDD] rounded flex items-center justify-between cursor-pointer self-end hover:border-[#C6A46A]/50">
                <span className="font-medium">Allow Intl Quote Requests</span>
                <input
                  type="checkbox"
                  checked={commerce.shipping.internationalQuoteEnabled}
                  onChange={(e) =>
                    setCommerce({
                      ...commerce,
                      shipping: {
                        ...commerce.shipping,
                        internationalQuoteEnabled: e.target.checked,
                      },
                    })
                  }
                  className="accent-[#C6A46A]"
                />
              </label>
            </div>

            {/* Sri Lankan Delivery Zones */}
            <div className="space-y-2 border-t border-[#3B332E] pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#C6A46A]">
                Sri Lankan Delivery Zones
              </p>
              <div className="space-y-2">
                {commerce.shipping.localZones.map((z, idx) => (
                  <div
                    key={z.id}
                    className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center bg-[#151312] p-2.5 rounded border border-[#3B332E] text-xs text-[#F3EBDD]"
                  >
                    <input
                      type="text"
                      value={z.name}
                      onChange={(e) => {
                        const zones = [...commerce.shipping.localZones];
                        zones[idx] = {...z, name: e.target.value};
                        setCommerce({...commerce, shipping: {...commerce.shipping, localZones: zones}});
                      }}
                      className="sm:col-span-2 px-2.5 py-1.5 bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    />
                    <input
                      type="number"
                      min={0}
                      value={z.baseRateLkr}
                      onChange={(e) => {
                        const zones = [...commerce.shipping.localZones];
                        zones[idx] = {...z, baseRateLkr: Number(e.target.value)};
                        setCommerce({...commerce, shipping: {...commerce.shipping, localZones: zones}});
                      }}
                      title="Base LKR"
                      className="px-2.5 py-1.5 font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    />
                    <input
                      type="number"
                      min={0}
                      value={z.extraPerKgLkr}
                      onChange={(e) => {
                        const zones = [...commerce.shipping.localZones];
                        zones[idx] = {...z, extraPerKgLkr: Number(e.target.value)};
                        setCommerce({...commerce, shipping: {...commerce.shipping, localZones: zones}});
                      }}
                      title="Extra per kg (LKR)"
                      className="px-2.5 py-1.5 font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    />
                    <label className="inline-flex items-center gap-2 justify-end pr-2 cursor-pointer text-[#D2C6B5]">
                      <input
                        type="checkbox"
                        checked={z.enabled}
                        onChange={(e) => {
                          const zones = [...commerce.shipping.localZones];
                          zones[idx] = {...z, enabled: e.target.checked};
                          setCommerce({
                            ...commerce,
                            shipping: {...commerce.shipping, localZones: zones},
                          });
                        }}
                        className="accent-[#C6A46A]"
                      />
                      <span>Enabled</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Country-Based International Charges & Policies */}
            <div className="space-y-3 border-t border-[#3B332E] pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#C6A46A]">
                International Country Rates &amp; Shipping Policies (Base USD + Extra per 500g USD)
              </p>
              <div className="space-y-2">
                {commerce.shipping.internationalRates.map((r, idx) => (
                  <div
                    key={r.country}
                    className="bg-[#151312] p-2.5 rounded border border-[#3B332E] text-xs text-[#F3EBDD] space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex-1 font-medium min-w-[140px] text-[#F3EBDD]">
                        {r.country}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={r.baseUsd}
                        onChange={(e) => {
                          const rates = [...commerce.shipping.internationalRates];
                          rates[idx] = {...r, baseUsd: Number(e.target.value)};
                          setCommerce({
                            ...commerce,
                            shipping: {...commerce.shipping, internationalRates: rates},
                          });
                        }}
                        title="Base USD"
                        className="w-20 px-2 py-1 font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={r.extraPer500gUsd}
                        onChange={(e) => {
                          const rates = [...commerce.shipping.internationalRates];
                          rates[idx] = {...r, extraPer500gUsd: Number(e.target.value)};
                          setCommerce({
                            ...commerce,
                            shipping: {...commerce.shipping, internationalRates: rates},
                          });
                        }}
                        title="Extra per 500g USD"
                        className="w-20 px-2 py-1 font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                      />
                      <label className="inline-flex items-center gap-1 cursor-pointer text-[#D2C6B5]">
                        <input
                          type="checkbox"
                          checked={r.enabled}
                          onChange={(e) => {
                            const rates = [...commerce.shipping.internationalRates];
                            rates[idx] = {...r, enabled: e.target.checked};
                            setCommerce({
                              ...commerce,
                              shipping: {...commerce.shipping, internationalRates: rates},
                            });
                          }}
                          className="accent-[#C6A46A]"
                        />
                        <span>Enabled</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={r.policyNote || ''}
                      placeholder="Country-specific shipping policy note (no unverified ETA/duty claims)"
                      onChange={(e) => {
                        const rates = [...commerce.shipping.internationalRates];
                        rates[idx] = {...r, policyNote: e.target.value};
                        setCommerce({
                          ...commerce,
                          shipping: {...commerce.shipping, internationalRates: rates},
                        });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 pt-2 items-center">
                <input
                  type="text"
                  placeholder="Country (e.g. France)"
                  value={newCountry.country}
                  onChange={(e) => setNewCountry({...newCountry, country: e.target.value})}
                  className="px-3 py-1.5 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                />
                <input
                  type="number"
                  value={newCountry.baseUsd}
                  onChange={(e) => setNewCountry({...newCountry, baseUsd: Number(e.target.value)})}
                  title="Base USD"
                  className="px-2 py-1.5 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                />
                <input
                  type="number"
                  value={newCountry.extraPer500gUsd}
                  onChange={(e) =>
                    setNewCountry({...newCountry, extraPer500gUsd: Number(e.target.value)})
                  }
                  title="Extra per 500g USD"
                  className="px-2 py-1.5 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                />
                <input
                  type="text"
                  placeholder="Country policy note"
                  value={newCountry.policyNote}
                  onChange={(e) => setNewCountry({...newCountry, policyNote: e.target.value})}
                  className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = newCountry.country.trim();
                    if (
                      !name ||
                      commerce.shipping.internationalRates.some(
                        (r) => r.country.toLowerCase() === name.toLowerCase(),
                      )
                    ) {
                      return;
                    }
                    setCommerce({
                      ...commerce,
                      shipping: {
                        ...commerce.shipping,
                        internationalRates: [
                          ...commerce.shipping.internationalRates,
                          {
                            country: name,
                            baseUsd: newCountry.baseUsd,
                            extraPer500gUsd: newCountry.extraPer500gUsd,
                            policyNote: newCountry.policyNote.trim() || undefined,
                            enabled: true,
                          },
                        ],
                      },
                    });
                    setNewCountry({country: '', baseUsd: 25, extraPer500gUsd: 11, policyNote: ''});
                  }}
                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Country</span>
                </button>
              </div>
            </div>

            {/* Currencies & Administrator Exchange Rates */}
            <div className="space-y-3 border-t border-[#3B332E] pt-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#C6A46A]">
                  Currencies &amp; Administrator-Configured Exchange Rates
                </p>
                <p className="text-[11px] text-[#D2C6B5] mt-0.5">
                  Rates are strictly administrator-configured per 1.00 USD (never auto-guessed).
                  LKR and USD remain active by default; enable additional currencies below.
                </p>
              </div>

              <div className="space-y-2">
                {commerce.currencies.map((c, idx) => {
                  const isLockedPrimary = c.code === 'LKR' || c.code === 'USD';
                  return (
                    <div
                      key={c.code}
                      className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-center bg-[#151312] p-2.5 rounded border border-[#3B332E] text-xs text-[#F3EBDD]"
                    >
                      <span className="font-mono-tabular font-semibold text-[#C6A46A]">
                        {c.code}
                      </span>
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) => {
                          const next = [...commerce.currencies];
                          next[idx] = {...c, name: e.target.value};
                          setCommerce({...commerce, currencies: next});
                        }}
                        className="sm:col-span-2 px-2 py-1 bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                      />
                      <input
                        type="text"
                        value={c.symbol}
                        onChange={(e) => {
                          const next = [...commerce.currencies];
                          next[idx] = {...c, symbol: e.target.value};
                          setCommerce({...commerce, currencies: next});
                        }}
                        title="Symbol"
                        className="px-2 py-1 font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                      />
                      <input
                        type="number"
                        step="0.0001"
                        min={0.01}
                        disabled={c.code === 'USD'}
                        value={c.code === 'LKR' ? commerce.shipping.usdToLkrRate : c.ratePerUsd}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const next = [...commerce.currencies];
                          next[idx] = {...c, ratePerUsd: val};
                          setCommerce({
                            ...commerce,
                            currencies: next,
                            shipping:
                              c.code === 'LKR'
                                ? {...commerce.shipping, usdToLkrRate: val}
                                : commerce.shipping,
                          });
                        }}
                        title="Rate per 1 USD"
                        className="px-2 py-1 font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded disabled:opacity-60 focus:outline-none focus:border-[#C6A46A]"
                      />
                      <label className="inline-flex items-center justify-end gap-1.5 cursor-pointer text-[#D2C6B5]">
                        <input
                          type="checkbox"
                          disabled={isLockedPrimary}
                          checked={c.enabled}
                          onChange={(e) => {
                            const next = [...commerce.currencies];
                            next[idx] = {...c, enabled: e.target.checked};
                            setCommerce({...commerce, currencies: next});
                          }}
                          className="accent-[#C6A46A]"
                        />
                        <span>{isLockedPrimary ? 'Required' : 'Enabled'}</span>
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center pt-1">
                <input
                  type="text"
                  maxLength={4}
                  placeholder="Code (e.g. CAD)"
                  value={newCurrency.code}
                  onChange={(e) =>
                    setNewCurrency({...newCurrency, code: e.target.value.toUpperCase()})
                  }
                  className="px-2.5 py-1.5 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                />
                <input
                  type="text"
                  placeholder="Symbol (e.g. C$)"
                  value={newCurrency.symbol}
                  onChange={(e) => setNewCurrency({...newCurrency, symbol: e.target.value})}
                  className="px-2.5 py-1.5 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                />
                <input
                  type="text"
                  placeholder="Name (e.g. Canadian Dollar)"
                  value={newCurrency.name}
                  onChange={(e) => setNewCurrency({...newCurrency, name: e.target.value})}
                  className="px-2.5 py-1.5 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                />
                <input
                  type="number"
                  step="0.01"
                  min={0.01}
                  placeholder="Rate / USD"
                  value={newCurrency.ratePerUsd}
                  onChange={(e) =>
                    setNewCurrency({...newCurrency, ratePerUsd: Number(e.target.value)})
                  }
                  className="px-2.5 py-1.5 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const code = newCurrency.code.trim().toUpperCase().replace(/[^A-Z]/g, '');
                    if (
                      code.length < 3 ||
                      commerce.currencies.some((c) => c.code === code) ||
                      newCurrency.ratePerUsd <= 0
                    ) {
                      return;
                    }
                    setCommerce({
                      ...commerce,
                      currencies: [
                        ...commerce.currencies,
                        {
                          code,
                          symbol: newCurrency.symbol.trim() || code,
                          name: newCurrency.name.trim() || code,
                          ratePerUsd: newCurrency.ratePerUsd,
                          enabled: true,
                        },
                      ],
                    });
                    setNewCurrency({code: '', symbol: '', name: '', ratePerUsd: 1});
                  }}
                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Currency</span>
                </button>
              </div>
            </div>

            {/* Export Defaults */}
            <div className="space-y-3 border-t border-[#3B332E] pt-4 text-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#C6A46A]">
                Export Trade Defaults
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                    Default MOQ (Units)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={commerce.exportConfig.defaultMoqUnits}
                    onChange={(e) =>
                      setCommerce({
                        ...commerce,
                        exportConfig: {
                          ...commerce.exportConfig,
                          defaultMoqUnits: Math.max(1, Number(e.target.value)),
                        },
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-[#D2C6B5] mb-1">
                    Export Pricing &amp; Quotation Policy Note
                  </label>
                  <input
                    type="text"
                    value={commerce.exportConfig.ratePolicyNote}
                    onChange={(e) =>
                      setCommerce({
                        ...commerce,
                        exportConfig: {
                          ...commerce.exportConfig,
                          ratePolicyNote: e.target.value,
                        },
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-medium bg-[#123D32] border border-[#1C493C] text-[#F3EBDD] rounded-md hover:bg-[#1C493C] cursor-pointer"
            >
              Save Payment &amp; Shipping Settings
            </button>
          </div>
        </form>
      )}

      {/* Sandbox Gateway HMAC Webhook Simulator */}
      <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-6 space-y-4">
        <div>
          <h2 className="font-medium text-base text-[#F3EBDD]">
            Sandbox Payment Webhook Simulator
          </h2>
          <p className="text-xs text-[#D2C6B5] mt-0.5">
            Dispatches a server-signed HMAC webhook callback for an existing gateway order without live merchant charges.
          </p>
        </div>
        <form
          onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            if (!simWebhook.orderRef.trim()) return;
            try {
              const res = await adminSimulateGatewayWebhook({
                provider: simWebhook.provider,
                orderRef: simWebhook.orderRef.trim(),
                outcome: simWebhook.outcome,
              });
              setMsg(
                `Simulated ${simWebhook.provider} webhook (${res.eventId}): Order ${res.order.orderRef} is now ${res.order.paymentStatus} / ${res.order.orderStatus}.`,
              );
            } catch (err) {
              setMsg(err instanceof Error ? err.message : 'Webhook simulation failed.');
            }
          }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
              Provider Adapter
            </label>
            <select
              value={simWebhook.provider}
              onChange={(e) =>
                setSimWebhook({
                  ...simWebhook,
                  provider: e.target.value as 'sl_gateway' | 'intl_gateway',
                })
              }
              className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
            >
              <option value="sl_gateway">Sri Lankan Gateway (Sandbox)</option>
              <option value="intl_gateway">International Gateway (Sandbox)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Order Ref *</label>
            <input
              type="text"
              required
              placeholder="CH-2026-1003"
              value={simWebhook.orderRef}
              onChange={(e) => setSimWebhook({...simWebhook, orderRef: e.target.value})}
              className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Outcome</label>
            <select
              value={simWebhook.outcome}
              onChange={(e) =>
                setSimWebhook({...simWebhook, outcome: e.target.value as 'paid' | 'failed'})
              }
              className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
            >
              <option value="paid">Payment Succeeded (Paid)</option>
              <option value="failed">Payment Failed</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] cursor-pointer h-[34px] whitespace-nowrap"
          >
            Simulate Signed Webhook
          </button>
        </form>
      </div>

      {/* Account MFA & App Check Security Posture */}
      <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#C6A46A]" aria-hidden="true" />
            <h2 className="font-medium text-base text-[#F3EBDD]">
              Administrator MFA &amp; App Check Posture
            </h2>
          </div>
          <span className="text-xs font-mono-tabular text-[#A99B88]">
            Client App Check: {isClientAppCheckActive() ? 'Active' : 'Not configured (set VITE_RECAPTCHA_SITE_KEY)'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-[#151312] border border-[#3B332E] rounded">
            <p className="text-[#D2C6B5]">Enrolled Account MFA Factors</p>
            <p className="font-mono-tabular font-medium text-[#F3EBDD] mt-1">
              {auth.currentUser ? multiFactor(auth.currentUser).enrolledFactors.length : 0} factor(s)
            </p>
          </div>
          <div className="p-3 bg-[#151312] border border-[#3B332E] rounded">
            <p className="text-[#D2C6B5]">Server MFA Enforcement</p>
            <p className="font-mono-tabular font-medium text-[#F3EBDD] mt-1">
              {sessionInfo?.mfaRequired ? 'ENFORCED (ADMIN_REQUIRE_MFA=true)' : 'Optional (enable in env)'}
            </p>
          </div>
          <div className="p-3 bg-[#151312] border border-[#3B332E] rounded">
            <p className="text-[#D2C6B5]">Server App Check Enforcement</p>
            <p className="font-mono-tabular font-medium text-[#F3EBDD] mt-1">
              {sessionInfo?.appCheckEnforced ? 'ENFORCED (ENFORCE_APP_CHECK=true)' : 'Optional (enable in env)'}
            </p>
          </div>
        </div>

        {auth.currentUser && (
          <div className="space-y-3 border-t border-[#3B332E] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[#D2C6B5]">
                Enroll a Time-based One-Time Password (TOTP) authenticator app on your signed-in admin account.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const current = auth.currentUser;
                    if (!current) return;
                    const session = await multiFactor(current).getSession();
                    const secret = await TotpMultiFactorGenerator.generateSecret(session);
                    setTotpSecretObj(secret);
                    setTotpSecretKey(secret.secretKey);
                    setMsg('Generated TOTP authenticator secret key. Add it to your authenticator app and confirm the 6-digit code below.');
                  } catch (err) {
                    setMsg(
                      err instanceof Error
                        ? err.message
                        : 'Recent sign-in required or TOTP MFA not enabled in Firebase Authentication console.',
                    );
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] cursor-pointer whitespace-nowrap"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Generate TOTP Enrollment Secret</span>
              </button>
            </div>

            {totpSecretObj && (
              <form
                onSubmit={async (e: FormEvent) => {
                  e.preventDefault();
                  try {
                    const current = auth.currentUser;
                    if (!current) return;
                    const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
                      totpSecretObj,
                      totpVerifyCode.trim(),
                    );
                    await multiFactor(current).enroll(assertion, 'Admin Authenticator');
                    setTotpSecretObj(null);
                    setTotpSecretKey('');
                    setTotpVerifyCode('');
                    setMsg('TOTP multi-factor authentication enrolled successfully for this administrator account.');
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : 'Unable to confirm TOTP code.');
                  }
                }}
                className="p-4 bg-[#151312] border border-[#C6A46A]/50 rounded-md space-y-3 text-xs text-[#F3EBDD]"
              >
                <p className="font-mono-tabular break-all">
                  <strong className="text-[#C6A46A]">Secret Key:</strong> {totpSecretKey}
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    placeholder="Enter 6-digit code from app"
                    value={totpVerifyCode}
                    onChange={(e) => setTotpVerifyCode(e.target.value)}
                    className="px-3 py-2 font-mono-tabular bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 font-medium bg-[#123D32] border border-[#1C493C] text-[#F3EBDD] rounded hover:bg-[#1C493C] cursor-pointer whitespace-nowrap"
                  >
                    Confirm &amp; Enroll MFA
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Role-Based Administrators */}
      <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-6 space-y-4">
        <h2 className="font-medium text-base text-[#F3EBDD]">
          Role-Based Administrators (`adminUsers`)
        </h2>
        <form
          onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            if (!newAdmin.uid.trim() || !newAdmin.email.trim()) {
              return;
            }
            try {
              await saveAdminUser({...newAdmin, active: true, isNew: true});
              setNewAdmin({uid: '', email: '', displayName: '', role: 'catalog_manager'});
              const adm = await fetchPaginated<AdminUserRecord>('adminUsers', {pageSize: 30});
              setAdmins(adm.items);
              void syncAdminAllowlistToServer(
                adm.items
                  .filter((x) => x.active)
                  .map((x) => ({email: x.email, role: x.role})),
              ).catch(() => undefined);
              setMsg('Administrator role saved and synced to server RBAC.');
            } catch (err) {
              setMsg(err instanceof Error ? err.message : 'Failed to save administrator.');
            }
          }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
              Firebase UID *
            </label>
            <input
              type="text"
              required
              value={newAdmin.uid}
              onChange={(e) => setNewAdmin({...newAdmin, uid: e.target.value})}
              className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
              Google Email *
            </label>
            <input
              type="email"
              required
              value={newAdmin.email}
              onChange={(e) => setNewAdmin({...newAdmin, email: e.target.value})}
              className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Role</label>
            <select
              value={newAdmin.role}
              onChange={(e) => setNewAdmin({...newAdmin, role: e.target.value as AdminRole})}
              className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
            >
              <option value="super_admin">Super Admin</option>
              <option value="catalog_manager">Catalog Manager</option>
              <option value="order_manager">Order Manager</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium bg-[#123D32] border border-[#1C493C] text-[#F3EBDD] rounded hover:bg-[#1C493C] cursor-pointer h-[34px] whitespace-nowrap"
          >
            Add Admin
          </button>
        </form>

        <div className="divide-y divide-[#3B332E] border-t border-[#3B332E] pt-2">
          {admins.map((a) => (
            <div key={a.uid} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium text-[#F3EBDD]">{a.email}</p>
                <p className="text-xs font-mono-tabular text-[#A99B88]">
                  UID: {a.uid} · Role: <span className="text-[#C6A46A]">{a.role}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await saveAdminUser({...a, active: !a.active, isNew: false});
                    const nextAdmins = admins.map((row) =>
                      row.uid === a.uid ? {...row, active: !row.active} : row,
                    );
                    setAdmins(nextAdmins);
                    void syncAdminAllowlistToServer(
                      nextAdmins
                        .filter((x) => x.active)
                        .map((x) => ({email: x.email, role: x.role})),
                    ).catch(() => undefined);
                    setMsg(`Updated status for ${a.email}.`);
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : 'Failed to update admin.');
                  }
                }}
                className={`px-3 py-1 text-xs border rounded cursor-pointer ${
                  a.active
                    ? 'bg-[#123D32]/60 border-[#86EFAC]/40 text-[#86EFAC]'
                    : 'bg-[#2A2522] border-[#3B332E] text-[#A99B88]'
                }`}
              >
                {a.active ? 'Active' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


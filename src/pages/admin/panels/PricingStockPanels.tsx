import {useEffect, useState} from 'react';
import {useStore} from '../../../context/StoreContext';
import {
  fetchExportCatalog,
  syncServerExportPricing,
  syncServerStockOverrides,
} from '../../../services/commerceApi';
import {
  fetchInventoryList,
  fetchPaginated,
  saveProduct,
  updateInventoryAndVariantStock,
} from '../../../services/firestoreService';
import type {AdminSectionId, InventoryRecord} from '../../../types/admin';
import type {Product} from '../../../types/commerce';

interface PricingStockPanelsProps {
  section: Extract<AdminSectionId, 'pricing' | 'stock'>;
}

interface ExportPricingRow {
  productId: string;
  name: string;
  brandId: string;
  exportable: boolean;
  moqUnits: number;
  exportPriceUsd: number;
  bulkPackText: string;
}

export default function PricingStockPanels({section}: PricingStockPanelsProps) {
  const {refreshCatalog} = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [exportRows, setExportRows] = useState<ExportPricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, invRes, expRes] = await Promise.allSettled([
        fetchPaginated<Product>('products', {pageSize: 30}),
        fetchInventoryList(40),
        fetchExportCatalog(),
      ]);
      const prodItems = prodRes.status === 'fulfilled' ? prodRes.value.items : [];
      const invItems = invRes.status === 'fulfilled' ? invRes.value.items : [];
      const expProducts = expRes.status === 'fulfilled' ? expRes.value.products : prodItems;
      const defaultMoq =
        expRes.status === 'fulfilled' ? expRes.value.exportConfig.defaultMoqUnits : 25;

      setProducts(prodItems);
      setInventory(invItems);
      setExportRows(
        (expProducts.length ? expProducts : prodItems).map((p) => ({
          productId: p.id,
          name: p.name.en,
          brandId: p.brandId,
          exportable: p.exportable !== false,
          moqUnits: p.moqUnits ?? defaultMoq,
          exportPriceUsd: p.exportPriceUsd ?? p.variants[0]?.priceUsd ?? 10,
          bulkPackText: (p.bulkPackSizes || ['1kg pouch', '5kg sack', '25kg master']).join(', '),
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMsg('');
    void loadData();
  }, [section]);

  if (section === 'pricing') {
    return (
      <div className="space-y-6 text-[#F3EBDD]">
        <div>
          <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">Price Management</h1>
          <p className="text-sm text-[#D2C6B5]">
            Update LKR and USD selling prices per product variant SKU.
          </p>
        </div>

        {msg && <div className="p-3 text-sm bg-[#211C1A] border border-[#C6A46A]/60 text-[#F3EBDD] rounded-md">{msg}</div>}

        <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#2A2522] border-b border-[#3B332E] text-xs text-[#C6A46A]">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Variant SKU</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Price (LKR)</th>
                <th className="px-4 py-3">Price (USD)</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3B332E]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#A99B88]">
                    Loading variant pricing...
                  </td>
                </tr>
              ) : (
                products.flatMap((p) =>
                  p.variants.map((v, idx) => (
                    <tr key={v.variantSku} className="hover:bg-[#2A2522]/45">
                      <td className="px-4 py-2.5 font-medium text-[#F3EBDD]">{p.name.en}</td>
                      <td className="px-4 py-2.5 font-mono-tabular text-xs text-[#C6A46A]">{v.variantSku}</td>
                      <td className="px-4 py-2.5 text-xs text-[#D2C6B5]">{v.label}</td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          value={v.priceLkr}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setProducts((prev) =>
                              prev.map((prod) =>
                                prod.id === p.id
                                  ? {
                                      ...prod,
                                      variants: prod.variants.map((vr, i) =>
                                        i === idx ? {...vr, priceLkr: val} : vr,
                                      ),
                                    }
                                  : prod,
                              ),
                            );
                          }}
                          className="w-28 px-2.5 py-1 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          step="0.1"
                          value={v.priceUsd}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setProducts((prev) =>
                              prev.map((prod) =>
                                prod.id === p.id
                                  ? {
                                      ...prod,
                                      variants: prod.variants.map((vr, i) =>
                                        i === idx ? {...vr, priceUsd: val} : vr,
                                      ),
                                    }
                                  : prod,
                              ),
                            );
                          }}
                          className="w-24 px-2.5 py-1 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await saveProduct(p);
                              setMsg(`Updated price for ${v.variantSku}.`);
                              void refreshCatalog();
                            } catch (err) {
                              setMsg(err instanceof Error ? err.message : 'Failed to save price.');
                            }
                          }}
                          className="px-3 py-1 text-xs font-medium bg-[#C6A46A] text-[#151312] hover:bg-[#D4B47B] rounded cursor-pointer whitespace-nowrap"
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  )),
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Export Pricing, MOQ & Bulk Packaging Formats */}
        <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                Export Pricing, MOQ &amp; Bulk Packaging
              </h2>
              <p className="text-xs text-[#D2C6B5]">
                Configure wholesale export availability, minimum order quantities, indicative USD
                export unit pricing, and available bulk pack formats.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await syncServerExportPricing(
                    exportRows.map((row) => ({
                      productId: row.productId,
                      exportable: row.exportable,
                      moqUnits: Math.max(1, Number(row.moqUnits) || 25),
                      exportPriceUsd: Math.max(0.1, Number(row.exportPriceUsd) || 10),
                      bulkPackSizes: row.bulkPackText
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })),
                  );
                  setMsg('Saved export pricing, MOQ, and packaging formats.');
                  void refreshCatalog();
                } catch (err) {
                  setMsg(
                    err instanceof Error ? err.message : 'Failed to save export configuration.',
                  );
                }
              }}
              className="px-4 py-2 text-xs font-medium bg-[#123D32] border border-[#1C493C] text-[#F3EBDD] hover:bg-[#1C493C] rounded-md cursor-pointer whitespace-nowrap"
            >
              Save Export Configuration
            </button>
          </div>

          <div className="overflow-x-auto border border-[#3B332E] rounded-md">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#2A2522] border-b border-[#3B332E] text-[#C6A46A]">
                <tr>
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5">Exportable</th>
                  <th className="px-3 py-2.5">MOQ (Units)</th>
                  <th className="px-3 py-2.5">Export Ref (USD)</th>
                  <th className="px-3 py-2.5">Bulk Pack Sizes (Comma-separated)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3B332E]">
                {exportRows.map((row, idx) => (
                  <tr key={row.productId} className="hover:bg-[#2A2522]/45">
                    <td className="px-3 py-2.5 font-medium text-[#F3EBDD]">
                      <span>{row.name}</span>
                      <span className="block text-[10px] uppercase text-[#A99B88]">
                        {row.brandId}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={row.exportable}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setExportRows((prev) =>
                            prev.map((item, i) =>
                              i === idx ? {...item, exportable: checked} : item,
                            ),
                          );
                        }}
                        className="accent-[#C6A46A]"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min={1}
                        value={row.moqUnits}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value));
                          setExportRows((prev) =>
                            prev.map((item, i) => (i === idx ? {...item, moqUnits: val} : item)),
                          );
                        }}
                        className="w-20 px-2 py-1 font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min={0.1}
                        step="0.1"
                        value={row.exportPriceUsd}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setExportRows((prev) =>
                            prev.map((item, i) =>
                              i === idx ? {...item, exportPriceUsd: val} : item,
                            ),
                          );
                        }}
                        className="w-24 px-2 py-1 font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        value={row.bulkPackText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setExportRows((prev) =>
                            prev.map((item, i) =>
                              i === idx ? {...item, bulkPackText: val} : item,
                            ),
                          );
                        }}
                        className="w-full min-w-[220px] px-2.5 py-1 bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#F3EBDD]">
      <div>
        <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">Stock Management</h1>
        <p className="text-sm text-[#D2C6B5]">
          Synchronized inventory ledger updating both `inventory` and product variant availability.
        </p>
      </div>

      {msg && <div className="p-3 text-sm bg-[#211C1A] border border-[#C6A46A]/60 text-[#F3EBDD] rounded-md">{msg}</div>}

      <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#2A2522] border-b border-[#3B332E] text-xs text-[#C6A46A]">
            <tr>
              <th className="px-4 py-3">Variant SKU</th>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Quantity</th>
              <th className="px-4 py-3">Available</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3B332E]">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#A99B88]">
                  Loading stock ledger...
                </td>
              </tr>
            ) : (
              inventory.map((inv) => {
                const parent = products.find((p) => p.id === inv.productId);
                return (
                  <tr key={inv.variantSku} className="hover:bg-[#2A2522]/45">
                    <td className="px-4 py-2.5 font-mono-tabular text-xs text-[#C6A46A]">{inv.variantSku}</td>
                    <td className="px-4 py-2.5 text-xs uppercase text-[#D2C6B5]">{inv.brandId}</td>
                    <td className="px-4 py-2.5 text-xs text-[#D2C6B5]">{inv.label}</td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min={0}
                        value={inv.stockQuantity}
                        onChange={(e) => {
                          const qty = Math.max(0, Number(e.target.value));
                          setInventory((prev) =>
                            prev.map((row) =>
                              row.variantSku === inv.variantSku
                                ? {...row, stockQuantity: qty}
                                : row,
                            ),
                          );
                        }}
                        className="w-24 px-2.5 py-1 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={inv.available}
                        onChange={(e) => {
                          const avail = e.target.checked;
                          setInventory((prev) =>
                            prev.map((row) =>
                              row.variantSku === inv.variantSku ? {...row, available: avail} : row,
                            ),
                          );
                        }}
                        className="accent-[#C6A46A]"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={!parent}
                        onClick={async () => {
                          if (!parent) {
                            return;
                          }
                          try {
                            await updateInventoryAndVariantStock(
                              parent,
                              inv.variantSku,
                              inv.stockQuantity,
                              inv.available,
                            );
                            try {
                              await syncServerStockOverrides([
                                {
                                  variantSku: inv.variantSku,
                                  stockQuantity: inv.stockQuantity,
                                  available: inv.available,
                                },
                              ]);
                            } catch {
                              // Best effort if server route unavailable
                            }
                            setProducts((prev) =>
                              prev.map((prod) =>
                                prod.id === parent.id
                                  ? {
                                      ...prod,
                                      variants: prod.variants.map((vr) =>
                                        vr.variantSku === inv.variantSku
                                          ? {
                                              ...vr,
                                              stockQuantity: inv.stockQuantity,
                                              available: inv.available,
                                            }
                                          : vr,
                                      ),
                                    }
                                  : prod,
                              ),
                            );
                            setMsg(`Synced stock for ${inv.variantSku} (${inv.stockQuantity} units).`);
                            void refreshCatalog();
                          } catch (err) {
                            setMsg(err instanceof Error ? err.message : 'Failed to update stock.');
                          }
                        }}
                        className="px-3 py-1 text-xs font-medium bg-[#C6A46A] text-[#151312] hover:bg-[#D4B47B] rounded disabled:opacity-40 cursor-pointer whitespace-nowrap"
                      >
                        Update Stock
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import {FormEvent, useEffect, useState} from 'react';
import type {DocumentData, QueryDocumentSnapshot} from 'firebase/firestore';
import {where} from 'firebase/firestore';
import {Plus, Trash2, Upload} from 'lucide-react';
import BrandLogo, {isOfficialLogoBrand} from '../../../components/BrandLogo';
import SafeImage from '../../../components/SafeImage';
import {useStore} from '../../../context/StoreContext';
import {
  fetchPaginated,
  saveBrand,
  saveCategory,
  saveProduct,
} from '../../../services/firestoreService';
import type {AdminSectionId, CategoryRecord} from '../../../types/admin';
import type {BrandConfig, BrandId, Product, ProductVariant} from '../../../types/commerce';
import {uploadOptimizedProductImage} from '../../../utils/imageUpload';

interface CatalogPanelsProps {
  section: Extract<AdminSectionId, 'products' | 'categories' | 'brands' | 'variants'>;
}

const EMPTY_PRODUCT: Product = {
  id: '',
  brandId: 'ceyvana',
  sku: '',
  slug: '',
  categorySlug: 'whole-spices',
  name: {en: '', si: ''},
  category: {en: 'Whole & Ground Spices', si: 'සම්පූර්ණ සහ කුඩු කළ කුළුබඩු'},
  description: {en: '', si: ''},
  tastingNotes: {en: '', si: ''},
  origin: {en: 'Sri Lanka', si: 'ශ්‍රී ලංකාව'},
  mainImage: '/src/assets/images/brand_ceyvana_spices_1795545289791.jpg',
  thumbnailImage: '/src/assets/images/brand_ceyvana_spices_1795545289791.jpg',
  gallery: [],
  availability: 'in_stock',
  featured: false,
  isArchived: false,
  seoTitle: '',
  seoDescription: '',
  variants: [
    {
      variantSku: '',
      label: '100g',
      weightGrams: 100,
      priceLkr: 950,
      priceUsd: 4.5,
      stockQuantity: 50,
      available: true,
    },
  ],
};

export default function CatalogPanels({section}: CatalogPanelsProps) {
  const {refreshCatalog} = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [brandFilter, setBrandFilter] = useState<'all' | BrandId>('all');
  const [cursorStack, setCursorStack] = useState<(QueryDocumentSnapshot<DocumentData> | null)[]>([
    null,
  ]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [newCategory, setNewCategory] = useState<CategoryRecord>({
    id: '',
    brandId: 'ceyvana',
    slug: '',
    name: {en: '', si: ''},
    sortOrder: 1,
    isActive: true,
  });

  const [brands, setBrands] = useState<BrandConfig[]>([]);
  const [selectedVariantProductId, setSelectedVariantProductId] = useState('');

  const loadProducts = async (cursor: QueryDocumentSnapshot<DocumentData> | null = null) => {
    setLoading(true);
    try {
      const constraints = brandFilter !== 'all' ? [where('brandId', '==', brandFilter)] : [];
      const res = await fetchPaginated<Product>('products', {
        pageSize: 8,
        cursor,
        constraints,
      });
      setProducts(res.items);
      setLastDoc(res.lastDoc);
      setHasMore(res.hasMore);
      if (res.items.length > 0 && !selectedVariantProductId) {
        setSelectedVariantProductId(res.items[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await fetchPaginated<CategoryRecord>('categories', {pageSize: 30});
      setCategories(res.items);
    } finally {
      setLoading(false);
    }
  };

  const loadBrands = async () => {
    setLoading(true);
    try {
      const res = await fetchPaginated<BrandConfig>('brands', {pageSize: 20});
      setBrands(res.items.sort((a, b) => (a.sortOrder ?? 9) - (b.sortOrder ?? 9)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setStatusMsg('');
    if (section === 'products' || section === 'variants') {
      setCursorStack([null]);
      void loadProducts(null);
    } else if (section === 'categories') {
      void loadCategories();
    } else if (section === 'brands') {
      void loadBrands();
    }
  }, [section, brandFilter]);

  const handleImageUpload = async (file: File) => {
    if (!editingProduct) {
      return;
    }
    const skuSlug = editingProduct.sku
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const targetId =
      editingProduct.id || `${editingProduct.brandId}-${skuSlug || Date.now()}`;
    setUploadingImage(true);
    setStatusMsg('');
    try {
      const {mainUrl, thumbnailUrl} = await uploadOptimizedProductImage(
        file,
        editingProduct.brandId,
        targetId,
      );
      setEditingProduct({
        ...editingProduct,
        id: editingProduct.id || targetId,
        mainImage: mainUrl,
        thumbnailImage: thumbnailUrl,
        gallery: Array.from(new Set([mainUrl, ...editingProduct.gallery])).slice(0, 6),
      });
      setStatusMsg('Compressed image and thumbnail uploaded to Firebase Storage.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingProduct) {
      return;
    }
    setStatusMsg('');
    try {
      const computedId =
        editingProduct.id ||
        `${editingProduct.brandId}-${editingProduct.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
      const slug =
        editingProduct.slug ||
        editingProduct.name.en
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      const normalizedVariants: ProductVariant[] = editingProduct.variants.map((v, idx) => ({
        ...v,
        variantSku:
          v.variantSku.trim() ||
          `${editingProduct.sku.trim()}-${v.label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-') || idx + 1}`,
        weightGrams: Number(v.weightGrams) || 100,
        priceLkr: Number(v.priceLkr) || 0,
        priceUsd: Number(v.priceUsd) || 0,
        stockQuantity: Number(v.stockQuantity) || 0,
      }));

      await saveProduct({
        ...editingProduct,
        id: computedId,
        slug,
        seoTitle: editingProduct.seoTitle || `${editingProduct.name.en} | Ceylon Heritage`,
        seoDescription:
          editingProduct.seoDescription || editingProduct.description.en.slice(0, 155),
        variants: normalizedVariants,
      });
      setEditingProduct(null);
      setStatusMsg('Product and variant inventory saved.');
      await Promise.all([loadProducts(null), refreshCatalog()]);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to save product.');
    }
  };

  if (section === 'products') {
    return (
      <div className="space-y-6 text-[#F3EBDD]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">
              Product Management
            </h1>
            <p className="text-sm text-[#D2C6B5]">
              Create, edit, archive products, and upload compressed Firebase Storage images.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value as 'all' | BrandId)}
              className="px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
            >
              <option value="all">All Brands</option>
              <option value="ceyvana">Ceyvana</option>
              <option value="ceylomira">Ceylomira</option>
            </select>
            <button
              type="button"
              onClick={() => setEditingProduct({...EMPTY_PRODUCT})}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="p-3 text-sm bg-[#211C1A] border border-[#C6A46A]/60 text-[#F3EBDD] rounded-md">
            {statusMsg}
          </div>
        )}

        {editingProduct && (
          <form
            onSubmit={handleSaveProduct}
            className="bg-[#211C1A] border border-[#C6A46A]/35 rounded-lg p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-[#3B332E] pb-3">
              <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                {editingProduct.id ? `Edit: ${editingProduct.name.en}` : 'New Product'}
              </h2>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-xs text-[#D2C6B5] hover:text-[#C6A46A] cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Brand</label>
                <select
                  value={editingProduct.brandId}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      brandId: e.target.value as BrandId,
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                >
                  <option value="ceyvana">Ceyvana</option>
                  <option value="ceylomira">Ceylomira</option>
                  <option value="hand-crafts">Hand Crafts</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Product SKU *</label>
                <input
                  type="text"
                  required
                  value={editingProduct.sku}
                  onChange={(e) => setEditingProduct({...editingProduct, sku: e.target.value})}
                  placeholder="CYV-CLOV"
                  className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Category Slug</label>
                <input
                  type="text"
                  value={editingProduct.categorySlug}
                  onChange={(e) =>
                    setEditingProduct({...editingProduct, categorySlug: e.target.value})
                  }
                  className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Name (English) *</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name.en}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      name: {...editingProduct.name, en: e.target.value},
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Name (Sinhala)</label>
                <input
                  type="text"
                  value={editingProduct.name.si}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      name: {...editingProduct.name, si: e.target.value},
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Description (English)</label>
                <textarea
                  rows={3}
                  value={editingProduct.description.en}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      description: {...editingProduct.description, en: e.target.value},
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Description (Sinhala)</label>
                <textarea
                  rows={3}
                  value={editingProduct.description.si}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      description: {...editingProduct.description, si: e.target.value},
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center border-t border-[#3B332E] pt-4">
              <div className="flex items-center gap-3">
                <div className="w-20 aspect-[4/3] rounded overflow-hidden bg-[#151312] border border-[#3B332E]">
                  <SafeImage
                    src={editingProduct.thumbnailImage || editingProduct.mainImage}
                    alt={editingProduct.name.en || 'Preview'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#3B332E] bg-[#2A2522] text-[#F3EBDD] rounded-md cursor-pointer hover:border-[#C6A46A]">
                  <Upload className="w-3.5 h-3.5 text-[#C6A46A]" />
                  <span>{uploadingImage ? 'Compressing...' : 'Upload Image'}</span>
                  <input
                    type="file"
                    accept="image/webp,image/jpeg,image/png"
                    className="sr-only"
                    disabled={uploadingImage}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleImageUpload(file);
                      }
                    }}
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Availability</label>
                <select
                  value={editingProduct.availability}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      availability: e.target.value as Product['availability'],
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                >
                  <option value="in_stock">In Stock</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
              </div>

              <div className="flex items-center gap-5 pt-4 text-[#F3EBDD]">
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingProduct.featured)}
                    onChange={(e) =>
                      setEditingProduct({...editingProduct, featured: e.target.checked})
                    }
                    className="accent-[#C6A46A]"
                  />
                  <span>Featured</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingProduct.isArchived)}
                    onChange={(e) =>
                      setEditingProduct({...editingProduct, isArchived: e.target.checked})
                    }
                    className="accent-[#C6A46A]"
                  />
                  <span>Archived</span>
                </label>
              </div>
            </div>

            {/* Verified Product Portfolio Specifications (Optional — left blank to omit cleanly) */}
            <div className="border-t border-[#3B332E] pt-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#C6A46A]">
                Verified Portfolio Specifications (Leave blank if unverified; omitted from PDFs automatically)
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    Key Highlights (EN, comma separated)
                  </label>
                  <input
                    type="text"
                    value={editingProduct.highlights?.en || ''}
                    onChange={(e) => {
                      setEditingProduct({
                        ...editingProduct,
                        highlights: {
                          en: e.target.value,
                          si: editingProduct.highlights?.si || '',
                        },
                      });
                    }}
                    placeholder="Single-estate Alba quills, Hand-rolled in Matara"
                    className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    Key Highlights (SI, comma separated)
                  </label>
                  <input
                    type="text"
                    value={editingProduct.highlights?.si || ''}
                    onChange={(e) => {
                      setEditingProduct({
                        ...editingProduct,
                        highlights: {
                          en: editingProduct.highlights?.en || '',
                          si: e.target.value,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Ingredients (EN)</label>
                  <input
                    type="text"
                    value={editingProduct.ingredients?.en || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        ingredients: {
                          en: e.target.value,
                          si: editingProduct.ingredients?.si || '',
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Ingredients (SI)</label>
                  <input
                    type="text"
                    value={editingProduct.ingredients?.si || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        ingredients: {
                          en: editingProduct.ingredients?.en || '',
                          si: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Packaging Type (EN)</label>
                  <input
                    type="text"
                    value={editingProduct.packagingType?.en || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        packagingType: {
                          en: e.target.value,
                          si: editingProduct.packagingType?.si || '',
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Storage Instructions (EN)</label>
                  <input
                    type="text"
                    value={editingProduct.storageInstructions?.en || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        storageInstructions: {
                          en: e.target.value,
                          si: editingProduct.storageInstructions?.si || '',
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Verified Shelf Life</label>
                  <input
                    type="text"
                    value={editingProduct.exportSpecs?.shelfLife || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        exportSpecs: {
                          ...(editingProduct.exportSpecs || {
                            exportable: true,
                            moqUnits: 25,
                            exportPriceUsd: editingProduct.variants[0]?.priceUsd || 4,
                            bulkPackSizes: [],
                          }),
                          shelfLife: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. 24 months sealed"
                    className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Technical / Export Specs (EN)</label>
                  <input
                    type="text"
                    value={editingProduct.technicalSpecs?.en || ''}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        technicalSpecs: {
                          en: e.target.value,
                          si: editingProduct.technicalSpecs?.si || '',
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#D2C6B5] mb-1">
                    Verified Certifications (comma separated)
                  </label>
                  <input
                    type="text"
                    value={(editingProduct.certifications || []).join(', ')}
                    onChange={(e) => {
                      const list = e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                      setEditingProduct({...editingProduct, certifications: list});
                    }}
                    placeholder="Leave blank if unverified"
                    className="w-full px-3 py-2 text-xs bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-medium bg-[#C6A46A] text-[#151312] hover:bg-[#D4B47B] rounded-md cursor-pointer whitespace-nowrap"
              >
                Save Product
              </button>
            </div>
          </form>
        )}

        <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#2A2522] border-b border-[#3B332E] text-xs text-[#C6A46A]">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Variants</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3B332E]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#A99B88]">
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#A99B88]">
                    No products in Firestore yet. Use &quot;Initialize Catalog &amp; Settings&quot; in Overview.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-[#2A2522]/45">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-12 aspect-[4/3] rounded overflow-hidden bg-[#151312] border border-[#3B332E] shrink-0">
                          <SafeImage
                            src={p.thumbnailImage || p.mainImage}
                            alt={p.name.en}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#F3EBDD]">{p.name.en}</p>
                          <p className="text-xs text-[#A99B88]">{p.category.en}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs uppercase text-[#D2C6B5]">{p.brandId}</td>
                    <td className="px-4 py-3 font-mono-tabular text-xs text-[#C6A46A]">{p.sku}</td>
                    <td className="px-4 py-3 font-mono-tabular text-xs text-[#F3EBDD]">{p.variants.length}</td>
                    <td className="px-4 py-3 text-xs text-[#D2C6B5]">
                      {p.isArchived ? 'Archived' : p.availability}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingProduct(p)}
                        className="px-3 py-1.5 text-xs border border-[#3B332E] bg-[#2A2522] text-[#F3EBDD] rounded hover:border-[#C6A46A] cursor-pointer whitespace-nowrap"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={cursorStack.length <= 1}
            onClick={() => {
              const prevStack = cursorStack.slice(0, -1);
              setCursorStack(prevStack);
              void loadProducts(prevStack[prevStack.length - 1] ?? null);
            }}
            className="px-3 py-1.5 text-xs border border-[#3B332E] bg-[#211C1A] text-[#F3EBDD] rounded hover:border-[#C6A46A] disabled:opacity-40 cursor-pointer"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={!hasMore || !lastDoc}
            onClick={() => {
              if (!lastDoc) {
                return;
              }
              setCursorStack((s) => [...s, lastDoc]);
              void loadProducts(lastDoc);
            }}
            className="px-3 py-1.5 text-xs border border-[#3B332E] bg-[#211C1A] text-[#F3EBDD] rounded hover:border-[#C6A46A] disabled:opacity-40 cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  if (section === 'variants') {
    const activeProd = products.find((p) => p.id === selectedVariantProductId) ?? products[0];
    return (
      <div className="space-y-6 text-[#F3EBDD]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">Product Variant Management</h1>
            <p className="text-sm text-[#D2C6B5]">
              Configure pack sizes, variant SKUs, net weights, and availability per product.
            </p>
          </div>
          {products.length > 0 && (
            <select
              value={activeProd?.id || ''}
              onChange={(e) => setSelectedVariantProductId(e.target.value)}
              className="px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brandId.toUpperCase()} · {p.name.en}
                </option>
              ))}
            </select>
          )}
        </div>

        {statusMsg && (
          <div className="p-3 text-sm bg-[#211C1A] border border-[#C6A46A]/60 text-[#F3EBDD] rounded-md">
            {statusMsg}
          </div>
        )}

        {activeProd && (
          <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-base text-[#F3EBDD]">{activeProd.name.en}</h2>
              <button
                type="button"
                onClick={() => {
                  const nextVariants = [
                    ...activeProd.variants,
                    {
                      variantSku: `${activeProd.sku}-NEW`,
                      label: '500g',
                      weightGrams: 500,
                      priceLkr: 2500,
                      priceUsd: 11,
                      stockQuantity: 25,
                      available: true,
                    },
                  ];
                  setProducts((prev) =>
                    prev.map((p) =>
                      p.id === activeProd.id ? {...p, variants: nextVariants} : p,
                    ),
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#C6A46A] text-[#151312] hover:bg-[#D4B47B] rounded cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Variant</span>
              </button>
            </div>

            <div className="space-y-3">
              {activeProd.variants.map((v, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end p-3 bg-[#151312] border border-[#3B332E] rounded-md"
                >
                  <div>
                    <label className="block text-[11px] text-[#D2C6B5]">Variant SKU</label>
                    <input
                      type="text"
                      value={v.variantSku}
                      onChange={(e) => {
                        const updated = activeProd.variants.map((item, i) =>
                          i === idx ? {...item, variantSku: e.target.value} : item,
                        );
                        setProducts((prev) =>
                          prev.map((p) => (p.id === activeProd.id ? {...p, variants: updated} : p)),
                        );
                      }}
                      className="w-full px-2.5 py-1.5 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#D2C6B5]">Pack Size</label>
                    <input
                      type="text"
                      value={v.label}
                      onChange={(e) => {
                        const updated = activeProd.variants.map((item, i) =>
                          i === idx ? {...item, label: e.target.value} : item,
                        );
                        setProducts((prev) =>
                          prev.map((p) => (p.id === activeProd.id ? {...p, variants: updated} : p)),
                        );
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#D2C6B5]">Weight (g)</label>
                    <input
                      type="number"
                      value={v.weightGrams}
                      onChange={(e) => {
                        const updated = activeProd.variants.map((item, i) =>
                          i === idx ? {...item, weightGrams: Number(e.target.value)} : item,
                        );
                        setProducts((prev) =>
                          prev.map((p) => (p.id === activeProd.id ? {...p, variants: updated} : p)),
                        );
                      }}
                      className="w-full px-2.5 py-1.5 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#D2C6B5]">LKR Price</label>
                    <input
                      type="number"
                      value={v.priceLkr}
                      onChange={(e) => {
                        const updated = activeProd.variants.map((item, i) =>
                          i === idx ? {...item, priceLkr: Number(e.target.value)} : item,
                        );
                        setProducts((prev) =>
                          prev.map((p) => (p.id === activeProd.id ? {...p, variants: updated} : p)),
                        );
                      }}
                      className="w-full px-2.5 py-1.5 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#D2C6B5]">Stock</label>
                    <input
                      type="number"
                      value={v.stockQuantity}
                      onChange={(e) => {
                        const updated = activeProd.variants.map((item, i) =>
                          i === idx ? {...item, stockQuantity: Number(e.target.value)} : item,
                        );
                        setProducts((prev) =>
                          prev.map((p) => (p.id === activeProd.id ? {...p, variants: updated} : p)),
                        );
                      }}
                      className="w-full px-2.5 py-1.5 text-xs font-mono-tabular bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1.5 text-xs text-[#F3EBDD]">
                      <input
                        type="checkbox"
                        checked={v.available}
                        onChange={(e) => {
                          const updated = activeProd.variants.map((item, i) =>
                            i === idx ? {...item, available: e.target.checked} : item,
                          );
                          setProducts((prev) =>
                            prev.map((p) =>
                              p.id === activeProd.id ? {...p, variants: updated} : p,
                            ),
                          );
                        }}
                        className="accent-[#C6A46A]"
                      />
                      <span>Active</span>
                    </label>
                    {activeProd.variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = activeProd.variants.filter((_, i) => i !== idx);
                          setProducts((prev) =>
                            prev.map((p) =>
                              p.id === activeProd.id ? {...p, variants: updated} : p,
                            ),
                          );
                        }}
                        className="p-1.5 text-[#F3B0B6] hover:text-[#F3EBDD] cursor-pointer"
                        aria-label="Remove variant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await saveProduct(activeProd);
                    setStatusMsg(`Saved variants for ${activeProd.name.en}.`);
                    void refreshCatalog();
                  } catch (err) {
                    setStatusMsg(err instanceof Error ? err.message : 'Save failed.');
                  }
                }}
                className="px-5 py-2.5 text-xs font-medium bg-[#C6A46A] text-[#151312] hover:bg-[#D4B47B] rounded-md cursor-pointer whitespace-nowrap"
              >
                Save Variants to Firestore
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (section === 'categories') {
    return (
      <div className="space-y-6 text-[#F3EBDD]">
        <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">Category Management</h1>
        {statusMsg && (
          <div className="p-3 text-sm bg-[#211C1A] border border-[#C6A46A]/60 text-[#F3EBDD] rounded-md">
            {statusMsg}
          </div>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await saveCategory(newCategory);
              setNewCategory({
                id: '',
                brandId: 'ceyvana',
                slug: '',
                name: {en: '', si: ''},
                sortOrder: 1,
                isActive: true,
              });
              setStatusMsg('Category saved.');
              await loadCategories();
            } catch (err) {
              setStatusMsg(err instanceof Error ? err.message : 'Failed to save category.');
            }
          }}
          className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Brand</label>
            <select
              value={newCategory.brandId}
              onChange={(e) =>
                setNewCategory({...newCategory, brandId: e.target.value as BrandId})
              }
              className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
            >
              <option value="ceyvana">Ceyvana</option>
              <option value="ceylomira">Ceylomira</option>
              <option value="hand-crafts">Hand Crafts</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Slug *</label>
            <input
              type="text"
              required
              value={newCategory.slug}
              onChange={(e) => setNewCategory({...newCategory, slug: e.target.value})}
              placeholder="herbal-blends"
              className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] placeholder-[#A99B88] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Name (EN) *</label>
            <input
              type="text"
              required
              value={newCategory.name.en}
              onChange={(e) =>
                setNewCategory({
                  ...newCategory,
                  name: {...newCategory.name, en: e.target.value},
                })
              }
              className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#D2C6B5] mb-1">Name (SI)</label>
            <input
              type="text"
              value={newCategory.name.si}
              onChange={(e) =>
                setNewCategory({
                  ...newCategory,
                  name: {...newCategory.name, si: e.target.value},
                })
              }
              className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded focus:outline-none focus:border-[#C6A46A]"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium bg-[#C6A46A] text-[#151312] hover:bg-[#D4B47B] rounded cursor-pointer h-[38px] whitespace-nowrap"
          >
            Save Category
          </button>
        </form>

        <div className="bg-[#211C1A] border border-[#3B332E] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#2A2522] border-b border-[#3B332E] text-xs text-[#C6A46A]">
              <tr>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">English</th>
                <th className="px-4 py-3">Sinhala</th>
                <th className="px-4 py-3">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3B332E]">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-[#2A2522]/45">
                  <td className="px-4 py-3 text-xs uppercase text-[#D2C6B5]">{cat.brandId}</td>
                  <td className="px-4 py-3 font-mono-tabular text-xs text-[#C6A46A]">{cat.slug}</td>
                  <td className="px-4 py-3 text-[#F3EBDD]">{cat.name.en}</td>
                  <td className="px-4 py-3 text-[#D2C6B5]">{cat.name.si}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await saveCategory({...cat, isActive: !cat.isActive});
                          setStatusMsg(`Updated category ${cat.name.en}.`);
                          await loadCategories();
                        } catch (err) {
                          setStatusMsg(err instanceof Error ? err.message : 'Failed to update category.');
                        }
                      }}
                      className={`px-2.5 py-1 text-xs border rounded cursor-pointer ${
                        cat.isActive
                          ? 'bg-[#123D32] text-[#86EFAC] border-[#1C493C]'
                          : 'bg-[#2A2522] text-[#A99B88] border-[#3B332E]'
                      }`}
                    >
                      {cat.isActive ? 'Active' : 'Inactive'}
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

  // Brand Management
  return (
    <div className="space-y-6 text-[#F3EBDD]">
      <h1 className="font-display text-3xl font-medium text-[#F3EBDD]">Brand Management</h1>
      {statusMsg && (
        <div className="p-3 text-sm bg-[#211C1A] border border-[#C6A46A]/60 text-[#F3EBDD] rounded-md">{statusMsg}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {brands.map((b) => (
          <div
            key={b.id}
            className="bg-[#211C1A] border border-[#3B332E] rounded-lg p-5 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-mono-tabular text-[#A99B88]">brandId: {b.id}</p>
                <span
                  className="inline-block w-4 h-4 rounded-sm border border-[#C6A46A]/50 shrink-0"
                  style={{backgroundColor: b.theme.primary}}
                  aria-label={`${b.name.en} primary swatch`}
                />
              </div>
              {isOfficialLogoBrand(b.id) && (
                <div>
                  <BrandLogo brandId={b.id} size="md" />
                </div>
              )}
              <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                {b.name.en}
              </h2>
              <p className="text-xs text-[#D2C6B5]">{b.tagline.en}</p>
            </div>
            <div className="space-y-3 pt-3 border-t border-[#3B332E]">
              <label className="block text-xs font-medium text-[#D2C6B5]">Visibility Status</label>
              <select
                value={b.status}
                onChange={async (e) => {
                  const next = {...b, status: e.target.value as BrandConfig['status']};
                  try {
                    await saveBrand(next);
                    setBrands((prev) => prev.map((item) => (item.id === b.id ? next : item)));
                    setStatusMsg(`Updated ${b.name.en} status to ${next.status}.`);
                    void refreshCatalog();
                  } catch (err) {
                    setStatusMsg(err instanceof Error ? err.message : 'Failed to update brand.');
                  }
                }}
                className="w-full px-3 py-2 text-sm bg-[#2A2522] text-[#F3EBDD] border border-[#3B332E] rounded-md focus:outline-none focus:border-[#C6A46A]"
              >
                <option value="active">Active (Live Store)</option>
                <option value="coming_soon">Coming Soon</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

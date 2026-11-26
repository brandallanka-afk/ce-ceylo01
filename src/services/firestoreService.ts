import {
  collection,
  deleteDoc,
  doc,
  type DocumentData,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import brandsSample from '../data/brands.json';
import productsSample from '../data/products.json';
import {BOOTSTRAP_ADMIN_EMAIL, db, handleFirestoreError, OperationType} from '../lib/firebase';
import type {
  AdminRole,
  AdminUserRecord,
  CategoryRecord,
  CustomerRecord,
  EnquiryRecord,
  InventoryRecord,
  OrderRecord,
  OrderStatus,
  PaymentStatus,
  PromotionRecord,
  SiteSettingsRecord,
} from '../types/admin';
import type {BrandConfig, BrandId, Product} from '../types/commerce';

export interface PaginatedResult<T> {
  items: T[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

function sanitizeId(raw: string): string {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

// ---------------------------------------------------------------------------
// Public Storefront Read Services (on-demand getDocs, no real-time listeners)
// ---------------------------------------------------------------------------
export async function fetchPublicCatalog(): Promise<{
  brands: BrandConfig[];
  products: Product[];
}> {
  try {
    const [brandsSnap, productsSnap] = await Promise.all([
      getDocs(query(collection(db, 'brands'), where('status', '!=', 'hidden'))),
      getDocs(query(collection(db, 'products'), where('isArchived', '==', false), limit(60))),
    ]);

    const brands = brandsSnap.empty
      ? (brandsSample as BrandConfig[])
      : brandsSnap.docs
          .map((d) => d.data() as BrandConfig)
          .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));

    const products = productsSnap.empty
      ? (productsSample as Product[])
      : productsSnap.docs.map((d) => d.data() as Product);

    return {brands, products};
  } catch {
    // Graceful fallback to Phase 1 static sample JSON if Firestore isn't seeded yet
    return {
      brands: brandsSample as BrandConfig[],
      products: productsSample as Product[],
    };
  }
}

export async function fetchPublicSiteSettings(): Promise<SiteSettingsRecord | null> {
  try {
    const snap = await getDoc(doc(db, 'siteSettings', 'global'));
    return snap.exists() ? (snap.data() as SiteSettingsRecord) : null;
  } catch {
    return null;
  }
}

export async function submitPublicEnquiry(payload: {
  enquiryRef?: string;
  type: 'wholesale' | 'export' | 'general';
  brandInterest?: string;
  contactName: string;
  companyName?: string;
  email: string;
  phone?: string;
  country?: string;
  website?: string;
  businessType?: string;
  productInterests?: string[];
  requiredQuantities?: string;
  packagingRequirements?: string;
  destinationCountry?: string;
  volumeBand?: string;
  message: string;
}): Promise<string> {
  const id = `enq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `enquiries/${id}`;
  try {
    const docData: Record<string, unknown> = {
      type: payload.type,
      contactName: payload.contactName.trim().slice(0, 120),
      email: payload.email.trim().slice(0, 180),
      message: payload.message.trim().slice(0, 2500),
      status: 'new',
      createdAt: serverTimestamp(),
    };
    if (payload.enquiryRef?.trim()) {
      docData.enquiryRef = payload.enquiryRef.trim().slice(0, 40);
    }
    if (payload.brandInterest?.trim()) {
      docData.brandInterest = payload.brandInterest.trim().slice(0, 80);
    }
    if (payload.companyName?.trim()) {
      docData.companyName = payload.companyName.trim().slice(0, 140);
    }
    if (payload.phone?.trim()) {
      docData.phone = payload.phone.trim().slice(0, 40);
    }
    if (payload.country?.trim()) {
      docData.country = payload.country.trim().slice(0, 80);
    }
    if (payload.website?.trim() && /^https?:\/\//i.test(payload.website.trim())) {
      docData.website = payload.website.trim().slice(0, 240);
    }
    if (payload.businessType?.trim()) {
      docData.businessType = payload.businessType.trim();
    }
    if (Array.isArray(payload.productInterests) && payload.productInterests.length > 0) {
      docData.productInterests = payload.productInterests.slice(0, 25);
    }
    if (payload.requiredQuantities?.trim()) {
      docData.requiredQuantities = payload.requiredQuantities.trim().slice(0, 160);
    }
    if (payload.packagingRequirements?.trim()) {
      docData.packagingRequirements = payload.packagingRequirements.trim().slice(0, 200);
    }
    if (payload.destinationCountry?.trim()) {
      docData.destinationCountry = payload.destinationCountry.trim().slice(0, 80);
    }
    if (payload.volumeBand?.trim()) {
      docData.volumeBand = payload.volumeBand.trim().slice(0, 60);
    }
    await setDoc(doc(db, 'enquiries', id), docData);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ---------------------------------------------------------------------------
// Admin Auth & Role Verification
// ---------------------------------------------------------------------------
export async function ensureAndFetchAdminProfile(user: {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
}): Promise<AdminUserRecord | null> {
  if (!user.email || !user.emailVerified) {
    return null;
  }
  const path = `adminUsers/${user.uid}`;
  try {
    const refDoc = doc(db, 'adminUsers', user.uid);
    const snap = await getDoc(refDoc);
    if (snap.exists()) {
      const record = snap.data() as AdminUserRecord;
      return record.active ? record : null;
    }

    if (user.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      const newAdmin: Record<string, unknown> = {
        uid: user.uid,
        email: user.email,
        displayName: (user.displayName || 'Lead Administrator').slice(0, 120),
        role: 'super_admin' as AdminRole,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(refDoc, newAdmin);
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Lead Administrator',
        role: 'super_admin',
        active: true,
      };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// ---------------------------------------------------------------------------
// Generic Paginated Query Helper (prevents loading entire DB at once)
// ---------------------------------------------------------------------------
export async function fetchPaginated<T>(
  collectionName: string,
  options: {
    pageSize?: number;
    cursor?: QueryDocumentSnapshot<DocumentData> | null;
    constraints?: QueryConstraint[];
    orderField?: string;
    orderDir?: 'asc' | 'desc';
  } = {},
): Promise<PaginatedResult<T>> {
  const {
    pageSize = 10,
    cursor = null,
    constraints = [],
    orderField,
    orderDir = 'desc',
  } = options;
  try {
    const parts: QueryConstraint[] = [...constraints];
    if (orderField) {
      parts.push(orderBy(orderField, orderDir));
    }
    if (cursor) {
      parts.push(startAfter(cursor));
    }
    parts.push(limit(pageSize + 1));

    const snap = await getDocs(query(collection(db, collectionName), ...parts));
    const hasMore = snap.docs.length > pageSize;
    const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
    const items = docs.map((d) => ({...(d.data() as object), id: d.id}) as T);
    return {
      items,
      lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
      hasMore,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collectionName);
  }
}

// ---------------------------------------------------------------------------
// Secure Production Database Initialization (No Fake Customers or Orders)
// ---------------------------------------------------------------------------
export async function initializeProductionDatabase(): Promise<{count: number}> {
  try {
    const batch = writeBatch(db);
    let count = 0;

    // 1. Brands (Ceyvana, Ceylomira, and Hand Crafts configurable teaser)
    for (const [idx, b] of (brandsSample as BrandConfig[]).entries()) {
      batch.set(doc(db, 'brands', b.id), {
        id: b.id,
        slug: b.slug,
        name: b.name,
        tagline: b.tagline,
        description: b.description,
        status: b.status,
        theme: b.theme,
        heroImage: b.heroImage,
        sortOrder: idx + 1,
        updatedAt: serverTimestamp(),
      });
      count++;
    }

    // 2. Categories
    const categories: Omit<CategoryRecord, 'updatedAt'>[] = [
      {
        id: 'cat-chilli-heat',
        brandId: 'ceyvana',
        slug: 'chilli-heat',
        name: {en: 'Chilli & Heat', si: 'මිරිස් නිෂ්පාදන'},
        sortOrder: 1,
        isActive: true,
      },
      {
        id: 'cat-curry-blends',
        brandId: 'ceyvana',
        slug: 'curry-blends',
        name: {en: 'Curry Blends', si: 'තුනපහ මිශ්‍රණ'},
        sortOrder: 2,
        isActive: true,
      },
      {
        id: 'cat-whole-spices',
        brandId: 'ceyvana',
        slug: 'whole-spices',
        name: {en: 'Whole & Ground Spices', si: 'සම්පූර්ණ සහ කුඩු කළ කුළුබඩු'},
        sortOrder: 3,
        isActive: true,
      },
      {
        id: 'cat-black-tea',
        brandId: 'ceylomira',
        slug: 'black-tea',
        name: {en: 'Black Tea', si: 'කළු තේ'},
        sortOrder: 1,
        isActive: true,
      },
      {
        id: 'cat-infused-tea',
        brandId: 'ceylomira',
        slug: 'infused-tea',
        name: {en: 'Infused Tea', si: 'රස ගැන්වූ තේ'},
        sortOrder: 2,
        isActive: true,
      },
      {
        id: 'cat-estate-collections',
        brandId: 'ceylomira',
        slug: 'estate-collections',
        name: {en: 'Estate Collections', si: 'විශේෂ වතු එකතුව'},
        sortOrder: 3,
        isActive: true,
      },
    ];
    for (const c of categories) {
      batch.set(doc(db, 'categories', c.id), {...c, updatedAt: serverTimestamp()});
      count++;
    }

    // 3. Products & Inventory
    for (const p of productsSample as Product[]) {
      batch.set(doc(db, 'products', p.id), {
        id: p.id,
        brandId: p.brandId,
        sku: p.sku,
        slug: p.slug,
        categorySlug: p.categorySlug,
        name: p.name,
        category: p.category,
        description: p.description,
        tastingNotes: p.tastingNotes,
        origin: p.origin,
        mainImage: p.mainImage,
        thumbnailImage: p.mainImage,
        gallery: p.gallery,
        availability: p.availability,
        featured: Boolean(p.featured),
        isArchived: false,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        variants: p.variants,
        updatedAt: serverTimestamp(),
      });
      count++;

      for (const v of p.variants) {
        batch.set(doc(db, 'inventory', v.variantSku), {
          variantSku: v.variantSku,
          productId: p.id,
          brandId: p.brandId,
          label: v.label,
          stockQuantity: v.stockQuantity,
          lowStockThreshold: 20,
          available: v.available,
          updatedAt: serverTimestamp(),
        });
        count++;
      }
    }

    // 4. Site Settings (Global content, language readiness, delivery threshold)
    batch.set(doc(db, 'siteSettings', 'global'), {
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
        en: 'Home to Ceyvana pure island spices and Ceylomira high-grown teas—harvested directly with Sri Lankan smallholders and master estates.',
        si: 'ශ්‍රී ලංකාවේ ගොවිපළවල් සහ කඳුකර තේ වතු වලින් සෘජුවම ලබාගන්නා සෙයිවානා කුළුබඩු සහ සෙයිලෝමිරා තේ එකතුව.',
      },
      whatsappNumber: '94770000000',
      enabledLanguages: [
        {code: 'en', shortLabel: 'EN', nativeLabel: 'English', enabled: true},
        {code: 'si', shortLabel: 'සිංහල', nativeLabel: 'සිංහල', enabled: true},
        {code: 'ta', shortLabel: 'தமிழ்', nativeLabel: 'தமிழ் (Future)', enabled: false},
      ],
      freeDeliveryThresholdLkr: 15000,
      updatedAt: serverTimestamp(),
    });
    count++;

    await batch.commit();
    return {count};
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'initializeProductionDatabase');
  }
}

export const seedInitialDatabase = initializeProductionDatabase;

// ---------------------------------------------------------------------------
// CRUD Operations for Admin Panels
// ---------------------------------------------------------------------------
export async function saveProduct(product: Product): Promise<void> {
  const id = sanitizeId(product.id || `${product.brandId}-${product.sku.toLowerCase()}`);
  const path = `products/${id}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'products', id), {
      id,
      brandId: product.brandId,
      sku: product.sku.trim().slice(0, 40),
      slug: product.slug.trim().slice(0, 120),
      categorySlug: product.categorySlug.trim().slice(0, 64),
      name: product.name,
      category: product.category,
      description: product.description,
      tastingNotes: product.tastingNotes,
      origin: product.origin,
      mainImage: product.mainImage.slice(0, 800),
      thumbnailImage: (product.thumbnailImage || product.mainImage).slice(0, 800),
      gallery: product.gallery.slice(0, 6),
      availability: product.availability,
      featured: Boolean(product.featured),
      isArchived: Boolean(product.isArchived),
      seoTitle: product.seoTitle.slice(0, 160),
      seoDescription: product.seoDescription.slice(0, 320),
      variants: product.variants.slice(0, 12),
      updatedAt: serverTimestamp(),
    });

    for (const v of product.variants.slice(0, 12)) {
      const skuId = sanitizeId(v.variantSku);
      batch.set(doc(db, 'inventory', skuId), {
        variantSku: skuId,
        productId: id,
        brandId: product.brandId,
        label: v.label.slice(0, 40),
        stockQuantity: Math.max(0, Number(v.stockQuantity) || 0),
        lowStockThreshold: 20,
        available: Boolean(v.available),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateInventoryAndVariantStock(
  product: Product,
  variantSku: string,
  newStock: number,
  available: boolean,
): Promise<void> {
  const safeStock = Math.max(0, Math.round(newStock));
  const path = `inventory/${variantSku}`;
  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'inventory', variantSku),
      {
        variantSku,
        productId: product.id,
        brandId: product.brandId,
        label:
          product.variants.find((v) => v.variantSku === variantSku)?.label || variantSku,
        stockQuantity: safeStock,
        lowStockThreshold: 20,
        available,
        updatedAt: serverTimestamp(),
      },
      {merge: true},
    );

    const updatedVariants = product.variants.map((v) =>
      v.variantSku === variantSku ? {...v, stockQuantity: safeStock, available} : v,
    );
    const anyAvailable = updatedVariants.some((v) => v.available && v.stockQuantity > 0);
    const lowStock =
      anyAvailable &&
      updatedVariants.every((v) => v.stockQuantity <= 20 || !v.available);

    batch.update(doc(db, 'products', product.id), {
      variants: updatedVariants,
      availability: !anyAvailable ? 'out_of_stock' : lowStock ? 'low_stock' : 'in_stock',
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveCategory(cat: CategoryRecord): Promise<void> {
  const id = sanitizeId(cat.id || `cat-${cat.brandId}-${cat.slug}`);
  const path = `categories/${id}`;
  try {
    await setDoc(doc(db, 'categories', id), {
      id,
      brandId: cat.brandId,
      slug: cat.slug.trim().toLowerCase().slice(0, 64),
      name: cat.name,
      sortOrder: Number(cat.sortOrder) || 1,
      isActive: Boolean(cat.isActive),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveBrand(brand: BrandConfig): Promise<void> {
  const id = sanitizeId(brand.id) as BrandId;
  const path = `brands/${id}`;
  try {
    await setDoc(doc(db, 'brands', id), {
      id,
      slug: brand.slug,
      name: brand.name,
      tagline: brand.tagline,
      description: brand.description,
      status: brand.status,
      theme: brand.theme,
      heroImage: brand.heroImage.slice(0, 500),
      sortOrder: Number(brand.sortOrder) || 1,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateOrderStatuses(
  orderId: string,
  orderStatus: OrderStatus,
  paymentStatus: PaymentStatus,
): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      orderStatus,
      paymentStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateEnquiryStatus(
  enquiryId: string,
  status: EnquiryRecord['status'],
): Promise<void> {
  const path = `enquiries/${enquiryId}`;
  try {
    await updateDoc(doc(db, 'enquiries', enquiryId), {status});
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function savePromotion(promo: PromotionRecord): Promise<void> {
  const code = promo.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
  const path = `promotions/${code}`;
  try {
    await setDoc(doc(db, 'promotions', code), {
      code,
      type: promo.type,
      value: Number(promo.value) || 0,
      minOrderLkr: Number(promo.minOrderLkr) || 0,
      brandIds: promo.brandIds,
      isActive: Boolean(promo.isActive),
      expiresAt: (promo.expiresAt || '').slice(0, 40),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePromotion(code: string): Promise<void> {
  const path = `promotions/${code}`;
  try {
    await deleteDoc(doc(db, 'promotions', code));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSiteSettings(settings: SiteSettingsRecord): Promise<void> {
  const path = 'siteSettings/global';
  try {
    await setDoc(doc(db, 'siteSettings', 'global'), {
      id: 'global',
      announcement: settings.announcement,
      heroTitle: settings.heroTitle,
      heroSubtitle: settings.heroSubtitle,
      whatsappNumber: settings.whatsappNumber.trim().slice(0, 30),
      enabledLanguages: settings.enabledLanguages.slice(0, 10),
      freeDeliveryThresholdLkr: Math.max(0, Number(settings.freeDeliveryThresholdLkr) || 0),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveAdminUser(admin: {
  uid: string;
  email: string;
  displayName?: string;
  role: AdminRole;
  active: boolean;
  isNew?: boolean;
}): Promise<void> {
  const uid = sanitizeId(admin.uid);
  const path = `adminUsers/${uid}`;
  try {
    if (admin.isNew) {
      await setDoc(doc(db, 'adminUsers', uid), {
        uid,
        email: admin.email.trim().slice(0, 180),
        displayName: (admin.displayName || '').trim().slice(0, 120),
        role: admin.role,
        active: Boolean(admin.active),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'adminUsers', uid), {
        email: admin.email.trim().slice(0, 180),
        displayName: (admin.displayName || '').trim().slice(0, 120),
        role: admin.role,
        active: Boolean(admin.active),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function exportDatabaseSnapshot(): Promise<Record<string, unknown[]>> {
  const collections = [
    'brands',
    'categories',
    'products',
    'inventory',
    'customers',
    'orders',
    'enquiries',
    'promotions',
    'siteSettings',
  ];
  const snapshot: Record<string, unknown[]> = {};
  for (const col of collections) {
    try {
      const snap = await getDocs(query(collection(db, col), limit(250)));
      snapshot[col] = snap.docs.map((d) => ({id: d.id, ...d.data()}));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, col);
    }
  }
  return snapshot;
}

export async function fetchInventoryList(
  pageSize = 20,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<PaginatedResult<InventoryRecord>> {
  return fetchPaginated<InventoryRecord>('inventory', {
    pageSize,
    cursor,
    orderField: 'variantSku',
    orderDir: 'asc',
  });
}

export async function fetchOrdersList(
  pageSize = 10,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<PaginatedResult<OrderRecord>> {
  return fetchPaginated<OrderRecord>('orders', {
    pageSize,
    cursor,
    orderField: 'createdAt',
    orderDir: 'desc',
  });
}

export async function fetchCustomersList(
  pageSize = 15,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<PaginatedResult<CustomerRecord>> {
  return fetchPaginated<CustomerRecord>('customers', {
    pageSize,
    cursor,
    orderField: 'createdAt',
    orderDir: 'desc',
  });
}

export async function fetchEnquiriesList(
  pageSize = 15,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<PaginatedResult<EnquiryRecord>> {
  return fetchPaginated<EnquiryRecord>('enquiries', {
    pageSize,
    cursor,
    orderField: 'createdAt',
    orderDir: 'desc',
  });
}

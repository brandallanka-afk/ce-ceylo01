import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import brandsSample from '../data/brands.json';
import productsSample from '../data/products.json';
import {
  getLocalizedText,
  getTranslations,
  type LanguageOption,
  resolveActiveLanguages,
} from '../i18n';
import {fetchPublicCommerceConfig, type PublicCommerceConfig} from '../services/commerceApi';
import type {
  BrandConfig,
  CartItem,
  ConfiguredCurrency,
  CurrencyCode,
  LanguageCode,
  LocalizedText,
  Product,
  ProductVariant,
  RoutePage,
} from '../types/commerce';
import {syncConfiguredCurrencies} from '../utils/currency';
import {buildPagePath, parseLocationRoute, type RouteState} from '../utils/seo';

interface StoreContextValue {
  route: RouteState;
  navigate: (page: RoutePage, productSlug?: string) => void;
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  availableLanguages: LanguageOption[];
  t: ReturnType<typeof getTranslations>;
  localize: (text: LocalizedText) => string;
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  availableCurrencies: ConfiguredCurrency[];
  catalogBrands: BrandConfig[];
  catalogProducts: Product[];
  commerceConfig: PublicCommerceConfig | null;
  refreshCatalog: () => Promise<void>;
  cart: CartItem[];
  cartCount: number;
  cartSubtotalLkr: number;
  cartSubtotalUsd: number;
  cartWeightGrams: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (product: Product, variant: ProductVariant, quantity?: number) => void;
  updateQuantity: (variantSku: string, quantity: number) => void;
  removeFromCart: (variantSku: string) => void;
  clearCart: () => void;
}

const CART_STORAGE_KEY = 'ceylon_heritage_cart_v1';
const PREF_STORAGE_KEY = 'ceylon_heritage_prefs_v1';

const DEFAULT_CURRENCIES: ConfiguredCurrency[] = [
  {code: 'LKR', symbol: 'LKR', name: 'Sri Lankan Rupee', ratePerUsd: 300, enabled: true, isDefault: true},
  {code: 'USD', symbol: '$', name: 'US Dollar', ratePerUsd: 1, enabled: true},
];

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({children}: {children: React.ReactNode}) {
  const initialParsed = useMemo(() => parseLocationRoute(['en', 'si', 'ta']), []);

  const [route, setRoute] = useState<RouteState>(() => initialParsed.route);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [catalogBrands, setCatalogBrands] = useState<BrandConfig[]>(
    brandsSample as BrandConfig[],
  );
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(
    productsSample as Product[],
  );
  const [commerceConfig, setCommerceConfig] = useState<PublicCommerceConfig | null>(null);
  const [availableLanguages, setAvailableLanguages] = useState<LanguageOption[]>(
    () => resolveActiveLanguages(null),
  );

  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    try {
      const saved = localStorage.getItem(PREF_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {currency?: CurrencyCode};
        if (parsed.currency && /^[A-Z]{3}$/.test(parsed.currency)) {
          return parsed.currency;
        }
      }
    } catch {
      // Fallback to LKR
    }
    return 'LKR';
  });

  const [lang, setLangState] = useState<LanguageCode>(() => {
    if (initialParsed.langFromUrl) {
      return initialParsed.langFromUrl;
    }
    try {
      const saved = localStorage.getItem(PREF_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {lang?: LanguageCode};
        if (parsed.lang && typeof parsed.lang === 'string') {
          return parsed.lang;
        }
      }
    } catch {
      // Fallback to English
    }
    return 'en';
  });

  const inflightRefresh = useRef<Promise<void> | null>(null);

  const refreshCatalog = useCallback(async () => {
    if (inflightRefresh.current) {
      return inflightRefresh.current;
    }
    const run = (async () => {
      let nextProducts: Product[] = productsSample as Product[];
      try {
        const {fetchPublicCatalog, fetchPublicSiteSettings} = await import('../services/firestoreService');
        const [data, siteCfg] = await Promise.all([
          fetchPublicCatalog(),
          fetchPublicSiteSettings().catch(() => null),
        ]);
        if (data.brands.length > 0) {
          setCatalogBrands(data.brands);
        }
        if (data.products.length > 0) {
          nextProducts = data.products;
        }
        if (siteCfg?.enabledLanguages) {
          setAvailableLanguages(resolveActiveLanguages(siteCfg.enabledLanguages));
        }
      } catch {
        // Keep static sample fallback
      }

      try {
        const cfg = await fetchPublicCommerceConfig();
        setCommerceConfig(cfg);
        if (cfg.currencies?.length) {
          syncConfiguredCurrencies(cfg.currencies);
          const enabledCodes = cfg.currencies.filter((c) => c.enabled).map((c) => c.code);
          setCurrencyState((prev) => (enabledCodes.includes(prev) ? prev : 'LKR'));
        }
        if (cfg.liveStockBySku) {
          nextProducts = nextProducts.map((p) => {
            const variants = p.variants.map((v) => {
              const live = cfg.liveStockBySku[v.variantSku];
              return live
                ? {...v, stockQuantity: live.stockQuantity, available: live.available}
                : v;
            });
            const anyAvail = variants.some((v) => v.available && v.stockQuantity > 0);
            return {
              ...p,
              variants,
              availability: !anyAvail
                ? 'out_of_stock'
                : variants.every((v) => v.stockQuantity <= 20)
                  ? 'low_stock'
                  : 'in_stock',
            };
          });
        }
      } catch {
        // Server config unavailable in static-only preview
      }
      setCatalogProducts(nextProducts);
    })();

    inflightRefresh.current = run.finally(() => {
      inflightRefresh.current = null;
    });
    return inflightRefresh.current;
  }, []);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed as CartItem[];
        }
      }
    } catch {
      // Ignore invalid localStorage payload
    }
    return [];
  });

  // Normalize legacy hash URLs (#/ceyvana -> /ceyvana) cleanly without reload
  useEffect(() => {
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      const target = buildPagePath(initialParsed.route.page, {
        productSlug: initialParsed.route.productSlug,
        lang: initialParsed.langFromUrl || lang,
      });
      window.history.replaceState(null, '', target);
    }
  }, [initialParsed, lang]);

  useEffect(() => {
    const knownCodes = availableLanguages.map((l) => l.code);
    const syncFromLocation = () => {
      const parsed = parseLocationRoute(knownCodes);
      setRoute(parsed.route);
      if (parsed.langFromUrl && knownCodes.includes(parsed.langFromUrl)) {
        setLangState(parsed.langFromUrl);
      } else if (!window.location.hash) {
        setLangState((prev) => (parsed.langFromUrl ? parsed.langFromUrl : prev));
      }
      window.scrollTo({top: 0, behavior: 'auto'});
    };
    window.addEventListener('popstate', syncFromLocation);
    window.addEventListener('hashchange', syncFromLocation);
    return () => {
      window.removeEventListener('popstate', syncFromLocation);
      window.removeEventListener('hashchange', syncFromLocation);
    };
  }, [availableLanguages]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage quota issues
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(PREF_STORAGE_KEY, JSON.stringify({lang, currency}));
    } catch {
      // Ignore storage quota issues
    }
    document.documentElement.lang = lang;
  }, [lang, currency]);

  const navigate = useCallback(
    (page: RoutePage, productSlug?: string) => {
      const nextPath = buildPagePath(page, {productSlug, lang});
      if (window.location.pathname !== nextPath || window.location.hash) {
        window.history.pushState(null, '', nextPath);
      }
      setRoute({page, productSlug});
      window.scrollTo({top: 0, behavior: 'auto'});
    },
    [lang],
  );

  const setLang = useCallback(
    (nextLang: LanguageCode) => {
      setLangState(nextLang);
      const nextPath = buildPagePath(route.page, {
        productSlug: route.productSlug,
        lang: nextLang,
      });
      if (window.location.pathname !== nextPath) {
        window.history.replaceState(null, '', nextPath);
      }
    },
    [route.page, route.productSlug],
  );

  const setCurrency = useCallback((nextCurrency: CurrencyCode) => {
    setCurrencyState(nextCurrency);
  }, []);

  const addToCart = useCallback(
    (product: Product, variant: ProductVariant, quantity = 1) => {
      if (!variant.available || variant.stockQuantity <= 0) {
        return;
      }
      setCart((prev) => {
        const existing = prev.find((item) => item.variantSku === variant.variantSku);
        if (existing) {
          const nextQty = Math.min(variant.stockQuantity, existing.quantity + quantity);
          return prev.map((item) =>
            item.variantSku === variant.variantSku ? {...item, quantity: nextQty} : item,
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            brandId: product.brandId,
            productSlug: product.slug,
            productName: product.name,
            variantSku: variant.variantSku,
            variantLabel: variant.label,
            weightGrams: variant.weightGrams,
            priceLkr: variant.priceLkr,
            priceUsd: variant.priceUsd,
            image: product.mainImage,
            quantity: Math.min(variant.stockQuantity, Math.max(1, quantity)),
            maxStock: variant.stockQuantity,
          },
        ];
      });
      setIsCartOpen(true);
    },
    [],
  );

  const updateQuantity = useCallback((variantSku: string, quantity: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.variantSku !== variantSku) {
            return item;
          }
          const clamped = Math.min(item.maxStock, quantity);
          return {...item, quantity: clamped};
        })
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const removeFromCart = useCallback((variantSku: string) => {
    setCart((prev) => prev.filter((item) => item.variantSku !== variantSku));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const totals = useMemo(() => {
    return cart.reduce(
      (acc, item) => {
        acc.count += item.quantity;
        acc.lkr += item.priceLkr * item.quantity;
        acc.usd += item.priceUsd * item.quantity;
        acc.weight += item.weightGrams * item.quantity;
        return acc;
      },
      {count: 0, lkr: 0, usd: 0, weight: 0},
    );
  }, [cart]);

  const availableCurrencies = useMemo(() => {
    const list = commerceConfig?.currencies?.filter((c) => c.enabled) ?? DEFAULT_CURRENCIES;
    return list.length > 0 ? list : DEFAULT_CURRENCIES;
  }, [commerceConfig]);

  const localize = useCallback(
    (text: LocalizedText) => getLocalizedText(text, lang),
    [lang],
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      route,
      navigate,
      lang,
      setLang,
      availableLanguages,
      t: getTranslations(lang),
      localize,
      currency,
      setCurrency,
      availableCurrencies,
      catalogBrands,
      catalogProducts,
      commerceConfig,
      refreshCatalog,
      cart,
      cartCount: totals.count,
      cartSubtotalLkr: totals.lkr,
      cartSubtotalUsd: totals.usd,
      cartWeightGrams: totals.weight,
      isCartOpen,
      setIsCartOpen,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
    }),
    [
      route,
      navigate,
      lang,
      setLang,
      availableLanguages,
      localize,
      currency,
      setCurrency,
      availableCurrencies,
      catalogBrands,
      catalogProducts,
      commerceConfig,
      refreshCatalog,
      cart,
      totals,
      isCartOpen,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used inside StoreProvider');
  }
  return ctx;
}

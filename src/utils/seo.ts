import type {CurrencyCode, LanguageCode, NewsStory, Product, RoutePage} from '../types/commerce';

export interface RouteState {
  page: RoutePage;
  productSlug?: string;
}

export interface BreadcrumbItem {
  label: string;
  page?: RoutePage;
  productSlug?: string;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

const DEFAULT_OG_IMAGE = '/src/assets/images/hero_ceylon_heritage_1795545289913.webp';

function mapSegmentToRoute(segment: string, param?: string): RouteState {
  switch (segment) {
    case 'ceyvana':
      return {page: 'ceyvana'};
    case 'ceylomira':
      return {page: 'ceylomira'};
    case 'hand-crafts':
      return {page: 'hand-crafts'};
    case 'product':
      return param ? {page: 'product', productSlug: param} : {page: 'home'};
    case 'cart':
      return {page: 'cart'};
    case 'wholesale':
      return {page: 'wholesale'};
    case 'about':
      return {page: 'about'};
    case 'stories':
      return {page: 'stories'};
    case 'contact':
      return {page: 'contact'};
    case 'privacy':
      return {page: 'privacy'};
    case 'terms':
      return {page: 'terms'};
    case 'portfolio':
      return {page: 'portfolio'};
    case 'admin':
      return {page: 'admin'};
    default:
      return {page: 'home'};
  }
}

export function buildPagePath(
  page: RoutePage,
  options?: {productSlug?: string; lang?: LanguageCode},
): string {
  const cleanLang = (options?.lang || 'en').trim().toLowerCase();
  const basePath =
    page === 'home'
      ? '/'
      : page === 'product' && options?.productSlug
        ? `/product/${encodeURIComponent(options.productSlug)}`
        : `/${page}`;

  // Admin portal stays language-neutral on /admin
  if (page === 'admin' || !cleanLang || cleanLang === 'en') {
    return basePath;
  }

  return basePath === '/' ? `/${cleanLang}` : `/${cleanLang}${basePath}`;
}

export function parseLocationRoute(
  knownLangCodes: string[] = ['en', 'si', 'ta'],
): {route: RouteState; langFromUrl?: LanguageCode} {
  // Support legacy hash URLs (#/ceyvana, #/product/slug) cleanly
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
    const parts = rawHash.split('/').filter(Boolean);
    if (parts.length > 0 && knownLangCodes.includes(parts[0].toLowerCase()) && parts[0] !== 'en') {
      const langFromUrl = parts[0].toLowerCase();
      return {
        route: parts.length > 1 ? mapSegmentToRoute(parts[1], parts[2]) : {page: 'home'},
        langFromUrl,
      };
    }
    return {route: parts.length > 0 ? mapSegmentToRoute(parts[0], parts[1]) : {page: 'home'}};
  }

  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const segments = pathname.split('/').filter(Boolean);
  const queryLang = new URLSearchParams(window.location.search).get('lang')?.trim().toLowerCase();

  let langFromUrl: string | undefined =
    queryLang && knownLangCodes.includes(queryLang) ? queryLang : undefined;

  if (segments.length > 0 && knownLangCodes.includes(segments[0].toLowerCase())) {
    const candidate = segments[0].toLowerCase();
    if (candidate !== 'en') {
      langFromUrl = candidate;
    }
    const rest = segments.slice(1);
    return {
      route: rest.length > 0 ? mapSegmentToRoute(rest[0], rest[1]) : {page: 'home'},
      langFromUrl: candidate,
    };
  }

  return {
    route: segments.length > 0 ? mapSegmentToRoute(segments[0], segments[1]) : {page: 'home'},
    langFromUrl,
  };
}

function upsertMeta(selector: string, attrs: Record<string, string>, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string, extraAttrs: Record<string, string> = {}): void {
  const attrParts = Object.entries(extraAttrs)
    .map(([k, v]) => `[${k}="${v}"]`)
    .join('');
  const selector = `link[rel="${rel}"]${attrParts}`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    for (const [k, v] of Object.entries(extraAttrs)) {
      el.setAttribute(k, v);
    }
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLdScript(id: string, data: Record<string, unknown> | null): void {
  const existing = document.getElementById(id);
  if (!data) {
    existing?.remove();
    return;
  }
  const script = (existing as HTMLScriptElement | null) ?? document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  if (!existing) {
    document.head.appendChild(script);
  }
}

export function resolveWebpAssetUrl(imgPath: string): string {
  const clean = (imgPath || DEFAULT_OG_IMAGE).trim();
  if (/^\/src\/assets\/images\/.+\.(jpe?g|png)$/i.test(clean)) {
    const webp = clean.replace(/\.(jpe?g|png)$/i, '.webp');
    return `${window.location.origin}${webp}`;
  }
  if (/^https?:\/\//i.test(clean)) {
    return clean;
  }
  return `${window.location.origin}${clean.startsWith('/') ? clean : `/${clean}`}`;
}

export interface PageSeoOptions {
  title: string;
  description: string;
  page: RoutePage;
  lang: LanguageCode;
  productSlug?: string;
  image?: string;
  ogType?: 'website' | 'product' | 'article';
  availableLangCodes?: string[];
  noindex?: boolean;
}

export function updatePageSeo(options: PageSeoOptions): void {
  const {
    title,
    description,
    page,
    lang,
    productSlug,
    image = DEFAULT_OG_IMAGE,
    ogType = 'website',
    availableLangCodes = ['en', 'si'],
    noindex = false,
  } = options;

  const origin = window.location.origin;
  const canonicalPath = buildPagePath(page, {productSlug, lang});
  const canonicalUrl = `${origin}${canonicalPath}`;
  const ogImageUrl = resolveWebpAssetUrl(image);
  const ogLocale = lang === 'si' ? 'si_LK' : lang === 'ta' ? 'ta_LK' : 'en_LK';

  document.title = title;
  upsertMeta('meta[name="description"]', {name: 'description'}, description);
  upsertMeta(
    'meta[name="robots"]',
    {name: 'robots'},
    noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
  );

  // Open Graph metadata
  upsertMeta('meta[property="og:type"]', {property: 'og:type'}, ogType);
  upsertMeta('meta[property="og:title"]', {property: 'og:title'}, title);
  upsertMeta('meta[property="og:description"]', {property: 'og:description'}, description);
  upsertMeta('meta[property="og:url"]', {property: 'og:url'}, canonicalUrl);
  upsertMeta('meta[property="og:locale"]', {property: 'og:locale'}, ogLocale);
  upsertMeta('meta[property="og:image"]', {property: 'og:image'}, ogImageUrl);

  // Twitter card metadata
  upsertMeta('meta[name="twitter:title"]', {name: 'twitter:title'}, title);
  upsertMeta('meta[name="twitter:description"]', {name: 'twitter:description'}, description);
  upsertMeta('meta[name="twitter:image"]', {name: 'twitter:image'}, ogImageUrl);

  // Canonical URL
  upsertLink('canonical', canonicalUrl);

  // Remove stale hreflang tags and rebuild for active languages (skipped on private/noindex routes)
  document.head
    .querySelectorAll('link[rel="alternate"][hreflang]')
    .forEach((node) => node.remove());

  if (!noindex && page !== 'admin' && page !== 'cart') {
    const uniqueLangs = Array.from(new Set(availableLangCodes.map((c) => c.toLowerCase())));
    for (const code of uniqueLangs) {
      const href = `${origin}${buildPagePath(page, {productSlug, lang: code})}`;
      upsertLink('alternate', href, {hreflang: code});
    }
    const defaultHref = `${origin}${buildPagePath(page, {productSlug, lang: 'en'})}`;
    upsertLink('alternate', defaultHref, {hreflang: 'x-default'});
  }
}

/** Backwards-compatible wrapper */
export function updateDocumentMeta(title: string, description: string): void {
  updatePageSeo({
    title,
    description,
    page: 'home',
    lang: document.documentElement.lang || 'en',
  });
}

export function setOrganizationWebsiteStructuredData(lang: LanguageCode = 'en'): void {
  const origin = window.location.origin;
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: 'Ceylon Heritage House',
        url: origin,
        description:
          lang === 'si'
            ? 'ශ්‍රී ලංකාවේ පිරිසිදු සෙයිවානා කුළුබඩු සහ සෙයිලෝමිරා උසස් තත්ත්වයේ කඳුකර තේ අපනයන ආයතනය.'
            : 'Multi-brand Sri Lankan specialty house uniting Ceyvana Premium Ceylon Spices and Ceylomira Premium Ceylon Tea.',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Colombo',
          addressCountry: 'LK',
        },
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support and export trade desk',
          availableLanguage: ['English', 'Sinhala'],
          email: 'hello@ceylonheritage.lk',
        },
        brand: [
          {'@type': 'Brand', name: 'Ceyvana', description: 'Premium Ceylon Spices'},
          {'@type': 'Brand', name: 'Ceylomira', description: 'Premium Ceylon Tea'},
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: origin,
        name: 'Ceylon Heritage House — Ceyvana & Ceylomira',
        inLanguage: ['en', 'si'],
        publisher: {'@id': `${origin}/#organization`},
      },
    ],
  };
  setJsonLdScript('site-org-json-ld', schema);
}

export function setProductStructuredData(
  product: Product | null,
  lang: LanguageCode = 'en',
  currency: CurrencyCode = 'LKR',
): void {
  if (!product) {
    setJsonLdScript('product-json-ld', null);
    return;
  }

  const origin = window.location.origin;
  const productUrl = `${origin}${buildPagePath('product', {productSlug: product.slug, lang})}`;
  const useUsd = currency.toUpperCase() === 'USD';
  const offerCurrency = useUsd ? 'USD' : 'LKR';

  // Strictly factual variant Offers matching live prices and inventory — zero fabricated ratings
  const offers = product.variants.map((v) => ({
    '@type': 'Offer',
    sku: v.variantSku,
    url: productUrl,
    priceCurrency: offerCurrency,
    price: useUsd ? v.priceUsd : v.priceLkr,
    itemCondition: 'https://schema.org/NewCondition',
    availability:
      v.available && v.stockQuantity > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    seller: {
      '@type': 'Organization',
      name: 'Ceylon Heritage House',
    },
  }));

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name[lang] || product.name.en,
    description: product.description[lang] || product.description.en || product.seoDescription,
    sku: product.sku,
    category: product.category[lang] || product.category.en,
    countryOfOrigin: {
      '@type': 'Country',
      name: 'Sri Lanka',
    },
    url: productUrl,
    brand: {
      '@type': 'Brand',
      name: product.brandId === 'ceyvana' ? 'Ceyvana' : 'Ceylomira',
    },
    image: [resolveWebpAssetUrl(product.mainImage)],
    offers:
      offers.length === 1
        ? offers[0]
        : {
            '@type': 'AggregateOffer',
            priceCurrency: offerCurrency,
            lowPrice: Math.min(...offers.map((o) => o.price)),
            highPrice: Math.max(...offers.map((o) => o.price)),
            offerCount: offers.length,
            offers,
          },
  };

  setJsonLdScript('product-json-ld', schema);
}

export function setBreadcrumbStructuredData(
  items: BreadcrumbItem[],
  lang: LanguageCode = 'en',
): void {
  if (!items || items.length === 0) {
    setJsonLdScript('breadcrumb-json-ld', null);
    return;
  }
  const origin = window.location.origin;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.label,
      ...(item.page
        ? {item: `${origin}${buildPagePath(item.page, {productSlug: item.productSlug, lang})}`}
        : {}),
    })),
  };
  setJsonLdScript('breadcrumb-json-ld', schema);
}

export function setFaqStructuredData(faqs: FaqEntry[] | null): void {
  if (!faqs || faqs.length === 0) {
    setJsonLdScript('faq-json-ld', null);
    return;
  }
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
  setJsonLdScript('faq-json-ld', schema);
}

export function setArticleStructuredData(story: NewsStory | null, lang: LanguageCode = 'en'): void {
  if (!story) {
    setJsonLdScript('article-json-ld', null);
    return;
  }
  const origin = window.location.origin;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: story.title[lang] || story.title.en,
    description: story.excerpt[lang] || story.excerpt.en,
    articleBody: story.body[lang] || story.body.en,
    inLanguage: lang,
    image: [resolveWebpAssetUrl(story.image)],
    mainEntityOfPage: `${origin}${buildPagePath('stories', {lang})}`,
    author: {
      '@type': 'Organization',
      name: 'Ceylon Heritage House',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Ceylon Heritage House',
    },
  };
  setJsonLdScript('article-json-ld', schema);
}

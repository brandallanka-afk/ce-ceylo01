import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type {
  PortfolioCoverDesign,
  PortfolioFieldOptions,
  PortfolioOrientation,
} from '../src/types/admin.ts';
import type {BrandId, ConfiguredCurrency, CurrencyCode, Product} from '../src/types/commerce.ts';

export const DEFAULT_PORTFOLIO_FIELDS: PortfolioFieldOptions = {
  sku: true,
  category: true,
  description: true,
  highlights: true,
  ingredients: true,
  origin: true,
  packSizes: true,
  packagingType: true,
  storageInstructions: true,
  shelfLife: true,
  netWeight: true,
  retailPrices: true,
  wholesalePrices: false, // Confidential wholesale/export pricing OFF by default
  moq: false,
  technicalSpecs: true,
  certifications: true,
};

interface BrandPdfTheme {
  id: BrandId;
  nameEn: string;
  nameSi: string;
  taglineEn: string;
  taglineSi: string;
  signatureStatementEn?: string;
  defaultIntroEn: string;
  defaultIntroSi: string;
  heroImagePath: string;
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  tint: string;
  ink: string;
  muted: string;
  border: string;
}

const BRAND_THEMES: Record<BrandId, BrandPdfTheme> = {
  ceyvana: {
    id: 'ceyvana',
    nameEn: 'CEYVANA',
    nameSi: 'සෙයිවානා (CEYVANA)',
    taglineEn: 'Heritage Spices & Culinary Treasures of Ceylon',
    taglineSi: 'ලංකා පාරම්පරික කුළුබඩු සහ ආහාර රසකාරක එකතුව',
    signatureStatementEn: 'Every spice has a story. Every flavour has a heritage.',
    defaultIntroEn:
      'Ceyvana curates single-origin Sri Lankan spices harvested across coastal Matara gardens, central Kandy spice estates, and dry-zone farms. Graded, cleaned, and sealed at origin to preserve authentic aroma and culinary integrity.',
    defaultIntroSi:
      'සෙයිවානා මාතර, මහනුවර සහ උතුරු-මැද ප්‍රදේශවලින් නෙළාගත් පිරිසිදු ශ්‍රී ලාංකික කුළුබඩු ස්වභාවික සුවඳ සහ ගුණාත්මකභාවය රැකෙන පරිදි සෘජුවම ඉදිරිපත් කරයි.',
    heroImagePath: '/src/assets/images/brand_ceyvana_spices_1795545289791.jpg',
    primary: '#6E1924',
    secondary: '#3A2113',
    accent: '#C49A45',
    surface: '#FAF6F0',
    tint: '#F3ECE1',
    ink: '#22150E',
    muted: '#665043',
    border: '#DFCDAE',
  },
  ceylomira: {
    id: 'ceylomira',
    nameEn: 'CEYLOMIRA',
    nameSi: 'සෙයිලෝමිරා (CEYLOMIRA)',
    taglineEn: 'Single-Estate Ceylon Teas & Botanical Infusions',
    taglineSi: 'තෝරාගත් සිලෝන් තේ සහ ස්වභාවික ශාකසාර පාන',
    defaultIntroEn:
      'Ceylomira brings together single-estate orthodox black teas, high-grown silver tips, and heritage Sri Lankan botanical infusions packed close to harvest to preserve clarity, briskness, and floral aroma.',
    defaultIntroSi:
      'සෙයිලෝමිරා උඩරට සහ පහතරට වතුයායන්ගෙන් නෙළාගත් පිරිසිදු සිලෝන් තේ සහ දේශීය ඔසු පාන ස්වභාවික නැවුම්බව සමඟ පිරිනමයි.',
    heroImagePath: '/src/assets/images/brand_ceylomira_tea_1795545290271.jpg',
    primary: '#0E3324',
    secondary: '#172820',
    accent: '#B87A43',
    surface: '#F7F4EC',
    tint: '#ECE8DC',
    ink: '#13221A',
    muted: '#4A5B50',
    border: '#D5CBB7',
  },
  'hand-crafts': {
    id: 'hand-crafts',
    nameEn: 'CEYLON HAND CRAFTS',
    nameSi: 'ලංකා හස්ත කර්මාන්ත',
    taglineEn: 'Authentic Artisan Woodwork, Brass & Heritage Craft',
    taglineSi: 'සාම්ප්‍රදායික කැටයම්, පිත්තල සහ අත්කම් නිර්මාණ',
    defaultIntroEn:
      'Curated Sri Lankan artisanal homeware crafted by master woodcarvers, brassware guilds, and handloom weavers using seasoned local materials.',
    defaultIntroSi:
      'ශ්‍රී ලාංකික පාරම්පරික ශිල්පීන්ගේ දෑතින් නිමැවුණු ලී කැටයම්, පිත්තල සහ අත්කම් නිර්මාණ එකතුව.',
    heroImagePath: '/src/assets/images/hero_ceylon_heritage_1795545289913.jpg',
    primary: '#5D402C',
    secondary: '#2B1F16',
    accent: '#B59148',
    surface: '#FAF6EE',
    tint: '#EFE8DB',
    ink: '#211811',
    muted: '#645243',
    border: '#DDD0BA',
  },
};

export interface RenderPortfolioPdfParams {
  brandId: BrandId;
  language: 'en' | 'si';
  currency: CurrencyCode;
  currencyConfig?: ConfiguredCurrency;
  title: string;
  version: string;
  coverDesign: PortfolioCoverDesign;
  orientation: PortfolioOrientation;
  introMessage?: string;
  companyProfile?: string;
  contactInfo?: string;
  websiteUrl: string;
  whatsappNumber: string;
  omittedFieldNote?: string;
  fields: PortfolioFieldOptions;
  products: Product[];
  generatedAtIso: string;
}

export interface RenderedPortfolioPdfResult {
  buffer: Buffer;
  pageCount: number;
  productCount: number;
}

const FONT_KEYS = {
  serif: 'SerifRegular',
  serifBold: 'SerifBold',
  serifItalic: 'SerifItalic',
  sans: 'SansRegular',
  sansBold: 'SansBold',
  siSerif: 'SinhalaSerifRegular',
  siSerifBold: 'SinhalaSerifBold',
  siSans: 'SinhalaSansRegular',
  siSansBold: 'SinhalaSansBold',
} as const;

type FontRole = 'serif' | 'sans';

function resolveFontsDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'server/fonts'),
    path.resolve(import.meta.dirname || process.cwd(), 'fonts'),
    path.resolve(process.cwd(), 'fonts'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'NotoSans-Regular.ttf'))) {
      return dir;
    }
  }
  throw new Error('Embedded PDF TrueType fonts not found in server/fonts/.');
}

function registerFonts(doc: PDFKit.PDFDocument): void {
  const dir = resolveFontsDir();
  doc.registerFont(FONT_KEYS.serif, path.join(dir, 'NotoSerif-Regular.ttf'));
  doc.registerFont(FONT_KEYS.serifBold, path.join(dir, 'NotoSerif-Bold.ttf'));
  doc.registerFont(FONT_KEYS.serifItalic, path.join(dir, 'NotoSerif-Italic.ttf'));
  doc.registerFont(FONT_KEYS.sans, path.join(dir, 'NotoSans-Regular.ttf'));
  doc.registerFont(FONT_KEYS.sansBold, path.join(dir, 'NotoSans-Bold.ttf'));
  doc.registerFont(FONT_KEYS.siSerif, path.join(dir, 'NotoSerifSinhala-Regular.ttf'));
  doc.registerFont(FONT_KEYS.siSerifBold, path.join(dir, 'NotoSerifSinhala-Bold.ttf'));
  doc.registerFont(FONT_KEYS.siSans, path.join(dir, 'NotoSansSinhala-Regular.ttf'));
  doc.registerFont(FONT_KEYS.siSansBold, path.join(dir, 'NotoSansSinhala-Bold.ttf'));
}

function normalizePdfText(raw: string): string {
  return String(raw || '')
    .replace(/\u00B7/g, ' | ')
    .replace(/\u2022/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function pickFontKey(role: FontRole, bold: boolean, italic: boolean, isSinhala: boolean): string {
  if (isSinhala) {
    if (role === 'serif') {
      return bold ? FONT_KEYS.siSerifBold : FONT_KEYS.siSerif;
    }
    return bold ? FONT_KEYS.siSansBold : FONT_KEYS.siSans;
  }
  if (role === 'serif') {
    if (bold) return FONT_KEYS.serifBold;
    if (italic) return FONT_KEYS.serifItalic;
    return FONT_KEYS.serif;
  }
  return bold ? FONT_KEYS.sansBold : FONT_KEYS.sans;
}

interface TextRun {
  text: string;
  isSinhala: boolean;
  fontKey: string;
  width: number;
}

interface WrappedLine {
  runs: TextRun[];
  width: number;
}

function splitIntoScriptSegments(text: string): {text: string; isSinhala: boolean}[] {
  const clean = normalizePdfText(text);
  const matches = clean.match(/[\u0D80-\u0DFF\u200D]+|[^\u0D80-\u0DFF\u200D]+/g);
  if (!matches) return [];
  return matches.map((m) => ({
    text: m,
    isSinhala: /[\u0D80-\u0DFF]/.test(m),
  }));
}

function measureAndWrapMixedText(
  doc: PDFKit.PDFDocument,
  rawText: string,
  maxWidth: number,
  fontSize: number,
  role: FontRole = 'sans',
  bold = false,
  italic = false,
  lineHeightRatio = 1.46,
): {lines: WrappedLine[]; lineHeight: number; totalHeight: number} {
  const safeMaxWidth = Math.max(24, maxWidth);
  const lineHeight = fontSize * lineHeightRatio;
  const paragraphs = normalizePdfText(rawText).split(/\r?\n/);
  const lines: WrappedLine[] = [];

  doc.fontSize(fontSize);

  for (const para of paragraphs) {
    const trimmedPara = para.trimEnd();
    if (!trimmedPara) {
      lines.push({runs: [], width: 0});
      continue;
    }

    // Tokenize into words preserving single trailing spaces so wrapping preserves spacing
    const rawWords = trimmedPara.split(/(\s+)/).filter((t) => t.length > 0);
    let currentRuns: TextRun[] = [];
    let currentWidth = 0;

    const pushCurrentLine = () => {
      // Trim trailing whitespace run
      while (currentRuns.length > 0 && /^\s+$/.test(currentRuns[currentRuns.length - 1].text)) {
        const popped = currentRuns.pop()!;
        currentWidth = Math.max(0, currentWidth - popped.width);
      }
      lines.push({runs: currentRuns, width: currentWidth});
      currentRuns = [];
      currentWidth = 0;
    };

    const appendToken = (tokenText: string) => {
      const segs = splitIntoScriptSegments(tokenText);
      const tokenRuns: TextRun[] = segs.map((seg) => {
        const fontKey = pickFontKey(role, bold, italic, seg.isSinhala);
        doc.font(fontKey).fontSize(fontSize);
        return {
          text: seg.text,
          isSinhala: seg.isSinhala,
          fontKey,
          width: doc.widthOfString(seg.text),
        };
      });
      const tokenWidth = tokenRuns.reduce((sum, r) => sum + r.width, 0);

      if (currentRuns.length === 0 && /^\s+$/.test(tokenText)) {
        return; // Don't start wrapped line with leading space
      }

      if (currentWidth + tokenWidth <= safeMaxWidth || currentRuns.length === 0) {
        // Hard-break oversized single token if wider than box
        if (currentRuns.length === 0 && tokenWidth > safeMaxWidth && tokenText.length > 6) {
          let chunk = '';
          for (const ch of Array.from(tokenText)) {
            const test = chunk + ch;
            const testSegs = splitIntoScriptSegments(test);
            let testW = 0;
            for (const s of testSegs) {
              doc.font(pickFontKey(role, bold, italic, s.isSinhala)).fontSize(fontSize);
              testW += doc.widthOfString(s.text);
            }
            if (testW > safeMaxWidth && chunk.length > 0) {
              appendToken(chunk);
              pushCurrentLine();
              chunk = ch;
            } else {
              chunk = test;
            }
          }
          if (chunk) {
            appendToken(chunk);
          }
          return;
        }
        currentRuns.push(...tokenRuns);
        currentWidth += tokenWidth;
      } else {
        pushCurrentLine();
        if (!/^\s+$/.test(tokenText)) {
          appendToken(tokenText);
        }
      }
    };

    for (const word of rawWords) {
      appendToken(word);
    }
    if (currentRuns.length > 0) {
      pushCurrentLine();
    }
  }

  return {
    lines,
    lineHeight,
    totalHeight: Math.max(lineHeight, lines.length * lineHeight),
  };
}

function drawMixedText(
  doc: PDFKit.PDFDocument,
  rawText: string,
  x: number,
  y: number,
  options: {
    width: number;
    fontSize: number;
    color: string;
    role?: FontRole;
    bold?: boolean;
    italic?: boolean;
    align?: 'left' | 'center' | 'right';
    lineHeightRatio?: number;
  },
): number {
  const layout = measureAndWrapMixedText(
    doc,
    rawText,
    options.width,
    options.fontSize,
    options.role ?? 'sans',
    Boolean(options.bold),
    Boolean(options.italic),
    options.lineHeightRatio ?? 1.46,
  );

  doc.fillColor(options.color);

  layout.lines.forEach((line, lineIdx) => {
    const lineY = y + lineIdx * layout.lineHeight;
    let cursorX = x;
    if (options.align === 'center') {
      cursorX = x + Math.max(0, (options.width - line.width) / 2);
    } else if (options.align === 'right') {
      cursorX = x + Math.max(0, options.width - line.width);
    }

    for (const run of line.runs) {
      doc
        .font(run.fontKey)
        .fontSize(options.fontSize)
        .fillColor(options.color)
        .text(run.text, cursorX, lineY, {lineBreak: false});
      cursorX += run.width;
    }
  });

  return y + layout.totalHeight;
}

function isSupportedImageBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  return false;
}

const ALLOWED_IMAGE_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
]);

async function loadImageBuffer(srcPath?: string): Promise<Buffer | null> {
  if (!srcPath) return null;
  const trimmed = srcPath.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname.toLowerCase())) {
        return null;
      }
      const resp = await fetch(trimmed, {signal: AbortSignal.timeout(3000)});
      if (!resp.ok) return null;
      const arr = await resp.arrayBuffer();
      if (arr.byteLength > 3 * 1024 * 1024) return null;
      const buf = Buffer.from(arr);
      return isSupportedImageBuffer(buf) ? buf : null;
    } catch {
      return null;
    }
  }

  // Local workspace relative path (/src/assets/images/foo.jpg or .webp -> .jpg)
  const rel = trimmed.replace(/^\/+/, '');
  const candidates = [
    path.resolve(process.cwd(), rel),
    path.resolve(process.cwd(), rel.replace(/\.webp$/i, '.jpg')),
    path.resolve(process.cwd(), 'public', rel),
  ];

  for (const cand of candidates) {
    if (!cand.startsWith(process.cwd() + path.sep)) continue;
    if (fs.existsSync(cand)) {
      const buf = fs.readFileSync(cand);
      if (isSupportedImageBuffer(buf)) return buf;
    }
  }
  return null;
}

function loc(
  field: {en?: string; si?: string} | undefined,
  lang: 'en' | 'si',
): string {
  if (!field) return '';
  if (lang === 'si' && field.si && field.si.trim()) {
    return field.si.trim();
  }
  return (field.en || field.si || '').trim();
}

function formatPdfPrice(
  priceUsd: number,
  priceLkr: number,
  currency: CurrencyCode,
  currencyConfig?: ConfiguredCurrency,
): string {
  if (currency === 'LKR') {
    return `LKR ${Math.round(priceLkr).toLocaleString('en-US')}`;
  }
  if (currency === 'USD') {
    return `$${priceUsd.toFixed(2)}`;
  }
  const symbol = currencyConfig?.symbol || currency;
  const rate = currencyConfig?.ratePerUsd || 1;
  const converted = priceUsd * rate;
  return `${symbol} ${converted.toFixed(2)}`;
}

function formatWholesalePdfPrice(
  exportPriceUsd: number,
  currency: CurrencyCode,
  currencyConfig?: ConfiguredCurrency,
): string {
  if (currency === 'LKR') {
    const rate = currencyConfig?.ratePerUsd || 300;
    return `LKR ${Math.round(exportPriceUsd * rate).toLocaleString('en-US')} / kg`;
  }
  if (currency === 'USD') {
    return `$${exportPriceUsd.toFixed(2)} / kg`;
  }
  const symbol = currencyConfig?.symbol || currency;
  const rate = currencyConfig?.ratePerUsd || 1;
  return `${symbol} ${(exportPriceUsd * rate).toFixed(2)} / kg`;
}

export async function generateBrandPortfolioPdf(
  params: RenderPortfolioPdfParams,
): Promise<RenderedPortfolioPdfResult> {
  const theme = BRAND_THEMES[params.brandId] ?? BRAND_THEMES.ceyvana;
  const lang = params.language === 'si' ? 'si' : 'en';
  const isLandscape = params.orientation === 'landscape';
  const filteredProducts = params.products.filter(
    (p) => p.brandId === params.brandId && !p.isArchived,
  );

  if (filteredProducts.length === 0) {
    throw new Error(`No active verified products found for brand "${params.brandId}".`);
  }

  // Preload all unique product + hero images cleanly before synchronous PDF construction
  const imageCache = new Map<string, Buffer | null>();
  const imagePaths = new Set<string>([theme.heroImagePath]);
  for (const p of filteredProducts) {
    if (p.mainImage) imagePaths.add(p.mainImage);
  }
  await Promise.all(
    Array.from(imagePaths).map(async (imgPath) => {
      imageCache.set(imgPath, await loadImageBuffer(imgPath));
    }),
  );

  // Group products strictly by verified category
  const categoryGroups: {categorySlug: string; categoryName: string; items: Product[]}[] = [];
  const groupMap = new Map<string, {categorySlug: string; categoryName: string; items: Product[]}>();
  for (const p of filteredProducts) {
    const slug = p.categorySlug || 'signature-collection';
    const catName = loc(p.category, lang) || 'Signature Collection';
    let group = groupMap.get(slug);
    if (!group) {
      group = {categorySlug: slug, categoryName: catName, items: []};
      groupMap.set(slug, group);
      categoryGroups.push(group);
    }
    group.items.push(p);
  }

  const doc = new PDFDocument({
    size: 'A4',
    layout: isLandscape ? 'landscape' : 'portrait',
    margins: {top: 44, bottom: 44, left: 42, right: 42},
    bufferPages: true,
    info: {
      Title: params.title,
      Author: `${theme.nameEn} | Ceylon Heritage House`,
      Subject: `${theme.nameEn} Product Portfolio (${params.version})`,
      Creator: 'Ceylon Heritage House Portfolio Engine',
    },
  });

  registerFonts(doc);

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const pdfDone = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const marginX = 42;
  const contentW = pageW - marginX * 2;
  const topSafeY = 66;
  const bottomSafeY = pageH - 56;
  const dateLabel = params.generatedAtIso.slice(0, 10);
  const yearLabel = dateLabel.slice(0, 4);
  const whatsappDisplay = params.whatsappNumber ? `+${params.whatsappNumber.replace(/^\+/, '')}` : '';

  const labels =
    lang === 'si'
      ? {
          edition: 'සිංහල සංස්කරණය',
          catalogueBadge: 'නිල නිෂ්පාදන නාමාවලිය',
          introHeading: 'සන්නාම හැඳින්වීම සහ ආයතනික තොරතුරු',
          companyHeading: 'ආයතනය සහ සම්බන්ධතා විස්තර',
          tocHeading: 'අන්තර්ගතය සහ වර්ගීකරණ සූචිය',
          productsWord: 'නිෂ්පාදන',
          sku: 'SKU කේතය',
          origin: 'මූලාශ්‍රය',
          highlights: 'විශේෂාංග',
          ingredients: 'අමුද්‍රව්‍ය',
          packagingType: 'ඇසුරුම් වර්ගය',
          storage: 'ගබඩා උපදෙස්',
          shelfLife: 'ආයු කාලය',
          moq: 'අවම ඇණවුම් ප්‍රමාණය (MOQ)',
          specs: 'තාක්ෂණික විස්තර',
          certs: 'සහතික',
          packTableHeadPack: 'ඇසුරුම',
          packTableHeadWeight: 'ශුද්ධ බර',
          packTableHeadRetail: 'මිල',
          wholesaleLabel: 'තොග/අපනයන මිල (FOB)',
          confidentialNotice: 'ව්‍යාපාරික රහස්‍ය සංස්කරණය - අවසරලත් තොග මිල ඇතුළත් වේ',
          pageWord: 'පිටුව',
          ofWord: '/',
          copyright: `© ${yearLabel} ${theme.nameEn} | Ceylon Heritage House. සියලුම හිමිකම් ඇවිරිණි.`,
        }
      : {
          edition: 'ENGLISH EDITION',
          catalogueBadge: 'OFFICIAL PRODUCT PORTFOLIO',
          introHeading: 'BRAND INTRODUCTION & HERITAGE PROFILE',
          companyHeading: 'COMPANY & DIRECT ORDER DESK',
          tocHeading: 'PORTFOLIO INDEX & CATEGORIES',
          productsWord: 'Products',
          sku: 'SKU',
          origin: 'Origin',
          highlights: 'Highlights',
          ingredients: 'Ingredients',
          packagingType: 'Packaging Type',
          storage: 'Storage Instructions',
          shelfLife: 'Shelf Life',
          moq: 'Minimum Order Qty (MOQ)',
          specs: 'Technical Specifications',
          certs: 'Certifications',
          packTableHeadPack: 'Pack Size',
          packTableHeadWeight: 'Net Weight',
          packTableHeadRetail: 'Displayed Price',
          wholesaleLabel: 'Authorized Export / Wholesale Reference',
          confidentialNotice: 'CONFIDENTIAL TRADE EDITION - AUTHORIZED WHOLESALE PRICING INCLUDED',
          pageWord: 'Page',
          ofWord: 'of',
          copyright: `© ${yearLabel} ${theme.nameEn} | Ceylon Heritage House. All rights reserved.`,
        };

  // -------------------------------------------------------------------------
  // PAGE 1: LUXURY EDITORIAL COVER PAGE (3 SELECTABLE DESIGNS)
  // -------------------------------------------------------------------------
  const drawCoverPage = () => {
    const heroBuf = imageCache.get(theme.heroImagePath) ?? null;

    if (params.coverDesign === 'heritage_crest') {
      doc.rect(0, 0, pageW, pageH).fill(theme.primary);
      // Outer & inner hairline antique/copper gold frames
      doc.lineWidth(1.5).strokeColor(theme.accent).rect(22, 22, pageW - 44, pageH - 44).stroke();
      doc.lineWidth(0.5).strokeColor(theme.accent).rect(28, 28, pageW - 56, pageH - 56).stroke();

      // Top heritage badge
      let curY = isLandscape ? 58 : 88;
      doc
        .lineWidth(0.8)
        .strokeColor(theme.accent)
        .rect(pageW / 2 - 120, curY, 240, 24)
        .stroke();
      drawMixedText(doc, labels.catalogueBadge, pageW / 2 - 115, curY + 5, {
        width: 230,
        fontSize: 9,
        color: theme.accent,
        role: 'sans',
        bold: true,
        align: 'center',
      });

      curY += 56;
      curY = drawMixedText(doc, theme.nameEn, marginX, curY, {
        width: contentW,
        fontSize: isLandscape ? 38 : 44,
        color: '#FAF6F0',
        role: 'serif',
        bold: true,
        align: 'center',
      });

      curY += 6;
      curY = drawMixedText(doc, lang === 'si' ? theme.taglineSi : theme.taglineEn, marginX + 20, curY, {
        width: contentW - 40,
        fontSize: 13,
        color: theme.accent,
        role: 'serif',
        italic: true,
        align: 'center',
      });

      curY += 18;
      doc
        .lineWidth(1)
        .strokeColor(theme.accent)
        .moveTo(pageW / 2 - 64, curY)
        .lineTo(pageW / 2 + 64, curY)
        .stroke();

      // Central Hero Photograph Frame (if available, preserving aspect ratio)
      curY += 22;
      const frameW = isLandscape ? 260 : 300;
      const frameH = isLandscape ? 140 : 195;
      const frameX = (pageW - frameW) / 2;
      if (heroBuf) {
        doc.rect(frameX - 4, curY - 4, frameW + 8, frameH + 8).lineWidth(0.75).strokeColor(theme.accent).stroke();
        doc.image(heroBuf, frameX, curY, {fit: [frameW, frameH], align: 'center', valign: 'center'});
        curY += frameH + 26;
      } else {
        curY += 32;
      }

      // Portfolio Title & Edition Metadata
      curY = drawMixedText(doc, params.title, marginX + 20, curY, {
        width: contentW - 40,
        fontSize: 18,
        color: '#FAF6F0',
        role: 'serif',
        bold: true,
        align: 'center',
      });

      curY += 10;
      const metaLine = `${labels.edition} | ${params.version} | ${dateLabel} | ${filteredProducts.length} ${labels.productsWord}`;
      curY = drawMixedText(doc, metaLine, marginX, curY, {
        width: contentW,
        fontSize: 9.5,
        color: '#E7DCC8',
        role: 'sans',
        align: 'center',
      });

      if (theme.signatureStatementEn) {
        drawMixedText(doc, theme.signatureStatementEn, marginX + 20, curY + 14, {
          width: contentW - 40,
          fontSize: 11.5,
          color: theme.accent,
          role: 'serif',
          italic: true,
          align: 'center',
        });
      }

      // Bottom Footer Band
      const footY = pageH - 86;
      doc.lineWidth(0.5).strokeColor(theme.accent).moveTo(60, footY - 12).lineTo(pageW - 60, footY - 12).stroke();
      const contactStrip = [params.websiteUrl, whatsappDisplay ? `WhatsApp: ${whatsappDisplay}` : '']
        .filter(Boolean)
        .join('   |   ');
      drawMixedText(doc, contactStrip, marginX, footY, {
        width: contentW,
        fontSize: 9.5,
        color: '#FAF6F0',
        role: 'sans',
        align: 'center',
      });
    } else if (params.coverDesign === 'editorial_split') {
      // Left heritage color spine + warm ivory canvas
      const leftPanelW = isLandscape ? 270 : 210;
      doc.rect(0, 0, pageW, pageH).fill(theme.surface);
      doc.rect(0, 0, leftPanelW, pageH).fill(theme.primary);
      doc.rect(leftPanelW, 0, 3, pageH).fill(theme.accent);

      // Left column typography
      let leftY = 72;
      leftY = drawMixedText(doc, labels.catalogueBadge, 24, leftY, {
        width: leftPanelW - 48,
        fontSize: 8.5,
        color: theme.accent,
        role: 'sans',
        bold: true,
      });
      leftY += 14;
      leftY = drawMixedText(doc, theme.nameEn, 24, leftY, {
        width: leftPanelW - 48,
        fontSize: 24,
        color: '#FAF6F0',
        role: 'serif',
        bold: true,
      });
      leftY += 10;
      leftY = drawMixedText(doc, lang === 'si' ? theme.taglineSi : theme.taglineEn, 24, leftY, {
        width: leftPanelW - 48,
        fontSize: 10.5,
        color: '#EAE0CE',
        role: 'serif',
        italic: true,
      });

      if (theme.signatureStatementEn) {
        leftY += 18;
        drawMixedText(doc, theme.signatureStatementEn, 24, leftY, {
          width: leftPanelW - 48,
          fontSize: 11,
          color: theme.accent,
          role: 'serif',
          italic: true,
        });
      }

      // Bottom metadata on spine
      const spineBottomY = pageH - 130;
      drawMixedText(
        doc,
        `${labels.edition}\n${params.version}\n${dateLabel}\n${filteredProducts.length} ${labels.productsWord}`,
        24,
        spineBottomY,
        {
          width: leftPanelW - 48,
          fontSize: 9,
          color: '#E5DAC5',
          role: 'sans',
        },
      );

      // Right column editorial presentation
      const rightX = leftPanelW + 34;
      const rightW = pageW - rightX - 34;
      let rightY = 72;

      if (heroBuf) {
        const imgH = isLandscape ? 210 : 280;
        doc.rect(rightX, rightY, rightW, imgH).fill(theme.tint);
        doc.image(heroBuf, rightX, rightY, {fit: [rightW, imgH], align: 'center', valign: 'center'});
        doc.lineWidth(0.75).strokeColor(theme.accent).rect(rightX, rightY, rightW, imgH).stroke();
        rightY += imgH + 34;
      } else {
        rightY += 80;
      }

      rightY = drawMixedText(doc, params.title, rightX, rightY, {
        width: rightW,
        fontSize: 22,
        color: theme.ink,
        role: 'serif',
        bold: true,
      });
      rightY += 14;
      doc.lineWidth(1.2).strokeColor(theme.accent).moveTo(rightX, rightY).lineTo(rightX + 80, rightY).stroke();
      rightY += 16;

      const summaryText =
        params.introMessage?.trim() || (lang === 'si' ? theme.defaultIntroSi : theme.defaultIntroEn);
      rightY = drawMixedText(doc, summaryText, rightX, rightY, {
        width: rightW,
        fontSize: 10,
        color: theme.muted,
        role: 'sans',
      });

      drawMixedText(
        doc,
        [params.websiteUrl, whatsappDisplay ? `WhatsApp: ${whatsappDisplay}` : '']
          .filter(Boolean)
          .join('  |  '),
        rightX,
        pageH - 64,
        {
          width: rightW,
          fontSize: 9,
          color: theme.secondary,
          role: 'sans',
          bold: true,
        },
      );
    } else {
      // gallery_minimal — restrained ivory luxury gallery
      doc.rect(0, 0, pageW, pageH).fill(theme.surface);
      doc.lineWidth(0.75).strokeColor(theme.border).rect(26, 26, pageW - 52, pageH - 52).stroke();

      let curY = isLandscape ? 70 : 120;
      curY = drawMixedText(doc, labels.catalogueBadge, marginX, curY, {
        width: contentW,
        fontSize: 9,
        color: theme.accent,
        role: 'sans',
        bold: true,
        align: 'center',
      });
      curY += 16;
      curY = drawMixedText(doc, theme.nameEn, marginX, curY, {
        width: contentW,
        fontSize: 40,
        color: theme.primary,
        role: 'serif',
        bold: true,
        align: 'center',
      });
      curY += 10;
      curY = drawMixedText(doc, lang === 'si' ? theme.taglineSi : theme.taglineEn, marginX + 30, curY, {
        width: contentW - 60,
        fontSize: 12.5,
        color: theme.muted,
        role: 'serif',
        italic: true,
        align: 'center',
      });

      curY += 24;
      doc
        .lineWidth(1)
        .strokeColor(theme.accent)
        .moveTo(pageW / 2 - 48, curY)
        .lineTo(pageW / 2 + 48, curY)
        .stroke();

      curY += 28;
      if (heroBuf) {
        const imgW = isLandscape ? 250 : 280;
        const imgH = isLandscape ? 140 : 190;
        doc.image(heroBuf, (pageW - imgW) / 2, curY, {
          fit: [imgW, imgH],
          align: 'center',
          valign: 'center',
        });
        curY += imgH + 28;
      }

      curY = drawMixedText(doc, params.title, marginX + 20, curY, {
        width: contentW - 40,
        fontSize: 17,
        color: theme.ink,
        role: 'serif',
        bold: true,
        align: 'center',
      });
      curY += 10;
      curY = drawMixedText(
        doc,
        `${labels.edition} | ${params.version} | ${dateLabel}`,
        marginX,
        curY,
        {
          width: contentW,
          fontSize: 9.5,
          color: theme.muted,
          role: 'sans',
          align: 'center',
        },
      );

      if (theme.signatureStatementEn) {
        drawMixedText(doc, theme.signatureStatementEn, marginX + 24, curY + 14, {
          width: contentW - 48,
          fontSize: 11,
          color: theme.primary,
          role: 'serif',
          italic: true,
          align: 'center',
        });
      }

      drawMixedText(
        doc,
        [params.websiteUrl, whatsappDisplay ? `WhatsApp: ${whatsappDisplay}` : '']
          .filter(Boolean)
          .join('   |   '),
        marginX,
        pageH - 72,
        {
          width: contentW,
          fontSize: 9,
          color: theme.primary,
          role: 'sans',
          align: 'center',
        },
      );
    }
  };

  drawCoverPage();

  // Helper for content pages (warm subtle border + clean white/ivory surface)
  let currentPageIndex = 0; // 0-indexed page counter
  const addContentPage = () => {
    doc.addPage({
      size: 'A4',
      layout: isLandscape ? 'landscape' : 'portrait',
      margins: {top: 44, bottom: 44, left: 42, right: 42},
    });
    currentPageIndex += 1;
    doc.rect(0, 0, pageW, pageH).fill('#FFFFFF');
    doc.rect(0, 0, pageW, 6).fill(theme.primary);
    return topSafeY;
  };

  // -------------------------------------------------------------------------
  // PAGE 2: BRAND INTRODUCTION, COMPANY PROFILE & TABLE OF CONTENTS PLACEHOLDER
  // -------------------------------------------------------------------------
  let cursorY = addContentPage();
  const tocPageIndex = currentPageIndex;

  // Brand Intro Panel
  const introText =
    params.introMessage?.trim() || (lang === 'si' ? theme.defaultIntroSi : theme.defaultIntroEn);
  const companyText =
    params.companyProfile?.trim() ||
    'Ceylon Heritage House (Pvt) Ltd - Curated origin-packed Sri Lankan spices, single-estate Ceylon teas, and heritage craft.';
  const contactText = [
    params.contactInfo?.trim() || 'Colombo Heritage Dispatch & Trade Desk, Sri Lanka',
    params.websiteUrl ? `Web: ${params.websiteUrl}` : '',
    whatsappDisplay ? `WhatsApp: ${whatsappDisplay}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const statementLayout = theme.signatureStatementEn
    ? measureAndWrapMixedText(doc, theme.signatureStatementEn, contentW - 28, 10.5, 'serif', false, true)
    : null;
  const statementOffset = statementLayout ? statementLayout.totalHeight + 6 : 0;

  const introLayout = measureAndWrapMixedText(doc, introText, contentW - 28, 9.5, 'sans', false, false);
  const companyLayout = measureAndWrapMixedText(
    doc,
    `${companyText}\n${contactText}`,
    contentW - 28,
    9,
    'sans',
    false,
    false,
  );
  const introBoxH = 26 + statementOffset + introLayout.totalHeight + 14;
  const companyBoxH = 26 + companyLayout.totalHeight + 12;

  doc.rect(marginX, cursorY, contentW, introBoxH).fill(theme.surface);
  doc.rect(marginX, cursorY, 3, introBoxH).fill(theme.primary);
  drawMixedText(doc, labels.introHeading, marginX + 14, cursorY + 10, {
    width: contentW - 28,
    fontSize: 9.5,
    color: theme.primary,
    role: 'sans',
    bold: true,
  });
  if (theme.signatureStatementEn) {
    drawMixedText(doc, theme.signatureStatementEn, marginX + 14, cursorY + 25, {
      width: contentW - 28,
      fontSize: 10.5,
      color: theme.primary,
      role: 'serif',
      italic: true,
    });
  }
  drawMixedText(doc, introText, marginX + 14, cursorY + 26 + statementOffset, {
    width: contentW - 28,
    fontSize: 9.5,
    color: theme.ink,
    role: 'sans',
  });
  cursorY += introBoxH + 12;

  doc.rect(marginX, cursorY, contentW, companyBoxH).fill('#FAF9F7');
  doc.lineWidth(0.5).strokeColor(theme.border).rect(marginX, cursorY, contentW, companyBoxH).stroke();
  drawMixedText(doc, labels.companyHeading, marginX + 14, cursorY + 10, {
    width: contentW - 28,
    fontSize: 9,
    color: theme.secondary,
    role: 'sans',
    bold: true,
  });
  drawMixedText(doc, `${companyText}\n${contactText}`, marginX + 14, cursorY + 25, {
    width: contentW - 28,
    fontSize: 9,
    color: theme.muted,
    role: 'sans',
  });
  cursorY += companyBoxH + 18;

  // Table of Contents Header (coordinates recorded so page numbers get painted cleanly after product layout)
  drawMixedText(doc, labels.tocHeading, marginX, cursorY, {
    width: contentW,
    fontSize: 11,
    color: theme.primary,
    role: 'serif',
    bold: true,
  });
  cursorY += 18;
  doc.lineWidth(0.8).strokeColor(theme.accent).moveTo(marginX, cursorY).lineTo(marginX + contentW, cursorY).stroke();
  cursorY += 10;

  interface TocRowSlot {
    pageIndex: number;
    y: number;
    label: string;
    isCategory: boolean;
    targetPageOneBased: number;
  }
  const tocSlots: TocRowSlot[] = [];

  const reserveTocSlot = (label: string, isCategory: boolean): TocRowSlot => {
    const rowH = isCategory ? 17 : 14;
    if (cursorY + rowH > bottomSafeY) {
      cursorY = addContentPage();
      drawMixedText(doc, `${labels.tocHeading} (cont.)`, marginX, cursorY, {
        width: contentW,
        fontSize: 10,
        color: theme.primary,
        role: 'serif',
        bold: true,
      });
      cursorY += 20;
    }
    const slot: TocRowSlot = {
      pageIndex: currentPageIndex,
      y: cursorY,
      label,
      isCategory,
      targetPageOneBased: 0,
    };
    tocSlots.push(slot);
    cursorY += rowH;
    return slot;
  };

  // Reserve TOC slots in exact category + product order
  const productTocMap = new Map<string, TocRowSlot>();
  const categoryTocMap = new Map<string, TocRowSlot>();
  for (const group of categoryGroups) {
    categoryTocMap.set(
      group.categorySlug,
      reserveTocSlot(`${group.categoryName} (${group.items.length})`, true),
    );
    for (const item of group.items) {
      const itemLabel = `${loc(item.name, lang)}${params.fields.sku && item.sku ? `  [${item.sku}]` : ''}`;
      productTocMap.set(item.id, reserveTocSlot(itemLabel, false));
    }
  }

  // -------------------------------------------------------------------------
  // PRODUCT SECTIONS (STRICTLY NON-OVERLAPPING EDITORIAL CARDS)
  // -------------------------------------------------------------------------
  cursorY = addContentPage();

  const measureProductCard = (product: Product) => {
    const pad = 14;
    const imgW = isLandscape ? 168 : 138;
    const imgH = isLandscape ? 168 : 148;
    const rightColW = contentW - pad * 2 - imgW - 18;

    const prodName = loc(product.name, lang);
    const titleLayout = measureAndWrapMixedText(doc, prodName, rightColW, 13, 'serif', true, false, 1.35);

    const metaBits: string[] = [];
    if (params.fields.sku && product.sku) metaBits.push(`${labels.sku}: ${product.sku}`);
    if (params.fields.category && loc(product.category, lang)) metaBits.push(loc(product.category, lang));
    if (params.fields.origin && loc(product.origin, lang)) metaBits.push(`${labels.origin}: ${loc(product.origin, lang)}`);
    const metaLine = metaBits.join('  |  ');
    const metaLayout = metaLine
      ? measureAndWrapMixedText(doc, metaLine, rightColW, 8.2, 'sans', true, false, 1.35)
      : null;

    const descText = params.fields.description ? loc(product.description, lang) : '';
    const descLayout = descText
      ? measureAndWrapMixedText(doc, descText, rightColW, 9, 'sans', false, false, 1.44)
      : null;

    // Build verified optional spec rows (omitting any unverified / missing fields cleanly)
    const specRows: {label: string; value: string}[] = [];
    const highlightsVal = params.fields.highlights ? loc(product.highlights, lang) || loc(product.tastingNotes, lang) : '';
    if (highlightsVal) specRows.push({label: labels.highlights, value: highlightsVal});

    const ingredientsVal = params.fields.ingredients ? loc(product.ingredients, lang) : '';
    if (ingredientsVal) specRows.push({label: labels.ingredients, value: ingredientsVal});

    const pkgTypeVal = params.fields.packagingType
      ? loc(product.packagingType, lang) || product.exportSpecs?.packagingNote || ''
      : '';
    if (pkgTypeVal) specRows.push({label: labels.packagingType, value: pkgTypeVal});

    const storageVal = params.fields.storageInstructions ? loc(product.storageInstructions, lang) : '';
    if (storageVal) specRows.push({label: labels.storage, value: storageVal});

    const shelfLifeVal = params.fields.shelfLife ? product.exportSpecs?.shelfLife?.trim() || '' : '';
    if (shelfLifeVal) specRows.push({label: labels.shelfLife, value: shelfLifeVal});

    if (params.fields.moq && typeof product.moqUnits === 'number' && product.moqUnits > 0) {
      specRows.push({label: labels.moq, value: `${product.moqUnits} units`});
    }

    const techVal = params.fields.technicalSpecs
      ? loc(product.technicalSpecs, lang) || product.exportSpecs?.botanicalOrGrade || ''
      : '';
    if (techVal) specRows.push({label: labels.specs, value: techVal});

    if (params.fields.certifications && Array.isArray(product.certifications) && product.certifications.length > 0) {
      specRows.push({label: labels.certs, value: product.certifications.filter(Boolean).join(', ')});
    }

    if (
      params.fields.wholesalePrices &&
      typeof product.exportPriceUsd === 'number' &&
      product.exportPriceUsd > 0
    ) {
      specRows.push({
        label: labels.wholesaleLabel,
        value: formatWholesalePdfPrice(product.exportPriceUsd, params.currency, params.currencyConfig),
      });
    }

    let specsHeight = 0;
    const measuredSpecs = specRows.map((sr) => {
      const lineStr = `${sr.label}: ${sr.value}`;
      const lay = measureAndWrapMixedText(doc, lineStr, rightColW, 8.2, 'sans', false, false, 1.38);
      specsHeight += lay.totalHeight + 2;
      return {...sr, layout: lay};
    });

    const rightUpperH =
      titleLayout.totalHeight +
      (metaLayout ? metaLayout.totalHeight + 4 : 0) +
      (descLayout ? descLayout.totalHeight + 8 : 0) +
      (specsHeight > 0 ? specsHeight + 6 : 0);

    const upperBodyH = Math.max(imgH, rightUpperH);

    // Pack sizes & retail pricing table (below upper image+details block spanning full card inner width)
    const activeVariants = (product.variants ?? []).filter((v) => v && (v.label || v.weightGrams));
    const showPackTable = params.fields.packSizes && activeVariants.length > 0;
    const tableRowH = 19;
    const tableH = showPackTable ? 20 + activeVariants.length * tableRowH + 6 : 0;

    const totalH = pad + upperBodyH + (tableH > 0 ? 12 + tableH : 0) + pad;

    return {
      pad,
      imgW,
      imgH,
      rightColW,
      prodName,
      titleLayout,
      metaLine,
      metaLayout,
      descText,
      descLayout,
      measuredSpecs,
      showPackTable,
      activeVariants,
      tableRowH,
      tableH,
      upperBodyH,
      totalH,
    };
  };

  for (let gIdx = 0; gIdx < categoryGroups.length; gIdx++) {
    const group = categoryGroups[gIdx];
    const firstProductMetric = measureProductCard(group.items[0]);
    const catHeaderH = 32;

    // Keep Category Header anchored with at least its first product card (no orphaned header!)
    if (cursorY + catHeaderH + firstProductMetric.totalH > bottomSafeY) {
      cursorY = addContentPage();
    }

    const catSlot = categoryTocMap.get(group.categorySlug);
    if (catSlot) {
      catSlot.targetPageOneBased = currentPageIndex + 1;
    }

    // Category Section Banner
    doc.rect(marginX, cursorY, contentW, 24).fill(theme.tint);
    doc.rect(marginX, cursorY, 4, 24).fill(theme.accent);
    drawMixedText(
      doc,
      `${group.categoryName.toUpperCase()}  (${group.items.length})`,
      marginX + 12,
      cursorY + 6,
      {
        width: contentW - 24,
        fontSize: 10,
        color: theme.primary,
        role: 'serif',
        bold: true,
      },
    );
    cursorY += 32;

    for (let pIdx = 0; pIdx < group.items.length; pIdx++) {
      const product = group.items[pIdx];
      const m = pIdx === 0 ? firstProductMetric : measureProductCard(product);

      if (cursorY + m.totalH > bottomSafeY) {
        cursorY = addContentPage();
      }

      const prodSlot = productTocMap.get(product.id);
      if (prodSlot) {
        prodSlot.targetPageOneBased = currentPageIndex + 1;
      }

      const cardX = marginX;
      const cardY = cursorY;

      // Card Surface & Crisp Border
      doc.rect(cardX, cardY, contentW, m.totalH).fill('#FFFFFF');
      doc.lineWidth(0.7).strokeColor(theme.border).rect(cardX, cardY, contentW, m.totalH).stroke();

      // Left Column: High-Resolution Product Photograph Frame (True Aspect Ratio via `fit`)
      const imgX = cardX + m.pad;
      const imgY = cardY + m.pad;
      doc.rect(imgX, imgY, m.imgW, m.imgH).fill(theme.surface);
      doc.lineWidth(0.5).strokeColor(theme.border).rect(imgX, imgY, m.imgW, m.imgH).stroke();

      const imgBuf = imageCache.get(product.mainImage) ?? null;
      if (imgBuf) {
        doc.image(imgBuf, imgX + 2, imgY + 2, {
          fit: [m.imgW - 4, m.imgH - 4],
          align: 'center',
          valign: 'center',
        });
      } else {
        drawMixedText(doc, theme.nameEn, imgX + 8, imgY + m.imgH / 2 - 8, {
          width: m.imgW - 16,
          fontSize: 10,
          color: theme.muted,
          role: 'serif',
          bold: true,
          align: 'center',
        });
      }

      // Right Column: Title, SKU/Origin, Editorial Description, Verified Specifications
      const rightX = imgX + m.imgW + 18;
      let ry = cardY + m.pad;

      ry = drawMixedText(doc, m.prodName, rightX, ry, {
        width: m.rightColW,
        fontSize: 13,
        color: theme.primary,
        role: 'serif',
        bold: true,
        lineHeightRatio: 1.35,
      });

      if (m.metaLine) {
        ry += 2;
        ry = drawMixedText(doc, m.metaLine, rightX, ry, {
          width: m.rightColW,
          fontSize: 8.2,
          color: theme.accent,
          role: 'sans',
          bold: true,
          lineHeightRatio: 1.35,
        });
      }

      if (m.descText) {
        ry += 5;
        ry = drawMixedText(doc, m.descText, rightX, ry, {
          width: m.rightColW,
          fontSize: 9,
          color: theme.ink,
          role: 'sans',
          lineHeightRatio: 1.44,
        });
      }

      if (m.measuredSpecs.length > 0) {
        ry += 5;
        doc
          .lineWidth(0.4)
          .strokeColor(theme.border)
          .moveTo(rightX, ry)
          .lineTo(rightX + m.rightColW, ry)
          .stroke();
        ry += 5;

        for (const sr of m.measuredSpecs) {
          ry = drawMixedText(doc, `${sr.label}: ${sr.value}`, rightX, ry, {
            width: m.rightColW,
            fontSize: 8.2,
            color: sr.label === labels.wholesaleLabel ? theme.primary : theme.muted,
            role: 'sans',
            bold: sr.label === labels.wholesaleLabel,
            lineHeightRatio: 1.38,
          });
          ry += 2;
        }
      }

      // Pack Sizes & Retail Prices Table
      if (m.showPackTable) {
        const tableX = cardX + m.pad;
        const tableW = contentW - m.pad * 2;
        let ty = cardY + m.pad + m.upperBodyH + 10;

        // Table Header Row
        doc.rect(tableX, ty, tableW, 20).fill(theme.primary);
        const col1W = params.fields.sku ? tableW * 0.25 : 0;
        const colPackW = params.fields.sku ? tableW * 0.27 : tableW * 0.42;
        const colWeightW = params.fields.netWeight ? tableW * 0.22 : 0;

        let hx = tableX + 8;
        if (params.fields.sku) {
          drawMixedText(doc, labels.sku, hx, ty + 4, {
            width: col1W - 8,
            fontSize: 8,
            color: '#FAF6F0',
            role: 'sans',
            bold: true,
          });
          hx += col1W;
        }
        drawMixedText(doc, labels.packTableHeadPack, hx, ty + 4, {
          width: colPackW - 8,
          fontSize: 8,
          color: '#FAF6F0',
          role: 'sans',
          bold: true,
        });
        hx += colPackW;
        if (params.fields.netWeight) {
          drawMixedText(doc, labels.packTableHeadWeight, hx, ty + 4, {
            width: colWeightW - 8,
            fontSize: 8,
            color: '#FAF6F0',
            role: 'sans',
            bold: true,
          });
          hx += colWeightW;
        }
        if (params.fields.retailPrices) {
          drawMixedText(doc, labels.packTableHeadRetail, tableX + 8, ty + 4, {
            width: tableW - 16,
            fontSize: 8,
            color: '#FAF6F0',
            role: 'sans',
            bold: true,
            align: 'right',
          });
        }
        ty += 20;

        m.activeVariants.forEach((v, vIdx) => {
          doc.rect(tableX, ty, tableW, m.tableRowH).fill(vIdx % 2 === 0 ? theme.surface : '#FFFFFF');
          doc.lineWidth(0.35).strokeColor(theme.border).rect(tableX, ty, tableW, m.tableRowH).stroke();
          let cx = tableX + 8;
          if (params.fields.sku) {
            drawMixedText(doc, v.variantSku, cx, ty + 4, {
              width: col1W - 8,
              fontSize: 8,
              color: theme.muted,
              role: 'sans',
            });
            cx += col1W;
          }
          drawMixedText(doc, v.label, cx, ty + 4, {
            width: colPackW - 8,
            fontSize: 8.2,
            color: theme.ink,
            role: 'sans',
            bold: true,
          });
          cx += colPackW;
          if (params.fields.netWeight) {
            const weightStr =
              v.weightGrams >= 1000
                ? `${(v.weightGrams / 1000).toFixed(v.weightGrams % 1000 === 0 ? 0 : 2)} kg`
                : `${v.weightGrams} g`;
            drawMixedText(doc, weightStr, cx, ty + 4, {
              width: colWeightW - 8,
              fontSize: 8.2,
              color: theme.muted,
              role: 'sans',
            });
          }
          if (params.fields.retailPrices) {
            drawMixedText(
              doc,
              formatPdfPrice(v.priceUsd, v.priceLkr, params.currency, params.currencyConfig),
              tableX + 8,
              ty + 4,
              {
                width: tableW - 16,
                fontSize: 8.5,
                color: theme.primary,
                role: 'sans',
                bold: true,
                align: 'right',
              },
            );
          }
          ty += m.tableRowH;
        });
      }

      cursorY += m.totalH + 14;
    }
  }

  // -------------------------------------------------------------------------
  // FINAL BUFFERED PASS: STAMP TOC PAGE NUMBERS + CONTENT HEADERS & FOOTERS
  // -------------------------------------------------------------------------
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  // 1. Paint TOC rows onto their reserved TOC pages now that exact target page numbers exist
  for (const slot of tocSlots) {
    doc.switchToPage(slot.pageIndex);
    const rowY = slot.y;
    const indentX = slot.isCategory ? marginX : marginX + 14;
    const maxLabelW = contentW - (slot.isCategory ? 48 : 62);
    if (slot.isCategory) {
      doc.rect(marginX, rowY - 1, contentW, 15).fill(theme.surface);
    }
    drawMixedText(doc, slot.label, indentX, rowY + 1, {
      width: maxLabelW,
      fontSize: slot.isCategory ? 9 : 8.5,
      color: slot.isCategory ? theme.primary : theme.ink,
      role: 'sans',
      bold: slot.isCategory,
    });
    drawMixedText(
      doc,
      String(slot.targetPageOneBased || tocPageIndex + 2),
      marginX,
      rowY + 1,
      {
        width: contentW - 6,
        fontSize: 8.5,
        color: slot.isCategory ? theme.primary : theme.muted,
        role: 'sans',
        bold: slot.isCategory,
        align: 'right',
      },
    );
  }

  // 2. Paint Running Headers & Footers on every content page (skip cover page index 0)
  for (let i = 1; i < totalPages; i++) {
    doc.switchToPage(i);

    // Running Top Header
    drawMixedText(doc, theme.nameEn, marginX, 24, {
      width: contentW * 0.45,
      fontSize: 8.5,
      color: theme.primary,
      role: 'serif',
      bold: true,
    });
    drawMixedText(doc, `${params.title}  |  ${params.version}`, marginX, 24, {
      width: contentW,
      fontSize: 8,
      color: theme.muted,
      role: 'sans',
      align: 'right',
    });
    doc
      .lineWidth(0.5)
      .strokeColor(theme.accent)
      .moveTo(marginX, 42)
      .lineTo(marginX + contentW, 42)
      .stroke();

    // Running Bottom Footer
    const footerRuleY = pageH - 42;
    doc
      .lineWidth(0.5)
      .strokeColor(theme.border)
      .moveTo(marginX, footerRuleY)
      .lineTo(marginX + contentW, footerRuleY)
      .stroke();

    if (params.fields.wholesalePrices) {
      drawMixedText(doc, labels.confidentialNotice, marginX, footerRuleY - 13, {
        width: contentW,
        fontSize: 7.2,
        color: theme.primary,
        role: 'sans',
        bold: true,
        align: 'center',
      });
    }

    const footerLeft = [
      labels.copyright,
      params.websiteUrl,
      whatsappDisplay ? `WhatsApp: ${whatsappDisplay}` : '',
      dateLabel,
    ]
      .filter(Boolean)
      .join('  |  ');

    drawMixedText(doc, footerLeft, marginX, footerRuleY + 7, {
      width: contentW - 85,
      fontSize: 7.4,
      color: theme.muted,
      role: 'sans',
    });

    const pageStr = `${labels.pageWord} ${i + 1} ${labels.ofWord} ${totalPages}`;
    drawMixedText(doc, pageStr, marginX, footerRuleY + 7, {
      width: contentW,
      fontSize: 7.8,
      color: theme.primary,
      role: 'sans',
      bold: true,
      align: 'right',
    });
  }

  doc.end();
  const buffer = await pdfDone;

  return {
    buffer,
    pageCount: totalPages,
    productCount: filteredProducts.length,
  };
}

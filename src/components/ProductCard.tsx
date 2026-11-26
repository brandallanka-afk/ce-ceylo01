import {useState} from 'react';
import {useStore} from '../context/StoreContext';
import type {Product} from '../types/commerce';
import {formatMoney} from '../utils/currency';
import {buildPagePath} from '../utils/seo';
import BrandLogo, {isOfficialLogoBrand} from './BrandLogo';
import SafeImage from './SafeImage';

interface ProductCardProps {
  product: Product;
  accentHex?: string;
}

export default function ProductCard({product, accentHex}: ProductCardProps) {
  const {lang, currency, t, navigate, addToCart} = useStore();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selectedVariant = product.variants[selectedIdx] ?? product.variants[0];

  const brandName = product.brandId === 'ceyvana' ? 'CEYVANA' : 'CEYLOMIRA';
  const defaultAccent = product.brandId === 'ceyvana' ? '#501C2B' : '#123D32';
  const btnBg = accentHex ?? defaultAccent;
  const productUrl = buildPagePath('product', {productSlug: product.slug, lang});
  const localizedName = product.name[lang] || product.name.en;
  const localizedCategory = product.category[lang] || product.category.en;
  const localizedOrigin = product.origin[lang] || product.origin.en;

  const stockText =
    product.availability === 'low_stock'
      ? t.store.lowStock
      : product.availability === 'out_of_stock'
        ? t.store.outOfStock
        : t.store.inStock;

  return (
    <article className="group flex flex-col bg-[#211C1A] border border-[#C6A46A]/22 hover:border-[#C6A46A]/60 rounded-md overflow-hidden luxury-card-shadow transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5">
      <a
        href={productUrl}
        onClick={(e) => {
          e.preventDefault();
          navigate('product', product.slug);
        }}
        className="block relative aspect-[4/3] bg-[#161412] overflow-hidden"
      >
        <SafeImage
          src={product.mainImage}
          alt={`${localizedName} — ${localizedOrigin}`}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          aspectClass="w-full h-full"
        />
      </a>

      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-[#A99B88] mb-2.5 tracking-[0.1em]">
            <span className="inline-flex items-center gap-2 min-w-0 font-medium text-[#C6A46A]">
              {isOfficialLogoBrand(product.brandId) && (
                <BrandLogo brandId={product.brandId} size="2xs" sheen={false} animated={false} />
              )}
              <span className="truncate uppercase tracking-[0.12em]">
                {brandName} <span className="text-[#A99B88] normal-case tracking-normal">· {localizedCategory}</span>
              </span>
            </span>
            <span className="shrink-0 font-normal text-[#A99B88]">
              {stockText}
            </span>
          </div>

          <h3 className="font-display text-[1.35rem] font-medium text-[#F3EBDD] leading-snug mb-1.5">
            <a
              href={productUrl}
              onClick={(e) => {
                e.preventDefault();
                navigate('product', product.slug);
              }}
              className="hover:text-[#C6A46A] transition-colors duration-150"
            >
              {localizedName}
            </a>
          </h3>

          <p className="text-xs text-[#D2C6B5] line-clamp-1 leading-relaxed">{localizedOrigin}</p>
        </div>

        <div className="space-y-3.5 pt-3.5 border-t border-[#C6A46A]/20">
          {/* Refined dark luxury weight options */}
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label={t.pdp.packSize}
          >
            {product.variants.map((variant, idx) => {
              const isSelected = idx === selectedIdx;
              return (
                <button
                  key={variant.variantSku}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedIdx(idx)}
                  className={`px-2.5 py-1 text-xs font-mono-tabular rounded border transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[32px] ${
                    isSelected
                      ? 'bg-[#C6A46A] text-[#151312] border-[#C6A46A] font-medium'
                      : 'bg-[#2A2522] text-[#D2C6B5] border-[#3B332E] hover:text-[#F3EBDD] hover:border-[#C6A46A]/65'
                  }`}
                >
                  {variant.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-end justify-between gap-3 pt-0.5">
            <div>
              <span className="block text-[10px] tracking-wider text-[#A99B88] font-mono-tabular">
                {selectedVariant.variantSku}
              </span>
              <span className="text-base font-medium text-[#C6A46A] font-mono-tabular">
                {formatMoney(selectedVariant.priceLkr, selectedVariant.priceUsd, currency)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => addToCart(product, selectedVariant, 1)}
              disabled={!selectedVariant.available || selectedVariant.stockQuantity <= 0}
              style={{backgroundColor: btnBg}}
              className="px-4 py-2 text-xs font-medium tracking-wide text-[#F3EBDD] border border-[#C6A46A]/50 rounded hover:border-[#C6A46A] hover:brightness-110 disabled:opacity-40 transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 min-h-[44px]"
            >
              {t.store.addToCart}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

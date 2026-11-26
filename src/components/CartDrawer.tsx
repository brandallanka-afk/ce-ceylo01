import {useEffect} from 'react';
import {Minus, Plus, ShoppingBag, Trash2, X} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {
  buildCartWhatsAppMessage,
  buildWhatsAppLink,
  formatMoney,
  resolveBrandWhatsappNumber,
} from '../utils/currency';
import SafeImage from './SafeImage';

export default function CartDrawer() {
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    cartSubtotalLkr,
    cartSubtotalUsd,
    cartWeightGrams,
    currency,
    lang,
    t,
    commerceConfig,
    updateQuantity,
    removeFromCart,
    navigate,
  } = useStore();

  useEffect(() => {
    if (!isCartOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCartOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCartOpen, setIsCartOpen]);

  if (!isCartOpen) {
    return null;
  }

  const distinctBrands = Array.from(new Set(cart.map((i) => i.brandId)));
  const brandScope = distinctBrands.length === 1 ? distinctBrands[0] : 'mixed';
  const targetWhatsapp = resolveBrandWhatsappNumber(brandScope, commerceConfig);

  const whatsappUrl = buildWhatsAppLink(
    buildCartWhatsAppMessage(cart, currency, lang),
    targetWhatsapp,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={t.cart.title}
    >
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-[2px] transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      <aside className="relative z-10 w-full max-w-md bg-[#211C1A] text-[#F3EBDD] h-full flex flex-col border-l border-[#C6A46A]/35 shadow-2xl">
        <div className="px-6 py-4 border-b border-[#C6A46A]/25 bg-[#151312] text-[#F3EBDD] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-[#C6A46A]" aria-hidden="true" />
            <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">{t.cart.title}</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            aria-label="Close cart"
            className="w-10 h-10 inline-flex items-center justify-center rounded hover:bg-[#2A2522] text-[#F3EBDD] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#C6A46A]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-4">
              <ShoppingBag className="w-10 h-10 text-[#C6A46A]/65" aria-hidden="true" />
              <div className="space-y-1.5">
                <h3 className="font-display text-2xl font-medium text-[#F3EBDD]">
                  {t.cart.emptyTitle}
                </h3>
                <p className="text-sm text-[#D2C6B5] max-w-xs">{t.cart.emptyBody}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCartOpen(false);
                    navigate('ceyvana');
                  }}
                  className="px-4 py-2.5 text-xs font-medium tracking-wider bg-[#501C2B] border border-[#C6A46A]/50 text-[#F3EBDD] rounded hover:border-[#C6A46A] cursor-pointer min-h-[40px]"
                >
                  {t.cart.browseCeyvana}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCartOpen(false);
                    navigate('ceylomira');
                  }}
                  className="px-4 py-2.5 text-xs font-medium tracking-wider bg-[#123D32] border border-[#C6A46A]/50 text-[#F3EBDD] rounded hover:border-[#C6A46A] cursor-pointer min-h-[40px]"
                >
                  {t.cart.browseCeylomira}
                </button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-[#C6A46A]/18">
              {cart.map((item) => {
                const liveStock =
                  commerceConfig?.liveStockBySku?.[item.variantSku]?.stockQuantity ?? item.maxStock;
                const displayName = item.productName[lang] || item.productName.en;
                return (
                  <li key={item.variantSku} className="py-4 flex gap-4">
                    <div className="w-20 h-20 rounded-md overflow-hidden bg-[#151312] border border-[#362F2A] shrink-0">
                      <SafeImage
                        src={item.image}
                        alt={displayName}
                        sizes="80px"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-[#C6A46A]">
                            {item.brandId === 'ceyvana' ? 'Ceyvana' : 'Ceylomira'} ·{' '}
                            {item.variantLabel}
                          </p>
                          <h4 className="text-sm font-medium text-[#F3EBDD] truncate">
                            {displayName}
                          </h4>
                          <p className="text-[11px] font-mono-tabular text-[#A99B88]">
                            {item.variantSku} · {liveStock} in stock
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.variantSku)}
                          aria-label={`${t.cart.remove} ${displayName}`}
                          className="p-1.5 text-[#A99B88] hover:text-[#F3B0B6] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center border border-[#C6A46A]/30 rounded-md bg-[#2A2522]">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.variantSku, item.quantity - 1)}
                            aria-label="Decrease quantity"
                            className="w-8 h-8 inline-flex items-center justify-center hover:bg-[#362F2A] text-[#F3EBDD] cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2.5 text-xs font-mono-tabular font-medium text-[#F3EBDD]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={item.quantity >= liveStock}
                            onClick={() => updateQuantity(item.variantSku, item.quantity + 1)}
                            aria-label="Increase quantity"
                            className="w-8 h-8 inline-flex items-center justify-center hover:bg-[#362F2A] text-[#F3EBDD] disabled:opacity-35 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="text-sm font-medium font-mono-tabular text-[#C6A46A]">
                          {formatMoney(
                            item.priceLkr * item.quantity,
                            item.priceUsd * item.quantity,
                            currency,
                          )}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t border-[#C6A46A]/25 bg-[#151312] px-6 py-5 space-y-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-[#D2C6B5]">
                <span>{t.cart.totalWeight}</span>
                <span className="font-mono-tabular text-[#A99B88]">{cartWeightGrams}g</span>
              </div>
              <div className="flex justify-between text-base font-medium text-[#F3EBDD]">
                <span>{t.cart.subtotal}</span>
                <span className="font-mono-tabular text-[#C6A46A]">
                  {formatMoney(cartSubtotalLkr, cartSubtotalUsd, currency)}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#A99B88] bg-[#211C1A] border border-[#C6A46A]/20 rounded-md p-3 leading-relaxed">
              {t.cart.demoNotice}
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  navigate('cart');
                }}
                className="w-full inline-flex items-center justify-center px-4 py-3 text-sm font-medium bg-[#C6A46A] text-[#151312] rounded-md hover:bg-[#D4B47B] transition-colors cursor-pointer"
              >
                {t.cart.viewFullCart}
              </button>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium bg-transparent border border-[#C6A46A]/55 text-[#F3EBDD] rounded-md hover:border-[#C6A46A] hover:bg-[#C6A46A]/10 transition-colors"
              >
                {t.cart.whatsappOrder}
              </a>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

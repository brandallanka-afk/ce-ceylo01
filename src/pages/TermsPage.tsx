import {useEffect} from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import {useStore} from '../context/StoreContext';
import {updatePageSeo} from '../utils/seo';

export default function TermsPage() {
  const {lang, t, availableLanguages} = useStore();
  const isSi = lang === 'si';

  useEffect(() => {
    updatePageSeo({
      title: isSi
        ? 'නියමයන් සහ කොන්දේසි | සෙයිලෝන් හෙරිටේජ් හවුස්'
        : 'Terms & Conditions | Ceylon Heritage House',
      description: isSi
        ? 'සෙයිවානා සහ සෙයිලෝමිරා වෙබ් අඩවිය, ඇණවුම් තහවුරු කිරීම් සහ ජාත්‍යන්තර අපනයන කොන්දේසි.'
        : 'Terms governing orders, bank transfer verification, stock validation, and international export quotations for Ceyvana and Ceylomira.',
      page: 'terms',
      lang,
      availableLangCodes: availableLanguages.map((l) => l.code),
    });
  }, [lang, isSi, availableLanguages]);

  return (
    <div className="bg-[#151312] text-[#F3EBDD]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-8">
        <header className="space-y-3 border-b border-[#C6A46A]/25 pb-6">
          <Breadcrumbs
            items={[
              {label: t.nav.home, page: 'home'},
              {label: isSi ? 'නියමයන් සහ කොන්දේසි' : 'Terms & Conditions'},
            ]}
          />
          <p className="text-xs font-medium tracking-[0.18em] uppercase text-[#C6A46A]">
            {isSi ? 'නීතිමය තොරතුරු' : 'Legal & Governance'}
          </p>
          <h1 className="font-display text-4xl font-medium text-[#F3EBDD]">
            {isSi ? 'නියමයන් සහ කොන්දේසි' : 'Terms & Conditions'}
          </h1>
          <p className="text-xs text-[#A99B88]">Last updated: November 2026</p>
        </header>

        <div className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-lg p-6 sm:p-8 space-y-6 text-sm sm:text-base text-[#D2C6B5] leading-relaxed luxury-card-shadow">
          <section className="space-y-2">
            <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
              1. Pricing, Stock Validation &amp; Payment Verification
            </h2>
            <p>
              All product unit prices, pack weights, delivery zone charges, and available stock
              quantities are validated server-side upon checkout. Orders submitted via Bank Transfer
              remain in pending verification until an administrator confirms receipt of funds.
              Opening a WhatsApp order summary does not automatically confirm an order.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
              2. Product Availability &amp; Natural Harvest Variance
            </h2>
            <p>
              All spices and teas are single-origin agricultural crops harvested across Sri Lanka.
              Subtle seasonal variations in aroma, colour, and harvest availability may occur, and
              orders are fulfilled subject to active batch inventory.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
              3. Wholesale &amp; International Export Shipments
            </h2>
            <p>
              International export quotations are confirmed strictly in writing per destination
              country, weight, and Incoterms. Transit times and destination customs duties are not
              guaranteed prior to official carrier booking and destination customs confirmation.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

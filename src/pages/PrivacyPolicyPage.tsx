import {useEffect} from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import {useStore} from '../context/StoreContext';
import {updatePageSeo} from '../utils/seo';

export default function PrivacyPolicyPage() {
  const {lang, t, availableLanguages} = useStore();
  const isSi = lang === 'si';

  useEffect(() => {
    updatePageSeo({
      title: isSi
        ? 'රහස්‍යතා ප්‍රතිපත්තිය | සෙයිලෝන් හෙරිටේජ් හවුස්'
        : 'Privacy Policy | Ceylon Heritage House',
      description: isSi
        ? 'සෙයිවානා සහ සෙයිලෝමිරා පාරිභෝගික දත්ත, ඇණවුම් විස්තර සහ ආරක්ෂණ ප්‍රතිපත්ති.'
        : 'Privacy, order data protection, and zero-card-storage commitments for Ceyvana and Ceylomira customers and trade buyers.',
      page: 'privacy',
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
              {label: isSi ? 'රහස්‍යතා ප්‍රතිපත්තිය' : 'Privacy Policy'},
            ]}
          />
          <p className="text-xs font-medium tracking-[0.18em] uppercase text-[#C6A46A]">
            {isSi ? 'නීතිමය තොරතුරු' : 'Legal & Governance'}
          </p>
          <h1 className="font-display text-4xl font-medium text-[#F3EBDD]">
            {isSi ? 'රහස්‍යතා ප්‍රතිපත්තිය' : 'Privacy Policy'}
          </h1>
          <p className="text-xs text-[#A99B88]">Last updated: November 2026</p>
        </header>

        <div className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-lg p-6 sm:p-8 space-y-6 text-sm sm:text-base text-[#D2C6B5] leading-relaxed luxury-card-shadow">
          <section className="space-y-2">
            <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
              1. Browser Preferences &amp; Shopping Cart Persistence
            </h2>
            <p>
              Shopping cart selections, chosen language preferences (English or Sinhala), and display
              currency (LKR or USD) are persisted locally in your browser so your basket remains intact
              across sessions.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
              2. Orders, Wholesale Enquiries &amp; WhatsApp Communications
            </h2>
            <p>
              Delivery details, payment references, bank transfer slips, and international buyer
              enquiries submitted through our commerce forms are stored securely to verify payments,
              prepare commercial dispatches, and respond to official trade requests. We never sell or
              rent customer or buyer records to third parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
              3. Payment Verification &amp; Card Security Commitments
            </h2>
            <p>
              Orders currently use verified Bank Transfer receipts or administrator-enabled Cash on
              Delivery, with modular Sri Lankan and international payment gateway adapters prepared
              using signed server-side webhooks. Ceylon Heritage House never collects, processes, or
              stores payment card numbers or CVV codes on its servers.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

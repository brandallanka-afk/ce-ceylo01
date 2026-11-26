import {FormEvent, useEffect, useState} from 'react';
import {CheckCircle2, MessageCircle} from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
import {useStore} from '../context/StoreContext';
import {buildWhatsAppLink} from '../utils/currency';
import {updatePageSeo} from '../utils/seo';

export default function ContactPage() {
  const {t, lang, commerceConfig, availableLanguages} = useStore();
  const [inquiryType, setInquiryType] = useState<'wholesale' | 'export' | 'general'>('wholesale');
  const [brandInterest, setBrandInterest] = useState('Ceyvana & Ceylomira');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Sri Lanka');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    updatePageSeo({
      title:
        lang === 'si'
          ? 'සම්බන්ධ වන්න | සෙයිලෝන් හෙරිටේජ් හවුස්'
          : 'Contact & Trade Desk | Ceylon Heritage House',
      description:
        lang === 'si'
          ? 'සිල්ලර ඇණවුම්, තොග බෙදාහැරීම් සහ අපනයන විමසුම් සඳහා සෙයිවානා සහ සෙයිලෝමිරා කොළඹ වෙළඳ කාර්යාලය සමඟ සම්බන්ධ වන්න.'
          : 'Connect with Ceylon Heritage House in Colombo, Sri Lanka for retail orders, wholesale distribution, and export enquiries.',
      page: 'contact',
      lang,
      availableLangCodes: availableLanguages.map((l) => l.code),
    });
  }, [lang, availableLanguages]);

  const whatsappDirect = buildWhatsAppLink(
    lang === 'si'
      ? 'ආයුබෝවන්, තොග සහ අපනයන විමසීමක් සඳහා සම්බන්ධ වෙමි.'
      : 'Hello Ceylon Heritage Desk, I would like to request wholesale / export information.',
    commerceConfig?.whatsappNumber,
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !message.trim()) {
      return;
    }
    try {
      const {submitPublicEnquiry} = await import('../services/firestoreService');
      await submitPublicEnquiry({
        type: inquiryType,
        brandInterest,
        contactName: fullName,
        companyName: company,
        email,
        phone,
        country,
        message,
      });
    } catch {
      // Allow graceful confirmation with WhatsApp fallback if offline
    }
    setSubmitted(true);
  };

  const whatsappSubmittedUrl = buildWhatsAppLink(
    `Enquiry (${inquiryType.toUpperCase()}) - ${brandInterest}\nName: ${fullName}\nCompany: ${company || 'N/A'}\nCountry: ${country}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\n\n${message}`,
    commerceConfig?.whatsappNumber,
  );

  return (
    <div className="bg-[#1C1917] text-[#F3EBDD]">
      <section className="bg-[#151312] text-[#F3EBDD] py-14 lg:py-20 border-b border-[#C6A46A]/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <Breadcrumbs tone="light" items={[{label: t.nav.home, page: 'home'}, {label: t.nav.contact}]} />
          <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-[#C6A46A]">
            {t.contact.eyebrow}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-medium text-[#F3EBDD]">
            {t.contact.title}
          </h1>
          <p className="text-sm sm:text-base text-[#D2C6B5] max-w-2xl leading-relaxed">
            {t.contact.subtitle}
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left: Direct WhatsApp & Colombo Office Info */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#123D32] text-[#F3EBDD] border border-[#C6A46A]/40 rounded-md p-7 sm:p-8 space-y-4 luxury-card-shadow">
              <div className="flex items-center gap-2.5">
                <MessageCircle className="w-5 h-5 text-[#C6A46A]" aria-hidden="true" />
                <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                  {t.contact.whatsappCardTitle}
                </h2>
              </div>
              <p className="text-sm text-[#D2C6B5] leading-relaxed">{t.contact.whatsappCardBody}</p>
              <a
                href={whatsappDirect}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-5 py-3 text-xs font-medium tracking-[0.06em] bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] transition-colors min-h-[44px]"
              >
                {t.contact.whatsappBtn}
              </a>
            </div>

            <div className="bg-[#211C1A] border border-[#C6A46A]/25 rounded-md p-6 space-y-2.5 text-sm luxury-card-shadow">
              <h3 className="font-display text-xl font-medium text-[#F3EBDD]">
                Ceylon Heritage House
              </h3>
              <p className="text-[#D2C6B5]">{t.footer.locationLabel}</p>
              <p className="font-mono-tabular text-xs text-[#C6A46A]">{t.footer.emailLabel}</p>
            </div>
          </div>

          {/* Right: Wholesale & Export Enquiry Form */}
          <div className="lg:col-span-7 bg-[#211C1A] border border-[#C6A46A]/25 rounded-md p-6 sm:p-8 luxury-card-shadow">
            {submitted ? (
              <div className="py-8 space-y-4">
                <div className="flex items-center gap-2.5 text-[#86EFAC]">
                  <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                  <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                    {t.contact.successTitle}
                  </h2>
                </div>
                <p className="text-sm text-[#D2C6B5] leading-relaxed">{t.contact.successBody}</p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <a
                    href={whatsappSubmittedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 text-xs font-medium tracking-[0.06em] bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] min-h-[44px] inline-flex items-center"
                  >
                    {t.contact.whatsappBtn}
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setMessage('');
                    }}
                    className="px-5 py-2.5 text-sm font-medium border border-[#C6A46A]/55 text-[#F3EBDD] rounded-md hover:border-[#C6A46A] hover:bg-[#C6A46A]/10 cursor-pointer"
                  >
                    {t.contact.formTitle}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h2 className="font-display text-2xl font-medium text-[#F3EBDD]">
                  {t.contact.formTitle}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="inq-type"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      {t.contact.inquiryType}
                    </label>
                    <select
                      id="inq-type"
                      value={inquiryType}
                      onChange={(e) =>
                        setInquiryType(e.target.value as 'wholesale' | 'export' | 'general')
                      }
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    >
                      <option value="wholesale">{t.contact.typeWholesale}</option>
                      <option value="export">{t.contact.typeExport}</option>
                      <option value="general">{t.contact.typeGeneral}</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="inq-brand"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      {t.contact.brandInterest}
                    </label>
                    <select
                      id="inq-brand"
                      value={brandInterest}
                      onChange={(e) => setBrandInterest(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    >
                      <option value="Ceyvana & Ceylomira">Ceyvana & Ceylomira</option>
                      <option value="Ceyvana Spices">Ceyvana Spices</option>
                      <option value="Ceylomira Tea">Ceylomira Tea</option>
                      <option value="Hand Crafts (Future Launch)">Hand Crafts (Future Launch)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="inq-name"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      {t.contact.fullName} *
                    </label>
                    <input
                      id="inq-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="inq-company"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      {t.contact.company}
                    </label>
                    <input
                      id="inq-company"
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="inq-email"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      {t.contact.email} *
                    </label>
                    <input
                      id="inq-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="inq-phone"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      {t.contact.phone}
                    </label>
                    <input
                      id="inq-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="inq-country"
                      className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                    >
                      {t.contact.country}
                    </label>
                    <input
                      id="inq-country"
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="inq-message"
                    className="block text-xs font-medium text-[#D2C6B5] mb-1.5"
                  >
                    {t.contact.message} *
                  </label>
                  <textarea
                    id="inq-message"
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#2A2522] border border-[#3B332E] text-[#F3EBDD] rounded-md focus:outline-none focus:border-[#C6A46A]"
                  />
                </div>

                <button
                  type="submit"
                  className="px-6 py-3 text-xs font-medium tracking-[0.06em] bg-[#C6A46A] text-[#151312] rounded hover:bg-[#D4B47B] transition-colors cursor-pointer min-h-[44px]"
                >
                  {t.contact.submitBtn}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

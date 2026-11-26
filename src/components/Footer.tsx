import {ArrowUpRight} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {buildWhatsAppLink} from '../utils/currency';
import {buildPagePath} from '../utils/seo';
import BrandLogo from './BrandLogo';

export default function Footer() {
  const {navigate, t, lang, setLang, availableLanguages, commerceConfig} = useStore();
  const whatsappUrl = buildWhatsAppLink(
    lang === 'si'
      ? 'ආයුබෝවන්, Ceylon Heritage නිෂ්පාදන පිළිබඳ විමසීමක් ඇත.'
      : 'Hello Ceylon Heritage Desk, I would like to enquire about your Sri Lankan products.',
    commerceConfig?.whatsappNumber,
  );

  return (
    <footer className="bg-[#0D0C0B] text-[#D2C6B5] border-t border-[#C6A46A]/25">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12 pb-14 border-b border-[#C6A46A]/20">
          <div className="md:col-span-5 space-y-5">
            <div className="space-y-2">
              <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-[#C6A46A]">
                Colombo · Sri Lanka
              </p>
              <p className="font-display text-2xl sm:text-3xl font-medium tracking-[0.14em] text-[#F3EBDD]">
                {t.corporateName}
              </p>
            </div>
            <p className="text-sm text-[#D2C6B5] max-w-md leading-relaxed">{t.footer.tagline}</p>
            <div className="flex flex-wrap items-center gap-5 pt-2">
              <a
                href={buildPagePath('ceyvana', {lang})}
                onClick={(e) => {
                  e.preventDefault();
                  navigate('ceyvana');
                }}
                aria-label={t.nav.ceyvana}
                className="inline-flex rounded focus-visible:outline-none"
              >
                <BrandLogo brandId="ceyvana" size="sm" />
              </a>
              <span className="h-8 w-px bg-[#C6A46A]/30" aria-hidden="true" />
              <a
                href={buildPagePath('ceylomira', {lang})}
                onClick={(e) => {
                  e.preventDefault();
                  navigate('ceylomira');
                }}
                aria-label={t.nav.ceylomira}
                className="inline-flex rounded focus-visible:outline-none"
              >
                <BrandLogo brandId="ceylomira" size="sm" />
              </a>
            </div>
            <div
              className="pt-1 flex flex-wrap items-center gap-2 text-xs"
              role="group"
              aria-label="Language"
            >
              {availableLanguages.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  aria-pressed={lang === item.code}
                  onClick={() => setLang(item.code)}
                  className={`px-3 py-1.5 rounded border transition-colors duration-150 cursor-pointer min-h-[36px] ${
                    lang === item.code
                      ? 'border-[#C6A46A] bg-[#C6A46A]/15 text-[#C6A46A] font-medium'
                      : 'border-[#362F2A] text-[#D2C6B5] hover:text-[#F3EBDD] hover:border-[#C6A46A]/45'
                  }`}
                >
                  {item.nativeLabel}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 space-y-3.5">
            <h2 className="text-xs font-medium tracking-[0.16em] text-[#C6A46A] uppercase">
              {t.footer.brandsTitle}
            </h2>
            <ul className="space-y-2.5 text-sm text-[#D2C6B5]">
              <li>
                <a
                  href={buildPagePath('ceyvana', {lang})}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('ceyvana');
                  }}
                  className="hover:text-[#C6A46A] transition-colors duration-150"
                >
                  {t.nav.ceyvana}
                </a>
              </li>
              <li>
                <a
                  href={buildPagePath('ceylomira', {lang})}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('ceylomira');
                  }}
                  className="hover:text-[#C6A46A] transition-colors duration-150"
                >
                  {t.nav.ceylomira}
                </a>
              </li>
              <li>
                <a
                  href={buildPagePath('hand-crafts', {lang})}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('hand-crafts');
                  }}
                  className="hover:text-[#C6A46A] transition-colors duration-150"
                >
                  {t.nav.handCrafts}
                </a>
              </li>
              <li>
                <a
                  href={buildPagePath('wholesale', {lang})}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('wholesale');
                  }}
                  className="hover:text-[#C6A46A] transition-colors duration-150"
                >
                  {t.nav.wholesale}
                </a>
              </li>
              <li>
                <a
                  href={buildPagePath('portfolio', {lang})}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('portfolio');
                  }}
                  className="hover:text-[#C6A46A] transition-colors duration-150"
                >
                  {t.nav.portfolio}
                </a>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-3.5">
            <h2 className="text-xs font-medium tracking-[0.16em] text-[#C6A46A] uppercase">
              {t.footer.corporateTitle}
            </h2>
            <ul className="space-y-2.5 text-sm text-[#D2C6B5]">
              <li>
                <a
                  href={buildPagePath('about', {lang})}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('about');
                  }}
                  className="hover:text-[#C6A46A] transition-colors duration-150"
                >
                  {t.nav.about}
                </a>
              </li>
              <li>
                <a
                  href={buildPagePath('stories', {lang})}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('stories');
                  }}
                  className="hover:text-[#C6A46A] transition-colors duration-150"
                >
                  {t.nav.stories}
                </a>
              </li>
              <li>
                <a
                  href={buildPagePath('contact', {lang})}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('contact');
                  }}
                  className="hover:text-[#C6A46A] transition-colors duration-150"
                >
                  {t.nav.contact}
                </a>
              </li>
              <li>
                <a
                  href={buildPagePath('privacy', {lang})}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('privacy');
                  }}
                  className="hover:text-[#C6A46A] transition-colors duration-150"
                >
                  {t.nav.privacy}
                </a>
              </li>
              <li>
                <a
                  href={buildPagePath('terms', {lang})}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('terms');
                  }}
                  className="hover:text-[#C6A46A] transition-colors duration-150"
                >
                  {t.nav.terms}
                </a>
              </li>
              <li>
                <a
                  href="/admin"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('admin');
                  }}
                  className="hover:text-[#C6A46A] transition-colors duration-150"
                >
                  Admin Portal
                </a>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-3.5">
            <h2 className="text-xs font-medium tracking-[0.16em] text-[#C6A46A] uppercase">
              {t.footer.connectTitle}
            </h2>
            <ul className="space-y-3 text-sm text-[#D2C6B5]">
              <li>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#F3EBDD] hover:text-[#C6A46A] transition-colors duration-150 border-b border-[#C6A46A]/45 pb-0.5"
                >
                  <span>{t.footer.whatsappLabel}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#C6A46A]" aria-hidden="true" />
                </a>
              </li>
              <li className="font-mono-tabular text-xs text-[#D2C6B5]">{t.footer.emailLabel}</li>
              <li className="text-xs text-[#D2C6B5]">{t.footer.locationLabel}</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#A99B88]">
          <p>{t.footer.copyright}</p>
          <p>{t.footer.phaseNotice}</p>
        </div>
      </div>
    </footer>
  );
}

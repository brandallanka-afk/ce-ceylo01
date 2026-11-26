import {useEffect, useRef, useState} from 'react';
import {ChevronDown, Menu, ShoppingBag, X} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import type {RoutePage} from '../types/commerce';
import {buildPagePath} from '../utils/seo';
import BrandLogo from './BrandLogo';

export default function Navbar() {
  const {
    route,
    navigate,
    lang,
    setLang,
    availableLanguages,
    currency,
    setCurrency,
    availableCurrencies,
    t,
    cartCount,
    setIsCartOpen,
  } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [heritageMenuOpen, setHeritageMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setHeritageMenuOpen(false);
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setHeritageMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, []);

  const handleNav = (page: RoutePage) => {
    setMobileOpen(false);
    setHeritageMenuOpen(false);
    navigate(page);
  };

  const isHeritageActive =
    route.page === 'hand-crafts' ||
    route.page === 'about' ||
    route.page === 'stories' ||
    route.page === 'portfolio';

  return (
    <>
      {/* Deep Obsidian utility bar */}
      <div className="bg-[#0D0C0B] text-[#D2C6B5] text-[11px] border-b border-[#C6A46A]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-between gap-4">
          <p className="truncate hidden sm:block tracking-[0.1em] text-[#D2C6B5]">
            {t.announcement}
          </p>
          <p className="truncate sm:hidden tracking-[0.14em] text-[#C6A46A]">
            Ceyvana · Ceylomira
          </p>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="flex items-center gap-1.5" role="group" aria-label="Language">
              {availableLanguages.map((item) => {
                const active = lang === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setLang(item.code)}
                    className={`px-1.5 py-0.5 text-[11px] tracking-wider transition-colors duration-150 cursor-pointer whitespace-nowrap border-b ${
                      active
                        ? 'border-[#C6A46A] text-[#C6A46A] font-medium'
                        : 'border-transparent text-[#D2C6B5] hover:text-[#F3EBDD]'
                    }`}
                  >
                    {item.shortLabel}
                  </button>
                );
              })}
            </div>
            <span className="text-[#A99B88]" aria-hidden="true">
              /
            </span>
            <div className="flex items-center gap-1.5" role="group" aria-label="Currency">
              {availableCurrencies.length <= 3 ? (
                availableCurrencies.map((c) => {
                  const active = currency === c.code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setCurrency(c.code)}
                      className={`px-1.5 py-0.5 text-[11px] font-mono-tabular transition-colors duration-150 cursor-pointer whitespace-nowrap border-b ${
                        active
                          ? 'border-[#C6A46A] text-[#C6A46A] font-medium'
                          : 'border-transparent text-[#D2C6B5] hover:text-[#F3EBDD]'
                      }`}
                    >
                      {c.code}
                    </button>
                  );
                })
              ) : (
                <select
                  aria-label="Currency Selector"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="bg-[#211C1A] text-[#F3EBDD] font-mono-tabular text-[11px] px-2 py-0.5 rounded border border-[#C6A46A]/35 cursor-pointer"
                >
                  {availableCurrencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Strict 3-zone sticky top navigation bar (64px height) in Royal Charcoal */}
      <header className="sticky top-0 z-40 bg-[#151312]/95 backdrop-blur-md border-b border-[#C6A46A]/25 text-[#F3EBDD]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6 lg:gap-8">
          {/* Zone 1: Architectural brand wordmark */}
          <a
            href={buildPagePath('home', {lang})}
            onClick={(e) => {
              e.preventDefault();
              handleNav('home');
            }}
            aria-current={route.page === 'home' ? 'page' : undefined}
            className="font-display text-lg sm:text-[1.5rem] font-medium tracking-[0.16em] text-[#F3EBDD] whitespace-nowrap shrink-0 hover:text-[#C6A46A] transition-colors duration-150"
          >
            {t.corporateName}
          </a>

          {/* Zone 2: 5 concise single-line links with luxury Houses dropdown */}
          <nav
            className="hidden md:flex items-center gap-6 lg:gap-8 text-[13px] tracking-[0.04em] font-medium text-[#F3EBDD]"
            aria-label="Primary Navigation"
          >
            <a
              href={buildPagePath('ceyvana', {lang})}
              aria-current={route.page === 'ceyvana' ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                handleNav('ceyvana');
              }}
              className={`relative inline-flex items-center gap-2 py-1.5 whitespace-nowrap shrink-0 transition-colors duration-150 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[1.5px] after:w-full after:bg-[#C6A46A] after:transition-transform after:duration-150 after:origin-left ${
                route.page === 'ceyvana'
                  ? 'text-[#C6A46A] after:scale-x-100'
                  : 'text-[#F3EBDD] after:scale-x-0 hover:text-[#C6A46A] hover:after:scale-x-100'
              }`}
            >
              <BrandLogo
                brandId="ceyvana"
                size="2xs"
                eager
                sheen={false}
                className="hidden lg:inline-flex"
              />
              <span>{t.nav.ceyvana}</span>
            </a>

            <a
              href={buildPagePath('ceylomira', {lang})}
              aria-current={route.page === 'ceylomira' ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                handleNav('ceylomira');
              }}
              className={`relative inline-flex items-center gap-2 py-1.5 whitespace-nowrap shrink-0 transition-colors duration-150 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[1.5px] after:w-full after:bg-[#C6A46A] after:transition-transform after:duration-150 after:origin-left ${
                route.page === 'ceylomira'
                  ? 'text-[#C6A46A] after:scale-x-100'
                  : 'text-[#F3EBDD] after:scale-x-0 hover:text-[#C6A46A] hover:after:scale-x-100'
              }`}
            >
              <BrandLogo
                brandId="ceylomira"
                size="2xs"
                eager
                sheen={false}
                className="hidden lg:inline-flex"
              />
              <span>{t.nav.ceylomira}</span>
            </a>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-expanded={heritageMenuOpen}
                aria-haspopup="true"
                onClick={() => setHeritageMenuOpen((v) => !v)}
                className={`relative inline-flex items-center gap-1 py-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[1.5px] after:w-full after:bg-[#C6A46A] after:transition-transform after:duration-150 after:origin-left ${
                  isHeritageActive || heritageMenuOpen
                    ? 'text-[#C6A46A] after:scale-x-100'
                    : 'text-[#F3EBDD] after:scale-x-0 hover:text-[#C6A46A] hover:after:scale-x-100'
                }`}
              >
                <span>{lang === 'si' ? 'උරුමය සහ නාමාවලි' : 'Heritage & Dossiers'}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#C6A46A] transition-transform duration-150 ${
                    heritageMenuOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {heritageMenuOpen && (
                <div
                  className="absolute left-0 top-full mt-3 w-72 bg-[#211C1A] text-[#F3EBDD] border border-[#C6A46A]/35 rounded shadow-2xl p-2 z-50"
                  role="menu"
                >
                  <div className="px-3 py-2 border-b border-[#C6A46A]/20">
                    <p className="text-[11px] tracking-[0.16em] uppercase text-[#C6A46A] font-medium">
                      Ceylon Heritage House
                    </p>
                  </div>
                  <div className="py-1.5 space-y-0.5">
                    <a
                      href={buildPagePath('portfolio', {lang})}
                      role="menuitem"
                      onClick={(e) => {
                        e.preventDefault();
                        handleNav('portfolio');
                      }}
                      className="block px-3 py-2.5 rounded hover:bg-[#2A2522] transition-colors duration-150"
                    >
                      <span className="block text-xs font-medium text-[#F3EBDD]">
                        {t.nav.portfolio}
                      </span>
                      <span className="block text-[11px] text-[#A99B88] mt-0.5">
                        {lang === 'si'
                          ? 'නිල PDF නිෂ්පාදන නාමාවලි'
                          : 'Official brand PDF catalogues'}
                      </span>
                    </a>
                    <a
                      href={buildPagePath('hand-crafts', {lang})}
                      role="menuitem"
                      onClick={(e) => {
                        e.preventDefault();
                        handleNav('hand-crafts');
                      }}
                      className="block px-3 py-2.5 rounded hover:bg-[#2A2522] transition-colors duration-150"
                    >
                      <span className="block text-xs font-medium text-[#F3EBDD]">
                        {t.nav.handCrafts}
                      </span>
                      <span className="block text-[11px] text-[#C6A46A] mt-0.5">
                        {t.home.comingSoon} · Woodwork & Handloom
                      </span>
                    </a>
                    <a
                      href={buildPagePath('about', {lang})}
                      role="menuitem"
                      onClick={(e) => {
                        e.preventDefault();
                        handleNav('about');
                      }}
                      className="block px-3 py-2.5 rounded hover:bg-[#2A2522] transition-colors duration-150"
                    >
                      <span className="block text-xs font-medium text-[#F3EBDD]">{t.nav.about}</span>
                      <span className="block text-[11px] text-[#A99B88] mt-0.5">
                        {lang === 'si' ? 'ආයතනික උරුමය සහ ප්‍රමිතිය' : 'Origin stewardship & quality'}
                      </span>
                    </a>
                    <a
                      href={buildPagePath('stories', {lang})}
                      role="menuitem"
                      onClick={(e) => {
                        e.preventDefault();
                        handleNav('stories');
                      }}
                      className="block px-3 py-2.5 rounded hover:bg-[#2A2522] transition-colors duration-150"
                    >
                      <span className="block text-xs font-medium text-[#F3EBDD]">
                        {t.nav.stories}
                      </span>
                      <span className="block text-[11px] text-[#A99B88] mt-0.5">
                        {lang === 'si' ? 'වතු යායෙන් ක්ෂේත්‍ර සටහන්' : 'Harvest & craft dispatches'}
                      </span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            <a
              href={buildPagePath('wholesale', {lang})}
              aria-current={route.page === 'wholesale' ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                handleNav('wholesale');
              }}
              className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors duration-150 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[1.5px] after:w-full after:bg-[#C6A46A] after:transition-transform after:duration-150 after:origin-left ${
                route.page === 'wholesale'
                  ? 'text-[#C6A46A] after:scale-x-100'
                  : 'text-[#F3EBDD] after:scale-x-0 hover:text-[#C6A46A] hover:after:scale-x-100'
              }`}
            >
              {t.nav.wholesale}
            </a>

            <a
              href={buildPagePath('contact', {lang})}
              aria-current={route.page === 'contact' ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                handleNav('contact');
              }}
              className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors duration-150 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[1.5px] after:w-full after:bg-[#C6A46A] after:transition-transform after:duration-150 after:origin-left ${
                route.page === 'contact'
                  ? 'text-[#C6A46A] after:scale-x-100'
                  : 'text-[#F3EBDD] after:scale-x-0 hover:text-[#C6A46A] hover:after:scale-x-100'
              }`}
            >
              {t.nav.contact}
            </a>
          </nav>

          {/* Zone 3: Cart CTA + Mobile Menu Toggle */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              aria-label={`${t.nav.cart} (${cartCount})`}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-medium tracking-wider text-[#F3EBDD] bg-transparent border border-[#C6A46A]/55 rounded hover:border-[#C6A46A] hover:bg-[#C6A46A]/10 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 min-h-[44px]"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#C6A46A]" aria-hidden="true" />
              <span>{t.nav.cart}</span>
              <span className="font-mono-tabular text-[#C6A46A] font-medium">({cartCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileOpen}
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded border border-[#C6A46A]/45 text-[#F3EBDD] bg-[#211C1A] hover:border-[#C6A46A] transition-colors duration-150 cursor-pointer"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile navigation drawer */}
        {mobileOpen && (
          <nav
            className="md:hidden bg-[#211C1A] border-t border-[#C6A46A]/25 px-4 py-5 space-y-1 shadow-2xl"
            aria-label="Mobile Navigation"
          >
            {(
              [
                {page: 'home', label: t.nav.home},
                {page: 'ceyvana', label: t.nav.ceyvana, brandId: 'ceyvana' as const},
                {page: 'ceylomira', label: t.nav.ceylomira, brandId: 'ceylomira' as const},
                {page: 'hand-crafts', label: t.nav.handCrafts},
                {page: 'portfolio', label: t.nav.portfolio},
              ] as {page: RoutePage; label: string; brandId?: 'ceyvana' | 'ceylomira'}[]
            ).map((item) => (
              <a
                key={item.page}
                href={buildPagePath(item.page, {lang})}
                aria-current={route.page === item.page ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  handleNav(item.page);
                }}
                className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded text-sm font-medium min-h-[44px] ${
                  route.page === item.page
                    ? 'bg-[#2A2522] text-[#C6A46A] border border-[#C6A46A]/35'
                    : 'text-[#F3EBDD] hover:bg-[#2A2522]/75 hover:text-[#C6A46A]'
                }`}
              >
                <span>{item.label}</span>
                {item.brandId && (
                  <BrandLogo brandId={item.brandId} size="xs" eager sheen={false} />
                )}
              </a>
            ))}
            <div className="pt-2 mt-2 border-t border-[#C6A46A]/20 space-y-1">
              {(
                [
                  {page: 'wholesale', label: t.nav.wholesale},
                  {page: 'about', label: t.nav.about},
                  {page: 'stories', label: t.nav.stories},
                  {page: 'contact', label: t.nav.contact},
                ] as {page: RoutePage; label: string}[]
              ).map((item) => (
                <a
                  key={item.page}
                  href={buildPagePath(item.page, {lang})}
                  aria-current={route.page === item.page ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNav(item.page);
                  }}
                  className={`block px-3.5 py-3 rounded text-sm font-medium min-h-[44px] ${
                    route.page === item.page
                      ? 'bg-[#2A2522] text-[#C6A46A] border border-[#C6A46A]/35'
                      : 'text-[#F3EBDD] hover:bg-[#2A2522]/75 hover:text-[#C6A46A]'
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>
    </>
  );
}

import type {SiteLanguageConfig} from '../types/admin';
import type {LanguageCode, LocalizedText} from '../types/commerce';
import {translations} from './translations';

export interface LanguageOption {
  code: LanguageCode;
  shortLabel: string;
  nativeLabel: string;
}

export type TranslationShape = (typeof translations)['en'];

/**
 * Language Registry — default English and Sinhala with an extensible 3rd language slot
 * that can be activated via siteSettings.enabledLanguages or translations.ts without rebuilding UI components.
 */
export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {code: 'en', shortLabel: 'EN', nativeLabel: 'English'},
  {code: 'si', shortLabel: 'සිංහල', nativeLabel: 'සිංහල'},
];

const dynamicLanguagePacks: Record<string, TranslationShape> = {};

export function registerLanguagePack(
  code: string,
  overrides: Partial<TranslationShape>,
): void {
  const cleanCode = code.trim().toLowerCase();
  if (!cleanCode) return;
  dynamicLanguagePacks[cleanCode] = {
    ...translations.en,
    ...overrides,
  };
}

export function resolveActiveLanguages(
  configured?: SiteLanguageConfig[] | null,
): LanguageOption[] {
  if (!configured || configured.length === 0) {
    return SUPPORTED_LANGUAGES;
  }
  const active = configured
    .filter((item) => item.enabled && item.code)
    .map((item) => ({
      code: item.code,
      shortLabel: item.shortLabel || item.code.toUpperCase(),
      nativeLabel: item.nativeLabel || item.code.toUpperCase(),
    }));
  return active.length > 0 ? active : SUPPORTED_LANGUAGES;
}

export function getLocalizedText(text: LocalizedText, lang: LanguageCode): string {
  return text[lang] || text.en;
}

export function getTranslations(lang: LanguageCode): TranslationShape {
  if (lang === 'si') return translations.si;
  if (lang === 'en') return translations.en;
  return dynamicLanguagePacks[lang] ?? translations[lang] ?? translations.en;
}

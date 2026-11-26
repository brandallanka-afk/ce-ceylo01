import type {FirebaseApp} from 'firebase/app';
import {
  getToken,
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from 'firebase/app-check';

let appCheckInstance: AppCheck | null = null;

export function initOptionalAppCheck(app: FirebaseApp): AppCheck | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const siteKey = (import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim();
  if (!siteKey) {
    return null;
  }
  if (appCheckInstance) {
    return appCheckInstance;
  }
  try {
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    return appCheckInstance;
  } catch {
    return null;
  }
}

export function isClientAppCheckActive(): boolean {
  return Boolean(appCheckInstance);
}

export async function getAppCheckTokenHeader(): Promise<Record<string, string>> {
  if (!appCheckInstance) {
    return {};
  }
  try {
    const result = await getToken(appCheckInstance, false);
    return result.token ? {'X-Firebase-AppCheck': result.token} : {};
  } catch {
    return {};
  }
}

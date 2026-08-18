import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';

// Indonesian is the default language and ships eagerly in the main bundle,
// so the first paint never waits for a network fetch. English locale files
// are loaded lazily, one chunk per locale and namespace.
import idCommon from './locales/id/common.json';
import idCanvas from './locales/id/canvas.json';

export const LANGUAGE_STORAGE_KEY = 'stemmagraph.language';
export const SUPPORTED_LANGUAGES = ['id', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const isAppLanguage = (value: string | null): value is AppLanguage =>
  value === 'id' || value === 'en';

const readStoredLanguage = (): AppLanguage => {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isAppLanguage(stored)) return stored;
  } catch {
    // localStorage can be blocked (private mode, disabled storage); keep default
  }
  return 'id';
};

export const i18n = createInstance();

void i18n
  .use(initReactI18next)
  .use(
    resourcesToBackend((language: string, namespace: string) =>
      import(`./locales/${language}/${namespace}.json`)
    )
  )
  .init({
    lng: readStoredLanguage(),
    supportedLngs: ['id', 'en'],
    fallbackLng: 'id',
    fallbackNS: 'common',
    defaultNS: 'common',
    // Namespaces load on demand; components opt in with useTranslation('canvas')
    ns: [],
    partialBundledLanguages: true,
    returnEmptyString: false,
    resources: {
      id: {
        common: idCommon,
        canvas: idCanvas,
      },
    },
    interpolation: {
      // React already escapes rendered strings
      escapeValue: false,
    },
    react: {
      // ID fallback strings are bundled, so t() always resolves synchronously
      // and the UI swaps in place once a lazy locale chunk arrives.
      useSuspense: false,
    },
  });

// Date rendering in scope components uses the active language, mirroring the
// original 'id-ID' formatting for Indonesian.
export const formatDate = (
  value: string | number | Date,
  language: string
): string =>
  new Intl.DateTimeFormat(
    language === 'en' ? 'en-US' : 'id-ID',
    { day: 'numeric', month: 'short', year: 'numeric' }
  ).format(new Date(value));

export const changeAppLanguage = (language: AppLanguage): Promise<void> =>
  i18n.changeLanguage(language).then(() => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // persistence is best effort; the switch itself already succeeded
    }
    document.documentElement.lang = language;
  });

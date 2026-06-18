import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import ja from './locales/ja.json';
import en from './locales/en.json';

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    resources: {
      ja: { translation: ja },
      en: { translation: en },
    },
    lng: Localization.getLocales()?.[0]?.languageCode ?? 'ja',
    fallbackLng: 'ja',
    interpolation: { escapeValue: false },
  });

export default i18n;

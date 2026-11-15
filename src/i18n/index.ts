import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import vi from "./locales/vi.json";

/**
 * UI copy lives only in `locales/vi.json`. Keys are English and grouped by feature. The app ships
 * Vietnamese only, so `vi` is both the language and the fallback.
 *
 * Inline resources make initialisation synchronous, so `t()` works at import time as well as in render.
 */
void i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi } },
  lng: "vi",
  fallbackLng: "vi",
  // React escapes output already; escaping again would turn "&" in a company name into "&amp;".
  interpolation: { escapeValue: false },
  // No Suspense boundary in the app, and resources are bundled, so never suspend.
  react: { useSuspense: false },
});

export default i18n;

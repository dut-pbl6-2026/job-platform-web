import "i18next";
import type vi from "./locales/vi.json";

// Types the keys from the Vietnamese resource file: a typo or a missing key fails `tsc -b`.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof vi };
  }
}

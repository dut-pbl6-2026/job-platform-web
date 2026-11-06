import { defineConfig } from "@playwright/test";

// Dedicated port: never reuse a dev server that may run without mocks or against a real backend.
const PORT = 5179;

/**
 * Viewport screenshots for design review (`npm run shots`). Real viewport emulation, so the 390px
 * project lays out at 390px (headless Chrome alone falls back to ~504px on this machine).
 * The app runs with VITE_ENABLE_MOCKS=true and every /api call is cut off in the specs, so the
 * screens need no backend and show the same mock data on every machine.
 */
export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: { VITE_ENABLE_MOCKS: "true" },
    timeout: 60_000,
  },
  projects: [
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
    { name: "laptop-1280", use: { viewport: { width: 1280, height: 800 } } },
    { name: "wide-1600", use: { viewport: { width: 1600, height: 900 } } },
    {
      name: "mobile-390",
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
    },
  ],
});

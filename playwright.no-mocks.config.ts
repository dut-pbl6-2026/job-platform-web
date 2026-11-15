import { defineConfig } from "@playwright/test";

// Second suite, run by `npm run e2e:no-mocks`: the app without VITE_ENABLE_MOCKS, so the specs can check
// that no mock data is rendered when the API answers. Its own port, never shared with the mocked suite.
const PORT = 5180;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/mock-gating.spec.ts",
  outputDir: "test-results",
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: { VITE_ENABLE_MOCKS: "false" },
    timeout: 60_000,
  },
});

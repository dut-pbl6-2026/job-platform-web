import { expect, test, type Page } from "@playwright/test";

/**
 * Token refresh on 401 (src/lib/api.ts). The access token "old-access" is rejected by /auth/me, so
 * the interceptor refreshes. Only a rejected refresh (401/403) may end the session.
 */

const ME = {
  id: "e2e-user",
  email: "user@e2e.local",
  fullName: "Người dùng thử",
  role: "User",
  isActive: true,
};

async function seedTokens(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("accessToken", "old-access");
    localStorage.setItem("refreshToken", "old-refresh");
  });
}

/** /auth/me accepts only the new access token; the old one gets 401 and forces a refresh. */
async function mockMe(page: Page) {
  const authHeaders: string[] = [];
  await page.route("**/api/auth/me", (route) => {
    const auth = route.request().headers()["authorization"] ?? "";
    authHeaders.push(auth);
    if (auth === "Bearer new-access") route.fulfill({ json: ME });
    else route.fulfill({ status: 401, json: { message: "expired" } });
  });
  return authHeaders;
}

test.describe("refresh failures", () => {
  test("429 on refresh keeps the session and the original request is retried after it succeeds", async ({ page }) => {
    await seedTokens(page);
    const authHeaders = await mockMe(page);
    let refreshCalls = 0;
    await page.route("**/api/auth/refresh", (route) => {
      refreshCalls += 1;
      if (refreshCalls === 1) {
        route.fulfill({ status: 429, headers: { "Retry-After": "0" }, json: { message: "rate limited" } });
      } else {
        route.fulfill({ json: { accessToken: "new-access", refreshToken: "new-refresh" } });
      }
    });

    await page.goto("/");

    await expect.poll(() => authHeaders.includes("Bearer new-access")).toBe(true);
    expect(refreshCalls).toBe(2);
    // Retried with the refreshed token, and the stored tokens are the new pair.
    expect(authHeaders[0]).toBe("Bearer old-access");
    const stored = await page.evaluate(() => ({
      access: localStorage.getItem("accessToken"),
      refresh: localStorage.getItem("refreshToken"),
    }));
    expect(stored).toEqual({ access: "new-access", refresh: "new-refresh" });
  });

  test("429 that never clears keeps the tokens in storage", async ({ page }) => {
    await seedTokens(page);
    await mockMe(page);
    let refreshCalls = 0;
    await page.route("**/api/auth/refresh", (route) => {
      refreshCalls += 1;
      route.fulfill({ status: 429, headers: { "Retry-After": "0" }, json: { message: "rate limited" } });
    });

    await page.goto("/");

    await expect.poll(() => refreshCalls).toBe(3);
    const stored = await page.evaluate(() => ({
      access: localStorage.getItem("accessToken"),
      refresh: localStorage.getItem("refreshToken"),
    }));
    expect(stored).toEqual({ access: "old-access", refresh: "old-refresh" });
  });

  test("401 on refresh ends the session and clears the tokens", async ({ page }) => {
    await seedTokens(page);
    await mockMe(page);
    let refreshCalls = 0;
    await page.route("**/api/auth/refresh", (route) => {
      refreshCalls += 1;
      route.fulfill({ status: 401, json: { message: "invalid refresh token" } });
    });

    await page.goto("/");

    await expect.poll(() => refreshCalls).toBe(1);
    await expect
      .poll(() => page.evaluate(() => [localStorage.getItem("accessToken"), localStorage.getItem("refreshToken")]))
      .toEqual([null, null]);
  });
});

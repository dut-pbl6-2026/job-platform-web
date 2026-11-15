import { expect, test, type Page } from "@playwright/test";

async function offlineBackend(page: Page) {
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
}

test.describe("registration and email verification", () => {
  test("registration answers 202: no session is stored, the notice is shown on login", async ({ page }) => {
    await offlineBackend(page);
    const logins: string[] = [];
    await page.route("**/api/auth/login", (route) => {
      logins.push(route.request().url());
      route.fulfill({ status: 500, json: { message: "must not be called" } });
    });
    let registerBody: Record<string, unknown> | null = null;
    await page.route("**/api/auth/register", (route) => {
      registerBody = route.request().postDataJSON();
      route.fulfill({ status: 202, json: { message: "Verification email sent." } });
    });
    await page.goto("/register");

    await page.getByRole("button", { name: "Ứng viên", exact: true }).click();
    await page.getByLabel("Họ và tên").fill("Nguyễn Văn An");
    await page.getByLabel("Email").fill("an@e2e.local");
    await page.locator("#reg-pwd").fill("Passw0rd!e2e");
    await page.locator("#reg-confirm").fill("Passw0rd!e2e");
    await page.getByRole("button", { name: "Đăng ký ứng viên" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Check your email to verify your account.")).toBeVisible();
    expect(registerBody).toMatchObject({ email: "an@e2e.local", role: "User" });
    // No tokens and no user id from the 202 response: nothing is stored and nothing is logged in.
    const stored = await page.evaluate(() => ({
      access: localStorage.getItem("accessToken"),
      refresh: localStorage.getItem("refreshToken"),
    }));
    expect(stored).toEqual({ access: null, refresh: null });
    expect(logins).toHaveLength(0);
  });

  test("verify-email with a valid token shows success and a link to login", async ({ page }) => {
    await offlineBackend(page);
    const bodies: unknown[] = [];
    await page.route("**/api/auth/verify-email", (route) => {
      bodies.push(route.request().postDataJSON());
      route.fulfill({ status: 200, json: { message: "Email verified." } });
    });
    await page.goto("/verify-email?token=valid-token-e2e");

    await expect(page.getByText("Your email has been verified.")).toBeVisible();
    await expect(page.getByRole("link", { name: "log in" })).toHaveAttribute("href", "/login");
    expect(bodies).toEqual([{ token: "valid-token-e2e" }]);
  });

  test("verify-email sends the token once even though StrictMode runs effects twice", async ({ page }) => {
    await offlineBackend(page);
    let calls = 0;
    await page.route("**/api/auth/verify-email", (route) => {
      calls += 1;
      route.fulfill({ status: calls === 1 ? 200 : 400, json: { message: "x" } });
    });
    await page.goto("/verify-email?token=once-e2e");

    await expect(page.getByText("Your email has been verified.")).toBeVisible();
    await page.waitForTimeout(300);
    expect(calls).toBe(1);
    await expect(page.getByText("This verification link is invalid")).toHaveCount(0);
  });

  test("verify-email with an invalid, expired or used token (400) shows a message and a link back to login", async ({ page }) => {
    await offlineBackend(page);
    await page.route("**/api/auth/verify-email", (route) =>
      route.fulfill({ status: 400, json: { title: "Bad Request", detail: "Token expired" } }),
    );
    await page.goto("/verify-email?token=expired-e2e");

    await expect(page.getByText("This verification link is invalid, has expired or has already been used.")).toBeVisible();
    await expect(page.getByText("Your email has been verified.")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back to login" }).first()).toHaveAttribute("href", "/login");
  });

  test("verify-email without a token shows the invalid-link message and sends nothing", async ({ page }) => {
    await offlineBackend(page);
    let calls = 0;
    await page.route("**/api/auth/verify-email", (route) => {
      calls += 1;
      route.fulfill({ status: 400, json: {} });
    });
    await page.goto("/verify-email");

    await expect(page.getByText("This verification link is invalid")).toBeVisible();
    expect(calls).toBe(0);
  });

  test("login 401 shows one message covering wrong password and unverified account", async ({ page }) => {
    await offlineBackend(page);
    await page.route("**/api/auth/login", (route) => route.fulfill({ status: 401, json: { title: "Unauthorized" } }));
    await page.goto("/login");

    await page.getByLabel("Email").fill("an@e2e.local");
    await page.locator("#login-pwd").fill("wrong-password");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page.getByRole("alert")).toHaveText("Check your credentials or verify your email");
    expect(await page.evaluate(() => localStorage.getItem("accessToken"))).toBeNull();
  });
});

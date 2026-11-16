import { expect, test, type Page } from "@playwright/test";

const SENT = "Nếu email này đang chờ xác minh, một liên kết mới đã được gửi.";
const RATE_LIMITED = "Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.";
const RESEND_BUTTON = /^Gửi lại email xác minh$/;
const COOLING_BUTTON = /^Gửi lại sau \d+ giây$/;

async function offlineBackend(page: Page) {
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
}

/** Registers an account (202) and lands on the login page with the "check your email" notice. */
async function registerAndWaitForNotice(page: Page) {
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({ status: 202, json: { message: "Verification email sent." } }),
  );
  await page.goto("/register");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByLabel("Họ và tên").fill("Nguyễn Văn An");
  await page.getByRole("textbox", { name: "Email" }).fill("an@e2e.local");
  await page.locator("#reg-pwd").fill("Passw0rd!e2e");
  await page.locator("#reg-confirm").fill("Passw0rd!e2e");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("button", { name: "Đăng ký ứng viên" }).click();
  await expect(page.getByText("Kiểm tra email để xác minh tài khoản của bạn.")).toBeVisible();
}

test.describe("resend verification email", () => {
  test("202 shows the generic message and starts the 60-second cooldown", async ({ page }) => {
    await offlineBackend(page);
    await registerAndWaitForNotice(page);
    const bodies: unknown[] = [];
    await page.route("**/api/auth/resend-verification", (route) => {
      bodies.push(route.request().postDataJSON());
      route.fulfill({ status: 202, json: { message: "If this email is awaiting verification, a new link was sent." } });
    });

    await page.getByRole("button", { name: RESEND_BUTTON }).click();

    await expect(page.getByText(SENT)).toBeVisible();
    await expect(page.getByRole("button", { name: COOLING_BUTTON })).toBeDisabled();
    expect(bodies).toEqual([{ email: "an@e2e.local" }]);
  });

  test("429 shows the rate-limit message and leaves the button enabled", async ({ page }) => {
    await offlineBackend(page);
    await registerAndWaitForNotice(page);
    await page.route("**/api/auth/resend-verification", (route) =>
      route.fulfill({ status: 429, json: { title: "Too Many Requests" } }),
    );

    await page.getByRole("button", { name: RESEND_BUTTON }).click();

    await expect(page.getByRole("alert")).toHaveText(RATE_LIMITED);
    await expect(page.getByRole("button", { name: RESEND_BUTTON })).toBeEnabled();
    await expect(page.getByText(SENT)).toHaveCount(0);
  });

  test("a second click during the cooldown is disabled and sends nothing", async ({ page }) => {
    await offlineBackend(page);
    await registerAndWaitForNotice(page);
    let calls = 0;
    await page.route("**/api/auth/resend-verification", (route) => {
      calls += 1;
      route.fulfill({ status: 202, json: { message: "ok" } });
    });

    await page.getByRole("button", { name: RESEND_BUTTON }).click();
    const cooling = page.getByRole("button", { name: COOLING_BUTTON });
    await expect(cooling).toBeDisabled();
    await cooling.click({ force: true });
    await page.waitForTimeout(300);

    expect(calls).toBe(1);
  });

  test("verify-email page asks for the address and sends it", async ({ page }) => {
    await offlineBackend(page);
    await page.route("**/api/auth/verify-email", (route) =>
      route.fulfill({
        status: 422,
        json: { title: "Invalid verification token", errorCode: "VERIFICATION_TOKEN_INVALID" },
      }),
    );
    const bodies: unknown[] = [];
    await page.route("**/api/auth/resend-verification", (route) => {
      bodies.push(route.request().postDataJSON());
      route.fulfill({ status: 202, json: { message: "ok" } });
    });
    await page.goto("/verify-email?token=expired-resend-e2e");

    await expect(page.getByText("Liên kết xác minh này không hợp lệ")).toBeVisible();
    await page.getByRole("textbox", { name: "Email" }).fill("an@e2e.local");
    await page.getByRole("button", { name: RESEND_BUTTON }).click();

    await expect(page.getByText(SENT)).toBeVisible();
    expect(bodies).toEqual([{ email: "an@e2e.local" }]);
  });
});

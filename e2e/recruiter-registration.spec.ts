import { expect, test, type Page } from "@playwright/test";

/**
 * Recruiter registration with an invite code (AUTH-01-06, AUTH-01-09, AUTH-01-15).
 *
 * The code is bound to one email address, and the account email field plays that part: auth-svc
 * forwards the same address to job-svc check and redeem, so the two cannot differ. An invited
 * recruiter is active at once and gets no verification email.
 */

async function offlineBackend(page: Page) {
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
}

async function fillRecruiterForm(page: Page, code: string, email = "tuyen@e2e.local") {
  await page.goto("/register");
  await page.getByRole("radio", { name: /Nhà tuyển dụng/ }).click();
  await page.getByLabel("Mã mời của công ty").fill(code);
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByLabel("Họ và tên").fill("Trần Văn Tuyển");
  await page.getByLabel("Email nhận mã mời").fill(email);
  await page.locator("#reg-pwd").fill("Passw0rd!e2e");
  await page.locator("#reg-confirm").fill("Passw0rd!e2e");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
}

test.describe("recruiter registration with an invite code", () => {
  test("a missing or short code is rejected before any request", async ({ page }) => {
    await offlineBackend(page);
    const requests: string[] = [];
    await page.route("**/api/auth/register", (route) => {
      requests.push(route.request().url());
      route.fulfill({ status: 202, json: { message: "must not be called" } });
    });
    await page.goto("/register");
    await page.getByRole("radio", { name: /Nhà tuyển dụng/ }).click();

    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await expect(page.getByText("Hãy nhập mã mời của công ty.")).toBeVisible();
    await expect(page.locator("#reg-invite")).toBeFocused();

    // A code with the wrong length never leaves the browser either.
    await page.getByLabel("Mã mời của công ty").fill("ABCD-EFGH");
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await expect(page.getByText("Mã mời không hợp lệ, đã dùng hoặc đã hết hạn.")).toBeVisible();
    expect(requests).toHaveLength(0);
  });

  test("the code is normalised and sent with the account email, then login asks to sign in", async ({ page }) => {
    await offlineBackend(page);
    let body: Record<string, unknown> | null = null;
    await page.route("**/api/auth/register", (route) => {
      body = route.request().postDataJSON();
      route.fulfill({ status: 202, json: { message: "ok" } });
    });
    // Lower case and dashes are accepted on input, the API takes the 12 characters only.
    await fillRecruiterForm(page, "abcd-efgh-jkmn");
    await page.getByRole("button", { name: "Đăng ký nhà tuyển dụng" }).click();

    await expect(page).toHaveURL(/\/login$/);
    expect(body).toEqual({
      email: "tuyen@e2e.local",
      password: "Passw0rd!e2e",
      fullName: "Trần Văn Tuyển",
      role: "Recruiter",
      inviteCode: "ABCDEFGHJKMN",
    });
    // An invited recruiter is active at once: no verification mail, so no "check your email".
    await expect(page.getByText("Tài khoản nhà tuyển dụng đã sẵn sàng. Hãy đăng nhập.")).toBeVisible();
    await expect(page.getByText("Kiểm tra email để xác minh tài khoản của bạn.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Gửi lại email xác minh/ })).toHaveCount(0);
  });

  test("a used, expired or mismatched code (422) is reported on the code field", async ({ page }) => {
    await offlineBackend(page);
    await page.route("**/api/auth/register", (route) =>
      route.fulfill({
        status: 422,
        json: { title: "Invalid invite code", detail: "Invite code is invalid.", errorCode: "INVITE_CODE_INVALID" },
      }),
    );
    await fillRecruiterForm(page, "ABCD-EFGH-JKMN");
    await page.getByRole("button", { name: "Đăng ký nhà tuyển dụng" }).click();

    await expect(page.getByText("Mã mời không hợp lệ, đã dùng hoặc đã hết hạn.")).toBeVisible();
    // The form keeps what was typed, so the code can be corrected without re-entering everything.
    await expect(page.getByLabel("Mã mời của công ty")).toHaveValue("ABCD-EFGH-JKMN");
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await expect(page.getByLabel("Email nhận mã mời")).toHaveValue("tuyen@e2e.local");
    await expect(page).toHaveURL(/\/register$/);
  });

  test("job-svc unreachable (503) shows a retry message instead of blaming the code", async ({ page }) => {
    await offlineBackend(page);
    await page.route("**/api/auth/register", (route) =>
      route.fulfill({ status: 503, json: { message: "Invite service unavailable." } }),
    );
    await fillRecruiterForm(page, "ABCD-EFGH-JKMN");
    await page.getByRole("button", { name: "Đăng ký nhà tuyển dụng" }).click();

    await expect(page.getByText("Chưa kiểm tra được mã mời. Vui lòng thử lại sau.")).toBeVisible();
    await expect(page.getByText("Mã mời không hợp lệ, đã dùng hoặc đã hết hạn.")).toHaveCount(0);
  });
});

import { expect, test, type Page } from "@playwright/test";

const ACCEPTED = "Kiểm tra email để tiếp tục đăng ký công ty.";

async function offlineBackend(page: Page) {
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
}

async function fillForm(page: Page) {
  await page.getByLabel("Họ và tên người đại diện").fill("Trần Thị Quản Trị");
  await page.getByLabel("Tên công ty").fill("Công ty TNHH Một Thành Viên");
  await page.getByLabel(/^Mã số thuế/).fill("0312345678");
  await page.getByLabel("Email công ty").fill("admin@congty.test");
  await page.locator("#company-pwd").fill("Passw0rd!e2e");
  await page.locator("#company-confirm").fill("Passw0rd!e2e");
}

test("company sign-up sends the payload and shows one neutral copy", async ({ page }) => {
  await offlineBackend(page);
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/auth/register-company", (route) => {
    bodies.push(route.request().postDataJSON());
    // 202 for a new sign-up, an existing email, a taken name or a join-request routing alike.
    route.fulfill({ status: 202, json: { message: "Check your email to continue the company sign-up." } });
  });
  await page.goto("/register-company");
  await fillForm(page);

  await page.getByRole("button", { name: "Đăng ký công ty" }).click();

  await expect(page.getByText(ACCEPTED)).toBeVisible();
  // The copy reveals neither a new sign-up nor an existing account.
  await expect(page.getByText(/đã được đăng ký|đã tồn tại/i)).toHaveCount(0);
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toEqual({
    companyName: "Công ty TNHH Một Thành Viên",
    taxCode: "0312345678",
    email: "admin@congty.test",
    password: "Passw0rd!e2e",
    fullName: "Trần Thị Quản Trị",
  });
});

test("company sign-up omits an empty tax code", async ({ page }) => {
  await offlineBackend(page);
  let body: Record<string, unknown> | null = null;
  await page.route("**/api/auth/register-company", (route) => {
    body = route.request().postDataJSON();
    route.fulfill({ status: 202, json: { message: "accepted" } });
  });
  await page.goto("/register-company");
  await page.getByLabel("Họ và tên người đại diện").fill("Trần Thị Quản Trị");
  await page.getByLabel("Tên công ty").fill("Công ty Không Thuế");
  await page.getByLabel("Email công ty").fill("admin@congty.test");
  await page.locator("#company-pwd").fill("Passw0rd!e2e");
  await page.locator("#company-confirm").fill("Passw0rd!e2e");
  await page.getByRole("button", { name: "Đăng ký công ty" }).click();

  await expect(page.getByText(ACCEPTED)).toBeVisible();
  expect(body).not.toBeNull();
  expect(body as Record<string, unknown>).not.toHaveProperty("taxCode");
});

test("a free public email domain (422 WORK_EMAIL_REQUIRED) is reported on the email field", async ({ page }) => {
  await offlineBackend(page);
  await page.route("**/api/auth/register-company", (route) =>
    route.fulfill({
      status: 422,
      json: {
        title: "Work email required",
        detail: "A work email address is required.",
        errorCode: "WORK_EMAIL_REQUIRED",
      },
    }),
  );
  await page.goto("/register-company");
  await fillForm(page);
  await page.getByLabel("Email công ty").fill("someone@gmail.com");

  await page.getByRole("button", { name: "Đăng ký công ty" }).click();

  await expect(page.getByText("Cần email công ty, không dùng email cá nhân như Gmail, Yahoo, Outlook.")).toBeVisible();
  await expect(page.getByText(ACCEPTED)).toHaveCount(0);
});

test("a job-svc lookup failure (503) is retryable and stores nothing on the first try", async ({ page }) => {
  await offlineBackend(page);
  let calls = 0;
  await page.route("**/api/auth/register-company", (route) => {
    calls += 1;
    if (calls === 1) route.fulfill({ status: 503, json: { title: "Service unavailable" } });
    else route.fulfill({ status: 202, json: { message: "accepted" } });
  });
  await page.goto("/register-company");
  await fillForm(page);

  await page.getByRole("button", { name: "Đăng ký công ty" }).click();
  await expect(page.getByText("Chưa gửi được đăng ký công ty vì dịch vụ tạm thời không phản hồi.")).toBeVisible();

  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByText(ACCEPTED)).toBeVisible();
  expect(calls).toBe(2);
});

test("the candidate sign-up screen links to company sign-up", async ({ page }) => {
  await offlineBackend(page);
  await page.goto("/register");
  await page.getByRole("link", { name: "Đăng ký công ty" }).click();
  await expect(page).toHaveURL(/\/register-company$/);
  await expect(page.getByRole("heading", { name: "Đăng ký công ty" })).toBeVisible();
});

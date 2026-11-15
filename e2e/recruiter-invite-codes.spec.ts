import { expect, test, type Page } from "@playwright/test";

const COMPANY_ID = "33333333-3333-3333-3333-333333333333";

async function offlineBackend(page: Page) {
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
}

async function signIn(page: Page, role: "User" | "Recruiter", companyId: string | null) {
  await page.addInitScript(() => localStorage.setItem("accessToken", "e2e-token"));
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        id: `e2e-${role}`,
        email: `${role.toLowerCase()}@e2e.local`,
        fullName: "Nhà tuyển dụng thử",
        role,
        isActive: true,
        companyId,
      },
    }),
  );
}

test("recruiter registration asks for an invite code and sends it, not a companyId", async ({ page }) => {
  await offlineBackend(page);
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/auth/register", (route) => {
    bodies.push(route.request().postDataJSON());
    route.fulfill({ status: 201, json: { userId: "e2e-new", message: "registered" } });
  });
  await page.goto("/register");

  await page.getByRole("button", { name: "Nhà tuyển dụng" }).click();
  await expect(page.getByLabel("Mã mời của công ty")).toBeVisible();
  await page.getByLabel("Họ và tên").fill("Người Mới");
  await page.getByLabel("Email").fill("new.recruiter@e2e.local");
  await page.getByLabel(/^Mật khẩu/).fill("SecureP@ss123");
  await page.getByLabel("Nhập lại mật khẩu").fill("SecureP@ss123");
  await page.getByLabel("Mã mời của công ty").fill("abcd-efgh-jklm");
  await page.getByRole("button", { name: "Đăng ký nhà tuyển dụng" }).click();

  await expect(page).toHaveURL(/\/login/);
  expect(bodies).toHaveLength(1);
  expect(bodies[0].inviteCode).toBe("ABCDEFGHJKLM");
  expect(bodies[0]).not.toHaveProperty("companyId");
});

test("recruiter registration shows the invite error from a 422 on the field", async ({ page }) => {
  await offlineBackend(page);
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({ status: 422, json: { title: "Invalid invite code", errorCode: "INVITE_CODE_INVALID" } }),
  );
  await page.goto("/register");

  await page.getByRole("button", { name: "Nhà tuyển dụng" }).click();
  await page.getByLabel("Họ và tên").fill("Người Mới");
  await page.getByLabel("Email").fill("bad.code@e2e.local");
  await page.getByLabel(/^Mật khẩu/).fill("SecureP@ss123");
  await page.getByLabel("Nhập lại mật khẩu").fill("SecureP@ss123");
  await page.getByLabel("Mã mời của công ty").fill("ABCD-EFGH-JKLM");
  await page.getByRole("button", { name: "Đăng ký nhà tuyển dụng" }).click();

  await expect(page.getByText("Mã mời không hợp lệ, đã dùng hoặc đã hết hạn.")).toBeVisible();
});

test("company creator issues an invite code and sees it once", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter", COMPANY_ID);
  const posts: string[] = [];
  await page.route("**/api/companies/*/invite-codes", (route) => {
    posts.push(new URL(route.request().url()).pathname);
    route.fulfill({
      status: 201,
      json: { id: "55555555-5555-5555-5555-555555555555", code: "ABCD-EFGH-JKLM", expiresAt: "2099-01-07T00:00:00Z" },
    });
  });
  await page.goto("/recruiter/invite-codes");

  await page.getByRole("button", { name: "Tạo mã mời" }).click();
  await expect(page.getByText("ABCD-EFGH-JKLM")).toBeVisible();
  await expect(page.getByText("Mã chỉ hiển thị một lần")).toBeVisible();
  expect(posts).toEqual([`/api/companies/${COMPANY_ID}/invite-codes`]);
});

test("account without a company cannot issue invite codes", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter", null);
  await page.goto("/recruiter/invite-codes");

  await expect(page.getByText("Tài khoản của bạn chưa gắn với công ty")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tạo mã mời" })).toBeDisabled();
});

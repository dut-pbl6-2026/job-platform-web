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
    route.fulfill({ status: 202, json: { message: "Check your email to verify your account." } });
  });
  await page.goto("/register");

  await page.getByRole("button", { name: "Nhà tuyển dụng" }).click();
  await expect(page.getByLabel("Mã mời của công ty")).toBeVisible();
  await page.getByLabel("Họ và tên").fill("Người Mới");
  await page.getByLabel("Email nhận mã mời").fill("new.recruiter@e2e.local");
  await page.getByLabel(/^Mật khẩu/).fill("SecureP@ss123");
  await page.getByLabel("Nhập lại mật khẩu").fill("SecureP@ss123");
  await page.getByLabel("Mã mời của công ty").fill("abcd-efgh-jklm");
  await page.getByRole("button", { name: "Đăng ký nhà tuyển dụng" }).click();

  await expect(page).toHaveURL(/\/login/);
  // An invited recruiter is active at once: no verification email, so no "check your email" notice.
  await expect(page.getByText("Tài khoản nhà tuyển dụng đã sẵn sàng. Hãy đăng nhập.")).toBeVisible();
  await expect(page.getByText("Kiểm tra email để xác minh tài khoản của bạn.")).toHaveCount(0);
  expect(bodies).toHaveLength(1);
  expect(bodies[0].inviteCode).toBe("ABCDEFGHJKLM");
  // The account address is also the address the code was issued to: auth-svc forwards it to job-svc.
  expect(bodies[0].email).toBe("new.recruiter@e2e.local");
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
  await page.getByLabel("Email nhận mã mời").fill("bad.code@e2e.local");
  await page.getByLabel(/^Mật khẩu/).fill("SecureP@ss123");
  await page.getByLabel("Nhập lại mật khẩu").fill("SecureP@ss123");
  await page.getByLabel("Mã mời của công ty").fill("ABCD-EFGH-JKLM");
  await page.getByRole("button", { name: "Đăng ký nhà tuyển dụng" }).click();

  await expect(page.getByText("Mã mời không hợp lệ, đã dùng hoặc đã hết hạn.")).toBeVisible();
});

test("company creator issues an email-bound invite code and sees it once", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter", COMPANY_ID);
  const posts: string[] = [];
  const bodies: unknown[] = [];
  await page.route("**/api/companies/*/invite-codes", (route) => {
    posts.push(new URL(route.request().url()).pathname);
    bodies.push(route.request().postDataJSON());
    route.fulfill({
      status: 201,
      json: {
        id: "55555555-5555-5555-5555-555555555555",
        code: "ABCD-EFGH-JKLM",
        email: "new.recruiter@e2e.local",
        expiresAt: "2099-01-07T00:00:00Z",
      },
    });
  });
  await page.goto("/recruiter/invite-codes");

  await page.getByLabel("Email nhận mã mời").fill("new.recruiter@e2e.local");
  await page.getByRole("button", { name: "Tạo mã mời" }).click();
  await expect(page.getByText("ABCD-EFGH-JKLM")).toBeVisible();
  await expect(page.getByText("Mã dành cho new.recruiter@e2e.local")).toBeVisible();
  await expect(page.getByText("Mã chỉ hiển thị một lần")).toBeVisible();
  expect(posts).toEqual([`/api/companies/${COMPANY_ID}/invite-codes`]);
  expect(bodies).toEqual([{ email: "new.recruiter@e2e.local" }]);
});

test("an invalid invite email is stopped before the API call", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter", COMPANY_ID);
  let posts = 0;
  await page.route("**/api/companies/*/invite-codes", (route) => {
    posts += 1;
    route.fulfill({ status: 422, json: { errorCode: "INVITE_EMAIL_INVALID" } });
  });
  await page.goto("/recruiter/invite-codes");

  await page.getByLabel("Email nhận mã mời").fill("not-an-email");
  await page.getByRole("button", { name: "Tạo mã mời" }).click();

  await expect(page.getByText("Email không hợp lệ")).toBeVisible();
  expect(posts).toBe(0);
});

test("account without a company cannot issue invite codes", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter", null);
  await page.goto("/recruiter/invite-codes");

  await expect(page.getByText("Tài khoản của bạn chưa gắn với công ty")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tạo mã mời" })).toBeDisabled();
});

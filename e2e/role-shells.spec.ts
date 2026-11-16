import { expect, test, type Page } from "@playwright/test";

/**
 * Role shells, the account menu, the public company page and the workspace company settings.
 * These are behaviour checks, not screenshots.
 */

type Role = "User" | "Recruiter" | "Admin";

async function offlineBackend(page: Page) {
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
}

/** On a phone the workspace nav is behind the Menu button; open it before looking for links. */
async function openWorkspaceMenu(page: Page) {
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  if (await menu.isVisible()) await menu.click();
}

async function signIn(page: Page, role: Role) {
  await page.addInitScript(() => localStorage.setItem("accessToken", "e2e-token"));
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        id: `e2e-${role}`,
        email: `${role.toLowerCase()}@e2e.local`,
        fullName: "Người dùng thử",
        role,
        isActive: true,
        companyId: role === "Recruiter" ? "co-e2e" : null,
      },
    }),
  );
}

test("home: a guest gets the hero, search and real job rows", async ({ page }) => {
  await offlineBackend(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Tìm việc phù hợp, tuyển người đúng." })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Từ khóa" })).toBeVisible();
  await expect(page.locator('[class*="skeleton"]')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator(".jp-jobcard").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng tuyển miễn phí" }).first()).toBeVisible();
});

test("home: searching writes both fields to the job board URL", async ({ page }) => {
  await offlineBackend(page);
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Từ khóa" }).fill("React");
  await page.getByPlaceholder("Tất cả địa điểm").fill("Hà Nội");
  await page.getByRole("button", { name: "Tìm việc" }).click();
  await expect(page).toHaveURL(/\/jobs\?.*q=React/);
  await expect(page).toHaveURL(/location=H/);
});

test("avatar menu: the profile entry opens /profile and Escape returns focus", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "User");
  await page.goto("/jobs");
  const trigger = page.getByRole("button", { name: "Tài khoản của Người dùng thử" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("menu", { name: "Menu tài khoản" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("menuitem", { name: "Hồ sơ" }).click();
  await expect(page).toHaveURL(/\/profile$/);
});

test("recruiter shell: sidebar sections, active marker, no marketing footer", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await page.goto("/recruiter");
  await expect(page.getByRole("heading", { name: "Tổng quan tuyển dụng" })).toBeVisible();
  await openWorkspaceMenu(page);
  for (const label of ["Tổng quan", "Tin tuyển dụng", "Đăng tin", "Công ty"]) {
    await expect(
      page.getByRole("navigation", { name: "Điều hướng khu vực làm việc" }).getByRole("link", { name: label }),
    ).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Tổng quan" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("footer")).toHaveCount(0);
  await expect(page.getByText("Chờ duyệt")).toHaveCount(0);
});

test("company settings: a member sees read-only fields and the reason", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await page.route("**/api/companies/mine", (route) =>
    route.fulfill({
      json: {
        isCompanyAdmin: false,
        company: {
          id: "co-e2e",
          name: "Công ty thử nghiệm",
          taxCode: "0312345678",
          verified: true,
          industry: "IT",
          size: "50-100",
          address: "Đà Nẵng",
          website: "https://example.vn",
          description: "Mô tả công ty",
        },
      },
    }),
  );
  await page.goto("/recruiter/company");
  await expect(page.getByText("Chỉ quản trị viên công ty được sửa thông tin công ty.")).toBeVisible();
  const name = page.getByLabel("Tên công ty");
  await expect(name).toBeDisabled();
  await expect(name).toHaveValue("Công ty thử nghiệm");
});

test("company settings: the company admin can save the profile", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await page.route("**/api/companies/mine", (route) =>
    route.fulfill({
      json: {
        isCompanyAdmin: true,
        company: { id: "co-e2e", name: "Công ty thử nghiệm", verified: true, industry: "IT" },
      },
    }),
  );
  await page.route("**/api/companies/co-e2e", (route) => route.fulfill({ json: { message: "ok" } }));
  await page.goto("/recruiter/company");
  await page.getByLabel("Tên công ty").fill("Công ty thử nghiệm mới");
  await page.getByRole("button", { name: "Lưu thông tin công ty" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Đã lưu thông tin công ty." })).toBeVisible();
});

test("public company page: facts and an empty or unavailable job section", async ({ page }) => {
  await offlineBackend(page);
  await page.route("**/api/companies/co-e2e", (route) =>
    route.fulfill({
      json: {
        id: "co-e2e",
        name: "Công ty thử nghiệm",
        verified: true,
        industry: "IT",
        size: "50-100",
        address: "Đà Nẵng",
        website: "https://example.vn",
        description: "Công ty làm phần mềm.",
      },
    }),
  );
  // The jobs endpoint is being added on job-svc main: a 404 is handled as "not available yet".
  await page.route("**/api/companies/co-e2e/jobs**", (route) =>
    route.fulfill({ status: 404, json: { message: "not found" } }),
  );
  await page.goto("/companies/co-e2e");
  await expect(page.getByRole("heading", { level: 1, name: "Công ty thử nghiệm" })).toBeVisible();
  await expect(page.getByText("Đã xác minh")).toBeVisible();
  await expect(page.getByText("Công ty làm phần mềm.")).toBeVisible();
  await expect(page.getByText("Chưa tải được danh sách tin riêng của công ty.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Tìm trên bảng việc làm" }).first()).toBeVisible();
});

test("recruiter applicants: the AI match score is a whole number and null scores say why", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await page.route("**/api/jobs/job-score", (route) =>
    route.fulfill({
      json: {
        id: "job-score",
        title: "Lập trình viên Frontend",
        companyId: "co-e2e",
        companyName: "Công ty thử nghiệm",
        location: "Đà Nẵng",
        status: "Active",
        createdAt: new Date().toISOString(),
      },
    }),
  );
  await page.route("**/api/applications/status-flow", (route) =>
    route.fulfill({ json: { transitions: { pending: ["reviewed"], reviewed: ["shortlisted"] } } }),
  );
  await page.route("**/api/applications/job/job-score**", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "app-1",
            jobId: "job-score",
            status: "pending",
            applicantId: "u1",
            score: 78.4,
            scoringStatus: "done",
            createdAt: "2026-11-01T09:00:00Z",
            updatedAt: "2026-11-01T09:00:00Z",
          },
          {
            id: "app-2",
            jobId: "job-score",
            status: "pending",
            applicantId: "u2",
            score: null,
            scoringStatus: "processing",
            createdAt: "2026-11-02T09:00:00Z",
            updatedAt: "2026-11-02T09:00:00Z",
          },
          {
            id: "app-3",
            jobId: "job-score",
            status: "pending",
            applicantId: "u3",
            score: null,
            scoringStatus: "failed",
            createdAt: "2026-11-03T09:00:00Z",
            updatedAt: "2026-11-03T09:00:00Z",
          },
        ],
        total: 3,
        page: 1,
        size: 20,
      },
    }),
  );
  await page.goto("/recruiter/jobs/job-score/applications");
  await expect(
    page.getByText("Điểm do AI chấm từ CV so với yêu cầu tin tuyển dụng; chỉ nhà tuyển dụng thấy."),
  ).toBeVisible();
  await expect(page.locator(".jp-match-score-value", { hasText: "78" }).first()).toBeVisible();
  await expect(page.locator(".jp-match-score-value", { hasText: "78" }).first()).not.toHaveText("78.4");
  await expect(page.getByText("Đang tính")).toBeVisible();
  await expect(page.getByText("Không tính được")).toBeVisible();
});

test("candidate score page is gone: /resume-score is the public 404", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "User");
  await page.goto("/resume-score");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang này." })).toBeVisible();
  await expect(page.getByText("Điểm phù hợp AI")).toHaveCount(0);
});

test("AI assistant is gone: no dock, no links, /chat is the public 404", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "User");
  await page.goto("/jobs");
  await expect(page.getByRole("button", { name: "Mở trợ lý việc làm" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Trợ lý AI" })).toHaveCount(0);
  await page.goto("/chat");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang này." })).toBeVisible();
});

for (const [role, landing] of [
  ["Recruiter", "/recruiter"],
  ["Admin", "/admin"],
] as const) {
  test(`login: ${role} lands in its own workspace`, async ({ page }) => {
    await offlineBackend(page);
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        json: {
          accessToken: "e2e-token",
          refreshToken: "e2e-refresh",
          user: { id: `e2e-${role}`, email: `${role.toLowerCase()}@e2e.local`, fullName: "Người dùng thử", role },
        },
      }),
    );
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        json: {
          id: `e2e-${role}`,
          email: `${role.toLowerCase()}@e2e.local`,
          fullName: "Người dùng thử",
          role,
          isActive: true,
        },
      }),
    );
    await page.goto("/login");
    await page.getByLabel("Email").fill(`${role.toLowerCase()}@e2e.local`);
    await page.getByLabel(/^Mật khẩu/).fill("Abcdefg1");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).last().click();
    await expect(page).toHaveURL(new RegExp(`${landing}$`));
  });
}

test("home: a signed-in candidate is not sent to the guest-only company sign-up", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "User");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Tìm việc phù hợp, tuyển người dùng đúng." })).toHaveCount(
    0,
  );
  await expect(page.getByRole("heading", { level: 1, name: "Tìm việc phù hợp, tuyển người đúng." })).toBeVisible();
  await expect(
    page.getByText(
      "Tài khoản ứng viên không đăng tin được. Nhà tuyển dụng đăng ký riêng bằng email công ty, sau khi đăng xuất khỏi tài khoản này.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng tuyển miễn phí" })).toHaveCount(0);
});

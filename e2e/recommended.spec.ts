import { expect, test, type Page, type Request } from "@playwright/test";

type Role = "User" | "Recruiter" | "Admin";

async function offlineBackend(page: Page) {
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
}

async function signIn(page: Page, role: Role) {
  await page.addInitScript(() => localStorage.setItem("accessToken", "e2e-token"));
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: { id: `e2e-${role}`, email: `${role.toLowerCase()}@e2e.local`, fullName: "Người dùng thử", role, isActive: true, companyId: null },
    }),
  );
}

/** RecommendedJobDto as job-svc returns it (nested company and category, no description or score). */
function item(id: string, title: string, strategy: string, reason: string) {
  return {
    id,
    title,
    companyId: "22222222-2222-2222-2222-222222222222",
    company: { id: "22222222-2222-2222-2222-222222222222", name: "Công ty thử nghiệm" },
    categoryId: null,
    category: null,
    location: "Hà Nội",
    salaryMin: 10000000,
    salaryMax: 20000000,
    salaryCurrency: "VND",
    employmentType: "FullTime",
    experienceLevel: "Mid",
    createdAt: "2026-11-10T08:00:00Z",
    strategy,
    reason,
  };
}

/** Mock GET /api/jobs/recommended; returns the request log. `respond` can return a status or items. */
async function mockRecommended(page: Page, respond: () => { status?: number; json: unknown }) {
  const calls: Request[] = [];
  await page.route(
    (url) => url.pathname === "/api/jobs/recommended",
    (route) => {
      calls.push(route.request());
      const r = respond();
      route.fulfill({ status: r.status ?? 200, json: r.json });
    },
  );
  return calls;
}

test("user sees recommended jobs with the backend's rationale line", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "User");
  const calls = await mockRecommended(page, () => ({
    json: { items: [item("11111111-1111-1111-1111-111111111111", "Lập trình viên React", "Content", "Khớp với kỹ năng React trong hồ sơ của bạn")], total: 1, isCached: false, generatedAt: "2026-11-15T01:00:00Z" },
  }));
  await page.goto("/jobs");

  await expect(page.getByRole("heading", { name: "Việc làm gợi ý cho bạn" })).toBeVisible();
  await expect(page.getByText("Cá nhân hóa theo hồ sơ và kỹ năng của bạn")).toBeVisible();
  await expect(page.getByRole("link", { name: "Lập trình viên React" }).first()).toBeVisible();
  await expect(page.getByText("Khớp với kỹ năng React trong hồ sơ của bạn")).toBeVisible();
  expect(calls).toHaveLength(1);
});

test("cold start: a Popular recommendation renders like any other", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "User");
  await mockRecommended(page, () => ({
    json: { items: [item("11111111-1111-1111-1111-222222222222", "Kỹ sư dữ liệu", "Popular", "Việc làm được nhiều người quan tâm")], total: 1, isCached: false, generatedAt: "2026-11-15T01:00:00Z" },
  }));
  await page.goto("/jobs");

  await expect(page.getByRole("heading", { name: "Việc làm gợi ý cho bạn" })).toBeVisible();
  await expect(page.getByText("Việc làm được nhiều người quan tâm")).toBeVisible();
});

test("empty result hides the section without an error", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "User");
  await mockRecommended(page, () => ({ json: { items: [], total: 0, isCached: false, generatedAt: "2026-11-15T01:00:00Z" } }));
  await page.goto("/jobs");

  // The board has loaded (mock jobs) before we assert the section is absent.
  await expect(page.locator(".jp-row").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Việc làm gợi ý cho bạn" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Thử lại" })).toHaveCount(0);
});

test("a failed call shows the error and retry loads the list", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "User");
  let fail = true;
  const calls = await mockRecommended(page, () =>
    fail
      ? { status: 500, json: { title: "Lỗi máy chủ" } }
      : { json: { items: [item("11111111-1111-1111-1111-333333333333", "Chuyên viên tuyển dụng", "Content", "Khớp với hồ sơ của bạn")], total: 1, isCached: false, generatedAt: "2026-11-15T01:00:00Z" } },
  );
  await page.goto("/jobs");

  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByText("Khớp với hồ sơ của bạn")).toBeVisible();
  expect(calls.length).toBeGreaterThanOrEqual(2);
});

test("refresh asks the backend to bypass its cache", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "User");
  const calls = await mockRecommended(page, () => ({
    json: { items: [item("11111111-1111-1111-1111-444444444444", "Nhân viên kinh doanh", "Content", "Khớp với hồ sơ của bạn")], total: 1, isCached: true, generatedAt: "2026-11-15T01:00:00Z" },
  }));
  await page.goto("/jobs");
  await expect(page.getByText("Khớp với hồ sơ của bạn")).toBeVisible();

  await page.getByRole("button", { name: "Làm mới gợi ý" }).click();
  await expect.poll(() => calls.some((r) => new URL(r.url()).searchParams.get("refresh") === "true")).toBe(true);
});

for (const role of ["Recruiter", "Admin"] as const) {
  test(`${role} never requests recommendations and sees no section`, async ({ page }) => {
    await offlineBackend(page);
    await signIn(page, role);
    const calls = await mockRecommended(page, () => ({ json: { items: [], total: 0, isCached: false, generatedAt: "2026-11-15T01:00:00Z" } }));
    await page.goto("/jobs");

    await expect(page.getByRole("heading", { name: "Việc làm gợi ý cho bạn" })).toHaveCount(0);
    // Give a stray request time to fire before asserting none did.
    await page.waitForLoadState("networkidle");
    expect(calls).toHaveLength(0);
  });
}

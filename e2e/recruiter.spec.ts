import { expect, test, type Page, type Request } from "@playwright/test";

type Role = "User" | "Recruiter" | "Admin";

/** Backend unreachable for every call that is not mocked below. */
async function offlineBackend(page: Page) {
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
}

/** A signed-in session without auth-svc: a token in storage and a canned /auth/me. */
async function signIn(page: Page, role: Role) {
  await page.addInitScript(() => localStorage.setItem("accessToken", "e2e-token"));
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        id: `e2e-${role}`,
        email: `${role.toLowerCase()}@e2e.local`,
        fullName: "Nhà tuyển dụng thử",
        role,
        isActive: true,
      },
    }),
  );
}

const JOB_BASE = {
  description: "Mô tả công việc thử nghiệm.",
  companyId: "22222222-2222-2222-2222-222222222222",
  companyName: "Công ty thử nghiệm",
  salaryMin: 10000000,
  salaryMax: 20000000,
  salaryCurrency: "VND",
  categoryId: null,
  categoryName: null,
  requirements: null,
  benefits: null,
  employmentType: "FullTime",
  experienceLevel: "Mid",
  recruiterId: "e2e-Recruiter",
  viewCount: 0,
  updatedAt: "2026-11-10T08:00:00Z",
};

/** JobDetailDto rows as job-svc returns them, one per status the recruiter list can show. */
const JOBS = [
  {
    ...JOB_BASE,
    id: "11111111-1111-1111-1111-111111111111",
    title: "Lập trình viên React",
    location: "Hà Nội",
    status: "Active",
    createdAt: "2026-11-10T08:00:00Z",
  },
  {
    ...JOB_BASE,
    id: "11111111-1111-1111-1111-222222222222",
    title: "Kỹ sư dữ liệu",
    location: "Đà Nẵng",
    status: "Pending",
    createdAt: "2026-11-09T08:00:00Z",
  },
  {
    ...JOB_BASE,
    id: "11111111-1111-1111-1111-333333333333",
    title: "Chuyên viên tuyển dụng",
    location: "Remote",
    status: "Closed",
    createdAt: "2026-11-08T08:00:00Z",
  },
];

/**
 * Mock job-svc GET /api/jobs/recruiter (1-based page, optional case-insensitive status) and
 * app-svc GET /api/applications/job/{id} (only `total` is read by the dashboard).
 * Returns the request log so a test can assert which calls were made.
 */
async function mockRecruiterApi(page: Page, jobs: typeof JOBS = JOBS) {
  const calls: Request[] = [];
  await page.route(
    (url) => url.pathname.endsWith("/api/jobs/recruiter"),
    (route) => {
      calls.push(route.request());
      const url = new URL(route.request().url());
      const status = url.searchParams.get("status")?.toLowerCase();
      const size = Number(url.searchParams.get("size")) || 10;
      const page1 = Number(url.searchParams.get("page")) || 1;
      const filtered = status ? jobs.filter((j) => j.status.toLowerCase() === status) : jobs;
      const items = filtered.slice((page1 - 1) * size, page1 * size);
      route.fulfill({
        json: {
          items,
          total: filtered.length,
          page: page1,
          size,
          totalPages: Math.max(1, Math.ceil(filtered.length / size)),
        },
      });
    },
  );
  await page.route(
    (url) => /\/api\/applications\/job\/[^/]+$/.test(url.pathname),
    (route) => {
      calls.push(route.request());
      const url = new URL(route.request().url());
      route.fulfill({
        json: {
          items: [],
          total: 2,
          page: Number(url.searchParams.get("page")) || 1,
          size: Number(url.searchParams.get("size")) || 20,
        },
      });
    },
  );
  return calls;
}

/** On the mobile project the nav folds into the Menu button; open it so the links can be found. */
async function openNavIfFolded(page: Page) {
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  if (await menu.isVisible()) await menu.click();
}

const recruiterCalls = (calls: Request[]) =>
  calls.filter((r) => new URL(r.url()).pathname.endsWith("/api/jobs/recruiter"));

test("recruiter sees the workspace sidebar and real counts on the dashboard", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await mockRecruiterApi(page);
  await page.goto("/recruiter");

  await expect(page.getByRole("heading", { name: "Tổng quan tuyển dụng" })).toBeVisible();
  await openNavIfFolded(page);
  const nav = page.getByRole("navigation", { name: "Điều hướng khu vực làm việc" });
  for (const label of ["Tổng quan", "Tin tuyển dụng", "Đăng tin", "Công ty"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "Tổng quan" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("footer")).toHaveCount(0);

  // No approval stage remains: two tiles, Active and Closed, with the real totals.
  await expect(page.getByRole("listitem").filter({ hasText: "Tin đang mở" })).toContainText("1");
  await expect(page.getByRole("listitem").filter({ hasText: "Đã đóng" })).toContainText("1");
  await expect(page.getByRole("listitem").filter({ hasText: "Chờ duyệt" })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "Lập trình viên React" })).toBeVisible();
});

test("user does not see the recruiter nav and never calls the recruiter endpoints", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "User");
  const calls = await mockRecruiterApi(page);
  await page.goto("/jobs");

  await openNavIfFolded(page);
  await expect(page.getByRole("link", { name: "Tuyển dụng" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Tạo CV" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Điều hướng khu vực làm việc" })).toHaveCount(0);
  expect(recruiterCalls(calls)).toHaveLength(0);
});

test("user is redirected away from the recruiter routes", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "User");
  const calls = await mockRecruiterApi(page);

  await page.goto("/recruiter");
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByText("Khu vực này chỉ dành cho nhà tuyển dụng.")).toBeVisible();

  await page.goto("/recruiter/jobs");
  await expect(page).toHaveURL(/\/jobs$/);
  expect(recruiterCalls(calls)).toHaveLength(0);
});

test("recruiter is redirected away from applicant-only pages", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  const applicationCalls: Request[] = [];
  await page.route(
    (url) => url.pathname.endsWith("/api/applications/me"),
    (route) => {
      applicationCalls.push(route.request());
      route.fulfill({ json: { items: [], total: 0, page: 0, size: 10, totalPages: 1 } });
    },
  );

  await page.goto("/applications");
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByText("Trang này chỉ dành cho ứng viên.")).toBeVisible();
  expect(applicationCalls).toHaveLength(0);

  await page.goto("/jobs/11111111-1111-1111-1111-111111111111/apply");
  await expect(page).toHaveURL(/\/jobs$/);
});

test("recruiter job list filters by status and passes it to the API", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  const calls = await mockRecruiterApi(page);
  await page.goto("/recruiter/jobs");

  await expect(page.getByRole("cell", { name: "Lập trình viên React" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Kỹ sư dữ liệu" })).toBeVisible();

  await page.getByRole("button", { name: "Đã đóng" }).click();
  await expect(page).toHaveURL(/status=Closed/);
  await expect(page.getByRole("cell", { name: "Chuyên viên tuyển dụng" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Lập trình viên React" })).toHaveCount(0);
  expect(recruiterCalls(calls).some((r) => new URL(r.url()).searchParams.get("status") === "Closed")).toBe(true);
});

test("recruiter with no jobs sees the empty states", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await mockRecruiterApi(page, []);

  await page.goto("/recruiter");
  await expect(page.getByText("Bạn chưa có tin tuyển dụng nào.")).toBeVisible();

  await page.goto("/recruiter/jobs");
  await expect(page.getByText("Bạn chưa có tin tuyển dụng nào.")).toBeVisible();
});

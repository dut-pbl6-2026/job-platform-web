import { expect, test, type Page, type Request } from "@playwright/test";

type Role = "User" | "Recruiter";

async function offlineBackend(page: Page) {
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
}

/** Signed in, with an optional company (auth-svc UserDto.CompanyId, returned by /api/auth/me). */
async function signIn(page: Page, role: Role, companyId: string | null = "33333333-3333-3333-3333-333333333333") {
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

/** Captures POSTs to /api/jobs and to the admin endpoint; the job list the redirect lands on is empty. */
async function mockPost(page: Page) {
  const posts: { url: string; body: Record<string, unknown> | null; request: Request }[] = [];
  await page.route(
    (url) => url.pathname === "/api/jobs" || url.pathname === "/api/admin/jobs",
    (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        posts.push({ url: new URL(req.url()).pathname, body: req.postDataJSON(), request: req });
        route.fulfill({ status: 201, json: { id: "44444444-4444-4444-4444-444444444444", message: "Job created" } });
      } else {
        route.fulfill({ json: { items: [], total: 0, page: 1, size: 10, totalPages: 1 } });
      }
    },
  );
  await page.route(
    (url) => url.pathname.endsWith("/api/jobs/recruiter"),
    (route) => route.fulfill({ json: { items: [], total: 0, page: 1, size: 10, totalPages: 1 } }),
  );
  return posts;
}

test("recruiter posts a job through POST /api/jobs with the account's companyId", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  const posts = await mockPost(page);
  await page.goto("/recruiter/jobs/new");

  await page.getByLabel("Tiêu đề vị trí").fill("Lập trình viên React");
  await page.getByLabel("Mô tả công việc").fill("Phát triển giao diện web.");
  await page.getByRole("textbox", { name: /^Địa điểm/ }).fill("Hà Nội");
  await page.getByLabel("Lương tối thiểu (VND)").fill("10000000");
  await page.getByRole("button", { name: "Xuất bản" }).click();

  await expect(page).toHaveURL(/\/recruiter\/jobs$/);
  await expect(page.getByText("Tin đã được đăng và hiển thị công khai.")).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(posts[0].url).toBe("/api/jobs");
  expect(posts[0].body).toEqual({
    title: "Lập trình viên React",
    description: "Phát triển giao diện web.",
    companyId: "33333333-3333-3333-3333-333333333333",
    location: "Hà Nội",
    salaryMin: 10000000,
    salaryMax: null,
    salaryCurrency: "VND",
    categoryId: null,
    requirements: null,
    benefits: null,
    employmentType: "FullTime",
    experienceLevel: "Entry",
  });
});

test("post job: empty submit names each missing field and sends nothing", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  const posts = await mockPost(page);
  await page.goto("/recruiter/jobs/new");

  await page.getByRole("button", { name: "Xuất bản" }).click();
  await expect(page.getByText("Vui lòng nhập tiêu đề")).toBeVisible();
  await expect(page.getByText("Vui lòng nhập mô tả")).toBeVisible();
  await expect(page.getByText("Vui lòng nhập địa điểm")).toBeVisible();
  expect(posts).toHaveLength(0);
});

test("post job: maximum salary below minimum is refused", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  const posts = await mockPost(page);
  await page.goto("/recruiter/jobs/new");

  await page.getByLabel("Tiêu đề vị trí").fill("Kế toán");
  await page.getByLabel("Mô tả công việc").fill("Kế toán tổng hợp.");
  await page.getByRole("textbox", { name: /^Địa điểm/ }).fill("Đà Nẵng");
  await page.getByLabel("Lương tối thiểu (VND)").fill("20000000");
  await page.getByLabel("Lương tối đa (VND)").fill("10000000");
  await page.getByRole("button", { name: "Xuất bản" }).click();

  await expect(page.getByText("Mức lương tối đa phải lớn hơn hoặc bằng tối thiểu")).toBeVisible();
  expect(posts).toHaveLength(0);
});

test("post job: an account without a company cannot publish", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter", null);
  const posts = await mockPost(page);
  await page.goto("/recruiter/jobs/new");

  await expect(page.getByText("Tài khoản của bạn chưa gắn với công ty")).toBeVisible();
  await expect(page.getByRole("button", { name: "Xuất bản" })).toBeDisabled();
  expect(posts).toHaveLength(0);
});

test("post job: a User is redirected away and sends nothing", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "User");
  const posts = await mockPost(page);
  await page.goto("/recruiter/jobs/new");

  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByText("Khu vực này chỉ dành cho nhà tuyển dụng.")).toBeVisible();
  expect(posts).toHaveLength(0);
});

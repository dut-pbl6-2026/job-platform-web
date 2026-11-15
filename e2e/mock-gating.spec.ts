import { expect, test } from "@playwright/test";

// Runs with playwright.no-mocks.config.ts: the dev server has VITE_ENABLE_MOCKS=false.

/** A title from the seed catalogue (src/mocks/seedJobs.json): it must never show when the API answers. */
const MOCK_ONLY_TITLE = "Ky su phan mem";

const REAL_JOB = {
  id: "55555555-5555-5555-5555-555555555555",
  title: "Kỹ sư backend từ API",
  description: "Mô tả từ máy chủ.",
  companyId: "33333333-3333-3333-3333-333333333333",
  companyName: "Công ty từ API",
  location: "Đà Nẵng",
  salaryMin: 12000000,
  salaryMax: 18000000,
  salaryCurrency: "VND",
  categoryId: null,
  categoryName: null,
  requirements: null,
  benefits: null,
  employmentType: "FullTime",
  experienceLevel: "Mid",
  status: "Active",
  viewCount: 0,
  recruiterId: "66666666-6666-6666-6666-666666666666",
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  skills: [],
};

test("job list shows only what the search API returns when mocks are off", async ({ page }) => {
  await page.route("**/api/search/jobs**", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: REAL_JOB.id,
            title: REAL_JOB.title,
            description: REAL_JOB.description,
            company_id: REAL_JOB.companyId,
            company_name: REAL_JOB.companyName,
            location: REAL_JOB.location,
            salary_min: REAL_JOB.salaryMin,
            salary_max: REAL_JOB.salaryMax,
            currency: "VND",
            category_id: null,
            category_name: null,
            employment_type: "FullTime",
            experience_level: "Mid",
            status: "Active",
            recruiter_id: REAL_JOB.recruiterId,
            created_at: REAL_JOB.createdAt,
            updated_at: REAL_JOB.updatedAt,
            skills: [],
          },
        ],
        total: 1,
        page: 0,
        size: 20,
        totalPages: 1,
      },
    }),
  );
  await page.route("**/api/categories", (route) => route.fulfill({ json: [] }));
  await page.goto("/jobs");

  await expect(page.getByRole("link", { name: REAL_JOB.title })).toBeVisible();
  await expect(page.getByText(MOCK_ONLY_TITLE, { exact: false })).toHaveCount(0);
});

test("job detail shows the API job, never a mock catalogue entry, when the API answers 200", async ({ page }) => {
  await page.route(`**/api/jobs/${REAL_JOB.id}`, (route) => route.fulfill({ json: REAL_JOB }));
  await page.goto(`/jobs/${REAL_JOB.id}`);

  await expect(page.getByRole("heading", { level: 1, name: REAL_JOB.title })).toBeVisible();
  await expect(page.getByText(MOCK_ONLY_TITLE, { exact: false })).toHaveCount(0);
});

test("a failing search shows an error and does not fall back to mock data", async ({ page }) => {
  await page.route("**/api/search/jobs**", (route) => route.fulfill({ status: 500, json: { title: "boom" } }));
  await page.route("**/api/categories", (route) => route.fulfill({ json: [] }));
  await page.goto("/jobs");

  await expect(page.getByText(MOCK_ONLY_TITLE, { exact: false })).toHaveCount(0);
  await expect(page.getByText("Máy chủ đang gặp sự cố", { exact: false }).first()).toBeVisible();
});

test("the forgot-password page shows fixed Vietnamese text, not the backend message", async ({ page }) => {
  await page.route("**/api/auth/forgot-password", (route) =>
    route.fulfill({ status: 200, json: { message: "If the email exists, a link was sent." } }),
  );
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("a@e2e.local");
  await page.getByRole("button", { name: "Gửi liên kết đặt lại" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Nếu email tồn tại" })).toBeVisible();
  await expect(page.getByText("If the email exists", { exact: false })).toHaveCount(0);
});

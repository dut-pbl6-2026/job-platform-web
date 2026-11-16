import { expect, test, type Page, type Request } from "@playwright/test";

type Role = "User" | "Recruiter";

const JOB_ID = "55555555-5555-4555-8555-555555555555";
const COMPANY_ID = "33333333-3333-3333-3333-333333333333";

const JOB = {
  id: JOB_ID,
  title: "Lập trình viên React",
  description: "Phát triển giao diện web.",
  location: "Hà Nội",
  companyId: COMPANY_ID,
  companyName: "Công ty thử nghiệm",
  categoryId: "",
  employmentType: "FullTime",
  experienceLevel: "Mid",
  salaryMin: 10000000,
  salaryMax: 20000000,
  salaryCurrency: "VND",
  requirements: "React, TypeScript",
  benefits: "Bảo hiểm đầy đủ",
  status: "active",
  createdAt: "2026-11-16T00:00:00Z",
  updatedAt: "2026-11-16T00:00:00Z",
};

async function offlineBackend(page: Page) {
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
}

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
        companyId: COMPANY_ID,
      },
    }),
  );
}

test("recruiter edits a published job through PUT /api/jobs/{id}", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");

  const puts: { body: Record<string, unknown> | null; request: Request }[] = [];
  await page.route(`**/api/jobs/${JOB_ID}`, (route) => {
    const req = route.request();
    if (req.method() === "PUT") {
      puts.push({ body: req.postDataJSON(), request: req });
      route.fulfill({ json: { message: "Job updated" } });
    } else {
      route.fulfill({ json: JOB });
    }
  });
  await page.route("**/api/categories", (route) => route.fulfill({ json: [] }));
  await page.route(
    (url) => url.pathname === "/api/jobs/recruiter",
    (route) => route.fulfill({ json: { items: [], total: 0, page: 1, size: 10, totalPages: 1 } }),
  );

  await page.goto(`/recruiter/jobs/${JOB_ID}/edit`);

  await expect(page.getByLabel("Tiêu đề vị trí")).toHaveValue("Lập trình viên React");
  await page.getByLabel("Tiêu đề vị trí").fill("Lập trình viên React (cao cấp)");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();

  await expect(page).toHaveURL(/\/recruiter\/jobs$/);
  expect(puts).toHaveLength(1);
  expect(puts[0].body).toMatchObject({
    title: "Lập trình viên React (cao cấp)",
    description: "Phát triển giao diện web.",
    companyId: COMPANY_ID,
    employmentType: "FullTime",
    experienceLevel: "Mid",
    salaryMin: 10000000,
    salaryMax: 20000000,
  });
});

test("recruiter removes a job after an explicit confirmation", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");

  const deletes: string[] = [];
  await page.route(
    (url) => url.pathname === "/api/jobs/recruiter",
    (route) =>
      route.fulfill({
        json: { items: [JOB], total: 1, page: 1, size: 10, totalPages: 1 },
      }),
  );
  await page.route(`**/api/jobs/${JOB_ID}`, (route) => {
    if (route.request().method() === "DELETE") {
      deletes.push(new URL(route.request().url()).pathname);
      route.fulfill({ status: 204, body: "" });
      return;
    }
    route.fulfill({ json: JOB });
  });

  await page.goto("/recruiter/jobs");
  await page.getByRole("button", { name: "Gỡ tin" }).first().click();

  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Gỡ tin “Lập trình viên React”?");
  await expect(dialog).toContainText("không thể hoàn tác");
  await dialog.getByRole("button", { name: "Gỡ tin" }).click();

  await expect.poll(() => deletes).toEqual([`/api/jobs/${JOB_ID}`]);
});

test("cancelling the removal keeps the job", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");

  let deleted = false;
  await page.route(
    (url) => url.pathname === "/api/jobs/recruiter",
    (route) => route.fulfill({ json: { items: [JOB], total: 1, page: 1, size: 10, totalPages: 1 } }),
  );
  await page.route(`**/api/jobs/${JOB_ID}`, (route) => {
    if (route.request().method() === "DELETE") {
      deleted = true;
      route.fulfill({ status: 204, body: "" });
      return;
    }
    route.fulfill({ json: JOB });
  });

  await page.goto("/recruiter/jobs");
  await page.getByRole("button", { name: "Gỡ tin" }).first().click();
  await page.getByRole("button", { name: "Giữ tin" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(deleted).toBe(false);
});

import { expect, test, type Page, type Request } from "@playwright/test";

type Role = "User" | "Recruiter";

const JOB_ID = "55555555-5555-5555-5555-555555555555";
const APPLICANT_ID = "66666666-6666-6666-6666-666666666666";
const APP_PENDING = "77777777-7777-7777-7777-000000000001";
const APP_ACCEPTED = "77777777-7777-7777-7777-000000000002";
const APP_REVIEWED = "77777777-7777-7777-7777-000000000003";

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
        companyId: "33333333-3333-3333-3333-333333333333",
      },
    }),
  );
}

const APPLICATIONS = [
  {
    id: APP_PENDING,
    jobId: JOB_ID,
    applicantId: APPLICANT_ID,
    status: "pending",
    cvUrl: "/api/applications/cv/e2e.pdf",
    coverLetter: "Kính gửi nhà tuyển dụng,\nTôi có 3 năm làm React.",
    createdAt: "2026-11-10T08:00:00Z",
    updatedAt: "2026-11-10T08:00:00Z",
  },
  {
    id: APP_ACCEPTED,
    jobId: JOB_ID,
    applicantId: APPLICANT_ID,
    status: "accepted",
    cvUrl: "",
    coverLetter: null,
    createdAt: "2026-11-09T08:00:00Z",
    updatedAt: "2026-11-09T08:00:00Z",
  },
  {
    id: APP_REVIEWED,
    jobId: JOB_ID,
    applicantId: APPLICANT_ID,
    status: "reviewed",
    cvUrl: "",
    coverLetter: null,
    createdAt: "2026-11-08T08:00:00Z",
    updatedAt: "2026-11-08T08:00:00Z",
  },
];

const STATUS_FLOW = {
  all_statuses: ["pending", "reviewed", "shortlisted", "accepted", "rejected"],
  terminal_statuses: ["accepted", "rejected"],
  transitions: {
    pending: ["reviewed", "rejected"],
    reviewed: ["shortlisted", "rejected"],
    shortlisted: ["accepted", "rejected"],
    accepted: [],
    rejected: [],
  },
};

type Mocks = { puts: Request[]; listCalls: Request[]; putStatus?: number };

/** GET job-svc /api/jobs/{id} (title), GET app-svc status flow and applications for the job, PUT status. */
async function mockApplications(page: Page, opts: { putStatus?: number } = {}): Promise<Mocks> {
  const mocks: Mocks = { puts: [], listCalls: [], putStatus: opts.putStatus };
  await page.route(
    (url) => url.pathname === `/api/jobs/${JOB_ID}`,
    (route) =>
      route.fulfill({
        json: {
          id: JOB_ID,
          title: "Lập trình viên React",
          description: "Mô tả.",
          companyId: "33333333-3333-3333-3333-333333333333",
          companyName: "Công ty thử nghiệm",
          location: "Hà Nội",
          salaryMin: 0,
          salaryMax: 0,
          salaryCurrency: "VND",
          categoryId: null,
          categoryName: null,
          requirements: null,
          benefits: null,
          employmentType: "FullTime",
          experienceLevel: "Entry",
          recruiterId: "e2e-Recruiter",
          status: "Active",
          viewCount: 0,
          createdAt: "2026-11-01T08:00:00Z",
          updatedAt: "2026-11-01T08:00:00Z",
        },
      }),
  );
  await page.route(
    (url) => url.pathname === "/api/applications/status-flow",
    (route) => route.fulfill({ json: STATUS_FLOW }),
  );
  await page.route(
    (url) => url.pathname === `/api/applications/job/${JOB_ID}`,
    (route) => {
      mocks.listCalls.push(route.request());
      const status = new URL(route.request().url()).searchParams.get("status");
      const items = status ? APPLICATIONS.filter((a) => a.status === status) : APPLICATIONS;
      route.fulfill({ json: { items, total: items.length, page: 1, size: 20 } });
    },
  );
  await page.route(
    (url) => /\/api\/applications\/[0-9a-f-]+\/status$/.test(url.pathname),
    (route) => {
      if (route.request().method() !== "PUT") return route.fallback();
      mocks.puts.push(route.request());
      if (opts.putStatus === 409) {
        return route.fulfill({
          status: 409,
          json: {
            status: 409,
            message: "Invalid status transition from 'Pending' to 'Accepted'.",
            current_status: "pending",
            allowed_transitions: ["reviewed", "rejected"],
          },
        });
      }
      return route.fulfill({ json: {} });
    },
  );
  return mocks;
}

const LIST = (page: Page) => page.getByRole("list", { name: "Danh sách hồ sơ ứng tuyển" });

test("recruiter sees the job's applications with Vietnamese status and no applicant id", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await mockApplications(page);
  await page.goto(`/recruiter/jobs/${JOB_ID}/applications`);

  await expect(page.getByRole("heading", { level: 1, name: "Hồ sơ ứng viên: Lập trình viên React" })).toBeVisible();
  await expect(LIST(page).getByRole("listitem")).toHaveCount(3);
  await LIST(page).getByText("Thư ứng tuyển").click();
  await expect(LIST(page).getByText("Kính gửi nhà tuyển dụng")).toBeVisible();
  await expect(LIST(page).getByText("Nhận việc")).toBeVisible();
  await expect(page.getByText(APPLICANT_ID)).toHaveCount(0);
  await expect(page.getByText(APP_PENDING)).toHaveCount(0);
});

test("recruiter moves a pending application to reviewed, and only legal next steps are offered", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  const mocks = await mockApplications(page);
  await page.goto(`/recruiter/jobs/${JOB_ID}/applications`);

  const pendingRow = LIST(page).getByRole("listitem").filter({ hasText: "Kính gửi nhà tuyển dụng" });
  const select = pendingRow.locator("select");
  await expect(select.locator("option")).toHaveText(["Chọn trạng thái mới", "Đã xem", "Không đậu"]);
  await select.selectOption("reviewed");
  await pendingRow.getByRole("button", { name: "Cập nhật" }).click();

  await expect(page.getByText("Đã cập nhật trạng thái ứng viên thành: Đã xem")).toBeVisible();
  expect(mocks.puts).toHaveLength(1);
  expect(mocks.puts[0].url()).toContain(`/api/applications/${APP_PENDING}/status`);
  expect(mocks.puts[0].postDataJSON()).toEqual({ status: "reviewed" });
});

test("accepted application is terminal: no status control", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await mockApplications(page);
  await page.goto(`/recruiter/jobs/${JOB_ID}/applications`);

  const acceptedRow = LIST(page).getByRole("listitem").filter({ hasText: "Nhận việc" });
  await expect(acceptedRow.getByText("Đã kết thúc quy trình")).toBeVisible();
  await expect(acceptedRow.locator("select")).toHaveCount(0);
});

test("a 409 from the server is shown in Vietnamese, not the English backend message", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await mockApplications(page, { putStatus: 409 });
  await page.goto(`/recruiter/jobs/${JOB_ID}/applications`);

  const pendingRow = LIST(page).getByRole("listitem").filter({ hasText: "Kính gửi nhà tuyển dụng" });
  await pendingRow.locator("select").selectOption("reviewed");
  await pendingRow.getByRole("button", { name: "Cập nhật" }).click();

  await expect(page.getByText("Trạng thái hồ sơ đã thay đổi.")).toBeVisible();
  await expect(page.getByText("Invalid status transition")).toHaveCount(0);
});

test("status filter is in the URL and is sent to the API", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  const mocks = await mockApplications(page);
  await page.goto(`/recruiter/jobs/${JOB_ID}/applications`);

  await page.getByRole("button", { name: "Đã xem" }).click();
  await expect(page).toHaveURL(/status=reviewed/);
  await expect(LIST(page).getByRole("listitem")).toHaveCount(1);
  expect(mocks.listCalls.some((r) => new URL(r.url()).searchParams.get("status") === "reviewed")).toBe(true);
});

test("job list links to the job's applications", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await mockApplications(page);
  await page.route(
    (url) => url.pathname.endsWith("/api/jobs/recruiter"),
    (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: JOB_ID,
              title: "Lập trình viên React",
              description: "Mô tả.",
              companyId: "33333333-3333-3333-3333-333333333333",
              location: "Hà Nội",
              status: "Active",
              createdAt: "2026-11-01T08:00:00Z",
              updatedAt: "2026-11-01T08:00:00Z",
              salaryMin: 0,
              salaryMax: 0,
              salaryCurrency: "VND",
              employmentType: "FullTime",
              experienceLevel: "Entry",
              recruiterId: "e2e-Recruiter",
              viewCount: 0,
            },
          ],
          total: 1,
          page: 1,
          size: 10,
          totalPages: 1,
        },
      }),
  );
  await page.goto("/recruiter/jobs");
  await page.getByRole("link", { name: "Xem ứng viên" }).click();
  await expect(page).toHaveURL(new RegExp(`/recruiter/jobs/${JOB_ID}/applications$`));
});

test("a User is redirected away from the recruiter applications page and sees no applications", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "User");
  const mocks = await mockApplications(page);
  await page.goto(`/recruiter/jobs/${JOB_ID}/applications`);

  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByText("Khu vực này chỉ dành cho nhà tuyển dụng.")).toBeVisible();
  expect(mocks.listCalls).toHaveLength(0);
});

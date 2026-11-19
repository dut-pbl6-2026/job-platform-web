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
    applicantName: "Trần Thị Bình",
    applicantEmail: "candidate.binh@e2e.local",
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
    applicantName: "Lê Minh Cường",
    applicantEmail: "candidate.cuong@e2e.local",
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
    applicantName: "Phạm Thu Dung",
    applicantEmail: "candidate.dung@e2e.local",
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

/** A valid one-page PDF: pdf.js refuses a bare header, so the viewer test needs real bytes. */
function minimalPdf(): Buffer {
  const stream = "BT /F1 12 Tf 72 720 Td (E2E CV) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

const SCORE_DETAIL = {
  overall_score: 78,
  band: "Strong",
  breakdown: {
    skills: {
      score: 100,
      matching: ["marketing"],
      missing: [],
      negated: [],
      extra: ["seo"],
      evidence: { marketing: "Content and performance marketer." },
    },
    semantic: {
      score: 60,
      title_fit: 0.8,
      top_matches: [{ requirement: "SEO", cv_excerpt: "SEO plan", similarity: 0.7 }],
    },
    experience: { score: 100, cv_years: 3, required_years: 2 },
    education: { score: 100, cv_level: "bachelor", required_level: "bachelor" },
  },
  suggestions: ["Add measurable results to your CV."],
  warnings: [],
  meta: { parser: "text", pages: 1, language: "en", model: "test", cached: false, elapsed_ms: 1200 },
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

const ROWS = (page: Page) => page.locator(".jp-apps-table tbody tr");
const TABLE = (page: Page) => page.getByRole("table", { name: "Danh sách hồ sơ ứng tuyển" });

test("recruiter sees the job's applications as a table with score and status", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await mockApplications(page);
  await page.goto(`/recruiter/jobs/${JOB_ID}/applications`);

  await expect(page.getByRole("heading", { level: 1, name: "Hồ sơ ứng viên: Lập trình viên React" })).toBeVisible();
  await expect(TABLE(page)).toBeVisible();
  await expect(ROWS(page)).toHaveCount(3);
  await expect(ROWS(page).filter({ hasText: "Trần Thị Bình" })).toContainText("candidate.binh@e2e.local");
  await expect(ROWS(page).filter({ hasText: "Lê Minh Cường" })).toContainText("Nhận việc");
  await expect(page.getByText(APPLICANT_ID)).toHaveCount(0);
  await expect(page.getByText(APP_PENDING)).toHaveCount(0);
});

test("a row opens the application page and the name opens the public profile", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await mockApplications(page);
  await page.goto(`/recruiter/jobs/${JOB_ID}/applications`);
  await expect(ROWS(page)).toHaveCount(3);

  const pending = ROWS(page).filter({ hasText: "Trần Thị Bình" });
  await expect(pending.getByRole("link", { name: "Xem hồ sơ công khai của Trần Thị Bình" })).toHaveAttribute(
    "href",
    `/candidates/${APPLICANT_ID}`,
  );
  await expect(pending.getByRole("link", { name: "Trần Thị Bình", exact: true })).toHaveAttribute(
    "href",
    `/candidates/${APPLICANT_ID}`,
  );

  // Clicking the row itself (not a link or a control) opens the application.
  await pending.locator("td").nth(1).click();
  await expect(page).toHaveURL(new RegExp(`/recruiter/applications/${APP_PENDING}$`));
});

test("recruiter moves a pending application to reviewed, and only legal next steps are offered", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  const mocks = await mockApplications(page);
  await page.goto(`/recruiter/jobs/${JOB_ID}/applications`);

  const pendingRow = ROWS(page).filter({ hasText: "candidate.binh@e2e.local" });
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

  const accepted = ROWS(page).filter({ hasText: "Lê Minh Cường" });
  await expect(accepted.locator("select")).toHaveCount(0);
  await expect(accepted).toContainText("Nhận việc");
});

test("a 409 from the server is shown in Vietnamese, not the English backend message", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await mockApplications(page, { putStatus: 409 });
  await page.goto(`/recruiter/jobs/${JOB_ID}/applications`);

  const pendingRow = ROWS(page).filter({ hasText: "candidate.binh@e2e.local" });
  await pendingRow.locator("select").selectOption("reviewed");
  await pendingRow.getByRole("button", { name: "Cập nhật" }).click();

  await expect(page.getByText("Trạng thái hồ sơ đã thay đổi")).toBeVisible();
  await expect(page.getByText("Invalid status transition")).toHaveCount(0);
});

test("status filter is in the URL and is sent to the API", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  const mocks = await mockApplications(page);
  await page.goto(`/recruiter/jobs/${JOB_ID}/applications`);

  await page.getByRole("button", { name: "Đã xem" }).click();

  await expect(page).toHaveURL(/status=reviewed/);
  await expect.poll(() => mocks.listCalls.at(-1)?.url().includes("status=reviewed")).toBe(true);
  await expect(ROWS(page)).toHaveCount(1);
});

test("the application page shows the cover letter, the CV in the page and the score report without advice", async ({
  page,
}) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await mockApplications(page);
  await page.route(
    (url) => url.pathname === `/api/applications/${APP_PENDING}`,
    (route) =>
      route.fulfill({
        json: {
          ...APPLICATIONS[0],
          recruiterNotes: null,
          score: 78,
          scoreStatus: "done",
          scoreDetail: SCORE_DETAIL,
          statusHistory: [],
          nextAllowedStatuses: ["reviewed"],
        },
      }),
  );
  await page.route("**/api/applications/cv/e2e.pdf", (route) =>
    route.fulfill({ status: 200, contentType: "application/pdf", body: minimalPdf() }),
  );

  await page.goto(`/recruiter/applications/${APP_PENDING}`);

  await expect(page.getByRole("heading", { level: 1, name: "Trần Thị Bình" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thư ứng tuyển" })).toBeVisible();
  await expect(page.getByText("Tôi có 3 năm làm React.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Điểm phù hợp AI" })).toBeVisible();
  await expect(page.getByText("Rất phù hợp")).toBeVisible();
  // The report is the candidate-facing one minus the improvement advice.
  await expect(page.getByText("Gợi ý cải thiện CV")).toHaveCount(0);
  await expect(page.getByText("Add measurable results to your CV.")).toHaveCount(0);

  // The CV is rendered by the app itself, so it shows even where the browser has no PDF viewer.
  await expect(page.locator("canvas.jp-cv-page").first()).toBeVisible({ timeout: 15_000 });
});

test("the CV keeps the browser viewer's frame when the browser has one", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await mockApplications(page);
  // Chrome/Edge/Firefox report a built-in viewer; headless does not, which is why the default test
  // above sees the pdf.js canvases instead.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "pdfViewerEnabled", { configurable: true, get: () => true });
  });
  await page.route(
    (url) => url.pathname === `/api/applications/${APP_PENDING}`,
    (route) =>
      route.fulfill({
        json: {
          ...APPLICATIONS[0],
          recruiterNotes: null,
          score: 78,
          scoreStatus: "done",
          scoreDetail: SCORE_DETAIL,
          statusHistory: [],
          nextAllowedStatuses: ["reviewed"],
        },
      }),
  );
  await page.route("**/api/applications/cv/e2e.pdf", (route) =>
    route.fulfill({ status: 200, contentType: "application/pdf", body: minimalPdf() }),
  );

  await page.goto(`/recruiter/applications/${APP_PENDING}`);

  const frame = page.locator("iframe.jp-cv-frame");
  await expect(frame).toBeVisible();
  await expect.poll(() => frame.getAttribute("src")).toMatch(/^blob:/);
  await expect(page.locator("canvas.jp-cv-page")).toHaveCount(0);
});

test("job list links to the job's applications", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await page.route("**/api/jobs/recruiter**", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: JOB_ID,
            title: "Lập trình viên React",
            location: "Hà Nội",
            status: "Active",
            createdAt: "2026-11-01T08:00:00Z",
            updatedAt: "2026-11-01T08:00:00Z",
          },
        ],
        total: 1,
        page: 1,
        size: 10,
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

  await expect(page).toHaveURL(/\/jobs/);
  expect(mocks.listCalls).toHaveLength(0);
  expect(mocks.puts).toHaveLength(0);
});

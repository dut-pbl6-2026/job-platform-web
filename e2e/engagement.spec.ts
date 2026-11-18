import { expect, test, type Page, type Request } from "@playwright/test";

/**
 * Recruiter engagement surfaces: the candidate board, saved email templates, the interview dialog and
 * the notification bell. The backend is mocked at the gateway boundary; the assertions are on what the
 * UI sends and shows, plus the accessible names a keyboard user relies on.
 */

const COMPANY_ID = "33333333-3333-3333-3333-333333333333";
const JOB_ID = "11111111-1111-1111-1111-111111111111";
const APPLICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const JOB = {
  id: JOB_ID,
  title: "Lập trình viên React",
  description: "Phát triển giao diện.",
  location: "Đà Nẵng",
  companyId: COMPANY_ID,
  companyName: "Công ty thử nghiệm",
  categoryId: "",
  employmentType: "FullTime",
  experienceLevel: "Mid",
  salaryMin: 15000000,
  salaryMax: 25000000,
  salaryCurrency: "VND",
  status: "active",
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
};

const APPLICATION = {
  id: APPLICATION_ID,
  jobId: JOB_ID,
  applicantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  applicantName: "Trần Thị Bình",
  applicantEmail: "candidate.binh@jobplatform.local",
  status: "pending",
  cvUrl: null,
  coverLetter: "Tôi quan tâm tới vị trí này.",
  score: 82,
  scoringStatus: "done",
  createdAt: "2026-11-10T08:00:00Z",
  updatedAt: "2026-11-10T08:00:00Z",
};

async function offlineBackend(page: Page) {
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
}

async function signIn(page: Page, role: "User" | "Recruiter" = "Recruiter") {
  await page.addInitScript(() => localStorage.setItem("accessToken", "e2e-token"));
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        id: `e2e-${role}`,
        email: `${role.toLowerCase()}@e2e.local`,
        fullName: "Nhà tuyển dụng thử",
        role,
        isActive: true,
        companyId: role === "Recruiter" ? COMPANY_ID : null,
      },
    }),
  );
}

async function mockEngagement(page: Page) {
  const calls: { method: string; path: string; body: Record<string, unknown> | null; request: Request }[] = [];
  const record = (route: Parameters<Parameters<typeof page.route>[1]>[0]) => {
    const request = route.request();
    const body = request.method() === "GET" ? null : request.postDataJSON();
    calls.push({ method: request.method(), path: new URL(request.url()).pathname, body, request });
  };

  await page.route(
    (url) => url.pathname === "/api/jobs/recruiter",
    (route) => {
      record(route);
      route.fulfill({ json: { items: [JOB], total: 1, page: 1, size: 100, totalPages: 1 } });
    },
  );
  await page.route(
    (url) => url.pathname === `/api/applications/job/${JOB_ID}`,
    (route) => {
      record(route);
      route.fulfill({ json: { items: [APPLICATION], total: 1, page: 1, size: 100, totalPages: 1 } });
    },
  );
  await page.route(
    (url) => url.pathname === `/api/applications/${APPLICATION_ID}/status`,
    (route) => {
      record(route);
      route.fulfill({ json: { status: "reviewed" } });
    },
  );
  await page.route("**/api/applications/status-flow", (route) =>
    route.fulfill({
      json: {
        all_statuses: ["pending", "reviewed", "shortlisted", "accepted", "rejected"],
        terminal_statuses: ["accepted", "rejected"],
        transitions: {
          pending: ["reviewed", "rejected"],
          reviewed: ["shortlisted", "rejected"],
          shortlisted: ["accepted", "rejected"],
          accepted: [],
          rejected: [],
        },
      },
    }),
  );

  const templates: Record<string, unknown>[] = [];
  await page.route("**/api/email-templates", (route) => {
    record(route);
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const created = {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        ...body,
        createdAt: "2026-11-16T00:00:00Z",
        updatedAt: "2026-11-16T00:00:00Z",
      };
      templates.push(created);
      route.fulfill({ status: 201, json: created });
      return;
    }
    route.fulfill({ json: templates });
  });

  const interviews: Record<string, unknown>[] = [];
  await page.route("**/api/interviews", (route) => {
    record(route);
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const interview = {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        applicationId: APPLICATION_ID,
        jobId: JOB_ID,
        jobTitle: JOB.title,
        companyId: COMPANY_ID,
        applicantId: APPLICATION.applicantId,
        applicantName: APPLICATION.applicantName,
        applicantEmail: APPLICATION.applicantEmail,
        recruiterId: "e2e-Recruiter",
        recruiterName: "Nhà tuyển dụng thử",
        recruiterEmail: "recruiter@e2e.local",
        startsAtUtc: body.startsAtUtc,
        endsAtUtc: body.startsAtUtc,
        durationMinutes: body.durationMinutes,
        mode: body.mode,
        location: body.location ?? null,
        notes: body.notes ?? null,
        status: "scheduled",
        calendarUid: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        createdAt: "2026-11-16T00:00:00Z",
      };
      interviews.push(interview);
      route.fulfill({ status: 201, json: { interview, inviteSent: true, inviteError: null } });
      return;
    }
    route.fulfill({ json: interviews });
  });

  return calls;
}

test("candidate board moves an application through the status machine", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page);
  const calls = await mockEngagement(page);
  await page.goto("/recruiter/candidates");

  await expect(page.getByRole("heading", { name: "Quản lý ứng viên" })).toBeVisible();
  const card = page.locator(".jp-cand-card").filter({ hasText: "Trần Thị Bình" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("candidate.binh@jobplatform.local");

  // Dragging is the only way to move a card: no per-card select.
  await expect(card.getByRole("combobox")).toHaveCount(0);

  // HTML5 drag and drop: the same DataTransfer has to travel from the card to the target column.
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  const reviewedColumn = page.locator(".jp-kanban-col.is-reviewed");
  await card.dispatchEvent("dragstart", { dataTransfer });
  await reviewedColumn.dispatchEvent("dragover", { dataTransfer });
  await reviewedColumn.dispatchEvent("drop", { dataTransfer });

  await expect
    .poll(() => calls.find((call) => call.path.endsWith(`/${APPLICATION_ID}/status`))?.body)
    .toEqual({ status: "reviewed" });
});

test("a recruiter saves a reusable email template", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page);
  const calls = await mockEngagement(page);
  await page.goto("/recruiter/email-templates");

  await page.getByRole("button", { name: "Mẫu mới" }).click();
  await page.getByLabel("Tên mẫu").fill("Mời phỏng vấn vòng 1");
  await page.getByLabel("Tiêu đề").fill("Mời phỏng vấn vị trí {{job_title}}");
  await page.getByLabel("Nội dung").fill("Chào {{candidate_name}}, hẹn bạn phỏng vấn.");
  await page.getByRole("button", { name: "Lưu mẫu" }).click();

  await expect(page.locator(".jp-template-card")).toContainText("Mời phỏng vấn vòng 1");
  const post = calls.find((call) => call.method === "POST" && call.path === "/api/email-templates");
  expect(post?.body).toMatchObject({
    name: "Mời phỏng vấn vòng 1",
    subject: "Mời phỏng vấn vị trí {{job_title}}",
  });
});

test("scheduling from a candidate card sends the interview and shows the confirmation", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page);
  const calls = await mockEngagement(page);
  await page.goto("/recruiter/candidates");

  await page.getByRole("button", { name: /Đặt lịch phỏng vấn với Trần Thị Bình/ }).click();
  const dialog = page.getByRole("dialog", { name: "Đặt lịch phỏng vấn" });
  await expect(dialog).toBeVisible();
  // The invite always carries the .ics file, so there is nothing to tick or explain.
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  await expect(dialog).not.toContainText(".ics");
  await dialog.getByLabel("Liên kết cuộc họp").fill("https://meet.example.vn/phong-van");
  await dialog.getByRole("button", { name: "Tạo lịch" }).click();

  await expect(page.getByText("Đã tạo lịch và gửi thư mời.")).toBeVisible();
  const post = calls.find((call) => call.method === "POST" && call.path === "/api/interviews");
  expect(post?.body).toMatchObject({
    applicationId: APPLICATION_ID,
    durationMinutes: 45,
    mode: "online",
    location: "https://meet.example.vn/phong-van",
    sendInvite: true,
  });
});

test("the bell counts recent activity and opens a readable feed", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page);
  await mockEngagement(page);
  await page.goto("/recruiter/candidates");

  const bell = page.getByRole("button", { name: "Thông báo" });
  await expect(bell).toBeVisible();
  await bell.click();

  const panel = page.getByRole("dialog", { name: "Thông báo" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Hồ sơ mới cho Lập trình viên React");
  await expect(panel).toContainText("Trần Thị Bình");
});

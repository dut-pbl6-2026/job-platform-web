import { expect, test, type Page, type TestInfo } from "@playwright/test";

/**
 * Screenshots of every screen for design review, written to screenshots/<project>/<name>.png.
 * Not a visual regression suite: nothing is compared, the images are for people to look at.
 */

type Role = "User" | "Recruiter" | "Admin";

/** Backend unreachable: with VITE_ENABLE_MOCKS=true the app shows its mock data. */
async function offlineBackend(page: Page) {
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
}

/** A signed-in session without auth-svc: a token in storage and a canned /auth/me. */
async function signIn(page: Page, role: Role) {
  await page.addInitScript(() => localStorage.setItem("accessToken", "e2e-token"));
  // Registered after offlineBackend, so it takes precedence for this URL.
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
}

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  // Mock calls resolve after a short timer; wait until no skeleton placeholder is left.
  await expect(page.locator('[class*="skeleton"]')).toHaveCount(0, { timeout: 10_000 });
  await page.screenshot({ path: `screenshots/${testInfo.project.name}/${name}.png`, fullPage: true });
}

const GUEST_SCREENS: [name: string, path: string][] = [
  ["home", "/"],
  ["not-found", "/khong-co-trang-nay"],
  ["jobs", "/jobs"],
  ["jobs-empty", "/jobs?q=zzzzqqq"],
  [
    "jobs-filtered",
    "/jobs?experienceLevel=Mid&employmentType=FullTime&minSalary=5000000&maxSalary=10000000&sort=salary_desc",
  ],
  ["job-detail", "/jobs/seed-1"],
  ["job-not-found", "/jobs/khong-ton-tai"],
  ["login", "/login"],
  ["register", "/register"],
  ["forgot-password", "/forgot-password"],
  ["reset-password", "/reset-password?token=abc"],
];

const SIGNED_IN_SCREENS: [name: string, role: Role, path: string][] = [
  ["job-detail-user", "User", "/jobs/seed-1"],
  ["job-detail-recruiter", "Recruiter", "/jobs/seed-1"],
  ["apply", "User", "/jobs/seed-1/apply"],
  ["profile", "User", "/profile"],
  ["applications", "User", "/applications"],
  ["recruiter-dashboard", "Recruiter", "/recruiter"],
  ["admin-dashboard", "Admin", "/admin"],
  ["admin-jobs", "Admin", "/admin/jobs"],
  ["admin-users", "Admin", "/admin/users"],
];

for (const [name, path] of GUEST_SCREENS) {
  test(`guest ${name}`, async ({ page }, testInfo) => {
    await offlineBackend(page);
    await page.goto(path);
    await shoot(page, testInfo, name);
  });
}

for (const [name, role, path] of SIGNED_IN_SCREENS) {
  test(`${role} ${name}`, async ({ page }, testInfo) => {
    await offlineBackend(page);
    await signIn(page, role);
    await page.goto(path);
    await shoot(page, testInfo, name);
  });
}

const PDF = { name: "cv-nguyen-van-a.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 e2e") };

async function openApply(page: Page) {
  await offlineBackend(page);
  await signIn(page, "User");
  await page.goto("/jobs/seed-1/apply");
  await expect(page.getByRole("heading", { name: "Gửi hồ sơ ứng tuyển" })).toBeVisible();
}

test("apply: file of the wrong type", async ({ page }, testInfo) => {
  await openApply(page);
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "anh.png", mimeType: "image/png", buffer: Buffer.from("png") });
  await expect(page.getByText("Chỉ nhận PDF, DOC hoặc DOCX")).toBeVisible();
  await shoot(page, testInfo, "apply-wrong-type");
});

test("apply: file over 5 MB", async ({ page }, testInfo) => {
  await openApply(page);
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "cv-lon.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(page.getByText("File tối đa 5 MB")).toBeVisible();
  await shoot(page, testInfo, "apply-too-large");
});

test("apply: no file chosen", async ({ page }, testInfo) => {
  await openApply(page);
  await page.getByRole("button", { name: "Gửi hồ sơ", exact: true }).click();
  await expect(page.getByText("Hãy chọn file CV")).toBeVisible();
  await expect(page.getByRole("button", { name: /File CV/ })).toBeFocused();
  await shoot(page, testInfo, "apply-no-file");
});

test("apply: success, then 409 on the same job", async ({ page }, testInfo) => {
  await openApply(page);
  await page.locator('input[type="file"]').setInputFiles(PDF);
  await expect(page.getByText(PDF.name)).toBeVisible();
  await shoot(page, testInfo, "apply-file-chosen");
  await page.getByRole("button", { name: "Gửi hồ sơ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Đã gửi hồ sơ" })).toBeFocused();
  await expect(page.getByText(PDF.name)).toBeVisible(); // the success screen repeats the CV file name
  await shoot(page, testInfo, "apply-success");

  // The mock store remembers the first application: the second one is a duplicate.
  await page.goto("/jobs/seed-1/apply");
  await page.locator('input[type="file"]').setInputFiles(PDF);
  await page.getByRole("button", { name: "Gửi hồ sơ", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "đã nộp hồ sơ cho tin này" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Xem đơn đã nộp" })).toBeVisible();
  await shoot(page, testInfo, "apply-duplicate");
});

/**
 * Layout checks that need no eyes: nothing pushes the page wider than the viewport, and every
 * control a finger has to hit is at least 44px in both directions (WCAG 2.5.8 / plan §2.2).
 */
async function expectSoundLayout(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);
  const small = await page.evaluate(() => {
    const sel =
      'main button, main input:not([type="checkbox"]):not([type="radio"]):not([hidden]), main select, main textarea, main a.jp-btn, main [role="combobox"]';
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 43.5 || r.width < 43.5)
      .map(
        ({ el, r }) =>
          `${el.tagName.toLowerCase()}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`,
      );
  });
  expect(small, "controls under 44px").toEqual([]);
}

const LAYOUT_ROUTES: [name: string, role: Role | null, path: string][] = [
  ["apply", "User", "/jobs/seed-1/apply"],
  ["login", null, "/login"],
  ["login with next", null, "/login?next=%2Fjobs%2Fseed-1%2Fapply"],
  ["register", null, "/register"],
  ["forgot-password", null, "/forgot-password"],
  ["reset-password", null, "/reset-password?token=abc"],
];

for (const [name, role, path] of LAYOUT_ROUTES) {
  test(`layout ${name}`, async ({ page }) => {
    await offlineBackend(page);
    if (role) await signIn(page, role);
    await page.goto(path);
    await expect(page.locator('[class*="skeleton"]')).toHaveCount(0, { timeout: 10_000 });
    await expectSoundLayout(page);
  });
}

test("login: empty submit names the problem next to each field", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible(); // a real <label>, not a placeholder
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).last().click();
  await expect(page.getByText("Email là bắt buộc")).toBeVisible();
  await expect(page.getByText("Hãy nhập mật khẩu")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeFocused();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  await shoot(page, testInfo, "login-errors");
});

test("login: wrong password", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ status: 401, json: { message: "Invalid credentials" } }),
  );
  await page.goto("/login");
  await page.getByLabel("Email").fill("a@e2e.local");
  await page.getByLabel(/^Mật khẩu/).fill("sai-mat-khau");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).last().click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Kiểm tra lại thông tin đăng nhập hoặc xác minh email của bạn." }),
  ).toBeVisible();
  await shoot(page, testInfo, "login-wrong-password");
});

test("login: coming from a job says where you go back to", async ({ page }) => {
  await offlineBackend(page);
  await page.goto("/login?next=%2Fjobs%2Fseed-1%2Fapply");
  await expect(page.getByText("Đăng nhập xong, bạn quay lại trang đang xem.")).toBeVisible();
});

test("register: password rules are visible up front and tick as met", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await page.goto("/register");
  const rules = page.locator(".jp-rules");
  await expect(rules).toBeVisible();
  await expect(rules.getByText("(chưa đạt)")).toHaveCount(3);
  await page.getByLabel(/^Mật khẩu/).fill("Abcdefg1");
  await expect(rules.getByText("(đã đạt)")).toHaveCount(3);
  await page.getByLabel(/^Mật khẩu/).fill("abcdefg1");
  await expect(rules.getByText("(đã đạt)")).toHaveCount(2); // no capital letter yet
  await shoot(page, testInfo, "register-password-rules");
});

test("register: empty submit, role switch has aria-pressed", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await page.goto("/register");
  await expect(page.getByRole("button", { name: "Ứng viên", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Nhà tuyển dụng", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByRole("button", { name: "Đăng ký ứng viên" }).click();
  await expect(page.getByText("Họ tên là bắt buộc")).toBeVisible();
  await expect(page.getByLabel("Họ và tên")).toBeFocused();
  await shoot(page, testInfo, "register-errors");
});

test("forgot password: success message", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await page.route("**/api/auth/forgot-password", (route) =>
    route.fulfill({ status: 200, json: { message: "Nếu email tồn tại, liên kết đặt lại đã được gửi" } }),
  );
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("a@e2e.local");
  await page.getByRole("button", { name: "Gửi liên kết đặt lại" }).click();
  await expect(page.getByRole("status").filter({ hasText: "liên kết đặt lại đã được gửi" })).toBeVisible();
  await shoot(page, testInfo, "forgot-password-sent");
});

test("forgot password: rate limit shows Vietnamese copy, not the backend text", async ({ page }) => {
  await offlineBackend(page);
  await page.route("**/api/auth/forgot-password", (route) =>
    route.fulfill({
      status: 429,
      json: {
        status: 429,
        title: "Too Many Requests",
        detail: "Forgot password request limit exceeded. Please try again later.",
      },
    }),
  );
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("a@e2e.local");
  await page.getByRole("button", { name: "Gửi liên kết đặt lại" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Bạn đã gửi quá nhiều yêu cầu");
  await expect(alert).not.toContainText("limit exceeded");
});

test("reset password: expired token offers a new link", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await page.route("**/api/auth/reset-password", (route) =>
    route.fulfill({ status: 401, json: { message: "Invalid token" } }),
  );
  await page.goto("/reset-password?token=het-han");
  await page.getByLabel(/^Mật khẩu mới/).fill("Abcdefg1");
  await page.getByLabel("Nhập lại mật khẩu mới").fill("Abcdefg1");
  await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Mã đặt lại không hợp lệ hoặc đã hết hạn." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nhận liên kết mới" })).toBeVisible();
  await shoot(page, testInfo, "reset-password-expired");
});

test("reset password: mismatch is reported on the confirm field", async ({ page }) => {
  await offlineBackend(page);
  await page.goto("/reset-password");
  await page.getByLabel("Mã đặt lại").fill("abc");
  await page.getByLabel(/^Mật khẩu mới/).fill("Abcdefg1");
  await page.getByLabel("Nhập lại mật khẩu mới").fill("Khac12345");
  await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
  await expect(page.getByText("Xác nhận mật khẩu không khớp")).toBeVisible();
  await expect(page.getByLabel("Nhập lại mật khẩu mới")).toBeFocused();
});

test("guest jobs load error", async ({ page }, testInfo) => {
  // A 4xx is never replaced by mock data, so the error state with its retry button shows.
  await offlineBackend(page);
  await page.route("**/api/search/**", (route) => route.fulfill({ status: 400, json: { message: "Bad request" } }));
  await page.goto("/jobs");
  await shoot(page, testInfo, "jobs-error");
});

test("guest jobs first viewport", async ({ page }, testInfo) => {
  // What a visitor sees before scrolling: the brief requires the first job inside this frame.
  await offlineBackend(page);
  await page.goto("/jobs");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[class*="skeleton"]')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator(".jp-row").first()).toBeInViewport();
  await page.screenshot({ path: `screenshots/${testInfo.project.name}/jobs-viewport.png` });
});

test("guest jobs filter drawer", async ({ page }, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1100, "the drawer only exists below 1100px");
  await offlineBackend(page);
  await page.goto("/jobs");
  await expect(page.locator('[class*="skeleton"]')).toHaveCount(0, { timeout: 10_000 });
  await page.getByRole("button", { name: /Bộ lọc/ }).click();
  await expect(page.getByRole("dialog", { name: "Bộ lọc" })).toBeVisible();
  await page.waitForTimeout(400); // let the slide-in finish
  await page.screenshot({ path: `screenshots/${testInfo.project.name}/jobs-drawer.png` });
});

test("fonts are self-hosted", async ({ page }) => {
  const external: string[] = [];
  const local: string[] = [];
  page.on("request", (req) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(req.url())) external.push(req.url());
  });
  page.on("response", (res) => {
    if (/\/fonts\/be-vietnam-pro-.*\.woff2$/.test(res.url()) && res.ok()) local.push(res.url());
  });
  await offlineBackend(page);
  await page.goto("/jobs");
  await page.evaluate(() => document.fonts.ready);
  // document.fonts.check() is also true when no face matches at all, so look at the faces themselves.
  const loadedWeights = await page.evaluate(() =>
    [...document.fonts]
      .filter((f) => f.family.includes("Be Vietnam Pro") && f.status === "loaded")
      .map((f) => f.weight),
  );
  expect(loadedWeights.length).toBeGreaterThan(0);
  expect(local.length).toBeGreaterThan(0);
  expect(external).toEqual([]);
});

/* Candidate account (S7) --------------------------------------------------------------------------- */

type Status = "pending" | "reviewed" | "shortlisted" | "accepted" | "rejected";

function application(n: number, status: Status, extra: Record<string, unknown> = {}) {
  return {
    id: `app-${n}`,
    jobId: "seed-1",
    jobTitle: `Lập trình viên Frontend React ${n}`,
    companyName: "Công ty TNHH Phần mềm Đà Nẵng",
    location: n % 4 === 0 ? "Remote" : "Đà Nẵng",
    applicantId: "e2e-User",
    status,
    coverLetter: null,
    cvFileName: "cv-nguyen-van-a.pdf",
    cvUrl: "/files/cv-nguyen-van-a.pdf",
    createdAt: `2026-11-0${(n % 5) + 1}T09:30:00Z`,
    updatedAt: `2026-11-0${(n % 5) + 1}T09:30:00Z`,
    ...extra,
  };
}

const ALL_STATUSES: Status[] = ["pending", "reviewed", "shortlisted", "accepted", "rejected"];

/** app-svc is 1-based and answers { items, total, page, size }; the filter in the URL is passed through. */
async function applicationsFromBackend(page: Page, items: object[], requests: string[] = []) {
  await page.route(/\/api\/applications\/me(\?|$)/, (route) => {
    const url = new URL(route.request().url());
    requests.push(url.search);
    const status = url.searchParams.get("status");
    const rows = status ? items.filter((a) => (a as { status: string }).status === status) : items;
    return route.fulfill({ json: { items: rows, total: rows.length, page: 1, size: 8 } });
  });
}

test("applications: board with every status, long title, remote job", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await signIn(page, "User");
  const items = [
    ...ALL_STATUSES.map((s, i) => application(i + 1, s)),
    application(6, "pending", {
      jobTitle:
        "Chuyên viên phát triển kinh doanh khu vực miền Trung và Tây Nguyên kiêm quản lý đối tác chiến lược dài hạn",
    }),
  ];
  await applicationsFromBackend(page, items);
  await page.goto("/applications");
  await expect(page.getByRole("link", { name: "Lập trình viên Frontend React 1" })).toBeVisible();
  for (const label of ["Chờ xem", "Đã xem", "Vào vòng sau", "Nhận việc", "Không đậu"]) {
    await expect(page.locator(".jp-app-row").getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText("Làm từ xa").first()).toBeVisible();
  await expect(page.getByText("6 đơn")).toBeVisible();
  await expectSoundLayout(page);
  await shoot(page, testInfo, "applications-board");
});

test("applications: the status filter asks the backend and can be cleared", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await signIn(page, "User");
  const requests: string[] = [];
  await applicationsFromBackend(
    page,
    ALL_STATUSES.map((s, i) => application(i + 1, s)),
    requests,
  );
  await page.goto("/applications");
  await expect(page.locator(".jp-app-row")).toHaveCount(5);
  await page.getByRole("button", { name: "Nhận việc" }).click();
  await expect(page).toHaveURL(/status=accepted/);
  await expect(page.locator(".jp-app-row")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Nhận việc" })).toHaveAttribute("aria-pressed", "true");
  expect(requests.some((s) => s.includes("status=accepted"))).toBe(true);
  await shoot(page, testInfo, "applications-filtered");
  await page.getByRole("button", { name: "Tất cả" }).click();
  await expect(page.locator(".jp-app-row")).toHaveCount(5);
});

test("applications: empty list, and an empty filter that offers to clear itself", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await signIn(page, "User");
  await applicationsFromBackend(page, []);
  await page.goto("/applications");
  await expect(page.getByRole("heading", { name: "Chưa có đơn nào" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Xem bảng việc làm" })).toBeVisible();
  await shoot(page, testInfo, "applications-empty");
  await page.goto("/applications?status=rejected");
  await expect(page.getByRole("heading", { name: "Không có đơn nào ở trạng thái “Không đậu”" })).toBeVisible();
  await page.getByRole("button", { name: "Xem tất cả đơn" }).click();
  await expect(page).not.toHaveURL(/status=/);
});

test("applications: load error is Vietnamese and retry works", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await signIn(page, "User");
  let fail = true;
  await page.route(/\/api\/applications\/me(\?|$)/, (route) =>
    fail
      ? route.fulfill({ status: 400, json: { message: "Bad request" } })
      : route.fulfill({ json: { items: [application(1, "pending")], total: 1, page: 1, size: 8 } }),
  );
  await page.goto("/applications");
  await expect(page.getByRole("alert").filter({ hasText: "Không tải được danh sách đơn ứng tuyển" })).toBeVisible();
  await shoot(page, testInfo, "applications-error");
  fail = false;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.locator(".jp-app-row")).toHaveCount(1);
});

test("applications: recruiter is sent to the job board with a notice", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await page.goto("/applications");
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByText("Trang này chỉ dành cho ứng viên.")).toBeVisible();
});

const DETAIL = application(1, "shortlisted", {
  coverLetter: "Kính gửi nhà tuyển dụng,\n\nTôi quan tâm đến vị trí này vì đã có 3 năm làm React.",
  statusHistory: [
    {
      id: "h2",
      applicationId: "app-1",
      status: "shortlisted",
      note: "Mời phỏng vấn vòng 2 vào thứ Sáu.",
      changedAt: "2026-11-04T08:00:00Z",
    },
    { id: "h1", applicationId: "app-1", status: "pending", note: null, changedAt: "2026-11-02T09:30:00Z" },
    { id: "h3", applicationId: "app-1", status: "reviewed", note: null, changedAt: "2026-11-03T10:15:00Z" },
  ],
});

test("application detail: status, letter, history oldest first, CV, no internal ids", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await signIn(page, "User");
  await page.route(/\/api\/applications\/app-1$/, (route) => route.fulfill({ json: DETAIL }));
  await page.goto("/applications/app-1");
  await expect(page.getByRole("heading", { level: 1, name: "Lập trình viên Frontend React 1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thư xin việc" })).toBeVisible();
  await expect(page.getByText("Mời phỏng vấn vòng 2 vào thứ Sáu.")).toBeVisible();
  const order = await page.locator(".jp-history-row .jp-status").allTextContents();
  expect(order.map((t) => t.trim())).toEqual(["Chờ xem", "Đã xem", "Vào vòng sau"]);
  await expect(page.getByRole("button", { name: /cv-nguyen-van-a\.pdf/ })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("e2e-User");
  await expect(page.locator("main")).not.toContainText("app-1");
  await expectSoundLayout(page);
  await shoot(page, testInfo, "application-detail");
});

test("application detail: unknown id and failed load", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await signIn(page, "User");
  await page.route(/\/api\/applications\/app-404$/, (route) =>
    route.fulfill({ status: 404, json: { message: "not found" } }),
  );
  await page.goto("/applications/app-404");
  await expect(page.getByRole("heading", { name: "Không tìm thấy đơn ứng tuyển." })).toBeVisible();
  await shoot(page, testInfo, "application-not-found");
  await page.route(/\/api\/applications\/app-bad$/, (route) =>
    route.fulfill({ status: 403, json: { message: "forbidden" } }),
  );
  await page.goto("/applications/app-bad");
  await expect(page.getByRole("alert").filter({ hasText: "Bạn không có quyền xem đơn ứng tuyển này" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
});

test("profile: edit info, add and delete skill, experience and education", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await signIn(page, "User");
  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 2, name: "Thông tin cá nhân" })).toBeVisible();
  await shoot(page, testInfo, "profile-empty");

  // Info: a too-short name is reported on the field, then it saves.
  await page.getByRole("button", { name: "Sửa thông tin" }).click();
  await page.getByLabel(/^Họ tên/).fill("A");
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await expect(page.getByText("Họ tên cần từ 2 ký tự.")).toBeVisible();
  await page.getByLabel(/^Họ tên/).fill("Nguyễn Văn An");
  await page.getByLabel(/^Chức danh/).fill("Lập trình viên Frontend");
  await page.getByLabel(/^Điện thoại/).fill("0905123456");
  await page.getByLabel(/^Ngày sinh/).fill("2000-01-31");
  await page.getByLabel(/^Giới thiệu ngắn/).fill("Ba năm làm React và TypeScript.");
  await shoot(page, testInfo, "profile-edit");
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await expect(page.getByText("Đã lưu hồ sơ.")).toBeVisible();
  await expect(page.locator(".jp-profile-identity strong").filter({ hasText: "Nguyễn Văn An" })).toBeVisible();
  await expect(page.getByText("31/1/2000")).toBeVisible();

  // Skill: empty name is refused; a valid one is listed; it can be deleted.
  const skills = page.locator(".jp-profile-side");
  await skills.getByRole("button", { name: "Thêm" }).click();
  await skills.getByRole("button", { name: "Lưu kỹ năng" }).click();
  await expect(skills.getByText("Nhập tên kỹ năng.")).toBeVisible();
  await skills.getByLabel(/^Tên kỹ năng/).fill("React");
  await skills.getByLabel("Mức thành thạo").selectOption("4");
  await skills.getByRole("button", { name: "Lưu kỹ năng" }).click();
  await expect(skills.getByText("Mức 4/5 · 1 năm")).toBeVisible();

  // Experience, current job: no end date field.
  const main = page.locator(".jp-profile-main");
  const experience = main.locator("section", { has: page.getByRole("heading", { name: "Kinh nghiệm làm việc" }) });
  await experience.getByRole("button", { name: "Thêm" }).click();
  await experience.getByRole("button", { name: "Lưu kinh nghiệm" }).click();
  await expect(experience.getByText("Nhập tên công ty.")).toBeVisible();
  await experience.getByLabel(/^Công ty/).fill("Công ty Phần mềm Hải Châu");
  await experience.getByLabel(/^Chức danh/).fill("Kỹ sư phần mềm");
  await experience.getByLabel(/^Bắt đầu/).fill("2022-03-01");
  await experience.getByLabel("Đang làm việc ở đây").check({ force: true });
  await expect(experience.getByLabel(/^Kết thúc/)).toHaveCount(0);
  await experience.getByRole("button", { name: "Lưu kinh nghiệm" }).click();
  await expect(experience.getByText("1/3/2022 – Hiện tại")).toBeVisible();

  // Education
  const education = main.locator("section", { has: page.getByRole("heading", { name: "Học vấn" }) });
  await education.getByRole("button", { name: "Thêm" }).click();
  await education.getByLabel(/^Trường/).fill("Đại học Bách khoa Đà Nẵng");
  await education.getByLabel(/^Bằng cấp/).fill("Kỹ sư");
  await education.getByLabel(/^Ngành/).fill("Công nghệ thông tin");
  await education.getByLabel(/^Bắt đầu/).fill("2018-09-01");
  await education.getByRole("button", { name: "Lưu học vấn" }).click();
  await expect(education.getByText("Kỹ sư · Công nghệ thông tin")).toBeVisible();
  await expect(education.getByText("Từ 1/9/2018")).toBeVisible();
  await shoot(page, testInfo, "profile-filled");
  await expectSoundLayout(page);

  await skills.getByRole("button", { name: "Xóa kỹ năng React" }).click();
  await expect(skills.getByText("Chưa có kỹ năng nào.")).toBeVisible();
  await education.getByRole("button", { name: "Xóa học vấn Đại học Bách khoa Đà Nẵng" }).click();
  await expect(education.getByText("Chưa có học vấn nào.")).toBeVisible();
});

test("profile: load error is Vietnamese and retry works", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await signIn(page, "User");
  let fail = true;
  await page.route(/\/api\/profiles\/me$/, (route) =>
    fail
      ? route.fulfill({ status: 400, json: { message: "Bad request" } })
      : route.fulfill({
          json: {
            id: "p1",
            userId: "e2e-User",
            fullName: "Người dùng thử",
            skills: [],
            experiences: [],
            education: [],
          },
        }),
  );
  await page.goto("/profile");
  await expect(page.getByRole("alert").filter({ hasText: "Không tải được hồ sơ" })).toBeVisible();
  await shoot(page, testInfo, "profile-error");
  fail = false;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Thông tin cá nhân" })).toBeVisible();
});

/* Admin (S8) ----------------------------------------------------------------------------------------- */

const STATS = {
  users: { status: "ok", total: 128, active: 120, newThisMonth: 9, byRole: { User: 100, Recruiter: 27, Admin: 1 } },
  jobs: { status: "ok", total: 340, active: 300, pending: 3 },
  applications: { status: "ok", total: 57, pending: 30, accepted: 12, rejected: 15 },
};

async function adminOverview(page: Page, stats: object = STATS) {
  await page.route(/\/api\/admin\/stats$/, (route) => route.fulfill({ json: stats }));
  await page.route(/\/api\/health$/, (route) =>
    route.fulfill({
      json: {
        status: "Degraded",
        services: [
          { name: "auth", status: "UP", latencyMs: 12 },
          { name: "job", status: "UP", latencyMs: 31 },
          { name: "application", status: "DOWN" },
        ],
      },
    }),
  );
}

test("admin dashboard: number groups, no approval shortcut, service down", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await signIn(page, "Admin");
  await adminOverview(page);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Bảng quản trị" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Duyệt .* tin chờ duyệt/ })).toHaveCount(0);
  await expect(page.locator(".jp-stat", { hasText: "Nhà tuyển dụng" })).toContainText("27");
  await expect(page.locator(".jp-stat", { hasText: "Nhận việc" })).toContainText("12");
  await expect(page.getByText("Không phản hồi")).toBeVisible();
  await expect(page.getByText("Hoạt động", { exact: true }).first()).toBeVisible();
  // The workspace sidebar marks where you are (behind Menu on a phone).
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  if (await menu.isVisible()) await menu.click();
  await expect(page.getByRole("link", { name: "Tổng quan" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("footer")).toHaveCount(0);
  await expectSoundLayout(page);
  await shoot(page, testInfo, "admin-dashboard-data");
});

test("admin dashboard: a section that did not answer says so instead of showing zero", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await signIn(page, "Admin");
  await adminOverview(page, { ...STATS, applications: { status: "unavailable" } });
  await page.goto("/admin");
  await expect(page.getByRole("status").filter({ hasText: "Chưa lấy được số liệu đơn ứng tuyển" })).toBeVisible();
  await expect(page.locator(".jp-stat", { hasText: "Nhận việc" })).toContainText("Chưa có số liệu");
  await shoot(page, testInfo, "admin-dashboard-partial");
});

test("admin dashboard: load error is Vietnamese and retry works", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await signIn(page, "Admin");
  let fail = true;
  await page.route(/\/api\/admin\/stats$/, (route) =>
    fail ? route.fulfill({ status: 403, json: { message: "forbidden" } }) : route.fulfill({ json: STATS }),
  );
  await page.goto("/admin");
  await expect(page.getByRole("alert").filter({ hasText: "Bạn không có quyền xem số liệu thống kê" })).toBeVisible();
  await shoot(page, testInfo, "admin-dashboard-error");
  fail = false;
  await page.getByRole("button", { name: "Thử lại" }).first().click();
  await expect(page.locator(".jp-stat", { hasText: "Nhà tuyển dụng" })).toContainText("27");
});

test("admin: a candidate is sent to the job board with a notice", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "User");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByText("Khu vực này chỉ dành cho quản trị viên.")).toBeVisible();
});

type FakeJob = Record<string, unknown> & { id: string; title: string; status: string };
type FakeUser = { id: string; email: string; fullName: string; role: string; isActive: boolean; createdAt: string };

function fakeJob(id: string, title: string, status: string, input: Record<string, unknown> = {}): FakeJob {
  const now = new Date().toISOString();
  return {
    id,
    title,
    description: typeof input.description === "string" ? input.description : "Mô tả công việc thử nghiệm.",
    companyId: "company-e2e",
    companyName: "Công ty thử nghiệm",
    categoryId: "cat-e2e",
    categoryName: "Công nghệ thông tin",
    location: typeof input.location === "string" ? input.location : "Hà Nội",
    salaryMin: typeof input.salaryMin === "number" ? input.salaryMin : 15000000,
    salaryMax: typeof input.salaryMax === "number" ? input.salaryMax : 25000000,
    salaryCurrency: "VND",
    employmentType: "FullTime",
    experienceLevel: "Mid",
    skills: [],
    recruiterName: "Minh Tran",
    status,
    createdAt: now,
    updatedAt: now,
  };
}

const FAKE_USERS: FakeUser[] = [
  ["Lan Nguyen", "lan@example.com", "User", true],
  ["Minh Tran", "minh@example.com", "Recruiter", true],
  ["Hoa Pham", "hoa@example.com", "User", true],
  ["Khoa Le", "khoa@example.com", "Recruiter", false],
  ["An Do", "an@example.com", "User", true],
  ["Chi Bao", "bao@example.com", "Admin", true],
  ["Thanh Vu", "thanh@example.com", "User", true],
  ["Hoai Nguyen", "hoai@example.com", "Recruiter", true],
].map(([fullName, email, role, isActive], i) => ({
  id: `e2e-user-${i + 1}`,
  email: String(email),
  fullName: String(fullName),
  role: String(role),
  isActive: Boolean(isActive),
  createdAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
}));

/**
 * Stateful stand-in for the admin job and user endpoints, for the admin specs only. The admin screens
 * have no offline store, so each test serves these routes from the arrays below, mutated per request.
 * Routes registered later in a test (the failure cases) still take precedence over this one.
 */
async function adminBackend(page: Page) {
  const jobs: FakeJob[] = [
    ...Array.from({ length: 8 }, (_, i) => fakeJob(`pending-${i + 1}`, `Tin chờ duyệt ${i + 1}`, "Pending")),
    ...Array.from({ length: 4 }, (_, i) => fakeJob(`active-${i + 1}`, `Tin đang tuyển ${i + 1}`, "Active")),
  ];
  const users: FakeUser[] = FAKE_USERS.map((u) => ({ ...u }));

  await page.route(/\/api\/admin\//, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.slice(url.pathname.indexOf("/admin/"));
    const method = req.method();
    let body: Record<string, unknown> = {};
    try {
      body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
    } catch {
      body = {};
    }
    const size = Math.max(1, Number(url.searchParams.get("size") ?? 8));
    const current = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const paged = <T>(items: T[]) => ({
      data: items.slice((current - 1) * size, current * size),
      pagination: {
        page: current,
        pageSize: size,
        totalItems: items.length,
        totalPages: Math.max(1, Math.ceil(items.length / size)),
      },
    });
    const jobMatch = path.match(/^\/admin\/jobs\/([^/]+)(?:\/(takedown|restore|permanent))?$/);

    if (path === "/admin/jobs" && method === "GET") {
      const status = url.searchParams.get("status");
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      let items = jobs.filter((j) =>
        status ? j.status.toLowerCase() === status.toLowerCase() : j.status !== "Deleted",
      );
      if (q) items = items.filter((j) => j.title.toLowerCase().includes(q));
      return route.fulfill({ json: paged(items) });
    }
    if (path === "/admin/jobs" && method === "POST") {
      const created = fakeJob(`admin-${jobs.length + 1}`, String(body.title ?? ""), "Active", body);
      jobs.unshift(created);
      return route.fulfill({ status: 201, json: { id: created.id, message: "Đã tạo tin" } });
    }
    if (jobMatch) {
      const [, id, action] = jobMatch;
      const job = jobs.find((j) => j.id === id);
      if (!job) return route.fulfill({ status: 404, json: { message: "not found" } });
      if (!action && method === "GET") return route.fulfill({ json: job });
      if (!action && method === "PUT") {
        Object.assign(job, { ...fakeJob(id, String(body.title ?? job.title), job.status, body), status: job.status });
        return route.fulfill({ json: { message: "Đã lưu" } });
      }
      if (!action && method === "DELETE") {
        job.status = "Deleted";
        return route.fulfill({ json: { message: "Đã xóa" } });
      }
      if (action === "permanent" && method === "DELETE") {
        if (job.status !== "Deleted") return route.fulfill({ status: 409, json: { message: "conflict" } });
        jobs.splice(jobs.indexOf(job), 1);
        return route.fulfill({ json: { message: "Đã xóa vĩnh viễn" } });
      }
      if (action === "takedown" && method === "POST") {
        job.status = "Deleted";
        job.moderationReason = String(body.reason ?? "");
        job.moderatedAt = new Date().toISOString();
        return route.fulfill({ json: { message: "Đã gỡ tin" } });
      }
      if (action === "restore" && method === "POST") {
        if (job.status !== "Deleted") return route.fulfill({ status: 409, json: { message: "conflict" } });
        job.status = "Active";
        job.moderationReason = null;
        job.moderatedAt = null;
        return route.fulfill({ json: { message: "Đã khôi phục tin" } });
      }
    }
    if (path === "/admin/users" && method === "GET") {
      const q = (url.searchParams.get("search") ?? "").trim().toLowerCase();
      const role = url.searchParams.get("role");
      const isActive = url.searchParams.get("isActive");
      let items = users;
      if (q) items = items.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.includes(q));
      if (role) items = items.filter((u) => u.role === role);
      if (isActive) items = items.filter((u) => String(u.isActive) === isActive);
      return route.fulfill({ json: paged(items) });
    }
    const userMatch = path.match(/^\/admin\/users\/([^/]+)\/(activate|deactivate)$/);
    if (userMatch && method === "PATCH") {
      const user = users.find((u) => u.id === userMatch[1]);
      if (!user) return route.fulfill({ status: 404, json: { message: "not found" } });
      user.isActive = userMatch[2] === "activate";
      return route.fulfill({ json: {} });
    }
    return route.fulfill({ status: 404, json: { message: "not found" } });
  });
}

test("admin jobs: takedown requires a reason, then restore or purge", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await adminBackend(page);
  await signIn(page, "Admin");
  await page.goto("/admin/jobs");
  const rows = page.locator(".jp-queue-item");
  await expect(rows.first()).toBeVisible();
  await expect(page.locator(".jp-queue")).not.toContainText(/\b(Active|Pending|Deleted|active|pending)\b/);

  // No approval actions remain anywhere on the screen.
  await expect(page.getByRole("button", { name: /^Duyệt tin/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Từ chối tin/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tạo tin" })).toHaveCount(0);
  await expectSoundLayout(page);

  // Reading a job still works.
  const first = rows.first();
  const title = await first.locator(".jp-row-title").innerText();
  await first.getByRole("button", { name: "Xem nội dung" }).click();
  await expect(first.locator(".jp-facts")).toBeVisible();
  await expect(first.getByRole("heading", { name: "Mô tả công việc" })).toBeVisible();
  await expect(first).not.toContainText(/FullTime|Full-time|Mid\b|Senior\b/);
  await first.getByRole("button", { name: "Ẩn nội dung" }).click();

  // Takedown: an empty reason is refused next to the field; the request is not sent.
  await first.getByRole("button", { name: /^Gỡ tin / }).click();
  await expectSoundLayout(page);
  await first.getByRole("button", { name: "Xác nhận gỡ tin" }).click();
  await expect(first.getByText("Nhập lý do gỡ tin để lưu vào lịch sử kiểm duyệt.")).toBeVisible();
  await expect(first.getByLabel(/^Lý do gỡ tin/)).toHaveAttribute("aria-invalid", "true");
  await shoot(page, testInfo, "admin-jobs-takedown");
  await first.getByLabel(/^Lý do gỡ tin/).fill("Nội dung vi phạm quy định đăng tin");
  await first.getByRole("button", { name: "Xác nhận gỡ tin" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Đã gỡ tin/ })).toBeVisible();
  await expect(page.locator(".jp-queue")).not.toContainText(title);

  // Deleted filter: the stored reason is on the row, and restore brings the job back.
  await page.getByLabel("Trạng thái").selectOption("Deleted");
  const gone = rows.filter({ hasText: title });
  await expect(gone).toContainText("Nội dung vi phạm quy định đăng tin");
  await expect(gone.getByRole("button", { name: /^Khôi phục tin/ })).toBeVisible();
  await expect(gone.getByRole("button", { name: /^Sửa tin/ })).toHaveCount(0);
  await gone.getByRole("button", { name: /^Khôi phục tin/ }).click();
  await expect(gone.getByText("Khôi phục tin này?")).toBeVisible();
  await shoot(page, testInfo, "admin-jobs-restore");
  await gone.getByRole("button", { name: "Xác nhận khôi phục" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Đã khôi phục tin/ })).toBeVisible();
  await expect(rows.filter({ hasText: title })).toHaveCount(0);

  // Purge is only offered on a soft-deleted job and warns that it cannot be undone.
  await page.getByLabel("Trạng thái").selectOption("");
  const restored = rows.filter({ hasText: title });
  await expect(restored).toBeVisible();
  await restored.getByRole("button", { name: /^Gỡ tin / }).click();
  await restored.getByLabel(/^Lý do gỡ tin/).fill("Tin trùng lặp");
  await restored.getByRole("button", { name: "Xác nhận gỡ tin" }).click();
  await page.getByLabel("Trạng thái").selectOption("Deleted");
  const again = rows.filter({ hasText: title });
  await expect(again).toContainText("Tin trùng lặp");
  await again.getByRole("button", { name: /^Xóa vĩnh viễn tin/ }).click();
  await expect(again.getByText("Thao tác này không thể hoàn tác.")).toBeVisible();
  await shoot(page, testInfo, "admin-jobs-purge");
  await again.getByRole("button", { name: "Xóa vĩnh viễn", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Đã xóa vĩnh viễn" })).toBeVisible();
});

test("admin jobs: a failed list load can be retried", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await signIn(page, "Admin");
  let fail = true;
  await page.route(/\/api\/admin\/jobs\?/, (route) =>
    fail
      ? route.fulfill({ status: 400, json: { message: "bad" } })
      : route.fulfill({ json: { data: [], pagination: { page: 1, pageSize: 6, totalItems: 0, totalPages: 1 } } }),
  );
  await page.goto("/admin/jobs");
  await expect(page.getByRole("alert").filter({ hasText: "Không tải được danh sách tin" })).toBeVisible();
  await shoot(page, testInfo, "admin-jobs-error");
  fail = false;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { name: "Chưa có tin tuyển dụng" })).toBeVisible();
  await shoot(page, testInfo, "admin-jobs-empty");
});

test("admin jobs: edit a job without leaving the moderation queue", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await adminBackend(page);
  await signIn(page, "Admin");
  await page.goto("/admin/jobs");
  const rows = page.locator(".jp-queue-item");
  await expect(rows.first()).toBeVisible();
  await expectSoundLayout(page);

  const row = rows.first();
  const title = await row.locator(".jp-row-title").innerText();
  await row.getByRole("button", { name: `Sửa tin ${title}` }).click();
  await expect(row.getByLabel(/^Tiêu đề tin/)).toHaveValue(title);
  await shoot(page, testInfo, "admin-jobs-edit");
  await row.getByLabel(/^Tiêu đề tin/).fill(`${title} (đã sửa)`);
  await row.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Đã lưu thay đổi" })).toBeVisible();
  await expect(rows.filter({ hasText: `${title} (đã sửa)` })).toBeVisible();
});

test("admin users: Vietnamese roles, filters, confirm before deactivating, admins untouched", async ({
  page,
}, testInfo) => {
  await offlineBackend(page);
  await adminBackend(page);
  await signIn(page, "Admin");
  await page.goto("/admin/users");
  const rows = page.locator(".jp-table--users tbody tr");
  await expect(rows.first()).toBeVisible();
  await expect(page.locator(".jp-table--users")).not.toContainText(/\b(Recruiter|User|Admin)\b/);
  await expect(rows.filter({ hasText: "bao@example.com" })).toContainText("Quản trị viên");
  await expectSoundLayout(page);
  await shoot(page, testInfo, "admin-users");

  // The admin account has no action.
  const adminRow = rows.filter({ hasText: "bao@example.com" });
  await expect(adminRow.getByRole("button")).toHaveCount(0);
  await expect(adminRow).toContainText("Không áp dụng cho quản trị viên");

  // Deactivate: asks first, cancel leaves it as it was, confirm changes it.
  const lan = rows.filter({ hasText: "lan@example.com" });
  await expect(lan).toContainText("Đang hoạt động");
  await lan.getByRole("button", { name: "Vô hiệu hóa lan@example.com" }).click();
  await expect(lan.getByText("Vô hiệu hóa tài khoản này?")).toBeVisible();
  await shoot(page, testInfo, "admin-users-confirm");
  await lan.getByRole("button", { name: "Hủy" }).click();
  await expect(lan).toContainText("Đang hoạt động");
  await lan.getByRole("button", { name: "Vô hiệu hóa lan@example.com" }).click();
  await lan.getByRole("button", { name: "Xác nhận" }).click();
  await expect(lan).toContainText("Đã vô hiệu hóa");
  await expect(page.getByRole("status").filter({ hasText: "Đã vô hiệu hóa tài khoản lan@example.com." })).toBeVisible();
  await lan.getByRole("button", { name: "Kích hoạt lan@example.com" }).click();
  await lan.getByRole("button", { name: "Xác nhận" }).click();
  await expect(lan).toContainText("Đang hoạt động");

  // Filters live in the URL.
  await page.getByLabel("Vai trò").selectOption("Recruiter");
  await expect(page).toHaveURL(/role=Recruiter/);
  await expect(rows.filter({ hasText: "lan@example.com" })).toHaveCount(0);
  await page.getByLabel("Trạng thái").selectOption("inactive");
  await expect(
    page.getByRole("heading", { name: "Không có người dùng nào khớp bộ lọc" }).or(rows.first()),
  ).toBeVisible();
  await page.getByLabel("Vai trò").selectOption("");
  await page.getByLabel("Trạng thái").selectOption("");
  await page.getByLabel("Tên hoặc email").fill("zzzz-khong-co");
  await page.getByRole("button", { name: "Tìm" }).click();
  await expect(page.getByRole("heading", { name: "Không có người dùng nào khớp bộ lọc" })).toBeVisible();
  await shoot(page, testInfo, "admin-users-empty");
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await expect(rows.first()).toBeVisible();
});

test("admin users: a failed change keeps the old state and says why", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await adminBackend(page);
  await signIn(page, "Admin");
  await page.goto("/admin/users");
  const lan = page.locator(".jp-table--users tbody tr").filter({ hasText: "lan@example.com" });
  await expect(lan).toBeVisible();
  // A 4xx is shown, never replaced by mock success.
  await page.route(/\/api\/admin\/users\/.*\/deactivate$/, (route) =>
    route.fulfill({ status: 409, json: { message: "Cannot deactivate this account." } }),
  );
  await lan.getByRole("button", { name: "Vô hiệu hóa lan@example.com" }).click();
  await lan.getByRole("button", { name: "Xác nhận" }).click();
  // The backend text is English and is not shown: the page names the action instead.
  await expect(
    page.getByRole("alert").filter({ hasText: "Chưa cập nhật được tài khoản. Vui lòng thử lại." }),
  ).toBeVisible();
  await expect(page.getByText("Cannot deactivate", { exact: false })).toHaveCount(0);
  await expect(lan).toContainText("Đang hoạt động");
  await shoot(page, testInfo, "admin-users-error");
});

test("admin users: load error is Vietnamese and retry works", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Admin");
  let fail = true;
  await page.route(/\/api\/admin\/users\?/, (route) =>
    fail
      ? route.fulfill({ status: 400, json: { message: "bad" } })
      : route.fulfill({ json: { data: [], pagination: { page: 1, pageSize: 8, totalItems: 0, totalPages: 1 } } }),
  );
  await page.goto("/admin/users");
  await expect(page.getByRole("alert").filter({ hasText: "Không tải được danh sách người dùng" })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { name: "Chưa có người dùng" })).toBeVisible();
});

/* Deferred surfaces (S9): chat and CV scoring take the tokens, behaviour is unchanged ------------------- */

test("chat page: labelled as in development, starter question gets an answer", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await signIn(page, "User");
  await page.goto("/chat");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Trợ lý việc làm");
  await expect(page.locator("main .jp-devtag")).toBeVisible();
  // No requirement code or service name leaks into the page.
  await expect(page.locator("main")).not.toContainText(/AI-01|AI-svc/);
  await expectSoundLayout(page);
  await shoot(page, testInfo, "chat-empty");
  await page.getByRole("button", { name: "Mẹo phỏng vấn backend" }).click();
  await expect(page.locator(".chat-bubble--user")).toContainText("Mẹo phỏng vấn backend");
  await expect(page.locator(".chat-bubble--assistant").first()).toBeVisible();
  await shoot(page, testInfo, "chat-answer");
});

test("chat dock: opens from the button, can jump to the page and shrink", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await signIn(page, "User");
  await page.goto("/jobs");
  await page.getByRole("button", { name: "Mở trợ lý việc làm" }).click();
  await expect(page.getByRole("dialog", { name: "Trợ lý việc làm" })).toBeVisible();
  await shoot(page, testInfo, "chat-dock");
  await page.getByRole("button", { name: "Thu nhỏ" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Mở trợ lý việc làm" }).click();
  await page.getByRole("link", { name: "Mở trang chat" }).click();
  await expect(page).toHaveURL(/\/chat$/);
});

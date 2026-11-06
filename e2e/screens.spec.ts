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
      json: { id: `e2e-${role}`, email: `${role.toLowerCase()}@e2e.local`, fullName: "Người dùng thử", role, isActive: true },
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
  ["jobs", "/jobs"],
  ["jobs-empty", "/jobs?q=zzzzqqq"],
  ["jobs-filtered", "/jobs?experienceLevel=Mid&employmentType=FullTime&minSalary=5000000&maxSalary=10000000&sort=salary_desc"],
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
  await page.locator('input[type="file"]').setInputFiles({ name: "anh.png", mimeType: "image/png", buffer: Buffer.from("png") });
  await expect(page.getByText("Chỉ nhận PDF, DOC hoặc DOCX")).toBeVisible();
  await shoot(page, testInfo, "apply-wrong-type");
});

test("apply: file over 5 MB", async ({ page }, testInfo) => {
  await openApply(page);
  await page.locator('input[type="file"]').setInputFiles({ name: "cv-lon.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
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
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);
  const small = await page.evaluate(() => {
    const sel = 'main button, main input:not([type="checkbox"]):not([type="radio"]):not([hidden]), main select, main textarea, main a.jp-btn, main [role="combobox"]';
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 43.5 || r.width < 43.5)
      .map(({ el, r }) => `${el.tagName.toLowerCase()}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`);
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
  await page.route("**/api/auth/login", (route) => route.fulfill({ status: 401, json: { message: "Invalid credentials" } }));
  await page.goto("/login");
  await page.getByLabel("Email").fill("a@e2e.local");
  await page.getByLabel(/^Mật khẩu/).fill("sai-mat-khau");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).last().click();
  await expect(page.getByRole("alert").filter({ hasText: "Email hoặc mật khẩu không đúng" })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Nhà tuyển dụng", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Đăng ký ứng viên" }).click();
  await expect(page.getByText("Họ tên là bắt buộc")).toBeVisible();
  await expect(page.getByLabel("Họ và tên")).toBeFocused();
  await shoot(page, testInfo, "register-errors");
});

test("register as recruiter: pick a company by name, by keyboard", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await page.goto("/register");
  await page.getByRole("button", { name: "Nhà tuyển dụng", exact: true }).click();

  // Not picked yet: submitting says so, and no UUID or "CompanyId" is ever on screen.
  await page.getByRole("button", { name: "Đăng ký nhà tuyển dụng" }).click();
  await expect(page.getByText("Hãy chọn công ty bạn tuyển dụng cho.")).toBeVisible();

  const box = page.getByRole("combobox", { name: /Công ty bạn tuyển dụng cho/ });
  await expect(box).toBeFocused();
  await box.fill("T");
  await expect(page.getByRole("option")).toHaveCount(0); // under 2 characters: no search yet
  await box.fill("Cong");
  await expect(page.getByRole("option").first()).toBeVisible();
  await expect(box).toHaveAttribute("aria-expanded", "true");
  await shoot(page, testInfo, "register-company-list");

  await box.press("ArrowDown");
  await expect(box).toHaveAttribute("aria-activedescendant", /.+/);
  await box.press("Enter");
  await expect(page.getByRole("group", { name: /Công ty bạn tuyển dụng cho/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Đổi/ })).toBeVisible();
  await expect(page.getByText("Hãy chọn công ty bạn tuyển dụng cho.")).toHaveCount(0);
  await shoot(page, testInfo, "register-company-picked");

  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/companyid/i);
  expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

  await page.getByRole("button", { name: /Đổi/ }).click();
  await expect(box).toBeFocused();
});

test("register as recruiter: no company found, and a failed search can be retried", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await page.goto("/register");
  await page.getByRole("button", { name: "Nhà tuyển dụng", exact: true }).click();
  const box = page.getByRole("combobox", { name: /Công ty bạn tuyển dụng cho/ });
  await box.fill("zzzzqq");
  await expect(page.getByText("Chưa thấy công ty? Liên hệ quản trị viên.")).toBeVisible();
  await shoot(page, testInfo, "register-company-none");

  // A 4xx is never hidden behind mock data: the real error shows, with a retry.
  await page.route("**/api/companies**", (route) => route.fulfill({ status: 400, json: { message: "Bad request" } }));
  await box.fill("Cong ty khac");
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  await shoot(page, testInfo, "register-company-error");
});

test("register as recruiter: auth-svc 422 asks to choose the company again", async ({ page }) => {
  await offlineBackend(page);
  await page.route("**/api/auth/register", (route) => route.fulfill({ status: 422, json: { detail: "Invalid companyId" } }));
  await page.goto("/register");
  await page.getByRole("button", { name: "Nhà tuyển dụng", exact: true }).click();
  const box = page.getByRole("combobox", { name: /Công ty bạn tuyển dụng cho/ });
  await box.fill("Cong");
  await expect(page.getByRole("option").first()).toBeVisible(); // the list loads after a debounce
  await box.press("ArrowDown");
  await box.press("Enter");
  await expect(page.getByRole("group", { name: /Công ty bạn tuyển dụng cho/ })).toBeVisible();
  await page.getByLabel("Họ và tên").fill("Nguyễn Văn A");
  await page.getByLabel("Email").fill("a@e2e.local");
  await page.getByLabel(/^Mật khẩu/).fill("Abcdefg1");
  await page.getByLabel("Nhập lại mật khẩu").fill("Abcdefg1");
  await page.getByRole("button", { name: "Đăng ký nhà tuyển dụng" }).click();
  await expect(page.getByText("Công ty không còn tồn tại, hãy chọn lại.")).toBeVisible();
  await expect(page.getByRole("combobox", { name: /Công ty bạn tuyển dụng cho/ })).toBeVisible();
});

test("forgot password: success message", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await page.route("**/api/auth/forgot-password", (route) => route.fulfill({ status: 200, json: { message: "Nếu email tồn tại, liên kết đặt lại đã được gửi" } }));
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("a@e2e.local");
  await page.getByRole("button", { name: "Gửi liên kết đặt lại" }).click();
  await expect(page.getByRole("status").filter({ hasText: "liên kết đặt lại đã được gửi" })).toBeVisible();
  await shoot(page, testInfo, "forgot-password-sent");
});

test("reset password: expired token offers a new link", async ({ page }, testInfo) => {
  await offlineBackend(page);
  await page.route("**/api/auth/reset-password", (route) => route.fulfill({ status: 401, json: { message: "Invalid token" } }));
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
    [...document.fonts].filter((f) => f.family.includes("Be Vietnam Pro") && f.status === "loaded").map((f) => f.weight),
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
    application(6, "pending", { jobTitle: "Chuyên viên phát triển kinh doanh khu vực miền Trung và Tây Nguyên kiêm quản lý đối tác chiến lược dài hạn" }),
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
  await applicationsFromBackend(page, ALL_STATUSES.map((s, i) => application(i + 1, s)), requests);
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

test("applications: recruiter is told the page is for candidates", async ({ page }) => {
  await offlineBackend(page);
  await signIn(page, "Recruiter");
  await page.goto("/applications");
  await expect(page.getByRole("heading", { name: "Trang này dành cho người tìm việc." })).toBeVisible();
});

const DETAIL = application(1, "shortlisted", {
  coverLetter: "Kính gửi nhà tuyển dụng,\n\nTôi quan tâm đến vị trí này vì đã có 3 năm làm React.",
  statusHistory: [
    { id: "h2", applicationId: "app-1", status: "shortlisted", note: "Mời phỏng vấn vòng 2 vào thứ Sáu.", changedAt: "2026-11-04T08:00:00Z" },
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
  await page.route(/\/api\/applications\/app-404$/, (route) => route.fulfill({ status: 404, json: { message: "not found" } }));
  await page.goto("/applications/app-404");
  await expect(page.getByRole("heading", { name: "Không tìm thấy đơn ứng tuyển." })).toBeVisible();
  await shoot(page, testInfo, "application-not-found");
  await page.route(/\/api\/applications\/app-bad$/, (route) => route.fulfill({ status: 403, json: { message: "forbidden" } }));
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
  await expect(page.getByText("Nguyễn Văn An", { exact: true })).toBeVisible();
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
      : route.fulfill({ json: { id: "p1", userId: "e2e-User", fullName: "Người dùng thử", skills: [], experiences: [], education: [] } }),
  );
  await page.goto("/profile");
  await expect(page.getByRole("alert").filter({ hasText: "Không tải được hồ sơ" })).toBeVisible();
  await shoot(page, testInfo, "profile-error");
  fail = false;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Thông tin cá nhân" })).toBeVisible();
});

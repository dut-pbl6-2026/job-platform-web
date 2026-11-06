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

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

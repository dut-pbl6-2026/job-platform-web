import { expect, test, type Page } from "@playwright/test";

const COMPANY_ID = "33333333-3333-3333-3333-333333333333";
const REQUEST_ID = "77777777-7777-7777-7777-777777777777";

async function offlineBackend(page: Page) {
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
}

async function signIn(page: Page, role: "User" | "Recruiter", companyId: string | null) {
  await page.addInitScript(() => localStorage.setItem("accessToken", "e2e-token"));
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        id: `e2e-${role}`,
        email: `${role.toLowerCase()}@e2e.local`,
        fullName: "Người dùng thử",
        role,
        isActive: true,
        companyId,
      },
    }),
  );
}

const myRequest = (over: Record<string, unknown>) => ({
  id: REQUEST_ID,
  companyId: COMPANY_ID,
  status: "Pending",
  createdAt: "2026-11-01T02:00:00Z",
  expiresAt: "2026-11-08T02:00:00Z",
  canEscalate: false,
  ...over,
});

test.describe("requester join-request status", () => {
  test("a pending request shows the state and its expiry, with no escalate action yet", async ({ page }) => {
    await offlineBackend(page);
    await signIn(page, "User", null);
    await page.route(/\/api\/companies\/me\/join-request$/, (route) =>
      route.fulfill({ json: myRequest({ status: "Pending" }) }),
    );
    await page.goto("/join-request");

    await expect(page.getByText("Chờ công ty duyệt")).toBeVisible();
    await expect(page.getByText("8/11/2026")).toBeVisible();
    await expect(page.getByRole("button", { name: "Gửi yêu cầu hỗ trợ" })).toHaveCount(0);
  });

  test("an expired request can be escalated once and then reads as escalated", async ({ page }) => {
    await offlineBackend(page);
    await signIn(page, "User", null);
    let escalated = false;
    const posts: string[] = [];
    await page.route(/\/api\/companies\/me\/join-request\/escalate$/, (route) => {
      posts.push(new URL(route.request().url()).pathname);
      escalated = true;
      route.fulfill({ json: { id: REQUEST_ID, status: "Escalated" } });
    });
    await page.route(/\/api\/companies\/me\/join-request$/, (route) =>
      route.fulfill({
        json: escalated
          ? myRequest({ status: "Escalated", canEscalate: false })
          : myRequest({ status: "Expired", canEscalate: true }),
      }),
    );
    await page.goto("/join-request");

    await expect(page.getByText("Đã hết thời gian chờ", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Gửi yêu cầu hỗ trợ" }).click();

    await expect(page.getByText("Đã gửi hỗ trợ", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Gửi yêu cầu hỗ trợ" })).toHaveCount(0);
    expect(posts).toEqual(["/api/companies/me/join-request/escalate"]);
  });

  test("an account without a join request gets a neutral empty state", async ({ page }) => {
    await offlineBackend(page);
    await signIn(page, "User", null);
    await page.route(/\/api\/companies\/me\/join-request$/, (route) =>
      route.fulfill({ status: 404, json: { errorCode: "JOIN_REQUEST_NOT_FOUND", message: "No join request." } }),
    );
    await page.goto("/join-request");

    await expect(page.getByText("Chưa có yêu cầu tham gia công ty nào")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});

test.describe("company admin join requests", () => {
  const pendingRow = {
    id: REQUEST_ID,
    companyId: COMPANY_ID,
    userId: "99999999-9999-9999-9999-999999999999",
    status: "Pending",
    createdAt: "2026-11-01T02:00:00Z",
    expiresAt: "2026-11-08T02:00:00Z",
    decidedAt: null,
    decisionReason: null,
  };

  test("the admin approves a pending request and the row leaves the pending state", async ({ page }) => {
    await offlineBackend(page);
    await signIn(page, "Recruiter", COMPANY_ID);
    let approved = false;
    const calls: string[] = [];
    await page.route(/\/api\/companies\/[^/]+\/join-requests\/[^/]+\/approve$/, (route) => {
      calls.push(new URL(route.request().url()).pathname);
      approved = true;
      route.fulfill({ json: { id: REQUEST_ID, status: "Approved" } });
    });
    await page.route(/\/api\/companies\/[^/]+\/join-requests(\?.*)?$/, (route) =>
      route.fulfill({
        json: {
          items: [approved ? { ...pendingRow, status: "Approved", decidedAt: "2026-11-02T02:00:00Z" } : pendingRow],
          total: 1,
          page: 1,
          size: 10,
        },
      }),
    );
    await page.goto("/recruiter/join-requests");

    await expect(page.getByText("Chờ công ty duyệt")).toBeVisible();
    await expect(page.getByText("Gửi ngày 1/11/2026")).toBeVisible();
    await page.getByRole("button", { name: "Duyệt yêu cầu gửi ngày 1/11/2026" }).click();

    await expect(page.getByText("Đã được duyệt")).toBeVisible();
    expect(calls).toEqual([`/api/companies/${COMPANY_ID}/join-requests/${REQUEST_ID}/approve`]);
    // The internal user id is never rendered.
    await expect(page.getByText("99999999-9999-9999-9999-999999999999")).toHaveCount(0);
  });

  test("the admin rejects a pending request", async ({ page }) => {
    await offlineBackend(page);
    await signIn(page, "Recruiter", COMPANY_ID);
    let rejected = false;
    const calls: string[] = [];
    const bodies: unknown[] = [];
    await page.route(/\/api\/companies\/[^/]+\/join-requests\/[^/]+\/reject$/, (route) => {
      calls.push(new URL(route.request().url()).pathname);
      bodies.push(route.request().postDataJSON());
      rejected = true;
      route.fulfill({ json: { id: REQUEST_ID, status: "Rejected" } });
    });
    await page.route(/\/api\/companies\/[^/]+\/join-requests(\?.*)?$/, (route) =>
      route.fulfill({
        json: {
          items: [rejected ? { ...pendingRow, status: "Rejected", decidedAt: "2026-11-02T02:00:00Z" } : pendingRow],
          total: 1,
          page: 1,
          size: 10,
        },
      }),
    );
    await page.goto("/recruiter/join-requests");

    await page.getByRole("button", { name: "Từ chối yêu cầu gửi ngày 1/11/2026" }).click();

    await expect(page.getByText("Bị từ chối")).toBeVisible();
    expect(calls).toEqual([`/api/companies/${COMPANY_ID}/join-requests/${REQUEST_ID}/reject`]);
    expect(bodies).toEqual([{}]);
  });

  test("a 409 state change is reported and the list is reloaded", async ({ page }) => {
    await offlineBackend(page);
    await signIn(page, "Recruiter", COMPANY_ID);
    let listCalls = 0;
    await page.route(/\/api\/companies\/[^/]+\/join-requests\/[^/]+\/approve$/, (route) =>
      route.fulfill({
        status: 409,
        json: { errorCode: "JOIN_REQUEST_STATE_INVALID", message: "Only a pending request can be approved." },
      }),
    );
    await page.route(/\/api\/companies\/[^/]+\/join-requests(\?.*)?$/, (route) => {
      listCalls += 1;
      route.fulfill({ json: { items: [pendingRow], total: 1, page: 1, size: 10 } });
    });
    await page.goto("/recruiter/join-requests");

    await page.getByRole("button", { name: "Duyệt yêu cầu gửi ngày 1/11/2026" }).click();

    await expect(
      page.getByText("Yêu cầu vừa thay đổi hoặc đã hết thời gian chờ. Danh sách đã được làm mới."),
    ).toBeVisible();
    expect(listCalls).toBeGreaterThan(1);
  });
});

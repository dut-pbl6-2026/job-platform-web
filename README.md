# job-platform-web

React + Vite — part of **Vietnam Job Platform** (`pbl6`) under [`dut-pbl6-2026`](https://github.com/dut-pbl6-2026).

- Tech: React 18 + Vite 5 + TypeScript + React Router + Axios + TanStack Query
- Auth: Login / Register UI consuming `job-platform-auth-svc` (Port 5001, `net10.0`, `YARP gateway`)
- Jobs: List + Detail pages (`search-svc` 5003 / `job-svc` 5002 via the gateway)
- Apply / Profile / History: WEB-01-04/05/06 → `app-svc` 5004 + `profile-svc` 5005
- **Mock data is opt-in**: `VITE_ENABLE_MOCKS=true` lets a call fall back to localStorage/seed data only when the backend is unreachable or returns 5xx. Never on 4xx (a 404 means a wrong URL/contract and must show). Off by default, so staging/prod always show real errors.
- Branch flow: `feature/* → main` (see job-platform-docs/.github/git-strategy.md)

## Features — AUTH-01 + JOB-01 / SEARCH-01 / WEB-01 (PBL6-12/13)

- **Auth**: `POST /api/auth/register` — pwd `8+1upper+1num` (SRS), role `User/Recruiter/Admin` (`Employer` alias → `Recruiter`), fullName 2..128; `POST /api/auth/login` — JWT `access 60m` + `refresh 30d` (SHA256 rotation, `Http: Bearer`); `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` (protected); client axios interceptor + `ProtectedRoute`/`GuestOnly`
- **Jobs (WEB-01-02/03, JOB-01, SEARCH-01)**: `GET /api/search/jobs?q=&location=&page=&size=` (SEARCH-01-04: `page` 0-based, `size` 1..100 default 20 server — client dùng `JOB_PAGE_SIZE=9` cho grid 3×3, vẫn trong spec, đổi lên 20 chỉ cần sửa hằng), `GET /api/jobs/{id}` (JOB-01-05), `GET /api/categories` (JOB-01-06); UI `JobListPage` + `JobDetailPage` (Apply nếu `isUser`, Edit nếu `isRecruiter` + owner); roles canonical `User/Recruiter/Admin` (`lib/roles.ts:1`, `Employer` alias deprecated)
- **Advanced search (ADV-01, Week 6)**: filter bar for salary (VND/USD), skills (`skillOp=or` default / `and`; type a skill and press Enter), location including Remote, employment type, experience (multi-select = any of them), category (by id from `GET /api/categories`), sort (`relevance` / `created_at_desc` / `salary_desc` / `salary_asc`). Query string is the source of truth. One endpoint: `GET /api/search/jobs` with camelCase params. search-svc has no facets or skill/location suggestion API yet. **TanStack Query** caches search/categories/job detail for 5 minutes (`lib/queryClient.ts`).
- **Apply + Profile + History (WEB-01-04/05/06, APP-01, PROFILE-01)**: form `POST /api/applications` FormData `job_id` + `cover_letter` + `cv_file` (PDF/DOC/DOCX ≤5MB, 409 duplicate); `GET /api/applications/me` + `GET /api/applications/{id}`; hồ sơ `GET/PUT /api/profile/me|/profile`, skills/experience/education CRUD. UI `/jobs/:id/apply`, `/profile`, `/applications`, `/applications/:id`. Fallback `localStorage` khi app-svc/profile-svc chưa chạy.
- **Admin dashboard + job approval (ADMIN-01)**: Admin-only `/admin` (statistics `GET /api/admin/stats` from auth-svc, service health `GET /api/health` from the gateway), `/admin/jobs` pending list `GET /api/admin/jobs?status=Pending` + `POST /api/admin/jobs/{id}/approve` `{ note? }` / `POST /api/admin/jobs/{id}/reject` `{ reason }` (reason required), `/admin/users` `GET /api/admin/users?search=&role=&isActive=` + `PATCH /api/admin/users/{id}/activate|deactivate`. Admin list endpoints page from 1; the client converts. No change-role endpoint yet.
- **AI chat UI (AI-01, Week 10)**: authenticated `/chat` + floating dock. `POST /api/ai/chat` SSE (`token`/`jobs`/`truncated`/`done`), session `POST/DELETE /api/ai/session`, history `GET .../history`. Context window 20 messages / 8,000 tokens; 512 output cap; 20 req/hour. ai-svc does not serve these endpoints yet: the UI shows "Tính năng chat AI đang phát triển" (with `VITE_ENABLE_MOCKS=true`: local mock replies). Login after register/login lands on `/jobs` (no `/dashboard`).
- **Local backend helper**: `run-backend.bat` / `run-backend.sh` from this repo (or the parent workspace) start Docker postgres + auth `:5001` and seed a demo Admin if missing (`admin@jobplatform.local` / `Admin12345`).
- **In-app toast (WS-01, Week 5)**: authenticated users connect to `ws /ws/notifications?token=` (Vite proxies `/ws`). Message `notification` with `job.created` renders `Việc làm mới: [title] tại [company]` and links to `/jobs/{id}`. Reconnect + ping follow WS-01-06. A 30s poll of `GET /api/search/jobs` (override `VITE_JOB_TOAST_POLL_MS`) toasts jobs that appear after the first snapshot, deduped against the socket. Programmatic: `showToast()` / `window` event `jp:toast`.

## Setup

```bash
npm install          # or pnpm install
cp .env.example .env # VITE_API_BASE_URL=/api
npm run dev          # http://localhost:5173  (proxy /api and /ws -> gateway :5000)
```

Dev needs the gateway running (`../scripts/run-gateway.ps1`, or `run-dev-services.ps1` for the whole stack): every request goes `/api/* -> gateway :5000 -> service`. Override with `VITE_GATEWAY_URL`.

Prod:

```bash
VITE_API_BASE_URL=https://<gateway-host>/api npm run build
npm run preview
```

## Project structure

```
src/
  types/job.ts        -> Job/Company/Category/PaginatedJobs (JOB-01/SRC 3.3.4)
  mocks/jobsMock.ts   -> 16 seed jobs fallback when job-svc not running
  lib/config.ts       -> resolveApiBaseUrl (gateway-first VITE_API_BASE_URL)
  lib/api.ts          -> axios instance + auth helpers (register/login/me/logout + refresh)
  lib/jobsApi.ts      -> fetchJobs (ADV-01 + SEARCH-01), normalizeJob adapter, mock facets
  lib/queryClient.ts  -> TanStack Query staleTime 5m
  lib/searchFilters.ts -> URL <-> ADV-01 filters
  components/AdvancedFilters.tsx, AppHeader.tsx, ProtectedRoute.tsx, JobCard.tsx, SearchBar.tsx, Pagination.tsx
  lib/validation.ts   -> SRS password regex + email/fullName validators
  contexts/AuthContext.tsx -> login/register/logout/refreshUser, isAuthenticated
  contexts/ChatContext.tsx -> AI-01 session + 20-message context window
  contexts/ToastContext.tsx -> in-app toast stack (WS-01 + new-job poll)
  lib/notificationSocket.ts -> /ws/notifications JWT + reconnect
  lib/notificationMessages.ts -> job.created copy "Việc làm mới: … tại …"
  components/ToastViewport.tsx, AppHeader.tsx, ProtectedRoute.tsx, JobCard.tsx, SearchBar.tsx, Pagination.tsx
  lib/applicationsApi.ts -> APP-01 apply/history + mock
  lib/profileApi.ts      -> PROFILE-01 me/skills/experience/education + mock
  pages/LoginPage.tsx, RegisterPage.tsx, JobListPage.tsx (WEB-01-02), JobDetailPage.tsx (WEB-01-03)
  lib/adminApi.ts        -> ADMIN-01 stats/users/pending jobs + mock
  pages/ApplyPage.tsx (WEB-01-04), ProfilePage.tsx (WEB-01-05), ApplicationHistoryPage.tsx + ApplicationDetailPage.tsx (WEB-01-06)
  pages/AdminDashboardPage.tsx, AdminJobsPage.tsx, AdminUsersPage.tsx, ChatPage.tsx
  styles/auth.css + jobs.css + toast.css + admin.css + chat.css
  App.tsx (routes /chat,/admin,/admin/jobs,/admin/users) + main.tsx
scripts/seed-admin.ps1 -> register Admin if email is free (admin, admin2, …)
run-backend.bat / run-backend.sh -> docker postgres+auth, then seed admin
vite.config.ts        -> proxy /api + /ws -> VITE_GATEWAY_URL (default http://localhost:5000)
```

## Backend deps

- **Gateway** `job-platform-gateway` `:5000` — single entry; routes `/api/auth|jobs|search|...`
- `job-platform-auth-svc` `:5001` (upstream of gateway):
  `src/Auth.Api/Endpoints/AuthEndpoints.cs` + `Dtos/AuthDtos.cs` (register/login/refresh/logout/me/forgot/reset)
  `Program.cs` CORS `http://localhost:5173,3000` + `MapAuthEndpoints()`
- DB `job_platform_auth` via `DATABASE_URL_AUTH`, JWT via `Jwt` (`Secret≥32`, `Issuer=Audience=job-platform`)
- Verify: `curl http://localhost:5000/health` -> gateway ok
  `curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"Abc12345","fullName":"Test"}'`

## Validation (SRS AUTH-01)

- Email 256, FullName 128, Password `^(?=.*[A-Z])(?=.*\d).{8,}$` — UI shows inline errors + strength meter
- Anti-enumeration on forgot-password, server always `200`

## Next

- Add `ForgotPasswordPage` + `ResetPasswordPage` (15min TTL)

## Deploy (Vercel jp-web — TM3 Bao)
- Service: `jp-web` `https://jp-web.vercel.app` `Vercel` `VITE_API_BASE_URL=https://<gateway-host>/api`
- Hook: Vercel Git auto `push main`

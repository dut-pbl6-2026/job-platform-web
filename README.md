# job-platform-web

React + Vite — part of **Vietnam Job Platform** (`pbl6`) under [`dut-pbl6-2026`](https://github.com/dut-pbl6-2026).

- Tech: React 19 + Vite 8 + TypeScript 7 + React Router 7 + Axios + TanStack Query 5 + i18next (Biome for lint/format)
- Auth: Login / Register UI consuming `job-platform-auth-svc` (Port 5001, `net10.0`, `YARP gateway`)
- Jobs: public home, job board, job detail and public company profile (`search-svc` 5003 / `job-svc` 5002 via the gateway)
- Shells: one layout per audience (`PublicLayout`, auth panel, `AuthedLayout` → candidate header or `WorkspaceLayout` sidebar)
- Apply / Profile / History: WEB-01-04/05/06 → `app-svc` 5004 + `profile-svc` 5005
- **Mock data is opt-in**: `VITE_ENABLE_MOCKS=true` lets a call fall back to localStorage/seed data only when the backend is unreachable or returns 5xx. Never on 4xx (a 404 means a wrong URL/contract and must show). Off by default, so staging/prod always show real errors.
- Branch flow: `feature/* → main` (see job-platform-docs/.github/git-strategy.md)

## Features — AUTH-01 + JOB-01 / SEARCH-01 / WEB-01 (PBL6-12/13)

- **Auth**: `POST /api/auth/register` — `202` plus a verification link (pwd `8+1upper+1num`, role `User/Recruiter/Admin`, `Employer` alias → `Recruiter`, fullName 2..128); `POST /api/auth/verify-email` — 24 h single use, bad/expired/used token `422 VERIFICATION_TOKEN_INVALID`; `POST /api/auth/login` — JWT `access 60m` + `refresh 30d` (SHA256 rotation, `Http: Bearer`); `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` (protected); client axios interceptor + `ProtectedRoute`/`GuestOnly`
- **Company self-serve + join requests (AUTH-01-10 to AUTH-01-15)**: `/register-company` (work email, one fixed `202` message), `/verify-email`, `/join-request` (status + escalate), recruiter `/recruiter/join-requests` (approve/reject) and `/recruiter/invite-codes` (issue a code bound to one email).
- **Recruiter flows**: `/recruiter` dashboard with real counts, `/recruiter/jobs` with Active/Closed filters (legacy Pending values render read-only), `/recruiter/jobs/new` to post a job (published immediately), `/recruiter/jobs/:jobId/applications` to review applicants with the recruiter-only AI match score and move their status, and `/recruiter/company` for the company profile. The company creator is Company Admin and can edit it; other recruiters see the same facts read-only with the reason.
- **Public surfaces**: `/` home with keyword/location search, categories, the 6 newest jobs and a real company strip; `/companies/:id` company profile with its Active jobs (`GET /api/companies/{id}/jobs`, with a job-board link fallback while that endpoint rolls out); a public `*` 404. The account menu (avatar image or initials) holds profile, applications, AI chat, company and admin console; it is the only entry to `/profile`.
- **Jobs (WEB-01-02/03, JOB-01, SEARCH-01)**: `GET /api/search/jobs?q=&location=&page=&size=` (SEARCH-01-04: `page` 0-based, `size` 1..100 default 20 server — the client uses `JOB_PAGE_SIZE=9` for the 3×3 grid, still within spec; changing it to 20 only requires editing the constant), `GET /api/jobs/{id}` (JOB-01-05), `GET /api/categories` (JOB-01-06); UI `JobListPage` + `JobDetailPage` (Apply nếu `isUser`, Edit nếu `isRecruiter` + owner); roles canonical `User/Recruiter/Admin` (`lib/roles.ts:1`, `Employer` alias deprecated)
- **Advanced search (ADV-01, Week 6)**: filter bar for salary (VND/USD), skills (`skillOp=or` default / `and`; type a skill and press Enter), location including Remote, employment type, experience (multi-select = any of them), category (by id from `GET /api/categories`), sort (`relevance` / `created_at_desc` / `salary_desc` / `salary_asc`). Query string is the source of truth. One endpoint: `GET /api/search/jobs` with camelCase params. search-svc has no facets or skill/location suggestion API yet. **TanStack Query** caches search/categories/job detail for 5 minutes (`lib/queryClient.ts`).
- **Apply + Profile + History (WEB-01-04/05/06, APP-01, PROFILE-01)**: form `POST /api/applications` FormData `job_id` + `cover_letter` + `cv_file` (PDF/DOC/DOCX ≤5MB, 409 duplicate); `GET /api/applications/me` + `GET /api/applications/{id}`; profile `GET/PUT /api/profiles/me`, `GET /api/profiles/{id}`, skills/experience/education CRUD. UI `/jobs/:id/apply`, `/profile`, `/applications`, `/applications/:id`. Falls back to `localStorage` when app-svc/profile-svc are not running.
- **Admin dashboard + job moderation (ADMIN-01)**: Admin-only `/admin` (statistics `GET /api/admin/stats` from auth-svc, service health `GET /api/health` from the gateway), `/admin/jobs` `GET /api/admin/jobs` with view/edit of any job and **takedown with a required reason** (`POST /api/admin/jobs/{id}/takedown { reason }`, `POST /api/admin/jobs/{id}/restore`); admins no longer create or approve/reject jobs. `/admin/users` `GET /api/admin/users?search=&role=&isActive=` + `PATCH /api/admin/users/{id}/activate|deactivate`. Admin list endpoints page from 1; the client converts. No change-role endpoint yet. A non-admin who opens an admin URL is sent to `/jobs` with a notice.
- **AI chat UI (AI-01, Week 10)**: authenticated `/chat` + floating dock. `POST /api/ai/chat` SSE (`token`/`jobs`/`truncated`/`done`), session `POST/DELETE /api/ai/session`, history `GET .../history`. Context window 20 messages / 8,000 tokens; 512 output cap; 20 req/hour. ai-svc serves these endpoints; with `VITE_ENABLE_MOCKS=true` the UI can use local mock replies. After auth the destination is role-based: User → `/jobs`, Recruiter → `/recruiter`, Admin → `/admin`; an explicit `?next=`/`state.from` still wins. The candidate CV scoring page (`/resume-score`) is removed; candidates never see an AI score. Recruiters see the app-svc match score per applicant.
- **Local backend helper**: `run-backend.bat` / `run-backend.sh` from this repo (or the parent workspace) start Docker postgres + auth `:5001` and seed a demo Admin if missing (`admin@jobplatform.local` / `Admin12345`).
- **i18n**: all user-facing copy is in `src/i18n/locales/vi.json`, with English keys grouped by feature; `vi` is both the language and the fallback. Code and comments are English, and new copy goes through `t()`, never hard-coded in a component.
- **In-app toast (WS-01, Week 5)**: authenticated users connect to `ws /ws/notifications?token=` (Vite proxies `/ws`). Message `notification` with `job.created` renders `Việc làm mới: [title] tại [company]` and links to `/jobs/{id}`. Reconnect + ping follow WS-01-06. A 30s poll of `GET /api/search/jobs` (override `VITE_JOB_TOAST_POLL_MS`) toasts jobs that appear after the first snapshot, deduped against the socket. Programmatic: `showToast()` / `window` event `jp:toast`.

## Setup

```bash
npm install          # or pnpm install
cp .env.example .env # VITE_API_BASE_URL=/api, VITE_GATEWAY_URL=http://localhost:5000
npm run dev          # http://localhost:5173  (proxy /api and /ws -> gateway :5000)
```

Build-time variables: `VITE_API_BASE_URL` (the API prefix the bundle calls; default `/api`), `VITE_ENABLE_MOCKS` (off by default; only network errors and 5xx fall back), `VITE_ENABLE_NOTIFICATION_WS` (off until the backend serves `/ws/notifications`), `VITE_JOB_TOAST_POLL_MS` (default 30000). `VITE_GATEWAY_URL` only configures the Vite dev proxy; it is not part of the bundle.

Dev needs the gateway running (`../scripts/run-gateway.ps1`, or `run-dev-services.ps1` for the whole stack): every request goes `/api/* -> gateway :5000 -> service`. Override with `VITE_GATEWAY_URL`.

Prod:

```bash
VITE_API_BASE_URL=https://<gateway-host>/api npm run build
npm run preview
```

The Docker build also accepts `VITE_API_URL` (default `http://localhost:5000`) as a build arg, but the current client reads only `VITE_API_BASE_URL`. `VITE_WS_URL` is not read by the code: the notification socket path is fixed at `/ws/notifications` and gated by `VITE_ENABLE_NOTIFICATION_WS`.

## Project structure

```
src/
  types/job.ts        -> Job/Company/Category/PaginatedJobs (JOB-01/SRC 3.3.4)
  mocks/jobsMock.ts   -> 16 seed jobs fallback when job-svc not running
  lib/config.ts       -> resolveApiBaseUrl (gateway-first VITE_API_BASE_URL)
  lib/api.ts          -> axios instance + auth helpers (register/register-company/verify-email/login/me/logout + refresh)
  lib/jobsApi.ts      -> fetchJobs (ADV-01 + SEARCH-01), normalizeJob adapter, mock facets
  lib/companyApi.ts   -> public company detail/jobs + GET /api/companies/mine + PUT /api/companies/{id}
  layouts/PublicLayout.tsx -> PublicLayout, CandidateLayout, AuthedLayout (guard + role shell)
  layouts/WorkspaceLayout.tsx -> recruiter/admin sidebar console, slim top bar, mobile disclosure
  components/ui/AccountMenu.tsx -> avatar + role-aware menu (profile, applications, chat, company, admin, sign out)
  lib/joinRequestApi.ts -> join-request status/escalate + recruiter approve/reject
  lib/inviteApi.ts    -> issue a recruiter invite code bound to one email
  lib/queryClient.ts  -> TanStack Query staleTime 5m
  lib/searchFilters.ts -> URL <-> ADV-01 filters
  i18n/index.ts + locales/vi.json -> i18next setup; every user-facing string, English keys
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
  pages/LoginPage.tsx, RegisterPage.tsx, RegisterCompanyPage.tsx, VerifyEmailPage.tsx, JobListPage.tsx (WEB-01-02), JobDetailPage.tsx (WEB-01-03)
  lib/adminApi.ts        -> ADMIN-01 stats/users/jobs + takedown/restore
  pages/HomePage.tsx, CompanyPage.tsx, NotFoundPage.tsx
  pages/ApplyPage.tsx (WEB-01-04), ProfilePage.tsx (WEB-01-05), ApplicationHistoryPage.tsx + ApplicationDetailPage.tsx (WEB-01-06), JoinRequestPage.tsx
  pages/RecruiterDashboardPage.tsx, RecruiterJobsPage.tsx, RecruiterPostJobPage.tsx, RecruiterApplicationsPage.tsx, RecruiterCompanyPage.tsx, RecruiterInviteCodesPage.tsx, RecruiterJoinRequestsPage.tsx
  pages/AdminDashboardPage.tsx, AdminJobsPage.tsx, AdminUsersPage.tsx, ChatPage.tsx
  styles/home.css + workspace.css + company.css + ui.css + admin.css + recruiter.css + chat.css
  App.tsx (layout routes + role guards; no per-page TopBar/global footer) + main.tsx
scripts/seed-admin.ps1 -> register Admin if email is free (admin, admin2, …)
run-backend.bat / run-backend.sh -> docker postgres+auth, then seed admin
vite.config.ts        -> proxy /api + /ws -> VITE_GATEWAY_URL (default http://localhost:5000)
```

## Backend deps

- **Gateway** `job-platform-gateway` `:5000` — single entry; routes `/api/auth|jobs|search|...`
- `job-platform-auth-svc` `:5001` (upstream of gateway):
  `src/Auth.Api/Endpoints/AuthEndpoints.cs` + `src/Auth.Core/Contracts/` (register/register-company/verify-email/login/refresh/logout/me/forgot/reset)
  `Program.cs` CORS `http://localhost:5173,3000` + `MapAuthEndpoints()`
- DB `job_platform_auth` via `DATABASE_URL_AUTH`; JWT is RS256, signed only by auth-svc with `Jwt__SigningKeyPem`; validators read auth-svc's JWKS. The web client never sees a signing key.
- Verify: `curl http://localhost:5000/health` -> gateway ok
  `curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"Abc12345","fullName":"Test"}'`

## Validation (SRS AUTH-01)

- Email 256, FullName 128, Password `^(?=.*[A-Z])(?=.*\d).{8,}$` — UI shows inline errors + strength meter
- Anti-enumeration on forgot-password, server always `200`

## Deploy (Vercel jp-web — TM3 Bao)
- Service: `jp-web` `https://jp-web.vercel.app` `Vercel` `VITE_API_BASE_URL=https://<gateway-host>/api`
- Hook: Vercel Git auto `push main`

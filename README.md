# job-platform-web

React + Vite — part of **Vietnam Job Platform** (`pbl6`) under [`dut-pbl6-2026`](https://github.com/dut-pbl6-2026).

- Tech: React 18 + Vite 5 + TypeScript + React Router + Axios
- Auth: Login / Register UI consuming `job-platform-auth-svc` (Port 5001, `net10.0`, `YARP gateway`)
- Jobs: List + Detail pages (mock fallback, ready for `job-svc` 5002 / `search-svc` 5003)
- Branch flow: `feature/* → main` (see job-platform-docs/.github/git-strategy.md)

## Features — AUTH-01 + JOB-01 / SEARCH-01 / WEB-01 (PBL6-12/13)

- **Auth**: `POST /api/auth/register` — pwd `8+1upper+1num` (SRS), role `User|Employer`, fullName 2..128; `POST /api/auth/login` — JWT `access 60m` + `refresh 30d` (SHA256 rotation, `Http: Bearer`); `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` (protected); client axios interceptor + `ProtectedRoute`/`GuestOnly`
- **Jobs (WEB-01-02/03, JOB-01, SEARCH-01)**: `GET /api/search/jobs?q=&location=&page=&size=` (SEARCH-01), `GET /api/jobs/{id}` (JOB-01-05), `GET /api/categories` (JOB-01-06); UI `JobListPage` (search bar + cards title/company/location/salary + pagination) + `JobDetailPage` (full description/company/Apply if User + Edit if owner); AppHeader nav `/jobs`

## Setup

```bash
npm install          # or pnpm install
cp .env.example .env # VITE_API_BASE_URL=/api  (vite proxy -> http://localhost:5001)
npm run dev          # http://localhost:5173  (proxy /api -> 5001)
```

Prod:

```bash
VITE_API_BASE_URL=https://gateway.example.com/api npm run build
npm run preview
```

## Project structure

```
src/
  types/job.ts        -> Job/Company/Category/PaginatedJobs (JOB-01/SRC 3.3.4)
  mocks/jobsMock.ts   -> 16 seed jobs fallback when job-svc not running
  lib/api.ts          -> axios instance + auth helpers (register/login/me/logout + refresh)
  lib/jobsApi.ts      -> fetchJobs/fetchJobById/fetchCategories (SEARCH-01) + mock fallback + formatSalary/timeAgo
  lib/validation.ts   -> SRS password regex + email/fullName validators
  contexts/AuthContext.tsx -> login/register/logout/refreshUser, isAuthenticated
  components/AppHeader.tsx, ProtectedRoute.tsx, JobCard.tsx, SearchBar.tsx, Pagination.tsx
  pages/LoginPage.tsx, RegisterPage.tsx, DashboardPage.tsx, JobListPage.tsx (WEB-01-02), JobDetailPage.tsx (WEB-01-03)
  styles/auth.css + jobs.css
  App.tsx (routes /,/login,/register,/dashboard,/jobs,/jobs/:id) + main.tsx
vite.config.ts        -> proxy /api -> http://localhost:5001 (gateway)
```

## Backend deps

- `job-platform-auth-svc` must expose:
  `src/Auth.Api/Endpoints/AuthEndpoints.cs` + `Dtos/AuthDtos.cs` (register/login/refresh/logout/me/forgot/reset)
  `Program.cs` CORS `http://localhost:5173,3000` + `MapAuthEndpoints()`
- DB `job_platform_auth` via `DATABASE_URL_AUTH`, JWT via `Jwt` (`Secret≥32`, `Issuer=Audience=job-platform`)
- Verify: `curl http://localhost:5001/health` -> `{"status":"ok"}`
  `curl -X POST http://localhost:5001/api/auth/register -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"Abc12345","fullName":"Test"}'`

## Validation (SRS AUTH-01)

- Email 256, FullName 128, Password `^(?=.*[A-Z])(?=.*\d).{8,}$` — UI shows inline errors + strength meter
- Anti-enumeration on forgot-password, server always `200`

## Next

- Add `ForgotPasswordPage` + `ResetPasswordPage` (15min TTL)
- Add `YARP gateway` route `/api/auth/*` -> `auth-svc:5001`, forward `X-User-Id/Role`

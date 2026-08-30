# job-platform-web

React + Vite — part of **Vietnam Job Platform** (`pbl6`) under [`dut-pbl6-2026`](https://github.com/dut-pbl6-2026).

- Tech: React 18 + Vite 5 + TypeScript + React Router + Axios
- Auth: Login / Register UI consuming `job-platform-auth-svc` (Port 5001, `net10.0`, `YARP gateway`)
- Branch flow: `feature/* → main` (see job-platform-docs/.github/git-strategy.md)

## Features — AUTH-01 (PBL6-12/13)

- `POST /api/auth/register` — pwd `8+1upper+1num` (SRS), role `User|Employer`, fullName 2..128
- `POST /api/auth/login` — JWT `access 60m` + `refresh 30d` (SHA256 rotation, `Http: Bearer`)
- `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` (protected)
- Client: axios interceptor auto-attach `Authorization: Bearer`, queue + refresh on 401, `localStorage` persist, `ProtectedRoute` + `GuestOnly`

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
  lib/api.ts          -> axios instance + auth helpers (register/login/me/logout + refresh)
  lib/validation.ts   -> SRS password regex + email/fullName validators
  contexts/AuthContext.tsx -> login/register/logout/refreshUser, isAuthenticated
  components/ProtectedRoute.tsx
  pages/LoginPage.tsx
  pages/RegisterPage.tsx
  pages/DashboardPage.tsx
  styles/auth.css     -> design tokens, card, inputs, alerts, spinner
  App.tsx + main.tsx
vite.config.ts        -> proxy /api -> http://localhost:5001
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

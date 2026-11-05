# job-platform-web

React web client of **Vietnam Job Platform** (PBL6 2026, `dut-pbl6-2026`). Product truth lives in `PRODUCT.md`: read it before any UI work.

## Stack
React 18 · Vite 5 · TypeScript 5 (strict) · React Router 7 · TanStack Query 5 · Axios. Plain CSS in `src/styles/` (no Tailwind, no CSS-in-JS). No test runner and no ESLint config yet.

## Commands
- Dev with backend: `npm run dev` (port 5173; proxies `/api` and `/ws` to the gateway on `:5000`)
- Dev without backend: `VITE_ENABLE_MOCKS=true npm run dev` (mock fallback on network errors and 5xx only)
- Build and type check: `npm run build` (runs `tsc -b`, then `vite build`; must pass before every commit)
- Local backend: `run-backend.bat` / `run-backend.sh` (Postgres + auth, seeds Admin `admin@jobplatform.local`)

## Layout
- `src/pages/*Page.tsx`: route screens, **default export**. Routes are in `src/App.tsx`.
- `src/components/*.tsx`: shared UI, **named exports**.
- `src/lib/*Api.ts`: one API module per service. Errors go through `lib/http.ts` (`httpStatus`, `shouldUseMock`).
- `src/lib/roles.ts`: canonical roles `User` / `Recruiter` / `Admin` (`Employer` is a deprecated alias).
- `src/types/*.ts`: DTOs. `normalizeJob` in `jobsApi.ts` adapts backend shapes.
- Import alias `@/*` → `src/*`.

## Hard rules
- **Never hide real errors.** Mock fallback only with `VITE_ENABLE_MOCKS=true` and only on no response or 5xx, never on 4xx.
- **Follow backend contracts exactly.** Search pages are 0-based; admin lists are 1-based (the client converts). Don't change API calls during UI work.
- **Vietnamese-only user-facing copy.** Code and comments may be English.
- **No invented data.** Every badge or label must trace to a backend field. No fake counts, testimonials, logos or "Top/HOT" tags.
- **Never show internal IDs** (company ID, UUIDs) or raw enums (`Full-time`, `active`) to users. Map them to Vietnamese labels.
- Don't add dependencies without asking. Don't commit `.env`.

## Current work: UI redesign (branch `refactor/ui-redesign`)
- **Plan, the source of truth for scope, slices and status:** `../md/implementation_plan_web_ui_refactor.md` (§4 UI slices S0–S10, §5 bug commits F1–F6, §9 status).
- **Direction:** "Bảng giờ tàu" (Railway Timetable). Jobs are timetable rows with fixed columns, the job list is a sortable board, and on phones each row folds into 2 lines. Tokens are in plan §2.2: navy `#133a6b` shell, amber selection, red "Mới". The font is Be Vietnam Pro.
- **Chosen first-viewport sketch:** `.impeccable/mocks/decision/assigned.html`.
- **Baseline critique (16/40):** `.impeccable/critique/2026-11-05T15-34-04Z__src.md`.
- **Design workflow:** the `impeccable` skill. Read its `craft-floor.md` before UI edits; run `impeccable detect --json src` after UI changes; write `DESIGN.md` only after the build is finished.
- **Screenshots:** headless Chrome on this machine lays out at ≥504px even with `--window-size=390`, so 390px mobile captures need real viewport emulation.
- **Commits:** one commit per slice. Logic fixes go in their own `fix(web): …` commits. Commit only when the user asks.

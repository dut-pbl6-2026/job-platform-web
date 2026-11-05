# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The web app is the React client of **Vietnam Job Platform**, the PBL6 2026 course project (`dut-pbl6-2026`). It has three roles: **User** (candidate), **Recruiter**, and **Admin**. `Employer` is a deprecated alias for Recruiter (`src/lib/roles.ts`).

The audience that decides success comes first: **course graders and demo-day viewers**. They judge whether the system works end to end. The in-product users the demo walks through are:

- **Candidates (User):** Vietnamese job seekers. They search and filter jobs, read a job, apply with a CV, keep a profile, and track their applications.
- **Admins:** they review pending job posts (read, then approve or reject with a reason), activate or deactivate users, and check platform stats and service health.
- **Recruiters:** today they can only edit their own job from the job detail page. No posting or candidate-management flow exists on the web yet; `Đăng tuyển & tìm hồ sơ` links back to `/jobs`.

## Product Purpose

The web app shows that a microservice job platform works as one product. Requests go through the YARP gateway to the auth, job, search, application, profile, and notification services. Success means the course's MUST HAVE flows run reliably in a live demo against real backends: login, register, job list, job detail, and apply. SHOULD HAVE features such as advanced search, admin approval, and realtime alerts are extras built on those flows.

## Positioning

Undecided, and deliberately so. The user said the "WOW" features (AI Job Copilot, Smart Resume Scoring) do not need to be done now. Future work should not present them as the product's edge or design around them. Until a differentiator is chosen, the bar is a complete, reliable Vietnamese job board.

## Operating Context

- **Demo scene:** the whole stack runs locally through Docker Compose and the gateway on `:5000`, with the web dev server on `:5173` proxying `/api` and `/ws`. `run-backend.bat`/`.sh` seed a demo Admin account (`admin@jobplatform.local`). Production is the Vercel deployment `jp-web`.
- **Data:** job listings come from the crawler (public sources such as vieclam.gov.vn), are indexed by search-svc, and are mapped to the 9 predefined backend categories.
- **Failure honesty:** mock data only runs when `VITE_ENABLE_MOCKS=true`, and only on network errors or 5xx responses, never on 4xx. Staging and prod must show real errors, not hide broken contracts.
- **Sibling client:** a separate Flutter mobile app (`job-platform-mobile`) covers the same core screens. This repo is web only.

## Capabilities and Constraints

- **Built:** auth (register, login, refresh, logout, forgot and reset password); job list with keyword, location, and advanced filters (salary, skills, employment type, experience, category, sort), with the query string as the source of truth; job detail; apply with CV (PDF/DOC/DOCX ≤ 5 MB; duplicate application returns 409); profile with skills, experience, and education; application history and detail; admin dashboard, pending-job review, and user management; realtime new-job toasts (WebSocket plus 30 s poll).
- **Built but deferred, not a priority:** the AI chat at `/chat` and the floating dock (ai-svc does not serve them yet, so the UI says the feature is in development), and resume scoring at `/resume-score`.
- **Contract rules:** the client follows backend contracts exactly. Search pages are 0-based; admin lists are 1-based and the client converts. Admins have no change-role endpoint, and search-svc has no facets or suggestion API.
- **Validation (SRS AUTH-01):** passwords need 8+ characters with at least one uppercase letter and one digit; email is at most 256 characters and full name 2–128. Forgot-password always returns 200 so it can't reveal which accounts exist.
- **Open:** the recruiter web flows (posting, applicant management) are unscoped. Dark mode and i18n are master-plan nice-to-haves with no commitment.

## Brand Commitments

- **Name:** Vietnam Job Platform. The header wordmark is `jobplatform`.
- **Language:** Vietnamese only. All user-facing copy is Vietnamese (`<html lang="vi">`) and no English UI is planned. Developer docs and code comments may stay in English.

## Evidence on Hand

- Crawled seed jobs: `src/mocks/seedJobs.json`, refreshed with `npm run sync:seed` from `job-platform-crawler/seed/jobs.json`.
- Company names, industries, and verified flags shown on the home page come from live job data, not from a curated list.
- **None of these exist, and future work must not invent them:** testimonials, partner or customer logos, user or placement counts, press, pricing, and real company branding assets.

## Product Principles

1. **The demo must not break.** The MUST HAVE flows always beat new features.
2. **Show the truth.** Real backend errors are surfaced, never hidden behind mock data or fake success states.
3. **One clear path per role.** Each role gets a focused route through its own job. Unfinished capabilities say plainly that they are in development instead of pretending to work.
4. **Vietnamese first.** Copy reads naturally to Vietnamese job seekers, and Vietnamese diacritics and VND formatting are first-class.

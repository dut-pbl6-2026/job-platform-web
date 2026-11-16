# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The web app is the React client of **Vietnam Job Platform**, the PBL6 2026 course project (`dut-pbl6-2026`). It has three roles: **User** (candidate), **Recruiter**, and **Admin**. `Employer` is a deprecated alias for Recruiter (`src/lib/roles.ts`).

The audience that decides success comes first: **course graders and demo-day viewers**. They judge whether the system works end to end. The in-product users the demo walks through are:

- **Candidates (User):** Vietnamese job seekers. They search and filter jobs, read a job, apply with a CV, keep a profile, and track their applications.
- **Admins:** they moderate published jobs (read and edit any job, take one down with a required audit reason, restore it, and permanently delete an already soft-deleted job), activate or deactivate users, and check platform stats and service health. They never approve or reject a job before publication.
- **Recruiters:** they have a sidebar workspace with a dashboard (`/recruiter`), a job list (`/recruiter/jobs`, Active/Closed), a post-a-job form (`/recruiter/jobs/new`, published immediately), an applicant list per job (`/recruiter/jobs/:jobId/applications`) with the recruiter-only AI match score, and a company profile (`/recruiter/company`). The company creator is **Company Admin** and edits the company; other recruiters are Members and see the same facts read-only with the reason. They can also issue invite codes bound to one email (`/recruiter/invite-codes`) and approve or reject join requests (`/recruiter/join-requests`).

## Product Purpose

The web app shows that a microservice job platform works as one product. Requests go through the YARP gateway to the auth, job, search, application, profile, and notification services. Success means the course's MUST HAVE flows run reliably in a live demo against real backends: login, register, job list, job detail, and apply. SHOULD HAVE features such as advanced search, job moderation, and realtime alerts are extras built on those flows.

## Positioning

Undecided, and deliberately so. The user said the "WOW" features (AI Job Copilot, Smart Resume Scoring) do not need to be done now. Future work should not present them as the product's edge or design around them. Until a differentiator is chosen, the bar is a complete, reliable Vietnamese job board.

## Operating Context

- **Demo scene:** the whole stack runs locally through Docker Compose and the gateway on `:5000`, with the web dev server on `:5173` proxying `/api` and `/ws`. `run-backend.bat`/`.sh` seed a demo Admin account (`admin@jobplatform.local`). Production is the Vercel deployment `jp-web`.
- **Data:** job listings come from the crawler (public sources such as vieclam.gov.vn), are indexed by search-svc, and are mapped to the 9 predefined backend categories.
- **Failure honesty:** mock data only runs when `VITE_ENABLE_MOCKS=true`, and only on network errors or 5xx responses, never on 4xx. Staging and prod must show real errors, not hide broken contracts.
- **Sibling client:** a separate Flutter mobile app (`job-platform-mobile`) covers the same core screens. This repo is web only.

## Capabilities and Constraints

- **Built:** auth (register with email verification, login, refresh, logout, forgot and reset password); company self-serve sign-up with work-email verification, recruiter invite codes bound to one email, and join requests with admin approve/reject and the escalate action; job list with keyword, location, and advanced filters (salary, skills, employment type, experience, category, sort), with the query string as the source of truth; a public home with keyword/location search, categories, newest jobs and a real company strip; public company profiles at `/companies/:id`; job detail; apply with CV (PDF/DOC/DOCX ≤ 5 MB; duplicate application returns 409); profile with avatar, skills, experience, and education for every role; application history and detail; role shells with a persistent recruiter/admin sidebar and an avatar account menu; instant job publication; recruiter dashboard, job posting, applicant review with a recruiter-only AI match score, and company profiles (Company Admin edits, Members read with the reason); admin dashboard, job takedown/restore with an audit reason, and user management; realtime new-job toasts (WebSocket plus 30 s poll); AI chat at `/chat`. Candidate CV scoring is removed, and candidates never see an AI score.
- **Contract rules:** the client follows backend contracts exactly. Search pages are 0-based; admin lists are 1-based and the client converts. Admins have no change-role endpoint, and search-svc has no facets or suggestion API.
- **Validation (SRS AUTH-01):** passwords need 8+ characters with at least one uppercase letter and one digit; email is at most 256 characters and full name 2–128. Forgot-password always returns 200 so it can't reveal which accounts exist.
- **Open:** dark mode and a second UI language are master-plan nice-to-haves with no commitment.

## Brand Commitments

- **Name:** Vietnam Job Platform. The header wordmark is `jobplatform`.
- **Language:** Vietnamese only. All user-facing copy lives in `src/i18n/locales/vi.json` (English keys) and renders as Vietnamese (`<html lang="vi">`); no English UI is planned. Developer docs and code comments stay in English.

## Evidence on Hand

- Crawled seed jobs: `src/mocks/seedJobs.json`, refreshed with `npm run sync:seed` from `job-platform-crawler/seed/jobs.json`.
- Company names, industries, and verified flags shown on the home page come from live job data, not from a curated list.
- **None of these exist, and future work must not invent them:** testimonials, partner or customer logos, user or placement counts, press, pricing, and real company branding assets.

## Product Principles

1. **The demo must not break.** The MUST HAVE flows always beat new features.
2. **Show the truth.** Real backend errors are surfaced, never hidden behind mock data or fake success states.
3. **One clear path per role.** Each role gets a focused route through its own job. Unfinished capabilities say plainly that they are in development instead of pretending to work.
4. **Vietnamese first.** Copy reads naturally to Vietnamese job seekers, and Vietnamese diacritics and VND formatting are first-class.

---
version: 1
slug: "src-pages-joblistpage-tsx"
primary_target: "src/pages/JobListPage.tsx"
related_targets: ["src/pages/JobDetailPage.tsx","src/pages/ApplyPage.tsx","src/pages/LoginPage.tsx"]
---

# Surface brief: job board (`/jobs`) and the screens that share its world

Mode: **Operate**. The visitor completes a task: find a job, read it, apply. Scanability and consistency beat expression.

Scope: the whole web client redesign (plan: `../md/implementation_plan_web_ui_refactor.md`). `/jobs` is the primary surface. Detail, apply, auth, account and admin screens inherit this world.

Audience and job: Vietnamese job seekers on laptop (1280-1600px) and phone (390px). Success is "thông tin việc làm rõ ràng tuyệt đối": salary, place, level and type readable in one glance. Demo-day graders walk list, detail, apply, login.

Constraints: no logos and no deadlines exist in the crawled data, so the design stands on type alone. Every label traces to a backend field. Vietnamese only. No invented counts, badges or "Top/HOT" tags.

Memorable moment: the board itself. Navy column-header band, tabular salary column, one amber selected row.

Unresolved: recruiter `CompanyId` field on register (S6); phone capture tool (Playwright vs temp dir, before S3); footer content kept in full (S10).

## Direction contract

THESIS: Each job is a train on a timetable: one row, fixed columns, read sideways in a second. This replaces the card grid every job board ships, TopCV included. List, detail and apply share one column grid, so nothing can overlap.

OWN-WORLD: Navy `#133a6b` shell bar and column-header band; ground `#f3f5f8`; white board with `#dde3eb` row rules; amber `#f5b400` only as a fill or band for "your selection" (selected row, active filter, active nav), never as text on white; red square plus the word "Mới" for new. Be Vietnam Pro 400-800 on a five-step scale (13/15/17/22/30), tabular numerals, salary right-aligned. Radius 6px controls, 8px panels, no pills, no gradients, no shadows beyond a 1px rule.

STORY: The visitor sees at once that this is a clean Vietnamese job board that shows facts, not hype. They scan a column, open a row, apply with a CV, and are returned to the job after login. Nothing on screen is invented.

FIRST VIEWPORT: Shell bar 64px (wordmark left, nav, Đăng ký / Đăng nhập right). Search row: keyword, location (280px), "Tìm việc". Category row of the 9 backend categories with job counts. Below: filter column 264px plus board. Board header "Bảng việc làm · N việc đang tuyển" with a sort select. Column header band (Vị trí · Công ty, Nơi làm, Lương, Cấp bậc, Hình thức, Đăng) and 64px rows, first job fully inside 900px height. At 390px each row folds to two lines and filters become a drawer. Primary action is "Tìm việc" in navy. Matches `.impeccable/mocks/decision/assigned.html`.

FORM: Railway timetable board ("Bảng giờ tàu"), the card the user locked on the direction decision page (sketch `assigned.html`, code-led), seed:e9f5526895f60ff8

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

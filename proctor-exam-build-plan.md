# Proctor Exam System — Build Plan
**Stack:** React (frontend, hosted on GitHub Pages) + Google Apps Script (backend/API) + Google Sheets (database)

This plan breaks the build into phases you can complete sequentially. Each phase produces something testable before you move to the next.

---

## Phase 0 — Project Setup

**Goal:** Repo, tooling, and Sheet skeleton exist.

1. Create GitHub repo `proctor-exam`.
2. Scaffold React app (Vite recommended for GitHub Pages):
   ```
   npm create vite@latest proctor-exam -- --template react
   ```
3. Install router + HTTP client:
   ```
   npm install react-router-dom axios
   ```
4. Configure `vite.config.js` with the correct `base` path for GitHub Pages (`/proctor-exam/`).
5. Create the Google Sheet with tabs: `Students`, `Exams`, `Questions`, `Attempts`, `Answers`, `Violations`, `Settings`. Add header rows matching the structure from your reference doc.
6. Create the Apps Script project (bound to the Sheet), enable **Deploy as Web App**.
7. Confirm: React dev server runs locally, Apps Script deploys a URL that returns a test JSON response, Sheet is reachable from Apps Script.

**Deliverable:** Empty React shell + working Apps Script "ping" endpoint + Sheet skeleton.

---

## Phase 1 — Backend API Design (Apps Script)

**Goal:** A single, well-defined API contract the frontend can build against.

1. Structure Apps Script files: `Code.gs` (router/doGet/doPost), `Auth.gs`, `Exams.gs`, `Students.gs`, `Questions.gs`, `Attempts.gs`, `Results.gs`, `Utils.gs`.
2. Use one `doPost(e)` entry point that reads an `action` field and routes to the right function (Apps Script web apps only expose one GET/POST endpoint, so an action-based router is simplest):
   ```js
   function doPost(e) {
     const body = JSON.parse(e.postData.contents);
     const handlers = {
       teacherLogin, studentVerify, createExam, importStudents,
       importQuestions, startAttempt, submitAnswer, logViolation,
       finishAttempt, getResults, ...
     };
     const fn = handlers[body.action];
     if (!fn) return jsonResponse({ error: "Unknown action" });
     return jsonResponse(fn(body));
   }
   ```
3. Define request/response JSON shapes for every endpoint up front (write these in a shared `API.md` in the repo) — this avoids mismatches later. At minimum:
   - `teacherLogin({passcode}) -> {token}`
   - `studentVerify({examCode, studentId}) -> {ok, studentName, examMeta}`
   - `createExam({...}) -> {examId}`
   - `importStudents({section, names[]}) -> {count}`
   - `importQuestions({examId, rows[]}) -> {count}`
   - `startAttempt({examId, studentId}) -> {attemptId, questions[]}` (no answers included)
   - `submitAnswer({attemptId, questionNumber, answer, timeUsed}) -> {ok}`
   - `logViolation({attemptId, type}) -> {violationCount, deduction}`
   - `finishAttempt({attemptId}) -> {ok}`
   - `getResults({examId, token}) -> {summary, rows[]}`
4. Store the teacher passcode and any session tokens in Apps Script `PropertiesService`, never in the frontend code.
5. Add CORS handling (Apps Script web apps need `ContentService` + proper headers or a JSONP-style workaround — test this early, it's the most common integration snag).

**Deliverable:** Documented API contract + all endpoints stubbed and callable (even with dummy data).

---

## Phase 2 — Authentication & Role Selection

**Goal:** Landing page where the user picks **Teacher** or **Student**, each with its own login path.

1. React route structure:
   ```
   /                → RoleSelect
   /teacher/login    → TeacherLogin
   /teacher/*        → TeacherApp (protected)
   /student/login     → StudentLogin
   /exam/:attemptId    → ExamRunner (protected)
   ```
2. `RoleSelect` page: two large buttons — "I'm a Teacher" / "I'm a Student" — routes accordingly.
3. `TeacherLogin`: passcode field → calls `teacherLogin` → stores returned token in memory + `sessionStorage` → redirects to `/teacher/dashboard`.
4. `StudentLogin`: Exam Code + Student ID fields → calls `studentVerify` → on success, store `attemptId`-pending state → redirect to instructions/fullscreen screen.
5. Build a simple `AuthContext` (React context) holding `{role, token, studentInfo}` so protected routes can check it.
6. Protect teacher routes with a wrapper component that redirects to `/teacher/login` if no token.

**Deliverable:** Working role-based login flow, teacher and student can each reach their respective landing screens (dashboard vs. exam entry), backed by real Apps Script calls.

---

## Phase 3 — Teacher: Exam & Question Management

**Goal:** Teacher can create an exam, paste in students, paste in questions.

1. `Dashboard` page: list exams from `getExams`, with status badges (Active/Closed) and buttons: Open, Duplicate, Results, Close.
2. `CreateExam` form: title, code, section, per-question timer, opening/closing date-time, violation deduction, max violations, randomize toggles, retake policy → `createExam`.
3. `StudentImport` component: large `<textarea>` for paste, client-side split on newlines, preview table, `[Import Students]` → `importStudents`. Auto-generate Student IDs if none supplied.
4. `QuestionImport` component: `<textarea>` accepting the pipe-delimited format (`NUMBER|TYPE|QUESTION|A|B|C|D|ANSWER|POINTS`), client-side parser + validation (flag malformed rows before sending), preview table, `[Import Questions]` → `importQuestions`.
5. Support the three question types (`MCQ`, `TRUE_FALSE`, `IDENTIFICATION`) in both the parser and preview renderer.
6. `DuplicateExam` flow: modal pre-filled from source exam, requires new section + new code, calls a `duplicateExam` endpoint that copies `Questions` rows but resets `Students`, `Attempts`, `Answers`, `Violations` for the new `ExamID`.

**Deliverable:** Teacher can fully configure an exam end-to-end from the UI and see it listed on the dashboard.

---

## Phase 4 — Student: Exam-Taking Flow

**Goal:** Student can take the exam one question at a time under timer control.

1. `PreExamInstructions` page: exam title, rules, fullscreen requirement notice, `[Enter Fullscreen & Start]` button (calls `document.documentElement.requestFullscreen()` then `startAttempt`).
2. `ExamRunner` page:
   - Fetch and hold the question list returned by `startAttempt` (answers never included).
   - Local state: `currentIndex`, `timeRemaining`, `answers{}`.
   - Per-question countdown using `useEffect` + `setInterval`; on expiry, auto-submit blank answer and advance.
   - On `[Next]`: call `submitAnswer`, then advance `currentIndex`; **do not** allow going back (no back button, no browser-back handling — intercept `popstate`).
   - Progress indicator ("Question 12 of 50") but never show correctness or running score.
3. `ExamComplete` page: simple "submitted, you may close this window" screen; call `finishAttempt` on mount.
4. Handle abrupt closing time: poll or check exam closing timestamp each question load; if past closing time, auto-submit and route to `ExamComplete`.

**Deliverable:** A student can log in, go fullscreen, answer questions one at a time under a timer, and submit — no navigating backward, no score shown.

---

## Phase 5 — Proctoring / Violation Detection

**Goal:** Detect and log tab switches, window blur, and fullscreen exits during `ExamRunner`.

1. Build a `useProctoring(attemptId, settings)` custom hook mounted only inside `ExamRunner`:
   ```js
   useEffect(() => {
     const onVis = () => { if (document.hidden) reportViolation("TAB_SWITCH"); };
     const onBlur = () => reportViolation("WINDOW_BLUR");
     const onFsChange = () => { if (!document.fullscreenElement) reportViolation("FULLSCREEN_EXIT"); };
     document.addEventListener("visibilitychange", onVis);
     window.addEventListener("blur", onBlur);
     document.addEventListener("fullscreenchange", onFsChange);
     return () => { /* cleanup listeners */ };
   }, []);
   ```
2. `reportViolation(type)` calls `logViolation` → backend increments count, computes deduction, returns running totals.
3. Show a modal warning after each violation ("You left the exam window. Violation 1/3. -2 points.") without revealing the running score total.
4. On reaching `maxViolations`, apply the configured action (auto-submit / lock / allow-continue) from `Settings`.
5. Be explicit in the UI copy that this is deterrence/logging, not a lockdown browser — set correct expectations for the teacher too.

**Deliverable:** Violations are detected, penalized server-side, logged to the `Violations` sheet, and surfaced to the student without exposing scoring.

---

## Phase 6 — Grading & Results

**Goal:** Backend grades automatically; teacher can view/export results.

1. On `finishAttempt`, Apps Script grades `Answers` against `Questions.Answer`, sums points, subtracts violation deductions (floored at 0), writes to `Attempts` (`Score`, `Deduction`, `FinalScore`, `Status`).
2. `Results` page (teacher): summary cards (Students, Completed, Not Taken, Average, Highest, Lowest) + sortable table (Student, Score, Violations, Status).
3. Buttons: `Export CSV` (client-side generation from fetched JSON), `View Answers` (per-student breakdown), `View Violations` (per-student violation log), `Print Results` (CSS print stylesheet).
4. Guard `getResults` behind the teacher token.

**Deliverable:** Teacher gets an accurate, exportable results view immediately after students finish.

---

## Phase 7 — Settings & Security Hardening

**Goal:** Configurable passcode, safe defaults, no secrets in the public repo.

1. `Teacher → Settings → Change Passcode` page: calls a `changePasscode` endpoint; passcode stored only in `PropertiesService`, never in Sheet plaintext if avoidable (or at least never in the GitHub repo).
2. Confirm nothing in the React bundle contains secrets — audit `dist/` after build (`grep -r "102799" dist/`).
3. Add basic rate limiting / attempt-count checks in Apps Script for `teacherLogin` and `studentVerify` to reduce brute-force risk.
4. Validate every incoming payload server-side (don't trust client-side validation alone) — especially exam code, student ID, and attempt ownership checks (a student should never be able to submit answers for someone else's `attemptId`).
5. Double-check `studentVerify` rejects: unknown exam code, closed exam, student not on roster, already-attempted (unless retakes allowed).

**Deliverable:** No secrets in the public repo; server-side checks enforce every access rule described in your spec.

---

## Phase 8 — Deployment

**Goal:** Live, working system.

1. Build React app (`npm run build`), deploy `dist/` to GitHub Pages (via `gh-pages` npm package or a GitHub Actions workflow).
2. Deploy Apps Script as a Web App with access set to "Anyone" (required for public frontend calls) — but all sensitive actions still gated by passcode/token checks inside the script.
3. Store the deployed Apps Script URL as an environment variable in the React build (`VITE_API_URL`) rather than hardcoding it, so you can redeploy the backend without touching frontend code.
4. Smoke-test the full flow end-to-end on the live URLs: teacher creates exam → imports students/questions → student logs in → takes exam with a simulated violation → teacher views results.

**Deliverable:** Publicly reachable system at your GitHub Pages URL, fully wired to the live Apps Script backend.

---

## Phase 9 — Pilot Test & Iterate

**Goal:** Validate with a real small group before a real exam.

1. Run a dry-run exam with 3–5 volunteer "students" (classmates/colleagues) using dummy questions.
2. Specifically test: closing-time auto-submit while a student is mid-exam, violation counting accuracy, duplicate-exam isolation between sections, CSV export correctness, mobile/tablet browser behavior (fullscreen API support varies).
3. Fix any race conditions in Apps Script (Sheets writes aren't naturally transactional — use `LockService` around write operations like `logViolation`, `submitAnswer`, and attempt creation to avoid concurrent-write corruption when many students submit near-simultaneously).
4. Only after this passes cleanly, use it for a real graded exam.

**Deliverable:** Confidence the system holds up under concurrent real usage.

---

## Phase 10 — Optional Enhancements (post-launch)

- Randomize question order / choice order per student.
- Multiple attempts with configurable attempt limits.
- Question banks / tagging by topic.
- Bulk question generation format compatible with pasting AI-generated question sets.
- Section-wide analytics (item difficulty, most-missed questions).
- Email notifications to teacher when an exam closes.

---

## Suggested Repo Structure

```
proctor-exam/
├── src/
│   ├── pages/
│   │   ├── RoleSelect.jsx
│   │   ├── teacher/ (Login, Dashboard, CreateExam, StudentImport, QuestionImport, Results, Settings)
│   │   └── student/ (Login, PreExamInstructions, ExamRunner, ExamComplete)
│   ├── components/ (shared UI: Timer, ViolationModal, QuestionCard, ResultsTable)
│   ├── hooks/ (useProctoring.js, useTimer.js)
│   ├── context/ (AuthContext.jsx)
│   ├── api/ (api.js — wraps all Apps Script calls)
│   └── App.jsx
├── vite.config.js
└── README.md

apps-script/
├── Code.gs
├── Auth.gs
├── Exams.gs
├── Students.gs
├── Questions.gs
├── Attempts.gs
├── Results.gs
└── Utils.gs
```

---

### Suggested order if you're building solo
Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Each phase is independently testable, so you always have something working rather than a half-built system.

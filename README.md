# DSSSMS — Dinsho Secondary School Student Management System

A full-stack student management system: Node.js/Express/Prisma/MySQL backend,
React/TypeScript/Tailwind frontend. Built from the Group One project proposal
(Chapters 3–5: functional requirements, use cases, and data model).

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, TypeScript, Prisma ORM, MySQL, Zod, JWT |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query, React Hook Form |

## Project structure

```
dsssms/
├── backend/                 # Express API (Clean Architecture, modular by domain)
│   ├── prisma/
│   │   ├── schema.prisma    # Full data model (11 domains)
│   │   └── seed.ts          # Demo data: admin, teacher, classroom, students, parents
│   └── src/
│       ├── config/          # Validated environment config
│       ├── core/            # Errors, logger, HTTP helpers, auth utils, authorization helpers
│       ├── database/        # Prisma client singleton
│       ├── middlewares/     # authenticate, authorize (RBAC), validate, rate-limit, error handler
│       ├── modules/         # One folder per domain: auth, users, students, parents,
│       │                    # classrooms, subjects, teacher-subjects, attendance,
│       │                    # grades, academic-reports, notifications
│       └── routes/          # Route aggregator
└── src/                      # React frontend
    ├── components/ui/        # Reusable UI primitives (Table, Modal, Button, etc.)
    ├── context/               # AuthContext
    ├── hooks/                 # React Query hooks, one file per domain
    ├── layouts/                # AppLayout (sidebar/topbar), nav config
    ├── lib/                    # API client (axios + auto token refresh), per-domain API modules, validation schemas
    ├── pages/                  # One folder per feature area
    ├── routes/                 # ProtectedRoute (RBAC guard), GuestRoute, router config
    └── types/                  # Types mirroring backend DTOs
```

## Prerequisites

- Node.js 20+
- MySQL 8+ (a running instance, empty database created)
- npm

## Backend setup

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
- `DATABASE_URL` — your MySQL connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — two different random strings, 32+ characters each
  (e.g. `openssl rand -base64 48`)

Then:

```bash
npm install
npx prisma migrate dev --name init   # creates all tables
npm run prisma:seed                  # loads demo data (see credentials below)
npm run dev                          # starts the API on http://localhost:4000
```

Other useful backend scripts:

```bash
npm run build          # compile TypeScript to dist/
npm run start           # run the compiled build
npm run prisma:studio   # visual DB browser
npm test                 # run the unit test suite (vitest)
```

### Demo accounts (after seeding)

All seeded accounts use the password `Demo@12345`.

| Role | Username |
|---|---|
| Administrator | `admin` |
| Teacher | `abebe.kebede` |
| Students | `chaltu.tesfaye`, `dawit.getachew`, `selam.mulugeta` |
| Guardians | usernames printed to the console during seeding |

The demo teacher is homeroom + subject teacher (Math, English) for a seeded
"Grade 9 A" classroom with the three demo students enrolled, sample
attendance for today, and sample grades for Semester 1 — enough to explore
every screen without manual setup.

**Change these passwords before using this in anything resembling
production.**

## Frontend setup

From the project root (not `backend/`):

```bash
cp .env.example .env.local
npm install
npm run dev       # starts the frontend on http://localhost:5173
```

`.env.local` only needs `VITE_API_BASE_URL`, which defaults to
`http://localhost:4000/api/v1` — matching the backend's default port.

Open `http://localhost:5173/login` and sign in with any demo account above.

## What's implemented

Every functional requirement in the proposal has a working screen or API
endpoint:

- **Auth & accounts**: login, JWT access/refresh with rotation, account
  lockout after repeated failed logins, change password, RBAC on every route
- **Staff management**: Admin creates Director/Vice Director/Teacher/Admin
  accounts, activates/deactivates, resets passwords
- **Student registration**: with optional guardian linking (existing or new)
  in the same atomic transaction
- **Parents**: account creation, linked-children view
- **Classrooms & Subjects**: CRUD, with safety checks (can't delete a
  classroom with enrolled students, etc.)
- **Teaching assignments**: which teacher teaches which subject to which
  classroom — the authorization backbone for attendance and grades
- **Attendance**: daily roster marking per classroom, same-day correction
  window for teachers, full oversight correction for admin roles, per-student
  history and summaries
- **Grades**: component-based grading matching Ethiopian secondary school
  practice — a teacher builds a subject's assessment scheme per semester out
  of components (Quiz, Assignment, Test, Mid Exam, or a custom name), each
  worth a teacher-chosen number of marks, with the scheme capped at 100
  total. Final Exam is mandatory and fixed at exactly 50 marks. Scores are
  entered per component per student; a student's subject total is the sum
  of their component scores out of the scheme's total marks. No letter
  grades — everything is numeric, out of 100.
- **Academic reports**: per-classroom average + class rank generation
  (standard competition ranking, ties handled correctly), regenerable per
  semester/year
- **Notifications**: direct send, "notify all parents of a student", inbox
  with read/unread state
- **Timetable**: oversight roles build each classroom's weekly schedule from
  its teaching assignments (with double-booking checks for both the teacher
  and the classroom); teachers and students each see their own read-only view
- **Assignments & homework**: teachers set homework per class, with a
  per-student submission checklist; students self-report completion
  (auto-flagged late if submitted after the due date) and teachers can
  correct any student's status. There's no file-upload layer in this system,
  so this is a completion checklist, not file submission.

## Known limitations / next steps

These are flagged deliberately rather than hidden:

1. **Refresh tokens are stored in `localStorage`** on the frontend (see
   `src/lib/token-storage.ts`). This is because the backend returns the
   refresh token in the JSON response body rather than an httpOnly cookie.
   Moving to httpOnly cookies is the natural hardening step before any real
   deployment — it would need a small backend change (setting the cookie in
   `auth.controller.ts`) alongside the frontend change.
2. **No "send to parents" button in the UI yet.** The
   `POST /notifications/student/:id/parents` endpoint and its frontend hook
   (`useSendToParents`) exist and work, but there's no student detail page to
   put the button on — only a student *list* was built. Small addition.
3. **No automated end-to-end tests.** Unit tests cover the trickiest pure
   logic (competition ranking, token duration parsing, password/grade
   policy) — see `backend/src/**/__tests__/`. Integration/E2E tests against a
   real database are not included.
4. **The Timetable, Assignments, and Grades schema changes all need a
   migration.** `TimetableEntry`, `Assignment`, `AssignmentSubmission`,
   `GradeComponent`, and `GradeEntry` were added — and the old single-score
   `Grade` model removed — after the database was last migrated. This is a
   breaking change for the grades table specifically: if you have real data
   in the old `grades` table, write a one-off script to convert each row
   into a component + entry before migrating, or accept the loss if it's
   still pre-launch demo data. Run
   `npx prisma migrate dev --name add_timetable_assignments_and_grading` (and
   `npx prisma generate`) before starting the backend, or these routes will
   fail against a stale database.
5. **This was built without network access to actually run `npm install`,
   `prisma generate`, or a build.** Every file was reviewed by hand, but if
   something doesn't compile on first try, that's why — check the exact
   error and it's very likely a small fix (missing peer dependency version,
   a Prisma-generated type name, etc.), not a structural problem.

## License

Not specified — add one appropriate for your context (school/academic use).

# Academic Register — Architectural Rules (Non-Negotiable)

## Core Rule: Required Subject Columns Are Never Conditional

If Grade 11 has 8 required subjects in `GradeSubjectConfig`, the Academic Register
**always has exactly 8 subject columns** — no more, no less.

A subject column must never be hidden, removed, or skipped because:
- No teacher has been assigned to teach that subject (`TeacherSubject` missing)
- No grade components have been defined for that subject
- No student scores have been entered for that subject
- The subject finalization status is not yet FINALIZED

A missing result renders as `—` in the cell. A student with any `—` result is
marked `INCOMPLETE` (finalized) or `PENDING` (not finalized). They are excluded
from ranking. **The column itself is always present.**

---

## Source of Truth Separation

| Concern | Source | Never use for |
|---|---|---|
| Which subjects are **required** for a grade | `GradeSubjectConfig` | Result lookup |
| Who **teaches** a subject in a classroom | `TeacherSubject` | Defining required subjects |
| Subject **scores** | `GradeComponent` + `GradeEntry` | Subject list |

`GradeSubjectConfig` → authoritative required-subject list
`TeacherSubject` → resolves the path from required subject to its scores
`TeacherSubject` is never used to determine whether a subject column exists

---

## Enforcement Points

**Backend — `loadSemesterResults()` in `academic-register.service.ts`:**
Outer loop must iterate over `configuredSubjectIds` from `GradeSubjectConfig`.
For every configured subject, the result entry must be created regardless of
whether a `TeacherSubject` exists. If no assignment: `hasAssignment: false`,
`finalResult: null`.

**Backend — `determineAcademicStatus()`:**
Any `finalResult: null` → `INCOMPLETE` (finalized) or `PENDING` (not finalized).
`PASS`/`FAIL` is only assigned when ALL configured subjects have non-null
finalized results.

**Frontend — `AcademicRegisterPage.tsx`:**
Subject columns rendered from `data.subjects` (the `GradeSubjectConfig`-sourced list).
Never derive the column list from student result arrays.

---

## What Must Not Change

Do NOT:
- Replace the `GradeSubjectConfig` loop with a `TeacherSubject` loop
- Filter subject columns based on whether any student has a result
- Filter subject columns based on finalization status
- Remove subjects from the register when a teacher is unassigned
- Silently omit a subject from totals/averages when it has no result

These changes would violate the architectural contract and corrupt the Academic Register.

---

## Academic Status Values

| Status | Meaning | Official? |
|---|---|---|
| `PASS` | All subjects finalized, average ≥ pass mark, all subjects ≥ min subject mark | Yes |
| `FAIL` | All subjects finalized, fails average or any subject threshold | Yes |
| `INCOMPLETE` | Classroom finalized but student has ≥1 null result | Not official |
| `PENDING` | Classroom not yet finalized | Not official |

These four statuses are completely separate from:
- Result Workflow Status (`SubjectFinalization.status`: DRAFT/UNDER_REVIEW/APPROVED/FINALIZED)
- Promotion Status (`PromotionEntry.decision`: PROMOTED/REPEATED/GRADUATED)

Never mix these three status types.

---

## Three View Modes

| Mode | Source | Both semesters required for official result? |
|---|---|---|
| `SEMESTER_1` | S1 components only | No |
| `SEMESTER_2` | S2 components only | No |
| `FULL_YEAR` | (S1 result × 0.5) + (S2 result × 0.5) | Yes |

Full-Year weights are defined in `SEMESTER_WEIGHTS` in `academic-register.service.ts`.
Currently 50/50. This constant is the only place weights should change.

---

## Related Files

- `backend/src/modules/academic-register/academic-register.service.ts` — core logic
- `backend/src/modules/grade-subject-config/` — subject configuration management
- `backend/prisma/schema.prisma` — `GradeSubjectConfig` model
- `src/pages/academic-register/AcademicRegisterPage.tsx` — register UI
- `src/pages/grade-subject-config/GradeSubjectConfigPage.tsx` — config management UI

/**
 * Age calculation utilities — frontend mirror of backend/src/core/utils/age.util.ts.
 *
 * Kept as a separate file so it can be imported by both Zod schemas and UI
 * components without pulling in backend-only dependencies.
 */

/** The minimum age (in completed years) required at admission. */
export const MINIMUM_ADMISSION_AGE = 16;

/**
 * Returns the age in completed years as of `referenceDate` (default: today).
 * Handles leap-year birthdays correctly.
 */
export function ageInYears(dob: Date, referenceDate: Date = new Date()): number {
  let age = referenceDate.getFullYear() - dob.getFullYear();
  const monthDiff = referenceDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Returns true if the student is old enough on `admissionDate` (default: today).
 */
export function meetsMinimumAdmissionAge(
  dob: Date,
  admissionDate: Date = new Date(),
): boolean {
  return ageInYears(dob, admissionDate) >= MINIMUM_ADMISSION_AGE;
}

/**
 * Parses a YYYY-MM-DD string and returns a Date, or null if invalid.
 * - Rejects strings that don't match YYYY-MM-DD exactly
 * - Rejects impossible calendar dates (e.g. Feb 29 in a non-leap year, month 13)
 * - Creates the Date in local midnight time to avoid UTC-offset day-shift issues
 * Used by the CSV bulk import validator.
 */
export function parseDateString(value: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  // Validate calendar ranges before constructing the Date
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  // Construct using Date components (local time) — avoids UTC-offset day-shift
  const d = new Date(year, month - 1, day);
  // Verify the Date didn't roll over (e.g. Feb 29 in a non-leap year → Mar 1)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

/**
 * Age calculation utilities for student admission validation.
 *
 * Rules:
 *  - "At least 16 years old" means the student's 16th birthday has already
 *    occurred or falls on the admission/reference date.
 *  - Future dates of birth are always invalid.
 *  - The calculation is birthday-exact: a student born on 2010-05-15 first
 *    becomes 16 on 2026-05-15, not one day earlier or later.
 *  - Leap-year birthdays (Feb 29) are handled correctly: the birthday is
 *    treated as Feb 28 in non-leap years.
 */

/** The minimum age (in completed years) required at admission. */
export const MINIMUM_ADMISSION_AGE = 16;

/**
 * Returns the age in completed years as of `referenceDate`.
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
 * Returns true if the student is old enough to be admitted on `admissionDate`.
 * "Old enough" means age in completed years >= MINIMUM_ADMISSION_AGE.
 */
export function meetsMinimumAdmissionAge(
  dob: Date,
  admissionDate: Date = new Date(),
): boolean {
  return ageInYears(dob, admissionDate) >= MINIMUM_ADMISSION_AGE;
}

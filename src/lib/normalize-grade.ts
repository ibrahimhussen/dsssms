/**
 * normalizeClassName
 *
 * Normalizes classroom grade names to a consistent "Grade N" format
 * regardless of how they were stored in the database.
 *
 * Examples:
 *   "grade 11"  → "Grade 11"
 *   "GRADE 10"  → "Grade 10"
 *   "Grade 9"   → "Grade 9"   (unchanged)
 *   "Grade11"   → "Grade 11"
 *   "11"        → "Grade 11"
 *
 * This mirrors the extractClassName() function used in the backend service
 * (academic-register.service.ts) so both layers produce the same output.
 */
export function normalizeClassName(rawName: string): string {
  const match = rawName.match(/(?:Grade\s*)?(\d+)/i);
  return match ? `Grade ${match[1]}` : rawName;
}

/**
 * Converts a numeric score (0-100) into a letter grade.
 *
 * NOTE: these cutoffs are a sensible default and should be adjusted to
 * match Dinsho Secondary School's official grading policy if it differs
 * from this scale — this is the single place that would need to change.
 */
export function computeLetterGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

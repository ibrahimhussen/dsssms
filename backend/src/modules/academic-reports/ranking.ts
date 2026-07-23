export interface RankableEntry {
  studentId: number;
  average: number;
}

/**
 * Assigns standard competition ranks (1, 2, 2, 4 — ties share a rank, and
 * the rank after a tie skips ahead by the number of tied entries) to a set
 * of student averages. Pure function, no I/O — safe to unit test directly
 * and reused by AcademicReportService.generateClassroomReports.
 */
export function computeCompetitionRanks(entries: RankableEntry[]): Map<number, number> {
  const sorted = [...entries].sort((a, b) => b.average - a.average);
  const rankByStudentId = new Map<number, number>();

  sorted.forEach((entry, index) => {
    if (index > 0 && sorted[index - 1].average === entry.average) {
      rankByStudentId.set(entry.studentId, rankByStudentId.get(sorted[index - 1].studentId)!);
    } else {
      rankByStudentId.set(entry.studentId, index + 1);
    }
  });

  return rankByStudentId;
}

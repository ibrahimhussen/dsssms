import { describe, expect, it } from 'vitest';
import { computeCompetitionRanks } from '../ranking';

describe('computeCompetitionRanks', () => {
  it('ranks distinct averages in descending order (1, 2, 3)', () => {
    const result = computeCompetitionRanks([
      { studentId: 1, average: 70 },
      { studentId: 2, average: 90 },
      { studentId: 3, average: 80 },
    ]);

    expect(result.get(2)).toBe(1);
    expect(result.get(3)).toBe(2);
    expect(result.get(1)).toBe(3);
  });

  it('gives tied averages the same rank and skips the next rank (1, 2, 2, 4)', () => {
    const result = computeCompetitionRanks([
      { studentId: 1, average: 90 },
      { studentId: 2, average: 85 },
      { studentId: 3, average: 85 },
      { studentId: 4, average: 70 },
    ]);

    expect(result.get(1)).toBe(1);
    expect(result.get(2)).toBe(2);
    expect(result.get(3)).toBe(2);
    expect(result.get(4)).toBe(4); // not 3 — standard competition ranking skips ahead by the tie count
  });

  it('handles a three-way tie at the top (1, 1, 1, 4)', () => {
    const result = computeCompetitionRanks([
      { studentId: 1, average: 95 },
      { studentId: 2, average: 95 },
      { studentId: 3, average: 95 },
      { studentId: 4, average: 60 },
    ]);

    expect(result.get(1)).toBe(1);
    expect(result.get(2)).toBe(1);
    expect(result.get(3)).toBe(1);
    expect(result.get(4)).toBe(4);
  });

  it('handles a single entry', () => {
    const result = computeCompetitionRanks([{ studentId: 1, average: 77 }]);
    expect(result.get(1)).toBe(1);
  });

  it('handles an empty list without throwing', () => {
    const result = computeCompetitionRanks([]);
    expect(result.size).toBe(0);
  });

  it('does not mutate the input array', () => {
    const input = [
      { studentId: 1, average: 60 },
      { studentId: 2, average: 90 },
    ];
    const inputCopy = [...input];
    computeCompetitionRanks(input);
    expect(input).toEqual(inputCopy);
  });
});

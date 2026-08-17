import * as crypto from 'crypto';
import { prisma } from '../../database/prisma-client';
import { Prisma } from '@prisma/client';

/**
 * Builds a base username from a person's name, e.g. "Abebe Kebede" -> "abebe.kebede".
 * The caller is responsible for appending a disambiguating suffix if the
 * base is already taken (see ensureUniqueUsername).
 */
export function buildBaseUsername(firstName: string, lastName: string): string {
  const clean = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');

  return `${clean(firstName)}.${clean(lastName)}`;
}

/**
 * Given a base username and a function to check availability, returns the
 * first available variant: "abebe.kebede", then "abebe.kebede2", "abebe.kebede3", ...
 */
export async function ensureUniqueUsername(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>
): Promise<string> {
  let candidate = base;
  let suffix = 1;

  // Bounded loop — a school will never have thousands of same-name collisions.
  while (await isTaken(candidate)) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }

  return candidate;
}

/**
 * Generates the official permanent student ID in the form DSH-YYYY-NNNNN,
 * e.g. DSH-2026-00001. Uses the StudentIdCounter table for a concurrency-safe
 * sequential counter. Two simultaneous registrations for the same year
 * serialize on the MySQL row-level lock acquired by the UPDATE and receive
 * different sequence numbers.
 *
 * Must be called inside a Prisma transaction so the counter increment and
 * student creation are atomic.
 */
export async function generateStudentId(
  tx: Prisma.TransactionClient,
  year: number = new Date().getFullYear()
): Promise<string> {
  // Upsert ensures the counter row exists for this year, then increment atomically.
  // Using $executeRaw for the atomic increment — Prisma's update cannot do
  // "SET field = field + 1" and read the result in one round-trip on all drivers.
  await tx.$executeRaw`
    INSERT INTO student_id_counters (year, lastSequence, updatedAt)
    VALUES (${year}, 1, NOW())
    ON DUPLICATE KEY UPDATE lastSequence = lastSequence + 1, updatedAt = NOW()
  `;

  const counter = await tx.studentIdCounter.findUniqueOrThrow({ where: { year } });
  const seq = String(counter.lastSequence).padStart(5, '0');
  return `DSH-${year}-${seq}`;
}

/**
 * @deprecated Use generateStudentId(tx, year) instead.
 * Kept only so existing bulk-import retry logic (which catches P2002 on
 * admissionNumber) continues to compile until fully migrated.
 */
export function generateAdmissionNumber(year: number = new Date().getFullYear()): string {
  const randomPart = crypto.randomInt(10000, 99999);
  return `ADM-${year}-${randomPart}`;
}

/**
 * Generates a random, policy-compliant temporary password for accounts
 * created by an administrator (staff, students, parents). The user is
 * expected to change it on first login.
 */
export function generateTemporaryPassword(): string {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const special = '!@#$%&*';

  const pick = (charset: string) => charset[crypto.randomInt(0, charset.length)];

  const required = [pick(lower), pick(upper), pick(digits), pick(special)];
  const all = lower + upper + digits + special;
  const rest = Array.from({ length: 6 }, () => pick(all));

  const combined = [...required, ...rest];

  // Shuffle (Fisher-Yates) so the required characters aren't always in the same position.
  for (let i = combined.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join('');
}

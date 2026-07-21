import * as crypto from 'crypto';

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
 * Generates an admission number in the form ADM-<YEAR>-<5 random digits>,
 * e.g. ADM-2026-04821. Uniqueness is enforced at the database level
 * (Student.admissionNumber is @unique); on collision the caller retries.
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

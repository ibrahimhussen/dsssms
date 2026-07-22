/** Drops undefined/empty values so axios doesn't send `?search=&page=1` noise. */
export function cleanParams<T extends Record<string, unknown>>(params: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(params) as (keyof T)[]) {
    const value = params[key];
    if (value !== undefined && value !== '') {
      result[key] = value;
    }
  }
  return result;
}

/** Drops undefined/empty values so axios doesn't send `?search=&page=1` noise. */
export function cleanParams(params: object): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      result[key] = value;
    }
  }
  return result;
}

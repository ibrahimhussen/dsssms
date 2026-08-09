/** Drops undefined/empty values so axios doesn't send `?search=&page=1` noise. */
export function cleanParams(params: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value !== undefined && value !== '') {
      result[key] = value;
    }
  }
  return result;
}


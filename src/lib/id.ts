export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 18)}`;
}

export function createSlug(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 10);
}

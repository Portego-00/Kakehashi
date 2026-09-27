export function canAccessBunpro(username?: string | null): boolean {
  return Boolean(username?.trim());
}

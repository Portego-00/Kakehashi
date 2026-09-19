export function canAccessCoreStudy(username?: string | null): boolean {
  return Boolean(username?.trim());
}

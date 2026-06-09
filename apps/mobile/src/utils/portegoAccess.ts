export function isPortegoUsername(username?: string | null): boolean {
  return (username?.trim().toLowerCase() ?? "") === "portego";
}


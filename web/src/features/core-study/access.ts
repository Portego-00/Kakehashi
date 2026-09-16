import { isPortegoUsername } from "../../../../src/utils/portegoAccess";

export function canAccessCoreStudy(username?: string | null, isDemo = false): boolean {
  return !isDemo && isPortegoUsername(username);
}

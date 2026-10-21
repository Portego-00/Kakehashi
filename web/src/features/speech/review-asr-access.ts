import { isPortegoUsername } from "../../../../src/utils/portegoAccess";

export function canUseReviewAsr(username?: string | null, isDemo = false) {
  return !isDemo && isPortegoUsername(username);
}

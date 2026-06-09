import { hasWaniKaniApiToken } from "@kakehashi/core";

export function SharedCoreSmokeTest() {
  const ok = hasWaniKaniApiToken("shared-core");

  return (
    <span data-shared-core-ok={ok ? "true" : "false"} hidden>
      shared core loaded
    </span>
  );
}

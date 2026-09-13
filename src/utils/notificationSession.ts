let notificationSessionGeneration = 0;
let notificationSessionSuspended = false;

/** Block account-derived notification work before logout starts awaiting I/O. */
export function suspendNotificationSessionForLogout(): void {
  if (!notificationSessionSuspended) {
    notificationSessionGeneration += 1;
    notificationSessionSuspended = true;
  }
}

/** Re-enable notification work after an authenticated token is available. */
export function resumeNotificationSession(): void {
  if (notificationSessionSuspended) {
    notificationSessionGeneration += 1;
    notificationSessionSuspended = false;
  }
}

export function isNotificationSessionActive(): boolean {
  return !notificationSessionSuspended;
}

export function getNotificationSessionGeneration(): number | null {
  return notificationSessionSuspended ? null : notificationSessionGeneration;
}

export function isNotificationSessionCurrent(generation: number): boolean {
  return (
    !notificationSessionSuspended &&
    generation === notificationSessionGeneration
  );
}

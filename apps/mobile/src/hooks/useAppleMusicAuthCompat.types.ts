export type AppleMusicAuthStatus =
  | "authorized"
  | "denied"
  | "notDetermined"
  | "restricted"
  | "unknown";

export interface AppleMusicSubscriptionStatus {
  canPlayCatalogContent: boolean;
  canBecomeSubscriber: boolean;
  hasCloudLibraryEnabled: boolean;
  isMusicCatalogSubscriptionEligible: boolean;
}

export interface AppleMusicAuthCompat {
  available: boolean;
  requestAuthorization: () => Promise<AppleMusicAuthStatus>;
  checkSubscription: () => Promise<AppleMusicSubscriptionStatus>;
  isAuthenticating: boolean;
  error: Error | null;
}

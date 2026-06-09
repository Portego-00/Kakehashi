export type ReviewFeatureSupport = {
  audio: boolean;
  haptics: boolean;
  notifications: boolean;
};

export const WEB_REVIEW_FEATURE_SUPPORT: ReviewFeatureSupport = {
  audio: false,
  haptics: false,
  notifications: false,
};

export function getUnsupportedReviewFeatures(
  support: ReviewFeatureSupport
): Array<keyof ReviewFeatureSupport> {
  return Object.entries(support)
    .filter(([, enabled]) => !enabled)
    .map(([feature]) => feature as keyof ReviewFeatureSupport);
}

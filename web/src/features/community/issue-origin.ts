export const WEB_ISSUE_ORIGIN_LABEL = "origin:web";

export function webIssueOriginLabels() {
  return [WEB_ISSUE_ORIGIN_LABEL];
}

export function hasWebIssueOrigin(labels: unknown): boolean {
  return Array.isArray(labels) && labels.some((label) => label === WEB_ISSUE_ORIGIN_LABEL);
}

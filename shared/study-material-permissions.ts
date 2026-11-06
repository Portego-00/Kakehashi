export const STUDY_MATERIAL_TOKEN_SETTINGS_URL = "https://www.wanikani.com/settings/personal_access_tokens";
export const STUDY_MATERIAL_PERMISSION_TITLE = "Enable saving notes";
export const STUDY_MATERIAL_PERMISSION_MESSAGE = "WaniKani did not allow this change. Edit the API token you use for Kakehashi and check study_materials:create and study_materials:update. Save the token settings, then try again. If the token was replaced or revoked, reconnect Kakehashi. Your unsaved changes are still here.";
export const STUDY_MATERIAL_PERMISSION_SUMMARY = "Check study_materials:create and study_materials:update in your WaniKani API token settings, then try again. Your changes are still here.";

/** Only use for rejected study-material writes; other requests have other scopes. */
export function isStudyMaterialPermissionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { statusCode?: unknown; status?: unknown; message?: unknown };
  const status = typeof candidate.statusCode === "number" ? candidate.statusCode : candidate.status;
  if (typeof status === "number") return status === 401 || status === 403;
  // Older native clients retained HTTP status only in the error message.
  return typeof candidate.message === "string" && (
    /\b(?:API error|HTTP(?: status)?|status(?: code)?)[\s:]+(?:401|403)\b/i.test(candidate.message)
    || /^(?:unauthorized|forbidden)(?:[.!:\s]|$)/i.test(candidate.message)
  );
}

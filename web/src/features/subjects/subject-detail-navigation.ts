import { safeInternalPath } from "@/lib/navigation";

function isSupportedSubjectReturnPath(path: string) {
  return path === "/search"
    || path.startsWith("/search?")
    || path === "/reviews"
    || path.startsWith("/reviews?")
    || path === "/lessons"
    || path.startsWith("/lessons?")
    || path === "/study"
    || path.startsWith("/study/")
    || path.startsWith("/study?")
    || path === "/music"
    || path.startsWith("/music?");
}

export function resolveSubjectReturnPath(value: string | null | undefined) {
  const path = safeInternalPath(value, "/search");
  return isSupportedSubjectReturnPath(path) ? path : "/search";
}

export function subjectReturnLabel(returnTo: string) {
  if (returnTo === "/reviews" || returnTo.startsWith("/reviews?")) return "Back to reviews";
  if (returnTo === "/lessons" || returnTo.startsWith("/lessons?")) return "Back to lessons";
  if (returnTo === "/study" || returnTo.startsWith("/study/") || returnTo.startsWith("/study?")) return "Back to study";
  if (returnTo === "/music" || returnTo.startsWith("/music?")) return "Back to lyrics";
  return "Subject search";
}

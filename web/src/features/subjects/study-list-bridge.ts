import { saveSubjectLists, type StudyStorageScope } from "@/features/study/storage";
import type { SubjectList } from "./lists";

export function bridgeListsToStudy(scope: StudyStorageScope | null | undefined, lists: SubjectList[]) {
  if (scope === null || scope === undefined) return false;
  return saveSubjectLists(scope, lists);
}

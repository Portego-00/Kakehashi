import { useCallback, useEffect, useState } from "react";
import {
  createSubjectList,
  deleteSubjectList,
  getSubjectLists,
  renameSubjectList,
  replaceSubjectIdsInList,
  SubjectList,
} from "../utils/subjectLists";

interface UseSubjectListsState {
  isLoading: boolean;
  error: string | null;
  lists: SubjectList[];
  reload: () => Promise<void>;
  createList: (name: string, initialSubjectIds?: number[]) => Promise<SubjectList>;
  renameList: (listId: string, name: string) => Promise<SubjectList | null>;
  deleteList: (listId: string) => Promise<boolean>;
  replaceListSubjects: (
    listId: string,
    subjectIds: number[]
  ) => Promise<SubjectList | null>;
}

export function useSubjectLists(): UseSubjectListsState {
  const [lists, setLists] = useState<SubjectList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const nextLists = await getSubjectLists();
      setLists(nextLists);
    } catch (err) {
      console.error("Failed to load subject lists:", err);
      setError("Failed to load lists.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const createList = useCallback(
    async (name: string, initialSubjectIds: number[] = []) => {
      const list = await createSubjectList(name, initialSubjectIds);
      await reload();
      return list;
    },
    [reload]
  );

  const renameList = useCallback(
    async (listId: string, name: string) => {
      const updated = await renameSubjectList(listId, name);
      await reload();
      return updated;
    },
    [reload]
  );

  const removeList = useCallback(
    async (listId: string) => {
      const deleted = await deleteSubjectList(listId);
      await reload();
      return deleted;
    },
    [reload]
  );

  const replaceListSubjects = useCallback(
    async (listId: string, subjectIds: number[]) => {
      const updated = await replaceSubjectIdsInList(listId, subjectIds);
      await reload();
      return updated;
    },
    [reload]
  );

  return {
    isLoading,
    error,
    lists,
    reload,
    createList,
    renameList,
    deleteList: removeList,
    replaceListSubjects,
  };
}

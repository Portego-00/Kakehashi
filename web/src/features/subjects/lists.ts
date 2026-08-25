export interface SubjectList {
  id: string;
  name: string;
  subjectIds: number[];
  createdAt: string;
  updatedAt: string;
}

interface ListEnvelope { version: 1; lists: SubjectList[] }
export interface ListStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export const SUBJECT_LISTS_EVENT = "kakehashi-subject-lists-change";

function validList(value: unknown): value is SubjectList {
  if (!value || typeof value !== "object") return false;
  const list = value as Partial<SubjectList>;
  return typeof list.id === "string" && typeof list.name === "string" && Array.isArray(list.subjectIds) && list.subjectIds.every((id) => Number.isInteger(id)) && typeof list.createdAt === "string" && typeof list.updatedAt === "string";
}

export function listStorageKey(username: string) {
  return `kakehashi-web:subject-lists:${encodeURIComponent(username.trim().toLocaleLowerCase())}:v1`;
}

function notifySubjectLists(username: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SUBJECT_LISTS_EVENT, { detail: { username } }));
  }
}

export function subscribeSubjectLists(username: string, onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const key = listStorageKey(username);
  const normalized = username.trim().toLocaleLowerCase();
  const onStorage = (event: StorageEvent) => { if (event.key === key) onChange(); };
  const onListsChange = (event: Event) => {
    const changed = (event as CustomEvent<{ username?: string }>).detail?.username?.trim().toLocaleLowerCase();
    if (changed === normalized) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SUBJECT_LISTS_EVENT, onListsChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SUBJECT_LISTS_EVENT, onListsChange);
  };
}

export function createListRepository(
  storage: ListStorage,
  username: string,
  now: () => Date = () => new Date(),
  idFactory: () => string = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
) {
  const key = listStorageKey(username);
  const load = (): SubjectList[] => {
    try {
      const raw = storage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Partial<ListEnvelope>;
      return parsed.version === 1 && Array.isArray(parsed.lists) ? parsed.lists.filter(validList) : [];
    } catch {
      return [];
    }
  };
  const save = (lists: SubjectList[]) => {
    storage.setItem(key, JSON.stringify({ version: 1, lists } satisfies ListEnvelope));
    notifySubjectLists(username);
    return lists;
  };
  const update = (change: (lists: SubjectList[]) => SubjectList[]) => save(change(load()));

  return {
    key,
    snapshot: () => storage.getItem(key) ?? "",
    load,
    replace(lists: SubjectList[]) { return save(lists.filter(validList)); },
    create(name: string) {
      const timestamp = now().toISOString();
      const list = { id: idFactory(), name: name.trim() || "Untitled list", subjectIds: [], createdAt: timestamp, updatedAt: timestamp };
      save([...load(), list]);
      return list;
    },
    rename(id: string, name: string) { return update((lists) => lists.map((list) => list.id === id ? { ...list, name: name.trim() || "Untitled list", updatedAt: now().toISOString() } : list)); },
    remove(id: string) { return update((lists) => lists.filter((list) => list.id !== id)); },
    restore(list: SubjectList, toIndex = 0) { return update((lists) => { const copy = lists.filter((item) => item.id !== list.id); copy.splice(Math.max(0, Math.min(toIndex, copy.length)), 0, list); return copy; }); },
    reorder(id: string, toIndex: number) {
      return update((lists) => {
        const fromIndex = lists.findIndex((list) => list.id === id);
        if (fromIndex < 0) return lists;
        const copy = [...lists];
        const [target] = copy.splice(fromIndex, 1);
        copy.splice(Math.max(0, Math.min(toIndex, copy.length)), 0, target);
        return copy;
      });
    },
    addSubject(id: string, subjectId: number) { return update((lists) => lists.map((list) => list.id === id && !list.subjectIds.includes(subjectId) ? { ...list, subjectIds: [...list.subjectIds, subjectId], updatedAt: now().toISOString() } : list)); },
    removeSubject(id: string, subjectId: number) { return update((lists) => lists.map((list) => list.id === id ? { ...list, subjectIds: list.subjectIds.filter((value) => value !== subjectId), updatedAt: now().toISOString() } : list)); },
    reorderSubject(id: string, subjectId: number, toIndex: number) {
      return update((lists) => lists.map((list) => {
        if (list.id !== id) return list;
        const fromIndex = list.subjectIds.indexOf(subjectId);
        if (fromIndex < 0) return list;
        const subjectIds = [...list.subjectIds];
        const [target] = subjectIds.splice(fromIndex, 1);
        subjectIds.splice(Math.max(0, Math.min(toIndex, subjectIds.length)), 0, target);
        return { ...list, subjectIds, updatedAt: now().toISOString() };
      }));
    },
  };
}

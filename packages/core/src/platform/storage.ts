export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type SyncKeyValueStorage = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
};

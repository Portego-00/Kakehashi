export type ReadingProgress = { bookId: string; page: number; totalPages: number };

// Keep the last page available to flush even when the debounce timer is cancelled.
export function createReadingProgressSaver(
  persist: (progress: ReadingProgress) => Promise<void>,
  onError: (error: unknown) => void,
) {
  let pending: ReadingProgress | null = null;
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writes = Promise.resolve();

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const progress = pending;
    const savingRevision = revision;
    pending = null;
    if (progress) {
      writes = writes.then(() => persist(progress)).catch((error) => {
        // Preserve failed progress for the next lifecycle flush without replacing a newer page.
        if (revision === savingRevision) pending ??= progress;
        onError(error);
      });
    }
    return writes;
  };

  return {
    queue(progress: ReadingProgress) {
      revision += 1;
      pending = progress;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 450);
    },
    flush,
  };
}

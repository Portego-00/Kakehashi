import {
  getDataUpdatedAt,
  getFromCache,
  saveDataUpdatedAt,
  saveToCache,
} from "../utils/cache";
import {
  getFromPermanentStorage,
  PERMANENT_KEYS,
  saveAssignmentsToPermanentStorage,
} from "../utils/permanentStorage";

const ASSIGNMENTS_CACHE_KEY = "assignments_all";

type AssignmentCacheRecord = {
  id: number;
  data_updated_at?: string;
};

type AssignmentCacheCollection<Assignment extends AssignmentCacheRecord> = {
  data: Assignment[];
  data_updated_at: string;
  total_count: number;
};

let assignmentCacheLock: Promise<void> = Promise.resolve();
let assignmentCacheMutationRevision = 0;
let assignmentCacheInvalidationRevision = 0;
const assignmentMutationRevisions = new Map<number, number>();

function parseUpdatedAt(value: string | null | undefined): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function selectNewestCollectionTimestamp(
  timestamps: (string | null | undefined)[],
  fallback: string
): string {
  let newestTimestamp = fallback;
  let newestTimestampMs = parseUpdatedAt(fallback);

  for (const timestamp of timestamps) {
    const timestampMs = parseUpdatedAt(timestamp);
    if (timestamp && timestampMs > newestTimestampMs) {
      newestTimestamp = timestamp;
      newestTimestampMs = timestampMs;
    }
  }

  return newestTimestamp;
}

export function captureAssignmentCacheMutationRevision(): number {
  return assignmentCacheMutationRevision;
}

export function reserveAssignmentCacheMutation(assignmentId: number): void {
  assignmentCacheMutationRevision += 1;
  assignmentMutationRevisions.set(
    assignmentId,
    assignmentCacheMutationRevision
  );
}

export function invalidateAssignmentCacheWrites(): void {
  assignmentCacheMutationRevision += 1;
  assignmentCacheInvalidationRevision = assignmentCacheMutationRevision;
  assignmentMutationRevisions.clear();
}

export async function withAssignmentCacheLock<T>(
  operation: () => Promise<T>
): Promise<T> {
  const previousOperation = assignmentCacheLock;
  let releaseOperation!: () => void;
  assignmentCacheLock = new Promise<void>((resolve) => {
    releaseOperation = resolve;
  });

  await previousOperation;
  try {
    return await operation();
  } finally {
    releaseOperation();
  }
}

/**
 * Commit a fetched assignment snapshot while retaining assignment records that
 * were changed locally after the fetch began. All canonical assignment-cache
 * readers and writers share the same lock, so a protected mutation is present
 * before a later snapshot commit reads the current cache.
 */
export async function persistAssignmentCollectionInCaches<
  Assignment extends AssignmentCacheRecord,
  Collection extends AssignmentCacheCollection<Assignment>,
>(
  incomingCollection: Collection,
  fetchStartMutationRevision: number
): Promise<Collection> {
  return withAssignmentCacheLock(async () => {
    const [cachedCollection, permanentEntry, persistedCursor] = await Promise.all([
      getFromCache<Collection>(ASSIGNMENTS_CACHE_KEY, undefined, {
        ignoreTTL: true,
      }),
      getFromPermanentStorage<Assignment[]>(PERMANENT_KEYS.ALL_ASSIGNMENTS, {
        ignoreTTL: true,
      }),
      getDataUpdatedAt("assignments"),
    ]);

    if (
      assignmentCacheInvalidationRevision > fetchStartMutationRevision
    ) {
      return incomingCollection;
    }

    const currentAssignments = new Map<number, Assignment>();
    for (const assignment of permanentEntry?.data ?? []) {
      currentAssignments.set(assignment.id, assignment);
    }
    // AsyncStorage is the primary assignment cache. Prefer its record when the
    // two stores carry the same server timestamp, otherwise retain the newer one.
    for (const assignment of cachedCollection?.data?.data ?? []) {
      const permanentAssignment = currentAssignments.get(assignment.id);
      currentAssignments.set(
        assignment.id,
        !permanentAssignment ||
          parseUpdatedAt(assignment.data_updated_at) >=
            parseUpdatedAt(permanentAssignment.data_updated_at)
          ? assignment
          : permanentAssignment
      );
    }

    const incomingIds = new Set<number>();
    const mergedAssignments = incomingCollection.data.map((assignment) => {
      incomingIds.add(assignment.id);
      const mutationRevision = assignmentMutationRevisions.get(assignment.id);
      const currentAssignment = currentAssignments.get(assignment.id);
      return currentAssignment &&
        ((mutationRevision !== undefined &&
          mutationRevision > fetchStartMutationRevision) ||
          parseUpdatedAt(currentAssignment.data_updated_at) >
            parseUpdatedAt(assignment.data_updated_at))
        ? currentAssignment
        : assignment;
    });

    for (const [assignmentId, currentAssignment] of currentAssignments) {
      const mutationRevision = assignmentMutationRevisions.get(assignmentId);
      if (
        !incomingIds.has(assignmentId) &&
        ((mutationRevision !== undefined &&
          mutationRevision > fetchStartMutationRevision) ||
          parseUpdatedAt(currentAssignment.data_updated_at) >
            parseUpdatedAt(incomingCollection.data_updated_at))
      ) {
        mergedAssignments.push(currentAssignment);
      }
    }

    const mergedCollection = {
      ...incomingCollection,
      data: mergedAssignments,
      total_count: mergedAssignments.length,
      data_updated_at: selectNewestCollectionTimestamp(
        [
          cachedCollection?.data?.data_updated_at,
          permanentEntry?.dataUpdatedAt,
          persistedCursor,
          incomingCollection.data_updated_at,
        ],
        incomingCollection.data_updated_at
      ),
    } as Collection;

    await saveToCache(
      ASSIGNMENTS_CACHE_KEY,
      mergedCollection,
      mergedCollection.data_updated_at
    );
    await saveAssignmentsToPermanentStorage(
      mergedAssignments,
      mergedCollection.data_updated_at
    );
    await saveDataUpdatedAt(
      "assignments",
      mergedCollection.data_updated_at
    );

    return mergedCollection;
  });
}

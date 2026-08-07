export type QueuedChange = {
  id: string;
  eventId: string;
  label: string;
  createdAt: number;
  status: "queued" | "syncing" | "needsResolution";
  kind: "workCompletion";
  payload: {
    itemId: string;
    completed: boolean;
    expectedUpdatedAt: number;
    serverStatusAtQueue: "open" | "inProgress" | "blocked" | "completed";
  };
  error?: string;
};

export type OfflinePackage = {
  eventId: string;
  selected: { plan: boolean; work: boolean; files: boolean };
  downloadedAt: number;
  counts: { plan: number; work: number; files: number };
  /** Serialized event data, deliberately excluding signed file URLs. */
  plan: Array<{
    id: string;
    title: string;
    scheduledFor: string;
    location?: string;
  }>;
  work: Array<{
    id: string;
    title: string;
    status: "open" | "inProgress" | "blocked" | "completed";
    updatedAt: number;
  }>;
  lastSuccessfulSyncAt?: number;
};

const dbName = "race-planner-offline";
const changesStore = "changes";
const packagesStore = "packages";

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(changesStore))
        db.createObjectStore(changesStore, { keyPath: "id" });
      if (!db.objectStoreNames.contains(packagesStore))
        db.createObjectStore(packagesStore, { keyPath: "eventId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(
  storeName: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(
        db.transaction(storeName, mode).objectStore(storeName),
      );
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

function id() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export async function queueWorkCompletion(
  input: Omit<QueuedChange, "id" | "createdAt" | "status" | "kind">,
) {
  const change: QueuedChange = {
    ...input,
    id: id(),
    createdAt: Date.now(),
    status: "queued",
    kind: "workCompletion",
  };
  await transact(changesStore, "readwrite", (store) => store.put(change));
  return change;
}

export async function listQueuedChanges(eventId: string) {
  const changes = await transact<QueuedChange[]>(
    changesStore,
    "readonly",
    (store) => store.getAll(),
  );
  return changes
    .filter((item) => item.eventId === eventId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateQueuedChange(change: QueuedChange) {
  await transact(changesStore, "readwrite", (store) => store.put(change));
}

export async function removeQueuedChange(id: string) {
  await transact(changesStore, "readwrite", (store) => store.delete(id));
}

export async function saveOfflinePackage(value: OfflinePackage) {
  await transact(packagesStore, "readwrite", (store) => store.put(value));
}

export async function getOfflinePackage(eventId: string) {
  return await transact<OfflinePackage | undefined>(
    packagesStore,
    "readonly",
    (store) => store.get(eventId),
  );
}

export async function markSuccessfulSync(eventId: string) {
  const value = await getOfflinePackage(eventId);
  if (value === undefined) return;
  const next = { ...value, lastSuccessfulSyncAt: Date.now() };
  await saveOfflinePackage(next);
  return next;
}

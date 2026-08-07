export type QueuedChange = {
  id: string;
  eventId: string;
  label: string;
  createdAt: number;
};
const dbName = "race-planner-offline";
const storeName = "changes";

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(storeName, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function listQueuedChanges(eventId: string) {
  const db = await open();
  const changes = await new Promise<QueuedChange[]>((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).getAll();
    request.onsuccess = () =>
      resolve(request.result.filter((item) => item.eventId === eventId));
    request.onerror = () => reject(request.error);
  });
  db.close();
  return changes.sort((a, b) => a.createdAt - b.createdAt);
}

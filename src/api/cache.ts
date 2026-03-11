const DB_NAME = "variance-dashboard";
const DB_VERSION = 1;
const STORE_NAME = "jobs";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function getCachedMachineNames(
  jobIds: number[],
): Promise<Map<number, string>> {
  const db = await openDB();
  const result = new Map<number, string>();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  await Promise.all(
    jobIds.map(
      (id) =>
        new Promise<void>((resolve) => {
          const req = store.get(id);
          req.onsuccess = () => {
            if (req.result) result.set(id, req.result);
            resolve();
          };
          req.onerror = () => resolve();
        }),
    ),
  );
  return result;
}

export async function cacheMachineNames(
  entries: Map<number, string>,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  for (const [id, name] of entries) {
    store.put(name, id);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

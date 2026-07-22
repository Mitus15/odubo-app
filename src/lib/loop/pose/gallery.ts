/**
 * Local Pose Studio gallery — IndexedDB, on-device, nothing uploaded.
 *
 * Holds BOTH stills and clips as Blobs (localStorage can't: ~5MB of strings
 * only). This is the interim persistence "for now"; when R2 lands it becomes the
 * sync source (upload each item, keep the local copy). No dependencies.
 */

const DB_NAME = "loopsoul-pose";
const STORE = "items";
const VERSION = 1;

export type GalleryKind = "image" | "video";
export type GalleryItem = {
  id: string;
  kind: GalleryKind;
  blob: Blob;
  mime: string;
  createdAt: number;
};

function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** Persist a still or clip; returns the stored item. No-op-safe if IDB missing. */
export async function saveItem(blob: Blob, kind: GalleryKind): Promise<GalleryItem | null> {
  if (!idbAvailable()) return null;
  const item: GalleryItem = { id: newId(), kind, blob, mime: blob.type || (kind === "video" ? "video/webm" : "image/jpeg"), createdAt: Date.now() };
  await tx("readwrite", (s) => s.put(item));
  return item;
}

/** All items, newest first. */
export async function listItems(): Promise<GalleryItem[]> {
  if (!idbAvailable()) return [];
  const all = await tx<GalleryItem[]>("readonly", (s) => s.getAll() as IDBRequest<GalleryItem[]>);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteItem(id: string): Promise<void> {
  if (!idbAvailable()) return;
  await tx("readwrite", (s) => s.delete(id));
}

export async function clearItems(): Promise<void> {
  if (!idbAvailable()) return;
  await tx("readwrite", (s) => s.clear());
}

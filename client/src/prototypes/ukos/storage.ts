import { type SavedWorkshop, validWorkshop } from "./protocol";

const databaseName = "hackademy-ukos-prototype";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("workshops");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Lokalny zapis jest niedostępny."));
    request.onblocked = () =>
      reject(new Error("Inna karta blokuje lokalny zapis."));
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = database.transaction("workshops", mode);
      const request = operation(tx.objectStore("workshops"));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () =>
        reject(tx.error ?? new Error("Nie udało się zapisać warsztatu."));
      tx.onabort = () =>
        reject(tx.error ?? new Error("Przerwano zapis warsztatu."));
    });
  } finally {
    database.close();
  }
}

export const workshopStorage = {
  async load(key: string, version: string) {
    const value: unknown = await transaction("readonly", (store) =>
      store.get(key),
    );
    if (value === undefined) return null;
    if (
      !validWorkshop(
        value,
        version,
        key.startsWith("ukos-course:") ? 15 : undefined,
      )
    )
      throw new Error("Zapis jest uszkodzony lub niezgodny z obrazem.");
    return value;
  },
  async save(key: string, workshop: SavedWorkshop) {
    await transaction("readwrite", (store) => store.put(workshop, key));
  },
  async clear(key: string) {
    await transaction("readwrite", (store) => store.delete(key));
  },
};

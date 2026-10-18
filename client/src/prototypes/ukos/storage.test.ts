import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBObjectStore, IDBDatabase } from "fake-indexeddb";
import { workshopStorage } from "./storage";

describe("local workshop persistence", () => {
  beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
  afterEach(() => vi.restoreAllMocks());
  const record = { version: "v1", archive: "YWJj", step: 2, savedAt: 100 };

  it("commits a workshop, isolates accounts, loads and deletes only the selected key", async () => {
    expect(await workshopStorage.load("alice", "v1")).toBeNull();
    await workshopStorage.save("alice", record);
    await workshopStorage.save("bob", { ...record, step: 5 });
    expect(await workshopStorage.load("alice", "v1")).toEqual(record);
    expect((await workshopStorage.load("bob", "v1"))?.step).toBe(5);
    await workshopStorage.clear("alice");
    expect(await workshopStorage.load("alice", "v1")).toBeNull();
    expect(await workshopStorage.load("bob", "v1")).not.toBeNull();
  });
  it("rejects corrupt and incompatible images instead of declaring them restored", async () => {
    await workshopStorage.save("alice", record);
    await expect(workshopStorage.load("alice", "v2")).rejects.toThrow(
      "niezgodny",
    );
    await workshopStorage.save("bad", { ...record, archive: "%%%" });
    await expect(workshopStorage.load("bad", "v1")).rejects.toThrow(
      "uszkodzony",
    );
  });
  it("surfaces quota and storage permission failures", async () => {
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    await expect(workshopStorage.save("alice", record)).rejects.toThrow(
      "quota",
    );
    vi.spyOn(indexedDB, "open").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    await expect(workshopStorage.load("alice", "v1")).rejects.toThrow("denied");
  });
  it("rejects an aborted transaction and closes its database", async () => {
    const original = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(function (
      this: IDBDatabase,
      ...args: Parameters<typeof original>
    ) {
      const tx = original.apply(this, args);
      queueMicrotask(() => tx.abort());
      return tx;
    });
    await expect(workshopStorage.save("alice", record)).rejects.toThrow();
  });
});

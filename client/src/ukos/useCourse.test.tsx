import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { courseRequest, type CourseState } from "./api";
import { useCourse } from "./useCourse";
vi.mock("./api", () => ({ courseRequest: vi.fn() }));
const state = (completedSteps = 0): CourseState => ({ completedSteps });
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(courseRequest).mockResolvedValue(state());
});
afterEach(() => vi.restoreAllMocks());
it("restores the furthest account progress and synchronizes offline completions", async () => {
  localStorage.setItem("ukos-progress-v1:alice", "8");
  vi.mocked(courseRequest).mockImplementation(async (_token, completedSteps) =>
    state(completedSteps ?? 3),
  );
  const { result } = renderHook(() => useCourse("alice", "sessionKey"));
  await waitFor(() => expect(result.current.synchronized).toBe(true));
  expect(result.current.completed).toBe(8);
  expect(result.current.successCount).toBe(0);
  act(() => {
    result.current.progress(9);
    result.current.progress(2);
    result.current.progress(16);
  });
  expect(localStorage.getItem("ukos-progress-v1:alice")).toBe("9");
  await act(async () => {
    await result.current.sync();
  });
  expect(result.current.completed).toBe(9);
  expect(result.current.synchronized).toBe(true);
  expect(result.current.successCount).toBe(1);
});
it("retains local progress across network errors and retries on online and visibility", async () => {
  localStorage.setItem("ukos-progress-v1:alice", "5");
  vi.mocked(courseRequest).mockRejectedValue(new Error("Offline"));
  const { result, unmount } = renderHook(() => useCourse("alice", "sessionKey"));
  await waitFor(() => expect(result.current.error).toBe("Offline"));
  expect(result.current.completed).toBe(5);
  expect(result.current.synchronized).toBe(false);
  vi.mocked(courseRequest).mockResolvedValue(state(5));
  act(() => window.dispatchEvent(new Event("online")));
  await waitFor(() => expect(result.current.synchronized).toBe(true));
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  await waitFor(() => expect(result.current.syncing).toBe(false));
  unmount();
});
it("reports unavailable local storage", async () => {
  vi.mocked(courseRequest).mockResolvedValue(state(15));
  const { result } = renderHook(() => useCourse("bob", "sessionKey"));
  await waitFor(() => expect(result.current.synchronized).toBe(true));
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  vi.mocked(courseRequest).mockResolvedValue(state(15));
  await act(async () => {
    await result.current.sync();
  });
  expect(result.current.storageError).toContain("lokalnie");
});
it("ignores malformed saved progress and stale responses after unmount", async () => {
  localStorage.setItem("ukos-progress-v1:alice", "NaN");
  let resolve!: (value: CourseState) => void;
  vi.mocked(courseRequest).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { result, unmount } = renderHook(() => useCourse("alice", "sessionKey"));
  expect(result.current.completed).toBe(0);
  unmount();
  await act(async () => resolve(state(15)));
  expect(localStorage.getItem("ukos-progress-v1:alice")).toBe("NaN");
});

it("does not celebrate replayed runtime progress, duplicates or already recorded server progress", async () => {
  vi.mocked(courseRequest).mockImplementation(async (_token, completed) => state(completed ?? 0));
  const { result } = renderHook(() => useCourse("alice", "sessionKey"));
  await waitFor(() => expect(result.current.synchronized).toBe(true));
  act(() => result.current.progress(5, true));
  await act(async () => { await result.current.sync(); });
  expect(result.current.completed).toBe(5);
  expect(result.current.successCount).toBe(0);
  act(() => {
    result.current.progress(6);
    result.current.progress(6);
    result.current.progress(5);
  });
  await act(async () => { await result.current.sync(); });
  expect(result.current.successCount).toBe(1);
  await act(async () => { await result.current.sync(); });
  expect(result.current.successCount).toBe(1);
  act(() => result.current.progress(7));
  vi.mocked(courseRequest).mockResolvedValue(state(7));
  await act(async () => { await result.current.sync(); });
  expect(result.current.successCount).toBe(1);
});

it("does not celebrate failed server writes or their later recovery", async () => {
  const { result } = renderHook(() => useCourse("alice", "sessionKey"));
  await waitFor(() => expect(result.current.synchronized).toBe(true));
  act(() => result.current.progress(1));
  vi.mocked(courseRequest).mockImplementation(async (_token, completed) => {
    if (completed !== undefined) throw new Error("Write failed");
    return state();
  });
  await act(async () => { await result.current.sync(); });
  expect(result.current.error).toBe("Write failed");
  expect(result.current.successCount).toBe(0);
  vi.mocked(courseRequest).mockImplementation(async (_token, completed) => state(completed ?? 0));
  await act(async () => { await result.current.sync(); });
  expect(result.current.synchronized).toBe(true);
  expect(result.current.successCount).toBe(0);
});

it("counts individually confirmed live steps and never celebrates failed local persistence", async () => {
  vi.mocked(courseRequest).mockImplementation(async (_token, completed) => state(completed ?? 0));
  const { result } = renderHook(() => useCourse("alice", "sessionKey"));
  await waitFor(() => expect(result.current.synchronized).toBe(true));
  act(() => {
    result.current.progress(1);
    result.current.progress(2);
  });
  await act(async () => { await result.current.sync(); });
  expect(result.current.successCount).toBe(2);
  const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  act(() => result.current.progress(3));
  expect(result.current.storageError).toContain("lokalnego postępu");
  await act(async () => { await result.current.sync(); });
  expect(result.current.successCount).toBe(2);
  storage.mockRestore();
  act(() => result.current.progress(4));
  const failAccept = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  await act(async () => { await result.current.sync(); });
  expect(result.current.successCount).toBe(2);
  expect(result.current.storageError).toContain("lokalnie");
  failAccept.mockRestore();
});

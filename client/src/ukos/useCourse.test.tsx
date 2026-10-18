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
  const { result } = renderHook(() => useCourse("alice", "token"));
  await waitFor(() => expect(result.current.synchronized).toBe(true));
  expect(result.current.completed).toBe(8);
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
});
it("retains local progress across network errors and retries on online and visibility", async () => {
  localStorage.setItem("ukos-progress-v1:alice", "5");
  vi.mocked(courseRequest).mockRejectedValue(new Error("Offline"));
  const { result, unmount } = renderHook(() => useCourse("alice", "token"));
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
  const { result } = renderHook(() => useCourse("bob", "token"));
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
  const { result, unmount } = renderHook(() => useCourse("alice", "token"));
  expect(result.current.completed).toBe(0);
  unmount();
  await act(async () => resolve(state(15)));
  expect(localStorage.getItem("ukos-progress-v1:alice")).toBe("NaN");
});

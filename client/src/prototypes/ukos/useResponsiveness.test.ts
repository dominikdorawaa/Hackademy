import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useResponsiveness } from "./useResponsiveness";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("measures main-thread frames and long tasks, resets hidden gaps and releases monitoring", () => {
  vi.useFakeTimers();
  let frame: FrameRequestCallback = () => {};
  let report: (list: { getEntries: () => unknown[] }) => void = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "PerformanceObserver",
    class {
      static supportedEntryTypes = ["longtask"];
      constructor(callback: typeof report) {
        report = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      frame = callback;
      return 1;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const { result, unmount } = renderHook(useResponsiveness);
  act(() => {
    frame(10);
    frame(26);
    frame(42);
    frame(58);
    report({ getEntries: () => [1, 2] });
    vi.advanceTimersByTime(1000);
  });
  expect(result.current).toEqual({ p95: 16, max: 16, longTasks: 2 });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    frame(10000);
    frame(10016);
    vi.advanceTimersByTime(1000);
  });
  expect(result.current.p95).toBe(16);
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
});

it("works when long-task observation is unavailable", () => {
  vi.useFakeTimers();
  vi.stubGlobal("PerformanceObserver", undefined);
  const { result, unmount } = renderHook(useResponsiveness);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(result.current.longTasks).toBe(0);
  unmount();
});

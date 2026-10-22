import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useArenaClock } from './useArenaClock';

afterEach(() => vi.useRealTimers());

it('stops rendering in the hidden tab and after the duel, then resumes with elapsed wall time', () => {
  vi.useFakeTimers();
  let visibility: DocumentVisibilityState = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  const { result, rerender, unmount } = renderHook(({ active }) => useArenaClock(1000, active), { initialProps: { active: true } });
  act(() => { vi.advanceTimersByTime(1000); });
  expect(result.current.now - result.current.receivedAt).toBe(1000);
  act(() => { visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
  const hidden = result.current;
  act(() => { vi.advanceTimersByTime(10_000); });
  expect(result.current).toBe(hidden);
  act(() => { visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
  expect(result.current.now - result.current.receivedAt).toBe(11_000);
  rerender({ active: false });
  const finished = result.current;
  act(() => { vi.advanceTimersByTime(10_000); });
  expect(result.current).toBe(finished);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

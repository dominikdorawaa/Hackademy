import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMinuteClock } from './useMinuteClock';

describe('minute clock', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(Date.parse('2026-10-25T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it('moves forward every minute while active', () => {
    const { result } = renderHook(() => useMinuteClock());
    const start = result.current;
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current - start).toBe(60_000);
  });

  it('stays put while inactive and catches up when it becomes active', () => {
    const { result, rerender } = renderHook(({ active }) => useMinuteClock(active), { initialProps: { active: false } });
    const start = result.current;
    act(() => { vi.advanceTimersByTime(180_000); });
    expect(result.current).toBe(start);
    rerender({ active: true });
    expect(result.current - start).toBe(180_000);
  });
});

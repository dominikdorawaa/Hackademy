import { describe, expect, it, vi } from 'vitest';
import { isStaleChunkError, reloadOnceForStaleChunk } from './staleChunk';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  } as Storage;
}

describe('isStaleChunkError', () => {
  it.each([
    'error loading dynamically imported module: https://hackademy.app/static/UkosPage-Psfvex_M.js',
    'Failed to fetch dynamically imported module: https://hackademy.app/static/ArenaPage-abc.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /static/ArenaPage-abc.css',
  ])('recognises "%s"', message => {
    expect(isStaleChunkError(new TypeError(message))).toBe(true);
  });

  it('ignores ordinary errors', () => {
    expect(isStaleChunkError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
  });
});

describe('reloadOnceForStaleChunk', () => {
  it('reloads the first time', () => {
    const reload = vi.fn();
    expect(reloadOnceForStaleChunk(1_000, memoryStorage, reload)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('does not reload again right after a reload', () => {
    const storage = memoryStorage();
    const getStorage = () => storage;
    const reload = vi.fn();
    reloadOnceForStaleChunk(1_000, getStorage, reload);
    expect(reloadOnceForStaleChunk(5_000, getStorage, reload)).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads again after the guard window', () => {
    const storage = memoryStorage();
    const getStorage = () => storage;
    const reload = vi.fn();
    reloadOnceForStaleChunk(1_000, getStorage, reload);
    expect(reloadOnceForStaleChunk(20_000, getStorage, reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does not reload when storage is unavailable', () => {
    const storage = { getItem: () => { throw new Error('blocked'); } } as unknown as Storage;
    const reload = vi.fn();
    expect(reloadOnceForStaleChunk(1_000, () => storage, reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not throw when reading sessionStorage itself is blocked', () => {
    const reload = vi.fn();
    const spy = vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
    try {
      expect(reloadOnceForStaleChunk(1_000, undefined, reload)).toBe(false);
    } finally {
      spy.mockRestore();
    }
    expect(reload).not.toHaveBeenCalled();
  });
});

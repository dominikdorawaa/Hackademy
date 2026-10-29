const RELOAD_KEY = 'hackademy:stale-chunk-reload';
const RELOAD_GUARD_MS = 10_000;

const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

export function isStaleChunkError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return CHUNK_ERROR.test(message);
}

export function reloadOnceForStaleChunk(now = Date.now(), getStorage = (): Storage => sessionStorage, reload = () => window.location.reload()) {
  try {
    const storage = getStorage();
    const last = Number(storage.getItem(RELOAD_KEY));
    if (last && now - last < RELOAD_GUARD_MS) return false;
    storage.setItem(RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  reload();
  return true;
}

export function enableStaleChunkReload() {
  window.addEventListener('vite:preloadError', () => { reloadOnceForStaleChunk(); });
}

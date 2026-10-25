// After a deploy, tabs still running the old build ask for chunk hashes that no longer exist.
// One reload fetches the new index.html; the timestamp guard stops a reload loop when the failure is real.
const RELOAD_KEY = 'hackademy:stale-chunk-reload';
const RELOAD_GUARD_MS = 10_000;

const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

export function isStaleChunkError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return CHUNK_ERROR.test(message);
}

export function reloadOnceForStaleChunk(now = Date.now(), storage: Storage = sessionStorage, reload = () => window.location.reload()) {
  try {
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
  // The error still propagates, so the route error page shows "new version" until the reload lands.
  window.addEventListener('vite:preloadError', () => { reloadOnceForStaleChunk(); });
}

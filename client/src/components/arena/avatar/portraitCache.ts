interface PortraitEntry {
  promise: Promise<string | null>;
  users: number;
  url: string | null;
}

export function createPortraitCache(load: (key: string) => Promise<string>, maxUnused = 32) {
  const entries = new Map<string, PortraitEntry>();
  const trim = () => {
    let unused = [...entries.values()].filter(entry => entry.users === 0).length;
    for (const [key, entry] of entries) {
      if (unused <= maxUnused) break;
      if (entry.users !== 0) continue;
      entries.delete(key);
      if (entry.url) URL.revokeObjectURL(entry.url);
      unused--;
    }
  };

  return {
    acquire(key: string) {
      let entry = entries.get(key);
      if (!entry) {
        const created: PortraitEntry = { users: 0, url: null, promise: Promise.resolve(null) };
        created.promise = Promise.resolve().then(() => load(key)).then(url => {
          if (entries.get(key) !== created) {
            URL.revokeObjectURL(url);
            return null;
          }
          created.url = url;
          return url;
        }).catch(() => {
          if (entries.get(key) === created) entries.delete(key);
          return null;
        });
        entry = created;
      }
      entries.delete(key);
      entries.set(key, entry);
      entry.users++;
      let released = false;
      return {
        promise: entry.promise,
        release() {
          if (released) return;
          released = true;
          entry.users--;
          trim();
        },
      };
    },
  };
}

export type HeaderRule = {
  pattern: string;
  set: [string, string][];
  unset: string[];
};

export function parsePagesHeaders(source: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  source.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    if (!/^\s/.test(raw)) {
      if (!line.startsWith('/')) throw new Error(`Line ${index + 1}: expected a path pattern`);
      rules.push({ pattern: line, set: [], unset: [] });
      return;
    }
    const rule = rules.at(-1);
    if (!rule) throw new Error(`Line ${index + 1}: header without a path pattern`);
    if (line.startsWith('!')) {
      rule.unset.push(line.slice(1).trim().toLowerCase());
      return;
    }
    const separator = line.indexOf(':');
    if (separator < 1) throw new Error(`Line ${index + 1}: expected "Name: value"`);
    rule.set.push([line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim()]);
  });
  return rules;
}

export function patternMatches(pattern: string, path: string): boolean {
  const source = pattern
    .split(/(\*|:[A-Za-z0-9_]+)/)
    .map((part) => {
      if (part === '*') return '.*';
      if (/^:[A-Za-z0-9_]+$/.test(part)) return '[^/]+';
      return part.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(`^${source}$`).test(path);
}

export function headersForPath(rules: HeaderRule[], path: string): Map<string, string[]> {
  const headers = new Map<string, string[]>();
  for (const rule of rules) {
    if (!patternMatches(rule.pattern, path)) continue;
    for (const name of rule.unset) headers.delete(name);
    for (const [name, value] of rule.set) headers.set(name, [...(headers.get(name) ?? []), value]);
  }
  return headers;
}

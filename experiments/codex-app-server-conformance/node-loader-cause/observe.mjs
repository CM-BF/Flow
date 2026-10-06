// Public enums and fixed dependency roles only; never return remote text or inferred policy causes.
export function observeLoader(bytes, roles, complete) {
  const unknown = { errorClass: 'UNKNOWN', errno: null, errnoState: 'unknown', dependencyRoles: [] };
  if (!complete || !Buffer.isBuffer(bytes) || bytes.length > 8192) return unknown;
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return unknown; }
  if (text.includes('\0')) return unknown;
  const found = new Set(), numbers = new Set(); let library = false;
  for (const line of text.split(/\r?\n/)) {
    const match = /^(?:dyld\[(\d{1,10})\]: )?Library not loaded: ([^\r\n]+)$/.exec(line);
    if (match && (!match[1] || (Number(match[1]) >= 1 && Number(match[1]) <= 2147483647))) {
      library = true;
      const row = roles.find(row => row.token === match[2]);
      if (row && /^[a-z0-9-]{1,48}$/.test(row.role) && found.size < 4) found.add(row.role);
    }
    for (const match of line.matchAll(/\berrno(?:=|: )(\d{1,3})\b/g)) {
      const value = Number(match[1]); if (value >= 1 && value <= 255) numbers.add(value);
    }
  }
  return { errorClass: library ? 'library-not-loaded' : 'UNKNOWN',
    errno: numbers.size === 1 ? [...numbers][0] : null,
    errnoState: numbers.size === 1 ? 'observed-text' : numbers.size > 1 ? 'conflict' : 'unknown',
    dependencyRoles: [...found].sort() };
}

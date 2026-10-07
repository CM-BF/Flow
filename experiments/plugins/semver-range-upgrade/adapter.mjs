import satisfies from 'semver/functions/satisfies.js';
export const hostApiMajor = 1;
/** The two releases share this wrapper; only the verified npm dependency changes. */
export function invoke({ input, signal }) {
  if (signal.aborted) throw signal.reason;
  if (typeof input !== 'string' || Buffer.byteLength(input, 'utf8') > 4096) throw new Error('Invalid range input');
  const value = JSON.parse(input);
  if (!value || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'includePrerelease,range,version'
    || typeof value.version !== 'string' || Buffer.byteLength(value.version, 'utf8') > 256
    || typeof value.range !== 'string' || Buffer.byteLength(value.range, 'utf8') > 256
    || typeof value.includePrerelease !== 'boolean') throw new Error('Invalid range input');
  return String(satisfies(value.version, value.range, { includePrerelease: value.includePrerelease }));
}

/** Local attempt limit only; center registration capacity remains independently configured. */
export function parseRunnerConcurrency(raw: string | undefined, mode: 'native' | 'a2a'): number {
  const limit = raw === undefined ? 1 : Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 16 || (raw !== undefined && String(limit) !== raw)) {
    throw new Error('FLOW_RUNNER_MAX_CONCURRENT_ATTEMPTS must be a canonical decimal integer from 1 to 16.');
  }
  if (mode === 'a2a' && limit !== 1) throw new Error('A2A runner supports a local attempt limit of 1 only.');
  return limit;
}

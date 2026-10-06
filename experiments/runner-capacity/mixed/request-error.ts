/** Only fixed categories leave the owned child; error objects are neither copied nor changed. */
export function requestErrorClass(error: unknown): string {
  if (!(error instanceof Error)) return 'non-error';
  if (error.name === 'AbortError') return 'abort';
  if (error.name === 'TimeoutError') return 'timeout';
  if (error instanceof SyntaxError) return 'decode';
  const cause = 'cause' in error ? error.cause : undefined;
  const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;
  if (typeof code === 'string' && ['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)) return code;
  if (error instanceof TypeError) return 'transport-or-type';
  return 'other';
}

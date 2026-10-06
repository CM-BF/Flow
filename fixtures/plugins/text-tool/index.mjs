export const hostApiMajor = 1;
export function invoke({ input, config, signal }) {
  signal.throwIfAborted();
  return `${config.prefix ?? ''}${input}`;
}

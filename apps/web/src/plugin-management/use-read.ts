import { useEffect, useState } from 'react';

export function useRead<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ data?: T; failed: boolean; pending: boolean; load?: typeof load; attempt?: number }>({ failed: false, pending: true });
  useEffect(() => {
    const controller = new AbortController();
    setState(previous => ({ ...previous, load, attempt, failed: false, pending: true }));
    void Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return load(controller.signal);
    }).then(
      data => { if (!controller.signal.aborted) setState({ data, load, attempt, failed: false, pending: false }); },
      () => { if (!controller.signal.aborted) setState(previous => ({ ...previous, failed: true, pending: false })); },
    );
    return () => controller.abort();
  }, [load, attempt]);
  return { ...state, pending: state.pending || state.load !== load || state.attempt !== attempt, retry: () => setAttempt(value => value + 1) };
}

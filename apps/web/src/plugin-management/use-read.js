import { useEffect, useState } from 'react';
export function useRead(load) {
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState({ failed: false });
    useEffect(() => {
        const controller = new AbortController();
        setState({ failed: false });
        void load(controller.signal).then(data => { if (!controller.signal.aborted)
            setState({ data, failed: false }); }, () => { if (!controller.signal.aborted)
            setState({ failed: true }); });
        return () => controller.abort();
    }, [load, attempt]);
    return { ...state, retry: () => setAttempt(value => value + 1) };
}

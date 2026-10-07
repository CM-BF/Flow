import { CONTRACT } from './contract.js';
export function childReporter(stop, limits = () => CONTRACT, messageLimit = () => limits().responseBytes) {
    let pending = 0;
    let total = 0;
    let dropped = 0;
    let closed = false;
    const send = (value) => {
        const contract = limits();
        const record = { ...value, childMs: performance.now(), pid: process.pid };
        const bytes = Buffer.byteLength(JSON.stringify(record));
        total += bytes;
        if (closed || bytes > Math.min(contract.responseBytes, messageLimit()) || pending + bytes > contract.ipcPendingBytes || total > contract.softBytes) {
            dropped++;
            stop();
            return false;
        }
        pending += bytes;
        try {
            if (!process.send)
                throw new Error('ipc_disconnected');
            process.send(record, error => { pending -= bytes; if (error) {
                dropped++;
                stop();
            } });
            return dropped === 0;
        }
        catch {
            pending -= bytes;
            dropped++;
            stop();
            return false;
        }
    };
    return { send, get dropped() { return dropped; }, get pending() { return pending; }, get total() { return total; }, close() { closed = true; } };
}
export async function abortable(promise, signal) {
    signal.throwIfAborted();
    let abort;
    const interrupted = new Promise((_, reject) => { abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true }); });
    try {
        return await Promise.race([promise, interrupted]);
    }
    finally {
        signal.removeEventListener('abort', abort);
    }
}
export function memoryObservation() {
    const memory = process.memoryUsage();
    return { kind: 'memory', rss: memory.rss, heapUsed: memory.heapUsed, external: memory.external,
        arrayBuffers: memory.arrayBuffers, maxRssKiB: process.resourceUsage().maxRSS };
}

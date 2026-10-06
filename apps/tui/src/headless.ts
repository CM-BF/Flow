import type { Readable, Writable } from 'node:stream';
import type { InteractionController } from '@flow/interaction';

/** Sequential JSONL commands use the exact same controller as Ink, including unresolved ACK semantics. */
export async function runHeadless(controller: InteractionController, input: Readable, output: Writable): Promise<void> {
  const write = (value: unknown) => new Promise<void>((resolve, reject) => {
    const text = JSON.stringify(value).replace(/[\u202a-\u202e\u2066-\u2069]/g, c => `\\u${c.charCodeAt(0).toString(16)}`);
    output.write(`${text}\n`, error => error ? reject(error) : resolve());
  });
  let buffer = Buffer.alloc(0);
  try {
    for await (const chunk of input) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (buffer.length + bytes.length > 192 * 1024) throw new Error('Headless input frame too large');
      buffer = Buffer.concat([buffer, bytes]);
      for (;;) {
        const newline = buffer.indexOf(10); if (newline < 0) break;
        const line = buffer.subarray(0, newline); buffer = buffer.subarray(newline + 1);
        let command: unknown;
        try { command = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(line)); }
        catch { await write({ result: { ok: false, code: 'INVALID_JSON', message: 'Expected one typed JSON command per line.' } }); continue; }
        const result = await controller.execute(command as never);
        await write({ result, snapshot: controller.snapshot() });
        if (controller.snapshot().closed) return;
      }
    }
    if (buffer.length) throw new Error('Headless input ended mid-frame');
  } finally { await controller.dispose(); }
}

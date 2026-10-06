import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';

for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  if (request.type === 'unicode') {
    const bytes = Buffer.from(`${JSON.stringify({ type: 'response', id: request.id, success: true, data: { text: '中文🙂' } })}\n`);
    const first = bytes.indexOf(Buffer.from('中')) + 1;
    const second = bytes.indexOf(Buffer.from('🙂')) + 2;
    process.stdout.write(bytes.subarray(0, first)); await delay(25);
    process.stdout.write(bytes.subarray(first, second)); await delay(25);
    process.stdout.write(bytes.subarray(second));
  }
  if (request.type === 'exit') {
    await new Promise(resolve => process.stderr.write(`discarded-prefix:${'x'.repeat(12_000)}SYNTHETIC_SECRET_MARKER`, resolve));
    await delay(20);
    process.exit(7);
  }
  // 'hold' deliberately remains pending until the synthetic process exits.
}

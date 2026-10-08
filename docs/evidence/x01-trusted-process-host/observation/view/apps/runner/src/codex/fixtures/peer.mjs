// Synthetic protocol peer. Never starts Codex, reads credentials, or calls a provider.
import readline from 'node:readline';
const mode = process.argv[2] ?? 'normal';
const send = value => process.stdout.write(`${JSON.stringify(value)}\n`);
let initialized = false;
const input = readline.createInterface({ input: process.stdin });
const reordered = [];
if (mode === 'ignore-term') { process.on('SIGTERM', () => {}); setInterval(() => {}, 1000); }
input.on('line', line => {
  const message = JSON.parse(line);
  if (message.method === 'initialize') {
    if (mode === 'init-stall') return;
    if (mode === 'bad-init') { send({ id: message.id, result: { userAgent: 'wrong' } }); return; }
    send({ id: message.id, result: { userAgent: 'synthetic/1', codexHome: '/synthetic-private', platformFamily: 'unix', platformOs: 'test' } });
  } else if (message.method === 'initialized') {
    initialized = true;
    send({ method: 'synthetic/ready', params: { initialized } });
    if (mode === 'pause') { input.pause(); process.stdin.pause(); setInterval(() => {}, 1000); }
  } else if (!message.method) send({ method: 'synthetic/replied', params: message });
  else if (message.method === 'stall') send({ method: 'synthetic/received', params: { id: message.id } });
  else if (message.method === 'delayed') setTimeout(() => send({ id: message.id, result: 'late' }), 80);
  else if (message.method === 'reorder') {
    reordered.push(message);
    if (reordered.length === 3) for (const item of reordered.reverse()) send({ id: item.id, result: item.params });
  } else if (message.method === 'unicode') {
    const frame = Buffer.from(`${JSON.stringify({ id: message.id, result: '中文🙂🌍' })}\n`);
    let at = 0;
    const timer = setInterval(() => { process.stdout.write(frame.subarray(at, ++at)); if (at === frame.length) clearInterval(timer); }, 1);
  } else if (message.method === 'duplicate') {
    send({ id: message.id, result: 'first' }); send({ id: message.id, result: 'second' });
  } else if (message.method === 'remote-error') send({ id: message.id, error: { code: -32001, message: 'SECRET_MARKER', data: { secret: 'SECRET_MARKER' } } });
  else if (message.method === 'server-request') {
    send({ id: 'approval-1', method: 'item/approval', params: { value: 1 } });
    send({ id: 1, method: 'item/approval', params: { value: 2 } });
    send({ id: message.id, result: true });
  } else if (message.method === 'duplicate-server') {
    send({ id: 'a', method: 'approval', params: null }); send({ id: 'a', method: 'approval', params: null });
  } else if (message.method === 'future-id') send({ id: message.id + 1000, result: 'bad' });
  else if (message.method === 'wrong-id-type') send({ id: String(message.id), result: 'bad' });
  else if (message.method === 'invalid-json') process.stdout.write('{broken}\n');
  else if (message.method === 'invalid-utf8') process.stdout.write(Buffer.from([0x22, 0xff, 0x22, 0x0a]));
  else if (message.method === 'truncated') process.stdout.end('{"id":');
  else if (message.method === 'long-line') process.stdout.write('x'.repeat(message.params.bytes));
  else if (message.method === 'flood') {
    for (let i = 0; i < message.params.count; i++) send({ method: 'item/delta', params: { i, text: '文'.repeat(message.params.size) } });
  } else if (message.method === 'stderr') {
    process.stderr.write('SECRET_MARKER'.repeat(20_000), () => send({ id: message.id, result: true }));
  } else if (message.method === 'exit') process.exit(7);
  else if (message.method === 'environment') send({ id: message.id, result: { keys: Object.keys(process.env).sort(), lang: process.env.LANG } });
  else send({ id: message.id, result: { initialized, value: message.params } });
});

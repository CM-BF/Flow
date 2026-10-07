import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, fstatSync, mkdtempSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { prepareDarwinWriterHost } from './native-authority.js';

const root = process.env.FLOW_ENG01J_SCRATCH;
const binary = process.env.FLOW_ENG01J_CANARY;
const inherited = Number(process.env.FLOW_ENG01J_INHERITED_FD);
assert.ok(root && binary && Number.isSafeInteger(inherited));
function fixture() {
  const directory = mkdtempSync(join(root!, 'writer-'));
  const executable = join(directory, 'canary'); copyFileSync(binary!, executable);
  writeFileSync(join(directory, 'calculator.mjs'), '0'); writeFileSync(join(directory, 'baseline.txt'), '0');
  return { directory, executable, executableSha256: createHash('sha256').update(readFileSync(executable)).digest('hex'), arguments: ['app-server', String(inherited)] };
}

test('real R06 factory closes the inherited regular FD and holds the sandboxed writer handle', async () => {
  assert.ok(fstatSync(inherited).isFile());
  assert.equal(writeSync(inherited, 'P'), 1); // This FD really is writable in the Node host, before R06 spawn.
  const input = fixture(), host = await prepareDarwinWriterHost(input);
  const controller = new AbortController();
  const transport = host.createTransport({ signal: controller.signal, workingDirectory: input.directory });
  try {
    await transport.ready;
    const pid = transport.snapshot().pid;
    assert.ok(pid);
    assert.deepEqual(await transport.receive(), { kind: 'notification', method: 'canary/result', params: {
      pid, inheritedWrite: -1, inheritedErrno: 9, allowedWrite: 1, deniedOpen: -1, deniedErrno: 1,
    } });
    assert.equal(readFileSync(join(input.directory, 'calculator.mjs'), 'utf8'), 'X');
    assert.equal(readFileSync(join(input.directory, 'baseline.txt'), 'utf8'), '0');
    assert.throws(() => host.createTransport({ signal: controller.signal, workingDirectory: input.directory }));
  } finally {
    const stopped = await host.close();
    assert.equal(stopped.child, 'confirmed-exited');
    assert.equal(stopped.writeAccess, 'unknown'); // No model/all-delegation qualification was granted.
    assert.deepEqual(await host.close(), stopped);
  }
});

test('changed target identity rejects before transport; wrong executable digest is rejected', async () => {
  const input = fixture();
  await assert.rejects(prepareDarwinWriterHost({ ...input, executableSha256: '0'.repeat(64) }));
  const host = await prepareDarwinWriterHost(input);
  writeFileSync(join(input.directory, 'calculator.mjs'), 'changed');
  assert.throws(() => host.createTransport({ signal: new AbortController().signal, workingDirectory: input.directory }));
  assert.equal((await host.close()).writeAccess, 'unknown');
});

test('closing an unused host permanently prevents launch', async () => {
  const input = fixture(), host = await prepareDarwinWriterHost(input);
  assert.equal((await host.close()).child, 'not-started');
  assert.throws(() => host.createTransport({ signal: new AbortController().signal, workingDirectory: input.directory }));
});

// Fixed report validator and compiler inventory. Neither executes a process.
import assert from 'node:assert/strict';
const exact = (value, names) => assert.deepEqual(Object.keys(value).sort(), [...names].sort());
export function decodeReport(bytes, nonce, pid) {
  assert.ok(bytes.length <= 4096 && bytes.at(-1) === 10);
  const lines = bytes.toString('utf8').trimEnd().split('\n'); assert.equal(lines.length, 5);
  const records = lines.map(line => JSON.parse(line));
  assert.deepEqual(records[0], { record: 'start', protocol: 'flow.fd-canary.v1', nonce, pid });
  assert.deepEqual(records[4], { record: 'complete', count: 3 });
  for (let fd = 0; fd < 3; fd++) {
    const row = records[fd + 1]; exact(row, ['record', 'fd', 'fstat', 'fcntl']);
    assert.equal(row.record, 'fd'); assert.equal(row.fd, fd);
    for (const name of ['fstat', 'fcntl']) {
      const call = row[name]; exact(call, ['ok', 'result', 'errno', 'errnoNumber', ...(name === 'fstat' ? ['kind'] : ['access', 'nonblocking'])]);
      assert.equal(typeof call.ok, 'boolean'); assert.ok(Number.isSafeInteger(call.result) && call.result >= -1 && call.result <= 2147483647);
      if (call.ok) {
        assert.ok(name === 'fstat' ? call.result === 0 : call.result >= 0);
        assert.equal(call.errno, null); assert.equal(call.errnoNumber, 0);
      } else {
        assert.equal(call.result, -1); assert.ok(['EPERM', 'EACCES', 'EBADF', 'EINTR', 'OTHER'].includes(call.errno));
        assert.ok(Number.isSafeInteger(call.errnoNumber) && call.errnoNumber > 0 && call.errnoNumber <= 2147483647);
      }
      if (name === 'fstat') assert.ok(call.ok ? ['socket', 'fifo', 'regular', 'character', 'other'].includes(call.kind) : call.kind === 'unknown');
      else if (call.ok) { assert.ok(['read-only', 'write-only', 'read-write', 'unknown'].includes(call.access)); assert.equal(typeof call.nonblocking, 'boolean'); }
      else { assert.equal(call.access, 'unknown'); assert.equal(call.nonblocking, null); }
    }
  }
  return records;
}

export function compilerInventory(bytes, directory, artifacts, clang, linker) {
  assert.ok(bytes.length <= 65536);
  const commands = [];
  for (const line of bytes.toString('utf8').split('\n')) {
    if (!/^\s+"\//.test(line)) continue;
    const words = [...line.matchAll(/"([^"\n]*)"/g)].map(match => match[1]);
    assert.ok(words.length > 1 && [clang, linker].includes(words[0]));
    const role = words[0] === linker ? 'linker' : words.includes('-cc1as') ? 'assembler' : words.includes('-cc1') ? 'frontend' : null;
    assert.ok(role);
    const outputIndex = words.indexOf('-o'); assert.ok(outputIndex >= 0 && outputIndex + 1 < words.length);
    const output = words[outputIndex + 1];
    assert.ok(output.startsWith(`${directory}/`) && artifacts.some(item => item.path === output));
    commands.push({ executable: words[0], role, output: output.slice(directory.length + 1), pid: null, evidence: 'compiler-verbose-command' });
  }
  assert.ok(commands.length >= 2 && commands.length <= 8 && commands.some(item => item.role === 'frontend') && commands.some(item => item.role === 'linker'));
  return commands;
}

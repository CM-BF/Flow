// Fixed report validator and compiler inventory. Neither executes a process.
import assert from 'node:assert/strict';
const exact = (value, names) => assert.deepEqual(Object.keys(value).sort(), [...names].sort());
export function decodeReport(bytes, nonce, pid) {
  assert.match(nonce, /^[0-9a-f]{32}$/);
  assert.ok(Number.isSafeInteger(pid) && pid >= 1 && pid <= 2147483647);
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

const compilerCodes = new Set(['compiler-output-limit', 'compiler-include-search-syntax', 'compiler-command-syntax',
  'compiler-executable', 'compiler-role', 'compiler-output-option', 'compiler-output-location', 'compiler-output-missing',
  'compiler-include-search-unclosed', 'compiler-command-count']);
class CompilerInventoryError extends Error {
  constructor(code) { super('Compiler inventory unavailable'); this.code = code; }
}
const requireCompiler = (condition, code) => { if (!condition) throw new CompilerInventoryError(code); };
export const compilerFailureCode = error => error instanceof CompilerInventoryError && compilerCodes.has(error.code) ? error.code : 'unclassified';

function compilerWords(line) {
  requireCompiler(Buffer.byteLength(line) <= 16384 && /^"\//.test(line), 'compiler-command-syntax');
  const words = []; let index = 0;
  while (index < line.length) {
    while (line[index] === ' ' || line[index] === '\t') index++;
    if (index === line.length) break;
    let word = '';
    if (line[index] === '"') {
      index++; let ended = false;
      while (index < line.length) {
        const char = line[index++];
        if (char === '"') { ended = true; break; }
        if (char === '\\') {
          const escaped = line[index++];
          requireCompiler(['"', '\\', '$'].includes(escaped), 'compiler-command-syntax'); word += escaped;
        } else { requireCompiler(char.charCodeAt(0) >= 32 && char !== '\u007f', 'compiler-command-syntax'); word += char; }
      }
      requireCompiler(ended && (index === line.length || /[ \t]/.test(line[index])), 'compiler-command-syntax');
    } else {
      while (index < line.length && !/[ \t]/.test(line[index])) {
        const char = line[index++];
        requireCompiler(char.charCodeAt(0) >= 32 && !['"', '\\', '$', '\u007f'].includes(char), 'compiler-command-syntax'); word += char;
      }
    }
    requireCompiler(words.length < 2048 && Buffer.byteLength(word) <= 4096, 'compiler-command-syntax'); words.push(word);
  }
  return words;
}

export function compilerInventory(bytes, directory, artifacts, clang, linker) {
  requireCompiler(bytes.length <= 65536, 'compiler-output-limit');
  const commands = []; let includeSearch = false;
  for (const line of bytes.toString('utf8').split('\n')) {
    const trimmed = line.trim();
    if (/^#include .* search starts here:$/.test(trimmed)) { includeSearch = true; continue; }
    if (trimmed === 'End of search list.') { includeSearch = false; continue; }
    if (includeSearch) { requireCompiler(/^\/[^\n]+(?: \(framework directory\))?$/.test(trimmed), 'compiler-include-search-syntax'); continue; }
    if (/^clang -cc1 version [0-9][^\n]* default target [A-Za-z0-9_.-]+$/.test(trimmed)) continue;
    const commandLike = /^["/]/.test(trimmed) || /(?:^|\s)-(?:cc1|cc1as|o)(?:\s|$)/.test(trimmed);
    if (!commandLike) continue;
    // LLVM printArg quotes the executable; arguments may be bare or quote/escape only ", backslash and $.
    // This decodes data only and never evaluates shell syntax.
    const words = compilerWords(trimmed);
    requireCompiler(words.length > 1 && [clang, linker].includes(words[0]), 'compiler-executable');
    const role = words[0] === linker ? 'linker' : words.includes('-cc1as') ? 'assembler' : words.includes('-cc1') ? 'frontend' : null;
    requireCompiler(role, 'compiler-role');
    const outputIndex = words.indexOf('-o'); requireCompiler(outputIndex >= 0 && outputIndex + 1 < words.length && words.filter(word => word === '-o').length === 1, 'compiler-output-option');
    const output = words[outputIndex + 1];
    requireCompiler(output.startsWith(`${directory}/`), 'compiler-output-location');
    requireCompiler(artifacts.some(item => item.path === output), 'compiler-output-missing');
    commands.push({ executable: words[0], role, output: output.slice(directory.length + 1), pid: null, evidence: 'compiler-verbose-command' });
  }
  requireCompiler(!includeSearch, 'compiler-include-search-unclosed');
  requireCompiler(commands.length >= 2 && commands.length <= 8 && commands.some(item => item.role === 'frontend') && commands.some(item => item.role === 'linker'), 'compiler-command-count');
  return commands;
}

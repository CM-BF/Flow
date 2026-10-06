// Read-only compiler overlay: this one patched test against the fixed integration checkout.
import ts from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/node_modules/typescript/lib/typescript.js';
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const evidence = fileURLToPath(new URL('.', import.meta.url));
const target = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/apps/tui/src/journey.test.ts';
const replacement = fileURLToPath(new URL('../../../../apps/tui/src/journey.test.ts', import.meta.url));
const configPath = evidence + 'tsconfig.json';
const read = ts.readConfigFile(configPath, ts.sys.readFile);
if (read.error) throw Error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, evidence);
const host = ts.createCompilerHost(parsed.options);
const original = host.getSourceFile.bind(host);
host.getSourceFile = (path, version, onError, fresh) => path === target
  ? ts.createSourceFile(path, readFileSync(replacement, 'utf8'), version, true)
  : original(path, version, onError, fresh);
const program = ts.createProgram(parsed.fileNames, parsed.options, host);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
const inputs = program.getSourceFiles().map(file => {
  const path = file.fileName === target ? replacement : file.fileName;
  const bytes = readFileSync(path);
  return { path, compilerPath: file.fileName, realpath: realpathSync(path), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
writeFileSync(evidence + 'compiler-inputs.json', JSON.stringify({ overlay: { target, replacement }, inputs }, null, 2) + '\n', { flag: 'wx' });
if (diagnostics.length) process.stdout.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCurrentDirectory: () => evidence, getCanonicalFileName: path => path, getNewLine: () => '\n',
}));
process.exitCode = diagnostics.length ? 2 : 0;

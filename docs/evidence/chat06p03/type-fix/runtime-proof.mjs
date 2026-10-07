// Source-only erasure comparison. Never imports or executes either baseline module.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from '/Users/citrine/Projects/AgentHarness/Flow/node_modules/typescript/lib/typescript.js';
const directory = path.dirname(fileURLToPath(import.meta.url));
const baseline = path.join(directory, '../baseline');
const sha = value => createHash('sha256').update(value).digest('hex');
if (ts.version !== '5.9.3') throw Error('Fixed TypeScript version changed');
const compilerOptions = { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, sourceMap: false, removeComments: false, newLine: ts.NewLineKind.LineFeed };
const result = { method: 'TypeScript.transpileModule only; emitted text compared, never loaded', typescript: ts.version, files: [] };
for (const name of ['accumulator', 'index']) {
  const original = fs.readFileSync(path.join(baseline, `${name}.ts.txt`), 'utf8');
  const adapted = fs.readFileSync(path.join(baseline, `${name}.ts`), 'utf8');
  const emit = text => ts.transpileModule(text, { compilerOptions, fileName: `${name}.ts`, reportDiagnostics: true });
  const before = emit(original), after = emit(adapted);
  if (before.diagnostics?.length || after.diagnostics?.length || before.outputText !== after.outputText) throw Error('Runtime erasure differs');
  result.files.push({ name, originalSha256: sha(original), adaptedSha256: sha(adapted), erasedBytes: Buffer.byteLength(before.outputText), erasedSha256: sha(before.outputText), runtimeEqual: true });
}
fs.writeFileSync(path.join(directory, 'runtime-proof.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify(result)}\n`);

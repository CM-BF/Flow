// Exactly one reviewed synthetic composition. Node --check does not execute this main.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function durableCreate(file, value) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}

async function main() {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(directory, '../../..');
  const evidence = path.join(root, 'docs/evidence/wpf-mature-02/isolation');
  const inputPath = path.join(evidence, 'canary-run-input.json');
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  assert.equal(input.permission.callsAllowed, 1);
  for (const [file, expected] of Object.entries({ ...input.r06Files, ...input.transformFiles })) {
    assert.equal(sha256(fs.readFileSync(file)), expected, 'Fixed dependency changed');
  }
  for (const [file, expected] of Object.entries(input.reviewedFiles)) {
    assert.equal(sha256(fs.readFileSync(path.join(root, file))), expected, 'Reviewed source changed');
  }
  const { createCodexTransport } = await import('/Users/citrine/Projects/AgentHarness/Flow/apps/runner/src/codex/index.ts');
  const { runSyntheticCanary } = await import('./compose-canary.mjs');
  const start = new Date().toISOString();
  const reservation = {
    at: start, consumedCalls: 1, inputSha256: sha256(fs.readFileSync(inputPath)),
    driverSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
    meaning: 'One function call consumed before resource creation; no automatic retry even after unknown/failure',
  };
  durableCreate(path.join(evidence, 'canary-once-reservation.json'), reservation);
  let factoryCalls = 0;
  let childEvidence = { state: 'no-child-created' };
  const fixedFactory = options => {
    assert.equal(++factoryCalls, 1, 'More than one owned child requested');
    assert.equal(options.spawn.executable, '/usr/bin/sandbox-exec');
    const control = path.join(path.dirname(options.spawn.cwd), 'control');
    const copied = {};
    for (const name of ['config.json', 'default-deny.sb', 'canary-preload.mjs', 'peer.mjs']) {
      copied[name] = sha256(fs.readFileSync(path.join(control, name)));
    }
    const config = JSON.parse(fs.readFileSync(path.join(control, 'config.json'), 'utf8'));
    durableCreate(path.join(evidence, 'canary-actual-input.json'), {
      at: new Date().toISOString(), options, config, copiedHashes: copied,
      inputSha256: reservation.inputSha256, driverSha256: reservation.driverSha256,
    });
    const transport = createCodexTransport(options);
    childEvidence = { state: 'awaiting-confirmed-close' };
    return {
      ...transport,
      close: async () => {
        const close = await transport.close(); // R06 remains the only supervisor.
        if (close.child === 'confirmed-exited') {
          const reportPath = path.join(options.spawn.cwd, 'canary-result.json');
          try {
            const stat = fs.lstatSync(reportPath);
            assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 4096);
            childEvidence = { state: 'child-report-before-cleanup', report: JSON.parse(fs.readFileSync(reportPath, 'utf8')) };
          } catch { childEvidence = { state: 'no-valid-child-report', meaning: 'bootstrap/pre-report failure or unavailable evidence; never inferred success' }; }
        }
        return close;
      },
    };
  };
  let result;
  try {
    result = await runSyntheticCanary(fixedFactory, {
      r06Target: input.r06Target,
      peerBytes: fs.readFileSync('/Users/citrine/Projects/AgentHarness/Flow/apps/runner/src/codex/fixtures/peer.mjs'),
    });
  } catch {
    result = { passed: false, reason: 'composition-rejected', cleanup: 'unknown; inspect owned receipt, never retry' };
  }
  const record = { startedAt: start, endedAt: new Date().toISOString(), functionCalls: 1, factoryCalls, childEvidence, result,
    realAppServerStarts: 0, providerCalls: 0, authCalls: 0, sourceReservation: reservation };
  durableCreate(path.join(evidence, 'canary-result.json'), record);
  process.stdout.write(`${JSON.stringify(record)}\n`);
  if (!result.passed) process.exitCode = 1;
}

await main();

// One-time migration of already authorized owners. No progress state is copied.
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { coordinationPool, initializeLedger, applyCommand } from '../src/coordination/ledger.mjs';
const inputs = JSON.parse(await readFile('docs/evidence/d04/migration-inputs.json', 'utf8'));
const repository = process.env.FLOW_COORDINATION_REPO;
const pool = coordinationPool();
const receipts = [];
try {
  await initializeLedger(pool);
  for (const input of inputs) {
    const worktree = path.join('/Users/citrine/Projects/AgentHarness/Flow-worktrees', input.directory);
    const branch = execFileSync('git', ['-C', worktree, 'branch', '--show-current'], { encoding: 'utf8' }).trim();
    const head = execFileSync('git', ['-C', worktree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const dirty = Boolean(execFileSync('git', ['-C', worktree, 'status', '--porcelain'], { encoding: 'utf8' }).trim());
    const command = { action: 'take', requestId: `d04-migration-20261006-${input.taskId}`, taskId: input.taskId, actor: input.actor, scope: input.scope, role: input.role ?? 'writer', worktree, branch, origin: 'migration', observedAt: input.observedAt ?? '2026-10-06T02:48:42Z' };
    receipts.push({ observedHead: head, observedDirty: dirty, receipt: await applyCommand(pool, command, repository) });
  }
  await writeFile('docs/evidence/d04/migration-receipts.json', `${JSON.stringify(receipts, null, 2)}\n`);
  console.log(JSON.stringify({ migrated: receipts.length, tasks: receipts.map(value => value.receipt.claim.taskId) }));
} finally { await pool.end(); }

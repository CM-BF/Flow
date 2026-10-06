import { execFile } from 'node:child_process';

function runGit(directory, args) {
  return new Promise((resolve, reject) => {
    let result, closed = false;
    const finish = () => {
      if (!closed || !result) return;
      if (result.error) reject(result.error); else resolve(result.stdout);
    };
    const child = execFile('git', ['-C', directory, ...args], {
      timeout: 5000, maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    }, (error, stdout) => { result = { error, stdout }; finish(); });
    // execFile can report spawn errors before close; the permit covers actual child lifetime.
    child.once('close', () => { closed = true; finish(); });
  });
}

/** One aggregation owns one context. Injected run must settle only when its job has ended. */
export function createGitSnapshot({ concurrency = 4, run = runGit } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new RangeError('concurrency must be a positive integer');
  let active = 0;
  const waiting = [], changes = new Map();
  const acquire = () => {
    if (active < concurrency) { active++; return Promise.resolve(); }
    return new Promise(resolve => waiting.push(resolve));
  };
  const release = () => {
    if (waiting.length) waiting.shift()(); else active--;
  };
  async function execute(directory, args) {
    // Preserve the queued command even if its caller subsequently mutates an args array.
    const command = [...args];
    await acquire();
    try { return await run(directory, command); }
    finally { release(); }
  }
  async function readChanges(directory, capturedHead) {
    const [dirty, untracked] = await Promise.all([
      execute(directory, ['diff', '--name-only', '-z', '--no-renames', capturedHead, '--']),
      execute(directory, ['ls-files', '--others', '--exclude-standard', '-z']),
    ]);
    const actualHead = (await execute(directory, ['rev-parse', 'HEAD'])).trim();
    if (actualHead !== capturedHead) throw new Error('HEAD changed during main observation; current proof is unknown');
    return Object.freeze({ dirty, untracked });
  }
  function mainChanges(directory, capturedHead) {
    const key = JSON.stringify([directory, capturedHead]);
    if (!changes.has(key)) changes.set(key, readChanges(directory, capturedHead));
    return changes.get(key);
  }
  return Object.freeze({ execute, mainChanges });
}

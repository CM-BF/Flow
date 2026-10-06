import { spawn } from 'node:child_process';
import { access, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const [mode, ready] = process.argv.slice(2);
if (mode === 'grandchild') {
  process.on('SIGTERM', () => {});
  setInterval(() => {}, 1000);
  await writeFile(ready, JSON.stringify({ grandchildPid: process.pid }));
} else {
  const child = spawn(process.execPath, [process.argv[1], mode === 'leader' ? 'middle' : 'grandchild', ready], { stdio: 'ignore' });
  child.on('error', () => process.exit(1));
  if (mode === 'leader') child.on('exit', code => process.exit(code ?? 1));
  else {
    for (let tries = 0; tries < 100; tries++) {
      try { await access(ready); process.exit(0); } catch { await delay(20); }
    }
    process.exit(1);
  }
}

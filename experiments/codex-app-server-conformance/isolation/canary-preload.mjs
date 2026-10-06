// Proposal only: copied into ALLOW_ROOT/control and used with Node --import.
// It performs no process spawning, RPC framing, auth or provider operation.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const policyDenial = error => ['EACCES', 'EPERM'].includes(error?.code);
function denied(action) {
  try { action(); return false; } catch (error) { return policyDenial(error); }
}

async function networkDenied(port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };
    // A timeout/refusal is unknown, not evidence of sandbox denial.
    const timer = setTimeout(() => finish(false), 500);
    socket.once('connect', () => finish(false));
    socket.once('error', error => finish(policyDenial(error)));
  });
}

async function check() {
  const control = path.dirname(fileURLToPath(import.meta.url));
  const allowedRoot = path.dirname(control);
  if (!/^\/private\/tmp\/flow-wpf02-allow-[A-Za-z0-9]{6}$/.test(allowedRoot)) throw Error('Unexpected layout');
  const configPath = path.join(control, 'config.json');
  const stat = fs.lstatSync(configPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw Error('Invalid config');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.allowedRoot !== allowedRoot || !/^\/private\/tmp\/flow-wpf02-deny-[A-Za-z0-9]{6}$/.test(config.deniedRoot)
    || !/^[a-f0-9]{32}$/.test(config.runId) || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw Error('Invalid inputs');
  const state = path.join(allowedRoot, 'state');
  if (process.env.HOME !== path.join(state, 'home') || process.env.CODEX_HOME !== path.join(state, 'codex')
    || process.execPath !== config.node || process.argv[1] !== path.join(control, 'peer.mjs')) throw Error('Unexpected execution');
  if (Object.keys(process.env).some(key => /^(NODE_|DYLD_|LD_|OPENAI_|ANTHROPIC_)/.test(key))) throw Error('Unexpected environment');
  const ownFile = path.join(state, 'allowed-marker.txt');
  fs.writeFileSync(ownFile, 'owned-synthetic-marker', { flag: 'wx', mode: 0o600 });
  const checks = {
    allowedReadWrite: fs.readFileSync(ownFile, 'utf8') === 'owned-synthetic-marker',
    outsideReadDenied: denied(() => fs.readFileSync(path.join(config.deniedRoot, 'denied-marker.txt'))),
    outsideWriteDenied: denied(() => fs.writeFileSync(path.join(config.deniedRoot, 'blocked-write.txt'), 'synthetic', { flag: 'wx' })),
    controlWriteDenied: denied(() => fs.writeFileSync(path.join(control, 'blocked-write.txt'), 'synthetic', { flag: 'wx' })),
    symlinkReadDenied: denied(() => fs.readFileSync(path.join(state, 'escape-link'))),
    hardlinkCreationDenied: denied(() => fs.linkSync(path.join(config.deniedRoot, 'denied-marker.txt'), path.join(state, 'escape-hardlink'))),
    loopbackDenied: await networkDenied(config.port),
  };
  const report = { version: 1, runId: config.runId, checks, passed: Object.values(checks).every(Boolean) };
  fs.writeFileSync(path.join(state, 'canary-result.json'), JSON.stringify(report), { flag: 'wx', mode: 0o600 });
  if (!report.passed) process.exit(70);
}

try { await check(); } catch { process.exit(71); }

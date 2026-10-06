import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { baseServiceEnvironment } from './environment.mjs';
import { startPreview, statusPreview, stopPreview, runService } from './preview.mjs';
try {
  const [action, flag, directory, ...rest] = process.argv.slice(2);
  if (action === 'maintenance') {
    const [subcommand, directoryFlag, privateDirectory, targetFlag, target, ...extra] = process.argv.slice(3);
    if (directoryFlag !== '--directory' || !privateDirectory || extra.length || (targetFlag && targetFlag !== '--target') || (subcommand === 'refresh' ? !target : targetFlag)) throw new Error('USAGE');
    const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./maintenance-host.mjs', import.meta.url)), subcommand, privateDirectory, ...(target ? [target] : [])], { env: baseServiceEnvironment('center'), cwd: fileURLToPath(new URL('../../', import.meta.url)), stdio: 'inherit' });
    process.exitCode = await new Promise(resolve => { child.once('error', () => resolve(1)); child.once('exit', code => resolve(code ?? 1)); });
  } else if (action === 'internal-service') await runService(flag, directory);
  else {
    if (!['start', 'status', 'stop'].includes(action) || flag !== '--directory' || !directory || rest.some(value => value !== '--confirm-pending') || action !== 'start' && rest.length) throw new Error('USAGE');
    const options = { directory, adminUrl: process.env.FLOW_PREVIEW_ADMIN_URL, confirmPending: rest.includes('--confirm-pending') };
    const result = await ({ start: startPreview, status: statusPreview, stop: stopPreview })[action](options);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }
} catch (error) {
  const code = /^[A-Z_]+$/.test(error.code ?? '') ? error.code : 'PREVIEW_OPERATION_UNCONFIRMED';
  process.stderr.write(`${JSON.stringify({ error: code, message: 'Preview operation was not confirmed. Inspect status; no provider availability or work completion is implied.' })}\n`);
  process.exitCode = 1;
}

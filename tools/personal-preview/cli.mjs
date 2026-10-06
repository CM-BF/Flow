import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { baseServiceEnvironment } from './environment.mjs';
import { startPreview, statusPreview, stopPreview, runService, bootstrapPreviewWeb, publishPreviewWeb, rollbackPreviewWeb, preparePreviewRelease, importPreviewCompatibility, readPreviewJson } from './preview.mjs';
try {
  const [action, flag, directory, ...rest] = process.argv.slice(2);
  if (action === 'web') {
    const [subcommand, ...values] = process.argv.slice(3);
    if (values.length % 2) throw new Error('USAGE');
    const options = {};
    for (let index = 0; index < values.length; index += 2) { if (Object.hasOwn(options, values[index])) throw new Error('USAGE'); options[values[index]] = values[index + 1]; }
    const privateDirectory = options['--directory'];
    let result;
    if (subcommand === 'prepare' && Object.keys(options).sort().join() === '--directory,--release-id,--target') result = await preparePreviewRelease({ directory: privateDirectory, target: options['--target'], releaseId: options['--release-id'] });
    else if (subcommand === 'import-compatibility' && Object.keys(options).sort().join() === '--directory,--report-directory') result = await importPreviewCompatibility({ directory: privateDirectory, reportDirectory: options['--report-directory'] });
    else if (['bootstrap', 'publish', 'rollback'].includes(subcommand) && Object.keys(options).sort().join() === '--directory,--request') {
      const input = await readPreviewJson(options['--request']);
      const allowed = ['expectedVersion', 'expectedBackendHead', 'compatibilityId', ...(subcommand === 'bootstrap' ? [] : ['artifact'])];
      if (Object.keys(input).sort().join() !== allowed.sort().join()) throw new Error('USAGE');
      result = await ({ bootstrap: bootstrapPreviewWeb, publish: publishPreviewWeb, rollback: rollbackPreviewWeb })[subcommand]({ ...input, directory: privateDirectory });
    } else throw new Error('USAGE');
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else if (action === 'maintenance') {
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

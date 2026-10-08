import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { baseServiceEnvironment } from './environment.mjs';
import { startPreview, statusPreview, stopPreview, runService, bootstrapPreviewWeb, publishPreviewWeb, rollbackPreviewWeb, preparePreviewRelease, importPreviewCompatibility, readPreviewJson, preparePreviewBackend, loadPreviewConfiguration, replacePreviewWebHost, assertPreviewMaintenanceRuntime, activatePreviewMessageSettings } from './preview.mjs';
import { maintenanceRuntime } from './backend-release/host.mjs';
import { join } from 'node:path';
try {
  const [action, flag, directory, ...rest] = process.argv.slice(2);
  if (action === 'backend') {
    const [subcommand, ...values] = process.argv.slice(3);
    const options = {};
    if (subcommand !== 'prepare' || values.length !== 8) throw new Error('USAGE');
    for (let i = 0; i < values.length; i += 2) { if (Object.hasOwn(options, values[i])) throw new Error('USAGE'); options[values[i]] = values[i + 1]; }
    if (Object.keys(options).sort().join() !== '--directory,--offline-store,--pnpm-cli,--target') throw new Error('USAGE');
    const result = await preparePreviewBackend({ directory: options['--directory'], target: options['--target'], offlineStore: options['--offline-store'], pnpmCli: options['--pnpm-cli'] });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else if (action === 'web') {
    const [subcommand, ...values] = process.argv.slice(3);
    if (values.length % 2) throw new Error('USAGE');
    const options = {};
    for (let index = 0; index < values.length; index += 2) { if (Object.hasOwn(options, values[index])) throw new Error('USAGE'); options[values[index]] = values[index + 1]; }
    const privateDirectory = options['--directory'];
    let result;
    if (subcommand === 'prepare' && Object.keys(options).sort().join() === '--directory,--release-id,--target') result = await preparePreviewRelease({ directory: privateDirectory, target: options['--target'], releaseId: options['--release-id'] });
    else if (subcommand === 'import-compatibility' && Object.keys(options).sort().join() === '--directory,--report-directory') result = await importPreviewCompatibility({ directory: privateDirectory, reportDirectory: options['--report-directory'] });
    else if (subcommand === 'replace-host' && Object.keys(options).sort().join() === '--directory,--request') {
      const input = await readPreviewJson(options['--request']);
      if (Object.hasOwn(input, 'directory')) throw new Error('USAGE');
      result = await replacePreviewWebHost({ ...input, directory: privateDirectory });
      if (result.outcome !== 'ready') process.exitCode = 1;
    } else if (['bootstrap', 'publish', 'rollback'].includes(subcommand) && Object.keys(options).sort().join() === '--directory,--request') {
      const input = await readPreviewJson(options['--request']);
      const allowed = ['expectedVersion', 'expectedBackendHead', 'compatibilityId', ...(subcommand === 'bootstrap' ? [] : ['artifact'])];
      if (Object.keys(input).sort().join() !== allowed.sort().join()) throw new Error('USAGE');
      result = await ({ bootstrap: bootstrapPreviewWeb, publish: publishPreviewWeb, rollback: rollbackPreviewWeb })[subcommand]({ ...input, directory: privateDirectory });
    } else throw new Error('USAGE');
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else if (action === 'message-settings') {
    if (flag !== '--directory' || !directory || rest.length !== 2 || rest[0] !== '--request') throw new Error('USAGE');
    const recipe = await readPreviewJson(rest[1]);
    process.stdout.write(`${JSON.stringify(await activatePreviewMessageSettings({ directory, recipe }))}\n`);
  } else if (action === 'maintenance') {
    const [subcommand, directoryFlag, privateDirectory, option, value, ...extra] = process.argv.slice(3);
    if (directoryFlag !== '--directory' || !privateDirectory || extra.length || (subcommand === 'refresh' ? option !== '--target' || !value : subcommand === 'bootstrap' ? option && (option !== '--backend-artifact' || !value) : option)) throw new Error('USAGE');
    const config = await loadPreviewConfiguration(privateDirectory);
    const runtime = await maintenanceRuntime(config);
    await assertPreviewMaintenanceRuntime(config, runtime);
    const host = join(runtime.root, 'tools/personal-preview/maintenance-host.mjs');
    const child = spawn(process.execPath, ['--import', 'tsx', host, subcommand, privateDirectory, subcommand === 'refresh' ? value : '', subcommand === 'bootstrap' && option ? value : ''], { env: baseServiceEnvironment('center'), cwd: runtime.root, stdio: 'inherit' });
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

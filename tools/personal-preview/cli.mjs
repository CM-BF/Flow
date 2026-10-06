import { startPreview, statusPreview, stopPreview, runService } from './preview.mjs';
try {
  const [action, flag, directory, ...rest] = process.argv.slice(2);
  if (action === 'internal-service') await runService(flag, directory);
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

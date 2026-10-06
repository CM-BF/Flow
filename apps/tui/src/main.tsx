import React from 'react';
import { render } from 'ink';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FlowClient } from '@flow/client';
import { commandDescriptors, createInteractionController } from '@flow/interaction';
import { openIntentStore } from './intent-store.js';
import { runHeadless } from './headless.js';
import { TerminalScreen } from './screen.js';

export async function runTerminal(args = process.argv.slice(2), env = process.env): Promise<void> {
  if (args.includes('--help')) { process.stdout.write(`${commandDescriptors.map(command => `${command.usage} — ${command.description}`).join('\n')}\n`); return; }
  if (args.some(arg => arg !== '--headless')) throw new Error('Unsupported terminal option');
  const url = new URL(env.FLOW_URL ?? '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('FLOW_URL must be an absolute center origin');
  const token = env.FLOW_TOKEN;
  if (!token || token.length > 4096 || /[\r\n]/.test(token)) throw new Error('FLOW_TOKEN is required in the environment');
  const connectionId = createHash('sha256').update(JSON.stringify([url.origin, token])).digest('hex');
  const store = await openIntentStore(env.FLOW_TUI_STATE_DIR ?? join(homedir(), '.flow-terminal'), connectionId);
  const controller = createInteractionController({ client: new FlowClient({ baseUrl: url.origin, token }), connectionId, intents: store });
  let unmount: (() => void) | undefined;
  const stop = () => { void controller.dispose().then(() => { unmount?.(); if (args.includes('--headless')) process.stdin.destroy(); }); };
  process.once('SIGTERM', stop); if (args.includes('--headless')) process.once('SIGINT', stop);
  try {
    await controller.initialize();
    if (args.includes('--headless')) await runHeadless(controller, process.stdin, process.stdout);
    else {
      if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Interactive mode requires a TTY; use --headless');
      const app = render(<TerminalScreen controller={controller} />, { exitOnCtrlC: false, patchConsole: false });
      unmount = app.unmount; await app.waitUntilExit();
    }
  } finally { process.off('SIGTERM', stop); process.off('SIGINT', stop); await controller.dispose(); unmount?.(); await store.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runTerminal().catch(() => { process.stderr.write('Flow terminal failed. Check connection configuration, private state, or unresolved lock; no credentials were logged.\n'); process.exitCode = 1; });
}

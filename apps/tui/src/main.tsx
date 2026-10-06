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
import { closeTerminalResources } from './lifecycle.js';
import { createGoalTerminal } from './goal/terminal.js';
import { openGoalIntentStore } from './goal/store.js';
import { GoalScreen } from './goal/screen.js';
import { goalHelp } from './goal/commands.js';

export async function runTerminal(args = process.argv.slice(2), env = process.env): Promise<void> {
  if (args.includes('--help')) { process.stdout.write(args.includes('--goal') ? `--goal <id> [--headless]\n${goalHelp}\n` : `${commandDescriptors.map(command => `${command.usage} — ${command.description}`).join('\n')}\n`); return; }
  let goalId: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--headless') continue;
    if (args[i] !== '--goal' || goalId !== undefined || !args[i + 1] || !/^[a-f0-9-]{36}$/i.test(args[i + 1]!)) throw new Error('Unsupported terminal option');
    goalId = args[++i];
  }
  const url = new URL(env.FLOW_URL ?? '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('FLOW_URL must be an absolute center origin');
  const token = env.FLOW_TOKEN;
  if (!token || token.length > 4096 || /[\r\n]/.test(token)) throw new Error('FLOW_TOKEN is required in the environment');
  const connectionId = createHash('sha256').update(JSON.stringify([url.origin, token])).digest('hex');
  const directory = env.FLOW_TUI_STATE_DIR ?? join(homedir(), '.flow-terminal');
  const store = goalId ? await openGoalIntentStore(directory, connectionId, goalId) : await openIntentStore(directory, connectionId);
  const client = new FlowClient({ baseUrl: url.origin, token, assistantStreamProtocol: 'patch-v1' });
  let controller: ReturnType<typeof createGoalTerminal> | ReturnType<typeof createInteractionController> | undefined;
  let unmount: (() => void) | undefined;
  const stopObservation = () => { try { unmount?.(); } finally { if (args.includes('--headless')) process.stdin.destroy(); } };
  const stop = () => { void (controller?.dispose() ?? Promise.resolve()).then(stopObservation, stopObservation).catch(() => { process.exitCode = 1; }); };
  try {
    const goal = goalId ? createGoalTerminal({ client, connectionId, goalId, intents: store as Awaited<ReturnType<typeof openGoalIntentStore>> }) : null;
    const conversation = goal ? null : createInteractionController({ client, observe: client, connectionId, intents: store as Awaited<ReturnType<typeof openIntentStore>> });
    controller = goal ?? conversation!;
    process.once('SIGTERM', stop); if (args.includes('--headless')) process.once('SIGINT', stop);
    await controller.initialize();
    if (args.includes('--headless')) await runHeadless(controller, process.stdin, process.stdout);
    else {
      if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Interactive mode requires a TTY; use --headless');
      const app = render(goal ? <GoalScreen controller={goal} /> : <TerminalScreen controller={conversation!} />, { exitOnCtrlC: false, patchConsole: false });
      unmount = app.unmount; await app.waitUntilExit();
    }
  } finally {
    process.off('SIGTERM', stop); process.off('SIGINT', stop);
    await closeTerminalResources({ settle: async () => { await controller?.dispose(); }, unmount: () => unmount?.(), closeJournal: store.close });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runTerminal().catch(() => { process.stderr.write('Flow terminal failed. Check connection configuration, private state, or unresolved lock; no credentials were logged.\n'); process.exitCode = 1; });
}

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { TextInput } from '@assistant-ui/react-ink';
import { terminalText } from '@flow/interaction';
import { goalDisplay, type GoalTerminal } from './terminal.js';
const unsafe = /[\x00-\x08\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/;
export function GoalScreen({ controller }: { controller: GoalTerminal }) {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  const { exit } = useApp(), { stdout } = useStdout();
  const dimensions = () => ({ rows: (stdout as NodeJS.WriteStream).rows || 24, columns: (stdout as NodeJS.WriteStream).columns || 80 });
  const [size, setSize] = useState(dimensions), [editorNotice, setEditorNotice] = useState('');
  useEffect(() => { const resize = () => setSize(dimensions()); stdout.on('resize', resize); return () => { stdout.off('resize', resize); }; }, [stdout]);
  useEffect(() => { if (state.closed) exit(); }, [state.closed, exit]);
  useInput((input, key) => { if (key.ctrl && input === 'c') void controller.execute({ type: 'quit' }); });
  const body = goalDisplay(state, Math.max(160, Math.min(1600, (size.rows - 12) * Math.max(20, size.columns - 4))));
  return <Box flexDirection="column">
    <Text bold>Flow goal · {state.goal.connected ? 'connected' : 'not observing'}</Text>
    <Text dimColor>{state.goal.plan?.goalId ?? 'Loading goal'}</Text>
    {state.goal.intent && <Text color="yellow">{state.goal.commandState === 'sending' ? 'Submitting saved request…' : 'Acknowledgement unknown — original request saved. /recover'}</Text>}
    <Text>{terminalText(body.text)}</Text>
    <Text dimColor>Page {body.page}/{body.pages} · /page number · /observe refreshes</Text>
    <Text dimColor>{terminalText((editorNotice || state.notice).slice(0, 900))}</Text>
    <Box borderStyle="single" paddingX={1}><Text color="green">› </Text>
      <TextInput value={state.draft} multiLine submitOnEnter autoFocus placeholder="Local draft or /command" onChange={text => {
        if (unsafe.test(text)) { setEditorNotice('Terminal control characters are not accepted.'); return; }
        setEditorNotice(''); controller.setDraft(text);
      }} onSubmit={text => { void controller.input(text).then(answer => {
        if (answer.ok && text.startsWith('/') && controller.snapshot().draft === text) controller.setDraft('');
        if (!answer.ok) setEditorNotice(answer.message);
      }); }} />
    </Box>
    <Text dimColor>Enter command / keep draft · Ctrl-J newline · Ctrl-C disconnect</Text>
  </Box>;
}

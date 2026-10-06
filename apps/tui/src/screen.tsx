import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { TextInput } from '@assistant-ui/react-ink';
import { completeInput, terminalText, type InteractionController } from '@flow/interaction';
const unsafe = /[\x00-\x08\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/;
const visible = (text: string, length = 1400) => terminalText(text.length > length ? `${text.slice(0, length)}… [display truncated]` : text);

export function TerminalScreen({ controller }: { controller: InteractionController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  const { exit } = useApp(); const { stdout } = useStdout();
  const terminalRows = () => (stdout as NodeJS.WriteStream).rows || 24;
  const [rows, setRows] = useState(terminalRows); const [editorNotice, setEditorNotice] = useState('');
  useEffect(() => { const resized = () => setRows(terminalRows()); stdout.on('resize', resized); return () => { stdout.off('resize', resized); }; }, [stdout]);
  useEffect(() => { if (state.closed) exit(); }, [state.closed, exit]);
  useInput((input, key) => {
    if (key.ctrl && input === 'c') { void controller.execute({ type: 'quit' }); return; }
    if (key.tab) { const completions = completeInput(state.draft); if (completions.length === 1) controller.setDraft(`${completions[0]} `); }
  });
  const observed = state.observation;
  const turns = (observed ? state.turns.filter(turn => turn.id === observed.turnId) : state.turns).slice(-Math.max(1, Math.min(3, Math.floor((rows - 10) / 5))));
  return <Box flexDirection="column">
    <Text bold>Flow · {state.connected ? 'connected' : 'not observing'}{state.busy ? ' · working' : ''}</Text>
    <Text dimColor>{state.selected ? `${visible(state.selected.title, 80)}  ${state.selected.id}` : 'Select /conversations or /new. /help lists commands.'}</Text>
    {state.pending && <Text color="yellow">{state.pending.status === 'unknown' ? 'Acknowledgement unknown — saved original request. Use /recover.' : 'Submitting immutable request…'}</Text>}
    {state.view === 'conversation' && (!observed || observed.panel === 'body') && turns.map(turn => <Box key={turn.id} flexDirection="column" marginTop={1}>
      <Text>You: {visible(turn.userText, 350)}</Text>
      {observed?.segments.length ? observed.segments.slice(-4).map(segment => <Box key={segment.id} flexDirection="column">
        <Text>Assistant: {visible(segment.text)}</Text>
        <Text dimColor>{segment.kind === 'final' ? 'recorded reply' : segment.interrupted ? 'incomplete' : segment.observationPaused ? 'observation paused' : segment.phase}{segment.truncated ? ' · truncated' : ''}</Text>
      </Box>) : <Text>Assistant: {turn.assistant.text === null ? `[${turn.assistant.state}; task ${turn.status}]` : visible(turn.assistant.text)}{turn.assistant.truncated ? ' [truncated]' : ''}</Text>}
      {observed && observed.segments.length > 4 && <Text dimColor>{observed.segments.length - 4} earlier segments retained in the observation.</Text>}
      <Text dimColor>{turn.status} · model {visible(turn.effectiveModel ?? 'unknown', 180)}</Text>
    </Box>)}
    {state.view === 'conversation' && observed?.panel === 'activity' && <Box flexDirection="column">
      <Text bold>Activity · turn {observed.number} · /detail number</Text>
      {observed.activities.map((item,index) => <Text key={item.id}>{index+1}. {visible(item.toolName ?? item.kind,100)} · {item.status}{item.detail ? '' : ' · no public body'}</Text>)}
      {observed.hasMore && <Text dimColor>More: /activity next</Text>}
    </Box>}
    {state.view === 'conversation' && observed?.detail && observed.panel !== 'body' && observed.panel !== 'activity' && <Box flexDirection="column">
      <Text bold>{visible(observed.detail.title,100)}</Text><Text>{visible(observed.detail.text,2400)}</Text>
      {observed.detail.truncated && <Text color="yellow">Truncated public fragment; the remainder is not available here.</Text>}
    </Box>}
    {state.view === 'conversation' && observed?.error && <Text color="yellow">Observation incomplete: {visible(observed.error,250)}</Text>}
    {state.view === 'conversations' && state.conversations.map(item => <Text key={item.id}>{item.id} {visible(item.title, 70)}</Text>)}
    {state.view === 'profiles' && state.profiles.map(item => <Text key={item.id}>{item.id} {visible(item.model, 80)} · {item.access} · not probed</Text>)}
    <Text dimColor>{visible(editorNotice || state.notice, 2200)}</Text>
    {state.view === 'conversations' && state.conversationCursor && <Text dimColor>More: /conversations {visible(state.conversationCursor, 128)}</Text>}
    {state.view === 'profiles' && state.profileCursor && <Text dimColor>More: /profiles {visible(state.profileCursor, 128)}</Text>}
    <Box borderStyle="single" paddingX={1}>
      <Text color="green">› </Text>
      <TextInput value={state.draft} multiLine submitOnEnter autoFocus placeholder="Message or /command"
        onChange={text => {
          if (unsafe.test(text)) { setEditorNotice('Terminal control characters are not accepted in the interactive editor.'); return; }
          setEditorNotice(''); controller.setDraft(text);
        }} onSubmit={text => {
          void controller.input(text).then(answer => {
            if (answer.ok && text.startsWith('/') && controller.snapshot().draft === text) controller.setDraft('');
            if (!answer.ok) setEditorNotice(answer.message);
          });
        }} />
    </Box>
    <Text dimColor>Enter send · Ctrl-J newline · Tab complete · Ctrl-C disconnect and quit</Text>
  </Box>;
}

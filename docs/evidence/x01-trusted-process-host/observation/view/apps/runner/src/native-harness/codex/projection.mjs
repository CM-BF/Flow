import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const source = 'codex.app-server.agent-message';

function id(value) {
  assert.ok(typeof value === 'string' && value.length > 0 && Buffer.byteLength(value) <= 128, 'Native ID exceeds Flow boundary');
}

function validateItem(item) {
  id(item?.id);
  assert.equal(typeof item.type, 'string', 'Missing item type');
  if (item.type !== 'agentMessage') return;
  assert.ok(['commentary', 'final_answer', null].includes(item.phase), 'Unknown message phase');
  assert.ok(item.delivery === null || item.delivery === 'async', 'Invalid delivery');
  assert.ok(item.questions === null || Array.isArray(item.questions), 'Invalid questions');
  assert.ok(typeof item.text === 'string' && Buffer.byteLength(item.text) <= 1048576, 'Final content exceeds Flow boundary');
}

function ordinaryCandidate(messages) {
  if (messages.some(item => item.phase === null)) return { state: 'unknown', reason: 'phase-unknown' };
  if (messages.some(item => item.delivery !== null || item.questions?.length)) return { state: 'unsupported', reason: 'nonordinary-message' };
  const finals = messages.filter(item => item.phase === 'final_answer');
  if (finals.length !== 1) return { state: 'unknown', reason: finals.length ? 'ambiguous-finals' : 'missing-completed-final-item' };
  return { state: 'candidate', item: finals[0] };
}

/** Pure ordinary-final evidence projection. No host terminal policy, I/O, retry, or process ownership. */
export function createOrdinaryFinalProjection(expected) {
  id(expected.threadId);
  id(expected.turnId);
  const identity = structuredClone(expected);
  const items = new Map();
  let itemBytes = 0;
  let terminal = null;
  let invalid = false;

  function result() {
    if (!terminal) return { state: 'pending', final: null };
    if (terminal.status !== 'completed') return { state: terminal.status, final: null };
    const observed = ordinaryCandidate([...items.values()].filter(item => item.type === 'agentMessage'));
    if (observed.state !== 'candidate') return { ...observed, final: null };
    const final = observed.item;
    if (terminal.itemsView === 'full') {
      const listed = ordinaryCandidate(terminal.items.filter(item => item.type === 'agentMessage'));
      if (listed.state !== 'candidate') return { ...listed, final: null };
      assert.deepEqual(listed.item, final, 'Full terminal item differs from completed item');
    }
    const sourceMessageId = digest([identity.turnId, final.id]);
    return {
      state: 'completed',
      final: { source, nativeSessionId: identity.threadId, nativeTurnId: identity.turnId,
        nativeItemId: final.id, sourceMessageId, messageId: digest([source, identity.threadId, sourceMessageId]), text: final.text },
      actualExecution: 'unknown',
    };
  }

  function acceptItem(params) {
    assert.equal(params.turnId, identity.turnId, 'Turn identity mismatch');
    assert.equal(terminal, null, 'Item arrived after terminal');
    const item = params.item;
    validateItem(item);
    assert.ok(Number.isFinite(params.completedAtMs), 'Missing item completion timestamp');
    assert.ok(items.size < 64 || items.has(item.id), 'Completed item limit reached');
    if (items.has(item.id)) {
      assert.deepEqual(items.get(item.id), item, 'Completed item changed');
    } else {
      itemBytes += Buffer.byteLength(JSON.stringify(item));
      assert.ok(itemBytes <= 2097152, 'Completed item byte limit reached');
      items.set(item.id, structuredClone(item));
    }
  }

  function acceptTerminal(turn) {
    assert.equal(turn?.id, identity.turnId, 'Turn identity mismatch');
    assert.ok(['completed', 'failed', 'interrupted'].includes(turn.status), 'Completion must be terminal');
    if (turn.status === 'completed') assert.equal(turn.error, null, 'Successful turn cannot carry an error');
    assert.ok(['notLoaded', 'summary', 'full'].includes(turn.itemsView)
      && Array.isArray(turn.items) && turn.items.length <= 1000, 'Invalid turn item view');
    for (const item of turn.items) validateItem(item);
    assert.equal(new Set(turn.items.map(item => item.id)).size, turn.items.length, 'Duplicate terminal item identity');
    if (terminal) assert.deepEqual(terminal, turn, 'Terminal changed');
    else terminal = structuredClone(turn);
  }

  return {
    accept(notification) {
      assert.equal(invalid, false, 'Projection invalidated by earlier evidence');
      try {
        assert.ok(notification && ['item/completed', 'turn/completed'].includes(notification.method), 'Unsupported ordinary-final notification');
        assert.ok(Buffer.byteLength(JSON.stringify(notification)) <= 2097152, 'Decoded notification exceeds limit');
        const params = notification.params ?? {};
        assert.equal(params.threadId, identity.threadId, 'Thread identity mismatch');
        if (notification.method === 'item/completed') acceptItem(params);
        else acceptTerminal(params.turn);
        return result();
      } catch (error) {
        invalid = true;
        throw error;
      }
    },
  };
}

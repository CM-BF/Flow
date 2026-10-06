import assert from 'node:assert/strict';

const approved = {
  'four-processes': { tasks: 16, runners: 4, capacityPerRunner: 1 },
  'declared-four': { tasks: 12, runners: 1, capacityPerRunner: 4 },
} as const;

export function resolveScenario(id: string, windowId: string | undefined) {
  assert(Object.hasOwn(approved, id), 'Unapproved scenario; smoke and capacity1 control are not enabled.');
  assert(windowId?.trim(), 'Formal run needs a coordinated window identifier.');
  return Object.freeze({ id: id as keyof typeof approved, ...approved[id as keyof typeof approved], conversations: 128, formal: true, windowId });
}

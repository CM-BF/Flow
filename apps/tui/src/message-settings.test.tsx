import React, { act } from 'react';
import { afterEach, expect, test } from 'vitest';
import { cleanup, render } from 'ink-testing-library';
import { TerminalScreen } from './screen.js';
import { controlledSettings, selectFirst } from '../../../packages/interaction/src/message-settings/fixture.js';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const controllers: ReturnType<typeof controlledSettings>['controller'][] = [];
afterEach(async () => { await act(async () => { cleanup(); await Promise.all(controllers.splice(0).map(controller => controller.dispose())); }); });

test('Ink consumes the shared selection and shows unknown observations without inventing effective thinking', async () => {
  const value = controlledSettings(); controllers.push(value.controller); await selectFirst(value);
  const settings = value.controller.snapshot().settings.selected!;
  value.f.snapshot.lastTurn = value.f.accepted({ text: 'synthetic text', expectedRevision: 0, mode: 'follow-up', messageSettings: settings }).turn;
  await value.controller.input('/recover');
  let terminal!: ReturnType<typeof render>;
  await act(async () => { terminal = render(<TerminalScreen controller={value.controller} />); });
  await expect.poll(() => terminal.lastFrame()).toContain('Next message settings: sonnet');
  expect(terminal.lastFrame()).toContain('Requested: sonnet'); expect(terminal.lastFrame()).toContain('Observed: unknown');
  expect(terminal.lastFrame()).toContain('Actual thinking: unknown');
  await act(async () => { await value.controller.input('/settings'); });
  expect(terminal.lastFrame()).toContain('Claude complete choices'); expect(terminal.lastFrame()).toContain('#2');
  expect(terminal.lastFrame()).toContain('effort not requested'); expect(terminal.lastFrame()).toContain('access none');
  await act(async () => { terminal.stdin.write('\u0003'); });
  await expect.poll(() => value.controller.snapshot().closed).toBe(true); expect(value.calls).toHaveLength(0);
});

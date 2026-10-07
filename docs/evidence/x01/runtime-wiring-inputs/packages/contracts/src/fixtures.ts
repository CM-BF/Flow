import type { TaskSubmission } from './tasks.js';

export const taskFixtures = {
  success: { title: 'Summarize the field notes', prompt: 'Prepare a concise summary and verify the saved artifact.', harness: 'fixture', fixture: { scenario: 'success', delayMs: 600 } },
  decision: { title: 'Review the launch checklist', prompt: 'Prepare the checklist, then ask me before publishing the artifact.', harness: 'fixture', fixture: { scenario: 'decision', delayMs: 600 } },
  failure: { title: 'Inspect a failed execution', prompt: 'Exercise the explicit failure path.', harness: 'fixture', fixture: { scenario: 'failure' } },
  verificationFailure: { title: 'Inspect failed verification', prompt: 'Retain the artifact and show the evidence when verification fails.', harness: 'fixture', fixture: { scenario: 'verification-failure' } },
  large: { title: 'Inspect folded evidence', prompt: 'Keep the long evidence behind a reference.', harness: 'fixture', fixture: { scenario: 'large', detailBytes: 262144 } },
  slow: { title: 'Continue after the browser closes', prompt: 'Complete in the background.', harness: 'fixture', fixture: { scenario: 'slow', delayMs: 8000 } },
} satisfies Record<string, TaskSubmission>;

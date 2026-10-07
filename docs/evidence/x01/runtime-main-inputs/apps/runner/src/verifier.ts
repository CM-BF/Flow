import { createHash } from 'node:crypto';
import type { RunnerEventData, VerificationRule } from '@flow/contracts';

export function textDigest(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function verifyText(artifactId: string, content: string, requested?: VerificationRule): RunnerEventData {
  const rule: VerificationRule = requested?.kind === 'contains'
    ? { kind: 'contains', expected: requested.expected }
    : { kind: 'nonempty' };
  const artifactVersion = textDigest(content);
  const passed = rule.kind === 'contains' ? content.includes(rule.expected) : content.trim().length > 0;
  return {
    type: 'verification', artifactId, artifactVersion, verifierId: 'flow.text', verifierVersion: '1',
    inputDigest: textDigest(JSON.stringify({ artifactVersion, rule })),
    result: passed ? 'passed' : 'failed',
    evidence: rule.kind === 'contains' ? `Saved artifact ${passed ? 'contains' : 'does not contain'} the required text.` : `Saved artifact is ${passed ? 'nonempty' : 'empty'}.`,
  };
}

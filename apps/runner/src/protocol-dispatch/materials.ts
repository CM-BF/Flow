import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Task } from '@a2a-js/sdk';
import type { ProtocolState, VerificationRule } from '@flow/contracts';
import type { EventOutbox } from '../outbox.js';
import { textDigest, verifyText } from '../verifier.js';

/** Save the exact inline content locally and in the lower store before independent verification. */
export async function importArtifacts(task: Task, state: ProtocolState, directory: string, outbox: EventOutbox, rule?: VerificationRule) {
  if (task.artifacts.length > 200) throw new Error('Remote task exceeds the artifact count budget.');
  let bytes = 0;
  for (const artifact of task.artifacts) {
    if (!artifact.artifactId || artifact.parts.some(part => part.content?.$case !== 'text')) throw new Error('Only named inline text artifacts are supported.');
    const content = artifact.parts.map(part => part.content?.value).join('\n');
    const size = Buffer.byteLength(content); bytes += size;
    if (size > 1_048_576 || bytes > 2_097_152) throw new Error('Remote task exceeds the artifact byte budget.');
    const artifactId = `a2a:${textDigest(`${task.id}\0${artifact.artifactId}`)}`;
    const version = textDigest(content);
    const receipt = state.artifacts.find(item => item.artifactId === artifactId && item.version === version);
    if (receipt?.verified) continue;
    const file = join(directory, `${textDigest(artifactId)}-${version}.txt`);
    await writeFile(file, content, { mode: 0o600 });
    const saved = await readFile(file, 'utf8');
    if (textDigest(saved) !== version) throw new Error('Local protocol artifact changed before verification.');
    if (!receipt) await outbox.emit({ type: 'artifact', artifactId, title: (artifact.name || artifact.artifactId).slice(0, 180), version, content: saved, mediaType: 'text/plain' });
    await outbox.emit(verifyText(artifactId, saved, rule));
    state.artifacts.push({ artifactId, version, verified: true, reference: { id: artifactId, title: artifact.name || artifact.artifactId } });
  }
}

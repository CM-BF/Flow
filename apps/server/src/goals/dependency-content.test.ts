import { expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import type { GoalArtifactBinding } from '../../../../packages/contracts/src/goals.js';
import { sha256 } from '../database.js';
import { dependencyContent } from './dependency-content.js';

function binding(id: string, content: string): GoalArtifactBinding {
  return { nodeId: id, executionId: `exec-${id}`, taskId: `task-${id}`, artifactId: `artifact-${id}`, artifactVersion: sha256(content), detailId: `detail-${id}` };
}

it('reads multiple short dependencies in one query without changing their ordered content', async () => {
  const bindings = [binding('z', 'short'), binding('a', 'short')];
  const query = vi.fn().mockResolvedValue({ rows: [{ ordinal: 1, content: 'short' }, { ordinal: 2, content: 'short' }] });
  expect(await dependencyContent({ query } as unknown as PoolClient, bindings)).toEqual(bindings.map(item => ({ ...item, content: 'short' })));
  expect(query).toHaveBeenCalledTimes(1);
});

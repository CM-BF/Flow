import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PluginMutationResult, PluginRegistration, PluginVersionDeclaration } from '../../../../packages/contracts/src/plugins.js';
import { canonical, HttpError, sha256 } from '../database.js';
import { command } from '../tasks.js';
import { operationView, readSnapshot, type OperationRecord } from './storage.js';

async function registerVersion(client: PoolClient, installationId: string, declaration: PluginVersionDeclaration): Promise<string> {
  const id = randomUUID();
  await client.query('INSERT INTO flow.plugin_versions(id,installation_id,package_version,declaration) VALUES($1,$2,$3,$4)', [id, installationId, declaration.packageVersion, JSON.stringify(declaration)]);
  return id;
}
export async function registerPlugin(pool: Pool, input: PluginRegistration, key: string): Promise<PluginMutationResult> {
  const result = await command(pool, 'plugin.register', key, input, async client => {
    const { workspaceId, projectId } = input.scope;
    if (projectId && !(await client.query('SELECT id FROM flow.projects WHERE id=$1 AND workspace_id=$2', [projectId, workspaceId])).rowCount) {
      throw new HttpError(404, 'project_not_found', 'Project not found in the plugin workspace.');
    }
    const id = randomUUID();
    const inserted = await client.query(`INSERT INTO flow.plugin_installations(id,workspace_id,project_id,package_name,revision)
      VALUES($1,$2,$3,$4,1) ON CONFLICT DO NOTHING RETURNING id`, [id, workspaceId, projectId, input.version.packageName]);
    if (!inserted.rowCount) throw new HttpError(409, 'plugin_scope_conflict', 'This package is already registered in the scope.');
    const versionId = await registerVersion(client, id, input.version);
    await client.query("INSERT INTO flow.plugin_revisions(installation_id,revision,version_id,configuration,grants) VALUES($1,1,$2,'{}','[]')", [id, versionId]);
    const operation = (await client.query<OperationRecord>(`INSERT INTO flow.plugin_operations(id,installation_id,kind,actor,input_digest,before_revision,after_revision)
      VALUES($1,$2,'register','owner',$3,NULL,1) RETURNING *`, [randomUUID(), id, sha256(canonical(input))])).rows[0]!;
    return { snapshot: await readSnapshot(client, id), operation: operationView(operation) };
  });
  return { ...result.value, replayed: result.replayed };
}

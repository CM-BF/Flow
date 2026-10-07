import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PluginCommand, PluginConfiguration, PluginMutationResult, PluginRegistration, PluginVersionDeclaration } from '../../../../packages/contracts/src/plugins.js';
import { canonical, HttpError, sha256 } from '../database.js';
import { command } from '../tasks.js';
import { appendPluginRevision, loadInstallation, operationView, readSnapshot, type OperationRecord } from './storage.js';

async function registerVersion(client: PoolClient, installationId: string, declaration: PluginVersionDeclaration): Promise<string> {
  const id = randomUUID();
  const inserted = await client.query('INSERT INTO flow.plugin_versions(id,installation_id,package_version,declaration) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id', [id, installationId, declaration.packageVersion, JSON.stringify(declaration)]);
  if (!inserted.rowCount) throw new HttpError(409, 'plugin_version_conflict', 'A package version cannot be redeclared.');
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

function validateConfiguration(version: PluginVersionDeclaration, values: PluginConfiguration): void {
  const fields = new Map(version.publicConfiguration.map(field => [field.key, field]));
  for (const [key, value] of Object.entries(values)) {
    const field = fields.get(key);
    const valid = field?.kind === 'boolean' ? typeof value === 'boolean'
      : field?.kind === 'integer' ? typeof value === 'number' && Number.isInteger(value) && value >= field.min && value <= field.max
      : field?.kind === 'enum' ? typeof value === 'string' && field.values.includes(value) : false;
    if (!valid) throw new HttpError(409, 'plugin_configuration_invalid', 'Configuration does not match the selected public schema.');
  }
  if (version.publicConfiguration.some(field => field.required && !Object.hasOwn(values, field.key))) {
    throw new HttpError(409, 'plugin_configuration_invalid', 'Required public configuration is missing.');
  }
}
export async function changePlugin(pool: Pool, id: string, input: PluginCommand, key: string): Promise<PluginMutationResult> {
  const result = await command(pool, `plugin.command:${id}`, key, input, async client => {
    const installation = await loadInstallation(client, id, true);
    if (installation.revision !== input.expectedRevision || installation.revision === 2_147_483_647) {
      throw new HttpError(409, 'plugin_revision_conflict', 'Plugin revision changed; read the current registration.');
    }
    const current = await readSnapshot(client, id);
    let configuration = current.configuration;
    let grants = current.grants;
    let versionId = current.version.id;
    const change = input.change;
    if (change.kind === 'configure') {
      validateConfiguration(current.version, change.values);
      configuration = change.values;
    } else if (change.kind === 'set-grants') {
      if (change.capabilities.some(capability => !current.version.capabilities.includes(capability))) {
        throw new HttpError(409, 'plugin_grant_invalid', 'Grants must be a subset of the declared capabilities.');
      }
      grants = change.capabilities;
    } else if (change.kind === 'register-version') {
      if (change.version.packageName !== installation.package_name) throw new HttpError(409, 'plugin_version_conflict', 'The package name is fixed by its registration.');
      await registerVersion(client, id, change.version);
    } else if (change.kind === 'select-version') {
      if (!(await client.query('SELECT id FROM flow.plugin_versions WHERE installation_id=$1 AND id=$2', [id, change.versionId])).rowCount) {
        throw new HttpError(404, 'plugin_version_not_found', 'Plugin version not found in this registration.');
      }
      versionId = change.versionId;
      configuration = {};
      grants = [];
    } else throw new HttpError(400, 'invalid_plugin_command', 'This registry command is unavailable.');
    return appendPluginRevision(client, installation, { versionId, configuration, grants, kind: change.kind, inputDigest: sha256(canonical(input)) });
  });
  return { ...result.value, replayed: result.replayed };
}

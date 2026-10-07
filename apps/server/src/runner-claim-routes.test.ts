import Fastify from 'fastify';
import { expect, test } from 'vitest';
import { registerRunnerClaimRoutes } from './runner-claim-routes.js';
import { ClaimFixture } from '../../../docs/evidence/x01/center-claim-fixture.js';
import { HttpError } from './database.js';

test('the production claim routes decode v3 and return an allocated binding through the real transaction path', async () => {
  const f=new ClaimFixture(), app=Fastify();
  const oldQuery=f.query.bind(f); f.query=async(sql,values=[])=>sql.startsWith('SELECT kind FROM flow.plugin_binding_executions')?{rows:[{kind:'tool'}],rowCount:1}:oldQuery(sql,values); app.decorateRequest('runnerId',f.runnerId);
  app.setErrorHandler((error,_request,reply)=>reply.code(error instanceof HttpError?error.status:500).send({code:error instanceof HttpError?error.code:'internal'}));
  registerRunnerClaimRoutes(app,f.pool,5000);
  try {
    const response=await app.inject({method:'POST',url:'/api/runner/claim-opportunity',payload:f.request});
    expect(response.statusCode).toBe(200); expect(response.json()).toMatchObject({state:'assigned',assignment:{pluginToolBinding:f.binding}});
    const status=await app.inject({method:'POST',url:'/api/runner/claim-opportunity/status',payload:f.request});
    expect(status.statusCode).toBe(200); expect(status.json()).toEqual(response.json());
    const bad=await app.inject({method:'POST',url:'/api/runner/claim-opportunity',payload:{...f.request,runnerId:'another'}});
    expect(bad.statusCode).toBe(403);
    const unknown=await app.inject({method:'POST',url:'/api/runner/claim-opportunity',payload:{...f.request,protocol:'flow.runner-claim.v4'}});
    expect(unknown.statusCode).toBe(400);
  } finally { await app.close(); }
  expect(app.server.listening).toBe(false); expect(f.releases).toBe(2);
});

test('malformed v2 opt-in fails before any transaction and legacy identity stays v2',async()=>{
  const f=new ClaimFixture(),app=Fastify();app.decorateRequest('runnerId',f.runnerId);
  app.setErrorHandler((error,_request,reply)=>reply.code(error instanceof HttpError?error.status:500).send({code:error instanceof HttpError?error.code:'internal'}));
  registerRunnerClaimRoutes(app,f.pool,5000);
  try {
    const result=await app.inject({method:'POST',url:'/api/runner/claim-opportunity',payload:{...f.request,protocol:'flow.runner-claim.v2'}});
    expect(result.statusCode).toBe(400);expect(f.queries).toEqual([]);
    const identity=await app.inject({method:'GET',url:'/api/runner/identity'});
    expect(identity.json()).toEqual({protocol:'flow.runner-claim.v2',runnerId:f.runnerId});
  }finally{await app.close();}
  expect(app.server.listening).toBe(false);
});

test('AV03 center production v4 route shares receipt transaction and explicit tool qualification', async () => {
  const f = new ClaimFixture(), app = Fastify();
  const original = f.query.bind(f);
  f.query = async (sql, values = []) => sql.startsWith('SELECT kind FROM flow.plugin_binding_executions')
    ? { rows: [{ kind: 'tool' }], rowCount: 1 } : original(sql, values);
  app.decorateRequest('runnerId', f.runnerId);
  app.setErrorHandler((error, _request, reply) => reply.code(error instanceof HttpError ? error.status : 500).send({ code: error instanceof HttpError ? error.code : 'internal' }));
  registerRunnerClaimRoutes(app, f.pool, 5000);
  const input = { ...f.request, protocol: 'flow.runner-claim.v4', pluginVerifierExecution: { bindingProtocol: 'flow.plugin-verification.v1',
    storeId: 'owned-store', hostApiMajor: 1, algorithms: [{ id: 'flow.json-object.required-keys', version: 1 }] } };
  try {
    const first = await app.inject({ method: 'POST', url: '/api/runner/claim-opportunity', payload: input });
    expect(first.statusCode).toBe(200); expect(first.json()).toMatchObject({ state: 'assigned', assignment: { pluginToolBinding: f.binding } });
    const replay = await app.inject({ method: 'POST', url: '/api/runner/claim-opportunity/status', payload: input });
    expect(replay.json()).toEqual(first.json()); expect(f.receipts).toHaveLength(1);
    const conflict = await app.inject({ method: 'POST', url: '/api/runner/claim-opportunity', payload: f.request });
    expect(conflict.statusCode).toBe(409); expect(conflict.json().code).toBe('claim_key_conflict');
    const query = f.queries.find(q => q.sql.includes('SELECT t.id FROM flow.tasks t'))!;
    expect(query.sql.indexOf('plugin_binding_executions')).toBeLessThan(query.sql.indexOf('LIMIT 1'));
    expect(query.values.slice(2)).toEqual(['owned-store', 1, 'owned-store', 1, JSON.stringify(input.pluginVerifierExecution.algorithms)]);
  } finally { await app.close(); }
  expect(app.server.listening).toBe(false);
});

test('AV03 center verifier assignment traverses production route, locks, source checks and strict ACK', async () => {
  const { randomUUID, createHash } = await import('node:crypto');
  const { decodeVerifierRunnerClaimResponse } = await import('../../../packages/contracts/src/verifier-runner-claim.js');
  const f = new ClaimFixture(), app = Fastify(), original = f.query.bind(f);
  const source = { taskId: randomUUID(), attemptId: randomUUID(), artifactId: 'source', version: createHash('sha256').update('{"id":1}').digest('hex'), content: '{"id":1}' };
  const rule = { schemaVersion: 1 as const, algorithmId: 'flow.json-object.required-keys' as const, algorithmVersion: 1 as const, requiredKeys: ['id'] };
  f.task.submission.prompt = JSON.stringify({ source, rule }); f.binding.inputDigest = createHash('sha256').update(f.task.submission.prompt).digest('hex');
  const input = { protocol: 'flow.runner-claim.v4' as const, runnerId: f.runnerId, requestId: randomUUID(),
    pluginVerifierExecution: { bindingProtocol: 'flow.plugin-verification.v1' as const, storeId: 'owned-store', hostApiMajor: 1 as const,
      algorithms: [{ id: 'flow.json-object.required-keys' as const, version: 1 as const }] } };
  let permission = true;
  f.query = async (sql, values = []) => {
    if (sql.startsWith('SELECT kind FROM flow.plugin_binding_executions')) return { rows: [{ kind: 'verifier' }], rowCount: 1 };
    if (sql.startsWith('SELECT source_task_id,source_attempt_id,artifact_id,artifact_version,project_id,rule')) return { rows: [{ source_task_id: source.taskId, source_attempt_id: source.attemptId,
      artifact_id: source.artifactId, artifact_version: source.version, project_id: 'project', rule }], rowCount: 1 };
    if (sql.includes('FROM flow.project_task_bindings')) return { rows: [{ project_id: 'project', workspace_id: 'personal' }], rowCount: 1 };
    if (sql.startsWith('SELECT d.content FROM flow.artifacts')) return { rows: [{ content: source.content }], rowCount: 1 };
    if (sql.includes('FROM flow.plugin_revisions r JOIN flow.plugin_versions')) {
      const result = await original(sql, values); return { ...result, rows: result.rows.map(row => ({ ...(row as object), grants: permission ? ['verifier'] : [] })) };
    }
    // This is a SQL boundary fake, not PostgreSQL eligibility evidence.
    if (sql.includes('SELECT t.id FROM flow.tasks t')) return { rows: [{ id: f.task.id }], rowCount: 1 };
    return original(sql, values);
  };
  app.decorateRequest('runnerId', f.runnerId);
  app.setErrorHandler((error, _request, reply) => reply.code(error instanceof HttpError ? error.status : 500).send({ code: error instanceof HttpError ? error.code : 'internal' }));
  registerRunnerClaimRoutes(app, f.pool, 5000);
  try {
    const response = await app.inject({ method: 'POST', url: '/api/runner/claim-opportunity', payload: input });
    expect(response.statusCode).toBe(200);
    expect(decodeVerifierRunnerClaimResponse(response.json(), input, 'claim')).toMatchObject({ state: 'assigned', assignment: {
      pluginVerifierBinding: { executionKind: 'verifier', bindingId: f.binding.bindingId, verification: { projectId: 'project', rule } } } });
    f.binding.scope.projectId = 'foreign';
    const foreign = await app.inject({ method: 'POST', url: '/api/runner/claim-opportunity/status', payload: input });
    expect(foreign.json()).toMatchObject({ state: 'unavailable', identity: response.json().identity });
    f.binding.scope.projectId = null;
    permission = false;
    const denied = await app.inject({ method: 'POST', url: '/api/runner/claim-opportunity/status', payload: input });
    expect(denied.json()).toMatchObject({ state: 'unavailable', identity: response.json().identity }); expect(f.receipts).toHaveLength(1);
  } finally { await app.close(); }
  expect(app.server.listening).toBe(false);
});

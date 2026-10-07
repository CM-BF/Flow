import Fastify from 'fastify';
import { expect, test } from 'vitest';
import { registerRunnerClaimRoutes } from './runner-claim-routes.js';
import { ClaimFixture } from '../../../docs/evidence/x01/center-claim-fixture.js';
import { HttpError } from './database.js';

test('the production claim routes decode v3 and return an allocated binding through the real transaction path', async () => {
  const f=new ClaimFixture(), app=Fastify(); app.decorateRequest('runnerId',f.runnerId);
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

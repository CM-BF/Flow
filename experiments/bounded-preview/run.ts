import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { startFixture, digest } from './fixture.js';

const startedAt = new Date().toISOString();
const deadline = performance.now() + 90_000;
const result: any = { startedAt, sourceCommit: execFileSync('git', ['rev-parse','HEAD'], { encoding:'utf8' }).trim(), productBase: 'e802854f346a81749efdef3f36737b16141b98ef', node: process.version,
  method: { databaseBytes: 'UTF8 JSON serialization of decoded pg result.rows; NOT PostgreSQL wire', httpBytes: 'UTF8 response body, headers excluded', timing: 'Instrumented shared host, first-after-seed not cold cache, subsequent n20 p99=max; no CPU/SLO/speedup claim', hashes: 'Node SHA256 inputs observed separately; PG full-body hash remains present in each bounded detail SELECT' }, workloads: [], exitCode: 1 };
const baseline = JSON.parse(await readFile('docs/evidence/b03/baseline-reference.json','utf8'));
let fixture: Awaited<ReturnType<typeof startFixture>> | undefined;
const percentile = (values: number[], fraction: number) => [...values].sort((a,b)=>a-b)[Math.ceil(values.length*fraction)-1]!;
try {
  fixture = await startFixture('after');
  result.databaseName=fixture.databaseName; result.port=fixture.port;
  for (const contentBytes of [256,131072]) for (const turns of [1,20,50]) {
    const content = '中🙂ab'.repeat(Math.floor(contentBytes/9))+'x'.repeat(contentBytes%9);
    assert.equal(Buffer.byteLength(content),contentBytes);
    const fixtures = await fixture.seed(Array.from({length:turns},()=>content)); const samples: any[]=[];
    for (let index=0;index<21;index+=1) {
      if (performance.now()>deadline) throw new Error('B03 work deadline exceeded');
      const response = await fixture.http('/api/conversations/'+fixtures[0]!.conversationId+'/turns?limit='+turns,undefined,true);
      assert.equal(response.status,200); assert.equal(response.body.turns.length,turns);
      const expectedPreview=content.slice(0,4000).replace(/[\uD800-\uDBFF]$/,'');
      for(const turn of response.body.turns) {
        assert.equal(turn.assistant.state,'available'); assert.equal(turn.assistant.text,expectedPreview);
        assert.equal(turn.assistant.truncated,expectedPreview.length<content.length); assert.equal(turn.assistant.source.contentDigest,digest(content));
      }
      const work=response.work!;const selects=Object.entries(work.sql).filter(([name])=>name.startsWith('select:'));
      const selectCount=selects.reduce((sum,[,q])=>sum+q.count,0);
      const pgFullBodyDigestChecks=selects.filter(([name])=>name.includes("sha256(convert_to(content,'UTF8'))")).reduce((sum,[,q])=>sum+q.count,0);
      const bodyHashes=work.hashes.filter(hash=>hash.inputBytes===contentBytes);
      assert.equal(selectCount,2+5*turns); assert.equal(pgFullBodyDigestChecks,turns); assert.equal(bodyHashes.length,0);
      samples.push({phase:index?'subsequent':'first-after-seed',elapsedMs:response.elapsedMs,httpUtf8Bytes:response.httpUtf8Bytes,selectCount,
        transactionCount:Object.entries(work.sql).filter(([name])=>name.startsWith('transaction:')).reduce((sum,[,q])=>sum+q.count,0),
        decodedSelectRowsJsonUtf8Bytes:selects.reduce((sum,[,q])=>sum+q.decodedRowsJsonUtf8Bytes,0),pgFullBodyDigestChecks,bodyHashCount:bodyHashes.length,bodyHashInputBytes:0,...work});
    }
    const subsequent=samples.slice(1);const fields=['selectCount','transactionCount','decodedSelectRowsJsonUtf8Bytes','httpUtf8Bytes','pgFullBodyDigestChecks','bodyHashCount','bodyHashInputBytes'];
    for(const field of fields)assert.equal(new Set(samples.map(sample=>sample[field])).size,1,field+' consistency');
    const before=baseline.workloads.find((w:any)=>w.turns===turns&&w.contentUtf8Bytes===contentBytes);
    assert.equal(subsequent[0].httpUtf8Bytes,before.summary.httpUtf8Bytes,'HTTP output size is unchanged at fixed fixture shape');
    result.workloads.push({turns,contentUtf8Bytes:contentBytes,persistedBodyUtf8Bytes:turns*contentBytes,samples,summary:{n:20,firstMs:samples[0].elapsedMs,
      p50Ms:percentile(subsequent.map(s=>s.elapsedMs),.5),p95Ms:percentile(subsequent.map(s=>s.elapsedMs),.95),p99Ms:percentile(subsequent.map(s=>s.elapsedMs),.99),...Object.fromEntries(fields.map(f=>[f,subsequent[0][f]]))},baselineSummary:before.summary});
  }
  result.exitCode=0;
} catch(error) {result.error=error instanceof Error?{name:error.name,message:error.message,stack:error.stack?.split('\n').slice(0,7)}:{message:String(error)};}
finally {
  try {await fixture?.close();result.cleanup=fixture?JSON.parse(await readFile('docs/evidence/b03/after-cleanup.json','utf8')):null;}
  catch(error){result.exitCode=1;result.cleanupError=error instanceof Error?error.message:String(error);}
  result.endedAt=new Date().toISOString();
  await writeFile('docs/evidence/b03/after.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({startedAt:result.startedAt,endedAt:result.endedAt,exitCode:result.exitCode,workloads:result.workloads.map((w:any)=>({turns:w.turns,contentUtf8Bytes:w.contentUtf8Bytes,...w.summary})),cleanup:result.cleanup,error:result.error}));process.exitCode=result.exitCode;
}

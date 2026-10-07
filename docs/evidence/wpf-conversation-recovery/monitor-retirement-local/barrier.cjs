const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),path=require('node:path');
const ts=require(process.argv[2]),source=fs.readFileSync(process.argv[3],'utf8'),old=fs.readFileSync(process.argv[4],'utf8');
const hash=x=>createHash('sha256').update(x).digest('hex');
const results=[];
function astOf(s){return ts.createSourceFile('browser.ts',s,ts.ScriptTarget.ES2023,true,ts.ScriptKind.TS);}
function variable(body,name,a){const n=body.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(a)===name));assert.ok(n,name);return n.getText(a);}
function monitorHarness(s){
 const a=astOf(s),supervisor=a.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='supervisor');
 const block=supervisor.body,tryNode=block.statements.find(n=>ts.isTryStatement(n)&&n.finallyBlock);
 const actualTimer=tryNode.tryBlock.statements.find(n=>n.getText(a).startsWith('monitor = setInterval'));
 const prefix=[];for(const n of tryNode.finallyBlock.statements){if(n.getText(a).startsWith('signalGroups('))break;prefix.push(n.getText(a));}
 assert.ok(prefix.at(-1).startsWith('await monitoring'));assert.ok(actualTimer);
 const requireCode=a.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='requireThat').getText(a);
 let resolve,reject;const barrier=new Promise((r,j)=>{resolve=r;reject=j});let now=100,samples=0,signals=0,captured;
 const options={free:1e12,evidence:100,scratch:100},worker={exitCode:null,signalCode:null};
 const actualLoop=tryNode.tryBlock.statements.find(n=>ts.isWhileStatement(n)).getText(a);
 const context=vm.createContext({worker,sleep:async()=>{worker.exitCode=0;now=45000},performance:{now:()=>now},clearInterval:()=>{},setInterval:cb=>(captured=cb,1),freeBytes:()=>barrier,
  treeBytes:async p=>{samples++;return options[p];},text:e=>e.message||String(e),signalGroups:()=>{signals++;}});
 const code=`${requireCode}\nlet stopped=false,monitorRetiring=false,interruptionRequested=false,stopReason,monitor,monitoring;
 const errors=[],hardAt=60000,CLEANUP_MS=15000,STOP_FREE=100,EVIDENCE_BYTES=1000000,evidence='evidence',scratch='scratch',gate={maxScratchBytes:1000};
 let minimumFreeBytes=Infinity,peakScratchBytes=0;
 ${['stop','interrupted','working','checkpoint'].map(n=>variable(block,n,a)).join('\n')}
 ${actualTimer.getText(a)}
 globalThis.api={finishWait:async()=>{${actualLoop}},monitor:()=>{globalThis.timer();return monitoring},direct:()=>{monitoring=checkpoint().catch(()=>{});return monitoring},
 retire:async()=>{${prefix.join('\n')}},interrupt:interrupted,state:()=>({stopped,monitorRetiring,interruptionRequested,stopReason,errors:[...errors],minimumFreeBytes,peakScratchBytes})};`;
 vm.runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.None}}).outputText,context,{timeout:1000});context.timer=captured;
 return{api:context.api,options,release:()=>resolve(options.free),reject,now:x=>{now=x},counts:()=>({samples,signals}),sourceHash:hash(s)};
}
async function check(name,callback){await callback();results.push(name);}
(async()=>{
 await check('old negative: actual timer/finally barrier records false deadline',async()=>{const h=monitorHarness(old),p=h.api.monitor(),r=h.api.retire();h.release();await p;await r;assert.equal(h.api.state().stopReason,'Work deadline reached; cleanup reserve started');});
 await check('new positive: same barrier retires only timer work guard',async()=>{const h=monitorHarness(source),p=h.api.monitor(),r=h.api.retire();h.release();await p;await r;assert.equal(h.api.state().stopReason,undefined);assert.equal(h.counts().samples,2);assert.equal(h.api.state().peakScratchBytes,100);});
 await check('direct work checkpoint cannot borrow timer retirement',async()=>{const h=monitorHarness(source),p=h.api.direct(),r=h.api.retire();h.release();await p;await r;assert.match(h.api.state().stopReason,/deadline/);});
 await check('active timer trailing real deadline stays failed',async()=>{const h=monitorHarness(source),p=h.api.monitor();h.now(45000);h.release();await p;assert.match(h.api.state().stopReason,/deadline/);});
 await check('active timer leading real deadline stays failed',async()=>{const h=monitorHarness(source);h.now(45000);await h.api.monitor();assert.match(h.api.state().stopReason,/deadline/);});
 for(const [name,mutate,match] of [['free',h=>h.options.free=100,/Free space/],['evidence',h=>h.options.evidence=1000000,/Evidence limit/],['scratch',h=>h.options.scratch=1001,/Scratch limit/]]){
  await check(`retired timer still fails ${name} resource limit`,async()=>{const h=monitorHarness(source),p=h.api.monitor(),r=h.api.retire();mutate(h);h.release();await p;await r;assert.match(h.api.state().stopReason,match);});
 }
 await check('retired timer still fails awaited filesystem error',async()=>{const h=monitorHarness(source),p=h.api.monitor(),r=h.api.retire();h.reject(Error('EACCES controlled'));await p;await r;assert.equal(h.api.state().stopReason,'EACCES controlled');});
 await check('late interrupt during retirement stays failed without repeated signals',async()=>{const h=monitorHarness(source),p=h.api.monitor(),r=h.api.retire();h.api.interrupt();h.api.interrupt();h.release();await p;await r;assert.equal(h.api.state().stopReason,'Supervisor interrupted');assert.equal(h.api.state().interruptionRequested,true);assert.equal(h.counts().signals,0);});
 const a=astOf(source),body=a.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='supervisor').body;
 const workTry=body.statements.find(n=>ts.isTryStatement(n)&&n.finallyBlock),loop=workTry.tryBlock.statements.find(n=>ts.isWhileStatement(n));
 await check('actual worker exit at await still fails the final real work deadline before retirement',async()=>{const h=monitorHarness(source);await assert.rejects(()=>h.api.finishWait(),/deadline/);assert.equal(h.api.state().monitorRetiring,false);});
 const helpers=a.statements.filter(n=>ts.isFunctionDeclaration(n)&&['requireThat','priorAttemptCharge'].includes(n.name?.text));assert.equal(helpers.length,2);
 const lines=body.statements.map(n=>n.getText(a)),start=lines.findIndex(x=>x.startsWith('const reconciliations')),end=lines.findIndex(x=>x.startsWith('requireThat(remainingReconciliations.size'));
 assert.ok(start>=0&&end>start);
 const ctx=vm.createContext({digest:hash,readFile:async p=>files[p],readdir:async()=>runNames,join:path.join});
 vm.runInContext(ts.transpileModule(helpers.map(n=>n.getText(a)).join('\n')+`\nglobalThis.api={priorAttemptCharge,scan:async(gate)=>{const evidence='/evidence',runs='/runs';${lines.slice(start,end+1).join('\n')}return priorMs}};`,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.None}}).outputText,ctx,{timeout:1000});
 const run='recturn-20261007-070121-4aa406',base=path.dirname(path.dirname(path.dirname(process.argv[3])))+'/../docs/evidence/wpf-conversation-recovery';
 const evidence=path.resolve(process.argv[5]),budget=fs.readFileSync(path.join(evidence,'browser-runs',run,'budget.json'),'utf8'),review=fs.readFileSync(path.join(evidence,'continuous-fourth-root-review.json'),'utf8');
 const item={run,budgetSha256:hash(budget),reviewFile:'continuous-fourth-root-review.json',reviewSha256:hash(review)};
 const charge=ctx.api.priorAttemptCharge;
 await check('exact root accepted failed-run receipt charges 11109; old budget unchanged',async()=>{assert.equal(charge(run,budget,item,review),11109);assert.equal(JSON.parse(budget).complete,false);});
 for(const [name,modify] of [['no receipt',()=>[run,budget]],['wrong run',()=>['other',budget,item,review]],['budget mismatch',()=>[run,budget,{...item,budgetSha256:'0'.repeat(64)},review]],['review mismatch',()=>[run,budget,item,review+' ']],['cleanup unknown',()=>[run,JSON.stringify({...JSON.parse(budget),cleanupComplete:false}),item,review]]]){
  await check(`reconciliation rejects ${name}`,async()=>assert.throws(()=>charge(...modify())));
 }
 for(const [name,modify] of [['decision',r=>r.decision='PASS'],['unknown groups',r=>r.cleanup.freshOwnedProcessObservations[0].group='EPERM'],['remaining DB',r=>r.cleanup.database.remaining=['owned']],['scratch remains',r=>r.cleanup.scratchAbsent=false],['EOF missing',r=>r.actual.stdoutEof=false],['undercharge',r=>r.accounting.chargeMs=10489],['not failure',r=>r.actual.exitCode=0],['fixture cleanup error',r=>r.cleanup.fixture.errors=['unclosed']],['empty group observations',r=>r.cleanup.freshOwnedProcessObservations=[]]]){
  await check(`reconciliation rejects hash-bound ${name}`,async()=>{const value=JSON.parse(review);modify(value);const raw=JSON.stringify(value);assert.throws(()=>charge(run,budget,{...item,reviewSha256:hash(raw)},raw));});
 }
 let files={['/runs/'+run+'/budget.json']:budget,['/evidence/'+item.reviewFile]:review},runNames=[run];
 await check('actual preflight scanner consumes exact reconciliation',async()=>assert.equal(await ctx.api.scan({reconciledFailures:[item]}),11109));
 for(const [name,items] of [['duplicate',[item,item]],['unsafe path',[{...item,reviewFile:'../external.json'}]],['unknown run',[{...item,run:'unknown'}]],['missing',[]]]){
  await check(`actual scanner rejects ${name}`,async()=>await assert.rejects(()=>ctx.api.scan({reconciledFailures:items})));
 }
 await check('settled attempts retain original accounting and reject reconciliation',async()=>{const raw=JSON.stringify({complete:true,cleanupComplete:true,elapsedMs:123.5});assert.equal(charge('ok',raw),123.5);assert.throws(()=>charge('ok',raw,item,review));});
 console.log(JSON.stringify({state:'PASS',checks:results.length,results,oldSourceSha256:hash(old),newSourceSha256:hash(source),scope:'Actual AST-extracted parent closures/timer/retirement and preflight scanner; controlled filesystem barrier and immutable accepted failure originals. No PG, Chrome, HTTP, subprocess, product imports or runtime retry.'},null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1});

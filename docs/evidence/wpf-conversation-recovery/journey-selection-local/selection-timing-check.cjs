const fs = require('node:fs'); const vm = require('node:vm'); const assert = require('node:assert/strict');
const ts = require(process.argv[2]); const source = fs.readFileSync(process.argv[3], 'utf8');
const ast=ts.createSourceFile('browser.ts',source,ts.ScriptTarget.ES2023,true,ts.ScriptKind.TS);
const names=new Set(['requireThat','selectedGroups','selectionPassed']);
const picked=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.has(n.name?.text)||ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='journeyGroups'));
assert.equal(picked.length,4);
const code=ts.transpileModule(picked.map(n=>n.getText(ast)).join('\n')+'\nglobalThis.probe={selectedGroups,selectionPassed};',{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.None}}).outputText;
const context=vm.createContext({}); vm.runInContext(code,context,{timeout:1000}); const {selectedGroups,selectionPassed}=context.probe;
const expected={full:['cookieRead','textIntentDraft','crossTabCas','sameKeyTurn','pageOnlyAuthLoss','csrfOffline','themes390'],'recovery-chain':['cookieRead','textIntentDraft','crossTabCas','sameKeyTurn'],'page-auth':['cookieRead','pageOnlyAuthLoss'],'csrf-offline':['cookieRead','csrfOffline'],appearance:['cookieRead','themes390']};
let assertions=1;
for(const invalid of [undefined,null,'', 'missing','constructor','toString',[],{},0]){assert.throws(()=>selectedGroups(invalid));assertions++;}
for(const [journey,required] of Object.entries(expected)){
 assert.deepEqual(Array.from(selectedGroups(journey)),required);assertions++;
 const make=()=>({journey,requiredGroups:[...required],completedGroups:[...required],checks:required.map(x=>'actual '+x),failure:null,pageErrors:[],cleanupErrors:[],coverage:Object.fromEntries(expected.full.map(x=>[x,required.includes(x)?'PASSED':'NOT_SELECTED']))});
 assert.equal(selectionPassed(journey,make()),true);assertions++;
 for(const change of [r=>r.journey='wrong',r=>r.requiredGroups=[],r=>r.requiredGroups.pop(),r=>r.completedGroups=[],r=>r.completedGroups.pop(),r=>r.completedGroups.reverse(),r=>r.completedGroups.push(required[0]),r=>r.checks=[],r=>r.coverage[required[1]]='NOT_RUN',r=>r.coverage[required[1]]='FAILED',r=>r.coverage[required[1]]='NOT_SELECTED',r=>r.failure='setup failed',r=>delete r.failure,r=>r.pageErrors=['unexpected'],r=>r.cleanupErrors=['cleanup failed'],r=>r.pageErrors=undefined,r=>r.coverage=undefined]){
  const result=make();change(result);assert.equal(selectionPassed(journey,result),false);assertions++;
 }
 assert.equal(selectionPassed(journey,undefined),false);assertions++;
}
const runKeys=[];function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='run'&&n.arguments.length===3&&ts.isStringLiteral(n.arguments[1]))runKeys.push(n.arguments[1].text);ts.forEachChild(n,visit);}visit(ast);
assert.deepEqual(runKeys,expected.full);assertions++;

(async()=>{
 let declaration;
 function find(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='run')declaration=n;ts.forEachChild(n,find);}find(ast);
 assert.ok(declaration);assertions++;
 let clock=0;context.performance={now:()=>++clock};
 const prelude="const workerBegan=0;const requiredGroups=['cookieRead','pageOnlyAuthLoss'];const completedGroups=[],checks=[],groupTimings=[];const coverage={};const checkpoint=async()=>{};";
 const runCode=ts.transpileModule(prelude+'const '+declaration.getText(ast)+';globalThis.runProbe={run,completedGroups,checks,groupTimings,coverage};',{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.None}}).outputText;
 vm.runInContext(runCode,context,{timeout:1000});const r=context.runProbe;
 await r.run('cookie','cookieRead',async()=>{});assert.deepEqual(JSON.parse(JSON.stringify(r.groupTimings)),[{group:'cookieRead',startedOffsetMs:1,endedOffsetMs:2,elapsedMs:1,outcome:'PASSED'}]);assertions++;
 await assert.rejects(r.run('auth','pageOnlyAuthLoss',async()=>{throw Error('setup failed');}),/setup failed/);assertions++;
 assert.deepEqual(JSON.parse(JSON.stringify(r.groupTimings[1])),{group:'pageOnlyAuthLoss',startedOffsetMs:3,endedOffsetMs:4,elapsedMs:1,outcome:'FAILED'});assertions++;
 let called=false;await r.run('unselected','textIntentDraft',async()=>{called=true});assert.equal(called,false);assert.equal(r.groupTimings.length,2);assertions+=2;
 assert.deepEqual(Array.from(r.completedGroups),['cookieRead']);assert.equal(r.coverage.pageOnlyAuthLoss,'FAILED');assertions+=2;
 console.log(JSON.stringify({state:'PASS',assertions,journeys:Object.keys(expected),fullGroupOrder:runKeys,groupTimingPort:'success/failure/unselected exact captured run callback',clock:'deterministic monotonic stub for port behavior, not browser measurement',scope:'actual extracted selection/run functions; no worker/browser/IDB startup'}));
})().catch(error=>{console.error(error);process.exitCode=1;});

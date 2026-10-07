const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const ts=require(process.argv[2]); const source=fs.readFileSync(process.argv[3],'utf8');
const ast=ts.createSourceFile('browser.ts',source,ts.ScriptTarget.ES2023,true,ts.ScriptKind.TS);
const names=new Set(['requireThat','selectedGroups','selectionPassed']);
const selected=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.has(n.name?.text)||ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='journeyGroups'));
assert.equal(selected.length,4);
const code=ts.transpileModule(selected.map(n=>n.getText(ast)).join('\n')+'\nglobalThis.probe={selectedGroups,selectionPassed};',{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.None}}).outputText;
const context=vm.createContext({});vm.runInContext(code,context,{timeout:1000});const {selectedGroups,selectionPassed}=context.probe;
const expected={'create-ack-loss':['cookieRead','createAckLoss'],'created-turn-ack-loss':['cookieRead','createdTurnAckLoss'],'queue-ack-loss':['cookieRead','queueAckLoss']};
let assertions=1;
for(const [journey,required] of Object.entries(expected)){
 assert.deepEqual(Array.from(selectedGroups(journey)),required);assertions++;
 const make=()=>({journey,requiredGroups:[...required],completedGroups:[...required],checks:required.map(x=>'actual '+x),failure:null,pageErrors:[],cleanupErrors:[],coverage:Object.fromEntries(required.map(x=>[x,'PASSED']))});
 assert.equal(selectionPassed(journey,make()),true);assertions++;
 for(const mutate of [r=>{r.requiredGroups=['cookieRead'];r.completedGroups=['cookieRead'];r.checks=['only login']},r=>r.completedGroups=[],r=>r.completedGroups.pop(),r=>r.coverage[required[1]]='NOT_SELECTED',r=>r.failure='public UI setup failed',r=>r.journey='full',r=>r.completedGroups.reverse()]){
  const r=make();mutate(r);assert.equal(selectionPassed(journey,r),false);assertions++;
 }
 assert.equal(selectionPassed('full',make()),false);assertions++;
}
assert.deepEqual(Array.from(selectedGroups('full')),['cookieRead','textIntentDraft','crossTabCas','sameKeyTurn','pageOnlyAuthLoss','csrfOffline','themes390']);assertions++;
assert.deepEqual(Array.from(selectedGroups('connection-choice')),['cookieRead','connectionChoice']);assertions++;
console.log(JSON.stringify({state:'PASS',assertions,selected:Object.keys(expected),scope:'new selections reject empty/partial/foreign/setup-failed results; old mapping unchanged; no worker, HTTP, PG, Chrome or product imports executed'}));

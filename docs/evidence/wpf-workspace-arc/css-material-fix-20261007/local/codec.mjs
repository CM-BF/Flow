import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {claudeMessageSettingsCatalogPageSchema} from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-composition/packages/contracts/src/execution-profiles.ts';
const base='/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-composition';
const require=createRequire(import.meta.url),ts=require(base+'/node_modules/typescript/lib/typescript.js');
const fixture=base+'/apps/web/test/workspace-layout.fixture.ts';
function extract(text){
 const ast=ts.createSourceFile('fixture.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);assert.equal(ast.parseDiagnostics.length,0);
 const declarations=new Map();let payload;
 function visit(node){
  if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&['hash','id','choices','configuration','profile'].includes(node.name.text)){assert.ok(!declarations.has(node.name.text));declarations.set(node.name.text,node.initializer.getText(ast));}
  if(ts.isIfStatement(node)&&node.expression.getText(ast)==='url.pathname === "/api/execution-profiles"'){
   const calls=[];function find(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='json')calls.push(n);ts.forEachChild(n,find);}find(node.thenStatement);assert.equal(calls.length,1);payload=calls[0].arguments[1].getText(ast);
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);assert.equal(declarations.size,5);assert.ok(payload);
 const body='const at="2026-10-07T23:59:00.000Z";\n'+['hash','id','choices','configuration','profile'].map(name=>'const '+name+'='+declarations.get(name)+';').join('\n')+'\nreturn '+payload+';';
 const js=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None},reportDiagnostics:true});assert.equal(js.diagnostics.length,0);
 return new Function('createHash',js.outputText)(createHash);
}
const oldText=readFileSync(new URL('./before.fixture.ts',import.meta.url),'utf8');const newText=readFileSync(fixture,'utf8');
const oldDto=extract(oldText),newDto=extract(newText),oldResult=claudeMessageSettingsCatalogPageSchema.safeParse(oldDto),newResult=claudeMessageSettingsCatalogPageSchema.safeParse(newDto);
assert.equal(oldDto.profiles[0].profile.model.displayName,'Arc fixture profile');assert.equal(oldResult.success,false);
assert.ok(oldResult.error.issues.some(issue=>JSON.stringify(issue.path)==='["profiles",0,"profile","model","displayName"]'));
assert.equal(newResult.success,true,JSON.stringify(newResult.error?.issues));assert.equal(newResult.data.profiles[0].profile.model.displayName,'arc-A');
assert.deepEqual(newResult.data.profiles[0].profile.configuration.turnSettings.choices.map(choice=>choice.model),['arc-A','arc-B','arc-C']);
assert.deepEqual(newDto.profiles[0].profile.reference,oldDto.profiles[0].profile.reference);
const result={method:'AST extracts actual fixture declarations and exact JSON response expression; original public claudeMessageSettingsCatalogPageSchema as used by FlowClient, not a mirrored schema. No fixture import/HTTP/browser.',passed:2,failed:0,cases:[{name:'Original exact DTO rejected at model.displayName',state:'PASS',issues:oldResult.error.issues.map(({code,path})=>({code,path}))},{name:'Fixed exact DTO accepted, original profile identity/configuration and three choices preserved',state:'PASS'}],sourcePins:[fixture,base+'/packages/contracts/src/execution-profiles.ts',base+'/packages/contracts/src/claude-turn-settings.ts'].map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})),oldFixtureSha256:createHash('sha256').update(oldText).digest('hex')};
writeFileSync(new URL('./pure-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));

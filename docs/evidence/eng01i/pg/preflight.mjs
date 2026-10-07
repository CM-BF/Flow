import ts from 'typescript';
import { readFileSync,existsSync,realpathSync,lstatSync,writeFileSync } from 'node:fs';
import { resolve,dirname,relative,extname,join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
const entries=['apps/runner/src/engineering/native-adapter.test.ts','docs/evidence/eng01i/pg/fixture.ts'];
const seen=new Set(),files=[],missing=[],external=new Map(),dynamic=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
function add(path){if(seen.has(path))return;seen.add(path);if(!existsSync(path)){missing.push(relative(root,path));return;}const b=readFileSync(path);files.push({path:relative(root,path),bytes:b.length,sha256:hash(b)});if(!/\.[mc]?[jt]sx?$/.test(path))return;
 const ast=ts.createSourceFile(path,b.toString(),ts.ScriptTarget.Latest,true);const specs=new Set();
 function visit(n){if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier))specs.add(n.moduleSpecifier.text);
 if(ts.isCallExpression(n)&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0])&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==='require'))specs.add(n.arguments[0].text);
 if(ts.isNewExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='URL'&&n.arguments?.[0]&&ts.isStringLiteral(n.arguments[0])&&n.arguments[0].text.startsWith('.')){const f=resolve(dirname(path),n.arguments[0].text);if(!/\.sql$/.test(f))dynamic.push({from:relative(root,path),value:n.arguments[0].text});else add(f);}
 ts.forEachChild(n,visit); }visit(ast);
 for(const spec of specs){if(spec.startsWith('node:'))continue;if(spec.startsWith('.')){const p=resolve(dirname(path),spec),choices=[p,p.replace(/\.js$/,'.ts'),p.replace(/\.js$/,'.tsx'),join(p,'index.ts')];const found=choices.find(existsSync);if(found)add(found);else missing.push({from:relative(root,path),import:spec});}
 else if(spec.startsWith('@flow/')){const name=spec.split('/')[1],base=join(root,'packages',name),manifest=join(base,'package.json');add(manifest);const pkg=JSON.parse(readFileSync(manifest));const suffix=spec.split('/').slice(2).join('/');let dest=typeof pkg.exports==='string'?pkg.exports:pkg.exports?.[suffix?'./'+suffix:'.'];if(typeof dest==='object')dest=dest.import??dest.default; if(typeof dest==='string')add(resolve(base,dest));else missing.push({from:relative(root,path),workspace:spec});}
 else external.set(spec,{specifier:spec,from:relative(root,path)});}}
entries.forEach(p=>add(join(root,p)));
// Fixed literal migration arrays in the two actual factory consumers.
for(const p of ['012-goal-tool-runs.sql','013-goal-native-mode.sql','017-goal-graph-runs.sql','019-goal-graph-native-mode.sql'])add(join(root,'packages/storage/migrations',p));
const packages=[];
for(const e of external.values()){try{const req=createRequire(join(root,e.from)),entry=req.resolve(e.specifier),actual=realpathSync(entry);let dir=dirname(actual);while(!existsSync(join(dir,'package.json'))&&dirname(dir)!==dir)dir=dirname(dir);const manifest=join(dir,'package.json'),b=readFileSync(manifest),p=JSON.parse(b);packages.push({...e,entry:actual,entryBytes:readFileSync(actual).length,entrySha256:hash(readFileSync(actual)),name:p.name,version:p.version,packagePath:manifest,packageSha256:hash(b)});}catch{missing.push(e);}}
for(const p of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','apps/runner/package.json','apps/server/package.json'])add(join(root,p));
const result={at:new Date().toISOString(),entries,files:files.sort((a,b)=>a.path.localeCompare(b.path)),packages,missing,dynamic,limits:'Static closure only; URL SQL literals explicit; scheduler/runtime package dynamic SQL retained in installed package binding. No imports executed.'};
writeFileSync(new URL('./preflight.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({files:files.length,sql:files.filter(f=>f.path.endsWith('.sql')).length,packages:packages.length,missing,dynamic}));

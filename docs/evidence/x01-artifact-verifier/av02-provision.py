from pathlib import Path
import subprocess,re,json,hashlib,os
R=Path(__file__).resolve().parents[3]; E=R/'docs/evidence/x01-artifact-verifier'; ref='96b424777cd2c66e603157649e5a859ca1b914f6'
allfiles=set(subprocess.check_output(['git','ls-tree','-r','--name-only',ref],cwd=R,text=True).splitlines())
queue=['apps/runner/src/plugins/execution.test.ts','apps/runner/src/plugins/host.ts','packages/plugin-runtime/src/package-store.test.ts','packages/contracts/src/plugin-runtime.ts','packages/contracts/src/runner.ts','apps/runner/src/plugins/process-worker.ts']
owned=set(json.loads((E/'av02-amend-receipt.json').read_text())['claim']['scope']); seen={}; missing=[]
modules={'@flow/contracts':'packages/contracts/src/index.ts','@flow/plugin-runtime':'packages/plugin-runtime/src/package-store.ts','@flow/client':'packages/client/src/index.ts'}
while queue:
 p=queue.pop()
 if p in seen:continue
 b=subprocess.check_output(['git','show',ref+':'+p],cwd=R);seen[p]=b
 for imp in re.findall(r'''(?:from\s*|import\s*\(|import\s*)['"]([^'"]+)['"]''',b.decode()):
  q=modules.get(imp)
  if imp.startswith('.'):
   raw=os.path.normpath(str(Path(p).parent/imp));opts=[raw,re.sub(r'\.js$','.ts',raw),raw+'.ts',raw+'/index.ts'];q=next((x for x in opts if x in allfiles),None)
   if q is None:missing.append([p,imp])
  if q:queue.append(q)
for p in ['package.json','tsconfig.json','.gitignore','packages/contracts/package.json','packages/plugin-runtime/package.json','apps/runner/package.json','tools/owned-process-supervision/supervise.py']+[p for p in allfiles if p.startswith('packages/fixtures/plugins/text-tool/')]:
 seen[p]=subprocess.check_output(['git','show',ref+':'+p],cwd=R)
assert not missing,missing
assert sum(map(len,seen.values()))<8*1024*1024
sparse=Path(subprocess.check_output(['git','rev-parse','--git-path','info/sparse-checkout'],cwd=R,text=True).strip());old=sparse.read_text();extra=''.join('/'+p+'\n' for p in sorted(seen) if '/'+p+'\n' not in old);sparse.write_text(old+extra)
subprocess.run(['git','read-tree','-mu','HEAD'],cwd=R,check=True)
rows=[]
for p,b in seen.items():
 assert (R/p).read_bytes()==b,p
 rows.append({'path':p,'commit':ref,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'ownedProduct':p in owned})
(R/'node_modules').mkdir(exist_ok=True)
links=[]
for name in ['typescript','vitest','zod','tar','@types/node']:
 dest=R/'node_modules'/name;src=Path('/Users/citrine/Projects/AgentHarness/Flow/node_modules')/({'zod':'.pnpm/zod@4.6.5/node_modules/zod','tar':'.pnpm/tar@7.5.22/node_modules/tar'}.get(name,name));assert src.exists(),name;dest.parent.mkdir(exist_ok=True)
 if not dest.exists():dest.symlink_to(src.resolve())
 assert dest.resolve()==src.resolve();links.append({'path':str(dest.relative_to(R)),'realpath':str(dest.resolve())})
(E/'av02-source-closure.json').write_text(json.dumps({'ref':ref,'count':len(rows),'bytes':sum(x['bytes'] for x in rows),'missing':missing,'rows':rows,'links':links},indent=2)+'\n')
print(json.dumps({'files':len(rows),'bytes':sum(x['bytes'] for x in rows),'missing':missing,'links':len(links)}))

from pathlib import Path
import subprocess,re,json,hashlib,os
R=Path(__file__).resolve().parents[3];E=R/'docs/evidence/x01-artifact-verifier';base='96b424777cd2c66e603157649e5a859ca1b914f6';source='e746029f6';current=subprocess.check_output(['git','rev-parse',source],cwd=R,text=True).strip()
files=set(subprocess.check_output(['git','ls-tree','-r','--name-only',current],cwd=R,text=True).splitlines());owned=set(json.loads((E/'av03-amend-receipt.json').read_text())['claim']['scope']);q=['packages/contracts/src/verifier-runner-claim.test.ts','apps/runner/src/admission-verifier-claim.test.ts','apps/runner/src/admission-plugin-claim.test.ts'];seen={};missing=[];modules={'@flow/contracts':'packages/contracts/src/index.ts','@flow/client':'packages/client/src/index.ts','@flow/plugin-runtime':'packages/plugin-runtime/src/package-store.ts'}
while q:
 p=q.pop()
 if p in seen:continue
 ref=current if p in owned else base;b=subprocess.check_output(['git','show',ref+':'+p],cwd=R);seen[p]=(ref,b)
 for name in re.findall(r'''(?:from\s*|import\s*\(|import\s*)['"]([^'"]+)['"]''',b.decode()):
  dest=modules.get(name)
  if name.startswith('.'):
   raw=os.path.normpath(str(Path(p).parent/name));dest=next((x for x in [raw,re.sub(r'\.js$','.ts',raw),raw+'.ts',raw+'/index.ts'] if x in files),None)
   if dest is None:missing.append([p,name])
  if dest:q.append(dest)
assert not missing,missing
for p in ['package.json','tsconfig.json','apps/runner/package.json','packages/contracts/package.json','packages/client/package.json','tools/owned-process-supervision/supervise.py']:
 seen[p]=(base,subprocess.check_output(['git','show',base+':'+p],cwd=R))
assert sum(len(b) for _,b in seen.values())<=8388608
rows=[]
for p,(ref,b) in sorted(seen.items()):
 f=R/p
 if f.exists():assert f.read_bytes()==b,p
 else:f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(b)
 rows.append({'path':p,'commit':ref,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
(E/'av03-source-closure.json').write_text(json.dumps({'rows':rows,'count':len(rows),'bytes':sum(x['bytes'] for x in rows),'missing':missing,'links':json.loads((E/'av02-source-closure.json').read_text())['links']},indent=2)+'\n');print(json.dumps({'count':len(rows),'bytes':sum(x['bytes'] for x in rows),'missing':missing}))

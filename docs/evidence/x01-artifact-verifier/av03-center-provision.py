from pathlib import Path
import subprocess,re,json,hashlib,os
R=Path(__file__).resolve().parents[3];E=R/'docs/evidence/x01-artifact-verifier';B=E/'av03-center-inputs';base='337060abb836770902493acd02b29d472a34e298';source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip()
files=set(subprocess.check_output(['git','ls-tree','-r','--name-only',source],cwd=R,text=True).splitlines())|set(subprocess.check_output(['git','ls-tree','-r','--name-only',base],cwd=R,text=True).splitlines())
owned=set(json.loads((E/'av03-center-amend-receipt.json').read_text())['claim']['scope']); entries=['packages/contracts/src/verifier-runner-claim.test.ts','packages/client/src/plugin-runner.test.ts','apps/server/src/plugin-runtime/verification.test.ts','apps/server/src/runner-claim-routes.test.ts','apps/server/src/index.ts'];q=entries[:];seen={};missing=[];modules={'@flow/contracts':'packages/contracts/src/index.ts','@flow/client':'packages/client/src/index.ts','@flow/plugin-runtime':'packages/plugin-runtime/src/package-store.ts'}
while q:
 p=q.pop()
 if p in seen:continue
 ref=source if p in owned else base
 try:b=subprocess.check_output(['git','show',ref+':'+p],cwd=R,stderr=subprocess.DEVNULL)
 except subprocess.CalledProcessError:missing.append([p,ref]);continue
 seen[p]=(ref,b)
 for name in re.findall(r'''(?:from\s*|import\s*\(|import\s*)['"]([^'"]+)['"]''',b.decode()):
  dest=modules.get(name)
  if name.startswith('.'):
   raw=os.path.normpath(str(Path(p).parent/name));dest=next((x for x in [raw,re.sub(r'\.js$','.ts',raw),re.sub(r'\.js$','.d.ts',raw),raw+'.ts',raw+'/index.ts'] if x in files),None)
   if dest is None:missing.append([p,name])
  if dest:q.append(dest)
assert not missing,missing
for p in ['package.json','tsconfig.json','apps/server/package.json','apps/runner/package.json','packages/contracts/package.json','packages/client/package.json','packages/storage/migrations/036-plugin-verification-bindings.sql']:
 ref=source if p in owned else base;seen[p]=(ref,subprocess.check_output(['git','show',ref+':'+p],cwd=R))
assert sum(len(b) for _,b in seen.values())<=8388608
rows=[]
for p,(ref,b) in sorted(seen.items()):
 f=B/p
 if f.exists(): assert f.read_bytes()==b,p
 else:f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(b)
 rows.append({'path':p,'commit':ref,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
(E/'av03-center-closure.json').write_text(json.dumps({'source':source,'base':base,'mirror':str(B),'entries':entries,'rows':rows,'count':len(rows),'bytes':sum(x['bytes'] for x in rows),'missing':missing},indent=2)+'\n')
print(json.dumps({'count':len(rows),'bytes':sum(x['bytes'] for x in rows),'missing':missing}))

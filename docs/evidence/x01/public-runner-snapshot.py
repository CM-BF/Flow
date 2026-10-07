"""One fixed-source verification mirror, including the real server and runner closure. No module execution."""
from pathlib import Path
import subprocess, posixpath, re, json, hashlib
ROOT=Path(__file__).resolve().parents[3]
BASE='1e12eaf13a02b45a99dfe126bc182c2ea45a8390'
DEST=ROOT/'docs/evidence/x01/public-runner-inputs'
OWN={'apps/server/src/index.ts','apps/server/src/reconciliation.ts','apps/runner/src/runtime.ts','packages/client/src/index.ts','packages/client/src/plugin-runner.ts','apps/server/src/plugin-runtime/public-runner-pg.test.ts','docs/evidence/x01/enable-binding-pg-fixture.ts'}
allpaths=set(subprocess.check_output(['git','ls-tree','-r','--name-only',BASE],cwd=ROOT,text=True).splitlines())|OWN
aliases={'@flow/client':'packages/client/src/index.ts','@flow/contracts':'packages/contracts/src/index.ts','@flow/plugin-runtime':'packages/plugin-runtime/src/package-store.ts'}
pending=['apps/server/src/plugin-runtime/public-runner-pg.test.ts']; data={}; origins={}; external=set()
while pending:
 p=pending.pop()
 if p in data:continue
 b=(ROOT/p).read_bytes() if p in OWN else subprocess.check_output(['git','show',BASE+':'+p],cwd=ROOT)
 data[p]=b;origins[p]='current-own' if p in OWN else BASE
 for spec in re.findall(r'''(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]''',b.decode()):
  target=aliases.get(spec)
  if spec.startswith('.'):
   v=posixpath.normpath(posixpath.join(posixpath.dirname(p),spec));target=next((q for q in [v,re.sub(r'\.js$','.ts',v),v+'.ts',v+'/index.ts'] if q in allpaths),None)
   if target is None:raise ValueError((p,spec))
  if target:pending.append(target)
  elif not spec.startswith('node:'):external.add(spec)
extras=[p for p in allpaths if p.startswith('packages/storage/migrations/') and p.endswith('.sql')]
extras += ['docs/evidence/x01/enable-binding-pg-input.json']
extras += [p for p in allpaths if p.startswith('experiments/plugins/semver-compare/package/')]
for p in extras:
 b=(ROOT/p).read_bytes() if p.startswith('docs/evidence/x01/') else subprocess.check_output(['git','show',BASE+':'+p],cwd=ROOT)
 data[p]=b;origins[p]='fixed-existing-fixture' if p.startswith('docs/evidence/x01/') else BASE
rows=[]
for p,b in sorted(data.items()):
 out=DEST/p
 if out.exists() and out.read_bytes()!=b:raise ValueError('Existing mirror differs: '+p)
 out.parent.mkdir(parents=True,exist_ok=True)
 if not out.exists():out.write_bytes(b)
 rows.append({'path':p,'origin':origins[p],'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
assert sum(map(len,data.values()))<1700000
(ROOT/'docs/evidence/x01/public-runner-closure.json').write_text(json.dumps({'base':BASE,'sourceOnly':True,'files':rows,'count':len(rows),'bytes':sum(map(len,data.values())),'externalImports':sorted(external),'missing':[]},indent=2)+'\n')
print(json.dumps({'files':len(rows),'bytes':sum(map(len,data.values())),'external':sorted(external)}))

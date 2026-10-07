"""Fixed source-only direct import closure; no module execution or dependency copying."""
from pathlib import Path
import subprocess,re,posixpath,hashlib,json
ROOT=Path(__file__).resolve().parents[3]; BASE='b7687ff3b33d538e2b41e05ec849f670d9b9d8bb'; DEST=ROOT/'docs/evidence/x01/runtime-wiring-inputs'
changed={'packages/client/src/index.ts','apps/server/src/reconciliation.ts','apps/server/src/plugin-runtime/recovery.test.ts','apps/runner/src/runtime.ts','apps/runner/src/plugins/runtime.test.ts','packages/client/src/plugin-runner.ts','packages/client/src/plugin-runner.test.ts','apps/runner/src/plugins/execution.ts','packages/contracts/src/plugin-artifact.ts'}
packages={'@flow/client':'packages/client/src/index.ts','@flow/contracts':'packages/contracts/src/index.ts','@flow/plugin-runtime':'packages/plugin-runtime/src/package-store.ts'}
allpaths=set(subprocess.check_output(['git','ls-tree','-r','--name-only',BASE],cwd=ROOT,text=True).splitlines())|changed
pending=['apps/runner/src/plugins/runtime.test.ts','packages/client/src/plugin-runner.test.ts','apps/server/src/plugin-runtime/recovery.test.ts']; data={}; rows=[]
while pending:
 p=pending.pop()
 if p in data:continue
 b=(ROOT/p).read_bytes() if p in changed else subprocess.check_output(['git','show',BASE+':'+p],cwd=ROOT)
 origin='current-own' if p in changed else BASE
 if p=='packages/contracts/src/assistant-stream.ts':
  origin='2949569bcac7d3b0257a0026f488f42eb6276222'
  b=subprocess.check_output(['git','show',origin+':'+p],cwd=ROOT)
 if p=='packages/contracts/src/runner.ts':
  s=b.decode(); s="import { pluginArtifactSourceSchema } from './plugin-artifact.js';\n"+s
  needle="type: z.literal('artifact'), artifactId: idSchema, title, version: digest, content, mediaType: z.string().max(120)"
  assert s.count(needle)==1; b=s.replace(needle,needle+', pluginSource: pluginArtifactSourceSchema.optional()').encode(); origin=BASE+' + approved 685978 pluginSource two-line addition'
 data[p]=b
 for spec in re.findall(r'''(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]''',b.decode()):
  target=packages.get(spec)
  if spec.startswith('.'):
   v=posixpath.normpath(posixpath.join(posixpath.dirname(p),spec)); candidates=[v,re.sub(r'\.js$','.ts',v),v+'.ts',v+'/index.ts']
   target=next((q for q in candidates if q in allpaths),None)
   if target is None: raise ValueError((p,spec))
  if target:pending.append(target)
 rows.append({'path':p,'origin':origin,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
assert sum(map(len,data.values()))<750000
for p,b in data.items():
 out=DEST/p;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(b)
(ROOT/'docs/evidence/x01/runtime-wiring-input.json').write_text(json.dumps({'base':BASE,'sourceOnly':True,'count':len(data),'bytes':sum(map(len,data.values())),'rows':sorted(rows,key=lambda x:x['path'])},indent=2)+'\n')
print(json.dumps({'files':len(data),'bytes':sum(map(len,data.values()))}))

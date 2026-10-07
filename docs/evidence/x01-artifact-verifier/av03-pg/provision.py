from pathlib import Path
import subprocess,json,hashlib,re,os
R=Path(__file__).resolve().parents[4];D=Path(__file__).resolve().parent;B=D/'inputs';base='b79121e1944f10f82a416d98d776c0f55bf9c943';source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip();old=json.loads((D.parent/'av03-center-closure.json').read_text());seen={x['path']:(x['commit'],x['path']) for x in old['rows']};test='apps/server/src/plugin-runtime/verification-pg.test.ts';fixture='docs/evidence/x01-artifact-verifier/av03-pg/fixture.ts';seen[test]=(source,test);seen[fixture]=(source,fixture);seen['apps/server/src/pre036-index.ts']=(base,'apps/server/src/index.ts')
for p in subprocess.check_output(['git','ls-tree','-r','--name-only',base,'packages/storage/migrations'],cwd=R,text=True).splitlines():seen[p]=(base,p)
rows=[]
for p,(ref,origin) in sorted(seen.items()):
 b=subprocess.check_output(['git','show',ref+':'+origin],cwd=R);f=B/p;f.parent.mkdir(parents=True,exist_ok=True)
 if f.exists():assert f.read_bytes()==b,p
 else:f.write_bytes(b)
 rows.append({'path':str(f.relative_to(R)),'origin':origin,'commit':ref,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
assert sum(x['bytes'] for x in rows)<4194304
(D/'closure.json').write_text(json.dumps({'source':source,'base':base,'rows':rows,'count':len(rows),'bytes':sum(x['bytes'] for x in rows),'note':'One fixed pre036 factory byte copy; aliases resolve its relative dependencies in this same controlled input root. Static imports load before fixture.create; no dynamic import after CREATE.'},indent=2)+'\n')
config={'extends':'../../../../tsconfig.json','compilerOptions':{'noEmit':True,'baseUrl':'./inputs','paths':{'@flow/contracts':['packages/contracts/src/index.ts'],'@flow/client':['packages/client/src/index.ts'],'@flow/plugin-runtime':['packages/plugin-runtime/src/package-store.ts'],'@av03/pre036-server':['apps/server/src/pre036-index.ts']}},'include':[],'exclude':[],'files':['./inputs/'+test]};(D/'tsconfig.json').write_text(json.dumps(config,indent=2)+'\n')
print(json.dumps({'count':len(rows),'bytes':sum(x['bytes'] for x in rows)}))

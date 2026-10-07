"""Bounded AV03 center local caller; reuse fixed OPS14, one cumulative record, no service or PG."""
from pathlib import Path
import dataclasses,datetime,hashlib,importlib.util,json,os,sys,time,shutil
sys.dont_write_bytecode=True
R=Path(__file__).resolve().parents[4];E=R/'docs/evidence/x01-artifact-verifier/av03-pg'
B=E/'inputs'
name=sys.argv[1];assert name in ('types','types-fix','collect')
record=E/'local.json';state=json.loads(record.read_text()) if record.exists() else {'attempts':[]}
assert len(state['attempts'])<3
used=sum(x['supervision']['elapsed_ms'] for x in state['attempts']);rawused=sum(x['raw']['bytes'] for x in state['attempts']);assert used<60000 and rawused<524288
node='/opt/homebrew/opt/node@24/bin/node';files=['apps/server/src/plugin-runtime/verification-pg.test.ts']
cmd=([node,str(R/'node_modules/typescript/bin/tsc'),'--noEmit','-p',str(E/'tsconfig.json')] if name.startswith('types') else [node,str(R/'node_modules/vitest/vitest.mjs'),'list','--config',str(E/'vitest.config.mjs'),'--json'])
floor=int(os.environ['FLOW_AV03_FLOOR']);assert floor>=14950858752
free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize;assert free>=floor
out=E/('local-'+name);out.mkdir();tmp=out/'tmp';tmp.mkdir();ident=tmp.stat();now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z');start=now();clock=time.monotonic()
def save(path,value):
 with path.open('w') as f:json.dump(value,f,indent=2);f.write('\n')
save(out/'reservation.json',{'startedAt':start,'command':cmd,'floor':floor,'free':free,'tmp':{'path':str(tmp),'dev':ident.st_dev,'ino':ident.st_ino},'maxSeconds':30,'cumulativeMaxSeconds':60,'rawMaxBytes':524288,'tmpMaxBytes':4194304})
spec=importlib.util.spec_from_file_location('av03_ops14',R/'tools/owned-process-supervision/supervise.py');m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
env={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LANG':'en_US.UTF-8','LC_ALL':'en_US.UTF-8','TZ':'UTC','TMPDIR':str(tmp),'TMP':str(tmp),'TEMP':str(tmp),'NODE_DISABLE_COMPILE_CACHE':'1','NO_COLOR':'1','FORCE_COLOR':'0','PYTHONDONTWRITEBYTECODE':'1','FLOW_AV03_FIXTURES':str(tmp/'verifier-fixtures.json'),'FLOW_X01_PLUGIN_CLAIM_FACTS':str(tmp/'v3-fixtures.json')}
remaining=min(30,(60000-used)/1000);result=m.supervise(m.Launch(tuple(cmd),str(R),env,m.Ownership.NEW_CHILD_SESSION,m.Capture.MERGED),m.Policy(remaining-3,1,2,min(131072,524288-rawused)))
raw=result.stdout;(out/'output.log').write_bytes(raw);rep=dataclasses.asdict(result);rep.pop('stdout');rep.pop('stderr');code=None if result.first_failure is None else result.first_failure.get('code')
closed=result.exit_code is not None and result.owned_state=='absent' and result.eof=={'stdout':True} and result.observed_bytes==result.retained_bytes==len(raw) and not result.secondary_failures and code in (None,'CHILD_EXIT_NONZERO') and not any(s.get('state')=='unknown' for s in result.signals)
cleanup={'knownProcessClosed':closed,'removed':False,'retained':str(tmp)};n=0;b=0
if closed:
 current=tmp.lstat();assert current.st_dev==ident.st_dev and current.st_ino==ident.st_ino and not tmp.is_symlink()
 for p in tmp.rglob('*'):
  st=p.lstat();n+=1;b+=st.st_size;assert n<=4096 and b<=4194304 and not p.is_symlink()
 for file in ['verifier-fixtures.json','v3-fixtures.json']:
  p=tmp/file
  if p.exists():assert p.stat().st_size<=65536; (out/file).write_bytes(p.read_bytes())
 shutil.rmtree(tmp);assert not tmp.exists();cleanup.update({'removed':True,'retained':None,'endSampleEntries':n,'endSampleBytes':b,'dev':ident.st_dev,'ino':ident.st_ino})
state['attempts'].append({'name':name,'startedAt':start,'endedAt':now(),'wallBeforePersistenceSeconds':time.monotonic()-clock,'supervision':rep,'cleanup':cleanup,'raw':{'path':str((out/'output.log').relative_to(R)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()},'sourceHashes':{str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [Path(__file__),*(B/f for f in files),B/'apps/server/src/runners.ts',B/'apps/server/src/plugin-runtime/claim.ts',B/'apps/server/src/plugin-runtime/verification.ts']}})
save(record,state);print(json.dumps({'name':name,'exit':result.exit_code,'elapsedMs':result.elapsed_ms,'owned':result.owned_state,'eof':result.eof,'rawBytes':len(raw),'cleanup':cleanup}));sys.exit(0 if result.exit_code==0 and closed and cleanup['removed'] else 1)

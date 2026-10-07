import sys,os,json,time,datetime,tempfile,pathlib,hashlib,importlib.util,dataclasses,shutil
root=pathlib.Path(__file__).resolve().parents[3];e=root/'docs/evidence/s01p08'; mode=sys.argv[1]
assert mode in ('baseline','types','types-fixed','optimized','focused')
d=json.loads((e/'dependencies.json').read_text()); node='/opt/homebrew/opt/node@24/bin/node'
argv=[node,d['typescript']+'/bin/tsc','--noEmit','-p',str(e/'tsconfig.json')] if mode.startswith('types') else [node,d['vitest']+'/vitest.mjs','run','--config',str(e/'vitest.config.mjs'),'--configLoader','native','apps/runner/src/native-stream-ownership.test.ts']
p=e/'local.json';record=json.loads(p.read_text()) if p.exists() else {'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'runs':[],'limit':{'children':4,'rawBytes':262144,'tmpBytes':8388608,'secondsEach':60},'scope':'injected local only; no native, PG, HTTP, provider'}
assert len(record['runs'])<4 and not (e/(mode+'.txt')).exists()
assert shutil.disk_usage(root).free>=1107296256
module=pathlib.Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py');spec=importlib.util.spec_from_file_location('ops14',module);ops=importlib.util.module_from_spec(spec);sys.modules['ops14']=ops;spec.loader.exec_module(ops)
tmp=pathlib.Path(tempfile.mkdtemp(prefix='flow-s01p08-'));identity=tmp.stat();before=datetime.datetime.now(datetime.timezone.utc).isoformat()
inputs=[]
for q in [root/'apps/runner/src/native-stream-ownership.test.ts',root/'apps/runner/src/attempt-control.ts',root/'apps/runner/src/native-harness/codex/adapter.ts',e/'vitest.config.mjs',e/'tsconfig.json']:
 b=q.read_bytes();inputs.append({'path':str(q.relative_to(root)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
r={'mode':mode,'startedAt':before,'tmp':{'path':str(tmp),'dev':identity.st_dev,'ino':identity.st_ino},'inputs':inputs,'supervisorSha256':hashlib.sha256(module.read_bytes()).hexdigest(),'argv':argv};record['runs'].append(r);p.write_text(json.dumps(record,indent=2)+'\n')
env={**os.environ,'NODE_DISABLE_COMPILE_CACHE':'1','TMPDIR':str(tmp),'TMP':str(tmp),'TEMP':str(tmp),'VITE_CACHE_DIR':str(tmp/'vite'),'XDG_CACHE_HOME':str(tmp/'cache')}
report=ops.supervise(ops.Launch(tuple(argv),str(root),env,ops.Ownership.NEW_CHILD_SESSION,ops.Capture.MERGED),ops.Policy(58,.5,1.5,65536))
raw=report.stdout;rawpath=e/(mode+'.txt');rawpath.write_bytes(raw);facts=dataclasses.asdict(report);facts.pop('stdout');facts.pop('stderr');r.update({'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'process':facts,'raw':{'path':str(rawpath.relative_to(root)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}})
paths=list(tmp.rglob('*'));size=sum(q.lstat().st_size for q in [tmp,*paths]);r['tmp']['sampleBytes']=size;r['tmp']['sampleCount']=len(paths)+1
current=tmp.lstat();safe=report.owned_state=='absent' and all(report.eof.values()) and (current.st_dev,current.st_ino)==(identity.st_dev,identity.st_ino) and size<=8388608 and not any(q.is_symlink() for q in paths)
if safe:shutil.rmtree(tmp)
r['tmp']['removed']=safe and not tmp.exists();r['tmp']['retained']=not r['tmp']['removed'];record['rawBytes']=sum(v.get('raw',{}).get('bytes',0) for v in record['runs']);p.write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'mode':mode,'exit':report.exit_code,'elapsedMs':report.elapsed_ms,'rawBytes':len(raw),'ownedState':report.owned_state,'eof':report.eof,'tmp':r['tmp'],'firstFailure':report.first_failure}));print(raw.decode(errors='replace')[-12000:]);sys.exit(0 if report.exit_code==0 and safe else 1)

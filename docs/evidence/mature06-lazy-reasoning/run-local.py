import sys,os,json,time,datetime,tempfile,pathlib,hashlib,importlib.util,dataclasses,shutil,stat
root=pathlib.Path(__file__).resolve().parents[3];e=root/'docs/evidence/mature06-lazy-reasoning';mode=sys.argv[1]
assert mode in ('types','tests','types-fix','tests-fix','p2-red','p2-green','p2-types','pg-types','pg-collect','pg-fix-gates')
gate_mode=mode=='pg-fix-gates';fix_mode=mode.startswith('p2-');pg_mode=mode.startswith('pg-')and not gate_mode
d=json.loads((e/'dependencies.json').read_text());node=d['node'];entries=['packages/contracts/src/assistant-stream-selection.test.ts','apps/server/src/assistant-stream/selection.test.ts','packages/interaction/src/stream/selection.test.ts']
argv=[node,d['typescript']+'/bin/tsc','--noEmit','-p',str(e/'tsconfig.json')] if 'types' in mode else [node,d['vitest']+'/vitest.mjs','run','--config',str(e/'vitest.config.mjs'),'--configLoader','native',*entries]
if fix_mode and mode!='p2-types':argv=argv[:-3]+['packages/interaction/src/stream/selection.test.ts','-t',('keeps text advancing|marks a retained disclosure' if mode=='p2-red' else 'keeps text advancing|marks a retained disclosure|aborts a close flight|rejects delayed disclosure')]
if pg_mode:argv=([node,d['typescript']+'/bin/tsc','--noEmit','-p',str(e/'pg-tsconfig.json')] if mode=='pg-types' else [node,d['vitest']+'/vitest.mjs','list','--config',str(e/'pg-vitest.config.mjs'),'--configLoader','native','apps/server/src/assistant-stream/selection-pg.test.ts'])
if gate_mode:argv=['/opt/homebrew/bin/python3.13','-B',str(e/'pg-gates.test.py'),'--verbose']
p=e/('pg-fix-local.json' if gate_mode else 'pg-local.json' if pg_mode else 'lifecycle-local.json' if fix_mode else 'local.json');now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();record=json.loads(p.read_text()) if p.exists() else {'startedAt':now(),'runs':[],'limit':{'children':4,'eachSeconds':60,'rawBytes':262144,'tmpBytes':8388608},'actualScope':'pure/injected only; no HTTP/PG/provider/native','segmentStartedAt':('2026-10-07T07:59:19Z' if gate_mode else '2026-10-07T07:46:59Z' if pg_mode else '2026-10-07T07:36:26Z' if fix_mode else '2026-10-07T07:23:01.133Z')}
assert len(record['runs'])<(2 if gate_mode or pg_mode else 4) and not (e/(mode+'.txt')).exists();assert (datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(record['segmentStartedAt'].replace('Z','+00:00'))).total_seconds()<(600 if gate_mode else 720 if fix_mode or pg_mode else 1200)
free=shutil.disk_usage(root).free;assert free>=1107296256
module=pathlib.Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py');spec=importlib.util.spec_from_file_location('ops14',module);ops=importlib.util.module_from_spec(spec);sys.modules['ops14']=ops;spec.loader.exec_module(ops)
tmp=pathlib.Path(tempfile.mkdtemp(prefix='flow-lazy01-'));identity=tmp.lstat()
inputs=[]
for q in [root/x for x in [*entries,'packages/contracts/src/assistant-stream.ts','apps/server/src/assistant-stream/index.ts','apps/server/src/assistant-stream/queries.ts','packages/interaction/src/stream/projection.ts','packages/interaction/src/stream/patches.ts','packages/interaction/src/stream/presentation.ts']]+[e/'vitest.config.mjs',e/'tsconfig.json']:
 b=q.read_bytes();inputs.append({'path':str(q.relative_to(root)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
if pg_mode:
 for q in [root/'apps/server/src/assistant-stream/selection-pg.test.ts',root/'docs/evidence/mature02c02/pg-fixture.ts',e/'pg-tsconfig.json',e/'pg-vitest.config.mjs',e/'pg-dependencies.json']:
  b=q.read_bytes();inputs.append({'path':str(q.relative_to(root)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
if gate_mode:
 for q in [e/'execute-pg.py',e/'pg-gates.test.py']:
  b=q.read_bytes();inputs.append({'path':str(q.relative_to(root)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
r={'mode':mode,'startedAt':now(),'freeBytes':free,'inputs':inputs,'supervisorSHA':hashlib.sha256(module.read_bytes()).hexdigest(),'argv':argv,'tmp':{'path':str(tmp),'dev':identity.st_dev,'ino':identity.st_ino}};record['runs'].append(r);p.write_text(json.dumps(record,indent=2)+'\n')
env={**os.environ,'NODE_DISABLE_COMPILE_CACHE':'1','TMPDIR':str(tmp),'TMP':str(tmp),'TEMP':str(tmp),'VITE_CACHE_DIR':str(tmp/'vite'),'XDG_CACHE_HOME':str(tmp/'cache')}
report=ops.supervise(ops.Launch(tuple(argv),str(root),env,ops.Ownership.NEW_CHILD_SESSION,ops.Capture.MERGED),ops.Policy(58,.5,1.5,65536))
raw=report.stdout;rawpath=e/(mode+'.txt');rawpath.write_bytes(raw);facts=dataclasses.asdict(report);facts.pop('stdout');facts.pop('stderr');r.update({'finishedAt':now(),'process':facts,'raw':{'path':str(rawpath.relative_to(root)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}})
safe=report.owned_state=='absent' and all(report.eof.values());count=0;size=0
try:
 current=tmp.lstat();assert (current.st_dev,current.st_ino)==(identity.st_dev,identity.st_ino)
 stack=[tmp]
 while stack:
  q=stack.pop();s=q.lstat();count+=1;size+=s.st_size;assert count<=4096 and size<=8388608 and not stat.S_ISLNK(s.st_mode)
  if stat.S_ISDIR(s.st_mode):
   with os.scandir(q) as items:
    for item in items:
     assert len(stack)+count<4096;stack.append(pathlib.Path(item.path))
  else:assert stat.S_ISREG(s.st_mode)
except Exception as error:safe=False;r['tmp']['sampleUnknown']=type(error).__name__
r['tmp'].update({'closedSampleBytes':size,'closedSampleNodes':count,'peakBytes':None})
if safe:shutil.rmtree(tmp)
r['tmp']['removed']=safe and not tmp.exists();record['rawBytes']=sum(v.get('raw',{}).get('bytes',0) for v in record['runs']);p.write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'mode':mode,'exit':report.exit_code,'elapsedMs':report.elapsed_ms,'rawBytes':len(raw),'ownedState':report.owned_state,'eof':report.eof,'tmp':r['tmp']}));print(raw.decode(errors='replace')[-14000:]);sys.exit(0 if report.exit_code==0 and safe else 1)

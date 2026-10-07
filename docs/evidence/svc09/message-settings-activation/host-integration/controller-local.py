"""Only the controller's direct zero-PG consumers; existing OPS14 owns each child."""
from pathlib import Path
from dataclasses import asdict
import datetime, hashlib, importlib.util, json, os, shutil, sys, tempfile
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
NODE = '/opt/homebrew/Cellar/node@24/24.20.0/bin/node'
SUPERVISOR = ROOT / 'tools/owned-process-supervision/supervise.py'
assert hashlib.sha256(SUPERVISOR.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
spec=importlib.util.spec_from_file_location('svc09a_controller_ops14', SUPERVISOR)
ops=importlib.util.module_from_spec(spec);sys.modules[spec.name]=ops;spec.loader.exec_module(ops)
assert sys.argv[1:] in [[], ['--import'], ['--default'], ['--default-closure']]
import_only=sys.argv[1:]==['--import']; default_only=sys.argv[1:]==['--default']
closure_only=sys.argv[1:]==['--default-closure']
run=HERE/('controller-local-04' if closure_only else 'controller-local-03' if default_only else 'controller-local-02' if import_only else 'controller-local-01');run.mkdir()
def save(name,value):
 data=value if isinstance(value,bytes) else (json.dumps(value,indent=2)+'\n').encode()
 fd=os.open(run/name,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
 with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
free=shutil.disk_usage(ROOT).free;assert free>=1024**3+32*1024**2+2*1024**2
scratch=Path(tempfile.mkdtemp(prefix='flow-svc09a-controller-',dir='/private/tmp'));before=scratch.lstat()
paths=['tools/personal-preview/'+s for s in ['preview.mjs','preview.test.mjs','process.mjs','process.test.mjs']]
if import_only: paths += ['docs/evidence/svc09/message-settings-activation/host-integration/'+p for p in ['controller-loader.mjs','controller-import-check.mjs','controller-driver-inputs.json','controller-local.py']]
if default_only or closure_only: paths = ['docs/evidence/svc09/message-settings-activation/host-integration/'+p for p in ['default-host.mjs','default-host.test.mjs','default-host.test.py','host-entry.mjs','host-cleanup.mjs','host-records.mjs','host-run.py','host-supervise.py','controller-local.py']]
pattern='SVC09A readiness|SVC09A startup launches|SVC09A startup profile'
commands=[(NODE,'--experimental-vm-modules','--test','--test-concurrency=1','--test-reporter=spec','--test-name-pattern='+pattern,*[str(ROOT/p) for p in paths if p.endswith('.test.mjs')])]
if import_only: commands=[(NODE,str(HERE/'controller-import-check.mjs'),'--load-controller-only')]
if default_only: commands=[(NODE,'--test','--test-reporter=spec',str(HERE/'default-host.test.mjs')),(sys.executable,str(HERE/'default-host.test.py'))]
if closure_only: commands=[(NODE,'--test','--test-reporter=spec','--test-name-pattern=default real ports|startup primary|actual recorded subset|unpersisted launch|pending launch',str(HERE/'default-host.test.mjs'))]
save('reservation.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commands':commands,'cumulativeSecondsCap':120,'rawBytesCap':2097152,'scratchBytesCap':33554432,'maxConcurrentChildren':3,'freeBytes':free,'scratch':str(scratch),'dev':before.st_dev,'ino':before.st_ino,'inputs':[{'path':p,'bytes':(ROOT/p).stat().st_size,'sha256':hashlib.sha256((ROOT/p).read_bytes()).hexdigest()} for p in paths],'provider':0,'pg':0})
reports=[]
for index,command in enumerate(commands):
 r=ops.supervise(ops.Launch(command,str(ROOT),{'PATH':'/usr/bin:/bin','HOME':str(scratch),'TMPDIR':str(scratch),'NODE_DISABLE_COMPILE_CACHE':'1','PYTHONDONTWRITEBYTECODE':'1','FLOW_SVC09A_CONTROLLER_SCRATCH':str(scratch)},ops.Ownership.NEW_CHILD_SESSION),ops.Policy(30,.5,2,262144))
 reports.append(r);save(f'{index+1:02}-stdout.txt',r.stdout);save(f'{index+1:02}-stderr.txt',r.stderr)
 v=asdict(r);v.pop('stdout');v.pop('stderr');save(f'{index+1:02}-outer.json',v)
 if r.exit_code!=0 or r.owned_state!='absent' or not all(r.eof.values()):break
finished=all(r.owned_state=='absent' and all(r.eof.values()) for r in reports)
after=scratch.lstat();remaining=list(scratch.iterdir());cleanup='KEEP'
if finished and (before.st_dev,before.st_ino)==(after.st_dev,after.st_ino) and not remaining:scratch.rmdir();cleanup='removed'
summary={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reports':[{'exit':r.exit_code,'elapsedMs':r.elapsed_ms,'rawBytes':len(r.stdout)+len(r.stderr),'ownedState':r.owned_state,'eof':r.eof,'firstFailure':r.first_failure} for r in reports],'scratch':{'path':str(scratch),'dev':before.st_dev,'ino':before.st_ino,'remainingEntries':len(remaining),'cleanup':cleanup},'provider':0,'pg':0}
save('result.json',summary);print(json.dumps(summary))
raise SystemExit(0 if all(r.exit_code==0 for r in reports) and finished and cleanup=='removed' else 1)

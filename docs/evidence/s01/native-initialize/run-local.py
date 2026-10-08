"""Three finite preparation checks; existing OPS14 is sole process supervisor."""
import dataclasses, hashlib, importlib.util, json, os, shutil, stat, subprocess, sys, tempfile, time
from pathlib import Path
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[4]; HERE=Path(__file__).resolve().parent
NODE='/opt/homebrew/opt/node@24/bin/node'
SDK='/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk'
DEADLINE=datetime.fromisoformat('2026-10-08T01:50:24.924+00:00')
MODE=sys.argv[1]; HEAD=sys.argv[2]
assert MODE in ('types','ports','clang','types-fixed')
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path); m=importlib.util.module_from_spec(spec);sys.modules[name]=m;spec.loader.exec_module(m);return m
helper=load('replay_checked_helper', ROOT/'docs/evidence/s01/mixed-ab-preparation/delivery-replay-operator.py')
opsPath=HERE/'fixed-source/tools/owned-process-supervision/supervise.py'
assert helper.digest(opsPath)[1]=='725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
ops=load('native_preparation_ops14',opsPath)
started=time.monotonic(); until=started+20
assert (DEADLINE-datetime.now(timezone.utc)).total_seconds()>22
baseenv={'PATH':'/usr/bin:/bin','LANG':'C','LC_ALL':'C','GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null','GIT_TERMINAL_PROMPT':'0'}
def git(*args): return subprocess.check_output(['/usr/bin/git',*args],cwd=ROOT,env=baseenv,text=True).strip()
assert git('rev-parse','HEAD')==HEAD and git('branch','--show-current')=='codex/runner-capacity-probe'
gate=json.loads((HERE/(MODE+'-gate.json')).read_text()); claim=gate['claim']
assert claim['version']==4 and claim['state']=='active' and claim['worker']=='status_read' and claim['worktree']==str(ROOT)
assert len(claim['scope'])==8 and claim['scope']==json.loads((HERE/'claim-amend.json').read_text())['receipt']['claim']['scope']
assert abs((datetime.now(timezone.utc)-datetime.fromisoformat(gate['observedAt'].replace('Z','+00:00'))).total_seconds())<10
current=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/resource-window-current.json')
manager=json.loads(current.read_text())['forwardAdmission']
assert manager['termsBytes']['MikaS01NativeInitializeSourcePreparation']==8388608
floor=max(13291487232, manager['minimumFreshFreeBytes']);free=shutil.disk_usage(ROOT).free
assert free>=floor
bindings=json.loads((HERE/('current-inputs.json' if MODE=='types-fixed' else 'local-inputs.json')).read_text())
for row in bindings:
    assert helper.digest(ROOT/row['path'])==(row['bytes'],row['sha256']),row['path']
recordPath=HERE/'local.json'; record=json.loads(recordPath.read_text()) if recordPath.exists() else {'startedAt':'2026-10-08T01:25:24.924Z','deadline':'2026-10-08T01:50:24.924Z','runs':[],'engineeringCap':3,'nativeExecuted':False,'wholeExternalWall':'UNKNOWN','activePeak':'UNKNOWN'}
assert len(record['runs'])==('types','ports','clang','types-fixed').index(MODE)
assert all(r['processClosed'] for r in record['runs'])
if MODE=='types-fixed': record['fourthCheckAmendment']={'authorizedBy':'D01 canonical via Mika','maximumChildren':4,'deadlineUnchanged':True,'cumulativeSeconds':60}; record['engineeringCap']=4
rawPath=HERE/(MODE+'.raw'); assert helper.absent(rawPath)
allowed={'docs/evidence/s01/native-initialize/local.json'}|{'docs/evidence/s01/native-initialize/'+x+s for x in ('types','ports','clang','types-fixed') for s in ('-gate.json','.raw')}
for line in git('status','--porcelain','--untracked-files=all').splitlines():
    assert line[3:] in allowed, line
scratch=Path(tempfile.mkdtemp(prefix='flow-s01-initialize-'+MODE+'-')); identity=scratch.lstat(); row={'mode':MODE,'head':HEAD,'startAt':helper.utc(),'gate':gate,'managerAt':manager['at'],'floor':floor,'freeBytes':free,'inputs':bindings,'tmp':{'path':str(scratch),'dev':identity.st_dev,'ino':identity.st_ino,'cleanup':'KEEP'}}
record['runs'].append(row)
def save():
    data=json.dumps(record,indent=2)+'\n';assert len(data.encode())<262144;recordPath.write_text(data)
save()
env=dict(baseenv,TMPDIR=str(scratch),TMP=str(scratch),TEMP=str(scratch),HOME=str(scratch),NODE_DISABLE_COMPILE_CACHE='1',TSX_DISABLE_CACHE='1')
if MODE in ('types','types-fixed'): argv=[NODE,str(ROOT/'node_modules/typescript/bin/tsc'),'-p',str(HERE/'tsconfig.json')]
elif MODE=='ports': argv=[NODE,str(ROOT/'node_modules/vitest/vitest.mjs'),'run','--config',str(HERE/'vitest.config.mjs'),'--configLoader','native']
else: argv=['/usr/bin/clang','-std=c11','-Wall','-Wextra','-Werror','-O2','-arch','arm64','-isysroot',SDK,str(ROOT/'experiments/runner-capacity/native-initialize/sampler-darwin.c'),'-lproc','-o',str(scratch/'sampler-darwin')]
row['argv']=argv; save()
report=ops.supervise(ops.Launch(tuple(argv),str(ROOT),env,ops.Ownership.NEW_CHILD_SESSION,ops.Capture.MERGED),ops.Policy(16,0.5,1,65536))
raw=report.stdout;rawPath.write_bytes(raw);os.chmod(rawPath,0o600)
row['process']=dataclasses.asdict(report);row['process'].pop('stdout');row['process'].pop('stderr');row['raw']={'path':str(rawPath.relative_to(ROOT)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
row['processClosed']=helper.process_closed(report,raw);row['returnObservedAt']=helper.utc()
if row['processClosed'] and time.monotonic()+1<until:
    row['tmp']['sample']=helper.inventory(scratch,(identity.st_dev,identity.st_ino),until-0.5,2*1024*1024)
    if MODE=='clang' and report.exit_code==0 and report.first_failure is None:
        source=scratch/'sampler-darwin';size,sha=helper.digest(source);assert size<=131072
        target=HERE/'sampler-darwin';assert helper.absent(target)
        with target.open('xb') as f:f.write(source.read_bytes())
        os.chmod(target,0o700);row['artifact']={'path':str(target.relative_to(ROOT)),'bytes':size,'sha256':sha,'executed':False}
    assert (scratch.lstat().st_dev,scratch.lstat().st_ino)==(identity.st_dev,identity.st_ino)
    shutil.rmtree(scratch);row['tmp']['cleanup']='removed' if helper.absent(scratch) else 'UNKNOWN'
row['elapsedMsBeforePersist']=(time.monotonic()-started)*1000;row['finishedAt']=helper.utc();save()
print(json.dumps({'mode':MODE,'exit':report.exit_code,'pid':report.pid,'closed':row['processClosed'],'tmp':row['tmp']['cleanup'],'rawBytes':len(raw),'elapsedMs':(time.monotonic()-started)*1000}),flush=True)
sys.exit(0 if row['processClosed'] and row['tmp']['cleanup']=='removed' and time.monotonic()<until else 1)

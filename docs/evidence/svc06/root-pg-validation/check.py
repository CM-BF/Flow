"""Bounded direct checks; no package installation, services, or database."""
import hashlib, importlib.util, json, os, shutil, stat, sys, tempfile, threading, time
from datetime import datetime, timezone
from pathlib import Path
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
MODULE = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py')
assert hashlib.sha256(MODULE.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
spec = importlib.util.spec_from_file_location('svc06_pg_ops14', MODULE)
m = importlib.util.module_from_spec(spec); sys.modules[spec.name] = m; spec.loader.exec_module(m)
phase = sys.argv[1]
commands = {
 'fixed-source': [str(HERE/'fixed-source-selection.mjs')],
 'red': ['--test-name-pattern=^root host pg ', 'tools/personal-preview/backend-release/dependency-plan.test.mjs'],
 'green': ['--test-name-pattern=^(root host pg |selects backend production|staging selects)', 'tools/personal-preview/backend-release/dependency-plan.test.mjs', 'tools/personal-preview/backend-release/runtime-installation.test.mjs'],
}
runpath = HERE/'run.json'
record = json.loads(runpath.read_text()) if runpath.exists() else {'kind':'svc06-root-pg-direct-checks','rounds':[],'cumulativeLimitMs':120000,'commandLimitMs':30000,'rawLimit':131072,'tmpLimit':16777216,'freshGate':2684354560,'liveReserve':1073741824}
assert phase in commands and not (HERE/phase).exists()
assert sum(r['elapsed_ms'] for r in record['rounds']) < 120000
raw_before = sum(r['retained_bytes'] for r in record['rounds'])
fresh = shutil.disk_usage(ROOT).free
assert fresh >= record['freshGate']
out = HERE/phase; out.mkdir(mode=0o700)
tmp = Path(tempfile.mkdtemp(prefix='flow-svc06-rootpg-',dir='/private/tmp'))
identity = tmp.stat(); peak = {'logicalBytes':0,'allocatedBytes':0,'minimumFreeBytes':fresh,'samples':0,'vanishedChildren':0,'errors':[]}
stop = threading.Event()
def sample():
    logical=allocated=0
    try:
        for path, dirs, names in os.walk(tmp, followlinks=False):
            for name in names:
                try: value=(Path(path)/name).lstat()
                except FileNotFoundError: peak['vanishedChildren']+=1; continue
                logical+=value.st_size; allocated+=value.st_blocks*512
        peak['samples']+=1; peak['logicalBytes']=max(peak['logicalBytes'],logical); peak['allocatedBytes']=max(peak['allocatedBytes'],allocated)
        peak['minimumFreeBytes']=min(peak['minimumFreeBytes'],shutil.disk_usage(ROOT).free)
    except Exception as error: peak['errors'].append(type(error).__name__)
def observe():
    while not stop.wait(.02): sample()
thread=threading.Thread(target=observe,daemon=True); thread.start()
argv=('/opt/homebrew/opt/node@24/bin/node',*(() if phase=='fixed-source' else ('--test','--test-isolation=none')),*commands[phase])
started=datetime.now(timezone.utc).isoformat()
report=m.supervise(m.Launch(argv,str(ROOT),{'PATH':'/opt/homebrew/opt/node@24/bin:/usr/bin:/bin','TMPDIR':str(tmp),'TMP':str(tmp),'TEMP':str(tmp),'TSX_DISABLE_CACHE':'1'},m.Ownership.NEW_CHILD_SESSION),m.Policy(27,.5,2,min(65536,131072-raw_before)))
stop.set();thread.join();sample()
finished=datetime.now(timezone.utc).isoformat()
result=dict(vars(report));result['stdout']=f'{phase}/stdout.txt';result['stderr']=f'{phase}/stderr.txt'
(out/'stdout.txt').write_bytes(report.stdout);(out/'stderr.txt').write_bytes(report.stderr)
current=tmp.lstat(); remaining=sorted(p.name for p in tmp.iterdir())
removed=False
if (current.st_dev,current.st_ino)==(identity.st_dev,identity.st_ino) and not remaining and report.owned_state=='absent': tmp.rmdir();removed=True
sources=['dependency-plan.mjs','dependency-plan.test.mjs','runtime-installation.test.mjs','runtime-installation.mjs','installation-view.mjs','cache-plan.mjs']
bindings=[]
for name in sources:
    path=ROOT/'tools/personal-preview/backend-release'/name; data=path.read_bytes();bindings.append({'path':str(path.relative_to(ROOT)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
result.update(phase=phase,startedAt=started,finishedAt=finished,argv=argv,freshFreeBytes=fresh,resourcePeak=peak,tmpRoot=str(tmp),tmpIdentity=[identity.st_dev,identity.st_ino],tmpRemaining=remaining,tmpRemoved=removed,sourceBindings=bindings)
result['resourceThresholdsMet']=not peak['errors'] and peak['logicalBytes']<=record['tmpLimit'] and peak['minimumFreeBytes']>=record['liveReserve'] and raw_before+report.retained_bytes<=record['rawLimit']
record['rounds'].append(result);record['updatedAt']=finished;record['measurement']='20ms metadata samples, not atomic peak or reservation'
runpath.write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['phase','exit_code','elapsed_ms','retained_bytes','owned_state','eof','first_failure','tmpRemoved','resourceThresholdsMet']}))

"""One local validation record for the two already selected commands; no PG or product imports here."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import sys
import threading
import time
from datetime import datetime, timezone
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/evidence/chat05p01'
RUN = BASE / 'local-resumed-20261007'
MODULE = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py')
assert hashlib.sha256(MODULE.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
spec = importlib.util.spec_from_file_location('chat05_ops14', MODULE)
supervisor = importlib.util.module_from_spec(spec); sys.modules[spec.name] = supervisor; spec.loader.exec_module(supervisor)
node = '/opt/homebrew/opt/node@24/bin/node'
plan = json.loads((BASE / 'direct-check-plan.json').read_text())
commands = [
 ('direct', [node, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'docs/evidence/chat05p01/pure-check.config.mjs', *plan['files'], '-t', plan['pattern']], 60, 16 * 1024**2),
 ('types', [node, str(ROOT / 'node_modules/typescript/bin/tsc'), '--project', 'docs/evidence/chat05p01/focused-tsconfig.json', '--pretty', 'false'], 30, 8 * 1024**2),
]
def now(): return datetime.now(timezone.utc).isoformat()
def free():
    s = os.statvfs(ROOT); return s.f_bavail * s.f_frsize

def contents(path):
    total = 0; files = []; missed = 0; start = time.monotonic(); count = 0
    for folder, dirs, names in os.walk(path, followlinks=False):
        for name in dirs + names:
            count += 1
            assert count <= 4096 and time.monotonic() - start < .5
            p = Path(folder) / name
            try: s = p.lstat()
            except FileNotFoundError: missed += 1; continue
            assert not stat.S_ISLNK(s.st_mode)
            if stat.S_ISREG(s.st_mode): total += s.st_size; files.append({'path':str(p.relative_to(path)), 'bytes':s.st_size})
    return {'bytes':total,'files':files,'missedTransientChildren':missed,'atomic':False}

def write(path, value):
    with path.open('x') as f: json.dump(value,f,indent=2); f.write('\n'); f.flush(); os.fsync(f.fileno())

os.mkdir(RUN, 0o700)
window = {'startedAt':now(),'source':'40af6d9071c621707971fd983a85dd9145f065fd','commands':[],'PG':0,'provider':0,'browser':0,'newTestsSelected':10,'old22Repeated':False}
write(RUN / 'reservation.json', window)
for name, command, seconds, increment in commands:
    available = free(); result = {'name':name,'startedAt':now(),'command':command,'budgetSeconds':seconds,'incrementBytes':increment,'rawLimit':1024**2,'freeBefore':available,'requiredFree':1024**3+increment}
    if available < result['requiredFree']:
        result.update(status='NOT_RUN',reason='fresh-space-gate');window['commands'].append(result);break
    temp = RUN / (name + '-tmp');os.mkdir(temp,0o700);identity=temp.stat();result['tmpIdentity']={'dev':identity.st_dev,'ino':identity.st_ino}
    observations=[];sample_errors=[];done=threading.Event()
    def observe():
        while not done.is_set():
            try:
                s=temp.lstat();assert s.st_dev==identity.st_dev and s.st_ino==identity.st_ino and stat.S_ISDIR(s.st_mode)
                measurement=contents(temp);observations.append({'free':free(),'tmpBytes':measurement['bytes'],'missed':measurement['missedTransientChildren']})
                assert len(observations)<=700
            except Exception as e: sample_errors.append(type(e).__name__); return
            done.wait(.1)
    monitor=threading.Thread(target=observe,daemon=True);monitor.start()
    env={'PATH':f'/opt/homebrew/opt/node@24/bin:/usr/bin:/bin:/usr/sbin','HOME':str(temp),'TMPDIR':str(temp), 'TMP':str(temp),'TEMP':str(temp),'FLOW_TEST_CACHE_DIR':str(temp/'vite'),'NODE_DISABLE_COMPILE_CACHE':'1','TSX_DISABLE_CACHE':'1','PYTHONDONTWRITEBYTECODE':'1'}
    report=supervisor.supervise(supervisor.Launch(tuple(command),str(ROOT),env,supervisor.Ownership.NEW_CHILD_SESSION),supervisor.Policy(seconds,.5,2,512*1024))
    done.set();monitor.join(.5); assert not monitor.is_alive()
    final=contents(temp);observations.append({'free':free(),'tmpBytes':final['bytes'],'missed':final['missedTransientChildren']})
    value=dict(vars(report));value.pop('stdout');value.pop('stderr');result['supervision']=value
    for stream in ['stdout','stderr']:
        with (RUN/f'{name}.{stream}').open('xb') as f:f.write(getattr(report,stream));f.flush();os.fsync(f.fileno())
    result['finishedAt']=now(); result['rawBytes']=len(report.stdout)+len(report.stderr)
    result['resourceObservation']={'samples':len(observations),'errors':sample_errors,'minFree':min(s['free'] for s in observations),'maxTmpBytes':max(s['tmpBytes']for s in observations),'sampledNotPhysicalPeak':True}
    result['tmpAfter']=final;result['tmpRemoved']=False
    passed=report.exit_code==0 and report.owned_state=='absent' and all(report.eof.values()) and report.first_failure is None and not sample_errors
    passed=passed and result['resourceObservation']['minFree']>=1024**3 and result['resourceObservation']['maxTmpBytes']+result['rawBytes']<=increment and result['rawBytes']<=1024**2
    result['status']='PASSED' if passed else 'FAILED_OR_UNKNOWN'
    write(RUN/f'{name}-checkpoint.json',result)
    if report.owned_state=='absent' and not final['files'] and not list(temp.iterdir()):
        fresh=temp.stat();assert(fresh.st_dev,fresh.st_ino)==(identity.st_dev,identity.st_ino);temp.rmdir();result['tmpRemoved']=True
    else:result['tmpRetained']='Only exact listed generated cache retained; fixture cleanup must be confirmed from final paths.'
    window['commands'].append(result)
    if not passed:break
window['finishedAt']=now();window['supervisedTotalMs']=sum(c.get('supervision',{}).get('elapsed_ms',0)for c in window['commands'])
window['observationLimits']='Metadata samples and final sample, not a hard allocation reservation or exact instantaneous peak. OPS14 enforces command time/output and child ownership. No new signal loop.'
write(RUN/'result.json',window)
print(json.dumps({'commands':[{'name':c['name'],'status':c['status'],'exit':c.get('supervision',{}).get('exit_code'),'ms':c.get('supervision',{}).get('elapsed_ms'),'group':c.get('supervision',{}).get('owned_state')}for c in window['commands']],'supervisedTotalMs':window['supervisedTotalMs']}))

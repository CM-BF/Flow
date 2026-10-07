"""Passive outer capture for the existing Recovery visual-task parent; no second DB/Chrome supervisor."""
from pathlib import Path
import argparse, datetime, hashlib, json, math, os, selectors, signal, subprocess, sys, time

parser = argparse.ArgumentParser()
parser.add_argument('--gate', required=True)
parser.add_argument('--env-file', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
base = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-shared-overlays')
gate_path, env_path, output = Path(args.gate), Path(args.env_file), Path(args.output)
gate = json.loads(gate_path.read_text())
assert output == Path(__file__).resolve().parent / 'actual' / gate['run'], 'Outer output must stay in this prepared task namespace'
phase = gate.get('visualAppearancePhase', {})
assert gate.get('allowRun') is True and gate['journey'] == 'appearance' and gate.get('messageSettingsPhase') is None
assert phase.get('id') == 'VISUAL01-RECOVERY-APPEARANCE-20261007' and phase.get('budgetMs') == 60000 and phase.get('cleanupMs') == 30000
assert 45000 <= gate['totalMs'] <= min(60000, 60000-phase['spentMs'])
assert datetime.datetime.fromisoformat(gate['expiresAt'].replace('Z','+00:00')) > datetime.datetime.now(datetime.timezone.utc)
identity = env_path.lstat()
assert not env_path.is_symlink() and env_path.is_file() and identity.st_uid == os.getuid() and identity.st_mode & 0o777 == 0o600
# The value is only consumed by Node --env-file, never read by this collector.
output.mkdir(mode=0o700, exist_ok=False)
started = time.monotonic(); hard = started + gate['totalMs']/1000; work = hard-30
started_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
errors, signals = [], []
child = None; sent_term = False; sent_kill = False

def stop(reason):
    global sent_term
    if reason not in errors: errors.append(reason)
    if child is not None and child.poll() is None and not sent_term:
        sent_term = True
        try: os.kill(child.pid, signal.SIGTERM)
        except ProcessLookupError: pass
        except OSError as error: errors.append('parent TERM: '+str(error))

def final_reap_reserve():
    global sent_kill
    if child is not None and child.poll() is None and hard-time.monotonic() <= .5 and not sent_kill:
        sent_kill = True; errors.append('parent exceeded cleanup deadline; resource closure UNKNOWN')
        try: os.kill(child.pid,signal.SIGKILL)
        except ProcessLookupError: pass
        except OSError as error: errors.append('parent final KILL: '+str(error))

def interrupted(number, frame):
    signals.append(number); stop('outer interrupted')

for number in (signal.SIGTERM, signal.SIGINT): signal.signal(number, interrupted)
env = {key:value for key,value in os.environ.items() if key in ('PATH','HOME','USER','LOGNAME','LANG','LC_ALL')}
env.update(FLOW_VISUAL01_BROWSER='1', FLOW_MSG03_BROWSER='1', FLOW_RECOVERY_GATE=str(gate_path), TSX_DISABLE_CACHE='1', NODE_DISABLE_COMPILE_CACHE='1')
command = ['/opt/homebrew/opt/node@24/bin/node', '--env-file='+str(env_path), '--import', 'tsx', 'apps/web/test/conversation-recovery.browser.ts', '--visual-appearance']
streams = {}; selector = selectors.DefaultSelector(); handles = []
try:
    if signals: raise RuntimeError('interrupted before launch')
    child = subprocess.Popen(command, cwd=base, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    (output/'start.json').write_text(json.dumps({'run':gate['run'],'startedAt':started_at,'outerPid':os.getpid(),'parentPid':child.pid,'gateSha256':hashlib.sha256(gate_path.read_bytes()).hexdigest()})+'\n')
    print(json.dumps({'actualStart':started_at,'run':gate['run'],'outerPid':os.getpid(),'parentPid':child.pid}),flush=True)
    for name, pipe, filename in [('stdout',child.stdout,'parent.stdout.jsonl'),('stderr',child.stderr,'parent.stderr.log')]:
        handle=(output/filename).open('xb'); handles.append(handle)
        streams[name]={'file':filename,'bytes':0,'retainedBytes':0,'droppedBytes':0,'EOF':False,'sha256':hashlib.sha256()}
        os.set_blocking(pipe.fileno(),False); selector.register(pipe,selectors.EVENT_READ,(name,handle))
    while selector.get_map() or child.poll() is None:
        final_reap_reserve()
        remaining=hard-time.monotonic()
        if time.monotonic() >= work and child.poll() is None: stop('outer work deadline; cleanup reserve')
        if remaining <= 0:
            stop('outer total deadline')
            break
        # Give the existing parent its own cleanup interval; a collector failure asks that parent to clean up.
        for key,_ in selector.select(min(.05,remaining)):
            name,handle=key.data; state=streams[name]
            try: chunk=os.read(key.fd,65536)
            except BlockingIOError: continue
            except OSError as error:
                stop('pipe read: '+str(error)); selector.unregister(key.fileobj); continue
            if not chunk:
                state['EOF']=True; selector.unregister(key.fileobj); key.fileobj.close(); continue
            state['bytes']+=len(chunk); state['sha256'].update(chunk)
            keep=min(len(chunk),max(0,256*1024-sum(row['retainedBytes'] for row in streams.values())))
            try:
                if keep: handle.write(chunk[:keep]); state['retainedBytes']+=keep
            except OSError as error:
                stop('raw write: '+str(error)); keep=0
            state['droppedBytes']+=len(chunk)-keep
            if state['droppedBytes']: stop('outer raw bound exceeded')
    if child.poll() is None:
        stop('parent not terminal at outer deadline')
        # Parent owns independent worker/Chrome groups. Do not guess their identity or call them absent.
        try: os.kill(child.pid,signal.SIGKILL)
        except ProcessLookupError: pass
        except OSError as error: errors.append('parent KILL: '+str(error))
    if child.poll() is None: errors.append('parent terminal not observed')
except BaseException as error:
    stop(type(error).__name__+': '+str(error))
finally:
    # Late errors do not skip reading: continue draining available bytes/EOF up to the same hard deadline.
    while child is not None and time.monotonic()<hard and (selector.get_map() or child.poll() is None):
        final_reap_reserve()
        for key,_ in selector.select(min(.02,max(0,hard-time.monotonic()))):
            name,handle=key.data; state=streams[name]
            try: chunk=os.read(key.fd,65536)
            except BlockingIOError: continue
            except OSError as error:
                errors.append('tail read: '+str(error)); selector.unregister(key.fileobj); continue
            if not chunk: state['EOF']=True; selector.unregister(key.fileobj); key.fileobj.close(); continue
            state['bytes']+=len(chunk); state['sha256'].update(chunk)
            keep=min(len(chunk),max(0,256*1024-sum(row['retainedBytes'] for row in streams.values())))
            try:
                if keep: handle.write(chunk[:keep]);state['retainedBytes']+=keep
            except OSError as error: errors.append('tail write: '+str(error));keep=0
            state['droppedBytes']+=len(chunk)-keep
        if child.poll() is not None and not selector.get_map(): break
    if child is not None and child.poll() is None:
        errors.append('parent not terminal at outer tail deadline; resource closure UNKNOWN')
        try: os.kill(child.pid,signal.SIGKILL)
        except ProcessLookupError: pass
        except OSError as error: errors.append('parent final KILL: '+str(error))
    for handle in handles:
        try: handle.close()
        except OSError as error: errors.append('log close: '+str(error))
    selector.close()
    exit_code=child.poll() if child else None
    if exit_code != 0: errors.append('actual parent exit '+str(exit_code))
    if len(streams)!=2 or any(not s['EOF'] or s['droppedBytes'] for s in streams.values()):errors.append('incomplete outer streams')
    report={'run':gate['run'],'startedAt':started_at,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'outerPid':os.getpid(),'parentPid':child.pid if child else None,'exitCode':exit_code,'elapsedMs':(time.monotonic()-started)*1000,'signals':signals,'streams':{name:{**s,'sha256':s['sha256'].hexdigest()} for name,s in streams.items()},'errors':errors,'cleanupAuthority':'Only parent supervisor owns DB/worker/Chrome/scratch. Separate exact post-cleanup observation required; absent not inferred here.'}
    try: (output/'actual-exit.json').write_text(json.dumps(report,indent=2)+'\n')
    except OSError as error: errors.append('terminal write: '+str(error))
    terminal={'outerTerminal':True,'run':gate['run'],'actualParentExit':exit_code,'postWriteElapsedMs':(time.monotonic()-started)*1000,'stdoutEOF':streams.get('stdout',{}).get('EOF',False),'stderrEOF':streams.get('stderr',{}).get('EOF',False),'errors':errors,'signals':signals}
    if signals or time.monotonic()>hard: errors.append('late signal/outer deadline')
    print(json.dumps(terminal),flush=True)
sys.exit(0 if exit_code == 0 and not errors and not signals else 1)

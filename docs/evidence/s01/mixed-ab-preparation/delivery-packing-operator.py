"""One fixed S01 packing window; reuse OPS14 and the reviewed ownership/receipt helpers."""
import dataclasses
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace

START = time.monotonic()
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
WINDOW = 's01-buffered-packing-abba-once'
INPUT = HERE / 'delivery-packing-input.json'
BASE = HERE / 'delivery-packing-actual-r1'
SUFFIXES = ('-reservation.json', '-spawn.json', '-root.json', '.raw', '.json')
SPEC = importlib.util.spec_from_file_location('s01_packing_reviewed_helpers', HERE / 'delivery-replay-operator.py')
helper = importlib.util.module_from_spec(SPEC); sys.modules[SPEC.name] = helper; SPEC.loader.exec_module(helper)

def command(trace_sha):
    return [helper.NODE, str(HERE / 'delivery-packing-js/parent/delivery-packing.js'), '--authorized-packing-once',
            str(HERE / 'delivery-replay-trace.json'), trace_sha,
            str(HERE / 'delivery-replay-js-v2/delivery-replay-main.js'), str(HERE / 'delivery-packing-js/worker/delivery-replay-main.js')]

def build_confirmed():
    build = HERE / 'delivery-packing-js'
    manifest = helper.read_json(build / 'manifest.json')
    for name, row in manifest['files'].items():
        if helper.digest(build / name) != (row['bytes'], row['sha256']): raise ValueError('build_bytes')
    for name in helper.JS_NAMES:
        if name != 'pg-delivery.js' and helper.digest(build / 'worker' / name) != helper.digest(helper.BUILD / name): raise ValueError('worker_policy_changed')
    runs = helper.read_json(HERE / 'delivery-packing-local.json', 262144)['runs']
    compile_run = next(r for r in runs if r['kind'] == 'packing-compile')
    raw = helper.read_bytes(ROOT / compile_run['raw']['path'], 32768)
    facts = SimpleNamespace(**compile_run['process'], stdout=raw, stderr=b'')
    if (compile_run['head'] != manifest['head'] or compile_run['build']['manifestSha256'] != helper.digest(build / 'manifest.json')[1]
            or not helper.process_closed(facts, raw) or facts.exit_code != 0 or facts.first_failure is not None
            or not compile_run['closed'] or not compile_run['tmp']['removed']): raise ValueError('compile_receipt_unknown')
    for path, row in compile_run['source'].items():
        if helper.digest(ROOT / path) != (row['bytes'], row['sha256']): raise ValueError('compiled_source_changed')
    return manifest

def child():
    inputs = helper.read_json(INPUT)
    reservation=helper.read_json(Path(str(BASE)+'-reservation.json')); root=helper.read_json(Path(str(BASE)+'-root.json'))
    tmp=Path(os.environ['TMPDIR']); identity=tmp.lstat()
    if reservation.get('window')!=WINDOW or reservation.get('inputSha')!=helper.digest(INPUT)[1] or root.get('path')!=str(tmp) or (root.get('dev'),root.get('ino'))!=(identity.st_dev,identity.st_ino):raise ValueError('child_reservation_identity')
    helper.save(Path(str(BASE) + '-spawn.json'), {'window':WINDOW,'pid':os.getpid(),'pgid':os.getpgrp(),'at':helper.utc()})
    argv = command(inputs['traceSha256'])
    env = helper.environment(Path(os.environ['TMPDIR'])); env['FLOW_S01_REPLAY_OPEN'] = WINDOW
    os.execve(helper.NODE, argv, env)

def main(head, input_sha, floor):
    end = START + 60
    if not sys.flags.isolated or sys.dont_write_bytecode is not True or os.environ.get('FLOW_S01_PACKING_OPEN') != WINDOW: raise ValueError('explicit_isolated_open_required')
    if ROOT != helper.EXPECTED_ROOT or not all(helper.absent(Path(str(BASE) + suffix)) for suffix in SUFFIXES): raise ValueError('output_or_root_identity')
    if helper.digest(INPUT)[1] != input_sha: raise ValueError('input_hash')
    inputs = helper.read_json(INPUT, 262144)
    for row in inputs['files']:
        path = Path(row['path']); path = path if path.is_absolute() else ROOT / path
        if helper.digest(path.resolve()) != (row['bytes'],row['sha256']) or str(path.resolve()) != row['realpath']: raise ValueError('input_changed')
    env = helper.environment(Path('/tmp'))
    for args, expected in ((['rev-parse','HEAD'],head),(['rev-parse','origin/'+helper.BRANCH],head),(['branch','--show-current'],helper.BRANCH),(['status','--porcelain=v1','--untracked-files=all'],'')):
        if subprocess.check_output(['/usr/bin/git',*args],cwd=ROOT,env=env,timeout=3).decode().strip() != expected: raise ValueError('git_identity')
    build_confirmed()
    vfs=os.statvfs(ROOT); free=vfs.f_bavail*vfs.f_frsize
    if floor < inputs['minimumHistoricalFloorNotAuthorization'] or free < floor or time.monotonic() >= START+5: raise ValueError('fresh_admission')
    record={'mode':'packing','window':WINDOW,'head':head,'inputSha':input_sha,'startedAt':helper.utc(),'floorBytes':floor,'freeBytes':free,'faults':[],'closed':False,'successBeforePersistence':False}
    helper.save(Path(str(BASE)+'-reservation.json'),record)
    tmp=None; info=None
    try:
        tmp=Path(tempfile.mkdtemp(prefix='flow-s01-packing-actual-',dir='/tmp')); info=tmp.lstat()
        record['tmp']={'path':str(tmp),'dev':info.st_dev,'ino':info.st_ino,'removed':False}
        helper.save(Path(str(BASE)+'-root.json'),record['tmp'])
        if helper.digest(helper.OPS)[1] != helper.OPS_SHA: raise ValueError('ops_changed')
        spec=importlib.util.spec_from_file_location('s01_packing_ops',helper.OPS); owned=importlib.util.module_from_spec(spec);sys.modules[spec.name]=owned;spec.loader.exec_module(owned)
        work=min(45,end-time.monotonic()-10)
        if work<=0: raise TimeoutError('no_work_margin')
        report=owned.supervise(owned.Launch((helper.PYTHON,'-I','-B',str(Path(__file__).resolve()),'--child'),str(ROOT),helper.environment(tmp),owned.Ownership.NEW_CHILD_SESSION,owned.Capture.MERGED),owned.Policy(work,2,3,131072))
        raw=report.stdout;record['process']={k:v for k,v in dataclasses.asdict(report).items() if k not in ('stdout','stderr')}
        fd=os.open(str(BASE)+'.raw',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
        with os.fdopen(fd,'wb') as handle:handle.write(raw);handle.flush();os.fsync(handle.fileno())
        record['raw']={'bytes':len(raw),'sha256':helper.hashlib.sha256(raw).hexdigest()};record['closed']=helper.process_closed(report,raw)
        if report.exit_code!=0 or report.first_failure or not record['closed']:record['faults'].append('process_or_capture_unknown')
        if not record['faults']:
            result=json.loads(raw)
            if result.get('window')!=WINDOW or result.get('traceSha')!=inputs['traceSha256'] or result.get('order')!=['old','new','new','old'] or result.get('inputRows')!=2048 or result.get('success') is not True:raise ValueError('packing_result_identity')
            spawn=helper.read_json(Path(str(BASE)+'-spawn.json'))
            if spawn.get('window')!=WINDOW or spawn.get('pid')!=report.pid or spawn.get('pgid')!=report.pid:raise ValueError('spawn_identity')
            arms=result.get('arms',[])
            if len(arms)!=4 or [a.get('variant') for a in arms]!=['old','new','new','old']:raise ValueError('arm_order')
            for value in arms:
                if (value.get('mode')!='buffered' or value.get('success') is not True or value.get('failure') is not None
                        or value.get('exit')!={'code':0,'signal':None} or value.get('stdoutEOF') is not True or value.get('stderrEOF') is not True
                        or value.get('stdoutBytes')!=0 or value.get('stderrBytes')!=0 or value.get('receipt',{}).get('known') is not True
                        or value.get('receipt',{}).get('inputRows')!=2048 or value.get('parentControl',{}).get('pendingBytes')!=0
                        or value.get('parentControl',{}).get('dropped')!=0):raise ValueError('arm_incomplete')
            record['result']=result
    except Exception as error:record['faults'].append(type(error).__name__)
    finally:
        if tmp is not None and record['closed'] and time.monotonic()<end-5:
            try:
                record['tmp']['lastSample']=helper.inventory(tmp,(info.st_dev,info.st_ino),end-4,2097152)
                if time.monotonic()>=end-3:raise TimeoutError('cleanup_margin')
                helper.shutil.rmtree(tmp);record['tmp']['removed']=helper.absent(tmp)
            except Exception as error:record['faults'].append(type(error).__name__)
        if not record.get('tmp',{}).get('removed'):record['faults'].append('TMP_KEEP')
        record['endedAt']=helper.utc();record['beforePersistenceMs']=(time.monotonic()-START)*1000
        record['successBeforePersistence']=not record['faults'] and time.monotonic()<end-1
        helper.save(Path(str(BASE)+'.json'),record)
    return helper.emit_result(record,end)

if __name__=='__main__':
    if sys.argv[1:]==['--child']:child()
    elif len(sys.argv)==5 and sys.argv[1]=='--authorized-packing-once':raise SystemExit(main(sys.argv[2],sys.argv[3],int(sys.argv[4])))
    else:raise ValueError('fixed_arguments')

"""This bounded local segment only; fixed OPS14 and the already reviewed resource helpers."""
import dataclasses
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from datetime import datetime

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); sys.modules[name] = module; spec.loader.exec_module(module)
    return module

helper = load('s01_reviewed_replay_helpers', HERE / 'delivery-replay-operator.py')
if helper.digest(helper.OPS)[1] != helper.OPS_SHA:
    raise ValueError('supervisor_changed')
owned = load('s01_chunk_owned', helper.OPS)
kind = sys.argv[1]
buffered = kind in ('buffered-tests', 'buffered-types')
packing = kind in ('packing-compile', 'packing-tests')
if kind not in ('direct', 'boundary', 'types', 'packing-compile', 'packing-tests', 'buffered-tests', 'buffered-types'):
    raise ValueError('fixed_mode')
started = time.monotonic(); end = started + 30
stem = 'queue-buffered' if buffered else 'delivery-packing' if packing else 'pg-delivery-chunk'
path = HERE / (stem + '-local.json')
record = json.loads(path.read_text()) if path.exists() else {'startedAt': '2026-10-07T15:25:09.000Z', 'deadline': '2026-10-07T15:45:09.000Z', 'runs': [],
    'limits': {'children': 5, 'wholeEachSeconds': 30, 'cumulativeSeconds': 90, 'rawBytes': 262144, 'tmpBytes': 8388608, 'newBytes': 16777216}, 'wholeExternalWall': None}
if buffered and not path.exists():
    record.update({'startedAt':'2026-10-07T16:57:00.000Z','deadline':'2026-10-07T17:12:00.000Z'})
    record['limits'].update({'children':3,'cumulativeSeconds':60,'rawBytes':524288,'tmpBytes':4194304,'newBytes':8388608})
if packing and not path.exists():
    record.update({'startedAt':'2026-10-07T15:47:10.000Z','deadline':'2026-10-07T16:02:10.000Z'})
    record['limits'].update({'children':3,'cumulativeSeconds':60})
if len(record['runs']) >= record['limits']['children'] or sum(r['elapsedMs'] for r in record['runs']) >= record['limits']['cumulativeSeconds'] * 1000:
    raise ValueError('segment_limit')
if any(not r['closed'] or not r['tmp']['removed'] for r in record['runs']):
    raise ValueError('prior_unknown')
if time.time() >= datetime.fromisoformat(record['deadline'].replace('Z', '+00:00')).timestamp():
    raise ValueError('segment_expired')
number = len(record['runs']) + 1
raw_path = HERE / f'{stem}-{number}.raw'
if not helper.absent(raw_path):
    raise ValueError('raw_exists')
run = {'kind': kind, 'number': number, 'startedAt': helper.utc(), 'floorBytes': 14950858752 if buffered else 15927017472 if packing else 14414970880, 'source': {}}
for relative in ('experiments/runner-capacity/mixed/pg-delivery.ts', 'experiments/runner-capacity/mixed/pg-delivery-chunks.test.ts',
    'experiments/runner-capacity/mixed/pg-delivery.test.ts', 'experiments/runner-capacity/mixed/delivery-replay.test.ts',
    'experiments/runner-capacity/mixed/pg-delivery-bridge.ts', 'experiments/runner-capacity/mixed/delivery-replay.ts',
    'experiments/runner-capacity/mixed/observe-pg.ts', 'experiments/runner-capacity/mixed/channel.ts', 'experiments/runner-capacity/mixed/contract.ts',
    'docs/evidence/s01/mixed-ab-preparation/pg-delivery-chunk-tsconfig.json', 'docs/evidence/s01/mixed-ab-preparation/pg-delivery-chunk-vitest.config.mjs',
    'docs/evidence/s01/mixed-ab-preparation/pg-delivery-chunk-local.py', 'docs/evidence/s01/mixed-ab-preparation/delivery-replay-operator.py', 'tsconfig.json'):
    size, sha = helper.digest(ROOT / relative); run['source'][relative] = {'bytes': size, 'sha256': sha}
if packing:
    for relative in ('experiments/runner-capacity/mixed/delivery-packing.ts','experiments/runner-capacity/mixed/delivery-packing.test.ts','experiments/runner-capacity/mixed/delivery-replay-main.ts','docs/evidence/s01/mixed-ab-preparation/delivery-packing-tsconfig.json','docs/evidence/s01/mixed-ab-preparation/delivery-packing-vitest.config.mjs'):
        size, sha = helper.digest(ROOT / relative); run['source'][relative] = {'bytes':size,'sha256':sha}
if buffered:
    for relative in ('experiments/runner-capacity/mixed/queue-buffered-main.ts','experiments/runner-capacity/mixed/queue-buffered.test.ts','experiments/runner-capacity/mixed/ab-driver.ts','experiments/runner-capacity/mixed/ab-sequence.ts','experiments/runner-capacity/mixed/ab-sequence.test.ts','experiments/runner-capacity/mixed/queue-probe.ts','experiments/runner-capacity/mixed/driver.ts','experiments/runner-capacity/mixed/run-identity.ts','experiments/runner-capacity/mixed/proof.ts','docs/evidence/s01/mixed-ab-preparation/queue-buffered-tsconfig.json','docs/evidence/s01/mixed-ab-preparation/queue-buffered-vitest.config.mjs'):
        size,sha=helper.digest(ROOT / relative); run['source'][relative]={'bytes':size,'sha256':sha}
run['dependencies'] = []
for item in json.loads((HERE / 'delivery-replay-input-v2.json').read_text())['files']:
    if not (item['path'].startswith('node_modules/') or item['path'].startswith('/')):
        continue
    source = Path(item['path']); source = source if source.is_absolute() else ROOT / source
    if helper.digest(source.resolve()) != (item['bytes'], item['sha256']) or item.get('realpath', str(source.resolve())) != str(source.resolve()):
        raise ValueError('dependency_changed')
    run['dependencies'].append(item)
vfs = os.statvfs(ROOT); run['freeBytes'] = vfs.f_bavail * vfs.f_frsize
if run['freeBytes'] < run['floorBytes']:
    raise ValueError('free_space')
tmp = Path(tempfile.mkdtemp(prefix='flow-s01-buffered-local-' if buffered else 'flow-s01-packing-local-' if packing else 'flow-s01-chunk-local-', dir='/tmp')); identity = tmp.lstat()
run['tmp'] = {'path': str(tmp), 'dev': identity.st_dev, 'ino': identity.st_ino, 'removed': False}
record['runs'].append(run); path.write_text(json.dumps(record, indent=2) + '\n')
env = helper.environment(tmp); env['FLOW_S01_DELIVERY_TMP'] = str(tmp / 'cache')
run['head'] = subprocess.check_output(['/usr/bin/git', 'rev-parse', 'HEAD'], cwd=ROOT, env=env).decode().strip()
if buffered:
    argv = [helper.NODE, str(ROOT / 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', str(HERE / 'queue-buffered-tsconfig.json')] if kind == 'buffered-types' else [helper.NODE, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', str(HERE / 'queue-buffered-vitest.config.mjs'), '--configLoader', 'native']
elif kind == 'packing-compile':
    argv = [helper.NODE, str(ROOT / 'node_modules/typescript/bin/tsc'), '-p', str(HERE / 'delivery-packing-tsconfig.json'), '--outDir', str(tmp / 'emit')]
elif kind == 'packing-tests':
    argv = [helper.NODE, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', str(HERE / 'delivery-packing-vitest.config.mjs'), '--configLoader', 'native']
elif kind == 'types':
    argv = [helper.NODE, str(ROOT / 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', str(HERE / 'pg-delivery-chunk-tsconfig.json')]
else:
    pattern = 'keeps exact-fit boundaries' if kind == 'boundary' else 'chunk packing|bounded chunks|a partially accepted flush|buffered samples|capacity |finite observation delivery replay'
    argv = [helper.NODE, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', str(HERE / 'pg-delivery-chunk-vitest.config.mjs'), '--configLoader', 'native', '-t', pattern]
run['argv'] = argv
path.write_text(json.dumps(record, indent=2) + '\n')
work = min(24, end - time.monotonic() - 5, record['limits']['cumulativeSeconds'] - sum(r.get('elapsedMs', 0) for r in record['runs']) / 1000 - 5)
if work <= 0:
    raise TimeoutError('no_work_margin_keep_tmp')
report = owned.supervise(owned.Launch(tuple(argv), str(ROOT), env, owned.Ownership.NEW_CHILD_SESSION, owned.Capture.MERGED), owned.Policy(work, .5, 1, 32768))
run['process'] = {k: v for k, v in dataclasses.asdict(report).items() if k not in ('stdout', 'stderr')}
fd = os.open(raw_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
with os.fdopen(fd, 'wb') as handle:
    handle.write(report.stdout); handle.flush(); os.fsync(handle.fileno())
run['raw'] = {'path': str(raw_path.relative_to(ROOT)), 'bytes': len(report.stdout), 'sha256': hashlib.sha256(report.stdout).hexdigest()}
run['closed'] = helper.process_closed(report, report.stdout)
if kind == 'packing-compile' and report.exit_code == 0 and run['closed'] and time.monotonic() < end - 5:
    old = helper.build_binding('bf9127870db0d9d14087d679fea1eba4c5e217f440650665f6d376c9af1b0615', 'cf4fba750a7ea148398efe95c392d8cbf66154b9668eabbe45d0b345b7bcfdfb')
    build = HERE / 'delivery-packing-js'
    if not helper.absent(build): raise ValueError('packing_build_exists')
    parent_names = (*helper.JS_NAMES, 'delivery-packing.js')
    payloads = {'parent/' + name: helper.read_bytes(tmp / 'emit' / name, 65536) for name in parent_names}
    for name in helper.JS_NAMES:
        payloads['worker/' + name] = helper.read_bytes(tmp / 'emit' / name, 65536) if name == 'pg-delivery.js' else helper.read_bytes(helper.BUILD / name, 65536)
    for directory in ('parent', 'worker'): payloads[directory + '/package.json'] = b'{"type":"module"}\n'
    if sum(map(len, payloads.values())) > 262144: raise ValueError('compiled_size')
    build.mkdir(); (build / 'parent').mkdir(); (build / 'worker').mkdir()
    for name, data in payloads.items():
        fd = os.open(build / name, os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'wb') as handle: handle.write(data); handle.flush(); os.fsync(handle.fileno())
    value = {'head':run['head'],'source':run['source'],'compilerArgv':argv,'compilerDependencies':run['dependencies'],
        'oldManifestSha':'cf4fba750a7ea148398efe95c392d8cbf66154b9668eabbe45d0b345b7bcfdfb',
        'workerDifference':['pg-delivery.js'], 'parentOnlySeam':'shared arm optional workerFile/export plus ABBA plan',
        'files':{name:{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in payloads.items()}}
    helper.save(build / 'manifest.json', value); run['build'] = {'path':str(build.relative_to(ROOT)),'manifestSha256':helper.digest(build / 'manifest.json')[1],'bytes':sum(map(len,payloads.values()))}

if run['closed'] and time.monotonic() < end - 3:
    try:
        run['tmp']['lastSample'] = helper.inventory(tmp, (identity.st_dev, identity.st_ino), end - 2, record['limits']['tmpBytes'])
        if time.monotonic() >= end - 1:
            raise TimeoutError('cleanup_margin')
        helper.shutil.rmtree(tmp); run['tmp']['removed'] = helper.absent(tmp)
    except Exception as error:
        run['tmp']['unknown'] = type(error).__name__
run['endedAt'] = helper.utc(); run['elapsedMs'] = (time.monotonic() - started) * 1000
record['rawBytes'] = sum(r['raw']['bytes'] for r in record['runs']); path.write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({'kind': kind, 'exit': report.exit_code, 'closed': run['closed'], 'removed': run['tmp']['removed'], 'rawBytes': len(report.stdout)}), flush=True)
raise SystemExit(0 if report.exit_code == 0 and run['closed'] and run['tmp']['removed'] and time.monotonic() < end else 1)

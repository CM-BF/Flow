"""Two fixed pure-module checks; consumes the existing OPS14 supervisor."""
import dataclasses
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import stat
import sys
import tempfile
import time
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
NODE = '/opt/homebrew/opt/node@24/bin/node'
MODULE = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
EXPECTED = '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
assert hashlib.sha256(MODULE.read_bytes()).hexdigest() == EXPECTED
spec = importlib.util.spec_from_file_location('s01_owned', MODULE)
owned = importlib.util.module_from_spec(spec); sys.modules[spec.name] = owned; spec.loader.exec_module(owned)
kind, suffix = sys.argv[1:]
assert kind in ('tests', 'types') and suffix in ('1', '2', '3', '4', '5')
output = HERE / ('pg-wiring-' + kind + '-' + suffix)
for extension in ('.raw', '.json'):
    try: os.lstat(str(output) + extension)
    except FileNotFoundError: pass
    else: raise RuntimeError('output already exists')
started = time.monotonic()
record = {'kind': kind, 'startedAt': datetime.now(timezone.utc).isoformat(), 'source': {}, 'supervisorSha': EXPECTED,
          'floorBytes': 6895435776, 'limits': {'workSeconds': 55, 'rawBytes': 524288, 'tmpBytes': 16777216}, 'wholeExternalWall': None}
for relative in ('experiments/runner-capacity/mixed/pg-delivery.ts', 'experiments/runner-capacity/mixed/pg-delivery-bridge.ts',
                 'experiments/runner-capacity/mixed/claim-observation.ts', 'experiments/runner-capacity/mixed/pg-delivery-wiring.test.ts',
                 'experiments/runner-capacity/mixed/child.ts', 'experiments/runner-capacity/mixed/driver.ts', 'experiments/runner-capacity/mixed/process.ts', 'experiments/runner-capacity/mixed/ab-input.ts',
                 'experiments/runner-capacity/mixed/observe-pg.ts', 'experiments/runner-capacity/mixed/channel.ts',
                 'experiments/runner-capacity/mixed/contract.ts', 'tsconfig.json',
                 'docs/evidence/s01/mixed-ab-preparation/pg-wiring-vitest.config.mjs',
                 'docs/evidence/s01/mixed-ab-preparation/pg-wiring-tsconfig.json'):
    data = (ROOT / relative).read_bytes(); record['source'][relative] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
vfs = os.statvfs(ROOT); record['freeBytes'] = vfs.f_bavail * vfs.f_frsize
assert record['freeBytes'] >= record['floorBytes']
tmp = Path(tempfile.mkdtemp(prefix='flow-s01-pg-wiring-')); identity = tmp.lstat()
record['tmp'] = {'path': str(tmp), 'dev': identity.st_dev, 'ino': identity.st_ino, 'removed': False}
env = dict(os.environ, NODE_DISABLE_COMPILE_CACHE='1', TMPDIR=str(tmp), TMP=str(tmp), TEMP=str(tmp), FLOW_S01_WIRING_TMP=str(tmp / 'cache'), PYTHONDONTWRITEBYTECODE='1')
command = [NODE, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', str(HERE / 'pg-wiring-vitest.config.mjs'), '--configLoader', 'native'] if kind == 'tests' else [NODE, str(ROOT / 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', str(HERE / 'pg-wiring-tsconfig.json')]
if kind == 'tests' and suffix == '2': command += ['-t', '^full envelope cap']
if kind == 'tests' and suffix == '3': command += ['-t', '^v2']
if kind == 'tests' and suffix == '4': command += ['-t', '^real existing child']
record['argv'] = command
report = owned.supervise(owned.Launch(tuple(command), str(ROOT), env, owned.Ownership.NEW_CHILD_SESSION, owned.Capture.MERGED), owned.Policy(55, .5, 1, 524288))
raw = report.stdout
with open(str(output) + '.raw', 'xb') as handle: os.chmod(handle.name, 0o600); handle.write(raw)
record['process'] = {key: value for key, value in dataclasses.asdict(report).items() if key not in ('stdout', 'stderr')}
record['raw'] = {'path': output.name + '.raw', 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
if report.owned_state == 'absent' and all(report.eof.values()) and not report.secondary_failures:
    try:
        current = tmp.lstat(); assert (current.st_dev, current.st_ino) == (identity.st_dev, identity.st_ino) and stat.S_ISDIR(current.st_mode)
        count = 0; total = 0; pending = [tmp]
        while pending:
            directory = pending.pop()
            with os.scandir(directory) as entries:
                for entry in entries:
                    count += 1; assert count <= 4096
                    info = entry.stat(follow_symlinks=False)
                    if stat.S_ISLNK(info.st_mode): raise RuntimeError('symlink')
                    if stat.S_ISDIR(info.st_mode): pending.append(Path(entry.path))
                    elif stat.S_ISREG(info.st_mode): total += info.st_size
                    else: raise RuntimeError('node kind')
                    assert total <= 16777216
        record['tmp']['lastSampleBytes'] = total; record['tmp']['entries'] = count
        assert (tmp.lstat().st_dev, tmp.lstat().st_ino) == (identity.st_dev, identity.st_ino)
        shutil.rmtree(tmp)
        try: tmp.lstat()
        except FileNotFoundError: record['tmp']['removed'] = True
    except Exception as error:
        record['tmp']['cleanupUnknown'] = type(error).__name__
else:
    record['tmp']['cleanupUnknown'] = 'process_not_confirmed_closed'
record['endedAt'] = datetime.now(timezone.utc).isoformat(); record['elapsedBeforePersistenceMs'] = (time.monotonic() - started) * 1000
with open(str(output) + '.json', 'x') as handle: json.dump(record, handle, indent=2)
print(json.dumps({'kind': kind, 'exit': report.exit_code, 'owned': report.owned_state, 'eof': report.eof, 'rawBytes': len(raw), 'tmpRemoved': record['tmp']['removed']}))
sys.exit(0 if report.exit_code == 0 and report.owned_state == 'absent' and all(report.eof.values()) and record['tmp']['removed'] else 1)

"""One record, fixed OPS14, fresh resource sum, four pure filesystem regressions only."""
import dataclasses, datetime, hashlib, importlib.util, json, os, sys, time
from pathlib import Path
R = Path(__file__).resolve().parents[4]
E = R / 'docs/evidence/x01/cleanup-root-guard'
OPS = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
assert hashlib.sha256(OPS.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
record = E / 'local.json'; state = json.loads(record.read_text()) if record.exists() else {'attempts': []}
assert len(state['attempts']) < 3
used = sum(x['supervision']['elapsed_ms'] for x in state['attempts']); rawused = sum(x['raw']['bytes'] for x in state['attempts']); assert used < 60000
manager = json.loads(Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-platform-management/docs/evidence/web-platform/resource-window-current.json').read_text())
terms = manager['forwardAdmission']['termsBytes']; floor = manager['forwardAdmission']['minimumFreshFreeBytes']
assert sum(terms.values()) == floor
extra = 0 if terms.get('MikaVerifierCleanupRootGuardOrdinary') == 4194304 else 4194304
floor += extra
free = os.statvfs(R).f_bavail * os.statvfs(R).f_frsize
assert free >= floor
out = E / ('run-' + str(len(state['attempts']) + 1)); out.mkdir(); tmp = out / 'tmp'; tmp.mkdir(); info = tmp.lstat()
stamp = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
def save(path, value): path.write_text(json.dumps(value, indent=2) + '\n')
started = stamp(); beginning = time.monotonic()
command = (sys.executable, '-I', '-B', str(E / 'root-guard.test.py'))
save(out / 'reservation.json', {'startedAt': started, 'floorBytes': floor, 'freeBytes': free, 'resourceRecordedAt': manager['recordedAt'], 'state': manager['state'], 'currentActual': manager['currentActual'], 'terms': terms, 'extraBytes': extra, 'command': command, 'tmp': {'path': str(tmp), 'dev': info.st_dev, 'ino': info.st_ino}, 'temporaryMaxBytes': 2097152, 'rawMaxBytes': 524288, 'seconds': 30})
spec = importlib.util.spec_from_file_location('cleanup_ops14', OPS); ops = importlib.util.module_from_spec(spec); sys.modules[spec.name] = ops; spec.loader.exec_module(ops)
env = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C', 'TZ': 'UTC', 'TMPDIR': str(tmp), 'TMP': str(tmp), 'TEMP': str(tmp), 'PYTHONDONTWRITEBYTECODE': '1'}
result = ops.supervise(ops.Launch(command, str(R), env, ops.Ownership.NEW_CHILD_SESSION, ops.Capture.MERGED), ops.Policy(min(27, (60000-used)/1000-3), 1, 2, 524288-rawused))
raw = result.stdout; (out / 'output.log').write_bytes(raw); report = dataclasses.asdict(result); report.pop('stdout'); report.pop('stderr')
code = None if result.first_failure is None else result.first_failure.get('code')
closed = result.exit_code is not None and result.owned_state == 'absent' and result.eof == {'stdout': True} and result.observed_bytes == result.retained_bytes == len(raw) and not result.secondary_failures and code in (None, 'CHILD_EXIT_NONZERO') and not any(s.get('state') == 'unknown' for s in result.signals)
cleanup = {'knownProcessClosed': closed, 'removed': False, 'retained': str(tmp)}
if closed:
    current = tmp.lstat(); assert (current.st_dev,current.st_ino) == (info.st_dev, info.st_ino) and not tmp.is_symlink() and tmp.resolve() == tmp
    entries = list(tmp.iterdir()); assert not entries, 'Own test fixtures remain; KEEP'
    tmp.rmdir()
    try: tmp.lstat()
    except FileNotFoundError: pass
    else: raise ValueError('Temporary absence not confirmed')
    cleanup.update(removed=True, retained=None, dev=info.st_dev, ino=info.st_ino, endSampleEntries=0, exactLstat='ENOENT')
state['attempts'].append({'startedAt': started, 'endedAt': stamp(), 'elapsedBeforePersistence': time.monotonic()-beginning, 'supervision': report, 'cleanup': cleanup, 'raw': {'path': str((out/'output.log').relative_to(R)), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}, 'sourceHashes': {str(p.relative_to(R)): hashlib.sha256(p.read_bytes()).hexdigest() for p in [E/'root-guard.test.py', E/'local.py', E.parent/'enable-binding-pg-once.py']}})
save(record, state)
print(json.dumps({'state': 'PASSED' if result.exit_code == 0 and closed and cleanup['removed'] else 'FAILED_OR_UNKNOWN', 'pid': result.pid, 'elapsedMs': result.elapsed_ms, 'rawBytes': len(raw), 'cleanup': cleanup}))
raise SystemExit(0 if result.exit_code == 0 and closed and cleanup['removed'] else 1)

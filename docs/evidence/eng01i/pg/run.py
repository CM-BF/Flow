"""One explicitly coordinated PG window; OPS14 owns process supervision, this caller owns receipts."""
import dataclasses, datetime, hashlib, importlib.util, json, os, re, shutil, signal, stat, sys, tempfile, time
from pathlib import Path
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
NODE = '/opt/homebrew/opt/node@24/bin/node'

def save(path, value):
    data = value if isinstance(value, bytes) else (json.dumps(value, indent=2) + '\n').encode()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(data); stream.flush(); os.fsync(stream.fileno())
    fd = os.open(path.parent, os.O_RDONLY); os.fsync(fd); os.close(fd)

def size(root):
    total = count = 0
    for directory, dirs, files in os.walk(root, followlinks=False):
        for name in dirs + files:
            info = (Path(directory) / name).lstat(); count += 1
            if count > 8192 or not (stat.S_ISDIR(info.st_mode) or stat.S_ISREG(info.st_mode)): raise ValueError('OWNED_TREE_BOUND')
            if stat.S_ISREG(info.st_mode): total += info.st_size
    return total

def main():
    # Covers initial durable reservation and final report writes too. No child is spawned before reservation.
    started = time.monotonic(); deadline = started + 150
    signal.signal(signal.SIGALRM, lambda *_: os._exit(124)); signal.setitimer(signal.ITIMER_REAL, 150)
    window = sys.argv[1]; assert re.fullmatch(r'[A-Za-z0-9-]{1,80}', window)
    assert os.environ.get('FLOW_ENG01I_APPROVED_WINDOW') == window
    assert os.environ.get('FLOW_ENG01I_PG_ADMIN_URL')
    manifest = json.loads((HERE / 'preflight.json').read_text())
    for row in manifest['files']:
        data = (ROOT / row['path']).read_bytes()
        assert len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256'], row['path']
    for row in manifest['packages']:
        assert hashlib.sha256(Path(row['packagePath']).read_bytes()).hexdigest() == row['packageSha256']
        entry = Path(row['entry']).read_bytes(); assert len(entry) == row['entryBytes'] and hashlib.sha256(entry).hexdigest() == row['entrySha256']
    free = shutil.disk_usage(ROOT).free
    assert free >= 1207959552  # 1 GiB retained + 128 MiB candidate increment, including PG/WAL observation.
    run = HERE / window; run.mkdir(mode=0o700)  # Exclusive: never replay an old run.
    scratch = Path(tempfile.mkdtemp(prefix='flow-eng01i-pg-')).resolve(); identity = scratch.lstat()
    argv = (NODE, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config', str(ROOT / 'docs/evidence/eng01i/local/vitest.config.mjs'),
            'apps/runner/src/engineering/native-adapter.test.ts', '-t', 'public native host PG journey')
    save(run / 'reservation.json', {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'window': window,
         'scratch': str(scratch), 'dev': identity.st_dev, 'ino': identity.st_ino, 'argv': argv, 'freeBytes': free,
         'preflightSha256': hashlib.sha256((HERE / 'preflight.json').read_bytes()).hexdigest(),
         'workSeconds': 120, 'totalSeconds': 150, 'stdoutStderrBytes': 1048576, 'allEvidenceBytes': 2097152, 'runtimeBytes': 8388608, 'providerCalls': 0})
    spec = importlib.util.spec_from_file_location('eng01i_pg_supervisor', ROOT / 'tools/owned-process-supervision/supervise.py')
    module = importlib.util.module_from_spec(spec); sys.modules[spec.name] = module; spec.loader.exec_module(module)
    # The parent deadline includes all preparation, not a new timer at child spawn.
    remaining = deadline - time.monotonic(); work_seconds = min(120, remaining - 30)
    if work_seconds < 1:
        save(run / 'not-run.json', {'reason': 'TOTAL_DEADLINE_BEFORE_SPAWN', 'childCreated': False, 'remainingSeconds': remaining, 'scratch': str(scratch)})
        current = scratch.lstat(); assert (current.st_dev, current.st_ino) == (identity.st_dev, identity.st_ino) and not list(scratch.iterdir())
        scratch.rmdir(); return 2
    save(run / 'spawn-budget.json', {'elapsedPreparationSeconds': time.monotonic() - started, 'workSeconds': work_seconds, 'stopSeconds': 2.5, 'reservedCleanupAndReportingSeconds': 30})
    # Recalculate after the durable budget checkpoint too; a delayed fsync never grants another 120s.
    remaining = deadline - time.monotonic(); work_seconds = min(120, remaining - 30)
    if work_seconds < 1: raise RuntimeError('TOTAL_DEADLINE_AFTER_CHECKPOINT_NO_CHILD')
    env = {'PATH': '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin', 'HOME': str(scratch), 'TMPDIR': str(scratch), 'NO_COLOR': '1',
           'NODE_DISABLE_COMPILE_CACHE': '1', 'TSX_DISABLE_CACHE': '1', 'FLOW_ENG01I_CACHE': str(scratch / 'cache'),
           'FLOW_ENG01I_LOCAL_FACTS': str(scratch / 'peers.json'), 'FLOW_ENG01I_PG': 'reviewed',
           'FLOW_ENG01I_PG_ADMIN_URL': os.environ['FLOW_ENG01I_PG_ADMIN_URL'], 'FLOW_ENG01I_PG_FACTS': str(run / 'fixture'),
           'FLOW_ENG01I_CLEANUP_UNTIL': str(round((time.time() + remaining - 5) * 1000))}
    result = module.supervise(module.Launch(argv, str(ROOT), env, module.Ownership.NEW_CHILD_SESSION), module.Policy(work_seconds, .5, 2, 1048576))
    value = dataclasses.asdict(result)
    for name in ['stdout', 'stderr']:
        raw = value.pop(name); save(run / (name + '.log'), raw); value[name] = {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    value['runtimeBytesBeforeCleanup'] = size(scratch); value['freeAfter'] = shutil.disk_usage(ROOT).free
    value['at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    if (scratch / 'peers.json').exists(): save(run / 'peers.json', (scratch / 'peers.json').read_bytes())
    save(run / 'result.json', value)
    closed = [json.loads(p.read_text()) for p in run.glob('fixture.*.json') if json.loads(p.read_text()).get('stage') == 'closed']
    complete = len(closed) == 1 and not closed[0]['errors'] and closed[0]['detail']['databaseAbsent']
    removed = False
    if result.owned_state == 'absent' and all(result.eof.values()) and complete and value['runtimeBytesBeforeCleanup'] <= 8388608 and size(run) <= 2097152 and value['freeAfter'] >= 1073741824:
        current = scratch.lstat(); assert (current.st_dev, current.st_ino) == (identity.st_dev, identity.st_ino)
        save(run / 'before-runtime-cleanup.json', {'scratch': str(scratch), 'dev': current.st_dev, 'ino': current.st_ino, 'databaseAbsent': True, 'ownedGroup': 'absent'})
        shutil.rmtree(scratch); removed = True
    save(run / 'cleanup.json', {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'runtimeRemoved': removed,
         'scratch': str(scratch), 'databaseCleanupConfirmed': complete, 'ownedGroup': result.owned_state, 'evidenceBytes': size(run)})
    okay = result.exit_code == 0 and result.first_failure is None and not result.secondary_failures and removed
    print(json.dumps({'window': window, 'exit': result.exit_code, 'elapsedMs': result.elapsed_ms, 'ownedGroup': result.owned_state, 'databaseCleanupConfirmed': complete, 'runtimeRemoved': removed, 'okay': okay}))
    return 0 if okay else 1

if __name__ == '__main__': raise SystemExit(main())

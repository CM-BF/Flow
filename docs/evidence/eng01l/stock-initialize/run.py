"""One initialize-only admission. OPS14 owns process observation; this caller owns evidence and scratch."""
from pathlib import Path
import dataclasses, datetime, hashlib, importlib.util, json, os, resource, shutil, signal, stat, sys, tempfile, time

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
PYTHON = '/opt/homebrew/opt/python@3.13/bin/python3.13'
NODE = '/opt/homebrew/opt/node@24/bin/node'
LOADER = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/node_modules/tsx/dist/loader.mjs'
SUPERVISOR = ROOT/'tools/owned-process-supervision/supervise.py'

def digest(path):
    with path.open('rb') as stream: return hashlib.file_digest(stream, 'sha256').hexdigest()

def read_small(path, maximum):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > maximum: raise RuntimeError('BOUNDED_FILE_REQUIRED')
        with os.fdopen(fd, 'rb', closefd=False) as stream: raw = stream.read(maximum + 1)
        if len(raw) > maximum: raise RuntimeError('FILE_LIMIT')
        return raw
    finally: os.close(fd)

def save(path, value):
    raw = value if isinstance(value, bytes) else (json.dumps(value, indent=2) + '\n').encode()
    if not isinstance(value, bytes) and len(raw) > 8192: raise RuntimeError('RECORD_LIMIT')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, 'wb', closefd=False) as stream: stream.write(raw); stream.flush(); os.fsync(fd)
    finally: os.close(fd)
    fd = os.open(path.parent, os.O_RDONLY | os.O_NOFOLLOW)
    try: os.fsync(fd)
    finally: os.close(fd)

def measure(root, maximum):
    total = 0; count = 0; pending = [root]
    while pending:
        with os.scandir(pending.pop()) as entries:
            for entry in entries:
                count += 1
                if count > 128: raise RuntimeError('ENTRY_LIMIT')
                info = entry.stat(follow_symlinks=False)
                if info.st_uid != os.getuid(): raise RuntimeError('OWNER_CHANGED')
                if stat.S_ISDIR(info.st_mode): pending.append(Path(entry.path))
                elif stat.S_ISREG(info.st_mode): total += info.st_size
                else: raise RuntimeError('PRIVATE_FILE_TYPE_UNKNOWN')
                if total > maximum: raise RuntimeError('BYTE_LIMIT')
    return total

def file_fact(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid(): raise RuntimeError('TARGET_UNKNOWN')
    return {'dev': str(info.st_dev), 'ino': str(info.st_ino), 'hex': read_small(path, 2).hex()}

def main():
    started = time.monotonic(); deadline = started + 10
    # Independent total deadline stays armed across preparation, reporting and fsync.
    signal.signal(signal.SIGALRM, lambda *_: os._exit(124)); signal.setitimer(signal.ITIMER_REAL, 10)
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    if Path(sys.executable).resolve() != Path(PYTHON).resolve(): raise RuntimeError('INTERPRETER_CHANGED')
    os.umask(0o077)
    out = HERE/'run-once'; out.mkdir(mode=0o700)  # Exclusive; any existing attempt rejects, never auto-replay.
    result = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'driverStarts': 0,
              'primaryFailure': None, 'cleanup': {'state': 'unknown', 'removed': False},
              'nativeWriteAccess': 'unknown', 'providerCalls': 0, 'PG': 0, 'browser': 0,
              'limits': {'totalSeconds': 10, 'totalRecordBytes': 65536, 'privateBytes': 1048576}}
    scratch = None; root_identity = None; report = None; driver = None; before = None
    try:
        free = shutil.disk_usage(ROOT).free
        if free < 1107296256: raise RuntimeError('NOT_RUN_RESOURCE_GATE')
        inputs = json.loads((HERE/'inputs.json').read_text())
        for binding in inputs['bindings']:
            path = Path(binding['path']) if binding['path'].startswith('/') else ROOT/binding['path']
            if (binding.get('realpath') and str(path.resolve()) != binding['realpath']) or path.stat().st_size != binding['bytes'] or digest(path) != binding['sha256']:
                raise RuntimeError('INPUT_CHANGED')
        alias = inputs['alias']; target = ROOT/alias['path']
        if not target.is_symlink() or os.readlink(target) != alias['link'] or target.parent.is_symlink(): raise RuntimeError('ALIAS_CHANGED')
        save(out/'intent.json', {**result, 'freeBytes': free, 'source': inputs['productSource'], 'inputsSha256': digest(HERE/'inputs.json'), 'entrySha256': digest(Path(__file__))})
        scratch = Path(tempfile.mkdtemp(prefix='eng01l-initialize-', dir='/private/tmp'))
        s = scratch.lstat(); root_identity = (s.st_dev, s.st_ino)
        result['scratch'] = {'path': str(scratch), 'dev': str(s.st_dev), 'ino': str(s.st_ino)}
        save(out/'reservation.json', result)
        workspace = scratch/'workspace'; runtime = scratch/'runtime'; control = runtime/'control'; state = runtime/'state'
        for path in (workspace, runtime, control, state): path.mkdir(mode=0o700)
        for name in ('calculator.mjs', 'baseline.txt'): save(workspace/name, b'0')
        before = {name: file_fact(workspace/name) for name in ('calculator.mjs', 'baseline.txt')}
        spec = importlib.util.spec_from_file_location('eng01l_initialize_supervisor', SUPERVISOR)
        module = importlib.util.module_from_spec(spec); sys.modules[spec.name] = module; spec.loader.exec_module(module)
        # Deduct all preparation from the one total deadline; reserve .5s stop/reap and 2.5s persistence/cleanup.
        work = min(5, deadline - time.monotonic() - 3)
        if work < 2.5: raise RuntimeError('NOT_RUN_NO_CHILD_BUDGET')
        env = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'HOME': str(state), 'TMPDIR': str(state), 'CODEX_HOME': str(state),
               'NODE_DISABLE_COMPILE_CACHE': '1', 'TSX_DISABLE_CACHE': '1'}
        save(out/'spawn-intent.json', {'command': [NODE, '--import', LOADER, str(HERE/'driver.ts'), str(scratch), str(out)],
             'maximumDriverStarts': 1, 'maximumNativeStarts': 1, 'workSeconds': work, 'termSeconds': .2, 'killSeconds': .3,
             'outerOutputBytes': 8192, 'nativeStderrBytes': 8192, 'protocol': ['initialize', 'initialized']})
        result['driverStarts'] = 1
        report = module.supervise(module.Launch((NODE, '--import', LOADER, str(HERE/'driver.ts'), str(scratch), str(out)), str(ROOT), env,
                                               module.Ownership.NEW_CHILD_SESSION), module.Policy(work, .2, .3, 8192))
        row = dataclasses.asdict(report); row.pop('stdout'); row.pop('stderr'); result['supervision'] = row
        save(out/'stdout', report.stdout); save(out/'stderr', report.stderr)
        driver = json.loads(read_small(out/'driver-result.json', 4096)); result['driver'] = driver
        if driver.get('primaryFailure'): result['primaryFailure'] = driver['primaryFailure']
        if report.first_failure or report.exit_code != 0 or report.owned_state != 'absent' or not all(report.eof.values()): raise RuntimeError('DRIVER_NOT_CLEAN')
        if not driver['ready'] or driver['cleanup']['child'] != 'confirmed-exited' or driver['cleanup']['hostWrite'] != 'settled' or not driver['diagnosticComplete']:
            raise RuntimeError('INITIALIZE_OR_DRAIN_UNKNOWN')
    except Exception as error:
        result['primaryFailure'] = result['primaryFailure'] or {'code': str(error) if isinstance(error, RuntimeError) else 'ENTRY_EXCEPTION', 'type': type(error).__name__}
    finally:
        if scratch is not None:
            try:
                current = scratch.lstat(); same = stat.S_ISDIR(current.st_mode) and (current.st_dev, current.st_ino) == root_identity
                private_bytes = measure(scratch, 1048576); end_free = shutil.disk_usage(ROOT).free
                files = {name: file_fact(workspace/name) for name in before} if before else {}
                result['fileFacts'] = files
                files_match = before is not None and files == before and sorted(os.listdir(workspace)) == sorted(before)
                policy = scratch/'runtime/control/flow-readonly.sb'
                if policy.exists(): save(out/'policy.sb', read_small(policy, 24576))
                # A failed initialize can still close cleanly. Absent OS group cannot substitute for host FD drain.
                process_clean = report is not None and report.owned_state == 'absent' and all(report.eof.values())
                drain = driver is not None and driver['cleanup']['child'] in ('not-started', 'confirmed-exited') and driver['cleanup']['hostWrite'] == 'settled'
                safe = same and process_clean and drain and files_match and end_free >= 1073741824
                result['cleanup'] = {'state': 'ready' if safe else 'unknown', 'identityMatched': same, 'ownedProcessAbsent': process_clean,
                                     'hostDrainObserved': drain, 'filesUnchanged': files_match, 'privateBytesAtEnd': private_bytes,
                                     'endFreeBytes': end_free, 'removed': False}
                # Headroom covers this checkpoint and final result; all stdout/stderr and native diagnostics are counted.
                result['recordBytesBeforeCheckpoint'] = measure(out, 65536 - 16384)
                save(out/'checkpoint-before-cleanup.json', result)
                if safe:
                    shutil.rmtree(scratch); result['cleanup'].update({'state': 'complete', 'removed': True})
            except Exception as error:
                result['cleanup'].update({'state': 'unknown', 'errorType': type(error).__name__})
                result['primaryFailure'] = result['primaryFailure'] or {'code': 'CLEANUP_UNKNOWN'}
    result['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    result['elapsedMs'] = round((time.monotonic() - started) * 1000)
    result['passed'] = result['driverStarts'] == 1 and result['primaryFailure'] is None and result['cleanup']['state'] == 'complete'
    save(out/'result.json', result)
    print(json.dumps({'passed': result['passed'], 'elapsedMs': result['elapsedMs'], 'cleanup': result['cleanup']['state']}), flush=True)
    signal.setitimer(signal.ITIMER_REAL, 0)
    return 0 if result['passed'] else 1

if __name__ == '__main__':
    if sys.argv[1:] != ['--run']: raise SystemExit(64)
    raise SystemExit(main())

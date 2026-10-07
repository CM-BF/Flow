"""Exact follow-up for the retained ENG01L fixture. No native launch or other root is accepted."""
from pathlib import Path
import dataclasses, hashlib, importlib.util, json, os, shutil, signal, stat, sys, time
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); sys.modules[name] = module; spec.loader.exec_module(module)
    return module

def main():
    start = time.monotonic(); deadline = start + 5
    signal.signal(signal.SIGALRM, lambda *_: os._exit(124)); signal.setitimer(signal.ITIMER_REAL, 5)
    if hashlib.sha256((HERE/'run.py').read_bytes()).hexdigest() != '472400aa4e9d1954d84ce9341f472cea5e6585e07dbae4497a9d3cb422a8a17d': raise RuntimeError('OPERATOR_CHANGED')
    old = load('eng01l_fixed_operator', HERE/'run.py')
    out = HERE/'cleanup-once'; out.mkdir(mode=0o700)
    request_path = HERE/'cleanup-only-request.json'
    if old.digest(request_path) != 'a274db3cd813f8be5a034417c3060b3fbdc089c314b5cbdb79e7abe2b6b85375': raise RuntimeError('REQUEST_CHANGED')
    request = json.loads(request_path.read_text()); root = Path(request['scratch']['path']); parent = root.parent
    result = {'kind': 'EXACT_FOLLOWUP_CLEANUP', 'originalRunUnchanged': True, 'originalRunPassed': False,
              'state': 'KEEP', 'removed': False, 'primaryFailure': None, 'stock': 0, 'provider': 0, 'PG': 0}
    parent_fd = None
    try:
        if not shutil.rmtree.avoids_symlink_attacks: raise RuntimeError('FD_RELATIVE_REMOVAL_UNSUPPORTED')
        parent_fd = os.open(parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        p = os.fstat(parent_fd)
        if (str(p.st_dev), str(p.st_ino)) != (request['scratch']['parentDev'], request['scratch']['parentIno']): raise RuntimeError('PARENT_CHANGED')
        if old.digest(HERE/'run-once/result.json') != request['originalRecordSha256']: raise RuntimeError('ORIGINAL_CHANGED')
        if old.digest(HERE/'retained-lstat.json') != request['diagnosticSha256']: raise RuntimeError('DIAGNOSTIC_CHANGED')
        prior = json.loads((HERE/'retained-lstat.json').read_text())
        expected = {row[0]: row for row in prior['records']}
        def inventory():
            root_stat = root.lstat()
            if not stat.S_ISDIR(root_stat.st_mode) or (str(root_stat.st_dev), str(root_stat.st_ino)) != ('16777234', '123644157') or root_stat.st_uid != os.getuid(): raise RuntimeError('ROOT_CHANGED')
            pending = [root]; rows = []; total = 0
            while pending:
                path = pending.pop(); fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
                try:
                    with os.scandir(fd) as entries:
                        for entry in entries:
                            s = entry.stat(follow_symlinks=False); name = str((path/entry.name).relative_to(root))
                            if s.st_uid != os.getuid() or s.st_dev != root_stat.st_dev: raise RuntimeError('CHILD_OWNER_OR_DEVICE')
                            kind = 'directory' if stat.S_ISDIR(s.st_mode) else 'regular' if stat.S_ISREG(s.st_mode) else 'unsupported'
                            if kind == 'unsupported' or kind == 'regular' and s.st_nlink != 1: raise RuntimeError('CHILD_TYPE_OR_LINKS')
                            row = [name, kind, str(s.st_dev), str(s.st_ino), s.st_size, oct(stat.S_IMODE(s.st_mode)), s.st_uid]
                            if expected.get(name) != row: raise RuntimeError('CHILD_CHANGED')
                            rows.append(row)
                            if len(rows) > 128: raise RuntimeError('ENTRY_LIMIT')
                            if kind == 'directory': pending.append(path/entry.name)
                            else: total += s.st_size
                            if total > 4194304: raise RuntimeError('BYTE_LIMIT')
                finally: os.close(fd)
            if len(rows) != len(expected): raise RuntimeError('CHILD_SET_CHANGED')
            return {'entries': len(rows), 'regularBytes': total, 'sha256': hashlib.sha256(json.dumps(sorted(rows)).encode()).hexdigest()}
        observed = inventory()
        try: os.killpg(87104, 0)
        except ProcessLookupError: result['groupObservation'] = 'ESRCH'
        else: raise RuntimeError('GROUP_PRESENT')
        supervisor_path = ROOT/'tools/owned-process-supervision/supervise.py'
        if old.digest(supervisor_path) != '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d': raise RuntimeError('SUPERVISOR_CHANGED')
        supervisor = load('eng01l_cleanup_supervisor', supervisor_path)
        report = supervisor.supervise(supervisor.Launch(('/usr/sbin/lsof', '-nP', '-Fpcn', '+D', str(root)), str(ROOT), {'PATH': '/usr/bin:/bin:/usr/sbin', 'LANG': 'C'}, supervisor.Ownership.CHILD_PID_ONLY), supervisor.Policy(.75, 0, .2, 1024))
        row = dataclasses.asdict(report); row.pop('stdout'); row.pop('stderr'); result['lsof'] = row
        old.save(out/'lsof.stdout', report.stdout); old.save(out/'lsof.stderr', report.stderr)
        if report.exit_code != 1 or report.stdout or report.stderr or report.owned_state != 'absent' or not all(report.eof.values()) or report.signals or report.secondary_failures or (report.first_failure or {}).get('code') != 'CHILD_EXIT_NONZERO': raise RuntimeError('OPEN_CONSUMER_UNKNOWN')
        policy = old.read_small(root/request['policy']['path'], 24576)
        if hashlib.sha256(policy).hexdigest() != request['policy']['sha256']: raise RuntimeError('POLICY_CHANGED')
        old.save(out/'policy.sb', policy)
        files = {name: old.file_fact(root/'workspace'/name) for name in request['workspace']}
        if any(value['hex'] != '30' for value in files.values()): raise RuntimeError('SYNTHETIC_CONTENT_CHANGED')
        launch_target = request['workspace']['calculator.mjs']['observedAtLaunchIdentity']
        if (files['calculator.mjs']['dev'], files['calculator.mjs']['ino']) != (launch_target['device'], launch_target['inode']): raise RuntimeError('CALCULATOR_CHANGED')
        result.update({'inventory': observed, 'filesObservedNow': files, 'baselineBeforeInode': 'NOT_PERSISTED', 'policySha256': request['policy']['sha256'],
                       'root': request['scratch'], 'requestSha256': old.digest(request_path), 'entrySha256': old.digest(Path(__file__)), 'state': 'READY_FOR_EXACT_REMOVAL'})
        if old.measure(out, 32768) + Path(__file__).stat().st_size + 6144 > 32768: raise RuntimeError('EVIDENCE_LIMIT')
        old.save(out/'checkpoint-before-removal.json', result)
        if inventory() != observed or deadline - time.monotonic() < .7: raise RuntimeError('FINAL_IDENTITY_OR_DEADLINE')
        shutil.rmtree(root.name, dir_fd=parent_fd)
        os.fsync(parent_fd)
        result.update({'state': 'REMOVED', 'removed': not root.exists()})
    except Exception as error:
        result['primaryFailure'] = {'code': str(error) if isinstance(error, RuntimeError) else 'CLEANUP_EXCEPTION', 'type': type(error).__name__}
        result['state'] = 'UNKNOWN_KEEP_OR_PARTIAL'
    finally:
        if parent_fd is not None: os.close(parent_fd)
    result['elapsedMs'] = round((time.monotonic() - start) * 1000)
    old.save(out/'result.json', result)
    print(json.dumps({'state': result['state'], 'removed': result['removed'], 'elapsedMs': result['elapsedMs']}), flush=True)
    signal.setitimer(signal.ITIMER_REAL, 0)
    return 0 if result['removed'] and result['primaryFailure'] is None else 1

if __name__ == '__main__':
    if sys.argv[1:] != ['--run']: raise SystemExit(64)
    raise SystemExit(main())

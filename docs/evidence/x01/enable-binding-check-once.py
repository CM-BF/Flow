"""Thin X01 caller of the fixed OPS14 supervisor. Preparation is not execution permission."""
import time
ENTRY_STARTED = time.monotonic()
import dataclasses
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import stat
import sys
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/evidence/x01'
RUN = EVIDENCE / 'enable-binding-stage-a-run-r2'
SUPERVISOR = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
SUPERVISOR_SHA = '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
FLOOR = 1_107_296_256
RAW_LIMIT, STREAM_LIMIT, TAIL_RESERVE = 524_288, 458_752, 65_536
OUTPUTS = {'reservation.json', 'admission.json', 'preflight.stdout', 'strict-launch.json', 'strict.stdout',
           'tests-launch.json', 'tests.stdout', 'fixture.json', 'receipt.json'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_regular(path, maximum):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_size > maximum:
            raise ValueError('Unexpected input kind or size')
        data = bytearray()
        while len(data) <= maximum:
            chunk = os.read(fd, min(65_536, maximum + 1 - len(data)))
            if not chunk:
                break
            data.extend(chunk)
        after = os.fstat(fd)
        if len(data) > maximum or len(data) != before.st_size or (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns):
            raise ValueError('Input changed while reading')
        return bytes(data), before
    finally:
        os.close(fd)


def supervision_facts(result, label):
    """Preserve OPS14 history; qualify its final ownership and capture facts."""
    facts = dataclasses.asdict(result)
    facts.pop('stdout'); facts.pop('stderr')
    facts['label'] = label
    facts['rawComplete'] = (result.owned_state == 'absent' and result.exit_code is not None
                            and all(result.eof.values()) and result.observed_bytes == result.retained_bytes)
    # Historical observations are audit data, not failures. Signal uncertainty is not recoverable here.
    failures = [result.first_failure, *result.secondary_failures]
    uncertain = (not facts['rawComplete'] or any(x and x['code'] != 'CHILD_EXIT_NONZERO' for x in failures)
                 or any(x['state'] == 'unknown' for x in result.signals))
    return facts, uncertain


def main():
    if (len(sys.argv) != 5 or sys.argv[1] != '--mika-approved-once'
            or not re.fullmatch('[a-f0-9]{40}', sys.argv[2])
            or not Path(sys.argv[3]).is_absolute() or not re.fullmatch('[a-f0-9]{64}', sys.argv[4])):
        raise ValueError('Reviewed HEAD and a separately issued admission path/hash are required')
    started = ENTRY_STARTED
    deadline = started + 30
    expected_head = sys.argv[2]
    nonce = uuid.uuid4().hex
    report = {'kind': 'X01_LOCAL_CHECK', 'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'reviewedHead': expected_head, 'sourceCommit': 'ade4efa0a332f4f1f1cbcd50012ab8881f41a8dc',
              'nonce': nonce, 'steps': [], 'failure': None, 'unknown': False, 'artifacts': [],
              'limits': {'seconds': 30, 'rawBytes': RAW_LIMIT, 'streamBytes': STREAM_LIMIT,
                         'tailReservedBytes': TAIL_RESERVE, 'temporarySampleBytes': 33_554_432},
              'PG': 0, 'provider': 0, 'temporaryPeakBoundProven': False}
    run_identity = None
    temporary = None
    observed_streams = 0
    ops = None

    def gate(reserve=0):
        if time.monotonic() + reserve >= deadline:
            raise TimeoutError('X01 remaining deadline is exhausted')

    def persist(name, data):
        maximum = {'reservation.json': 2048, 'admission.json': 8192, 'receipt.json': 16_384}.get(name, STREAM_LIMIT)
        if name not in OUTPUTS or len(data) > maximum:
            raise ValueError('Unexpected artifact')
        parent = os.open(RUN, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            current = os.fstat(parent)
            if (current.st_dev, current.st_ino) != run_identity:
                raise ValueError('Evidence identity changed')
            fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=parent)
            item = {'name': name, 'dev': None, 'ino': None, 'complete': False}
            report['artifacts'].append(item)
            try:
                identity = os.fstat(fd)
                item.update({'dev': identity.st_dev, 'ino': identity.st_ino})
                pending = data
                while pending:
                    written = os.write(fd, pending)
                    if written <= 0:
                        raise OSError('Artifact write made no progress')
                    pending = pending[written:]
                os.fsync(fd)
            finally:
                os.close(fd)
            os.fsync(parent)
            item.update({'complete': True, 'bytes': len(data), 'sha256': sha(data)})
        except Exception:
            report['unknown'] = True
            raise
        finally:
            os.close(parent)

    def save_json(name, value):
        persist(name, json.dumps(value, ensure_ascii=True, separators=(',', ':')).encode() + b'\n')

    def verify(row):
        gate(3)
        data, _ = read_regular(ROOT / row['path'], row['bytes'])
        if len(data) != row['bytes'] or sha(data) != row['sha256']:
            raise ValueError('Fixed input differs')

    def supervise(label, argv, env, seconds):
        nonlocal observed_streams
        gate(3)
        if observed_streams >= STREAM_LIMIT:
            raise ValueError('No remaining stream budget')
        result = ops.supervise(ops.Launch(tuple(argv), str(ROOT), env, ops.Ownership.NEW_CHILD_SESSION, ops.Capture.MERGED),
                               ops.Policy(min(seconds, deadline - time.monotonic() - 3), .25, .75,
                                          min(4096 if label == 'preflight' else STREAM_LIMIT, STREAM_LIMIT - observed_streams)))
        observed_streams += result.observed_bytes
        facts, uncertain = supervision_facts(result, label)
        report['unknown'] |= uncertain
        report['steps'].append(facts)
        persist(label + '.stdout', result.stdout)
        if uncertain:
            raise RuntimeError('Owned supervision is incomplete or uncertain')
        return result

    def sample_temporary():
        gate(1)
        current = temporary['path'].lstat()
        if not stat.S_ISDIR(current.st_mode) or (current.st_dev, current.st_ino) != (temporary['dev'], temporary['ino']):
            raise ValueError('Temporary root identity changed')
        queue, count, size = [temporary['path']], 0, 0
        while queue:
            gate(1)
            with os.scandir(queue.pop()) as entries:
                for entry in entries:
                    gate(1)
                    count += 1
                    if count > 4096:
                        raise ValueError('Temporary entry sample exceeds limit')
                    info = entry.stat(follow_symlinks=False)
                    if stat.S_ISDIR(info.st_mode):
                        queue.append(Path(entry.path))
                    elif stat.S_ISREG(info.st_mode):
                        size += info.st_size
                    else:
                        raise ValueError('Unknown temporary node is retained')
                    if size > 33_554_432:
                        raise ValueError('Temporary byte sample exceeds limit')
        temporary['lastSample'] = {'entries': count, 'logicalBytes': size}

    try:
        gate(3)
        fixed, _ = read_regular(SUPERVISOR, 12_543)
        if sha(fixed) != SUPERVISOR_SHA:
            raise ValueError('Supervisor binding changed')
        sys.dont_write_bytecode = True
        spec = importlib.util.spec_from_file_location('x01_fixed_ops14', SUPERVISOR)
        ops = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = ops
        spec.loader.exec_module(ops)
        inputs = json.loads(read_regular(EVIDENCE / 'enable-binding-validation-input.json', 65_536)[0])
        support = json.loads(read_regular(EVIDENCE / 'enable-binding-stage-a-input-r2.json', 32_768)[0])
        if str(Path(sys.executable).resolve(strict=True)) != support['pythonRealpath']:
            raise ValueError('Python launch interpreter differs')
        for row in [*inputs['stageA']['inputs'], *inputs['productReview']['inputs'], *inputs['fixedPackageAndConfiguration'], *inputs['preparedArtifacts'], *support['files']]:
            verify(row)
        admission_bytes, _ = read_regular(sys.argv[3], 8192)
        if sha(admission_bytes) != sys.argv[4]:
            raise ValueError('Independent admission receipt differs')
        admission = json.loads(admission_bytes)
        expected_claim = json.loads(read_regular(EVIDENCE / 'enable-binding-amend-v8.json', 8192)[0])['claim']
        claim = admission.get('claim', {})
        claim_fields = ('claimId', 'version', 'lead', 'worker', 'role', 'taskId', 'state', 'branch', 'worktree', 'scope')
        if (admission.get('kind') != 'X01_LOCAL_CHECK_OPEN' or admission.get('state') != 'OPEN'
                or admission.get('lead') != 'mika' or admission.get('reviewedHead') != expected_head
                or not re.fullmatch('[a-f0-9]{32}', admission.get('windowId', ''))
                or any(claim.get(key) != expected_claim[key] for key in claim_fields)):
            raise ValueError('Fresh claim identity or independent window does not match')
        observed_at = datetime.datetime.fromisoformat(admission['ledgerObservedAt'].replace('Z', '+00:00'))
        def admission_is_fresh():
            age = (datetime.datetime.now(datetime.timezone.utc) - observed_at).total_seconds()
            if not 0 <= age <= 60:
                raise ValueError('Independent fresh ledger receipt expired')
        admission_is_fresh()
        report['admission'] = {'sha256': sha(admission_bytes), 'windowId': admission['windowId'],
                               'ledgerObservedAt': admission['ledgerObservedAt']}
        dependencies = json.loads(read_regular(EVIDENCE / 'enable-binding-dependency-view-request.json', 32_768)[0])
        for row in dependencies['links']:
            gate(3)
            path = Path(row['destination'])
            if not path.is_symlink() or str(path.resolve(strict=True)) != row['target']:
                raise ValueError('Dependency view is not the reviewed exact link')
            data, _ = read_regular(row['packageJson']['realpath'], row['packageJson']['bytes'])
            if sha(data) != row['packageJson']['sha256']:
                raise ValueError('Dependency metadata changed')
        for row in [*dependencies['tools'], *dependencies['transitivePackageMetadata'], *support['external']]:
            gate(3)
            if str(Path(row['path']).resolve(strict=True)) != row['realpath']:
                raise ValueError('Tool or dependency realpath changed')
            data, _ = read_regular(row['realpath'], row['bytes'])
            if sha(data) != row['sha256']:
                raise ValueError('Tool or dependency bytes changed')
        free = os.statvfs(ROOT).f_bavail * os.statvfs(ROOT).f_frsize
        report['freeBeforeBytes'] = free
        if free < FLOOR or os.path.lexists(RUN):
            raise ValueError('Resource gate failed or this window was already consumed')
        admission_is_fresh()
        os.mkdir(RUN, 0o700)
        report['evidenceRoot'] = {'path': str(RUN), 'dev': None, 'ino': None}
        info = RUN.lstat(); run_identity = (info.st_dev, info.st_ino)
        report['evidenceRoot'] = {'path': str(RUN), 'dev': info.st_dev, 'ino': info.st_ino}
        save_json('reservation.json', {'nonce': nonce, 'reviewedHead': expected_head, 'startedAt': report['startedAt'], 'consumed': True})
        persist('admission.json', admission_bytes)
        git_env = {'PATH': '/usr/bin:/bin', 'GIT_OPTIONAL_LOCKS': '0', 'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null'}
        preflight = supervise('preflight', ['/usr/bin/git', 'status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'], git_env, 1)
        lines = [line for line in preflight.stdout.decode('utf8').split('\0') if line]
        owned_untracked = {'? ' + str((RUN / name).relative_to(ROOT)) for name in ('reservation.json', 'admission.json')}
        if (preflight.exit_code != 0 or '# branch.oid ' + expected_head not in lines
                or '# branch.head codex/plugin-enable-binding' not in lines
                or any(not line.startswith('# ') and line not in owned_untracked for line in lines)):
            raise ValueError('Reviewed HEAD, branch or complete clean state differs')
        gate(3)
        created = Path(tempfile.mkdtemp(prefix='flow-x01-local-'))
        temporary = {'path': created, 'dev': None, 'ino': None, 'removed': False}
        info = created.lstat(); temporary.update({'dev': info.st_dev, 'ino': info.st_ino})
        for name in ['tmp', 'cache']:
            (created / name).mkdir(mode=0o700)
        env = {'PATH': '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin', 'LANG': 'C.UTF-8', 'CI': '1',
               'TMPDIR': str(created / 'tmp'), 'TMP': str(created / 'tmp'), 'TEMP': str(created / 'tmp'), 'NODE_DISABLE_COMPILE_CACHE': '1',
               'FLOW_X01_BINDING_CACHE': str(created / 'cache'), 'FLOW_X01_EXECUTION_EVIDENCE': str(RUN / 'fixture.json')}
        for label, seconds in [('strict', 8), ('tests', 14)]:
            gate(3)
            admission_is_fresh()
            if os.statvfs(ROOT).f_bavail * os.statvfs(ROOT).f_frsize < FLOOR:
                raise ValueError('Resource reserve changed before next command')
            result = supervise(label, [sys.executable, str(EVIDENCE / 'enable-binding-launch.py'), label, nonce, str(run_identity[0]), str(run_identity[1])], env, seconds)
            try:
                checkpoint = json.loads(read_regular(RUN / (label + '-launch.json'), 4096)[0])
                if checkpoint.get('nonce') != nonce or checkpoint.get('label') != label or checkpoint.get('pid') != result.pid or checkpoint.get('pgid') != result.pid:
                    raise ValueError('Same-PID launch checkpoint differs')
            except Exception:
                report['unknown'] = True
                raise
            sample_temporary()
            if result.exit_code != 0:
                raise RuntimeError('Business check failed; complete raw is retained')
            if label == 'tests':
                parsed = json.loads(result.stdout)
                report['selected'] = parsed.get('numTotalTests'); report['passed'] = parsed.get('numPassedTests')
                if parsed.get('success') is not True or (parsed.get('numTotalTests'), parsed.get('numPassedTests'), parsed.get('numFailedTests'), parsed.get('numPendingTests')) != (17, 17, 0, 0):
                    raise ValueError('Expected selected/pass counts were not observed')
                if {x.get('name') for x in parsed.get('testResults', [])} != {str(ROOT / 'packages/contracts/src/plugin-runtime.test.ts'), str(ROOT / 'apps/runner/src/plugins/execution.test.ts')}:
                    raise ValueError('Selected test files differ')
                fixture = json.loads(read_regular(RUN / 'fixture.json', 16_384)[0])
                if len(fixture.get('roots', [])) != 11 or len(fixture.get('children', [])) != 11 or fixture.get('retained') != [] or any(not x.get('removed') for x in fixture['roots']) or any(x.get('exitCode') != 0 or x.get('signal') is not None for x in fixture['children']):
                    raise ValueError('Owned fixture cleanup or child evidence is incomplete')
                if any(Path(x['path']).parent != created / 'tmp' or not Path(x['path']).name.startswith('flow-x01-execution-')
                       or type(x.get('dev')) is not int or type(x.get('ino')) is not int or os.path.lexists(x['path']) for x in fixture['roots']):
                    raise ValueError('Fixture root identities or absence do not match the owned namespace')
                if any(type(x.get('pid')) is not int or x['pid'] <= 0 for x in fixture['children']):
                    raise ValueError('Fixture child identities are missing')
                report['fixtureConfirmed'] = True
    except Exception as error:
        report['failure'] = {'type': type(error).__name__, 'code': 'CHECK_WINDOW_FAILED'}
        if isinstance(error, (OSError, TimeoutError)):
            report['unknown'] = True
    finally:
        if temporary is not None:
            try:
                if report['unknown'] or any(not x['rawComplete'] for x in report['steps']):
                    raise ValueError('Uncertain child or stream forbids temporary cleanup')
                sample_temporary()
                gate(1)
                shutil.rmtree(temporary['path'])
                temporary['removed'] = not os.path.lexists(temporary['path'])
                if not temporary['removed']:
                    raise ValueError('Temporary cleanup is unconfirmed')
            except Exception:
                report['unknown'] = True
            report['temporary'] = {**temporary, 'path': str(temporary['path'])}
        report['observedStreamBytes'] = observed_streams
        report['elapsedBeforeReceiptMs'] = (time.monotonic() - started) * 1000
        report['elapsedBasis'] = 'before final receipt; OPS14 does not supervise caller persistence'
        try:
            if run_identity is None:
                raise ValueError('No owned output directory')
            save_json('receipt.json', report)
            disk_bytes = 0
            for path in RUN.iterdir():
                if path.name not in OUTPUTS:
                    raise ValueError('Unexpected output is retained')
                data, info = read_regular(path, RAW_LIMIT)
                if stat.S_IMODE(info.st_mode) != 0o600:
                    raise ValueError('Unexpected output mode')
                disk_bytes += len(data)
            elapsed = (time.monotonic() - started) * 1000
            incomplete_observed = sum(x['observed_bytes'] - x['retained_bytes'] for x in report['steps'])
            complete = not report['unknown'] and all(x['rawComplete'] for x in report['steps'])
            cli = {'receiptWritten': True, 'failure': report['failure'], 'unknown': report['unknown'],
                   'rawDiskBytes': disk_bytes, 'rawLimitBytes': RAW_LIMIT, 'elapsedBeforeCliMs': elapsed,
                   'observedUnretainedBytes': incomplete_observed, 'rawAccountingComplete': complete,
                   'temporaryRemoved': bool(temporary and temporary['removed']), 'selected': report.get('selected'), 'passed': report.get('passed'),
                   'wholeToolExitRequiresExternalObservation': True}
            # Reserve the bounded CLI before encoding it; rawDiskBytes already includes retained streams.
            cli['knownChargeWithCliReserve'] = disk_bytes + incomplete_observed + 8192
            cli['withinKnownRawBudget'] = cli['knownChargeWithCliReserve'] <= RAW_LIMIT
            success = report['failure'] is None and complete and elapsed < 30_000 and cli['withinKnownRawBudget']
            encoded = json.dumps(cli, separators=(',', ':')).encode() + b'\n'
            if len(encoded) > 8192:
                raise ValueError('CLI exceeds its reserved tail')
            os.write(1, encoded)
            return 0 if success and cli['withinKnownRawBudget'] else 1
        except Exception:
            # Do not lose known resource identity if the final persistence itself failed.
            safe = {'receiptWritten': False, 'unknown': True, 'evidenceRoot': report.get('evidenceRoot'),
                    'temporary': report.get('temporary'), 'steps': [{'pid': x['pid'], 'owned_state': x['owned_state']} for x in report['steps']]}
            os.write(1, json.dumps(safe, separators=(',', ':')).encode() + b'\n')
            return 1


if __name__ == '__main__':
    raise SystemExit(main())

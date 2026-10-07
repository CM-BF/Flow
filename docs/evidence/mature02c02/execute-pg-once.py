"""One explicitly opened C02 public-API validation, using the existing owned subprocess pattern.
No import-time execution. Unknown lifecycle retains the exact owned temp root and DB receipt.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import selectors
import shutil
import signal
import stat
import subprocess
import tempfile
import time

WT = Path(__file__).resolve().parents[3]
EVIDENCE = WT / 'docs/evidence/mature02c02'
NODE = '/opt/homebrew/opt/node@24/bin/node'
RAW_LIMIT = 32768


def save(path, value):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n'); stream.flush(); os.fsync(stream.fileno())


def read_json(path, maximum):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > maximum:
            raise ValueError('RECEIPT_BOUND')
        value = os.read(fd, maximum + 1)
        if len(value) != info.st_size:
            raise ValueError('RECEIPT_CHANGED')
        return json.loads(value), {'bytes': len(value), 'sha256': hashlib.sha256(value).hexdigest(), 'dev': info.st_dev, 'ino': info.st_ino}
    finally:
        os.close(fd)


def group_state(pid):
    try: os.killpg(pid, 0); return 'present'
    except ProcessLookupError: return 'absent'
    except OSError: return 'unknown'


def stop_group(child):
    actions, observations = [], []
    for action in [signal.SIGTERM, signal.SIGKILL]:
        state = group_state(child.pid); observations.append(state)
        if state != 'present': return {'state': state, 'signals': actions, 'observations': observations}
        try: os.killpg(child.pid, action); actions.append(int(action))
        except ProcessLookupError: return {'state': 'absent', 'signals': actions, 'observations': observations}
        except OSError as error: return {'state': 'unknown', 'signals': actions, 'observations': observations, 'signalErrno': error.errno}
        try: child.wait(timeout=.5)
        except subprocess.TimeoutExpired: pass
    state = group_state(child.pid); observations.append(state)
    return {'state': state, 'signals': actions, 'observations': observations}


def temp_sample(root, identity, deadline):
    current = root.lstat()
    if not stat.S_ISDIR(current.st_mode) or (current.st_dev, current.st_ino) != identity:
        raise ValueError('TEMP_IDENTITY')
    pending, count, size = [(root, 0)], 0, 0
    while pending:
        if time.monotonic() >= deadline: raise ValueError('TEMP_SAMPLE_DEADLINE')
        directory, depth = pending.pop()
        if depth > 8: raise ValueError('TEMP_DEPTH')
        with os.scandir(directory) as entries:
            for entry in entries:
                if time.monotonic() >= deadline: raise ValueError('TEMP_SAMPLE_DEADLINE')
                count += 1
                if count > 4096: raise ValueError('TEMP_ENTRIES')
                info = entry.stat(follow_symlinks=False)
                if stat.S_ISDIR(info.st_mode): pending.append((Path(entry.path), depth + 1))
                elif stat.S_ISREG(info.st_mode): size += info.st_size
                else: raise ValueError('TEMP_SPECIAL')
    return {'entries': count, 'logicalBytes': size, 'activePeak': 'unknown'}


def verify_dependencies(links, inputs):
    source = {row['path']: row for row in inputs}
    counts = {'installed-third-party': 0, 'same-worktree-source': 0}
    for row in links:
        link = WT / row['destination']
        if str(link.resolve()) != row['target']: raise SystemExit('DEPENDENCY_PATH_CHANGED')
        if row['kind'] == 'installed-third-party':
            expected_bytes, expected_sha = row['packageJsonBytes'], row['packageJsonSha256']
        elif row['kind'] == 'same-worktree-source':
            relative = (Path(row['target']) / 'package.json').relative_to(WT).as_posix()
            bound = source[relative]
            expected_bytes, expected_sha = bound['bytes'], bound['sha256']
        else: raise SystemExit('DEPENDENCY_KIND_UNKNOWN')
        value = (link / 'package.json').read_bytes()
        if len(value) != expected_bytes or hashlib.sha256(value).hexdigest() != expected_sha: raise SystemExit('DEPENDENCY_CHANGED')
        counts[row['kind']] += 1
    return counts


def main():
    start = time.monotonic(); at = datetime.datetime.now(datetime.timezone.utc)
    window = os.environ.get('FLOW_C02_WINDOW', '')
    if os.environ.get('FLOW_C02_PG_WINDOW') != 'reviewed' or not re.fullmatch(r'[A-Za-z0-9-]{1,64}', window): raise SystemExit('NOT_OPEN')
    if not os.environ.get('FLOW_C02_PG_ADMIN_URL'): raise SystemExit('ADMIN_CONFIGURATION_MISSING')
    expected = os.environ.get('FLOW_C02_EXECUTION_HEAD', '')
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=WT, text=True, timeout=3).strip()
    if head != expected or subprocess.check_output(['git', 'status', '--porcelain'], cwd=WT, timeout=3): raise SystemExit('SOURCE_NOT_FIXED')
    manifest_name = os.environ.get('FLOW_C02_PG_MANIFEST', 'pg-source-manifest.json')
    if manifest_name not in {'pg-source-manifest.json', 'pg-cwd-source-manifest.json'}: raise SystemExit('MANIFEST_NOT_REVIEWED')
    manifest_bytes = (EVIDENCE / manifest_name).read_bytes()
    manifest = json.loads(manifest_bytes)
    for row in manifest['items']:
        value = (WT / row['path']).read_bytes()
        if len(value) != row['bytes'] or hashlib.sha256(value).hexdigest() != row['sha256']: raise SystemExit('INPUT_CHANGED')
    for row in manifest['external']:
        if str(Path(row['path']).resolve()) != row['realpath']: raise SystemExit('EXTERNAL_PATH_CHANGED')
        fd = os.open(row['realpath'], os.O_RDONLY | os.O_NOFOLLOW); digest = hashlib.sha256(); count = 0
        try:
            before = os.fstat(fd)
            if not stat.S_ISREG(before.st_mode): raise SystemExit('EXTERNAL_KIND_CHANGED')
            while True:
                chunk = os.read(fd, 1048576)
                if not chunk: break
                count += len(chunk); digest.update(chunk)
            after = os.fstat(fd)
            if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns): raise SystemExit('EXTERNAL_CHANGED_DURING_READ')
        finally: os.close(fd)
        if count != row['bytes'] or digest.hexdigest() != row['sha256']: raise SystemExit('EXTERNAL_CHANGED')
    verify_dependencies(json.loads((EVIDENCE / 'dependency-link-request.json').read_text())['links'], manifest['items'])
    previous = json.loads((EVIDENCE / 'claim-amend-receipt.json').read_text())['claim']
    ledger = json.loads(subprocess.check_output([NODE, '/Users/citrine/Projects/AgentHarness/Flow/apps/execution-dashboard/src/coordination/cli.mjs', 'list'], cwd=WT, timeout=3, stderr=subprocess.DEVNULL))
    current = next((row for row in ledger['claims'] if row['claimId'] == previous['claimId']), None)
    if ledger['state'] != 'available' or current is None or any(current[key] != previous[key] for key in ['claimId', 'version', 'state', 'role', 'taskId', 'lead', 'worker', 'worktree', 'branch', 'scope']): raise SystemExit('CLAIM_UNKNOWN')
    prefix = str(EVIDENCE / ('pg-' + window))
    suffixes = ['.result.json', '.stdout', '.stderr', '.fixture.json', '.vitest.json', '.reservation.json', '.child.json']
    suffixes += ['.fixture.json' + suffix for suffix in ['.reservation.json', '.create-request.json', '.database.json']]
    for suffix in suffixes:
        try: Path(prefix + suffix).lstat()
        except FileNotFoundError: continue
        raise SystemExit('OUTPUT_EXISTS_NO_RETRY')
    fs = os.statvfs(WT); free = fs.f_bavail * fs.f_frsize
    if free < 1207959552: raise SystemExit('RESOURCE_NOT_RUN')
    record = {'window': window, 'sourceHead': head, 'inputManifest': {'name': manifest_name, 'sha256': hashlib.sha256(manifest_bytes).hexdigest()},
              'startedAt': at.isoformat(), 'freeBefore': free, 'errors': [], 'actualCodex': 0, 'provider': 0}
    errors = record['errors']; root = None; child = None; streams = {}; eof = set(); selector = selectors.DefaultSelector(); observed = 0
    def phase(name, reserve):
        if time.monotonic() + reserve >= start + 120:
            errors.append(name + '_NOT_STARTED_DEADLINE'); return False
        return True
    try:
        root = Path(tempfile.mkdtemp(prefix='flow-c02-pg-window-'))
        record['tempRoot'] = str(root); info = root.lstat(); identity = (info.st_dev, info.st_ino); record['tempIdentity'] = list(identity)
        save(prefix + '.reservation.json', record)
        env = os.environ.copy()
        for name in ['NODE_OPTIONS', 'NODE_COMPILE_CACHE']: env.pop(name, None)
        epoch = int(at.timestamp() * 1000)
        env.update({'TMPDIR': str(root), 'FLOW_C02_TEST_CACHE': str(root / 'vite'), 'NODE_DISABLE_COMPILE_CACHE': '1',
                    'FLOW_C02_PG_RECEIPT': prefix + '.fixture.json', 'FLOW_C02_PG_WORK_UNTIL': str(epoch + 60000),
                    'FLOW_C02_PG_CLEANUP_UNTIL': str(epoch + 110000)})
        command = [NODE, '/Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/vitest.mjs', 'run',
                   '--config', 'docs/evidence/mature02c02/vitest.pg.config.mjs', '--configLoader', 'native',
                   '--reporter=json', '--outputFile=' + prefix + '.vitest.json']
        for channel in ['stdout', 'stderr']:
            streams[channel] = os.fdopen(os.open(prefix + '.' + channel, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), 'wb')
        if time.monotonic() - start >= 10: raise ValueError('PREFLIGHT_DEADLINE')
        child = subprocess.Popen(command, cwd=WT, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        record['pid'] = child.pid
        save(prefix + '.child.json', {'pid': child.pid, 'pgid': child.pid, 'at': datetime.datetime.now(datetime.timezone.utc).isoformat()})
        for channel in ['stdout', 'stderr']:
            pipe = getattr(child, channel); os.set_blocking(pipe.fileno(), False); selector.register(pipe, selectors.EVENT_READ, channel)
        while child.poll() is None or selector.get_map():
            if time.monotonic() - start >= 110: errors.append('WINDOW_DEADLINE'); break
            for key, _ in selector.select(.05):
                chunk = os.read(key.fileobj.fileno(), 16384)
                if not chunk: eof.add(key.data); selector.unregister(key.fileobj); key.fileobj.close(); continue
                before = observed; observed += len(chunk); streams[key.data].write(chunk[:max(0, RAW_LIMIT - before)])
                if observed > RAW_LIMIT: errors.append('RAW_LIMIT'); break
            if errors: break
    except BaseException as error:
        errors.append(type(error).__name__)
    finally:
        try: process = stop_group(child) if child else {'state': 'not-started', 'signals': []}
        except Exception:
            process = {'state': 'unknown', 'signals': []}; errors.append('PROCESS_CLEANUP_UNKNOWN')
        if child:
            try: record['exitCode'] = child.wait(timeout=.5)
            except subprocess.TimeoutExpired: record['exitCode'] = None
        # Only already-available pipe bytes are retained during the bounded close; no second execution.
        drain_until = min(start + 113, time.monotonic() + .5)
        try:
            while selector.get_map() and time.monotonic() < drain_until:
                for key, _ in selector.select(.01):
                    chunk = os.read(key.fileobj.fileno(), 16384)
                    if not chunk: eof.add(key.data); selector.unregister(key.fileobj); key.fileobj.close(); continue
                    before = observed; observed += len(chunk); streams[key.data].write(chunk[:max(0, RAW_LIMIT - before)])
        except Exception: errors.append('STDIO_DRAIN_UNKNOWN')
        for key in list(selector.get_map().values()):
            try: key.fileobj.close()
            except OSError: errors.append('PIPE_CLOSE_UNKNOWN')
        try: selector.close()
        except OSError: errors.append('SELECTOR_CLOSE_UNKNOWN')
        for stream in streams.values():
            try: stream.flush(); os.fsync(stream.fileno()); stream.close()
            except OSError: errors.append('CAPTURE_CLOSE_UNKNOWN')
        record.update({'processGroup': process, 'stdioEof': sorted(eof), 'observedRawBytes': observed, 'rawComplete': observed <= RAW_LIMIT and eof == {'stdout', 'stderr'}})
        if child and (process['state'] != 'absent' or eof != {'stdout', 'stderr'}): errors.append('PROCESS_OR_STDIO_UNKNOWN')
        fixture = None; fixture_confirmed = False
        try:
            if not phase('RECEIPT_READ', 5): raise ValueError('RECEIPT_DEADLINE')
            fixture, record['fixtureBinding'] = read_json(prefix + '.fixture.json', 8192)
            tests, record['vitestBinding'] = read_json(prefix + '.vitest.json', 32768)
            reservation, record['databaseReservationBinding'] = read_json(prefix + '.fixture.json.reservation.json', 8192)
            owned, record['databaseIdentityBinding'] = read_json(prefix + '.fixture.json.database.json', 8192)
            if not isinstance(fixture, dict) or fixture.get('window') != window or fixture.get('sourceHead') != head: raise ValueError('FIXTURE_BINDING')
            if fixture.get('database') != reservation.get('database') or owned.get('database') != reservation.get('database') or owned.get('creationAcknowledged') is not True or owned.get('identity', {}).get('marker') != reservation.get('marker') or fixture.get('databaseIdentity') != owned.get('identity'): raise ValueError('DATABASE_BINDING')
            if not isinstance(owned.get('identity'), dict) or not isinstance(owned['identity'].get('oid'), str) or not re.fullmatch(r'[1-9][0-9]*', owned['identity']['oid']): raise ValueError('DATABASE_OID')
            if not isinstance(tests, dict) or not isinstance(tests.get('testResults'), list): raise ValueError('TEST_RESULT_SHAPE')
            assertions = [case for suite in tests['testResults'] for case in suite['assertionResults']]
            record['selection'] = {'selected': len(assertions), 'passed': sum(case['status'] == 'passed' for case in assertions)}
            if tests.get('success') is not True or len(assertions) != 6 or any(case['status'] != 'passed' for case in assertions): errors.append('TESTS_FAILED_OR_SELECTION')
            cleanup = fixture.get('cleanup')
            if not isinstance(cleanup, dict) or any(cleanup.get(key) is not True for key in ['startupSettled', 'runnersClosed', 'appClosed', 'poolClosed', 'adminClosed', 'databaseIdentityConfirmed', 'databaseAbsent']) or type(cleanup.get('connections')) is not int or cleanup['connections'] != 0 or 'retainedDatabase' not in fixture or fixture['retainedDatabase'] is not None: raise ValueError('CLEANUP_FACTS_UNKNOWN')
            if fixture.get('primaryPhases') != [] or fixture.get('cleanupErrors') != [] or fixture.get('cleanupComplete') is not True or fixture.get('adminError') or fixture.get('poolError'): raise ValueError('FIXTURE_FAILURE')
            if not isinstance(fixture.get('roots'), list) or any(row.get('state') != 'removed' for row in fixture['roots']): raise ValueError('FIXTURE_ROOTS_UNKNOWN')
            if type(fixture.get('databaseLogicalBytes')) is not int or fixture['databaseLogicalBytes'] < 0 or fixture['databaseLogicalBytes'] > 64 * 1024 * 1024: raise ValueError('DATABASE_SAMPLE_BOUND')
            fixture_confirmed = not errors
        except (OSError, ValueError, KeyError, TypeError, AttributeError): errors.append('RESULT_UNKNOWN')
        record['fixtureReceiptConfirmed'] = fixture_confirmed
        record['captures'] = {}
        for channel in streams:
            if not phase('CAPTURE_HASH', 4): break
            try:
                fd = os.open(prefix + '.' + channel, os.O_RDONLY | os.O_NOFOLLOW)
                try:
                    info = os.fstat(fd)
                    if not stat.S_ISREG(info.st_mode) or info.st_size > RAW_LIMIT: raise ValueError('RAW_IDENTITY')
                    value = os.read(fd, RAW_LIMIT + 1)
                    if len(value) != info.st_size: raise ValueError('RAW_CHANGED')
                    record['captures'][channel] = {'bytes': len(value), 'sha256': hashlib.sha256(value).hexdigest(), 'dev': info.st_dev, 'ino': info.st_ino}
                finally: os.close(fd)
            except (OSError, ValueError): errors.append('RAW_IDENTITY_UNKNOWN')
        record['retainedTempRoot'] = str(root) if root else None
        if root and child and process['state'] == 'absent' and eof == {'stdout', 'stderr'} and fixture_confirmed and phase('TEMP_SAMPLE', 4):
            try:
                record['tempFinalSample'] = temp_sample(root, identity, start + 117)
                if record['tempFinalSample']['logicalBytes'] > 32 * 1024 * 1024: errors.append('TEMP_SAMPLE_BOUND')
                if not phase('TEMP_DELETE', 3): raise ValueError('DELETE_DEADLINE')
                current = root.lstat()
                if not stat.S_ISDIR(current.st_mode) or (current.st_dev, current.st_ino) != identity: raise ValueError('TEMP_IDENTITY_CHANGED')
                shutil.rmtree(root)
                if os.path.lexists(root): raise ValueError('ROOT_STILL_PRESENT')
                record['retainedTempRoot'] = None
            except (OSError, ValueError): errors.append('TEMP_CLEANUP_UNKNOWN')
        record['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat(); record['elapsedSeconds'] = time.monotonic() - start
        record['phase'] = 'before-final-receipt'
        record['checksPassed'] = child is not None and record.get('exitCode') == 0 and not errors and record['rawComplete'] and record['retainedTempRoot'] is None and record['elapsedSeconds'] < 120
        receipt_written = False
        try:
            if phase('FINAL_RECEIPT', 1): save(prefix + '.result.json', record); receipt_written = True
        except OSError: errors.append('FINAL_RECEIPT_UNKNOWN')
        delivery = {'finalReceiptWritten': receipt_written, 'elapsedSeconds': time.monotonic() - start}
        delivery['success'] = record['checksPassed'] and receipt_written and not errors and delivery['elapsedSeconds'] < 120
        print(json.dumps({'result': record, 'delivery': delivery}), flush=True)
    raise SystemExit(0 if delivery['success'] else 1)


if __name__ == '__main__':
    main()

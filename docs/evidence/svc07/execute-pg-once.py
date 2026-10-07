#!/usr/bin/env python3
"""One reviewed SVC07 window. No database recovery, service control, or retry."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import selectors
import signal
import stat
import subprocess
import time
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
NODE = '/opt/homebrew/opt/node@24/bin/node'
CLAIM = '3bbb8293-c36d-40c8-a133-723463801943'
OUTPUTS = ['pg-run-reservation.json', 'pg-result.json', 'pg-output.log', 'pg-exit.json', 'pg-tmp']
COMMAND = [NODE, 'node_modules/vitest/vitest.mjs', 'run', 'docs/evidence/svc07/pg-transaction.test.ts',
           '--config', 'docs/evidence/svc07/pg-vitest.config.mjs', '--configLoader', 'runner',
           '--no-cache', '--reporter', 'verbose', '--no-color']


def stamp():
    return datetime.now(timezone.utc).isoformat()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def observe_group(pid, send=os.killpg):
    try:
        send(pid, 0)
        return {'state': 'present', 'errno': None}
    except ProcessLookupError:
        return {'state': 'absent', 'errno': None}
    except OSError as error:
        return {'state': 'unknown', 'errno': error.errno}


def signal_group(pid, action, send=os.killpg):
    try:
        send(pid, action)
        return {'state': 'sent', 'errno': None, 'signal': action}
    except ProcessLookupError:
        return {'state': 'absent', 'errno': None, 'signal': action}
    except OSError as error:
        return {'state': 'unknown', 'errno': error.errno, 'signal': action}


def supervise(command, environment, log, deadline, limit=65536, on_spawn=lambda _: None,
              observe=observe_group, send=signal_group):
    """Private seam for owned children; the production CLI command stays fixed."""
    process = subprocess.Popen(command, cwd=ROOT, env=environment, stdin=subprocess.DEVNULL,
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True)
    spawn = {'pid': process.pid, 'pgid': process.pid, 'startedAt': stamp()}
    retained = observed = 0
    eof = False
    reason = None
    observations, signals, secondary = [], [], []
    selector = None
    try:
        on_spawn(spawn)  # Persist immediately; do not depend on normal return.
        assert process.stdout is not None
        selector = selectors.DefaultSelector()
        selector.register(process.stdout, selectors.EVENT_READ)
        os.set_blocking(process.stdout.fileno(), False)
        while not eof and reason is None:
            if time.monotonic() >= deadline:
                reason = 'DEADLINE'
                break
            for key, _ in selector.select(min(0.05, max(0, deadline - time.monotonic()))):
                chunk = os.read(key.fd, 8192)
                if not chunk:
                    eof = True
                    break
                observed += len(chunk)
                keep = chunk[:max(0, limit - retained)]
                log.write(keep)
                retained += len(keep)
                if observed > limit:
                    reason = 'OUTPUT_LIMIT'
                    break
        if eof and reason is None:
            try:
                process.wait(timeout=max(0.001, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                reason = 'DEADLINE'
    except Exception as error:
        reason = reason or 'SUPERVISION_ERROR'
        secondary.append({'phase': 'capture', 'type': type(error).__name__, 'errno': getattr(error, 'errno', None)})
    # Reap the leader before group observation: a zombie is not a live leader.
    code = process.poll()
    state = observe(process.pid); observations.append(state)
    if reason or code is None or state['state'] != 'absent':
        reason = reason or 'LIFECYCLE_UNKNOWN'
        if state['state'] == 'present':
            sent = send(process.pid, signal.SIGTERM); signals.append(sent)
        try:
            code = process.wait(timeout=0.5)
        except subprocess.TimeoutExpired:
            code = None
        state = observe(process.pid); observations.append(state)
        # An unknown observation/signal is not authority to retry or escalate.
        if state['state'] == 'present' and all(item['state'] != 'unknown' for item in observations + signals):
            signals.append(send(process.pid, signal.SIGKILL))
        if code is None:
            try:
                code = process.wait(timeout=0.5)
            except subprocess.TimeoutExpired:
                reason = reason or 'EXIT_UNKNOWN'
        state = observe(process.pid); observations.append(state)
    for phase, close in [('selector', selector.close if selector else lambda: None),
                         ('pipe', process.stdout.close if process.stdout else lambda: None), ('log', log.flush)]:
        try:
            close()
        except Exception as error:
            secondary.append({'phase': phase, 'type': type(error).__name__, 'errno': getattr(error, 'errno', None)})
            reason = reason or 'CLEANUP_UNKNOWN'
    return {'spawn': spawn, 'pid': process.pid, 'exit': code, 'reason': reason, 'stdoutEof': eof,
            'retainedBytes': retained, 'observedBytes': observed, 'rawComplete': eof and reason is None,
            'groupState': state, 'groupAbsent': state['state'] == 'absent',
            'observations': observations, 'signals': signals, 'secondaryFailures': secondary}


def read_owned_json(path, maximum):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > maximum:
            raise ValueError('Invalid bounded result')
        data = os.read(fd, maximum + 1)
        if len(data) > maximum:
            raise ValueError('Result over budget')
        return json.loads(data), len(data)
    finally:
        os.close(fd)


def preflight(expected_head, expected_manifest):
    manifest_path = HERE / 'pg-prepared-manifest.json'
    if digest(manifest_path) != expected_manifest:
        raise ValueError('Manifest changed')
    packet = json.loads(manifest_path.read_text())
    for entry in packet['files']:
        parts = Path(entry['path']).parts
        if Path(entry['path']).is_absolute() or '..' in parts:
            raise ValueError('Invalid packet path')
        path = ROOT / entry['path']
        if path.is_symlink() or not path.resolve().is_relative_to(ROOT) or path.stat().st_size != entry['bytes'] or digest(path) != entry['sha256']:
            raise ValueError('Input changed')
    if subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, timeout=2).decode().strip() != expected_head:
        raise ValueError('HEAD changed')
    if subprocess.check_output(['git', 'status', '--porcelain=v1'], cwd=ROOT, timeout=2).strip():
        raise ValueError('Worktree not clean')
    for name in OUTPUTS:
        try:
            (HERE / name).lstat()
        except FileNotFoundError:
            continue
        raise ValueError('Existing output must be preserved')
    for entry in json.loads((HERE / 'dependency-links.json').read_text())['entries']:
        link = Path(entry['link'])
        if str(link.resolve()) != entry['realpath'] or digest(link / 'package.json') != entry['packageJsonSha256']:
            raise ValueError('Dependency changed')
    if not os.environ.get('FLOW_SVC07_TEST_ADMIN'):
        raise ValueError('Missing authorized admin configuration')
    ledger_command = [NODE, '/Users/citrine/Projects/AgentHarness/Flow/apps/execution-dashboard/src/coordination/cli.mjs', 'list']
    ledger = subprocess.run(ledger_command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=3, check=True)
    assignments = json.loads(ledger.stdout)
    claim = next(row for row in assignments['claims'] if row['claimId'] == CLAIM)
    if assignments['state'] != 'available' or claim['version'] != 1 or claim['state'] != 'active' or claim['taskId'] != 'SVC07' or claim['role'] != 'writer' or claim['lead'] != 'mika' or claim['worker'] != 'db_transaction_owner' or claim['worktree'] != str(ROOT) or claim['branch'] != 'codex/server-transaction-disconnect':
        raise ValueError('Claim not confirmed')
    if set(claim['scope']) != {'apps/server/src/database.ts', 'apps/server/src/database-transaction.test.ts', 'plans/svc07-transaction-recovery', 'docs/evidence/svc07'}:
        raise ValueError('Claim scope changed')
    disk = os.statvfs(ROOT)
    free = disk.f_bavail * disk.f_frsize
    if free < 1207959552 or free - 67108864 < 1073741824:
        raise ValueError('PG disk floor failed')
    return {'head': expected_head, 'manifestSha256': expected_manifest, 'availableBeforeBytes': free,
            'claimId': CLAIM, 'claimVersion': 1, 'claimObservedAt': assignments['observedAt']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--expected-head', required=True)
    parser.add_argument('--manifest-sha256', required=True)
    args = parser.parse_args()
    beginning = time.monotonic()
    try:
        gate = preflight(args.expected_head, args.manifest_sha256)
    except Exception:
        print(json.dumps({'state': 'HOLD', 'reason': 'Fresh preflight not confirmed; no new attempt opened'}))
        return 2
    record = {'state': 'RUNNING', 'startedAt': stamp(), 'gate': gate, 'command': COMMAND}
    exit_fd = os.open(HERE / 'pg-exit.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(exit_fd, 'w') as receipt:
        receipt.write(json.dumps(record) + '\n'); receipt.flush()
        temporary = HERE / 'pg-tmp'
        temp_identity = None
        try:
            temporary.mkdir(mode=0o700)
            info = temporary.lstat()
            temp_identity = (info.st_dev, info.st_ino)
            record['temporary'] = {'path': str(temporary), 'device': info.st_dev, 'inode': info.st_ino, 'absentAfter': False}
            env = dict(os.environ)
            env.pop('NODE_PG_FORCE_NATIVE', None); env.pop('NODE_COMPILE_CACHE', None)
            env.update(TMPDIR=str(temporary), NODE_DISABLE_COMPILE_CACHE='1', NO_COLOR='1')
            log_fd = os.open(HERE / 'pg-output.log', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            def save_spawn(spawn):
                record['spawn'] = spawn
                receipt.seek(0); receipt.truncate(); receipt.write(json.dumps(record) + '\n'); receipt.flush(); os.fsync(receipt.fileno())
            with os.fdopen(log_fd, 'wb') as log:
                result = supervise(COMMAND, env, log, beginning + 27, on_spawn=save_spawn)
                record['process'] = result  # Preserve primary supervision facts even if log.close fails.
            record['rawSha256'] = digest(HERE / 'pg-output.log')
            details, size = read_owned_json(HERE / 'pg-result.json', 32768)
            _, reservation_size = read_owned_json(HERE / 'pg-run-reservation.json', 32768)
            if size + reservation_size > 32768:
                raise ValueError('Automatic result budget exceeded')
            record['resultBytes'] = size + reservation_size
            record['database'] = {'name': details['database'], 'marker': details['marker'], 'cleanup': details['cleanup']}
            passed = (result['exit'] == 0 and result['rawComplete'] and result['groupAbsent']
                      and details['cleanup']['status'] == 'CONFIRMED' and details['cleanup']['databaseAbsent']
                      and details['cleanup']['connectionsZero'] and details['cleanup']['adminEndAcknowledged']
                      and not details['primaryFailure'] and details['unexpectedPoolErrors'] == 0
                      and len(details['cases']) == 2 and details['terminationRequests'] == 2)
            record['state'] = 'PASSED' if passed else 'UNKNOWN'
        except Exception:
            record['state'] = 'UNKNOWN'
            record['reason'] = 'Execution, evidence, or cleanup was not confirmed; preserve all outputs and fixture identity'
        finally:
            if temp_identity is not None:
                try:
                    latest = temporary.lstat()
                    if (latest.st_dev, latest.st_ino) != temp_identity or not stat.S_ISDIR(latest.st_mode):
                        raise ValueError('Temporary identity changed')
                    temporary.rmdir()  # Retain any unexpected contents; do not recurse.
                    record['temporary']['absentAfter'] = True
                except Exception:
                    record['state'] = 'UNKNOWN'
            record['endedAt'] = stamp()
            record['wallSeconds'] = time.monotonic() - beginning
            if record['wallSeconds'] > 30:
                record['state'] = 'UNKNOWN'
            if record['state'] != 'PASSED':
                record['recovery'] = {'input': 'pg-input.json', 'action': 'Read-only owner reconciliation of this exact database/marker/backend identities; no automatic retry, terminate, or DROP'}
            receipt.seek(0); receipt.truncate(); receipt.write(json.dumps(record, indent=2) + '\n'); receipt.flush()
    print(json.dumps({'state': record['state'], 'wallSeconds': record['wallSeconds'], 'receipt': str(HERE / 'pg-exit.json')}))
    return 0 if record['state'] == 'PASSED' else 1


if __name__ == '__main__':
    raise SystemExit(main())

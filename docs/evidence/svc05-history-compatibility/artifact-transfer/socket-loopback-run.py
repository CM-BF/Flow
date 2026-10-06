"""Single-use supervisor. Only this run's group, checked temp identity and ports."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
NODE = '/opt/homebrew/opt/node@24/bin/node'
RESERVE = 1073741824
FREE_GATE = RESERVE + 8388608


def persist(path, value):
    with path.open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())
    descriptor = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def group_absent(pgid):
    try:
        os.killpg(pgid, 0)
        return False
    except ProcessLookupError:
        return True
    except PermissionError:
        return None


def logical_bytes(root):
    total, count = 0, 0
    for folder, directories, names in os.walk(root, followlinks=False):
        directories[:] = [d for d in directories if not (Path(folder) / d).is_symlink()]
        for name in names:
            count += 1
            if count > 512:
                raise RuntimeError('FILE_COUNT_LIMIT')
            total += (Path(folder) / name).lstat().st_size
    return total


if len(sys.argv) != 2 or '/' in sys.argv[1] or not sys.argv[1].startswith('socket-once-'):
    raise SystemExit('NEW_FIXED_EVIDENCE_NAME_REQUIRED')
destination = HERE / sys.argv[1]
if shutil.disk_usage(HERE).free < FREE_GATE:
    raise SystemExit('SPACE_GATE')
destination.mkdir(mode=0o700)
started = time.monotonic()
reservation = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'sourceSha256': hashlib.sha256((HERE / 'socket-loopback.mjs').read_bytes()).hexdigest(),
               'supervisorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
               'workMs': 35000, 'cleanupMs': 10000, 'state': 'reserved-one-shot'}
persist(destination / 'reservation.json', reservation)
stopped = None
minimum_free = shutil.disk_usage(HERE).free
peak_raw = peak_temp = 0
private = None
child_evidence = destination / 'evidence'
environment = {'PATH': '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin', 'LANG': 'C',
               'LC_ALL': 'C', 'NODE_ENV': 'production', 'TMPDIR': '/private/tmp'}
with (destination / 'stdout.txt').open('xb') as stdout, (destination / 'stderr.txt').open('xb') as stderr:
    process = subprocess.Popen([NODE, str(HERE / 'socket-loopback.mjs'), str(child_evidence)],
                               cwd=HERE, env=environment, stdout=stdout, stderr=stderr, start_new_session=True)
    persist(destination / 'process-start.json', {'pid': process.pid, 'pgid': process.pid})
    while process.poll() is None:
        elapsed = time.monotonic() - started
        free = shutil.disk_usage(HERE).free
        minimum_free = min(minimum_free, free)
        try:
            peak_raw = max(peak_raw, logical_bytes(destination))
            child_reservation = child_evidence / 'reservation.json'
            if private is None and child_reservation.exists():
                try:
                    private = json.loads(child_reservation.read_text())
                except json.JSONDecodeError:
                    pass  # Observe again within the same deadline while its first write finishes.
            if private and Path(private['root']).exists():
                peak_temp = max(peak_temp, logical_bytes(Path(private['root'])))
        except Exception:
            stopped = stopped or 'RESOURCE_OBSERVATION_UNKNOWN'
        cleanup_started = (child_evidence / 'cleanup-started.json').exists()
        if not stopped and (free < RESERVE or peak_raw > 1048576 or peak_temp > 4194304):
            stopped = 'RESOURCE_THRESHOLD'
        if not stopped and elapsed >= 35 and not cleanup_started:
            stopped = 'WORK_DEADLINE'
        if stopped and not group_absent(process.pid):
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            # Send once; preserve stop cause without another TERM each sample.
            break
        if elapsed >= 45:
            stopped = 'TOTAL_DEADLINE'
            break
        time.sleep(0.1)
    if process.poll() is None:
        try:
            process.wait(timeout=max(0.001, 45 - (time.monotonic() - started)))
        except subprocess.TimeoutExpired:
            stopped = 'TOTAL_DEADLINE_KILL_KEEP'
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait(timeout=1)
    stdout.flush()
    stderr.flush()
    os.fsync(stdout.fileno())
    os.fsync(stderr.fileno())

absent = group_absent(process.pid)
if absent is False:
    # The leader can exit before its descendants. Stop only this owned group.
    stopped = stopped or 'GROUP_RETAINED'
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    until = min(started + 45, time.monotonic() + 1)
    while time.monotonic() < until and group_absent(process.pid) is False:
        time.sleep(0.05)
    absent = group_absent(process.pid)

checkpoint = child_evidence / 'checkpoint.json'
try:
    facts = json.loads(checkpoint.read_text()) if checkpoint.exists() else None
except (OSError, json.JSONDecodeError):
    facts = None
    stopped = stopped or 'CHECKPOINT_UNREADABLE'
ports = []
if facts:
    for port in facts['ports']:
        if not isinstance(port, int) or port in (61227, 61228):
            stopped = stopped or 'PORT_IDENTITY_UNKNOWN'
            break
        try:
            value = subprocess.run(['/usr/sbin/lsof', '-nP', '-iTCP:' + str(port), '-Fp'],
                                   capture_output=True, timeout=1)
            ports.append({'port': port, 'lsofExit': value.returncode, 'bytes': len(value.stdout),
                          'noKernelEntries': value.returncode == 1 and not value.stdout and not value.stderr})
        except subprocess.SubprocessError:
            ports.append({'port': port, 'noKernelEntries': None, 'error': 'PORT_OBSERVATION_UNKNOWN'})
decision = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'exitCode': process.returncode,
            'stopReason': stopped, 'elapsedMs': round((time.monotonic() - started) * 1000),
            'pgid': process.pid, 'groupAbsent': absent, 'ports': ports,
            'checkpointPresent': facts is not None,
            'checkpointSha256': hashlib.sha256(checkpoint.read_bytes()).hexdigest() if facts else None,
            'minimumObservedFreeBytes': minimum_free, 'peakObservedRawBytes': peak_raw,
            'peakObservedTempLogicalBytes': peak_temp,
            'physicalPeakMeasured': False, 'deleteAllowed': False, 'tmpRemoved': False}
if facts:
    private_root = Path(facts['root'])
    info = private_root.lstat()
    decision['tempIdentityMatches'] = (private is not None and facts['root'] == private['root']
                                       and facts['identity'] == private['identity']
                                       and str(private_root).startswith('/private/tmp/flow-svc05h-sockets-')
                                       and not private_root.is_symlink()
                                       and info.st_dev == facts['identity']['dev'] and info.st_ino == facts['identity']['ino'])
    decision['deleteAllowed'] = (stopped is None and absent is True and ports and all(p['noKernelEntries'] for p in ports)
                                 and decision['tempIdentityMatches']
                                 and process.returncode == 0 and facts['outcome'] != 'FAILED_OR_UNKNOWN'
                                 and facts['cleanup'] == 'SERVERS_STOPPED_TMP_RETAINED_FOR_SUPERVISOR')
persist(destination / 'cleanup-decision.json', decision)
if decision['deleteAllowed']:
    shutil.rmtree(private_root)
    decision['tmpRemoved'] = not private_root.exists()
decision['finalRawBytesBeforeReceipt'] = logical_bytes(destination)
persist(destination / 'operator-result.json', decision)
print(json.dumps({'exitCode': process.returncode, 'outcome': facts.get('outcome') if facts else 'UNKNOWN',
                  'attempts': facts.get('attempts') if facts else None, 'groupAbsent': absent,
                  'tmpRemoved': decision['tmpRemoved'], 'stopReason': stopped}))
sys.exit(0 if process.returncode == 0 and decision['tmpRemoved'] else 1)

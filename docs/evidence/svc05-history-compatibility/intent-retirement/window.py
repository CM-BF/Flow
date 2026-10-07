"""One-step use of the existing supervisor, sharing a durable drain-start deadline."""
import importlib.util
import json
import os
import stat
from pathlib import Path
import time

SPEC = importlib.util.spec_from_file_location('reviewed_supervisor', Path(__file__).resolve().parents[1] / 'center-recovery' / 'supervise.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

def remaining_budget(data, wall, monotonic):
    if data['limitSeconds'] != 900:
        raise RuntimeError('WINDOW_LIMIT')
    wall_elapsed = wall - data['wallStart']
    monotonic_elapsed = monotonic - data['monotonicStart']
    if wall_elapsed < 0 or monotonic_elapsed < 0:
        raise RuntimeError('WINDOW_CLOCK_CHANGED')
    return 900 - max(wall_elapsed, monotonic_elapsed)

def run_step(argv, drain_marker, window_id, begin_drain=False):
    marker = Path(drain_marker)
    if begin_drain:
        # Capture before persistence so fsync latency counts against the total window.
        body = json.dumps({'windowId': window_id, 'wallStart': time.time(), 'monotonicStart': time.monotonic(), 'limitSeconds': 900}).encode()
        fd = os.open(marker, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, 'wb') as stream:
                stream.write(body)
                stream.flush()
                os.fsync(stream.fileno())
            parent = os.open(marker.parent, os.O_RDONLY)
            try: os.fsync(parent)
            finally: os.close(parent)
        except BaseException:
            raise  # No service action has started; preserve the exclusive marker.
    fd = os.open(marker, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        st = os.fstat(stream.fileno())
        if not stat.S_ISREG(st.st_mode) or st.st_uid != os.getuid() or st.st_mode & 0o777 != 0o600 or st.st_size > 1024:
            raise RuntimeError('WINDOW_IDENTITY')
        data = json.loads(stream.read(1025))
    if data['windowId'] != window_id:
        raise RuntimeError('WINDOW_IDENTITY')
    remaining = remaining_budget(data, time.time(), time.monotonic())
    if remaining <= 2:
        return {'outcome': 'NOT_RUN', 'reason': 'TOTAL_DRAIN_DEADLINE', 'elapsedSeconds': 900 - remaining}
    result = MODULE.supervise(argv, work_seconds=min(118, remaining - 2), exit_seconds=2)
    result['totalDrainElapsedSeconds'] = 900 - remaining_budget(data, time.time(), time.monotonic())
    result['totalDrainLimitSeconds'] = 900
    return result

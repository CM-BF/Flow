"""One authorized module-assembly observation; no exported function is invoked."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import selectors
import shutil
import signal
import subprocess
import tempfile
import time

ROOT = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-retained-web-compatibility')
BACKEND = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility')
OUTPUT = Path(__file__).parent
NODE = '/opt/homebrew/opt/node@24/bin/node'
LOADER = ROOT / 'node_modules/tsx/dist/loader.mjs'
CAP = 128 * 1024

def save(name, value):
    with (OUTPUT / name).open('x') as handle:
        json.dump(value, handle, indent=2)
        handle.write('\n')
        handle.flush()
        os.fsync(handle.fileno())
    descriptor = os.open(OUTPUT, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)

def group_state(pid):
    try:
        os.killpg(pid, 0)
        return 'present'
    except ProcessLookupError:
        return 'absent'
    except OSError:
        return 'unknown'

def temp_bytes(path):
    return sum(entry.lstat().st_size for entry in path.rglob('*') if entry.is_file())

entries = [
    ('apps/runner/src/runtime.ts', 'runRunner'),
    ('apps/runner/src/execution-profiles.ts', 'describeExecutionProfile'),
    ('apps/runner/src/verifier.ts', 'verifyText'),
    ('apps/server/src/index.ts', 'createServer'),
]
bindings = []
for relative, export in entries:
    content = (BACKEND / relative).read_bytes()
    fixed = subprocess.check_output(['git', '-C', str(BACKEND), 'show', f'af51c621696230fbced12227670f014ca73bd8a1:{relative}'])
    assert content == fixed
    bindings.append({'path': relative, 'export': export, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
assert shutil.disk_usage(ROOT).free >= 1024**3 + 8 * 1024**2
save('import-reservation.json', {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'entries': bindings, 'attempts': 1, 'wallMs': 10000, 'workMs': 7000, 'cleanupMs': 3000, 'outputLimitBytes': CAP, 'temporaryLimitBytes': 8 * 1024**2, 'exportCalls': 0, 'authorization': 'Lead exact two aliases and import-only; subsequent message adds createServer export without invocation'})
scratch = Path(tempfile.mkdtemp(prefix='flow-svc05r01-import-'))
identity = scratch.stat()
save('import-temp-identity.json', {'path': str(scratch), 'dev': identity.st_dev, 'ino': identity.st_ino})
urls = [(BACKEND / path).as_uri() for path, _ in entries]
code = 'const entries = ' + json.dumps(list(zip(urls, [export for _, export in entries]))) + '; for (const [url, name] of entries) { const m = await import(url); const type = typeof m[name]; console.log(JSON.stringify({ entry: url, export: name, type })); if (type !== "function") throw new Error("missing export"); }'
command = [NODE, '--import', str(LOADER), '--input-type=module', '-e', code]
started = time.monotonic()
child = subprocess.Popen(command, cwd=ROOT, env={'PATH': '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin', 'TSX_DISABLE_CACHE': '1', 'TMPDIR': str(scratch)}, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
save('import-process.json', {'pid': child.pid, 'pgid': child.pid, 'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'node': NODE, 'loader': str(LOADER.resolve()), 'cwd': str(ROOT), 'command': command, 'environmentKeys': ['PATH', 'TSX_DISABLE_CACHE', 'TMPDIR']})
selector = selectors.DefaultSelector()
streams = {'stdout': bytearray(), 'stderr': bytearray()}
for stream, name in [(child.stdout, 'stdout'), (child.stderr, 'stderr')]:
    os.set_blocking(stream.fileno(), False)
    selector.register(stream, selectors.EVENT_READ, name)
reason = None
peak_temp = 0
while selector.get_map() and time.monotonic() - started < 7:
    peak_temp = max(peak_temp, temp_bytes(scratch))
    if peak_temp > 8 * 1024**2:
        reason = 'temporary-limit'
        break
    for key, _ in selector.select(0.025):
        chunk = os.read(key.fileobj.fileno(), 4096)
        if not chunk:
            selector.unregister(key.fileobj)
            continue
        remaining = CAP - sum(map(len, streams.values()))
        streams[key.data].extend(chunk[:remaining])
        if len(chunk) > remaining:
            reason = 'output-limit'
            break
    if reason:
        break
if selector.get_map() and reason is None:
    reason = 'work-deadline'
actions = []
child.poll()
if group_state(child.pid) == 'present':
    os.killpg(child.pid, signal.SIGTERM)
    actions.append('TERM')
while group_state(child.pid) == 'present' and time.monotonic() - started < 9:
    child.poll()
    time.sleep(0.025)
if group_state(child.pid) == 'present':
    os.killpg(child.pid, signal.SIGKILL)
    actions.append('KILL')
while group_state(child.pid) == 'present' and time.monotonic() - started < 10:
    child.poll()
    time.sleep(0.025)
exit_code = child.poll()
group = group_state(child.pid)
peak_temp = max(peak_temp, temp_bytes(scratch))
for name, data in streams.items():
    with (OUTPUT / f'import-{name}.txt').open('xb') as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())
result = {'exitCode': exit_code, 'elapsedMs': round((time.monotonic() - started) * 1000), 'stopReason': reason, 'signals': actions, 'group': group, 'stdoutBytes': len(streams['stdout']), 'stderrBytes': len(streams['stderr']), 'temporaryPeakBytes': peak_temp, 'cacheDisabled': True, 'exportCalls': 0, 'pgStarted': False, 'chromeStarted': False, 'providerCalls': 0, 'sourceBindings': bindings}
save('import-checkpoint.json', result)
current = scratch.stat()
same = (current.st_dev, current.st_ino) == (identity.st_dev, identity.st_ino)
result['tempRemoved'] = False
if group == 'absent' and same:
    shutil.rmtree(scratch)
    result['tempRemoved'] = not scratch.exists()
result['tempIdentityMatches'] = same
result['passed'] = exit_code == 0 and reason is None and group == 'absent' and result['tempRemoved'] and peak_temp <= 8 * 1024**2
save('import-result.json', result)
print(json.dumps(result))

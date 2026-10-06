"""Run only after Mika opens this exact local-check window. No SDK/PG/network target."""
import datetime, hashlib, json, os, pathlib, selectors, shutil, signal, stat, subprocess, sys, tempfile, time

root = pathlib.Path(__file__).resolve().parents[3]
evidence = root / 'docs/evidence/chat06p03'
node = '/opt/homebrew/opt/node@24/bin/node'
main = pathlib.Path('/Users/citrine/Projects/AgentHarness/Flow')
test_file = 'apps/runner/src/assistant-stream/accumulator-incremental.test.ts'
base_test = [node, str(main / 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'docs/evidence/chat06p03/vitest.config.mjs', '--configLoader', 'native', '--reporter=json', test_file]
strict = [node, str(main / 'node_modules/typescript/bin/tsc'), '--noEmit', '--project', 'docs/evidence/chat06p03/tsconfig.json']
if sys.argv[1:] != ['--mika-approved-once']:
    raise SystemExit('A reviewed local-check window is required.')
started = time.monotonic()
deadline = started + 30
receipt = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'limitSeconds': 30, 'rawLimitBytes': 2097152, 'streamLimitBytes': 2031616, 'tailReservedBytes': 65536, 'steps': [], 'providerCalls': 0, 'PG': 0, 'failure': None}
raw_bytes = 0
active = None
owned = None
owned_identity = None
output_names = ['once-reservation.json', 'red.stdout', 'red.stderr', 'red-measurements.json', 'green.stdout', 'green.stderr', 'green-measurements.json', 'strict.stdout', 'strict.stderr', 'check-receipt.json']

def group_absent(pid):
    try: os.killpg(pid, 0); return False
    except ProcessLookupError: return True

def persist(name, value):
    with open(evidence / name, 'x', encoding='utf8') as file:
        json.dump(value, file, indent=2); file.write('\n'); file.flush(); os.fsync(file.fileno())

def run(label, argv, env, maximum):
    global active, raw_bytes
    began = time.monotonic()
    timeout = min(deadline - 1, began + maximum)
    if timeout <= began: raise RuntimeError('No remaining check budget')
    record = {'label': label, 'argv': argv, 'exitCode': None, 'elapsedMs': None, 'ownedProcessExited': False, 'pipesReachedEOF': False, 'streamsClosed': False, 'ownedGroupAbsent': False}
    receipt['steps'].append(record)
    streams = []
    selector = selectors.DefaultSelector()
    try:
        active = subprocess.Popen(argv, cwd=root, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        for suffix, pipe in [('stdout', active.stdout), ('stderr', active.stderr)]:
            file = open(evidence / (label + '.' + suffix), 'xb'); streams.append(file)
            os.set_blocking(pipe.fileno(), False); selector.register(pipe, selectors.EVENT_READ, file)
        while selector.get_map():
            if time.monotonic() >= timeout: raise RuntimeError('Check deadline exceeded')
            for key, _ in selector.select(min(0.05, max(0, timeout - time.monotonic()))):
                chunk = os.read(key.fileobj.fileno(), 65536)
                if not chunk: selector.unregister(key.fileobj); continue
                raw_bytes += len(chunk)
                if raw_bytes > receipt['streamLimitBytes']: raise RuntimeError('Raw byte budget exceeded')
                key.data.write(chunk)
        record['pipesReachedEOF'] = True
        record['exitCode'] = active.wait(timeout=max(0.01, timeout - time.monotonic()))
        record['ownedProcessExited'] = True
        record['ownedGroupAbsent'] = group_absent(active.pid)
        if not record['ownedGroupAbsent']: raise RuntimeError('Owned process group remains after leader exit')
    finally:
        if active and not record['ownedGroupAbsent']:
            # Pipe EOF can lag leader exit; terminate only this registered child group.
            try: os.killpg(active.pid, signal.SIGKILL); record['cleanupSignal'] = 'SIGKILL'
            except ProcessLookupError: record['cleanupSignal'] = 'group-absent'
            try: active.wait(timeout=max(0.01, deadline - time.monotonic())); record['ownedProcessExited'] = True
            except subprocess.TimeoutExpired: record['cleanupUnknown'] = True
            until = min(deadline - 0.5, time.monotonic() + 0.25)
            while not group_absent(active.pid) and time.monotonic() < until: time.sleep(0.005)
            record['ownedGroupAbsent'] = group_absent(active.pid)
        if active:
            for pipe in [active.stdout, active.stderr]:
                if pipe: pipe.close()
        selector.close()
        for file in streams: file.flush(); os.fsync(file.fileno()); file.close()
        record['streamsClosed'] = all(file.closed for file in streams) and (active is None or all(pipe.closed for pipe in [active.stdout, active.stderr] if pipe))
        record['elapsedMs'] = (time.monotonic() - began) * 1000
        active = None
    return record['exitCode']

try:
    free = os.statvfs(root).f_bavail * os.statvfs(root).f_frsize
    receipt['freeBeforeBytes'] = free
    if free < 1107296256: raise RuntimeError('Insufficient resource reserve')
    persist('once-reservation.json', {'startedAt': receipt['startedAt'], 'consumed': True, 'freeBytes': free, 'window': 'red-gated implementation, green public comparison, strict noEmit; no automatic retry'})
    owned = pathlib.Path(tempfile.mkdtemp(prefix='flow-chat06p03-'))
    receipt['ownedTemporaryRoot'] = {'createdPath': str(owned), 'identity': None, 'removed': False}
    identity = owned.lstat(); owned_identity = (identity.st_dev, identity.st_ino)
    receipt['ownedTemporaryRoot']['identity'] = {'dev': identity.st_dev, 'ino': identity.st_ino}
    if not stat.S_ISDIR(identity.st_mode): raise RuntimeError('Owned temporary root is not a directory')
    env = dict(os.environ); env.update({'CHAT06P03_MEASUREMENTS': 'red-measurements.json', 'CHAT06P03_CACHE_DIR': str(owned / 'vite-cache'), 'TMPDIR': str(owned), 'TMP': str(owned), 'TEMP': str(owned)})
    red_code = run('red', base_test + ['-t', 'public coalescer preserves'], env, 8)
    red = json.loads((evidence / 'red.stdout').read_text())
    assertions = [a for suite in red['testResults'] for a in suite['assertionResults'] if a['status'] == 'failed']
    if red_code != 1 or red['numFailedTests'] != 1 or len(assertions) != 1 or '294912' not in ''.join(assertions[0]['failureMessages']):
        raise RuntimeError('Red was not the intended repeated-prefix byte-count assertion')
    source = root / 'apps/runner/src/assistant-stream/accumulator.ts'
    old = (evidence / 'baseline/accumulator.ts').read_text()
    if source.read_text() != old: raise RuntimeError('Production source differs from the fixed red baseline')
    new = old.replace("import { createHash } from 'node:crypto';", "import { createHash, type Hash } from 'node:crypto';")
    new = new.replace('content:string; sent:number; revision:number;', 'content:string; sent:number; sentBytes:number; prefixHash:Hash; revision:number;')
    new = new.replace("content:'',sent:0,revision:0", "content:'',sent:0,sentBytes:0,prefixHash:createHash('sha256'),revision:0")
    new = new.replace('const fromBytes=Buffer.byteLength(block.content.slice(0,block.sent));\n      block.sent+=text.length;', 'const fromBytes=block.sentBytes;\n      block.sent+=text.length; block.sentBytes+=Buffer.byteLength(text);\n      block.prefixHash.update(text);')
    new = new.replace('prefixDigest:hash(block.content.slice(0,block.sent))', "prefixDigest:block.prefixHash.copy().digest('hex')")
    if new == old or 'prefixDigest:hash(block.content.slice(0,block.sent))' in new: raise RuntimeError('Controlled implementation patch did not match')
    source.write_text(new)
    receipt['implementationSha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
    red_usage = json.loads((evidence / 'red-measurements.json').read_text())['total']
    env['CHAT06P03_PRIOR_BYTES'] = str(red_usage['bytes']); env['CHAT06P03_PRIOR_FRAMES'] = str(red_usage['frames']); env['CHAT06P03_MEASUREMENTS'] = 'green-measurements.json'
    if run('green', base_test, env, 10) != 0: raise RuntimeError('Green comparison failed')
    if run('strict', strict, env, 8) != 0: raise RuntimeError('Strict noEmit failed')
    receipt['syntheticTotal'] = json.loads((evidence / 'green-measurements.json').read_text())['total']
except Exception as error:
    receipt['failure'] = type(error).__name__ + ': ' + str(error)
finally:
    if owned is not None:
        facts = receipt['ownedTemporaryRoot']
        try:
            current = owned.lstat()
            if not stat.S_ISDIR(current.st_mode) or (current.st_dev, current.st_ino) != owned_identity: raise RuntimeError('Owned temporary identity is unknown or changed')
            if not all(step['ownedProcessExited'] and step['ownedGroupAbsent'] and step['streamsClosed'] for step in receipt['steps']): raise RuntimeError('Owned processes or streams are not settled')
            files = list(owned.rglob('*')); sizes = [item.lstat() for item in files]
            facts.update({'entries': len(files), 'logicalBytes': sum(value.st_size for value in sizes if stat.S_ISREG(value.st_mode)), 'allocatedBytes': sum(value.st_blocks * 512 for value in sizes) + current.st_blocks * 512})
            shutil.rmtree(owned); facts['removed'] = not owned.exists()
        except Exception as error:
            facts['cleanupUnknown'] = type(error).__name__ + ': ' + str(error)
            receipt['failure'] = receipt['failure'] or 'Owned temporary cleanup is unknown'
    receipt['rawBytes'] = raw_bytes
    receipt['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    receipt['elapsedBeforeReceiptMs'] = (time.monotonic() - started) * 1000
    receipt['rawAccounting'] = {'streamObservedBytes': raw_bytes, 'streamLimitBytes': 2031616, 'tailReservedBytes': 65536, 'tailIncludes': 'measurement JSON, reservation, this receipt and CLI'}
    persist('check-receipt.json', receipt)
    files = {name: (evidence / name).stat().st_size for name in output_names if (evidence / name).is_file()}
    final_elapsed = (time.monotonic() - started) * 1000
    final = {'elapsedAfterReceiptMs': final_elapsed, 'files': files, 'filesBytes': sum(files.values()), 'cliBytes': 0, 'totalRawBytes': 0, 'withinBudget': False, 'failure': receipt['failure']}
    for _ in range(5):
        final['totalRawBytes'] = final['filesBytes'] + final['cliBytes']
        final['withinBudget'] = final_elapsed <= 30000 and final['totalRawBytes'] <= 2097152
        final['cliBytes'] = len((json.dumps(final) + '\n').encode())
    encoded = json.dumps(final) + '\n'
    sys.stdout.write(encoded); sys.stdout.flush()
    if receipt['failure'] or not final['withinBudget']: sys.exit(1)

"""Run only after Mika opens this exact local-check window. No SDK/PG/network target."""
import datetime, hashlib, json, os, pathlib, selectors, signal, subprocess, sys, time

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
receipt = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'limitSeconds': 30, 'rawLimitBytes': 2097152, 'steps': [], 'providerCalls': 0, 'PG': 0, 'failure': None}
raw_bytes = 0
active = None

def persist(name, value):
    with open(evidence / name, 'x', encoding='utf8') as file:
        json.dump(value, file, indent=2); file.write('\n'); file.flush(); os.fsync(file.fileno())

def run(label, argv, env, maximum):
    global active, raw_bytes
    began = time.monotonic()
    timeout = min(deadline - 1, began + maximum)
    if timeout <= began: raise RuntimeError('No remaining check budget')
    record = {'label': label, 'argv': argv, 'exitCode': None, 'elapsedMs': None, 'ownedProcessExited': False}
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
                if raw_bytes > receipt['rawLimitBytes']: raise RuntimeError('Raw byte budget exceeded')
                key.data.write(chunk)
        record['exitCode'] = active.wait(timeout=max(0.01, timeout - time.monotonic()))
        record['ownedProcessExited'] = True
    finally:
        if active and not record['ownedProcessExited']:
            # Pipe EOF can lag leader exit; terminate only this registered child group.
            try: os.killpg(active.pid, signal.SIGKILL); record['cleanupSignal'] = 'SIGKILL'
            except ProcessLookupError: record['cleanupSignal'] = 'group-absent'
            try: active.wait(timeout=max(0.01, deadline - time.monotonic())); record['ownedProcessExited'] = True
            except subprocess.TimeoutExpired: record['cleanupUnknown'] = True
        if active:
            for pipe in [active.stdout, active.stderr]:
                if pipe: pipe.close()
        selector.close()
        for file in streams: file.flush(); os.fsync(file.fileno()); file.close()
        record['elapsedMs'] = (time.monotonic() - began) * 1000
        active = None
    return record['exitCode']

try:
    free = os.statvfs(root).f_bavail * os.statvfs(root).f_frsize
    receipt['freeBeforeBytes'] = free
    if free < 1107296256: raise RuntimeError('Insufficient resource reserve')
    persist('once-reservation.json', {'startedAt': receipt['startedAt'], 'consumed': True, 'freeBytes': free, 'window': 'red-gated implementation, green public comparison, strict noEmit; no automatic retry'})
    env = dict(os.environ); env['CHAT06P03_MEASUREMENTS'] = 'red-measurements.json'
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
    if run('strict', strict, dict(os.environ), 8) != 0: raise RuntimeError('Strict noEmit failed')
    receipt['syntheticTotal'] = json.loads((evidence / 'green-measurements.json').read_text())['total']
except Exception as error:
    receipt['failure'] = type(error).__name__ + ': ' + str(error)
finally:
    receipt['rawBytes'] = raw_bytes
    receipt['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    receipt['elapsedBeforeReceiptMs'] = (time.monotonic() - started) * 1000
    persist('check-receipt.json', receipt)
    final_elapsed = (time.monotonic() - started) * 1000
    print(json.dumps({'elapsedAfterReceiptMs': final_elapsed, 'withinBudget': final_elapsed <= 30000 and raw_bytes <= 2097152, 'failure': receipt['failure']}))
    if receipt['failure'] or final_elapsed > 30000: sys.exit(1)

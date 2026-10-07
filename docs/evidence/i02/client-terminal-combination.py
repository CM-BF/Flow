"""Current-main direct consumers; no PG, listener, package execution or provider."""
from pathlib import Path
import dataclasses, datetime, importlib.util, json, os, shutil, sys, tempfile, time

root = Path(__file__).resolve().parents[3]
out = root / 'docs/evidence/i02/client-terminal-combination'
out.mkdir(exist_ok=False)
spec = importlib.util.spec_from_file_location('client_terminal_intake_supervision', root / 'tools/owned-process-supervision/supervise.py')
supervision = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = supervision
spec.loader.exec_module(supervision)
started = time.monotonic()
free = shutil.disk_usage(root).free
assert free >= 2684354560 + 9 * 1024 * 1024
scratch = Path(tempfile.mkdtemp(prefix='flow-client-terminal-intake-'))
os.chmod(scratch, 0o700)
identity = scratch.stat()
env = {key: os.environ[key] for key in ('PATH', 'HOME', 'LANG') if key in os.environ}
env.update(TMPDIR=str(scratch), TMP=str(scratch), TEMP=str(scratch), PYTHONDONTWRITEBYTECODE='1')
node = '/opt/homebrew/opt/node@24/bin/node'
commands = [
    ('direct', (node, 'node_modules/vitest/vitest.mjs', 'run', 'apps/runner/src/outbox.test.ts', 'apps/runner/src/outbox-resume.test.ts', 'apps/runner/src/native-activity-body/host-production.test.ts', '--no-file-parallelism')),
    ('types', (node, 'node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false')),
]

result = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'freeBefore': free,
          'limits': {'totalWorkSeconds': 60, 'rawBytes': 1048576, 'scratchBytes': 8388608},
          'scratch': {'path': str(scratch), 'dev': identity.st_dev, 'ino': identity.st_ino}, 'runs': []}
(out / 'reservation.json').write_text(json.dumps(result, indent=2) + '\n')
raw = 0
for name, argv in commands:
    remaining = 60 - (time.monotonic() - started)
    assert remaining > 0
    report = supervision.supervise(supervision.Launch(argv, str(root), env, supervision.Ownership.NEW_CHILD_SESSION), supervision.Policy(remaining, .5, 2, 1048576 - raw))
    (out / (name + '.stdout')).write_bytes(report.stdout)
    (out / (name + '.stderr')).write_bytes(report.stderr)
    data = dataclasses.asdict(report)
    raw += len(data.pop('stdout')) + len(data.pop('stderr'))
    data.update(name=name, argv=list(argv), passed=report.exit_code == 0 and report.owned_state == 'absent' and all(report.eof.values()) and not report.first_failure and not report.secondary_failures)
    result['runs'].append(data)
    (out / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    if not data['passed']:
        break
usage = sum(p.stat().st_size for p in scratch.rglob('*') if p.is_file() and not p.is_symlink())
now = scratch.lstat()
result.update(rawBytes=raw, scratchBytesObserved=usage, elapsedMs=round((time.monotonic()-started)*1000), finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
result['passed'] = len(result['runs']) == 2 and all(x['passed'] for x in result['runs']) and usage <= 8388608
assert (now.st_dev, now.st_ino) == (identity.st_dev, identity.st_ino) and not scratch.is_symlink()
if all(x['owned_state'] == 'absent' and all(x['eof'].values()) for x in result['runs']):
    shutil.rmtree(scratch)
    result['scratchRemoved'] = True
else:
    result['scratchRemoved'] = False
(out / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: result[key] for key in ('passed','rawBytes','scratchBytesObserved','scratchRemoved','elapsedMs')}))
sys.exit(0 if result['passed'] else 1)

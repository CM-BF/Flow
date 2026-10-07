"""Thin, bounded OPS14 caller for the SVC08 same-lock host replacement direct consumers."""
import dataclasses
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
NODE = '/opt/homebrew/opt/node@24/bin/node'


def write(path, data):
    with path.open('xb') as stream:
        stream.write(data); stream.flush(); os.fsync(stream.fileno())


def main():
    # This independent deadline also covers result serialization and fsync. The child
    # is separately bounded by OPS14; a parent timeout never licenses scratch removal.
    signal.signal(signal.SIGALRM, lambda *_: os._exit(124))
    signal.setitimer(signal.ITIMER_REAL, 24.5)
    label = sys.argv[1]
    if label not in ('first', 'repair', 'direct'):
        raise ValueError('EXPLICIT_ROUND_REQUIRED')
    free = shutil.disk_usage(ROOT).free
    if free < 1107296256:
        raise RuntimeError('RESOURCE_NOT_ADMITTED')
    files = ['tools/personal-preview/preview.mjs', 'tools/personal-preview/preview.test.mjs',
             'tools/personal-preview/cli.mjs', 'tools/personal-preview/README.md',
             'tools/personal-preview/web-artifact.mjs', 'tools/personal-preview/web-release.mjs',
             'tools/personal-preview/backend-release/host.mjs',
             'tools/owned-process-supervision/supervise.py', 'docs/evidence/svc08/replace-host/run-local.py']
    bindings = [{'path': path, 'bytes': (ROOT/path).stat().st_size,
                 'sha256': hashlib.sha256((ROOT/path).read_bytes()).hexdigest()} for path in files]
    scratch = Path(tempfile.mkdtemp(prefix='flow-svc08-host-segment-')).resolve()
    identity = scratch.stat()
    reservation = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'round': label, 'scratch': str(scratch), 'scratchDev': identity.st_dev, 'scratchIno': identity.st_ino,
                   'freeBytes': free, 'sources': bindings, 'selectedPlanned': 9, 'legacyPgNotSelected': 6, 'rawBytesMax': 262144,
                   'tmpBytesMax': 16777216, 'PG': 0, 'Chrome': 0, 'provider': 0,
                   'policy': {'work': 20, 'term': .5, 'reap': 2, 'parent': 24.5}}
    write(HERE/f'{label}-reservation.json', (json.dumps(reservation, indent=2)+'\n').encode())
    spec = importlib.util.spec_from_file_location('svc08_supervisor', ROOT/'tools/owned-process-supervision/supervise.py')
    module = importlib.util.module_from_spec(spec); sys.modules[spec.name] = module; spec.loader.exec_module(module)
    report = module.supervise(module.Launch((NODE, '--test', '--test-name-pattern=SVC08 replace-host', 'tools/personal-preview/preview.test.mjs'), str(ROOT),
                              {'PATH': '/usr/bin:/bin', 'HOME': str(HERE), 'NO_COLOR': '1',
                               'TMPDIR': str(scratch)}, module.Ownership.NEW_CHILD_SESSION),
                              module.Policy(20, .5, 2, 131072))
    value = dataclasses.asdict(report)
    for name in ('stdout', 'stderr'):
        data = value.pop(name); write(HERE/f'{label}-{name}.log', data)
        value[name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    value['at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    value['freeAfterBytes'] = shutil.disk_usage(ROOT).free
    value['complete'] = (report.exit_code == 0 and report.owned_state == 'absent' and all(report.eof.values())
                         and report.first_failure is None and not report.secondary_failures)
    value['scratchChildren'] = sorted(item.name for item in scratch.iterdir())
    value['scratchRemoved'] = False
    write(HERE/f'{label}-result.json', (json.dumps(value, indent=2)+'\n').encode())
    if report.owned_state == 'absent' and not value['scratchChildren']:
        current = scratch.stat()
        if (current.st_dev,current.st_ino) == (identity.st_dev,identity.st_ino):
            scratch.rmdir(); value['scratchRemoved'] = True
    write(HERE/f'{label}-cleanup.json', (json.dumps({'scratch':str(scratch),'removed':value['scratchRemoved'],'children':value['scratchChildren'],'ownedState':report.owned_state},indent=2)+'\n').encode())
    print(json.dumps({'round': label, 'complete': value['complete'], 'childExit': report.exit_code,
                      'ownedState': report.owned_state, 'elapsedMs': report.elapsed_ms}))
    return 0 if value['complete'] else 1


if __name__ == '__main__':
    raise SystemExit(main())

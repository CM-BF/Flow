"""Same-PID durable launch checkpoint, then one of two fixed Node commands."""
import datetime
import json
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[3]
RUN = ROOT / 'docs/evidence/x01/enable-binding-local-run'
NODE = '/opt/homebrew/opt/node@24/bin/node'
COMMANDS = {
    'strict': [NODE, str(ROOT / 'node_modules/typescript/bin/tsc'), '--noEmit', '-p',
               'docs/evidence/x01/enable-binding-validation-tsconfig.json'],
    'tests': [NODE, str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run', '--config',
              'docs/evidence/x01/enable-binding-validation-vitest.config.mjs', '--configLoader', 'native',
              '--reporter=json', 'packages/contracts/src/plugin-runtime.test.ts',
              'apps/runner/src/plugins/execution.test.ts'],
}


def main():
    os.umask(0o077)
    label, nonce, dev, ino = sys.argv[1:]
    if label not in COMMANDS or not re.fullmatch('[a-f0-9]{32}', nonce):
        raise ValueError('Invalid fixed launch identity')
    if os.getpid() != os.getpgrp():
        raise ValueError('Launch requires its own initial process group')
    parent = os.open(RUN, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        info = os.fstat(parent)
        if (info.st_dev, info.st_ino) != (int(dev), int(ino)):
            raise ValueError('Evidence directory identity changed')
        fd = os.open(label + '-launch.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=parent)
        try:
            data = json.dumps({'label': label, 'nonce': nonce, 'pid': os.getpid(), 'pgid': os.getpgrp(),
                               'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                               'argv': COMMANDS[label]}, separators=(',', ':')).encode() + b'\n'
            if len(data) > 4096:
                raise ValueError('Checkpoint exceeds its reserved bytes')
            while data:
                written = os.write(fd, data)
                if written <= 0:
                    raise OSError('Checkpoint write made no progress')
                data = data[written:]
            os.fsync(fd)
        finally:
            os.close(fd)
        os.fsync(parent)
    finally:
        os.close(parent)
    os.execve(NODE, COMMANDS[label], dict(os.environ))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # A partial checkpoint is retained for the caller; failure never reaches exec.
        os.write(2, b'X01_LAUNCH_CHECKPOINT_FAILED\n')
        raise SystemExit(125)

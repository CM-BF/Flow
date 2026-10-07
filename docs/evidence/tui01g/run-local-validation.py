"""Bounded caller for the three already prepared TUI01G local check groups."""
import dataclasses
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = Path(__file__).resolve().parent
SUPERVISOR = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
NODE = '/opt/homebrew/opt/node@24/bin/node'
GROUPS = {
    'new': ['node_modules/vitest/vitest.mjs', 'run', '--config', 'docs/evidence/tui01g/vitest.config.mts', 'packages/interaction/src/message-settings', 'apps/tui/src/message-settings.test.tsx'],
    'direct': ['node_modules/vitest/vitest.mjs', 'run', '--config', 'docs/evidence/tui01g/vitest.config.mts', 'packages/interaction/src/controller.test.ts', 'packages/interaction/src/queue-control/controller.test.ts', 'packages/interaction/src/task-control/controller.test.ts', 'apps/tui/src/terminal.test.ts'],
    'types': ['node_modules/typescript/bin/tsc', '-p', 'docs/evidence/tui01g/tsconfig.json', '--noEmit'],
    'ink': ['node_modules/vitest/vitest.mjs', 'run', '--config', 'docs/evidence/tui01g/vitest.config.mts', 'apps/tui/src/message-settings.test.tsx', 'apps/tui/src/terminal.test.ts', '-t', 'Ink|descriptor completion'],
}


def tree_bytes(root):
    return sum(p.stat().st_size for p in root.rglob('*') if p.is_file() and not p.is_symlink()) if root.exists() else 0


def main():
    group, label = sys.argv[1:]
    argv = (NODE, *GROUPS[group])
    result_path = EVIDENCE / f'validation-{label}.json'
    reservation = EVIDENCE / f'validation-{label}-reservation.json'
    free = shutil.disk_usage(ROOT).free
    raw_before = sum(p.stat().st_size for p in EVIDENCE.glob('validation-*.log'))
    cache = Path('/tmp/flow-tui01g-vite')
    assert free >= 1107296256 and raw_before + tree_bytes(cache) < 8 * 1024 * 1024
    assert not result_path.exists()
    body = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'group': group, 'argv': argv,
            'cwd': str(ROOT), 'freeBefore': free, 'rawBefore': raw_before,
            'supervisor': str(SUPERVISOR), 'supervisorSha256': hashlib.sha256(SUPERVISOR.read_bytes()).hexdigest(),
            'bounds': {'workSeconds': 27, 'termSeconds': 0.5, 'killSeconds': 2, 'combinedOutputBytes': 262144, 'rawAndCacheBytes': 8388608},
            'providerCalls': 0, 'PG': 0, 'Chrome': 0, 'PTY': 0}
    with reservation.open('x') as f:
        json.dump(body, f, indent=2); f.write('\n'); f.flush(); os.fsync(f.fileno())
    spec = importlib.util.spec_from_file_location('tui01g_owned_supervisor', SUPERVISOR)
    module = importlib.util.module_from_spec(spec); sys.modules[spec.name] = module; spec.loader.exec_module(module)
    env = dict(os.environ, TSX_DISABLE_CACHE='1', NO_COLOR='1', CI='1')
    env.pop('FORCE_COLOR', None)
    report = module.supervise(module.Launch(argv, str(ROOT), env, module.Ownership.NEW_CHILD_SESSION),
                              module.Policy(27, 0.5, 2, 262144))
    result = dataclasses.asdict(report)
    for stream in ('stdout', 'stderr'):
        data = result.pop(stream); path = EVIDENCE / f'validation-{label}-{stream}.log'
        with path.open('xb') as f:
            f.write(data); f.flush(); os.fsync(f.fileno())
        result[stream] = {'path': str(path.relative_to(ROOT)), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    result.update(body)
    result['cacheBytesAfter'] = tree_bytes(cache)
    result['combinedRawAndCacheAfter'] = result['cacheBytesAfter'] + sum(p.stat().st_size for p in EVIDENCE.glob('validation-*.log'))
    result['freeAfter'] = shutil.disk_usage(ROOT).free
    result['resourceBoundMet'] = result['combinedRawAndCacheAfter'] <= 8388608 and result['freeAfter'] >= 1073741824
    with result_path.open('x') as f:
        json.dump(result, f, indent=2); f.write('\n'); f.flush(); os.fsync(f.fileno())
    print(json.dumps({k: result[k] for k in ('exit_code', 'elapsed_ms', 'first_failure', 'owned_state', 'combinedRawAndCacheAfter', 'resourceBoundMet')}))
    return 0 if result['exit_code'] == 0 and result['owned_state'] == 'absent' and result['first_failure'] is None and result['resourceBoundMet'] else 1


if __name__ == '__main__':
    raise SystemExit(main())

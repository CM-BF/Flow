"""Fixed SVC06B build assembly; lifecycle supervision belongs solely to OPS14."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent

def main(argv, *, inputs_path=HERE / 'build-inputs.json', entry_path=HERE / 'build-entry.mjs',
         output_path=HERE / 'outer-report.json', argument='--execute-fixed-build'):
    # Only the fixed in-process recovery caller supplies these paths. The old CLI
    # retains its exact entry and consumed namespace; no new command-line override.
    if argv != [argument]:
        raise ValueError('EXACT_BUILD_ARGUMENT_REQUIRED')
    for path in (inputs_path, entry_path, output_path):
        assert isinstance(path, Path) and path.is_absolute() and path.parent.is_relative_to(HERE)
    delta = json.loads(inputs_path.read_bytes())
    binding = delta['supervisor']
    module_path = Path(binding['path'])
    assert str(module_path.resolve()) == binding['realpath']
    assert hashlib.sha256(module_path.read_bytes()).hexdigest() == binding['sha256']
    spec = importlib.util.spec_from_file_location('svc06b_ops14', module_path)
    ops = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = ops
    spec.loader.exec_module(ops)
    # Refuse an already consumed outer destination before launching any child.
    output = output_path
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    report = ops.supervise(
        ops.Launch(('/opt/homebrew/opt/node@24/bin/node', str(entry_path), argument),
                   str(HERE.parents[3]), {'PATH': '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin',
                   'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1'}, ops.Ownership.NEW_CHILD_SESSION),
        ops.Policy(420, .5, 2, 1024 * 1024))
    result = dict(vars(report))
    for key in ('stdout', 'stderr'):
        result[key] = getattr(report, key).decode('utf8', 'replace')
    # All stop decisions precede disk persistence; pnpm remains in the owned session.
    with os.fdopen(fd, 'w', encoding='utf8') as stream:
        json.dump(result, stream, ensure_ascii=False)
        stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
    parent = os.open(str(output.parent), os.O_RDONLY)
    try:
        os.fsync(parent)
    finally:
        os.close(parent)
    print(json.dumps({'raw': str(output), 'exit_code': report.exit_code, 'owned_state': report.owned_state,
                      'eof': report.eof, 'first_failure': report.first_failure, 'elapsed_ms': report.elapsed_ms}))
    return 0 if report.exit_code == 0 and not report.first_failure and report.owned_state == 'absent' and all(report.eof.values()) else 1

if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))

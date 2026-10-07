"""Thin fixed calls. Existing OPS14 and the reviewed maintenance executor own all deadlines/phase ordering."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
OLD = HERE.parents[3].parent / 'backend-release/docs/evidence/svc06/update-diagnostics-candidate'
NODE = '/opt/homebrew/Cellar/node@24/24.20.0/bin/node'
PYTHON = '/opt/homebrew/Cellar/python@3.13/3.13.3_1/Frameworks/Python.framework/Versions/3.13/bin/python3.13'
PHASES = ['facts-before', 'preflight', 'history-before', 'bootstrap', 'operation', 'refresh', 'facts-paused',
          'history-paused', 'checkpoint', 'resume', 'facts-final', 'final']
READONLY_SHA256 = '0c6aceff07880d361186f87dcf0f42e087f7dd22c935c4007c545551f2eb8710'


def read_plan(path, digest):
    path = Path(path)
    assert path.is_absolute() and str(path.resolve()) == str(path)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        before = os.fstat(stream.fileno())
        assert stat.S_ISREG(before.st_mode) and before.st_uid == os.getuid() and before.st_nlink == 1
        assert stat.S_IMODE(before.st_mode) == 0o600 and before.st_size <= 131072
        raw = stream.read(131073); after = os.fstat(stream.fileno())
    assert (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns)
    assert len(raw) <= 131072 and hashlib.sha256(raw).hexdigest() == digest
    plan = json.loads(raw); assert plan['ready'] is True, 'FRESH_INSTANCE_AND_REPORTS_REQUIRED'
    return plan


def verify_file(row):
    path = Path(row['path']); info = path.lstat()
    assert stat.S_ISREG(info.st_mode) and not path.is_symlink() and str(path.resolve()) == row['realpath']
    assert (str(info.st_dev), str(info.st_ino), info.st_uid, info.st_nlink, info.st_size) == (
        row['dev'], row['ino'], row['uid'], row['nlink'], row['bytes'])
    assert hashlib.sha256(path.read_bytes()).hexdigest() == row['sha256']


def verify_readonly():
    raw = (HERE / 'current-entry-readonly.json').read_bytes()
    assert hashlib.sha256(raw).hexdigest() == READONLY_SHA256
    fixed = json.loads(raw)
    for row in fixed['readonly']: verify_file(row)
    pg = fixed['factsPg']; verify_file(pg['manifest'])
    inventory = json.loads(Path(pg['manifest']['path']).read_bytes())['inventory']['entries']
    for row in pg['aliases']:
        path = Path(row['path']); info = path.lstat()
        assert path.is_symlink() and os.readlink(path) == row['target'] and str(path.resolve()) == row['realpath']
        assert (str(info.st_dev), str(info.st_ino)) == (row['dev'], row['ino'])
    for package in pg['packages']:
        root = Path(package['root']); info = root.lstat()
        assert stat.S_ISDIR(info.st_mode) and not root.is_symlink() and str(root.resolve()) == str(root)
        assert (str(info.st_dev), str(info.st_ino), info.st_uid) == (package['dev'], package['ino'], package['uid'])
        prefix = package['manifestPrefix']
        entries = [row for row in inventory if row['kind'] == 'file' and row['path'].startswith(prefix)]
        assert len(entries) == package['files'] and sum(row['bytes'] for row in entries) == package['bytes']
        for row in entries:
            path = root / row['path'][len(prefix):]; info = path.lstat()
            assert stat.S_ISREG(info.st_mode) and not path.is_symlink() and str(path.resolve()) == str(path)
            assert info.st_size == row['bytes'] and hashlib.sha256(path.read_bytes()).hexdigest() == row['sha256']
    # Preserve the existing executor's conservative historical debit; it is not a fresh 2MiB allowance.
    prior = fixed['priorRaw']; root = Path(prior['directory'])
    paths = sorted(str(path.relative_to(root)) for path in root.rglob('*') if path.is_file())
    assert paths == sorted(row['path'] for row in prior['files'])
    for row in prior['files']:
        path = root / row['path']; info = path.lstat()
        assert stat.S_ISREG(info.st_mode) and not path.is_symlink()
        assert info.st_size == row['bytes'] and hashlib.sha256(path.read_bytes()).hexdigest() == row['sha256']
    assert sum(row['bytes'] for row in prior['files']) == prior['bytes'] == 119396
    return fixed


def verify_pins(plan):
    # Fixed old facts dependencies remain separate from the selected artifact's history/maintenance ports.
    assert plan['pins'] and len({row['path'] for row in plan['pins']}) == len(plan['pins'])
    for row in plan['pins']: verify_file(row)
    verify_readonly()
    required = [str(HERE / name) for name in ('current-operator.py', 'current-import.mjs', 'current-maintenance.mjs',
                'current-migration.mjs', 'runner-idle.mjs', 'current-entry-readonly.json',
                'current-web-transfer.mjs', 'current-web-actions.mjs', 'managed-update-inputs.json')]
    required += [str(HERE.parent.parent / 'svc05-history-compatibility/release-operation/runner-files.mjs'),
                 str(HERE.parent / 'update-diagnostics-candidate/history-projection.mjs')]
    required += [str(OLD / name) for name in ('maintenance-continuation.py', 'maintenance-continuation.json', 'maintenance-supervise.py')]
    required += [NODE, PYTHON, plan['supervisor']['path']]
    assert set(required) <= {row['path'] for row in plan['pins']}
    assert plan['supervisor']['sha256'] == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
    assert next(row for row in plan['pins'] if row['path'] == plan['supervisor']['path'])['sha256'] == plan['supervisor']['sha256']
    return {'supervisor': plan['supervisor']}


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); sys.modules[name] = module; spec.loader.exec_module(module)
    return module


def maintenance_plan(plan, path, digest):
    assert plan['initialVersion'] == plan['migration']['expectedRunner']['maintenance_version']
    assert len(plan['reportIds']) == 3 and len(set(plan['reportIds'])) == 3
    assert plan['migration']['artifact']['sourceHead'] == '04da80692e79e2b7c3f6341c7fa76515a3f719a3'
    assert plan['migration']['expectedBackendArtifact']['sourceHead'] == '6c0fdcda8858aac33489c48c1948e902dd6a3d7e'
    assert plan['budget']['rawBytes'] == 2097152 and plan['budget']['liveBytes'] == 1073741824
    assert plan['budget']['freshBytes'] >= 2684354560 and plan['budget']['perPhaseOutputBytes'] == 65536
    steps = []
    for phase in PHASES:
        artifact = plan['migration']['artifact' if PHASES.index(phase) >= PHASES.index('refresh') else 'expectedBackendArtifact']
        root = Path(plan['migration']['installationDirectory']) / 'backend-artifacts' / artifact['artifactId'] / 'root'
        steps.append({'name': phase, 'argv': [NODE, '--import', str(root / 'node_modules/tsx/dist/loader.mjs'),
            str(HERE / 'current-maintenance.mjs'), '--phase', phase, str(path), digest], 'cwd': str(root),
            'ownership': 'childPidOnly', 'maximumWorkSeconds': 180 if phase == 'refresh' else 60})
    return {**plan, 'directory': plan['migration']['installationDirectory'], 'node': NODE, 'steps': steps, 'planPath': str(path)}


def save_report(path, work):
    path = Path(path); parent = path.parent; info = parent.lstat()
    assert stat.S_ISDIR(info.st_mode) and not parent.is_symlink() and str(parent.resolve()) == str(parent)
    assert info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) == 0o700
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as stream:
        result = work()
        json.dump(result, stream); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
    parent_fd = os.open(parent, os.O_RDONLY | os.O_NOFOLLOW)
    try: os.fsync(parent_fd)
    finally: os.close(parent_fd)
    complete = result['exit_code'] == 0 and result['first_failure'] is None and result['owned_state'] == 'absent' and all(result['eof'].values())
    print(json.dumps({'complete': complete, 'owned': result['owned_state'], 'eof': result['eof'], 'elapsedMs': result['elapsed_ms']}))
    return 0 if complete else 1


def web_invocation(plan, action, path, digest):
    publication = plan['webPublication']
    if action == '--execute-fixed-web-import':
        value = publication['transferInput']
        assert value and Path(value['path']).is_absolute()
        target = plan['migration']['artifact']
        argv = [NODE, str(HERE / 'current-web-transfer.mjs'), action, value['path'], value['sha256']]
        outer = publication['transferOuter']
    else:
        phase = {'--execute-fixed-retained-reports': 'import-retained-reports',
                 '--execute-fixed-new-report': 'import-new-report', '--execute-fixed-web-publish': 'publish-web'}[action]
        target = plan['migration']['expectedBackendArtifact' if phase == 'import-retained-reports' else 'artifact']
        argv = [NODE, str(HERE / 'current-web-actions.mjs'), phase, path, digest]
        outer = publication['actions'][phase]['outer']
    root = Path(plan['migration']['installationDirectory']) / 'backend-artifacts' / target['artifactId'] / 'root'
    return [argv[0], '--import', str(root / 'node_modules/tsx/dist/loader.mjs'), *argv[1:]], str(root), outer


def main(argv):
    assert len(argv) in (4, 5), 'EXACT_INVOCATION_REQUIRED'
    action, path, digest, window = argv[:4]
    plan = read_plan(path, digest); assert window == plan['window'] and window.startswith('svc06-personal-7d1-')
    verify_pins(plan)
    env = {'PATH': str(Path(NODE).parent) + ':/usr/bin:/bin:/usr/sbin', 'LC_ALL': 'C',
           'PYTHONDONTWRITEBYTECODE': '1', 'TSX_DISABLE_CACHE': '1'}
    if action == '--maintenance-child':
        assert len(argv) == 5
        fixed = maintenance_plan(plan, path, digest)
        driver = load(OLD / 'maintenance-continuation.py', 'svc06b_existing_maintenance_driver')
        driver.execute(window, float(argv[4]), plan=fixed, verify=lambda: verify_pins(plan),
                       validate=lambda: maintenance_plan(plan, path, digest))
        return 0
    assert len(argv) == 4
    outer = load(OLD / 'maintenance-supervise.py', 'svc06b_existing_outer'); ops = outer.supervisor()
    if action in ('--execute-fixed-web-import', '--execute-fixed-retained-reports', '--execute-fixed-new-report', '--execute-fixed-web-publish'):
        command, cwd, output = web_invocation(plan, action, path, digest)
        if action != '--execute-fixed-retained-reports':
            selected = plan['webPublication']['transferInput']
            web_input = read_plan(selected['path'], selected['sha256'])
            assert web_input['finalReceipt']['path'] == str(Path(plan['runDirectory']) / 'final.json')
            assert web_input['expectedBackendArtifact'] == plan['migration']['artifact']
            assert web_input['expectedWebHostArtifact'] == plan['migration']['expectedWebHostArtifact']
            assert web_input['budget'] == {key: plan['migration']['budget'][key] for key in ('freshBytes', 'liveBytes', 'rawBytes', 'addedBytes')}
        def execute_web():
            report = ops.supervise(ops.Launch(tuple(command), cwd, env, ops.Ownership.NEW_CHILD_SESSION), ops.Policy(30, .5, 2, 65536))
            result = dict(vars(report))
            for name in ('stdout', 'stderr'): result[name] = getattr(report, name).decode('utf8', 'replace')
            return result
        return save_report(output, execute_web)
    if action == '--execute-fixed-maintenance':
        maintenance_plan(plan, path, digest)
        return save_report(plan['maintenanceOuter'], lambda: outer.supervise_operator(ops,
            [PYTHON, str(Path(__file__).resolve()), '--maintenance-child', path, digest, window], str(HERE), env, seconds=900))
    assert action == '--execute-fixed-import', 'EXACT_INVOCATION_REQUIRED'
    assert not Path(plan['migration']['runDirectory']).exists() and not Path(plan['migration']['runDirectory']).is_symlink()
    # Migration has an independently pinned instance file, preserving its exact input bytes.
    migration = read_plan(plan['migrationInput']['path'], plan['migrationInput']['sha256'])
    assert migration == plan['migration']
    def execute_import():
        report = ops.supervise(ops.Launch((NODE, str(HERE / 'current-import.mjs'), '--execute-fixed-import',
            plan['migrationInput']['path'], plan['migrationInput']['sha256']), str(HERE), env, ops.Ownership.NEW_CHILD_SESSION),
            ops.Policy(120, .5, 2, 1048576))
        result = dict(vars(report))
        for name in ('stdout', 'stderr'): result[name] = getattr(report, name).decode('utf8', 'replace')
        return result
    return save_report(plan['migrationOuter'], execute_import)


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))

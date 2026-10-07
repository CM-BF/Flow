"""Independent operator deadline; only its direct PID is owned here, never host services."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
from datetime import datetime, timezone
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
SUPERVISOR_SHA = '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'


def load_supervisor(pin):
    path = Path(pin['path'])
    assert str(path.resolve()) == pin['realpath'] and not path.is_symlink()
    data = path.read_bytes()
    assert len(data) == pin['bytes'] and hashlib.sha256(data).hexdigest() == pin['sha256'] == SUPERVISOR_SHA
    spec = importlib.util.spec_from_file_location('svc09a_outer_ops14', path)
    module = importlib.util.module_from_spec(spec); sys.modules[spec.name] = module; spec.loader.exec_module(module)
    return module


def supervise_operator(ops, argv, env, *, work_seconds=215):
    return ops.supervise(ops.Launch(tuple(argv), str(HERE), env, ops.Ownership.CHILD_PID_ONLY),
                         ops.Policy(work_seconds, .5, 2, 65536))


def disposition(report):
    complete = report.exit_code == 0 and report.first_failure is None and report.owned_state == 'absent' and all(report.eof.values())
    return {'operatorReturned': complete, 'operatorOwnedState': report.owned_state,
            'firstFailure': report.first_failure, 'secondaryFailures': report.secondary_failures,
            'servicesAndDatabase': 'NOT_INFERRED_FROM_CALLER_EXIT' if complete else 'UNKNOWN_KEEP',
            'phaseRecordsRequired': True, 'retry': False}

def attempt_files(argv):
    if argv == ['--run-default-host-once']:
        return 'default-host-outer-once', 'actual-default-host-once', '--execute-default-host-once'
    assert argv in (['--run-host-once'], ['--run-host-r2-once'], ['--run-host-r3-once'], ['--run-host-r4-once']), 'EXACT_ARGUMENT_REQUIRED'
    if argv == ['--run-host-r4-once']:
        return 'host-outer-r4-once', 'actual-host-r4-once', '--execute-host-r4-once'
    if argv == ['--run-host-r3-once']:
        return 'host-outer-r3-once', 'actual-host-r3-once', '--execute-host-r3-once'
    if argv == ['--run-host-r2-once']:
        return 'host-outer-r2-once', 'actual-host-r2-once', '--execute-host-r2-once'
    return 'host-outer-once', 'actual-host-once', '--execute-host-once'


def reserve_attempt(directory, outer_name, operator_name):
    assert not os.path.lexists(directory / operator_name), 'OPERATOR_NAMESPACE_EXISTS'
    namespace = directory / outer_name
    namespace.mkdir(mode=0o700)  # Exclusive even if the previous caller never began.
    return namespace


def main(argv, *, attempt=None):
    if attempt is None:
        outer_name, operator_name, operator_argument = attempt_files(argv)
        fixed = json.loads((HERE / 'host-inputs.json').read_bytes())
        directory, operator = HERE, HERE / 'host-run.py'
    else:
        assert argv == [] and set(attempt) == {'input', 'operator', 'argument', 'directory', 'outerName', 'operatorName'}, 'COLD_OUTER_PORT_INVALID'
        def fixed_bytes(value):
            path = Path(value['path'])
            assert path.is_absolute() and not path.is_symlink() and str(path.resolve()) == value['realpath']
            data = path.read_bytes()
            assert len(data) == value['bytes'] and hashlib.sha256(data).hexdigest() == value['sha256']
            return data
        fixed = json.loads(fixed_bytes(attempt['input']))
        fixed_bytes(attempt['operator'])
        operator = Path(attempt['operator']['path'])
        directory = Path(attempt['directory'])
        assert directory.is_absolute() and directory == operator.parent, 'COLD_OUTER_DIRECTORY_INVALID'
        outer_name, operator_name = attempt['outerName'], attempt['operatorName']
        assert all(isinstance(v, str) and v and Path(v).name == v and v not in ('.', '..') for v in (outer_name, operator_name))
        assert outer_name != operator_name
        operator_argument = attempt['argument']
        assert operator_argument == '--execute-cold-once', 'COLD_OPERATOR_ARGUMENT_REQUIRED' 
    ops = load_supervisor(fixed['supervisor'])
    assert os.environ.get('FLOW_SVC09A_ADMIN_URL'), 'EXPLICIT_LOCAL_ADMIN_REQUIRED'
    # A second outer invocation is refused even if the operator failed before its own reservation.
    namespace = reserve_attempt(directory, outer_name, operator_name)
    env = {'PATH': '/usr/bin:/bin', 'PYTHONDONTWRITEBYTECODE': '1',
           'FLOW_SVC09A_ADMIN_URL': os.environ['FLOW_SVC09A_ADMIN_URL']}
    report = supervise_operator(ops, [fixed['python']['path'], str(operator), operator_argument], env)
    value = {'at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
             'scope': 'CALLER_PID_ONLY_NOT_DETACHED_SERVICE_GROUPS', 'limits': {'operatorSeconds': 215, 'termSeconds': .5, 'reapSeconds': 2},
             'report': {**vars(report), 'stdout': report.stdout.decode('utf8', 'replace'), 'stderr': report.stderr.decode('utf8', 'replace')},
             'disposition': disposition(report)}
    # Only after supervision finishes. Persistence failure cannot prolong the already bounded caller.
    try:
        with (namespace / 'outer-report.json').open('x', encoding='utf8') as stream:
            os.chmod(stream.name, 0o600)
            json.dump(value, stream, ensure_ascii=False, indent=2); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
    except Exception as error:
        print(json.dumps({'recordFailureType': type(error).__name__, 'disposition': disposition(report)}))
        return 1
    print(json.dumps({'outerReport': str(namespace / 'outer-report.json'), 'elapsedMs': report.elapsed_ms, **disposition(report)}))
    return 0 if disposition(report)['operatorReturned'] else 1


if __name__ == '__main__':
    try:
        raise SystemExit(main(sys.argv[1:]))
    except Exception as error:
        print(json.dumps({'errorType': type(error).__name__, 'disposition': 'UNKNOWN_KEEP_NO_RETRY'}))
        raise SystemExit(1)

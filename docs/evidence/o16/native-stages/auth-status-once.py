"""One public status command; private output exists in memory only, never in records."""
from pathlib import Path
import datetime
import hashlib
import importlib.util
import json
import os
import shutil
import stat
import sys
import tempfile
import time

BASE = Path(__file__).resolve().parent
BINARY = Path('/Users/citrine/.local/share/claude/versions/2.1.291')
BINARY_SHA = '9a1d2ed6bb4421e8fc80c892c0413f293be3ee50ae3d7dda1a7622197a056690'
SUPERVISOR = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py')
SUPERVISOR_SHA = '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
RUN = BASE / 'auth-status-once'
ENUMS = {
    'authMethod': {'none', 'claude.ai', 'oauth_token', 'api_key', 'api_key_helper', 'third_party'},
    'apiProvider': {'firstParty', 'first_party', 'anthropic', 'bedrock', 'vertex', 'foundry', 'gateway'},
    'subscriptionType': {'free', 'pro', 'max', 'team', 'enterprise', None},
}


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1048576), b''):
            value.update(block)
    return value.hexdigest()


def durable(name, value):
    encoded = (json.dumps(value, indent=2) + '\n').encode()
    if len(encoded) > 16384:
        raise ValueError('SAFE_RECORD_LIMIT')
    with (RUN / name).open('xb') as stream:
        stream.write(encoded)
        stream.flush()
        os.fsync(stream.fileno())
    fd = os.open(RUN, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def safe_status(raw):
    # No exception text, discarded fields, raw content or hashes of raw content escape.
    try:
        value = json.loads(raw)
    except (ValueError, UnicodeError):
        return {}, 'INVALID_JSON'
    if type(value) is not dict:
        return {}, 'INVALID_SHAPE'
    allowed = {}
    if type(value.get('loggedIn')) is bool:
        allowed['loggedIn'] = value['loggedIn']
    for key, choices in ENUMS.items():
        if key in value and (value[key] is None or type(value[key]) is str) and value[key] in choices:
            allowed[key] = value[key]
    return allowed, None if 'loggedIn' in allowed else 'MISSING_PUBLIC_BOOLEAN'


def main():
    started = time.monotonic()
    free = shutil.disk_usage(BASE).free
    if RUN.exists() or free < 1073741824 + 1048576 + 65536:
        raise RuntimeError('NOT_RUN_EXISTING_OR_RESOURCE_GATE')
    if BINARY.is_symlink() or not BINARY.is_file() or digest(BINARY) != BINARY_SHA or digest(SUPERVISOR) != SUPERVISOR_SHA:
        raise RuntimeError('NOT_RUN_FIXED_INPUT_MISMATCH')
    spec = importlib.util.spec_from_file_location('o16_public_auth_supervision', SUPERVISOR)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    RUN.mkdir(mode=0o700)
    scratch = Path(tempfile.mkdtemp(prefix='flow-o16-public-auth-', dir='/private/tmp'))
    original = scratch.lstat()
    durable('reservation.json', {
        'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'scope': 'one existing public CLI auth status; no SDK query/login/keychain export',
        'argv': [str(BINARY), 'auth', 'status', '--json'],
        'binarySha256': BINARY_SHA, 'supervisorSha256': SUPERVISOR_SHA,
        'callerSha256': digest(Path(__file__)), 'freeBytes': free,
        'scratch': str(scratch), 'dev': original.st_dev, 'ino': original.st_ino,
        'limits': {'totalSeconds': 10, 'memoryOutputBytes': 65536, 'scratchBytes': 1048576, 'safeRecordsBytes': 65536},
        'state': 'reserved; outcome unknown; never automatically repeat',
    })
    env = {key: os.environ[key] for key in ('HOME', 'USER', 'PATH', 'LANG', 'LC_ALL') if key in os.environ}
    env.update({'TMPDIR': str(scratch), 'DISABLE_AUTOUPDATER': '1', 'DISABLE_TELEMETRY': '1', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC': '1'})
    remaining = 10 - (time.monotonic() - started) - 2.5
    if remaining <= 0:
        durable('result.json', {'status': 'NOT_RUN_PREPARATION_DEADLINE', 'cleanup': 'KEEP'})
        return
    report = module.supervise(module.Launch((str(BINARY), 'auth', 'status', '--json'), str(scratch), env, module.Ownership.NEW_CHILD_SESSION), module.Policy(min(7, remaining), .25, 1, 65536))
    allowed, parse_failure = safe_status(report.stdout)
    # Report fields below come from the reviewed supervisor, never child strings.
    result = {key: getattr(report, key) for key in ('pid', 'ownership', 'exit_code', 'elapsed_ms', 'observed_bytes', 'eof', 'first_failure', 'secondary_failures', 'signals', 'owned_state', 'observations')}
    result.update({'publicStatus': allowed, 'parseFailure': parse_failure,
                   'rawStdoutArchived': False, 'rawStderrArchived': False,
                   'queryCalls': 0, 'interactiveAuthCalls': 0, 'credentialFilesReadByCaller': 0,
                   'SDKAuthRouteProven': False, 'cleanup': 'KEEP_UNTIL_SAFE_CHECKPOINT'})
    report.stdout = report.stderr = b''
    durable('result.json', result)
    children = list(scratch.iterdir())
    fresh = scratch.lstat()
    cleanup = {'state': 'KEEP', 'entries': len(children), 'reason': 'EMPTY_EXACT_OWNED_ONLY'}
    if (not children and stat.S_ISDIR(fresh.st_mode) and (fresh.st_dev, fresh.st_ino, fresh.st_uid) == (original.st_dev, original.st_ino, os.getuid())
            and report.owned_state == 'absent' and all(report.eof.values()) and time.monotonic() - started < 10):
        scratch.rmdir()
        cleanup.update({'state': 'removed', 'reason': 'EXACT_EMPTY_AFTER_DURABLE_RESULT'})
    cleanup['totalElapsedMs'] = round((time.monotonic() - started) * 1000)
    durable('cleanup.json', cleanup)
    print(json.dumps({'publicStatus': allowed, 'exitCode': report.exit_code, 'ownedState': report.owned_state, 'cleanup': cleanup['state'], 'totalElapsedMs': cleanup['totalElapsedMs']}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # No uncaught exception string/traceback could quote a private child payload.
        print(json.dumps({'status': 'UNKNOWN_OR_NOT_RUN', 'errorType': type(error).__name__}))
        sys.exit(1)

"""Pure HOME-only recipe and public auth-result interpretation; no IO or launch."""
import json
from pathlib import PurePosixPath


FIELDS = ('loggedIn', 'authMethod', 'apiProvider', 'subscriptionType')
ENVIRONMENT_KEYS = frozenset((
    'HOME', 'CLAUDE_CONFIG_DIR', 'TMPDIR', 'CLAUDE_TMPDIR',
    'CLAUDE_SECURESTORAGE_CONFIG_DIR', 'USER', 'PATH', 'LANG',
    'DISABLE_AUTOUPDATER', 'DISABLE_TELEMETRY',
    'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', 'CLAUDE_CODE_ENTRYPOINT',
    'CLAUDE_AGENT_SDK_VERSION', 'CLAUDE_CODE_SDK_READS_SESSION_STATE',
))
NORMAL_HOME = '/Users/citrine'


def home_cases(private_environment, private_home):
    """The trusted prepared recipe supplies every value; only HOME may differ."""
    if (set(private_environment) != ENVIRONMENT_KEYS
            or private_environment.get('HOME') != private_home
            or not isinstance(private_home, str) or not private_home.startswith('/private/tmp/')
            or private_environment.get('USER') != 'citrine'
            or private_environment.get('CLAUDE_SECURESTORAGE_CONFIG_DIR') != ''):
        raise ValueError('HOME_RECIPE_MISMATCH')
    home = PurePosixPath(private_home)
    if home.name != 'home' or home.parent.name != 'native' or '..' in home.parts:
        raise ValueError('HOME_RECIPE_MISMATCH')
    expected = {
        'CLAUDE_CONFIG_DIR': str(home.parent / 'config'),
        'TMPDIR': str(home.parent / 'tmp'), 'CLAUDE_TMPDIR': str(home.parent / 'tmp'),
        'PATH': '/usr/bin:/bin:/usr/sbin:/sbin', 'LANG': 'C.UTF-8',
        'DISABLE_AUTOUPDATER': '1', 'DISABLE_TELEMETRY': '1',
        'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC': '1',
        'CLAUDE_CODE_ENTRYPOINT': 'sdk-ts', 'CLAUDE_AGENT_SDK_VERSION': '0.3.290',
        'CLAUDE_CODE_SDK_READS_SESSION_STATE': '1',
    }
    if any(private_environment[key] != value for key, value in expected.items()):
        raise ValueError('HOME_RECIPE_MISMATCH')
    a = dict(private_environment)
    b = {**a, 'HOME': NORMAL_HOME}
    if [key for key in a if a[key] != b[key]] != ['HOME']:
        raise ValueError('HOME_FACTOR_MISMATCH')
    return (a, b)


def interpret_status(raw_stdout, report, safe_status):
    """Interpret the fixed parser and OPS14 report without rewriting either.

    safe_status is the fixed original four-field parser. Missing is distinct
    from explicit null; unrecognised optional fields cannot become a missing
    field exception. Caller retains raw supervisor facts separately.
    """
    public, parse_failure = safe_status(raw_stdout)
    missing = [field for field in FIELDS if field not in public]
    result = {'publicStatus': public, 'missingFields': missing,
              'decision': 'STOP_UNKNOWN', 'expectedNegativeStatus': False}
    if parse_failure or any(field not in public for field in FIELDS[:3]):
        return result
    try:
        present = json.loads(raw_stdout)
    except (ValueError, UnicodeError):
        return result
    if not isinstance(present, dict):
        return result
    if any(field in present and field not in public for field in FIELDS):
        return result
    if (report.owned_state != 'absent'
            or report.eof != {'stdout': True, 'stderr': True}
            or report.signals != [] or report.secondary_failures != []):
        return result
    negative = (public['loggedIn'] is False and public['authMethod'] == 'none'
                and public['apiProvider'] == 'firstParty' and report.exit_code == 1)
    failure = report.first_failure
    expected_exit = {'phase': 'work', 'code': 'CHILD_EXIT_NONZERO',
                     'type': 'SupervisionFailure', 'errno': None,
                     'message': 'child exit nonzero'}
    if negative and (failure is None or failure == expected_exit):
        result.update(decision='CONTINUE', expectedNegativeStatus=True)
        return result
    if (public['loggedIn'] is True and public['authMethod'] != 'none'
            and public['apiProvider'] == 'firstParty' and not missing
            and report.exit_code == 0 and failure is None):
        result['decision'] = 'CONTINUE'
    return result

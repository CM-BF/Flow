"""New Web argv construction only; no operational entry, installed artifact or subprocess is used."""
import ast
import importlib.util
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True
here = Path(__file__).resolve().parent
source = here / 'current-operator.py'
ast.parse(source.read_text())
spec = importlib.util.spec_from_file_location('web_args_only', source)
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
plan = json.loads((here / 'current-update-template.json').read_bytes())
web = plan['webPublication']
web['transferInput'] = {'path': '/private/tmp/flow-svc06b-toy/transfer.json', 'sha256': 'a' * 64}
web['transferOuter'] = '/private/tmp/flow-svc06b-toy/transfer-outer.json'
web['actions'] = {name: {'directory': '/private/tmp/flow-svc06b-toy/' + name,
                        'outer': '/private/tmp/flow-svc06b-toy/' + name + '-outer.json'}
                  for name in ['import-retained-reports', 'import-new-report', 'publish-web']}
for action in ['--execute-fixed-retained-reports', '--execute-fixed-new-report', '--execute-fixed-web-publish', '--execute-fixed-web-import']:
    argv, cwd, outer = module.web_invocation(plan, action, '/private/tmp/flow-svc06b-toy/plan.json', 'b' * 64)
    selected = plan['migration']['expectedBackendArtifact' if action == '--execute-fixed-retained-reports' else 'artifact']
    assert selected['artifactId'] in cwd
    assert argv[:3] == [module.NODE, '--import', cwd + '/node_modules/tsx/dist/loader.mjs']
    assert outer.startswith('/private/tmp/flow-svc06b-toy/')
    if action == '--execute-fixed-web-import':
        assert argv[-3:] == [action, web['transferInput']['path'], 'a' * 64]
    else:
        assert argv[-2:] == ['/private/tmp/flow-svc06b-toy/plan.json', 'b' * 64]
try:
    module.web_invocation(plan, '--retry', '/unused', 'c' * 64)
    raise AssertionError('unsupported action accepted')
except KeyError:
    pass
assert len(module.PHASES) == 12 and len(plan['reportIds']) == 3
ops = module.load(plan['supervisor']['path'], 'svc06b_policy_validation_only')
launch = ops.Launch((module.NODE, '--version'), str(here), {}, ops.Ownership.NEW_CHILD_SESSION)
for policy in [ops.Policy(120, .5, 2, 1048576), ops.Policy(30, .5, 2, 65536)]:
    ops._validate(launch, policy)
try:
    ops._validate(launch, ops.Policy(120, .5, 2, 2097152))
    raise AssertionError('invalid old capture budget accepted')
except ValueError:
    pass
print(json.dumps({'outcome': 'four-Web-invocations-unsupported-action-and-real-OPS14-policies-checked', 'argumentCases': 5, 'policyCases': 3, 'personalIO': 0, 'children': 0}))

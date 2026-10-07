"""Pure argument/AST checks: no supervisor, subprocess, DB or installation access."""
import ast
import importlib.util
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True
here = Path(__file__).resolve().parent
path = here / 'current-operator.py'
ast.parse(path.read_text())
spec = importlib.util.spec_from_file_location('svc06b_args_only', path)
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
plan = json.loads((here / 'current-update-template.json').read_bytes())
plan['reportIds'] = [letter * 64 for letter in ('a', 'b', 'c')]
plan['initialVersion'] = plan['migration']['expectedRunner']['maintenance_version'] = 21
fixed = module.maintenance_plan(plan, '/private/tmp/synthetic-fixed.json', 'd' * 64)
assert len(fixed['steps']) == 12
for index, step in enumerate(fixed['steps']):
    artifact = plan['migration']['artifact' if index >= 5 else 'expectedBackendArtifact']
    root = str(Path(plan['migration']['installationDirectory']) / 'backend-artifacts' / artifact['artifactId'] / 'root')
    assert step['cwd'] == root and step['argv'][2] == root + '/node_modules/tsx/dist/loader.mjs'
    assert step['argv'][-4:] == ['--phase', step['name'], '/private/tmp/synthetic-fixed.json', 'd' * 64]
    assert step['ownership'] == 'childPidOnly'
assert module.OLD == Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-release/docs/evidence/svc06/update-diagnostics-candidate')
readonly = module.verify_readonly()
assert readonly['priorRaw']['bytes'] == 119396
assert readonly['priorRaw']['newRunAvailableAfterReserve'] == 1584540
assert len(readonly['factsPg']['packages']) == 14
print(json.dumps({'outcome': 'python-definition-ast-12-exact-arguments-and-readonly-closure',
                  'priorRawBytes': 119396, 'factsPgPackages': 14, 'personalIO': 0, 'children': 0}))

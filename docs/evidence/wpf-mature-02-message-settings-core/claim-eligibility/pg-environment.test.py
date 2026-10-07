"""Pure environment-boundary sentinel. Never import the PG caller or inspect real environment."""
import ast
from pathlib import Path
from types import SimpleNamespace

source = Path(__file__).with_name('pg-once.py').read_text()
tree = ast.parse(source)
selected = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in ('fixed_environment', 'pg_environment')]
assert len(selected) == 2
poison = {'NODE_OPTIONS': '--require /sentinel/private.cjs --import /sentinel/private.mjs',
    'NODE_PATH': '/sentinel/modules', 'HOME': '/sentinel/private-home',
    'FLOW_PRIVATE_CONFIG': '/sentinel/private.json', 'DATABASE_URL': 'sentinel-only'}
class ForbiddenParent:
    def __getattribute__(self, name):
        raise AssertionError('Parent environment must not be read')
namespace = {'os': SimpleNamespace(environ=ForbiddenParent())}
exec(compile(ast.Module(body=selected, type_ignores=[]), '<actual-caller-environment-functions>', 'exec'), namespace)
base = namespace['fixed_environment']()
assert set(base) == {'PATH', 'LANG', 'LC_ALL', 'TZ', 'NODE_DISABLE_COMPILE_CACHE', 'PYTHONDONTWRITEBYTECODE', 'GIT_CONFIG_NOSYSTEM', 'GIT_CONFIG_GLOBAL', 'GIT_OPTIONAL_LOCKS'}
assert base['PATH'] == '/usr/bin:/bin' and base['GIT_CONFIG_GLOBAL'] == '/dev/null'
assert not (set(base) & set(poison))
result = namespace['pg_environment'](Path('/owned/sentinel'), 'a' * 32, 'b' * 40, 110000, 170000)
assert not (set(result) & set(poison))
assert result == {**base, 'TMPDIR': '/owned/sentinel/tmp', 'TMP': '/owned/sentinel/tmp', 'TEMP': '/owned/sentinel/tmp',
    'FLOW_X01_BINDING_CACHE': '/owned/sentinel/cache', 'FLOW_X01_PG_ROOT': '/owned/sentinel/fixtures',
    'FLOW_X01_PG_WINDOW': 'a' * 32, 'FLOW_X01_PG_HEAD': 'b' * 40,
    'FLOW_X01_PG_WORK_UNTIL': '110000', 'FLOW_X01_PG_CLEANUP_UNTIL': '170000'}
# Bind the two actual Launch sites and exec handoff statically, without evaluating main/child.
launches = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == 'Launch']
assert len(launches) == 2
assert ast.unparse(launches[0].args[2]) == 'fixed_environment()'
assert ast.unparse(launches[1].args[2]) == 'env'
assignments = [n for n in ast.walk(tree) if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'env' for t in n.targets)]
assert len(assignments) == 1 and isinstance(assignments[0].value, ast.Call) and assignments[0].value.func.id == 'pg_environment'
execs = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == 'execve']
assert len(execs) == 1 and ast.unparse(execs[0].args[2]) == 'os.environ'
print('1/1 environment sentinel passed; pure actual-function extraction + two Launch/exec wiring checks')

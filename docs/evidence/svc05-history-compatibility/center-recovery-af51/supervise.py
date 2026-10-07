"""Use the approved shared PID-only wrapper; never signal detached services."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
bindings = json.loads((HERE / 'runtime-bindings.json').read_text())
if str(Path(sys.executable).resolve()) != bindings['pythonRealpath'] or sys.version.split()[0] != bindings['pythonVersion']:
    raise SystemExit('PYTHON_CHANGED')
for item in bindings['supervisionInputs']:
    payload = Path(item['path']).read_bytes()
    if len(payload) != item['bytes'] or hashlib.sha256(payload).hexdigest() != item['sha256']:
        raise SystemExit('SUPERVISION_INPUT_CHANGED')
wrapper = Path(bindings['supervisionInputs'][0]['path'])
spec = importlib.util.spec_from_file_location('flow_af51_center_supervision', wrapper)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
if sys.argv[1:] != ['--execute-center-once']:
    raise SystemExit('EXPLICIT_OPERATION_REQUIRED')
result = module.supervise(['/opt/homebrew/opt/node@24/bin/node', str(HERE / 'operator.mjs'), '--execute-center-once'], work_seconds=28, exit_seconds=2)
print(json.dumps(result), flush=True)
raise SystemExit(0 if result['outcome'] == 'operator-returned-zero' else 124 if result['deadlineExceeded'] else 1)

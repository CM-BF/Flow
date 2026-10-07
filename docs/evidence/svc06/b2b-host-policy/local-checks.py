"""Bounded syntax/status and three pure terminal-guard checks; no product imports or services."""
import ast
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import time
from datetime import datetime, timezone
sys.dont_write_bytecode = True
base = Path(__file__).resolve().parent
started = time.monotonic()
module_path = Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/tools/owned-process-supervision/supervise.py')
assert hashlib.sha256(module_path.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
spec = importlib.util.spec_from_file_location('svc06_local_ops14', module_path)
module = importlib.util.module_from_spec(spec); sys.modules[spec.name] = module; spec.loader.exec_module(module)
input = json.loads((base / 'inputs.json').read_text()); node = input['node']
free = os.statvfs(base); available = free.f_bavail * free.f_frsize
assert available >= 1024**3 + 1024**2
scratch = Path(tempfile.mkdtemp(prefix='flow-svc06-host-policy-local-')).resolve(); os.chmod(scratch, 0o700)
st = scratch.stat(); result = {'startedAt': datetime.now(timezone.utc).isoformat(), 'source': '3444895e', 'freshFree': available, 'scratch': str(scratch), 'scratchIdentity': {'dev': st.st_dev, 'ino': st.st_ino}, 'checks': []}
env = {'PATH': f'{Path(node).parent}:/usr/bin:/bin', 'HOME': str(scratch), 'TMPDIR': str(scratch), 'NODE_DISABLE_COMPILE_CACHE': '1', 'PYTHONDONTWRITEBYTECODE': '1'}
commands = [('entry-syntax', [node, '--check', str(base / 'entry.mjs')]), ('journey-syntax', [node, '--check', str(base / 'journey.mjs')]), ('work-terminal-3', [node, '--test', str(base / 'work-terminal.test.mjs')]), ('status', [node, '--input-type=module', '-e', "import {readFile} from 'node:fs/promises';import{parseStatus}from'/Users/citrine/Projects/AgentHarness/Flow/apps/execution-dashboard/src/status.mjs';const s=parseStatus(await readFile('plans/svc06-backend-release/status.md','utf8'),'SVC06');console.log(JSON.stringify({errors:s.errors,humanMissing:s.human.missing,timingIssues:s.timing.issues}));if(s.errors.length||s.human.missing.length)process.exitCode=1;"])]
try:
    ast.parse((base / 'supervise.py').read_text()); result['pythonAST'] = 'parsed-without-import'
    for name, argv in commands:
        remaining = 10 - (time.monotonic() - started)
        assert remaining > 2.5
        report = module.supervise(module.Launch(tuple(argv), str(base.parents[3]), env, module.Ownership.NEW_CHILD_SESSION), module.Policy(min(3, remaining - 2.5), .5, 2, 32768))
        value = dict(vars(report))
        for stream in ('stdout', 'stderr'):
            raw = getattr(report, stream)
            with (base / (name + '.' + stream)).open('xb') as f: f.write(raw)
            value[stream] = {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
        result['checks'].append({'name': name, **value})
        if not (report.exit_code == 0 and report.owned_state == 'absent' and all(report.eof.values()) and report.first_failure is None): break
except BaseException as error:
    result['failureType'] = type(error).__name__
finally:
    info = scratch.stat(); assert (info.st_dev, info.st_ino) == (st.st_dev, st.st_ino)
    entries = list(scratch.iterdir()); result['scratchEntriesAfter'] = len(entries)
    if not entries: scratch.rmdir(); result['scratchRemoved'] = True
    else: result['scratchRemoved'] = False
    result['finishedAt'] = datetime.now(timezone.utc).isoformat(); result['elapsedMs'] = round((time.monotonic() - started) * 1000)
    with (base / 'local-result.json').open('x') as f: json.dump(result, f, indent=2); f.write('\n')
print(json.dumps({'checks': [(v['name'], v['exit_code']) for v in result['checks']], 'failure': result.get('failureType'), 'elapsedMs': result['elapsedMs'], 'scratchRemoved': result['scratchRemoved']}))
raise SystemExit(0 if len(result['checks']) == 4 and all(v['exit_code'] == 0 for v in result['checks']) and result['scratchRemoved'] and 'failureType' not in result else 1)

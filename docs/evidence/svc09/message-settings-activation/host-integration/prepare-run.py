"""One local definition-import/parameter check; no host, native, database or install."""
from pathlib import Path
from dataclasses import asdict
import ast, datetime, hashlib, importlib.util, json, os, shutil, sys, tempfile
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
NODE = '/opt/homebrew/Cellar/node@24/24.20.0/bin/node'
MODULE = ROOT / 'tools/owned-process-supervision/supervise.py'
assert hashlib.sha256(MODULE.read_bytes()).hexdigest() == '725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
spec = importlib.util.spec_from_file_location('svc09a_prepare_ops14', MODULE)
ops = importlib.util.module_from_spec(spec); sys.modules[spec.name] = ops; spec.loader.exec_module(ops)
assert sys.argv[1:] in ([], ['--host-guard'], ['--review-fixes'], ['--work-environment'], ['--retry-arguments'], ['--path-contract'], ['--path-contract-recheck'], ['--mixed-query'])
host_guard = sys.argv[1:] == ['--host-guard']
review_fixes = sys.argv[1:] == ['--review-fixes']
work_environment = sys.argv[1:] == ['--work-environment']
retry_arguments = sys.argv[1:] == ['--retry-arguments']
path_recheck = sys.argv[1:] == ['--path-contract-recheck']
path_contract = sys.argv[1:] == ['--path-contract'] or path_recheck
mixed_query = sys.argv[1:] == ['--mixed-query']
run = HERE / ('prepare-local-08' if mixed_query else 'prepare-local-07' if path_recheck else 'prepare-local-06' if path_contract else 'prepare-local-05' if retry_arguments else 'prepare-local-04' if work_environment else 'prepare-local-03' if review_fixes else 'prepare-local-02' if host_guard else 'prepare-local-01'); run.mkdir()

def save(name, value):
    data = value if isinstance(value, bytes) else (json.dumps(value, indent=2) + '\n').encode()
    fd = os.open(run/name, os.O_CREAT|os.O_EXCL|os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'wb') as f: f.write(data); f.flush(); os.fsync(f.fileno())

free = shutil.disk_usage(ROOT).free
assert free >= 1024**3 + 2*1024**2 + 256*1024
if work_environment or retry_arguments: assert free >= 16175529984
if path_contract: assert free >= 17942446080
if mixed_query: assert free >= 19363266560
# The path-contract check uses the identical generator/prefix/tmp parent as the actual operator.
scratch = Path(tempfile.mkdtemp(prefix='flow-svc09a-host-' if path_contract else 'flow-svc09a-review-' if review_fixes else 'flow-svc09a-host-preparation-' if host_guard else 'flow-svc09a-prepare-',dir='/private/tmp')); before = scratch.lstat()
argv = (NODE, '--test', '--test-reporter=spec', str(HERE/'host-prepare.test.mjs')) if host_guard else (NODE, str(HERE/'prepare-check.mjs'))
inputs = ['host-consumer.mjs','mixed-runner.mjs','prepare-check.mjs','prepare-run.py']
if host_guard or review_fixes:
    inputs += ['host-entry.mjs','host-fixture.mjs','host-records.mjs','host-cleanup.mjs','host-run.py','measure-once.py','host-prepare.test.mjs','host-inputs.json']
    if review_fixes: inputs += ['host-supervise.py','host-supervise.test.py','host-review-fixes.test.mjs']
    for name in ['host-run.py','measure-once.py'] + (['host-supervise.py','host-supervise.test.py'] if review_fixes else []):
        ast.parse((HERE/name).read_text())
commands = [(NODE, '--test', '--test-reporter=spec', str(HERE/'host-review-fixes.test.mjs')), (sys.executable, str(HERE/'host-supervise.test.py'))] if review_fixes else [argv]
if work_environment or retry_arguments or path_contract:
    inputs = ['host-run.py', 'host-supervise.py', 'host-supervise.test.py', 'prepare-run.py', 'host-inputs.json']
    for name in inputs:
        if name.endswith('.py'): ast.parse((HERE/name).read_text())
    selected = [
        'OperatorBoundary.test_work_environment_resolves_actual_listener_tool_missing_from_old_path',
        'OperatorBoundary.test_work_environment_keeps_private_paths_and_does_not_inherit_credentials'] if work_environment else [
        'OperatorBoundary.test_attempt_arguments_bind_each_fixed_namespace_and_preparation',
        'OperatorBoundary.test_unknown_or_user_supplied_attempt_paths_are_rejected_before_io',
        'OperatorBoundary.test_consumed_operator_or_outer_namespace_refuses_reuse_without_touching_old_attempt']
    commands = [(sys.executable, str(HERE/'host-supervise.test.py'), *selected)]
if path_contract:
    inputs += ['host-paths.mjs', 'host-paths.test.mjs', 'host-consumer.mjs', 'host-entry.mjs', 'host-cleanup.mjs', 'host-records.mjs', 'host-fixture.mjs']
    selection = ('--test-name-pattern=actual Python mkdtemp root',) if path_recheck else ()
    commands.insert(0, (NODE, '--test', '--test-reporter=spec', *selection, str(HERE/'host-paths.test.mjs')))
schema_sha = '277ab00876c0b904168b4d3f1b2dc2b3221761bb27cb0a8b5e2618e7aa0f5653'
if mixed_query:
    assert hashlib.sha256((ROOT/'apps/server/src/database.ts').read_bytes()).hexdigest() == schema_sha
    inputs = ['mixed-runner.mjs', 'mixed-query.test.mjs', 'host-records.mjs', 'host-fixture.mjs', 'prepare-run.py']
    ast.parse((HERE/'prepare-run.py').read_text())
    commands = [(NODE, '--test', '--test-reporter=spec', str(HERE/'mixed-query.test.mjs'))]
output_cap = 131072 if path_contract or mixed_query else 262144
save('reservation.json', {'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'argv':argv if not (review_fixes or work_environment or retry_arguments or path_contract) else None,'commands':commands,'freeBytes':free,
  'runtimeBudgetSeconds':20 if path_contract else 10,'rawBytesCap':output_cap,'scratchBytesCap':2097152,'scratch':str(scratch),'dev':before.st_dev,'ino':before.st_ino,
  'pythonAST': 'PASS' if host_guard or review_fixes or work_environment or retry_arguments or path_contract or mixed_query else 'NOT_SELECTED',
  'databaseSchema': {'source': '098b0d51512dfaa04c30ca7cbe103684720fe29f', 'path': 'apps/server/src/database.ts', 'sha256': schema_sha} if mixed_query else None,
  'inputs':[{'path':n,'bytes':(HERE/n).stat().st_size,'sha256':hashlib.sha256((HERE/n).read_bytes()).hexdigest()} for n in inputs]})
reports=[]
for index, command in enumerate(commands):
    prefix = f'case{index+1:02d}-' if review_fixes or path_contract else ''
    remaining_output = output_cap - sum(len(r.stdout) + len(r.stderr) for r in reports)
    assert remaining_output > 0, 'LOCAL_OUTPUT_BUDGET_EXHAUSTED'
    report = ops.supervise(ops.Launch(command,str(ROOT),{'PATH':'/usr/bin:/bin','HOME':str(scratch),'TMPDIR':str(scratch),'NODE_DISABLE_COMPILE_CACHE':'1',
        'PYTHONDONTWRITEBYTECODE':'1','FLOW_SVC09A_PREPARE_SCRATCH':str(scratch),
        **({'FLOW_SVC09A_DATABASE_SOURCE_SHA':schema_sha} if mixed_query else {})},ops.Ownership.NEW_CHILD_SESSION),ops.Policy(8,.5,1,remaining_output))
    reports.append(report)
    save(prefix+'stdout.txt',report.stdout);save(prefix+'stderr.txt',report.stderr)
    v=asdict(report);v.pop('stdout');v.pop('stderr');save(prefix+'result.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'report':v,'rawBytes':len(report.stdout)+len(report.stderr)})
    if report.exit_code!=0 or report.owned_state!='absent' or not all(report.eof.values()): break
all_finished=all(r.owned_state=='absent' and all(r.eof.values()) for r in reports)
after=scratch.lstat(); remaining=list(scratch.iterdir()); cleanup='KEEP'
if all_finished and (before.st_dev,before.st_ino)==(after.st_dev,after.st_ino) and not remaining:
    scratch.rmdir();cleanup='removed'
save('cleanup.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'state':cleanup,'scratch':str(scratch),'dev':before.st_dev,'ino':before.st_ino,'remainingEntries':len(remaining),'ownedState':'absent' if all_finished else 'unknown','eof':[r.eof for r in reports]})
summary={'reports':[{'exit':r.exit_code,'elapsedMs':r.elapsed_ms,'rawBytes':len(r.stdout)+len(r.stderr),'ownedState':r.owned_state,'eof':r.eof} for r in reports],'cleanup':cleanup}
if review_fixes or path_contract: save('summary.json',summary)
print(json.dumps(summary))
raise SystemExit(0 if len(reports)==len(commands) and all(r.exit_code==0 for r in reports) and all_finished and cleanup=='removed' else 1)

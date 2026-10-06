"""Parse candidate data and syntax only; never execute its commands/imports."""
from pathlib import Path
import datetime, hashlib, json, re, subprocess
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'docs/evidence/ops-ci01'
BASE = '37f75d3654fc500d37b1ddfda0871807d878715f'
workflow = ROOT / 'docs/ci/check-workflow.yml'
parsed = subprocess.run(['/usr/bin/ruby','--disable-gems','-rpsych','-rjson','-e',
    'puts JSON.generate(Psych.safe_load(File.read(ARGV[0]), permitted_classes: [], aliases: false))',str(workflow)],capture_output=True,text=True,timeout=5)
assert parsed.returncode == 0, parsed.stderr
job_data = json.loads(parsed.stdout)
assert set(job_data['on']) == {'workflow_dispatch'}
assert job_data['permissions'] == {'contents':'read'}
assert len(job_data['jobs']) == 1
job = job_data['jobs']['contracts-and-handler']
assert job['runs-on']=='ubuntu-24.04' and job['timeout-minutes']==12
assert job['if']=='github.event.repository.private == false'
assert job['env']['FLOW_TEST_DATABASE_URL'].endswith('@127.0.0.1:55432/flow_c01')
assert job['services']['postgres']['env']['POSTGRES_DB']=='flow_c01'
assert job['services']['postgres']['ports']==['55432:5432']
text=workflow.read_text()
assert 'secrets.' not in text and 'pull_request' not in text and 'pnpm check' not in text
assert 'upload-artifact' not in text and 'cache: pnpm' not in text
syntax=[]
for step in job['steps']:
    if 'uses' in step:
        assert re.fullmatch(r'(actions/checkout|actions/setup-node|pnpm/action-setup)@[a-f0-9]{40}',step['uses'])
        continue
    source=step['run']
    result=subprocess.run(['/bin/bash','-n'],input=source,capture_output=True,text=True,timeout=5)
    syntax.append({'name':step['name'],'parser':'bash -n','exit':result.returncode,'stderr':result.stderr})
    assert result.returncode==0,result.stderr
    for script in re.findall(r"node --input-type=module - <<'NODE'\n(.*?)\nNODE",source,re.S):
        result=subprocess.run(['/opt/homebrew/opt/node@24/bin/node','--check','--input-type=module'],input=script,capture_output=True,text=True,timeout=5)
        syntax.append({'name':step['name'],'parser':'Node24 --check only','exit':result.returncode,'stderr':result.stderr})
        assert result.returncode==0,result.stderr
contracts=ROOT/'packages/contracts/src/contracts.test.ts';server=ROOT/'apps/server/src/server.test.ts'
contract_count=len(re.findall(r'\bit\(',contracts.read_text()));server_count=len(re.findall(r'\bit\(',server.read_text()))
assert contract_count==2 and server_count==10
selected_title='persists accepted commands across restart and rejects changed retries'
assert server.read_text().count("it('"+selected_title+"'")==1
assert 'FLOW_TEST_DATABASE_URL' in server.read_text() and "testDatabase.pathname !== '/flow_c01'" in server.read_text()
assert "testDatabase.hostname !== '127.0.0.1'" in server.read_text() and "testDatabase.port !== '55432'" in server.read_text()
assert "await server?.close()" in server.read_text()
assert json.loads((ROOT/'package.json').read_bytes())['packageManager']=='pnpm@9.15.4'
assert json.loads((ROOT/'package.json').read_bytes())['devDependencies']['vitest']=='4.0.18'
# All provisioned product/config/SQL bytes, rather than a claim of runtime imports.
provision=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/plan-status-review/docs/quality/ops-ci01-source-provision.json')
original=json.loads(provision.read_bytes());inputs=[];changed=[]
for entry in original['selected']:
    path=entry['path']
    if path in ['docs/ci/README.md','docs/ci/check-workflow.yml']:continue
    local=ROOT/path
    if not local.is_file(): changed.append({'path':path,'reason':'missing'});continue
    data=local.read_bytes();h=hashlib.sha256(data).hexdigest()
    if len(data)!=entry['bytes'] or h!=entry['sha256']:changed.append({'path':path,'reason':'changed'})
    inputs.append({'path':path,'ref':BASE,'bytes':len(data),'sha256':h})
assert not changed,changed
sql=[x for x in inputs if x['path'].startswith('packages/storage/migrations/') and x['path'].endswith('.sql')]
assert len(sql)==31,len(sql)
# Explicit dynamic-array migration callers; no source import is performed.
for path,names in {
 'apps/server/src/goal-tool-runs/index.ts':['012-goal-tool-runs.sql','013-native-goal-tool-runs.sql'],
 'apps/server/src/goal-graph-runs/index.ts':['017-goal-graph-runs.sql','019-native-goal-graph-runs.sql']
}.items():
    code=(ROOT/path).read_text()
    for name in names:assert name in code,(path,name)
result={'kind':'OPS-CI01-static-validation','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'base':BASE,'workflowSha256':hashlib.sha256(workflow.read_bytes()).hexdigest(),
 'yaml':{'parser':'Ruby stdlib Psych 3.1.0, gems disabled','exit':parsed.returncode,'keys':list(job_data)},
 'syntax':syntax,'staticSelection':{'contracts':2,'handler':1,'handlerUnselected':9},
 'resourceClosure':{'providedInputs':len(inputs),'sqlFiles':len(sql),'mismatches':changed,'semantics':'fixed source/SQL existence and digest only; not a runtime import or Linux execution'},
 'localExecution':{'projectImports':0,'tests':0,'PG':0,'provider':0,'dependencyInstalls':0},
 'remoteWorkflow':'NOT_RUN','activation':'NOT_ENABLED','staticChecks':'PASSED'}
(OUT/'static-result.json').write_text(json.dumps(result,indent=2)+'\n')
(OUT/'protected-inputs.json').write_text(json.dumps(inputs,indent=2)+'\n')
(OUT/'workflow-parsed.json').write_text(json.dumps(job_data,indent=2)+'\n')
print(json.dumps({'status':result['staticChecks'],'shellAndJavaScriptSyntaxChecks':len(syntax),'inputs':len(inputs),'sql':len(sql),'projectTests':0,'remoteWorkflow':'NOT_RUN'}))

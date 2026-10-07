"""One fixed LAZY HTTP/PG window. OPS14 owns processes; existing C02 fixture owns DB."""
import dataclasses,datetime,hashlib,importlib.util,json,os,pathlib,shutil,stat,subprocess,sys,tempfile,time
ROOT=pathlib.Path(__file__).resolve().parents[3]
E=ROOT/'docs/evidence/mature06-lazy-reasoning'
NODE='/opt/homebrew/opt/node@24/bin/node'
PYTHON='/opt/homebrew/bin/python3.13'
OPS=pathlib.Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')

def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);sys.modules[name]=value;spec.loader.exec_module(value);return value

def main():
 started=time.monotonic();utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
 expected=os.environ.get('FLOW_LAZY_EXECUTION_HEAD');window=os.environ.get('FLOW_LAZY_WINDOW')
 if os.environ.get('FLOW_LAZY_PG_OPEN')!='1':raise SystemExit('NOT_OPEN')
 source=(E/'pg-input.json').read_bytes();input=json.loads(source)
 if hashlib.sha256(source).hexdigest()!=os.environ.get('FLOW_LAZY_INPUT_SHA')or window!=input['window']:raise SystemExit('INPUT_NOT_FIXED')
 head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True,timeout=2).strip()
 if head!=expected or subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,timeout=2):raise SystemExit('HEAD_NOT_CLEAN')
 for row in input['bindings']:
  path=ROOT/row['path'];value=path.read_bytes()
  if path.is_symlink()or len(value)!=row['bytes']or hashlib.sha256(value).hexdigest()!=row['sha256']:raise SystemExit('INPUT_CHANGED')
 for row in input['external']:
  path=pathlib.Path(row['path'])
  if str(path.resolve())!=row['realpath']:raise SystemExit('EXTERNAL_PATH_CHANGED')
  value=path.read_bytes()
  if len(value)!=row['bytes']or hashlib.sha256(value).hexdigest()!=row['sha256']:raise SystemExit('EXTERNAL_CHANGED')
 ledger=json.loads(subprocess.check_output([NODE,'/Users/citrine/Projects/AgentHarness/Flow/apps/execution-dashboard/src/coordination/cli.mjs','list'],timeout=3,stderr=subprocess.DEVNULL))
 claim=next((c for c in ledger['claims']if c['claimId']==input['claim']['claimId']),None)
 if ledger['state']!='available'or claim is None or any(claim.get(k)!=v for k,v in input['claim'].items()):raise SystemExit('CLAIM_UNKNOWN')
 prefix=E/('pg-'+window)
 paths={name:pathlib.Path(str(prefix)+suffix)for name,suffix in input['outputs'].items()}
 for path in paths.values():
  try:path.lstat()
  except FileNotFoundError:continue
  raise SystemExit('OUTPUT_EXISTS_NO_RETRY')
 free=shutil.disk_usage(ROOT).free
 if free<int(input['freeFloorBytes']):raise SystemExit('RESOURCE_NOT_RUN')
 if not os.environ.get('FLOW_C02_PG_ADMIN_URL'):raise SystemExit('ADMIN_MAPPING_MISSING')
 if time.monotonic()-started>5:raise SystemExit('PREFLIGHT_DEADLINE')
 helper=module('lazy_fixture_resource',ROOT/'docs/evidence/mature02c02/execute-pg-once.py');ops=module('lazy_ops14',OPS)
 record={'window':window,'head':head,'inputSHA':hashlib.sha256(source).hexdigest(),'startedAt':utc(),'freeBefore':free,'primary':None,'secondary':[],'provider':0,'native':0,'process':None,'tmp':None,'fixture':None,'tests':None}
 root=None;identity=None;closed=False
 helper.save(paths['reservation'],{'window':window,'head':head,'operatorPid':os.getpid(),'at':utc()})
 try:
  root=pathlib.Path(tempfile.mkdtemp(prefix='flow-lazy-pg-'));record['tmp']={'path':str(root),'state':'KEEP'};info=root.lstat();identity=(info.st_dev,info.st_ino);record['tmp'].update({'dev':info.st_dev,'ino':info.st_ino})
  helper.save(paths['root'],record['tmp'])
  now=time.time();env={**os.environ,'NODE_DISABLE_COMPILE_CACHE':'1','TMPDIR':str(root),'TMP':str(root),'TEMP':str(root),'VITE_CACHE_DIR':str(root/'vite'),'XDG_CACHE_HOME':str(root/'cache'),'FLOW_C02_PG_WINDOW':'reviewed','FLOW_C02_WINDOW':window,'FLOW_C02_EXECUTION_HEAD':head,'FLOW_C02_PG_RECEIPT':str(paths['fixture']),'FLOW_C02_PG_WORK_UNTIL':str(int((now+40)*1000)),'FLOW_C02_PG_CLEANUP_UNTIL':str(int((now+78)*1000)),'FLOW_LAZY_CHILD_RECEIPT':str(paths['child'])}
  deps=json.loads((E/'dependencies.json').read_text())
  argv=(PYTHON,'-B',str(E/'pg-child.py'),NODE,deps['vitest']+'/vitest.mjs','run','--config',str(E/'pg-vitest.config.mjs'),'--configLoader','native','apps/server/src/assistant-stream/selection-pg.test.ts','--reporter=json','--outputFile='+str(paths['vitest']))
  remaining=90-(time.monotonic()-started)-5
  if remaining<79:raise ValueError('SPAWN_DEADLINE')
  report=ops.supervise(ops.Launch(argv,str(ROOT),env,ops.Ownership.NEW_CHILD_SESSION,ops.Capture.MERGED),ops.Policy(min(80,remaining-1),.5,.5,524288))
  facts=dataclasses.asdict(report);facts.pop('stdout');facts.pop('stderr');record['process']=facts
  fd=os.open(paths['raw'],os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  with os.fdopen(fd,'wb')as file:file.write(report.stdout);file.flush();os.fsync(file.fileno())
  closed=report.exit_code is not None and report.owned_state=='absent'and all(report.eof.values())and not report.secondary_failures
  if not closed:raise ValueError('PROCESS_UNKNOWN')
  fixture,receipt=helper.read_json(paths['fixture'],8192);record['fixture']={'facts':fixture,'receipt':receipt}
  if fixture.get('window')!=window or fixture.get('sourceHead')!=head:raise ValueError('FIXTURE_IDENTITY')
  results,receipt=helper.read_json(paths['vitest'],262144);record['tests']={'total':results.get('numTotalTests'),'passed':results.get('numPassedTests'),'failed':results.get('numFailedTests'),'pending':results.get('numPendingTests'),'receipt':receipt}
  if report.exit_code!=0 or report.first_failure or not fixture.get('cleanupComplete')or results.get('numTotalTests')!=2 or results.get('numPassedTests')!=2:raise ValueError('VALIDATION_NOT_PASSED')
 except BaseException as error:record['primary']={'type':type(error).__name__,'code':str(error)if isinstance(error,ValueError)else'EXECUTION_OR_PERSISTENCE_UNKNOWN','errno':getattr(error,'errno',None)}
 finally:
  if root is not None and identity is not None and closed and (record.get('fixture')or{}).get('facts',{}).get('cleanupComplete'):
   try:
    sample=helper.temp_sample(root,identity,started+88);record['tmp']['closedSample']=sample
    if sample['logicalBytes']>33554432:raise ValueError('TMP_BUDGET')
    current=root.lstat()
    if(current.st_dev,current.st_ino)!=identity:raise ValueError('TMP_IDENTITY')
    shutil.rmtree(root)
    try:root.lstat();raise ValueError('TMP_NOT_ABSENT')
    except FileNotFoundError:record['tmp']['state']='absent'
   except BaseException as error:record['secondary'].append({'phase':'tmp','type':type(error).__name__,'errno':getattr(error,'errno',None)})
  sizes={}
  for name,path in paths.items():
   if name=='result':continue
   try:
    info=path.lstat()
    if not stat.S_ISREG(info.st_mode):raise ValueError('OUTPUT_KIND')
    sizes[name]=info.st_size
   except FileNotFoundError:continue
   except BaseException:record['secondary'].append({'phase':'output','code':'UNKNOWN'})
  record['outputBytesBeforeResult']=sum(sizes.values());record['outputSizes']=sizes;record['finishedAt']=utc();record['elapsedSeconds']=time.monotonic()-started
  record['internalChecksPassed']=not record['primary']and not record['secondary']and record['tmp']is not None and record['tmp']['state']=='absent'and record['elapsedSeconds']<=90 and record['outputBytesBeforeResult']<=1000000
  record['wholeToolCompletedAt']=None;record['finalPersistenceIncludedInElapsed']=False
  encoded=json.dumps(record,indent=2).encode()
  if len(encoded)>65536 or record['outputBytesBeforeResult']+len(encoded)>1048576:record['internalChecksPassed']=False;record['secondary'].append({'phase':'result','code':'OUTPUT_BUDGET'})
  helper.save(paths['result'],record)
  print(json.dumps({'window':window,'internalChecksPassed':record['internalChecksPassed'],'processClosed':closed,'fixtureCleanup':(record.get('fixture')or{}).get('facts',{}).get('cleanupComplete'),'tmp':record['tmp'],'elapsedSeconds':record['elapsedSeconds']}))
 return 0 if record['internalChecksPassed']else 1

if __name__=='__main__':raise SystemExit(main())

"""One reviewed helper request. OPS14 owns processes; existing exec_only owns FD closure."""
from pathlib import Path
import dataclasses, hashlib, importlib.util, json, os, resource, shutil, signal, stat, sys, tempfile, time
ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
OLD_SHIM = HERE.parent/'stock-helper/run.py'
SUPERVISOR = ROOT/'tools/owned-process-supervision/supervise.py'
NODE = '/opt/homebrew/opt/node@24/bin/node'
LOADER = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/node_modules/tsx/dist/loader.mjs'
NATIVE = '/opt/homebrew/lib/node_modules/@openai/codex/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/bin/codex'

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);sys.modules[name]=module;spec.loader.exec_module(module);return module

def digest(path):
    with Path(path).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()

def identity(path):
    s=path.lstat()
    if not stat.S_ISREG(s.st_mode) or s.st_nlink!=1 or s.st_uid!=os.getuid():raise RuntimeError('OWN_FILE_REQUIRED')
    return {'dev':str(s.st_dev),'ino':str(s.st_ino),'size':s.st_size,'mode':s.st_mode,'uid':s.st_uid,'nlink':s.st_nlink}

def read_file(path,maximum):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        s=os.fstat(fd)
        if not stat.S_ISREG(s.st_mode) or s.st_size>maximum:raise RuntimeError('BOUNDED_FILE_REQUIRED')
        with os.fdopen(fd,'rb',closefd=False) as f:data=f.read(maximum+1)
        if len(data)>maximum:raise RuntimeError('FILE_LIMIT')
        return data
    finally:os.close(fd)

def measure(directory):
    total=0;entries=0;pending=[directory]
    while pending:
        current=pending.pop()
        with os.scandir(current) as stream:
            for entry in stream:
                entries+=1
                if entries>128:raise RuntimeError('PRIVATE_ENTRY_LIMIT')
                info=entry.stat(follow_symlinks=False)
                if stat.S_ISDIR(info.st_mode):pending.append(Path(entry.path))
                elif stat.S_ISREG(info.st_mode):total+=info.st_size
                else:raise RuntimeError('PRIVATE_FILE_TYPE_UNKNOWN')
                if total>1048576:raise RuntimeError('PRIVATE_BYTE_LIMIT')
    return total

def run():
    started=time.monotonic();deadline=started+10
    signal.signal(signal.SIGALRM,lambda *_:os._exit(124));signal.setitimer(signal.ITIMER_REAL,10)
    resource.setrlimit(resource.RLIMIT_CORE,(0,0))
    out=HERE/'stock-run-once';out.mkdir(mode=0o700) # Exclusive; never replay a failed/unknown run.
    # Check the reused persistence module before importing it; no user/service reads.
    if digest(OLD_SHIM)!='d037b8a0c0075ae0727150344ec714ed41753d3bb6a2465e30081a6b5db23ba7':raise RuntimeError('SHIM_CHANGED')
    old=load('eng01j_old_shim',OLD_SHIM);save=old.persist
    expected=json.loads((HERE/'stock-inputs.json').read_text())
    try:
        for binding in expected['bindings']:
            path=Path(binding['path']) if binding['path'].startswith('/') else ROOT/binding['path']
            if (binding.get('realpath') and str(path.resolve())!=binding['realpath']) or path.stat().st_size!=binding['bytes'] or digest(path)!=binding['sha256']:raise RuntimeError('INPUT_CHANGED')
    except Exception as error:
        save(out/'not-run.json',{'state':'NOT_RUN','reason':type(error).__name__,'stockAttempts':0,'scratchCreated':False});return 1
    supervisor=load('eng01j_stock_supervisor',SUPERVISOR)
    result={'startedAt':old.utc(),'sourceTarget':expected['productSource'],'stockAttempts':0,'providerCalls':0,'PG':0,'browser':0,
            'primaryFailure':None,'cleanup':{'state':'unknown','removed':False},'reports':[],'limits':{'seconds':10,'rawBytes':65536,'privateBytes':1048576}}
    scratch=None;root_identity=None;reports=[]
    try:
        fs=os.statvfs(ROOT);free=fs.f_bavail*fs.f_frsize
        if free<1107296256:raise RuntimeError('NOT_RUN_RESOURCE_GATE')
        save(out/'intent.json',{**result,'freeBytes':free,'inputsSha256':digest(HERE/'stock-inputs.json'),'entrySha256':digest(Path(__file__))})
        scratch=Path(tempfile.mkdtemp(prefix='eng01j-stock-host-',dir='/private/tmp'));info=scratch.lstat();root_identity=(info.st_dev,info.st_ino)
        result['scratch']={'path':str(scratch),'dev':str(info.st_dev),'ino':str(info.st_ino)}
        save(out/'reservation.json',result)
        workspace=scratch/'workspace';runtime=scratch/'runtime';control=runtime/'control';state=runtime/'state'
        for p in (workspace,runtime,control,state):p.mkdir(mode=0o700)
        for name in ('calculator.mjs','baseline.txt'):save(workspace/name,b'0')
        before={name:identity(workspace/name) for name in ('calculator.mjs','baseline.txt')}
        env={'PATH':'/usr/bin:/bin','LANG':'C','HOME':str(state),'TMPDIR':str(state),'CODEX_HOME':str(state)}
        def invoke(label,argv,environment,cap,maximum):
            remaining=deadline-time.monotonic()-2.5 # .5 TERM/reap + two seconds reporting/cleanup.
            if remaining<=.1:raise RuntimeError('NO_CHILD_BUDGET')
            if label=='stock':result['stockAttempts']+=1
            report=supervisor.supervise(supervisor.Launch(tuple(argv),str(workspace),environment,supervisor.Ownership.NEW_CHILD_SESSION),
                                        supervisor.Policy(min(maximum,remaining),.2,.3,cap))
            reports.append(report)
            row=dataclasses.asdict(report);row.pop('stdout');row.pop('stderr');result['reports'].append({'stage':label,**row})
            save(out/(label+'.stdout'),report.stdout);save(out/(label+'.stderr'),report.stderr);save(out/(label+'.json'),row)
            if report.first_failure or report.exit_code!=0 or report.owned_state!='absent' or not all(report.eof.values()):raise RuntimeError(label.upper()+'_PROCESS_NOT_CLEAN')
            return report.stdout
        invoke('prepare',(NODE,'--import',LOADER,str(HERE/'prepare-once.ts'),str(scratch)),{**env,'NODE_DISABLE_COMPILE_CACHE':'1','TSX_DISABLE_CACHE':'1'},2048,2)
        launch=json.loads(read_file(control/'launch.json',4096));policy=read_file(control/'policy.sb',24576);request=read_file(control/'request.json',1024)
        if launch!={'policySha256':hashlib.sha256(policy).hexdigest(),'requestSha256':hashlib.sha256(request).hexdigest(),
            'executable':'/usr/bin/sandbox-exec','native':NATIVE,'helperArgument':'--codex-run-as-fs-helper','cwd':str(workspace),
            'environment':env,'stdin':'readonly-regular-file','extraDescriptors':'closed','writeAccess':'unknown'}:raise RuntimeError('PREPARED_LAUNCH_MISMATCH')
        # Bind the actual -f profile bytes to the prepared -p spec, without rebuilding a policy or request.
        if json.loads(request)!={'operation':'fs/writeFile','params':{'path':(workspace/'calculator.mjs').as_uri(),'dataBase64':'WA==','followSymlinks':False,'sandbox':None}}:raise RuntimeError('PREPARED_REQUEST_MISMATCH')
        if any(identity(workspace/name)!=before[name] for name in before):raise RuntimeError('TARGET_CHANGED_BEFORE_LAUNCH')
        save(out/'prepared.json',{'launch':launch,'before':before,'request':json.loads(request)})
        save(out/'policy.sb',policy)
        if measure(scratch)>1048576:raise RuntimeError('PRIVATE_BYTE_LIMIT')
        save(out/'stock-intent.json',{'maximumStockAttempts':1,'native':NATIVE,'shim':str(OLD_SHIM),'requestSha256':launch['requestSha256']})
        raw=invoke('stock',(sys.executable,'-B',str(OLD_SHIM),'exec-only',str(control),str(control/'request.json')),env,16384,3)
        reply=json.loads(raw)
        facts={name:{'identity':identity(workspace/name),'hex':read_file(workspace/name,2).hex()} for name in before}
        result['fileFacts']=facts;result['responseMatchesExpected']=(reply=={'status':'ok','payload':{'operation':'fs/writeFile','response':{}}});result['writeAccess']='unknown'
        same=all(facts[name]['identity']['dev']==before[name]['dev'] and facts[name]['identity']['ino']==before[name]['ino'] for name in before)
        valid=(reply=={'status':'ok','payload':{'operation':'fs/writeFile','response':{}}} and same
               and facts['calculator.mjs']['hex']=='58' and facts['baseline.txt']['hex']=='30'
               and sorted(os.listdir(workspace))==['baseline.txt','calculator.mjs'])
        save(out/'file-facts.json',{'responseMatchesExpected':result['responseMatchesExpected'],'files':facts,'passed':valid,'writeAccess':'unknown'})
        if not valid:raise RuntimeError('PAYLOAD_OR_FILE_MISMATCH')
    except Exception as error:
        result['primaryFailure']={'code':str(error)[:100] if isinstance(error,RuntimeError) else 'ENTRY_EXCEPTION','type':type(error).__name__}
    finally:
        if scratch is not None:
            try:
                current=scratch.lstat();same=stat.S_ISDIR(current.st_mode) and (current.st_dev,current.st_ino)==root_identity
                private_bytes=measure(scratch);clean=all(r.owned_state=='absent' and all(r.eof.values()) for r in reports)
                result['cleanup']={'state':'ready' if same and clean else 'unknown','identityMatched':same,'privateBytesAtEnd':private_bytes,'removed':False}
                # Bounded diagnostics survive even when stock startup fails before a payload.
                result['finalFiles']={name:{'identity':identity(workspace/name),'hex':read_file(workspace/name,2).hex()} for name in before} if 'before' in locals() else {}
                result['rawBytes']=sum(r.retained_bytes for r in reports)
                evidence_bytes=sum(p.stat().st_size for p in out.iterdir() if p.is_file())
                result['evidenceBytesBeforeCheckpoint']=evidence_bytes
                if evidence_bytes+16384>65536 or private_bytes>1048576:raise RuntimeError('RECORD_OR_PRIVATE_LIMIT')
                save(out/'checkpoint-before-cleanup.json',result)
                if same and clean:shutil.rmtree(scratch);result['cleanup'].update({'state':'complete','removed':True})
            except Exception as error:
                result['cleanup'].update({'state':'unknown','errorType':type(error).__name__})
                result['primaryFailure']=result['primaryFailure'] or {'code':'CLEANUP_UNKNOWN'}
    result['finishedAt']=old.utc();result['elapsedMs']=round((time.monotonic()-started)*1000)
    result['passed']=result['stockAttempts']==1 and result['primaryFailure'] is None and result['cleanup']['state']=='complete'
    save(out/'result.json',result)
    print(json.dumps({'passed':result['passed'],'stockAttempts':result['stockAttempts'],'elapsedMs':result['elapsedMs'],'cleanup':result['cleanup']['state']}),flush=True)
    signal.setitimer(signal.ITIMER_REAL,0)
    return 0 if result['passed'] else 1

if __name__=='__main__':
    if sys.argv[1:]!=['--run']:raise SystemExit(64)
    raise SystemExit(run())

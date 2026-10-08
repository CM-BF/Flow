"""PREPARED / NOT_RUN. Native Chrome sibling changes authority; explicit Lead acceptance and a fresh gate are mandatory.
Reuses reviewed Quick b1 sibling lifecycle/terminal contract, exact owned-scratch guard and DPERF partial retained OPS meter. Never execute for syntax checking.
"""
import datetime, errno, hashlib, importlib.util, json, os, re, selectors, shutil, signal, stat, subprocess, sys, time
from dataclasses import asdict
from pathlib import Path
BASE = Path(__file__).resolve().parent
MiB = 1024 ** 2
TOTAL_MS = 90000
CLEANUP_MS = 15000
ENTRY = 'worker.mjs'
BOUNDARY = 'native-chrome-sibling-without-custom-outer-write-or-egress-sandbox'
TERMINAL_CONTRACT = 'visual-picker-browser-v1-external-exit-required'

def load(p):
    assert Path(p).is_file() and not Path(p).is_symlink() and Path(p).stat().st_size <= MiB
    return json.loads(Path(p).read_text())
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p, value):
    encoded=(json.dumps(value, indent=2)+'\n').encode()
    assert len(encoded)<=128*1024, 'Bounded parent JSON exceeded'
    Path(p).write_bytes(encoded)
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def scan_error(error):
    if error.errno != errno.ENOENT: raise error  # Only a vanished directory is transient.

def sizes(root):
    logical = allocated = 0
    for parent, directories, files in os.walk(root, followlinks=False, onerror=scan_error):
        directories[:] = [n for n in directories if not (Path(parent)/n).is_symlink()]
        for name in files:
            try: s = (Path(parent)/name).lstat()
            except FileNotFoundError: continue
            if stat.S_ISREG(s.st_mode): logical += s.st_size; allocated += s.st_blocks * 512
    return logical, allocated

def free(p):
    s = os.statvfs(p); return s.f_bavail * s.f_frsize

def alive(p):
    if p is None: return False
    try: os.killpg(p.pid, 0); return True
    except ProcessLookupError: return False
    except PermissionError: return True  # Unknown is not absence; retain scratch and fail cleanup.

def stop(p, sig):
    if p:
        try: os.killpg(p.pid, sig)
        except ProcessLookupError: pass

def main():
    assert len(sys.argv) == 3 and sys.argv[1] == '--gate'
    preparation_started=time.monotonic(); preparation_wall_ms=int(time.time()*1000)
    binding = load(BASE/'binding.json')
    assert binding['state'] == 'REVIEWED_SOURCE_BOUND', 'Independent source review and fresh admission are required'
    gate = load(sys.argv[2])
    assert gate['allowRun'] is True and gate['singleUse'] is True and gate['mode'] == 'visual-picker-browser'
    assert gate['taskId'] == binding['task'] == 'WPF-VISUAL01'
    assert gate['bindingSha256'] == sha(BASE/'binding.json') and gate['runnerSha256'] == sha(__file__)
    assert gate['claim'] == binding['claim'] and gate['overlaps'] == []
    assert datetime.datetime.fromisoformat(gate['expiresAt'].replace('Z','+00:00')) > datetime.datetime.now(datetime.timezone.utc)
    assert gate['entry'] == 'visual-picker' and re.fullmatch('[a-zA-Z0-9-]{1,80}', gate['run'])
    assert gate['sourceHead'] == binding['head'] and gate['sourceHashes'] == binding['sources']
    assert gate['previousRuntimeMs'] == binding['previousRuntimeMs']
    assert gate['previousRuntimeMs'] == 0 and binding['previousEvidenceBytes'] == 0, 'First VISUAL Picker browser packet; no prior browser budget inheritance'
    assert binding['terminalAcceptance']['contract'] == TERMINAL_CONTRACT
    assert gate['totalMs'] == TOTAL_MS-gate['previousRuntimeMs']
    assert gate['startFreeBytes'] >= 1024**3+128*MiB and gate['stopFreeBytes'] >= 1024**3+64*MiB
    # Manager pins a real Lead decision separately from source approval. No approval is supplied by this preparation.
    approval = binding['nativeChromeBoundaryApproval']
    assert approval is not None and gate['nativeChromeBoundaryApproval'] == approval
    assert sha(approval['path']) == approval['sha256']
    accepted = load(approval['path'])
    assert accepted['decision'] == 'ACCEPTED' and accepted['boundary'] == BOUNDARY
    assert accepted['runnerSha256'] == sha(__file__) and accepted['workerSha256'] == binding['preparedFiles'][ENTRY]
    root = Path(binding['worktree']); assert root.resolve() == root
    # Direct/strict history is scoped to unchanged component/controller inputs, not the changed browser fixture.
    prior = binding['priorLocalEvidence']
    assert gate['priorLocalEvidence'] == prior
    for item in prior['reviews']:
        assert sha(item['path']) == item['sha256']
    for relative, digest in prior['unchangedSources'].items():
        assert binding['sources'][relative] == digest
    review = binding['sourceReview']; assert review is not None and gate['sourceReview'] == review
    assert sha(review['path']) == review['sha256']
    budget = BASE/'browser-budget.json'
    for name in ('browser-budget.json', 'result.json', 'consumed-gate.json', 'scratch', 'raw', 'worker.log'):
        assert not (BASE/name).exists(), 'This packet is one use and cannot reset or retry'
    with (BASE/'consumed-gate.json').open('x') as f: json.dump(gate, f)
    started = preparation_started; wall_ms = preparation_wall_ms
    hard = started+gate['totalMs']/1000; work = hard-CLEANUP_MS/1000
    scratch = BASE/'scratch'; output = BASE/'raw'/gate['run']
    assert len(str(scratch).encode('utf8')) <= 40
    scratch_identity = None
    process = chrome = None; errors = []; cleanup = []; samples = []; streams = {}; stopping = False
    selector = selectors.DefaultSelector(); handles = []; chrome_facts = None
    meter_record={'adoption':'PARTIAL_RETAINED_ADOPTION','unknown':[],'last':None}
    meter=None
    report = {'measurement':meter_record,'state':'FAILED', 'sourceHead':binding['head'], 'implementation':binding['implementation'],
              'entry':gate['entry'], 'startedAt':now(), 'previousRuntimeMs':gate['previousRuntimeMs'],
              'authorityBoundary':BOUNDARY, 'boundaryApproval':approval, 'samples':samples, 'errors':errors,
              'terminalContract':TERMINAL_CONTRACT, 'priorLocalEvidence':prior,
              'completionBoundary':'Final dual-group cleanup/resource/result seal before restoring cooperative handlers; external actual exit receipt is still mandatory'}
    def request_stop(sig, frame):
        nonlocal stopping
        stopping = True
        if 'stopSignal' not in report:
            report['stopSignal'] = signal.Signals(sig).name
            errors.append('Cooperative stop: '+report['stopSignal'])
        report['state'] = 'FAILED'
    previous_handlers = {sig:signal.signal(sig,request_stop) for sig in (signal.SIGTERM,signal.SIGINT)}
    def retained_bytes():
        sample=meter.measure(meter.Root(str(BASE), binding['measurementRoot']['device'], binding['measurementRoot']['inode']),
          exclude=('scratch',), limits=meter.Limits(max_entries=20000,max_seconds=.25))
        meter_record['last']=asdict(sample)
        if sample.state!='complete':
            meter_record['unknown'].append(asdict(sample)); raise RuntimeError('Retained measurement unknown')
        return sample.logical_bytes + binding['previousEvidenceBytes'] + binding['outerEvidenceReserveBytes']
    def observe_resources(phase):
        available = free(root); tmp = sizes(scratch); retained = retained_bytes()
        samples.append({'phase':phase,'seconds':round(time.monotonic()-started,3),'freeBytes':available,
                        'scratchLogical':tmp[0],'scratchAllocated':tmp[1],'retainedBytes':retained})
        if available <= gate['stopFreeBytes']: raise RuntimeError('Free-space stop')
        if max(tmp) > 64*MiB: raise RuntimeError('Scratch/profile observed cap')
        if retained > 8*MiB-128*1024: raise RuntimeError('Retained evidence reserve exhausted')
        return retained
    def checkpoint():
        if stopping or time.monotonic() >= work: raise TimeoutError('Stop/work deadline; cleanup reserve begins')
        observe_resources('work')
    def git(*args):
        remaining=work-time.monotonic(); assert remaining > 0
        return subprocess.check_output(['git',*args],cwd=root,text=True,timeout=min(2,remaining),
          env={**os.environ,'GIT_OPTIONAL_LOCKS':'0','GIT_CONFIG_GLOBAL':'/dev/null','GIT_CONFIG_SYSTEM':'/dev/null'}).strip()
    def persist_chrome():
        if chrome_facts is not None: save(output/'owned-chrome.json',chrome_facts)
    def register(pipe, name, sink):
        os.set_blocking(pipe.fileno(),False)
        streams[name]={'receivedBytes':0,'keptBytes':0,'droppedBytes':0,'eof':False,'closed':False}
        selector.register(pipe,selectors.EVENT_READ,(name,sink))
    def observe_exit():
        if chrome is None: return
        code = chrome.poll()
        if code is not None and chrome_facts['exit'] is None:
            chrome_facts['exit']={'code':code if code>=0 else None,'signal':signal.Signals(-code).name if code<0 else None,
              'observedAt':now(),'beforeCdpPort':chrome_facts['cdpPortDiscoveredAt'] is None}
            persist_chrome()
        if code is not None and chrome_facts['close'] is None and all(streams.get(n,{}).get('eof',False) for n in ('chrome.stdout','chrome.stderr')):
            chrome_facts['close']={**chrome_facts['exit'],'observedAt':now(),
              'meaning':'Parent observed direct-child exit plus both captured pipe EOFs; not a Node close event'}
            persist_chrome()
    def pump(timeout):
        for key,_ in selector.select(max(0,timeout)):
            name,sink=key.data; chunk=os.read(key.fileobj.fileno(),65536); record=streams[name]
            if not chunk:
                selector.unregister(key.fileobj); record['eof']=True; key.fileobj.close(); record['closed']=True; continue
            is_chrome=name.startswith('chrome.')
            used=sum(v['keptBytes'] for n,v in streams.items() if n.startswith('chrome.')) if is_chrome else record['keptBytes']
            cap=65536 if is_chrome else MiB
            keep=min(len(chunk),max(0,cap-used)); sink.write(chunk[:keep]); sink.flush()
            record['receivedBytes']+=len(chunk); record['keptBytes']+=keep; record['droppedBytes']+=len(chunk)-keep
            if keep!=len(chunk) and name+' log cap' not in errors: errors.append(name+' log cap')
        if process is not None: process.poll()
        observe_exit()
    def signal_owned(p,sig):
        if p is chrome and p is not None and alive(p):
            chrome_facts['signals'].append({'signal':signal.Signals(sig).name,'at':now(),'target':'owned-chrome-pgid'})
        stop(p,sig)
    try:
        try:
            module=binding['measurementHelper']; assert sha(module['path'])==module['sha256']
            sys.dont_write_bytecode=True
            spec=importlib.util.spec_from_file_location('visual_owned_measure',module['path'])
            meter=importlib.util.module_from_spec(spec); sys.modules[spec.name]=meter; spec.loader.exec_module(meter)
            assert git('rev-parse','HEAD')==binding['head'] and git('branch','--show-current')==binding['branch']
            assert git('status','--porcelain')==''
            save(budget,{'complete':False,'spentMs':gate['previousRuntimeMs'],'run':gate['run'],'startedAt':report['startedAt']})
            own=dict(binding['readOnlyDependencies'])
            for p,h in binding['sources'].items():
                assert p not in own or own[p]==h, 'Conflicting duplicate input pin: '+p
                own[p]=h
            for p,h in own.items():
                checkpoint(); assert sha(root/p)==h,p
            for p,h in binding['preparedFiles'].items():
                checkpoint(); assert sha(BASE/p)==h,p
            assert str(Path(binding['node']['path']).resolve())==binding['node']['realpath']
            assert sha(binding['node']['realpath'])==binding['node']['sha256']
            for item in binding['externalPins']:
                checkpoint(); p=Path(item['path']); assert str(p.resolve())==item['realpath'] and sha(p)==item['sha256']
            assert free(root)>=gate['startFreeBytes']
            checkpoint(); assert not scratch.exists() and not scratch.is_symlink() and not output.exists()
            scratch.mkdir(mode=0o700); owned=scratch.lstat(); scratch_identity=(owned.st_dev,owned.st_ino,owned.st_uid)
            output.mkdir(parents=True,mode=0o700)
            chrome_dirs={name:scratch/name for name in ('profile','temp','cache','crash')}
            for directory in chrome_dirs.values(): directory.mkdir(mode=0o700)
            # A separate native process/session. No sandbox disabling flags; no user configuration discovery.
            chrome_args=['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking',
              '--disable-component-update','--disable-sync','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',
              '--user-data-dir='+str(chrome_dirs['profile']),'--disk-cache-dir='+str(chrome_dirs['cache']),'about:blank']
            chrome_env={k:os.environ[k] for k in ('PATH','HOME','USER','LOGNAME','LANG','LC_ALL','LC_CTYPE','TZ','__CF_USER_TEXT_ENCODING') if k in os.environ}
            temp={k:str(chrome_dirs['temp']) for k in ('TMPDIR','TMP','TEMP','MAC_CHROMIUM_TMPDIR')}
            temp.update(XDG_CACHE_HOME=str(chrome_dirs['cache']),BREAKPAD_DUMP_LOCATION=str(chrome_dirs['crash']))
            chrome_env.update(temp)
            chrome_facts={'parentPid':os.getpid(),'chromePid':None,'pgid':None,'processGroup':'separate-parent-owned-session',
              'authorityBoundary':BOUNDARY,'argv':[binding['chrome'],*chrome_args],'temp':temp,
              'spawnAttemptedAt':now(),'spawnReturnedAt':None,'cdpPortDiscoveredAt':None,'exit':None,'close':None,
              'launchError':None,'signals':[],'streams':streams}
            persist_chrome(); checkpoint()
            chrome_log=(output/'chrome.log').open('xb'); handles.append(chrome_log)
            try:
                chrome=subprocess.Popen([binding['chrome'],*chrome_args],cwd=scratch,env=chrome_env,stdin=subprocess.DEVNULL,
                  stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
            except BaseException as e:
                chrome_facts['launchError']={'type':type(e).__name__,'message':str(e)[:1024]}; persist_chrome(); raise
            chrome_facts.update(chromePid=chrome.pid,pgid=chrome.pid,spawnReturnedAt=now())
            report['chromePgid']=chrome.pid
            register(chrome.stdout,'chrome.stdout',chrome_log); register(chrome.stderr,'chrome.stderr',chrome_log)
            persist_chrome()
            port_file=chrome_dirs['profile']/'DevToolsActivePort'; port=None; launch_deadline=min(work,time.monotonic()+8)
            while port is None:
                checkpoint(); pump(.025)
                if errors: raise RuntimeError('Chrome stream evidence cap')
                if chrome.poll() is not None: raise RuntimeError('Owned native Chrome exited before CDP port discovery')
                if time.monotonic()>=launch_deadline: raise TimeoutError('Owned Chrome CDP port discovery timeout')
                if port_file.exists():
                    assert not port_file.is_symlink() and port_file.is_file() and port_file.stat().st_size<=512
                    lines=port_file.read_text().splitlines()
                    assert len(lines)==2 and re.fullmatch('[0-9]{1,5}',lines[0]) and re.fullmatch('/devtools/browser/[A-Za-z0-9-]+',lines[1])
                    port=int(lines[0]); assert 0<port<=65535
            endpoint='http://127.0.0.1:'+str(port)
            chrome_facts.update(cdpPortDiscoveredAt=now(),cdpEndpoint=endpoint); persist_chrome(); checkpoint()
            profile=BASE/'sandbox.sb'
            profile.write_text('(version 1)\n(allow default)\n(deny file-write*)\n(allow file-write* (subpath '+json.dumps(str(scratch))+') (subpath '+json.dumps(str(output))+') (literal "/dev/null"))\n(deny network*)\n(allow network-bind (local ip "localhost:*"))\n(allow network-inbound (local ip "localhost:*"))\n(allow network-outbound (remote ip "localhost:*"))\n')
            child_gate={**gate,'supervision':{'startedAtMs':wall_ms,'workDeadlineMs':wall_ms+gate['totalMs']-CLEANUP_MS,
              'hardDeadlineMs':wall_ms+gate['totalMs'],'scratch':str(scratch),'output':str(output),'parentPid':os.getpid(),
              'chromePid':chrome.pid,'chromePgid':chrome.pid,'chromeEndpoint':endpoint,'chromeOwnership':'external-parent-native-sibling'}}
            save(BASE/'child-gate.json',child_gate)
            env={k:v for k,v in os.environ.items() if not k.startswith(('FLOW_','PG','POSTGRES_','DPERF04_','MESSAGE_SETTINGS_','MSGQUICK_','PLUGIN_RUNTIME_')) and k not in ('DATABASE_URL','NODE_OPTIONS','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy')}
            for key in ('TMPDIR','TMP','TEMP','MAC_CHROMIUM_TMPDIR','XDG_CACHE_HOME','NODE_COMPILE_CACHE'): env[key]=str(scratch)
            env.update({'NODE_DISABLE_COMPILE_CACHE':'1','TSX_DISABLE_CACHE':'1','GIT_CONFIG_GLOBAL':'/dev/null','GIT_CONFIG_SYSTEM':'/dev/null',
              'GIT_OPTIONAL_LOCKS':'0','VISUAL_PICKER_BROWSER_GATE':str(BASE/'child-gate.json'),'TSX_TSCONFIG_PATH':str(BASE/'runtime-tsconfig.json')})
            checkpoint()
            worker_log=(BASE/'worker.log').open('xb'); handles.append(worker_log)
            process=subprocess.Popen(['/usr/bin/sandbox-exec','-f',str(profile),binding['node']['realpath'],'--import',binding['tsxLoader'],str(BASE/ENTRY)],
              cwd=root,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True)
            report['pgid']=process.pid; assert process.pid!=chrome.pid
            register(process.stdout,'worker',worker_log)
            while True:
                checkpoint(); pump(min(.25,max(0,work-time.monotonic())))
                if errors: raise RuntimeError('Process stream evidence cap')
                if chrome.poll() is not None: raise RuntimeError('Owned Chrome exited before parent cleanup')
                if process.poll() is not None and streams['worker']['eof']: break
        except BaseException as e: errors.append(type(e).__name__+': '+str(e))
        finally:
            # TERM both groups together, then KILL only surviving owned groups. No work-deadline guard in cleanup.
            for p in (process,chrome):
                try: signal_owned(p,signal.SIGTERM)
                except BaseException as e: cleanup.append('TERM owned group: '+str(e))
            until=min(hard-5,time.monotonic()+3)
            while any(alive(p) for p in (process,chrome)) and time.monotonic()<until:
                try: pump(.025)
                except BaseException as e: cleanup.append('Drain/reap: '+str(e)); break
            for p in (process,chrome):
                try:
                    if alive(p): signal_owned(p,signal.SIGKILL)
                    if p: p.wait(timeout=max(.01,min(1,hard-time.monotonic()-3)))
                except BaseException as e: cleanup.append('Owned process cleanup: '+str(e))
            until=min(hard-3,time.monotonic()+1)
            while (any(alive(p) for p in (process,chrome)) or selector.get_map()) and time.monotonic()<until:
                try: pump(.025)
                except BaseException as e: cleanup.append('Final stream drain: '+str(e)); break
            for name,p in (('worker',process),('chrome',chrome)):
                if alive(p): cleanup.append(name+' process group remains; scratch retained')
            if chrome is not None and chrome_facts['close'] is None: cleanup.append('Chrome exit and pipe-close observation incomplete')
            if selector.get_map(): cleanup.append('Captured process streams not fully closed')
            for key in list(selector.get_map().values()):
                try: selector.unregister(key.fileobj); key.fileobj.close()
                except BaseException as e: cleanup.append('Pipe close: '+str(e))
            selector.close()
            for p in (process,chrome):
                if p:
                    for pipe in (p.stdout,p.stderr):
                        if pipe and not pipe.closed:
                            try: pipe.close()
                            except BaseException as e: cleanup.append('Remaining pipe close: '+str(e))
            for handle in handles:
                try: handle.close()
                except BaseException as e: cleanup.append('Log close: '+str(e))
            try: persist_chrome()
            except BaseException as e: errors.append('Chrome evidence write: '+str(e))
            groups_absent=not any(alive(p) for p in (process,chrome))
            if groups_absent:
                try: observe_resources('after-both-groups-reaped-before-scratch-removal')
                except BaseException as e: errors.append('Final resource observation: '+str(e))
            try:
                if scratch.exists() or scratch.is_symlink():
                    current=scratch.lstat()
                    same=scratch_identity is not None and stat.S_ISDIR(current.st_mode) and not stat.S_ISLNK(current.st_mode) and (current.st_dev,current.st_ino,current.st_uid)==scratch_identity
                    if groups_absent and same and not meter_record['unknown']: shutil.rmtree(scratch)
                    else: cleanup.append('Scratch KEEP: not created by this run, replaced, active group or unknown measurement')
                if scratch.exists() or scratch.is_symlink(): cleanup.append('Scratch remains')
            except BaseException as e: cleanup.append('Scratch cleanup: '+str(e))
            if time.monotonic()>hard: cleanup.append('Total deadline exceeded')
            try:
                result=load(output/'browser-results.json')
                assert result['sourceHead']==binding['head'] and result['sourceHashes']==binding['sources']
                assert result['outcome']=='passed' and not result.get('failure') and result['cleanupErrors']==[]
                assert result['fixtureClosed'] is True and result['contextClosed'] is True
                assert result['chromeCleanupOwner']=='external-parent-native-sibling' and chrome is not None and result['chromePid']==chrome.pid
                assert result['pg']==0 and result['checks']==binding['expectedChecks'] and len(result['checks'])==8 and result['pageErrors']==[]
            except BaseException as e: errors.append('Browser report: '+str(e))
            def persist_results():
                elapsed=round((time.monotonic()-started)*1000); cumulative=gate['previousRuntimeMs']+elapsed
                if cumulative>TOTAL_MS and 'Cumulative allowance exceeded' not in errors: errors.append('Cumulative allowance exceeded')
                retained=None
                try:
                    retained=retained_bytes()
                    if retained>8*MiB-128*1024: raise RuntimeError('Retained evidence reserve exceeded')
                except BaseException as e: errors.append('Final evidence accounting: '+str(e))
                report.update(elapsedMs=elapsed,cumulativeMs=cumulative,remainingMs=max(0,TOTAL_MS-cumulative),
                  exitCode=process.returncode if process else None,chromeExit=chrome_facts['exit'] if chrome_facts else None,
                  logStreams=streams,retainedBytes=retained,cleanup={'errors':cleanup,'groupAbsent':groups_absent,
                    'workerGroupAbsent':not alive(process),'chromeGroupAbsent':not alive(chrome),'scratchAbsent':not scratch.exists() and not scratch.is_symlink()},
                  state='PASS' if not stopping and not errors and not cleanup and process and process.returncode==0 else 'FAILED')
                save(BASE/'result.json',report)
                save(budget,{'complete':not cleanup,'spentMs':cumulative,'limitMs':TOTAL_MS,'cleanupReserveMs':CLEANUP_MS,
                  'run':gate['run'],'supervisorResult':str(BASE/'result.json'), 'state':report['state'],
                  'terminalContract':TERMINAL_CONTRACT, 'stopSignal':report.get('stopSignal')})
            persist_results()
            try: observe_resources('after-result-and-budget-write')
            except BaseException as e: errors.append('Post-write resource observation: '+str(e))
            persist_results()
            evidence_files = []
            try:
                for name in ('browser-results.json', 'owned-chrome.json', 'chrome.log', 'native-filter-inputs.json', 'select-diagnostics.json', *binding['expectedScreenshots']):
                    path=output/name
                    assert path.is_file() and not path.is_symlink() and path.stat().st_size<=8*MiB, name
                    evidence_files.append({'path':str(path), 'bytes':path.stat().st_size, 'sha256':sha(path)})
                save(BASE/'runtime-evidence-manifest.json',{'files':evidence_files,'expectedChecks':binding['expectedChecks'],
                  'sourceHashes':binding['sources'],'sourceHead':binding['head']})
            except BaseException as e: errors.append('Expected runtime evidence: '+str(e))
            try: observe_resources('after-runtime-evidence-manifest-and-prior-result-writes')
            except BaseException as e: errors.append('Final seal resource observation: '+str(e))
            report['afterResultBudgetWritesElapsedMs']=round((time.monotonic()-started)*1000)
            report['finalTimingMeaning']='Observed after prior result/budget writes; bounded final seal serialization follows.'
            try:
                if retained_bytes()>8*MiB-128*1024: raise RuntimeError('Final retained evidence reserve exceeded')
                if time.monotonic()>hard: raise TimeoutError('Total deadline includes final evidence writes')
            except BaseException as e: errors.append('Final evidence completion: '+str(e))
            persist_results()
            if stopping: persist_results()
    finally:
        for sig,handler in previous_handlers.items(): signal.signal(sig,handler)
    # Cooperative handling ends at restoration. Disk PASS remains a candidate until actual outer exit0 + matching stdout.
    if stopping: persist_results()
    declared_exit=0 if not stopping and not errors and not cleanup and report['state']=='PASS' else 1
    sealed={}
    for name in ('binding.json','result.json','browser-budget.json','runtime-evidence-manifest.json'):
        path=BASE/name
        sealed[name]=sha(path) if path.is_file() else None
    print(json.dumps({'type':'terminal-seal','terminalContract':TERMINAL_CONTRACT,
      'state':'PASS' if declared_exit==0 else 'FAILED','declaredExitCode':declared_exit,'sealedFiles':sealed,
      'cleanup':report.get('cleanup'),'stopping':stopping,'stopSignal':report.get('stopSignal'),
      'afterFinalWritesElapsedMs':round((time.monotonic()-started)*1000)}),flush=True)
    return declared_exit

if __name__=='__main__':
    try: declared_exit=main()
    except BaseException as error:
        print(json.dumps({'state':'FAILED_TERMINAL_REPORT','declaredExitCode':1,
          'reason':type(error).__name__+': '+str(error)}),flush=True)
        declared_exit=1
    sys.exit(declared_exit)

"""PREPARED / NOT_RUN. Native Chrome sibling changes authority; explicit Lead acceptance and a fresh gate are mandatory.
Reuses reviewed b1 lifecycle methods with immutable previous-run evidence and remaining-budget binding and c1 external-exit terminal contract. Never execute for syntax checking.
"""
import datetime, errno, hashlib, json, os, re, selectors, shutil, signal, stat, subprocess, sys, time
from pathlib import Path
BASE = Path(__file__).resolve().parent
MiB = 1024 ** 2
TOTAL_MS = 150000
SEGMENT_MS = 90000
SINGLE_RUN_MS = 45000
CLEANUP_MS = 15000
ENTRY = 'worker.mjs'
BOUNDARY = 'native-chrome-sibling-without-custom-outer-write-or-egress-sandbox'
TERMINAL_CONTRACT = 'msgquick-browser-v1-external-exit-required'

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

def sizes(root, *, exclude_directory=None):
    root = Path(root)
    if exclude_directory is not None:
        exclude_directory = Path(exclude_directory)
        assert exclude_directory == root/'scratch', 'Only the exact owned scratch child may be excluded'
    logical = allocated = 0
    for parent, directories, files in os.walk(root, followlinks=False, onerror=scan_error):
        directories[:] = [n for n in directories if not (Path(parent)/n).is_symlink() and Path(parent)/n != exclude_directory]
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
    preparation_started=time.monotonic(); preparation_wall_ms=int(time.time()*1000)
    assert len(sys.argv) == 3 and sys.argv[1] == '--gate'
    binding = load(BASE/'binding.json')
    assert binding['state'] == 'REVIEWED_SOURCE_BOUND', 'Independent source review and fresh admission are required'
    gate = load(sys.argv[2])
    assert gate['allowRun'] is True and gate['singleUse'] is True and gate['mode'] == 'message-settings-quick-browser'
    assert gate['taskId'] == binding['task'] == 'WPF-MESSAGESETTINGS02'
    assert gate['bindingSha256'] == sha(BASE/'binding.json') and gate['runnerSha256'] == sha(__file__)
    assert gate['claim'] == binding['claim'] and gate['overlaps'] == []
    assert datetime.datetime.fromisoformat(gate['expiresAt'].replace('Z','+00:00')) > datetime.datetime.now(datetime.timezone.utc)
    assert gate['entry'] == 'message-settings-quick' and re.fullmatch('[a-zA-Z0-9-]{1,80}', gate['run'])
    assert gate['sourceHead'] == binding['head'] and gate['sourceHashes'] == binding['sources']
    assert gate['previousRuntimeMs'] == binding['previousRuntimeMs']
    assert gate['previousRuntimeMs'] == binding['previousRuntimeMs'] == 30625
    assert gate['selection'] == binding['selection'] and gate['selection'] in ('diagnostic','full')
    assert CLEANUP_MS < gate['totalMs'] <= SINGLE_RUN_MS
    segment = load(binding['segmentUsage']['path'])
    assert sha(binding['segmentUsage']['path']) == binding['segmentUsage']['sha256'] == gate['segmentUsageSha256']
    assert segment['id'] == 'MSGQUICK-NATIVE-CONTROL-CLOSEOUT-20261007'
    assert segment['historyConservativeMs'] == 30625 and segment['newSegmentLimitMs'] == SEGMENT_MS
    assert segment['actualConservativeSpentMs'] == gate['previousSegmentRuntimeMs'] == 0 and segment['runs'] == []
    assert gate['previousSegmentRuntimeMs']+gate['totalMs'] <= SEGMENT_MS
    assert gate['previousRuntimeMs']+gate['totalMs'] <= TOTAL_MS
    authorization=binding['segmentAuthorization']
    assert sha(authorization['path']) == authorization['sha256']
    assert load(authorization['path'])['newSegment']['totalActualRuntimeMs'] == SEGMENT_MS
    assert binding['segmentMetadataBytes']==Path(authorization['path']).stat().st_size+Path(binding['segmentUsage']['path']).stat().st_size
    assert binding['outerEvidenceReserveBytes'] == 2*MiB+16*1024
    # All three immutable failures carry their actual outer/terminal observations and exact cleanup receipts.
    prior = load(BASE/'prior-evidence.json')
    assert sha(BASE/'prior-evidence.json') == binding['preparedFiles']['prior-evidence.json']
    assert prior['roots'] == ['/private/tmp/msgquick-b1', '/private/tmp/msgquick-b1-outer-di68rhfu',
        '/private/tmp/msgquick-b2', '/private/tmp/msgquick-b2-outer-017_g6hn', '/private/tmp/msgquick-b2-admission-rijzrvzi',
        '/private/tmp/msgquick-b3', '/private/tmp/msgquick-b3-outer-na_54sb4', '/private/tmp/msgquick-b3-admission-okeh9ium']
    assert prior['accountedRuntimeMs'] == 30625 and prior['remainingMs'] == 29375  # Closed historical envelope; not new credit.
    assert len(prior['files']) == prior['fileCount'] and len({item['path'] for item in prior['files']}) == prior['fileCount']
    assert prior['bytes'] == sum(item['bytes'] for item in prior['files']) == binding['previousEvidenceBytes']
    for item in prior['files']:
        path=Path(item['path'])
        assert path.resolve()==path and path.is_file() and not path.is_symlink()
        assert any(path.is_relative_to(Path(root)) for root in prior['roots']) or str(path) in prior['extraFiles']
        assert path.stat().st_size==item['bytes'] and sha(path)==item['sha256']
    prior_paths={item['path'] for item in prior['files']}
    for root_path in prior['roots']:
        for folder,dirs,names in os.walk(root_path,followlinks=False,onerror=scan_error):
            assert all(not (Path(folder)/name).is_symlink() for name in dirs+names)
            assert all(str(Path(folder)/name) in prior_paths for name in names)
    for name, previous_ms, elapsed_ms, raw_spent, late_ms, charge, decision in (
        ('b1',0,12282,12282,12284,12326,'ACCEPTED_FAILED_ACTUAL_AND_CLEANUP_NOT_FEATURE_PASS'),
        ('b2',12326,6102,18428,6103,6142,'ACCEPTED_FAILED_ACTUAL_AND_OWNED_CLEANUP_NOT_FEATURE_PASS'),
        ('b3',18468,12095,30563,12096,12157,'ACCEPTED_FAILED_ACTUAL_AND_OWNED_CLEANUP_NOT_FEATURE_PASS')):
        entry=prior['runs'][name]; old_root=Path(entry['packet']); old_outer=Path(entry['outer'])
        assert str(old_root) in prior['roots'] and str(old_outer) in prior['roots']
        old_result=load(old_root/'result.json'); old_budget=load(old_root/'browser-budget.json'); old_exit=load(old_outer/'actual-exit.json')
        terminal_lines=(old_outer/'stdout.txt').read_text().splitlines(); assert len(terminal_lines)==1
        old_terminal=json.loads(terminal_lines[0])
        assert old_exit['actualExit']==old_terminal['declaredExitCode']==1 and old_terminal['state']==old_result['state']=='FAILED'
        assert old_exit['bothEOF'] is True and old_exit['groupAbsent'] is True and old_exit['droppedBytes']==0
        assert old_exit['stdoutSha256']==sha(old_outer/'stdout.txt') and old_exit['stderrSha256']==sha(old_outer/'stderr.txt')
        assert old_terminal['cleanup']==old_result['cleanup']=={'errors':[],'groupAbsent':True,'workerGroupAbsent':True,'chromeGroupAbsent':True,'scratchAbsent':True}
        expected_keys={'binding.json','result.json','browser-budget.json','runtime-evidence-manifest.json'}
        if name in ('b2','b3'): expected_keys.add(entry['traceRelativePath'])
        assert set(old_terminal['sealedFiles'])==expected_keys
        for filename,digest in old_terminal['sealedFiles'].items():
            assert filename in expected_keys and (old_root/filename).resolve().is_relative_to(old_root)
            assert sha(old_root/filename)==digest if digest is not None else not (old_root/filename).exists()
        assert old_terminal['sealedFiles']['runtime-evidence-manifest.json'] is None
        if name=='b2': assert old_terminal['sealedFiles']['raw/msgquick-b2-20261007-044744/select-diagnostics.json'] is None
        assert old_result['previousRuntimeMs']==previous_ms and old_result['elapsedMs']==elapsed_ms
        assert old_budget['spentMs']==raw_spent and old_terminal['afterFinalWritesElapsedMs']==late_ms
        assert charge-1 < max(old_exit['wallMs'],late_ms,elapsed_ms) <= charge
        review=entry['rootReview']; assert sha(review['path'])==review['sha256']
        old_review=load(review['path'])
        assert old_review['decision']==decision and old_review['source']==binding['implementation'] and old_review['terminal']==old_terminal
    assert sum(entry['accountedMs'] for entry in prior['runs'].values())==30625
    assert binding['terminalAcceptance']['contract'] == TERMINAL_CONTRACT
    assert gate['totalMs'] <= TOTAL_MS-gate['previousRuntimeMs']
    assert gate['startFreeBytes'] >= 1024**3+128*MiB and gate['stopFreeBytes'] >= 1024**3+64*MiB
    # Manager pins a real Lead decision separately from source approval. No approval is supplied by this preparation.
    approval = binding['nativeChromeBoundaryApproval']
    assert approval is not None and gate['nativeChromeBoundaryApproval'] == approval
    assert sha(approval['path']) == approval['sha256']
    accepted = load(approval['path'])
    assert accepted['decision'] == 'ACCEPTED' and accepted['boundary'] == BOUNDARY
    assert accepted['runnerSha256'] == sha(__file__) and accepted['workerSha256'] == binding['preparedFiles'][ENTRY]
    root = Path(binding['worktree']); assert root.resolve() == root
    # A trusted external admission must pin the independent review of actual c1 outer-exit/seal evidence.
    prior = binding['typesDirectEvidence']
    assert prior is not None and gate['typesDirectEvidence'] == prior
    assert prior['verdict'] == 'APPROVED_TYPES_DIRECT_ACTUAL_EVIDENCE'
    assert prior['sourceTarget'] == binding['implementation']
    browser_path='apps/web/test/message-settings.browser.ts'
    assert all(prior['sourceHashes'][path]==digest for path,digest in binding['sources'].items() if path != browser_path)
    # The old actual strict/direct result does not cover the new diagnostic entry.
    scenario_text=(root/browser_path).read_text()
    acceptance=scenario_text[scenario_text.index('/** No launcher/budget reset here.'):scenario_text.index('/** Measurement only.')].rstrip()+'\n'
    assert hashlib.sha256(acceptance.encode()).hexdigest()==binding['originalAcceptanceFunctionSha256']
    assert sha(prior['path']) == prior['sha256']  # Independent actual evidence review, not author-created passed:true.
    budget = BASE/'browser-budget.json'
    for name in ('browser-budget.json', 'result.json', 'consumed-gate.json', 'scratch', 'raw', 'worker.log'):
        assert not (BASE/name).exists(), 'This packet is one use and cannot reset or retry'
    with (BASE/'consumed-gate.json').open('x') as f: json.dump(gate, f)
    started = preparation_started; wall_ms = preparation_wall_ms
    hard = started+gate['totalMs']/1000; work = hard-CLEANUP_MS/1000
    scratch = BASE/'scratch'; output = BASE/'raw'/gate['run']
    assert len(str(scratch).encode('utf8')) <= 40
    process = chrome = None; errors = []; cleanup = []; samples = []; streams = {}; stopping = False
    selector = selectors.DefaultSelector(); handles = []; chrome_facts = None
    report = {'state':'FAILED', 'sourceHead':binding['head'], 'implementation':binding['implementation'],
              'entry':gate['entry'], 'selection':gate['selection'], 'startedAt':now(), 'previousRuntimeMs':gate['previousRuntimeMs'],
              'segmentId':segment['id'],'previousSegmentRuntimeMs':gate['previousSegmentRuntimeMs'],
              'authorityBoundary':BOUNDARY, 'boundaryApproval':approval, 'samples':samples, 'errors':errors,
              'terminalContract':TERMINAL_CONTRACT, 'typesDirectEvidence':prior,
              'priorEvidenceManifestSha256':binding['preparedFiles']['prior-evidence.json'],
              'previousEvidenceBytes':binding['previousEvidenceBytes'],'outerEvidenceReserveBytes':binding['outerEvidenceReserveBytes'],
              'completionBoundary':'Final dual-group cleanup/resource/result seal before restoring cooperative handlers; external actual exit receipt is still mandatory'}
    def request_stop(sig, frame):
        nonlocal stopping
        stopping = True
        if 'stopSignal' not in report:
            report['stopSignal'] = signal.Signals(sig).name
            errors.append('Cooperative stop: '+report['stopSignal'])
        report['state'] = 'FAILED'
    previous_handlers = {sig:signal.signal(sig,request_stop) for sig in (signal.SIGTERM,signal.SIGINT)}
    def observe_resources(phase):
        available = free(root); tmp = sizes(scratch); retained = sizes(BASE, exclude_directory=scratch)[0]+binding['previousEvidenceBytes']+binding['outerEvidenceReserveBytes']+binding['segmentMetadataBytes']
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
            checkpoint(); assert not scratch.exists() and not output.exists()
            scratch.mkdir(mode=0o700); output.mkdir(parents=True,mode=0o700)
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
            env={k:v for k,v in os.environ.items() if not k.startswith(('FLOW_','PG','POSTGRES_','DPERF04_','MESSAGE_SETTINGS_','MSGQUICK_')) and k not in ('DATABASE_URL','NODE_OPTIONS','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy')}
            for key in ('TMPDIR','TMP','TEMP','MAC_CHROMIUM_TMPDIR','XDG_CACHE_HOME','NODE_COMPILE_CACHE'): env[key]=str(scratch)
            env.update({'NODE_DISABLE_COMPILE_CACHE':'1','TSX_DISABLE_CACHE':'1','GIT_CONFIG_GLOBAL':'/dev/null','GIT_CONFIG_SYSTEM':'/dev/null',
              'GIT_OPTIONAL_LOCKS':'0','MSGQUICK_BROWSER_GATE':str(BASE/'child-gate.json'),'TSX_TSCONFIG_PATH':str(BASE/'runtime-tsconfig.json')})
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
                if groups_absent and scratch.exists(): shutil.rmtree(scratch)
                if scratch.exists(): cleanup.append('Scratch remains')
            except BaseException as e: cleanup.append('Scratch cleanup: '+str(e))
            if time.monotonic()>hard: cleanup.append('Total deadline exceeded')
            try:
                result=load(output/'browser-results.json')
                assert result['sourceHead']==binding['head'] and result['sourceHashes']==binding['sources']
                assert not result.get('failure') and result['cleanupErrors']==[]
                assert result['selection']==gate['selection']
                if gate['selection']=='diagnostic':
                    measurement=load(output/'native-control.json')
                    report['diagnosticComplete']=measurement.get('diagnosticComplete',False)
                    report['diagnosticConclusion']=measurement.get('conclusion','INCONCLUSIVE')
                    assert measurement['mode']=='native-control' and measurement['diagnosticComplete'] is True and not measurement.get('failure')
                    assert [item['name'] for item in measurement['arms']]==['plain-A-ArrowDown-Enter','plain-B-Space-ArrowDown-Enter','actual-B-Space-ArrowDown-Enter']
                    assert measurement['arms'][1]['selectedWithNativeEvents'] is True and measurement['pageErrors']==[]
                    assert result['outcome']=='diagnostic-complete' and result['diagnosticComplete'] is True and result['checks']==[]
                    report['diagnosticComplete']=True; report['diagnosticConclusion']=measurement['conclusion']
                else: assert result['outcome']=='passed'
                assert result['fixtureClosed'] is True and result['contextClosed'] is True
                assert result['chromeCleanupOwner']=='external-parent-native-sibling' and chrome is not None and result['chromePid']==chrome.pid
                assert result['pg']==0 and result['pageErrors']==[]
                if gate['selection']=='full': assert result['checks']==binding['expectedChecks'] and len(result['checks'])==6
            except BaseException as e: errors.append('Browser report: '+str(e))
            try:
                diagnostic=load(output/'select-diagnostics.json')
                assert (output/'select-diagnostics.json').stat().st_size<=65536
                assert diagnostic['version']==1 and diagnostic['state']=='INSTALLED'
                assert 0<len(diagnostic['events'])<=96 and diagnostic['eventBytes']<=49152
                assert diagnostic['observerErrors']==[]
                declared=load(output/'browser-results.json')['selectDiagnostics']
                assert declared['sha256']==sha(output/'select-diagnostics.json') and declared['bytes']==(output/'select-diagnostics.json').stat().st_size
                report['selectDiagnostics']={'sha256':declared['sha256'],'bytes':declared['bytes'],'events':len(diagnostic['events']),
                    'truncated':diagnostic['truncated'],'droppedEvents':diagnostic['droppedEvents']}
            except BaseException as e: errors.append('Select diagnostic evidence: '+str(e))
            def persist_results():
                elapsed=round((time.monotonic()-started)*1000); cumulative=gate['previousRuntimeMs']+elapsed
                segment_cumulative=gate['previousSegmentRuntimeMs']+elapsed
                if segment_cumulative>SEGMENT_MS and 'Segment allowance exceeded' not in errors: errors.append('Segment allowance exceeded')
                if cumulative>TOTAL_MS and 'Cumulative allowance exceeded' not in errors: errors.append('Cumulative allowance exceeded')
                retained=None
                try:
                    retained=sizes(BASE, exclude_directory=scratch)[0]+binding['previousEvidenceBytes']+binding['outerEvidenceReserveBytes']+binding['segmentMetadataBytes']
                    if retained>8*MiB-128*1024: raise RuntimeError('Retained evidence reserve exceeded')
                except BaseException as e: errors.append('Final evidence accounting: '+str(e))
                report.update(elapsedMs=elapsed,cumulativeMs=cumulative,remainingMs=max(0,SEGMENT_MS-segment_cumulative),
                  segmentCumulativeMs=segment_cumulative,historyClosedMs=30625,
                  exitCode=process.returncode if process else None,chromeExit=chrome_facts['exit'] if chrome_facts else None,
                  logStreams=streams,retainedBytes=retained,cleanup={'errors':cleanup,'groupAbsent':groups_absent,
                    'workerGroupAbsent':not alive(process),'chromeGroupAbsent':not alive(chrome),'scratchAbsent':not scratch.exists()},
                  state=('DIAGNOSTIC_COMPLETE' if gate['selection']=='diagnostic' else 'PASS') if not stopping and not errors and not cleanup and process and process.returncode==0 else 'FAILED')
                save(BASE/'result.json',report)
                save(budget,{'complete':not cleanup,'spentMs':cumulative,'limitMs':TOTAL_MS,'cleanupReserveMs':CLEANUP_MS,
                  'segmentId':segment['id'],'segmentSpentMs':segment_cumulative,'segmentLimitMs':SEGMENT_MS,'singleRunLimitMs':SINGLE_RUN_MS,
                  'run':gate['run'],'supervisorResult':str(BASE/'result.json'), 'state':report['state'],
                  'terminalContract':TERMINAL_CONTRACT, 'stopSignal':report.get('stopSignal')})
            persist_results()
            try: observe_resources('after-result-and-budget-write')
            except BaseException as e: errors.append('Post-write resource observation: '+str(e))
            persist_results()
            evidence_files = []
            try:
                for name in ('browser-results.json', 'owned-chrome.json', 'chrome.log', 'select-diagnostics.json', *(['native-control.json'] if gate['selection']=='diagnostic' else binding['expectedScreenshots'])):
                    path=output/name
                    assert path.is_file() and not path.is_symlink() and path.stat().st_size<=8*MiB, name
                    evidence_files.append({'path':str(path), 'bytes':path.stat().st_size, 'sha256':sha(path)})
                save(BASE/'runtime-evidence-manifest.json',{'files':evidence_files,'selection':gate['selection'],'expectedChecks':[] if gate['selection']=='diagnostic' else binding['expectedChecks'],
                  'sourceHashes':binding['sources'],'sourceHead':binding['head']})
            except BaseException as e: errors.append('Expected runtime evidence: '+str(e))
            try: observe_resources('after-runtime-evidence-manifest-and-prior-result-writes')
            except BaseException as e: errors.append('Final seal resource observation: '+str(e))
            report['afterResultBudgetWritesElapsedMs']=round((time.monotonic()-started)*1000)
            report['finalTimingMeaning']='Observed after prior result/budget writes; bounded final seal serialization follows.'
            try:
                if sizes(BASE, exclude_directory=scratch)[0]+binding['previousEvidenceBytes']+binding['outerEvidenceReserveBytes']+binding['segmentMetadataBytes']>8*MiB-128*1024: raise RuntimeError('Final retained evidence reserve exceeded')
                if time.monotonic()>hard: raise TimeoutError('Total deadline includes final evidence writes')
            except BaseException as e: errors.append('Final evidence completion: '+str(e))
            persist_results()
            if stopping: persist_results()
    finally:
        for sig,handler in previous_handlers.items(): signal.signal(sig,handler)
    # Cooperative handling ends at restoration. Disk PASS remains a candidate until actual outer exit0 + matching stdout.
    if stopping: persist_results()
    declared_exit=0 if not stopping and not errors and not cleanup and report['state'] in ('PASS','DIAGNOSTIC_COMPLETE') else 1
    sealed={}
    for name in ('binding.json','result.json','browser-budget.json','runtime-evidence-manifest.json'):
        path=BASE/name
        sealed[name]=sha(path) if path.is_file() else None
    if gate['selection']=='diagnostic':
        measurement_path=output/'native-control.json'
        sealed['raw/'+gate['run']+'/native-control.json']=sha(measurement_path) if measurement_path.is_file() else None
    diagnostic_path=output/'select-diagnostics.json'
    sealed['raw/'+gate['run']+'/select-diagnostics.json']=sha(diagnostic_path) if diagnostic_path.is_file() else None
    print(json.dumps({'type':'terminal-seal','terminalContract':TERMINAL_CONTRACT,
      'state':report['state'] if declared_exit==0 else 'FAILED','declaredExitCode':declared_exit,'sealedFiles':sealed,
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

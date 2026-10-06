"""One authorized prepare only; no install, source copy, or published pointer mutation."""
import datetime, hashlib, json, os, pathlib, selectors, shutil, signal, stat, subprocess, time
RUN = pathlib.Path(__file__).resolve().parent
CFG = json.loads((RUN / 'config.json').read_text())
SOURCE = pathlib.Path(CFG['sourceRepository'])
LIMIT = CFG['limits']
START = time.monotonic()
DEADLINE = START + LIMIT['totalSeconds']
WORK_END = START + LIMIT['workSeconds']
STATE = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'config': CFG, 'success': False, 'samples': [], 'abortReason': None, 'cleanup': [], 'limitations': ['Polling is not a disk quota; shared-volume changes and OS swap cannot be attributed or isolated.', 'No credentials, provider, DB, browser, install, clone, or publishing.']}
PROCESS = None
PGID = None
CACHE_BEFORE = {}
LOG_BYTES = 0
DRIVER_JSON_BYTES = 65_536
FINAL_REPORT_BYTES = 131_072
DRIVER_DIAGNOSTICS = {'artifact-result.json', 'driver-failure.json'}
SELECTOR = selectors.DefaultSelector()
ENV = {k: os.environ[k] for k in ['PATH','HOME','USER','LOGNAME','SHELL','LANG','LC_ALL','LC_CTYPE','TZ'] if k in os.environ}
ENV.update({'TMPDIR': str(RUN / 'scratch'), 'TMP': str(RUN / 'scratch'), 'TEMP': str(RUN / 'scratch'), 'GIT_OPTIONAL_LOCKS': '0'})
def encoded_json(value):
    return (json.dumps(value, indent=2) + '\n').encode()
def diagnostic_bytes(exclude=()):
    # Count all top-level JSON/log diagnostics, including prepared JSON records.
    return sum(p.stat().st_size for p in RUN.iterdir()
               if p.is_file() and p.suffix in {'.json', '.log', '.jsonl'} and p.name not in exclude)
def parent_diagnostic_room(replacing=None):
    excluded = DRIVER_DIAGNOSTICS | ({replacing} if replacing else set())
    # The driver can write concurrently: reserve its entire bounded allowance,
    # plus a final failure report, instead of racing a file-size observation.
    return LIMIT['logBytes'] - DRIVER_JSON_BYTES - FINAL_REPORT_BYTES - diagnostic_bytes(excluded)
def save(name, value):
    data = encoded_json(value)
    if len(data) > parent_diagnostic_room(name): raise RuntimeError('TOTAL_DIAGNOSTIC_BUDGET')
    (RUN / name).write_bytes(data)
def final_report():
    remaining = LIMIT['logBytes'] - diagnostic_bytes({'supervisor-result.json'})
    data = encoded_json(STATE)
    if len(data) > min(FINAL_REPORT_BYTES, remaining):
        STATE['success'] = False
        original_reason = STATE['abortReason']
        STATE['abortReason'] = 'FINAL_DIAGNOSTIC_BUDGET'
        # Report a failed/incomplete diagnostic rather than silently truncating
        # a successful run; original stream files remain untouched.
        data = encoded_json({'success': False, 'abortReason': STATE['abortReason'],
            'originalAbortReason': original_reason,
            'diagnosticsIncomplete': True, 'fullReportBytes': len(data),
            'startedAt': STATE['startedAt'], 'endedAt': STATE['endedAt'],
            'elapsedSeconds': STATE['elapsedSeconds'],
            'processGroupRemaining': STATE['processGroupRemaining'],
            'cleanupErrors': STATE.get('cleanupErrors', []),
            'sampleCount': len(STATE['samples'])})
    if len(data) > remaining:
        STATE['success'] = False
        STATE['abortReason'] = 'NO_DIAGNOSTIC_SPACE'
        return
    (RUN / 'supervisor-result.json').write_bytes(data)
def cleanup_error(phase, error):
    STATE['success'] = False
    entry = {'phase': phase, 'error': str(error)}
    STATE['cleanup'].append(entry)
    STATE.setdefault('cleanupErrors', []).append(entry)
def git(*args):
    return subprocess.check_output(['git','-C',str(SOURCE),*args],text=True,env=ENV,timeout=3).strip()
def safe_directory(path):
    info = path.lstat()
    if path.is_symlink() or not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or path.resolve() != path:
        raise RuntimeError('DIRECTORY_IDENTITY_CHANGED:' + str(path))
def inventory(path):
    if not path.exists(): return {}
    result = {}
    for parent, dirs, files in os.walk(path, followlinks=False):
        for name in dirs + files:
            p = pathlib.Path(parent) / name
            info = p.lstat()
            if p.is_symlink(): raise RuntimeError('SYMLINK_IN_MONITORED_OUTPUT:' + str(p))
            if stat.S_ISREG(info.st_mode): result[str(p)] = {'bytes':info.st_size,'allocated':info.st_blocks*512,'uid':info.st_uid}
    return result
CACHE_PATHS = [SOURCE / p for p in CFG['cachePaths']]
def monitor():
    for p in CACHE_PATHS: safe_directory(p)
    free = shutil.disk_usage(RUN).free
    outputs = inventory(RUN / 'artifacts')
    dist = {p:v for p,v in outputs.items() if '/dist/' in p}
    caches = {}
    for p in CACHE_PATHS: caches.update(inventory(p))
    growth = sum(max(0, v['bytes'] - CACHE_BEFORE.get(p, {}).get('bytes', 0)) for p,v in caches.items())
    sample = {'elapsedSeconds':round(time.monotonic()-START,3),'freeBytes':free,'distBytes':sum(v['bytes'] for v in dist.values()),'distAllocatedBytes':sum(v['allocated'] for v in dist.values()),'distFiles':len(dist),'maxDistFileBytes':max([v['bytes'] for v in dist.values()],default=0),'cachePositiveGrowthBytes':growth,'capturedStreamBytes':LOG_BYTES,'diagnosticBytesObserved':diagnostic_bytes()}
    STATE['samples'].append(sample)
    if free <= LIMIT['stopFreeBytes']: raise RuntimeError('FREE_SPACE_STOP_THRESHOLD')
    if sample['distBytes'] > LIMIT['distBytes'] or len(dist) > LIMIT['distFiles'] or sample['maxDistFileBytes'] > LIMIT['singleDistBytes']: raise RuntimeError('DIST_OUTPUT_BUDGET')
    if growth > LIMIT['cacheGrowthBytes']: raise RuntimeError('CACHE_GROWTH_BUDGET')
    if any(v['bytes'] > LIMIT['singleConfigTempBytes'] for p,v in caches.items() if '/.vite-temp/' in p): raise RuntimeError('CONFIG_TEMP_BUDGET')
    if diagnostic_bytes(DRIVER_DIAGNOSTICS) + DRIVER_JSON_BYTES + FINAL_REPORT_BYTES > LIMIT['logBytes']: raise RuntimeError('TOTAL_DIAGNOSTIC_BUDGET')
    return caches

def group_exists():
    if PGID is None: return False
    try: os.killpg(PGID, 0); return True
    except ProcessLookupError: return False

def stop_owned_group():
    if not group_exists(): return
    os.killpg(PGID, signal.SIGTERM)
    STATE['cleanup'].append({'action':'SIGTERM','pgid':PGID})
    until=min(time.monotonic()+3,DEADLINE-5)
    while group_exists() and time.monotonic()<until:
        if PROCESS: PROCESS.poll()
        time.sleep(.05)
    if group_exists():
        os.killpg(PGID, signal.SIGKILL)
        STATE['cleanup'].append({'action':'SIGKILL','pgid':PGID})
    until=min(time.monotonic()+8,DEADLINE-3)
    while group_exists() and time.monotonic()<until:
        if PROCESS: PROCESS.poll()
        time.sleep(.05)
    if group_exists(): raise RuntimeError('OWN_PROCESS_GROUP_STILL_PRESENT')

try:
    safe_directory(RUN)
    if stat.S_IMODE(RUN.stat().st_mode) != 0o700: raise RuntimeError('RUN_NOT_PRIVATE')
    gate=json.loads((RUN/'gate.json').read_text())
    if not gate.get('claimCommittedAndLiveVerified') or not gate.get('recoveryDependencyAndTypeWindowFinished') or not gate.get('rootApprovedOnce'): raise RuntimeError('EXECUTION_GATE_NOT_READY')
    STATE['gate']=gate
    for entry in CFG['tools']:
        if hashlib.sha256((RUN/entry['path']).read_bytes()).hexdigest()!=entry['sha256']: raise RuntimeError('FIXED_TOOL_BYTES_CHANGED')
    if git('rev-parse','HEAD')!=CFG['target'] or git('status','--porcelain'): raise RuntimeError('SOURCE_NOT_FIXED_CLEAN')
    STATE['sourceBefore']={'head':git('rev-parse','HEAD'),'tree':git('rev-parse','HEAD^{tree}'),'lockDigest':hashlib.sha256((SOURCE/'pnpm-lock.yaml').read_bytes()).hexdigest()}
    for p in CACHE_PATHS:
        safe_directory(p)
        if not os.access(p,os.W_OK|os.X_OK): raise RuntimeError('CACHE_ACCESS_NOT_READY')
        CACHE_BEFORE.update(inventory(p))
    save('cache-before.json',CACHE_BEFORE)
    free=shutil.disk_usage(RUN).free;STATE['freeBeforeBytes']=free
    if free<LIMIT['startFreeBytes']: raise RuntimeError('FREE_SPACE_START_THRESHOLD')
    # Only exact target paths are retained. No environment or command arguments are read.
    listed=subprocess.run(['/usr/sbin/lsof','-nP','-Fpcfn'],capture_output=True,text=True,timeout=5)
    matches=[];current={}
    for line in listed.stdout.splitlines():
        if line.startswith('p'): current={'pid':line[1:]}
        elif line.startswith('c'): current['executableName']=line[1:]
        elif line.startswith('n') and (line[1:]==str(SOURCE) or line[1:].startswith(str(SOURCE)+'/')): matches.append({**current,'path':line[1:]})
    STATE['consumerPreflight']={'exit':listed.returncode,'stderr':listed.stderr,'matches':matches}
    if listed.returncode or listed.stderr or matches: raise RuntimeError('SOURCE_CONSUMERS_NOT_CLEAR')
    if time.monotonic()>=WORK_END: raise RuntimeError('WORK_DEADLINE_BEFORE_SPAWN')
    command=['/usr/bin/sandbox-exec','-f',str(RUN/'prepare.sb'),CFG['node'],str(RUN/'driver.mjs')]
    PROCESS=subprocess.Popen(command,cwd=RUN,env=ENV,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    PGID=PROCESS.pid;STATE['process']={'pid':PROCESS.pid,'pgid':os.getpgid(PROCESS.pid),'command':command}
    if STATE['process']['pgid']!=PGID: raise RuntimeError('PROCESS_GROUP_IDENTITY_MISMATCH')
    for stream,name in [(PROCESS.stdout,'stdout.log'),(PROCESS.stderr,'stderr.log')]:
        os.set_blocking(stream.fileno(),False);SELECTOR.register(stream,selectors.EVENT_READ,name)
    next_sample=0
    while True:
        now=time.monotonic()
        if now>=WORK_END: raise RuntimeError('WORK_DEADLINE')
        if now>=next_sample: monitor();next_sample=now+LIMIT['pollSeconds']
        for key,_ in SELECTOR.select(timeout=.05):
            chunk=os.read(key.fileobj.fileno(),65536)
            if not chunk:SELECTOR.unregister(key.fileobj);continue
            room=max(0,parent_diagnostic_room())
            with (RUN/key.data).open('ab') as f:f.write(chunk[:max(0,room)])
            LOG_BYTES+=len(chunk)
            if len(chunk)>room:raise RuntimeError('TOTAL_DIAGNOSTIC_BUDGET')
        code=PROCESS.poll()
        if code is not None and not SELECTOR.get_map():break
    STATE['childExit']=PROCESS.returncode
    if group_exists():raise RuntimeError('DESCENDANTS_AFTER_DRIVER_EXIT')
    monitor()
    if PROCESS.returncode!=0:raise RuntimeError('PREPARE_EXIT_NONZERO')
    result=json.loads((RUN/'artifact-result.json').read_text())
    manifest=result['manifest']
    if result['artifact']['sourceHead']!=CFG['target'] or manifest['sourceHead']!=CFG['target'] or manifest['releaseId']!=CFG['releaseId'] or manifest['format']!=2:raise RuntimeError('ARTIFACT_DESCRIPTOR_MISMATCH')
    if manifest['sourceTree']!=STATE['sourceBefore']['tree'] or manifest['lockDigest']!=STATE['sourceBefore']['lockDigest']:raise RuntimeError('ARTIFACT_SOURCE_IDENTITY_MISMATCH')
    STATE['artifact']=result['artifact'];STATE['manifest']=manifest
    STATE['success']=True
except BaseException as error:
    STATE['abortReason']=type(error).__name__+': '+str(error)
finally:
    try:stop_owned_group()
    except BaseException as error:cleanup_error('stop-owned-group',error)
    STATE['processGroupRemaining']=group_exists()
    if PROCESS:
        try:STATE['childExit']=PROCESS.wait(timeout=max(.01,min(2,DEADLINE-time.monotonic())))
        except BaseException as error:cleanup_error('wait-owned-process',error)
    if not STATE['processGroupRemaining']:
        for stage in (RUN/'artifacts'/'web-artifacts').glob('.stage-*'):
            try:safe_directory(stage);shutil.rmtree(stage);STATE['cleanup'].append({'removedOwnPartialStage':str(stage)})
            except BaseException as error:cleanup_error('remove-own-stage:'+str(stage),error)
    try:
        after={}
        for p in CACHE_PATHS:after.update(inventory(p))
        save('cache-after.json',after)
        STATE['cacheNewOrChanged']={p:v for p,v in after.items() if CACHE_BEFORE.get(p)!=v}
        STATE['cacheCleanupPolicy']='No preexisting cache removed; unproven cache file ownership is retained and reported.'
        STATE['sourceAfter']={'head':git('rev-parse','HEAD'),'statusPorcelain':git('status','--porcelain')}
        if STATE['sourceAfter']['head']!=CFG['target'] or STATE['sourceAfter']['statusPorcelain']:cleanup_error('source-after','SOURCE_CHANGED')
    except BaseException as error:cleanup_error('cache-and-source-after',error)
    STATE['endedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();STATE['elapsedSeconds']=round(time.monotonic()-START,3)
    STATE['freeAfterBytes']=shutil.disk_usage(RUN).free
    STATE['minimumSampledFreeBytes']=min([STATE.get('freeBeforeBytes',STATE['freeAfterBytes'])]+[s['freeBytes'] for s in STATE['samples']])
    if STATE['processGroupRemaining']:cleanup_error('process-group-confirmation','OWN_PROCESS_GROUP_STILL_PRESENT')
    if STATE['elapsedSeconds']>LIMIT['totalSeconds']:cleanup_error('total-deadline','TOTAL_DEADLINE_EXCEEDED')
    final_report()
    print(json.dumps({'success':STATE['success'],'abortReason':STATE['abortReason'],'elapsedSeconds':STATE['elapsedSeconds'],'report':str(RUN/'supervisor-result.json'),'artifact':STATE.get('artifact'),'processGroupRemaining':STATE['processGroupRemaining']}))
raise SystemExit(0 if STATE['success'] else 1)

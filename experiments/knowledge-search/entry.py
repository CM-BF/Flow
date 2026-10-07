"""K01 bounded operator. It composes OPS14; it does not supervise or signal independently."""
from pathlib import Path
import argparse, dataclasses, datetime, hashlib, importlib.util, json, os, stat, sys, time, uuid
ROOT=Path(__file__).resolve().parent
WT=ROOT.parents[1]
NODE=Path('/opt/homebrew/opt/node@24/bin/node')
SUPERVISOR=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/owned-process-supervision/tools/owned-process-supervision/supervise.py')
SUPERVISOR_SHA='725bad9048e22d5f4c65f493918ab7afb57bb0a56e7594d31538ba028156092d'
MAX_NEW=16*1024*1024
MAX_TMP=8*1024*1024

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def sync_directory(path):
    fd=os.open(path,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:os.fsync(fd)
    finally:os.close(fd)
def write_new(path,value):
    data=(json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()
    if len(data)>262144:raise ValueError('record budget')
    with path.open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
    sync_directory(path.parent)
def logical_bytes(directory):
    total=0
    for root,dirs,files in os.walk(directory,followlinks=False):
        dirs[:]=[name for name in dirs if name not in ('node_modules','.local','.scratch') and not (Path(root)/name).is_symlink()]
        for name in files:
            path=Path(root)/name
            if not path.is_symlink():total+=path.stat().st_size
    return total
def verify_aliases(root,dependencies):
    for row in dependencies:
        alias=root/'node_modules'/row['name'];target=Path(row['target'])
        if alias.resolve(strict=True)!=target:raise ValueError('dependency alias mismatch '+row['name'])
    if (root/'source'/'node_modules').resolve(strict=True)!=(root/'node_modules'):raise ValueError('source dependency root mismatch')
    for name in ('contracts','client','plugin-runtime'):
        alias=root/'node_modules'/'@flow'/name;target=root/'source'/'packages'/name
        if alias.resolve(strict=True)!=target:raise ValueError('internal source alias mismatch '+name)

def is_absent(path):
    try:path.lstat()
    except FileNotFoundError:return True
    return False

def verify_inputs():
    manifest=json.loads((ROOT/'source-inputs.json').read_text())
    for row in manifest['items']:
        p=ROOT/'source'/row['path']
        if p.stat().st_size!=row['bytes'] or sha(p)!=row['sha256']:raise ValueError('fixed source mismatch '+row['path'])
    dependencies=json.loads((ROOT/'dependencies.json').read_text());verify_aliases(ROOT,dependencies)
    for row in dependencies:
        p=Path(row['target'])/'package.json'
        if p.stat().st_size!=row['packageJsonBytes'] or sha(p)!=row['packageJsonSha256']:raise ValueError('dependency metadata mismatch')
    if sha(SUPERVISOR)!=SUPERVISOR_SHA:raise ValueError('OPS14 changed')
    return manifest

def process_closed(report,saved_raw):
    first=report.first_failure
    return (report.exit_code is not None and report.owned_state=='absent'
      and report.capture=='merged' and report.eof=={'stdout':True}
      and report.observed_bytes==report.retained_bytes==len(saved_raw)
      and report.stdout==saved_raw and report.stderr==b'' and not report.secondary_failures
      and (first is None or first.get('code')=='CHILD_EXIT_NONZERO')
      and all(item.get('state') in ('sent','absent') for item in report.signals))
def check_passed(report,closed):
    return closed and report.exit_code==0 and report.first_failure is None

def environment(tmp,started,permit,admin_url=None):
    # No ambient HOME, NODE_OPTIONS, proxies, authentication or package manager settings.
    env={'PATH':'/usr/bin:/bin','LANG':'C','LC_ALL':'C','TZ':'UTC','TMPDIR':str(tmp),'TMP':str(tmp),'TEMP':str(tmp),
      'NODE_DISABLE_COMPILE_CACHE':'1','TSX_DISABLE_CACHE':'1','PYTHONDONTWRITEBYTECODE':'1',
      'TSX_TSCONFIG_PATH':str(ROOT/'types.tsconfig.json'),'FLOW_K01_QUERY_CACHE':str(tmp/'cache'),
      'FLOW_K01_QUERY_START_MS':str(int(started*1000)),'FLOW_K01_QUERY_NAMESPACE':str(tmp),
      'FLOW_K01_QUERY_WINDOW':permit.get('window',''),'FLOW_K01_QUERY_PG_OPEN':'NOT_OPEN',
      'GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null','GIT_TERMINAL_PROMPT':'0'}
    if admin_url is not None:
        env['FLOW_K01_QUERY_ADMIN_URL']=admin_url;env['FLOW_K01_QUERY_PG_OPEN']='reviewed'
    return env

def create_scratch(parent,name=None):
    parent.mkdir(exist_ok=True)
    if not parent.is_dir() or parent.is_symlink() or parent.resolve()!=parent:raise ValueError('scratch parent identity')
    name=name or 'k01-'+uuid.uuid4().hex
    if not name.startswith('k01-') or len(name)!=36 or any(c not in '0123456789abcdef' for c in name[4:]):raise ValueError('scratch name')
    path=parent/name;path.mkdir(mode=0o700)
    info=path.lstat();identity={'dev':info.st_dev,'ino':info.st_ino,'marker':uuid.uuid4().hex,'path':str(path)}
    write_new(path/'.owner.json',identity);sync_directory(parent)
    return path,identity

def read_marker(path):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    with os.fdopen(fd,'rb') as handle:
        info=os.fstat(handle.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size>8192:raise ValueError('marker file')
        data=handle.read(8193)
        if len(data)!=info.st_size or len(data)>8192:raise ValueError('marker changed')
    return json.loads(data)

def cleanup_scratch(path,identity,closed,deadline=None):
    result={'path':str(path),'identity':identity,'processClosed':closed,'absent':False,'state':'KEEP'}
    if not closed:return result
    def check_deadline():
        if deadline is not None and time.monotonic()>=deadline:raise ValueError('cleanup deadline')
    try:
        check_deadline();info=path.lstat()
        if not stat.S_ISDIR(info.st_mode) or path.resolve()!=path or str(path)!=identity['path'] or (info.st_dev,info.st_ino)!=(identity['dev'],identity['ino']):raise ValueError('identity')
        if read_marker(path/'.owner.json')!=identity:raise ValueError('marker')
        entries=[];total=0
        for root,dirs,files in os.walk(path,followlinks=False):
            for name in dirs+files:
                check_deadline();item=Path(root)/name;s=item.lstat()
                if not (stat.S_ISREG(s.st_mode) or stat.S_ISDIR(s.st_mode)):raise ValueError('unexpected entry')
                total+=s.st_size if stat.S_ISREG(s.st_mode) else 0;entries.append((item,s.st_dev,s.st_ino,stat.S_ISDIR(s.st_mode)))
                if total>MAX_TMP or len(entries)>10000:raise ValueError('cleanup budget')
        for item,dev,ino,directory in sorted(entries,key=lambda row:len(row[0].parts),reverse=True):
            check_deadline();current=item.lstat()
            if (current.st_dev,current.st_ino)!=(dev,ino):raise ValueError('entry changed')
            item.rmdir() if directory else item.unlink()
        current=path.lstat()
        if (current.st_dev,current.st_ino)!=(identity['dev'],identity['ino']):raise ValueError('root changed')
        path.rmdir();sync_directory(path.parent);result.update(absent=is_absent(path),logicalBytes=total)
        if result['absent']:result['state']='REMOVED'
    except (OSError,ValueError,KeyError,json.JSONDecodeError) as error:result['errorType']=type(error).__name__
    return result

def append_record(path,event):
    data=(json.dumps(event,ensure_ascii=False,separators=(',',':'))+'\n').encode()
    if path.stat().st_size+len(data)>131072:raise ValueError('record budget')
    with path.open('ab') as f:f.write(data);f.flush();os.fsync(f.fileno())
    sync_directory(path.parent)
def open_record(permit):
    folder=Path(permit['recordDirectory'])
    if not folder.is_absolute() or folder.parent!=(WT/'docs/evidence/k01') or not folder.name.startswith('query-entry-'):raise ValueError('record path')
    if not folder.exists():
        folder.mkdir(mode=0o700);sync_directory(folder.parent)
        (folder/'iterations.jsonl').touch(exist_ok=False)
        append_record(folder/'iterations.jsonl',{'event':'segment','permitSha256':permit['_sha'],'startedAt':permit['segmentStartedAt'],'expiresAt':permit['expiresAt']})
    if folder.is_symlink() or folder.resolve()!=folder:raise ValueError('record directory identity')
    ledger=folder/'iterations.jsonl';events=[json.loads(line) for line in ledger.read_text().splitlines()]
    if not events or events[0]['permitSha256']!=permit['_sha']:raise ValueError('unknown prior namespace')
    started=[e for e in events if e['event']=='started'];finished=[e for e in events if e['event']=='finished']
    if len(started)!=len(finished) or any(not e['resourceConfirmed'] or not e['scratch']['absent'] or not e['withinTimeBudget'] for e in finished):raise ValueError('prior result unknown; HOLD')
    return folder,ledger,finished

def main():
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['caller','pure','types','pg']);parser.add_argument('--permit',required=True,type=Path)
    args=parser.parse_args();started=time.time();started_mono=time.monotonic();permit=json.loads(args.permit.read_text());permit['_sha']=sha(args.permit)
    now=datetime.datetime.now(datetime.timezone.utc);deadline=datetime.datetime.fromisoformat(permit['expiresAt'].replace('Z','+00:00'))
    if args.mode not in permit.get('modes',[]) or permit.get('state')!='OPEN' or now>=deadline or not permit.get('authority'):raise ValueError('not OPEN')
    maximum=120 if args.mode=='pg' else 30
    if (deadline-now).total_seconds()<maximum:raise ValueError('insufficient absolute permit time')
    manifest=verify_inputs();folder,ledger,finished=open_record(permit)
    if args.mode!='pg' and (len(finished)>=5 or sum(r['operatorElapsedMs'] for r in finished)+30000>90000):raise ValueError('local iteration budget')
    if logical_bytes(ROOT)+logical_bytes(folder)>MAX_NEW:raise ValueError('new logical budget')
    free=os.statvfs(ROOT);free_bytes=free.f_bavail*free.f_frsize
    if not isinstance(permit.get('requiredFreeBytes'),int) or free_bytes<permit['requiredFreeBytes']:raise ValueError('manager floor')
    if args.mode=='pg':
        if not permit.get('reviewed') or permit.get('fixedProduct')!=manifest['base'] or any(e['mode']=='pg' for e in finished):raise ValueError('PG source/window not reviewed')
        expected=permit.get('experimentFiles',[]);required={p.name for p in ROOT.iterdir() if p.is_file() and p.name!='preparation.json'}
        if {r.get('path') for r in expected}!=required:raise ValueError('PG experiment bindings')
        for row in expected:
            p=ROOT/row['path']
            if p.parent!=ROOT or p.stat().st_size!=row['bytes'] or sha(p)!=row['sha256']:raise ValueError('PG binding mismatch')
    source_files=[{'path':p.name,'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(ROOT.iterdir()) if p.is_file() and p.suffix in ('.py','.ts','.mjs','.json')]
    scratch_name='k01-'+uuid.uuid4().hex
    if args.mode=='caller':argv=[sys.executable,'-I','-B',str(ROOT/'entry.test.py')]
    elif args.mode=='pg':argv=[str(NODE),'--import','tsx',str(ROOT/'run.ts')]
    else:
        argv=[str(NODE),str(ROOT/'node_modules'/('vitest/vitest.mjs' if args.mode=='pure' else 'typescript/bin/tsc'))]
        argv+=['run','--config',str(ROOT/'vitest.config.mjs'),'--no-cache'] if args.mode=='pure' else ['--noEmit','--project',str(ROOT/'types.tsconfig.json')]
    label=f'check-{len(finished)+1:02d}';append_record(ledger,{'event':'started','label':label,'mode':args.mode,'startedAt':now.isoformat(),'sourceHead':permit['sourceHead'],'argv':argv,'freeBytes':free_bytes,'sourceFiles':source_files,'scratchPlanned':str(ROOT/'.scratch'/scratch_name)})
    tmp,identity=create_scratch(ROOT/'.scratch',scratch_name)
    append_record(ledger,{'event':'namespace-created','label':label,'identity':identity})
    sys.dont_write_bytecode=True
    spec=importlib.util.spec_from_file_location('k01_ops14',SUPERVISOR);module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
    env=environment(tmp,started,permit,os.environ.get('FLOW_K01_QUERY_ADMIN_URL') if args.mode=='pg' else None)
    work=(110 if args.mode=='pg' else 20)-(time.monotonic()-started_mono)
    if work<=0:raise ValueError('preflight consumed work budget')
    report=module.supervise(module.Launch(tuple(argv),str(ROOT),env,module.Ownership.NEW_CHILD_SESSION,module.Capture.MERGED),module.Policy(work,3 if args.mode=='pg' else 2,7 if args.mode=='pg' else 5,49152))
    raw=report.stdout+report.stderr
    with (folder/(label+'.raw')).open('xb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
    saved=(folder/(label+'.raw')).read_bytes();closed=process_closed(report,saved)
    value=dataclasses.asdict(report);value.pop('stdout');value.pop('stderr')
    value.update(event='finished',label=label,mode=args.mode,resourceConfirmed=closed,outputSha256=hashlib.sha256(saved).hexdigest(),
      sourceChanged=[r['path'] for r in source_files if not (ROOT/r['path']).is_file() or sha(ROOT/r['path'])!=r['sha256']])
    try:verify_inputs();value['fixedInputsAfter']='matched'
    except Exception:value['fixedInputsAfter']='UNKNOWN'
    # Future PG receipts are retained regardless of process closure; no DB outcome is inferred here.
    value['scratch']=cleanup_scratch(tmp,identity,closed,started_mono+29) if args.mode!='pg' else {'path':str(tmp),'identity':identity,'state':'KEEP_PG_RECEIPTS','absent':False}
    value['logicalBytes']=logical_bytes(ROOT)+logical_bytes(folder)+value['scratch'].get('logicalBytes',0)
    value['storageWithinBudget']=value['logicalBytes']<=MAX_NEW and sum(p.stat().st_size for p in folder.glob('*.raw'))<=262144
    value['operatorElapsedMs']=round((time.monotonic()-started_mono)*1000)
    value['withinTimeBudget']=value['operatorElapsedMs']<=maximum*1000
    value['endedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();append_record(ledger,value)
    passed=check_passed(report,closed) and not value['sourceChanged'] and value['fixedInputsAfter']=='matched' and value['storageWithinBudget'] and value['withinTimeBudget'] and (args.mode=='pg' or value['scratch']['absent'])
    print(json.dumps({'mode':args.mode,'exit':report.exit_code,'closed':closed,'scratch':value['scratch']['state'],'passed':passed}))
    return 0 if passed else 1
if __name__=='__main__':raise SystemExit(main())

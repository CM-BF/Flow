import os,sys,json,time,subprocess,selectors,signal,hashlib,pathlib,datetime
root=pathlib.Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/tui-task-cancel')
name=sys.argv[1]
commands={
 'capture-check':['/opt/homebrew/opt/node@24/bin/node','docs/evidence/tui01f/web-handoff/capture.mjs','--self-test'],
 'import-only':['/opt/homebrew/opt/node@24/bin/node','--import','tsx','docs/evidence/tui01f/web-handoff/import-only.mjs'],
 'failure-attribution':['/opt/homebrew/opt/node@24/bin/node','--import','tsx','experiments/tui-web-control-handoff/journey.ts','--failure-self-test'],
 'types-attribution':['/opt/homebrew/opt/node@24/bin/node','node_modules/typescript/bin/tsc','-p','docs/evidence/tui01f/web-handoff/tsconfig.json','--pretty','false'],
 'types-first':['/opt/homebrew/opt/node@24/bin/node','node_modules/typescript/bin/tsc','-p','docs/evidence/tui01f/web-handoff/tsconfig.json','--pretty','false'],
 'pure-first':['/opt/homebrew/opt/node@24/bin/node','--import','tsx','experiments/tui-web-control-handoff/journey.ts','--self-test']}
command=commands[name];e=root/'docs/evidence/tui01f/web-handoff';space=os.statvfs(root);free=space.f_bavail*space.f_frsize
assert free>=1024**3+32*1024**2
source=[]
for path in ['apps/tui/src/task-controls/fixture.ts','experiments/tui-web-control-handoff/journey.ts','experiments/tui-web-control-handoff/preview.ts','experiments/tui-web-control-handoff/terminal.py']:
 b=(root/path).read_bytes();source.append({'path':path,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
env=dict(os.environ,TSX_DISABLE_CACHE='1');start=time.monotonic();at=datetime.datetime.now(datetime.timezone.utc).isoformat()
p=subprocess.Popen(command,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ,'stdout');sel.register(p.stderr,selectors.EVENT_READ,'stderr');buf={'stdout':bytearray(),'stderr':bytearray()};reason=None
while sel.get_map():
 if time.monotonic()-start>(10 if name=='capture-check' else 30) or sum(map(len,buf.values()))>256*1024:
  reason='deadline-or-output-bound'
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
 for k,_ in sel.select(0.05):
  b=os.read(k.fileobj.fileno(),65536)
  if not b:sel.unregister(k.fileobj)
  else:buf[k.data].extend(b[:max(0,256*1024-sum(map(len,buf.values())))])
 if reason and time.monotonic()-start>32:break
code=p.wait(timeout=2)
for kind,b in buf.items():
 with (e/(name+'-'+kind+'.txt')).open('xb') as f:f.write(b)
try:os.killpg(p.pid,0);group='present-or-unknown'
except ProcessLookupError:group='absent'
result={'startedAt':at,'command':command,'cwd':str(root),'freeBefore':free,'exitCode':code,'elapsedMs':round((time.monotonic()-start)*1000),'pid':p.pid,'group':group,'stopReason':reason,'sourceBindings':source,'outputs':{k:{'bytes':len(v),'sha256':hashlib.sha256(v).hexdigest()}for k,v in buf.items()},'PG':0,'browser':0,'provider':0,'install':0,'TSX_DISABLE_CACHE':'1'}
(e/(name+'-run.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));print(buf['stdout'].decode(errors='replace')[:10000]);print(buf['stderr'].decode(errors='replace')[:10000])

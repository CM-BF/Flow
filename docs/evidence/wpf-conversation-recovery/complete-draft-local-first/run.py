from pathlib import Path
import os,sys,time,json,subprocess,signal,shutil,hashlib,datetime,errno
base=Path("/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-recovery")
tmp=Path(__file__).parent
node="/opt/homebrew/opt/node@24/bin/node"
start=time.monotonic(); work_until=start+8.716; hard=start+13.716
report={"startedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"source":"fea37b408f6bf9d9fcde38afa760b903f38e5cf9","budgetMs":13716,"cleanupReserveMs":5000,"steps":[],"errors":[],"PG":False,"Chrome":False,"HTTP":False,"network":"sandbox denied","projectWrites":"sandbox denied","previousLocalChargedMs":6284,"observerRerun":False}
env={k:v for k,v in os.environ.items() if k in ("PATH","HOME","USER","LOGNAME","LANG","LC_ALL")}
env.update(TMPDIR=str(tmp),TSX_DISABLE_CACHE="1",NODE_DISABLE_COMPILE_CACHE="1")
def size():
 total=0
 for root,dirs,files in os.walk(tmp,onerror=lambda e: (_ for _ in ()).throw(e)):
  for f in files:
   try: total+=os.lstat(Path(root)/f).st_size
   except FileNotFoundError: pass
 return total
def absent(pid):
 try: os.killpg(pid,0); return False
 except ProcessLookupError: return True
report["startFreeBytes"]=shutil.disk_usage(tmp).free
commands=[("types",[node,str(base/"node_modules/typescript/lib/tsc.js"),"--noEmit","-p","apps/web/tsconfig.json"])]
for label,args in commands:
 if report["errors"] or time.monotonic()>=work_until: break
 command=["/usr/bin/sandbox-exec","-f",str(tmp/"sandbox.sb")]+args
 step={"label":label,"command":command}; p=None; begin=time.monotonic()
 try:
  with (tmp/(label+".log")).open("wb") as out:
   p=subprocess.Popen(command,cwd=base,env=env,stdout=out,stderr=subprocess.STDOUT,start_new_session=True);step["pid"]=p.pid
   while p.poll() is None:
    if time.monotonic()>=work_until: raise RuntimeError("local work deadline")
    if size()>8*1024*1024 or (tmp/(label+".log")).stat().st_size>1024*1024: raise RuntimeError("local size limit")
    time.sleep(.05)
   step["exitCode"]=p.wait()
   if step["exitCode"]: report["errors"].append(label+" exit "+str(step["exitCode"]))
 except BaseException as e: report["errors"].append(type(e).__name__+": "+str(e))
 finally:
  if p:
   try:
    if not absent(p.pid):
     os.killpg(p.pid,signal.SIGTERM)
     try: p.wait(timeout=max(.01,min(.5,hard-time.monotonic())))
     except subprocess.TimeoutExpired: pass
     if not absent(p.pid): os.killpg(p.pid,signal.SIGKILL)
     p.wait(timeout=max(.01,hard-time.monotonic()))
    step["groupAbsent"]=absent(p.pid)
    if not step["groupAbsent"]: report["errors"].append("owned group not absent")
   except BaseException as e: report["errors"].append("cleanup "+str(e))
  step["elapsedMs"]=(time.monotonic()-begin)*1000
  log=tmp/(label+".log")
  if log.exists(): step.update(logBytes=log.stat().st_size,logSha256=hashlib.sha256(log.read_bytes()).hexdigest())
  report["steps"].append(step)
try:
 report["tmpBytes"]=size();report["endFreeBytes"]=shutil.disk_usage(tmp).free
 if report["tmpBytes"]>8*1024*1024: report["errors"].append("terminal tmp limit")
 if sum(s.get("logBytes",0) for s in report["steps"])>1024*1024: report["errors"].append("terminal raw limit")
except BaseException as e: report["errors"].append("terminal accounting "+str(e))
report["elapsedMs"]=(time.monotonic()-start)*1000
if report["elapsedMs"]>13716: report["errors"].append("total deadline")
report["state"]="PASS" if not report["errors"] and len(report["steps"])==1 else "FAIL"
(tmp/"segment.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report))
sys.exit(0 if report["state"]=="PASS" else 1)

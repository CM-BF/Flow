from pathlib import Path
import os,sys,time,json,subprocess,signal,shutil,hashlib,datetime,errno
base=Path("/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-conversation-recovery")
tmp=Path(__file__).parent
node="/opt/homebrew/opt/node@24/bin/node"
start=time.monotonic(); work_until=start+10.000; hard=start+30.000
report={"startedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"source":"1952bcdb9c509c0da24192d55402587c34374b2e","budgetMs":30000,"cleanupReserveMs":5000,"steps":[],"errors":[],"PG":False,"Chrome":False,"HTTP":False,"network":"sandbox denied","projectWrites":"sandbox denied","previousLocalChargedMs":0,"observerRerun":False}
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
commands=[("direct",[node,str(base/"node_modules/vitest/vitest.mjs"),"run","--config",str(tmp/"vitest.config.mjs"),"--configLoader","native","--no-cache","--testNamePattern","blocks a bound late-view turn","--reporter=json","--outputFile",str(tmp/"vitest-results.json")]),("types",[node,str(base/"node_modules/typescript/lib/tsc.js"),"--noEmit","-p","apps/web/tsconfig.json"])]
for label,args in commands:
 if report["errors"] or time.monotonic()>=hard-5: break
 work_until=min(time.monotonic()+10.000,hard-5)
 child_hard=min(time.monotonic()+15.000,hard)
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
   if label=="direct" and step["exitCode"]==0:
    result=json.loads((tmp/"vitest-results.json").read_text())
    assertions=[v for suite in result["testResults"] for v in suite["assertionResults"]]
    selected=[v for v in assertions if v["status"] not in ("pending","skipped","todo")]
    step["selection"]={"passed":result["numPassedTests"],"failed":result["numFailedTests"],"notSelected":result["numPendingTests"],"selectedTitles":[v["fullName"] for v in selected]}
    if not (result["success"] and result["numPassedTests"]==1 and result["numFailedTests"]==0 and result["numPendingTests"]==54 and len(selected)==1 and "blocks a bound late-view turn" in selected[0]["fullName"] and selected[0]["status"]=="passed"):
     raise RuntimeError("exact direct1/54 NOT_SELECTED acceptance failed")
 except BaseException as e: report["errors"].append(type(e).__name__+": "+str(e))
 finally:
  if p:
   try:
    if not absent(p.pid):
     os.killpg(p.pid,signal.SIGTERM)
     try: p.wait(timeout=max(.01,min(.5,child_hard-time.monotonic())))
     except subprocess.TimeoutExpired: pass
     if not absent(p.pid): os.killpg(p.pid,signal.SIGKILL)
     p.wait(timeout=max(.01,child_hard-time.monotonic()))
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
if report["elapsedMs"]>30000: report["errors"].append("total deadline")
report["state"]="PASS" if not report["errors"] and len(report["steps"])==2 else "FAIL"
(tmp/"segment.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report))
sys.exit(0 if report["state"]=="PASS" else 1)

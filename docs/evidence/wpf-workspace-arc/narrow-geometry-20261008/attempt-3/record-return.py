from pathlib import Path
import json,os,math,sys,datetime
p=Path(__file__).parent;b=Path('/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-composition');read=lambda n:json.loads((p/n).read_text());write=lambda n,d:(p/n).write_text(json.dumps(d,indent=2)+'\n');start=read('outer/start.json');workerstart=read('raw/start.json');w=read('raw/worker-result.json');parent=read('raw/result.json');outer=read('outer/actual-exit.json');raw=read('raw/arc-browser.json');post=float(sys.argv[1]);exitcode=int(sys.argv[2]);obs=[]
for kind,ids in [('PID',[start['outerPid'],start['parentPid'],workerstart['workerPid'],w['chromePid']]),('PGID',[start['parentPid'],workerstart['workerPid']])]:
 for pid in ids:
  try:(os.kill if kind=='PID' else os.killpg)(pid,0);state='PRESENT'
  except ProcessLookupError:state='ESRCH'
  except OSError as ex:state='UNKNOWN:'+str(ex)
  obs.append({'kind':kind,'id':pid,'state':state})
for path in [p/'scratch',b/'apps/web/node_modules/.vite',b/'apps/web/node_modules/.vite-temp']:
 try:path.lstat();state='PRESENT'
 except FileNotFoundError:state='ENOENT'
 except OSError as ex:state='UNKNOWN:'+str(ex)
 obs.append({'path':str(path),'state':state})
closure=raw.get('cleanup',{});owned=all(r['state'] in ['ESRCH','ENOENT'] for r in obs) and closure.get('contextClosed') is True and closure.get('httpClosed') is True and not parent['cleanupErrors'] and all(r['EOF'] and not r['droppedBytes'] for r in outer['streams'].values());now=datetime.datetime.now(datetime.timezone.utc).isoformat();write('post-cleanup.json',{'at':now,'run':start['run'],'observations':obs,'rawClosure':closure,'parentCleanupErrors':parent['cleanupErrors'],'parentScenarioConfirmation':parent['state'],'workerChromeStdoutEOF':w['chromeStdoutEOF'],'workerChromeStderrEOF':w['chromeStderrEOF'],'parentStdoutEOF':parent['stdoutEOF'],'parentStderrEOF':parent['stderrEOF'],'outerStreams':outer['streams'],'independentPortProbe':False,'PG':False,'ownedReturn':owned});charge=math.ceil(max(post,outer['elapsedMs'],parent['elapsedMs']));write('accounting.json',{'at':now,'logicalId':'ARC-GEOMETRY-CONTINUATION-20261008','attempt':3,'outerElapsedMs':outer['elapsedMs'],'outerPostWriteElapsedMs':post,'parentElapsedMs':parent['elapsedMs'],'chargeMs':charge,'cumulativeMs':75205+charge,'remainingMs':270000-75205-charge,'state':'CLOSED_MAX_THREE_ATTEMPTS','oldCreditTransfer':False});write('actual-tool-exit.json',{'actualToolExit':exitcode,'postWriteElapsedMs':post,'stdoutEOF':outer['streams']['stdout']['EOF'],'stderrEOF':outer['streams']['stderr']['EOF'],'errors':outer['errors']});print(json.dumps({'returnAt':now,'ownedReturn':owned,'charge':charge,'cumulative':75205+charge,'passed':raw['passed'],'error':raw.get('error'),'screenshots':raw.get('screenshots'),'chromeEOF':[w['chromeStdoutEOF'],w['chromeStderrEOF']],'pids':[start['outerPid'],start['parentPid'],workerstart['workerPid'],w['chromePid']]}))

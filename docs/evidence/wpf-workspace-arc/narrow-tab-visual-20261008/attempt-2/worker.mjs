import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
const root=dirname(fileURLToPath(import.meta.url)); const scratch=join(root,'scratch'), output=join(root,'raw');
const binding=JSON.parse(await readFile(join(root,'binding.json'),'utf8'));
const cancellation=new AbortController();
const report={state:'FAILED',workerPid:process.pid,chromePid:null,chromeExit:null,interrupts:[],cleanupErrors:[],result:null};
let chrome,browser,launchError; let stdoutEnded=false,stderrEnded=false;
let chromeBytes=0,totalChromeBytes=0;const chunks=[];
const stop=signal=>{process.exitCode=1;report.interrupts.push(signal);cancellation.abort(new Error(signal));if(chrome?.pid&&chrome.exitCode===null&&chrome.signalCode===null)chrome.kill('SIGTERM');};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
const workTimer=setTimeout(()=>stop('work-timeout'),binding.limits.workMs);
async function bounded(action,ms){let timer;try{return await Promise.race([action(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('cleanup deadline')),ms);})]);}finally{clearTimeout(timer);}}
try {
 const {chromium}=await import(pathToFileURL(binding.playwright).href);
 const scenario=await import(pathToFileURL(binding.scenario).href);
 const profile=join(scratch,'chrome');await mkdir(profile);
 const args=['--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,`--disk-cache-dir=${join(scratch,'cache')}`,'about:blank'];
 chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args,{detached:false,stdio:['ignore','pipe','pipe'],env:{...process.env,MAC_CHROMIUM_TMPDIR:scratch,BREAKPAD_DUMP_LOCATION:join(scratch,'crashpad')}});
 chrome.on('error',error=>{launchError=error;});report.chromePid=chrome.pid;
 for(const stream of [chrome.stdout,chrome.stderr])stream.on('data',chunk=>{totalChromeBytes+=chunk.length;const kept=chunk.subarray(0,Math.max(0,65536-chromeBytes));chromeBytes+=kept.length;chunks.push(kept);});
 chrome.stdout.on('end',()=>{stdoutEnded=true;});chrome.stderr.on('end',()=>{stderrEnded=true;});
 chrome.once('exit',(code,signal)=>{report.chromeExit={code,signal};});
 await writeFile(join(output,'owned.json'),JSON.stringify({workerPid:process.pid,chromePid:chrome.pid,profile,args,group:'inherited-worker',temp:scratch,nativeChromeSandbox:true})+'\n');
 let port;const until=Date.now()+8000;
 while(!port){if(launchError)throw launchError;if(report.chromeExit||report.interrupts.length||Date.now()>=until)throw new Error('Chrome readiness failed');try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch(error){if(error.code!=='ENOENT')throw error;}if(!port)await delay(50);}
 report.cdpPort=port;browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`,{timeout:3000,noDefaults:true});
 report.contextAdmission={chromePid:chrome.pid,profile,ownership:'fresh PID/exclusive profile; scenario creates and closes one own context; no user browser'};
 report.result=await scenario.checkWorkspaceLayout({browser,outputDirectory:output,cacheDirectory:join(scratch,'vite'),signal:cancellation.signal});
 report.state=JSON.stringify(report.result.selected)===JSON.stringify(binding.requiredGroupNames)&&JSON.stringify(report.result.passed)===JSON.stringify(binding.requiredGroupNames)&&!report.result.error&&!report.result.cleanupErrors.length?'PASSED':'FAILED';
} catch(error){report.error=String(error.stack??error).slice(0,8192);}
finally {
 clearTimeout(workTimer);
 try{if(browser)await bounded(()=>browser.close(),2000);}catch(error){report.cleanupErrors.push('browser close: '+error.message);}
 if(chrome?.pid&&!report.chromeExit)chrome.kill('SIGTERM');
 const until=Date.now()+2500;while(chrome?.pid&&!report.chromeExit&&Date.now()<until)await delay(25);
 if(chrome?.pid&&!report.chromeExit){chrome.kill('SIGKILL');report.cleanupErrors.push('Chrome needed SIGKILL');}
 const last=Date.now()+1000;while(chrome?.pid&&(!report.chromeExit||!stdoutEnded||!stderrEnded)&&Date.now()<last)await delay(25);
 report.chromeStdoutEOF=stdoutEnded;report.chromeStderrEOF=stderrEnded;
 report.chromeLog={observedBytes:totalChromeBytes,retainedBytes:chromeBytes,truncatedBytes:totalChromeBytes-chromeBytes,finalAfterEOF:stdoutEnded&&stderrEnded};
 await writeFile(join(output,'chrome.log'),Buffer.concat(chunks));
 if(!report.chromeExit||!stdoutEnded||!stderrEnded||report.cleanupErrors.length||report.interrupts.length)report.state='FAILED';
 await writeFile(join(output,'worker-result.json'),JSON.stringify(report,null,2)+'\n');
}
if(report.interrupts.length)report.state='FAILED';
console.log(JSON.stringify(report));process.exitCode=report.state==='PASSED'?0:1;

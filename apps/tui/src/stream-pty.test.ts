import {expect,test} from 'vitest';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {streamCenter} from '../test-fixtures/stream-center.js';
const execute=promisify(execFile);
test('real PTY shows two verified prefixes, lazy/redacted tool bodies and sanitized text; exit leaves center work running',async()=>{
  const fixture=await streamCenter();const directory=await mkdtemp(join(tmpdir(),'flow-tui01c-pty-'));fixture.append('First');
  try {
    const env={PATH:'/opt/homebrew/opt/node@24/bin:/usr/bin:/bin',TERM:'xterm-256color',LANG:'en_US.UTF-8',FLOW_URL:fixture.url,FLOW_TOKEN:'synthetic-owner',FLOW_TUI_STATE_DIR:directory,TUI_TEST_NODE:process.execPath,TUI_TEST_CONVERSATION:fixture.conversation.id};
    const child=await execute('/usr/bin/python3',['apps/tui/test-fixtures/stream_driver.py'],{env,timeout:25000,maxBuffer:2*1024*1024});
    const receipt=JSON.parse(child.stdout.trim());console.log('TUI01C PTY',JSON.stringify(receipt));expect(receipt.exitCode).toBe(0);expect(receipt.rawModeRestored).toBe(true);
    expect(fixture.calls.filter(c=>c.url.includes('/native-activities/'))).toHaveLength(1);
    expect(fixture.calls.filter(c=>c.method==='POST').map(c=>c.url)).toEqual(['/fixture/advance']);
    expect(fixture.turn.task.status).toBe('running');fixture.finish('Completed after observer quit');
    const reopening=execute(process.execPath,['--import','tsx','apps/tui/src/main.tsx','--headless'],{env,timeout:10000,maxBuffer:2*1024*1024});
    reopening.child.stdin!.end(JSON.stringify({type:'open',id:fixture.conversation.id})+'\n'+JSON.stringify({type:'quit'})+'\n');
    const reopened=await reopening;
    const frames=reopened.stdout.trim().split('\n').map(line=>JSON.parse(line));
    expect(frames[0].snapshot.turns[0].assistant.text).toBe('Completed after observer quit');
    expect(frames[1].result.code).toBe('QUIT');
  } finally {await fixture.close();await rm(directory,{recursive:true,force:true});}
},40000);

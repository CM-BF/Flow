import { mkdtemp, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, expect, test } from 'vitest';
import { EventOutbox, EventStorageError } from '../outbox.js';
import type { EventBatch, RunnerEventData } from '@flow/contracts';
const roots: { path: string; dev: number; ino: number; removed: boolean }[] = [];
async function directory() {
  const path = await mkdtemp(join(tmpdir(), 'flow-terminal-outbox-')), stat = await lstat(path);
  roots.push({ path, dev: stat.dev, ino: stat.ino, removed: false }); return path;
}
afterEach(async () => {
  for (const root of roots.filter(item => !item.removed)) {
    const stat = await lstat(root.path); expect([stat.dev,stat.ino,stat.isDirectory(),stat.isSymbolicLink()]).toEqual([root.dev,root.ino,true,false]);
    await rm(root.path,{recursive:true}); root.removed=true;
  }
});
afterAll(async () => { if(process.env.FLOW_X01_TERMINAL_FACTS) await writeFile(process.env.FLOW_X01_TERMINAL_FACTS,JSON.stringify({roots}),{flag:'wx',mode:0o600}); });
test('terminal batch validates before sequence allocation and snapshots all data before durable report', async () => {
  const path=await directory(), reports: EventBatch[]=[];
  const outbox=new EventOutbox(path,{attemptId:'attempt',ownerVersion:1},async batch=>{
    expect(JSON.parse(await readFile(join(path,'pending-events.json'),'utf8'))).toEqual(batch);
    expect((await lstat(join(path,'pending-events.json'))).mode&0o777).toBe(0o600); reports.push(batch);
  });
  expect(()=>outbox.emitBatch([])).toThrow();
  expect(()=>outbox.emitBatch(Array.from({length:51},()=>({type:'message',text:'too many'})))).toThrow();
  const values: RunnerEventData[]=[{type:'message',text:'original'},{type:'completed',outcome:'succeeded'}];
  const sent=outbox.emitBatch(values); (values[0] as {text:string}).text='mutated'; await sent;
  expect(reports[0]!.events.map(event=>event.sequence)).toEqual([1,2]); expect(reports[0]!.events[0]).toHaveProperty('text','original');
});
test('terminal persistence failure reports nothing and remains sticky without allocating another sender', async () => {
  const path=await directory(); await mkdir(join(path,'pending-events.json.tmp')); let reports=0;
  const outbox=new EventOutbox(path,{attemptId:'attempt',ownerVersion:1},async()=>{reports++;});
  await expect(outbox.emitBatch([{type:'completed',outcome:'succeeded'}])).rejects.toBeInstanceOf(EventStorageError);
  await expect(outbox.emit({type:'message',text:'later'})).rejects.toBeInstanceOf(EventStorageError);
  expect(reports).toBe(0);
});

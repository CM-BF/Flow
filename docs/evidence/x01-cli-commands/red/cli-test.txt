import { mkdtemp, writeFile, unlink, rmdir, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { runCli } from './index.js';
import { accepted, binding, changed, command, id, input, response, runtimeView, taskId } from '../../../docs/evidence/x01-cli-commands/fixtures.js';
let dir:string,file:string,identity:Awaited<ReturnType<typeof lstat>>;
beforeEach(async()=>{dir=await mkdtemp(join(tmpdir(),'cli-'));file=join(dir,'input.json');identity=await lstat(dir);});
afterEach(async()=>{vi.restoreAllMocks();await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});const current=await lstat(dir);expect([current.dev,current.ino]).toEqual([identity.dev,identity.ino]);await rmdir(dir);});
async function cli(args:string[]) {const out:string[]=[],err:string[]=[];const code=await runCli(args,{out:t=>out.push(t),err:t=>err.push(t)},{FLOW_URL:'http://127.0.0.1:1',FLOW_TOKEN:'fixture-owner'});return {code,out,err};}
it('runs the actual CLI through FlowClient for all four commands',async()=>{
  const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(response(runtimeView())).mockResolvedValueOnce(response(changed())).mockResolvedValueOnce(response(accepted(),201)).mockResolvedValueOnce(response(binding()));
  expect((await cli(['plugin','runtime',id])).code).toBe(0);await writeFile(file,JSON.stringify(command));
  expect((await cli(['plugin','runtime-change',id,'--input',file,'--key','enable'])).code).toBe(0);await writeFile(file,JSON.stringify(input));
  expect((await cli(['plugin','tool-task',id,'--input',file,'--key','admit'])).code).toBe(0);
  const final=await cli(['plugin','binding',taskId]);expect(final.code).toBe(0);expect(JSON.parse(final.out[0]!)).toEqual(binding());expect(fetch).toHaveBeenCalledTimes(4);
});
it('returns usage2 before transport for missing key/invalid input/oversized encoded file',async()=>{
  const fetch=vi.spyOn(globalThis,'fetch');await writeFile(file,JSON.stringify(command));
  expect((await cli(['plugin','runtime-change',id,'--input',file])).code).toBe(2);
  await writeFile(file,'{}');expect((await cli(['plugin','runtime-change',id,'--input',file,'--key','k'])).code).toBe(2);
  await writeFile(file,' '.repeat(32769));expect((await cli(['plugin','tool-task',id,'--input',file,'--key','k'])).code).toBe(2);expect(fetch).not.toHaveBeenCalled();
});
it('separates unknown ACK exit4 from request usage2 and trusted business409 exit3',async()=>{
  await writeFile(file,JSON.stringify(input));const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(response({},201)).mockRejectedValueOnce(new Error('dropped')).mockResolvedValueOnce(response({error:{code:'plugin_revision_conflict',message:'changed'}},409));
  const args=['plugin','tool-task',id,'--input',file,'--key','original'];
  for(let i=0;i<2;i++){const result=await cli(args);expect(result.code).toBe(4);expect(result.err.join('')).toContain('original --key');expect(result.out).toEqual([]);}
  expect((await cli(args)).code).toBe(3);expect(fetch).toHaveBeenCalledTimes(3);
});

import { randomUUID } from 'node:crypto';
import { lstat,mkdtemp,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll,afterEach,beforeEach,expect,test,vi } from 'vitest';
import { readPluginRuntimeConfiguration } from './plugin-runtime-configuration.js';
const server=vi.hoisted(()=>({create:vi.fn(),listen:vi.fn(),close:vi.fn()}));
vi.mock('./index.js',()=>({createServer:server.create}));
const roots:{path:string;dev:number;ino:number;removed:boolean}[]=[];
async function policyFile(value:unknown){const path=await mkdtemp(join(tmpdir(),'flow-runtime-policy-')),stat=await lstat(path);roots.push({path,dev:stat.dev,ino:stat.ino,removed:false});const file=join(path,'policy.json');await writeFile(file,JSON.stringify(value),{mode:0o600});return file;}
beforeEach(()=>{vi.resetModules();vi.resetAllMocks();server.listen.mockResolvedValue(undefined);server.close.mockResolvedValue(undefined);server.create.mockResolvedValue({listen:server.listen,close:server.close});});
afterEach(async()=>{vi.unstubAllEnvs();vi.restoreAllMocks();for(const root of roots.filter(x=>!x.removed)){const stat=await lstat(root.path);expect([stat.dev,stat.ino,stat.isDirectory(),stat.isSymbolicLink()]).toEqual([root.dev,root.ino,true,false]);await rm(root.path,{recursive:true});root.removed=true;}});
afterAll(async()=>{if(process.env.FLOW_X01_HOST_POLICY_FACTS)await writeFile(process.env.FLOW_X01_HOST_POLICY_FACTS,JSON.stringify({roots}),{flag:'wx',mode:0o600});});
const identity=()=>({runnerId:randomUUID(),storeId:'owned',hostApiMajor:1 as const,protocol:'flow.plugin-runtime.v1' as const});
test('plugin host operator policy matches only the configured full authenticated tuple and omission stays disabled',async()=>{
  expect(await readPluginRuntimeConfiguration(undefined)).toBeUndefined();const id=identity();const {protocol,...tuple}=id;
  const file=await policyFile({hosts:[tuple]});const policy=(await readPluginRuntimeConfiguration(file))!;
  expect(policy(id)).toBe(true);for(const wrong of [{...id,runnerId:randomUUID()},{...id,storeId:'other'},{...id,hostApiMajor:2}])expect(policy(wrong as typeof id)).toBe(false);
  await writeFile(file,JSON.stringify({hosts:[]}));expect(policy(id)).toBe(true);
  for(const value of [{hosts:[]},{hosts:[tuple,tuple]},{hosts:[{...tuple,runnerId:'*'}]},{hosts:[{...tuple,token:'SECRET'}]}])await expect(readPluginRuntimeConfiguration(await policyFile(value))).rejects.toThrow('invalid or unavailable');
  await expect(readPluginRuntimeConfiguration('')).rejects.toThrow('invalid or unavailable');
});
function env(file:string|undefined){vi.stubEnv('DATABASE_URL','synthetic-only');vi.stubEnv('FLOW_TOKEN','synthetic-only');vi.stubEnv('FLOW_PORT','4310');for(const name of ['FLOW_PACKAGE_FETCH_CONFIG','FLOW_PLUGIN_INSTALL_CONFIG','FLOW_ACTIVE_STEERING','FLOW_BROWSER_SESSION_JSON','FLOW_ORIGIN'])vi.stubEnv(name,undefined);vi.stubEnv('FLOW_PLUGIN_RUNTIME_CONFIG',file);}
async function startAndStop(file:string|undefined){env(file);const prior=[process.listenerCount('SIGINT'),process.listenerCount('SIGTERM')];const on=vi.spyOn(process,'on');try{await import('./main.js');const stop=on.mock.calls.find(([name])=>name==='SIGTERM')![1];stop();await vi.waitFor(()=>expect(server.close).toHaveBeenCalledOnce());await Promise.resolve();expect([process.listenerCount('SIGINT'),process.listenerCount('SIGTERM')]).toEqual(prior);}finally{for(const [name,listener] of on.mock.calls)if(name==='SIGINT'||name==='SIGTERM')process.off(name,listener);}}
test('plugin host actual main forwards an explicitly loaded exact policy once and preserves ordinary close',async()=>{
  const id=identity(),{protocol,...tuple}=id;await startAndStop(await policyFile({hosts:[tuple]}));expect(server.create).toHaveBeenCalledOnce();expect(server.create.mock.calls[0]![0].pluginRuntimeHostPolicy(id)).toBe(true);expect(server.listen).toHaveBeenCalledOnce();
});
test('plugin host actual main omission has no policy property and invalid explicit input starts no center',async()=>{
  await startAndStop(undefined);expect(server.create.mock.calls[0]![0]).not.toHaveProperty('pluginRuntimeHostPolicy');
  vi.resetModules();server.create.mockClear();server.listen.mockClear();env('');await expect(import('./main.js')).rejects.toThrow('invalid or unavailable');expect(server.create).not.toHaveBeenCalled();expect(server.listen).not.toHaveBeenCalled();
});

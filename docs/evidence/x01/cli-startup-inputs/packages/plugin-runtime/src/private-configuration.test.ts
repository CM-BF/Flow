import { chmod, lstat, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import { readPrivateJsonConfiguration } from './private-configuration.js';
const roots: { path:string;dev:number;ino:number;removed:boolean }[]=[];
async function fixture(bytes:string|Buffer='{"store":"owned"}') {
  const path=await mkdtemp(join(tmpdir(),'flow-plugin-private-config-')), stat=await lstat(path);
  roots.push({path,dev:stat.dev,ino:stat.ino,removed:false}); const file=join(path,'config.json');
  await writeFile(file,bytes,{mode:0o600}); return {path,file};
}
afterEach(async()=>{vi.restoreAllMocks();for(const root of roots.filter(x=>!x.removed)){
  const stat=await lstat(root.path);expect([stat.dev,stat.ino,stat.isDirectory(),stat.isSymbolicLink()]).toEqual([root.dev,root.ino,true,false]);
  await rm(root.path,{recursive:true});root.removed=true;
}});
afterAll(async()=>{if(process.env.FLOW_X01_PRIVATE_CONFIG_FACTS)await writeFile(process.env.FLOW_X01_PRIVATE_CONFIG_FACTS,JSON.stringify({roots}),{flag:'wx',mode:0o600});});
test('private operator reader accepts bounded owned 0600 JSON and rejects aliases, nonprivate modes and nonfiles',async()=>{
  const f=await fixture();expect(await readPrivateJsonConfiguration(f.file)).toEqual({store:'owned'});
  const alias=join(f.path,'alias');await symlink(f.file,alias);
  await expect(readPrivateJsonConfiguration(alias)).rejects.toThrow();await expect(readPrivateJsonConfiguration('relative')).rejects.toThrow();
  await chmod(f.file,0o644);await expect(readPrivateJsonConfiguration(f.file)).rejects.toThrow();
  await mkdir(join(f.path,'directory'));await expect(readPrivateJsonConfiguration(join(f.path,'directory'))).rejects.toThrow();
});
test('private operator reader bounds UTF8 and actual bytes and rejects another uid',async()=>{
  for(const bytes of [Buffer.from([0xff]),'x'.repeat(65537),'{broken'])await expect(readPrivateJsonConfiguration((await fixture(bytes)).file)).rejects.toThrow();
  const f=await fixture();if(process.getuid){const uid=process.getuid();vi.spyOn(process,'getuid').mockReturnValue(uid+1);await expect(readPrivateJsonConfiguration(f.file)).rejects.toThrow();}
});

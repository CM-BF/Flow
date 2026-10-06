// One authorized operator action, not a reusable deployment framework. No secret values enter output.
import {readFile,lstat,mkdir,cp,rename,rm,readdir} from 'node:fs/promises';
import {join} from 'node:path';import {createHash} from 'node:crypto';import {Pool} from 'pg';
import {loadPreviewConfiguration,withPreviewLock,assertPreviewMarker,readPreviewJson} from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/preview.mjs';
import {verifyWebArtifact} from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/web-artifact.mjs';
import {importWebCompatibility,verifyWebCompatibility,readWebRelease,planWebRelease} from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/web-release.mjs';
import {inspectOwnedProcess} from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/process.mjs';
const directory='/Users/citrine/.flow-personal',reportRoot='/Users/citrine/Projects/AgentHarness/Flow/docs/evidence/wpf-release01';
const environment=JSON.parse(await readFile(join(reportRoot,'environment.json'),'utf8'));
const reports=await Promise.all(['old','new'].map(async label=>({label,report:JSON.parse(await readFile(join(reportRoot,label,'report.json'),'utf8')),input:environment.artifacts.find(v=>v.label===label)})));
const config=await loadPreviewConfiguration(directory);
const result=await withPreviewLock(config,async()=>{
  await assertPreviewMarker(config);const state=await readPreviewJson(join(directory,'state.json'));
  if(state.source.head!=='b1c2e39837c2208e6fc2c59a80e16797f26448b5'||await readWebRelease(directory))throw Error('Unexpected source/release');
  for(const role of ['center','runner','web'])if(await inspectOwnedProcess(state.processes[role])!=='running')throw Error('Owned process mismatch');
  for(const key of ['artifactId','manifestDigest','sourceHead'])if(state.webArtifact[key]!==reports[0].report.artifact[key])throw Error('Old descriptor mismatch');
  const pool=new Pool({connectionString:config.databaseUrl,max:1,connectionTimeoutMillis:1500,statement_timeout:2000});let maintenance;
  try{await pool.query('BEGIN READ ONLY');maintenance=(await pool.query('SELECT id,capacity,revoked,maintenance_state,maintenance_version FROM flow.runners ORDER BY id')).rows;await pool.query('COMMIT');}finally{await pool.end();}
  if(maintenance.length!==1||maintenance[0].maintenance_state!=='accepting'||maintenance[0].revoked)throw Error('Unexpected runner state');
  const imports=[];
  for(const {label,report,input} of reports){
    if(report.backendHead!==state.source.head)throw Error('Report backend mismatch');
    const artifact=report.artifact;await verifyWebArtifact({directory:input.directory,artifact});
    if(label==='new'){
      const root=join(directory,'web-artifacts'),destination=join(root,artifact.artifactId),stage=join(root,'.stage-svc04-approved');
      let exists=false;try{await lstat(destination);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}
      if(!exists){await mkdir(stage,{mode:0o700});try{for(const name of await readdir(join(input.directory,'web-artifacts',artifact.artifactId)))await cp(join(input.directory,'web-artifacts',artifact.artifactId,name),join(stage,name),{recursive:true,force:false,errorOnExist:true});await rename(stage,destination);}finally{await rm(stage,{recursive:true,force:true});}}
    }
    await verifyWebArtifact({directory,artifact});const compatibilityId=await importWebCompatibility({directory,reportDirectory:join(reportRoot,label)});
    await verifyWebCompatibility({directory,artifact,backendHead:state.source.head,compatibilityId});imports.push({label,artifact,compatibilityId});
  }
  const plan=await planWebRelease({directory,artifact:imports[0].artifact,expectedVersion:0,action:'bootstrap',backendHead:state.source.head,compatibilityId:imports[0].compatibilityId});
  return {observedAt:new Date().toISOString(),source:state.source.head,processes:Object.fromEntries(Object.entries(state.processes).map(([role,p])=>[role,p.pid])),maintenance,ports:{center:config.centerPort,web:config.webPort},configurationDigest:createHash('sha256').update(await readFile(join(directory,'config.json'))).digest('hex'),nativeConfigurationDigest:createHash('sha256').update(await readFile(join(directory,'claude.json'))).digest('hex'),imports,plannedBootstrapVersion:plan.version,retainedBudget:{artifacts:2,maxArtifacts:3,bytes:2950349,maxBytes:201326592},serviceActions:0};
});
console.log(JSON.stringify(result));

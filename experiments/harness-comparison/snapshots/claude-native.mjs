import { query } from '/tmp/flow-harness-eval.iq7BzZ/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs';
import { writeFile, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const fixtureDir = await realpath('/tmp/flow-claude-native.jr7N8j');
const fixturePath = path.join(fixtureDir, 'fixture.txt');
await writeFile(fixturePath, 'FLOW_FIXTURE_VALUE=17\n');
const pkg = JSON.parse(await readFile('/tmp/flow-harness-eval.iq7BzZ/node_modules/@anthropic-ai/claude-agent-sdk/package.json', 'utf8'));
const clean = v => String(v ?? '').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]').replace(/(?:sk-ant-|sk-|Bearer\s+)[A-Za-z0-9_.-]+/gi, '[secret redacted]').replace(/eyJ[A-Za-z0-9_.-]+/g,'[token redacted]').slice(0,800);
const report = { sdkVersion: pkg.version, packageRuntimeVersion: pkg.claudeCodeVersion, nodeVersion: process.version, fixtureDir, startedAt:new Date().toISOString(), runs:[] };
const started = performance.now();
const options = {
  cwd:fixtureDir, model:'sonnet', thinking:{type:'disabled'},
  tools:['Read'], allowedTools:['Read'], settingSources:[], plugins:[], skills:[],
  settings:{enabledPlugins:{}}, mcpServers:{}, strictMcpConfig:true,
  permissionMode:'dontAsk', maxTurns:3, maxBudgetUsd:0.25, persistSession:true,
  hooks:{PreToolUse:[{hooks:[async input => {
    const requested = input?.tool_input?.file_path;
    const allowed = input?.tool_name === 'Read' && typeof requested === 'string' && path.resolve(fixtureDir, requested) === fixturePath;
    return {hookSpecificOutput:{hookEventName:'PreToolUse', permissionDecision:allowed ? 'allow' : 'deny', permissionDecisionReason:allowed ? 'Experiment fixture read' : 'Only fixture.txt is authorized'}};
  }]}]},
};
async function run(label,prompt, overrides, expected) {
  const remaining = Math.max(1, 90000 - (performance.now()-started));
  const abortController = new AbortController();
  const timer=setTimeout(()=>abortController.abort(),remaining);
  const item={label, requestedModel:'sonnet', prompt, startedAt:new Date().toISOString(), events:[], toolNames:[], assistantText:[]};
  report.runs.push(item);
  const t=performance.now();
  try {
    const q=query({prompt,options:{...options,...overrides,abortController,stderr:data=>{item.stderrSummary=clean(data)}}});
    for await (const event of q) {
      item.events.push({type:event.type, ...(event.subtype ? {subtype:event.subtype}: {}), elapsedMs:Math.round(performance.now()-t)});
      if(event.type==='system' && event.subtype==='init') {
        item.sessionId=event.session_id; item.actualModel=event.model; item.runtimeVersion=event.claude_code_version;
        item.tools=event.tools; item.pluginCount=event.plugins?.length; item.pluginNames=event.plugins?.map(p=>p.name); item.mcpServerCount=event.mcp_servers?.length; item.skillCount=event.skills?.length; item.apiKeySource=event.apiKeySource;
      }
      if(event.type==='assistant') {
        item.messageModel=event.message?.model;
        for (const block of event.message?.content??[]) {
          if(block.type==='tool_use') item.toolNames.push(block.name);
          if(block.type==='text') item.assistantText.push(clean(block.text));
        }
      }
      if(event.type==='result') {
        item.result={subtype:event.subtype,isError:event.is_error,text:clean(event.result),numTurns:event.num_turns,durationMs:event.duration_ms,durationApiMs:event.duration_api_ms,totalCostUsd:event.total_cost_usd,usage:event.usage,modelUsage:event.modelUsage,permissionDenialCount:event.permission_denials?.length,errors:event.errors?.map(clean)};
        item.passed=!event.is_error && (event.result??'').trim()===expected;
      }
    }
  } catch(error) { item.error={name:error?.name??'Error',summary:clean(error?.message)}; item.passed=false; }
  finally {clearTimeout(timer); item.wallMs=Math.round(performance.now()-t); await writeFile(path.join(fixtureDir,'results.json'),JSON.stringify(report,null,2));}
  return item;
}
const first=await run('native-first','Read fixture.txt and reply with exactly FLOW_OK:17. Do not read any other file or use other tools.',{},'FLOW_OK:17');
if(first.passed && first.sessionId && performance.now()-started < 70000) {
  await run('native-resume','Reply with exactly FLOW_RESUME:17 using the value from the previous turn.',{resume:first.sessionId,tools:[],allowedTools:[],maxTurns:1},'FLOW_RESUME:17');
}
report.wallMs=Math.round(performance.now()-started); report.finishedAt=new Date().toISOString();
await writeFile(path.join(fixtureDir,'results.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { startStreamPreview } from "./conversation-stream-integration.fixture";
const root=fileURLToPath(new URL("../../../",import.meta.url)),output=root+"docs/evidence/wpf-chat06-stream-integration/",production=process.argv.includes("--production"),label=production?"production":"development";
const preview=await startStreamPreview(production),stream=preview.streams[0]!;
const paths=(JSON.parse(await readFile(output+"take-receipt.json","utf8")).claim.scope as string[]).filter(path=>path.startsWith("apps/"));
const sourceFiles=Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash("sha256").update(await readFile(root+path)).digest("hex")])));
const sourceCommit=execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim();
const browser=await chromium.launch({channel:"chrome",headless:true});const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:"reduce"});const page=await context.newPage();page.setDefaultTimeout(10000);
const errors:string[]=[],checks:string[]=[];let failure:string|null=null;page.on("pageerror",error=>errors.push(error.message));
const pane=(n:number)=>page.locator(`[id="panel-conversation:chat-${n}"]`),input=(n:number)=>pane(n).getByRole("textbox",{name:"Message input"});
const open=async(n:number)=>{if(!await page.getByRole("navigation",{name:"Conversations",exact:true}).isVisible())await page.getByRole("button",{name:"Chats",exact:true}).click();await page.getByRole("navigation",{name:"Conversations",exact:true}).getByRole("button",{name:`Conversation ${n}`,exact:true}).click();await expect(input(n)).toBeVisible();};
const check=async(name:string,run:()=>Promise<void>)=>{await run();checks.push(name);console.log("PASS",name);};
try{
 await page.goto(preview.url);if(production){await page.getByLabel("Owner token",{exact:true}).fill("flow-fixture-only");await page.getByRole("button",{name:"Connect workspace",exact:true}).click();}await expect(page.getByRole("textbox",{name:"Message input"})).toBeVisible();
 await check("official Thread shows an incremental draft, typed final settles once while task remains running",async()=>{
  await open(2);await expect(pane(2).getByText("A reply in progress",{exact:true})).toBeVisible();await expect(pane(2).locator('[data-stream-status]')).toContainText("not the final reply");
  const task=preview.first.chats.get("chat-2")!.turns[0]!.task.id;stream.append(task," with UTF8 古😀");await expect(pane(2).getByText("A reply in progress with UTF8 古😀",{exact:true})).toBeVisible();
  await input(2).fill("Keep a separate new draft");stream.append(task,"","block-complete");stream.finish(task,"Final answer without task completion");await expect(pane(2).getByText("Final answer without task completion",{exact:true})).toBeVisible();await expect(pane(2).locator('[data-stream-status]')).toHaveCount(0);await expect(page.getByRole("button",{name:"Previous",exact:true})).toHaveCount(0);await expect(input(2)).toHaveValue("Keep a separate new draft");
  await expect(pane(2).getByRole("button",{name:"Send message",exact:true})).toBeDisabled();expect(preview.first.requests.filter(r=>r.path.includes("/details/"))).toHaveLength(0);
 });
 await check("new conversation Enter uses CREATE without opt-in and GET with patch-v1, first acceptance preserves focus",async()=>{
  await page.getByRole("button",{name:"New chat",exact:true}).first().click();const composer=page.getByRole("textbox",{name:"Message input"}).last();await composer.fill("Hello incremental world");await composer.press("Enter");await expect(page.getByText(/^A: Thinking through your question/)).toBeVisible();await expect(composer).toBeFocused();await composer.fill("New draft during stream");await expect(page.getByText('A: Here is the complete reply to “Hello incremental world”.',{exact:true})).toBeVisible();await expect(composer).toHaveValue("New draft during stream");
  expect(stream.headers.some(h=>h.method==="POST"&&h.path==="/api/conversations"&&h.protocol===undefined)).toBe(true);expect(stream.headers.some(h=>h.method==="GET"&&h.protocol==="patch-v1")).toBe(true);
 });
 await check("unavailable settlement retains draft with truthful interrupted and truncated notices",async()=>{
  const turn=preview.first.addTurn("chat-3","Interrupted reply",false),task=stream.seed(turn);stream.append(task,"Retained intermediate");stream.append(task,"","incomplete",0,true);stream.finish(task,"Canonical separate reply",false);await open(3);
  await expect(pane(3).getByText("Retained intermediate",{exact:true})).toBeVisible();await expect(pane(3).locator('[data-stream-status]')).toContainText("Interrupted draft");await expect(pane(3).locator('[data-stream-status]')).toContainText("truncated");await expect(pane(3).getByText("Canonical separate reply",{exact:true})).toBeVisible();
 });
 await check("stream extension toggles independently, restores focus/draft and disables stream reads",async()=>{
  await input(3).fill("Keep me across extension toggle");await page.getByRole("button",{name:"Extensions and appearance",exact:true}).click();const row=page.locator("li").filter({hasText:"flow.assistant-stream"});await expect(row).toHaveCount(1);await row.getByRole("button",{name:"Disable flow.assistant-stream",exact:true}).click();await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Extensions and appearance",exact:true})).toBeFocused();await expect(pane(3).locator('[data-stream-status]')).toHaveCount(0);await expect(page.getByRole("button",{name:"Previous",exact:true})).toHaveCount(0);const before=stream.reads.length;await page.waitForTimeout(2200);expect(stream.reads).toHaveLength(before);await expect(input(3)).toHaveValue("Keep me across extension toggle");
  await page.getByRole("button",{name:"Extensions and appearance",exact:true}).click();await row.getByRole("button",{name:"Enable flow.assistant-stream",exact:true}).click();await page.keyboard.press("Escape");await expect(pane(3).getByText("Retained intermediate",{exact:true})).toBeVisible();
 });
 await check("two split panes update independently; hidden overview and offline suspend streams",async()=>{
  const turn=preview.first.addTurn("chat-4","Split reply",false),task=stream.seed(turn);stream.append(task,"Split draft");await open(4);await page.getByRole("button",{name:"Split chat",exact:true}).click();await open(3);
  await expect(pane(4)).toBeVisible();await expect(pane(3)).toBeVisible();stream.append(task," both visible");await expect(pane(4).getByText("Split draft both visible",{exact:true})).toBeVisible();
  await context.setOffline(true);await expect.poll(()=>page.evaluate(()=>navigator.onLine)).toBe(false);const before=stream.reads.length;await page.waitForTimeout(300);expect(stream.reads).toHaveLength(before);await expect(pane(4).locator('[data-stream-status]')).toContainText("updates paused");await context.setOffline(false);await expect(pane(4).locator('[data-stream-status]')).not.toContainText("updates paused");
  await page.getByRole("button",{name:"Work overview",exact:true}).click();const hidden=stream.reads.length;await page.waitForTimeout(2300);expect(stream.reads).toHaveLength(hidden);await page.getByRole("button",{name:"Chats",exact:true}).click();
 });
 await check("existing queue Enter and button preserve a fresh composer draft",async()=>{
  await open(4);await pane(4).getByRole("radio",{name:"Queue next",exact:true}).check();await input(4).fill("Queue while streaming");await input(4).press("Enter");await expect.poll(()=>preview.first.requests.filter(r=>r.method==="POST"&&r.path==="/api/conversations/chat-4/queue").length).toBe(1);await input(4).fill("Keep a new draft");await expect(input(4)).toHaveValue("Keep a new draft");
 });
 await check("same IDs after center replacement do not inherit draft cache and connection help explains token source",async()=>{
  await page.getByRole("button",{name:"Change connection",exact:true}).click();await expect(page.getByText(/Leave blank for this Web app/)).toBeVisible();await page.getByText("Where do I get the owner token?",{exact:true}).click();await expect(page.getByText(/This is a Flow token/)).toBeVisible();
  await page.getByLabel("Center URL",{exact:true}).fill(preview.centers[1]!);await page.getByLabel("Owner token",{exact:true}).fill("flow-fixture-only");await page.getByRole("button",{name:"Connect workspace",exact:true}).click();await expect(page.getByRole("navigation",{name:"Conversations",exact:true})).toBeVisible();await open(2);await expect(pane(2).getByText("A reply in progress",{exact:true})).toBeVisible();await expect(pane(2)).not.toContainText("Final answer without task completion");
 });
 await check("390px themes and keyboard preserve composer and visible draft semantics",async()=>{
  for(const theme of ["light","dark"] as const){await page.setViewportSize({width:1280,height:900});const toggle=page.getByRole("button",{name:`Use ${theme} theme`,exact:true});if(await toggle.isVisible())await toggle.click();await page.screenshot({path:output+`${label}-${theme}.png`});await page.setViewportSize({width:390,height:844});const hide=page.getByRole("button",{name:"Hide chat list",exact:true});if(await hide.isVisible())await hide.click();await input(2).focus();await input(2).press("Shift+Enter");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(pane(2).locator('[data-stream-status]')).toBeVisible();await page.screenshot({path:output+`${label}-${theme}-390.png`});}
 });
}catch(error){failure=String(error);console.error(error);await page.screenshot({path:output+`${label}-failure.png`,fullPage:true});}
finally{await writeFile(output+`${label}-browser.json`,JSON.stringify({startedSource:sourceCommit,sourceFiles,at:new Date().toISOString(),production,checks,errors,failure,streamReads:preview.streams.map(s=>s.reads),scope:"Actual Flow App, HTTP fixture only; no model/DB/real credentials"},null,2)+"\n");await browser.close();await preview.close();}
if(failure||errors.length)process.exitCode=1;

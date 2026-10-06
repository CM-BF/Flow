import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { startContextPreview } from "./conversation-context-integration.fixture";
const root=fileURLToPath(new URL("../../../",import.meta.url)),out=root+"docs/evidence/wpf-context-i01/";
const production=process.argv.includes("--production"),label=production?"production":"development";
const preview=await startContextPreview(production),browser=await chromium.launch({channel:"chrome",headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:"reduce"});const page=await context.newPage();page.setDefaultTimeout(10_000);
const errors:string[]=[],checks:string[]=[];let failure:string|null=null;
page.on("pageerror",error=>errors.push(error.message));
const dialog=()=>page.getByRole("dialog",{name:"Conversation knowledge",exact:true});
const input=()=>page.getByRole("textbox",{name:"Message input",exact:true}).filter({visible:true});
const knowledge=()=>page.getByRole("button",{name:"Knowledge",exact:true}).filter({visible:true});
const check=async(name:string,run:()=>Promise<void>)=>{await run();checks.push(name);console.log("PASS",name);};
const requests=(suffix:string)=>preview.first.requests.filter(request=>request.method==="POST"&&request.path.endsWith(suffix));
let chatId="";
try{
 await page.goto(preview.url);await page.getByLabel("Owner token",{exact:true}).or(input()).first().waitFor();if(await page.getByLabel("Owner token",{exact:true}).isVisible()){await page.getByLabel("Owner token",{exact:true}).fill("flow-fixture-only");await page.getByRole("button",{name:"Connect workspace",exact:true}).click();}await expect(input()).toBeVisible();
 await check("explicit bounded project pages, no default and empty project plaintext",async()=>{
  await input().fill("Keep my knowledge draft");await knowledge().click();await expect(dialog()).toBeVisible();await expect(dialog().getByLabel("Conversation project")).toHaveValue("");await expect(dialog().getByLabel("Conversation project").locator("option")).toHaveCount(41);
  await dialog().getByRole("button",{name:"Next projects"}).click();await expect(dialog().getByLabel("Conversation project").locator("option")).toHaveCount(3);await expect(dialog().getByLabel("Conversation project")).toHaveValue("");
  preview.empty(true);await dialog().getByRole("button",{name:"Refresh projects"}).click();await expect(dialog()).toContainText("No projects on this page");await page.keyboard.press("Escape");await expect(knowledge()).toBeFocused();await expect(input()).toHaveValue("Keep my knowledge draft");preview.empty(false);
 });
 await check("prepare-only lost CREATE uses original key and freezes project/profile with zero turns",async()=>{
  await knowledge().click();await dialog().getByRole("button",{name:"Refresh projects"}).click();await expect(dialog().getByLabel("Conversation project").locator("option")).toHaveCount(41);await dialog().getByLabel("Conversation project").selectOption("project-01");preview.loseCreate();
  await dialog().getByRole("button",{name:"Prepare conversation in project"}).click();await expect(dialog()).toContainText("Creation receipt pending");await page.keyboard.press("Escape");await expect(page.getByRole("region",{name:"Message receipt"})).toContainText("Receipt unknown");expect(requests("/turns")).toHaveLength(0);
  const first=requests("/conversations").at(-1)!;await page.getByRole("button",{name:"Retry same preparation"}).click();await expect(page.getByRole("region",{name:"Message receipt"})).toHaveCount(0);const second=requests("/conversations").at(-1)!;expect(second.key).toBe(first.key);expect(second.body).toBe(first.body);
  chatId=[...preview.first.chats.values()].find(chat=>chat.snapshot.conversation.title==="Keep my knowledge draft")!.snapshot.conversation.id;expect(preview.first.chats.get(chatId)!.turns).toHaveLength(0);await expect(input()).toHaveValue("Keep my knowledge draft");
 });
 await check("search whole citations, zero eager body, explicit lazy body/cache, close and keyboard preserve draft",async()=>{
  await knowledge().click();await expect(dialog()).toContainText("Conversation project locked");await dialog().getByLabel("Search project knowledge").fill("Fixed");await dialog().getByRole("button",{name:"Search",exact:true}).click();await expect(dialog().getByRole("checkbox")).toHaveCount(2);await dialog().getByRole("checkbox").first().check();expect(preview.reads.filter(r=>r.kind==="resolve")).toHaveLength(0);
  await dialog().getByText("Read Source 1, version 1",{exact:true}).focus();await page.keyboard.press("Enter");await expect(dialog().getByText("Fixed project knowledge <script>not executable</script> 🙂",{exact:true})).toBeVisible();expect(preview.reads.filter(r=>r.kind==="resolve")).toHaveLength(1);
  await page.keyboard.press("Escape");await expect(input()).toHaveValue("Keep my knowledge draft");await knowledge().click();expect(preview.reads.filter(r=>r.kind==="resolve")).toHaveLength(1);await page.keyboard.press("Escape");
 });
 await check("Send sends frozen references; delayed unknown ACK leaves new text and reselected refs intact",async()=>{
  preview.badAck();preview.first.setAckDelay(350);await input().fill("Send old text with knowledge");await page.getByRole("button",{name:"Send message",exact:true}).click();await expect(input()).toHaveValue("");await input().fill("New draft stays exact");
  await knowledge().click();await dialog().getByRole("checkbox").first().check();await page.keyboard.press("Escape");await expect(page.getByRole("region",{name:"Message receipt"})).toContainText("Receipt unknown");await expect(input()).toHaveValue("New draft stays exact");
  const first=requests("/turns").at(-1)!;expect(JSON.parse(first.body!).knowledge).toHaveLength(1);await page.getByRole("button",{name:"Retry same message"}).click();await expect(page.getByRole("region",{name:"Message receipt"})).toHaveCount(0);const retry=requests("/turns").at(-1)!;expect(retry.key).toBe(first.key);expect(retry.body).toBe(first.body);await expect(input()).toHaveValue("New draft stays exact");await expect(page.getByText("1 knowledge references selected for your next message.",{exact:true})).toBeVisible();
 });
 await check("Queue Enter uses the same selected refs and does not cancel current execution",async()=>{
  await page.getByRole("radio",{name:"Queue next",exact:true}).check();await input().fill("Queued with knowledge");await input().press("Enter");await expect(input()).toHaveValue("");await expect.poll(()=>requests("/queue").length).toBeGreaterThan(0);expect(JSON.parse(requests("/queue").at(-1)!.body!).knowledge).toHaveLength(1);expect(preview.first.requests.some(r=>r.method==="POST"&&r.path.endsWith("/cancel"))).toBe(false);
 });
 await check("plugin disable stops reads and retains selected reference plus new draft",async()=>{
  await knowledge().click();await dialog().getByRole("checkbox").first().check();await page.keyboard.press("Escape");await input().fill("Draft while disabled");await page.getByRole("button",{name:"Extensions and appearance",exact:true}).click();await page.getByRole("button",{name:"Disable flow.conversation-knowledge",exact:true}).click();await page.keyboard.press("Escape");await expect(input()).toHaveValue("Draft while disabled");await expect(page.getByText(/1 knowledge references selected for your next message/)).toBeVisible();const before=preview.reads.length;
  await page.getByRole("button",{name:"Extensions and appearance",exact:true}).click();await page.getByRole("button",{name:"Enable flow.conversation-knowledge",exact:true}).click();await page.keyboard.press("Escape");expect(preview.reads.length).toBe(before);await knowledge().click();await expect(dialog().getByRole("checkbox").first()).toBeChecked();await page.keyboard.press("Escape");
 });
 await check("local validation without a new receipt preserves the original text and selection without HTTP",async()=>{
  const before=requests("/queue").length, long="x".repeat(16001);await input().fill(long);await page.getByRole("button",{name:"Add to queue",exact:true}).click();await expect(input()).toHaveValue(long);await expect(page.getByText("Use a non-empty message up to 16,000 UTF-8 bytes for the queue. Your references are kept.",{exact:true})).toBeVisible();expect(requests("/queue").length).toBe(before);await knowledge().click();await expect(dialog().getByRole("checkbox").first()).toBeChecked();await page.keyboard.press("Escape");await input().fill("After local validation");
 });
 await check("budget rejection retains old receipt while a new draft and new references remain independent",async()=>{
  await page.route(url=>/\/api\/conversations\/[^/]+\/queue$/.test(url.pathname),async route=>{if(route.request().method()!=="POST"){await route.continue();return;}await new Promise(resolve=>setTimeout(resolve,450));await route.fulfill({status:400,contentType:"application/json",body:JSON.stringify({error:{code:"context_budget",message:"Fixture execution input budget exceeded"}})});});
  await input().fill("Old budget request");await page.getByRole("button",{name:"Add to queue",exact:true}).click();await expect(input()).toHaveValue("");await input().fill("New draft after budget");await knowledge().click();await dialog().getByRole("checkbox").nth(1).check();await page.keyboard.press("Escape");
  await expect(page.getByText("Fixture execution input budget exceeded",{exact:false}).first()).toBeVisible();await expect(input()).toHaveValue("New draft after budget");await knowledge().click();await expect(dialog().getByRole("checkbox").nth(1)).toBeChecked();await expect(dialog().getByRole("checkbox").first()).not.toBeChecked();await page.keyboard.press("Escape");await page.unrouteAll({behavior:"wait"});
 });
 await check("390 light/dark reduced-motion keyboard dialog retains selection and text",async()=>{
  await page.setViewportSize({width:390,height:844});await knowledge().click();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:out+label+"-light-390.png"});
  for(const key of ["Tab","Tab","Shift+Tab"]) {await page.keyboard.press(key);expect(await dialog().evaluate(el=>el.contains(document.activeElement))).toBe(true);}await page.keyboard.press("Escape");await expect(input()).toHaveValue("New draft after budget");
  await page.getByRole("button",{name:"Use dark theme",exact:true}).click();await knowledge().click();await page.screenshot({path:out+label+"-dark-390.png"});expect(await dialog().evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.keyboard.press("Escape");
 });
 await check("real native hidden and both split panes retain separate project bindings",async()=>{
  await page.setViewportSize({width:1280,height:800});
  for(const fixture of [preview.first,preview.second])fixture.chats.get("chat-3")!.snapshot.conversation.projectId="project-02";
  const nav=page.getByRole("navigation",{name:"Conversations",exact:true});if(!await nav.isVisible())await page.getByRole("button",{name:"Chats",exact:true}).click();
  await nav.getByRole("button",{name:"Conversation 3",exact:true}).click();const third=page.locator('[id="panel-conversation:chat-3"]');await expect(third.getByRole("textbox",{name:"Message input"})).toBeVisible();
  const hidden=page.locator(`[id="panel-conversation:${chatId}"]`);await expect(hidden).toBeHidden();const before=preview.reads.length;await page.waitForTimeout(100);expect(preview.reads.length).toBe(before);
  await page.getByRole("button",{name:"Split chat",exact:true}).click();await expect(hidden).toBeVisible();await expect(third).toBeVisible();
  await hidden.getByRole("button",{name:"Knowledge",exact:true}).click();await expect(dialog().getByRole("checkbox").nth(1)).toBeChecked();await page.keyboard.press("Escape");
  await third.getByRole("button",{name:"Knowledge",exact:true}).click();await expect(dialog()).toContainText("project-02");await dialog().getByLabel("Search project knowledge").fill("Fixed");await dialog().getByRole("button",{name:"Search",exact:true}).click();await expect(dialog().getByRole("checkbox")).toHaveCount(2);expect(preview.reads.at(-1)?.project).toBe("project-02");await dialog().getByRole("checkbox").first().check();
  await context.setOffline(true);await expect(dialog().getByLabel("Search project knowledge")).toBeDisabled();const offline=preview.reads.length;await page.keyboard.press("Escape");await context.setOffline(false);await expect(third.getByRole("button",{name:"Send message",exact:true})).toBeDisabled();expect(preview.reads.length).toBe(offline);
  await page.getByRole("button",{name:"Merge tabs",exact:true}).click();
 });
 await check("connection replacement rejects old scope and starts same IDs with no selected refs",async()=>{
  await page.getByRole("button",{name:"Change connection",exact:true}).click();await page.getByLabel("Center URL",{exact:true}).fill(preview.centers[1]!);await page.getByLabel("Owner token",{exact:true}).fill("flow-fixture-only");await page.getByRole("button",{name:"Connect workspace",exact:true}).click();
  await page.getByRole("navigation",{name:"Conversations",exact:true}).getByRole("button",{name:"Conversation 3",exact:true}).click();await knowledge().click();await expect(dialog()).toContainText("project-02");await expect(dialog()).toContainText("0 / 4");expect(preview.reads.filter(r=>r.center===1&&r.kind==="search")).toHaveLength(0);await page.keyboard.press("Escape");
 });
 await check("unsupported project capability and legacy no-project conversation retain plaintext without knowledge reads",async()=>{
  preview.unsupported(true);await page.getByRole("navigation",{name:"Conversations",exact:true}).getByRole("button",{name:"Conversation 8",exact:true}).click();await knowledge().click();await expect(dialog()).toContainText("No project · plain text only");await expect(dialog().getByLabel("Search project knowledge")).toHaveCount(0);await page.keyboard.press("Escape");
  const reads=preview.reads.length;await input().fill("Legacy plain text remains available");await input().press("Enter");await expect(input()).toHaveValue("");await expect.poll(()=>preview.second.requests.filter(r=>r.method==="POST"&&r.path.endsWith("/turns")).length).toBeGreaterThan(0);const sent=preview.second.requests.findLast(r=>r.method==="POST"&&r.path.endsWith("/turns"))!;expect(JSON.parse(sent.body!)).not.toHaveProperty("knowledge");expect(preview.reads.length).toBe(reads);
 });
 expect(errors).toEqual([]);
}catch(error){failure=error instanceof Error?error.stack??error.message:String(error);console.error(failure);await page.screenshot({path:out+label+"-failure.png"});}
finally{
 const paths:string[]=JSON.parse(await readFile(out+"take-receipt.json","utf8")).claim.scope.filter((p:string)=>p.startsWith("apps/"));const hashes=Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash("sha256").update(await readFile(root+p)).digest("hex")])));
 await writeFile(out+label+"-browser.json",JSON.stringify({at:new Date().toISOString(),sourceCommit:execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim(),hashes,production,checks,errors,failure,requests:preview.first.requests,reads:preview.reads},null,2));await browser.close();await preview.close();
}
if(failure)process.exitCode=1;

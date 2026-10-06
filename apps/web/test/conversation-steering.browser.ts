import { chromium, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { startSteeringFixture } from "./conversation-steering.fixture";

const production=process.argv.includes("--production"),label=production?"production":"development",output="docs/evidence/wpf-steering-control/";
const sourceFiles:Record<string,string>={};
const paths=JSON.parse(await readFile(output+"take-receipt.json","utf8")).claim.scope.filter((path:string)=>path.startsWith("apps/"));
for(const path of paths)sourceFiles[path]=createHash("sha256").update(await readFile(path)).digest("hex");
const sourceCommit=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),sourceDirty=execFileSync("git",["status","--porcelain"],{encoding:"utf8"});
const fixture=await startSteeringFixture(production),browser=await chromium.launch({headless:true,channel:"chrome"}),page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:"reduce"});
const errors:string[]=[],checks:string[]=[];let failure:string|null=null;
page.on("pageerror",error=>errors.push(error.message));
const check=async(name:string,run:()=>Promise<void>)=>{await run();checks.push(name);};
const draft=()=>page.getByRole("textbox",{name:"Additional instruction",exact:true});
const refresh=()=>page.getByRole("button",{name:"Refresh steering",exact:true});
const posts=()=>fixture.first.calls.filter(c=>c.method==="POST");
try{
  await page.goto(fixture.url);
  await check("closed zero reads; keyboard disclosure opens an authorized public FlowClient reader",async()=>{
    await expect(page.getByRole("button",{name:"Show steering",exact:true})).toBeVisible();expect(fixture.first.calls).toHaveLength(0);
    await page.getByRole("button",{name:"Show steering",exact:true}).press("Enter");await expect(refresh()).toBeEnabled();
    await expect.poll(()=>fixture.first.calls.filter(c=>c.path.endsWith("/admission")).length).toBe(1);await expect(draft()).toBeVisible();
  });
  await check("UTF8 limit keeps CJK draft with no receipt or POST",async()=>{
    const text="你".repeat(5462);await draft().fill(text);await page.getByRole("button",{name:"Send steering",exact:true}).click();
    await expect(page.getByRole("alert")).toContainText("16,384");await expect(draft()).toHaveValue(text);expect(posts()).toHaveLength(0);await expect(page.getByRole("listitem",{name:"Steering receipt",exact:true})).toHaveCount(0);
  });
  await check("IME zero, ShiftEnter newline, Enter exactly one command; next draft independent; same revision receipt refresh",async()=>{
    await draft().fill("Please explain the next step");await draft().dispatchEvent("keydown",{key:"Enter",code:"Enter",isComposing:true});expect(posts()).toHaveLength(0);
    await draft().press("Shift+Enter");await expect(draft()).toHaveValue("Please explain the next step\n");await draft().press("Enter");await expect.poll(()=>posts().length).toBe(1);await expect(draft()).toHaveValue("");
    await draft().fill("My independent next draft");await expect(page.getByText("Accepted by center",{exact:true})).toBeVisible();fixture.first.consume();await refresh().click();
    await expect(page.getByText("Consumption observed",{exact:true})).toBeVisible();await expect(draft()).toHaveValue("My independent next draft");
  });
  await check("lost ACK retries original key/body even after unavailable admission/4xx; new draft is not overwritten",async()=>{
    fixture.first.loseNext();await draft().fill("Keep the output concise");await page.getByRole("button",{name:"Send steering",exact:true}).click();await expect(page.getByText("Acceptance unknown",{exact:true})).toBeVisible();
    const original=posts().at(-1)!;await draft().fill("A separate next thought");fixture.first.rejectRetries(true);await page.getByRole("button",{name:"Retry original command",exact:true}).click();
    await expect(page.getByRole("alert").filter({hasText:"Attempt no longer available"})).toBeVisible();await expect(page.getByText("Acceptance unknown",{exact:true})).toBeVisible();
    expect(posts().at(-1)?.key).toBe(original.key);expect(posts().at(-1)?.body).toBe(original.body);
    await page.getByRole("button",{name:"Revoke access",exact:true}).click();await expect(page.getByText(/Steering access is unavailable/)).toBeVisible();const count=posts().length;
    await page.getByRole("button",{name:"Grant access",exact:true}).click();await expect(draft()).toHaveValue("A separate next thought");expect(posts()).toHaveLength(count);
    fixture.first.rejectRetries(false);fixture.first.consume();await refresh().click();await page.getByRole("button",{name:"Retry original command",exact:true}).click();
    await expect(page.getByText("Acceptance unknown",{exact:true})).toHaveCount(0);expect(posts().at(-1)?.key).toBe(original.key);expect(posts().at(-1)?.body).toBe(original.body);await expect(draft()).toHaveValue("A separate next thought");
  });
  await check("hidden read/command lifetime preserves uncertain receipt; reopening retries rather than resends",async()=>{
    await refresh().click();fixture.first.holdNext();await draft().fill("Held acknowledgement");await draft().press("Enter");await expect.poll(()=>posts().at(-1)?.body?.includes("Held acknowledgement")).toBe(true);
    const count=posts().length;await page.getByRole("button",{name:"Hide steering",exact:true}).click();fixture.first.release();await expect(draft()).toHaveCount(0);
    await page.getByRole("button",{name:"Show steering",exact:true}).click();await expect(page.getByText("Acceptance unknown",{exact:true})).toBeVisible();expect(posts()).toHaveLength(count);
    await page.getByRole("button",{name:"Retry original command",exact:true}).click();await expect(page.getByText("Acceptance unknown",{exact:true})).toHaveCount(0);expect(posts()).toHaveLength(count+1);
  });
  await check("same task ID in new center has isolated receipts and explicitly paged metadata",async()=>{
    fixture.second.seed(25);await page.getByRole("button",{name:"Switch center",exact:true}).click();await expect(page.getByText("Center B",{exact:true})).toBeVisible();await expect(page.getByRole("listitem",{name:"Steering receipt",exact:true})).toHaveCount(0);
    await expect(page.getByText("Loaded command history · 20",{exact:true})).toBeVisible();await page.getByText("Loaded command history · 20",{exact:true}).click();await page.getByRole("button",{name:"Load more commands",exact:true}).click();await expect(page.getByText("Loaded command history · 25",{exact:true})).toBeVisible();
    const calls=fixture.second.calls.filter(c=>c.path.includes("/steering?")).map(c=>c.path);expect(calls.some(c=>c.includes("after=20"))).toBe(true);
  });
  await check("read failure remains visible, offline disables reads and preserves the draft",async()=>{
    fixture.second.failReads(true);await draft().fill("Draft after reconnect");await refresh().click();await expect(page.getByRole("alert")).toContainText("Simulated read failure");await expect(page.getByText(/Availability is stale/)).toBeVisible();
    await page.getByRole("button",{name:"Go offline",exact:true}).click();await expect(refresh()).toBeDisabled();await expect(draft()).toHaveValue("Draft after reconnect");fixture.second.failReads(false);await page.getByRole("button",{name:"Go online",exact:true}).click();await expect(refresh()).toBeEnabled();await expect(page.getByRole("alert")).toHaveCount(0);
  });
  await check("light/dark 390px and keyboard focus remain readable without horizontal overflow",async()=>{
    for(const theme of["light","dark"]){if(theme==="dark")await page.getByRole("button",{name:"Dark theme",exact:true}).click();await page.setViewportSize({width:1280,height:720});await page.screenshot({path:output+`${label}-${theme}-1280.png`});
      await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await draft().focus();await expect(draft()).toBeFocused();await page.keyboard.press("Tab");await expect(page.getByRole("button",{name:"Send steering",exact:true})).toBeFocused();await page.screenshot({path:output+`${label}-${theme}-390.png`});}
  });
}catch(error){failure=error instanceof Error?error.stack??error.message:String(error);await page.screenshot({path:output+`${label}-failure.png`,fullPage:true});}
finally{await writeFile(output+`${label}-browser.json`,JSON.stringify({observedAt:new Date().toISOString(),sourceCommit,sourceDirty,sourceFiles,fixture:"Independent public HTTP fixture. No App/real center/provider/model/DB.",checks,errors,failure,httpCalls:{first:fixture.first.calls,second:fixture.second.calls}},null,2)+"\n");await browser.close();await fixture.close();}
if(failure||errors.length)throw Error(failure??errors.join("\n"));

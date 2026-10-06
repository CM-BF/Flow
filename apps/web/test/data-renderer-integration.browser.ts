import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { startQueuePreview } from "./conversation-queue.fixture";

const production = process.argv.includes("--production"), startedAt = new Date().toISOString();
const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = `${root}docs/evidence/wpf-renderer-i01/`, label = production ? "production" : "development";
const paths = ["apps/web/src/App.tsx", "apps/web/src/conversations/ConversationThread.tsx", ...["session.ts", "react.tsx", "data-renderers.ts"].map(x => `apps/web/src/plugin-integration/${x}`), "apps/web/test/data-renderer-integration.test.ts", "apps/web/test/data-renderer-integration.browser.ts"];
const sourceFiles = Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash("sha256").update(await readFile(root + path)).digest("hex")])));
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const preview = await startQueuePreview(production);
preview.first.addTurn("chat-2", "Another long reply", true); preview.first.setCurrentStatus("chat-2", "running");
for (let i=0; i<22; i++) preview.first.addTurn("chat-8", `History ${i}`, true);
const bTurn = preview.second.chats.get("chat-1")!.turns[0]!;
if (bTurn.assistant.state !== "available" || bTurn.assistant.source.kind !== "assistant-final") throw Error("Invalid fixture");
const bContent = "CENTER B full reply.\n".repeat(300); preview.second.details.get(bTurn.assistant.contentRef.id)!.content = bContent;
bTurn.assistant = { ...bTurn.assistant, text: bContent.slice(0,4000), source: { ...bTurn.assistant.source, contentDigest: createHash("sha256").update(bContent).digest("hex") } };
async function startLifetimePreview() {
  const code = `import React,{Activity,StrictMode,useState,useMemo,useEffect} from 'react';
import{createRoot}from'react-dom/client';import{AssistantRuntimeProvider,useExternalStoreRuntime}from'@assistant-ui/react';
import{FlowClient}from'@flow/client';import{ConversationProjection}from'/src/conversations/projection.ts';import{conversationMessages}from'/src/conversations/messages.ts';
import{AppPluginSession}from'/src/plugin-integration/session.ts';import{ConversationDataRenderers,PluginProvider}from'/src/plugin-integration/react.tsx';
import{Thread}from'/src/components/assistant-ui/elements/thread.aui.tsx';import{themes}from'/src/themes.ts';import'/src/assistant-ui.css';import'/src/styles.css';
const p=new ConversationProjection(new FlowClient({baseUrl:'',token:'flow-fixture-only'}),'chat-1',60000);await p.refresh();
const session=new AppPluginSession({knowsTask:()=>true,task:()=>null,hasDraft:()=>true,ownsMessage:()=>true,openTask(){},openWorkspace(){},closeWorkspace(){},async loadReference(){},setTheme(){},async copy(){}},themes[0]);
const h=React.createElement,thread=h(Thread,{autoFocus:false});const messages=conversationMessages(p.getSnapshot().turns);const convert=m=>m;
function Controls(){const[view,setView]=useState('view-a'),[hidden,setHidden]=useState(false);return h(React.Fragment,null,h('header',null,h('button',{onClick:()=>setView('view-b')},'Rename view'),h('button',{onClick:()=>setHidden(!hidden)},hidden?'Restore Activity':'Hide Activity'),h('output',null,view)),h(Activity,{mode:hidden?'hidden':'visible'},h('section',{style:{height:'80vh',display:'flex',flexDirection:'column'}},h(ConversationDataRenderers,{viewId:view,projection:p,visible:true},thread))));}
function Runtime(){const runtime=useExternalStoreRuntime({messages,convertMessage:convert,isRunning:false,onNew:async()=>{}});return h(PluginProvider,{session},h(AssistantRuntimeProvider,{runtime},h(Controls)));}
createRoot(document.getElementById('root')).render(h(StrictMode,null,h(Runtime)));`;
  const server = await createServer({ root: root + 'apps/web', server: { host: '127.0.0.1', port: 0, proxy: { '/api': preview.centers[0]! } }, plugins: [{ name: 'renderer-consumer', resolveId(id) { if(id === '/renderer-consumer.tsx') return '\0renderer-consumer.tsx'; }, load(id) { if(id === '\0renderer-consumer.tsx') return code; }, configureServer(server) { server.middlewares.use(async(req,res,next) => { if(req.url !== '/lifetime') return next(); res.setHeader('content-type','text/html'); res.end(await server.transformIndexHtml('/lifetime', '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/renderer-consumer.tsx"></script></body></html>')); }); } }] });
  await server.listen(); const address = server.httpServer!.address(); if(!address || typeof address === 'string') throw Error('No lifetime preview address');
  return { server, url: `http://127.0.0.1:${address.port}/lifetime` };
}
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const page = await context.newPage(); page.setDefaultTimeout(8000);
const errors: string[] = [], checks: string[] = []; let failure: string | undefined;
page.on("pageerror", error => errors.push(error.message));
const pane = (chat: number) => page.locator(`[id="panel-conversation:chat-${chat}"]`);
const input = (chat: number) => pane(chat).getByRole("textbox", { name: "Message input", exact: true });
const details = (center = preview.first) => center.requests.filter(r => /\/turns\/[^/]+\/details\//.test(r.path));
const open = async (chat: number) => { await page.getByRole("navigation", { name: "Conversations", exact: true }).getByRole("button", { name: `Conversation ${chat}`, exact: true }).click(); await expect(input(chat)).toBeVisible(); };
const connect = async (center = "") => { await page.getByLabel("Center URL").fill(center); await page.getByLabel("Owner token").fill("flow-fixture-only"); await page.getByRole("button", { name: "Connect workspace" }).click(); };
const check = async (name: string, run: () => Promise<void>) => { if (process.argv.includes("--lifetime-only") && !name.startsWith("direct React")) return; await run(); checks.push(name); console.log(`PASS ${name}`); };
try {
  await page.goto(preview.url); if (production) await connect();
  await check("actual App renders shortened reply with zero initial detail reads, Enter reveals once and caches", async () => {
    await open(1); const read = pane(1).getByRole("button", { name: "Read full reply", exact: true }); await expect(read).toBeVisible(); expect(details()).toHaveLength(0);
    await read.focus(); await read.press("Enter"); await expect(pane(1).locator('.flow-reply-detail pre')).toContainText("thoughtful reply"); expect(details()).toHaveLength(1);
    await pane(1).getByRole("button", { name: "Hide full reply" }).click(); await read.click(); expect(details()).toHaveLength(1);
    await input(1).fill("Keep this independent draft");
  });
  await check("native hidden removes its own renderer and resumes expanded cached reply and draft without another request", async () => {
    await open(2); await expect(pane(1)).toHaveAttribute("hidden", ""); await expect(pane(1).locator('.flow-reply-detail')).toHaveCount(0);
    await open(1); await expect(pane(1).getByRole("button", { name: "Hide full reply" })).toBeVisible(); await expect(input(1)).toHaveValue("Keep this independent draft");
    await expect(pane(1).locator('.flow-reply-detail pre')).toContainText("thoughtful reply"); expect(details()).toHaveLength(1);
  });
  await check("both split panes are readable while focus remains independent", async () => {
    await open(2); await page.getByRole("button", { name: "Split chat", exact: true }).click();
    await expect(input(1)).toBeVisible(); await expect(input(2)).toBeVisible(); await input(1).focus();
    await pane(2).getByRole("button", { name: "Read full reply", exact: true }).click(); await expect(pane(2).locator('.flow-reply-detail pre')).toContainText("thoughtful reply");
    expect(details()).toHaveLength(2); await expect(pane(1).getByRole("button", { name: "Hide full reply" })).toBeVisible();
  });
  await check("disable remains disabled across hide/resume and keeps the host-authorized fallback", async () => {
    await page.getByRole("button", { name: "Extensions and appearance", exact: true }).click();
    await page.getByRole("button", { name: "Disable flow.reply-detail", exact: true }).click(); await page.keyboard.press("Escape");
    await expect(pane(1).getByText("Enhanced display failed or is disabled. Using the standard reply display.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Merge tabs", exact: true }).click(); await open(1); await open(2); await open(1);
    await expect(pane(1).locator('.flow-reply-detail pre')).toContainText("thoughtful reply"); expect(details()).toHaveLength(2);
    await page.getByRole("button", { name: "Extensions and appearance", exact: true }).click(); await expect(page.getByRole("button", { name: "Enable flow.reply-detail", exact: true })).toBeVisible(); await page.keyboard.press("Escape");
  });
  await check("overview hides registrations without discarding the cached content, and closing a pane does not cancel execution", async () => {
    await page.getByRole("button", { name: "Work overview", exact: true }).click(); await expect(pane(1).locator('.flow-reply-detail')).toHaveCount(0);
    await open(1); await expect(pane(1).locator('.flow-reply-detail pre')).toContainText("thoughtful reply");
    await page.getByRole("button", { name: "Close Conversation 1", exact: true }).click(); await expect(pane(1)).toHaveCount(0);
    await open(1); await pane(1).getByRole("button", { name: "Read full reply", exact: true }).click(); expect(details()).toHaveLength(2);
    expect(preview.first.requests.filter(r => r.path.endsWith("/cancel"))).toHaveLength(0);
  });
  await check("same-revision assistant content and history pagination still reach the official Thread", async () => {
    const turn = preview.first.chats.get("chat-1")!.turns[0]!; if (turn.assistant.state !== "available") throw Error("Missing reply");
    turn.assistant = { ...turn.assistant, text: "Fresh assistant body at the same revision", truncated: false };
    await expect(pane(1).getByText("Fresh assistant body at the same revision", { exact: true })).toBeVisible();
    await open(8); const more = pane(8).getByRole("button", { name: "Load more turns", exact: true }); await expect(more).toBeVisible(); await more.click();
    await expect(pane(8).locator('[data-role="user"]')).toHaveCount(23); await expect(more).toHaveCount(0);
  });
  await check("stable converter preserves new intent/onNew, running gates and the separate draft", async () => {
    await open(2); await pane(2).getByRole("radio", { name: "Queue next", exact: true }).check(); await input(2).fill("Queued using Enter"); await input(2).press("Enter");
    await expect.poll(() => preview.first.requests.filter(r => r.method === "POST" && r.path === "/api/conversations/chat-2/queue").length).toBe(1);
    await input(2).fill("Queued using button"); await pane(2).getByRole("button", { name: "Add to queue", exact: true }).click();
    await expect.poll(() => preview.first.requests.filter(r => r.method === "POST" && r.path === "/api/conversations/chat-2/queue").length).toBe(2);
    await pane(2).getByRole("radio", { name: "Send now", exact: true }).check(); await input(2).fill("Ordinary follow up"); await expect(pane(2).getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
    const q = pane(2).getByRole("region", { name: "Conversation queue", exact: true });
    const disclosure = q.locator('button[aria-expanded]').first(); if (await disclosure.getAttribute('aria-expanded') === 'false') await disclosure.click();
    const cancel = q.getByRole("button", { name: "Cancel waiting message", exact: true });
    await expect(cancel).toHaveCount(2); await cancel.first().click(); await expect(cancel).toHaveCount(1); await cancel.first().click(); await expect(cancel).toHaveCount(0);
    preview.first.setCurrentStatus("chat-2", "succeeded"); await expect(pane(2).getByRole("button", { name: "Send message", exact: true })).toBeEnabled();
    await input(2).press("Enter"); await expect.poll(() => preview.first.requests.filter(r => r.method === "POST" && r.path === "/api/conversations/chat-2/turns").length).toBe(1);
    expect(JSON.parse(preview.first.requests.find(r => r.method === "POST" && r.path === "/api/conversations/chat-2/turns")!.body!).mode).toBe("follow-up");
    await input(2).fill("New editable draft while running"); await expect(input(2)).toHaveValue("New editable draft while running");
  });
  await check("late HTTP reply from old connection cannot fill a new center with the same conversation IDs", async () => {
    const initial = preview.first.chats.get("chat-1")!.turns[0]!;
    if (initial.assistant.state !== "available") throw Error("Missing response");
    initial.assistant = { ...initial.assistant, text: preview.first.details.get(initial.assistant.contentRef.id)!.content.slice(0,4000), truncated: true };
    await page.reload(); if(production) await connect(); await open(1);
    let release!: () => void, received!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); const arrived = new Promise<void>(resolve => { received = resolve; });
    await page.route(url => /\/api\/conversations\/chat-1\/turns\/[^/]+\/details\//.test(url.pathname), async route => { const response = await route.fetch(); received(); await gate; try { await route.fulfill({ response }); } catch { /* Old connection was already cancelled. */ } }, { times: 1 });
    await pane(1).getByRole("button", { name: "Read full reply", exact: true }).click(); await arrived;
    await page.getByRole("button", { name: "Change connection", exact: true }).click(); await connect(preview.centers[1]); await open(1); release();
    await expect(pane(1).getByRole("button", { name: "Read full reply", exact: true })).toBeVisible(); expect(details(preview.second)).toHaveLength(0);
    await pane(1).getByRole("button", { name: "Read full reply", exact: true }).click(); await expect(pane(1).locator('.flow-reply-detail pre')).toHaveText(bContent); expect(details(preview.second)).toHaveLength(1);
  });
  await check("real App light/dark narrow keyboard and reduced-motion screenshots retain readable full reply", async () => {
    await input(1).fill("Preserved screenshot draft"); await pane(1).getByRole("button", { name: "Hide full reply" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}${label}-light.png` });
    await page.getByRole("button", { name: "Use dark theme", exact: true }).click(); await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole("button", { name: "Hide chat list", exact: true }).click();
    const toggle = pane(1).getByRole("button", { name: "Hide full reply" }); await toggle.focus(); await toggle.press("Space"); await expect(toggle).toHaveCount(0);
    await pane(1).getByRole("button", { name: "Read full reply" }).press("Enter"); await expect(input(1)).toHaveValue("Preserved screenshot draft");
    await pane(1).getByRole("button", { name: "Hide full reply" }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${output}${label}-dark-390.png` }); expect(details(preview.second)).toHaveLength(1);
  });
  await check("direct React consumer updates a same-visible new binding without polling and Activity keeps expanded cache", async () => {
    const initial = preview.first.chats.get("chat-1")!.turns[0]!;
    if (initial.assistant.state !== "available") throw Error("Missing response");
    initial.assistant = { ...initial.assistant, text: preview.first.details.get(initial.assistant.contentRef.id)!.content.slice(0,4000), truncated: true };
    const lifetime = await startLifetimePreview();
    try {
      await page.goto(lifetime.url); await expect(page.getByRole("button", { name: "Read full reply", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Rename view" }).click(); await expect(page.locator('output')).toHaveText("view-b");
      await expect(page.getByRole("button", { name: "Read full reply", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Read full reply", exact: true }).click(); await expect(page.locator('.flow-reply-detail pre')).toContainText("thoughtful reply");
      const count = details().length; await page.getByRole("textbox", { name: "Message input", exact: true }).fill("Activity draft");
      await page.getByRole("button", { name: "Hide Activity" }).click(); await page.getByRole("button", { name: "Restore Activity" }).click();
      await expect(page.getByRole("button", { name: "Hide full reply", exact: true })).toBeVisible(); await expect(page.getByRole("textbox", { name: "Message input", exact: true })).toHaveValue("Activity draft"); expect(details()).toHaveLength(count);
    } finally { await page.goto('about:blank'); await lifetime.server.close(); }
  });
  expect(errors).toEqual([]);
} catch (error) { failure = error instanceof Error ? error.stack : String(error); console.error(failure); await page.screenshot({ path: `${output}${label}-failure.png` }).catch(() => {}); }
finally { await writeFile(`${output}${label}-browser.json`, JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), sourceCommit, sourceFiles, production, consumerFixtureBuild: "development; final direct-consumer check is separate from the actual App build", url: preview.url, checks, errors, failure: failure ?? null, detailRequests: { first: details(), second: details(preview.second) } }, null, 2)); await browser.close(); await preview.close(); }
if(failure) process.exitCode = 1;

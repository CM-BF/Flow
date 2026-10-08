import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { createServer, type Alias } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = fileURLToPath(new URL("..", import.meta.url));
export const expectedChecks = ["states-next-actions", "checking-keyboard-guard", "transient-submit", "explicit-retained-actions", "details-keyboard", "themes-390-geometry"];
export async function startConnectionFixture(input: { cacheDir: string; aliases: Alias[] }) {
  const server = await createServer({ root, configFile: false, envDir: false, cacheDir: input.cacheDir,
    resolve: { alias: input.aliases }, optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [react(), tailwindcss(), { name: "connection-component-fixture", configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (request.url === "/favicon.ico") { response.writeHead(204).end(); return; }
        if (request.url !== "/") return next();
        response.setHeader("content-type", "text/html");
        void vite.transformIndexHtml("/", '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connection component fixture</title></head><body><div id="root"></div><script type="module" src="/test/connection-ux.fixture.tsx"></script></body></html>').then(html => response.end(html), next);
      });
    } }], server: { host: "127.0.0.1", port: 0, strictPort: true, hmr: false, watch: null,
      fs: { allow: [root, ...input.aliases.map(item => item.replacement)] } }, logLevel: "error" });
  try {
    await server.listen();
    const address = server.httpServer?.address(); assert(address && typeof address !== "string");
    return { url: `http://127.0.0.1:${address.port}`, close: () => server.close() };
  } catch (error) { await server.close(); throw error; }
}
interface Observation { read: number; connect: number; logout: number; discard: number; argumentsMatched: boolean; pending: boolean }
async function observation(page: Page): Promise<Observation> {
  return JSON.parse(await page.getByTestId("fixture-observation").innerText()) as Observation;
}
export async function checkConnection(page: Page, fixture: { url: string }, output: string) {
  const checks: string[] = [], pageErrors: string[] = [], consoleErrors: string[] = [], blocked: string[] = [];
  const geometry: unknown[] = [];
  page.setDefaultTimeout(4000);
  page.on("pageerror", error => { if (pageErrors.length < 8) pageErrors.push(error.name); });
  page.on("console", message => { if (message.type() === "error" && consoleErrors.length < 8) consoleErrors.push("console-error"); });
  await page.route("**/*", route => {
    if (new URL(route.request().url()).origin === fixture.url) return route.continue();
    blocked.push("non-fixture-request"); return route.abort();
  });
  await page.goto(fixture.url);
  const main = page.getByRole("main"), token = page.getByLabel("Owner token", { exact: true });
  const check = page.getByRole("button", { name: "Check existing browser session", exact: true });
  const connect = page.getByRole("button", { name: "Connect workspace", exact: true });
  const phase = async (value: string) => { await page.getByLabel("Fixture phase", { exact: true }).selectOption(value); };
  for (const [value, message, next] of [
    ["idle", "Connect to your Flow workspace.", "Check whether this browser is already signed in"],
    ["unauthenticated", "This browser is not signed in to this workspace.", "Enter the workspace access token"],
    ["offline", "This workspace could not be reached.", "Drafts and pending commands have not been cancelled."],
    ["forbidden", "This workspace denied the browser connection.", "Ask the workspace administrator"],
    ["unsupported", "This workspace does not support browser sign-in yet.", "Ask its administrator"],
    ["error", "The browser connection could not be checked.", "Check the workspace address"],
    ["ready", "This browser is signed in.", "Previous page-only work may still need your decision."],
    ["undefined", "Connect to your Flow workspace.", "Check whether this browser is already signed in"],
  ] as const) {
    await phase(value); await expect(main.getByRole("status")).toHaveText(message);
    await expect(main).toContainText(next); await expect(main).not.toContainText(/expired|first sign-in/i);
  }
  await phase("error"); await expect(main.getByRole("alert")).toContainText("Synthetic connection check failed");
  await page.getByLabel("Optional actions", { exact: true }).uncheck(); await expect(check).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Discard previous page-only work", exact: true })).toHaveCount(0);
  await page.getByLabel("Optional actions", { exact: true }).check(); checks.push(expectedChecks[0]!);

  await phase("checking"); await token.fill("synthetic-A"); await expect(check).toHaveAttribute("aria-disabled", "true");
  await expect(connect).toHaveAttribute("aria-disabled", "true");
  await check.focus(); await page.keyboard.press("Enter"); await page.keyboard.press("Space"); await expect(check).toBeFocused();
  await token.focus(); await page.keyboard.press("Enter");
  assert.deepEqual(await observation(page), { read: 0, connect: 0, logout: 0, discard: 0, argumentsMatched: false, pending: false });
  await expect(token).toHaveValue("synthetic-A"); checks.push(expectedChecks[1]!);

  await phase("unauthenticated"); await token.fill(""); await connect.click(); assert.equal((await observation(page)).connect, 0);
  await token.fill("synthetic-A"); await token.press("Enter");
  await expect(token).toHaveValue("");
  await expect.poll(() => observation(page)).toMatchObject({ connect: 1, argumentsMatched: true, pending: true });
  await token.fill("synthetic-B"); await token.press("Enter"); await expect(token).toHaveValue("synthetic-B");
  assert.equal((await observation(page)).connect, 1); checks.push(expectedChecks[2]!);

  await page.getByRole("button", { name: "Sign out of this center", exact: true }).click();
  await page.getByRole("button", { name: "Discard previous page-only work", exact: true }).click();
  assert.deepEqual(await observation(page), { read: 0, connect: 1, logout: 1, discard: 1, argumentsMatched: true, pending: true });
  await expect(token).toHaveValue("synthetic-B"); checks.push(expectedChecks[3]!);

  await page.getByRole("button", { name: "Settle synthetic connection", exact: true }).click();
  await check.focus(); await page.keyboard.press("Enter"); await expect(check).toBeFocused(); assert.equal((await observation(page)).read, 1);
  const summary = main.locator("summary"); await summary.focus(); await page.keyboard.press("Enter");
  await expect(main.locator("details")).toHaveAttribute("open", ""); await expect(summary).toBeFocused();
  await expect(main).toContainText("HttpOnly browser session"); await page.keyboard.press("Space");
  await expect(main.locator("details")).not.toHaveAttribute("open", ""); await expect(summary).toBeFocused();
  await expect(main).toContainText("本机登录凭据"); await expect(main).toContainText("ask its administrator"); checks.push(expectedChecks[4]!);

  await token.fill("");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ["light", "dark"] as const) {
      await page.getByRole("button", { name: `Fixture ${theme} theme`, exact: true }).click();
      await expect.poll(() => page.evaluate(() => ({ theme: document.documentElement.dataset.theme,
        dark: document.documentElement.classList.contains("dark"), scheme: document.documentElement.style.colorScheme,
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches }))).toEqual({ theme, dark: theme === "dark", scheme: theme, reduced: true });
      const bounds = await main.evaluate(element => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth,
        left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right }));
      assert(bounds.scroll <= bounds.viewport + 1 && bounds.left >= -1 && bounds.right <= bounds.viewport + 1);
      for (const button of await main.getByRole("button").all()) { await button.scrollIntoViewIfNeeded(); await expect(button).toBeInViewport(); }
      geometry.push({ width, theme, ...bounds }); await page.evaluate(() => scrollTo(0, 0));
      if (width === 390) await page.screenshot({ path: join(output, `connection-${theme}-390.png`) });
    }
  }
  checks.push(expectedChecks[5]!); assert.deepEqual(pageErrors, []); assert.deepEqual(consoleErrors, []); assert.deepEqual(blocked, []);
  return { checks, pageErrors, consoleErrors, blocked, geometry, observation: await observation(page),
    scope: "Production component with synthetic props/callbacks; not Cookie/session or full App Recovery acceptance" };
}

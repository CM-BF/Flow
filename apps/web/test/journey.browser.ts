import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});
const evidence = (name: string) => resolve("../../docs/evidence/w01", name);

test("main states in both themes, safe folded detail, and no browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const details: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/details/")) details.push(request.url());
  });
  await page.goto("/#task=demo-decision");
  await expect(
    page.getByRole("heading", { name: "Your decision is needed" }),
  ).toBeVisible();
  expect(details).toHaveLength(0);
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Color theme").selectOption(theme);
    for (const [id, name] of [
      ["demo-decision", "waiting"],
      ["demo-running", "running"],
      ["demo-failed", "failed"],
      ["demo-verification", "verification-failed"],
      ["demo-completed", "completed"],
      ["demo-queued", "queued"],
      ["demo-uncertain", "uncertain"],
    ]) {
      await page.goto(`/#task=${id}`);
      await expect(page.locator(".identifier")).toHaveText(id!);
      await expect(page.locator(".connection.live")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.screenshot({
        path: evidence(`${theme}-${name}.png`),
        fullPage: true,
      });
    }
  }
  expect(details).toHaveLength(0);
  await page.goto("/#task=demo-completed");
  await page.getByRole("button", { name: /Field notes summary/ }).click();
  await expect(
    page.getByText("Artifact version", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: evidence("dark-artifact.png"),
    fullPage: true,
  });
  expect(details).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("narrow screen, keyboard disclosure, skip-link route and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"]) {
    await page.goto("/#task=demo-decision");
    await page.getByLabel("Color theme").selectOption(theme);
    const reference = page.getByRole("button", {
      name: /Launch checklist review/,
    });
    if ((await reference.getAttribute("aria-expanded")) !== "true") {
      await reference.focus();
      await page.keyboard.press("Enter");
    }
    await expect(reference).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByLabel("Launch checklist review content"),
    ).toBeVisible();
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
    await page.screenshot({
      path: evidence(`${theme}-narrow.png`),
      fullPage: true,
    });
  }
  await page.reload();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  expect(page.url()).toContain("task=demo-decision");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your decision is needed" }),
  ).toBeVisible();
  await page.goto("/#%E0%A4%A");
  await expect(
    page.getByRole("heading", { name: "Make room for focused work." }),
  ).toBeVisible();
});

test("disconnect and reconnect continues observation without cancelling work", async ({
  page,
  context,
}) => {
  const cancelRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/cancel")) cancelRequests.push(request.url());
  });
  await page.goto("/#task=demo-running");
  await expect(page.locator(".connection.live")).toBeVisible();
  await context.setOffline(true);
  await expect(page.locator(".connection.disconnected")).toBeVisible();
  await page.screenshot({
    path: evidence("light-disconnected.png"),
    fullPage: true,
  });
  await page.getByLabel("Color theme").selectOption("dark");
  await page.screenshot({
    path: evidence("dark-disconnected.png"),
    fullPage: true,
  });
  await context.setOffline(false);
  await expect(page.locator(".connection.live")).toBeVisible({
    timeout: 10000,
  });
  expect(cancelRequests).toEqual([]);
});

test("accept, close, reopen, decide and explicitly cancel", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Fixture scenario").selectOption("decision");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your decision is needed" }),
  ).toBeVisible();
  const acceptedUrl = page.url();
  await page.goto("about:blank");
  await page.goto(acceptedUrl);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator(".task-header .status-succeeded")).toBeVisible();
  await expect(page.locator(".verification-passed")).toBeVisible();
  await page.goto("/#task=demo-running");
  await page.getByRole("button", { name: "Cancel task", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm cancellation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(
    page.getByText(
      "Cancellation requested. Waiting for the runner to acknowledge that it stopped.",
    ),
  ).toBeVisible();
  await expect(page.locator(".task-header .status-cancelled")).toBeVisible();
});

test("large history is paged and large content is loaded once on expansion", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/#task=demo-large");
  await page.getByRole("button", { name: "Load earlier activity" }).click();
  await expect(
    page.getByText("Evidence step 1: saved a bounded progress note."),
  ).toBeAttached();
  await expect(
    page.getByRole("button", { name: "Load earlier activity" }),
  ).toHaveCount(0);
  expect(requests.filter((url) => url.includes("/api/details/"))).toHaveLength(
    0,
  );
  const reference = page.getByRole("button", { name: /Field notes summary/ });
  await reference.click();
  await expect(page.getByLabel("Field notes summary content")).toBeVisible();
  await reference.click();
  await reference.click();
  expect(requests.filter((url) => url.includes("/api/details/"))).toHaveLength(
    1,
  );
  await page.screenshot({
    path: evidence("light-large-detail.png"),
    fullPage: false,
  });
});

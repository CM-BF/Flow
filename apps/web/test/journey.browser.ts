import { test, expect, type Page } from "@playwright/test";
import { resolve } from "node:path";
const evidence = (name: string) =>
  resolve("../../docs/evidence/w01/thread-revision", name);
const activePane = (page: Page) => page.locator(".flow-tab-body:not([hidden])");
async function fresh(page: Page, id?: string) {
  await page.goto("about:blank");
  await page.goto(id ? `/#task=${id}` : "/");
}
async function theme(page: Page, value: "light" | "dark") {
  if ((await page.locator("html").getAttribute("data-theme")) !== value)
    await page.getByRole("button", { name: `Use ${value} theme` }).click();
}
test.beforeEach(({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("official Thread states and themes, lazy artifact, copy and unsupported actions", async ({
  page,
}) => {
  const details: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/details/")) details.push(request.url());
  });
  for (const mode of ["light", "dark"] as const) {
    for (const [id, state] of [
      ["demo-decision", "waiting"],
      ["demo-running", "running"],
      ["demo-failed", "failed"],
      ["demo-verification", "verification-failed"],
      ["demo-completed", "completed"],
      ["demo-queued", "queued"],
      ["demo-uncertain", "uncertain"],
    ]) {
      await fresh(page, id);
      await expect(page.locator(".connection.live")).toBeVisible();
      await theme(page, mode);
      await page.waitForTimeout(180);
      await expect(
        page.locator('[data-slot="aui_message-group"]'),
      ).toBeVisible();
      await expect(page.getByLabel("Message input")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Edit", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Refresh", exact: true }),
      ).toHaveCount(0);
      if (id === "demo-verification") {
        await expect(
          page.locator(".flow-status.status-succeeded"),
        ).toBeVisible();
        await expect(page.locator(".verification-failed")).toBeVisible();
      }
      await page.screenshot({ path: evidence(`${mode}-${state}.png`) });
    }
  }
  expect(details).toHaveLength(0);
  await fresh(page, "demo-completed");
  await page.getByRole("button", { name: "Open Field notes summary" }).click();
  await expect(
    page.getByRole("term").filter({ hasText: "Version" }),
  ).toBeVisible();
  expect(details).toHaveLength(1);
  await page.screenshot({ path: evidence("dark-artifact.png") });
});

test("narrow, reduced motion, keyboard skip and safe route", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const mode of ["light", "dark"] as const) {
    await fresh(page, "demo-decision");
    await theme(page, mode);
    await expect(
      page.getByRole("heading", { name: "Your decision is needed" }),
    ).toBeVisible();
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
    await page.screenshot({ path: evidence(`${mode}-narrow.png`) });
  }
  await page.reload();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  expect(page.url()).toContain("task=demo-decision");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your decision is needed" }),
  ).toBeVisible();
  await fresh(page);
  await page.goto("/#%E0%A4%A");
  await expect(page.getByLabel("Message input")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add Attachment", exact: true }),
  ).toHaveCount(0);
});

test("offline observation does not cancel, and restores live state", async ({
  page,
  context,
}) => {
  const cancels: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/cancel")) cancels.push(r.url());
  });
  await fresh(page, "demo-running");
  await expect(page.locator(".connection.live")).toBeVisible();
  await context.setOffline(true);
  await expect(page.locator(".connection.disconnected")).toBeVisible();
  for (const mode of ["light", "dark"] as const) {
    await theme(page, mode);
    await page.screenshot({ path: evidence(`${mode}-disconnected.png`) });
  }
  await context.setOffline(false);
  await expect(page.locator(".connection.live")).toBeVisible();
  expect(cancels).toEqual([]);
});

test("official Composer accepts, restores after reopen, decides and explicitly cancels", async ({
  page,
}) => {
  await fresh(page);
  await page.getByLabel("Fixture scenario").selectOption("decision");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your decision is needed" }),
  ).toBeVisible();
  const url = page.url();
  await page.goto("about:blank");
  await page.goto(url);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator(".flow-status.status-succeeded")).toBeVisible();
  await expect(page.locator(".verification-passed")).toBeVisible();
  await expect(
    page
      .locator(".flow-chat-list")
      .getByRole("button", {
        name: "Completed Prepare the checklist, then ask me before publishing the artifact.",
        exact: true,
      }),
  ).toBeVisible();
  await fresh(page);
  await page.getByLabel("Fixture scenario").selectOption("slow");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cancel task", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel task", exact: true }).click();
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(page.locator(".flow-status.status-cancelled")).toBeVisible();
  await expect(
    page
      .locator(".flow-chat-list")
      .getByRole("button", {
        name: "Cancelled Complete in the background.",
        exact: true,
      }),
  ).toBeVisible();
});

test("split, merge, tab keyboard, and close preserve drafts and isolate task observers", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await fresh(page);
  await page.getByLabel("Fixture scenario").selectOption("slow");
  await page.getByLabel("Message input").fill("Keep this unsent draft");
  await page
    .getByRole("button", {
      name: /^Running Continue after the browser closes$/,
    })
    .click();
  await expect(page.locator(".connection.live")).toBeVisible();
  await page.getByRole("button", { name: "Split chat", exact: true }).click();
  await expect(page.locator(".flow-chat-group")).toHaveCount(2);
  await expect(page.getByLabel("Message input")).toHaveValue(
    "Keep this unsent draft",
  );
  await page.getByRole("button", { name: "Merge tabs", exact: true }).click();
  await expect(page.locator(".flow-chat-group")).toHaveCount(1);
  await page.getByRole("tab", { name: "New chat", exact: true }).click();
  await expect(page.getByLabel("Message input")).toHaveValue(
    "Keep this unsent draft",
  );
  await expect(page.getByLabel("Fixture scenario")).toHaveValue("slow");
  await page
    .getByRole("tab", { name: "New chat", exact: true })
    .press("ArrowRight");
  await expect(
    page.getByRole("tab", {
      name: "Continue after the browser closes",
      exact: true,
    }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Split chat", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Close Continue after the browser closes",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Message input")).toHaveValue(
    "Keep this unsent draft",
  );
  expect(
    requests.filter((url) => url.includes("/demo-running/stream")),
  ).toHaveLength(1);
  expect(requests.filter((url) => url.endsWith("/cancel"))).toHaveLength(0);
  await page
    .getByRole("button", { name: /Review the launch checklist$/ })
    .click();
  await page
    .getByRole("button", {
      name: /^Running Continue after the browser closes$/,
    })
    .click();
  await page.getByRole("button", { name: "Split chat", exact: true }).click();
  await expect(page.locator(".connection.live")).toHaveCount(2);
  await page.screenshot({ path: evidence("light-split.png") });
  await theme(page, "dark");
  await page.screenshot({ path: evidence("dark-split.png") });
  await page.getByRole("button", { name: "Merge tabs", exact: true }).click();
  expect(
    requests.filter((url) => url.includes("/demo-decision/stream")),
  ).toHaveLength(1);
  expect(requests.filter((url) => url.endsWith("/cancel"))).toHaveLength(0);
});

test("lost acknowledgement retains official Composer draft and retries the same key", async ({
  page,
}) => {
  let first = true;
  const keys: string[] = [];
  await page.route("**/api/tasks", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]!);
    if (first) {
      first = false;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await fresh(page);
  await page.getByLabel("Message input").fill("Retry this durable acceptance");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Message input")).toHaveValue(
    "Retry this durable acceptance",
  );
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(page.locator(".flow-status")).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

test("closing during acceptance neither reopens a tab nor creates ghost observation", async ({
  page,
}) => {
  let release!: () => void;
  let captured!: () => void;
  const seen = new Promise<void>((r) => (captured = r));
  const gate = new Promise<void>((r) => (release = r));
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.route("**/api/tasks", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    captured();
    await gate;
    await route.fulfill({ response });
  });
  await fresh(page);
  await page.getByLabel("Message input").fill("Accepted after closing the tab");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await seen;
  await page
    .getByRole("button", { name: "Close New chat", exact: true })
    .click();
  release();
  await expect(
    page.getByRole("button", { name: /Accepted after closing the tab$/ }),
  ).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  expect(requests.filter((url) => url.includes("/stream"))).toHaveLength(0);
  expect(requests.filter((url) => url.endsWith("/cancel"))).toHaveLength(0);
});

test("large history is paged and large content only loads when opened", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await fresh(page, "demo-large");
  await page.getByRole("button", { name: "Load earlier activity" }).click();
  await expect(
    page.getByText("Evidence step 1: saved a bounded progress note."),
  ).toBeAttached();
  expect(requests.filter((url) => url.includes("/api/details/"))).toHaveLength(
    0,
  );
  await page.getByRole("button", { name: "Open Field notes summary" }).click();
  await expect(page.locator(".flow-workspace-detail-content")).toBeVisible();
  await page
    .getByRole("button", { name: "Close workspace", exact: true })
    .click();
  await page.getByRole("button", { name: "Open Field notes summary" }).click();
  expect(requests.filter((url) => url.includes("/api/details/"))).toHaveLength(
    1,
  );
  await page.screenshot({ path: evidence("light-large-detail.png") });
});

test("workspace tabs persist per task and after hiding; keyboard detail focus and safe terminal", async ({
  page,
}) => {
  await fresh(page, "demo-completed");
  await page.getByRole("button", { name: "Files", exact: true }).click();
  const file = page.getByRole("treeitem", {
    name: "Field notes summary",
    exact: true,
  });
  await file.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("tab", { name: "Field notes summary", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".flow-workspace-detail-content")).toBeVisible();
  await page
    .getByRole("button", {
      name: /^Running Continue after the browser closes$/,
    })
    .click();
  await page.getByRole("button", { name: "Terminal", exact: true }).click();
  await expect(page.getByLabel("Read-only task output")).toBeVisible();
  await page
    .getByRole("button", { name: /^Completed Summarize the field notes$/ })
    .click();
  await expect(
    page.getByRole("tab", { name: "Field notes summary", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "Close workspace", exact: true })
    .click();
  await page.getByRole("button", { name: "Toggle workspace panel" }).click();
  await expect(
    page.getByRole("tab", { name: "Field notes summary", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  for (const mode of ["light", "dark"] as const) {
    await theme(page, mode);
    await page.getByRole("tab", { name: "Terminal", exact: true }).click();
    await expect(page.getByLabel("Read-only task output")).toBeVisible();
    await page.screenshot({ path: evidence(`${mode}-terminal.png`) });
  }
});

test("list failure is visible and retried; Delete focuses adjacent chat tab", async ({
  page,
}) => {
  let fail = true;
  let failures = 0;
  await page.route(
    (url) => url.pathname === "/api/tasks",
    (route) => {
      if (route.request().method() === "GET" && fail) {
        fail = false;
        failures++;
        return route.abort();
      }
      return route.continue();
    },
  );
  await fresh(page);
  await expect(
    page.getByRole("button", { name: "Retry chat list" }),
  ).toBeVisible();
  expect(failures).toBe(1);
  await page.getByRole("button", { name: "Retry chat list" }).click();
  await page
    .getByRole("button", {
      name: /^Running Continue after the browser closes$/,
    })
    .click();
  await page
    .getByRole("tab", {
      name: "Continue after the browser closes",
      exact: true,
    })
    .press("Delete");
  await expect(
    page.getByRole("tab", { name: "New chat", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Message input")).toBeVisible();
});

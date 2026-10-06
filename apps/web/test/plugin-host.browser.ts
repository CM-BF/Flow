import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
const evidence = (name: string) =>
  fileURLToPath(
    new URL(`../../../docs/evidence/wpf-p01/${name}`, import.meta.url),
  );
test("actual workspace builtin renders output and loads only its reference", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("");
  await page.getByRole("tab", { name: "Terminal", exact: true }).click();
  await expect(page.getByText("Task A output", { exact: false })).toBeVisible();
  await page.getByRole("tab", { name: "Files", exact: true }).click();
  const tree = page.getByRole("treeitem", { name: "A report.txt" });
  await expect(tree).toBeVisible();
  await tree.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("tab", { name: "A report.txt", exact: true }),
  ).toBeFocused();
  await expect(page.getByText("Verified report for task A.")).toBeVisible();
  await expect(page.getByTestId("command-log")).toContainText(
    "flow.reference.load",
  );
  expect(errors).toEqual([]);
});
test("sidebar B command keeps local context while active task is A", async ({
  page,
}) => {
  await page.goto("");
  await expect(page.getByTestId("active-task")).toHaveText("A");
  await page.getByRole("button", { name: "Open from plugin" }).nth(1).click();
  await expect(page.getByTestId("active-task")).toHaveText("B");
  await expect(page.getByTestId("command-log")).toContainText(
    'context={"kind":"task","taskId":"B"}',
  );
  await expect(
    page.getByRole("treeitem", { name: "B report.txt" }),
  ).toBeVisible();
});
test("theme builtin and sample theme fallback preserve draft", async ({
  page,
}) => {
  await page.goto("");
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  const darkBackground = await page
    .locator("html")
    .evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--background"),
    );
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Ocean theme", exact: true })
    .click();
  await expect(page.getByTestId("theme")).toHaveText("sample.notes.ocean");
  await page.getByRole("button", { name: "Insert note", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Draft" })).toHaveValue(
    "Unsent draft Plugin note",
  );
  await page
    .getByRole("button", { name: "Disable Notes", exact: true })
    .click();
  await expect(page.getByTestId("theme")).toHaveText("dark");
  expect(
    await page
      .locator("html")
      .evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--background"),
      ),
  ).toBe(darkBackground);
  await expect(
    page.getByRole("button", { name: "More actions", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Draft" })).toHaveValue(
    "Unsent draft Plugin note",
  );
  await page.getByRole("button", { name: "Enable Notes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "More actions", exact: true }),
  ).toBeVisible();
});
test("lazy loader retry actually reloads and isolates render failure", async ({
  page,
}) => {
  await page.goto("?fail-load");
  await page.getByRole("tab", { name: "Notes", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("loader failed once");
  await page
    .getByRole("button", { name: "Retry extension", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Notes extension" }),
  ).toBeVisible();
  await expect(page.locator("article[data-context-frozen=true]")).toBeVisible();
  await page.getByLabel("Break Notes render").check();
  await expect(page.getByRole("alert")).toContainText("could not render");
  await expect(page.getByRole("textbox", { name: "Draft" })).toHaveValue(
    "Unsent draft",
  );
  await page.getByLabel("Break Notes render").uncheck();
  await page
    .getByRole("button", { name: "Retry extension", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Notes extension" }),
  ).toBeVisible();
});
test("capability denial remains visible without changing active task", async ({
  page,
}) => {
  await page.goto("");
  await page.getByLabel("Deny capabilities").check();
  await page.getByRole("button", { name: "Open from plugin" }).nth(1).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Permission denied: ui.navigate" }),
  ).toBeVisible();
  await expect(page.getByTestId("active-task")).toHaveText("A");
});
test("removing focused extension tab restores neighboring tab focus", async ({
  page,
}) => {
  await page.goto("");
  const tab = page.getByRole("tab", { name: "Task workspace", exact: true });
  await tab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Notes", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Notes extension" }),
  ).toBeVisible();
  await page.keyboard.press("Alt+d");
  await expect(
    page.getByRole("tab", { name: "Notes", exact: true }),
  ).toHaveCount(0);
  await expect(tab).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Draft" })).toHaveValue(
    "Unsent draft",
  );
});
test("light and dark screenshots with narrow reduced-motion layout", async ({
  page,
}) => {
  await page.goto("");
  await expect(
    page.getByRole("treeitem", { name: "A report.txt" }),
  ).toBeVisible();
  await page.screenshot({ path: evidence("host-light.png"), fullPage: true });
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await page.getByRole("tab", { name: "Terminal", exact: true }).click();
  await expect(page.getByText("Task A output", { exact: false })).toBeVisible();
  await page.screenshot({ path: evidence("host-dark.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.screenshot({
    path: evidence("host-narrow-dark.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("menu keyboard and bridge failure report top-level failure locally", async ({
  page,
}) => {
  await page.goto("");
  const trigger = page.getByRole("button", {
    name: "More actions",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "Ocean theme" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.getByLabel("Fail App bridge").check();
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Fixture bridge failed");
  await expect(page.getByTestId("theme")).toHaveText("light");
});

test("sample panel bridge failure is visible locally and retry clears it", async ({
  page,
}) => {
  await page.goto("");
  await page.getByRole("tab", { name: "Notes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Notes extension" }),
  ).toBeVisible();
  await page.getByLabel("Fail App bridge").check();
  await page
    .getByRole("button", { name: "Use Ocean theme", exact: true })
    .click();
  await expect(page.getByRole("article").getByRole("alert")).toHaveText(
    "Fixture bridge failed",
  );
  await expect(page.getByTestId("theme")).toHaveText("light");
  await page.getByLabel("Fail App bridge").uncheck();
  await page
    .getByRole("button", { name: "Use Ocean theme", exact: true })
    .click();
  await expect(page.getByTestId("theme")).toHaveText("sample.notes.ocean");
  await expect(page.getByRole("article").getByRole("alert")).toHaveCount(0);
});

test("workspace keeps A-B-A and Notes roundtrip layouts without leaking task details", async ({
  page,
}) => {
  await page.goto("?strict");
  const stats = () =>
    page.evaluate(() =>
      (
        window as unknown as {
          pluginFixtureStats: () => {
            workspace: number;
            referenceLoads: number;
          };
        }
      ).pluginFixtureStats(),
    );
  await expect(
    page.getByRole("treeitem", { name: "A report.txt" }),
  ).toBeVisible();
  expect((await stats()).referenceLoads).toBe(0);
  await expect(page.getByTestId("plugin-states")).toContainText(
    "sample.notes: registered",
  );
  await page.getByRole("treeitem", { name: "A report.txt" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Verified report for task A.")).toBeVisible();
  await page.getByRole("button", { name: "Open from plugin" }).nth(1).click();
  await expect(page.getByTestId("active-task")).toHaveText("B");
  await expect(page.getByText("Verified report for task A.")).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "A report.txt", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Open from plugin" }).nth(0).click();
  await expect(
    page.getByRole("tab", { name: "A report.txt", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "A report.txt", exact: true }).click();
  await expect(page.getByText("Verified report for task A.")).toBeVisible();
  const loads = (await stats()).referenceLoads;
  for (let index = 0; index < 3; index++) {
    await page.getByRole("tab", { name: "Notes", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Notes extension" }),
    ).toBeVisible();
    await expect.poll(async () => (await stats()).workspace).toBe(0);
    expect((await stats()).referenceLoads).toBe(loads);
    await page
      .getByRole("tab", { name: "Task workspace", exact: true })
      .click();
    await expect(
      page.getByRole("tab", { name: "A report.txt", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Verified report for task A.")).toBeVisible();
    await expect.poll(async () => (await stats()).workspace).toBe(1);
  }
  await page
    .getByRole("button", { name: "Disable Notes", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Notes", exact: true }),
  ).toHaveCount(0);
  expect((await stats()).workspace).toBe(1);
});

test("workspace tree expansion and terminal follow survive task and panel roundtrips", async ({
  page,
}) => {
  await page.goto("?strict&long-output");
  const group = page.getByRole("treeitem", {
    name: "Unopened references",
    exact: true,
  });
  await group.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(group).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Open from plugin" }).nth(1).click();
  await expect(group).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Open from plugin" }).nth(0).click();
  await expect(group).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("tab", { name: "Terminal", exact: true }).click();
  const output = page.getByLabel("Read-only task output");
  await expect
    .poll(() =>
      output.evaluate((node) => node.scrollHeight > node.clientHeight),
    )
    .toBe(true);
  await output.evaluate((node) => {
    node.scrollTop = 0;
    node.dispatchEvent(new Event("scroll"));
  });
  await expect(
    page.getByRole("button", { name: "Follow latest output", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Notes", exact: true }).click();
  await page.getByRole("tab", { name: "Task workspace", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Follow latest output", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open from plugin" }).nth(1).click();
  await page.getByRole("button", { name: "Open from plugin" }).nth(0).click();
  await page.getByRole("tab", { name: "Terminal", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Follow latest output", exact: true }),
  ).toBeVisible();
  await expect(output).toContainText("Task A output");
  await expect(output).not.toContainText("Task B output");
});
test("keep-mounted views hide denied data and disable releases private subscriptions", async ({
  page,
}) => {
  await page.goto("?strict");
  await expect(
    page.getByRole("treeitem", { name: "A report.txt" }),
  ).toBeVisible();
  const subscriptions = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            pluginFixtureStats: () => { workspace: number };
          }
        ).pluginFixtureStats().workspace,
    );
  await page.getByLabel("Deny capabilities").check();
  await expect(
    page.getByRole("treeitem", { name: "A report.txt" }),
  ).toBeHidden();
  await expect.poll(subscriptions).toBe(0);
  await page.getByLabel("Deny capabilities").uncheck();
  await expect(
    page.getByRole("treeitem", { name: "A report.txt" }),
  ).toBeVisible();
  await expect.poll(subscriptions).toBe(1);
  await page.getByRole("treeitem", { name: "A report.txt" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("tab", { name: "A report.txt", exact: true }),
  ).toBeVisible();
  // Remove the App's explicit detail selection while retaining the panel's opened-tab cache.
  await page.getByRole("tab", { name: "Files", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "A report.txt", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Disable workspace plugin", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Task workspace", exact: true }),
  ).toHaveCount(0);
  await expect.poll(subscriptions).toBe(0);
  await page
    .getByRole("button", { name: "Enable workspace plugin", exact: true })
    .click();
  await page.getByRole("tab", { name: "Task workspace", exact: true }).click();
  await expect.poll(subscriptions).toBe(1);
  // Explicit disable ends the plugin instance, so its former layout is intentionally released.
  await expect(
    page.getByRole("tab", { name: "A report.txt", exact: true }),
  ).toHaveCount(0);
});

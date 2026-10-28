const { chromium } = require(
  process.env.FETS_PLAYWRIGHT_MODULE ||
    "/workspace/mobile-tools/node_modules/playwright",
);
const assert = require("node:assert/strict");
const base = process.env.FETS_SITES_PREVIEW_URL || "http://127.0.0.1:4194";
const out =
  process.env.FETS_SITES_PREVIEW_DIR || "/workspace/fets-sites-flex-preview";
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const results = [];
  try {
    for (const width of [1440, 768, 390, 320]) {
      const p = await browser.newPage({ viewport: { width, height: 1050 } }),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("dialog", (d) => d.accept());
      await p.goto(base);
      await p
        .getByRole("heading", { name: "FETS SITES", exact: true })
        .waitFor();
      await p
        .getByRole("button", { name: "General inventory", exact: true })
        .click();
      await p.getByRole("button", { name: "Add item", exact: true }).click();
      let d = p.getByRole("dialog");
      assert.equal(await d.locator("[required]").count(), 0);
      await d.getByLabel("Item name", { exact: true }).fill("Computers");
      await d.getByLabel("Quantity", { exact: true }).fill("12");
      await d.getByLabel("Category", { exact: true }).fill("IT");
      await d.getByRole("button", { name: "Save", exact: true }).click();
      await d.waitFor({ state: "hidden" });
      let card = p
        .locator(".am-record-card")
        .filter({
          has: p.getByRole("heading", { name: "Computers", exact: true }),
        });
      await card.waitFor();
      await card.getByRole("button", { name: "Edit", exact: true }).click();
      await d
        .getByRole("button", { name: "Clear answer: Quantity", exact: true })
        .click();
      await d.getByRole("button", { name: "Save", exact: true }).click();
      await d.waitFor({ state: "hidden" });
      assert.equal(
        await card.getByText("Quantity", { exact: true }).count(),
        0,
      );
      await p
        .getByRole("button", { name: "Edit questions", exact: true })
        .click();
      await d
        .getByRole("button", { name: "Remove Category", exact: true })
        .click();
      await d
        .getByRole("button", { name: "Restore Category", exact: true })
        .waitFor();
      await d
        .getByRole("button", { name: "Add question", exact: true })
        .click();
      await d.getByLabel("Question", { exact: true }).fill("Purchase date");
      await d.getByLabel("Answer type", { exact: true }).selectOption("date");
      await d
        .getByRole("button", { name: "Save question", exact: true })
        .click();
      await d
        .getByRole("button", { name: "Rename Purchase date", exact: true })
        .waitFor();
      await p.screenshot({ path: out + "/questions-" + width + ".png" });
      await d.getByRole("button", { name: "Done", exact: true }).click();
      await p.getByRole("button", { name: "Add item", exact: true }).click();
      assert.equal(await d.getByLabel("Category", { exact: true }).count(), 0);
      await d.getByLabel("Item name", { exact: true }).fill("AC");
      await d.getByLabel("Quantity", { exact: true }).fill("3");
      await d.getByLabel("Purchase date", { exact: true }).fill("2026-10-01");
      await p.evaluate(() => (window.failSave = true));
      await d.getByRole("button", { name: "Save", exact: true }).click();
      await d.getByRole("alert").waitFor();
      assert.equal(
        await d.getByLabel("Item name", { exact: true }).inputValue(),
        "AC",
      );
      await p.evaluate(() => (window.failSave = false));
      await d.getByRole("button", { name: "Save", exact: true }).click();
      await d.waitFor({ state: "hidden" });
      let ac = p
        .locator(".am-record-card")
        .filter({ has: p.getByRole("heading", { name: "AC", exact: true }) });
      await ac.getByText("2026-10-01", { exact: true }).waitFor();
      await p.screenshot({ path: out + "/inventory-" + width + ".png" });
      await ac.getByRole("button", { name: "Delete", exact: true }).click();
      await ac.waitFor({ state: "hidden" });
      await p.getByLabel("Show deleted items").check();
      ac = p
        .locator(".am-record-card")
        .filter({ has: p.getByRole("heading", { name: "AC", exact: true }) });
      await ac.getByRole("button", { name: "Restore", exact: true }).click();
      await ac.waitFor({ state: "hidden" });
      await p.getByLabel("Show deleted items").uncheck();
      await p.getByRole("heading", { name: "AC", exact: true }).waitFor();
      await p
        .getByRole("button", { name: "Edit questions", exact: true })
        .click();
      await d
        .getByRole("button", { name: "Remove Purchase date", exact: true })
        .click();
      await d
        .getByRole("button", { name: "Restore Purchase date", exact: true })
        .click();
      await d
        .getByRole("button", { name: "Remove Purchase date", exact: true })
        .waitFor();
      await d.getByRole("button", { name: "Done", exact: true }).click();
      await p.getByText("2026-10-01", { exact: true }).waitFor();
      await p
        .getByRole("navigation", { name: "Test centres" })
        .getByRole("button", { name: "Cochin", exact: true })
        .click();
      await p
        .getByRole("button", { name: "General inventory", exact: true })
        .click();
      assert.equal(
        await p.getByRole("heading", { name: "AC", exact: true }).count(),
        0,
      );
      await p.getByRole("button", { name: "Add item", exact: true }).click();
      await d.getByLabel("Category", { exact: true }).waitFor();
      assert.equal(
        await d.getByLabel("Purchase date", { exact: true }).count(),
        0,
      );
      await p.keyboard.press("Escape");
      await d.waitFor({ state: "hidden" });
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      assert.deepEqual(errors, []);
      results.push({
        width,
        optionalFields: true,
        inventoryCRUD: true,
        customQuestions: true,
        clearAnswer: true,
        restoreQuestion: true,
        centreIsolation: true,
        failedSaveRecovery: true,
        errors,
      });
      await p.close();
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

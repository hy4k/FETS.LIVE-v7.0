const { chromium } = require(
  process.env.FETS_PLAYWRIGHT_MODULE || "playwright",
);
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const b = await chromium.launch({
    headless: true,
    ...(process.env.FETS_CHROME_PATH
      ? { executablePath: process.env.FETS_CHROME_PATH }
      : {}),
    args: ["--no-sandbox"],
  });
  const base = process.env.FETS_AUDIT_URL || "http://127.0.0.1:3015",
    out = process.env.FETS_AUDIT_DIR || ".page-audit";
  fs.mkdirSync(out, { recursive: true });
  const results = [];
  try {
    for (const width of [1440, 393]) {
      const p = await b.newPage({ viewport: { width, height: 1050 } });
      p.setDefaultTimeout(10000);
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(base + "/shift?shift=1");
      await p
        .getByRole("heading", { name: "The Shift", exact: true })
        .waitFor();
      await p.getByRole("table").first().waitFor();
      await p.screenshot({ path: `${out}/team-${width}.png`, fullPage: true });
      assert.equal(
        await p
          .locator("body")
          .evaluate((el) => el.scrollWidth > window.innerWidth + 1),
        false,
      );
      for (const removed of [
        "Month planning",
        "Development review",
        "Blueprint",
      ])
        assert.equal(await p.getByText(removed, { exact: true }).count(), 0);
      await p
        .getByRole("button", { name: "My duty sheet", exact: true })
        .click();
      await p.getByRole("button", { name: /^Alex 06:00/ }).click();
      await p.getByRole("heading", { name: "Alex", exact: true }).waitFor();
      await p
        .getByRole("heading", { name: "Your opening tasks", exact: true })
        .waitFor();
      await p.screenshot({ path: `${out}/staff-${width}.png`, fullPage: true });
      await p
        .getByRole("button", { name: "Walk & DVR log", exact: true })
        .click();
      await p
        .getByRole("heading", { name: "Walk & DVR log", exact: true })
        .waitFor();
      await p.getByRole("link", { name: /Open Lab/ }).waitFor();
      await p.screenshot({
        path: `${out}/checks-${width}.png`,
        fullPage: true,
      });
      await p
        .getByRole("button", { name: "Edit day plan", exact: true })
        .click();
      await p
        .getByRole("heading", { name: "Amend the day plan", exact: true })
        .waitFor();
      const context = p.getByLabel("Client / programme context");
      await context.fill("Unsaved daily change");
      await p
        .getByRole("button", { name: "Refresh Shift", exact: true })
        .click();
      await p.waitForTimeout(500);
      assert.equal(await context.inputValue(), "Unsaved daily change");
      await p.screenshot({
        path: `${out}/planner-${width}.png`,
        fullPage: true,
      });
      await p
        .getByRole("button", { name: "Cancel editing", exact: true })
        .click();
      await p.getByRole("button", { name: "Next day", exact: true }).click();
      await p
        .getByRole("heading", {
          name: "No duty plan for this day",
          exact: true,
        })
        .waitFor();
      await p
        .getByRole("button", { name: "Create day plan", exact: true })
        .click();
      await p
        .getByRole("heading", { name: "Plan the day", exact: true })
        .waitFor();
      assert.equal(await p.locator(".sv-editor-person").count(), 0);
      assert.equal(
        await p.getByLabel("Client / programme context").inputValue(),
        "",
      );
      assert.deepEqual(errors, []);
      results.push({
        width,
        team: true,
        personalSheet: true,
        sharedChecks: true,
        draftRetained: true,
        noFixedNextDayPattern: true,
        errors,
      });
      await p.close();
    }
  } finally {
    await b.close();
  }
  console.log(JSON.stringify(results));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

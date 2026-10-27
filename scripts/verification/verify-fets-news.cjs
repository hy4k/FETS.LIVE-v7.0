// Read-only full application preview. All news, people and source text are fictional.
const { chromium } = require(
  process.env.FETS_PLAYWRIGHT_MODULE || "playwright",
);
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.FETS_CHROME_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const base = process.env.FETS_AUDIT_URL || "http://127.0.0.1:3019",
    out = process.env.FETS_AUDIT_DIR || "/tmp/fets-news-preview";
  fs.mkdirSync(out, { recursive: true });
  const results = [];
  try {
    for (const width of [1440, 393, 320]) {
      const p = await browser.newPage({ viewport: { width, height: 1050 } });
      p.setDefaultTimeout(10000);
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(base + "/news-manager?news=1");
      await p.getByRole("heading", { name: "FETS News." }).waitFor();
      await p
        .getByRole("button", { name: "Updated pre-session checklist" })
        .waitFor();
      assert.equal(await p.getByText(/PRIVATE SOURCE/).count(), 0);
      await p.screenshot({ path: `${out}/feed-${width}.png`, fullPage: true });
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      await p.getByRole("button", { name: /Review inbox · 1/ }).click();
      await p
        .getByRole("button", { name: /Client briefing ready for review/ })
        .click();
      await p.getByRole("heading", { name: "Original source" }).waitFor();
      await p.getByText(/PRIVATE SOURCE/).waitFor();
      const title = p.getByLabel("Title", { exact: true });
      await title.fill("Unsaved edited briefing");
      assert.equal(
        await p.getByRole("button", { name: "Approve & publish" }).isEnabled(),
        false,
      );
      await p.getByRole("button", { name: "Refresh news" }).click();
      await p.waitForTimeout(300);
      assert.equal(await title.inputValue(), "Unsaved edited briefing");
      await p.screenshot({
        path: `${out}/review-${width}.png`,
        fullPage: true,
      });
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      await p.getByRole("button", { name: "Collection", exact: true }).click();
      await p.getByRole("heading", { name: "Collection & sources" }).waitFor();
      await p.screenshot({
        path: `${out}/sources-${width}.png`,
        fullPage: true,
      });
      await p.goto(base + "/news-manager?news=1&staff-news=1");
      await p
        .getByRole("button", { name: "Updated pre-session checklist" })
        .waitFor();
      assert.equal(
        await p.getByRole("button", { name: /Review inbox/ }).count(),
        0,
      );
      await p
        .getByRole("button", { name: "Updated pre-session checklist" })
        .click();
      await p
        .getByRole("button", { name: "I have read this update" })
        .waitFor();
      assert.equal(
        await p.getByRole("heading", { name: "Original source" }).count(),
        0,
      );
      assert.equal(await p.getByText(/PRIVATE SOURCE/).count(), 0);
      await p.screenshot({ path: `${out}/staff-${width}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      results.push({
        width,
        bodyOverflow: false,
        privateReview: true,
        approvalOnly: true,
        unsavedDraftRetained: true,
        staffSeesNoEmail: true,
        errors,
      });
      await p.close();
    }
    console.log(JSON.stringify(results));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

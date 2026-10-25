const { chromium } = require(
  process.env.FETS_PLAYWRIGHT_MODULE || "playwright",
);
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const b = await chromium.launch({
    headless: true,
    executablePath: process.env.FETS_CHROME_PATH,
    args: ["--no-sandbox"],
  });
  const base = process.env.FETS_AUDIT_URL || "http://127.0.0.1:3017";
  const out = process.env.FETS_AUDIT_DIR || ".page-audit";
  fs.mkdirSync(out, { recursive: true });
  const results = [];
  try {
    for (const width of [1440, 393]) {
      const p = await b.newPage({ viewport: { width, height: 1000 } });
      p.setDefaultTimeout(8000);
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(base);
      const home = p.locator("main").first();
      await home
        .getByRole("heading", { name: "Fets Space", exact: true })
        .waitFor();
      for (const text of [
        "Scheduled candidates",
        "Handovers to acknowledge",
        "Today’s roster",
        "Raise a case",
        "Quick access",
        "Help desk",
      ])
        assert.equal(await home.getByText(text, { exact: true }).count(), 0);
      await p.screenshot({ path: `${out}/home-${width}.png`, fullPage: true });
      await p.getByRole("button", { name: "All tools", exact: true }).click();
      const menu = p.getByRole("dialog", { name: "Workspace", exact: true });
      for (const text of [
        "FETS SITES",
        "TEAM SPACE",
        "FETS NEWS",
        "FETS SPACE",
        "Raise a case",
        "F-Vault / Access Hub",
      ])
        assert.equal(
          await menu.getByRole("button", { name: new RegExp(text) }).count(),
          0,
        );
      await p.keyboard.press("Escape");
      for (const [label, title] of [
        ["FETS SITES", "FETS SITES"],
        ["TEAM SPACE", "Team space"],
        ["FETS NEWS", "FETS NEWS"],
        ["FETS SPACE", "FETS SPACE"],
      ]) {
        await p.getByRole("button", { name: "FETS LIVE home" }).click();
        console.log("Opening", width, label);
        await p.getByRole("button", { name: new RegExp("^" + label) }).click();
        await p.waitForTimeout(500);
        assert(
          !/This page could not be displayed/.test(
            await p.locator("body").innerText(),
          ),
        );
        if (label !== "TEAM SPACE")
          await p
            .getByRole("heading", { name: new RegExp(title, "i") })
            .first()
            .waitFor();
        await p.reload();
        await p.waitForTimeout(600);
        assert(
          !/This page could not be displayed/.test(
            await p.locator("body").innerText(),
          ),
        );
      }
      await p.goto(base + "/my-desk");
      await p
        .getByRole("heading", { name: "Support & access", exact: true })
        .waitFor();
      await p.screenshot({ path: `${out}/desk-${width}.png`, fullPage: true });
      for (const label of [
        "Raise a case",
        "Quick access",
        "Help desk",
        "F-Vault / Access Hub",
      ])
        assert.equal(
          await p.getByRole("button", { name: new RegExp(label) }).count(),
          1,
        );
      await p.getByRole("button", { name: /Raise a case/ }).click();
      await p.waitForTimeout(500);
      assert.equal(new URL(p.url()).pathname, "/incident-log");
      await p.goto(base + "/my-desk");
      await p.getByRole("button", { name: /F-Vault/ }).click();
      await p.waitForTimeout(500);
      assert.equal(new URL(p.url()).pathname, "/access-hub");
      assert.deepEqual(errors, []);
      results.push({
        width,
        homeCards: true,
        noDuplicates: true,
        homeRoutes: true,
        deskTools: true,
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

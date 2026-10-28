// Full app, isolated fixtures only. Never submit production applications or credentials.
const { chromium } = require(
  process.env.FETS_PLAYWRIGHT_MODULE || "playwright",
);
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.FETS_AUDIT_URL || "http://127.0.0.1:4188";
const out = process.env.FETS_AUDIT_DIR || "/workspace/my-desk-audit";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.FETS_CHROME_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const checks = [];
  try {
    for (const width of [1440, 768, 390, 320]) {
      const page = await browser.newPage({
          viewport: { width, height: 1050 },
          reducedMotion: width === 320 ? "reduce" : "no-preference",
        }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + "/?landing=1");
      await page
        .getByRole("button", { name: /^My Desk/ })
        .first()
        .click();
      const name = page.getByRole("heading", {
        name: "Example Administrator",
        exact: true,
      });
      await name.waitFor();
      assert.equal(
        await page.locator(".main-scroll").evaluate((el) => el.scrollTop),
        0,
      );
      assert.equal(
        await page.getByText("Joining date not added", { exact: true }).count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("button", {
            name: /Start focus|Checklist|Find your focus|Better together|Team round/i,
          })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("button", { name: /^Raise a case|^F Vault|^Quick access/ })
          .count(),
        0,
      );
      await page
        .getByRole("heading", { name: "Work & time off", exact: true })
        .waitFor();
      await page.getByText("Weekly hours", { exact: true }).waitFor();
      assert.equal(
        await page
          .getByRole("button", {
            name: /History & approvals|Shift swap|Half-day leave/,
          })
          .count(),
        0,
      );
      await page
        .getByRole("button", {
          name:
            "1 " +
            new Date().toLocaleDateString("en-IN", {
              month: "short",
              timeZone: "Asia/Kolkata",
            }) +
            ": Completed work",
          exact: true,
        })
        .click();
      await page
        .getByLabel("Selected day details")
        .getByText("6:00 AM – 3:00 PM", { exact: true })
        .waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      await page.screenshot({ path: `${out}/my-desk-${width}.png` });
      await page
        .getByRole("button", { name: "Applications", exact: true })
        .click();
      for (const [label, text] of [
        ["Half-day leave", "Which half are you requesting off?"],
        ["Shift swap", "Your Date"],
        ["TOIL day off", "Day off (TOIL)"],
        ["Leave", "Leave Type"],
      ]) {
        await page
          .getByRole("button", { name: new RegExp("^" + label) })
          .click();
        await page.getByText(text).first().waitFor();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
        );
        if (label === "Half-day leave")
          await page.screenshot({ path: `${out}/half-day-${width}.png` });
        await page
          .getByRole("button", { name: "Back to applications", exact: true })
          .click();
      }
      await page
        .getByRole("button", { name: "History & approvals", exact: true })
        .click();
      await page
        .getByRole("button", { name: "My Requests", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Applications Inbox", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Back to applications", exact: true })
        .click();
      await page
        .getByRole("button", { name: "FETS LIVE home", exact: true })
        .click();
      await page.getByRole("button", { name: /^Raise a case/ }).click();
      assert.equal(new URL(page.url()).pathname, "/incident-log");
      await page
        .getByRole("button", { name: "Custom Incident", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "RAISE CUSTOM CASE", exact: true })
        .waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      await page
        .getByRole("button", { name: "Close case form", exact: true })
        .click();
      await page
        .getByRole("button", { name: "FETS LIVE home", exact: true })
        .click();
      await page.getByRole("button", { name: /^F Vault/ }).click();
      await page
        .getByRole("heading", { name: "F Vault", exact: true })
        .waitFor();
      await page.getByRole("button", { name: /Example staff portal/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      assert.equal(
        await dialog.getByText("training-sample-only", { exact: true }).count(),
        0,
      );
      await dialog
        .getByRole("button", { name: "Show Password", exact: true })
        .click();
      await dialog.getByText("training-sample-only", { exact: true }).waitFor();
      for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
      assert.equal(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
        true,
      );
      await page.screenshot({ path: `${out}/vault-${width}.png` });
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").count(), 0);
      await page
        .getByRole("button", { name: "FETS LIVE home", exact: true })
        .click();
      assert.equal(
        await page.getByRole("button", { name: "Find your focus" }).count(),
        0,
      );
      assert.deepEqual(errors, []);
      checks.push({
        width,
        noOverflow: true,
        identityVisible: true,
        directRequests: 4,
        requestHistory: true,
        caseAndVaultOnHome: true,
        privateDialog: true,
        errors,
      });
      await page.close();
    }
    console.log(JSON.stringify(checks, null, 2));
    fs.writeFileSync(
      out + "/verification.json",
      JSON.stringify(checks, null, 2),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

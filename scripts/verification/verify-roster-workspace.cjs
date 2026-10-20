const { chromium } = require(
  process.env.FETS_PLAYWRIGHT_MODULE || "playwright",
);
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const out =
    process.env.FETS_PREVIEW_OUTPUT || "/workspace/fets-roster-preview";
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const results = [];
  for (const width of [1440, 393, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
    });
    await context.route("**/*", (r) =>
      new URL(r.request().url()).hostname === "127.0.0.1"
        ? r.continue()
        : r.abort(),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:3015/Roster-Interactive-Preview.html");
    await page.getByRole("table").waitFor();
    const shot = async (name) => {
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Overflow ${name} ${width}`,
      );
      await page.screenshot({
        path: `${out}/${name}-${width}.png`,
        fullPage: true,
      });
    };
    await shot("schedule");
    assert.equal(
      await page.getByText("On the roster today", { exact: true }).count(),
      0,
    );
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await page.getByRole("table").waitFor();
    await page
      .getByRole("button", { name: "Shift types", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "6 AM–3 PM", exact: true })
      .click();
    assert.equal(
      await dialog.getByLabel("Start time", { exact: true }).inputValue(),
      "06:00",
    );
    await shot("shift-types");
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("button", { name: /Maya Joseph, 20 Oct,/ }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Roster type", { exact: true }).selectOption("HD");
    assert.equal(
      await dialog.getByLabel("End time", { exact: true }).inputValue(),
      "10:30",
    );
    await dialog
      .getByRole("button", { name: "Second half", exact: true })
      .click();
    assert.equal(
      await dialog.getByLabel("Start time", { exact: true }).inputValue(),
      "10:30",
    );
    assert.equal(
      await dialog.getByLabel("End time", { exact: true }).inputValue(),
      "15:00",
    );
    await shot("half-day");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Quick Add", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("From", { exact: true }).fill("2026-11-01");
    await dialog.getByLabel("Through", { exact: true }).fill("2026-11-15");
    await dialog.getByLabel("Roster type", { exact: true }).selectOption("L");
    await dialog
      .getByRole("button", { name: "Review dates", exact: true })
      .click();
    await dialog
      .getByText("15 dates to save · 0 existing entries kept", { exact: true })
      .waitFor();
    await shot("continuous-leave");
    await page.evaluate(() => window.rosterPreview.failNextSave());
    await dialog
      .getByRole("button", { name: "Save 15 dates", exact: true })
      .click();
    await dialog.getByRole("alert").waitFor();
    assert.equal(
      await dialog.getByLabel("From", { exact: true }).inputValue(),
      "2026-11-01",
    );
    assert.equal(
      await page.evaluate(
        () =>
          window.rosterPreview.data.schedules.filter((r) =>
            r.date.startsWith("2026-11"),
          ).length,
      ),
      0,
    );
    await dialog
      .getByRole("button", { name: "Review dates", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Save 15 dates", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(
      await page.evaluate(
        () =>
          window.rosterPreview.data.schedules.filter(
            (r) => r.date.startsWith("2026-11") && r.shift_code === "L",
          ).length,
      ),
      15,
    );
    await page.getByRole("button", { name: "Attendance", exact: true }).click();
    await page
      .getByRole("heading", { name: "Daily attendance", exact: true })
      .waitFor();
    await shot("attendance");
    await page
      .getByRole("button", { name: "Monthly overview", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Attendance overview", exact: true })
      .waitFor();
    await shot("overview");
    await page
      .getByRole("button", { name: "View Sara Thomas attendance", exact: true })
      .click();
    await page
      .getByText("Missing check-out", { exact: true })
      .first()
      .waitFor();
    await shot("staff-detail");
    await page.evaluate(() => window.rosterPreview.failLoad(true));
    await page
      .getByRole("button", { name: "Refresh roster", exact: true })
      .click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByRole("table").count(), 0);
    await shot("offline");
    assert.deepEqual(errors, []);
    results.push({
      width,
      errors,
      overflow: false,
      customShift: true,
      halfDay: true,
      continuousLeave15: true,
      atomicFailure: true,
      missingCheckout: true,
      offlineBlocked: true,
    });
    await context.close();
  }
  const staff = await browser.newPage();
  await staff.goto(
    "http://127.0.0.1:3015/Roster-Interactive-Preview.html?role=staff",
  );
  await staff.getByRole("table").waitFor();
  assert.equal(
    await staff.getByRole("button", { name: "Quick Add", exact: true }).count(),
    0,
  );
  assert.equal(
    await staff
      .getByRole("button", { name: "Shift types", exact: true })
      .count(),
    0,
  );
  assert.ok(
    await staff
      .getByRole("button", { name: /Maya Joseph, 20 Oct,/ })
      .isDisabled(),
  );
  await browser.close();
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

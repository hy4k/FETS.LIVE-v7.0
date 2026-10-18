// Only the isolated local preview is exercised. All external requests are blocked.
const { chromium } = require(
  process.env.FETS_PLAYWRIGHT_MODULE || "playwright",
);
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const out = process.env.FETS_PREVIEW_OUTPUT || "/tmp/fets-simple-shift";
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const results = [];
  for (const width of [1440, 768, 393, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width > 800 ? 1000 : 852 },
    });
    await context.route("**/*", (r) =>
      new URL(r.request().url()).hostname === "127.0.0.1"
        ? r.continue()
        : r.abort(),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const overflow = async (label) => {
      const size = await page.evaluate(() => ({
        viewport: innerWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(
        size.body <= size.viewport,
        `${label} overflow at ${width}: ${JSON.stringify(size)}`,
      );
    };
    const shot = async (name) => {
      console.log(width, name);
      await overflow(name);
      await page.screenshot({
        path: path.join(out, `${name}-${width}.png`),
        fullPage: true,
      });
    };
    await page.goto("http://127.0.0.1:3012/shift-preview.html");
    await page
      .getByRole("region", { name: "My timetable", exact: true })
      .waitFor();
    const openDuty = async (title) => {
      const summary = page
        .locator(".st-task-detail > summary")
        .filter({
          has: page.getByRole("heading", { name: title, exact: true }),
        });
      if (!((await summary.locator("..").getAttribute("open")) !== null))
        await summary.click();
    };
    const times = await page
      .locator(".st-entry")
      .evaluateAll((rows) => rows.map((r) => Number(r.dataset.time)));
    assert.deepEqual(
      times,
      [...times].sort((a, b) => a - b),
    );
    await shot("staff");
    await openDuty("Prepare the exam lab");
    const lab = page.getByRole("article", { name: "Prepare the exam lab" });
    await lab.getByText("Done means", { exact: true }).waitFor();
    assert.equal(
      await lab
        .getByRole("button", { name: "Finish duty", exact: true })
        .count(),
      0,
    );
    assert.equal(await page.locator(".st-task").count(), 3);
    await lab.getByRole("button", { name: "Start duty", exact: true }).click();
    await lab.getByRole("button", { name: "Finish duty", exact: true }).click();
    assert.ok(
      await lab
        .getByRole("button", { name: "Send for review", exact: true })
        .isDisabled(),
    );
    await lab
      .getByLabel("What did you complete?")
      .fill("All active stations checked; a faulty headset replaced.");
    await shot("finish");
    await lab
      .getByRole("button", { name: "Send for review", exact: true })
      .click();
    await page
      .getByText("Result submitted. An independent reviewer will check it.", {
        exact: true,
      })
      .waitFor();
    await lab
      .getByText("Sent for review. Another lead will check your result.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await lab
        .getByRole("button", { name: "Verify result", exact: true })
        .count(),
      0,
    );
    await openDuty("Call tomorrow’s candidates");
    const calls = page.getByRole("article", {
      name: "Call tomorrow’s candidates",
    });
    await calls.getByRole("button", { name: "Need help", exact: true }).click();
    await calls
      .getByLabel("What is stopping you, and what would help?")
      .fill(
        "Please confirm the joining instructions before I make these calls.",
      );
    assert.ok(
      await calls
        .getByRole("button", { name: "Ask the lead for help", exact: true })
        .isDisabled(),
    );
    await calls.getByLabel("Help needed").selectOption("clarity");
    await calls
      .getByRole("button", { name: "Ask the lead for help", exact: true })
      .click();
    await calls
      .getByText("I need clearer instructions", { exact: true })
      .waitFor();
    await shot("help");
    await page.getByLabel("Preview role").selectOption("manager");
    await page
      .getByRole("region", { name: "Team timetable", exact: true })
      .waitFor();
    await openDuty("Prepare the exam lab");
    assert.ok(
      (await page
        .getByRole("article", { name: "Prepare the exam lab" })
        .getByRole("button", { name: "Verify result", exact: true })
        .count()) === 1,
    );
    await shot("team");
    await page
      .getByRole("article", { name: "Prepare the exam lab" })
      .getByRole("button", { name: "Verify result", exact: true })
      .click();
    await page.getByText("Work verified.", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Assign a duty", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Assign a duty" });
    await dialog.waitFor();
    assert.equal(
      await dialog
        .getByLabel("Duty", { exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await shot("assignment");
    await page.keyboard.press("Escape");
    assert.equal(await dialog.count(), 0);
    await page.getByRole("button", { name: "People", exact: true }).click();
    await page.getByLabel("Colleague").selectOption("p1");
    await page.getByText("Feedback & follow-up", { exact: true }).waitFor();
    await shot("people");
    await page
      .getByRole("button", { name: "Add feedback", exact: true })
      .click();
    await page.getByLabel("Next step").selectOption("warning");
    await page
      .getByLabel("Observed work & evidence")
      .fill("Specific observed work to review.");
    await page
      .getByLabel("Agreed action, support or recognition")
      .fill("Agree focused training with the lead.");
    await page.getByLabel("Follow up on").fill("2026-10-22");
    assert.ok(
      await page
        .getByRole("button", { name: "Save feedback & follow-up", exact: true })
        .isDisabled(),
    );
    await shot("feedback");
    await page.getByLabel("Preview role").selectOption("cover");
    await page.getByLabel("Preview time").selectOption("10:07");
    await page
      .getByRole("region", { name: "My timetable", exact: true })
      .getByRole("button", { name: /Record DVR check.*10:06/ })
      .waitFor();
    await shot("break-cover");
    await page.getByRole("button", { name: /Record DVR check.*10:06/ }).click();
    await page
      .getByText("Check recorded at the current time.", { exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: /Record DVR check.*10:06/ })
        .count(),
      0,
    );
    await page.getByLabel("Preview role").selectOption("lead");
    await page.getByRole("button", { name: "Plan", exact: true }).click();
    await page
      .getByRole("button", { name: "Daily coverage", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Regular duties", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Regular duties", exact: true })
      .waitFor();
    await shot("regular-duties");
    await page.getByLabel("Preview time").selectOption("17:10");
    await page.getByRole("button", { name: "Report", exact: true }).click();
    await page
      .getByRole("heading", { name: "Day report", exact: true })
      .waitFor();
    await shot("report");
    await page
      .getByRole("button", { name: "Use today’s records", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Send to super admin", exact: true })
      .click();
    await page
      .getByRole("heading", {
        name: "Report sent for 2026-10-19.",
        exact: true,
      })
      .waitFor();
    await page.getByRole("button", { name: "My shift", exact: true }).click();
    await page
      .getByText(
        "Report sent. This day is closed; its records are available to read.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await page
        .locator(".sw-duty-card .sw-work-actions button:enabled")
        .count(),
      0,
    );
    assert.deepEqual(errors, []);
    results.push({
      width,
      errors,
      journeys: [
        "chronological timetable, expandable work and named cover",
        "start/finish/result",
        "independent verification",
        "specific help request",
        "team attention",
        "assignment keyboard focus",
        "private management feedback",
        "warning context requirement",
        "named break cover checkpoint",
        "regular duties",
        "report",
      ],
    });
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

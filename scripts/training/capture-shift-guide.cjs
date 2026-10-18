// Screenshot the isolated training preview. Never connects to production.
const { chromium } = require(
  process.env.FETS_PLAYWRIGHT_MODULE || "playwright",
);
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const out = process.env.FETS_GUIDE_OUTPUT || "/tmp/fets-shift-staff-guide";
fs.mkdirSync(path.join(out, "screenshots"), { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1050 },
    deviceScaleFactor: 2,
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
  const records = {};
  async function load(role = "staff", time = "09:37") {
    await page.goto("http://127.0.0.1:3012/shift-preview.html");
    await page.getByLabel("Preview role").selectOption(role);
    await page.getByLabel("Preview time").selectOption(time);
    await page.locator(".st-board").waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.ok(
      await page.evaluate(() => document.fonts.check("600 14px Manrope")),
    );
  }
  async function openDuty(title = "Prepare the exam lab") {
    const summary = page
      .locator(".st-task-detail > summary")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    if ((await summary.locator("..").getAttribute("open")) === null)
      await summary.click();
    return summary.locator("..");
  }
  async function capture(id, locator, marks = [], clip = null) {
    if (locator) await locator.scrollIntoViewIfNeeded();
    else await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(100);
    const box = clip || (await locator.boundingBox());
    const points = [];
    for (const mark of marks) {
      const b = await mark.boundingBox();
      assert.ok(b, "Missing mark " + id);
      const point = {
        n: points.length + 1,
        x: b.x - box.x,
        y: b.y - box.y,
        w: b.width,
        h: b.height,
      };
      assert.ok(
        point.x >= -1 &&
          point.y >= -1 &&
          point.x + point.w <= box.width + 1 &&
          point.y + point.h <= box.height + 1,
        "Mark outside " + id + JSON.stringify(point),
      );
      points.push(point);
    }
    if (clip)
      await page.screenshot({
        path: path.join(out, "screenshots", id + ".png"),
        clip,
      });
    else
      await locator.screenshot({
        path: path.join(out, "screenshots", id + ".png"),
      });
    records[id] = { width: box.width, height: box.height, points };
    console.log("Captured", id);
  }
  await load();
  await capture(
    "open",
    null,
    [
      page.locator(".preview-nav .active"),
      page.getByLabel("Working day"),
      page.getByRole("button", { name: "My shift", exact: true }),
    ],
    { x: 0, y: 48, width: 1280, height: 780 },
  );
  await capture(
    "timetable",
    null,
    [
      page.getByRole("button", { name: "Jump to current post" }),
      page.locator(".st-entry.is-current"),
      page.locator(".st-task").first().locator(".st-task-detail > summary"),
    ],
    { x: 65, y: 320, width: 1150, height: 650 },
  );
  let duty = await openDuty();
  await duty.locator(".sw-instructions summary").click();
  await capture("start", duty, [
    duty.locator(".sw-result"),
    duty.getByRole("button", { name: "Start duty", exact: true }),
    duty.getByRole("button", { name: "Need help", exact: true }),
  ]);
  await duty.getByRole("button", { name: "Need help", exact: true }).click();
  await duty
    .getByLabel("What is stopping you, and what would help?")
    .fill(
      "A headset is faulty. I need a replacement before this station is ready.",
    );
  await duty.getByLabel("Help needed").selectOption("equipment");
  await capture("help", duty.locator(".sw-action-form"), [
    duty.getByLabel("What is stopping you, and what would help?"),
    duty.getByLabel("Help needed"),
    duty.getByRole("button", { name: "Ask the lead for help", exact: true }),
  ]);
  await load();
  duty = await openDuty();
  await duty.getByRole("button", { name: "Start duty", exact: true }).click();
  await duty.getByRole("button", { name: "Finish duty", exact: true }).click();
  await duty
    .getByLabel("What did you complete?")
    .fill(
      "All active stations checked. Replaced the faulty headset and confirmed it works. The lab is ready.",
    );
  await capture("finish", duty.locator(".sw-action-form"), [
    duty.getByLabel("What did you complete?"),
    duty.getByRole("button", { name: "Send for review", exact: true }),
  ]);
  await duty
    .getByRole("button", { name: "Send for review", exact: true })
    .click();
  await page
    .getByText("Result submitted. An independent reviewer will check it.", {
      exact: true,
    })
    .waitFor();
  await capture("submitted", duty, [
    duty.locator(".sw-state").first(),
    duty.locator(".sw-proof"),
    duty.getByText("Sent for review. Another lead will check your result.", {
      exact: true,
    }),
  ]);
  await page.getByLabel("Preview role").selectOption("lead");
  await page.getByRole("button", { name: "Team", exact: true }).click();
  duty = await openDuty();
  await capture("review", duty, [
    duty.locator(".sw-proof"),
    duty.getByRole("button", { name: "Verify result", exact: true }),
    duty.getByRole("button", { name: "Return with feedback", exact: true }),
  ]);
  await duty
    .getByRole("button", { name: "Return with feedback", exact: true })
    .click();
  await duty
    .getByLabel("What needs to change to meet the agreed result?")
    .fill(
      "Please add the station number and confirm the replacement headset passed the audio test.",
    );
  await duty
    .getByRole("button", { name: "Save decision", exact: true })
    .click();
  await page.getByLabel("Preview role").selectOption("staff");
  duty = await openDuty();
  await capture("returned", duty, [
    duty.locator(".sw-feedback"),
    duty.getByRole("button", { name: "Finish duty", exact: true }),
  ]);
  await load("staff", "08:17");
  await capture("walk", page.locator(".st-entry.is-current"), [
    page.locator(".st-entry.is-current .st-post-copy"),
    page.getByRole("button", { name: /Record lab walk.*08:10/ }),
  ]);
  await load("staff", "11:07");
  await capture("dvr", page.locator(".st-entry.is-current"), [
    page.locator(".st-entry.is-current .st-post-copy"),
    page.getByRole("button", { name: /Record DVR check.*11:06/ }),
  ]);
  await load("staff", "10:37");
  await capture("break", page.locator(".st-entry.is-current"), [
    page.locator(".st-entry.is-current .st-time"),
    page.locator(".st-entry.is-current .st-post-copy"),
  ]);
  await page.getByRole("button", { name: "Team", exact: true }).click();
  await capture("team", page.locator(".st-entry.is-current"), [
    page.locator(".st-entry.is-current .st-lanes"),
    page.locator(".st-entry.is-current .st-break-note"),
  ]);
  await load();
  await page.getByRole("button", { name: "My feedback", exact: true }).click();
  const feedback = page.locator(".sw-feedback-record").first();
  await feedback
    .locator("textarea")
    .fill(
      "I would like a walkthrough of the equipment store before my next shift.",
    );
  await capture("feedback", feedback, [
    feedback.locator("textarea"),
    feedback.getByRole("button", { name: "Save my response", exact: true }),
  ]);
  await load("staff", "11:07");
  await page
    .getByRole("button", { name: "Open handovers", exact: true })
    .click();
  const rotation = page.locator(".sw-rotation").first();
  await rotation.locator(".sw-rotation-heading").click();
  await rotation
    .getByLabel("Handover result or feedback")
    .fill(
      "The post is handed over. One printer fault remains open; the lead has the details and the next owner.",
    );
  await capture("handover", rotation, [
    rotation.locator(".sw-rotation-heading"),
    rotation.getByLabel("Handover result or feedback"),
    rotation.getByRole("button", { name: "Submit handover", exact: true }),
  ]);
  await load("lead", "17:10");
  await page.getByRole("button", { name: "Report", exact: true }).click();
  await page
    .getByRole("button", { name: "Use today’s records", exact: true })
    .click();
  await capture("report", page.locator(".ts-compose"), [
    page.getByRole("button", { name: "Use today’s records", exact: true }),
    page.getByLabel("Carry into tomorrow"),
    page.getByRole("button", { name: "Send to super admin", exact: true }),
  ]);
  await page.setViewportSize({ width: 393, height: 1050 });
  await load();
  await capture(
    "phone",
    null,
    [
      page.getByRole("button", { name: "Jump to current post" }),
      page.locator(".st-task").first().locator(".st-task-detail > summary"),
    ],
    { x: 0, y: 135, width: 393, height: 900 },
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(out, "screenshots", "metadata.json"),
    JSON.stringify({ records, errors, trainingOnly: true }, null, 2),
  );
  await browser.close();
  console.log("Captured", Object.keys(records).length, "screenshots");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

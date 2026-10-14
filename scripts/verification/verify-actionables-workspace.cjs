// All browser mutations are against the in-memory preview repository.
const { chromium } = require(
  process.env.FETS_PLAYWRIGHT_MODULE || "playwright",
);
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const out =
    process.env.FETS_PREVIEW_OUTPUT || "/tmp/fets-actionables-preview";
  fs.mkdirSync(out, { recursive: true });
  const results = [];
  for (const width of [1440, 768, 393, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width > 1000 ? 1040 : 900 },
      deviceScaleFactor: 1,
    });
    await context.route("https://*.supabase.co/**", (r) => r.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const check = async (view) => {
      const sizes = await page.evaluate(() => ({
        width: innerWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(
        sizes.body <= width,
        `${view} overflow at ${width}: ${sizes.body}`,
      );
    };
    await page.goto("http://127.0.0.1:3011/actionables-preview.html");
    await page.getByText("25 institutions", { exact: true }).waitFor();
    await check("overview");
    await page.screenshot({
      path: `${out}/overview-${width}.png`,
      fullPage: width !== 1440,
    });
    await page
      .getByRole("button", { name: "Institutions", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Rajagiri College of Social Sciences",
        exact: true,
      })
      .waitFor();
    assert.equal(await page.locator(".aw-institution").count(), 25);
    await check("institutions");
    await page.screenshot({
      path: `${out}/institutions-${width}.png`,
      fullPage: width === 768,
    });
    await page.getByLabel("Search work and institutions").fill("682039");
    assert.equal(await page.locator(".aw-institution").count(), 1);
    await page.getByLabel("Search work and institutions").fill("");
    await page
      .getByRole("button", {
        name: "Rajagiri College of Social Sciences",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Add to shortlist", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Shortlisted · remove", exact: true })
      .waitFor();
    await check("institution work");
    await page
      .getByRole("button", { name: "Readiness & evidence", exact: true })
      .click();
    await page.getByText("Recorded readiness: 90%").waitFor();
    assert.equal(
      await page.getByText("No observation yet", { exact: true }).count(),
      10,
    );
    await check("readiness");
    await page.screenshot({
      path: `${out}/readiness-${width}.png`,
      fullPage: false,
    });
    await page
      .getByRole("button", { name: "Record observation", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Record readiness observation",
    });
    await dialog.waitFor();
    assert.equal(
      await dialog
        .getByLabel("Observed result")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await dialog.getByLabel("Observed result").selectOption("gap");
    await dialog
      .getByLabel("Observation / evidence")
      .fill(
        "Local verification only: record a site finding with enough detail for follow-up.",
      );
    await check("observation form");
    await dialog
      .getByRole("button", { name: "Record observation", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Assign follow-up", exact: true })
      .first()
      .waitFor();
    await page
      .getByRole("button", { name: "Assign follow-up", exact: true })
      .first()
      .click();
    await page.getByRole("dialog", { name: "Assign duty" }).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    await page
      .getByRole("button", { name: "Selected centres", exact: true })
      .click();
    await page.getByText("1 / 7 shortlisted", { exact: true }).waitFor();
    await check("rollout");
    await page.screenshot({
      path: `${out}/rollout-${width}.png`,
      fullPage: false,
    });
    await page
      .getByRole("button", { name: "Exam programmes", exact: true })
      .click();
    assert.equal(await page.locator(".aw-portfolio-groups li").count(), 15);
    await check("exam programmes");
    await page.getByRole("button", { name: "Audit", exact: true }).click();
    await page.getByLabel("Audit institution").selectOption("cochin-blastline");
    await page
      .getByRole("button", { name: "Record observation", exact: true })
      .first()
      .click();
    const fieldAudit = page.getByRole("dialog", {
      name: "Record readiness observation",
    });
    await fieldAudit.getByLabel("Observed result").selectOption("ready");
    await fieldAudit
      .getByLabel("Observation / evidence")
      .fill(
        "Local verification only: a separate selected institution receives this field finding.",
      );
    await fieldAudit
      .getByRole("button", { name: "Record observation", exact: true })
      .click();
    await fieldAudit.waitFor({ state: "hidden" });
    assert.equal(
      await page.getByLabel("Audit institution").inputValue(),
      "cochin-blastline",
    );
    await page
      .getByText(
        "Local verification only: a separate selected institution receives this field finding.",
      )
      .waitFor();
    await check("field audit without leaving its selected institution");
    await page.getByRole("button", { name: "Resources", exact: true }).click();
    await page
      .getByRole("heading", {
        name: "Contact resources",
        exact: true,
      })
      .waitFor();
    await check("guides");
    await page.screenshot({
      path: `${out}/guides-${width}.png`,
      fullPage: false,
    });
    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    await page
      .getByRole("button", { name: "Assign owner", exact: true })
      .first()
      .click();
    const duty = page.getByRole("dialog", { name: "Assign duty" });
    await duty.waitFor();
    await duty.getByLabel("Due date", { exact: true }).fill("2026-10-20");
    await duty
      .getByLabel("Who should receive the result?")
      .selectOption("preview-account");
    await check("duty form");
    await duty.getByRole("button", { name: "Save duty", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    await page
      .getByRole("button", { name: "Update result", exact: true })
      .last()
      .click();
    const result = page.getByRole("dialog", { name: "Update result" });
    await result.waitFor();
    await result
      .getByLabel("Result / what happened")
      .fill(
        "Local verification only: the next conversation and reporting action were recorded.",
      );
    await result.getByLabel("Duty status").selectOption("blocked");
    await check("result form");
    await result
      .getByRole("button", { name: "Save result", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page
      .getByText(
        "Local verification only: the next conversation and reporting action were recorded.",
      )
      .waitFor();
    await check("my work");
    await page.screenshot({
      path: `${out}/my-work-${width}.png`,
      fullPage: false,
    });
    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    await page.getByLabel("Filter work").selectOption("blocked");
    await check("team follow-up");
    // Preserve clean review screenshots using the unmodified actual source records.
    await page.goto("http://127.0.0.1:3011/actionables-preview.html");
    await page.getByText("25 institutions", { exact: true }).waitFor();
    await page.screenshot({
      path: `${out}/overview-clean-${width}.png`,
      fullPage: width === 1440,
    });
    await page
      .getByRole("button", { name: "Institutions", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Rajagiri College of Social Sciences",
        exact: true,
      })
      .waitFor();
    await page.screenshot({
      path: `${out}/institutions-clean-${width}.png`,
      fullPage: false,
    });
    assert.deepEqual(errors, []);
    results.push({
      width,
      overflow: false,
      browserErrors: errors,
      journeys: [
        "source catalogue and search",
        "shortlist decision",
        "readiness evidence",
        "gap follow-up",
        "duty assignment",
        "own work result",
        "team follow-up",
        "guides and scenario",
        "exam programmes",
        "shared field-audit selection",
      ],
    });
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(out + "/results.json", JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

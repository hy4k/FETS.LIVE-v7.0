const { chromium } = require("/workspace/mobile-tools/node_modules/playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const results = [];
  for (const width of [1440, 393]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:3017");
    await page.getByRole("heading", { name: "Ascender Manager" }).waitFor();
    assert.equal(
      await page
        .getByRole("navigation", { name: "Test centres" })
        .getByRole("button")
        .count(),
      3,
    );
    await page
      .getByRole("button", { name: "Edit details", exact: true })
      .click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Centre phone").fill("000 000 0000");
    await d.getByLabel("Responsible manager").selectOption("person");
    await d
      .getByLabel("Centre opening hours", { exact: true })
      .fill("08:00–17:00");
    await page.evaluate(() => (window.failSave = true));
    await d.getByRole("button", { name: "Save", exact: true }).click();
    await d.getByRole("alert").waitFor();
    assert.equal(
      await d.getByLabel("Centre phone").inputValue(),
      "000 000 0000",
    );
    await page.evaluate(() => (window.failSave = false));
    await d.getByRole("button", { name: "Save", exact: true }).click();
    await d.waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: "Open Roster", exact: true })
      .click();
    assert.deepEqual(await page.evaluate(() => window.lastNavigation), {
      page: "roster",
      branch: "calicut",
    });
    await page
      .getByRole("button", { name: "Rooms & programmes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add room / lab", exact: true })
      .click();
    await d.getByLabel("Room / lab name").fill("Example room");
    await d.getByLabel("Total seats", { exact: true }).fill("20");
    await d.getByLabel("Unavailable seats", { exact: true }).fill("21");
    await d.getByRole("button", { name: "Save", exact: true }).click();
    await d.getByRole("alert").waitFor();
    await d.getByLabel("Unavailable seats", { exact: true }).fill("2");
    await d.getByRole("button", { name: "Save", exact: true }).click();
    await d.waitFor({ state: "hidden" });
    await page
      .getByText("18 usable / 20 total seats", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Add exam programme", exact: true })
      .click();
    await d.getByLabel("Exam partner", { exact: false }).selectOption("client");
    await d.getByLabel("Programme", { exact: true }).fill("Example exam");
    await d.getByLabel("Approval", { exact: true }).selectOption("approved");
    await d.getByRole("button", { name: "Save", exact: true }).click();
    await d.getByRole("alert").waitFor();
    await d.getByLabel("Partner centre code").fill("EXAMPLE");
    await d.getByLabel("Approved seats").fill("20");
    await d
      .getByLabel("Approval document link")
      .fill("https://example.test/approval");
    await d.getByRole("button", { name: "Save", exact: true }).click();
    await d.waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: "Documents & renewals", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add renewal", exact: true })
      .click();
    await d.getByLabel("Renewal / deadline").fill("Example renewal");
    await d.getByLabel("Next due date").fill("2026-10-26");
    await d.getByRole("button", { name: "Save", exact: true }).click();
    await d.waitFor({ state: "hidden" });
    assert.equal(
      (await page.evaluate(() => window.lastSaved)).table,
      "compliance_items",
    );
    await page
      .getByRole("button", { name: "Add document link", exact: true })
      .click();
    await d.getByLabel("Document name").fill("Example document");
    await d
      .getByLabel("Existing document link")
      .fill("https://example.test/file");
    await d
      .getByLabel("Related renewal")
      .selectOption({ label: "Example renewal" });
    await d.getByRole("button", { name: "Save", exact: true }).click();
    await d.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await page.screenshot({
      path: `/workspace/fets-ascender-preview/overview-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("navigation", { name: "Test centres" })
      .getByRole("button")
      .filter({ hasText: "Mobile unit" })
      .click();
    await page
      .getByRole("button", { name: "Deployments", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add mobile deployment", exact: true })
      .click();
    await d.getByLabel("Host institution / venue").fill("Example venue");
    await d.getByLabel("First exam date").fill("2026-11-01");
    await d.getByLabel("Last exam date").fill("2026-11-02");
    await d.getByLabel("Setup due").fill("2026-10-31");
    await d.getByLabel("Readiness", { exact: true }).selectOption("confirmed");
    await d.getByRole("button", { name: "Save", exact: true }).click();
    await d.getByRole("alert").waitFor();
    await d.getByLabel("Deployment lead").selectOption("person");
    await d.getByLabel("Required seats").fill("20");
    await d
      .getByLabel("Readiness evidence / outstanding issue")
      .fill("Example evidence for isolated testing");
    await d.getByRole("button", { name: "Save", exact: true }).click();
    await d.waitFor({ state: "hidden" });
    await page.getByRole("heading", { name: "Example venue" }).waitFor();
    await page.getByRole("button", { name: "History", exact: true }).click();
    await page.locator("details summary").first().click();
    await page
      .getByRole("button", { name: "Deployments", exact: true })
      .click();
    await page.screenshot({
      path: `/workspace/fets-ascender-preview/mobile-unit-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    results.push({ width, passed: true });
    await page.close();
  }
  const denied = await browser.newPage();
  await denied.goto("http://127.0.0.1:3017/?denied");
  await denied.getByRole("alert").waitFor();
  assert.equal(
    await denied.getByRole("button", { name: "Edit details" }).count(),
    0,
  );
  await browser.close();
  console.log(
    JSON.stringify({
      checks:
        "centre editing, failed save recovery, existing-tool navigation, capacity validation, approvals, shared renewals, document links, Mobile deployments, history, access denial, no overflow",
      results,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

const { chromium } = require(
  process.env.FETS_PLAYWRIGHT_MODULE || "playwright",
);
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  for (const width of [1440, 393]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:3015/Roster-Interactive-Preview.html");
    await page.getByRole("table").waitFor();
    assert.equal(await page.locator(".rw-grid thead th").count(), 32);
    assert.equal(
      await page
        .getByRole("button", { name: "Month", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    if (width === 1440)
      assert.ok(
        await page
          .locator(".rw-grid-wrap")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      );
    const cell = page.getByRole("button", { name: /Maya Joseph, 20 Oct,/ });
    assert.equal((await cell.innerText()).trim(), "D1");
    assert.match(await cell.getAttribute("aria-label"), /Shift lead/);
    assert.ok(
      await cell.evaluate(
        (e) => getComputedStyle(e, "::after").height === "2px",
      ),
    );
    assert.notEqual(
      await cell.evaluate((e) => getComputedStyle(e).backgroundColor),
      await page
        .getByRole("button", { name: /Maya Joseph, 21 Oct,/ })
        .evaluate((e) => getComputedStyle(e).backgroundColor),
    );
    await page.getByRole("button", { name: "Attendance", exact: true }).click();
    await page
      .getByRole("button", { name: "Attendance report", exact: true })
      .click();
    await page.getByLabel("Staff member", { exact: true }).selectOption("p0");
    await page.getByRole("button", { name: "Generate draft" }).click();
    await page
      .getByLabel("Report title", { exact: true })
      .fill("Attendance review - Sample Staff");
    await page
      .getByLabel("Manager comments", { exact: true })
      .fill("Discuss the agreed follow-up on Monday.");
    const dl = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download PDF", exact: true })
      .click();
    const download = await dl;
    await download.saveAs(`/workspace/fets-roster-preview/report-${width}.pdf`);
    assert.equal(await download.failure(), null);
    await page.screenshot({
      path: `/workspace/fets-roster-preview/report-${width}.png`,
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    await page.goto(
      "http://127.0.0.1:3015/Roster-Interactive-Preview.html?role=staff",
    );
    await page.getByRole("button", { name: "Attendance", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Attendance report", exact: true })
        .count(),
      0,
    );
    await context.close();
    console.log(
      JSON.stringify({
        width,
        monthDays: 31,
        lead: true,
        distinctColours: true,
        editablePdf: true,
        staffReportHidden: true,
        errors,
      }),
    );
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

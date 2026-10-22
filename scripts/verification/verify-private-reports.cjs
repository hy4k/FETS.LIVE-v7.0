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
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const base = "http://127.0.0.1:3015/Roster-Interactive-Preview.html";
    await page.goto(base);
    await page.getByRole("button", { name: "Attendance", exact: true }).click();
    await page
      .getByRole("button", { name: "Attendance report", exact: true })
      .click();
    await page.getByLabel("Staff member", { exact: true }).selectOption("p0");
    await page.getByRole("button", { name: "Generate draft" }).click();
    await page
      .getByLabel("Report title", { exact: true })
      .fill("Private review for Maya");
    await page
      .getByLabel("Manager comments", { exact: true })
      .fill("First private draft");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page
      .getByText("Draft saved. Only you can see it until you share it.")
      .waitFor();
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.goto(base + "?role=staff");
    await page.getByRole("button", { name: "My reports", exact: true }).click();
    await page.getByText("No reports yet.", { exact: true }).waitFor();
    await page.goto(base);
    await page.getByRole("button", { name: "Reports", exact: true }).click();
    await page.getByRole("button", { name: /Private review for Maya/ }).click();
    assert.equal(
      await page.getByLabel("Manager comments", { exact: true }).inputValue(),
      "First private draft",
    );
    await page
      .getByLabel("Manager comments", { exact: true })
      .fill("Final private feedback for Maya");
    await page
      .getByRole("button", { name: "Share with Maya Joseph", exact: true })
      .click();
    await page.getByText(/Shared privately with Maya Joseph/).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Save draft", exact: true })
        .count(),
      0,
    );
    await page.goto(base + "?role=staff");
    await page.getByRole("button", { name: "My reports", exact: true }).click();
    await page.getByRole("button", { name: /Private review for Maya/ }).click();
    await page
      .getByText("Final private feedback for Maya", { exact: true })
      .waitFor();
    assert.equal(await page.getByRole("dialog").getByRole("textbox").count(), 0);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `/workspace/fets-roster-preview/private-report-${width}.png`,
      fullPage: true,
    });
    await page.goto(base + "?role=other");
    await page.getByRole("button", { name: "My reports", exact: true }).click();
    await page.getByText("No reports yet.", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      JSON.stringify({
        width,
        draftPersists: true,
        draftPrivate: true,
        editedBeforeSharing: true,
        recipientReads: true,
        otherStaffExcluded: true,
        errors,
      }),
    );
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

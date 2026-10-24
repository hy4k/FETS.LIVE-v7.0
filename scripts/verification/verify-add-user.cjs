const { chromium } = require("/workspace/mobile-tools/node_modules/playwright");
const assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [1440, 393]) {
      const page = await b.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("http://127.0.0.1:3016");
      await page.getByRole("button", { name: "Add User", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Add User" });
      await dialog.waitFor();
      for (const [label, value] of [
        ["Full name", "New Example Staff"],
        ["Email", "new@example.test"],
        ["Initial password", "fictional-password-123"],
        ["Contact number", "1234567890"],
        ["Position", "Invigilator"],
        ["Joining date", "2026-10-24"],
        ["Employee ID (on payslip)", "FETS99"],
        ["Designation (on payslip)", "Administrator"],
        ["Remarks", "Fictional review notes"],
      ])
        await dialog.getByLabel(label, { exact: true }).fill(value);
      for (const [button, label] of [
        ["Add certificates", "Certificates 1"],
        ["Add trainings attended", "Trainings attended 1"],
        ["Add future training / plans", "Future training / plans 1"],
      ]) {
        await dialog.getByRole("button", { name: button, exact: true }).click();
        await dialog.getByLabel(label, { exact: true }).fill("Example entry");
      }
      await page.screenshot({
        path: `/workspace/fets-add-user-preview/form-${width}.png`,
        fullPage: true,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.evaluate(() => (window.failStaffCreation = true));
      await dialog
        .getByRole("button", { name: "Add User", exact: true })
        .click();
      await dialog.getByRole("alert").waitFor();
      assert.equal(
        await dialog.getByLabel("Full name", { exact: true }).inputValue(),
        "New Example Staff",
      );
      await page.evaluate(() => (window.failStaffCreation = false));
      await dialog
        .getByRole("button", { name: "Add User", exact: true })
        .click();
      await dialog.waitFor({ state: "detached" });
      await page
        .getByRole("heading", { name: "New Example Staff", exact: true })
        .waitFor({ state: "visible" });
      await page.getByRole("button", { name: "growth", exact: true }).click();
      assert.equal(
        await page.getByLabel("Certificates 1", { exact: true }).inputValue(),
        "Example entry",
      );
      const saved = await page.evaluate(() => window.lastCreatedStaff);
      assert.equal(saved.permissions.employee_id, "FETS99");
      assert.equal(saved.future_trainings[0].title, "Example entry");
      await page.goto("http://127.0.0.1:3016?role=staff");
      await page
        .getByText("Super Admin Access Only", { exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Add User", exact: true })
          .count(),
        0,
      );
      assert.deepEqual(errors, []);
      console.log(
        JSON.stringify({
          width,
          button: true,
          allFields: true,
          errorPreservesInput: true,
          newProfileSelected: true,
          growthEditable: true,
          staffDenied: true,
          errors,
        }),
      );
      await page.close();
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

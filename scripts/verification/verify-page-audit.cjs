const { chromium } = require(
  process.env.FETS_PLAYWRIGHT_MODULE || "playwright",
);
const fs = require("node:fs");
const path = require("node:path");
const out =
  process.env.FETS_AUDIT_DIR || path.resolve(__dirname, "../../.page-audit");
const base = process.env.FETS_AUDIT_URL || "http://127.0.0.1:3018";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    ...(process.env.FETS_CHROME_PATH
      ? { executablePath: process.env.FETS_CHROME_PATH }
      : {}),
    headless: true,
    args: ["--no-sandbox"],
  });
  const routes = process.env.FETS_AUDIT_ROUTES
    ? process.env.FETS_AUDIT_ROUTES.split(",")
    : [
        "live",
        "calendar",
        "roster",
        "case",
        "handover",
        "desk",
        "business",
        "chat",
        "fets-chat",
        "lost-and-found",
        "actionables",
        "news",
        "attn-admin",
        "staff-ot",
        "candidate-tracker",
        "access-hub",
        "system-manager",
        "news-manager",
        "user-management",
        "branch-delegation",
        "dashboard",
        "fets-intelligence",
        "gbp",
      ];
  const results = [];
  for (const width of [1440, 393])
    for (const route of routes) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (
          m.type() === "error" &&
          /Page rendering failed|React error|ReferenceError|TypeError/.test(
            m.text(),
          )
        )
          errors.push(m.text());
      });
      let text = "";
      try {
        await page.goto(`${base}/?page=${route}`, {
          waitUntil: "load",
        });
        await page.waitForTimeout(800);
        text = await page.locator("body").innerText();
        if (/Render failure:|This page could not be displayed/.test(text))
          errors.push("render boundary displayed");
        if (route === "calendar" && !errors.length) {
          await page
            .getByRole("button", { name: "Analysis", exact: true })
            .click();
          await page
            .getByText("1 session with incomplete timing", { exact: true })
            .waitFor({ timeout: 5000 });
          await page.getByRole("button", { name: /Client Details/ }).click();
          await page.waitForTimeout(250);
          await page.getByRole("button", { name: /Overlap Analysis/ }).click();
          await page
            .getByText("Overlap check incomplete", { exact: true })
            .waitFor({ timeout: 5000 });
          await page.screenshot({
            path: `${out}/calendar-analysis-${width}.png`,
            fullPage: true,
          });
          await page
            .getByRole("button", {
              name: "Close Calendar Analysis",
              exact: true,
            })
            .click();
        }
      } catch (e) {
        errors.push(e.message);
      }
      if (route === "staff-ot") {
        const reads = await page.evaluate(() => window.auditReads);
        await page.waitForTimeout(600);
        if ((await page.evaluate(() => window.auditReads)) !== reads)
          errors.push("OT Manager keeps refetching after settling");
      }
      results.push({ route, width, errors, textLength: text.length });
      fs.writeFileSync(
        path.join(out, "results.json"),
        JSON.stringify(results, null, 2),
      );
      if (errors.length) {
        console.log(JSON.stringify(results.at(-1)));
        try {
          await page.screenshot({
            path: `${out}/failure-${route}-${width}.png`,
            fullPage: true,
            timeout: 3000,
          });
        } catch {}
      }
      console.log("Checked " + route + " " + width);
      await page.close();
    }
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(results, null, 2),
  );
  await browser.close();
  console.log(
    JSON.stringify({
      checks: results.length,
      failed: results.filter((x) => x.errors.length).length,
    }),
  );
  if (results.some((x) => x.errors.length)) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

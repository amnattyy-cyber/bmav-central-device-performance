import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("provides four independent product datasets", async () => {
  const data = JSON.parse(await readFile(new URL("app/sales-product-data.json", root), "utf8"));
  assert.deepEqual(data.products, ["Device", "GIA", "Postpay", "TrueOnline"]);
  assert.equal(data.branches.length, 17);
  assert.equal(data.meta.asOf, "2026-08-09");
  assert.equal(data.meta.targetUpdated, "2026-08-04");
  const targetTotals = Object.fromEntries(data.products.map((product) => [
    product,
    data.branches.reduce((sum, branch) => sum + branch.products[product].target, 0),
  ]));
  assert.ok(Math.abs(targetTotals.Device - 50953082.89859254) < 0.001);
  assert.ok(Math.abs(targetTotals.Postpay - 1979015.614442571) < 0.001);
  assert.ok(Math.abs(targetTotals.GIA - 8376155) < 0.001);
  assert.ok(Math.abs(targetTotals.TrueOnline - 599.2025015042318) < 0.001);
  assert.equal(
    data.branches.reduce((sum, branch) => sum + branch.products.TrueOnline.daily.reduce((dailySum, value) => dailySum + value, 0), 0),
    145,
  );
  assert.ok(Math.abs(
    data.branches.reduce((sum, branch) => sum + branch.products.TrueOnline.runrate, 0) - 499.44444444444446,
  ) < 0.001);
  assert.ok(Math.abs(
    data.branches.reduce((sum, branch) => sum + branch.products.Postpay.daily.reduce((dailySum, value) => dailySum + value, 0), 0) - 432122.15,
  ) < 0.001);
  assert.ok(Math.abs(
    data.branches.reduce((sum, branch) => sum + branch.products.Postpay.runrate, 0) - 1488420.7388888889,
  ) < 0.001);
  assert.equal(data.branches.reduce((sum, branch) => sum + branch.products.Device.daily[8], 0), 2641069);
  assert.equal(data.branches.reduce((sum, branch) => sum + branch.products.GIA.daily[8], 0), 240817);
  assert.equal(data.branches.reduce((sum, branch) => sum + branch.products.Postpay.daily[8], 0), 46937);
  assert.equal(data.branches.reduce((sum, branch) => sum + branch.products.TrueOnline.daily[8], 0), 19);
  assert.deepEqual(
    Object.fromEntries(data.products.map((product) => [
      product,
      data.branches.filter((branch) => branch.products[product].target > 0).length,
    ])),
    { Device: 15, GIA: 15, Postpay: 15, TrueOnline: 15 },
  );
  for (const branch of data.branches) {
    for (const product of data.products) {
      assert.ok(branch.products[product]);
      assert.equal(typeof branch.products[product].target, "number");
      assert.equal(typeof branch.products[product].runrate, "number");
      assert.ok(Array.isArray(branch.products[product].daily));
      assert.equal(branch.products[product].daily.length, 9);
    }
  }
});

test("provides Postpay individual performance as of 07 August 2026", async () => {
  const data = JSON.parse(await readFile(new URL("app/postpay-person-performance.json", root), "utf8"));
  assert.equal(data.meta.product, "Postpay");
  assert.equal(data.meta.asOf, "2026-08-07");
  assert.equal(data.meta.area, "BMA V - Central");
  assert.equal(data.people.length, 142);
  assert.equal(data.people.filter((person) => person.target > 0).length, 141);
  assert.equal(new Set(data.people.map((person) => person.shopName)).size, 16);
  const totals = data.people.reduce((sum, person) => ({
    target: sum.target + person.target,
    actual: sum.actual + person.actual,
    actualRunrate: sum.actualRunrate + person.actualRunrate,
  }), { target: 0, actual: 0, actualRunrate: 0 });
  assert.deepEqual(totals, { target: 2547937, actual: 340200, actualRunrate: 1504106 });
  assert.ok(data.people.every((person) => typeof person.runrateAchievement === "number"));
  assert.ok(data.people.every((person, index) => index === 0 || data.people[index - 1].runrateAchievement >= person.runrateAchievement));
});

test("dashboard exposes product, branch, and optional date filters", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const sheetSync = await readFile(new URL("app/google-sheet-data.ts", root), "utf8");
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(page, /Product Performance Monitor/);
  assert.match(page, /Dashboard ยอดขายรายวัน \(Device\/GIA : Data TSM, Post\/TOL : Data Link Daily Sales\)/);
  assert.match(page, /setProduct/);
  assert.match(page, /setBranchName/);
  assert.match(page, /targetedBranches/);
  assert.match(page, /branch\.products\[product\]\.target > 0/);
  assert.match(page, /ซ่อนสาขาที่ไม่มี Target/);
  assert.match(page, /setDateFilter/);
  assert.match(page, /ทุกวัน \(ยอดสะสมถึง \{String\(asOfDay\)/);
  assert.match(page, /เฉพาะวันที่/);
  assert.match(page, /loadGoogleSheetData/);
  assert.match(page, /nextData\.meta\.asOf < \(fallbackData as DashboardData\)\.meta\.asOf/);
  assert.match(page, /5 \* 60 \* 1000/);
  assert.match(page, /Google Sheet Live/);
  assert.match(sheetSync, /output=csv/);
  assert.match(sheetSync, /Dashboard_Data/);
  assert.match(sheetSync, /dashboardDataFromCsv/);
  assert.match(page, /Ranking Shop/);
  assert.match(page, /Shop Top Ranking/);
  assert.match(page, /PRODUCT EXECUTIVE LENS/);
  assert.match(page, /BRANCH EXECUTIVE ANALYSIS/);
  assert.match(page, /executiveFocus: Record<ProductName/);
  assert.match(page, /เพิ่มจำนวนปิด TOL ในมุม QTY/);
  assert.match(page, /ยกระดับความสม่ำเสมอของยอด GIA/);
  assert.match(page, /เร่งยอดปิด Postpay ให้ทัน Runrate/);
  assert.match(page, /branchName === ALL_BRANCHES/);
  assert.match(page, /const requiredPerDay = monthlyGap \/ remainingDays/);
  assert.match(page, /dailyValues\.indexOf\(bestValue\) \+ 1/);
  assert.match(page, /Top 3 Contribution/);
  assert.match(page, /ข้อเสนอแนะสำหรับสาขา/);
  assert.match(page, /product === "Postpay"/);
  assert.match(page, /POSTPAY • PEOPLE PERFORMANCE/);
  assert.match(page, /Performance รายบุคคล/);
  assert.match(page, /Data as of 07\/08\/2026/);
  assert.match(page, /postpay-person-performance\.json/);
  assert.match(page, /person\.shopName === branchName/);
  assert.match(page, /ค้นหาพนักงาน \/ ID \/ สาขา/);
  assert.match(page, /Actual-RR/);
  assert.match(page, /RR ACH/);
  assert.match(page, /Detailed Performance แยกจากยอดระดับสาขา/);
  assert.match(page, /%Achieve \{percent\(metrics\.pace\)\}/);
  assert.match(page, /name === "TrueOnline" \? " \(QTY\)"/);
  assert.match(page, /isQtyProduct \? " QTY"/);
  assert.match(page, /isQtyProduct \? "RR QTY" : "RR Net Amount"/);
  assert.doesNotMatch(page, /notation:\s*"compact"/);
  assert.doesNotMatch(page, /\{compact\(/);
  assert.match(page, /ดูครบทุกสาขา \/ Copy รูป/);
  assert.match(page, /<th>Target<\/th><th>%ACH<\/th>/);
  assert.match(page, /"Target MTD"/);
  assert.match(page, /"ACH MTD"/);
  assert.match(page, /rr-percent/);
  assert.match(page, /status\(branch\.runrateAchievement\)\.key/);
  assert.doesNotMatch(page, /อันดับรายสาขา/);
  assert.match(page, /Runrate %/);
  assert.doesNotMatch(page, /฿/);
  assert.match(page, /หน่วย: บาท/);
  assert.match(css, /td \{[^}]*font-size:\s*13px/);
  assert.match(css, /th \{[^}]*font-size:\s*12px/);
  assert.match(css, /\.rank-list \{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css, /\.rank-list \{[^}]*max-height/);
  assert.match(css, /\.rr-percent\.ontrack/);
  assert.match(css, /\.rr-percent\.watch/);
  assert.match(css, /\.rr-percent\.atrisk/);
  assert.match(css, /\.product-lens/);
  assert.match(css, /\.branch-analysis-grid/);
  assert.match(css, /\.people-performance/);
  assert.match(css, /\.people-table-wrap/);
  assert.match(css, /\.people-distribution/);
});


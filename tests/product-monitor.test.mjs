import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("provides four independent product datasets", async () => {
  const data = JSON.parse(await readFile(new URL("app/sales-product-data.json", root), "utf8"));
  assert.deepEqual(data.products, ["Device", "GIA", "Postpay", "TrueOnline"]);
  assert.equal(data.branches.length, 17);
  assert.equal(data.meta.asOf, "2026-08-12");
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
    193,
  );
  assert.ok(Math.abs(
    data.branches.reduce((sum, branch) => sum + branch.products.TrueOnline.runrate, 0) - 498.58333333333337,
  ) < 0.001);
  assert.ok(Math.abs(
    data.branches.reduce((sum, branch) => sum + branch.products.Postpay.daily.reduce((dailySum, value) => dailySum + value, 0), 0) - 578760.95,
  ) < 0.001);
  assert.ok(Math.abs(
    data.branches.reduce((sum, branch) => sum + branch.products.Postpay.runrate, 0) - 1495132.4541666664,
  ) < 0.001);
  assert.equal(data.branches.reduce((sum, branch) => sum + branch.products.Device.daily[11], 0), 2202179);
  assert.equal(data.branches.reduce((sum, branch) => sum + branch.products.GIA.daily[11], 0), 241072);
  assert.equal(data.branches.reduce((sum, branch) => sum + branch.products.Postpay.daily[11], 0), 48927);
  assert.equal(data.branches.reduce((sum, branch) => sum + branch.products.TrueOnline.daily[11], 0), 24);
  const productMom = Object.fromEntries(data.products.map((product) => {
    const runrate = data.branches.reduce((sum, branch) => sum + branch.products[product].runrate, 0);
    const julyActual = data.branches.reduce((sum, branch) => sum + branch.products[product].julyActual, 0);
    return [product, runrate / julyActual - 1];
  }));
  assert.ok(Math.abs(productMom.Device - 0.48844783753979737) < 1e-9);
  assert.ok(Math.abs(productMom.GIA - 0.27423862897582385) < 1e-9);
  assert.ok(Math.abs(productMom.Postpay - 0.1019364571876955) < 1e-9);
  assert.ok(Math.abs(productMom.TrueOnline - 0.054087385482734396) < 1e-9);
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
      assert.equal(typeof branch.products[product].julyActual, "number");
      assert.ok(Array.isArray(branch.products[product].daily));
      assert.equal(branch.products[product].daily.length, 12);
    }
  }
});

test("provides Google Sheet individual performance for Postpay and TOL", async () => {
  const data = JSON.parse(await readFile(new URL("app/postpay-person-performance.json", root), "utf8"));
  const tol = JSON.parse(await readFile(new URL("app/tol-person-performance.json", root), "utf8"));
  assert.equal(data.meta.product, "Postpay");
  assert.equal(data.meta.asOf, "2026-08-09");
  assert.equal(data.meta.area, "BMA V - Central");
  assert.equal(data.people.length, 140);
  assert.equal(data.people.filter((person) => person.target > 0).length, 140);
  assert.equal(new Set(data.people.map((person) => person.shopName)).size, 15);
  const totals = data.people.reduce((sum, person) => ({
    target: sum.target + person.target,
    actual: sum.actual + person.actual,
    actualRunrate: sum.actualRunrate + person.actualRunrate,
  }), { target: 0, actual: 0, actualRunrate: 0 });
  assert.deepEqual(totals, { target: 2833420, actual: 436123, actualRunrate: 1509601 });
  assert.ok(data.people.every((person) => typeof person.runrateAchievement === "number"));
  assert.ok(data.people.every((person, index) => index === 0 || data.people[index - 1].runrateAchievement >= person.runrateAchievement));
  assert.equal(tol.meta.product, "TrueOnline");
  assert.equal(tol.meta.asOf, "2026-08-10");
  assert.equal(tol.people.length, 130);
  assert.equal(new Set(tol.people.map((person) => person.shopName)).size, 15);
  assert.deepEqual(tol.people.reduce((sum, person) => ({
    target: sum.target + person.target,
    actual: sum.actual + person.actual,
    actualRunrate: sum.actualRunrate + person.actualRunrate,
  }), { target: 0, actual: 0, actualRunrate: 0 }), { target: 804, actual: 151, actualRunrate: 456 });
  assert.ok(tol.people.every((person) => person.target === 0 || person.runrateAchievement === person.actualRunrate / person.target));
});

test("dashboard exposes product, branch, and optional date filters", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const sheetSync = await readFile(new URL("app/google-sheet-data.ts", root), "utf8");
  const personSheetSync = await readFile(new URL("app/google-person-data.ts", root), "utf8");
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  const focusSync = await readFile(new URL("app/focus-device-data.ts", root), "utf8");
  const focusSales = JSON.parse(await readFile(new URL("app/focus-device-sales.json", root), "utf8"));
  assert.match(page, /Product Performance Monitor/);
  assert.match(page, /Dashboard ยอดขายรายวัน \(Device\/GIA : Data TSM, Post\/TOL : Data Link Daily Sales\)/);
  assert.match(page, /setProduct/);
  assert.match(page, /setSelectedBranchNames/);
  assert.match(page, /branch-multiselect/);
  assert.match(page, /toggleBranch/);
  assert.match(page, /selectedBranchNames\.includes\(branch\.name\)/);
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
  assert.match(page, /selectedBranchNames\.length === 0/);
  assert.match(page, /const requiredPerDay = monthlyGap \/ remainingDays/);
  assert.match(page, /dailyValues\.indexOf\(bestValue\) \+ 1/);
  assert.match(page, /Top 3 Contribution/);
  assert.match(page, /ข้อเสนอแนะสำหรับสาขา/);
  assert.match(page, /fallbackPersonDataByProduct/);
  assert.match(page, /POSTPAY/);
  assert.match(page, /TOL/);
  assert.match(page, /Performance Indy รายบุคคล/);
  assert.match(page, /personAsOfDisplay/);
  assert.match(page, /postpay-person-performance\.json/);
  assert.match(page, /tol-person-performance\.json/);
  assert.match(page, /loadGooglePersonPerformance/);
  assert.match(page, /peopleSyncSource/);
  assert.match(page, /อัปเดตอัตโนมัติทุก 5 นาที/);
  assert.match(page, /positionFilters/);
  assert.match(page, /togglePosition/);
  assert.match(page, /type="checkbox"/);
  assert.match(page, /เลือก Type \/ ตำแหน่ง/);
  assert.match(page, /noSalesPeople/);
  assert.match(page, /noSalesGroups/);
  assert.match(page, /NO SALES FOCUS/);
  assert.match(page, /ดูชื่อ • ตำแหน่ง • สาขา/);
  assert.match(page, /AUTO-GENERATED EXECUTIVE INSIGHT/);
  assert.match(page, /ข้อมูลเชิงลึกสำหรับผู้บริหาร/);
  assert.match(page, /executiveActions/);
  assert.match(page, /วิเคราะห์อัตโนมัติตาม/);
  assert.match(personSheetSync, /Postpay_People/);
  assert.match(personSheetSync, /TOL_People/);
  assert.match(personSheetSync, /personPerformanceFromCsv/);
  assert.match(personSheetSync, /actualRunrate \/ target/);
  assert.match(page, /selectedBranchNames\.includes\(person\.shopName\)/);
  assert.match(page, /ค้นหาพนักงาน \/ ID \/ สาขา/);
  assert.match(page, /Actual-RR/);
  assert.match(page, /RR ACH/);
  assert.match(page, /Google Sheet Live • อัปเดตอัตโนมัติทุก 5 นาที/);
  assert.match(page, /%Achieve \{percent\(metrics\.pace\)\}/);
  assert.match(page, /name === "TrueOnline" \? " \(QTY\)"/);
  assert.match(page, /isQtyProduct \? " QTY"/);
  assert.match(page, /isQtyProduct \? "RR QTY" : "RR Net Amount"/);
  assert.doesNotMatch(page, /notation:\s*"compact"/);
  assert.doesNotMatch(page, /\{compact\(/);
  assert.match(page, /ดูครบทุกสาขา \/ Copy รูป/);
  assert.match(page, /FOCUS DEVICE MODEL/);
  assert.match(page, /focusBranchPerformance/);
  assert.match(page, /focusCaptureMode/);
  assert.match(page, /ดูครบ 15 สาขา \/ Copy รูป/);
  assert.match(page, /Target ต่อวัน/);
  assert.match(page, /Central Rama 9 4Fl\./);
  assert.match(page, /Central World 4Fl\./);
  assert.match(page, /loadFocusDeviceData/);
  assert.match(page, /focusSyncSource/);
  assert.match(focusSync, /Focus_Device/);
  assert.match(focusSync, /gviz\/tq/);
  assert.match(focusSync, /range=A4:K531/);
  assert.match(focusSync, /EXCLUDED_TARGET_BRANCHES/);
  assert.match(focusSync, /True Kiosk The Eight Thonglor/);
  assert.match(focusSync, /True Shop U Chu Liang Building/);
  assert.match(page, /branch\.dailyTarget > 0/);
  assert.match(page, /แสดงเฉพาะ 15 สาขาที่มี Target/);
  assert.match(page, /BRANCH HEALTH SCORE/);
  assert.match(page, /branchHealthScore/);
  assert.match(page, /Download Excel/);
  assert.match(page, /downloadProductExcel/);
  assert.match(page, /downloadFocusExcel/);
  assert.match(page, /downloadPeopleExcel/);
  assert.match(page, /สรุปรายสาขา \+ Daily Trend/);
  assert.match(page, /Performance Indy<\/b>/);
  assert.match(page, /excel-export/);
  assert.match(css, /\.download-menu/);
  assert.match(css, /\.download-options/);
  assert.equal(focusSales.model, "Honor X5C Plus");
  assert.equal(focusSales.asOf, "2026-08-15");
  assert.equal(focusSales.sales.reduce((sum, row) => sum + row.qty, 0), 14);
  assert.match(page, /<th>Target<\/th><th>%ACH<\/th>/);
  assert.match(page, /"Target MTD"/);
  assert.match(page, /"ACH MTD"/);
  assert.match(page, /rr-percent/);
  assert.match(page, /status\(branch\.runrateAchievement\)\.key/);
  assert.doesNotMatch(page, /อันดับรายสาขา/);
  assert.match(page, /Runrate %/);
  assert.match(page, /%MOM/);
  assert.match(page, /Runrate เทียบ July Actual/);
  assert.match(page, /momPercent\(metrics\.mom\)/);
  assert.match(page, /momPercent\(branch\.mom\)/);
  assert.match(sheetSync, /julyActual/);
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
  assert.match(css, /\.position-checks/);
  assert.match(css, /\.no-sales-focus/);
  assert.match(css, /\.no-sales-groups/);
  assert.match(css, /\.auto-executive-analysis/);
  assert.match(css, /\.management-actions/);
  assert.match(css, /\.focus-capture-mode/);
  assert.match(css, /\.trend-scorebar/);
});

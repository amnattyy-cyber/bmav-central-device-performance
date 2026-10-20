import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("provides four independent product datasets", async () => {
  const data = JSON.parse(await readFile(new URL("app/sales-product-data.json", root), "utf8"));
  assert.deepEqual(data.products, ["Device", "GIA", "Postpay", "TrueOnline"]);
  assert.equal(data.branches.length, 15);
  assert.equal(data.meta.month, "October 2026");
  assert.equal(data.meta.asOf, "2026-10-20");
  assert.equal(data.meta.targetUpdated, "2026-10-01");
  const targetTotals = Object.fromEntries(data.products.map((product) => [
    product,
    data.branches.reduce((sum, branch) => sum + branch.products[product].target, 0),
  ]));
  assert.ok(Math.abs(targetTotals.Device - 139215088.76) < 0.001);
  assert.ok(Math.abs(targetTotals.Postpay - 2393977.48462) < 0.001);
  assert.ok(Math.abs(targetTotals.GIA - 8272644.64218) < 0.001);
  assert.ok(Math.abs(targetTotals.TrueOnline - 635.843733108) < 0.001);
  assert.equal(
    data.branches.reduce((sum, branch) => sum + branch.products.TrueOnline.daily.reduce((dailySum, value) => dailySum + value, 0), 0),
    330,
  );
  assert.ok(Math.abs(
    data.branches.reduce((sum, branch) => sum + branch.products.TrueOnline.runrate, 0) - 511.5,
  ) < 0.001);
  assert.ok(Math.abs(
    data.branches.reduce((sum, branch) => sum + branch.products.Postpay.daily.reduce((dailySum, value) => dailySum + value, 0), 0) - 1086347,
  ) < 0.001);
  assert.ok(Math.abs(
    data.branches.reduce((sum, branch) => sum + branch.products.Postpay.runrate, 0) - 1683837.85,
  ) < 0.001);
  assert.equal(data.branches.reduce((sum, branch) => sum + branch.products.Device.daily[19], 0), 2805902);
  assert.equal(data.branches.reduce((sum, branch) => sum + branch.products.GIA.daily[19], 0), 173152);
  assert.equal(data.branches.reduce((sum, branch) => sum + branch.products.Postpay.daily[19], 0), 60224);
  assert.equal(data.branches.reduce((sum, branch) => sum + branch.products.TrueOnline.daily[19], 0), 23);
  const productMom = Object.fromEntries(data.products.map((product) => {
    const runrate = data.branches.reduce((sum, branch) => sum + branch.products[product].runrate, 0);
    const julyActual = data.branches.reduce((sum, branch) => sum + branch.products[product].julyActual, 0);
    return [product, runrate / julyActual - 1];
  }));
  assert.ok(Math.abs(productMom.Device - 0.094119938152555) < 1e-9);
  assert.ok(Math.abs(productMom.GIA - 0.267703820732155) < 1e-9);
  assert.ok(Math.abs(productMom.Postpay - 0.321659473433597) < 1e-9);
  assert.ok(Math.abs(productMom.TrueOnline - 0.32170542635658905) < 1e-9);
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
      assert.equal(branch.products[product].daily.length, 31);
    }
  }
});

test("provides Google Sheet individual performance for all four products", async () => {
  const files = {
    Device: "app/device-person-performance.json",
    GIA: "app/gia-person-performance.json",
    Postpay: "app/postpay-person-performance.json",
    TrueOnline: "app/tol-person-performance.json",
  };
  const expectedTotals = {
    Device: { target: 177454637, actual: 74220676, actualRunrate: 122020603 },
    GIA: { target: 10788508, actual: 3204337, actualRunrate: 5192423 },
    Postpay: { target: 3165024, actual: 1015397, actualRunrate: 1660487 },
    TrueOnline: { target: 864, actual: 307, actualRunrate: 515 },
  };

  for (const [product, file] of Object.entries(files)) {
    const data = JSON.parse(await readFile(new URL(file, root), "utf8"));
    assert.equal(data.meta.product, product);
    assert.equal(data.meta.asOf, "2026-10-19");
    assert.equal(data.meta.area, "Regional Management BMA V - Central");
    assert.equal(data.people.length, 129);
    assert.equal(new Set(data.people.map((person) => person.id)).size, 129);
    assert.equal(new Set(data.people.map((person) => person.shopName)).size, 15);
    assert.deepEqual(data.people.reduce((sum, person) => ({
      target: sum.target + person.target,
      actual: sum.actual + person.actual,
      actualRunrate: sum.actualRunrate + person.actualRunrate,
    }), { target: 0, actual: 0, actualRunrate: 0 }), expectedTotals[product]);
    assert.ok(data.people.every((person) => typeof person.runrateAchievement === "number"));
    assert.ok(data.people.every((person, index) => index === 0 || data.people[index - 1].runrateAchievement >= person.runrateAchievement));
  }
});

test("dashboard exposes product, branch, and optional date filters", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const sheetSync = await readFile(new URL("app/google-sheet-data.ts", root), "utf8");
  const personSheetSync = await readFile(new URL("app/google-person-data.ts", root), "utf8");
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  const mongkolPage = await readFile(new URL("app/mongkol-dashboard.tsx", root), "utf8");
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
  assert.match(page, /setWeekFilter/);
  assert.match(page, /WOW_WEEKS/);
  assert.match(page, /calculateWow/);
  assert.match(page, /Performance WoW/);
  assert.match(page, /WoW \{wowUnit\}/);
  assert.match(page, /trend-badges/);
  assert.match(page, /จำนวนวันเท่ากัน/);
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
  assert.match(page, /device-person-performance\.json/);
  assert.match(page, /gia-person-performance\.json/);
  assert.match(page, /product\.toUpperCase\(\)/);
  assert.match(page, /TOL/);
  assert.match(page, /Performance Indy รายบุคคล/);
  assert.ok(page.indexOf('className="panel auto-executive-analysis"') < page.indexOf('className="panel people-performance"'));
  assert.match(page, /KEY FINDING • PERFORMANCE INDY/);
  assert.match(page, /ข้อค้นพบสำคัญรายบุคคล/);
  assert.match(page, /indyPriority/);
  assert.match(page, /topThreeIndyShare/);
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
  assert.match(personSheetSync, /Dev_People/);
  assert.match(personSheetSync, /GIA_People/);
  assert.match(personSheetSync, /PERSON_UNIT/);
  assert.match(personSheetSync, /Device: "Amount"/);
  assert.match(personSheetSync, /TrueOnline: "QTY"/);
  assert.match(personSheetSync, /True Shop \(dtac\) Supreme Complex Samsen/);
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
  assert.doesNotMatch(page, /FOCUS DEVICE MODEL/);
  assert.doesNotMatch(page, /Focus Honor X5C Plus/);
  assert.doesNotMatch(page, /downloadFocusExcel/);
  assert.doesNotMatch(page, /loadFocusDeviceData/);
  assert.match(page, /Performance เบอร์มงคล/);
  assert.match(page, /#\/mongkol/);
  assert.match(page, /MongkolDashboard/);
  assert.match(mongkolPage, /Performance เบอร์มงคล/);
  assert.match(page, /BRANCH HEALTH SCORE/);
  assert.match(page, /branchHealthScore/);
  assert.match(page, /Download Excel/);
  assert.match(page, /downloadProductExcel/);
  assert.match(page, /downloadPeopleExcel/);
  assert.match(page, /สรุปรายสาขา \+ Daily Trend/);
  assert.match(page, /Performance Indy<\/b>/);
  assert.match(page, /excel-export/);
  assert.match(css, /\.download-menu/);
  assert.match(css, /\.download-options/);
  assert.match(css, /\.mongkol-nav-link/);
  assert.match(css, /\.mongkol-kpis/);
  assert.match(page, /<th>Target<\/th><th>%ACH<\/th>/);
  assert.match(page, /"Target MTD"/);
  assert.match(page, /"ACH MTD"/);
  assert.match(page, /rr-percent/);
  assert.match(page, /status\(branch\.runrateAchievement\)\.key/);
  assert.doesNotMatch(page, /อันดับรายสาขา/);
  assert.match(page, /Runrate %/);
  assert.match(page, /%MOM/);
  assert.match(page, /Runrate เทียบ \{previousMonthName\} Actual/);
  assert.match(page, /previousMonthName/);
  assert.match(page, /momPercent\(metrics\.mom\)/);
  assert.match(page, /momPercent\(branch\.mom\)/);
  assert.match(sheetSync, /julyActual/);
  assert.match(sheetSync, /PreviousActual/);
  assert.match(sheetSync, /PRODUCT_UNITS/);
  assert.match(sheetSync, /reportingMonthPrefix/);
  assert.doesNotMatch(page, /฿/);
  assert.match(page, /หน่วย: \{isQtyProduct \? "QTY" : "Net"\}/);
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
  assert.match(css, /\.indy-key-findings/);
  assert.match(css, /\.indy-key-grid/);
  assert.match(css, /\.position-checks/);
  assert.match(css, /\.no-sales-focus/);
  assert.match(css, /\.no-sales-groups/);
  assert.match(css, /\.auto-executive-analysis/);
  assert.match(css, /\.management-actions/);
  assert.match(css, /\.focus-capture-mode/);
  assert.match(css, /\.trend-scorebar/);
  assert.match(css, /\.wow-panel/);
  assert.match(css, /\.wow-status\.partial/);
  assert.match(css, /\.trend-badge\.positive/);
  assert.match(css, /\.trend-badge\.negative/);
  assert.match(css, /\.trend-badge\.neutral/);
});


import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("provides four independent product datasets", async () => {
  const data = JSON.parse(await readFile(new URL("app/sales-product-data.json", root), "utf8"));
  assert.deepEqual(data.products, ["Device", "GIA", "Postpay", "TrueOnline"]);
  assert.equal(data.branches.length, 17);
  assert.equal(data.meta.asOf, "2026-08-04");
  assert.equal(data.meta.targetUpdated, "2026-08-04");
  const targetTotals = Object.fromEntries(data.products.map((product) => [
    product,
    data.branches.reduce((sum, branch) => sum + branch.products[product].target, 0),
  ]));
  assert.ok(Math.abs(targetTotals.Postpay - 1732466.883730832) < 0.001);
  assert.ok(Math.abs(targetTotals.GIA - 7140200) < 0.001);
  assert.ok(Math.abs(targetTotals.TrueOnline - 512.7655456351704) < 0.001);
  assert.equal(
    data.branches.reduce((sum, branch) => sum + branch.products.TrueOnline.daily.reduce((dailySum, value) => dailySum + value, 0), 0),
    63,
  );
  assert.ok(Math.abs(
    data.branches.reduce((sum, branch) => sum + branch.products.TrueOnline.runrate, 0) - 496,
  ) < 0.001);
  assert.deepEqual(
    Object.fromEntries(data.products.map((product) => [
      product,
      data.branches.filter((branch) => branch.products[product].target > 0).length,
    ])),
    { Device: 15, GIA: 15, Postpay: 14, TrueOnline: 14 },
  );
  for (const branch of data.branches) {
    for (const product of data.products) {
      assert.ok(branch.products[product]);
      assert.equal(typeof branch.products[product].target, "number");
      assert.equal(typeof branch.products[product].runrate, "number");
      assert.ok(Array.isArray(branch.products[product].daily));
      assert.equal(branch.products[product].daily.length, 4);
    }
  }
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
  assert.match(page, /5 \* 60 \* 1000/);
  assert.match(page, /Google Sheet Live/);
  assert.match(sheetSync, /output=csv/);
  assert.match(sheetSync, /Dashboard_Data/);
  assert.match(sheetSync, /dashboardDataFromCsv/);
  assert.match(page, /Ranking Shop/);
  assert.match(page, /Shop Top Ranking/);
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
});

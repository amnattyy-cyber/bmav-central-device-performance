import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  availableMetricsFor,
  dashboardDatasetFromCsv,
  selectDashboardData,
} from "../app/dashboard-data.ts";

const root = new URL("../", import.meta.url);

test("provides four independent product datasets", async () => {
  const data = JSON.parse(await readFile(new URL("app/sales-product-data.json", root), "utf8"));
  assert.deepEqual(data.products, ["Device", "GIA", "Postpay", "TrueOnline"]);
  assert.equal(data.branches.length, 17);
  assert.equal(data.meta.asOf, "2026-08-12");
  assert.equal(data.meta.targetUpdated, "2026-08-04");
  assert.deepEqual(
    Object.fromEntries(data.products.map((product) => [
      product,
      data.branches.filter((branch) => branch.products[product].target > 0).length,
    ])),
    { Device: 15, GIA: 15, Postpay: 15, TrueOnline: 15 },
  );
});

test("provides Google Sheet individual performance for Postpay and TOL", async () => {
  const postpay = JSON.parse(await readFile(new URL("app/postpay-person-performance.json", root), "utf8"));
  const tol = JSON.parse(await readFile(new URL("app/tol-person-performance.json", root), "utf8"));
  assert.equal(postpay.meta.product, "Postpay");
  assert.equal(postpay.people.length, 140);
  assert.equal(new Set(postpay.people.map((person) => person.shopName)).size, 15);
  assert.equal(tol.meta.product, "TrueOnline");
  assert.equal(tol.people.length, 130);
  assert.equal(new Set(tol.people.map((person) => person.shopName)).size, 15);
});

test("multi-month parser exposes Net and Qty while preserving prior-month history", () => {
  const headers = "Area,Month,AsOf,TargetUpdated,DaysInMonth,Product,BranchName,TDS,WW,Unit,Target,Runrate,PreviousActual,Day01,Day02";
  const products = ["Device", "GIA", "Postpay", "TrueOnline"];
  const august = products.map((product) => {
    const unit = product === "TrueOnline" ? "QTY" : "THB";
    return `BMAV,August 2026,2026-08-31,2026-08-04,31,${product},Shop A,1,2,${unit},100,90,80,1,2`;
  });
  const september = products.flatMap((product) => ["THB", "QTY"].map((unit) =>
    `BMAV,September 2026,2026-09-02,2026-09-01,30,${product},Shop A,1,2,${unit},${unit === (product === "TrueOnline" ? "QTY" : "THB") ? 100 : 0},60,0,4,5`,
  ));
  const dataset = dashboardDatasetFromCsv([headers, ...august, ...september].join("\n"));

  assert.deepEqual(dataset.months.map((month) => month.meta.monthKey), ["2026-08", "2026-09"]);
  assert.deepEqual(availableMetricsFor(dataset, "2026-09", "Device"), ["Net", "Qty"]);
  assert.deepEqual(availableMetricsFor(dataset, "2026-09", "TrueOnline"), ["Net", "Qty"]);

  const net = selectDashboardData(dataset, "2026-09", "Net", "Device");
  assert.equal(net.branches[0].products.Device.previousActual, 3);
  assert.equal(net.branches[0].products.Device.dailyByDate["2026-08-01"], 1);
  assert.equal(net.branches[0].products.Device.dailyByDate["2026-09-02"], 5);

  const qty = selectDashboardData(dataset, "2026-09", "Qty", "Device");
  assert.deepEqual(qty.branches[0].products.Device.daily.slice(0, 2), [4, 5]);
  assert.equal(qty.branches[0].products.Device.target, 0);
  assert.equal(qty.branches[0].products.Device.eligible, true);
});

test("dashboard exposes month, metric, branch, date, WoW, and Excel controls in valid UTF-8 Thai", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const sheetSync = await readFile(new URL("app/dashboard-data.ts", root), "utf8");
  const wow = await readFile(new URL("app/wow.ts", root), "utf8");
  const css = await readFile(new URL("app/globals.css", root), "utf8");

  assert.match(page, /Dashboard ยอดขายรายวัน/);
  assert.match(page, /เลือกเดือน/);
  assert.match(page, /มุมยอดขาย/);
  assert.match(page, /QTY \/ จำนวน Sub/);
  assert.match(page, /Net Amount \/ Revenue/);
  assert.match(page, /setMonthKey/);
  assert.match(page, /setMetric/);
  assert.match(page, /branch-multiselect/);
  assert.match(page, /setDateFilter/);
  assert.match(page, /Performance WoW/);
  assert.match(page, /Download Excel/);
  assert.match(page, /Google Sheet Live/);
  assert.match(sheetSync, /dashboardDatasetFromCsv/);
  assert.match(sheetSync, /PreviousActual/);
  assert.match(wow, /W40/);
  assert.match(css, /grid-template-columns: 1\.7fr/);
  assert.doesNotMatch([page, sheetSync, wow].join("\n"), /�/);
});

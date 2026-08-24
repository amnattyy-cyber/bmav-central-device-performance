import assert from "node:assert/strict";
import test from "node:test";

import { calculateWow, getWowWindow, WOW_WEEKS, wowTone } from "../app/wow.ts";
import { dashboardDataFromCsv } from "../app/google-sheet-data.ts";

const products = ["Device", "GIA", "Postpay", "TrueOnline"];

function productValue(daily, dailyByDate = undefined) {
  return { target: 100, daily, dailyByDate, runrate: 100, julyActual: 100 };
}

function branch(name, daily, dailyByDate = undefined) {
  return {
    name,
    ww: name,
    products: Object.fromEntries(products.map((product) => [product, productValue(daily, dailyByDate)])),
  };
}

function dashboard(asOf, branches) {
  return {
    meta: { area: "BMAV", month: "August 2026", asOf, daysInMonth: 31, targetUpdated: asOf },
    products,
    branches,
  };
}

test("Week 33 partial data compares the same three Monday-Wednesday days", () => {
  const daily = Array.from({ length: 12 }, (_, index) => index + 1);
  const data = dashboard("2026-08-12", [branch("A", daily)]);
  const result = calculateWow(data.branches, "Device", data, WOW_WEEKS[1]);

  assert.deepEqual(getWowWindow(WOW_WEEKS[1], data.meta.asOf), {
    usedDays: 3,
    currentStart: "2026-08-10",
    currentEnd: "2026-08-12",
    baseStart: "2026-08-03",
    baseEnd: "2026-08-05",
    isCompleteWeek: false,
    isWaiting: false,
  });
  assert.equal(result.currentTotal, 33);
  assert.equal(result.baseTotal, 12);
  assert.equal(result.wow, 1.75);
});

test("shop filter scope is honored because calculation uses only selected branches", () => {
  const first = branch("A", Array(12).fill(10));
  const second = branch("B", [...Array(9).fill(5), ...Array(3).fill(20)]);
  const data = dashboard("2026-08-12", [first, second]);

  assert.equal(calculateWow([first], "GIA", data, WOW_WEEKS[1]).wow, 0);
  assert.equal(calculateWow([second], "GIA", data, WOW_WEEKS[1]).wow, 3);
  assert.equal(calculateWow([first, second], "GIA", data, WOW_WEEKS[1]).wow, 1);
});

test("zero or unavailable base returns N/A-ready null and gray tone", () => {
  const zeroBase = branch("A", [...Array(9).fill(0), 4, 5, 6]);
  const data = dashboard("2026-08-12", [zeroBase]);
  const result = calculateWow(data.branches, "Postpay", data, WOW_WEEKS[1]);

  assert.equal(result.baseTotal, 0);
  assert.equal(result.wow, null);
  assert.equal(wowTone(result.wow), "neutral");

  const week32 = calculateWow(data.branches, "Postpay", data, WOW_WEEKS[0]);
  assert.equal(week32.baseComplete, false);
  assert.equal(week32.wow, null);
});

test("Week 36 supports equal-day comparison across August and September", () => {
  const dated = {
    "2026-08-24": 1,
    "2026-08-25": 2,
    "2026-08-26": 3,
    "2026-08-31": 5,
    "2026-09-01": 6,
    "2026-09-02": 7,
  };
  const selected = branch("TOL Shop", [6, 7], dated);
  const data = dashboard("2026-09-02", [selected]);
  const result = calculateWow([selected], "TrueOnline", data, WOW_WEEKS[4]);

  assert.equal(result.usedDays, 3);
  assert.equal(result.currentTotal, 18);
  assert.equal(result.baseTotal, 6);
  assert.equal(result.wow, 2);
  assert.equal(wowTone(result.wow), "positive");
});

test("future selected week waits without manufacturing a comparison", () => {
  const data = dashboard("2026-08-12", [branch("A", Array(12).fill(1))]);
  const result = calculateWow(data.branches, "Device", data, WOW_WEEKS[2]);
  assert.equal(result.usedDays, 0);
  assert.equal(result.isWaiting, true);
  assert.equal(result.wow, null);
});

test("Google Sheet parser preserves explicit dated columns for cross-month WoW", () => {
  const header = "Area,Month,AsOf,TargetUpdated,DaysInMonth,Product,BranchName,TDS,WW,Target,Runrate,JulyActual,Day01,Day02,Date_2026-08-31,2026-09-01";
  const rows = products.map((product) => `BMAV,September 2026,2026-09-02,2026-08-04,30,${product},Shop A,1,2,100,90,80,6,7,5,6`);
  const parsed = dashboardDataFromCsv([header, ...rows].join("\n"));
  const item = parsed.branches[0].products.TrueOnline;

  assert.equal(item.dailyByDate["2026-08-31"], 5);
  assert.equal(item.dailyByDate["2026-09-01"], 6);
  assert.equal(item.dailyByDate["2026-09-02"], 7);
});


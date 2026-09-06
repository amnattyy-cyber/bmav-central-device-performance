import assert from "node:assert/strict";
import test from "node:test";

import { calculateMomActual, momActualTone, previousMonthKeyOf } from "../app/mom.ts";

const products = ["Device", "GIA", "Postpay", "TrueOnline"];

function productValue(dailyByDate) {
  return { target: 100, daily: [], dailyByDate, runrate: 100, previousActual: 0, julyActual: 0 };
}

function branch(name, dailyByDate) {
  return {
    name,
    ww: name,
    products: Object.fromEntries(products.map((product) => [product, productValue(dailyByDate)])),
  };
}

function dashboard(monthKey, asOf, branches) {
  return {
    meta: { area: "BMAV", month: "September 2026", monthKey, asOf, daysInMonth: 30, targetUpdated: asOf, previousMonth: "August 2026", currency: "THB", metric: "Net" },
    products,
    branches,
  };
}

test("previousMonthKeyOf steps back across a year boundary", () => {
  assert.equal(previousMonthKeyOf("2026-09"), "2026-08");
  assert.equal(previousMonthKeyOf("2026-01"), "2025-12");
});

test("equal-day MoM Actual compares the same number of days across months", () => {
  const dated = {
    "2026-08-01": 10, "2026-08-02": 10, "2026-08-03": 10,
    "2026-09-01": 12, "2026-09-02": 12, "2026-09-03": 12,
  };
  const data = dashboard("2026-09", "2026-09-03", [branch("A", dated)]);
  const result = calculateMomActual(data.branches, "Device", data);

  assert.equal(result.usedDays, 3);
  assert.equal(result.baseDays, 3);
  assert.equal(result.currentTotal, 36);
  assert.equal(result.baseTotal, 30);
  assert.ok(Math.abs(result.momActual - 0.2) < 1e-9);
  assert.equal(momActualTone(result.momActual), "positive");
});

test("missing previous-month days mark the comparison incomplete instead of guessing", () => {
  const dated = {
    "2026-08-01": 10,
    "2026-09-01": 12, "2026-09-02": 12,
  };
  const data = dashboard("2026-09", "2026-09-02", [branch("A", dated)]);
  const result = calculateMomActual(data.branches, "Device", data);

  assert.equal(result.baseComplete, false);
  assert.equal(result.momActual, null);
  assert.equal(momActualTone(result.momActual), "neutral");
});

test("first month in the dataset has no prior month to compare against", () => {
  const dated = { "2026-08-01": 5, "2026-08-02": 6 };
  const data = dashboard("2026-08", "2026-08-02", [branch("A", dated)]);
  data.meta.month = "August 2026";
  const result = calculateMomActual(data.branches, "Device", data);

  assert.equal(result.baseTotal, 0);
  assert.equal(result.baseComplete, false);
  assert.equal(result.momActual, null);
});

test("shop filter scope narrows the totals to the selected branches only", () => {
  const dated = {
    "2026-08-01": 10, "2026-08-02": 10,
    "2026-09-01": 20, "2026-09-02": 20,
  };
  const first = branch("A", dated);
  const second = branch("B", dated);
  const data = dashboard("2026-09", "2026-09-02", [first, second]);

  const single = calculateMomActual([first], "GIA", data);
  const both = calculateMomActual([first, second], "GIA", data);
  assert.equal(single.currentTotal, 40);
  assert.equal(both.currentTotal, 80);
  assert.equal(single.momActual, 1);
  assert.equal(both.momActual, 1);
});

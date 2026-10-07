import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("auspicious-number snapshot reconciles area and detailed Indy performance", async () => {
  const data = JSON.parse(await readFile(new URL("app/mongkol-data.json", root), "utf8"));
  assert.equal(data.meta.asOf, "2026-10-06");
  assert.equal(data.areas.length, 16);
  assert.equal(data.areas.reduce((sum, area) => sum + area.target, 0), 1905);
  assert.equal(data.areas.reduce((sum, area) => sum + area.actual, 0), 64);
  assert.equal(data.areas.reduce((sum, area) => sum + area.noSaleCount, 0), 86);
  assert.equal(data.indySummary.count, 127);
  assert.equal(data.indySummary.noSale, 86);
  assert.equal(data.indySummary.atRisk + data.indySummary.watch + data.indySummary.onTrack + data.indySummary.noSale, 127);
  assert.ok(data.areas.every((area) => area.area === "BMA V - Central"));
  assert.ok(data.areas.every((area) => Number.isFinite(area.achievement) && Math.abs(area.achievement - area.actual / area.target) < 1e-9));
  assert.equal(data.indies.length, 127);
  assert.equal(data.indies.reduce((sum, indy) => sum + indy.target, 0), 1905);
  assert.equal(data.indies.reduce((sum, indy) => sum + indy.actual, 0), 64);
  assert.ok(data.indies.every((indy) => indy.firstName && indy.lastName && indy.shopCode && indy.daily.length === 6));
  assert.ok(data.indies.every((indy) => indy.actual === indy.daily.reduce((sum, qty) => sum + qty, 0)));
  assert.ok(data.indies.every((indy) => Math.abs(indy.achievement - indy.actual / indy.target) < 1e-9));
  assert.ok(data.indies.every((indy) => !("empId" in indy) && !("employeeId" in indy)));
  assert.equal("people" in data, false);
});

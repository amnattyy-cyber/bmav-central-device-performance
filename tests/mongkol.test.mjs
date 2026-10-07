import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("auspicious-number snapshot reconciles area and summarized Indy totals without employee identifiers", async () => {
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
  assert.equal("people" in data, false);
});

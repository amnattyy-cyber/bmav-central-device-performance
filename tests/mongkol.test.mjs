import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mongkolDataFromCsv } from "../app/mongkol-google-sheet.ts";

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

test("Mongkol Google Sheet CSV maps Indy rows and recalculates area totals", async () => {
  const data = JSON.parse(await readFile(new URL("app/mongkol-data.json", root), "utf8"));
  const csv = [
    "name_eng,sname_eng,emp_type_2,shop_code,Shop Name,Shop Type,Target,D1,D2,D3,D4,D5,D6,Actual 1-2 Oct,%ACH",
    'A,B,RR_Multi,80100001,"True Shop, Sample",COCO,15,1,0,0,0,0,0,1,6.7%',
    'C,D,RR_Multi,80100001,"True Shop, Sample",COCO,15,0,0,0,0,0,0,0,0%',
    'E,F,RR_Multi,80100002,Other Shop,COCO,15,0,2,0,0,0,0,2,13.3%',
  ].join("\n");
  const live = mongkolDataFromCsv(csv, data);
  assert.equal(live.indies.length, 3);
  assert.equal(live.areas.length, 2);
  assert.equal(live.areas.find((area) => area.branch === "True Shop, Sample")?.actual, 1);
  assert.equal(live.areas.find((area) => area.branch === "True Shop, Sample")?.noSaleCount, 1);
  assert.equal(live.indySummary.count, 3);
  assert.equal(live.indySummary.noSale, 1);
  assert.equal(live.meta.actualLabel, "1–2 Oct");
});

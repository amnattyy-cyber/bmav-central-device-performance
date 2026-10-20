import assert from "node:assert/strict";
import test from "node:test";

import { personPerformanceFromCsv } from "../app/google-person-data.ts";

const header = "AsOf,Product,EmployeeID,EmployeeName,Position,ShopName,Area,Unit,Target,Actual,ActualRunrate,RunrateAchievement,Tenure,UpdatedAt,Active";

test("Device uses Amount rows only and normalizes Shop aliases", () => {
  const csv = [
    header,
    "2026-10-19 0:00:00,Device,001,Ann,RR,True Shop (dtac) Supreme Complex Samsen,BMAV,Amount,100,50,80,80%,1 year,2026-10-20,TRUE",
    "2026-10-19 0:00:00,Device,001,Ann,RR,True Shop (dtac) Supreme Complex Samsen,BMAV,QTY,10,5,8,80%,1 year,2026-10-20,TRUE",
    "2026-10-19 0:00:00,Device,002,Bee,RR,True Shop Lotus's Ramindra,BMAV,Amount,200,100,220,110%,1 year,2026-10-20,TRUE",
  ].join("\n");
  const result = personPerformanceFromCsv(csv, "Device");

  assert.equal(result.meta.asOf, "2026-10-19");
  assert.equal(result.people.length, 2);
  assert.equal(result.people.find((person) => person.id === "001").shopName, "True Shop Supreme Complex (D)");
  assert.equal(result.people.find((person) => person.id === "002").shopName, "Kiosk Lotus's Ramindra");
  assert.equal(result.people.reduce((sum, person) => sum + person.target, 0), 300);
});

test("TOL uses QTY rows only and recalculates RR achievement", () => {
  const csv = [
    header,
    "2026-10-19 0:00:00,TrueOnline,001,Ann,RR,True Shop Central World Fl.4,BMAV,Amount,1000,500,800,80%,1 year,2026-10-20,TRUE",
    "2026-10-19 0:00:00,TrueOnline,001,Ann,RR,True Shop Central World Fl.4,BMAV,QTY,10,5,12,120%,1 year,2026-10-20,TRUE",
  ].join("\n");
  const result = personPerformanceFromCsv(csv, "TrueOnline");

  assert.equal(result.people.length, 1);
  assert.equal(result.people[0].target, 10);
  assert.equal(result.people[0].actualRunrate, 12);
  assert.equal(result.people[0].runrateAchievement, 1.2);
  assert.equal(result.people[0].shopName, "True Shop Central World 4Fl.");
});

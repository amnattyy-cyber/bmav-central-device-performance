import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("provides four independent product datasets", async () => {
  const data = JSON.parse(await readFile(new URL("app/sales-product-data.json", root), "utf8"));
  assert.deepEqual(data.products, ["Device", "GIA", "Postpay", "TrueOnline"]);
  assert.equal(data.branches.length, 17);
  assert.equal(data.meta.asOf, "2026-08-03");
  for (const branch of data.branches) {
    for (const product of data.products) {
      assert.ok(branch.products[product]);
      assert.equal(typeof branch.products[product].target, "number");
      assert.equal(typeof branch.products[product].runrate, "number");
      assert.ok(Array.isArray(branch.products[product].daily));
      assert.equal(branch.products[product].daily.length, 3);
    }
  }
});

test("dashboard exposes product, branch, and optional date filters", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(page, /Product Performance Monitor/);
  assert.match(page, /ไม่รวมยอดข้าม Product/);
  assert.match(page, /setProduct/);
  assert.match(page, /setBranchName/);
  assert.match(page, /setDateFilter/);
  assert.match(page, /ทุกวัน \(ยอดสะสมถึง 03 Aug\)/);
  assert.match(page, /เฉพาะวันที่/);
  assert.match(page, /Runrate %/);
  assert.doesNotMatch(page, /฿/);
  assert.match(page, /หน่วย: บาท/);
  assert.match(css, /td \{[^}]*font-size:\s*13px/);
  assert.match(css, /th \{[^}]*font-size:\s*12px/);
});

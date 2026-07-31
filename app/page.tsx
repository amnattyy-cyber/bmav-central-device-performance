"use client";

import { useMemo, useState } from "react";
import data from "./sales-analysis.json";

type BrandRow = {
  brand: string;
  target: number;
  rr: number;
  ach: number | null;
  prev: number;
  mom: number | null;
  targetQty: number;
  rrQty: number;
  achQty: number | null;
  prevQty: number;
  momQty: number | null;
};

type Branch = {
  shop: string;
  type: string;
  target: number;
  rr: number;
  ach: number | null;
  prev: number;
  mom: number | null;
  targetQty: number;
  rrQty: number;
  achQty: number | null;
  prevQty: number;
  momQty: number | null;
  brands: BrandRow[];
};

const branches = (data.branchBrands as Branch[]).filter((branch) => branch.target > 0);
const types = ["ทั้งหมด", ...Array.from(new Set(branches.map((b) => b.type)))];
const brands = ["ทุกแบรนด์", ...Array.from(new Set(branches.flatMap((b) => b.brands.map((x) => x.brand))))];

const fmtMoney = (value: number) =>
  new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const fmtNumber = (value: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
const fmtPct = (value: number | null, digits = 1) => value == null ? "—" : `${(value * 100).toFixed(digits)}%`;
const shortShop = (name: string) => name
  .replace("True Shop ", "")
  .replace("True Kiosk ", "Kiosk ")
  .replace("True Shop at ", "")
  .replace("True Shop Station ", "Station ");

function sum(rows: BrandRow[]) {
  const target = rows.reduce((a, b) => a + b.target, 0);
  const rr = rows.reduce((a, b) => a + b.rr, 0);
  const prev = rows.reduce((a, b) => a + b.prev, 0);
  const targetQty = rows.reduce((a, b) => a + b.targetQty, 0);
  const rrQty = rows.reduce((a, b) => a + b.rrQty, 0);
  const prevQty = rows.reduce((a, b) => a + b.prevQty, 0);
  return {
    target, rr, prev,
    ach: target > 0 ? rr / target : null,
    mom: prev > 0 ? rr / prev - 1 : null,
    targetQty, rrQty, prevQty,
    achQty: targetQty > 0 ? rrQty / targetQty : null,
    momQty: prevQty > 0 ? rrQty / prevQty - 1 : null,
  };
}

function status(ach: number | null, mom: number | null) {
  if (ach == null) return "zero";
  if (ach >= 0.9) return "good";
  if (ach < 0.5 || (mom != null && mom <= -0.2)) return "watch";
  return "push";
}

export default function Home() {
  const [typeFilter, setTypeFilter] = useState("ทั้งหมด");
  const [shopFilter, setShopFilter] = useState("ทุกสาขา");
  const [brandFilter, setBrandFilter] = useState("ทุกแบรนด์");

  const availableBranches = useMemo(() =>
    branches.filter((b) => typeFilter === "ทั้งหมด" || b.type === typeFilter), [typeFilter]);

  const selectedBranches = useMemo(() =>
    availableBranches.filter((b) => shopFilter === "ทุกสาขา" || b.shop === shopFilter),
    [availableBranches, shopFilter]);

  const branchPerformance = useMemo(() => selectedBranches.map((b) => {
    const rows = brandFilter === "ทุกแบรนด์" ? b.brands : b.brands.filter((x) => x.brand === brandFilter);
    return { ...b, ...sum(rows), rows };
  }).sort((a, b) => (b.ach ?? -1) - (a.ach ?? -1)), [selectedBranches, brandFilter]);

  const metrics = useMemo(() => sum(branchPerformance.flatMap((b) => b.rows)), [branchPerformance]);

  const brandPerformance = useMemo(() => brands.slice(1).map((brand) => {
    const rows = selectedBranches.flatMap((b) => b.brands.filter((x) => x.brand === brand));
    const zero = selectedBranches.filter((b) => {
      const row = b.brands.find((x) => x.brand === brand);
      return row && row.target > 0 && row.rr === 0;
    }).map((b) => b.shop);
    return { brand, ...sum(rows), zero, active: rows.filter((x) => x.rr > 0).length };
  }).filter((b) => b.target > 0).sort((a, b) => (b.ach ?? -1) - (a.ach ?? -1)), [selectedBranches]);

  const typePerformance = useMemo(() => types.slice(1).map((type) => {
    const rows = branchPerformance.filter((b) => b.type === type).flatMap((b) => b.rows);
    return { type, shops: branchPerformance.filter((b) => b.type === type).length, ...sum(rows) };
  }).filter((x) => x.shops > 0).sort((a, b) => (b.ach ?? -1) - (a.ach ?? -1)), [branchPerformance]);

  const topBrand = brandPerformance[0];
  const bottomBrand = [...brandPerformance].filter((x) => x.target > 0).sort((a, b) => (a.ach ?? 99) - (b.ach ?? 99))[0];
  const goodBranches = branchPerformance.filter((b) => status(b.ach, b.mom) === "good");
  const pushBranches = branchPerformance.filter((b) => status(b.ach, b.mom) === "push");
  const watchBranches = branchPerformance.filter((b) => status(b.ach, b.mom) === "watch" || status(b.ach, b.mom) === "zero");
  const gap = Math.max(0, metrics.target - metrics.rr);
  const maxAch = Math.max(1, ...branchPerformance.map((b) => b.ach ?? 0));
  const scopeLabel = [typeFilter, shopFilter, brandFilter].filter((x) => !["ทั้งหมด", "ทุกสาขา", "ทุกแบรนด์"].includes(x)).join(" · ") || "ภาพรวมพื้นที่";

  const resetFilters = () => {
    setTypeFilter("ทั้งหมด");
    setShopFilter("ทุกสาขา");
    setBrandFilter("ทุกแบรนด์");
  };

  return (
    <main>
      <header className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse" /> DEVICE PERFORMANCE • BMAV–CENTRAL</div>
          <h1>Focus Device By Brand</h1>
          <p>วิเคราะห์ยอดขายรายสาขาและรายแบรนด์ • As of 30 July 2026</p>
        </div>
        <div className="hero-badge">
          <span>WW · Wire &amp; Wireless</span>
          <strong>15</strong>
          <small>สาขาที่มี Target</small>
        </div>
      </header>

      <section className="filter-panel" aria-label="ตัวกรองแดชบอร์ด">
        <label><span>ประเภทสาขา</span><select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setShopFilter("ทุกสาขา"); }}>{types.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label><span>สาขา</span><select value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}><option>ทุกสาขา</option>{availableBranches.map((x) => <option key={x.shop}>{x.shop}</option>)}</select></label>
        <label><span>แบรนด์</span><select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>{brands.map((x) => <option key={x}>{x}</option>)}</select></label>
        <button className="reset" onClick={resetFilters}>ล้างตัวกรอง</button>
        <div className="scope"><span>มุมมองปัจจุบัน</span><strong>{scopeLabel}</strong></div>
      </section>

      <section className="kpi-grid" aria-label="KPI ภาพรวม">
        <article className="kpi primary"><span>ยอดขาย RR</span><strong>฿{fmtMoney(metrics.rr)}</strong><small>Target ฿{fmtMoney(metrics.target)}</small></article>
        <article className="kpi"><span>%Ach มูลค่า</span><strong>{fmtPct(metrics.ach)}</strong><div className="mini-track"><i style={{ width: `${Math.min(100, (metrics.ach ?? 0) * 100)}%` }} /></div></article>
        <article className={`kpi ${metrics.mom != null && metrics.mom >= 0 ? "positive" : "negative"}`}><span>MOM มูลค่า</span><strong>{metrics.mom != null && metrics.mom >= 0 ? "+" : ""}{fmtPct(metrics.mom)}</strong><small>เทียบเดือนก่อน ฿{fmtMoney(metrics.prev)}</small></article>
        <article className="kpi"><span>%Ach จำนวนเครื่อง</span><strong>{fmtPct(metrics.achQty)}</strong><small>RR {fmtNumber(metrics.rrQty)} / TG {fmtNumber(metrics.targetQty)}</small></article>
        <article className="kpi alert"><span>Gap to Target</span><strong>฿{fmtMoney(gap)}</strong><small>{gap === 0 ? "เกินเป้าแล้ว" : "มูลค่าที่ต้องเร่งปิด"}</small></article>
      </section>

      <section className="executive-grid">
        <article className="insight-card">
          <div className="section-title"><div><span>AUTO EXECUTIVE INSIGHT</span><h2>ข้อมูลเชิงลึกสำหรับผู้บริหาร</h2></div><b>อัปเดตตามตัวกรอง</b></div>
          <div className="insight-list">
            <div className="insight-item overview"><i>01</i><div><h3>ภาพรวม</h3><p>ทำได้ <strong>{fmtPct(metrics.ach)}</strong> ของเป้า และ MOM <strong className={metrics.mom != null && metrics.mom >= 0 ? "up" : "down"}>{metrics.mom != null && metrics.mom >= 0 ? "+" : ""}{fmtPct(metrics.mom)}</strong>{gap > 0 ? ` ยังมี Gap ฿${fmtMoney(gap)}` : " ปิดเป้าได้แล้ว"}</p></div></div>
            <div className="insight-item good"><i>02</i><div><h3>สาขาที่ทำผลงานได้ดี</h3><p>{goodBranches.length ? goodBranches.slice(0, 3).map((b) => `${shortShop(b.shop)} ${fmtPct(b.ach)}`).join(" • ") : "ยังไม่มีสาขาที่แตะระดับ 90% ในมุมมองนี้"}</p></div></div>
            <div className="insight-item push"><i>03</i><div><h3>สาขาที่ควรเร่งติดตาม</h3><p>{pushBranches.length ? pushBranches.slice(0, 3).map((b) => `${shortShop(b.shop)} ${fmtPct(b.ach)}`).join(" • ") : "ไม่มีสาขาในช่วงเร่งติดตาม"}</p></div></div>
            <div className="insight-item watch"><i>04</i><div><h3>สาขาเฝ้าระวัง</h3><p>{watchBranches.length ? watchBranches.slice(0, 3).map((b) => `${shortShop(b.shop)} ${fmtPct(b.ach)}`).join(" • ") : "ไม่พบสาขาเฝ้าระวังในมุมมองนี้"}</p></div></div>
            <div className="insight-item trend"><i>05</i><div><h3>แนวโน้มที่น่าสนใจ</h3><p>{topBrand ? `${topBrand.brand} นำที่ ${fmtPct(topBrand.ach)} / MOM ${topBrand.mom != null && topBrand.mom >= 0 ? "+" : ""}${fmtPct(topBrand.mom)}` : "ไม่มีข้อมูลแบรนด์"}{bottomBrand ? ` ขณะที่ ${bottomBrand.brand} อยู่ที่ ${fmtPct(bottomBrand.ach)}` : ""}</p></div></div>
          </div>
        </article>

        <aside className="action-card">
          <span className="action-label">NEXT BEST ACTIONS</span>
          <h2>ข้อเสนอแนะเชิงปฏิบัติการ</h2>
          <ol>
            <li><b>ปิด Gap จากสาขาหลัก</b><span>{watchBranches[0] ? `โฟกัส ${shortShop(watchBranches[0].shop)} ก่อน โดยติดตามยอดรายวันเทียบเป้า` : "รักษา run rate ของสาขานำและเพิ่ม cross-sell"}</span></li>
            <li><b>แก้ Brand Gap ที่กระทบสูง</b><span>{bottomBrand ? `ทำ action plan ${bottomBrand.brand}: stock, display, lead list และ conversion รายคน` : "ทบทวนแบรนด์ที่ต่ำกว่าเป้ารายสาขา"}</span></li>
            <li><b>ถอดสูตรจากจุดแข็ง</b><span>{topBrand ? `นำ playbook ${topBrand.brand} จากสาขา %Ach สูง ไปทดลองในกลุ่มเร่งติดตาม` : "แชร์แนวทางจากสาขาผลงานดี"}</span></li>
          </ol>
          <div className="daily-callout"><span>เป้าหมายบริหาร</span><strong>{gap > 0 ? `เร่งปิด ฿${fmtMoney(gap)}` : "รักษาระดับเหนือเป้า"}</strong><small>จากมุมมองปัจจุบัน</small></div>
        </aside>
      </section>

      <section className="two-col">
        <article className="panel">
          <div className="section-title"><div><span>BRANCH RANKING</span><h2>Performance By สาขา</h2></div><b>เรียงตาม %Ach Brand</b></div>
          <div className="branch-bars">
            {branchPerformance.map((b, index) => <div className="bar-row" key={b.shop}>
              <div className="rank">{String(index + 1).padStart(2, "0")}</div>
              <div className="bar-main"><div className="bar-label"><strong>{shortShop(b.shop)}</strong><span>{b.type}</span></div><div className="track"><i className={status(b.ach, b.mom)} style={{ width: `${Math.min(100, ((b.ach ?? 0) / maxAch) * 100)}%` }} /></div></div>
              <div className="bar-value"><strong>{fmtPct(b.ach)}</strong><span className={b.mom != null && b.mom >= 0 ? "up" : "down"}>{b.mom != null && b.mom >= 0 ? "+" : ""}{fmtPct(b.mom)} MOM</span></div>
            </div>)}
          </div>
        </article>

        <article className="panel brands-panel">
          <div className="section-title"><div><span>BRAND SCORECARD</span><h2>Top / Bottom Brand</h2></div><b>{selectedBranches.length} สาขาในมุมมอง</b></div>
          {topBrand && <div className="brand-hero top"><span>TOP BRAND</span><div><strong>{topBrand.brand}</strong><b>{fmtPct(topBrand.ach)}</b></div><small>MOM {topBrand.mom != null && topBrand.mom >= 0 ? "+" : ""}{fmtPct(topBrand.mom)} · RR ฿{fmtMoney(topBrand.rr)}</small></div>}
          {bottomBrand && <div className="brand-hero bottom"><span>BOTTOM BRAND</span><div><strong>{bottomBrand.brand}</strong><b>{fmtPct(bottomBrand.ach)}</b></div><small>MOM {bottomBrand.mom != null && bottomBrand.mom >= 0 ? "+" : ""}{fmtPct(bottomBrand.mom)} · ขายไม่ได้ {bottomBrand.zero.length} สาขา</small></div>}
          <div className="brand-list">{brandPerformance.map((b) => <div key={b.brand}><strong>{b.brand}</strong><span>{fmtPct(b.ach)}</span><i><em style={{ width: `${Math.min(100, (b.ach ?? 0) * 100)}%` }} /></i><small className={b.mom != null && b.mom >= 0 ? "up" : "down"}>{b.mom != null && b.mom >= 0 ? "+" : ""}{fmtPct(b.mom)} MOM</small></div>)}</div>
        </article>
      </section>

      <section className="panel area-panel">
        <div className="section-title"><div><span>SHOP TYPE VIEW</span><h2>ผลงานรายพื้นที่ / ประเภทสาขา</h2></div><b>มูลค่า RR เทียบ Target</b></div>
        <div className="type-grid">{typePerformance.map((x) => <article key={x.type}><span>{x.type}</span><strong>{fmtPct(x.ach)}</strong><div><i style={{ width: `${Math.min(100, (x.ach ?? 0) * 100)}%` }} /></div><p><b>RR ฿{fmtMoney(x.rr)}</b><small>{x.shops} สาขา · MOM {x.mom != null && x.mom >= 0 ? "+" : ""}{fmtPct(x.mom)}</small></p></article>)}</div>
      </section>

      <section className="panel branch-table-panel">
        <div className="section-title"><div><span>BRANCH × BRAND DIAGNOSTIC</span><h2>วิเคราะห์รายสาขา By Brand</h2></div><b>จุดแข็ง · จุดตก · No Sales</b></div>
        <div className="table-wrap"><table><thead><tr><th>สาขา</th><th>%Ach</th><th>MOM</th><th>Brand ทำได้ดี</th><th>MOM ตกมากสุด</th><th>ขายไม่ได้ (มี Target)</th><th>สถานะ</th></tr></thead>
          <tbody>{branchPerformance.map((b) => {
            const targeted = b.rows.filter((x) => x.target > 0);
            const best = [...targeted].filter((x) => x.rr > 0).sort((a, c) => (c.ach ?? -1) - (a.ach ?? -1))[0];
            const fall = [...targeted].filter((x) => x.mom != null).sort((a, c) => (a.mom ?? 99) - (c.mom ?? 99))[0];
            const noSales = targeted.filter((x) => x.rr === 0).map((x) => x.brand);
            const s = status(b.ach, b.mom);
            return <tr key={b.shop}><td><strong>{shortShop(b.shop)}</strong><small>{b.type}</small></td><td><b>{fmtPct(b.ach)}</b></td><td className={b.mom != null && b.mom >= 0 ? "up" : "down"}>{b.mom != null && b.mom >= 0 ? "+" : ""}{fmtPct(b.mom)}</td><td>{best ? <><b>{best.brand}</b><small>{fmtPct(best.ach)}</small></> : "—"}</td><td>{fall ? <><b>{fall.brand}</b><small className="down">{fmtPct(fall.mom)}</small></> : "—"}</td><td><div className="chips">{noSales.length ? noSales.map((x) => <span key={x}>{x}</span>) : <em>ไม่มี</em>}</div></td><td><span className={`status ${s}`}>{s === "good" ? "ทำได้ดี" : s === "push" ? "เร่งติดตาม" : s === "watch" ? "เฝ้าระวัง" : "ไม่มีเป้า"}</span></td></tr>;
          })}</tbody></table></div>
      </section>

      <section className="data-note">
        <div><strong>นิยามและขอบเขตที่ยืนยันแล้ว</strong><p>วิเคราะห์เฉพาะ 15 สาขาที่มี Target • RR NET AMOUNT / RR QTY คือ Run Rate ที่ใช้วัด %Ach และ MOM • ตัด The Eight Thonglor ซึ่ง Target = 0 ออกจาก KPI และการจัดอันดับ</p></div>
        <div><strong>เกณฑ์สถานะ</strong><p>ทำผลงานดี ≥ 90% • ควรเร่งติดตาม 50–89.9% • เฝ้าระวัง &lt; 50% หรือ MOM ลดลงตั้งแต่ 20% • ขายไม่ได้ = มี Target แต่ RR เท่ากับ 0</p></div>
      </section>

      <footer><span>BMAV–Central Device Performance</span><b>Source: data - 2026-07-31T171528.459.xlsx</b></footer>
    </main>
  );
}

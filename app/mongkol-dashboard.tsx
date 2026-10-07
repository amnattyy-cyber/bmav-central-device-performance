"use client";

import { useMemo, useState } from "react";
import mongkolFallback from "./mongkol-data.json";
import type { MongkolData } from "./mongkol-data";

const data = mongkolFallback as MongkolData;
const money = (value: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const shortShop = (name: string) => name
  .replace("True Shop Station ", "Station ")
  .replace("True Shop at ", "")
  .replace("True Shop ", "")
  .replace("True Kiosk ", "Kiosk ");

export default function MongkolDashboard() {
  const [mode, setMode] = useState<"area" | "indy">("area");
  const [captureMode, setCaptureMode] = useState(false);
  const [nameQuery, setNameQuery] = useState("");
  const filteredNames = useMemo(() => data.indies.filter((name) => name.includes(nameQuery.trim())), [nameQuery]);
  const totals = data.areas.reduce((total, area) => ({
    target: total.target + area.target,
    actual: total.actual + area.actual,
    forecast: total.forecast + area.rrEndMonth,
    noSale: total.noSale + area.noSaleCount,
    indyCount: total.indyCount + area.indyCount,
  }), { target: 0, actual: 0, forecast: 0, noSale: 0, indyCount: 0 });
  const asOfDate = new Date(`${data.meta.asOf}T00:00:00+07:00`);
  const asOfDisplay = Number.isNaN(asOfDate.valueOf()) ? "—" : asOfDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const backHref = typeof window !== "undefined" && window.location.pathname.includes("bmav-central-device-performance")
    ? "/bmav-central-device-performance/#/"
    : "/";

  return <main className={`mongkol-page${captureMode ? " mongkol-capture-mode" : ""}`}>
    <section className="panel mongkol-panel" aria-label="Dashboard เบอร์มงคล">
      <div className="section-head mongkol-heading">
        <div><span>OCTOBER 2026 • SPECIAL NUMBER PERFORMANCE</span><h1>Dashboard เบอร์มงคล</h1><p>{data.meta.area} • ข้อมูล ณ {asOfDisplay} • Snapshot จากไฟล์ต้นทาง</p></div>
        <div className="mongkol-actions">
          <a href="https://docs.google.com/spreadsheets/d/1HnloV7TpFMWDrHgcCEUTaJKKDz2Zgb8WjQPCSvfn-Ns/edit#gid=1992762098">Google Sheet</a>
          <a href={backHref}>กลับ Dashboard หลัก</a>
        </div>
      </div>
      <div className="mongkol-kpis">
        <article><span>Target เดือน</span><strong>{money(totals.target)} QTY</strong></article>
        <article><span>Actual ถึง 6 ต.ค.</span><strong>{money(totals.actual)} QTY</strong></article>
        <article><span>%ACH</span><strong>{percent(totals.target ? totals.actual / totals.target : 0)}</strong></article>
        <article><span>Forecast สิ้นเดือน</span><strong>{money(totals.forecast)} QTY</strong></article>
        <article><span>No Sale</span><strong>{money(totals.noSale)} / {money(totals.indyCount)}</strong><small>Indy</small></article>
      </div>
      <div className="mongkol-toolbar">
        <div className="mongkol-tabs" role="group" aria-label="เลือกมุมมองเบอร์มงคล">
          <button type="button" className={mode === "area" ? "active" : ""} onClick={() => setMode("area")}>มุม AREA</button>
          <button type="button" className={mode === "indy" ? "active" : ""} onClick={() => setMode("indy")}>ราย Indy</button>
        </div>
        <small>{mode === "area" ? `${data.areas.length} สาขา • สรุปยอดรายสาขา` : `${data.indies.length} รายชื่อ`}</small>
        {mode === "area" && <button type="button" className="capture-toggle mongkol-capture-toggle" aria-pressed={captureMode} onClick={() => setCaptureMode((value) => !value)}>{captureMode ? "กลับหน้าปกติ" : "Capture ครบทุกสาขา"}</button>}
      </div>
      {mode === "area" ? <div className="table-wrap mongkol-table-wrap"><table className="mongkol-table"><thead><tr><th>Rank</th><th>สาขา</th><th>Target</th><th>Actual MTD</th><th>%ACH</th><th>RR สิ้นเดือน</th><th>Indy</th><th>No Sale</th></tr></thead><tbody>
        {[...data.areas].sort((a, b) => b.achievement - a.achievement || b.actual - a.actual || a.branch.localeCompare(b.branch, "th")).map((area, index) => <tr key={area.branch}><td>{String(index + 1).padStart(2, "0")}</td><td><strong>{shortShop(area.branch)}</strong></td><td>{money(area.target)} QTY</td><td><b>{money(area.actual)} QTY</b></td><td><strong>{percent(area.achievement)}</strong></td><td>{money(area.rrEndMonth)} QTY</td><td>{area.indyCount}</td><td>{area.noSaleCount}</td></tr>)}
      </tbody><tfoot><tr><th colSpan={2}>รวม {data.meta.area}</th><td>{money(totals.target)} QTY</td><td>{money(totals.actual)} QTY</td><td>{percent(totals.target ? totals.actual / totals.target : 0)}</td><td>{money(totals.forecast)} QTY</td><td>{totals.indyCount}</td><td>{totals.noSale}</td></tr></tfoot></table><p className="mongkol-privacy-note">ตาราง AREA สรุปยอดรายสาขา โดยรวม Target 1,905 QTY จากข้อมูลราย Indy ครบ 16 สาขา</p></div> : <>
      <div className="mongkol-indy-summary">
        <article className="indy-total"><span>Indy ทั้งหมด</span><strong>{data.indySummary.count}</strong><small>Target รวม {money(totals.target)} QTY • Actual {money(totals.actual)} QTY</small></article>
        <article className="indy-no-sale"><span>No Sale</span><strong>{data.indySummary.noSale}</strong><small>Indy ที่ยังไม่มียอด</small></article>
        <article className="indy-risk"><span>At Risk</span><strong>{data.indySummary.atRisk}</strong><small>มียอด แต่ Forecast ต่ำกว่า 85% ของ Target</small></article>
        <article className="indy-watch"><span>Watch</span><strong>{data.indySummary.watch}</strong><small>Forecast 85–99.9% ของ Target</small></article>
        <article className="indy-track"><span>On Track</span><strong>{data.indySummary.onTrack}</strong><small>Forecast ถึง Target</small></article>
      </div>
      <div className="mongkol-indy-directory">
        <div className="mongkol-indy-directory-head"><h2>รายชื่อ Indy</h2><label><span className="sr-only">ค้นหาชื่อ Indy</span><input aria-label="ค้นหาชื่อ Indy" placeholder="ค้นหาชื่อ" value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} /></label></div>
        <div className="table-wrap mongkol-indy-name-wrap"><table className="mongkol-indy-name-table"><thead><tr><th>ชื่อพนักงาน</th></tr></thead><tbody>
          {filteredNames.map((name) => <tr key={name}><td>{name}</td></tr>)}
        </tbody></table></div>
      </div>
      </>}
    </section>
  </main>;
}

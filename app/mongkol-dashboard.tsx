"use client";

import { useEffect, useMemo, useState } from "react";
import mongkolFallback from "./mongkol-data.json";
import type { MongkolData } from "./mongkol-data";
import { loadMongkolGoogleSheetData } from "./mongkol-google-sheet";

const fallbackData = mongkolFallback as MongkolData;
const money = (value: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const indyPercent = (value: number) => value === 0 ? "0%" : percent(value);
const shortShop = (name: string) => name
  .replace("True Shop Station ", "Station ")
  .replace("True Shop at ", "")
  .replace("True Shop ", "")
  .replace("True Kiosk ", "Kiosk ");

export default function MongkolDashboard() {
  const [data, setData] = useState<MongkolData>(fallbackData);
  const [syncSource, setSyncSource] = useState<"sheet" | "fallback">("fallback");
  const [mode, setMode] = useState<"area" | "indy">("area");
  const [captureMode, setCaptureMode] = useState(false);
  const [nameQuery, setNameQuery] = useState("");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const sync = async () => {
      try {
        const nextData = await loadMongkolGoogleSheetData(fallbackData, controller.signal);
        if (active) {
          setData(nextData);
          setSyncSource("sheet");
        }
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Mongkol Google Sheet sync unavailable; using bundled data.", error);
          setSyncSource("fallback");
        }
      }
    };
    void sync();
    const interval = window.setInterval(sync, 5 * 60 * 1000);
    const onVisibility = () => { if (document.visibilityState === "visible") void sync(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  const filteredIndies = useMemo(() => {
    const query = nameQuery.trim().toLocaleLowerCase();
    return data.indies.filter((indy) => [indy.firstName, indy.lastName, indy.employeeType, indy.shopCode, indy.shopName, indy.shopType]
      .some((value) => value.toLocaleLowerCase().includes(query)));
  }, [nameQuery]);
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
        <div><span>OCTOBER 2026 • SPECIAL NUMBER PERFORMANCE</span><h1>Dashboard เบอร์มงคล</h1><p>{data.meta.area} • ข้อมูล ณ {asOfDisplay} • {syncSource === "sheet" ? "Google Sheet Live • อัปเดตทุก 5 นาที" : "ข้อมูลสำรอง • Google Sheet ยังไม่พร้อมใช้งาน"}</p></div>
        <div className="mongkol-actions">
          <a href="https://docs.google.com/spreadsheets/d/1HnloV7TpFMWDrHgcCEUTaJKKDz2Zgb8WjQPCSvfn-Ns/edit">Google Sheet</a>
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
        <div className="mongkol-indy-directory-head"><h2>ราย Indy • ข้อมูล 1–6 Oct</h2><label><span className="sr-only">ค้นหา Indy</span><input aria-label="ค้นหา Indy" placeholder="ค้นหาชื่อหรือสาขา" value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} /></label></div>
        <div className="table-wrap mongkol-indy-name-wrap"><table className="mongkol-indy-name-table"><thead><tr>
          <th>name_eng</th><th>sname_eng</th><th>emp_type_2</th><th>shop_code</th><th>Shop Name</th><th>Shop Type</th><th>Target</th>
          {Array.from({ length: 6 }, (_, index) => <th key={`d${index + 1}`}>D{index + 1}</th>)}
          <th>Actual<br />{data.meta.actualLabel || "1–6 Oct"}</th><th>%ACH</th>
        </tr></thead><tbody>
          {filteredIndies.map((indy, index) => <tr key={`${indy.firstName}-${indy.lastName}-${indy.shopCode}-${index}`}>
            <td>{indy.firstName}</td><td>{indy.lastName}</td><td>{indy.employeeType}</td><td>{indy.shopCode}</td><td>{indy.shopName}</td><td>{indy.shopType}</td><td>{money(indy.target)}</td>
            {indy.daily.map((qty, dayIndex) => <td key={`${indy.shopCode}-d${dayIndex + 1}`}>{qty ? money(qty) : "–"}</td>)}
            <td>{indy.actual ? money(indy.actual) : "–"}</td><td><strong>{indyPercent(indy.achievement)}</strong></td>
          </tr>)}
        </tbody></table></div>
      </div>
      </>}
    </section>
  </main>;
}

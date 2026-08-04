"use client";

import { useEffect, useMemo, useState } from "react";
import fallbackData from "./sales-product-data.json";
import { type Branch, type DashboardData, loadGoogleSheetData, type ProductName } from "./google-sheet-data";

const ALL_BRANCHES = "ทุกสาขา";
const ALL_DAYS = "all";
const productMeta: Record<ProductName, { color: string; accent: string; short: string }> = {
  Device: { color: "#2563eb", accent: "#dbeafe", short: "DEV" },
  GIA: { color: "#8e44ad", accent: "#f3e8ff", short: "GIA" },
  Postpay: { color: "#f59e0b", accent: "#fef3c7", short: "POST" },
  TrueOnline: { color: "#00a8e8", accent: "#cffafe", short: "TOL" },
};

const money = (value: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const shortShop = (name: string) => name
  .replace("True Shop Station ", "Station ")
  .replace("True Shop at ", "")
  .replace("True Shop ", "")
  .replace("True Kiosk ", "Kiosk ");

function status(pace: number) {
  if (pace >= 1) return { key: "ontrack", label: "On Track" };
  if (pace >= 0.85) return { key: "watch", label: "Watch" };
  return { key: "atrisk", label: "At Risk" };
}

export default function Home() {
  const [data, setData] = useState<DashboardData>(fallbackData as DashboardData);
  const [syncSource, setSyncSource] = useState<"sheet" | "fallback">("fallback");
  const [product, setProduct] = useState<ProductName>("Device");
  const [branchName, setBranchName] = useState(ALL_BRANCHES);
  const [dateFilter, setDateFilter] = useState(ALL_DAYS);
  const [captureMode, setCaptureMode] = useState(false);
  const productNames = data.products;
  const branches = data.branches as Branch[];
  const asOfDay = Number(data.meta.asOf.slice(-2));
  const asOfDate = new Date(`${data.meta.asOf}T00:00:00+07:00`);
  const shortMonth = asOfDate.toLocaleDateString("en-GB", { month: "short" });
  const monthYear = data.meta.month;
  const selectedDay = dateFilter === ALL_DAYS ? null : Number(dateFilter);
  const periodDay = selectedDay ?? asOfDay;
  const periodDays = selectedDay === null ? asOfDay : 1;
  const isDailyView = selectedDay !== null;
  const theme = productMeta[product];
  const isQtyProduct = product === "TrueOnline";
  const displayValue = (value: number) => `${money(value)}${isQtyProduct ? " QTY" : ""}`;

  const targetedBranches = useMemo(
    () => branches.filter((branch) => branch.products[product].target > 0),
    [product],
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const sync = async () => {
      try {
        const nextData = await loadGoogleSheetData(controller.signal);
        if (active) {
          setData(nextData);
          setSyncSource("sheet");
        }
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Google Sheet sync unavailable; using bundled dashboard data.", error);
          setSyncSource("fallback");
        }
      }
    };

    void sync();
    const interval = window.setInterval(sync, 5 * 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (branchName !== ALL_BRANCHES && !targetedBranches.some((branch) => branch.name === branchName)) {
      setBranchName(ALL_BRANCHES);
    }
  }, [branchName, targetedBranches]);

  const selectedBranches = useMemo(
    () => branchName === ALL_BRANCHES ? targetedBranches : targetedBranches.filter((branch) => branch.name === branchName),
    [branchName, targetedBranches],
  );

  const metrics = useMemo(() => {
    const target = selectedBranches.reduce((sum, branch) => sum + branch.products[product].target, 0);
    const daily = Array.from({ length: data.meta.daysInMonth }, (_, index) =>
      selectedBranches.reduce((sum, branch) => sum + (branch.products[product].daily[index] ?? 0), 0));
    const mtd = isDailyView
      ? daily[periodDay - 1] ?? 0
      : daily.slice(0, asOfDay).reduce((sum, value) => sum + value, 0);
    const today = daily[periodDay - 1] ?? 0;
    const targetMtd = target * periodDays / data.meta.daysInMonth;
    const pace = targetMtd > 0 ? mtd / targetMtd : 0;
    const forecast = periodDays > 0 ? mtd / periodDays * data.meta.daysInMonth : 0;
    const achievement = target > 0 ? mtd / target : 0;
    const runrate = selectedBranches.reduce((sum, branch) => sum + branch.products[product].runrate, 0);
    const runrateAchievement = target > 0 ? runrate / target : 0;
    return { target, daily, mtd, today, targetMtd, pace, forecast, achievement, runrate, runrateAchievement, dailyTarget: target / data.meta.daysInMonth };
  }, [selectedBranches, product, isDailyView, periodDay, periodDays]);

  const branchPerformance = useMemo(() => targetedBranches.map((branch) => {
    const item = branch.products[product];
    const mtd = isDailyView
      ? item.daily[periodDay - 1] ?? 0
      : item.daily.slice(0, asOfDay).reduce((sum, value) => sum + value, 0);
    const targetMtd = item.target * periodDays / data.meta.daysInMonth;
    const pace = targetMtd > 0 ? mtd / targetMtd : 0;
    const forecast = periodDays > 0 ? mtd / periodDays * data.meta.daysInMonth : 0;
    const runrateAchievement = item.target > 0 ? item.runrate / item.target : 0;
    return { ...branch, target: item.target, mtd, targetMtd, pace, forecast, runrate: item.runrate, runrateAchievement, today: item.daily[periodDay - 1] ?? 0 };
  }).filter((branch) => branchName === ALL_BRANCHES || branch.name === branchName)
    .sort((a, b) => b.pace - a.pace), [targetedBranches, product, branchName, isDailyView, periodDay, periodDays]);

  const activeBranches = branchPerformance.filter((branch) => branch.target > 0);
  const onTrack = activeBranches.filter((branch) => branch.pace >= 1);
  const atRisk = activeBranches.filter((branch) => branch.pace < .85);
  const leader = activeBranches[0];
  const maxPace = Math.max(1, ...activeBranches.map((branch) => branch.pace));
  const maxDaily = Math.max(metrics.dailyTarget, ...metrics.daily.slice(0, asOfDay), 1);
  const targetLevel = Math.min(96, (metrics.dailyTarget / maxDaily) * 100);

  const reset = () => {
    setProduct("Device");
    setBranchName(ALL_BRANCHES);
    setDateFilter(ALL_DAYS);
    setCaptureMode(false);
  };

  const toggleCaptureMode = () => {
    if (!captureMode) setBranchName(ALL_BRANCHES);
    setCaptureMode((current) => !current);
  };

  return (
    <main className={captureMode ? "capture-mode" : ""} style={{ "--product": theme.color, "--product-soft": theme.accent } as React.CSSProperties}>
      <header className="hero" data-sync-source={syncSource}>
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> BMAV-CENTRAL • DAILY SALES</div>
          <h1>Product<br />Performance <em>Monitor</em></h1>
          <p>Dashboard ยอดขายรายวัน (Device/GIA : Data TSM, Post/TOL : Data Link Daily Sales)</p>
        </div>
        <div className="hero-focus">
          <span>PRODUCT IN FOCUS</span>
          <strong>{product}</strong>
          <small>{branchName === ALL_BRANCHES ? `${targetedBranches.length} สาขาที่มี Target` : shortShop(branchName)} • {syncSource === "sheet" ? "Google Sheet Live" : "ข้อมูลสำรอง"}</small>
        </div>
      </header>

      <section className="control-deck" aria-label="ตัวกรอง Dashboard">
        <div className="product-switch" role="group" aria-label="เลือก Product">
          {productNames.map((name) => <button key={name} className={product === name ? "active" : ""} onClick={() => setProduct(name)}>
            <i style={{ background: productMeta[name].color }}>{productMeta[name].short}</i><span>{name}{name === "TrueOnline" ? " (QTY)" : ""}</span>
          </button>)}
        </div>
        <label><span>สาขา</span><select value={branchName} onChange={(event) => setBranchName(event.target.value)}><option>{ALL_BRANCHES}</option>{targetedBranches.map((branch) => <option key={branch.name}>{branch.name}</option>)}</select></label>
        <label><span>เลือกวันที่</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}><option value={ALL_DAYS}>ทุกวัน (ยอดสะสมถึง {String(asOfDay).padStart(2, "0")} {shortMonth})</option>{Array.from({ length: asOfDay }, (_, index) => <option key={index + 1} value={String(index + 1)}>เฉพาะวันที่ {String(index + 1).padStart(2, "0")} {shortMonth} {asOfDate.getFullYear()}</option>)}</select></label>
        <button className="reset" onClick={reset}>ล้างตัวกรอง</button>
      </section>

      <section className="scope-strip">
        <div><span>มุมมองปัจจุบัน</span><strong>{product} • {branchName}</strong></div>
        <div><span>ช่วงวันที่</span><strong>{isDailyView ? `เฉพาะวันที่ ${String(periodDay).padStart(2, "0")} ${monthYear}` : `ทุกวัน • สะสมถึง ${String(asOfDay).padStart(2, "0")} ${monthYear}`}</strong></div>
        <div><span>หลักการคำนวณ</span><strong>เฉพาะ {product} เท่านั้น{isQtyProduct ? " • มุม QTY" : ""}</strong></div>
      </section>

      <section className="kpi-grid" aria-label="KPI ของ Product ที่เลือก">
        <article className="kpi hero-kpi"><span>{isDailyView ? `ยอดวันที่ ${String(periodDay).padStart(2, "0")} ${shortMonth}` : "ยอดสะสม MTD"}</span><strong>{displayValue(metrics.mtd)}</strong><small>{isDailyView ? "ยอดเฉพาะวันที่เลือก" : `ยอดวันที่ ${String(asOfDay).padStart(2, "0")} ${shortMonth} ${displayValue(metrics.today)}`}</small></article>
        <article className="kpi"><span>Target</span><strong>{displayValue(metrics.target)}</strong><small>เฉลี่ย {displayValue(metrics.dailyTarget)} / วัน</small></article>
        <article className="kpi"><span>%ACH</span><strong>{percent(metrics.achievement)}</strong><div className="meter"><i style={{ width: `${Math.min(100, metrics.achievement * 100)}%` }} /></div></article>
        <article className={`kpi pace ${status(metrics.pace).key}`}><span>{isDailyView ? "ACH Daily" : "ACH MTD"}</span><strong>{percent(metrics.pace)}</strong><small>{status(metrics.pace).label}</small></article>
        <article className="kpi runrate-kpi"><span>Runrate</span><strong>{displayValue(metrics.runrate)}</strong><small>จาก {isQtyProduct ? "RR QTY" : "RR Net Amount"} ในไฟล์ต้นฉบับ</small></article>
        <article className="kpi"><span>Runrate % เทียบเป้า</span><strong>{percent(metrics.runrateAchievement)}</strong><div className="meter"><i style={{ width: `${Math.min(100, metrics.runrateAchievement * 100)}%` }} /></div></article>
        <article className="kpi"><span>Forecast สิ้นเดือน</span><strong>{displayValue(metrics.forecast)}</strong><small>{percent(metrics.target ? metrics.forecast / metrics.target : 0)} ของเป้า</small></article>
        <article className="kpi"><span>Gap ถึงเป้าเดือน</span><strong>{displayValue(Math.max(0, metrics.target - metrics.mtd))}</strong><small>ยอดที่ยังต้องปิด</small></article>
      </section>

      <section className="executive-grid">
        <article className="panel insight-panel">
          <div className="section-head"><div><span>PRODUCT INTELLIGENCE</span><h2>Executive Infographic</h2></div><b>{product} • {isDailyView ? `วันที่ ${periodDay}` : `สะสม ${asOfDay} วัน`}</b></div>
          <div className="insight-grid">
            <div className="insight major"><i>01</i><div><span>ภาพรวม Product</span><strong>%Achieve {percent(metrics.pace)}</strong><p>ทำได้ {displayValue(metrics.mtd)} จากเป้าที่ควรได้ {displayValue(metrics.targetMtd)}</p></div></div>
            <div className="insight"><i>02</i><div><span>Shop Top Ranking</span><strong>{leader ? shortShop(leader.name) : "—"}</strong><p>{leader ? `%Achieve ${percent(leader.pace)} • ${displayValue(leader.mtd)}` : "ยังไม่มีเป้าหมาย"}</p></div></div>
            <div className="insight"><i>03</i><div><span>On Track</span><strong>{onTrack.length} สาขา</strong><p>{activeBranches.length ? `${Math.round(onTrack.length / activeBranches.length * 100)}% ของสาขาที่มีเป้า` : "ไม่มีสาขาที่มีเป้า"}</p></div></div>
            <div className="insight"><i>04</i><div><span>ต้องเร่ง</span><strong>{atRisk.length} สาขา</strong><p>%Achieve ต่ำกว่า 85% ของเป้าตามวัน</p></div></div>
          </div>
        </article>

        <aside className="mission-card">
          <span>DAILY MISSION</span>
          <h2>{metrics.pace >= 1 ? "รักษาจังหวะเหนือเป้า" : "เร่งปิด Gap รายวัน"}</h2>
          <div className="mission-number"><small>เป้าต่อวัน</small><strong>{displayValue(metrics.dailyTarget)}</strong></div>
          <ul>
            <li><b>วันนี้</b><span>{displayValue(metrics.today)} • {percent(metrics.dailyTarget ? metrics.today / metrics.dailyTarget : 0)}</span></li>
            <li><b>Runrate</b><span>{displayValue(metrics.runrate)} • {percent(metrics.runrateAchievement)}</span></li>
            <li><b>Forecast</b><span>{displayValue(metrics.forecast)}</span></li>
            <li><b>Priority</b><span>{atRisk[0] ? shortShop(atRisk[0].name) : "รักษาทุกสาขา"}</span></li>
          </ul>
        </aside>
      </section>

      <section className="two-col">
        <article className="panel trend-panel">
          <div className="section-head"><div><span>DAILY TREND</span><h2>ยอดรายวัน • {product}</h2></div><b>เส้นประ = เป้าเฉลี่ย/วัน</b></div>
          <div className="daily-chart" style={{ "--target-level": `${100 - targetLevel}%` } as React.CSSProperties}>
            <div className="target-line"><span>{displayValue(metrics.dailyTarget)}</span></div>
            {metrics.daily.map((value, index) => <div className={`day-bar ${index + 1 > asOfDay ? "future" : ""} ${isDailyView && index + 1 !== selectedDay ? "not-selected" : ""} ${isDailyView && index + 1 === selectedDay ? "selected" : ""}`} key={index} title={`วันที่ ${index + 1}: ${displayValue(value)}`}>
              <i style={{ height: `${Math.max(value > 0 ? 4 : 0, value / maxDaily * 100)}%` }} /><span>{index + 1}</span>
            </div>)}
          </div>
        </article>

        <article className="panel ranking-panel">
          <div className="section-head"><div><span>SHOP RANKING</span><h2>Ranking Shop</h2></div><b>{activeBranches.length} สาขาที่มี Target</b></div>
          <div className="rank-list">{activeBranches.map((branch, index) => {
            const currentStatus = status(branch.pace);
            return <div className="rank-row" key={branch.name}>
              <span className="rank-no">{String(index + 1).padStart(2, "0")}</span>
              <div><div className="rank-label"><strong>{shortShop(branch.name)}</strong><span>{currentStatus.label}</span></div><div className="rank-track"><i className={currentStatus.key} style={{ width: `${Math.min(100, branch.pace / maxPace * 100)}%` }} /></div></div>
              <b>{percent(branch.pace)}</b>
            </div>;
          })}</div>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="section-head"><div><span>BRANCH MONITOR</span><h2>{product} Performance by Branch</h2></div><div className="table-actions"><b>หน่วย: บาท • {isDailyView ? `เฉพาะวันที่ ${String(periodDay).padStart(2, "0")} Aug` : "ยอดสะสมทุกวัน"}</b><button className="capture-toggle" onClick={toggleCaptureMode}>{captureMode ? "กลับ Dashboard" : "ดูครบทุกสาขา / Copy รูป"}</button></div></div>
        <div className="table-wrap"><table><thead><tr><th>สาขา</th><th>{isDailyView ? `ยอดวันที่ ${String(periodDay).padStart(2, "0")}` : "ยอด MTD"}</th><th>Target</th><th>%ACH</th><th>{isDailyView ? "Target Daily" : "Target MTD"}</th><th>{isDailyView ? "ACH Daily" : "ACH MTD"}</th><th>Runrate</th><th>Runrate %</th><th>Forecast</th><th>สถานะ</th></tr></thead>
          <tbody>{branchPerformance.map((branch) => {
            const currentStatus = status(branch.pace);
            return <tr key={branch.name}><td><strong>{shortShop(branch.name)}</strong><small>{branch.ww ? `WW ${branch.ww}` : "รอรหัสสาขา"}</small></td><td><b>{displayValue(branch.mtd)}</b><small>{isDailyView ? "เฉพาะวันที่เลือก" : `วันที่ ${String(asOfDay).padStart(2, "0")} ${shortMonth} ${displayValue(branch.today)}`}</small></td><td>{displayValue(branch.target)}</td><td>{percent(branch.target ? branch.mtd / branch.target : 0)}</td><td>{displayValue(branch.targetMtd)}</td><td><strong>{percent(branch.pace)}</strong></td><td><b className="rr-value">{displayValue(branch.runrate)}</b></td><td><strong className={`rr-percent ${status(branch.runrateAchievement).key}`}>{percent(branch.runrateAchievement)}</strong></td><td>{displayValue(branch.forecast)}</td><td><span className={`status ${currentStatus.key}`}>{currentStatus.label}</span></td></tr>;
          })}</tbody></table></div>
      </section>

      <section className="method-note"><div><strong>หลักการแยก Product</strong><p>ทุก KPI, กราฟ, อันดับ และตารางคำนวณจาก Product ที่เลือกเพียงรายการเดียว พร้อมซ่อนสาขาที่ไม่มี Target ของ Product นั้น</p></div><div><strong>Runrate จากไฟล์ต้นฉบับ</strong><p>ใช้ค่า {isQtyProduct ? "RR QTY สำหรับ TOL" : "RR Net Amount"} แยกตาม Product และสาขา • Runrate % = Runrate ÷ Target รายเดือน</p></div></section>
      <footer><span>BMAV-Central Product Performance Monitor</span><b>Source: 8778 Aug 2026 V1.xlsx • As of {String(asOfDay).padStart(2, "0")} {shortMonth} {asOfDate.getFullYear()}</b></footer>
    </main>
  );
}

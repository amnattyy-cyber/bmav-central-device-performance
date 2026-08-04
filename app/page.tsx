"use client";

import { useMemo, useState } from "react";
import data from "./sales-product-data.json";

type ProductName = "Device" | "GIA" | "Postpay" | "TrueOnline";
type ProductValue = { target: number; daily: number[]; runrate: number };
type Branch = {
  name: string;
  tds: number | null;
  ww: number | null;
  products: Record<ProductName, ProductValue>;
};

const productNames = data.products as ProductName[];
const branches = data.branches as Branch[];
const ALL_BRANCHES = "ทุกสาขา";
const productMeta: Record<ProductName, { color: string; accent: string; short: string }> = {
  Device: { color: "#2563eb", accent: "#dbeafe", short: "DEV" },
  GIA: { color: "#8e44ad", accent: "#f3e8ff", short: "GIA" },
  Postpay: { color: "#f59e0b", accent: "#fef3c7", short: "POST" },
  TrueOnline: { color: "#00a8e8", accent: "#cffafe", short: "TOL" },
};

const money = (value: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
const compact = (value: number) => new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 }).format(value);
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
  const [product, setProduct] = useState<ProductName>("Device");
  const [branchName, setBranchName] = useState(ALL_BRANCHES);
  const [day, setDay] = useState(3);
  const theme = productMeta[product];

  const selectedBranches = useMemo(
    () => branchName === ALL_BRANCHES ? branches : branches.filter((branch) => branch.name === branchName),
    [branchName],
  );

  const metrics = useMemo(() => {
    const target = selectedBranches.reduce((sum, branch) => sum + branch.products[product].target, 0);
    const daily = Array.from({ length: data.meta.daysInMonth }, (_, index) =>
      selectedBranches.reduce((sum, branch) => sum + (branch.products[product].daily[index] ?? 0), 0));
    const mtd = daily.slice(0, day).reduce((sum, value) => sum + value, 0);
    const today = daily[day - 1] ?? 0;
    const targetMtd = target * day / data.meta.daysInMonth;
    const pace = targetMtd > 0 ? mtd / targetMtd : 0;
    const forecast = day > 0 ? mtd / day * data.meta.daysInMonth : 0;
    const achievement = target > 0 ? mtd / target : 0;
    const runrate = selectedBranches.reduce((sum, branch) => sum + branch.products[product].runrate, 0);
    const runrateAchievement = target > 0 ? runrate / target : 0;
    return { target, daily, mtd, today, targetMtd, pace, forecast, achievement, runrate, runrateAchievement, dailyTarget: target / data.meta.daysInMonth };
  }, [selectedBranches, product, day]);

  const branchPerformance = useMemo(() => branches.map((branch) => {
    const item = branch.products[product];
    const mtd = item.daily.slice(0, day).reduce((sum, value) => sum + value, 0);
    const targetMtd = item.target * day / data.meta.daysInMonth;
    const pace = targetMtd > 0 ? mtd / targetMtd : 0;
    const forecast = day > 0 ? mtd / day * data.meta.daysInMonth : 0;
    const runrateAchievement = item.target > 0 ? item.runrate / item.target : 0;
    return { ...branch, target: item.target, mtd, targetMtd, pace, forecast, runrate: item.runrate, runrateAchievement, today: item.daily[day - 1] ?? 0 };
  }).filter((branch) => branchName === ALL_BRANCHES || branch.name === branchName)
    .sort((a, b) => b.pace - a.pace), [product, branchName, day]);

  const activeBranches = branchPerformance.filter((branch) => branch.target > 0);
  const onTrack = activeBranches.filter((branch) => branch.pace >= 1);
  const atRisk = activeBranches.filter((branch) => branch.pace < .85);
  const leader = activeBranches[0];
  const maxPace = Math.max(1, ...activeBranches.map((branch) => branch.pace));
  const maxDaily = Math.max(metrics.dailyTarget, ...metrics.daily.slice(0, day), 1);
  const targetLevel = Math.min(96, (metrics.dailyTarget / maxDaily) * 100);

  const reset = () => {
    setProduct("Device");
    setBranchName(ALL_BRANCHES);
    setDay(3);
  };

  return (
    <main style={{ "--product": theme.color, "--product-soft": theme.accent } as React.CSSProperties}>
      <header className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> BMAV-CENTRAL • DAILY SALES</div>
          <h1>Product<br />Performance <em>Monitor</em></h1>
          <p>ติดตามยอดรายวันแบบแยก Product และแยกรายสาขา — ไม่รวมยอดข้าม Product</p>
        </div>
        <div className="hero-focus">
          <span>PRODUCT IN FOCUS</span>
          <strong>{product}</strong>
          <small>{branchName === ALL_BRANCHES ? `${branches.length} จุดขาย` : shortShop(branchName)}</small>
        </div>
      </header>

      <section className="control-deck" aria-label="ตัวกรอง Dashboard">
        <div className="product-switch" role="group" aria-label="เลือก Product">
          {productNames.map((name) => <button key={name} className={product === name ? "active" : ""} onClick={() => setProduct(name)}>
            <i style={{ background: productMeta[name].color }}>{productMeta[name].short}</i><span>{name}</span>
          </button>)}
        </div>
        <label><span>สาขา</span><select value={branchName} onChange={(event) => setBranchName(event.target.value)}><option>{ALL_BRANCHES}</option>{branches.map((branch) => <option key={branch.name}>{branch.name}</option>)}</select></label>
        <label><span>ยอดถึงวันที่</span><select value={day} onChange={(event) => setDay(Number(event.target.value))}>{Array.from({ length: 3 }, (_, index) => <option key={index + 1} value={index + 1}>{String(index + 1).padStart(2, "0")} Aug 2026</option>)}</select></label>
        <button className="reset" onClick={reset}>ล้างตัวกรอง</button>
      </section>

      <section className="scope-strip">
        <div><span>มุมมองปัจจุบัน</span><strong>{product} • {branchName}</strong></div>
        <div><span>ข้อมูลล่าสุด</span><strong>{String(day).padStart(2, "0")} August 2026</strong></div>
        <div><span>หลักการคำนวณ</span><strong>เฉพาะ {product} เท่านั้น</strong></div>
      </section>

      <section className="kpi-grid" aria-label="KPI ของ Product ที่เลือก">
        <article className="kpi hero-kpi"><span>ยอดสะสม MTD</span><strong>{compact(metrics.mtd)}</strong><small>ยอดวันนี้ {money(metrics.today)}</small></article>
        <article className="kpi"><span>เป้ารวมเดือน</span><strong>{compact(metrics.target)}</strong><small>เฉลี่ย {money(metrics.dailyTarget)} / วัน</small></article>
        <article className="kpi"><span>% เป้าเดือน</span><strong>{percent(metrics.achievement)}</strong><div className="meter"><i style={{ width: `${Math.min(100, metrics.achievement * 100)}%` }} /></div></article>
        <article className={`kpi pace ${status(metrics.pace).key}`}><span>Pace MTD</span><strong>{percent(metrics.pace)}</strong><small>{status(metrics.pace).label}</small></article>
        <article className="kpi runrate-kpi"><span>Runrate</span><strong>{compact(metrics.runrate)}</strong><small>จาก RR Net Amount ในไฟล์ต้นฉบับ</small></article>
        <article className="kpi"><span>Runrate % เทียบเป้า</span><strong>{percent(metrics.runrateAchievement)}</strong><div className="meter"><i style={{ width: `${Math.min(100, metrics.runrateAchievement * 100)}%` }} /></div></article>
        <article className="kpi"><span>Forecast สิ้นเดือน</span><strong>{compact(metrics.forecast)}</strong><small>{percent(metrics.target ? metrics.forecast / metrics.target : 0)} ของเป้า</small></article>
        <article className="kpi"><span>Gap ถึงเป้าเดือน</span><strong>{compact(Math.max(0, metrics.target - metrics.mtd))}</strong><small>ยอดที่ยังต้องปิด</small></article>
      </section>

      <section className="executive-grid">
        <article className="panel insight-panel">
          <div className="section-head"><div><span>PRODUCT INTELLIGENCE</span><h2>Executive Infographic</h2></div><b>{product} • Day {day}</b></div>
          <div className="insight-grid">
            <div className="insight major"><i>01</i><div><span>ภาพรวม Product</span><strong>{percent(metrics.pace)} pace</strong><p>ทำได้ {money(metrics.mtd)} จากเป้าที่ควรได้ {money(metrics.targetMtd)}</p></div></div>
            <div className="insight"><i>02</i><div><span>สาขานำ</span><strong>{leader ? shortShop(leader.name) : "—"}</strong><p>{leader ? `${percent(leader.pace)} pace • ${money(leader.mtd)}` : "ยังไม่มีเป้าหมาย"}</p></div></div>
            <div className="insight"><i>03</i><div><span>On Track</span><strong>{onTrack.length} สาขา</strong><p>{activeBranches.length ? `${Math.round(onTrack.length / activeBranches.length * 100)}% ของสาขาที่มีเป้า` : "ไม่มีสาขาที่มีเป้า"}</p></div></div>
            <div className="insight"><i>04</i><div><span>ต้องเร่ง</span><strong>{atRisk.length} สาขา</strong><p>Pace ต่ำกว่า 85% ของเป้าตามวัน</p></div></div>
          </div>
        </article>

        <aside className="mission-card">
          <span>DAILY MISSION</span>
          <h2>{metrics.pace >= 1 ? "รักษาจังหวะเหนือเป้า" : "เร่งปิด Gap รายวัน"}</h2>
          <div className="mission-number"><small>เป้าต่อวัน</small><strong>{money(metrics.dailyTarget)}</strong></div>
          <ul>
            <li><b>วันนี้</b><span>{money(metrics.today)} • {percent(metrics.dailyTarget ? metrics.today / metrics.dailyTarget : 0)}</span></li>
            <li><b>Runrate</b><span>{money(metrics.runrate)} • {percent(metrics.runrateAchievement)}</span></li>
            <li><b>Forecast</b><span>{money(metrics.forecast)}</span></li>
            <li><b>Priority</b><span>{atRisk[0] ? shortShop(atRisk[0].name) : "รักษาทุกสาขา"}</span></li>
          </ul>
        </aside>
      </section>

      <section className="two-col">
        <article className="panel trend-panel">
          <div className="section-head"><div><span>DAILY TREND</span><h2>ยอดรายวัน • {product}</h2></div><b>เส้นประ = เป้าเฉลี่ย/วัน</b></div>
          <div className="daily-chart" style={{ "--target-level": `${100 - targetLevel}%` } as React.CSSProperties}>
            <div className="target-line"><span>{compact(metrics.dailyTarget)}</span></div>
            {metrics.daily.map((value, index) => <div className={`day-bar ${index + 1 > day ? "future" : ""}`} key={index} title={`วันที่ ${index + 1}: ${money(value)}`}>
              <i style={{ height: `${Math.max(value > 0 ? 4 : 0, value / maxDaily * 100)}%` }} /><span>{index + 1}</span>
            </div>)}
          </div>
        </article>

        <article className="panel ranking-panel">
          <div className="section-head"><div><span>BRANCH PACE</span><h2>อันดับรายสาขา</h2></div><b>{activeBranches.length} สาขาที่มีเป้า</b></div>
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
        <div className="section-head"><div><span>BRANCH MONITOR</span><h2>{product} Performance by Branch</h2></div><b>หน่วย: บาท • แสดงเฉพาะ Product ที่เลือก</b></div>
        <div className="table-wrap"><table><thead><tr><th>สาขา</th><th>ยอด MTD</th><th>เป้าเดือน</th><th>% เป้าเดือน</th><th>เป้า MTD</th><th>Pace MTD</th><th>Runrate</th><th>Runrate %</th><th>Forecast</th><th>สถานะ</th></tr></thead>
          <tbody>{branchPerformance.map((branch) => {
            const currentStatus = status(branch.pace);
            return <tr key={branch.name}><td><strong>{shortShop(branch.name)}</strong><small>{branch.ww ? `WW ${branch.ww}` : "รอรหัสสาขา"}</small></td><td><b>{money(branch.mtd)}</b><small>วันนี้ {money(branch.today)}</small></td><td>{money(branch.target)}</td><td>{percent(branch.target ? branch.mtd / branch.target : 0)}</td><td>{money(branch.targetMtd)}</td><td><strong>{percent(branch.pace)}</strong></td><td><b className="rr-value">{money(branch.runrate)}</b></td><td><strong>{percent(branch.runrateAchievement)}</strong></td><td>{money(branch.forecast)}</td><td><span className={`status ${currentStatus.key}`}>{currentStatus.label}</span></td></tr>;
          })}</tbody></table></div>
      </section>

      <section className="method-note"><div><strong>หลักการแยก Product</strong><p>ทุก KPI, กราฟ, อันดับ และตารางคำนวณจาก Product ที่เลือกเพียงรายการเดียว ไม่มีการนำ Device, GIA, Postpay และ TrueOnline มารวมกัน</p></div><div><strong>Runrate จากไฟล์ต้นฉบับ</strong><p>ใช้ค่า RR Net Amount แยกตาม Product และสาขา • Runrate % = Runrate ÷ เป้ารายเดือน</p></div></section>
      <footer><span>BMAV-Central Product Performance Monitor</span><b>Source: 8778 Aug 2026 V1.xlsx • As of 03 Aug 2026</b></footer>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import fallbackJson from "./sales-product-data.json";
import {
  availableMetricsFor,
  dashboardDatasetFromData,
  DEFAULT_METRIC_BY_PRODUCT,
  loadGoogleSheetData,
  selectDashboardData,
  type DashboardData,
  type DashboardDataset,
  type MetricName,
  type ProductName,
} from "./dashboard-data";
import { calculateWow, findDefaultWowWeek, formatWowRange, WOW_WEEKS, type WowWeek } from "./wow";

const products: ProductName[] = ["Device", "GIA", "Postpay", "TrueOnline"];
const titles: Record<ProductName, string> = { Device: "DEVICE", GIA: "GIA", Postpay: "POSTPAY", TrueOnline: "TOL" };
const productColors: Record<ProductName, string> = { Device: "#2563eb", GIA: "#8e44ad", Postpay: "#f59e0b", TrueOnline: "#00a8e8" };
const units: Record<MetricName, string> = { Net: "บาท", Qty: "QTY" };
const metricNames: Record<MetricName, string> = { Net: "Net Amount", Qty: "QTY" };
const fallbackData = fallbackJson as DashboardData;
const fallbackDataset = dashboardDatasetFromData(fallbackData);
const fmt = (value: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
const pct = (value: number | null) => value === null ? "—" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
const ratio = (value: number) => `${(value * 100).toFixed(1)}%`;

type Summary = {
  product: ProductName;
  metric: MetricName;
  target: number;
  actual: number;
  runrate: number;
  achievement: number | null;
  mom: number | null;
  wow: number | null;
  wowCurrent: number;
  wowBase: number;
};

function summarize(dataset: DashboardDataset, monthKey: string, product: ProductName, metric: MetricName, week: WowWeek): Summary {
  const data = selectDashboardData(dataset, monthKey, metric, product);
  const itemAvailable = availableMetricsFor(dataset, monthKey, product).includes(metric);
  const branches = data.branches.filter((branch) => branch.products[product].eligible || branch.products[product].target > 0);
  const target = branches.reduce((sum, branch) => sum + branch.products[product].target, 0);
  const actual = branches.reduce((sum, branch) => sum + branch.products[product].daily.slice(0, Number(data.meta.asOf.slice(-2))).reduce((subtotal, value) => subtotal + value, 0), 0);
  const runrate = branches.reduce((sum, branch) => sum + branch.products[product].runrate, 0);
  const previousActual = branches.reduce((sum, branch) => sum + branch.products[product].previousActual, 0);
  const wowData = calculateWow(branches, product, data, week);
  return {
    product,
    metric,
    target: itemAvailable ? target : 0,
    actual: itemAvailable ? actual : 0,
    runrate: itemAvailable ? runrate : 0,
    achievement: itemAvailable && target > 0 ? runrate / target : null,
    mom: itemAvailable && previousActual > 0 ? runrate / previousActual - 1 : null,
    wow: itemAvailable ? wowData.wow : null,
    wowCurrent: itemAvailable ? wowData.currentTotal : 0,
    wowBase: itemAvailable ? wowData.baseTotal : 0,
  };
}

function MetricCard({ summary }: { summary: Summary }) {
  const { metric, product } = summary;
  return <article className="bmav-product-card" style={{ "--product-color": productColors[product] } as React.CSSProperties}>
    <div className="bmav-card-title"><span>{titles[product]}</span><small>{metricNames[metric]} • {units[metric]}</small></div>
    <div className="bmav-card-grid">
      <div><span>Target</span><strong>{summary.target ? fmt(summary.target) : "—"}</strong></div>
      <div><span>Achieve</span><strong>{pct(summary.achievement)}</strong></div>
      <div><span>Actual MTD</span><strong>{fmt(summary.actual)}</strong></div>
      <div><span>Run Rate</span><strong>{fmt(summary.runrate)}</strong></div>
      <div className={summary.mom === null ? "neutral" : summary.mom >= 0 ? "positive" : "negative"}><span>MoM</span><strong>{pct(summary.mom)}</strong></div>
      <div className={summary.wow === null ? "neutral" : summary.wow >= 0 ? "positive" : "negative"}><span>WoW</span><strong>{pct(summary.wow)}</strong></div>
    </div>
  </article>;
}

function CompareChart({ title, metric, summaries }: { title: string; metric: MetricName; summaries: Summary[] }) {
  return <article className="panel bmav-chart-panel">
    <div className="bmav-chart-title">{title}</div>
    <div className="bmav-legend"><span><i className="bmav-legend-ach" />%Achieve</span><span><i className="bmav-legend-mom" />MoM</span></div>
    <div className="bmav-chart" role="img" aria-label={`${title}: % Achieve และ MoM แยกตาม Product`}>
      {summaries.map((summary) => {
        const achieve = summary.achievement ?? 0;
        const mom = summary.mom ?? 0;
        const barHeight = Math.min(Math.abs(achieve) * 100, 125);
        return <div className="bmav-chart-col" key={summary.product}>
          <div className="bmav-chart-plot">
            <span className="bmav-ach-label">{pct(summary.achievement)}</span>
            <i className="bmav-ach-bar" style={{ height: `${barHeight}%`, background: productColors[summary.product] }} />
            <span className={`bmav-mom-label ${mom >= 0 ? "positive" : "negative"}`}>{pct(summary.mom)}</span>
          </div>
          <strong>{titles[summary.product]}</strong>
          <small>{fmt(summary.runrate)} {units[metric]}</small>
        </div>;
      })}
    </div>
    <p className="bmav-chart-note">Achieve = Run Rate ÷ Target • {metricNames[metric]}</p>
  </article>;
}

export default function BmavPerformance() {
  const [dataset, setDataset] = useState(fallbackDataset);
  const [syncSource, setSyncSource] = useState<"sheet" | "fallback">("fallback");
  const [monthKey, setMonthKey] = useState(fallbackDataset.latestMonthKey);
  const monthChosenByUser = useRef(false);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [clock, setClock] = useState(0);
  const month = dataset.months.find((item) => item.meta.monthKey === monthKey) ?? dataset.months[dataset.months.length - 1];
  const week = selectedWeek ? WOW_WEEKS.find((item) => item.id === selectedWeek) ?? findDefaultWowWeek(month.meta.asOf) : findDefaultWowWeek(month.meta.asOf);
  const summary = useMemo(() => products.flatMap((product) => {
    const primary = DEFAULT_METRIC_BY_PRODUCT[product];
    return [summarize(dataset, monthKey, product, primary, week)];
  }), [dataset, monthKey, week]);
  const cards = summary;
  const netSummaries = useMemo(() => products.map((product) => summarize(dataset, monthKey, product, "Net", week)), [dataset, monthKey, week]);
  const qtySummaries = useMemo(() => products.map((product) => summarize(dataset, monthKey, product, "Qty", week)), [dataset, monthKey, week]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const sync = async () => {
      try {
        const next = await loadGoogleSheetData(controller.signal);
        if (active && next.latestAsOf >= fallbackData.meta.asOf) {
          setDataset(next);
          setMonthKey((current) => !monthChosenByUser.current || !next.months.some((item) => item.meta.monthKey === current) ? next.latestMonthKey : current);
          setSyncSource("sheet");
          setClock((value) => value + 1);
        }
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) setSyncSource("fallback");
      }
    };
    void sync();
    const interval = window.setInterval(sync, 5 * 60 * 1000);
    const onVisibility = () => { if (document.visibilityState === "visible") void sync(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { active = false; controller.abort(); window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  return <main className="bmav-page">
    <header className="bmav-hero">
      <div><span>BMAV-CENTRAL • EXECUTIVE VIEW</span><h1>BMAV PERFORMANCE</h1><p>ภาพรวม Device, GIA, Postpay และ TOL • Actual, Run Rate, MoM และ WoW</p></div>
      <a href="#/">กลับ Dashboard</a>
    </header>
    <section className="bmav-filters">
      <label>เลือกเดือน<select value={monthKey} onChange={(event) => { monthChosenByUser.current = true; setMonthKey(event.target.value); }}>{dataset.months.map((item) => <option key={item.meta.monthKey} value={item.meta.monthKey}>{item.meta.month}</option>)}</select></label>
      <label>เลือก Week<select value={week.id} onChange={(event) => setSelectedWeek(event.target.value)}>{WOW_WEEKS.map((item) => <option key={item.id} value={item.id}>{item.label} • {formatWowRange(item.start, item.end)}</option>)}</select></label>
      <span className={syncSource === "sheet" ? "bmav-live" : "bmav-fallback"}>{syncSource === "sheet" ? "Google Sheet Live • รีเฟรชทุก 5 นาที" : "ข้อมูลสำรอง • Google Sheet ยังไม่พร้อมใช้งาน"}</span>
    </section>
    <section className="bmav-four-cards" aria-label="BMAV performance by product">{cards.map((item) => <MetricCard key={item.product} summary={item} />)}</section>
    <div className="bmav-lower-title"><div><span>PRODUCT COMPARISON</span><h2>ยอดขายเทียบ Target</h2></div><small>ข้อมูลถึง {month.meta.asOf} • %Achieve คำนวณจาก Run Rate ÷ Target</small></div>
    <section className="bmav-charts">
      <CompareChart title="Net Amount : Sales by Product (Sales VS Target)" metric="Net" summaries={netSummaries} />
      <CompareChart title="QTY : Sales by Product (Sales VS Target)" metric="Qty" summaries={qtySummaries} />
    </section>
    <section className="panel bmav-table-panel">
      <div className="bmav-table-head"><div><span>BMAV PRODUCT SUMMARY</span><h2>Performance Overview</h2></div><small>{week.label} • {formatWowRange(week.start, week.end)} • เทียบฐานสัปดาห์ก่อน</small></div>
      <div className="table-wrap"><table className="bmav-table"><thead><tr><th rowSpan={2}>PRODUCT</th><th rowSpan={2}>AS OF</th><th colSpan={6}>NET AMOUNT</th><th colSpan={6}>QTY</th></tr><tr><th>Target</th><th>Actual</th><th>Run Rate</th><th>Achieve</th><th>MoM</th><th>WoW</th><th>Target</th><th>Actual</th><th>Run Rate</th><th>Achieve</th><th>MoM</th><th>WoW</th></tr></thead>
        <tbody>{products.map((product, index) => {
          const net = netSummaries[index];
          const qty = qtySummaries[index];
          return <tr key={product}><th><i style={{ background: productColors[product] }} />{titles[product]}</th><td>{month.meta.asOf}</td><td>{net.target ? fmt(net.target) : "—"}</td><td>{fmt(net.actual)}</td><td>{fmt(net.runrate)}</td><td>{pct(net.achievement)}</td><td className={net.mom === null ? "neutral" : net.mom >= 0 ? "positive" : "negative"}>{pct(net.mom)}</td><td className={net.wow === null ? "neutral" : net.wow >= 0 ? "positive" : "negative"}>{pct(net.wow)}</td><td>{qty.target ? fmt(qty.target) : "—"}</td><td>{fmt(qty.actual)}</td><td>{fmt(qty.runrate)}</td><td>{pct(qty.achievement)}</td><td className={qty.mom === null ? "neutral" : qty.mom >= 0 ? "positive" : "negative"}>{pct(qty.mom)}</td><td className={qty.wow === null ? "neutral" : qty.wow >= 0 ? "positive" : "negative"}>{pct(qty.wow)}</td></tr>;
        })}</tbody>
      </table></div>
      <p className="bmav-table-note">MoM = Run Rate เทียบ Actual เดือนก่อน • WoW = ยอด Week ที่เลือกเทียบสัปดาห์ก่อนในจำนวนวันเท่ากัน • หน่วย Net เป็นบาท และ QTY เป็นจำนวน</p>
    </section>
    <footer className="bmav-footer">BMAV-Central Product Performance Monitor • Google Sheet {syncSource === "sheet" ? "Live" : "Fallback"}{clock ? ` • Sync ${clock}` : ""}</footer>
  </main>;
}

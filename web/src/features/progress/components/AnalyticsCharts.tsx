"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MutableRefObject, type ReactNode } from "react";
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "motion/react";
import { Table2 } from "lucide-react";
import styles from "../analytics-charts.module.css";

export type AnalyticsChartDatum = { key: string; label: string; detail?: string; color?: string; [field: string]: string | number | null | undefined };
export type AnalyticsChartSeries = { key: string; label: string; color: string };
export type AnalyticsChartKind = "bar" | "area" | "line" | "horizontal-bar";
export type AnalyticsChartValueFormat = (value: number) => string;
export interface AnalyticsCartesianChartProps {
  data: AnalyticsChartDatum[];
  series: AnalyticsChartSeries[];
  kind: AnalyticsChartKind;
  label: string;
  stacked?: boolean;
  domain?: [number, number];
  valueFormat?: AnalyticsChartValueFormat;
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
  className?: string;
  minHeight?: number;
}
export type AnalyticsDonutDatum = { key: string; label: string; value: number; color: string; detail?: string };
export interface AnalyticsDonutChartProps {
  data: AnalyticsDonutDatum[];
  label: string;
  valueFormat?: AnalyticsChartValueFormat;
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
  centerLabel?: string;
  centerValue?: ReactNode;
  className?: string;
  minHeight?: number;
}

const formatValue: AnalyticsChartValueFormat = (value) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
const finiteValue = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const classes = (className?: string) => `${styles.chart}${className ? ` ${className}` : ""}`;

function ChartData({ data, series, label, valueFormat, onSelect, selected }: { data: AnalyticsChartDatum[]; series: AnalyticsChartSeries[]; label: string; valueFormat: AnalyticsChartValueFormat; onSelect?: (key: string) => void; selected: string | null }) {
  const hasDetails = data.some((row) => row.detail);
  return <details className={styles.dataDisclosure}>
    <summary><Table2 size={14} aria-hidden />Chart data</summary>
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={`${label} data table`}>
      <table className={styles.table} aria-label={`${label} data`}>
        <thead><tr><th scope="col">Item</th>{series.map((item) => <th scope="col" key={item.key}>{item.label}</th>)}{hasDetails ? <th scope="col">Details</th> : null}</tr></thead>
        <tbody>{data.map((row) => <tr key={row.key} data-selected={selected === row.key || undefined}>
          <th scope="row">{onSelect ? <button type="button" aria-label={`Select ${row.label}`} aria-pressed={selected === row.key} onClick={() => onSelect(row.key)}>{row.label}</button> : row.label}</th>
          {series.map((item) => { const value = finiteValue(row[item.key]); return <td key={item.key}>{value == null ? "Not recorded" : valueFormat(value)}</td>; })}
          {hasDetails ? <td>{row.detail ?? ""}</td> : null}
        </tr>)}</tbody>
      </table>
    </div>
  </details>;
}

type TooltipInput = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> };
function ChartTooltip({ active, payload, rows, series, valueFormat, activeKeyRef, total }: TooltipInput & { rows: Map<string, AnalyticsChartDatum>; series: AnalyticsChartSeries[]; valueFormat: AnalyticsChartValueFormat; activeKeyRef: MutableRefObject<string | null>; total?: number }) {
  const source = payload?.[0]?.payload;
  const key = source && typeof source === "object" && "key" in source && typeof source.key === "string" ? source.key : null;
  const row = key ? rows.get(key) : undefined;
  useEffect(() => { if (active && row) activeKeyRef.current = row.key; }, [active, row, activeKeyRef]);
  if (!active || !row) return null;
  return <div className={styles.tooltip} role="status" aria-live="polite">
    <strong>{row.label}</strong>
    <dl>{series.map((item) => {
      const value = finiteValue(row[item.key]);
      return <div key={item.key}><dt><i style={{ background: row.color && series.length === 1 ? row.color : item.color }} aria-hidden />{item.label}</dt><dd>{value == null ? "Not recorded" : valueFormat(value)}{total && value != null ? <small>{formatValue(value / total * 100)}%</small> : null}</dd></div>;
    })}</dl>
    {row.detail ? <p>{row.detail}</p> : null}
  </div>;
}

function selectWithKeyboard(event: KeyboardEvent<HTMLDivElement>, activeKey: MutableRefObject<string | null>, onSelect?: (key: string) => void) {
  if (!onSelect || (event.key !== "Enter" && event.key !== " ") || !(event.target instanceof Element) || !event.target.closest("[data-chart-plot]")) return;
  if (activeKey.current) { event.preventDefault(); onSelect(activeKey.current); }
}

export function AnalyticsCartesianChart({ data, series, kind, label, stacked = false, domain, valueFormat = formatValue, onSelect, selectedKey, className, minHeight = 220 }: AnalyticsCartesianChartProps) {
  const reduced = useReducedMotion();
  const [touchTooltip, setTouchTooltip] = useState(false);
  const chartId = useId();
  const activeKey = useRef<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const rows = useMemo(() => new Map(data.map((row) => [row.key, row])), [data]);
  const horizontal = kind === "horizontal-bar";
  const hasValues = data.some((row) => series.some((item) => finiteValue(row[item.key]) != null));
  const choose = (key: string) => { if (rows.has(key)) { activeKey.current = key; setSelected(key); onSelect?.(key); } };
  const numericDomain: [number, number | "auto"] = domain ?? [0, "auto"];
  const tickStyle = { fill: "var(--color-muted)", fontSize: 11 };
  const axisStyle = { stroke: "var(--color-rule)" };
  const animation = { isAnimationActive: !reduced, animationDuration: 220, animationBegin: 0, animationEasing: "ease-out" as const };
  const tickLabel = (key: string) => rows.get(key)?.label ?? key;
  return <div className={classes(className)} role="group" aria-label={label} data-chart-kind={kind} onPointerDownCapture={(event) => setTouchTooltip(event.pointerType === "touch")} onKeyDownCapture={(event) => selectWithKeyboard(event, activeKey, onSelect ? choose : undefined)}>
    {series.length > 1 ? <ul className={styles.legend} aria-label={`${label} series`}>{series.map((item) => <li key={item.key}><i style={{ background: item.color }} aria-hidden />{item.label}</li>)}</ul> : null}
    <div className={styles.plot} data-chart-plot style={{ "--chart-min-height": `${minHeight}px` } as CSSProperties}>
      {hasValues ? <div className={styles.canvas}><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 360, height: minHeight }}>
        <ComposedChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 12, right: 20, bottom: 4, left: 12 }} accessibilityLayer title={label} aria-label={label} onClick={(state) => { const index = Number(state.activeTooltipIndex); if (state.activeTooltipIndex != null && data[index]) choose(data[index].key); }}>
          <CartesianGrid stroke="var(--color-rule-2)" horizontal={!horizontal} vertical={horizontal} strokeDasharray="3 4" />
          {horizontal ? <>
            <XAxis type="number" domain={numericDomain} allowDataOverflow={Boolean(domain)} tickFormatter={valueFormat} tick={tickStyle} tickLine={false} axisLine={axisStyle} tickCount={5} height={28} />
            <YAxis dataKey="key" type="category" tickFormatter={tickLabel} tick={tickStyle} tickLine={false} axisLine={false} width={92} interval={0} />
            <ReferenceLine x={0} stroke="var(--color-rule)" />
          </> : <>
            <XAxis dataKey="key" tickFormatter={tickLabel} tick={tickStyle} tickLine={false} axisLine={axisStyle} padding={{ left: 16, right: 16 }} minTickGap={24} interval="preserveStartEnd" height={28} />
            <YAxis domain={numericDomain} allowDataOverflow={Boolean(domain)} tickFormatter={valueFormat} tick={tickStyle} tickLine={false} axisLine={false} width="auto" tickCount={5} />
            <ReferenceLine y={0} stroke="var(--color-rule)" />
          </>}
          <Tooltip trigger={touchTooltip ? "click" : "hover"} content={(props) => <ChartTooltip {...props} rows={rows} series={series} valueFormat={valueFormat} activeKeyRef={activeKey} />} filterNull={false} cursor={{ stroke: "var(--color-muted)", strokeDasharray: "3 3", fill: "var(--color-rule-2)", fillOpacity: 0.4 }} isAnimationActive={false} wrapperStyle={{ outline: "none", zIndex: 2 }} />
          {series.map((item) => {
            const hasGaps = data.some((row) => finiteValue(row[item.key]) == null);
            if (kind === "area") return <Area {...animation} key={item.key} id={`${chartId}-${item.key}`} type="monotone" dataKey={item.key} name={item.label} stroke={item.color} fill={item.color} fillOpacity={0.15} strokeWidth={2} stackId={stacked ? "values" : undefined} baseValue={0} connectNulls={false} dot={data.length === 1 || hasGaps ? { r: 2.5, strokeWidth: 0 } : false} activeDot={{ r: 4, stroke: "var(--color-surface)", strokeWidth: 2 }} />;
            if (kind === "line") return <Line {...animation} key={item.key} id={`${chartId}-${item.key}`} type="monotone" dataKey={item.key} name={item.label} stroke={item.color} strokeWidth={2} connectNulls={false} dot={data.length <= 12 || hasGaps ? { r: 2.5, strokeWidth: 0 } : false} activeDot={{ r: 4, stroke: "var(--color-surface)", strokeWidth: 2 }} />;
            return <Bar {...animation} key={item.key} id={`${chartId}-${item.key}`} dataKey={item.key} name={item.label} fill={item.color} stackId={stacked ? "values" : undefined} maxBarSize={horizontal ? 24 : 38} radius={stacked ? 0 : horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]}>{series.length === 1 ? data.map((row) => <Cell key={row.key} fill={row.color ?? item.color} />) : null}</Bar>;
          })}
        </ComposedChart>
      </ResponsiveContainer></div> : <p className={styles.empty}>{data.length ? "No recorded values in this period." : "Your chart will appear as data becomes available."}</p>}
    </div>
    {data.length ? <ChartData data={data} series={series} label={label} valueFormat={valueFormat} onSelect={onSelect ? choose : undefined} selected={selectedKey === undefined ? selected : selectedKey} /> : null}
  </div>;
}

export function AnalyticsDonutChart({ data, label, valueFormat = formatValue, onSelect, selectedKey, centerLabel = "Total", centerValue, className, minHeight = 220 }: AnalyticsDonutChartProps) {
  const reduced = useReducedMotion();
  const [touchTooltip, setTouchTooltip] = useState(false);
  const activeKey = useRef<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const valid = useMemo(() => data.filter((row) => Number.isFinite(row.value) && row.value >= 0), [data]);
  const rows = useMemo(() => new Map<string, AnalyticsChartDatum>(valid.map((row) => [row.key, row])), [valid]);
  const total = valid.reduce((sum, row) => sum + row.value, 0);
  const series = [{ key: "value", label: "Items", color: "var(--color-accent)" }];
  const choose = (key: string) => { if (rows.has(key)) { activeKey.current = key; setSelected(key); onSelect?.(key); } };
  return <div className={classes(className)} role="group" aria-label={label} data-chart-kind="donut" onPointerDownCapture={(event) => setTouchTooltip(event.pointerType === "touch")} onKeyDownCapture={(event) => selectWithKeyboard(event, activeKey, onSelect ? choose : undefined)}>
    <div className={styles.plot} data-chart-plot style={{ "--chart-min-height": `${minHeight}px` } as CSSProperties}>
      {total > 0 ? <><div className={styles.canvas}><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 320, height: minHeight }}>
        <PieChart accessibilityLayer title={label} aria-label={label} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie data={valid} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius="62%" outerRadius="86%" paddingAngle={0} stroke="var(--color-surface)" strokeWidth={2} isAnimationActive={!reduced} animationDuration={220} animationBegin={0} animationEasing="ease-out" onClick={(_entry, index) => { if (valid[index]) choose(valid[index].key); }}>{valid.map((row) => <Cell key={row.key} fill={row.color} />)}</Pie>
          <Tooltip trigger={touchTooltip ? "click" : "hover"} content={(props) => <ChartTooltip {...props} rows={rows} series={series} valueFormat={valueFormat} activeKeyRef={activeKey} total={total} />} isAnimationActive={false} wrapperStyle={{ outline: "none", zIndex: 2 }} />
        </PieChart>
      </ResponsiveContainer></div><div className={styles.donutCenter}><strong>{centerValue ?? valueFormat(total)}</strong><span>{centerLabel}</span></div></> : <p className={styles.empty}>No items in this distribution yet.</p>}
    </div>
    {valid.length ? <ChartData data={valid} series={series} label={label} valueFormat={valueFormat} onSelect={onSelect ? choose : undefined} selected={selectedKey === undefined ? selected : selectedKey} /> : null}
  </div>;
}

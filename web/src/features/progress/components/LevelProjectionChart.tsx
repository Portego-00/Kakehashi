"use client";

import { useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import { CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table2 } from "lucide-react";
import { projectionTimeline, type ProjectionCurve, type ProjectionScenario } from "../analytics-projection-chart";
import { formatDate, formatNumber } from "./AnalyticsPrimitives";
import styles from "../analytics-projection-chart.module.css";
import chartStyles from "../analytics-charts.module.css";

export function LevelProjectionChart({ curves, history = [], selected, level, goal, now, targetDate }: {
  curves: ProjectionCurve[]; history?: ProjectionCurve["points"]; selected: ProjectionScenario["key"]; level: number; goal: number; now: Date; targetDate: string;
}) {
  const reduced = useReducedMotion();
  const [touch, setTouch] = useState(false);
  const data = useMemo(() => projectionTimeline(curves, history), [curves, history]);
  const start = history[0]?.timestamp ?? now.getTime();
  const firstLevel = Math.min(level, ...history.map((point) => point.level));
  const end = Math.max(now.getTime() + 86_400_000, ...curves.map((curve) => curve.points.at(-1)!.timestamp));
  const target = targetDate ? new Date(`${targetDate}T23:59:59`).getTime() : NaN;
  const ticks = [start, start + (end - start) / 2, end];
  const levelTicks = [...new Set([firstLevel, ...[10, 20, 30, 40, 50, 60].filter((tick) => tick > firstLevel && tick < Math.max(goal, level)), Math.max(goal, level)])];
  const formatTick = (value: number) => value === now.getTime() ? "Today" : new Date(value).toLocaleDateString(undefined, end - start < 90 * 86_400_000 ? { month: "short", day: "numeric" } : { month: "short", year: "2-digit" });
  return <div className={styles.chart} role="group" aria-label="Level projection scenarios" data-chart-kind="line" data-motion={reduced ? "reduced" : "animated"} onPointerDownCapture={(event) => setTouch(event.pointerType === "touch")}>
    <div className={styles.plot} data-chart-plot>
      {curves.length || history.length ? <div className={styles.canvas}><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 400, height: 240 }}>
        <ComposedChart data={data} margin={{ top: 16, right: 18, bottom: 0, left: 0 }} accessibilityLayer title="Level projection scenarios" aria-label="Level projection scenarios">
          <CartesianGrid vertical={false} stroke="var(--color-rule-2)" strokeDasharray="3 4" />
          <XAxis dataKey="timestamp" type="number" scale="time" domain={[start, end]} ticks={ticks} tickFormatter={formatTick} tick={{ fill: "var(--color-muted)", fontSize: 11 }} tickLine={false} axisLine={false} height={28} interval="preserveStartEnd" minTickGap={24} />
          <YAxis domain={[firstLevel, Math.max(level, goal)]} ticks={levelTicks} tickFormatter={(value: number) => `L${value}`} tick={{ fill: "var(--color-muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={34} allowDecimals={false} />
          <ReferenceLine x={now.getTime()} stroke="var(--color-muted)" strokeDasharray="3 4" label={{ value: "Today", position: "insideTopLeft", fill: "var(--color-muted)", fontSize: 11 }} />
          {history.length ? <Line dataKey="history" name="Recorded history" type="stepAfter" stroke="var(--color-ink)" strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={!reduced} animationDuration={350} animationEasing="ease-out" /> : null}
          <ReferenceLine y={goal} stroke="var(--color-rule)" strokeDasharray="4 4" />
          {target > start && target <= end ? <ReferenceLine x={target} stroke="var(--color-muted)" strokeDasharray="2 4" label={{ value: "Target", position: "insideTopLeft", fill: "var(--color-muted)", fontSize: 11 }} /> : null}
          <Tooltip trigger={touch ? "click" : "hover"} isAnimationActive={false} cursor={{ stroke: "var(--color-muted)", strokeDasharray: "3 3" }} content={({ active, payload }) => {
            const row = payload?.[0]?.payload as ReturnType<typeof projectionTimeline>[number] | undefined;
            if (!active || !row) return null;
            if (row.timestamp < now.getTime()) return <div className={chartStyles.tooltip} role="status"><strong>{formatDate(new Date(row.timestamp))}</strong><p>Recorded level {row.history}</p></div>;
            return <div className={chartStyles.tooltip} role="status"><strong>{formatDate(new Date(row.timestamp))}</strong><dl>{curves.map((curve) => <div key={curve.key}><dt><i style={{ background: curve.color }} aria-hidden />{curve.label}</dt><dd>{row[curve.key] == null ? "Goal reached" : `L${formatNumber(row[curve.key]!)}`}</dd></div>)}</dl></div>;
          }} />
          {curves.map((curve) => <Line key={curve.key} dataKey={curve.key} name={curve.label} type="linear" stroke={curve.color} strokeWidth={curve.key === selected ? 3 : 1.75} strokeDasharray={curve.key === selected ? undefined : curve.key === "faster" ? "5 4" : "2 4"} dot={false} activeDot={{ r: 4, stroke: "var(--color-surface)", strokeWidth: 2 }} connectNulls={false} isAnimationActive={!reduced} animationDuration={350} animationBegin={0} animationEasing="ease-out" />)}
          {curves.map((curve) => <ReferenceDot key={curve.key} x={curve.points.at(-1)!.timestamp} y={goal} r={curve.key === selected ? 4 : 3} fill={curve.color} stroke="var(--color-surface)" strokeWidth={2} />)}
        </ComposedChart>
      </ResponsiveContainer></div> : <p className={styles.empty}>{goal <= level ? `Level ${goal} reached. Choose a higher goal to project your next levels.` : "No completed level history yet. Choose Custom to set a pace."}</p>}
    </div>
    {history.length ? <details className={chartStyles.dataDisclosure}><summary><Table2 size={14} aria-hidden />Recorded level history</summary><div className={chartStyles.tableScroll}><table className={chartStyles.table}><thead><tr><th>Level</th><th>Started</th></tr></thead><tbody>{history.slice(0, -1).map((point, index) => <tr key={index}><th scope="row">{point.level}</th><td>{formatDate(new Date(point.timestamp))}</td></tr>)}</tbody></table></div></details> : null}
    {goal <= level ? <p className={styles.empty}>Level {goal} reached. Choose a higher goal to project your next levels.</p> : null}
    {curves.length ? <>
      <ul className={styles.legend} aria-label="Projected goal dates">{curves.map((curve) => <li key={curve.key} data-selected={curve.key === selected}><span><i style={{ borderColor: curve.color, borderStyle: curve.key === selected ? "solid" : "dashed" }} aria-hidden />{curve.label}</span><time dateTime={new Date(curve.points.at(-1)!.timestamp).toISOString()}>{formatDate(new Date(curve.points.at(-1)!.timestamp))}</time></li>)}</ul>
      <details className={chartStyles.dataDisclosure}><summary><Table2 size={14} aria-hidden />Projection dates</summary><div className={chartStyles.tableScroll} tabIndex={0} role="region" aria-label="Projection dates table"><table className={chartStyles.table}><thead><tr><th scope="col">Level</th>{curves.map((curve) => <th key={curve.key} scope="col">{curve.label}</th>)}</tr></thead><tbody>{Array.from({ length: goal - level }, (_, index) => level + index + 1).map((value) => <tr key={value}><th scope="row">{value}</th>{curves.map((curve) => <td key={curve.key}>{formatDate(new Date(curve.points.find((point) => point.level === value)!.timestamp))}</td>)}</tr>)}</tbody></table></div></details>
    </> : null}
  </div>;
}

"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import type { bunproSeries } from './analytics';
import styles from './analytics.module.css';

type Stage = { key: string; label: string; value: number; color: string };

/** Largest remainder allocation: every tile represents the same share of the total. */
export function allocateTiles(values: number[], cells: number) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return values.map(() => 0);
  const exact = values.map(value => value / total * cells);
  const counts = exact.map(Math.floor);
  const order = exact.map((value, index) => ({ index, remainder: value - counts[index] })).sort((a, b) => b.remainder - a.remainder);
  const remaining = cells - counts.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < remaining; i++) counts[order[i].index]++;
  return counts;
}

export function KnowledgeHoneycomb({ stages, label }: { stages: Stage[]; label: string }) {
  const counts = allocateTiles(stages.map(stage => stage.value), 200);
  const tiles = stages.flatMap((stage, index) => Array.from({ length: counts[index] }, () => stage));
  return <div className={styles.honeycomb}><svg viewBox="0 0 408 185" role="img" aria-label={`${label}. ${stages.map(stage => `${stage.label}: ${stage.value}`).join(', ')}. Each hexagon represents approximately 0.5% of items.`}>
    {Array.from({ length: 200 }, (_, index) => {
      const row = Math.floor(index / 20), column = index % 20;
      const stage = tiles[index];
      const x = 10 + column * 20 + (row % 2 ? 10 : 0), y = 11 + row * 18;
      return <polygon key={index} points="0,-10 8.66,-5 8.66,5 0,10 -8.66,5 -8.66,-5" transform={`translate(${x},${y})`} fill={stage?.color ?? 'var(--color-paper-3)'}><title>{stage ? `${stage.label}: ${stage.value.toLocaleString()} items` : 'No items yet'}</title></polygon>;
    })}
  </svg><span>{tiles.length ? 'Each hexagon ≈ 0.5% of SRS items' : 'No SRS items yet'}</span></div>;
}

export function ForecastBars({ data, kinds }: { data: ReturnType<typeof bunproSeries>; kinds: ('grammar' | 'vocab')[] }) {
  const reduced = useReducedMotion();
  const colors = { grammar: 'var(--color-bunpro)', vocab: 'var(--color-vocabulary)' };
  const labels = { grammar: 'Grammar', vocab: 'Vocabulary' };
  const maximum = Math.max(1, ...data.flatMap(row => kinds.map(kind => row[kind] ?? 0)));
  const step = 420 / Math.max(1, data.length);
  const complete = data.every(row => kinds.every(kind => row[kind] != null));
  const total = data.reduce((sum, row) => sum + kinds.reduce((n, kind) => n + (row[kind] ?? 0), 0), 0);
  return <div className={styles.forecast}>
    <div className={styles.headline}>{complete ? <><strong>{total.toLocaleString()}</strong><span>scheduled in this forecast</span></> : <span>Scheduled reviews by day</span>}</div>
    <svg viewBox="0 0 480 220" role="img" aria-label={`Scheduled reviews. ${data.map(row => `${row.label}: ${kinds.map(kind => `${labels[kind]} ${row[kind] ?? 'unavailable'}`).join(', ')}`).join('; ')}`}>
      {[...new Set([0, Math.ceil(maximum / 2), maximum])].map(value => <g key={value}><text x="32" y={190 - value / maximum * 160} textAnchor="end" fill="var(--color-muted)" fontSize="10">{value}</text><line x1="42" x2="470" y1={186 - value / maximum * 160} y2={186 - value / maximum * 160} stroke="var(--color-rule-2)" strokeDasharray="2 4" /></g>)}
      {data.map((row, index) => <g key={row.key}>{kinds.map((kind, offset) => {
        const value = row[kind];
        if (value == null) return null;
        const height = value / maximum * 160;
        return <motion.rect key={kind} initial={reduced ? false : { x: 44 + index * step + offset * step / kinds.length, width: Math.max(1, step / kinds.length - 2), y: 186, height: 0 }} animate={{ x: 44 + index * step + offset * step / kinds.length, y: 186 - height, width: Math.max(1, step / kinds.length - 2), height }} transition={{ duration: reduced ? 0 : .22, ease: [.2, 0, 0, 1] }} fill={colors[kind]} rx="2"><title>{row.label}: {labels[kind]} {value}</title></motion.rect>;
      })}{(index % Math.max(1, Math.ceil((data.length - 1) / 3)) === 0 || index === data.length - 1) ? <text x={index === 0 ? 44 : index === data.length - 1 ? 466 : 44 + index * step + step / 2} y="208" textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"} fill="var(--color-muted)" fontSize="10">{row.label}</text> : null}</g>)}
    </svg>
    <ul className={styles.legend}>{kinds.map(kind => <li key={kind}><i style={{ background: colors[kind] }} />{labels[kind]}</li>)}</ul>
    <details className={styles.chartTable}><summary>Chart data</summary><table><thead><tr><th>Date</th>{kinds.map(kind => <th key={kind}>{labels[kind]}</th>)}</tr></thead><tbody>{data.map(row => <tr key={row.key}><th>{row.label}</th>{kinds.map(kind => <td key={kind}>{row[kind] ?? 'Unavailable'}</td>)}</tr>)}</tbody></table></details>
  </div>;
}

export function ReviewCalendar({ data, mode, endDate }: { data: { grammar: Record<string, number>; vocab: Record<string, number> }; mode: 'all' | 'grammar' | 'vocab'; endDate?: string }) {
  const tooltipId = useId();
  const [hovered, setHovered] = useState<{ key: string; left: number; top: number } | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const cells = useRef<Array<SVGRectElement | null>>([]);
  const activeCell = useRef<SVGRectElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  const closeSoon = () => { cancelClose(); closeTimer.current = setTimeout(() => setHovered(null), 120); };
  const show = (key: string, target: SVGRectElement) => {
    cancelClose();
    activeCell.current = target;
    const rect = target.getBoundingClientRect();
    setHovered({ key, left: Math.max(12, Math.min(rect.left + rect.width / 2 - 110, window.innerWidth - 232)), top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 104)) });
  };
  useEffect(() => {
    const dismiss = () => setHovered(null);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    const reposition = () => {
      const rect = activeCell.current?.getBoundingClientRect();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) { dismiss(); return; }
      setHovered(current => current ? { ...current, left: Math.max(12, Math.min(rect.left + rect.width / 2 - 110, window.innerWidth - 232)), top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 104)) } : null);
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('keydown', escape);
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', reposition); window.removeEventListener('keydown', escape); };
  }, []);
  const end = endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? new Date(`${endDate}T12:00:00Z`) : new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 175);
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const count = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  const days = Array.from({ length: count }, (_, index) => {
    const date = new Date(start); date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const value = (mode !== 'vocab' ? data.grammar[key] ?? 0 : 0) + (mode !== 'grammar' ? data.vocab[key] ?? 0 : 0);
    return { key, date, value };
  });
  const maximum = Math.max(1, ...days.map(day => day.value));
  const active = days.filter(day => day.value > 0).length;
  const width = Math.ceil(days.length / 7) * 14 + 32;
  const hoveredDay = days.find(day => day.key === hovered?.key);
  const tabKey = days.some(day => day.key === focusKey) ? focusKey : days.at(-1)?.key;
  const dayLabel = (day: typeof days[number]) => `${day.key}: ${day.value ? `${day.value.toLocaleString()} ${day.value === 1 ? 'review' : 'reviews'}` : 'No recorded reviews'}`;
  return <div className={styles.calendar}>
    <div className={styles.headline}><strong>{active}</strong><span>days with recorded reviews · last 26 weeks</span></div>
    <div className={styles.calendarScroll}><svg viewBox={`0 0 ${width} 132`} role="group" aria-label={`Review calendar: ${active} days with recorded reviews in the displayed 26 weeks.`}>
      {['M', 'W', 'F'].map((day, i) => <text key={day} x="0" y={35 + i * 28} fontSize="9" fill="var(--color-muted)">{day}</text>)}
      {days.map((day, index) => <g key={day.key}>{day.date.getUTCDate() <= 7 && day.date.getUTCDay() === 1 ? <text x={24 + Math.floor(index / 7) * 14} y="14" fontSize="9" fill="var(--color-muted)">{day.date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })}</text> : null}<rect className={styles.calendarCell} role="button" tabIndex={day.key === tabKey ? 0 : -1} aria-label={dayLabel(day)} aria-describedby={hovered?.key === day.key ? tooltipId : undefined} ref={element => { cells.current[index] = element; }}
        onPointerEnter={event => { if (event.pointerType !== 'touch') show(day.key, event.currentTarget); }} onPointerLeave={closeSoon}
        onFocus={event => { setFocusKey(day.key); show(day.key, event.currentTarget); }} onBlur={closeSoon}
        onClick={event => show(day.key, event.currentTarget)}
        onKeyDown={event => {
          const offsets: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); show(day.key, event.currentTarget); }
          else if (event.key in offsets || event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? days.length - 1 : Math.max(0, Math.min(days.length - 1, index + offsets[event.key]));
            cells.current[next]?.focus();
          }
        }} x={24 + Math.floor(index / 7) * 14} y={24 + index % 7 * 14} width="11" height="11" rx="2" fill={day.value ? 'var(--color-bunpro)' : 'var(--color-paper-3)'} fillOpacity={day.value ? .3 + .7 * Math.sqrt(day.value / maximum) : 1} /></g>)}
    </svg></div>
    {hovered && hoveredDay ? createPortal(<div id={tooltipId} role="tooltip" className={styles.calendarTooltip} style={{ left: hovered.left, top: hovered.top }} onPointerEnter={cancelClose} onPointerLeave={closeSoon}>
      <strong>{hoveredDay.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</strong>
      <span>{hoveredDay.value ? `${hoveredDay.value.toLocaleString()} ${hoveredDay.value === 1 ? 'review' : 'reviews'}` : 'No recorded reviews'}</span>
      {mode === 'all' && hoveredDay.value > 0 ? <small>Grammar: {(data.grammar[hoveredDay.key] ?? 0).toLocaleString()} · Vocabulary: {(data.vocab[hoveredDay.key] ?? 0).toLocaleString()}</small> : null}
    </div>, document.body) : null}
    <details className={styles.chartTable}><summary>Recorded days</summary><table><thead><tr><th>Date</th><th>Reviews</th></tr></thead><tbody>{days.filter(day => day.value > 0).map(day => <tr key={day.key}><th>{day.key}</th><td>{day.value}</td></tr>)}</tbody></table></details>
  </div>;
}

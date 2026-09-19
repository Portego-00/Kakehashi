import type { AnalyticsInsights, LevelProjection } from "./analytics-insights";
import type { Assignment, Subject } from "@/types/wanikani";
import { createPublicAnalyticsSnapshot, PUBLIC_SNAPSHOT_STAGES } from "./analytics-public-share";

export function downloadAnalyticsFile(content: Blob | string, filename: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : "") + text.replace(/"/g, '""')}"`;
}

export function analyticsCsv(insights: AnalyticsInsights) {
  return [
    ["Date", "Lessons", "Burns", "Reviews", "Incorrect answers", "Review accuracy (%)"],
    ...insights.activity.map((day) => [day.key, day.lessons, day.burns, day.reviews, day.errors, day.accuracy]),
  ].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function projectionsCalendar(projections: LevelProjection[], now = new Date(), goalLevel = 60) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kakehashi//Level milestones//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const projection of projections.filter((item) => item.status === "projected" && [10, 20, 30, 40, 50, 60, goalLevel].includes(item.level))) {
    const local = new Date(projection.date);
    const date = `${local.getFullYear()}${String(local.getMonth() + 1).padStart(2, "0")}${String(local.getDate()).padStart(2, "0")}`;
    lines.push("BEGIN:VEVENT", `UID:kakehashi-level-${projection.level}-${date}`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${date}`, `SUMMARY:WaniKani level ${projection.level} (estimated)`, "DESCRIPTION:Projected from your selected pace in Kakehashi. This is an estimate.", "TRANSP:TRANSPARENT", "END:VEVENT");
  }
  return [...lines, "END:VCALENDAR", ""].join("\r\n");
}

export type AnalyticsShareOptions = {
  username: string;
  level: number;
  hideUsername: boolean;
  hideDays: boolean;
  startedAt: string;
  theme: "light" | "dark";
  format: "stats" | "kanji" | "activity";
};

export function analyticsKanjiShareLayout(count: number) {
  const columns = Math.max(12, Math.min(60, Math.ceil(Math.sqrt(count * 1.55))));
  const cellWidth = 1296 / columns;
  const rowHeight = Math.max(22, Math.min(48, Math.floor(cellWidth * 0.9)));
  return { columns, cellWidth, rowHeight, fontSize: Math.min(40, Math.floor(cellWidth * 0.84)), height: Math.max(900, 680 + Math.ceil(count / columns) * rowHeight) };
}

export function buildAnalyticsShareModel(insights: AnalyticsInsights, options: AnalyticsShareOptions, subjects: Subject[], assignments: Assignment[], capturedAt = new Date()) {
  const snapshot = createPublicAnalyticsSnapshot(insights, options, subjects, assignments, capturedAt);
  const stages = new Map(assignments.filter((item) => !item.data.hidden).map((item) => [item.data.subject_id, item.data.srs_stage]));
  const kanji = subjects.filter((subject) => subject.object === "kanji" && !subject.data.hidden_at).sort((a, b) => a.data.level - b.data.level || a.id - b.id).map((subject) => ({ character: subject.data.characters ?? "", stage: stages.get(subject.id) ?? 0 }));
  const days = insights.activity.slice(-365);
  const offset = days[0]?.date.getDay() ?? 0;
  const calendar = days.map((day, index) => ({ ...day, column: Math.floor((offset + index) / 7), row: day.date.getDay() }));
  const calendarMonths: Array<{ column: number; date: Date }> = [];
  calendar.forEach((day, index) => {
    if (index !== 0 && day.date.getDate() !== 1) return;
    if (calendarMonths.length && day.column - calendarMonths.at(-1)!.column < 3) calendarMonths.pop();
    calendarMonths.push({ column: day.column, date: day.date });
  });
  const kanjiLayout = analyticsKanjiShareLayout(kanji.length);
  return {
    snapshot,
    kanji,
    kanjiLayout,
    calendar,
    calendarMonths,
    totalLearned: PUBLIC_SNAPSHOT_STAGES.reduce((sum, stage) => sum + snapshot.srs[stage], 0),
    width: 1440,
    height: options.format === "kanji" ? kanjiLayout.height : 900,
  };
}

const SHARE_COLORS = ["paper", "surface", "paper-2", "paper-3", "ink", "muted", "rule-2", "accent", "kanji", "vocabulary", "warning", "success"] as const;
type SharePalette = Record<(typeof SHARE_COLORS)[number], string> & { font: string; japanese: string };

function sharePalette(theme: AnalyticsShareOptions["theme"]): SharePalette {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  probe.style.setProperty("transition", "none", "important");
  probe.setAttribute("aria-hidden", "true");
  const base: CSSStyleDeclaration[] = [];
  const themed: CSSStyleDeclaration[] = [];
  const collect = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        if (rule.selectorText === ":root") base.push(rule.style);
        if (rule.selectorText === `[data-theme="${theme}"]`) themed.push(rule.style);
      } else if ("cssRules" in rule) collect((rule as CSSGroupingRule).cssRules);
    }
  };
  // Read the actual theme declarations so a light export stays light even inside a dark app.
  for (const sheet of document.styleSheets) { try { collect(sheet.cssRules); } catch { /* Cross-origin sheets cannot contain the local theme tokens. */ } }
  for (const declarations of [...base, ...themed]) for (const name of SHARE_COLORS) {
    const value = declarations.getPropertyValue(`--color-${name}`);
    if (value) probe.style.setProperty(`--color-${name}`, value);
  }
  document.body.append(probe);
  const palette = Object.fromEntries(SHARE_COLORS.map((name) => { probe.style.color = `var(--color-${name})`; return [name, getComputedStyle(probe).color]; })) as Record<(typeof SHARE_COLORS)[number], string>;
  probe.style.fontFamily = "var(--font-body)";
  const font = getComputedStyle(probe).fontFamily;
  probe.style.fontFamily = "var(--font-japanese)";
  const japanese = getComputedStyle(probe).fontFamily;
  probe.remove();
  return { ...palette, font, japanese };
}

export async function createAnalyticsShareImage(insights: AnalyticsInsights, options: AnalyticsShareOptions, subjects: Subject[], assignments: Assignment[], capturedAt = new Date()): Promise<Blob> {
  const model = buildAnalyticsShareModel(insights, options, subjects, assignments, capturedAt);
  const palette = sharePalette(options.theme);
  const mark = new Image();
  mark.src = "/brand/kakehashi-mark.png";
  await Promise.all([mark.decode(), document.fonts?.ready]);
  const canvas = document.createElement("canvas");
  canvas.width = model.width; canvas.height = model.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image export is unavailable in this browser.");
  const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  const text = (value: string, x: number, y: number, size = 24, color = palette.ink, weight = 400, maxWidth?: number) => {
    let fitted = size;
    ctx.font = `${weight} ${fitted}px ${palette.font}`;
    while (maxWidth && ctx.measureText(value).width > maxWidth && fitted > 12) { fitted -= 1; ctx.font = `${weight} ${fitted}px ${palette.font}`; }
    ctx.fillStyle = color; ctx.fillText(value, x, y);
  };
  const rule = (y: number) => { ctx.strokeStyle = palette["rule-2"]; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(72, y); ctx.lineTo(1368, y); ctx.stroke(); };
  const stageColors = [palette.kanji, palette.vocabulary, palette.accent, palette.warning, palette.success];
  ctx.fillStyle = palette.surface; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(mark, 66, 44, 64, 64);
  text("Kakehashi", 146, 89, 32, palette.ink, 600);
  ctx.textAlign = "right";
  text(capturedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), 1368, 86, 22, palette.muted);
  ctx.textAlign = "left";
  text(model.snapshot.username ? `${model.snapshot.username}'s progress` : "My WaniKani progress", 72, 172, 36, palette.ink, 550, 1296);
  rule(206);
  text("Level", 72, 250, 23, palette.muted);
  text(String(model.snapshot.level), 66, 346, 112, palette.ink, 600);
  text("/ 60", 66 + ctx.measureText(String(model.snapshot.level)).width + 18, 345, 34, palette.muted);
  text("Guru+ kanji", 568, 250, 23, palette.muted);
  text(number(model.snapshot.learnedGuruKanji), 564, 330, 66, palette.ink, 550);
  text("Lifetime accuracy", 1040, 250, 23, palette.muted);
  text(model.snapshot.accuracy === null ? "No data" : `${number(model.snapshot.accuracy)}%`, 1036, 330, 66, palette.ink, 550, 332);
  rule(386);

  if (options.format === "stats") {
    text("SRS distribution", 72, 438, 25, palette.ink, 550);
    const cx = 286; const cy = 605; const radius = 126;
    ctx.lineWidth = 32; ctx.strokeStyle = palette["paper-3"]; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    let angle = -Math.PI / 2;
    PUBLIC_SNAPSHOT_STAGES.forEach((stage, index) => {
      const count = model.snapshot.srs[stage];
      const span = model.totalLearned ? count / model.totalLearned * Math.PI * 2 : 0;
      if (span > 0) { ctx.strokeStyle = stageColors[index]; ctx.beginPath(); ctx.arc(cx, cy, radius, angle, angle + span); ctx.stroke(); }
      angle += span;
      const y = 486 + index * 58;
      ctx.fillStyle = stageColors[index]; ctx.fillRect(568, y - 15, 12, 12);
      text(stage, 600, y, 25);
      ctx.textAlign = "right";
      text(number(count), 1180, y, 29, palette.ink, 550);
      text(`${number(model.totalLearned ? count / model.totalLearned * 100 : 0)}%`, 1368, y, 22, palette.muted);
      ctx.textAlign = "left";
    });
    ctx.textAlign = "center"; text(number(model.totalLearned), cx, cy + 5, 54, palette.ink, 550, 205); text("learned items", cx, cy + 43, 21, palette.muted); ctx.textAlign = "left";
    text(insights.levelPace.median === null ? "Median pace: no completed levels" : `Median level pace  ${number(insights.levelPace.median)} days`, 568, 777, 22, palette.muted);
  } else if (options.format === "kanji") {
    text("Kanji collection", 72, 438, 25, palette.ink, 550);
    ctx.textAlign = "right"; text(`${number(model.kanji.length)} kanji in the catalog`, 1368, 438, 22, palette.muted); ctx.textAlign = "left";
    const gridTop = 482;
    const { columns, cellWidth, rowHeight, fontSize } = model.kanjiLayout;
    if (!model.kanji.length) text("No kanji available.", 72, gridTop + 42, 28, palette.muted);
    model.kanji.forEach((item, index) => {
      ctx.font = `${fontSize}px ${palette.japanese}`;
      ctx.fillStyle = item.stage >= 9 ? palette.success : item.stage >= 5 ? palette.accent : item.stage > 0 ? palette.kanji : palette.muted;
      ctx.fillText(item.character, 72 + index % columns * cellWidth, gridTop + Math.floor(index / columns) * rowHeight);
    });
    ctx.globalAlpha = 1;
    [["Not started", palette.muted], ["Apprentice", palette.kanji], ["Guru to Enlightened", palette.accent], ["Burned", palette.success]].forEach(([label, color], index) => {
      const x = 72 + index * 332; ctx.fillStyle = color; ctx.fillRect(x, canvas.height - 136, 13, 13); text(label, x + 26, canvas.height - 123, 21, palette.muted);
    });
  } else {
    const days = model.calendar;
    const max = Math.max(0, ...days.map((day) => day.count));
    text("Study activity", 72, 438, 25, palette.ink, 550);
    ctx.textAlign = "right";
    const date = (value: Date) => value.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    text(days.length ? `${date(days[0].date)} - ${date(days.at(-1)!.date)}` : "No activity in this period", 1368, 438, 21, palette.muted);
    ctx.textAlign = "left";
    const step = Math.min(40, 1210 / Math.max(1, (days.at(-1)?.column ?? 0) + 1));
    const xStart = 142; const yStart = 499;
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((label, row) => text(label, 72, yStart + row * 27 + 17, 17, palette.muted));
    model.calendarMonths.forEach((month) => text(month.date.toLocaleDateString(undefined, { month: "short" }), xStart + month.column * step, yStart - 18, 17, palette.muted));
    days.forEach((day) => {
      const x = xStart + day.column * step; const y = yStart + day.row * 27;
      ctx.fillStyle = palette["paper-2"]; ctx.fillRect(x, y, step - 4, 21);
      if (day.count > 0) { ctx.globalAlpha = 0.25 + Math.ceil(day.count / max * 4) / 4 * 0.75; ctx.fillStyle = palette.accent; ctx.fillRect(x, y, step - 4, 21); ctx.globalAlpha = 1; }
      if (insights.reviewSummary.available && day.reviewCoverage === "unavailable") { ctx.strokeStyle = palette["rule-2"]; ctx.setLineDash([3, 3]); ctx.strokeRect(x + 0.5, y + 0.5, step - 5, 20); ctx.setLineDash([]); }
    });
    text("0", 1050, 706, 17, palette.muted);
    for (let index = 0; index < 5; index += 1) { ctx.fillStyle = palette["paper-2"]; ctx.fillRect(1077 + index * 24, 691, 18, 18); if (index) { ctx.globalAlpha = 0.25 + index / 4 * 0.75; ctx.fillStyle = palette.accent; ctx.fillRect(1077 + index * 24, 691, 18, 18); ctx.globalAlpha = 1; } }
    text(`${number(max)} actions`, 1210, 706, 17, palette.muted, 400, 158);
    const activeDays = days.filter((day) => day.count > 0).length;
    text(`${number(activeDays)} active days`, 72, 742, 28, palette.ink, 550);
    text(`${number(days.reduce((sum, day) => sum + day.lessons, 0))} lessons`, 568, 742, 28, palette.ink, 550);
    text(`${number(days.reduce((sum, day) => sum + day.burns, 0))} burns`, 1040, 742, 28, palette.ink, 550);
    text(insights.reviewSummary.available ? days.some((day) => day.reviewCoverage === "unavailable") ? "Lessons, recorded reviews and burns. Dashed dates have no review history." : "Lessons, recorded reviews and burns; each action counted once." : "Dated lessons and burns. Historical reviews are unavailable.", 72, 780, 20, palette.muted);
  }
  rule(canvas.height - 90);
  text("WaniKani progress snapshot", 72, canvas.height - 44, 21, palette.muted);
  ctx.textAlign = "right";
  text(model.snapshot.daysStudying === undefined ? "kakehashi" : `${number(model.snapshot.daysStudying)} days since starting`, 1368, canvas.height - 44, 21, palette.muted);
  ctx.textAlign = "left";
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create the image.")), "image/png"));
}

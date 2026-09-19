export type PaceChartImageOptions = {
  levels: { level: number; days: number; excluded: boolean }[];
  currentLevel: number;
  goalLevel: number;
  projectedDate: string | null;
  paceDays: number | null;
  medianDays: number | null;
  clipAt: number | null;
  origin: "unlocked" | "started";
  capturedAt: Date;
};

export async function createPaceChartImage(options: PaceChartImageOptions): Promise<Blob> {
  const rows = options.levels.filter((row) => Number.isInteger(row.level) && row.level >= 1 && row.level <= 60 && Number.isFinite(row.days) && row.days >= 0).slice(0, 60);
  if (!rows.length) throw new Error("Complete a level before exporting the pace chart.");
  const canvas = document.createElement("canvas");
  canvas.width = 1440;
  canvas.height = 900;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image export is unavailable in this browser.");
  const tokens = getComputedStyle(document.documentElement);
  const color = (name: string, fallback: string) => tokens.getPropertyValue(name).trim() || fallback;
  const paper = color("--color-paper", "#f8f9fb");
  const ink = color("--color-ink", "#202124");
  const muted = color("--color-muted", "#63636e");
  const rule = color("--color-rule-2", "#d7d7de");
  const accent = color("--color-accent", "#235d93");
  const excluded = color("--color-warning", "#bd7a0e");
  const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  const date = (value: Date) => value.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const clip = options.clipAt != null && options.clipAt > 0 ? options.clipAt : Infinity;
  const max = Math.max(1, ...rows.map((row) => Math.min(row.days, clip)));

  ctx.fillStyle = paper; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = ink; ctx.font = "600 34px sans-serif"; ctx.fillText("Kakehashi", 64, 78);
  ctx.textAlign = "right"; ctx.fillStyle = muted; ctx.font = "21px sans-serif"; ctx.fillText(date(options.capturedAt), 1376, 78); ctx.textAlign = "left";
  ctx.fillStyle = ink; ctx.font = "600 44px sans-serif"; ctx.fillText("Level pace", 64, 154);
  ctx.fillStyle = muted; ctx.font = "23px sans-serif";
  ctx.fillText(`Current level ${options.currentLevel}  /  Goal level ${options.goalLevel}${options.projectedDate ? `  /  Estimated ${date(new Date(options.projectedDate))}` : ""}`, 64, 196);
  const metrics = [["Selected pace", options.paceDays], ["Median level", options.medianDays]] as const;
  metrics.forEach(([label, value], index) => {
    const x = 64 + index * 400;
    ctx.fillStyle = muted; ctx.font = "19px sans-serif"; ctx.fillText(label, x, 256);
    ctx.fillStyle = ink; ctx.font = "600 32px sans-serif"; ctx.fillText(value == null ? "No history" : `${number(value)} days`, x, 300);
  });
  ctx.fillStyle = muted; ctx.font = "19px sans-serif"; ctx.fillText("Completed levels", 864, 256);
  ctx.fillStyle = ink; ctx.font = "600 32px sans-serif"; ctx.fillText(String(rows.length), 864, 300);

  const left = 124, right = 1376, top = 362, bottom = 696, height = bottom - top;
  ctx.font = "17px sans-serif";
  for (let tick = 0; tick <= 4; tick += 1) {
    const y = bottom - tick / 4 * height;
    ctx.strokeStyle = rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    ctx.fillStyle = muted; ctx.textAlign = "right"; ctx.fillText(`${number(max * tick / 4)}d`, left - 14, y + 6);
  }
  ctx.textAlign = "center";
  const column = (right - left) / rows.length;
  const tickCount = Math.min(12, rows.length);
  const ticks = new Set(Array.from({ length: tickCount }, (_, index) => tickCount <= 1 ? 0 : Math.round(index * (rows.length - 1) / (tickCount - 1))));
  rows.forEach((row, index) => {
    const width = Math.min(84, column * 0.72);
    const x = left + (index + 0.5) * column;
    const barHeight = Math.min(row.days, clip) / max * height;
    ctx.fillStyle = row.excluded ? excluded : accent; ctx.fillRect(x - width / 2, bottom - barHeight, width, barHeight);
    if (ticks.has(index)) { ctx.fillStyle = muted; ctx.fillText(`L${row.level}`, x, bottom + 30); }
  });
  ctx.textAlign = "left";
  ctx.font = "20px sans-serif";
  ctx.fillStyle = accent; ctx.fillRect(64, 766, 18, 18); ctx.fillStyle = ink; ctx.fillText("Included", 94, 783);
  ctx.fillStyle = excluded; ctx.fillRect(244, 766, 18, 18); ctx.fillStyle = ink; ctx.fillText("Excluded from pace", 274, 783);
  ctx.fillStyle = muted; ctx.fillText(options.origin === "started" ? "Duration from first lesson" : "Duration from unlock", 594, 783);
  if (Number.isFinite(clip)) { ctx.textAlign = "right"; ctx.fillText(`Bars capped at ${number(clip)} days`, 1376, 783); ctx.textAlign = "left"; }
  ctx.fillStyle = muted; ctx.font = "18px sans-serif";
  ctx.fillText("Historical level duration. Future dates assume the selected pace continues; they are estimates.", 64, 853);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create the pace chart image.")), "image/png"));
}

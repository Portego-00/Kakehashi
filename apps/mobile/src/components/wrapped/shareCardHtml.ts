import { WrappedData } from "../../hooks/useWrappedData";
import { getSubjectTypeColor, withAlpha } from "../../utils/subjectColors";

/* ── helpers (duplicated from SummarySlide to keep this file self-contained) ── */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateRange(
  startedAt: string | null,
  passedAt: string | null
): string {
  const fmt = (d: string | null) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };
  const s = fmt(startedAt);
  const p = fmt(passedAt);
  if (s && p) return `${s} — ${p}`;
  if (s) return `Started ${s}`;
  if (p) return `Completed ${p}`;
  return "";
}

function formatTimeToGuru(ms?: number): string {
  if (!ms) return "";
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0 && hours > 0) return `${days}d ${hours}h`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return "< 1h";
}

/* ── badge / highlight builders ── */

function badgeHtml(character: string, type: string): string {
  let text: string;
  if (type === "radical") {
    text = getSubjectTypeColor("radical");
  } else if (type === "kanji") {
    text = getSubjectTypeColor("kanji");
  } else {
    text = getSubjectTypeColor("vocabulary");
  }
  const bg = withAlpha(text, 0.125);
  const border = withAlpha(text, 0.25);
  return `<div class="badge" style="background:${bg};border-color:${border};color:${text}">${escapeHtml(character)}</div>`;
}

function highlightRowHtml(
  badge: string,
  meaning: string,
  stat: string
): string {
  return `<div class="highlight-row">${badge}<div class="highlight-info"><div class="highlight-meaning">${escapeHtml(meaning)}</div><div class="highlight-stat">${escapeHtml(stat)}</div></div></div>`;
}

function highlightBlockHtml(
  icon: string,
  iconColor: string,
  title: string,
  rows: string
): string {
  return `<div class="highlight-block"><div class="highlight-title-row"><span style="color:${iconColor};font-size:10px">${icon}</span><span class="highlight-title">${title}</span></div>${rows}</div>`;
}

/* ──────────────────────────────────────────────────────────────── */

/**
 * Generates a self-contained HTML page that renders the summary card,
 * captures it with html2canvas (loaded from CDN), and posts the base64
 * PNG back via `window.ReactNativeWebView.postMessage`.
 */
export function generateShareCardHtml(data: WrappedData): string {
  const topMissed = data.mostMissed.slice(0, 2);
  const showFastest =
    data.fastestToGuru &&
    (!data.starPerformer ||
      data.fastestToGuru.subjectId !== data.starPerformer.subjectId);

  const dateRange = formatDateRange(data.startedAt, data.passedAt);
  const timeDaysDisplay = data.timeDays === 0 ? "< 1" : String(data.timeDays);
  const timeDaysLabel = data.timeDays === 1 ? "DAY" : "DAYS";

  /* ── Meta text ── */
  let metaHtml = "";
  if (data.username || dateRange) {
    const parts: string[] = [];
    if (data.username) parts.push(`@${escapeHtml(data.username)}`);
    if (dateRange) parts.push(escapeHtml(dateRange));
    metaHtml = `<div class="meta">${parts.join("&nbsp;&nbsp;·&nbsp;&nbsp;")}</div>`;
  }

  /* ── Highlight blocks ── */
  let highlightsHtml = "";

  if (topMissed.length > 0) {
    const rows = topMissed
      .map((s) =>
        highlightRowHtml(
          badgeHtml(s.characters, s.subjectType),
          s.primaryMeaning,
          `${s.percentageCorrect}% accuracy`
        )
      )
      .join("");
    highlightsHtml += highlightBlockHtml("⚠", "#f87171", "TOUGHEST", rows);
  }

  if (data.starPerformer) {
    highlightsHtml += highlightBlockHtml(
      "★",
      "#fbbf24",
      "STAR PERFORMER",
      highlightRowHtml(
        badgeHtml(
          data.starPerformer.characters,
          data.starPerformer.subjectType
        ),
        data.starPerformer.primaryMeaning,
        `${data.starPerformer.percentageCorrect}% · ${data.starPerformer.maxStreak} streak`
      )
    );
  }

  if (showFastest && data.fastestToGuru) {
    highlightsHtml += highlightBlockHtml(
      "⚡",
      "#34d399",
      "FASTEST TO GURU",
      highlightRowHtml(
        badgeHtml(
          data.fastestToGuru.characters,
          data.fastestToGuru.subjectType
        ),
        data.fastestToGuru.primaryMeaning,
        formatTimeToGuru(data.fastestToGuru.timeToGuru)
      )
    );
  }

  /* ── Full HTML page ── */
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=350, initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Hiragino Sans',sans-serif;
  background:transparent;
  -webkit-font-smoothing:antialiased;
}
.card{
  width:350px;
  padding:32px 24px 22px;
  background:linear-gradient(135deg,#120428 0%,#1e0c50 33%,#321872 66%,#4a20a0 100%);
  border-radius:28px;
  border:1.5px solid rgba(255,255,255,0.1);
  display:flex;flex-direction:column;align-items:center;
  overflow:hidden;position:relative;
}
.hero{display:flex;flex-direction:column;align-items:center;margin-bottom:22px;width:100%}
.accent-line{width:36px;height:1px;background:rgba(255,255,255,0.18);margin:6px 0}
.level-label{font-size:11px;font-weight:800;color:rgba(255,255,255,0.5);letter-spacing:6px}
.level-number{font-size:82px;font-weight:900;color:#fff;line-height:90px;margin:2px 0}
.summary-label{font-size:13px;font-weight:800;color:rgba(255,255,255,0.42);letter-spacing:10px}
.meta{font-size:11px;font-weight:600;color:rgba(255,255,255,0.28);margin-top:10px;letter-spacing:0.3px}
.stats-strip{
  display:flex;flex-direction:row;
  background:rgba(255,255,255,0.06);
  border-radius:16px;border:1px solid rgba(255,255,255,0.07);
  padding:14px 0;margin-bottom:14px;width:100%;
}
.stat-col{flex:1;display:flex;flex-direction:column;align-items:center}
.stat-divider{width:1px;background:rgba(255,255,255,0.1);margin:2px 0}
.stat-value{font-size:20px;font-weight:800;color:#fff;margin-bottom:3px}
.stat-label{font-size:9px;font-weight:700;color:rgba(255,255,255,0.38);letter-spacing:2px}
.highlight-block{
  background:rgba(255,255,255,0.05);
  border-radius:14px;border:1px solid rgba(255,255,255,0.06);
  padding:14px;margin-bottom:10px;width:100%;
  display:flex;flex-direction:column;gap:10px;
}
.highlight-title-row{display:flex;align-items:center;gap:5px}
.highlight-title{font-size:9px;font-weight:800;color:rgba(255,255,255,0.4);letter-spacing:2.5px}
.highlight-row{display:flex;align-items:center;gap:12px}
.highlight-info{flex:1;display:flex;flex-direction:column;gap:2px}
.highlight-meaning{font-size:14px;font-weight:700;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.highlight-stat{font-size:11px;font-weight:600;color:rgba(255,255,255,0.4)}
.badge{
  min-width:40px;height:40px;border-radius:10px;border:1px solid;
  display:flex;align-items:center;justify-content:center;
  font-size:20px;font-weight:700;padding:0 8px;flex-shrink:0;
}
.branding-row{display:flex;align-items:center;justify-content:center;gap:12px;padding-top:4px;width:100%}
.brand-line{flex:1;height:0.5px;background:rgba(255,255,255,0.1)}
.brand-text{font-size:10px;font-weight:700;color:rgba(255,255,255,0.2);letter-spacing:5px}
</style>
</head>
<body>
<div id="card" class="card">
  <div class="hero">
    <div class="accent-line"></div>
    <div class="level-label">LEVEL</div>
    <div class="level-number">${data.level}</div>
    <div class="summary-label">SUMMARY</div>
    <div class="accent-line"></div>
    ${metaHtml}
  </div>

  <div class="stats-strip">
    <div class="stat-col">
      <div class="stat-value">${escapeHtml(timeDaysDisplay)}</div>
      <div class="stat-label">${timeDaysLabel}</div>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-col">
      <div class="stat-value">${data.overallAccuracy}%</div>
      <div class="stat-label">ACCURACY</div>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-col">
      <div class="stat-value">${data.totalReviews.toLocaleString()}</div>
      <div class="stat-label">REVIEWS</div>
    </div>
  </div>

  ${highlightsHtml}

  <div class="branding-row">
    <div class="brand-line"></div>
    <div class="brand-text">KAKEHASHI</div>
    <div class="brand-line"></div>
  </div>
</div>

<script
  src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"
  onerror="window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:'cdn'}))"
></script>
<script>
window.onload=function(){
  if(typeof html2canvas==='undefined'){
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:'lib missing'}));
    return;
  }
  setTimeout(function(){
    html2canvas(document.getElementById('card'),{
      backgroundColor:null,
      scale:3,
      logging:false,
      useCORS:true
    }).then(function(c){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'success',data:c.toDataURL('image/png')}));
    }).catch(function(e){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:e.message}));
    });
  },150);
};
</script>
</body>
</html>`;
}

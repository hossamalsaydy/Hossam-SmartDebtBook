/* =========================================================
   charts.js — رسوم بيانية خفيفة بدون أي مكتبات خارجية
   (canvas 2D بسيط: أعمدة، خطوط، دائري)
   ========================================================= */

const Charts = (() => {

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
  }

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || canvas.parentElement.clientWidth || 400;
    const h = canvas.height || 220;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  /** رسم بياني بأعمدة مزدوجة (دين / سداد) لكل شهر */
  function drawGroupedBar(canvasId, labels, seriesA, seriesB, labelA, labelB) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);

    const padL = 46, padB = 30, padT = 16, padR = 10;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const maxVal = Math.max(1, ...seriesA, ...seriesB);
    const colA = cssVar('--rose-600');
    const colB = cssVar('--teal-600');
    const gridColor = cssVar('--line');
    const textColor = cssVar('--ink-500');

    // grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.font = '11px Tajawal, sans-serif';
    ctx.fillStyle = textColor;
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = padT + chartH - (chartH * i) / steps;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      const val = Math.round((maxVal * i) / steps);
      ctx.fillText(Utils.formatNumber(val), 4, y + 4);
    }

    const n = labels.length || 1;
    const groupW = chartW / n;
    const barW = Math.min(18, groupW / 3.2);

    labels.forEach((label, i) => {
      const gx = padL + i * groupW + groupW / 2;
      const aH = (seriesA[i] / maxVal) * chartH;
      const bH = (seriesB[i] / maxVal) * chartH;

      ctx.fillStyle = colA;
      roundRect(ctx, gx - barW - 3, padT + chartH - aH, barW, aH, 3);
      ctx.fill();

      ctx.fillStyle = colB;
      roundRect(ctx, gx + 3, padT + chartH - bH, barW, bH, 3);
      ctx.fill();

      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.fillText(label, gx, h - 8);
    });
    ctx.textAlign = 'start';

    // legend handled in HTML via caller if needed
    canvas.dataset.legendA = labelA;
    canvas.dataset.legendB = labelB;
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (h <= 0) h = 0.0001;
    const rad = Math.min(r, w / 2, Math.abs(h) / 2 || r);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  /** رسم دائري بسيط لتوزيع الأرصدة */
  function drawPie(canvasId, dataObj) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);

    const entries = Object.entries(dataObj).filter(([, v]) => v > 0);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    const cx = w / 2 - 60, cy = h / 2, radius = Math.min(cy, w / 2 - 90) - 6;

    if (total === 0 || entries.length === 0) {
      ctx.fillStyle = cssVar('--ink-500');
      ctx.font = '13px Tajawal, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('لا توجد بيانات كافية بعد', w / 2, h / 2);
      ctx.textAlign = 'start';
      return;
    }

    const palette = [cssVar('--rose-600'), cssVar('--teal-600'), cssVar('--amber-600'), cssVar('--slate-500')];
    let start = -Math.PI / 2;
    entries.forEach(([label, val], i) => {
      const slice = (val / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = palette[i % palette.length];
      ctx.fill();
      start += slice;
    });

    // donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = cssVar('--card-bg');
    ctx.fill();

    // legend
    let ly = cy - (entries.length * 22) / 2;
    ctx.font = '12px Tajawal, sans-serif';
    entries.forEach(([label, val], i) => {
      const lx = w / 2 + 70;
      ctx.fillStyle = palette[i % palette.length];
      roundRect(ctx, lx - 90, ly - 8, 10, 10, 2);
      ctx.fill();
      ctx.fillStyle = cssVar('--ink-700');
      ctx.textAlign = 'start';
      ctx.fillText(`${label} — ${Utils.formatNumber(val)}`, lx - 74, ly + 1);
      ly += 22;
    });
  }

  return { drawGroupedBar, drawPie };
})();

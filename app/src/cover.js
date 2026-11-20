// cover.js — draws a GTA 6-style multi-panel poster onto any canvas.
// Pure canvas 2D, no network, no libraries. The same function renders the
// live preview and the exported PNG, so what you see is what you share.
//
// Layout (fractions of canvas width W / height H):
//   top strip: press quote + stars + VOL ticket
//   6 photo panels: 4 corners + tall hero centre + wide bottom strip
//   giant gradient title + script subtitle overlapping the panels
//   tagline ribbon, then a billing block with barcode at the foot.
export const PANEL_DEFS = [
  { id: 'tl', label: 'THE INSIDER', x: 0.02, y: 0.065, w: 0.295, h: 0.32 },
  { id: 'hero', label: 'THE DRIVER', x: 0.325, y: 0.065, w: 0.35, h: 0.55 },
  { id: 'tr', label: 'THE BOSS', x: 0.685, y: 0.065, w: 0.295, h: 0.32 },
  { id: 'bl', label: 'THE RIDER', x: 0.02, y: 0.395, w: 0.295, h: 0.22 },
  { id: 'br', label: 'THE COURIER', x: 0.685, y: 0.395, w: 0.295, h: 0.22 },
  { id: 'strip', label: 'THE CREW', x: 0.02, y: 0.625, w: 0.96, h: 0.11 },
];

export const GRADES = {
  sunset: {
    name: 'Vice City Sunset',
    filter: 'saturate(1.28) contrast(1.08) sepia(0.16)',
    overlay: [['rgba(255,126,46,0.34)', 0], ['rgba(255,46,136,0.30)', 0.55], ['rgba(120,40,220,0.28)', 1]],
    mode: 'soft-light',
  },
  neon: {
    name: 'Neon Nights',
    filter: 'saturate(1.55) contrast(1.16) hue-rotate(-10deg)',
    overlay: [['rgba(255,0,160,0.34)', 0], ['rgba(0,220,255,0.26)', 0.6], ['rgba(90,0,180,0.30)', 1]],
    mode: 'soft-light',
  },
  golden: {
    name: 'Golden Hour',
    filter: 'saturate(1.18) contrast(1.05) sepia(0.34)',
    overlay: [['rgba(255,190,60,0.32)', 0], ['rgba(255,140,40,0.22)', 1]],
    mode: 'soft-light',
  },
  noir: {
    name: 'Noir Pink',
    filter: 'saturate(0.35) contrast(1.28) brightness(0.94)',
    overlay: [['rgba(255,60,140,0.30)', 0], ['rgba(20,10,40,0.34)', 1]],
    mode: 'soft-light',
  },
  original: {
    name: 'Original',
    filter: 'none',
    overlay: [],
    mode: 'soft-light',
  },
};

export const BORDER_COLORS = { gold: '#f7c948', white: '#f5f0e6', black: '#14101c' };

const DARK = '#1d0b2e';
const PINK = '#ff5da2';

/** Deterministic pseudo-random from a string seed (for barcode + grain). */
function seededRand(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitFont(ctx, text, maxWidth, startSize, family, weight = 900) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

function drawPalm(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6, -34, 2, -62);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * (0.08 + i * 0.16);
    const len = 34 - Math.abs(i - 2.5) * 3;
    ctx.beginPath();
    ctx.moveTo(2, -62);
    ctx.quadraticCurveTo(2 + Math.cos(a) * len * 0.6, -62 + Math.sin(a) * len * 0.7 - 8, 2 + Math.cos(a) * len, -62 + Math.sin(a) * len + 14);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPanelPhoto(ctx, panel, rect, state) {
  const { img, zoom = 1, ox = 0, oy = 0, fit = 'fill', flip = false } = panel;
  if (!img) return;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = fit === 'fit'
    ? Math.min(rect.w / iw, rect.h / ih)
    : Math.max(rect.w / iw, rect.h / ih);
  const scale = base * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const cx = rect.x + rect.w / 2 + ox * rect.w * 0.5;
  const cy = rect.y + rect.h / 2 + oy * rect.h * 0.5;
  ctx.save();
  if (flip) { ctx.translate(cx, cy); ctx.scale(-1, 1); ctx.translate(-cx, -cy); }
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

function drawPanelLabel(ctx, rect, text, W, bottom = false) {
  if (!text) return;
  const pad = W * 0.008;
  const h = W * 0.032;
  const fontPx = Math.max(11, W * 0.017);
  ctx.font = `800 ${fontPx}px 'Arial Black', 'Helvetica Neue', Arial, sans-serif`;
  const tw = ctx.measureText(text).width;
  const bw = tw + pad * 2.4;
  const bx = rect.x + W * 0.006;
  const by = bottom ? rect.y + rect.h - h - W * 0.006 : rect.y + W * 0.006;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bx + h * 0.35, by);
  ctx.lineTo(bx + bw, by);
  ctx.lineTo(bx + bw - h * 0.35, by + h);
  ctx.lineTo(bx, by + h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(12,6,20,0.92)';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + pad * 1.2, by + h / 2 + 1);
  ctx.restore();
}

function drawBarcode(ctx, x, y, w, h, seedText) {
  try { ctx.letterSpacing = '0px'; } catch (_) {}
  const rnd = seededRand(seedText || 'vice');
  ctx.fillStyle = '#f5f0e6';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 24);
  ctx.fillStyle = '#14101c';
  let cx = x;
  while (cx < x + w - 2) {
    const bw = 1 + Math.floor(rnd() * 3);
    const gap = 1 + Math.floor(rnd() * 2);
    if (rnd() > 0.22) ctx.fillRect(cx, y, bw, h);
    cx += bw + gap;
  }
  const num = '0 2113 1226';
  let fs = Math.max(9, h * 0.34);
  ctx.font = `600 ${fs}px 'Courier New', monospace`;
  while (ctx.measureText(num).width > w + 6 && fs > 7) {
    fs -= 1;
    ctx.font = `600 ${fs}px 'Courier New', monospace`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(num, x + w / 2, y + h + 4);
}

/**
 * Draws the whole cover.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} state { panels: [{img, zoom, ox, oy, fit, flip, label}], title, subtitle, tagline,
 *   quote, quoteSource, volume, billing, grade, gradeIntensity, slant, border, grain }
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const s = state || {};
  const grade = GRADES[s.grade] || GRADES.sunset;
  const intensity = s.gradeIntensity == null ? 1 : s.gradeIntensity;
  const border = BORDER_COLORS[s.border] || BORDER_COLORS.gold;
  const slant = s.slant ? W * 0.012 : 0;

  // Backdrop: deep violet dusk.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2a1145');
  bg.addColorStop(0.55, '#1d0b2e');
  bg.addColorStop(1, '#12061f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Sun glow behind the hero panel.
  const glow = ctx.createRadialGradient(W * 0.5, H * 0.22, 10, W * 0.5, H * 0.22, W * 0.55);
  glow.addColorStop(0, 'rgba(255,150,80,0.55)');
  glow.addColorStop(0.5, 'rgba(255,60,140,0.22)');
  glow.addColorStop(1, 'rgba(255,60,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ---- Panels ----
  // Cast labels are collected and drawn AFTER the title, so the title's
  // shadow can never paint over a label.
  const pendingLabels = [];
  const rects = PANEL_DEFS.map((def) => ({
    ...def,
    x: def.x * W, y: def.y * H, w: def.w * W, h: def.h * H,
  }));
  const panels = s.panels || [];
  rects.forEach((rect, i) => {
    const panel = panels[i] || {};
    const px = rect.x, py = rect.y, pw = rect.w, ph = rect.h;
    ctx.save();
    ctx.beginPath();
    const topShift = rect.id === 'hero' ? 0 : slant;
    ctx.moveTo(px + topShift, py);
    ctx.lineTo(px + pw + topShift, py);
    ctx.lineTo(px + pw - topShift, py + ph);
    ctx.lineTo(px - topShift, py + ph);
    ctx.closePath();
    ctx.clip();
    if (panel.img) {
      ctx.filter = grade.filter;
      drawPanelPhoto(ctx, panel, { x: px - slant, y: py, w: pw + slant * 2, h: ph }, s);
      ctx.filter = 'none';
    } else {
      // Empty panel: sunset placeholder so the cover never looks broken.
      const g = ctx.createLinearGradient(px, py, px, py + ph);
      g.addColorStop(0, '#ff9e56');
      g.addColorStop(0.5, '#ff5e8a');
      g.addColorStop(1, '#7b2ff7');
      ctx.fillStyle = g;
      ctx.fillRect(px - slant, py, pw + slant * 2, ph);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `700 ${Math.max(13, W * 0.02)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+ ADD PHOTO', px + pw / 2, py + ph / 2);
    }
    // Grade tint inside the panel.
    if (grade.overlay.length && intensity > 0) {
      const og = ctx.createLinearGradient(px, py, px + pw * 0.4, py + ph);
      grade.overlay.forEach(([c, stop]) => og.addColorStop(stop, c));
      ctx.globalCompositeOperation = grade.mode;
      ctx.globalAlpha = intensity * 0.85;
      ctx.fillStyle = og;
      ctx.fillRect(px - slant, py, pw + slant * 2, ph);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    // Bottom shade so cast labels stay readable on any photo.
    const shade = ctx.createLinearGradient(0, py + ph * 0.62, 0, py + ph);
    shade.addColorStop(0, 'rgba(10,4,18,0)');
    shade.addColorStop(1, 'rgba(10,4,18,0.55)');
    ctx.fillStyle = shade;
    ctx.fillRect(px - slant, py, pw + slant * 2, ph);
    ctx.restore();

    // Gold frame.
    ctx.save();
    ctx.beginPath();
    const topShift2 = rect.id === 'hero' ? 0 : slant;
    ctx.moveTo(px + topShift2, py);
    ctx.lineTo(px + pw + topShift2, py);
    ctx.lineTo(px + pw - topShift2, py + ph);
    ctx.lineTo(px - topShift2, py + ph);
    ctx.closePath();
    ctx.strokeStyle = border;
    ctx.lineWidth = Math.max(2, W * 0.004);
    ctx.stroke();
    ctx.restore();

    pendingLabels.push({ rect, text: panel.label ?? rect.label, bottom: rect.id === 'strip' });
  });

  // ---- Top strip: stars, quote, VOL ticket ----
  const topY = H * 0.038;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const starSize = Math.max(13, W * 0.024);
  ctx.font = `${starSize}px system-ui, sans-serif`;
  ctx.fillStyle = '#f7c948';
  ctx.fillText('★★★★★', W * 0.02, topY);
  const quote = (s.quote || '').trim();
  const quoteSrc = (s.quoteSource || '').trim();
  const quoteText = quote ? `\u201C${quote.toUpperCase()}\u201D` : '';
  const fullQuote = quoteText + (quoteSrc ? `  — ${quoteSrc.toUpperCase()}` : '');
  const qx = W * 0.02 + starSize * 5.6;
  // Shrink the quote until it clears the VOL ticket.
  let qFont = Math.max(11, W * 0.019);
  ctx.font = `italic 700 ${qFont}px Georgia, serif`;
  ctx.fillStyle = '#ffe9f3';
  const quoteMaxW = W * 0.98 - W * 0.13 - qx;
  while (qFont > 9 && ctx.measureText(fullQuote).width > quoteMaxW) {
    qFont -= 1;
    ctx.font = `italic 700 ${qFont}px Georgia, serif`;
  }
  ctx.fillText(fullQuote, qx, topY);
  // VOL ticket, top right.
  const vol = (s.volume || 'VOL. 1').toUpperCase();
  ctx.font = `900 ${Math.max(11, W * 0.02)}px 'Arial Black', Arial, sans-serif`;
  const vw = ctx.measureText(vol).width + W * 0.03;
  const vh = H * 0.028;
  ctx.save();
  ctx.translate(W * 0.98 - vw, H * 0.012);
  ctx.beginPath();
  ctx.moveTo(vh * 0.4, 0);
  ctx.lineTo(vw, 0);
  ctx.lineTo(vw - vh * 0.4, vh);
  ctx.lineTo(0, vh);
  ctx.closePath();
  ctx.fillStyle = '#f7c948';
  ctx.fill();
  ctx.fillStyle = '#1d0b2e';
  ctx.textAlign = 'center';
  ctx.fillText(vol, vw / 2, vh / 2 + 1);
  ctx.restore();

  // ---- Title ----
  const title = (s.title || 'VICE CITY').trim().toUpperCase();
  const titleMaxW = W * 0.96;
  const titleSize = fitFont(ctx, title, titleMaxW, W * 0.16, `'Arial Black', 'Helvetica Neue', Arial, sans-serif`);
  const titleY = H * 0.655;
  ctx.textAlign = 'center';
  try { ctx.letterSpacing = '2px'; } catch (_) { /* older canvas */ }
  const tGrad = ctx.createLinearGradient(0, titleY - titleSize * 0.85, 0, titleY + titleSize * 0.15);
  tGrad.addColorStop(0, '#fff3a3');
  tGrad.addColorStop(0.35, '#ffb347');
  tGrad.addColorStop(0.62, '#ff5e62');
  tGrad.addColorStop(0.85, '#ff2e88');
  tGrad.addColorStop(1, '#b537f2');
  const drawTitle = (dx, dy, fill, stroke) => {
    ctx.lineJoin = 'round';
    ctx.lineWidth = titleSize * 0.085;
    ctx.strokeStyle = stroke;
    ctx.strokeText(title, W / 2 + dx, titleY + dy);
    ctx.fillStyle = fill;
    ctx.fillText(title, W / 2 + dx, titleY + dy);
  };
  ctx.save();
  ctx.shadowColor = 'rgba(10,2,20,0.65)';
  ctx.shadowBlur = titleSize * 0.16;
  ctx.shadowOffsetY = titleSize * 0.05;
  drawTitle(W * 0.006, H * 0.008, DARK, DARK);
  ctx.restore();
  drawTitle(0, 0, tGrad, '#2a0a3d');
  try { ctx.letterSpacing = '0px'; } catch (_) {}

  // Script subtitle, overlapping the title's foot.
  const subtitle = (s.subtitle || '').trim();
  if (subtitle) {
    const subSize = fitFont(ctx, subtitle, W * 0.8, W * 0.075, `'Brush Script MT', 'Segoe Script', 'Snell Roundhand', cursive`, 700);
    ctx.save();
    ctx.translate(W / 2, H * 0.735);
    ctx.rotate(-0.045);
    ctx.font = `italic 700 ${subSize}px 'Brush Script MT', 'Segoe Script', 'Snell Roundhand', cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = subSize * 0.09;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#fff0f6';
    ctx.strokeText(subtitle, 0, 0);
    ctx.fillStyle = '#ff5da2';
    ctx.fillText(subtitle, 0, 0);
    ctx.restore();
  }

  // ---- Tagline ribbon ----
  const tagline = (s.tagline || '').trim().toUpperCase();
  if (tagline) {
    const ribH = H * 0.032;
    const ribY = H * 0.775;
    const ribFont = Math.max(11, W * 0.02);
    ctx.font = `800 ${ribFont}px 'Arial Black', Arial, sans-serif`;
    try { ctx.letterSpacing = '3px'; } catch (_) {}
    let tw = ctx.measureText(tagline).width + W * 0.06;
    if (tw > W * 0.92) tw = W * 0.92;
    ctx.save();
    ctx.translate(W / 2, ribY + ribH / 2);
    ctx.rotate(-0.008);
    ctx.beginPath();
    ctx.moveTo(-tw / 2 - ribH * 0.4, -ribH / 2);
    ctx.lineTo(tw / 2, -ribH / 2);
    ctx.lineTo(tw / 2 + ribH * 0.4, ribH / 2);
    ctx.lineTo(-tw / 2, ribH / 2);
    ctx.closePath();
    ctx.fillStyle = '#0c0614';
    ctx.fill();
    ctx.strokeStyle = PINK;
    ctx.lineWidth = Math.max(1.5, W * 0.002);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    try { ctx.letterSpacing = '3px'; } catch (_) {}
    ctx.fillText(tagline, 0, 1);
    ctx.restore();
    // NB: restore() also restores letterSpacing, so reset AFTER it.
    try { ctx.letterSpacing = '0px'; } catch (_) {}
  }

  // ---- Cast labels (on top of everything so far) ----
  pendingLabels.forEach(({ rect, text, bottom }) => drawPanelLabel(ctx, rect, text, W, bottom));

  // ---- Palm silhouettes flanking the billing block ----
  drawPalm(ctx, W * 0.035, H * 0.985, W * 0.00062, '#2a1145');
  drawPalm(ctx, W * 0.965, H * 0.985, W * 0.00056, '#2a1145');

  // ---- Billing block ----
  const billY = H * 0.845;
  try { ctx.letterSpacing = '0px'; } catch (_) {}
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const castNames = panels
    .map((p, i) => (p.label || PANEL_DEFS[i].label).replace(/^THE\s+/i, ''))
    .filter(Boolean);
  const billingTop = (s.billing || 'A SUNSET PICTURES PRODUCTION').toUpperCase();
  const billingMid = castNames.length ? `STARRING ${castNames.join('  ·  ')}` : '';
  const billingBot = 'SHOT ON YOUR OWN CAMERA  ·  GRADED BY HAND  ·  PHOTOS NEVER LEAVE THIS MACHINE';
  ctx.fillStyle = '#f5e9d0';
  const bFont0 = Math.max(10, W * 0.0165);
  // Auto-fit every billing line to the page width, whatever the font fallback.
  const fitLine = (text, size, weight = 700) => {
    let fs = size;
    ctx.font = `${weight} ${fs}px 'Arial Narrow', Arial, sans-serif`;
    while (fs > 6 && ctx.measureText(text).width > W * 0.94) {
      fs -= 0.5;
      ctx.font = `${weight} ${fs}px 'Arial Narrow', Arial, sans-serif`;
    }
    return fs;
  };
  let fs = fitLine(billingTop, bFont0);
  ctx.font = `700 ${fs}px 'Arial Narrow', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(billingTop, W / 2, billY);
  fs = fitLine(billingMid, bFont0 * 0.92);
  ctx.font = `700 ${fs}px 'Arial Narrow', Arial, sans-serif`;
  if (billingMid) ctx.fillText(billingMid, W / 2, billY + bFont0 * 1.5);
  ctx.fillStyle = '#c9a86a';
  fs = fitLine(billingBot, bFont0 * 0.85, 600);
  ctx.font = `600 ${fs}px 'Arial Narrow', Arial, sans-serif`;
  ctx.fillText(billingBot, W / 2, billY + bFont0 * 2.95);

  // COMING SOON, bottom left.
  ctx.textAlign = 'left';
  ctx.fillStyle = PINK;
  const csFont = Math.max(13, W * 0.028);
  ctx.font = `900 ${csFont}px 'Arial Black', Arial, sans-serif`;
  try { ctx.letterSpacing = '4px'; } catch (_) {}
  ctx.fillText('COMING SOON', W * 0.02, H * 0.975);
  try { ctx.letterSpacing = '0px'; } catch (_) {}

  // Barcode, bottom right.
  drawBarcode(ctx, W * 0.875, H * 0.925, W * 0.085, H * 0.032, title + (s.volume || ''));

  // ---- Film grain (deterministic, subtle) ----
  if (s.grain !== false) {
    const rnd = seededRand('grain-' + title);
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#ffffff';
    const dots = Math.floor((W * H) / 9000);
    for (let i = 0; i < dots; i++) {
      ctx.fillRect(rnd() * W, rnd() * H, 1.4, 1.4);
    }
    ctx.restore();
  }
}

/** Default state: demo cover with no photos yet. */
export function defaultState() {
  return {
    panels: PANEL_DEFS.map((d) => ({ img: null, zoom: 1, ox: 0, oy: 0, fit: 'fill', flip: false, label: d.label })),
    title: 'NEON TIDE',
    subtitle: 'chasing the last light',
    tagline: 'ONE COAST · FIVE STORIES · NO WAY HOME',
    quote: 'Pure golden-hour mayhem',
    quoteSource: 'The Harbor Gazette',
    volume: 'VOL. 1',
    billing: 'A SUNSET PICTURES PRODUCTION',
    grade: 'sunset',
    gradeIntensity: 1,
    slant: true,
    border: 'gold',
    grain: true,
  };
}

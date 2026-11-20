// main.js — wires the Vice Line studio: photo slots, per-panel crop,
// caption + grade controls, and PNG export. All state lives in one object;
// every change re-renders through cover.js, so preview == export.
import { drawCover, defaultState, PANEL_DEFS, GRADES, BORDER_COLORS } from './cover.js';
import { buildSamples } from './samples.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const statusEl = $('status');
const state = defaultState();
let selected = 1; // hero by default
let demoSamples = null;

const SIZES = {
  '4:5': { w: 1080, h: 1350, label: '1080 × 1350 · post' },
  '1:1': { w: 1080, h: 1080, label: '1080 × 1080 · square' },
  '9:16': { w: 1080, h: 1920, label: '1080 × 1920 · story' },
};
let exportSize = '4:5';

function setStatus(msg) { statusEl.textContent = msg; }

function render() {
  const size = SIZES[exportSize];
  const scale = 540 / size.w;
  canvas.width = Math.round(size.w * scale);
  canvas.height = Math.round(size.h * scale);
  drawCover(canvas, state);
  syncPanelUI();
}

function syncPanelUI() {
  document.querySelectorAll('.slot').forEach((el, i) => {
    el.classList.toggle('active', i === selected);
    el.classList.toggle('filled', !!state.panels[i].img);
    el.querySelector('.slot-label').textContent = state.panels[i].label;
  });
  const p = state.panels[selected];
  $('zoom').value = p.zoom;
  $('zoomVal').textContent = `${p.zoom.toFixed(2)}×`;
  $('panX').value = p.ox;
  $('panY').value = p.oy;
  $('fitBtn').textContent = p.fit === 'fill' ? 'Mode: Fill' : 'Mode: Fit';
  $('flipBtn').textContent = p.flip ? 'Flipped ✓' : 'Flip';
  $('selName').textContent = `${PANEL_DEFS[selected].id.toUpperCase()} — ${p.label}`;
  $('castInput').value = p.label;
}

/** Loads an image from a File/Blob/URL, resolving once drawable. */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not read that image'));
    img.src = src;
  });
}

async function setPanelPhoto(i, file) {
  try {
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    const p = state.panels[i];
    p.img = img;
    p.zoom = 1;
    p.ox = 0;
    p.oy = 0;
    p.fit = 'fill';
    render();
    setStatus(`Photo placed in ${PANEL_DEFS[i].id.toUpperCase()}. Drag it on the cover to reposition.`);
  } catch (e) {
    setStatus('That file could not be read as an image — try a JPG or PNG.');
  }
}

function loadDemo() {
  if (!demoSamples) demoSamples = buildSamples();
  // Assign scenes per panel: hero gets the car, corners get the city.
  const byPanel = [0, 5, 3, 2, 1, 4]; // tl, hero, tr, bl, br, strip
  demoSamples.forEach((s, k) => {
    const p = state.panels[byPanel.indexOf(k)];
    p.img = s.canvas;
    p.zoom = 1.06;
    p.ox = 0;
    p.oy = 0;
    p.fit = 'fill';
  });
  state.panels[1].zoom = 1.12;
  render();
  setStatus('Demo cover loaded — swap any panel with your own photo.');
}

// ---- Panel slots ----
const slotsEl = $('slots');
PANEL_DEFS.forEach((def, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'slot';
  b.innerHTML = `<span class="slot-id">${def.id.toUpperCase()}</span><span class="slot-label"></span>`;
  b.addEventListener('click', () => { selected = i; render(); });
  slotsEl.appendChild(b);
});

// ---- Upload: picker, drag & drop onto the cover, paste ----
$('photo').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) setPanelPhoto(selected, f);
  e.target.value = '';
});
$('uploadBtn').addEventListener('click', () => $('photo').click());

function panelAt(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const fx = (clientX - r.left) / r.width;
  const fy = (clientY - r.top) / r.height;
  for (let i = PANEL_DEFS.length - 1; i >= 0; i--) {
    const d = PANEL_DEFS[i];
    if (fx >= d.x && fx <= d.x + d.w && fy >= d.y && fy <= d.y + d.h) return i;
  }
  return -1;
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  selected = i;
  const p = state.panels[i];
  drag = { x: e.clientX, y: e.clientY, ox: p.ox, oy: p.oy, moved: false };
  canvas.setPointerCapture(e.pointerId);
  render();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const r = canvas.getBoundingClientRect();
  const d = PANEL_DEFS[selected];
  const p = state.panels[selected];
  const dx = (e.clientX - drag.x) / r.width / d.w;
  const dy = (e.clientY - drag.y) / r.height / d.h;
  if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) drag.moved = true;
  p.ox = Math.max(-1, Math.min(1, drag.ox + dx));
  p.oy = Math.max(-1, Math.min(1, drag.oy + dy));
  render();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  e.preventDefault();
  const p = state.panels[i];
  p.zoom = Math.max(1, Math.min(3, p.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  selected = i;
  render();
}, { passive: false });

['dragover', 'dragenter'].forEach((ev) => canvas.addEventListener(ev, (e) => {
  e.preventDefault();
  canvas.classList.add('dropping');
}));
['dragleave', 'drop'].forEach((ev) => canvas.addEventListener(ev, () => canvas.classList.remove('dropping')));
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!f) return;
  const i = panelAt(e.clientX, e.clientY);
  setPanelPhoto(i < 0 ? selected : i, f);
});
document.addEventListener('paste', (e) => {
  const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
  if (f) setPanelPhoto(selected, f);
});

// ---- Per-panel controls ----
$('zoom').addEventListener('input', (e) => { state.panels[selected].zoom = +e.target.value; render(); });
$('panX').addEventListener('input', (e) => { state.panels[selected].ox = +e.target.value; render(); });
$('panY').addEventListener('input', (e) => { state.panels[selected].oy = +e.target.value; render(); });
$('fitBtn').addEventListener('click', () => {
  const p = state.panels[selected];
  p.fit = p.fit === 'fill' ? 'fit' : 'fill';
  render();
});
$('flipBtn').addEventListener('click', () => { state.panels[selected].flip = !state.panels[selected].flip; render(); });
$('smartBtn').addEventListener('click', () => {
  const p = state.panels[selected];
  if (!p.img) { setStatus('Add a photo to this panel first.'); return; }
  const iw = p.img.naturalWidth || p.img.width;
  const ih = p.img.naturalHeight || p.img.height;
  // Portrait photos: zoom in and bias toward the top third, where faces are.
  // Positive oy shifts the photo DOWN so the panel window shows its top.
  if (ih > iw) { p.zoom = 1.45; p.oy = 0.28; p.ox = 0; }
  else { p.zoom = 1.25; p.oy = 0.12; p.ox = 0; }
  p.fit = 'fill';
  render();
  setStatus('Smart crop applied — faces sit in the top third.');
});
$('clearBtn').addEventListener('click', () => {
  const p = state.panels[selected];
  p.img = null; p.zoom = 1; p.ox = 0; p.oy = 0;
  render();
});
$('castInput').addEventListener('input', (e) => {
  state.panels[selected].label = e.target.value.toUpperCase().slice(0, 18);
  render();
});
$('fillAllBtn').addEventListener('click', () => {
  const src = state.panels[selected];
  if (!src.img) { setStatus('Add a photo to the selected panel first.'); return; }
  state.panels.forEach((p, i) => {
    if (i === selected) return;
    p.img = src.img; p.zoom = src.zoom; p.ox = src.ox; p.oy = src.oy; p.fit = src.fit;
  });
  render();
  setStatus('One photo across all six panels.');
});
$('shuffleBtn').addEventListener('click', () => {
  const imgs = state.panels.map((p) => p.img);
  const first = imgs.shift();
  imgs.push(first);
  state.panels.forEach((p, i) => { p.img = imgs[i]; });
  render();
  setStatus('Panels shuffled.');
});

// ---- Text controls ----
const bindText = (id, key) => {
  $(id).addEventListener('input', (e) => { state[key] = e.target.value; render(); });
};
bindText('titleInput', 'title');
bindText('subtitleInput', 'subtitle');
bindText('taglineInput', 'tagline');
bindText('quoteInput', 'quote');
bindText('quoteSrcInput', 'quoteSource');
bindText('volInput', 'volume');
bindText('billingInput', 'billing');

// ---- Style controls ----
const gradesEl = $('grades');
Object.entries(GRADES).forEach(([key, g]) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'grade' + (key === state.grade ? ' active' : '');
  b.textContent = g.name;
  b.addEventListener('click', () => {
    state.grade = key;
    document.querySelectorAll('.grade').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    render();
  });
  gradesEl.appendChild(b);
});
$('gradeInt').addEventListener('input', (e) => {
  state.gradeIntensity = +e.target.value;
  $('gradeIntVal').textContent = `${Math.round(state.gradeIntensity * 100)}%`;
  render();
});
$('slantBtn').addEventListener('click', () => {
  state.slant = !state.slant;
  $('slantBtn').textContent = state.slant ? 'Slanted panels ✓' : 'Slanted panels';
  render();
});
$('borderSel').addEventListener('change', (e) => { state.border = e.target.value; render(); });
$('sizeSel').addEventListener('change', (e) => { exportSize = e.target.value; render(); });

// ---- Demo + export ----
$('demoBtn').addEventListener('click', loadDemo);
$('exportBtn').addEventListener('click', () => {
  const size = SIZES[exportSize];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off, state);
  off.toBlob((blob) => {
    if (!blob) { setStatus('Export failed — try again.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const slug = (state.title || 'cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
    a.download = `${slug}-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(`Saved ${slug}-${size.w}x${size.h}.png — share it anywhere.`);
  }, 'image/png');
});

// ---- Keyboard: arrows nudge the selected photo ----
document.addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
  const p = state.panels[selected];
  const step = 0.04;
  if (e.key === 'ArrowLeft') { p.ox -= step; render(); e.preventDefault(); }
  if (e.key === 'ArrowRight') { p.ox += step; render(); e.preventDefault(); }
  if (e.key === 'ArrowUp') { p.oy -= step; render(); e.preventDefault(); }
  if (e.key === 'ArrowDown') { p.oy += step; render(); e.preventDefault(); }
});

// ---- Screenshot scenes (?shot=…) ----
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), () => {
    loadDemo();
    const q = new URLSearchParams(location.search);
    if (q.get('grade')) state.grade = q.get('grade');
    if (q.get('title')) { state.title = q.get('title'); $('titleInput').value = state.title; }
    if (q.get('subtitle')) { state.subtitle = q.get('subtitle'); $('subtitleInput').value = state.subtitle; }
    if (q.get('size')) { exportSize = q.get('size'); $('sizeSel').value = exportSize; }
    render();
  });
} else {
  loadDemo();
  render();
}

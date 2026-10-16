/* Kakhielotheek: stockfoto + tekstballonnen, alles op één canvas.
 * Wat je ziet is precies wat je downloadt: scherm en export gebruiken dezelfde tekenfunctie. */
'use strict';

(() => {
  const FONT_STACK = '"Arial Black", "Archivo Black", "Arial Bold", Arial, sans-serif';
  const MAX_SIDE = 1600;
  const ASPECTS = { orig: null, square: 1, portrait: 4 / 5, landscape: 16 / 9 };
  const PICSUM_SIZES = { orig: [1200, 900], square: [1080, 1080], portrait: [1080, 1350], landscape: [1280, 720] };
  const STARTERS = [
    'Typ hier je grap',
    'Ik zeg niks',
    'Hier had ik dus geen zin in',
    'Even voor de duidelijkheid',
    'Dit was niet afgesproken',
    'Heerlijk hoor',
  ];

  const $ = (s) => document.querySelector(s);
  const canvas = $('#stage');
  const ctx = canvas.getContext('2d');
  const ui = {
    wrap: $('#stageWrap'), empty: $('#empty'), loading: $('#loading'), credit: $('#credit'),
    file: $('#file'), shuffle: $('#shuffle'), query: $('#query'), format: $('#format'),
    addWhite: $('#addWhite'), addBlack: $('#addBlack'),
    editor: $('#editor'), hint: $('#hint'), text: $('#text'),
    tail: $('#tail'), outline: $('#outline'), auto: $('#auto'), size: $('#size'),
    dup: $('#dup'), front: $('#front'), del: $('#del'),
    download: $('#download'), share: $('#share'), undo: $('#undo'), clear: $('#clear'),
    toast: $('#toast'),
  };

  const state = {
    source: null,      // originele afbeelding
    base: null,        // bijgesneden versie op canvasformaat
    hasImage: false,
    bubbles: [],
    selectedId: null,
  };
  let nextId = 1;
  let drag = null;
  let lastTap = { id: null, t: 0 };
  const history = [];
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  /* ---------------- kleine hulpjes ---------------- */
  const font = (px) => `${Math.max(1, px).toFixed(1)}px ${FONT_STACK}`;
  const unit = () => Math.min(canvas.width, canvas.height);
  const cssScale = () => {
    const r = canvas.getBoundingClientRect();
    return r.width ? canvas.width / r.width : 1;
  };
  const selected = () => state.bubbles.find((b) => b.id === state.selectedId) || null;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  let toastTimer = 0;
  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2600);
  }

  function setLoading(on) {
    ui.loading.hidden = !on;
    ui.shuffle.disabled = on;
    ui.shuffle.textContent = on ? 'Laden…' : 'Shuffle stockfoto';
  }

  /* ---------------- geschiedenis ---------------- */
  function snapshot() {
    return JSON.stringify({ bubbles: state.bubbles, selectedId: state.selectedId });
  }
  function pushHistory() {
    const s = snapshot();
    if (history[history.length - 1] === s) return;
    history.push(s);
    if (history.length > 60) history.shift();
  }
  function undo() {
    if (history.length < 2) { toast('Niks meer om terug te draaien'); return; }
    history.pop();
    const prev = JSON.parse(history[history.length - 1]);
    state.bubbles = prev.bubbles;
    state.selectedId = prev.selectedId;
    syncPanel();
    render();
  }

  /* ---------------- foto's ---------------- */
  function blobToImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Kan deze afbeelding niet lezen')); };
      img.src = url;
    });
  }

  async function fetchBlob(url, ms = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal, mode: 'cors', referrerPolicy: 'no-referrer' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Geen afbeelding');
      return { blob, finalUrl: res.url };
    } finally {
      clearTimeout(timer);
    }
  }

  function setCredit(credit) {
    ui.credit.textContent = '';
    if (!credit) return;
    ui.credit.append('Foto: ');
    if (credit.href) {
      const a = document.createElement('a');
      a.href = credit.href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = credit.label;
      ui.credit.append(a);
    } else {
      ui.credit.append(credit.label);
    }
    if (credit.extra) ui.credit.append(` · ${credit.extra}`);
  }

  function setSource(img, credit) {
    state.source = img;
    setCredit(credit);
    rebuildBase();
  }

  function rebuildBase() {
    const img = state.source;
    if (!img) return;
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    let cw = sw, ch = sh, sx = 0, sy = 0;
    const r = ASPECTS[ui.format.value];
    if (r) {
      if (sw / sh > r) { cw = sh * r; sx = (sw - cw) / 2; } else { ch = sw / r; sy = (sh - ch) / 2; }
    }
    const k = Math.min(1, MAX_SIDE / Math.max(cw, ch));
    const W = Math.max(1, Math.round(cw * k));
    const H = Math.max(1, Math.round(ch * k));

    const base = document.createElement('canvas');
    base.width = W;
    base.height = H;
    const bctx = base.getContext('2d');
    bctx.imageSmoothingQuality = 'high';
    bctx.drawImage(img, sx, sy, cw, ch, 0, 0, W, H);

    const hadImage = state.hasImage;
    const oldW = canvas.width, oldH = canvas.height;
    state.base = base;
    canvas.width = W;
    canvas.height = H;
    state.hasImage = true;
    ui.empty.hidden = true;

    // Ballonnen houden hun plek als je een andere foto pakt: grap blijft, foto wisselt.
    if (hadImage && (oldW !== W || oldH !== H)) scaleBubbles(W / oldW, H / oldH);
    if (!hadImage && state.bubbles.length === 0) addBubble('white', { focus: false, text: 'Tik op mij en typ je grap' });

    ui.size.max = String(Math.round(Math.max(W, H) / 5));
    syncPanel();
    render();
  }

  function scaleBubbles(fx, fy) {
    const s = Math.sqrt(fx * fy);
    for (const b of state.bubbles) {
      b.x *= fx; b.y *= fy; b.w *= s; b.h *= s;
      if (b.tail) { b.tail.dx *= s; b.tail.dy *= s; }
      if (b.size) b.size *= s;
    }
    pushHistory();
  }

  async function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) { toast('Dat is geen foto'); return; }
    try {
      const img = await blobToImage(file);
      setSource(img, null);
    } catch (e) {
      toast(e.message);
    }
  }

  async function shufflePhoto() {
    const q = ui.query.value.trim();
    setLoading(true);
    try {
      if (q) await loadOpenverse(q);
      else await loadPicsum();
    } catch (e) {
      console.warn(e);
      if (q) {
        toast(`Niks bruikbaars gevonden voor "${q}", dan maar een verrassing`);
        try { await loadPicsum(); } catch (e2) { toast('Stockfoto laden lukt nu niet. Upload er zelf een?'); }
      } else {
        toast('Stockfoto laden lukt nu niet. Upload er zelf een?');
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadPicsum() {
    const [w, h] = PICSUM_SIZES[ui.format.value] || PICSUM_SIZES.square;
    const { blob, finalUrl } = await fetchBlob(`https://picsum.photos/${w}/${h}?random=${Date.now()}`);
    const img = await blobToImage(blob);
    const id = (finalUrl.match(/\/id\/(\d+)\//) || [])[1];
    setSource(img, { label: 'Lorem Picsum', href: 'https://picsum.photos' });
    if (id) {
      fetch(`https://picsum.photos/id/${id}/info`)
        .then((r) => r.json())
        .then((info) => {
          if (state.source === img) setCredit({ label: `${info.author} via Unsplash`, href: info.url, extra: 'Unsplash-licentie' });
        })
        .catch(() => {});
    }
  }

  const ovCache = new Map();
  async function loadOpenverse(q) {
    let results = ovCache.get(q);
    if (!results) {
      const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=50&mature=false&category=photograph`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Openverse ${res.status}`);
      const data = await res.json();
      results = (data.results || []).filter((r) => !r.width || r.width >= 500);
      ovCache.set(q, results);
    }
    if (!results.length) throw new Error('Geen resultaten');

    const pool = results.slice().sort(() => Math.random() - 0.5).slice(0, 5);
    for (const r of pool) {
      for (const src of [r.url, r.thumbnail].filter(Boolean)) {
        try {
          const { blob } = await fetchBlob(src, 9000);
          const img = await blobToImage(blob);
          const lic = r.license ? `${r.license.toUpperCase()} ${r.license_version || ''}`.trim() : '';
          setSource(img, {
            label: `${r.title || 'Zonder titel'}${r.creator ? ` door ${r.creator}` : ''}`,
            href: r.foreign_landing_url || null,
            extra: lic ? `licentie ${lic}` : null,
          });
          return;
        } catch (e) { /* volgende proberen */ }
      }
    }
    throw new Error('Geen enkele foto kon laden');
  }

  /* ---------------- ballonnen ---------------- */
  function addBubble(theme, opts = {}) {
    if (!state.hasImage) { toast('Kies eerst een foto'); return; }
    const W = canvas.width, H = canvas.height, u = unit();
    const n = state.bubbles.length;
    const w = u * 0.5, h = u * 0.26;
    const b = {
      id: nextId++,
      x: Math.min(W - w / 2, Math.max(w / 2, W * 0.5 + ((n % 3) - 1) * u * 0.08)),
      y: Math.min(H - h, Math.max(h / 2 + u * 0.03, H * 0.2 + (n % 4) * u * 0.07)),
      w, h,
      tail: { dx: u * 0.07, dy: u * 0.24 },
      text: opts.text || pick(STARTERS),
      theme,
      shape: 'oval',
      size: null,
      outline: theme === 'white',
    };
    state.bubbles.push(b);
    state.selectedId = b.id;
    pushHistory();
    syncPanel();
    render();
    if (opts.focus !== false && finePointer) { ui.text.focus(); ui.text.select(); }
  }

  function updateSelected(fn, commit = true) {
    const b = selected();
    if (!b) return;
    fn(b);
    if (commit) pushHistory();
    syncPanel();
    render();
  }

  function innerBox(b) {
    return b.shape === 'rect' ? { w: b.w * 0.86, h: b.h * 0.76 } : { w: b.w * 0.78, h: b.h * 0.62 };
  }

  function wrapLines(c, text, maxW) {
    const out = [];
    for (const para of String(text).split('\n')) {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) { out.push(''); continue; }
      let line = words[0];
      for (let i = 1; i < words.length; i++) {
        const test = `${line} ${words[i]}`;
        if (c.measureText(test).width <= maxW) line = test;
        else { out.push(line); line = words[i]; }
      }
      out.push(line);
    }
    return out;
  }

  const LINE_H = 1.13;
  function fits(c, b, box, px) {
    c.font = font(px);
    const lines = wrapLines(c, b.text, box.w);
    if (lines.length * px * LINE_H > box.h) return false;
    return lines.every((l) => c.measureText(l).width <= box.w);
  }

  function autoSize(c, b, box) {
    let lo = 4;
    let hi = Math.max(8, Math.min(box.h, Math.max(canvas.width, canvas.height) / 11));
    if (fits(c, b, box, hi)) return hi;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (fits(c, b, box, mid)) lo = mid; else hi = mid;
    }
    return lo;
  }

  function textLayout(c, b) {
    const box = innerBox(b);
    const px = b.size || autoSize(c, b, box);
    c.font = font(px);
    // bij handmatige grootte mag tekst breder dan het kader, dan wrapt hij op de ballonbreedte
    const lines = wrapLines(c, b.text, b.size ? Math.max(box.w, px * 2) : box.w);
    return { px, lines };
  }

  function bodyPath(c, b) {
    c.beginPath();
    const x = b.x - b.w / 2, y = b.y - b.h / 2;
    if (b.shape === 'rect') {
      const r = Math.min(b.w, b.h) * 0.24;
      c.moveTo(x + r, y);
      c.arcTo(x + b.w, y, x + b.w, y + b.h, r);
      c.arcTo(x + b.w, y + b.h, x, y + b.h, r);
      c.arcTo(x, y + b.h, x, y, r);
      c.arcTo(x, y, x + b.w, y, r);
      c.closePath();
    } else {
      c.ellipse(b.x, b.y, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
    }
  }

  function tailPoints(b) {
    if (!b.tail) return null;
    const { dx, dy } = b.tail;
    const len = Math.hypot(dx, dy);
    if (len < 2) return null;
    const nx = -dy / len, ny = dx / len;
    const hw = Math.min(b.w, b.h) * 0.16;
    return [
      [b.x + nx * hw, b.y + ny * hw],
      [b.x + dx, b.y + dy],
      [b.x - nx * hw, b.y - ny * hw],
    ];
  }

  function tailPath(c, pts) {
    // licht gebogen, zoals een getekend staartje
    const [a, tip, z] = pts;
    const bend = 0.12;
    const mx1 = (a[0] + tip[0]) / 2 + (tip[1] - a[1]) * bend;
    const my1 = (a[1] + tip[1]) / 2 - (tip[0] - a[0]) * bend;
    const mx2 = (z[0] + tip[0]) / 2 + (tip[1] - z[1]) * bend;
    const my2 = (z[1] + tip[1]) / 2 - (tip[0] - z[0]) * bend;
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.quadraticCurveTo(mx1, my1, tip[0], tip[1]);
    c.quadraticCurveTo(mx2, my2, z[0], z[1]);
    c.closePath();
  }

  function drawBubble(c, b) {
    const fill = b.theme === 'black' ? '#111111' : '#ffffff';
    const ink = b.theme === 'black' ? '#ffffff' : '#111111';
    const lw = Math.max(2, unit() / 330);
    const tail = tailPoints(b);

    c.save();
    // Eerst de rand van ballon + staartje dubbel dik, daarna de vulling eroverheen:
    // zo krijg je één doorlopende omtrek om de vereniging van beide vormen.
    if (b.outline) {
      c.strokeStyle = ink;
      c.lineWidth = lw * 2;
      c.lineJoin = 'round';
      bodyPath(c, b); c.stroke();
      if (tail) { c.lineJoin = 'miter'; c.miterLimit = 5; tailPath(c, tail); c.stroke(); }
    }
    c.fillStyle = fill;
    bodyPath(c, b); c.fill();
    if (tail) { tailPath(c, tail); c.fill(); }

    const { px, lines } = textLayout(c, b);
    const lh = px * LINE_H;
    c.fillStyle = ink;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = font(px);
    const y0 = b.y - ((lines.length - 1) * lh) / 2 + px * 0.04;
    lines.forEach((l, i) => c.fillText(l, b.x, y0 + i * lh));
    c.restore();
    return px;
  }

  function handleRadius() { return 11 * cssScale(); }

  function drawSelection(c, b) {
    const s = cssScale();
    const r = handleRadius();
    c.save();
    c.strokeStyle = '#ec008c';
    c.lineWidth = 2 * s;
    c.setLineDash([7 * s, 5 * s]);
    c.strokeRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    c.setLineDash([]);
    for (const [cx, cy] of corners(b)) {
      c.beginPath(); c.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
      c.fillStyle = '#ffffff'; c.fill();
      c.lineWidth = 3 * s; c.strokeStyle = '#ec008c'; c.stroke();
    }
    if (b.tail) {
      c.beginPath(); c.arc(b.x + b.tail.dx, b.y + b.tail.dy, r * 0.85, 0, Math.PI * 2);
      c.fillStyle = '#ec008c'; c.fill();
      c.lineWidth = 2.5 * s; c.strokeStyle = '#ffffff'; c.stroke();
    }
    c.restore();
  }

  function corners(b) {
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [b.x + sx * b.w / 2, b.y + sy * b.h / 2, sx, sy]);
  }

  function drawScene(c, withUi) {
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    if (state.base) c.drawImage(state.base, 0, 0);
    for (const b of state.bubbles) drawBubble(c, b);
    if (withUi) {
      const sel = selected();
      if (sel) drawSelection(c, sel);
    }
  }

  let raf = 0;
  function render() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!state.hasImage) return;
      drawScene(ctx, true);
      const sel = selected();
      if (sel && ui.auto.checked) {
        // toon de automatische grootte op de schuifregelaar
        const { px } = textLayout(ctx, sel);
        ui.size.value = String(Math.round(px));
      }
    });
  }

  /* ---------------- aanraken & slepen ---------------- */
  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  }

  function inTriangle(p, [a, b, c]) {
    const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    const l1 = ((b[1] - c[1]) * (p.x - c[0]) + (c[0] - b[0]) * (p.y - c[1])) / d;
    const l2 = ((c[1] - a[1]) * (p.x - c[0]) + (a[0] - c[0]) * (p.y - c[1])) / d;
    return l1 >= 0 && l2 >= 0 && l1 + l2 <= 1;
  }

  function hitBubble(b, p) {
    if (b.shape === 'rect') {
      if (Math.abs(p.x - b.x) <= b.w / 2 && Math.abs(p.y - b.y) <= b.h / 2) return true;
    } else {
      const nx = (p.x - b.x) / (b.w / 2), ny = (p.y - b.y) / (b.h / 2);
      if (nx * nx + ny * ny <= 1) return true;
    }
    const t = tailPoints(b);
    return !!t && inTriangle(p, t);
  }

  function handleAt(b, p) {
    const r = handleRadius() * 1.6; // ruim, voor vingers
    if (b.tail && Math.hypot(p.x - (b.x + b.tail.dx), p.y - (b.y + b.tail.dy)) <= r) return { type: 'tail' };
    for (const [cx, cy, sx, sy] of corners(b)) {
      if (Math.hypot(p.x - cx, p.y - cy) <= r) return { type: 'resize', sx, sy };
    }
    return null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!state.hasImage) return;
    const p = toCanvas(e);
    const sel = selected();
    drag = null;

    if (sel) {
      const h = handleAt(sel, p);
      if (h) drag = { mode: h.type, sx: h.sx, sy: h.sy, b: sel, orig: JSON.parse(JSON.stringify(sel)) };
    }
    if (!drag) {
      let hit = null;
      for (let i = state.bubbles.length - 1; i >= 0; i--) {
        if (hitBubble(state.bubbles[i], p)) { hit = state.bubbles[i]; break; }
      }
      if (hit) {
        const now = performance.now();
        const isDouble = lastTap.id === hit.id && now - lastTap.t < 380;
        lastTap = { id: hit.id, t: now };
        state.selectedId = hit.id;
        drag = { mode: 'move', b: hit, off: { x: p.x - hit.x, y: p.y - hit.y } };
        syncPanel();
        if (isDouble) {
          drag = null;
          ui.text.focus();
          ui.text.select();
          ui.editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } else {
        state.selectedId = null;
        syncPanel();
      }
    }
    if (drag) {
      drag.moved = false;
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
    render();
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = toCanvas(e);
    if (!drag) {
      if (finePointer && state.hasImage) {
        const sel = selected();
        const h = sel && handleAt(sel, p);
        let cur = 'default';
        if (h) cur = h.type === 'tail' ? 'crosshair' : (h.sx === h.sy ? 'nwse-resize' : 'nesw-resize');
        else if (state.bubbles.some((b) => hitBubble(b, p))) cur = 'move';
        canvas.style.cursor = cur;
      }
      return;
    }
    const b = drag.b;
    const o = drag.orig;
    const minSize = unit() * 0.08;
    drag.moved = true;
    if (drag.mode === 'move') {
      b.x = p.x - drag.off.x;
      b.y = p.y - drag.off.y;
    } else if (drag.mode === 'tail') {
      b.tail.dx = p.x - b.x;
      b.tail.dy = p.y - b.y;
    } else if (drag.mode === 'resize') {
      const fx = o.x - drag.sx * o.w / 2;
      const fy = o.y - drag.sy * o.h / 2;
      let w = Math.max(minSize, (p.x - fx) * drag.sx);
      let h = Math.max(minSize, (p.y - fy) * drag.sy);
      if (e.shiftKey) { const k = Math.max(w / o.w, h / o.h); w = o.w * k; h = o.h * k; }
      b.w = w; b.h = h;
      b.x = fx + drag.sx * w / 2;
      b.y = fy + drag.sy * h / 2;
      if (o.tail) { // punt van het staartje blijft staan
        b.tail.dx = o.x + o.tail.dx - b.x;
        b.tail.dy = o.y + o.tail.dy - b.y;
      }
    }
    render();
  });

  function endDrag(e) {
    if (!drag) return;
    if (drag.moved) pushHistory();
    drag = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* al los */ }
    syncPanel();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  /* ---------------- paneel ---------------- */
  function syncPanel() {
    const b = selected();
    ui.editor.hidden = !b;
    ui.hint.hidden = !!b;
    if (!b) return;
    if (document.activeElement !== ui.text) ui.text.value = b.text;
    document.querySelectorAll('[data-theme]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.theme === b.theme)));
    document.querySelectorAll('[data-shape]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.shape === b.shape)));
    ui.tail.checked = !!b.tail;
    ui.outline.checked = !!b.outline;
    ui.auto.checked = !b.size;
    if (b.size) ui.size.value = String(Math.round(b.size));
  }

  let textCommitTimer = 0;
  ui.text.addEventListener('input', () => {
    updateSelected((b) => { b.text = ui.text.value; }, false);
    clearTimeout(textCommitTimer);
    textCommitTimer = setTimeout(pushHistory, 500);
  });

  document.querySelectorAll('[data-theme]').forEach((el) => el.addEventListener('click', () => {
    updateSelected((b) => {
      if (b.theme !== el.dataset.theme) {
        b.theme = el.dataset.theme;
        b.outline = b.theme === 'white';
      }
    });
  }));
  document.querySelectorAll('[data-shape]').forEach((el) => el.addEventListener('click', () => {
    updateSelected((b) => { b.shape = el.dataset.shape; });
  }));
  ui.tail.addEventListener('change', () => updateSelected((b) => {
    b.tail = ui.tail.checked ? { dx: unit() * 0.07, dy: b.h / 2 + unit() * 0.11 } : null;
  }));
  ui.outline.addEventListener('change', () => updateSelected((b) => { b.outline = ui.outline.checked; }));
  ui.auto.addEventListener('change', () => updateSelected((b) => {
    b.size = ui.auto.checked ? null : Number(ui.size.value);
  }));
  ui.size.addEventListener('input', () => updateSelected((b) => { b.size = Number(ui.size.value); }, false));
  ui.size.addEventListener('change', pushHistory);

  ui.dup.addEventListener('click', () => {
    const b = selected();
    if (!b) return;
    const c = JSON.parse(JSON.stringify(b));
    c.id = nextId++;
    c.x += unit() * 0.05; c.y += unit() * 0.05;
    state.bubbles.push(c);
    state.selectedId = c.id;
    pushHistory(); syncPanel(); render();
  });
  ui.front.addEventListener('click', () => {
    const b = selected();
    if (!b) return;
    state.bubbles = state.bubbles.filter((x) => x !== b).concat(b);
    pushHistory(); render();
  });
  function deleteSelected() {
    if (!selected()) return;
    state.bubbles = state.bubbles.filter((x) => x.id !== state.selectedId);
    state.selectedId = null;
    pushHistory(); syncPanel(); render();
  }
  ui.del.addEventListener('click', deleteSelected);
  ui.clear.addEventListener('click', () => {
    if (!state.bubbles.length) return;
    state.bubbles = [];
    state.selectedId = null;
    pushHistory(); syncPanel(); render();
    toast('Weg! Ongedaan maken kan nog');
  });
  ui.undo.addEventListener('click', undo);

  ui.addWhite.addEventListener('click', () => addBubble('white'));
  ui.addBlack.addEventListener('click', () => addBubble('black'));

  /* ---------------- foto-invoer ---------------- */
  ui.file.addEventListener('change', () => { loadFile(ui.file.files[0]); ui.file.value = ''; });
  ui.shuffle.addEventListener('click', shufflePhoto);
  ui.query.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); shufflePhoto(); } });
  ui.format.addEventListener('change', () => { if (state.source) rebuildBase(); });

  ['dragenter', 'dragover'].forEach((t) => ui.wrap.addEventListener(t, (e) => {
    e.preventDefault(); ui.wrap.classList.add('drop');
  }));
  ['dragleave', 'drop'].forEach((t) => ui.wrap.addEventListener(t, () => ui.wrap.classList.remove('drop')));
  ui.wrap.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) loadFile(f);
  });
  window.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items || [])].find((x) => x.type.startsWith('image/'));
    if (item) { e.preventDefault(); loadFile(item.getAsFile()); }
  });

  /* ---------------- toetsenbord ---------------- */
  window.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); undo(); return; }
    if (typing) return;
    const b = selected();
    if (!b) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
    else if (e.key === 'Escape') { state.selectedId = null; syncPanel(); render(); }
    else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = (e.shiftKey ? 20 : 3) * cssScale();
      if (e.key === 'ArrowLeft') b.x -= step;
      if (e.key === 'ArrowRight') b.x += step;
      if (e.key === 'ArrowUp') b.y -= step;
      if (e.key === 'ArrowDown') b.y += step;
      render();
    }
  });
  window.addEventListener('keyup', (e) => { if (e.key.startsWith('Arrow') && selected()) pushHistory(); });

  /* ---------------- exporteren ---------------- */
  function exportBlob() {
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    drawScene(out.getContext('2d'), false);
    return new Promise((resolve, reject) => {
      try {
        out.toBlob((b) => (b ? resolve(b) : reject(new Error('Exporteren mislukt'))), 'image/jpeg', 0.92);
      } catch (e) { reject(e); }
    });
  }
  const fileName = () => `kakhiel-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`;

  ui.download.addEventListener('click', async () => {
    if (!state.hasImage) { toast('Eerst een foto kiezen'); return; }
    try {
      const blob = await exportBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName();
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Opgeslagen. Kakhiel-waardig!');
    } catch (e) {
      toast('Downloaden lukte niet bij deze foto');
    }
  });

  if (navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.jpg', { type: 'image/jpeg' })] })) {
    ui.share.hidden = false;
    ui.share.addEventListener('click', async () => {
      if (!state.hasImage) { toast('Eerst een foto kiezen'); return; }
      try {
        const blob = await exportBlob();
        const file = new File([blob], fileName(), { type: 'image/jpeg' });
        await navigator.share({ files: [file], title: 'Kakhiel' });
      } catch (e) {
        if (e.name !== 'AbortError') toast('Delen lukte niet');
      }
    });
  }

  /* ---------------- start ---------------- */
  window.addEventListener('resize', render);
  if (document.fonts) {
    document.fonts.addEventListener?.('loadingdone', render);
    document.fonts.load(`40px "Archivo Black"`).catch(() => {}).finally(render);
  }
  pushHistory();
  shufflePhoto();
})();

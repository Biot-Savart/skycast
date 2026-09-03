/* Dependency-free canvas charts with DPR scaling, hover tooltips and day/night bands. */

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(rect.width, 10);
  const h = Math.max(rect.height, 10);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function niceCeil(v) { return Math.ceil(v / 5) * 5; }
function niceFloor(v) { return Math.floor(v / 5) * 5; }

export class LineChart {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = Object.assign({ stroke: '#ffd166', fillTop: 'rgba(255,209,102,.28)', showDots: true }, opts);
    this.labels = [];
    this.values = [];
    this.bands = [];      // [{from, to}] in index space → shaded night regions
    this.hover = -1;
    this._onHover = opts.onHover || (() => {});
    canvas.addEventListener('pointermove', (e) => this._move(e));
    canvas.addEventListener('pointerleave', () => this._leave());
    window.addEventListener('resize', () => this.draw());
  }

  setData(labels, values, bands = []) {
    this.labels = labels;
    this.values = values;
    this.bands = bands;
    this.draw();
  }

  setHover(i) {
    if (this.hover !== i) { this.hover = i; this.draw(); }
  }

  _move(e) {
    const rect = this.canvas.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left) / rect.width) * (this.values.length - 1));
    const clamped = Math.max(0, Math.min(this.values.length - 1, i));
    if (clamped !== this.hover) { this.hover = clamped; this.draw(); }
    this._onHover(clamped, e);
  }

  _leave() {
    if (this.hover !== -1) { this.hover = -1; this.draw(); this._onHover(-1, null); }
  }

  pad() {
    const vals = this.values.filter(Number.isFinite);
    if (!vals.length) return { min: 0, max: 10 };
    let min = Math.min(...vals), max = Math.max(...vals);
    if (max - min < 4) { const m = (max + min) / 2; min = m - 2; max = m + 2; }
    const spread = (max - min) * 0.18;
    return { min: niceFloor(min - spread), max: niceCeil(max + spread) };
  }

  draw() {
    const { ctx, w, h } = setupCanvas(this.canvas);
    const n = this.values.length;
    if (!n) return;
    ctx.clearRect(0, 0, w, h);

    const padL = 6, padR = 6, padT = 12, padB = 22;
    const { min, max } = this.pad();
    const x = (i) => padL + (i / (n - 1)) * (w - padL - padR);
    const y = (v) => padT + (1 - (v - min) / (max - min)) * (h - padT - padB);

    // day/night bands
    ctx.fillStyle = 'rgba(30, 40, 70, 0.22)';
    for (const b of this.bands) {
      const x0 = b.from <= 0 ? padL : x(b.from);
      const x1 = b.to >= n - 1 ? w - padR : x(b.to);
      ctx.fillRect(x0, padT, x1 - x0, h - padT - padB);
    }

    // horizontal gridlines
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(230,240,250,.55)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    const steps = 4;
    for (let s = 0; s <= steps; s++) {
      const v = min + ((max - min) * s) / steps;
      const gy = y(v);
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(w - padR, gy);
      ctx.stroke();
      ctx.fillText(`${Math.round(v)}°`, padL + 2, gy - 4);
    }

    // x labels (every 3rd)
    ctx.textAlign = 'center';
    for (let i = 0; i < n; i += 3) {
      ctx.fillText(this.labels[i] || '', x(i), h - 6);
    }

    // area fill
    const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
    grad.addColorStop(0, this.opts.fillTop);
    grad.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.beginPath();
    ctx.moveTo(x(0), y(this.values[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(x(i), y(this.values[i]));
    ctx.lineTo(x(n - 1), h - padB);
    ctx.lineTo(x(0), h - padB);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    ctx.beginPath();
    ctx.moveTo(x(0), y(this.values[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(x(i), y(this.values[i]));
    ctx.strokeStyle = this.opts.stroke;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // dots + hover
    if (this.opts.showDots && n <= 48) {
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.arc(x(i), y(this.values[i]), i === this.hover ? 5 : 2.2, 0, Math.PI * 2);
        ctx.fillStyle = i === this.hover ? '#fff' : this.opts.stroke;
        ctx.fill();
      }
    }

    if (this.hover >= 0) {
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x(this.hover), padT);
      ctx.lineTo(x(this.hover), h - padB);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    this._geom = { x, y, padL, padR, padT, padB, w, h };
  }

  /** Pixel position of a point (used to place the tooltip). */
  pointPos(i) {
    if (!this._geom || !this.values.length) return null;
    const { x, y } = this._geom;
    return { px: x(i), py: y(this.values[i]), w: this._geom.w };
  }
}

export class BarChart {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = Object.assign({ color: '#9fd0ff', hoverColor: '#ffffff', unit: '', gap: 2 }, opts);
    this.values = [];
    this.labels = [];
    this.hover = -1;
    this._onHover = opts.onHover || (() => {});
    canvas.addEventListener('pointermove', (e) => this._move(e));
    canvas.addEventListener('pointerleave', () => this._leave());
    window.addEventListener('resize', () => this.draw());
  }

  setData(labels, values) {
    this.labels = labels;
    this.values = values;
    this.draw();
  }

  setHover(i) { if (this.hover !== i) { this.hover = i; this.draw(); } }

  _idx(e) {
    const rect = this.canvas.getBoundingClientRect();
    const t = (e.clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(this.values.length - 1, Math.floor(t * this.values.length)));
  }

  _move(e) {
    const i = this._idx(e);
    if (i !== this.hover) { this.hover = i; this.draw(); }
    this._onHover(i, e);
  }

  _leave() { if (this.hover !== -1) { this.hover = -1; this.draw(); this._onHover(-1, null); } }

  draw() {
    const { ctx, w, h } = setupCanvas(this.canvas);
    const n = this.values.length;
    if (!n) return;
    ctx.clearRect(0, 0, w, h);
    const padB = 18, padT = 4;
    const max = Math.max(0.5, ...this.values);
    const bw = (w - (n - 1) * this.opts.gap) / n;

    // baseline
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath();
    ctx.moveTo(0, h - padB);
    ctx.lineTo(w, h - padB);
    ctx.stroke();

    for (let i = 0; i < n; i++) {
      const v = this.values[i];
      const bh = v > 0 ? Math.max(2, (v / max) * (h - padB - padT - 2)) : 0;
      const x = i * (bw + this.opts.gap);
      if (bh > 0) {
        const g = ctx.createLinearGradient(0, h - padB - bh, 0, h - padB);
        g.addColorStop(0, i === this.hover ? this.opts.hoverColor : this.opts.color);
        g.addColorStop(1, 'rgba(120,170,220,.25)');
        ctx.fillStyle = g;
        ctx.beginPath();
        const r = Math.min(3, bw / 2);
        ctx.roundRect(x, h - padB - bh, bw, bh, [r, r, 0, 0]);
        ctx.fill();
      } else if (i === this.hover) {
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.fillRect(x + bw / 2 - 1, h - padB - 3, 2, 3);
      }
    }

    // time ticks every 12 slots (3h)
    ctx.fillStyle = 'rgba(230,240,250,.55)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < n; i += 12) {
      ctx.fillText(this.labels[i] || '', i * (bw + this.opts.gap) + bw / 2, h - 5);
    }
  }
}

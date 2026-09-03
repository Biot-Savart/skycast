/* Animated weather backgrounds on a full-screen canvas.
   Modes: stars / clouds / rain / snow / lightning / fog / sun-glow. */

const PALETTE = {
  day:    { cloud: 'rgba(255,255,255,.55)', star: null },
  night:  { cloud: 'rgba(180,195,220,.28)', star: '#dfe9ff' },
};

class Background {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = 'clear-day';
    this.particles = [];
    this.clouds = [];
    this.stars = [];
    this.fogBands = [];
    this.lastFlash = 0;
    this.flashAlpha = 0;
    this.running = false;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const onResize = () => this.resize();
    window.addEventListener('resize', onResize);
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.spawn();
  }

  /** theme string from wx.themeFor(), e.g. "rain-night" */
  setTheme(theme) {
    if (this.mode === theme) return;
    this.mode = theme;
    this.spawn();
    if (!this.running) { this.running = true; requestAnimationFrame(this.frame.bind(this)); }
    else if (this.reduced) { this.frameOnce(); }
  }

  isNight() { return this.mode.endsWith('night'); }

  spawn() {
    this.particles = [];
    this.clouds = [];
    this.stars = [];
    this.fogBands = [];
    const m = this.mode;
    const area = (this.w * this.h) / 1e6;

    if (m.startsWith('clear') || m.startsWith('partly')) {
      if (this.isNight()) {
        const count = Math.round(140 * area) + 40;
        for (let i = 0; i < count; i++) {
          this.stars.push({
            x: Math.random() * this.w, y: Math.random() * this.h * 0.75,
            r: Math.random() * 1.4 + 0.3, tw: Math.random() * Math.PI * 2, sp: 0.5 + Math.random() * 2,
          });
        }
      }
      if (m.startsWith('partly')) this.spawnClouds(Math.round(5 * area) + 3, 0.35);
    } else if (m.startsWith('cloud')) {
      this.spawnClouds(Math.round(9 * area) + 5, 0.6);
    } else if (m.startsWith('rain') || m.startsWith('thunder')) {
      this.spawnClouds(Math.round(7 * area) + 4, 0.5);
      const count = Math.round(160 * area) + 60;
      for (let i = 0; i < count; i++) {
        this.particles.push({ type: 'rain', x: Math.random() * this.w, y: Math.random() * this.h,
          len: 9 + Math.random() * 14, sp: 420 + Math.random() * 320 });
      }
    } else if (m.startsWith('snow')) {
      this.spawnClouds(Math.round(5 * area) + 3, 0.45);
      const count = Math.round(90 * area) + 40;
      for (let i = 0; i < count; i++) {
        this.particles.push({ type: 'snow', x: Math.random() * this.w, y: Math.random() * this.h,
          r: 1 + Math.random() * 2.4, sp: 22 + Math.random() * 45, ph: Math.random() * Math.PI * 2 });
      }
    } else if (m.startsWith('fog')) {
      for (let i = 0; i < 5; i++) {
        this.fogBands.push({ y: this.h * (0.25 + i * 0.16), sp: 6 + i * 5, amp: 20 + Math.random() * 30, ph: Math.random() * 9 });
      }
    }
    if (this.reduced) this.frameOnce();
  }

  spawnClouds(count, alpha) {
    for (let i = 0; i < count; i++) {
      const puffs = [];
      const np = 3 + Math.floor(Math.random() * 4);
      for (let p = 0; p < np; p++) {
        puffs.push({ dx: (Math.random() - 0.5) * 130, dy: (Math.random() - 0.5) * 34, r: 30 + Math.random() * 55 });
      }
      this.clouds.push({
        x: Math.random() * (this.w + 400) - 200, y: Math.random() * this.h * 0.55,
        sp: 5 + Math.random() * 14, alpha: alpha * (0.5 + Math.random() * 0.5), puffs,
      });
    }
  }

  frameOnce() { this.frame(0, true); }

  frame(t, once = false) {
    const ctx = this.ctx, w = this.w, h = this.h;
    ctx.clearRect(0, 0, w, h);
    const night = this.isNight();
    const pal = night ? PALETTE.night : PALETTE.day;

    // sun / moon glow
    if (!night) {
      if (this.mode.startsWith('clear') || this.mode.startsWith('partly')) {
        const g = ctx.createRadialGradient(w * 0.82, h * 0.16, 0, w * 0.82, h * 0.16, h * 0.5);
        g.addColorStop(0, 'rgba(255,225,150,.35)');
        g.addColorStop(1, 'rgba(255,225,150,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      const g = ctx.createRadialGradient(w * 0.8, h * 0.14, 0, w * 0.8, h * 0.14, h * 0.42);
      g.addColorStop(0, 'rgba(230,238,255,.22)');
      g.addColorStop(1, 'rgba(230,238,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // stars
    if (pal.star) {
      ctx.fillStyle = pal.star;
      for (const s of this.stars) {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(s.tw + t / 1000 * s.sp));
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // fog bands
    for (const f of this.fogBands) {
      const y = f.y + Math.sin(t / 1000 + f.ph) * 8;
      const g = ctx.createLinearGradient(0, y - 40, 0, y + 60);
      g.addColorStop(0, 'rgba(220,224,218,0)');
      g.addColorStop(0.5, 'rgba(222,226,220,.16)');
      g.addColorStop(1, 'rgba(220,224,218,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 40, w, 100);
    }

    // clouds
    ctx.fillStyle = pal.cloud;
    for (const c of this.clouds) {
      ctx.globalAlpha = c.alpha;
      for (const p of c.puffs) {
        ctx.beginPath();
        ctx.arc(c.x + p.dx, c.y + p.dy, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      c.x += c.sp * 0.016;
      if (c.x - 150 > w) { c.x = -150; c.y = Math.random() * this.h * 0.55; }
    }
    ctx.globalAlpha = 1;

    // rain / snow particles
    const dt = 0.016;
    ctx.strokeStyle = night ? 'rgba(170,200,240,.5)' : 'rgba(170,205,240,.55)';
    ctx.lineWidth = 1.2;
    for (const p of this.particles) {
      if (p.type === 'rain') {
        p.y += p.sp * dt;
        p.x += p.sp * dt * 0.18;
        if (p.y > h) { p.y = -20; p.x = Math.random() * w; }
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.len * 0.18, p.y - p.len);
        ctx.stroke();
      } else {
        p.y += p.sp * dt;
        p.x += Math.sin(t / 1000 + p.ph) * 12 * dt;
        if (p.y > h) { p.y = -10; p.x = Math.random() * w; }
        ctx.fillStyle = night ? 'rgba(225,235,250,.8)' : 'rgba(255,255,255,.9)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // lightning flashes
    if (this.mode.startsWith('thunder')) {
      const now = t;
      if (now - this.lastFlash > 4200 + Math.random() * 4000) {
        this.lastFlash = now;
        this.flashAlpha = 0.75;
      }
      if (this.flashAlpha > 0.02) {
        ctx.fillStyle = `rgba(255,255,255,${this.flashAlpha})`;
        ctx.fillRect(0, 0, w, h);
        this.flashAlpha *= 0.82;
      }
    }

    if (!this.reduced && !once) requestAnimationFrame(this.frame.bind(this));
    else if (this.reduced && !once) { /* single frame already drawn */ }
  }
}

export const background = new Background(document.getElementById('bg-canvas'));

/** Original procedural line sculpture, drawn with Canvas 2D. */
export class Sculpture {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;
    this.scene = 'ember';
    this.time = 0;
    this.pointer = { x: 0, y: 0 };
    this.paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.visible = true;
    this.last = 0;
    this.targetColor = this.color = [242, 102, 51];
    this.rings = Array.from({ length: 110 }, (_, i) => {
      const u = i / 110 * Math.PI * 2;
      return Array.from({ length: 91 }, (_, j) => {
        const v = j / 90 * Math.PI * 2;
        const radius = 1.2 + 0.46 * Math.cos(v);
        return [radius * Math.cos(u), 0.46 * Math.sin(v), radius * Math.sin(u), u, v];
      });
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.observer = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.schedule();
      else this.cancel();
    }, { rootMargin: '100px' });
    this.observer.observe(canvas);
    canvas.parentElement.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch' || this.paused) return;
      const bounds = canvas.getBoundingClientRect();
      this.pointer.x = (event.clientX - bounds.left) / bounds.width - 0.5;
      this.pointer.y = (event.clientY - bounds.top) / bounds.height - 0.5;
    });
    canvas.parentElement.addEventListener('pointerleave', () => { this.pointer = { x: 0, y: 0 }; });
    document.addEventListener('visibilitychange', () => document.hidden ? this.cancel() : this.schedule());
    this.resize();
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    this.width = bounds.width;
    this.height = bounds.height;
    this.dpr = Math.min(devicePixelRatio || 1, 1.75);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.draw();
  }

  setScene(scene) {
    this.scene = scene;
    this.targetColor = { ember: [242, 102, 51], tidal: [167, 207, 176], orbit: [183, 157, 229] }[scene];
    if (this.paused) { this.color = this.targetColor.slice(); this.draw(); }
  }

  setPaused(paused) {
    this.paused = paused;
    if (paused) this.cancel();
    else this.schedule();
  }

  cancel() { cancelAnimationFrame(this.frame); this.frame = null; }
  schedule() {
    if (!this.ctx || this.frame || this.paused || !this.visible || document.hidden) return;
    this.frame = requestAnimationFrame((stamp) => {
      this.frame = null;
      if (stamp - this.last > 32) {
        this.time += Math.min((stamp - this.last) / 1000, 0.05);
        this.last = stamp;
        this.color = this.color.map((value, i) => value + (this.targetColor[i] - value) * 0.055);
        this.draw();
      }
      this.schedule();
    });
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx || !this.width || !this.height) return;
    const w = this.width, h = this.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.5, cy = h * 0.435;
    const size = Math.min(w * 0.24, h * 0.26);
    const color = this.color.map(Math.round);
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, size * 2);
    glow.addColorStop(0, 'rgba(' + color.join(',') + ',0.07)');
    glow.addColorStop(1, 'rgba(' + color.join(',') + ',0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    const floor = ctx.createRadialGradient(cx, h * 0.77, 0, cx, h * 0.77, size * 1.2);
    floor.addColorStop(0, 'rgba(0,0,0,0.4)');
    floor.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(cx, h * 0.77);
    ctx.scale(1, 0.15);
    ctx.translate(-cx, -h * 0.77);
    ctx.fillStyle = floor;
    ctx.fillRect(cx - size * 1.4, h * 0.77 - size * 1.4, size * 2.8, size * 2.8);
    ctx.restore();

    const ax = 1.02 + Math.sin(this.time * 0.13) * 0.09 + this.pointer.y * 0.13;
    const ay = Math.sin(this.time * 0.1) * 0.1 + this.pointer.x * 0.18;
    const az = -0.44 + Math.sin(this.time * 0.09) * 0.045;
    const sinX = Math.sin(ax), cosX = Math.cos(ax), sinY = Math.sin(ay), cosY = Math.cos(ay), sinZ = Math.sin(az), cosZ = Math.cos(az);
    const project = (point) => {
      let [x, y, z, u, v] = point;
      const breath = 1 + 0.018 * Math.sin(u * 3 + this.time * 0.3) * Math.cos(v);
      x *= breath;
      z *= breath;
      const y1 = y * cosX - z * sinX;
      const z1 = y * sinX + z * cosX;
      const x1 = x * cosY + z1 * sinY;
      const z2 = -x * sinY + z1 * cosY;
      const x2 = x1 * cosZ - y1 * sinZ;
      const y2 = x1 * sinZ + y1 * cosZ;
      const perspective = 4.8 / (4.8 + z2);
      return [cx + x2 * size * perspective, cy + y2 * size * perspective + Math.sin(this.time * 0.4) * 3, z2];
    };
    const paths = this.rings.map((ring) => {
      const points = ring.map(project);
      return { points, z: points.reduce((sum, p) => sum + p[2], 0) / points.length };
    }).sort((a, b) => b.z - a.z);
    paths.forEach(({ points, z }) => {
      const light = Math.max(0.18, Math.min(1.25, 0.78 - z * 0.35));
      const red = Math.min(255, color[0] * light);
      const green = Math.min(255, color[1] * light);
      const blue = Math.min(255, color[2] * light);
      ctx.beginPath();
      points.forEach((point, i) => i ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1]));
      ctx.closePath();
      ctx.strokeStyle = 'rgba(' + [red, green, blue].map(Math.round).join(',') + ',' + (0.5 + light * 0.28) + ')';
      ctx.lineWidth = 0.75;
      ctx.stroke();
    });
    // Sparse orbital marks give the sculpture a gallery-instrument quality.
    ctx.strokeStyle = 'rgba(207,213,191,0.17)';
    ctx.lineWidth = 0.6;
    [[w * 0.16, h * 0.39], [w * 0.83, h * 0.6]].forEach(([x, y]) => {
      ctx.beginPath();ctx.moveTo(x - 4, y);ctx.lineTo(x + 4, y);ctx.moveTo(x, y - 4);ctx.lineTo(x, y + 4);ctx.stroke();
    });
  }
}

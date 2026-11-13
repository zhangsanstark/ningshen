import { h } from '../ui.js';

export default {
  id: 'mot',
  name: '多目标追踪',
  short: '追踪', tag: '分配注意', colors: ['#12d6c5', '#5cf2e0'], mins: 3,
  dim: '分配注意 · 动态追踪',
  desc: '几颗被标记的小球会和其他小球混在一起运动，你要一直用注意力「盯住」它们。速度会按你的表现自动调整。',
  howto: [
    '开始时有几颗小球会亮起并闪烁，记住它们。',
    '随后所有小球变得一模一样并开始移动，持续约 8 秒，全程用眼睛跟住目标球。',
    '停下后，点出所有目标球。全部答对速度加快，有错则减慢。',
  ],
  options: [
    { key: 'targets', label: '目标数', def: 3, choices: [[2, '2 个'], [3, '3 个'], [4, '4 个'], [5, '5 个']] },
    { key: 'trials', label: '轮数', def: 10, choices: [[6, '6 轮'], [10, '10 轮'], [20, '20 轮']] },
  ],
  variant: o => `${o.targets} 目标`,
  level: { def: 0.8, min: 0.2, max: 6, label: v => `速度 ${Number(v).toFixed(2)}×`, float: true },
  score: { label: '速度阈值', unit: '×', better: 'higher', digits: 2 },

  async run(ctx) {
    const T = ctx.opts.targets, N = T >= 5 ? 10 : 8; // 一共几颗球：盯 5 颗时加到 10 颗，不然剩下的太少、容易蒙对
    let speed = ctx.level ?? 0.8;
    const canvas = h('canvas', { class: 'mot-canvas' });
    const info = h('div', { class: 'pill-info' });
    ctx.stage.append(h('div', { class: 'center-col' }, info, canvas));
    const dpr = window.devicePixelRatio || 1;
    const W = Math.min(ctx.stage.clientWidth - 44, 640);
    const H = Math.round(Math.min(window.innerHeight * 0.6, W * 0.75));
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const g = canvas.getContext('2d');
    g.scale(dpr, dpr);
    const R = Math.max(12, Math.min(W, H) / 22);
    // 所有小球平时是同一种中性色；目标亮起、被选中时用这项训练自己的颜色并带一圈光
    const css = getComputedStyle(canvas);
    const v = (k, d) => css.getPropertyValue(k).trim() || d;
    const C = { ball: v('--text-2', '#b6bccd'), hot: v('--c1', '#12d6c5'), hot2: v('--c2', '#5cf2e0'), good: v('--good', '#3ddc97'), bad: v('--bad', '#ff5c7a') };

    let balls = [], phase = 'idle', selected = new Set(), flashOn = true;
    const draw = () => {
      g.clearRect(0, 0, W, H);
      balls.forEach((b, i) => {
        let fill = C.ball, glow = null, ring = false;
        if (phase === 'cue' && b.target && flashOn) { fill = C.hot; glow = C.hot; }
        if (phase === 'select' && selected.has(i)) { fill = C.hot; glow = C.hot; }
        if (phase === 'reveal') {
          if (b.target && selected.has(i)) { fill = C.good; glow = C.good; }
          else if (selected.has(i)) { fill = C.bad; glow = C.bad; }
          else if (b.target) ring = true; // 漏掉的目标：外面补一圈虚线
        }
        g.save();
        if (glow) { g.shadowColor = glow; g.shadowBlur = R * 1.4; }
        g.beginPath(); g.arc(b.x, b.y, R, 0, Math.PI * 2); g.fillStyle = fill; g.fill();
        g.restore();
        if (ring) { g.beginPath(); g.arc(b.x, b.y, R + 6, 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = C.hot2; g.setLineDash([4, 6]); g.stroke(); g.setLineDash([]); }
      });
    };

    const place = () => {
      balls = [];
      while (balls.length < N) {
        const x = R + Math.random() * (W - 2 * R), y = R + Math.random() * (H - 2 * R);
        if (balls.every(b => (b.x - x) ** 2 + (b.y - y) ** 2 > (R * 2.6) ** 2)) {
          const a = Math.random() * Math.PI * 2;
          balls.push({ x, y, vx: Math.cos(a), vy: Math.sin(a), target: balls.length < T });
        }
      }
    };

    const move = dt => {
      const v = speed * Math.min(W, H) * 0.35; // 像素/秒
      for (const b of balls) {
        b.x += b.vx * v * dt; b.y += b.vy * v * dt;
        if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); }
        if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); }
        if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy); }
        if (b.y > H - R) { b.y = H - R; b.vy = -Math.abs(b.vy); }
      }
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = balls[i], b = balls[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d > 0 && d < 2 * R) {
          const nx = dx / d, ny = dy / d;
          const p = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (p > 0) { a.vx -= p * nx; a.vy -= p * ny; b.vx += p * nx; b.vy += p * ny; }
          const o = (2 * R - d) / 2; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
          for (const q of [a, b]) { const m = Math.hypot(q.vx, q.vy) || 1; q.vx /= m; q.vy /= m; }
        }
      }
    };

    const animate = dur => new Promise(res => {
      let last = performance.now(); const end = last + dur;
      const step = now => {
        move(Math.min(0.05, (now - last) / 1000)); last = now; draw();
        if (now < end) ctx.raf(step); else res();
      };
      ctx.raf(step);
    });

    let selResolve = null;
    canvas.addEventListener('pointerdown', e => {
      if (phase !== 'select') return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left - canvas.clientLeft, y = e.clientY - r.top - canvas.clientTop;
      let bi = -1, bd = Infinity;
      balls.forEach((b, i) => { const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; bi = i; } });
      if (bi < 0 || bd > R * 1.8) return;
      if (selected.has(bi)) selected.delete(bi); else selected.add(bi);
      draw();
      if (selected.size === T && selResolve) { const f = selResolve; selResolve = null; f(); }
    });

    const reversals = [];
    let lastDir = 0, perfect = 0;
    for (let t = 0; t < ctx.opts.trials; t++) {
      ctx.setStatus(`第 ${t + 1} / ${ctx.opts.trials} 轮 · 速度 ${speed.toFixed(2)}×`); ctx.setProgress(t / ctx.opts.trials);
      place(); selected = new Set();
      phase = 'show'; info.textContent = '准备'; draw(); await ctx.wait(700);
      phase = 'cue'; info.textContent = `记住 ${T} 个亮起的目标`;
      for (let k = 0; k < 6; k++) { flashOn = k % 2 === 0; draw(); await ctx.wait(330); }
      flashOn = true; draw(); await ctx.wait(300);
      phase = 'move'; info.textContent = '盯住它们…';
      await animate(8000);
      phase = 'select'; info.textContent = `点出 ${T} 个目标球`; draw();
      await new Promise(res => { selResolve = res; });
      phase = 'reveal';
      const hit = [...selected].filter(i => balls[i].target).length;
      const ok = hit === T;
      ctx.beep(ok);
      info.textContent = ok ? '全部正确，加速' : `找对 ${hit} / ${T}，减速`;
      draw();
      const dir = ok ? 1 : -1;
      if (lastDir && dir !== lastDir) reversals.push(speed);
      lastDir = dir;
      if (ok) perfect++;
      speed = Math.min(6, Math.max(0.2, ok ? speed * 1.12 : speed / 1.12));
      await ctx.wait(1500);
    }
    const last = reversals.slice(-4);
    const thr = last.length >= 2 ? Math.exp(last.reduce((a, v) => a + Math.log(v), 0) / last.length) : speed;
    return {
      score: Math.round(thr * 100) / 100,
      metrics: [['全对轮数', `${perfect} / ${ctx.opts.trials}`], ['反转次数', reversals.length], ['下次起始速度', `${speed.toFixed(2)}×`]],
      level: speed,
      note: '速度阈值 = 你大约有一半机会全部追踪正确的速度（取最后几次反转的几何平均）。轮数越多越准。',
    };
  },
};

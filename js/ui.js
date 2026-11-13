// 通用 UI 与工具函数
import { icon } from './art.js';

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [p, val] of Object.entries(v)) p.startsWith('--') ? el.style.setProperty(p, val) : (el.style[p] = val); }
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

// 图标元素
export const ico = (name, cls = '') => h('span', { class: `ico ${cls}`, html: icon(name) });

// ---------- 数学 ----------
export const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export function sd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
}
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const pct = (x, d = 0) => `${(x * 100).toFixed(d)}%`;
export const ms = x => (x ? `${Math.round(x)} ms` : '—');

export function fmtNum(game, v) {
  if (v == null) return '—';
  const sc = game.score;
  return sc.format ? sc.format(v) : Number(v).toFixed(sc.digits ?? 0);
}
export function fmtScore(game, v) {
  if (v == null) return '—';
  const str = fmtNum(game, v);
  return game.score.unit ? `${str} ${game.score.unit}` : str;
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 数字滚动到目标值
export function countUp(el, to, fmt, dur = 900) {
  if (reducedMotion() || !isFinite(to)) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = now => {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - (1 - p) ** 4;
    el.textContent = fmt(to * e);
    if (p < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = fmt(to);
  };
  el.textContent = fmt(0);
  requestAnimationFrame(step);
  setTimeout(() => { if (el.isConnected) el.textContent = fmt(to); }, dur + 150); // 页面在后台、动画帧不走时，也保证最后显示的是真实成绩
}

// ---------- 声音反馈 ----------
let actx = null;
let soundOn = true;
export function setSound(v) { soundOn = v; }
function tone(freq, dur, vol, type = 'sine', delay = 0) {
  actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  const t = actx.currentTime + delay;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination);
  o.start(t); o.stop(t + dur + 0.05);
}
export function beep(ok = true) {
  if (!soundOn) return;
  try { ok ? tone(880, 0.11, 0.09) : tone(196, 0.24, 0.1, 'triangle'); } catch { /* 无声音也能继续 */ }
}
export function chime() {
  if (!soundOn) return;
  try { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.9, 0.09, 'sine', i * 0.11)); } catch { }
}
export function tick() {
  if (!soundOn) return;
  try { tone(620, 0.07, 0.05); } catch { }
}

// ---------- 背景音：三种噪音，现算现播，不用音频文件 ----------
// white 各个频率一样多，听着清亮；pink 频率越高越少，柔和一些；brown 更偏低频，低沉
// 返回 n 个采样，可以首尾相接循环播放
export function noiseSamples(kind, n) {
  const warm = 4096, fade = Math.min(8192, n >> 2);
  const g = new Float32Array(warm + n + fade);
  const white = () => Math.random() * 2 - 1;
  if (kind === 'pink') { // Paul Kellet 的近似：白噪音过一组一阶滤波再相加
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < g.length; i++) {
      const w = white();
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      g[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
    }
  } else if (kind === 'brown') { // 把白噪音一点点累加起来
    let last = 0;
    for (let i = 0; i < g.length; i++) { last = (last + 0.02 * white()) / 1.02; g[i] = last; }
  } else for (let i = 0; i < g.length; i++) g[i] = white();
  // 开头一小段和结尾之后的那一段交叠起来：循环播放时接缝处是连着的，没有「咔」的一声
  const out = g.slice(warm, warm + n);
  for (let i = 0; i < fade; i++) {
    const a = (i / fade) * Math.PI / 2;
    out[i] = out[i] * Math.sin(a) + g[warm + n + i] * Math.cos(a);
  }
  // 三种噪音调到同样的平均强度
  let sum = 0;
  for (let i = 0; i < n; i++) sum += out[i] * out[i];
  const k = 0.2 / Math.sqrt(sum / n || 1);
  for (let i = 0; i < n; i++) out[i] = clamp(out[i] * k, -1, 1);
  return out;
}
const NOISE_LEVEL = { white: 0.14, pink: 0.3, brown: 0.6 }; // 清亮的最刺耳，放得最轻
let noise = null; // 正在播的那一路：{kind, src, gain}
// 播放（或换成）某一种背景音；传 'off' 停掉。不受「音效」开关影响，它有自己的选项
export function setNoise(kind) {
  try {
    if (!NOISE_LEVEL[kind]) kind = 'off';
    if (noise && noise.kind === kind) return;
    if (noise) { // 先把正在播的淡出
      const { src, gain } = noise; noise = null;
      gain.gain.setTargetAtTime(0, actx.currentTime, 0.1);
      src.stop(actx.currentTime + 0.6);
    }
    if (kind === 'off') return;
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const n = Math.round(actx.sampleRate * 5);
    const buf = actx.createBuffer(2, n, actx.sampleRate);
    for (let ch = 0; ch < 2; ch++) buf.getChannelData(ch).set(noiseSamples(kind, n)); // 左右各算一份，听起来更开阔
    const src = actx.createBufferSource(), gain = actx.createGain();
    src.buffer = buf; src.loop = true;
    gain.gain.setValueAtTime(0, actx.currentTime);
    gain.gain.setTargetAtTime(NOISE_LEVEL[kind], actx.currentTime, 0.35);
    src.connect(gain).connect(actx.destination);
    src.start();
    noise = { kind, src, gain };
  } catch { /* 没有声音也不影响计时 */ }
}

// ---------- 图表：墨线，最新的一点是朱红 ----------
// 迷你走势线
export function sparkline(values, { w = 64, hgt = 18 } = {}) {
  const svg = s('svg', { viewBox: `0 0 ${w} ${hgt}`, class: 'spark', width: w, height: hgt, 'aria-hidden': 'true' });
  if (values.length < 2) return svg;
  let lo = Math.min(...values), hi = Math.max(...values);
  if (lo === hi) { lo -= 1; hi += 1; }
  const x = i => 2 + (i / (values.length - 1)) * (w - 5);
  const y = v => 3 + (1 - (v - lo) / (hi - lo)) * (hgt - 6);
  svg.append(s('polyline', { points: values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '), class: 'spark-line' }));
  svg.append(s('circle', { cx: x(values.length - 1), cy: y(values.at(-1)), r: 2.2, class: 'spark-dot' }));
  return svg;
}

// 折线图：values 为数字数组（按时间顺序）
let gid = 0;
export function lineChart(values, { better = 'higher', height = 150 } = {}) {
  const W = 520, H = height, P = { l: 40, r: 10, t: 14, b: 26 };
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
  if (!values.length) return svg;
  let lo = Math.min(...values), hi = Math.max(...values);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.14; lo -= pad; hi += pad;
  const x = i => P.l + (values.length === 1 ? (W - P.l - P.r) / 2 : (i / (values.length - 1)) * (W - P.l - P.r));
  const y = v => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const fmt = v => (Math.abs(hi - lo) < 10 ? v.toFixed(1) : Math.round(v));
  for (const v of [hi - pad, (hi + lo) / 2, lo + pad]) {
    svg.append(s('line', { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), class: 'grid' }));
    svg.append(s('text', { x: P.l - 10, y: y(v) + 3.5, class: 'axis', 'text-anchor': 'end' }, fmt(v)));
  }
  const best = better === 'lower' ? Math.min(...values) : Math.max(...values);
  const pts = values.map((v, i) => [x(i), y(v)]);
  const id = `lg${++gid}`;
  svg.append(s('defs', {}, s('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 },
    s('stop', { offset: '0', class: 'area-a' }), s('stop', { offset: '1', class: 'area-b' }))));
  svg.append(s('line', { x1: P.l, x2: W - P.r, y1: y(best), y2: y(best), class: 'best' }));
  if (pts.length > 1) {
    svg.append(s('path', { d: `M${pts[0][0]},${H - P.b} ${pts.map(p => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} L${pts.at(-1)[0]},${H - P.b} Z`, fill: `url(#${id})` }));
    svg.append(s('polyline', { points: pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '), class: 'line' }));
  }
  const last = values.length - 1;
  values.forEach((v, i) => svg.append(s('circle', { cx: x(i), cy: y(v), r: i === last ? 4.5 : values.length > 30 ? 1.5 : 2.2, class: i === last ? 'dot now' : 'dot' }, s('title', {}, String(v)))));
  svg.append(s('text', { x: W - P.r, y: H - 5, class: 'axis', 'text-anchor': 'end' }, better === 'lower' ? '越低越好 · 虚线是个人最佳' : '越高越好 · 虚线是个人最佳'));
  svg.append(s('text', { x: P.l, y: H - 5, class: 'axis' }, `最近 ${values.length} 次`));
  return svg;
}

// 柱状图：items = [{label, value, now?}]，每天一根细墨线
export function barChart(items, { unit = '', height = 150 } = {}) {
  const W = 520, H = height, P = { l: 4, r: 4, t: 22, b: 26 };
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
  const max = Math.max(1, ...items.map(i => i.value));
  const bw = (W - P.l - P.r) / items.length, full = H - P.t - P.b, w = 5;
  svg.append(s('line', { x1: P.l, x2: W - P.r, y1: H - P.b + 0.5, y2: H - P.b + 0.5, class: 'base' }));
  items.forEach((it, i) => {
    const cx = P.l + i * bw + bw / 2, bh = (it.value / max) * full;
    if (it.value) {
      svg.append(s('rect', { x: cx - w / 2, y: H - P.b - Math.max(bh, 2), width: w, height: Math.max(bh, 2), class: it.now ? 'bar now' : 'bar' }, s('title', {}, `${it.label}: ${it.value}${unit}`)));
      svg.append(s('text', { x: cx, y: H - P.b - Math.max(bh, 2) - 7, class: 'axis strong', 'text-anchor': 'middle' }, it.value));
    } else svg.append(s('circle', { cx, cy: H - P.b - 5, r: 1.2, class: 'hm0' }));
    if ((items.length - 1 - i) % Math.ceil(items.length / 7) === 0) svg.append(s('text', { x: cx, y: H - 6, class: 'axis', 'text-anchor': 'middle' }, it.now ? '今天' : it.label));
  });
  return svg;
}

// 活跃日历：一天一个点，练得越多点越大。今天用朱红圈出来
export function heatmap(act, weeks = 20) {
  const step = 20, W = weeks * step + 24, H = 7 * step;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'heatmap', role: 'img' });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - ((today.getDay() + 6) % 7) - (weeks - 1) * 7); // 周一为起点
  const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  ['一', '三', '五', '日'].forEach((t, i) => svg.append(s('text', { x: 0, y: (i === 3 ? 6 : i * 2) * step + 14, class: 'axis' }, t)));
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(start); day.setDate(start.getDate() + w * 7 + d);
      if (day > today) continue;
      const n = act[key(day)] || 0;
      const cx = 32 + w * step, cy = d * step + 10;
      const r = n === 0 ? 1.4 : n < 2 ? 3 : n < 4 ? 4.6 : n < 7 ? 6.2 : 7.6;
      svg.append(s('circle', { cx, cy, r, class: n ? 'hm' : 'hm hm0' }, s('title', {}, `${key(day)}：${n} 次`)));
      if (+day === +today) svg.append(s('circle', { cx, cy, r: 9.2, class: 'hm today' }));
    }
  }
  return svg;
}

// 数字键盘
export function numpad(onKey, { extra = null } = {}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  return h('div', { class: 'numpad' }, keys.map(k => h('button', {
    class: `key ${k === 'ok' ? 'key-ok' : ''} ${k === 'del' ? 'key-del' : ''}`,
    onpointerdown: e => { e.preventDefault(); onKey(k); },
  }, k === 'del' ? '⌫' : k === 'ok' ? (extra || '确认') : k)));
}

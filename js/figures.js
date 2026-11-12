// 插画与图形：七项训练的发光插画、首页的「今日五环」、专注计时的表盘。
// 每项训练有自己的一对颜色（--c1 → --c2，由调用处写在外层元素上），插画只用这对颜色加玻璃质感的中性色。

let seq = 0;
const uid = () => `i${++seq}`;
const defs = id => `<defs>
  <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--c1)"/><stop offset="1" style="stop-color:var(--c2)"/></linearGradient>
  <radialGradient id="${id}o" cx=".36" cy=".32" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".35" style="stop-color:var(--c2)"/><stop offset="1" style="stop-color:var(--c1)"/></radialGradient>
  <filter id="${id}b" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="8"/></filter>
</defs>`;
const GLASS = 'fill:var(--ill-glass);stroke:var(--ill-line);stroke-width:1';
const num = (x, y, t, size, style = '') => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" style="font-family:var(--font-num);font-weight:700;${style}">${t}</text>`;
const art = body => `<svg class="art" viewBox="0 0 240 150" fill="none" aria-hidden="true">${body}</svg>`;

// 舒尔特：一排玻璃方块，找到的亮起来，一道光把 1、2、3 连到下一个
function schulte() {
  const id = uid(), nums = [7, 1, 12, 4, 10, 3, 9, 2, 5, 11, 8, 6];
  const w = 40, hh = 34, gap = 8, x0 = 28, y0 = 16;
  const pos = v => { const i = nums.indexOf(v); return [x0 + (i % 4) * (w + gap), y0 + Math.floor(i / 4) * (hh + gap)]; };
  const c = v => { const [x, y] = pos(v); return `${x + w / 2} ${y + hh / 2}`; };
  const path = `M${[1, 2, 3, 4].map(c).join('L')}`;
  let o = defs(id)
    + `<path d="${path}" style="stroke:url(#${id}g);stroke-width:7;opacity:.5" filter="url(#${id}b)" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${path}" style="stroke:url(#${id}g);stroke-width:2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  nums.forEach(v => {
    const [x, y] = pos(v), box = `x="${x}" y="${y}" width="${w}" height="${hh}" rx="10"`;
    if (v <= 3) o += `<rect ${box} fill="url(#${id}g)" filter="url(#${id}b)" opacity=".7"/><rect ${box} fill="url(#${id}g)"/>` + num(x + w / 2, y + hh / 2 + 5.5, v, 16, 'fill:var(--on)');
    else if (v === 4) o += `<rect ${box} style="fill:var(--ill-solid);stroke:url(#${id}g);stroke-width:2"/>` + num(x + w / 2, y + hh / 2 + 5.5, v, 16, 'fill:var(--text)');
    else o += `<rect ${box} style="${GLASS};fill:var(--ill-solid)"/>` + num(x + w / 2, y + hh / 2 + 5.5, v, 15, 'fill:var(--ill-dim);font-weight:600');
  });
  return art(o);
}

// Stroop：四团色光之间，一个用蓝色写的「红」字
function stroop() {
  const id = uid();
  const blob = (x, y, r, col, op) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" opacity="${op}" filter="url(#${id}b)"/>`;
  return art(defs(id)
    + `<defs><linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8cff"/><stop offset="1" stop-color="#5ce1ff"/></linearGradient></defs>`
    + blob(52, 52, 30, '#ff4f6e', 0.75) + blob(190, 44, 24, '#ffd23f', 0.7) + blob(194, 108, 28, '#3dd17a', 0.65) + blob(46, 112, 22, '#a66bff', 0.7)
    + `<text x="120" y="107" text-anchor="middle" font-size="90" style="font-family:var(--font-sans);font-weight:900;fill:url(#${id}t)">红</text>`);
}

// SART：数字一个个掠过，唯独 3 是一盏要停下来的灯
function sart() {
  const id = uid();
  const side = (x, t, size, op) => num(x, 75 + size * 0.36, t, size, `fill:var(--text);opacity:${op}`);
  return art(defs(id)
    + `<path d="M12 44H84M156 44H228M12 106H84M156 106H228" style="stroke:var(--ill-line);stroke-width:1" stroke-linecap="round"/>`
    + side(30, 7, 24, 0.22) + side(66, 1, 34, 0.5) + side(174, 9, 34, 0.5) + side(210, 4, 24, 0.22)
    + `<circle cx="120" cy="75" r="34" fill="url(#${id}g)" filter="url(#${id}b)" opacity=".75"/>`
    + `<circle class="spin" cx="120" cy="75" r="45" style="stroke:url(#${id}g);stroke-width:2;stroke-dasharray:3 8" stroke-linecap="round"/>`
    + `<circle cx="120" cy="75" r="33" fill="url(#${id}g)"/>`
    + num(120, 94, 3, 52, 'fill:var(--on)'));
}

// N-back：三片玻璃由远到近，最远那片和眼前这片亮在同一格
function nback() {
  const id = uid();
  let a, b;
  const pane = (x, y, s, lit, mode, op) => {
    const cell = s * 0.2, g = s * 0.08, m = s * 0.12;
    let o = `<g opacity="${op}"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.17}" style="${GLASS};fill:var(--ill-solid)"/>`;
    for (let i = 0; i < 9; i++) {
      const cx = x + m + (i % 3) * (cell + g), cy = y + m + Math.floor(i / 3) * (cell + g), box = `x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="${cell}" height="${cell}" rx="${cell * 0.3}"`;
      if (i !== lit) { o += `<rect ${box} style="fill:var(--ill-line)"/>`; continue; }
      if (mode === 'back') a = [cx + cell / 2, cy + cell / 2];
      if (mode === 'front') b = [cx + cell / 2, cy + cell / 2];
      if (mode === 'mid') o += `<rect ${box} style="fill:var(--ill-dim)"/>`;
      else o += (mode === 'front' ? `<rect ${box} fill="url(#${id}g)" filter="url(#${id}b)"/>` : '') + `<rect ${box} fill="url(#${id}g)" opacity="${mode === 'back' ? 0.6 : 1}"/>`;
    }
    return `${o}</g>`;
  };
  const back = pane(30, 14, 50, 2, 'back', 0.6), mid = pane(84, 36, 62, 6, 'mid', 0.85), front = pane(146, 62, 76, 2, 'front', 1);
  const arc = `<path d="M${a[0]} ${a[1] - 8}C${a[0] + 40} ${a[1] - 34} ${b[0] - 10} ${b[1] - 70} ${b[0]} ${b[1] - 14}" style="stroke:url(#${id}g);stroke-width:2;stroke-dasharray:2 6" stroke-linecap="round"/>`;
  return art(defs(id) + back + mid + arc + front);
}

// 多目标追踪：几颗暗的，三颗亮的，拖着光尾
function mot() {
  const id = uid();
  const T = [[66, 46, -13, 7], [128, 102, 14, 6], [186, 44, -6, -12]];
  const D = [[28, 100], [104, 30], [84, 124], [200, 112], [150, 66]];
  return art(defs(id)
    + D.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" style="${GLASS};fill:var(--ill-solid)"/>`).join('')
    + T.map(([x, y, dx, dy]) => [3, 2, 1].map(k => `<circle cx="${x + dx * k}" cy="${y + dy * k}" r="${11 - k * 1.6}" fill="url(#${id}g)" opacity="${0.42 - k * 0.11}"/>`).join('')
      + `<circle cx="${x}" cy="${y}" r="15" fill="url(#${id}g)" filter="url(#${id}b)" opacity=".8"/><circle cx="${x}" cy="${y}" r="11.5" fill="url(#${id}o)"/>`).join(''));
}

// 限时心算：一道题，一条正在缩短的时间，一个亮着的答案
function arith() {
  const id = uid();
  return art(defs(id)
    + num(120, 50, '47 + 38', 34, 'fill:var(--text);letter-spacing:.02em')
    + `<rect x="62" y="66" width="116" height="5" rx="2.5" style="fill:var(--ill-line)"/><rect x="62" y="66" width="76" height="5" rx="2.5" fill="url(#${id}g)"/>`
    + `<rect x="82" y="86" width="76" height="46" rx="14" fill="url(#${id}g)" filter="url(#${id}b)" opacity=".7"/>`
    + `<rect x="82" y="86" width="76" height="46" rx="14" fill="url(#${id}g)"/>`
    + num(120, 120, 85, 30, 'fill:var(--on)'));
}

// 呼吸计数：一颗珠子，一圈圈荡开的光
function breath() {
  const id = uid();
  return art(defs(id)
    + [22, 38, 54, 70].map((r, i) => `<circle class="ripple" cx="120" cy="75" r="${r}" style="stroke:url(#${id}g);stroke-width:${2 - i * 0.3};opacity:${0.85 - i * 0.2};--d:${i * 0.4}s"/>`).join('')
    + `<circle cx="120" cy="75" r="26" fill="url(#${id}g)" filter="url(#${id}b)" opacity=".8"/>`
    + `<circle cx="120" cy="75" r="13" fill="url(#${id}o)"/>`);
}

const ART = { schulte, stroop, sart, nback, mot, arith, breath };
export const figure = id => (ART[id] ? ART[id]() : '');

// 今日五环：一项一环，从外到内。练完的那一环亮起来，没练的只在顶上留一个起点
export function todayRings(items) {
  const id = uid(), C = 150, sw = 18, step = 24;
  let o = '<defs>' + items.map((it, i) => `<linearGradient id="${id}r${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${it.c1}"/><stop offset="1" stop-color="${it.c2}"/></linearGradient>`).join('') + '</defs>';
  items.forEach((it, i) => {
    const r = 132 - i * step, len = (2 * Math.PI * r).toFixed(2);
    o += `<circle cx="${C}" cy="${C}" r="${r}" stroke="${it.c1}" stroke-width="${sw}" opacity=".15"/>`;
    o += it.done
      ? `<circle class="ring-on" cx="${C}" cy="${C}" r="${r}" stroke="url(#${id}r${i})" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${len}" transform="rotate(-90 ${C} ${C})" style="--len:${len};--i:${i};--glow:${it.c1}"/>`
      : `<circle cx="${C}" cy="${C - r}" r="${sw / 2}" fill="${it.c1}" opacity=".55"/>`;
  });
  const done = items.filter(it => it.done).length;
  o += `<text class="rings-num" x="${C}" y="${C + 8}" text-anchor="middle">${done}<tspan class="rings-den">/${items.length}</tspan></text>`;
  return `<svg class="rings" viewBox="0 0 300 300" fill="none" role="img" aria-label="今日训练进度：已完成 ${done} / ${items.length}">${o}</svg>`;
}

// 专注计时的表盘：一圈渐变的光，光头是一颗亮点；外面一分钟一格
export function clockDial(planMin) {
  const id = uid(), C = 200, step = planMin <= 60 ? 1 : 5, n = Math.max(1, Math.round(planMin / step)), every = planMin <= 30 ? 5 : planMin <= 60 ? 10 : 6;
  const P = (r, deg) => { const a = ((deg - 90) * Math.PI) / 180; return `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`; };
  let o = `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cff"/><stop offset=".5" stop-color="#4f8cff"/><stop offset="1" stop-color="#2fe3d0"/></linearGradient></defs>`;
  for (let i = 0; i < n; i++) {
    const big = i % every === 0, deg = (i / n) * 360;
    o += `<path d="M${P(big ? 180 : 186, deg)}L${P(192, deg)}" style="stroke:var(${big ? '--text-3' : '--stroke-2'});stroke-width:${big ? 1.6 : 1}" stroke-linecap="round"/>`;
  }
  o += `<circle cx="${C}" cy="${C}" r="158" style="stroke:var(--stroke);stroke-width:12"/>`
    + `<circle class="prog" cx="${C}" cy="${C}" r="158" stroke="url(#${id}g)" stroke-width="12" stroke-linecap="round" pathLength="1" transform="rotate(-90 ${C} ${C})"/>`
    + `<g class="tip"><circle cx="${C}" cy="${C - 158}" r="9"/></g>`;
  return `<svg viewBox="0 0 400 400" fill="none" aria-hidden="true">${o}</svg>`;
}

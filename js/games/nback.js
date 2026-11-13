import { h, rand, shuffle, mean, pct, loadClips, playClip } from '../ui.js';
import { dprime } from './common.js';

const LETTERS = ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T'];

function buildBlock(n, dual) {
  const len = 20 + n;
  const pool = shuffle(Array.from({ length: len - n }, (_, i) => i + n));
  const vis = new Set(), aud = new Set();
  if (dual) {
    pool.slice(0, 2).forEach(i => { vis.add(i); aud.add(i); });
    pool.slice(2, 6).forEach(i => vis.add(i));
    pool.slice(6, 10).forEach(i => aud.add(i));
  } else pool.slice(0, 6).forEach(i => vis.add(i));
  const pos = [], let_ = [];
  for (let i = 0; i < len; i++) {
    if (i >= n && vis.has(i)) pos.push(pos[i - n]);
    else { let p; do p = rand(0, 7); while (i >= n && p === pos[i - n]); pos.push(p); }
    if (i >= n && aud.has(i)) let_.push(let_[i - n]);
    else { let l; do l = rand(0, LETTERS.length - 1); while (i >= n && l === let_[i - n]); let_.push(l); }
  }
  return { len, pos, let: let_, vis, aud };
}

function speak(letter) {
  try {
    const u = new SpeechSynthesisUtterance(letter);
    u.lang = 'en-US'; u.rate = 1.1;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}

export default {
  id: 'nback',
  name: 'N-back',
  short: 'N-back', tag: '工作记忆', colors: ['#8b5cff', '#c77dff'], mins: 3.5,
  dim: '工作记忆 · 注意更新',
  desc: '记住 N 步之前出现过什么，并不断更新。双重模式同时追踪位置和字母两条信息流。',
  howto: [
    '方块会依次出现在 3×3 网格（中心除外）的某个位置，每 3 秒一个。',
    '如果当前位置与 N 步之前的位置相同，按 A（或点「位置相同」）。',
    '双重模式下还会读出一个字母：与 N 步之前的字母相同时按 L（或点「字母相同」）。',
    '每组结束后自动调整 N：错误少于 3 个升一级，多于 5 个降一级。',
  ],
  options: [
    { key: 'mode', label: '模式', def: 'single', choices: [['single', '单一（位置）'], ['dual', '双重（位置 + 字母）']] },
    { key: 'audio', label: '字母呈现', def: 'speech', choices: [['speech', '语音朗读'], ['text', '文字显示']] },
    { key: 'blocks', label: '组数', def: 3, choices: [[1, '1 组'], [3, '3 组'], [5, '5 组']] },
  ],
  variant: o => (o.mode === 'dual' ? '双重' : '单一'),
  level: { def: 1, min: 1, max: 9, label: n => `${n}-back` },
  score: { label: '平均 N', unit: '', better: 'higher', digits: 2 },

  async run(ctx) {
    const dual = ctx.opts.mode === 'dual';
    // 字母怎么念：先用自带的读音文件（audio/letters/）；读不进来就用浏览器的朗读；再不行就把字母显示在方块上
    let clips = null, useSpeech = false;
    if (dual && ctx.opts.audio === 'speech') {
      clips = await loadClips(LETTERS.map(l => `audio/letters/${l}.mp3`));
      useSpeech = !clips && 'speechSynthesis' in window;
    }
    let n = ctx.level ?? 1;
    const cells = Array.from({ length: 9 }, (_, i) => h('div', { class: `nb-cell ${i === 4 ? 'nb-center' : ''}` }));
    const grid = h('div', { class: 'nb-grid' }, cells);
    const info = h('div', { class: 'pill-info' });
    let cur = null;
    const mark = (type, btn) => {
      if (!cur || cur[type] != null) return;
      cur[type] = true;
      const isT = type === 'pPress' ? cur.visT : cur.audT;
      btn.classList.add(isT ? 'flash-good' : 'flash-bad');
      ctx.beep(isT);
    };
    const bP = h('button', { class: 'btn resp big', onpointerdown: e => { e.preventDefault(); mark('pPress', bP); } }, '位置相同', h('span', { class: 'kbd' }, 'A'));
    const bL = h('button', { class: 'btn resp big', onpointerdown: e => { e.preventDefault(); mark('lPress', bL); } }, '字母相同', h('span', { class: 'kbd' }, 'L'));
    if (!dual) bL.style.display = 'none';
    ctx.stage.append(h('div', { class: 'center-col' }, info, grid, h('div', { class: `resp-row ${dual ? 'two' : 'one'}` }, bP, bL)));
    ctx.onKey(e => {
      const k = e.key.toLowerCase();
      if (k === 'a') mark('pPress', bP);
      if (k === 'l' && dual) mark('lPress', bL);
    });
    const posIdx = p => (p >= 4 ? p + 1 : p); // 跳过中心格

    const blocks = [];
    for (let b = 0; b < ctx.opts.blocks; b++) {
      info.replaceChildren(`第 ${b + 1} 组`, h('b', {}, `${n}-back`));
      cells.forEach(c => { c.classList.remove('on'); c.textContent = ''; });
      if (b > 0) await ctx.wait(2500);
      const blk = buildBlock(n, dual);
      const st = { vh: 0, vm: 0, vf: 0, ah: 0, am: 0, af: 0 };
      for (let i = 0; i < blk.len; i++) {
        ctx.setStatus(`第 ${b + 1}/${ctx.opts.blocks} 组 · ${i + 1}/${blk.len}`); ctx.setProgress((b + i / blk.len) / ctx.opts.blocks);
        cur = { visT: blk.vis.has(i), audT: blk.aud.has(i), pPress: null, lPress: null };
        const cell = cells[posIdx(blk.pos[i])];
        cell.classList.add('on');
        if (dual) {
          const L = LETTERS[blk.let[i]];
          if (clips) playClip(clips[blk.let[i]]); else if (useSpeech) speak(L); else cell.textContent = L;
        }
        await ctx.wait(500);
        cell.classList.remove('on'); cell.textContent = '';
        await ctx.wait(2500);
        bP.classList.remove('flash-good', 'flash-bad'); bL.classList.remove('flash-good', 'flash-bad');
        if (cur.visT) cur.pPress ? st.vh++ : st.vm++; else if (cur.pPress) st.vf++;
        if (dual) { if (cur.audT) cur.lPress ? st.ah++ : st.am++; else if (cur.lPress) st.af++; }
      }
      cur = null;
      const ev = st.vm + st.vf, ea = st.am + st.af;
      const errMax = dual ? Math.max(ev, ea) : ev;
      blocks.push({ n, ...st, len: blk.len, nv: blk.vis.size, na: blk.aud.size });
      if (errMax < 3) n = Math.min(9, n + 1);
      else if (errMax > 5) n = Math.max(1, n - 1);
    }

    const sum = k => blocks.reduce((a, b) => a + b[k], 0);
    const nv = sum('nv'), na = sum('na'), total = sum('len');
    const metrics = [
      ['各组 N', blocks.map(b => b.n).join(' → ')],
      ['位置：命中 / 漏掉 / 误报', `${sum('vh')} / ${sum('vm')} / ${sum('vf')}`],
      ['位置 d′', dprime(sum('vh'), nv, sum('vf'), total - nv).toFixed(2)],
    ];
    if (dual) {
      metrics.push(['字母：命中 / 漏掉 / 误报', `${sum('ah')} / ${sum('am')} / ${sum('af')}`]);
      metrics.push(['字母 d′', dprime(sum('ah'), na, sum('af'), total - na).toFixed(2)]);
    }
    metrics.push(['位置命中率', pct(sum('vh') / Math.max(1, nv))]);
    return {
      score: mean(blocks.map(b => b.n)),
      metrics, level: n,
      note: `下次从 ${n}-back 开始。N-back 的进步主要体现在这个任务本身上，坚持记录比单次分数更重要。`,
    };
  },
};

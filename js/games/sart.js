import { h, mean, sd, pct, ms, shuffle } from '../ui.js';
import { dprime } from './common.js';

const SIZES = [48, 64, 84, 104, 124];

export default {
  id: 'sart',
  name: 'SART 持续注意',
  short: 'SART', tag: '持续注意', colors: ['#ffb52e', '#ffe76a'], mins: 2,
  dim: '持续注意 · 反应抑制',
  desc: '数字快速闪现，看到就按，唯独看到 3 时忍住不按。单调、节奏快，专门暴露「走神时的自动驾驶」。',
  howto: [
    '数字 1–9 依次快速出现：除了 3 以外，每个数字都按一下空格（或点击屏幕下方区域）。',
    '看到 3 时不要按。',
    '速度和准确同样重要，过程中没有对错提示。',
  ],
  options: [
    { key: 'len', label: '长度', def: 90, choices: [[90, '约 1.7 分钟'], [162, '约 3 分钟'], [225, '约 4.3 分钟（标准）']] },
  ],
  variant: o => `${o.len} 试次`,
  score: { label: 'd′ 辨别力', unit: '', better: 'higher', digits: 2 },

  async run(ctx) {
    // 生成数字序列：每 9 个为一组，组内 1–9 各一次（No-Go 约 11%）
    const seq = [];
    while (seq.length < ctx.opts.len) seq.push(...shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]));
    seq.length = ctx.opts.len;

    const digit = h('div', { class: 'sart-digit' });
    const tap = h('button', { class: 'tapzone', onpointerdown: e => { e.preventDefault(); press(); } }, window.matchMedia('(hover: none)').matches ? '每个数字点一下这里' : '点这里，或按空格');
    ctx.stage.append(h('div', { class: 'center-col sart' }, digit, tap));
    let pressT = null, onset = 0;
    const press = () => {
      if (pressT == null) pressT = performance.now() - onset;
      tap.classList.remove('pulse'); void tap.offsetWidth; tap.classList.add('pulse');
    };
    ctx.onKey(e => { if (e.code === 'Space') { e.preventDefault(); press(); } });

    const res = [];
    for (let i = 0; i < seq.length; i++) {
      ctx.setStatus(`${i + 1} / ${seq.length}`); ctx.setProgress(i / seq.length);
      const n = seq[i];
      pressT = null; onset = performance.now();
      digit.classList.remove('mask'); digit.textContent = n;
      digit.style.fontSize = `${SIZES[Math.floor(Math.random() * SIZES.length)]}px`;
      await ctx.wait(250);
      digit.textContent = ''; digit.classList.add('mask');
      await ctx.wait(900);
      res.push({ n, go: n !== 3, rt: pressT });
    }

    const go = res.filter(r => r.go), nogo = res.filter(r => !r.go);
    const hits = go.filter(r => r.rt != null).length;
    const omissions = go.length - hits;
    const commissions = nogo.filter(r => r.rt != null).length;
    const rts = go.filter(r => r.rt != null && r.rt > 100).map(r => r.rt);
    const m = mean(rts), cv = m ? sd(rts) / m : 0;
    const d = dprime(hits, go.length, commissions, nogo.length);
    return {
      score: Math.round(d * 100) / 100,
      metrics: [
        ['看到 3 却按了（误按）', `${commissions} / ${nogo.length}`],
        ['该按没按（漏按）', `${omissions} / ${go.length}`],
        ['抑制成功率', pct(1 - commissions / nogo.length)],
        ['平均反应', ms(m)],
        ['反应变异系数 CV', cv ? cv.toFixed(2) : '—'],
      ],
      note: 'd′ 综合了「该按就按」和「该停就停」，越高越好。CV 越低说明节奏越稳定；误按多通常意味着进入了自动驾驶状态。',
    };
  },
};

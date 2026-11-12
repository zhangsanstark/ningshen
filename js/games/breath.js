import { h, pct, mean } from '../ui.js';

export default {
  id: 'breath',
  name: '呼吸计数',
  short: '呼吸', tag: '元觉察', colors: ['#8f9bff', '#dcd4ff'], mins: 3,
  dim: '持续注意 · 元觉察',
  desc: '安静地数呼吸，1 到 9 循环。它测的不是计数能力，而是你能否觉察到自己走神了。',
  howto: [
    '自然呼吸，不需要刻意控制。一呼一吸算一次。',
    '第 1–8 次呼吸：每次按「呼吸」键（空格 / ←）；第 9 次：按「第 9 次」键（回车 / →），然后从 1 重新数。',
    '发现自己数乱了，按「数乱了」（R），从 1 重新开始——这不算错，反而是一次成功的觉察。',
    '屏幕不会显示计数，全靠你自己记。可以闭眼，只用按键。',
  ],
  options: [
    { key: 'min', label: '时长', def: 3, choices: [[3, '3 分钟'], [5, '5 分钟'], [10, '10 分钟'], [15, '15 分钟']] },
    { key: 'probe', label: '走神探测', def: 0, choices: [[0, '关闭'], [1, '每 1–2 分钟询问']] },
  ],
  variant: o => `${o.min} 分钟`,
  score: { label: '计数准确率', unit: '%', better: 'higher', digits: 0 },

  run(ctx) {
    const durMs = ctx.opts.min * 60000;
    let count = 0, correct = 0, errors = 0, resets = 0, breaths = 0;
    const gaps = []; let lastT = null;
    const probes = [];
    let paused = false, pausedMs = 0, pauseStart = 0;
    const t0 = performance.now();
    const elapsed = () => performance.now() - t0 - pausedMs - (paused ? performance.now() - pauseStart : 0);

    const orb = h('div', { class: 'breath-orb' }, h('i'), h('i'), h('i'), h('b'));
    const time = h('div', { class: 'breath-time' });
    const tap = el => { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); orb.classList.remove('pulse'); void orb.offsetWidth; orb.classList.add('pulse'); };
    const stamp = () => { const now = performance.now(); if (lastT) gaps.push(now - lastT); lastT = now; breaths++; };
    const one = () => { if (paused) return; stamp(); count++; if (count >= 9) { errors++; count = 0; } tap(bA); };
    const nine = () => { if (paused) return; stamp(); if (count === 8) correct++; else errors++; count = 0; tap(bB); };
    const reset = () => { if (paused) return; resets++; count = 0; lastT = null; tap(bR); };
    const bA = h('button', { class: 'btn resp big', onpointerdown: e => { e.preventDefault(); one(); } }, '呼吸 1–8', h('small', {}, '空格 / ←'));
    const bB = h('button', { class: 'btn resp big', onpointerdown: e => { e.preventDefault(); nine(); } }, '第 9 次', h('small', {}, '回车 / →'));
    const bR = h('button', { class: 'btn ghost', onpointerdown: e => { e.preventDefault(); reset(); } }, '我数乱了，从 1 重来', h('span', { class: 'kbd' }, 'R'));
    const probeBox = h('div', { class: 'probe hidden' });
    ctx.stage.append(h('div', { class: 'center-col breath' }, orb, time, h('div', { class: 'resp-row two' }, bA, bB), bR, probeBox));
    ctx.onKey(e => {
      if (e.code === 'Space' || e.key === 'ArrowLeft') { e.preventDefault(); one(); }
      else if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); nine(); }
      else if (e.key.toLowerCase() === 'r') reset();
    });

    const ask = (q, labels) => new Promise(res => {
      probeBox.replaceChildren(h('p', {}, q), h('div', { class: 'probe-row' },
        labels.map((l, i) => h('button', { class: 'btn', onclick: () => res(i + 1) }, h('b', {}, i + 1), h('small', {}, l)))));
    });
    const runProbe = async () => {
      paused = true; pauseStart = performance.now();
      probeBox.classList.remove('hidden');
      const on = await ask('刚才那一刻，你的注意力在呼吸上吗？', ['完全不在', '', '', '', '', '完全在']);
      const aware = await ask('你当时意识到自己注意力在哪里吗？', ['完全没意识到', '', '', '', '', '非常清楚']);
      probes.push({ on, aware });
      probeBox.classList.add('hidden');
      pausedMs += performance.now() - pauseStart; paused = false;
      nextProbe = elapsed() + 60000 + Math.random() * 60000;
    };
    let nextProbe = 60000 + Math.random() * 60000, probing = false;

    return new Promise(resolve => {
      ctx.interval(async () => {
        const e = elapsed();
        const left = Math.max(0, durMs - e);
        time.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
        ctx.setStatus('专心数呼吸'); ctx.setProgress(e / durMs);
        if (ctx.opts.probe && !probing && !paused && e > nextProbe && left > 20000) { probing = true; await runProbe(); probing = false; }
        if (left <= 0 && !paused) {
          const acc = correct + errors ? correct / (correct + errors) : 0;
          const metrics = [
            ['完整正确循环', correct],
            ['计数错误', errors],
            ['主动觉察「数乱了」', resets],
            ['总呼吸次数', breaths],
            ['平均呼吸间隔', gaps.length ? `${(mean(gaps) / 1000).toFixed(1)} 秒` : '—'],
          ];
          if (probes.length) metrics.push(['专注自评（1–6）', mean(probes.map(p => p.on)).toFixed(1)], ['觉察自评（1–6）', mean(probes.map(p => p.aware)).toFixed(1)]);
          ctx.chime();
          resolve({
            score: Math.round(acc * 100),
            metrics,
            note: correct + errors === 0 ? '本次没有完成任何一轮计数。' : '研究中（Levinson 等，2014）这个任务的平均错误率约为 16–22%。「数乱了」次数多不是坏事，说明你在练觉察。',
          });
        }
      }, 250);
    });
  },
};

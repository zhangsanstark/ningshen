import { h, shuffle } from '../ui.js';

export default {
  id: 'schulte',
  name: '舒尔特方格',
  short: '舒尔特', tag: '视觉搜索', colors: ['#3d8bff', '#6ec3ff'], mins: 1,
  dim: '选择性注意 · 视觉搜索',
  desc: '按顺序尽快找出所有数字。训练视觉搜索速度，以及注意力的集中和转移。',
  howto: [
    '方格里的数字是乱序排列的，从 1 开始按顺序依次点击。',
    '视线尽量停在方格中心，用余光去搜索，不要逐格扫视。',
    '点错不会前进，但会记一次错误。',
  ],
  options: [
    { key: 'size', label: '规格', def: 5, choices: [[3, '3×3'], [4, '4×4'], [5, '5×5'], [6, '6×6'], [7, '7×7']] },
    { key: 'order', label: '顺序', def: 'asc', choices: [['asc', '正序'], ['desc', '倒序']] },
    { key: 'hint', label: '提示下一个', def: 1, choices: [[1, '显示'], [0, '隐藏']] },
  ],
  variant: o => `${o.size}×${o.size}${o.order === 'desc' ? ' 倒序' : ''}`,
  score: { label: '用时', unit: '秒', better: 'lower', digits: 2 },

  run(ctx) {
    const { size, order, hint } = ctx.opts;
    const N = size * size;
    const nums = shuffle(Array.from({ length: N }, (_, i) => i + 1));
    const seq = order === 'desc' ? Array.from({ length: N }, (_, i) => N - i) : Array.from({ length: N }, (_, i) => i + 1);
    let idx = 0, errors = 0;
    const t0 = performance.now();

    return new Promise(resolve => {
      const next = h('div', { class: `pill-info ${hint ? '' : 'off'}` });
      const showNext = () => { next.replaceChildren('下一个', h('b', {}, seq[idx])); ctx.setProgress(idx / N); };
      const grid = h('div', { class: 'schulte', style: { '--n': size } },
        nums.map(n => h('button', {
          class: 'cell',
          onpointerdown: e => {
            e.preventDefault();
            const el = e.currentTarget;
            if (n === seq[idx]) {
              idx++;
              el.classList.remove('flash-bad'); el.classList.add('flash-good');
              ctx.timeout(() => el.classList.remove('flash-good'), 200);
              if (idx === N) {
                ctx.setProgress(1);
                const t = (performance.now() - t0) / 1000;
                resolve({
                  score: t,
                  metrics: [['错误次数', errors], ['平均每格', `${(t / N).toFixed(2)} 秒`]],
                  note: t / N < 0.8 && size < 7 ? '平均每格不到 0.8 秒，可以试试更大的规格。' : null,
                });
              } else showNext();
            } else {
              errors++; ctx.beep(false);
              el.classList.remove('flash-bad'); void el.offsetWidth; el.classList.add('flash-bad');
              ctx.timeout(() => el.classList.remove('flash-bad'), 340);
            }
          },
        }, n)));
      showNext();
      ctx.interval(() => ctx.setStatus(`${((performance.now() - t0) / 1000).toFixed(1)} 秒`), 100);
      ctx.stage.append(h('div', { class: 'center-col' }, next, grid));
    });
  },
};

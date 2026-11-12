import { h, pick, pct, ms } from '../ui.js';
import { rtPoints, adaptByAcc, levelNote, meanRT } from './common.js';

const COLORS = [
  { n: '红', c: '#ff5f5f' },
  { n: '绿', c: '#3dd17a' },
  { n: '蓝', c: '#5aa2ff' },
  { n: '黄', c: '#ffd23f' },
];
const KEYS = { '1': 0, '2': 1, '3': 2, '4': 3, d: 0, f: 1, j: 2, k: 3 };
const WINDOWS = [3000, 2600, 2200, 1900, 1650, 1800, 1600, 1400, 1250, 1100];

export default {
  id: 'stroop',
  name: 'Stroop 色词',
  short: 'Stroop', tag: '抗干扰', colors: ['#ff4f8b', '#ff9a3d'], mins: 2,
  dim: '选择性注意 · 干扰抑制',
  desc: '字的意思和字的颜色常常不一致，要忽略字义、只判断颜色。练的是在干扰下保持选择。',
  howto: [
    '屏幕中央出现一个颜色字，按下它的「墨水颜色」，不是字的意思。',
    '键盘：1/2/3/4 或 D/F/J/K 分别对应 红/绿/蓝/黄。',
    '第 6 级起会出现带方框的字：方框里的字要按「字义」作答（规则转换）。',
  ],
  options: [{ key: 'trials', label: '题数', def: 40, choices: [[30, '30'], [40, '40'], [60, '60']] }],
  variant: () => '',
  level: { def: 1, min: 1, max: 10 },
  score: { label: '得分', unit: '分', better: 'higher', digits: 0 },

  async run(ctx) {
    const level = ctx.level ?? 1;
    const win = WINDOWS[level - 1];
    const switchOn = level >= 6;
    const word = h('div', { class: 'stroop-word' });
    const card = h('div', { class: 'stroop-card' }, word);
    const btns = COLORS.map((c, i) => h('button', {
      class: 'btn resp',
      onpointerdown: e => { e.preventDefault(); ctx.press(i); },
    }, c.n, h('span', { class: 'kbd' }, i + 1)));
    ctx.stage.append(h('div', { class: 'center-col' }, card, h('div', { class: 'resp-row four' }, btns)));
    ctx.onKey(e => { const k = KEYS[e.key.toLowerCase()]; if (k != null) ctx.press(k); });

    const trials = [];
    let points = 0;
    for (let t = 0; t < ctx.opts.trials; t++) {
      ctx.setStatus(`${t + 1} / ${ctx.opts.trials}`); ctx.setProgress(t / ctx.opts.trials);
      word.classList.remove('msg'); word.textContent = '+'; word.style.color = ''; card.classList.remove('rule');
      await ctx.wait(450);
      const wi = Math.floor(Math.random() * 4);
      const congruent = Math.random() < 0.5;
      const ci = congruent ? wi : pick([0, 1, 2, 3].filter(i => i !== wi));
      const byMeaning = switchOn && Math.random() < 0.25;
      card.classList.toggle('rule', byMeaning);
      word.textContent = COLORS[wi].n;
      word.style.color = COLORS[ci].c;
      const r = await ctx.response(win);
      const answer = byMeaning ? wi : ci;
      const correct = r != null && r.key === answer;
      if (correct) points += rtPoints(r.rt, win);
      if (r) { ctx.beep(correct); btns[r.key].classList.add(correct ? 'flash-good' : 'flash-bad'); }
      trials.push({ congruent, byMeaning, correct, rt: r?.rt, timeout: !r });
      word.textContent = r ? '' : '太慢了'; word.classList.toggle('msg', !r);
      word.style.color = ''; card.classList.remove('rule');
      await ctx.wait(r ? 150 : 500);
      btns.forEach(b => b.classList.remove('flash-good', 'flash-bad'));
    }
    const acc = trials.filter(t => t.correct).length / trials.length;
    const plain = trials.filter(t => !t.byMeaning);
    const rtC = meanRT(plain.filter(t => t.congruent));
    const rtI = meanRT(plain.filter(t => !t.congruent));
    const newLevel = adaptByAcc(level, acc);
    const metrics = [
      ['正确率', pct(acc)],
      ['一致题反应', ms(rtC)],
      ['不一致题反应', ms(rtI)],
      ['干扰效应', rtC && rtI ? `${Math.round(rtI - rtC)} ms` : '—'],
      ['超时', trials.filter(t => t.timeout).length],
    ];
    if (switchOn) metrics.push(['字义题正确率', pct(trials.filter(t => t.byMeaning && t.correct).length / Math.max(1, trials.filter(t => t.byMeaning).length))]);
    return {
      score: points, metrics, level: newLevel,
      note: `干扰效应 = 不一致题比一致题慢多少，越小说明越不受字义干扰。${levelNote(level, newLevel)}`,
    };
  },
};

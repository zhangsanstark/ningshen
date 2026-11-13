import { h, rand, pick, numpad, mean } from '../ui.js';
import { levelNote } from './common.js';

// 按等级出题，结果都是非负整数。
// 最低一级就是两位数；一位数只出现在「3 × 4 + 5 × 6」这类连算题里。从第 5 级起有三位数。
const add = (a, b) => ({ q: `${a} + ${b}`, a: a + b });
const sub = (a, b) => (a === b ? sub(a, b - 1) : a < b ? { q: `${b} − ${a}`, a: b - a } : { q: `${a} − ${b}`, a: a - b }); // 不出结果是 0 的题
const mul = (a, b) => ({ q: `${a} × ${b}`, a: a * b });
const div = (a, b) => ({ q: `${a * b} ÷ ${a}`, a: b });
// 两个乘积相加、相减：3 × 4 + 5 × 6
const mulAdd = (a, b, c, d) => ({ q: `${a} × ${b} + ${c} × ${d}`, a: a * b + c * d });
const mulSub = (a, b, c, d) => (a * b < c * d ? mulSub(c, d, a, b) : { q: `${a} × ${b} − ${c} × ${d}`, a: a * b - c * d });
// 三个数连加减：58 + 36 − 27
const chain = (lo, hi) => { const a = rand(lo, hi), b = rand(lo, hi), c = rand(lo, Math.min(hi, a + b)); return { q: `${a} + ${b} − ${c}`, a: a + b - c }; };
const d1 = () => rand(2, 9), d2 = () => rand(12, 98), d3 = () => rand(101, 899);

// [从第几级, 到第几级, 出题]：每一级从覆盖它的题型里随机抽
const TYPES = [
  [1, 1, () => add(rand(12, 89), rand(3, 9))],              // 47 + 8
  [1, 1, () => sub(rand(21, 98), rand(3, 9))],              // 63 − 7
  [2, 4, () => add(rand(12, 88), rand(12, 88))],            // 34 + 58
  [2, 4, () => sub(d2(), d2())],                            // 81 − 37
  [3, 5, () => mulAdd(d1(), d1(), d1(), d1())],             // 3 × 4 + 5 × 6
  [4, 6, () => mulSub(d1(), d1(), d1(), d1())],             // 7 × 8 − 3 × 6
  [4, 6, () => mul(rand(12, 49), d1())],                    // 23 × 4
  [5, 7, () => add(d3(), d2())],                            // 347 + 68
  [5, 7, () => sub(rand(101, 999), d2())],                  // 512 − 47
  [6, 8, () => div(rand(3, 9), rand(12, 49))],              // 138 ÷ 6
  [6, 9, () => add(d3(), d3())],                            // 347 + 268
  [6, 9, () => sub(rand(101, 999), rand(101, 999))],        // 803 − 256
  [7, 9, () => chain(12, 98)],                              // 58 + 36 − 27
  [7, 9, () => { const p = mul(rand(12, 39), d1()), c = d2(); return { q: `${p.q} + ${c}`, a: p.a + c }; }], // 23 × 4 + 57
  [8, 10, () => mul(rand(11, 19), rand(11, 19))],           // 14 × 17
  [8, 10, () => mul(rand(102, 499), rand(3, 9))],           // 236 × 4
  [9, 10, () => mulAdd(rand(12, 29), d1(), d1(), d1())],    // 23 × 4 + 6 × 7
  [10, 10, () => mul(rand(12, 39), rand(12, 29))],          // 27 × 18
  [10, 10, () => chain(101, 899)],                          // 347 + 268 − 159
];
export function makeProblem(level) {
  const L = Math.max(1, Math.min(10, Math.round(level)));
  return pick(TYPES.filter(([lo, hi]) => L >= lo && L <= hi))[2]();
}
// 升级要达到的速度：每分钟答对几题。题越难，要求的题数越少
const PACE = [12, 10, 9, 8, 7, 6, 5, 4, 4, 4];

export default {
  id: 'arith',
  name: '限时心算',
  short: '心算', tag: '持续运算', colors: ['#4fd96a', '#c4f24a'], mins: 1,
  dim: '持续注意 · 工作记忆',
  desc: '在限定时间内尽可能多地答对算术题。克雷佩林模式只做相邻两个数字相加，用来观察注意力随时间的波动。',
  howto: [
    '综合心算：从两位数加减起步，等级越高数字越大，到三位数；中间还有「3 × 4 + 5 × 6」这样的连算题。用键盘或屏幕数字键输入答案，回车确认。',
    '克雷佩林：两个一位数相加，只输入结果的个位数（例如 7+8=15，输入 5），按键即提交。',
    '准确优先，再追求速度；答错会显示正确答案。',
  ],
  options: [
    { key: 'mode', label: '模式', def: 'mixed', choices: [['mixed', '综合心算'], ['kraepelin', '克雷佩林连加']] },
    { key: 'dur', label: '时长', def: 60, choices: [[60, '1 分钟'], [120, '2 分钟'], [180, '3 分钟']] },
  ],
  variant: o => `${o.mode === 'kraepelin' ? '克雷佩林' : '综合'} ${o.dur / 60}分钟`,
  level: { def: 1, min: 1, max: 10, applies: o => o.mode === 'mixed' },
  score: { label: '答对', unit: '题', better: 'higher', digits: 0 },

  run(ctx) {
    const { mode, dur } = ctx.opts;
    const kp = mode === 'kraepelin';
    const level = Math.max(1, Math.min(10, Math.round(ctx.level ?? 1)));
    const durMs = dur * 1000;
    let cur, input = '', correct = 0, wrong = 0, shownAt = 0;
    const times = [];
    const buckets = Array(Math.ceil(dur / 15)).fill(0); // 每 15 秒完成量
    const t0 = performance.now();

    const qEl = h('div', { class: 'arith-q' });
    const aEl = h('div', { class: 'arith-a' });
    const fb = h('div', { class: 'arith-fb' });
    const bar = h('div', { class: 'timebar' }, h('div'));

    const nextQ = () => {
      if (kp) { const a = rand(1, 9), b = rand(1, 9); cur = { q: `${a} + ${b}`, a: (a + b) % 10 }; }
      else cur = makeProblem(level);
      qEl.textContent = cur.q;
      qEl.classList.toggle('long', cur.q.length > 12); // 四个数的连算题比较长，字号小一点，窄屏上才放得下
      input = ''; aEl.textContent = kp ? '?' : ' ';
      shownAt = performance.now();
    };

    const submit = () => {
      if (input === '') return;
      const ok = Number(input) === cur.a;
      const now = performance.now();
      times.push(now - shownAt);
      if (ok) { correct++; buckets[Math.min(buckets.length - 1, Math.floor((now - t0) / 15000))]++; }
      else wrong++;
      ctx.beep(ok);
      aEl.classList.remove('good', 'bad'); void aEl.offsetWidth;
      aEl.classList.add(ok ? 'good' : 'bad');
      fb.textContent = ok ? '' : `${cur.q} = ${kp ? `…${cur.a}` : cur.a}`;
      nextQ();
    };

    const onKey = k => {
      if (k === 'ok') return submit();
      if (k === 'del') { input = input.slice(0, -1); aEl.textContent = input || ' '; return; }
      if (input.length >= 5) return;
      input += k; aEl.textContent = input;
      if (kp) submit();
    };

    ctx.onKey(e => {
      if (/^[0-9]$/.test(e.key)) onKey(e.key);
      else if (e.key === 'Backspace') onKey('del');
      else if (e.key === 'Enter') onKey('ok');
    });

    ctx.stage.append(h('div', { class: 'center-col arith' }, bar, qEl, aEl, fb,
      numpad(onKey, { extra: kp ? ' ' : '确认' })));
    if (kp) ctx.stage.querySelector('.key-ok').style.visibility = 'hidden';
    nextQ();

    return new Promise(resolve => {
      ctx.interval(() => {
        const left = durMs - (performance.now() - t0);
        bar.firstChild.style.width = `${Math.max(0, left / durMs) * 100}%`; ctx.setProgress(1 - left / durMs);
        ctx.setStatus(`剩余 ${Math.ceil(Math.max(0, left) / 1000)} 秒 · 答对 ${correct}`);
        if (left <= 0) {
          const total = correct + wrong;
          const acc = total ? correct / total : 0;
          let newLevel = level;
          if (!kp) {
            // 又准又够快就升一级；明显有余力（快出一大截、几乎全对）直接升两级，不用一级一级磨
            const need = PACE[level - 1] * dur / 60;
            if (acc >= 0.95 && correct >= need * 1.6) newLevel = Math.min(10, level + 2);
            else if (acc >= 0.9 && correct >= need) newLevel = Math.min(10, level + 1);
            else if (acc < 0.7 || correct < need / 3) newLevel = Math.max(1, level - 1);
          }
          const metrics = [
            ['正确率', `${Math.round(acc * 100)}%`],
            ['答错', wrong],
            ['平均每题', `${(mean(times) / 1000 || 0).toFixed(2)} 秒`],
            ['每分钟答对', (correct / (dur / 60)).toFixed(1)],
          ];
          if (kp && buckets.length > 1) metrics.push(['每 15 秒完成量', buckets.join(' / ')]);
          resolve({
            score: correct, metrics,
            level: kp ? null : newLevel,
            note: kp ? '看一下"每 15 秒完成量"：后段明显下降说明持续注意力在衰减。' : levelNote(level, newLevel),
          });
        }
      }, 100);
    });
  },
};

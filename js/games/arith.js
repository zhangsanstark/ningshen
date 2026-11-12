import { h, rand, pick, numpad, mean } from '../ui.js';
import { levelNote } from './common.js';

// 按等级出题，保证结果为非负整数
function makeProblem(level) {
  const L = Math.max(1, Math.min(10, level));
  const ops = [];
  const add = (a, b) => ({ q: `${a} + ${b}`, a: a + b });
  const sub = (a, b) => (a < b ? { q: `${b} − ${a}`, a: b - a } : { q: `${a} − ${b}`, a: a - b });
  const mul = (a, b) => ({ q: `${a} × ${b}`, a: a * b });
  const div = (a, b) => ({ q: `${a * b} ÷ ${a}`, a: b });
  if (L === 1) ops.push(() => add(rand(1, 9), rand(1, 9)));
  if (L >= 2 && L <= 3) ops.push(() => add(rand(1, 9), rand(1, 9)), () => sub(rand(2, 18), rand(1, 9)));
  if (L >= 3 && L <= 5) ops.push(() => add(rand(10, 99), rand(2, 9)), () => sub(rand(20, 99), rand(2, 9)));
  if (L >= 4) ops.push(() => add(rand(11, 89), rand(11, 89)), () => sub(rand(30, 99), rand(11, 29)));
  if (L >= 5) ops.push(() => mul(rand(2, 9), rand(2, 9)));
  if (L >= 6) ops.push(() => div(rand(2, 9), rand(2, 9)));
  if (L >= 7) ops.push(() => mul(rand(11, 49), rand(2, 9)), () => add(rand(100, 899), rand(11, 99)));
  if (L >= 8) ops.push(() => { const a = rand(11, 59), b = rand(11, 39), c = rand(2, 20); return { q: `${a} + ${b} − ${c}`, a: a + b - c }; });
  if (L >= 9) ops.push(() => mul(rand(11, 25), rand(11, 19)), () => div(rand(11, 19), rand(3, 9)));
  if (L >= 10) ops.push(() => sub(rand(300, 999), rand(101, 299)), () => { const a = rand(3, 9), b = rand(3, 9), c = rand(11, 49); return { q: `${a} × ${b} + ${c}`, a: a * b + c }; });
  return pick(ops)();
}

export default {
  id: 'arith',
  name: '限时心算',
  short: '心算', tag: '持续运算', colors: ['#4fd96a', '#c4f24a'], mins: 1,
  dim: '持续注意 · 工作记忆',
  desc: '在限定时间内尽可能多地答对算术题。克雷佩林模式只做相邻两个数字相加，用来观察注意力随时间的波动。',
  howto: [
    '综合心算：题目难度随等级自适应，用键盘或屏幕数字键输入答案，回车确认。',
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
    const level = ctx.level ?? 1;
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
            const avg = mean(times) / 1000;
            if (acc >= 0.9 && correct >= dur / 6 && avg < 5) newLevel = Math.min(10, level + 1);
            else if (acc < 0.7 || correct < dur / 20) newLevel = Math.max(1, level - 1);
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

// 专注计时（番茄钟）：把训练和真实任务连接起来
import { h, ico, chime, barChart } from './ui.js';
import { clockDial } from './figures.js';
import * as S from './store.js';

const PRESETS = [[25, 5], [50, 10], [15, 3]];
const TITLE = '凝神';
const RUN_KEY = 'zzl.focus.run';
const STALE_MS = 12 * 3600e3; // 超过 12 小时的计时不再恢复

// 进行中的计时：{task, planMin, breakMin, kind:'focus'|'break', start, pausedAt, pausedMs, distractions, done?, away?}
// 里面全是绝对时间戳，所以存下来、页面重开后按时钟一算就能接上，不依赖页面一直开着。
let T = loadRun();
let tick = null;
let wakeLock = null;

function loadRun() {
  try {
    const t = JSON.parse(localStorage.getItem(RUN_KEY) || 'null');
    if (!t || typeof t.start !== 'number') return null;
    if (Date.now() - t.start > STALE_MS) { localStorage.removeItem(RUN_KEY); return null; }
    return t;
  } catch { return null; }
}
// 每次状态变化都存一次盘：手机切到别的应用后，浏览器随时可能把页面回收
function persist() {
  try { T ? localStorage.setItem(RUN_KEY, JSON.stringify(T)) : localStorage.removeItem(RUN_KEY); } catch { /* 存不了就只留在内存里 */ }
}
const totalMs = () => (T.kind === 'focus' ? T.planMin : T.breakMin) * 60000;
const remaining = () => {
  if (!T) return 0;
  const now = T.pausedAt ?? Date.now();
  return Math.max(0, totalMs() - (now - T.start - T.pausedMs));
};
const fmt = msv => `${String(Math.floor(msv / 60000)).padStart(2, '0')}:${String(Math.floor(msv / 1000) % 60).padStart(2, '0')}`;
const onFocusPage = () => location.hash.replace(/^#\/?/, '').split('/')[0] === 'focus';

// 页面不在的这段时间里，计时可能已经走完了：按时钟补上结果
function settle() {
  if (!T || T.done || T.pausedAt != null || remaining() > 0) return;
  if (T.kind === 'focus') { T.done = true; T.away = true; T.pausedAt = T.start + T.pausedMs + totalMs(); }
  else T = null; // 休息在离开期间结束了，不用再提示
  persist();
}

async function lock(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* 不支持就算了 */ }
}

// 重画专注页；如果用户此刻在别的页面，就什么都不动
function refresh() {
  if (!onFocusPage()) return;
  const root = document.getElementById('app');
  root.innerHTML = '';
  renderFocus(root, true);
}

function ensureTick() {
  clearInterval(tick);
  tick = setInterval(() => {
    if (!T) { clearInterval(tick); document.title = TITLE; return; }
    if (T.done) { clearInterval(tick); return; }
    const left = remaining();
    document.title = `${fmt(left)} ${T.pausedAt != null ? '已暂停' : T.kind === 'focus' ? '专注中' : '休息中'}`;
    // 专注页的大表盘和首页卡片上的时间用的是同一个 id，在哪一页都会跟着走
    const el = document.getElementById('focus-clock');
    if (el) el.textContent = fmt(left);
    document.getElementById('focus-ring')?.style.setProperty('--p', 1 - left / totalMs());
    if (left <= 0 && T.pausedAt == null) finishPhase();
  }, 250);
}

function finishPhase() {
  chime();
  try { if (Notification?.permission === 'granted') new Notification(T.kind === 'focus' ? '专注完成，休息一下' : '休息结束'); } catch { }
  if (T.kind === 'focus') {
    T.done = true; T.pausedAt = Date.now(); persist();
    // 专注走完时要记录走神次数和自评：不在专注页就带过去
    if (onFocusPage()) refresh(); else location.hash = '#/focus';
  } else {
    T = null; persist(); lock(false); document.title = TITLE;
    refresh();
  }
}

// 启动时调用：把上次没走完的计时接上
export function resumeFocus() {
  settle();
  if (T && !T.done) { ensureTick(); if (T.pausedAt == null) lock(true); }
}

// 给首页用：现在有没有计时在走
export function focusStatus() {
  settle();
  if (!T) return null;
  const state = T.done ? 'done' : T.pausedAt != null ? 'paused' : T.kind;
  return { state, clock: fmt(remaining()), task: T.task };
}

// 表盘：一分钟一格，进度是一圈渐变的光，光头是一颗亮点
const dial = ({ min, p = 0, cls = '', clock, label }) => h('div', { class: `timer ${cls}`, id: 'focus-ring', style: { '--p': p } },
  h('div', { html: clockDial(min) }),
  h('div', { class: 'timer-center' },
    h('div', { id: 'focus-clock', class: 'timer-clock' }, clock),
    h('div', { class: 'timer-label' }, label)));

export function renderFocus(root, still = false) {
  settle();
  root.classList.toggle('still', still);
  const db = S.getDB();
  const today = S.dayKey();
  const todayRecs = db.focus.filter(f => S.dayKey(f.ts) === today);
  const todayMin = Math.round(todayRecs.reduce((a, f) => a + f.actualMin, 0));

  const head = h('section', { class: 'page-head' },
    h('span', { class: 'label' }, '专注计时'),
    h('h1', {}, '把练到的专注，', h('br'), '用在一件', h('span', { class: 'grad' }, '真事'), '上'),
    h('p', {}, '每次结束后记下走神的次数和专注的感受。几周之后对照训练记录，训练有没有用，由你自己判断。'));

  let body;
  if (!T) {
    let plan = Number(localStorage.getItem('zzl.focus.plan') || 25);
    let brk = Number(localStorage.getItem('zzl.focus.break') || 5);
    const task = h('input', { class: 'input', placeholder: '这次要专注做什么？（可选）', maxlength: 60, style: { textAlign: 'center' } });
    const planIn = h('input', { class: 'input num', type: 'number', min: 1, max: 180, value: plan, 'aria-label': '专注分钟' });
    const brkIn = h('input', { class: 'input num', type: 'number', min: 0, max: 60, value: brk, 'aria-label': '休息分钟' });
    const slot = h('div', {}, dial({ min: plan, clock: `${String(plan).padStart(2, '0')}:00`, label: '准备好了就开始' }));
    const valid = () => Math.max(1, Math.min(180, Number(planIn.value) || 25));
    const sync = () => {
      slot.replaceChildren(dial({ min: valid(), clock: `${String(valid()).padStart(2, '0')}:00`, label: '准备好了就开始' }));
      presetRow.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', PRESETS[i][0] === Number(planIn.value) && PRESETS[i][1] === Number(brkIn.value)));
    };
    const presetRow = h('div', { class: 'opts' }, PRESETS.map(([p, b]) => h('button', {
      class: p === plan && b === brk ? 'on' : '',
      onclick: () => { planIn.value = p; brkIn.value = b; sync(); },
    }, `${p} + ${b}`)));
    planIn.addEventListener('input', sync); brkIn.addEventListener('input', sync);
    const begin = () => {
      plan = valid();
      brk = Math.max(0, Math.min(60, Number(brkIn.value) || 0));
      localStorage.setItem('zzl.focus.plan', plan); localStorage.setItem('zzl.focus.break', brk);
      T = { task: task.value.trim(), planMin: plan, breakMin: brk, kind: 'focus', start: Date.now(), pausedAt: null, pausedMs: 0, distractions: 0 };
      persist();
      try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch { }
      lock(true); ensureTick(); refresh();
    };
    task.addEventListener('keydown', e => { if (e.key === 'Enter') begin(); });
    body = h('section', { class: 'tile focus-main' },
      slot,
      h('div', { class: 'focus-form' },
        task,
        presetRow,
        h('div', { class: 'mins' }, '专注', planIn, '分钟', h('span', { style: { width: '10px' } }), '休息', brkIn, '分钟'),
        h('button', { class: 'btn primary lg', onclick: begin }, '开始专注', ico('arrow', 'go'))));
  } else if (T.kind === 'focus' && T.done) {
    // 专注完成：自评
    let rating = 0;
    const stars = h('div', { class: 'rating' }, [1, 2, 3, 4, 5, 6].map(i => h('button', {
      'aria-label': `专注程度 ${i}`,
      onclick: () => { rating = i; stars.querySelectorAll('button').forEach((b, j) => b.classList.toggle('on', j < i)); },
    }, i)));
    const dIn = h('input', { class: 'input num', type: 'number', min: 0, value: T.distractions, 'aria-label': '走神次数' });
    const actual = (T.pausedAt - T.start - T.pausedMs) / 60000;
    const finish = (save, goBreak) => {
      if (save) S.addFocus({ ts: Date.now(), task: T.task, planMin: T.planMin, actualMin: Math.round(actual * 10) / 10, distractions: Number(dIn.value) || 0, rating, completed: true });
      if (save && goBreak && T.breakMin > 0) { T = { ...T, kind: 'break', done: false, away: false, start: Date.now(), pausedAt: null, pausedMs: 0 }; persist(); ensureTick(); }
      else { T = null; persist(); lock(false); document.title = TITLE; }
      refresh();
    };
    body = h('section', { class: 'tile focus-main', style: { paddingTop: '56px', gap: '18px' } },
      h('span', { class: 'label' }, `${Math.max(1, Math.round(actual))} 分钟`),
      h('div', { class: 'done-title' }, '完成了一次', h('span', { class: 'grad' }, '专注')),
      T.task ? h('p', { class: 'muted' }, T.task) : null,
      // 计时是在页面关着的时候走完的：如实说明，记不记由用户定
      T.away ? h('p', { class: 'small muted' }, '计时在你离开这个页面的时候走完了。如果那段时间其实没在专注，可以不记这一次。') : null,
      h('p', { class: 'small muted', style: { marginTop: '14px' } }, '这段时间有多专注？1 很分散，6 非常专注'),
      stars,
      h('div', { class: 'mins', style: { display: 'flex', alignItems: 'center', gap: '10px' } }, h('span', { class: 'muted small' }, '走神了'), dIn, h('span', { class: 'muted small' }, '次')),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginTop: '16px' } },
        T.breakMin > 0 ? h('button', { class: 'btn primary lg', onclick: () => finish(true, true) }, `保存，休息 ${T.breakMin} 分钟`) : null,
        h('button', { class: `btn lg ${T.breakMin > 0 ? '' : 'primary'}`, onclick: () => finish(true, false) }, '保存'),
        h('button', { class: 'btn lg', onclick: () => { if (confirm('不记这一次？这次专注不会进入记录。')) finish(false, false); } }, '不记这次')));
  } else {
    const isFocus = T.kind === 'focus';
    const paused = T.pausedAt != null;
    const min = isFocus ? T.planMin : T.breakMin;
    body = h('section', { class: 'tile focus-main' },
      dial({
        min, p: 1 - remaining() / (min * 60000), cls: `${isFocus ? '' : 'rest'} ${paused ? 'paused' : ''}`, clock: fmt(remaining()),
        label: paused ? '已暂停' : isFocus ? (T.task || '专注中') : '起来走走，看看远处',
      }),
      isFocus ? h('button', {
        class: 'btn distract', onclick: e => { T.distractions++; persist(); e.currentTarget.querySelector('b').textContent = T.distractions; },
      }, '我走神了，记一次', h('b', {}, T.distractions)) : null,
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' } },
        isFocus ? h('button', {
          class: 'btn sm', onclick: () => {
            if (paused) { T.pausedMs += Date.now() - T.pausedAt; T.pausedAt = null; } else T.pausedAt = Date.now();
            persist(); refresh();
          },
        }, paused ? '继续' : '暂停') : null,
        isFocus ? h('button', {
          class: 'btn sm', onclick: () => { T.pausedAt = T.pausedAt ?? Date.now(); T.done = true; persist(); refresh(); },
        }, '提前完成') : null,
        h('button', {
          class: 'btn sm', onclick: () => {
            if (isFocus && !confirm('放弃这次专注？不会保存记录。')) return;
            T = null; persist(); lock(false); document.title = TITLE; refresh();
          },
        }, isFocus ? '放弃' : '跳过休息')));
    ensureTick();
  }

  // 近 14 天专注分钟
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = S.dayKey(d);
    days.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, now: i === 0, value: Math.round(db.focus.filter(f => S.dayKey(f.ts) === k).reduce((a, f) => a + f.actualMin, 0)) });
  }
  const recent = db.focus.slice(-6).reverse();
  // 表盘是这一页的主角，放在左边从顶上开始；标题和记录在右边
  const side = h('aside', { class: 'focus-side' },
    head,
    h('section', { class: 'tile' },
      h('div', { class: 'tile-head' }, h('h3', {}, '近 14 天'), h('span', { class: 'muted small' }, `今日 ${todayRecs.length} 次 · ${todayMin} 分钟`)),
      barChart(days, { unit: ' 分钟' })),
    h('section', { class: 'tile' },
      h('div', { class: 'tile-head' }, h('h3', {}, '最近记录')),
      recent.length ? h('table', { class: 'tbl' },
        h('tr', {}, h('th', {}, '时间'), h('th', {}, '任务'), h('th', {}, '时长'), h('th', {}, '走神'), h('th', {}, '自评')),
        recent.map(f => h('tr', {},
          h('td', { class: 'muted' }, new Date(f.ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })),
          h('td', {}, f.task || '—'), h('td', { class: 'num' }, `${f.actualMin}′`), h('td', { class: 'num' }, f.distractions), h('td', { class: 'num' }, f.rating || '—'))))
        : h('p', { class: 'muted' }, '还没有专注记录。第一次不用太长，15 分钟就好。')));

  root.append(h('div', { class: 'focus' }, body, side));
}

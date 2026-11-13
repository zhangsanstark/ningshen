import { h, ico, fmtScore, fmtNum, lineChart, sparkline, heatmap, beep, chime, tick, setSound, clamp, mean, countUp } from './ui.js';
import { icon } from './art.js';
import { figure, todayRings } from './figures.js';
import * as S from './store.js';
import { renderFocus, resumeFocus, focusStatus } from './focus.js';
import schulte from './games/schulte.js';
import stroop from './games/stroop.js';
import sart from './games/sart.js';
import nback from './games/nback.js';
import mot from './games/mot.js';
import arith from './games/arith.js';
import breath from './games/breath.js';

// 七项训练：每个注意力维度留一项最有代表性的
export const GAMES = [schulte, stroop, sart, nback, mot, arith, breath];
const byId = Object.fromEntries(GAMES.map(g => [g.id, g]));
const app = document.getElementById('app');
setSound(S.settings().sound);

// ---------- 明暗主题（默认深色） ----------
const THEME_NAME = { dark: '深色', light: '浅色', auto: '跟随系统' };
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const themeBtn = document.getElementById('theme-btn');
function applyTheme() {
  const t = S.settings().theme || 'dark';
  const eff = t === 'auto' ? (darkQuery.matches ? 'dark' : 'light') : t;
  document.documentElement.dataset.theme = eff;
  document.querySelector('meta[name="theme-color"]').content = eff === 'dark' ? '#07080d' : '#eef0f8';
  themeBtn.innerHTML = `<span class="ico">${icon(t === 'auto' ? 'auto' : t === 'dark' ? 'moon' : 'sun')}</span>`;
  themeBtn.title = `外观：${THEME_NAME[t]}`;
}
darkQuery.addEventListener('change', applyTheme);
themeBtn.addEventListener('click', () => {
  const order = ['dark', 'light', 'auto'];
  S.setSetting('theme', order[(order.indexOf(S.settings().theme || 'dark') + 1) % 3]);
  applyTheme();
});
applyTheme();

// ---------- 每日训练计划 ----------
// 结构：舒尔特热身 + 3 项核心（5 选 3，五天内每项各出现 3 次）+ 呼吸计数收尾
const CORE = ['stroop', 'nback', 'sart', 'mot', 'arith'];
export function makePlan(date) {
  const day = Math.floor(Date.parse(`${date}T00:00:00`) / 864e5);
  return ['schulte', ...[0, 2, 4].map(k => CORE[(day + k) % CORE.length]), 'breath'];
}
// 今日训练进行到第几项：存在本地。手机切到别的应用后浏览器可能把页面回收，回来要能接上
const RUN_KEY = 'zzl.daily.run';
let dailyRun = null; // {date, queue:[ids], idx}
function setRun(v) {
  dailyRun = v;
  try { v ? localStorage.setItem(RUN_KEY, JSON.stringify(v)) : localStorage.removeItem(RUN_KEY); } catch { /* 存不了就只留在内存里 */ }
}
function restoreRun() {
  let r = null;
  try { r = JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); } catch { }
  const today = S.dayKey();
  if (!r || r.date !== today || !Array.isArray(r.queue) || !r.queue.every(id => byId[id])) return setRun(null);
  // 只在训练介绍页上接着走；停在首页或别的页面，说明这一轮已经放下了
  if (location.hash.replace(/^#\/?/, '').split('/')[0] !== 'game') return setRun(null);
  // 跳过已经练完的：比如刚做完一项、还没点「下一项」页面就没了
  const done = new Set(S.daily(today, makePlan).done);
  while (r.idx < r.queue.length && done.has(r.queue[r.idx])) r.idx++;
  if (r.idx >= r.queue.length) { setRun(null); history.replaceState(null, '', '#/'); return; }
  setRun(r);
  history.replaceState(null, '', `#/game/${r.queue[r.idx]}`);
}

// ---------- 路由 ----------
function route() {
  const [page, arg] = location.hash.replace(/^#\/?/, '').split('/');
  const navPage = page === 'game' ? 'home' : (page || 'home');
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.page === navPage));
  app.innerHTML = '';
  app.classList.remove('still');
  window.scrollTo(0, 0);
  if (page === 'game' && byId[arg]) renderIntro(byId[arg]);
  else if (page === 'stats') renderStats();
  else if (page === 'focus') renderFocus(app);
  else if (page === 'about') renderAbout();
  else { setRun(null); renderHome(); }
}
window.addEventListener('hashchange', route);

const variantOf = (g, o) => (g.variant ? g.variant(o) : '');
const levelOn = (g, o) => g.level && (!g.level.applies || g.level.applies(o));
const levelLabel = (g, v) => (g.level.label ? g.level.label(v) : `第 ${v} 级`);
const scoreNode = (g, v) => (v == null ? '—' : [fmtNum(g, v), g.score.unit ? h('small', {}, g.score.unit) : null]);
const col = g => ({ '--c1': g.colors[0], '--c2': g.colors[1] }); // 这项训练的一对颜色
const go = () => ico('arrow', 'go');
const minsText = m => `${Number.isInteger(m) ? m : m.toFixed(1)} 分钟`;

// 本周（周一到周日）哪几天练过：用「每周目标天数」代替连续打卡
function weekInfo() {
  const act = S.activity();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const mon = new Date(today); mon.setDate(mon.getDate() - ((today.getDay() + 6) % 7));
  const days = [...'一二三四五六日'].map((label, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    return { label, on: !!act[S.dayKey(d)], today: +d === +today, future: d > today };
  });
  return { days, count: days.filter(d => d.on).length };
}

// ---------- 首页 ----------
function renderHome() {
  const today = S.dayKey();
  const plan = S.daily(today, makePlan);
  const ids = plan.plan.filter(id => byId[id]);
  const done = new Set(plan.done);
  const left = ids.filter(id => !done.has(id));
  const nextId = left[0];
  const goal = S.settings().weekGoal || 5;
  const wk = weekInfo();
  const mins = list => Math.max(1, Math.round(list.reduce((a, id) => a + byId[id].mins, 0)));
  const planMin = Number(localStorage.getItem('zzl.focus.plan') || 25);
  const focusToday = S.getDB().focus.filter(f => S.dayKey(f.ts) === today);

  const now = new Date(), hr = now.getHours();
  const hello = hr < 5 ? '夜深了' : hr < 11 ? '早上好' : hr < 13 ? '中午好' : hr < 18 ? '下午好' : '晚上好';
  const start = () => {
    setRun({ date: today, queue: left, idx: 0 });
    location.hash = `#/game/${dailyRun.queue[0]}`;
  };

  const todayTile = h('section', { class: 'tile today' },
    h('div', {},
      h('span', { class: 'label' }, '今日训练'),
      h('h2', {}, !left.length ? '五项，全部点亮' : [left.length < ids.length ? '还剩' : '今天', h('b', { class: 'grad' }, mins(left)), '分钟']),
      h('div', { class: 'steps' }, ids.map((id, i) => {
        const g = byId[id], isDone = done.has(id);
        return h('a', { class: isDone ? 'done' : id === nextId ? 'next' : '', href: `#/game/${id}`, style: col(g) },
          h('span', { class: 'dot' }),
          h('span', { class: 'nm' }, g.name, h('small', {}, i === 0 ? '热身' : i === ids.length - 1 ? '收尾' : g.tag)),
          h('span', { class: 'min' }, minsText(g.mins)),
          h('span', { class: 'st', html: isDone ? icon('check') : '' }));
      })),
      h('div', { class: 'cta' },
        left.length
          ? [h('button', { class: 'btn primary lg', onclick: start }, left.length < ids.length ? '继续今日训练' : '开始今日训练', go()),
            h('span', { class: 'aside' }, '每项之间可以停，中途退出不计成绩')]
          : [h('a', { class: 'btn primary lg', href: '#/focus' }, '开一个专注计时', go()),
            h('span', { class: 'aside' }, '训练是手段，真事才是目的')])),
    h('div', { class: 'today-rings', html: todayRings(ids.map(id => ({ c1: byId[id].colors[0], c2: byId[id].colors[1], done: done.has(id) }))) }));

  // 有计时在走时，这张卡片显示实时剩余时间（id 和专注页的表盘相同，由 focus.js 的计时器更新）
  const fs = focusStatus();
  const FS_LABEL = { focus: '正在专注', break: '休息中', paused: '已暂停', done: '等你记录' };
  const focusTile = h('a', { class: 'tile focus-tile', href: '#/focus' },
    h('span', { class: 'label' }, fs ? `专注计时 · ${FS_LABEL[fs.state]}` : '专注计时'),
    h('div', { class: 'clock grad', id: fs && fs.state !== 'done' ? 'focus-clock' : null }, !fs ? `${planMin}:00` : fs.state === 'done' ? '完成' : fs.clock),
    h('p', {}, !fs ? '把练到的专注，用在一件真事上。计时、记下走神的次数，自己检验训练有没有用。'
      : fs.state === 'done' ? '这次专注走完了，去记一下走神次数和感受。'
        : fs.task ? `正在做：${fs.task}` : '计时正在走。点这里回到计时页。'),
    h('div', { class: 'row' },
      h('span', {}, focusToday.length ? `今日 ${focusToday.length} 次 · ${Math.round(focusToday.reduce((a, f) => a + f.actualMin, 0))} 分钟` : '今天还没有专注记录'),
      h('span', { class: 'link' }, fs ? '回到计时' : '去专注', ico('arrow'))));

  const weekTile = h('div', { class: 'tile week-tile', title: '每周目标天数：允许请假，不必天天练' },
    h('div', {}, h('span', { class: 'label' }, '本周训练'), h('b', {}, wk.count, h('small', {}, `/ ${goal} 天`))),
    h('div', { class: 'days' }, wk.days.map(d => h('div', { class: `day${d.on ? ' on' : ''}${d.today ? ' now' : ''}${d.future ? ' later' : ''}` }, h('i'), d.label))));

  const games = h('section', { class: 'games' },
    GAMES.map(g => {
      const list = S.sessions(g.id, variantOf(g, S.getOpts(g)));
      const best = S.bestOf(list, g.score.better);
      return h('a', { class: 'tile gtile', href: `#/game/${g.id}`, style: col(g) },
        h('div', { class: 'gtile-art', html: figure(g.id) }),
        h('h3', {}, g.name),
        h('p', {}, g.dim),
        h('div', { class: 'gtile-foot' },
          best != null ? h('div', {}, '个人最佳', h('b', { class: 'grad' }, scoreNode(g, best))) : h('span', { class: 'new grad' }, '还没练过'),
          list.length > 1 ? sparkline(list.slice(-12).map(s => s.score)) : null));
    }),
    h('a', { class: 'tile promise', href: '#/about' },
      h('p', {}, '只承诺一件事：', h('br'), '练什么，就在什么上', h('span', { class: 'grad' }, '进步'), '。'),
      h('span', { class: 'link' }, '为什么这么说', ico('arrow'))));

  app.append(
    h('section', { class: 'hello' },
      h('h1', {}, `${hello}。`, !left.length ? '今天练完了' : left.length < ids.length ? '接着练' : '该练专注了'),
      h('span', {}, now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }))),
    h('section', { class: 'bento' }, todayTile, h('div', { class: 'side' }, focusTile, weekTile)),
    h('div', { class: 'sec-title' }, h('h2', {}, '七项训练'), h('span', {}, '只和自己比，看趋势，不看单次')),
    games,
    h('footer', { class: 'foot' }, h('span', {}, '数据只存在这台设备'), h('span', {}, '没有广告'), h('span', {}, '没有连续打卡')));
}

// ---------- 训练介绍页 ----------
function renderIntro(game) {
  const opts = S.getOpts(game);
  const inDaily = dailyRun && dailyRun.queue[dailyRun.idx] === game.id;
  const root = h('div', { style: col(game) });
  const draw = () => {
    const variant = variantOf(game, opts);
    const list = S.sessions(game.id, variant);
    const best = S.bestOf(list, game.score.better);
    const lkey = `${game.id}:${variant}`;
    const lv = levelOn(game, opts) ? S.getLevel(lkey, game.level.def) : null;
    const optRows = (game.options || []).map(opt => h('div', { class: 'opt-row' },
      h('span', { class: 'lab' }, opt.label),
      h('div', { class: 'opts' }, opt.choices.map(([v, l]) => h('button', {
        class: opts[opt.key] === v ? 'on' : '',
        onclick: () => { opts[opt.key] = v; S.setOpts(game.id, { ...opts }); draw(); },
      }, l)))));
    if (lv != null) { // 难度平时按表现自动调；想直接换一档，在这里自己改
      const L = game.level;
      const step = dir => {
        S.setLevel(lkey, L.float ? clamp(lv * (dir > 0 ? 1.12 : 1 / 1.12), L.min, L.max) : clamp(lv + dir, L.min, L.max));
        draw();
      };
      optRows.push(h('div', { class: 'opt-row' },
        h('span', { class: 'lab' }, '难度'),
        h('div', { class: 'opts stepper', title: '会按表现自动调整，也可以自己改' },
          h('button', { 'aria-label': '降低难度', disabled: lv <= L.min, onclick: () => step(-1) }, '−'),
          h('span', {}, levelLabel(game, lv)),
          h('button', { 'aria-label': '提高难度', disabled: lv >= L.max, onclick: () => step(1) }, '+'))));
    }
    const recent = list.slice(-20).map(s => s.score);
    root.replaceChildren(
      h('div', { class: 'crumb' },
        h('a', { href: '#/' }, ico('back'), inDaily ? '结束今日训练，回到首页' : '全部训练'),
        inDaily ? h('span', {}, `今日训练 ${dailyRun.idx + 1} / ${dailyRun.queue.length}`) : null),
      h('section', { class: 'tile intro-hero' },
        h('div', {},
          h('span', { class: 'chip' }, game.dim),
          h('h1', {}, game.name),
          h('p', { class: 'desc' }, game.desc),
          h('div', { class: 'start' },
            h('button', { class: 'btn primary lg', onclick: () => play(game, { ...opts }) }, inDaily ? '开始这一项' : '开始训练', go()),
            inDaily ? h('button', { class: 'btn lg', onclick: () => nextDaily(game.id, true) }, '跳过') : null,
            h('span', { class: 'hint' }, '3 秒倒计时后开始 · 按 Esc 随时退出'))),
        h('div', { class: 'intro-art', html: figure(game.id) })),
      h('div', { class: 'intro-grid' },
        h('div', {},
          h('section', { class: 'tile' }, h('h3', {}, '怎么玩'), h('ol', { class: 'method' }, game.howto.map(t => h('li', {}, h('span', {}, t))))),
          optRows.length ? h('section', { class: 'tile' }, h('h3', {}, '设置'), optRows) : null),
        h('div', {},
          h('section', { class: 'tile record' }, h('h3', {}, '你的记录'),
            h('div', { class: 'kv' },
              h('div', {}, h('span', {}, `最佳${game.score.label}`), h('b', { class: 'grad' }, scoreNode(game, best))),
              h('div', {}, h('span', {}, '练习次数'), h('b', {}, list.length)),
              lv != null ? h('div', {}, h('span', {}, '当前难度'), h('b', {}, levelLabel(game, lv))) : null),
            recent.length > 1 ? lineChart(recent, { better: game.score.better, height: 160 })
              : h('p', { class: 'empty' }, recent.length ? '再练一次，这里就会出现你的走势。' : '第一次的成绩会成为你的基线，之后只和它比。')))));
  };
  draw();
  app.append(root);
}

function nextDaily(id, skipped = false) {
  if (!dailyRun) return;
  if (!skipped) S.markDailyDone(dailyRun.date, id);
  dailyRun.idx++;
  if (dailyRun.idx >= dailyRun.queue.length) { setRun(null); location.hash = '#/'; return; }
  setRun(dailyRun);
  const next = dailyRun.queue[dailyRun.idx];
  if (location.hash === `#/game/${next}`) route(); else location.hash = `#/game/${next}`;
}

// ---------- 训练运行 ----------
let wakeLock = null;
async function play(game, opts) {
  const variant = variantOf(game, opts);
  const lkey = `${game.id}:${variant}`;
  const useLevel = levelOn(game, opts);
  const level = useLevel ? S.getLevel(lkey, game.level.def) : null;
  const ac = new AbortController();
  const timers = new Set(), intervals = new Set(), keyFns = [];
  let rafId = null, pending = null;

  const status = h('span', { class: 'stage-status' });
  const bar = h('i');
  const body = h('div', { class: 'stage-body' });
  const quit = () => { ac.abort(); close(); };
  const overlay = h('div', { class: 'stage', style: col(game) },
    h('header', { class: 'stage-top' },
      h('div', { class: 'stage-title' }, h('i'), h('span', {}, game.name), level != null ? h('small', {}, levelLabel(game, level)) : null),
      status,
      h('button', { class: 'link-btn', title: '退出（Esc）', onclick: quit }, '退出', h('span', { class: 'kbd' }, 'Esc'))),
    h('div', { class: 'stage-progress' }, bar),
    body);

  const cleanup = () => {
    timers.forEach(clearTimeout); intervals.forEach(clearInterval);
    if (rafId) cancelAnimationFrame(rafId);
    keyFns.forEach(f => window.removeEventListener('keydown', f));
    keyFns.length = 0;
    try { speechSynthesis.cancel(); } catch { }
    if (pending) { clearTimeout(pending.tid); pending = null; }
  };
  const close = () => {
    cleanup(); overlay.remove(); document.body.classList.remove('playing');
    try { wakeLock?.release(); } catch { } wakeLock = null;
    window.removeEventListener('keydown', escFn);
  };
  const escFn = e => { if (e.key === 'Escape') quit(); };
  window.addEventListener('keydown', escFn);

  const abortErr = () => Object.assign(new Error('aborted'), { name: 'AbortError' });
  const ctx = {
    stage: body, opts, level, signal: ac.signal,
    history: S.sessions(game.id, variant),
    setStatus: t => { status.textContent = t; },
    setProgress: p => { bar.style.setProperty('--p', clamp(p, 0, 1)); },
    wait: msv => new Promise((res, rej) => {
      if (ac.signal.aborted) return rej(abortErr());
      const id = setTimeout(() => { timers.delete(id); ac.signal.aborted ? rej(abortErr()) : res(); }, msv);
      timers.add(id);
    }),
    timeout: (fn, msv) => { const id = setTimeout(() => { timers.delete(id); fn(); }, msv); timers.add(id); return id; },
    interval: (fn, msv) => { const id = setInterval(fn, msv); intervals.add(id); return id; },
    raf: fn => { rafId = requestAnimationFrame(t => { rafId = null; if (!ac.signal.aborted) fn(t); }); },
    onKey: fn => { const f = e => { if (e.repeat) return; fn(e); }; keyFns.push(f); window.addEventListener('keydown', f); },
    // 反应类任务：等待一次按键响应，超时返回 null
    response: timeout => new Promise((res, rej) => {
      if (ac.signal.aborted) return rej(abortErr());
      const t0 = performance.now();
      const tid = setTimeout(() => { pending = null; res(null); }, timeout);
      pending = { res, t0, tid };
    }),
    press: key => {
      if (!pending) return;
      const p = pending; pending = null; clearTimeout(p.tid);
      p.res({ key, rt: performance.now() - p.t0 });
    },
    beep: ok => beep(ok), chime,
  };

  document.body.append(overlay);
  document.body.classList.add('playing');
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch { }

  const aborted = new Promise((_, rej) => ac.signal.addEventListener('abort', () => rej(abortErr())));
  aborted.catch(() => { });
  try {
    // 3-2-1 倒计时
    const cd = h('div', { class: 'countdown' });
    body.append(cd);
    for (const n of ['3', '2', '1']) { cd.replaceChildren(h('i'), h('b', {}, n)); tick(); await ctx.wait(650); }
    cd.remove();
    const t0 = Date.now();
    const res = await Promise.race([game.run(ctx), aborted]);
    cleanup();
    if (!res) { close(); return; }
    const prev = S.sessions(game.id, variant);
    const prevBest = S.bestOf(prev, game.score.better);
    const rec = {
      game: game.id, variant, ts: Date.now(), score: res.score, level,
      metrics: res.metrics, durationMs: Date.now() - t0,
    };
    S.addSession(rec);
    if (useLevel && res.level != null) {
      const L = game.level;
      S.setLevel(lkey, L.float ? clamp(res.level, L.min, L.max) : clamp(Math.round(res.level), L.min, L.max));
    }
    // 只要练的是今日计划里的项目，就算完成（不必非从「开始今日训练」进入）
    const today = S.dayKey();
    if (S.daily(today, makePlan).plan.includes(game.id)) S.markDailyDone(today, game.id);
    status.textContent = ''; ctx.setProgress(1);
    showResult(game, opts, rec, prev, prevBest, res, body, close);
  } catch (e) {
    if (e?.name !== 'AbortError') {
      console.error(e);
      cleanup();
      body.replaceChildren(h('div', { class: 'center-col' }, h('p', {}, `出错了：${e.message}`), h('button', { class: 'btn', onclick: close }, '关闭')));
    }
  }
}

function showResult(game, opts, rec, prev, prevBest, res, body, close) {
  const better = game.score.better;
  const isPB = prev.length > 0 && (better === 'lower' ? rec.score < prevBest : rec.score > prevBest);
  // 以个人基线为参照：前 3 次中位数 vs 最近 3 次（含本次）
  const all = [...prev, rec].map(s => s.score);
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : null; };
  let baseline = null;
  if (all.length >= 6) {
    const b0 = med(all.slice(0, 3)), b1 = med(all.slice(-3));
    const ch = b0 ? ((b1 - b0) / Math.abs(b0)) * 100 * (better === 'lower' ? -1 : 1) : 0;
    baseline = `最近 3 次的中位数是 ${fmtScore(game, b1)}，比最初 3 次${ch >= 0 ? '进步' : '退步'}了 ${Math.abs(ch).toFixed(0)}%。`;
  }
  // 在最近 30 次中的百分位
  const last30 = all.slice(-30);
  const rank = last30.filter(v => (better === 'lower' ? v > rec.score : v < rec.score)).length;
  const pctl = last30.length >= 5 ? Math.round((rank / (last30.length - 1)) * 100) : null;
  if (isPB) chime();

  const inDaily = dailyRun && dailyRun.queue[dailyRun.idx] === game.id;
  const isLast = inDaily && dailyRun.idx === dailyRun.queue.length - 1;
  const scoreEl = h('span');
  const notes = [res.note, pctl != null ? `这次超过了你最近 ${last30.length} 次里 ${pctl}% 的成绩。` : null, baseline].filter(Boolean);

  body.replaceChildren(h('div', { class: 'result' },
    h('div', { class: 'result-head' },
      isPB ? h('div', { class: 'halo' }, h('i'), h('i'), h('i')) : null, // 破纪录：几圈光从分数后面荡开
      h('span', { class: 'label' }, game.score.label),
      h('div', { class: 'result-score' }, scoreEl, game.score.unit ? h('small', {}, game.score.unit) : null),
      isPB ? h('div', { class: 'badge pb' }, ico('spark'), `新的个人最佳 · 之前是 ${fmtScore(game, prevBest)}`)
        : prevBest != null ? h('div', { class: 'badge' }, `个人最佳 ${fmtScore(game, prevBest)}`)
          : h('div', { class: 'badge' }, '第一次记录 · 这就是你的基线')),
    (res.metrics || []).length ? h('div', { class: 'metrics' }, res.metrics.map(([k, v]) => h('div', { class: 'metric' }, h('span', {}, k), h('b', {}, v)))) : null,
    notes.length ? h('div', { class: 'tile note' }, h('b', { class: 'grad' }, '读懂这组数'), notes.map(t => h('p', {}, t))) : null,
    all.length > 1 ? h('div', { class: 'tile' }, lineChart(all.slice(-20), { better, height: 130 })) : null,
    h('div', { class: 'result-actions' },
      inDaily ? h('button', { class: 'btn primary lg', onclick: () => { close(); nextDaily(game.id); } }, isLast ? '完成今日训练' : '下一项', go()) : null,
      h('button', { class: `btn lg ${inDaily ? '' : 'primary'}`, onclick: () => { close(); play(game, opts); } }, ico('redo'), '再来一次'),
      h('button', { class: 'btn lg', onclick: () => { close(); if (inDaily) setRun(null); route(); } }, inDaily ? '结束今日训练' : '返回'))));
  countUp(scoreEl, rec.score, v => fmtNum(game, v));
}

// ---------- 记录 ----------
function renderStats() {
  const db = S.getDB();
  const known = db.sessions.filter(s => byId[s.game]);
  const totalMin = known.reduce((a, s) => a + (s.durationMs || 0), 0) / 60000;
  const focusMin = db.focus.reduce((a, f) => a + f.actualMin, 0);
  const dur = m => (m < 60 ? [Math.round(m), h('small', {}, '分钟')] : [(m / 60).toFixed(1), h('small', {}, '小时')]);
  const stat = (v, l) => h('div', { class: 'tile stat' }, h('b', { class: 'grad' }, v), h('span', {}, l));
  const opts = (choices, cur, on) => h('div', { class: 'opts' }, choices.map(([v, l]) => h('button', {
    class: cur === v ? 'on' : '', onclick: e => { on(v); e.currentTarget.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget)); },
  }, l)));

  const recs = GAMES.map(g => {
    const list = S.sessions(g.id);
    if (!list.length) return null;
    return h('section', { class: 'tile rec', style: col(g) },
      h('a', { class: 'rec-title', href: `#/game/${g.id}` }, h('i'), g.name),
      [...new Set(list.map(s => s.variant))].map(v => {
        const vl = list.filter(s => s.variant === v);
        return h('div', { class: 'variant' },
          h('div', { class: 'mode' }, v ? `${g.dim} · ${v}` : g.dim),
          h('div', { class: 'kv' },
            h('div', {}, h('span', {}, '次数'), h('b', {}, vl.length)),
            h('div', {}, h('span', {}, '最佳'), h('b', { class: 'grad' }, scoreNode(g, S.bestOf(vl, g.score.better)))),
            h('div', {}, h('span', {}, '近 7 次均值'), h('b', {}, scoreNode(g, mean(vl.slice(-7).map(s => s.score)))))),
          vl.length > 1 ? lineChart(vl.slice(-40).map(s => s.score), { better: g.score.better, height: 130 }) : null);
      }));
  }).filter(Boolean);

  // 真实专注：把专注计时的走神次数和训练放在同一页，自己看两者有没有关系
  const fr = db.focus.slice(-30);
  const real = h('section', { class: 'tile' },
    h('div', { class: 'tile-head' }, h('h3', {}, '真实专注'), h('span', { class: 'muted small' }, '来自专注计时，走神越少越好')),
    fr.length ? [
      h('div', { class: 'kv' },
        h('div', {}, h('span', {}, '平均每次走神'), h('b', {}, mean(fr.map(f => f.distractions || 0)).toFixed(1), h('small', {}, '次'))),
        h('div', {}, h('span', {}, '平均自评（1–6）'), h('b', {}, fr.some(f => f.rating) ? mean(fr.filter(f => f.rating).map(f => f.rating)).toFixed(1) : '—')),
        h('div', {}, h('span', {}, '平均时长'), h('b', {}, Math.round(mean(fr.map(f => f.actualMin))), h('small', {}, '分钟')))),
      fr.length > 1 ? h('div', { style: { marginTop: '18px' } }, lineChart(fr.map(f => f.distractions || 0), { better: 'lower', height: 130 })) : null,
    ] : h('p', { class: 'muted' }, '还没有专注记录。训练之后开一个专注计时，几周后回来看这条线有没有往下走。'));

  const fileIn = h('input', {
    type: 'file', accept: '.json,application/json', style: { display: 'none' }, onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      try { S.importData(await f.text()); setSound(S.settings().sound); applyTheme(); alert('导入成功'); route(); } catch (err) { alert(`导入失败：${err.message}`); }
    },
  });
  const setRow = (title, sub, ctrl) => h('div', { class: 'set-row' }, h('div', {}, h('b', {}, title), sub ? h('small', {}, sub) : null), ctrl);
  // 每日提醒和桌面小组件：只有安卓 App 里有（由 App 的外壳 NingshenShell 提供），网页版没有这两行
  const host = window.NingshenShell;
  let remindRow = null;
  const widgetRow = host && host.widgetPin
    ? setRow('桌面小组件', '把「今日五环」放到手机桌面上，点一下接着练', h('button', { class: 'btn sm', onclick: () => host.widgetPin() }, '添加到桌面'))
    : null;
  if (host && host.reminderGet) {
    const cur = JSON.parse(host.reminderGet()); // {on, time}
    let on = !!cur.on;
    const timeIn = h('input', { class: 'input num', type: 'time', value: cur.time, 'aria-label': '提醒时间', style: { width: '120px' } });
    timeIn.addEventListener('change', () => { if (on) host.reminderSet(true, timeIn.value || cur.time); });
    remindRow = setRow('每日提醒', '到点提醒今天还没练的训练。练完了就不提醒，也不记连续天数',
      h('div', { class: 'row' }, timeIn, opts([[true, '开'], [false, '关']], on, v => { on = v; host.reminderSet(v, timeIn.value || cur.time); })));
  }

  app.append(
    h('section', { class: 'page-head' },
      h('span', { class: 'label' }, '记录'),
      h('h1', {}, '只和', h('span', { class: 'grad' }, '自己'), '比'),
      h('p', {}, '看趋势，不看单次；状态差的日子分数低很正常。所有数据只保存在这台设备的浏览器里。')),
    h('section', { class: 'stats-row' },
      stat(known.length, '训练次数'), stat(dur(totalMin), '训练时长'), stat(db.focus.length, '专注次数'), stat(dur(focusMin), '专注时长')),
    h('section', { class: 'cols2' },
      h('section', { class: 'tile' },
        h('div', { class: 'tile-head' }, h('h3', {}, '活跃日历'), h('span', { class: 'muted small' }, `本周 ${weekInfo().count} / ${S.settings().weekGoal || 5} 天`)),
        heatmap(S.activity())),
      real),
    recs.length ? h('section', { class: 'recs' }, recs)
      : h('section', { class: 'tile', style: { marginTop: '18px' } }, h('p', { class: 'muted' }, '还没有训练记录。先去完成一次今日训练，这里会长出你的走势。')),
    h('section', { class: 'tile settings' },
      h('h3', {}, '设置与数据'),
      setRow('每周目标', '用目标天数代替连续打卡，允许请假', opts([3, 4, 5, 6, 7].map(n => [n, `${n} 天`]), S.settings().weekGoal || 5, v => S.setSetting('weekGoal', v))),
      setRow('外观', null, opts([['dark', '深色'], ['light', '浅色'], ['auto', '跟随系统']], S.settings().theme || 'dark', v => { S.setSetting('theme', v); applyTheme(); })),
      setRow('音效', '答对、答错和倒计时的提示音', opts([[true, '开'], [false, '关']], !!S.settings().sound, v => { S.setSetting('sound', v); setSound(v); })),
      remindRow,
      widgetRow,
      setRow('备份', '导出为 JSON 文件，可在别的设备导入', h('div', { class: 'row' },
        h('button', {
          class: 'btn sm', onclick: () => {
            const blob = new Blob([S.exportData()], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: `凝神-训练数据-${S.dayKey()}.json` });
            document.body.append(a); a.click(); a.remove();
          },
        }, ico('download'), '导出'),
        h('button', { class: 'btn sm', onclick: () => fileIn.click() }, ico('upload'), '导入'), fileIn,
        h('button', { class: 'btn sm danger', onclick: () => { if (confirm('确定清空全部训练和专注记录？此操作不可撤销。建议先导出备份。')) { S.clearAll(); applyTheme(); route(); } } }, ico('trash'), '清空')))));
}

// ---------- 说明 ----------
function renderAbout() {
  const what = {
    schulte: '在一片干扰里找到目标，训练视觉搜索。每天的热身。',
    stroop: '忽略字义、只看颜色。高等级加入规则反转，同时练到「切换」。',
    sart: '单调、快节奏，看到 3 忍住不按。误按次数是走神最直接的痕迹。',
    nback: '记住 N 步之前的位置并不断更新，工作记忆的经典任务。',
    mot: '同时盯住几个运动的目标，把注意力分给多处。',
    arith: '限时口算。克雷佩林模式能看到注意力随时间的衰减。',
    breath: '数呼吸，练的是「发现自己走神了」这件事本身。',
  };
  const li = (...kids) => h('li', {}, h('span', {}, kids));
  app.append(
    h('section', { class: 'page-head' },
      h('span', { class: 'label' }, '说明'),
      h('h1', {}, '能期待什么，不能期待什么'),
      h('p', {}, '这些训练都来自经典的注意力测验范式。下面是它们各自练什么，以及科学上站得住的说法。')),
    h('div', { class: 'essay' },
      h('div', {},
        h('section', { class: 'tile' },
          h('p', { class: 'quote' }, '练什么，就在什么上', h('span', { class: 'grad' }, '进步'), '。', h('br'), '别的，要你自己去验证。'),
          h('ul', { class: 'prose' },
            li('可靠的结论是：多次练习后，你在这些任务上会更快、更准。'),
            li('「在任务上变强」能不能迁移到工作和学习里的专注，多项大型元分析的结论是证据很弱，远迁移接近零。'),
            li('正念、呼吸类练习在研究中显示对注意力有小幅帮助。'),
            li('所以这里把', h('b', {}, '专注计时'), '放在和训练同等的位置：在真实任务里专注，并记下走神次数，由你自己检验有没有用。'),
            li('舒尔特方格网上流传的「年龄标准」没有可靠出处，这里只和你自己的历史成绩比。'))),
        h('section', { class: 'tile' }, h('h3', {}, '建议怎么用'),
          h('ul', { class: 'prose' },
            li('每周 3–5 天，每次十几分钟的「今日训练」：舒尔特热身，三项核心练习，呼吸计数收尾。'),
            li('以 4–6 周为一个周期看走势。单次成绩起伏很大，不必在意。'),
            li('训练完直接开一个专注计时，去做真正重要的事。'),
            li('难度会自动调整，目标是让你停在「有点难，但做得到」的区间。'))),
        h('section', { class: 'tile' }, h('h3', {}, '为什么是这七项'),
          h('ul', { class: 'prose' },
            li('原型里有 10 项训练，这里留下 7 项：每个注意力维度保留一项最有代表性的，不重复。'),
            li(h('b', {}, 'Flanker 箭头'), '和 Stroop 练的是同一种冲突控制，留下认知度更高、还带规则反转的 Stroop。'),
            li(h('b', {}, '任务转换'), '并入 Stroop 第 6 级之后的规则反转。'),
            li(h('b', {}, '记忆广度'), '和 N-back 同属工作记忆，留下难度阶梯更细的 N-back。')))),
      h('div', {},
        h('section', { class: 'tile' }, h('h3', {}, '七项训练，各练什么'),
          GAMES.map(g => h('a', { class: 'index-item', href: `#/game/${g.id}`, style: col(g) }, h('i'), h('div', {}, h('b', {}, g.name), h('span', {}, what[g.id]))))),
        h('section', { class: 'tile' },
          h('p', { class: 'fineprint' }, '凝神不是医疗工具，不能诊断或治疗注意力相关的疾病。没有广告，没有账号，数据只在你的设备上。')))));
}

// ---------- 启动 ----------
resumeFocus(); // 接上没走完的专注计时
restoreRun();  // 接上没走完的今日训练
route();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => { });
}

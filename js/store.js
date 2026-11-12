// 本地数据存储（localStorage），所有数据只保存在本机浏览器
const KEY = 'zzl.v1';

const blank = () => ({
  sessions: [],   // {game, variant, ts, score, level, metrics, durationMs}
  levels: {},     // `${game}:${variant}` -> level
  opts: {},       // game -> options
  focus: [],      // 专注计时记录
  daily: {},      // date -> {plan:[], done:[]}
  settings: { sound: true, theme: 'dark', weekGoal: 5 },
});

let db = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw) return blank();
    const b = blank();
    return { ...b, ...raw, settings: { ...b.settings, ...(raw.settings || {}) } };
  } catch {
    return blank();
  }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('保存失败', e); }
}

export const getDB = () => db;

export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addSession(s) { db.sessions.push(s); save(); }

export function sessions(game, variant) {
  return db.sessions.filter(s => s.game === game && (variant == null || s.variant === variant));
}

export function bestOf(list, better) {
  if (!list.length) return null;
  let b = list[0].score;
  for (const s of list) if (better === 'lower' ? s.score < b : s.score > b) b = s.score;
  return b;
}

export function getLevel(key, def = 1) { return db.levels[key] ?? def; }
export function setLevel(key, v) { db.levels[key] = v; save(); }

export function getOpts(game) {
  const o = {};
  for (const opt of game.options || []) o[opt.key] = opt.def;
  return { ...o, ...(db.opts[game.id] || {}) };
}
export function setOpts(gameId, o) { db.opts[gameId] = o; save(); }

export function addFocus(r) { db.focus.push(r); save(); }

export function settings() { return db.settings; }
export function setSetting(k, v) { db.settings[k] = v; save(); }

// 每天的活动次数（训练 + 专注）
export function activity() {
  const m = {};
  for (const s of db.sessions) { const k = dayKey(s.ts); m[k] = (m[k] || 0) + 1; }
  for (const f of db.focus) { const k = dayKey(f.ts); m[k] = (m[k] || 0) + 1; }
  return m;
}

export function streak() {
  const act = activity();
  const d = new Date();
  if (!act[dayKey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (act[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function daily(date, makePlan) {
  if (!db.daily[date]) { db.daily[date] = { plan: makePlan(date), done: [] }; save(); }
  return db.daily[date];
}
export function markDailyDone(date, id) {
  const d = db.daily[date];
  if (d && !d.done.includes(id)) { d.done.push(id); save(); }
}

export function exportData() { return JSON.stringify(db, null, 2); }
export function importData(text) {
  const raw = JSON.parse(text);
  if (!raw || !Array.isArray(raw.sessions)) throw new Error('文件格式不正确');
  const b = blank();
  db = { ...b, ...raw, settings: { ...b.settings, ...(raw.settings || {}) } };
  save();
}
export function clearAll() { db = blank(); save(); }

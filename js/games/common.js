import { mean, clamp } from '../ui.js';

// 反应类任务得分：正确一次 10 分，再按速度最多加 10 分
export function rtPoints(rt, window) {
  return 10 + Math.round(10 * clamp(1 - rt / window, 0, 1));
}

// 根据正确率调整等级
export function adaptByAcc(level, acc, { up = 0.9, down = 0.75, min = 1, max = 10 } = {}) {
  if (acc >= up) return clamp(level + 1, min, max);
  if (acc < down) return clamp(level - 1, min, max);
  return level;
}

export function levelNote(oldL, newL) {
  if (newL > oldL) return `表现稳定，下次升到第 ${newL} 级。`;
  if (newL < oldL) return `难度有点高，下次回到第 ${newL} 级巩固一下。`;
  return `下次继续保持第 ${newL} 级。`;
}

// 标准正态分布逆函数（Acklam 近似）
function probit(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

// 信号检测 d'（log-linear 校正，避免命中率为 0 或 1）
export function dprime(hits, signals, fas, noise) {
  const hr = (hits + 0.5) / (signals + 1);
  const fr = (fas + 0.5) / (noise + 1);
  return probit(hr) - probit(fr);
}

// 反应时间均值（只算正确试次）
export const meanRT = trials => mean(trials.filter(t => t.correct && t.rt != null).map(t => t.rt));

// 图标与插画：全部是内联 SVG，颜色跟随 CSS 变量（--ink / --g / --accent），明暗主题自动适配

const wrap = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const ICONS = {
  // 导航
  train: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/>',
  focus: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.6 1.6M9.5 3h5"/>',
  stats: '<path d="M4 19.5h16"/><path d="M5 15l4-4.2 3.5 3L19 7"/>',
  about: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2"/><circle cx="12" cy="7.8" r=".7" fill="currentColor"/>',
  // 通用
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  play: '<path d="M8.5 5.8v12.4a.6.6 0 0 0 .9.5l10-6.2a.6.6 0 0 0 0-1L9.400 5.300a.6.6 0 0 0-.9.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M9 6v12M15 6v12" stroke-width="2.2"/>',
  redo: '<path d="M19 12a7 7 0 1 1-2.300-5.200"/><path d="M19 4.500v4h-4"/>',
  sun: '<circle cx="12" cy="12" r="3.800"/><path d="M12 2.800v1.800M12 19.400v1.800M2.800 12h1.800M19.400 12h1.800M5.500 5.500l1.300 1.300M17.200 17.200l1.300 1.300M5.500 18.500l1.300-1.300M17.200 6.800l1.300-1.300"/>',
  moon: '<path d="M19.500 14.200A8 8 0 0 1 9.800 4.500a8 8 0 1 0 9.700 9.700z"/>',
  auto: '<circle cx="12" cy="12" r="8.500"/><path d="M12 3.500a8.500 8.500 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
  sound: '<path d="M4.500 9.500v5h3l4.500 3.500V6L7.500 9.500z"/><path d="M15.500 9a4 4 0 0 1 0 6M18 6.500a7.500 7.500 0 0 1 0 11"/>',
  mute: '<path d="M4.500 9.500v5h3l4.500 3.500V6L7.500 9.500z"/><path d="M16 9.500l5 5M21 9.500l-5 5"/>',
  download: '<path d="M12 4v11M7.500 11l4.500 4.500 4.500-4.500M5 19.500h14"/>',
  upload: '<path d="M12 15.500v-11M7.500 8.500L12 4l4.500 4.500M5 19.500h14"/>',
  trash: '<path d="M5 7h14M10 4h4M7 7l.8 12h8.400L17 7M10.500 10.500v5M13.500 10.500v5"/>',
  spark: '<path d="M12 3.500l1.900 5.100 5.100 1.900-5.100 1.900-1.900 5.100-1.900-5.100-5.100-1.900 5.100-1.900z" fill="currentColor" stroke="none"/><path d="M18.500 16.500l.7 1.800 1.800.7-1.800.7-.7 1.800-.7-1.800-1.800-.7 1.800-.7z" fill="currentColor" stroke="none"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14z"/><path d="M5 19c3-5 6-8 10-10"/>',
  lock: '<rect x="5.500" y="10.500" width="13" height="9" rx="2.500"/><path d="M8.500 10.500V8a3.500 3.500 0 0 1 7 0v2.500"/>',
  // 训练
  schulte: '<rect x="4" y="4" width="6.600" height="6.600" rx="1.700"/><rect x="13.400" y="4" width="6.600" height="6.600" rx="1.700"/><rect x="4" y="13.400" width="6.600" height="6.600" rx="1.700"/><rect x="13.400" y="13.400" width="6.600" height="6.600" rx="1.700" fill="currentColor"/>',
  stroop: '<path d="M12 3.500c3.200 3.700 5.800 6.600 5.800 10a5.800 5.800 0 0 1-11.600 0c0-3.400 2.600-6.300 5.800-10z"/><path d="M9.200 14a2.900 2.900 0 0 0 2.400 2.800"/>',
  sart: '<path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/><circle cx="12" cy="12" r="2.800"/>',
  nback: '<rect x="3.500" y="9.500" width="11" height="11" rx="2.600"/><path d="M7.500 6.500H15a2.500 2.500 0 0 1 2.500 2.500v7.500"/><path d="M11 3.500h7a2.500 2.500 0 0 1 2.500 2.500v7" opacity=".5"/>',
  mot: '<circle cx="7" cy="16.500" r="3"/><circle cx="17" cy="8" r="3" fill="currentColor"/><path d="M3.500 8.500c2-2.500 5-3.500 8-2.500M13 18.800c2.500.5 5-.5 7-2.500" opacity=".55"/>',
  arith: '<path d="M5 7.500h5M7.500 5v5M14.500 7.500h5M5.600 15.100l3.800 3.800M9.400 15.100l-3.800 3.800M14.500 15.500h5M14.500 18.500h5"/>',
  breath: '<circle cx="12" cy="12" r="2.100" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="5.600"/><circle cx="12" cy="12" r="9" opacity=".45"/>',
};

export const icon = name => wrap(ICONS[name] || '');

// 七项训练的示意图和刻度盘在 figures.js

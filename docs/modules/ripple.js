/* ============================================
   ripple.js
   方格水波扩散光效（单 RAF 管理 + 自适应）
============================================ */

import { getGridSize } from "./state.js";

const ripplePresets = {
  high: {
    radiusFactor: 1.1,
    radiusStep: 1,
    waveWidth: 1.8,
    sigma: 1.05,
    brightnessScale: 0.75,
    revertMs: 160,
    cutoff: 0.02,
  },
  balanced: {
    radiusFactor: 1,
    radiusStep: 1.2,
    waveWidth: 1.6,
    sigma: 0.9,
    brightnessScale: 0.6,
    revertMs: 140,
    cutoff: 0.02,
  },
  performance: {
    radiusFactor: 0.7,
    radiusStep: 1.8,
    waveWidth: 1.2,
    sigma: 0.9,
    brightnessScale: 0.45,
    revertMs: 100,
    cutoff: 0.03,
  },
  off: { disabled: true },
};

let rippleQuality = "balanced";

export function setRippleQuality(quality) {
  rippleQuality = ripplePresets[quality] ? quality : "balanced";
  return rippleQuality;
}

export function getRippleQuality() {
  return rippleQuality;
}

function getPreset() {
  return ripplePresets[rippleQuality] || ripplePresets.balanced;
}

/* ========== 缓存棋盘 DOM ========== */
let cachedCells = [];
let cachedRows = 0;
let cachedCols = 0;
// Map<HTMLElement, { deadline: number, prev: string | null }>
const highlightHold = new Map();

function ensureCells() {
  const { rows, cols } = getGridSize();
  const needRebuild =
    rows !== cachedRows ||
    cols !== cachedCols ||
    !cachedCells.length ||
    (cachedCells[0] && !cachedCells[0].isConnected);

  if (needRebuild) {
    cachedRows = rows || 16;
    cachedCols = cols || 16;
    cachedCells = Array.from(document.querySelectorAll(".cell"));
    highlightHold.clear();
  }
}

function getCell(row, col) {
  if (row < 0 || row >= cachedRows || col < 0 || col >= cachedCols) return null;
  const idx = row * cachedCols + col;
  return cachedCells[idx] || null;
}

/* ========== 全局 RAF 管理所有涟漪 ========== */
const activeRipples = [];
let rafId = null;
const MAX_RIPPLES = 5; // 提高并发，增加可见度和负载

function scheduleRAF() {
  if (rafId) return;
  rafId = requestAnimationFrame(stepAll);
}

function stepAll() {
  rafId = null;
  // DOM 可能在重绘后被替换，确保缓存有效
  ensureCells();

  const now = performance.now();

  // 清理过期高亮（即便没有活跃涟漪也要运行）
  for (const [cell, data] of highlightHold) {
    if (!data || data.deadline > now) continue;
    if (data.prev && data.prev.length) {
      cell.style.setProperty("--b", data.prev);
    } else {
      cell.style.removeProperty("--b");
    }
    highlightHold.delete(cell);
  }

  const hasRipples = activeRipples.length > 0;
  if (!hasRipples && !highlightHold.size) return;

  const nowHits = [];

  if (hasRipples) {
    for (let i = activeRipples.length - 1; i >= 0; i--) {
      const r = activeRipples[i];
      const alive = stepRipple(r, nowHits);
      if (!alive) activeRipples.splice(i, 1);
    }
  }

  // 批量写入亮度
  for (const hit of nowHits) {
    const prevExisting = highlightHold.get(hit.cell)?.prev;
    const prev = prevExisting !== undefined ? prevExisting : (hit.cell.style.getPropertyValue("--b") || "");
    hit.cell.style.setProperty("--b", hit.brightness);
    highlightHold.set(hit.cell, { deadline: now + hit.revertMs, prev });
  }

  if (activeRipples.length || highlightHold.size) scheduleRAF();
}

function stepRipple(ripple, hitsOut) {
  ripple.t += ripple.radiusStep;
  const radius = ripple.t;

  // 窗口范围
  const minR = Math.max(0, Math.floor(ripple.r - radius - ripple.waveWidth));
  const maxR = Math.min(cachedRows - 1, Math.ceil(ripple.r + radius + ripple.waveWidth));
  const minC = Math.max(0, Math.floor(ripple.c - radius - ripple.waveWidth));
  const maxC = Math.min(cachedCols - 1, Math.ceil(ripple.c + radius + ripple.waveWidth));

  for (let rr = minR; rr <= maxR; rr++) {
    for (let cc = minC; cc <= maxC; cc++) {
      if (ripple.sampleStep > 1 && !(rr === ripple.r && cc === ripple.c)) {
        if ((rr + cc) % ripple.sampleStep !== 0) continue;
      }

      const dr = rr - ripple.r;
      const dc = cc - ripple.c;
      const d = Math.hypot(dr, dc);
      const b = Math.exp(-1 * (((d - radius) / ripple.sigma) ** 2));
      if (b <= ripple.cutoff) continue;

      const cell = getCell(rr, cc);
      if (!cell || cell.classList.contains("revealed")) continue;

      hitsOut.push({ cell, brightness: 1 + b * ripple.brightnessScale, revertMs: ripple.revertMs });
    }
  }

  return ripple.t <= ripple.maxDist;
}

/* ========== 自适应参数 ========== */
function deriveAdaptiveParams(preset, rows, cols) {
  const diag = Math.sqrt(rows * rows + cols * cols);
  const baseSample = Math.max(1, Math.round(diag / 64)); // 略减降采样，更多点位参与
  const sampleStep = Math.max(1, Math.floor((preset.sampleStep || 0.8) * baseSample));
  const radiusStep = Math.max(0.6, preset.radiusStep || 1);
  const revertMs = Math.max(60, Math.min(220, preset.revertMs || 140));

  return {
    maxDist: Math.max(2, Math.ceil(diag * (preset.radiusFactor || 1))),
    waveWidth: preset.waveWidth || 1.6,
    sigma: preset.sigma || 1,
    brightnessScale: preset.brightnessScale ?? 0.6,
    cutoff: preset.cutoff ?? 0.02,
    sampleStep,
    radiusStep,
    revertMs,
  };
}

/**
 * 播放标记音符的水波扩散光效
 */
export function flashCell(r, c) {
  const preset = getPreset();
  if (preset.disabled) return;

  ensureCells();

  // 并发限制：超出则丢弃最旧的
  if (activeRipples.length >= MAX_RIPPLES) {
    activeRipples.shift();
  }

  const params = deriveAdaptiveParams(preset, cachedRows, cachedCols);

  activeRipples.push({
    r,
    c,
    t: 0,
    ...params,
  });

  scheduleRAF();
}

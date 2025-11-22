/* ============================================
   state.js
   共享 grid 数据给 sequencer / ripple 等模块
============================================ */

let grid = [];
let gridSize = { rows: 0, cols: 0 };

const ROW_AUDIO_KEY = "rowAudioConfig";
let rowAudioConfig = loadRowAudioConfig();

function loadRowAudioConfig() {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(ROW_AUDIO_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    console.warn("加载行音频配置失败，使用空配置:", e);
    return {};
  }
}

function saveRowAudioConfig() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(ROW_AUDIO_KEY, JSON.stringify(rowAudioConfig));
  } catch (e) {
    console.warn("保存行音频配置失败:", e);
  }
}

function defaultRowAudioConfig() {
  return { mode: "synth", volume: 1 };
}

function pruneRowAudioConfig(maxRows) {
  const allowed = Math.max(0, Number(maxRows) || 0);
  let changed = false;
  Object.keys(rowAudioConfig).forEach((k) => {
    const idx = parseInt(k, 10);
    if (Number.isNaN(idx) || idx < 0 || idx >= allowed) {
      delete rowAudioConfig[k];
      changed = true;
    }
  });
  if (changed) saveRowAudioConfig();
}

export function setGrid(g) {
  grid = g;
  gridSize = {
    rows: Array.isArray(g) ? g.length : 0,
    cols: Array.isArray(g) && g.length ? g[0].length : 0,
  };
  pruneRowAudioConfig(gridSize.rows);
}

export function getGrid() {
  return grid;
}

export function getGridSize() {
  return gridSize;
}

export function getRowAudioConfig(row) {
  return rowAudioConfig?.[row];
}

export function setRowAudioConfig(row, config) {
  if (typeof row !== "number" || row < 0) return;
  rowAudioConfig[row] = { ...defaultRowAudioConfig(), ...config };
  saveRowAudioConfig();
}

export function clearRowAudioConfig(row) {
  if (rowAudioConfig[row]) {
    delete rowAudioConfig[row];
    saveRowAudioConfig();
  }
}

export function resetRowAudioConfigs() {
  rowAudioConfig = {};
  saveRowAudioConfig();
}

export function getAllRowAudioConfigs() {
  return { ...rowAudioConfig };
}

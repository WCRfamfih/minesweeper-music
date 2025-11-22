// 前端 Minesweeper — 仅前端逻辑，不使用任何后台 API
import { resetSequencerPosition } from "./sequencer.js";
import { setGrid, getRowAudioConfig, setRowAudioConfig } from "./state.js";
import { createGrid } from "./grid.js";
import { audioCtx, getBuiltinSamples, loadBuiltinSample, loadFileSample } from "./audio.js";

const BOARD_MODES = {
  "16x16": { rows: 16, cols: 16, bars: 1 },
  "32x32": { rows: 32, cols: 32, bars: 2 },
  "64x32": { rows: 32, cols: 64, bars: 4 },
};

const DEFAULT_MODE = "16x16";
const ROW_LABEL_BASE = 60; // px

let game = null;
let currentMode = DEFAULT_MODE;
let boardScale = 1;
let openRowPanel = null;

function calcMines(rows, cols) {
  const density = 0.15625; // 16x16 时约 40 雷，保持相同比例
  return Math.max(10, Math.round(rows * cols * density));
}

function getCurrentSettings() {
  const base = BOARD_MODES[currentMode] || BOARD_MODES[DEFAULT_MODE];
  return {
    ...base,
    mines: calcMines(base.rows, base.cols),
  };
}

function getCellVisuals(cols) {
  if (cols <= 16) return { size: 32, gap: 4 };
  if (cols <= 32) return { size: 20, gap: 2 };
  return { size: 10, gap: 1 };
}

function getRowAudioState(rowIndex) {
  return getRowAudioConfig(rowIndex) || { mode: "synth", volume: 1 };
}

function updateRowAudioState(rowIndex, patch = {}) {
  const current = getRowAudioState(rowIndex);
  const next = { ...current, ...patch };
  setRowAudioConfig(rowIndex, next);
  return next;
}

// ======================================================
// 初始化游戏（替代 loadGame）
// ======================================================
export async function loadGame() {
  if (!game) {
    // 第一次进入游戏，创建前端 grid 逻辑
    const settings = getCurrentSettings();
    game = createGrid(settings.rows, settings.cols, settings.mines);
  }

  setGrid(game.grid); // 同步给 sequencer（保持功能不变）
  renderGrid();
}

// ======================================================
// 绘制棋盘
// ======================================================
function renderGrid() {
  const app = document.getElementById("app");
  app.innerHTML = "";
  openRowPanel = null;

  const table = document.createElement("div");
  table.className = "grid";

  const grid = game.grid;
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const { size, gap } = getCellVisuals(cols);
  const scaledSize = size * boardScale;
  const scaledGap = gap * boardScale;
  const labelWidth = ROW_LABEL_BASE * boardScale;

  table.style.setProperty("--rows", rows);
  table.style.setProperty("--cols", cols);
  table.style.setProperty("--cell-size", `${scaledSize}px`);
  table.style.setProperty("--cell-gap", `${scaledGap}px`);
  table.style.setProperty("--row-label-width", `${labelWidth}px`);

  for (let r = 0; r < rows; r++) {
    const header = createRowHeader(r);
    table.appendChild(header);

    for (let c = 0; c < cols; c++) {
      const data = grid[r][c];
      const cell = document.createElement("div");
      cell.className = "cell";

      if (data.revealed) {
        cell.classList.add("revealed");
        if (data.isMine) {
          cell.classList.add("mine-hit");
          cell.textContent = "💥";
        } else if (data.number > 0) {
          cell.textContent = data.number;
          cell.classList.add("num-" + data.number);
        }
      }

      if (data.flagged && !data.revealed) {
        cell.classList.add("flagged");
        cell.textContent = "🚩";
      }

      // 左键：翻开
      cell.addEventListener("click", () => revealCell(r, c));

      // 右键：插旗
      cell.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        toggleFlag(r, c);
      });

      table.appendChild(cell);
    }
  }

  app.appendChild(table);
}

function closeOpenRowPanel() {
  if (openRowPanel) {
    openRowPanel.classList.remove("open");
    openRowPanel = null;
  }
}

function createRowHeader(rowIndex) {
  const header = document.createElement("div");
  header.className = "row-header";
  header.dataset.row = rowIndex;

  const number = document.createElement("span");
  number.className = "row-number";
  number.textContent = String(rowIndex + 1).padStart(2, "0");

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "row-audio-toggle";
  toggle.setAttribute("aria-label", "展开行音频设置");
  toggle.textContent = "▸";

  const panel = document.createElement("div");
  panel.className = "row-audio-panel";
  buildRowAudioPanel(panel, rowIndex, toggle);

  toggle.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const isOpen = header.classList.contains("open");
    closeOpenRowPanel();
    if (!isOpen) {
      header.classList.add("open");
      openRowPanel = header;
    }
  });

  header.appendChild(number);
  header.appendChild(toggle);
  header.appendChild(panel);
  return header;
}

function buildRowAudioPanel(panel, rowIndex, toggleButton) {
  panel.innerHTML = "";
  const state = getRowAudioState(rowIndex);
  const builtin = getBuiltinSamples();

  const title = document.createElement("div");
  title.className = "row-audio-title";
  title.textContent = `第 ${rowIndex + 1} 行音频`;

  const status = document.createElement("div");
  status.className = "row-audio-status";

  const select = document.createElement("select");
  select.className = "row-audio-select";

  const defaultOpt = new Option("原始 Pluck（默认）", "synth");
  select.appendChild(defaultOpt);

  builtin.forEach((s) => {
    const opt = new Option(`预置 · ${s.name}`, s.id);
    select.appendChild(opt);
  });

  const uploadOpt = new Option("上传本地音频…", "upload");
  select.appendChild(uploadOpt);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "audio/*";
  fileInput.style.display = "none";

  const volumeWrap = document.createElement("label");
  volumeWrap.className = "row-audio-volume";
  volumeWrap.textContent = "音量";

  const volumeSlider = document.createElement("input");
  volumeSlider.type = "range";
  volumeSlider.min = "0";
  volumeSlider.max = "200";
  volumeSlider.step = "1";
  volumeSlider.value = Math.round((state.volume ?? 1) * 100);

  const volumeValue = document.createElement("span");
  volumeValue.className = "row-audio-vol-value";
  volumeValue.textContent = `${volumeSlider.value}%`;

  volumeWrap.appendChild(volumeSlider);
  volumeWrap.appendChild(volumeValue);

  panel.appendChild(title);
  panel.appendChild(status);
  panel.appendChild(select);
  panel.appendChild(volumeWrap);
  panel.appendChild(fileInput);

  function getVolume() {
    return Math.max(0, Math.min(parseInt(volumeSlider.value, 10) / 100 || 0, 2));
  }

  function getCurrentSelectValue() {
    const cfg = getRowAudioState(rowIndex);
    if (cfg.mode === "builtin" && cfg.sampleId) return cfg.sampleId;
    if (cfg.mode === "upload") return "upload";
    return "synth";
  }

  function updateStatus(label) {
    const cfg = getRowAudioState(rowIndex);
    let text = label || "原始 Pluck";
    if (cfg.mode === "builtin" && cfg.name) text = cfg.name;
    if (cfg.mode === "upload" && cfg.name) text = `上传 · ${cfg.name}`;
    status.textContent = `当前：${text}`;
  }

  function applySynth() {
    updateRowAudioState(rowIndex, { mode: "synth", sampleId: null, name: null, volume: getVolume() });
    updateStatus();
    select.value = "synth";
  }

  function ensureAudioReady() {
    if (audioCtx) return true;
    alert("请先点击页面任意位置开启音频，再加载音频文件。");
    select.value = getCurrentSelectValue();
    return false;
  }

  async function applyBuiltin(id) {
    const sample = builtin.find((b) => b.id === id);
    if (!sample) return;
    if (!ensureAudioReady()) {
      select.value = getCurrentSelectValue();
      return;
    }
    status.textContent = "加载预置音频...";
    select.disabled = true;
    toggleButton.disabled = true;
    try {
      const buffer = await loadBuiltinSample(sample.id);
      if (!buffer) throw new Error("buffer missing");
      updateRowAudioState(rowIndex, {
        mode: "builtin",
        sampleId: sample.id,
        name: sample.name,
        volume: getVolume(),
      });
      updateStatus(sample.name);
    } catch (err) {
      console.error(err);
      alert("加载预置音频失败，请重试。");
      applySynth();
    } finally {
      select.disabled = false;
      toggleButton.disabled = false;
    }
  }

  async function applyUpload(file) {
    if (!file) return;
    if (!ensureAudioReady()) {
      select.value = getCurrentSelectValue();
      return;
    }
    status.textContent = "加载本地音频...";
    select.disabled = true;
    toggleButton.disabled = true;
    try {
      const bufferId = `upload-${rowIndex}-${Date.now()}`;
      const buffer = await loadFileSample(file, bufferId);
      if (!buffer) throw new Error("decode failed");
      updateRowAudioState(rowIndex, {
        mode: "upload",
        sampleId: bufferId,
        name: file.name,
        volume: getVolume(),
      });
      updateStatus(file.name);
      select.value = "upload";
    } catch (err) {
      console.error(err);
      alert("上传的音频解码失败，请更换文件。");
      applySynth();
    } finally {
      select.disabled = false;
      toggleButton.disabled = false;
      fileInput.value = "";
    }
  }

  select.addEventListener("change", (ev) => {
    const value = ev.target.value;
    if (value === "synth") {
      applySynth();
      return;
    }
    if (value === "upload") {
      fileInput.click();
      return;
    }
    applyBuiltin(value);
  });

  volumeSlider.addEventListener("input", () => {
    volumeValue.textContent = `${volumeSlider.value}%`;
    updateRowAudioState(rowIndex, { volume: getVolume() });
  });

  fileInput.addEventListener("change", (ev) => {
    const file = ev.target.files && ev.target.files[0];
    applyUpload(file);
  });

  // 初始化选中状态
  if (state.mode === "builtin" && state.sampleId) {
    select.value = state.sampleId;
  } else if (state.mode === "upload") {
    select.value = "upload";
  } else {
    select.value = "synth";
  }
  updateStatus();
}

// ======================================================
// 右键插旗
// ======================================================
export function toggleFlag(r, c) {
  game.toggleFlag(r, c);
  setGrid(game.grid);
  renderGrid();
}

// ======================================================
// 左键翻开
// ======================================================
export function revealCell(r, c) {
  const result = game.revealCell(r, c);

  if (result.hitMine) {
    alert("💥 游戏结束！你踩到了地雷！");
    restartGame();
    return;
  }

  if (game.checkWin()) {
    alert("🎉 恭喜通关！");
    restartGame();
    return;
  }

  setGrid(game.grid);
  renderGrid();
}

// ======================================================
// 重开游戏
// ======================================================
export function restartGame() {
  const settings = getCurrentSettings();
  game = createGrid(settings.rows, settings.cols, settings.mines);
  setGrid(game.grid);
  resetSequencerPosition();
  renderGrid();
}

// ======================================================
// 切换棋盘模式（16/32/64）
// ======================================================
export function setBoardMode(modeKey) {
  if (!BOARD_MODES[modeKey]) {
    currentMode = DEFAULT_MODE;
  } else {
    currentMode = modeKey;
  }

  const settings = getCurrentSettings();
  game = createGrid(settings.rows, settings.cols, settings.mines);
  setGrid(game.grid);
  resetSequencerPosition();
  renderGrid();
}

export function getBoardModes() {
  return { ...BOARD_MODES };
}

export function getCurrentBoardMode() {
  return currentMode;
}

export function getCurrentBoardInfo() {
  return { mode: currentMode, ...getCurrentSettings() };
}

export function setBoardScale(scale) {
  boardScale = Math.max(0.3, Math.min(scale, 3));
  renderGrid();
}

export function getBoardScale() {
  return boardScale;
}

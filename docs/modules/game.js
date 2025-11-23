// 前端 Minesweeper — 仅前端逻辑，不使用任何后台 API
import { resetSequencerPosition } from "./sequencer.js";
import { setGrid, getRowAudioConfig, setRowAudioConfig, resetRowAudioConfigs, getGridSize } from "./state.js";
import { createGrid } from "./grid.js";
import { audioCtx, getBuiltinSamples, loadBuiltinSample, loadFileSample } from "./audio.js";

const BOARD_MODES = {
  "16x16": { rows: 16, cols: 16, bars: 1 },
  "32x32": { rows: 32, cols: 32, bars: 2 },
  "64x32": { rows: 32, cols: 64, bars: 4 },
};

const DEFAULT_MODE = "16x16";
const ROW_LABEL_BASE = 90; // px, 给行号与按钮留足空间

function emit(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

let game = null;
let currentMode = DEFAULT_MODE;
let boardScale = 1;
let openRowPanel = null;
let hoverCell = null;
let gameOver = false;
let probabilityMode = false;
let probabilityEverUsed = false;
let firstRevealFired = false;

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

export function setProbabilityMode(enabled) {
  probabilityMode = !!enabled;
  if (probabilityMode) {
    probabilityEverUsed = true;
    emit("game:probabilityLocked");
  }
  if (!probabilityMode) {
    if (!game || !game.grid) return;
    renderGrid();
  }
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
    const settings = getCurrentSettings();
    game = createGrid(settings.rows, settings.cols, settings.mines);
  }

  gameOver = false;
  probabilityEverUsed = false;
  firstRevealFired = false;
  setGrid(game.grid);
  renderGrid();
  emit("game:restart");
}

// ======================================================
// 绘制棋盘
// ======================================================
function renderGrid() {
  const app = document.getElementById("app");
  app.innerHTML = "";
  openRowPanel = null;
  hoverCell = null;

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
  table.classList.toggle("large-board", cols >= 32);

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
        if (data.muted) {
          cell.classList.add("flagged-muted");
          cell.textContent = "🚫";
        } else {
          cell.textContent = "🚩";
        }
      }

      if (gameOver && data.isMine && !data.flagged) {
        cell.classList.add("mine-show");
        cell.textContent = "💣";
      }

      // 左键：翻开或切换禁播
      cell.addEventListener("click", () => {
        if (data.flagged && !data.revealed) {
          toggleFlagMute(r, c);
          setGrid(game.grid);
          renderGrid();
          return;
        }
        if (!gameOver) {
          revealCell(r, c);
        }
      });

      // 悬停显示概率
      cell.addEventListener("pointerenter", () => showCellProbability(cell, r, c));
      cell.addEventListener("pointerleave", () => clearCellProbability(cell));

      // 右键：插旗
      cell.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        toggleFlag(r, c);
        renderGrid();
      });

      table.appendChild(cell);
    }
  }

  app.appendChild(table);
  attachGridHover(table);
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

  const actions = document.createElement("div");
  actions.className = "row-header-actions";

  const randomBtn = document.createElement("button");
  randomBtn.type = "button";
  randomBtn.className = "row-audio-random";
  randomBtn.setAttribute("aria-label", "随机选择预置音频");
  randomBtn.textContent = "🎲";

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "row-audio-reset";
  resetBtn.setAttribute("aria-label", "重置为 Pluck");
  resetBtn.textContent = "⟳";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "row-audio-toggle";
  toggle.setAttribute("aria-label", "展开行音频设置");
  toggle.textContent = "▸";

  const panel = document.createElement("div");
  panel.className = "row-audio-panel";
  const panelAPI = buildRowAudioPanel(panel, rowIndex, [toggle, randomBtn, resetBtn]);

  toggle.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const isOpen = header.classList.contains("open");
    closeOpenRowPanel();
    if (!isOpen) {
      header.classList.add("open");
      openRowPanel = header;
    }
  });

  randomBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    panelAPI.randomBuiltin();
  });

  resetBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    flashButton(resetBtn);
    panelAPI.resetToSynth();
  });

  function flashButton(btn) {
    if (!btn) return;
    btn.classList.add("pulse");
    setTimeout(() => btn.classList.remove("pulse"), 180);
  }

  actions.appendChild(randomBtn);
  actions.appendChild(resetBtn);
  actions.appendChild(toggle);

  header.appendChild(number);
  header.appendChild(actions);
  header.appendChild(panel);
  return header;
}

function attachGridHover(table) {
  table.addEventListener("pointermove", (ev) => {
    const cell = ev.target && ev.target.closest(".cell");
    if (cell === hoverCell) return;
    if (hoverCell) hoverCell.classList.remove("hovered");
    if (cell) cell.classList.add("hovered");
    hoverCell = cell;
  });

  table.addEventListener("pointerleave", () => {
    if (hoverCell) {
      hoverCell.classList.remove("hovered");
      hoverCell = null;
    }
  });
}

function clearCellProbability(cell) {
  if (!cell || !cell.classList.contains("prob-show")) return;
  const prev = cell.dataset.prevText || "";
  cell.textContent = prev;
  cell.classList.remove("prob-show");
  delete cell.dataset.prevText;
}

function showCellProbability(cell, r, c) {
  if (!probabilityMode || !cell) return;
  const prob = computeMineProbability(r, c);
  if (prob == null) return;
  const prev = cell.textContent;
  cell.dataset.prevText = prev;
  cell.textContent = `${Math.round(prob * 100)}%`;
  cell.classList.add("prob-show");
}

function computeMineProbability(r, c) {
  if (!game || !game.grid) return null;
  const grid = game.grid;
  const cell = grid[r]?.[c];
  if (!cell || cell.revealed || cell.flagged) return null;

  const totalMines = getCurrentSettings().mines;
  let flagged = 0;
  let revealed = 0;

  for (let rr = 0; rr < grid.length; rr++) {
    for (let cc = 0; cc < grid[0].length; cc++) {
      const d = grid[rr][cc];
      if (d.flagged) flagged++;
      if (d.revealed) revealed++;
    }
  }

  const total = grid.length * (grid[0]?.length || 0);
  const unknown = Math.max(1, total - revealed - flagged);
  const remainingMines = Math.max(0, totalMines - flagged);
  const baseProb = remainingMines / unknown;

  const dirs = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],          [0, 1],
    [1, -1],  [1, 0], [1, 1],
  ];
  let localProb = null;

  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    const neighbor = grid[nr]?.[nc];
    if (!neighbor || !neighbor.revealed || neighbor.number <= 0) continue;

    let f = 0;
    let u = 0;
    for (const [dr2, dc2] of dirs) {
      const rr = nr + dr2;
      const cc = nc + dc2;
      const ncell = grid[rr]?.[cc];
      if (!ncell) continue;
      if (ncell.flagged) f++;
      else if (!ncell.revealed) u++;
    }
    const remaining = neighbor.number - f;
    if (u > 0 && remaining > 0) {
      const p = remaining / u;
      localProb = localProb === null ? p : Math.max(localProb, p);
    }
  }

  const finalProb = Math.max(0, Math.min(1, localProb !== null ? localProb : baseProb));
  return finalProb;
}

function buildRowAudioPanel(panel, rowIndex, controlsToDisable = []) {
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

  // 上传放置最顶端
  const uploadOpt = new Option("上传本地音频…", "upload");
  select.appendChild(uploadOpt);

  const defaultOpt = new Option("原始 Pluck（默认）", "synth");
  select.appendChild(defaultOpt);

  builtin.forEach((s) => {
    const opt = new Option(`预置 · ${s.name}`, s.id);
    select.appendChild(opt);
  });

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

  function setBusy(busy) {
    select.disabled = busy;
    controlsToDisable.forEach((el) => {
      if (el) el.disabled = busy;
    });
  }

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
    setBusy(true);
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
      setBusy(false);
    }
  }

  async function applyUpload(file) {
    if (!file) return;
    if (!ensureAudioReady()) {
      select.value = getCurrentSelectValue();
      return;
    }
    status.textContent = "加载本地音频...";
    setBusy(true);
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
      setBusy(false);
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

  if (state.mode === "builtin" && state.sampleId) {
    select.value = state.sampleId;
  } else if (state.mode === "upload") {
    select.value = "upload";
  } else {
    select.value = "synth";
  }
  updateStatus();

  return {
    randomBuiltin() {
      const pool = [{ id: "synth", mode: "synth" }, ...builtin];
      const choice = pool[Math.floor(Math.random() * pool.length)];
      if (choice.id === "synth") {
        applySynth();
      } else {
        applyBuiltin(choice.id);
      }
    },
    resetToSynth() {
      applySynth();
    },
  };
}

// ======================================================
// 右键插旗
// ======================================================
export function toggleFlag(r, c) {
  game.toggleFlag(r, c);
  setGrid(game.grid);
  renderGrid();
}

function toggleFlagMute(r, c) {
  if (!game || !game.toggleFlagMute) return;
  game.toggleFlagMute(r, c);
}

// ======================================================
// 左键翻开
// ======================================================
export function revealCell(r, c) {
  if (gameOver) return;

  const result = game.revealCell(r, c);

  if (!firstRevealFired) {
    firstRevealFired = true;
    emit("game:firstReveal");
  }

  if (result.hitMine) {
    gameOver = true;
    renderGrid();
    alert("💥 游戏结束！你踩到了地雷！");
    emit("game:lose");
    return;
  }

  if (game.checkWin()) {
    gameOver = true;
    renderGrid();
    alert("🎉 恭喜通关！");
    emit("game:win");
    return;
  }

  setGrid(game.grid);
  renderGrid();
}

// ======================================================
// 重开游戏
// ======================================================
export function restartGame(resetAudio = true) {
  const settings = getCurrentSettings();
  game = createGrid(settings.rows, settings.cols, settings.mines);
  setGrid(game.grid);
  gameOver = false;
  probabilityEverUsed = false;
  firstRevealFired = false;
  if (resetAudio) {
    resetRowAudioConfigs();
  }
  resetSequencerPosition();
  renderGrid();
  emit("game:restart");
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
  gameOver = false;
  probabilityEverUsed = false;
  firstRevealFired = false;
  resetSequencerPosition();
  renderGrid();
  emit("game:restart");
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

export async function randomizeAllRowsAudio() {
  const { rows } = getGridSize();
  if (!rows) return;
  const builtin = getBuiltinSamples();
  const pool = [{ mode: "synth" }, ...builtin.map((s) => ({ mode: "builtin", sampleId: s.id, name: s.name }))];
  const pick = () => pool[Math.floor(Math.random() * pool.length)];

  const chosenIds = new Set();
  const choices = [];
  for (let r = 0; r < rows; r++) {
    const choice = pick();
    choices.push(choice);
    if (choice.sampleId) chosenIds.add(choice.sampleId);
  }

  if (chosenIds.size) {
    const promises = [...chosenIds].map((id) => loadBuiltinSample(id).catch(() => null));
    await Promise.all(promises);
  }

  for (let r = 0; r < rows; r++) {
    const choice = choices[r];
    if (choice.mode === "synth") {
      setRowAudioConfig(r, { mode: "synth", sampleId: null, name: null });
    } else {
      setRowAudioConfig(r, {
        mode: "builtin",
        sampleId: choice.sampleId,
        name: choice.name,
      });
    }
  }
  renderGrid();
}

export async function smartRandomizeAllRowsAudio(pluckRatio = 0.66) {
  const { rows } = getGridSize();
  if (!rows) return;
  const builtin = getBuiltinSamples();
  const ratio = Math.min(1, Math.max(0, Number(pluckRatio) || 0));
  const synthTarget = Math.round(rows * ratio);
  const pool = builtin.map((s) => ({ mode: "builtin", sampleId: s.id, name: s.name }));
  const choices = new Array(rows).fill(null);

  for (let r = 0; r < rows; r++) {
    choices[r] = r < synthTarget ? { mode: "synth" } : null;
  }

  for (let r = synthTarget; r < rows; r++) {
    const choice = pool.length ? pool[Math.floor(Math.random() * pool.length)] : { mode: "synth" };
    choices[r] = choice;
  }

  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  const chosenIds = new Set(choices.filter((c) => c.sampleId).map((c) => c.sampleId));
  if (chosenIds.size) {
    const promises = [...chosenIds].map((id) => loadBuiltinSample(id).catch(() => null));
    await Promise.all(promises);
  }

  for (let r = 0; r < rows; r++) {
    const choice = choices[r];
    if (choice.mode === "synth") {
      setRowAudioConfig(r, { mode: "synth", sampleId: null, name: null });
    } else {
      setRowAudioConfig(r, { mode: "builtin", sampleId: choice.sampleId, name: choice.name });
    }
  }

  renderGrid();
}

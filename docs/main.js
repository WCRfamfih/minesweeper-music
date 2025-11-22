import {
  loadGame,
  restartGame,
  setBoardMode,
  getBoardModes,
  getCurrentBoardMode,
  setBoardScale,
  getBoardScale,
  randomizeAllRowsAudio,
  smartRandomizeAllRowsAudio
} from "./modules/game.js";
import { startSequencer } from "./modules/sequencer.js";
import {
  setupUI,
  synthParams,
  resetParams,
  saveConfig,
  loadConfig,
  deleteConfig,
  exportConfig,
  importConfigFromFile
} from "./modules/ui.js";
import { initAudioGraph, audioCtx } from "./modules/audio.js";

/* ======================================================
   自动启动音频系统（浏览器需要用户点击才能启动 AudioContext）
====================================================== */

let audioStarted = false;

async function tryStartAudio() {
  if (audioStarted) return;

  console.log("🔊 初次点击，启动 AudioContext...");
  initAudioGraph(synthParams);

  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  // 启动音序器
  startSequencer(synthParams);

  audioStarted = true;
  console.log("AudioContext 状态 =", audioCtx.state);
}

// 监听全局任意点击，第一次点击即自动启动音频
window.addEventListener("pointerdown", tryStartAudio, { once: true });
window.addEventListener("touchstart", tryStartAudio, { once: true });

/* ======================================================
   页面加载（构建 UI、生成棋盘）
====================================================== */

window.onload = async () => {
  // 加载默认配置文件
  await loadDefaultConfig();
  setupUI();
  setupBoardSizeSelect();
  setupBoardScaleSlider();
  setupGlobalRandomButtons();
  setupHowTo();
  await loadGame();

  // 👉 不在 onload 调用 startSequencer（因为没用户手势会被阻止）
  console.log("游戏准备完毕，等待用户第一次点击以启动音序器/音频系统");
};

// 加载默认配置文件
async function loadDefaultConfig() {
  try {
    const response = await fetch("./Default_Pluck.json");
    if (response.ok) {
      const config = await response.json();
      Object.assign(synthParams, config);
      console.log("✅ 已加载默认配置文件 Default_Pluck.json");
    }
  } catch (e) {
    console.warn("⚠️ 未找到默认配置文件，使用内置默认参数:", e.message);
  }
}

/* ======================================================
   HTML 调用接口
====================================================== */

window.restartGame = restartGame;
window.resetParams = resetParams;
window.saveConfig = saveConfig;
window.loadConfig = loadConfig;
window.deleteConfig = deleteConfig;
window.exportConfig = exportConfig;
window.importConfigFromFile = importConfigFromFile;
window.randomizeAllRowsAudio = randomizeAllRowsAudio;
window.smartRandomizeAllRowsAudio = smartRandomizeAllRowsAudio;
window.hideHowTo = () => {
  const overlay = document.getElementById("howToOverlay");
  if (overlay) overlay.hidden = true;
};

function setupBoardSizeSelect() {
  const select = document.getElementById("boardSizeSelect");
  if (!select) return;

  const modes = getBoardModes();
  const current = getCurrentBoardMode();

  if (modes[current]) {
    select.value = current;
  }

  select.addEventListener("change", (e) => {
    const mode = e.target.value;
    setBoardMode(mode);
  });
}

function setupBoardScaleSlider() {
  const slider = document.getElementById("boardScaleSlider");
  const label = document.getElementById("boardScaleValue");
  if (!slider || !label) return;

  const current = Math.round(getBoardScale() * 100);
  slider.value = current;
  label.textContent = `${current}%`;

  slider.addEventListener("input", () => {
    const v = Math.max(30, Math.min(parseInt(slider.value, 10), 300));
    label.textContent = `${v}%`;
    setBoardScale(v / 100);
  });
}

function setupGlobalRandomButtons() {
  const btn = document.getElementById("globalRandomAudioBtn");
  const smartBtn = document.getElementById("smartRandomAudioBtn");

  if (btn) {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = "随机中...";
      try {
        await randomizeAllRowsAudio();
      } finally {
        btn.textContent = prev;
        btn.disabled = false;
      }
    });
  }

  if (smartBtn) {
    smartBtn.addEventListener("click", async () => {
      smartBtn.disabled = true;
      const prev = smartBtn.textContent;
      smartBtn.textContent = "随机中...";
      try {
        await smartRandomizeAllRowsAudio();
      } finally {
        smartBtn.textContent = prev;
        smartBtn.disabled = false;
      }
    });
  }
}

function setupHowTo() {
  const overlay = document.getElementById("howToOverlay");
  const openBtn = document.getElementById("howToPlayBtn");
  const closeBtn = document.getElementById("howToCloseBtn");
  const closeBtn2 = document.getElementById("howToCloseBtn2");
  const close = () => {
    if (overlay) overlay.hidden = true;
  };
  const open = () => {
    if (overlay) overlay.hidden = false;
  };

  if (openBtn && overlay) openBtn.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);
  if (closeBtn2) closeBtn2.addEventListener("click", close);
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
  }
}

// 为调试挂载到 window
window.audioCtx = audioCtx;

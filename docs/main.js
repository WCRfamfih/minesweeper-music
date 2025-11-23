import {
  loadGame,
  restartGame,
  setBoardMode,
  getBoardModes,
  getCurrentBoardMode,
  setBoardScale,
  getBoardScale,
  randomizeAllRowsAudio,
  smartRandomizeAllRowsAudio,
  setProbabilityMode
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

const THEME_KEY = "themePreference";
const THEME_ORDER = ["default", "aurora", "lavender", "olive", "brandblue"];
const THEME_LABELS = {
  default: "深空",
  aurora: "暮光",
  lavender: "雾紫",
  olive: "复古",
  brandblue: "品牌蓝"
};

/* ======================================================
   自动启动音频系统（浏览器需要用户点击才能启动 AudioContext）
====================================================== */

let audioStarted = false;
let timerEnabled = false;
let timerLocked = false;
let timerRunning = false;
let timerStart = 0;
let timerElapsed = 0;
let timerInterval = null;

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
  setupSettingsMenu();
  setupThemeMenu();
  setupBoardSizeSelect();
  setupBoardScaleSlider();
  setupGlobalRandomButtons();
  setupProbabilityToggle();
  setupTimerToggle();
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

function applyTheme(theme) {
  const next = THEME_ORDER.includes(theme) ? theme : "default";
  document.body.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
  updateThemeMenuActive(next);
}

function updateThemeMenuActive(theme) {
  const options = document.querySelectorAll(".theme-option");
  options.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === theme);
  });
  const toggle = document.getElementById("themeMenuToggle");
  if (toggle) {
    toggle.textContent = `🎨 主题：${THEME_LABELS[theme] || "深空"}`;
  }
}

function setupThemeMenu() {
  const toggle = document.getElementById("themeMenuToggle");
  const menu = document.getElementById("themeMenu");
  if (!toggle || !menu) return;

  const stored = localStorage.getItem(THEME_KEY) || "default";
  applyTheme(stored);

  const closeMenu = () => {
    if (menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.classList.remove("open");
  };

  const openMenu = () => {
    menu.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    toggle.classList.add("open");
  };

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.hidden) {
      openMenu();
    } else {
      closeMenu();
    }
  });

  menu.addEventListener("click", (e) => {
    e.stopPropagation();
    const btn = e.target.closest(".theme-option");
    if (!btn) return;
    const theme = btn.dataset.theme;
    applyTheme(theme);
    closeMenu();
  });

  document.addEventListener("click", () => closeMenu());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
}

function setupSettingsMenu() {
  const toggle = document.getElementById("settingsToggle");
  const menu = document.getElementById("settingsMenu");
  const container = toggle ? toggle.closest(".settings-container") : null;
  if (!toggle || !menu) return;

  const closeMenu = () => {
    if (menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (container) container.classList.remove("open");
  };

  const openMenu = () => {
    menu.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    if (container) container.classList.add("open");
  };

  const toggleMenu = () => {
    if (menu.hidden) {
      openMenu();
    } else {
      closeMenu();
    }
  };

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  menu.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("click", (e) => {
    if (menu.hidden) return;
    if (e.target === toggle || menu.contains(e.target)) return;
    closeMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeMenu();
    }
  });
}

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
  const smartRatioInput = document.getElementById("smartRatioInput");
  const smartRatioValue = document.getElementById("smartRatioValue");
  const setSmartRatio = (percent) => {
    if (!smartRatioInput || !smartRatioValue) return;
    const v = Math.max(0, Math.min(Math.round(percent), 100));
    smartRatioInput.value = v;
    smartRatioValue.textContent = `${v}%`;
    return v;
  };

  if (smartRatioInput && smartRatioValue) {
    const syncRatio = () => {
      const v = Math.max(0, Math.min(parseInt(smartRatioInput.value, 10) || 0, 100));
      setSmartRatio(v);
      return v / 100;
    };
    smartRatioInput.addEventListener("input", syncRatio);
    syncRatio();
    // 初始默认值按棋盘尺寸调整
    applyDefaultSmartRatio(setSmartRatio);
  }

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
        let ratio = 0.66;
        if (smartRatioInput) {
          const v = Math.max(0, Math.min(parseInt(smartRatioInput.value, 10) || 0, 100));
          ratio = v / 100;
        }
        await smartRandomizeAllRowsAudio(ratio);
      } finally {
        smartBtn.textContent = prev;
        smartBtn.disabled = false;
      }
    });
  }
}

function applyDefaultSmartRatio(setter) {
  if (typeof setter !== "function") return;
  const mode = getCurrentBoardMode();
  const percent = mode === "16x16" ? 85 : 90;
  setter(percent);
}

function setupProbabilityToggle() {
  const toggle = document.getElementById("probabilityToggle");
  if (!toggle) return;
  const sync = () => {
    setProbabilityMode(toggle.checked);
    if (toggle.checked) {
      lockTimer();
    }
  };
  toggle.addEventListener("change", sync);
  sync();
}

function setupTimerToggle() {
  const toggle = document.getElementById("timerModeToggle");
  const display = document.getElementById("timerDisplay");
  if (!toggle || !display) return;

  const sync = () => {
    if (timerLocked) {
      toggle.checked = false;
      timerEnabled = false;
      resetTimerDisplay();
      return;
    }
    timerEnabled = toggle.checked;
    if (!timerEnabled) {
      stopTimer(true);
    }
  };
  toggle.addEventListener("change", sync);
  sync();
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

// =======================
// 计时器工具
// =======================
function startTimer() {
  if (!timerEnabled || timerLocked || timerRunning) return;
  timerStart = performance.now() - timerElapsed;
  timerRunning = true;
  if (timerInterval) cancelAnimationFrame(timerInterval);
  const tick = () => {
    if (!timerRunning) return;
    const now = performance.now();
    timerElapsed = now - timerStart;
    updateTimerDisplay();
    timerInterval = requestAnimationFrame(tick);
  };
  timerInterval = requestAnimationFrame(tick);
}

function stopTimer(clear = false) {
  timerRunning = false;
  if (timerInterval) {
    cancelAnimationFrame(timerInterval);
    timerInterval = null;
  }
  if (clear) {
    timerElapsed = 0;
    updateTimerDisplay();
  }
}

function updateTimerDisplay() {
  const display = document.getElementById("timerDisplay");
  if (!display) return;
  const ms = Math.max(0, timerElapsed);
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((ms % 1000) / 100);
  display.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function resetTimerDisplay() {
  timerElapsed = 0;
  timerRunning = false;
  updateTimerDisplay();
}

function lockTimer() {
  timerLocked = true;
  timerEnabled = false;
  const toggle = document.getElementById("timerModeToggle");
  if (toggle) {
    toggle.checked = false;
    toggle.disabled = true;
  }
  stopTimer(true);
}

function unlockTimer() {
  timerLocked = false;
  const toggle = document.getElementById("timerModeToggle");
  if (toggle) {
    toggle.disabled = false;
  }
  resetTimerDisplay();
}

// 监听游戏事件驱动计时器
document.addEventListener("game:restart", () => {
  const probabilityToggle = document.getElementById("probabilityToggle");
  if (probabilityToggle) {
    probabilityToggle.checked = false;
  }
  setProbabilityMode(false);
  applyDefaultSmartRatio((percent) => {
    const smartRatioInput = document.getElementById("smartRatioInput");
    const smartRatioValue = document.getElementById("smartRatioValue");
    if (!smartRatioInput || !smartRatioValue) return;
    smartRatioInput.value = percent;
    smartRatioValue.textContent = `${percent}%`;
  });
  unlockTimer();
  const toggle = document.getElementById("timerModeToggle");
  if (toggle) {
    timerEnabled = toggle.checked;
  }
});

document.addEventListener("game:firstReveal", () => {
  startTimer();
});

document.addEventListener("game:win", () => {
  stopTimer(false);
});

document.addEventListener("game:lose", () => {
  stopTimer(true);
});

document.addEventListener("game:probabilityLocked", () => {
  lockTimer();
});

import { loadGame, restartGame } from "./modules/game.js";
import { startSequencer } from "./modules/sequencer.js";
import { setupUI, synthParams, resetParams, saveConfig, loadConfig, deleteConfig, exportConfig, importConfigFromFile } from "./modules/ui.js";
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

// 为调试挂载到 window
window.audioCtx = audioCtx;

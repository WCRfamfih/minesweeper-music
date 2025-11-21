/* ============================================
   ui.js
   UI 控件绑定 & 参数更新
============================================ */

import { refreshSequencer } from "./sequencer.js";
import { updateReverb } from "./synth.js";
import { masterGain } from "./audio.js";

/* 全局共享音色与效果参数 */
const defaultParams = {
  bpm: 100,
  volume: 0.5,

  attack: 0.01,
  decay: 0.20,
  sustain: 0.40,
  release: 0.30,

  waveform: "triangle",

  filterCutoff: 8000,
  filterQ: 1,

  reverbDecay: 2.5,
  reverbMix: 0.30,
  reverbLowCut: 400,
  reverbHighCut: 8000,
};

export const synthParams = { ...defaultParams };

/* ============================================
   保存和加载参数的函数
============================================ */

// 获取所有保存的配置文件列表
function getConfigList() {
  try {
    const list = localStorage.getItem("configList");
    return list ? JSON.parse(list) : {};
  } catch (e) {
    console.error("获取配置列表失败:", e);
    return {};
  }
}

// 保存配置文件列表
function saveConfigList(list) {
  try {
    localStorage.setItem("configList", JSON.stringify(list));
  } catch (e) {
    console.error("保存配置列表失败:", e);
  }
}

// 保存为具体的配置文件
export function saveConfig(configName) {
  if (!configName || configName.trim() === "") {
    alert("❌ 配置名称不能为空");
    return false;
  }

  try {
    console.log("📝 当前 synthParams:", synthParams); // 调试：显示所有参数
    const configList = getConfigList();
    const timestamp = new Date().toLocaleString("zh-CN");
    configList[configName] = {
      params: { ...synthParams },
      timestamp
    };
    saveConfigList(configList);
    console.log(`✅ 配置文件 "${configName}" 已保存`);
    console.log("💾 保存的参数内容:", configList[configName].params); // 调试：显示保存的内容
    return true;
  } catch (e) {
    console.error("保存配置失败:", e);
    return false;
  }
}

// 加载具体的配置文件
export function loadConfig(configName) {
  try {
    const configList = getConfigList();
    if (configList[configName]) {
      Object.assign(synthParams, configList[configName].params);
      console.log(`✅ 已加载配置文件 "${configName}"`);
      return true;
    } else {
      alert(`❌ 配置文件 "${configName}" 不存在`);
      return false;
    }
  } catch (e) {
    console.error("加载配置失败:", e);
    return false;
  }
}

// 删除配置文件
export function deleteConfig(configName) {
  try {
    const configList = getConfigList();
    if (configList[configName]) {
      delete configList[configName];
      saveConfigList(configList);
      console.log(`✅ 配置文件 "${configName}" 已删除`);
      updateConfigUI();
      return true;
    }
    return false;
  } catch (e) {
    console.error("删除配置失败:", e);
    return false;
  }
}

// 导出配置为 JSON 文件
export function exportConfig(configName) {
  try {
    const configList = getConfigList();
    if (!configList[configName]) {
      alert(`❌ 配置文件 "${configName}" 不存在`);
      return;
    }

    const data = JSON.stringify(configList[configName].params, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${configName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`✅ 配置文件 "${configName}" 已导出`);
  } catch (e) {
    console.error("导出配置失败:", e);
  }
}

// 从 JSON 文件导入配置
export function importConfigFromFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      // 验证 JSON 是否包含合法的参数
      if (typeof data === "object" && data.bpm) {
        const configName = file.name.replace(".json", "");
        const confirmed = confirm(`确认要导入配置 "${configName}" 吗？`);
        if (confirmed) {
          saveConfig(configName);
          Object.assign(synthParams, data);
          updateConfigUI();
          alert(`✅ 配置 "${configName}" 已导入并加载`);
        }
      } else {
        alert("❌ 无效的配置文件格式");
      }
    } catch (e) {
      alert("❌ 无法读取配置文件: " + e.message);
    }
  };
  reader.readAsText(file);
}

// 从 localStorage 加载默认参数
function loadParamsFromStorage() {
  try {
    const stored = localStorage.getItem("synthParams");
    if (stored) {
      const loaded = JSON.parse(stored);
      Object.assign(synthParams, loaded);
      return true;
    }
  } catch (e) {
    console.error("加载参数失败:", e);
  }
  return false;
}

// 保存到 localStorage
function saveParamsToStorage() {
  try {
    localStorage.setItem("synthParams", JSON.stringify(synthParams));
    console.log("✅ 音色参数已保存");
  } catch (e) {
    console.error("保存参数失败:", e);
  }
}

export function resetParams() {
  Object.assign(synthParams, defaultParams);
  localStorage.removeItem("synthParams");
  location.reload();
  console.log("✅ 参数已重置为默认值");
}

// 更新配置 UI 列表
function updateConfigUI() {
  const select = document.getElementById("configSelect");
  if (!select) return;

  const configList = getConfigList();
  const currentValue = select.value;

  select.innerHTML = '<option value="">-- 选择配置 --</option>';
  Object.keys(configList).forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });

  if (currentValue && configList[currentValue]) {
    select.value = currentValue;
  }
}

/* ============================================
   主 UI 初始化
============================================ */
export function setupUI(shouldLoad = false) {
  // 从 localStorage 加载参数（仅在初始化时加载，避免递归）
  // 注：默认配置已在 main.js 的 loadDefaultConfig() 中加载，这里仅作备用
  if (shouldLoad) {
    loadParamsFromStorage();
  }

  /* ========== BPM ========= */
  const bpmSlider = document.getElementById("bpmSlider");
  const bpmValue = document.getElementById("bpmValue");

  bpmSlider.value = synthParams.bpm;
  bpmValue.textContent = synthParams.bpm;

  bpmSlider.addEventListener("input", () => {
    synthParams.bpm = parseInt(bpmSlider.value, 10);
    bpmValue.textContent = synthParams.bpm;
    refreshSequencer(synthParams);
  });


  /* ========== 主音量 ========= */
  const volumeSlider = document.getElementById("volumeSlider");
  const volumeValue = document.getElementById("volumeValue");

  volumeSlider.value = synthParams.volume * 100;
  volumeValue.textContent = Math.round(synthParams.volume * 100) + "%";

  volumeSlider.addEventListener("input", () => {
    synthParams.volume = volumeSlider.value / 100;
    volumeValue.textContent = volumeSlider.value + "%";
    if (masterGain) masterGain.gain.value = synthParams.volume;
  });


  /* ========== ADSR ========== */
  const adsr = [
    ["attackSlider", "attackValue", "attack", "s"],
    ["decaySlider", "decayValue", "decay", "s"],
    ["sustainSlider", "sustainValue", "sustain", ""],
    ["releaseSlider", "releaseValue", "release", "s"],
  ];

  adsr.forEach(([sliderId, labelId, param, suffix]) => {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);

    slider.value = synthParams[param];
    label.textContent = slider.value + suffix;

    slider.addEventListener("input", () => {
      synthParams[param] = parseFloat(slider.value);
      label.textContent = slider.value + suffix;
    });
  });


  /* ========== 波形 ========= */
  const waveSel = document.getElementById("waveformSelect");
  waveSel.value = synthParams.waveform;

  waveSel.addEventListener("change", (e) => {
    synthParams.waveform = e.target.value;
    console.log("🎵 波形已更改:", synthParams.waveform);
  });
  
  // 添加 input 事件确保捕获所有变化
  waveSel.addEventListener("input", (e) => {
    synthParams.waveform = e.target.value;
    console.log("🎵 波形已更改(input):", synthParams.waveform);
  });


  /* ========== Filter ========= */
  const cutoffSlider = document.getElementById("filterCutoffSlider");
  const cutoffLabel = document.getElementById("filterCutoffValue");

  cutoffSlider.value = synthParams.filterCutoff;
  cutoffLabel.textContent = cutoffSlider.value + " Hz";

  cutoffSlider.addEventListener("input", () => {
    synthParams.filterCutoff = parseFloat(cutoffSlider.value);
    cutoffLabel.textContent = cutoffSlider.value + " Hz";
  });


  /* ========== Reverb ========= */

  const reverbDecay = document.getElementById("reverbDecaySlider");
  const reverbDecayValue = document.getElementById("reverbDecayValue");

  const reverbMix = document.getElementById("reverbMixSlider");
  const reverbMixValue = document.getElementById("reverbMixValue");

  const reverbLow = document.getElementById("reverbLowCutSlider");
  const reverbLowValue = document.getElementById("reverbLowCutValue");

  const reverbHigh = document.getElementById("reverbHighCutSlider");
  const reverbHighValue = document.getElementById("reverbHighCutValue");


  // 初始数值
  reverbDecay.value = synthParams.reverbDecay;
  reverbDecayValue.textContent = reverbDecay.value + "s";

  reverbMix.value = synthParams.reverbMix * 100;
  reverbMixValue.textContent = reverbMix.value + "%";

  reverbLow.value = synthParams.reverbLowCut;
  reverbLowValue.textContent = reverbLow.value + " Hz";

  reverbHigh.value = synthParams.reverbHighCut;
  reverbHighValue.textContent = reverbHigh.value + " Hz";


  // 绑定事件
  reverbDecay.addEventListener("input", () => {
    synthParams.reverbDecay = parseFloat(reverbDecay.value);
    reverbDecayValue.textContent = reverbDecay.value + "s";
    updateReverb(synthParams);
  });

  reverbMix.addEventListener("input", () => {
    synthParams.reverbMix = reverbMix.value / 100;
    reverbMixValue.textContent = reverbMix.value + "%";
  });

  reverbLow.addEventListener("input", () => {
    synthParams.reverbLowCut = parseFloat(reverbLow.value);
    reverbLowValue.textContent = reverbLow.value + " Hz";
  });

  reverbHigh.addEventListener("input", () => {
    synthParams.reverbHighCut = parseFloat(reverbHigh.value);
    reverbHighValue.textContent = reverbHigh.value + " Hz";
  });

  /* ========== 保存/加载/重置按钮 ========= */
  const saveBtn = document.getElementById("saveParamsBtn");
  const loadBtn = document.getElementById("loadParamsBtn");
  const resetBtn = document.getElementById("resetParamsBtn");

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const configName = prompt("请输入配置文件名称:");
      if (configName) {
        if (saveConfig(configName)) {
          updateConfigUI();
          alert(`✅ 配置文件 "${configName}" 已保存！`);
        }
      }
    });
  }

  if (loadBtn) {
    loadBtn.addEventListener("click", () => {
      if (confirm("确认要加载保存的参数吗？")) {
        loadParamsFromStorage();
        // 重新初始化所有 UI 控件为加载的值
        location.reload();
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("确认要重置所有参数为默认值吗？")) {
        resetParams();
      }
    });
  }

  /* ========== 配置文件管理 ========= */
  const configSelect = document.getElementById("configSelect");
  const configLoadBtn = document.getElementById("configLoadBtn");
  const configDeleteBtn = document.getElementById("configDeleteBtn");
  const configExportBtn = document.getElementById("configExportBtn");
  const configImportInput = document.getElementById("configImportInput");

  if (configSelect) {
    updateConfigUI();

    // 从下拉列表加载配置
    if (configLoadBtn) {
      configLoadBtn.addEventListener("click", () => {
        const configName = configSelect.value;
        if (configName) {
          if (loadConfig(configName)) {
            location.reload();
          }
        } else {
          alert("❌ 请先选择一个配置文件");
        }
      });
    }

    // 删除配置
    if (configDeleteBtn) {
      configDeleteBtn.addEventListener("click", () => {
        const configName = configSelect.value;
        if (configName) {
          if (confirm(`确认要删除配置 "${configName}" 吗？`)) {
            deleteConfig(configName);
            alert(`✅ 配置 "${configName}" 已删除`);
          }
        } else {
          alert("❌ 请先选择一个配置文件");
        }
      });
    }

    // 导出配置
    if (configExportBtn) {
      configExportBtn.addEventListener("click", () => {
        const configName = configSelect.value;
        if (configName) {
          exportConfig(configName);
        } else {
          alert("❌ 请先选择一个配置文件");
        }
      });
    }

    // 导入配置
    if (configImportInput) {
      configImportInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          importConfigFromFile(file);
          e.target.value = "";
        }
      });
    }
  }

  // 页面卸载时自动保存参数
  window.addEventListener("beforeunload", () => {
    saveParamsToStorage();
  });

  // 调试：打印初始化后的所有参数
  console.log("✅ setupUI() 初始化完成，当前参数:", synthParams);
}

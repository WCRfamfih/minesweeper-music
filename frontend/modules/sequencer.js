/* ============================================
   sequencer.js
   音序器系统：定时 tick，扫描列，播放音符
============================================ */

import { audioCtx, initAudioGraph } from "./audio.js";
import { playPluck } from "./synth.js";
import { flashCell } from "./ripple.js";
import { getGrid } from "./state.js";

/* 当前序列状态 */
let isPlaying = false;
let currentStep = 0;
let intervalId = null;

/* 五声音阶 (C D E G A) */
const pentatonic = [60, 62, 64, 67, 69];

/* 获取频率（上高下低） */
function getRowFreq(row) {
  const reversed = 15 - row;                   // 反转：顶部高音
  const index = reversed % pentatonic.length;
  const octave = Math.floor(reversed / pentatonic.length);
  return midiToFreq(pentatonic[index] + octave * 12);
}

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/* ============================================
   序列 tick()
   每次扫描 1 列，播放旗子所在的音符
============================================ */
function tick(synthParams) {
  const grid = getGrid();
  if (!grid.length) return;

  const step = currentStep % 16;

  // 扫描 16 行
  for (let r = 0; r < 16; r++) {
    const cell = grid[r][step];
    if (cell.flagged) {
      const freq = getRowFreq(r);
      playPluck(freq, synthParams);
      flashCell(r, step);
    }
  }

  currentStep++;
}

/* ============================================
   BPM 更新 → 重设 tick 间隔
============================================ */
function updateInterval(synthParams) {
  if (!isPlaying) return;
  if (intervalId) clearInterval(intervalId);

  const interval = (60000 / synthParams.bpm) / 4; // 16 步一个小节
  intervalId = setInterval(() => tick(synthParams), interval);
}

/* ============================================
   启动音序器（自动播放）
============================================ */
export function startSequencer(synthParams) {
  if (!audioCtx) initAudioGraph(synthParams);
  if (isPlaying) return;

  isPlaying = true;
  currentStep = 0;
  updateInterval(synthParams);
}

/* ============================================
   停止音序器
============================================ */
export function stopSequencer() {
  isPlaying = false;
  if (intervalId) clearInterval(intervalId);
}

/* ============================================
   BPM 更新
============================================ */
export function refreshSequencer(synthParams) {
  updateInterval(synthParams);
}

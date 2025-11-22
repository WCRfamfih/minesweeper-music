/* ============================================
   sequencer.js
   音序器系统：定时 tick，扫描列，播放音符
============================================ */

import { audioCtx, initAudioGraph, playSampleBuffer, getSampleBuffer } from "./audio.js";
import { playPluck } from "./synth.js";
import { flashCell } from "./ripple.js";
import { getGrid, getRowAudioConfig, getRowPitchOverride } from "./state.js";

/* 当前序列状态 */
let isPlaying = false;
let currentStep = 0;
let intervalId = null;

/* 五声音阶 (C D E G A) - 相对 C 的半音偏移 */
const pentOffsets = [0, 2, 4, 7, 9];

/* 获取频率（上高下低） */
function getRowFreq(row, totalRows) {
  const overrideMidi = getRowPitchOverride(row);
  if (typeof overrideMidi === "number") {
    return midiToFreq(overrideMidi);
  }

  const rows = totalRows || 16;
  const bottomToTop = rows - 1 - row;          // 0 = 最底行

  // 按五声音阶逐行上行：C D E G A，每 5 行进入下一音区
  const stepIndex = Math.max(0, bottomToTop);
  const noteIndex = stepIndex % pentOffsets.length;
  const octave = Math.floor(stepIndex / pentOffsets.length);

  const baseC = 48; // C3
  const midi = baseC + pentOffsets[noteIndex] + octave * 12;
  const clampedMidi = Math.min(midi, 108); // 避免超过 C8
  return midiToFreq(clampedMidi);
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
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  if (!rows || !cols) return;

  const step = currentStep % cols;

  for (let r = 0; r < rows; r++) {
    const cell = grid[r][step];
    if (cell.flagged) {
      const rowAudio = getRowAudioConfig(r);
      const useSample = rowAudio && rowAudio.mode && rowAudio.mode !== "synth" && rowAudio.sampleId;
      const buffer = useSample ? getSampleBuffer(rowAudio.sampleId) : null;

      if (buffer) {
        const vol = typeof rowAudio.volume === "number" ? rowAudio.volume : 1;
        playSampleBuffer(buffer, vol);
      } else {
        const freq = getRowFreq(r, rows);
        playPluck(freq, synthParams);
      }

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

  // 以 16 分音符为步长，不同棋盘宽度对应 1/2/4 小节循环
  const interval = (60000 / synthParams.bpm) / 4;
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

export function resetSequencerPosition() {
  currentStep = 0;
}

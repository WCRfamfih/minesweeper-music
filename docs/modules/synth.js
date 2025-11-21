/* ============================================
   synth.js
   合成器模块：波形 / ADSR / 滤波器 / Reverb Dry/Wet
============================================ */

import {
  audioCtx,
  masterCompressor,
  reverbLowCut,
  buildReverbImpulse
} from "./audio.js";

/* 
synthParams 由 ui.js 更新并传入
{
  attack, decay, sustain, release,
  filterCutoff, filterQ,
  waveform,
  reverbMix, reverbDecay
}
*/

export function playPluck(freq, synthParams) {
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  /* ========= 节点创建 ========= */

  const osc = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const amp = audioCtx.createGain();
  const dry = audioCtx.createGain();
  const wet = audioCtx.createGain();

  /* ========= 设定振荡器 ========= */
  osc.type = synthParams.waveform;  // 用户选择：sine/saw/square/triangle
  osc.frequency.value = freq;

  /* ========= 设定滤波器 ========= */
  filter.type = "lowpass";
  filter.frequency.value = synthParams.filterCutoff;
  filter.Q.value = synthParams.filterQ;

  /* ========= ADSR 包络 ========= */

  const A = synthParams.attack;
  const D = synthParams.decay;
  const S = synthParams.sustain;
  const R = synthParams.release;

  amp.gain.cancelScheduledValues(now);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.linearRampToValueAtTime(1.0, now + A);
  amp.gain.linearRampToValueAtTime(S, now + A + D);

  const sustainHold = 0.15;  // pluck 的主体保持时间
  const releaseStart = now + A + D + sustainHold;

  amp.gain.setValueAtTime(S, releaseStart);
  amp.gain.linearRampToValueAtTime(0.0001, releaseStart + R);

  /* ========= 干/湿比（混响） ========= */

  dry.gain.value = 1 - synthParams.reverbMix;
  wet.gain.value = synthParams.reverbMix;

  /* ========= 连接 ========= */

  osc.connect(filter);
  filter.connect(amp);

  // 干信号 → 压缩器
  amp.connect(dry);
  dry.connect(masterCompressor);

  // 湿信号 → 混响 → 压缩器
  amp.connect(wet);
  wet.connect(reverbLowCut);

  /* ========= 启动振荡器 ========= */

  osc.start(now);
  osc.stop(releaseStart + R + 0.05);
}

/* ============================================
   更新混响脉冲（供 ui.js 调用）
============================================ */
export function updateReverb(synthParams) {
  buildReverbImpulse(synthParams.reverbDecay);
}

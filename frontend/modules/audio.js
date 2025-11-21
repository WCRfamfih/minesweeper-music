/* ============================================
   audio.js
   音频总线：Compressor / Limiter / Reverb / Gain
============================================ */

export let audioCtx = null;

export let masterCompressor = null;
export let masterLimiter = null;
export let masterGain = null;

export let reverbLowCut = null;
export let reverbHighCut = null;
export let reverbNode = null;

/* ============================================
   构建混响脉冲（简单指数衰减噪声）
============================================ */
export function buildReverbImpulse(reverbDecay) {
  if (!audioCtx || !reverbNode) return;

  const rate = audioCtx.sampleRate;
  const length = Math.max(500, Math.floor(rate * reverbDecay));
  const impulse = audioCtx.createBuffer(2, length, rate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // 指数衰减噪声
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3);
    }
  }

  reverbNode.buffer = impulse;
}

/* ============================================
   初始化音频系统
   (AudioContext, Compressor, Limiter, Reverb)
============================================ */
export function initAudioGraph(synthParams) {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  /* --- Compressor --- */
  masterCompressor = audioCtx.createDynamicsCompressor();
  masterCompressor.threshold.value = -24;
  masterCompressor.knee.value = 30;
  masterCompressor.ratio.value = 12;
  masterCompressor.attack.value = 0.003;
  masterCompressor.release.value = 0.25;

  /* --- Limiter（硬限制） --- */
  masterLimiter = audioCtx.createDynamicsCompressor();
  masterLimiter.threshold.value = -3;
  masterLimiter.knee.value = 0;
  masterLimiter.ratio.value = 20;
  masterLimiter.attack.value = 0.001;
  masterLimiter.release.value = 0.05;

  /* --- 总音量 --- */
  masterGain = audioCtx.createGain();
  masterGain.gain.value = synthParams.volume;

  /* --- 混响滤波 --- */
  reverbLowCut = audioCtx.createBiquadFilter();
  reverbLowCut.type = "highpass";
  reverbLowCut.frequency.value = synthParams.reverbLowCut;

  reverbHighCut = audioCtx.createBiquadFilter();
  reverbHighCut.type = "lowpass";
  reverbHighCut.frequency.value = synthParams.reverbHighCut;

  /* --- Convolver Reverb --- */
  reverbNode = audioCtx.createConvolver();
  buildReverbImpulse(synthParams.reverbDecay);

  /* ========== 连接信号链 ========== */

  // Reverb chain
  reverbLowCut.connect(reverbHighCut);
  reverbHighCut.connect(reverbNode);
  reverbNode.connect(masterCompressor);

  // Master chain
  masterCompressor.connect(masterLimiter);
  masterLimiter.connect(masterGain);
  masterGain.connect(audioCtx.destination);
}

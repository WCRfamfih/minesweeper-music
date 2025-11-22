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

const sampleBuffers = new Map();

export const builtinSamples = [
  { id: "clap-1", name: "Cymatics - Eternity Clap 1", url: "./simples/Cymatics - Eternity Clap 1.wav" },
  { id: "clap-2", name: "Cymatics - Eternity Clap 2", url: "./simples/Cymatics - Eternity Clap 2.wav" },
  { id: "clap-3", name: "Cymatics - Eternity Clap 3", url: "./simples/Cymatics - Eternity Clap 3.wav" },
  { id: "kick-1c", name: "Cymatics - Eternity Kick 1 - C", url: "./simples/Cymatics - Eternity Kick 1 - C.wav" },
  { id: "kick-2c", name: "Cymatics - Eternity Kick 2 - C", url: "./simples/Cymatics - Eternity Kick 2 - C.wav" },
  { id: "kick-3c", name: "Cymatics - Eternity Kick 3 - C", url: "./simples/Cymatics - Eternity Kick 3 - C.wav" },
  { id: "rimshot-1", name: "Cymatics - Eternity Rimshot 1", url: "./simples/Cymatics - Eternity Rimshot 1.wav" },
  { id: "rimshot-2", name: "Cymatics - Eternity Rimshot 2", url: "./simples/Cymatics - Eternity Rimshot 2.wav" },
  { id: "rimshot-3", name: "Cymatics - Eternity Rimshot 3", url: "./simples/Cymatics - Eternity Rimshot 3.wav" },
  { id: "rimshot-4", name: "Cymatics - Eternity Rimshot 4", url: "./simples/Cymatics - Eternity Rimshot 4.wav" },
  { id: "rimshot-5", name: "Cymatics - Eternity Rimshot 5", url: "./simples/Cymatics - Eternity Rimshot 5.wav" },
  { id: "snap-6", name: "Cymatics - Eternity Snap 6", url: "./simples/Cymatics - Eternity Snap 6.wav" },
  { id: "snap-8", name: "Cymatics - Eternity Snap 8", url: "./simples/Cymatics - Eternity Snap 8.wav" },
];

export function getBuiltinSamples() {
  return [...builtinSamples];
}

export function getSampleBuffer(id) {
  return sampleBuffers.get(id) || null;
}

export function registerSampleBuffer(id, buffer) {
  if (!id || !buffer) return null;
  sampleBuffers.set(id, buffer);
  return buffer;
}

async function decodeToBuffer(arrayBuffer, id) {
  if (!audioCtx) return null;
  const buffer = await audioCtx.decodeAudioData(arrayBuffer);
  if (id) sampleBuffers.set(id, buffer);
  return buffer;
}

export async function loadBuiltinSample(id) {
  const item = builtinSamples.find((b) => b.id === id);
  if (!item || !audioCtx) return null;
  if (sampleBuffers.has(item.id)) return sampleBuffers.get(item.id);

  const res = await fetch(item.url);
  const arrayBuffer = await res.arrayBuffer();
  return decodeToBuffer(arrayBuffer, item.id);
}

export async function loadFileSample(file, id) {
  if (!file || !audioCtx) return null;
  const arrayBuffer = await file.arrayBuffer();
  return decodeToBuffer(arrayBuffer, id);
}

export function playSampleBuffer(buffer, volume = 1) {
  if (!audioCtx || !buffer) return null;

  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();

  gain.gain.value = Math.max(0, Math.min(volume, 2));

  source.buffer = buffer;
  source.connect(gain);

  if (masterCompressor) {
    gain.connect(masterCompressor);
  } else {
    gain.connect(audioCtx.destination);
  }

  source.start();
  return source;
}

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

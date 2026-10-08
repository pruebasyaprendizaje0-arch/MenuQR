const fs = require('fs');
const path = require('path');

function createWavBuffer(sampleRate, samples) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF chunk descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intVal = s < 0 ? s * 32768 : s * 32767;
    buffer.writeInt16LE(Math.floor(intVal), offset);
    offset += 2;
  }

  return buffer;
}

const sampleRate = 44100;

// 1. NUEVO PEDIDO: Campana brillante triple ascendente (C6 -> G6 -> C7)
function generateNuevoPedido() {
  const duration = 1.2;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  const notes = [
    { start: 0.0, freq1: 1046.5, freq2: 1318.5, dur: 0.35, amp: 0.4 },
    { start: 0.22, freq1: 1567.98, freq2: 2093.0, dur: 0.45, amp: 0.5 },
    { start: 0.45, freq1: 2093.0, freq2: 2637.0, dur: 0.7, amp: 0.55 },
  ];

  for (const note of notes) {
    const startSample = Math.floor(note.start * sampleRate);
    const endSample = Math.min(totalSamples, Math.floor((note.start + note.dur) * sampleRate));
    for (let i = startSample; i < endSample; i++) {
      const t = (i - startSample) / sampleRate;
      const decay = Math.exp(-t * 6.5);
      const wave = 0.6 * Math.sin(2 * Math.PI * note.freq1 * t) +
                   0.4 * Math.sin(2 * Math.PI * note.freq2 * t);
      samples[i] += wave * decay * note.amp;
    }
  }

  return createWavBuffer(sampleRate, samples);
}

// 2. EN COCINA: Tono de confirmación / marcha a cocina (A5 -> E6)
function generateEnCocina() {
  const duration = 0.8;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  const notes = [
    { start: 0.0, freq1: 880.0, freq2: 1108.7, dur: 0.35, amp: 0.4 },
    { start: 0.16, freq1: 1318.5, freq2: 1661.2, dur: 0.6, amp: 0.5 },
  ];

  for (const note of notes) {
    const startSample = Math.floor(note.start * sampleRate);
    const endSample = Math.min(totalSamples, Math.floor((note.start + note.dur) * sampleRate));
    for (let i = startSample; i < endSample; i++) {
      const t = (i - startSample) / sampleRate;
      const decay = Math.exp(-t * 5.0);
      const wave = 0.7 * Math.sin(2 * Math.PI * note.freq1 * t) +
                   0.3 * Math.sin(2 * Math.PI * note.freq2 * t);
      samples[i] += wave * decay * note.amp;
    }
  }

  return createWavBuffer(sampleRate, samples);
}

// 3. LISTO PARA SERVIR: Campana de servicio de mostrador (Ding! C6 + C7 con resonancia armónica de latón)
function generateListoParaServir() {
  const duration = 1.6;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // Campana de latón: fundamental 2093Hz (C7) + armónicos
    const decay1 = Math.exp(-t * 3.2);
    const decay2 = Math.exp(-t * 5.5);
    const wave = 0.5 * Math.sin(2 * Math.PI * 2093.0 * t) * decay1 +
                 0.3 * Math.sin(2 * Math.PI * 1046.5 * t) * decay1 +
                 0.15 * Math.sin(2 * Math.PI * 3135.9 * t) * decay2 +
                 0.05 * Math.sin(2 * Math.PI * 4186.0 * t) * decay2;
    samples[i] = wave * 0.65;
  }

  return createWavBuffer(sampleRate, samples);
}

const soundsDir = path.join(__dirname, '..', 'public', 'sounds');
if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}

fs.writeFileSync(path.join(soundsDir, 'nuevo-pedido.wav'), generateNuevoPedido());
fs.writeFileSync(path.join(soundsDir, 'en-cocina.wav'), generateEnCocina());
fs.writeFileSync(path.join(soundsDir, 'listo-servir.wav'), generateListoParaServir());

console.log('✅ Sonidos generados exitosamente en public/sounds/:');
console.log('- nuevo-pedido.wav');
console.log('- en-cocina.wav');
console.log('- listo-servir.wav');

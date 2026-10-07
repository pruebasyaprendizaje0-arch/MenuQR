import fs from "fs";
import path from "path";

// Generar un tono armónico ding/chime agradable (acorde de campanilla C6 + G6 con decay exponencial)
function generateWavBell(): Buffer {
  const sampleRate = 44100;
  const duration = 0.8; // 800ms
  const numSamples = Math.floor(sampleRate * duration);
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit PCM

  const buffer = Buffer.alloc(44 + numSamples * bytesPerSample);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * bytesPerSample, 4);
  buffer.write("WAVE", 8);

  // fmt subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // byteRate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // blockAlign
  buffer.writeUInt16LE(16, 34); // bitsPerSample

  // data subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * bytesPerSample, 40);

  // Frecuencias: F5 (698.46 Hz) + C6 (1046.5 Hz) + G6 (1567.98 Hz)
  const f1 = 1046.5;
  const f2 = 1318.51;
  const f3 = 1567.98;

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const decay = Math.exp(-4.5 * t);
    const sample =
      decay *
      (0.5 * Math.sin(2 * Math.PI * f1 * t) +
        0.3 * Math.sin(2 * Math.PI * f2 * t) +
        0.2 * Math.sin(2 * Math.PI * f3 * t));

    const intVal = Math.floor(Math.max(-1, Math.min(1, sample)) * 32767);
    buffer.writeInt16LE(intVal, offset);
    offset += 2;
  }

  return buffer;
}

const dir = path.join(process.cwd(), "public", "sounds");
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const audio = generateWavBell();
fs.writeFileSync(path.join(dir, "new-order.mp3"), audio);
fs.writeFileSync(path.join(dir, "new-order.wav"), audio);
console.log("Audio generado exitosamente en public/sounds/new-order.mp3");

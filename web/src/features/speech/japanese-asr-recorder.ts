import { JAPANESE_ASR_MAX_SECONDS, JAPANESE_ASR_SAMPLE_RATE } from "./japanese-asr-decode";

/** Audio stays in memory. Only the resampled mono PCM is sent to our local worker. */
export async function recordJapaneseReading(signal: AbortSignal, onListening: (finish: () => void) => void): Promise<Float32Array> {
  signal.throwIfAborted();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
  if (signal.aborted) { stream.getTracks().forEach(track => track.stop()); signal.throwIfAborted(); }
  let context: AudioContext | undefined;
  try {
    context = new AudioContext();
    await context.resume();
    signal.throwIfAborted();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const recorder = new MediaRecorder(stream);
    const blob = await new Promise<Blob>((resolve, reject) => {
      const chunks: Blob[] = [];
      const waveform = new Float32Array(analyser.fftSize);
      let heardSpeech = false;
      let lastSpeech = performance.now();
      const finish = () => { if (recorder.state !== "inactive") recorder.stop(); };
      const abort = () => { finish(); reject(signal.reason ?? new DOMException("Recording cancelled.", "AbortError")); };
      const maxTimer = setTimeout(finish, JAPANESE_ASR_MAX_SECONDS * 1000);
      const silenceTimer = setInterval(() => {
        analyser.getFloatTimeDomainData(waveform);
        const rms = Math.sqrt(waveform.reduce((sum, sample) => sum + sample * sample, 0) / waveform.length);
        if (rms > 0.015) { heardSpeech = true; lastSpeech = performance.now(); }
        if (heardSpeech && performance.now() - lastSpeech > 900) finish();
      }, 100);
      const cleanup = () => {
        clearTimeout(maxTimer); clearInterval(silenceTimer);
        signal.removeEventListener("abort", abort);
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { cleanup(); reject(new Error("The microphone recording failed. Try again or type your answer.")); };
      recorder.onstop = () => { cleanup(); resolve(new Blob(chunks, { type: recorder.mimeType })); };
      signal.addEventListener("abort", abort, { once: true });
      try { signal.throwIfAborted(); recorder.start(); onListening(finish); }
      catch (error) { cleanup(); reject(error); }
    });
    signal.throwIfAborted();
    if (!blob.size) throw new Error("No audio was recorded. Try again or type your answer.");
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    signal.throwIfAborted();
    const length = Math.min(Math.ceil(audio.duration * JAPANESE_ASR_SAMPLE_RATE), JAPANESE_ASR_MAX_SECONDS * JAPANESE_ASR_SAMPLE_RATE);
    const offline = new OfflineAudioContext(1, Math.max(1, length), JAPANESE_ASR_SAMPLE_RATE);
    const input = offline.createBufferSource();
    input.buffer = audio;
    input.connect(offline.destination);
    input.start();
    const result = await offline.startRendering();
    signal.throwIfAborted();
    return result.getChannelData(0).slice();
  } finally {
    stream.getTracks().forEach(track => track.stop());
    await context?.close().catch(() => undefined);
  }
}

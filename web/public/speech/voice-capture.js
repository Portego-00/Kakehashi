/* Raw mono PCM remains inside the page and its local recognition worker. */
class ReviewVoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = new Float32Array(Math.round(sampleRate * 0.032));
    this.offset = 0;
  }
  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let sample = 0;
      for (const channel of channels) sample += channel[i];
      this.frame[this.offset++] = sample / channels.length;
      if (this.offset === this.frame.length) {
        this.port.postMessage(this.frame, [this.frame.buffer]);
        this.frame = new Float32Array(Math.round(sampleRate * 0.032));
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor("review-voice-capture", ReviewVoiceCapture);

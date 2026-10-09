import { Audio } from "./expoAvCompat";

export async function playBunproFeedback(correct: boolean) {
  try {
    const { sound } = await Audio.Sound.createAsync(correct ? require("../../assets/audio/bunpro-correct.wav") : require("../../assets/audio/bunpro-incorrect.wav"), { shouldPlay: false, volume: 0.45 });
    sound.setOnPlaybackStatusUpdate(status => { if (status.isLoaded && status.didJustFinish) void sound.unloadAsync(); });
    await sound.playAsync();
  } catch { /* Feedback is optional; answer grading must remain available. */ }
}

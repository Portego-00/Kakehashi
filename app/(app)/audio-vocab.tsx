import React from "react";
import ExtraStudyModeAccess from "../../src/components/ExtraStudyModeAccess";
import AudioVocabScreen from "../../src/screens/audio-vocab-screen";

export default function AudioVocabRoute() {
  return (
    <ExtraStudyModeAccess modeId="audio-vocab">
      <AudioVocabScreen />
    </ExtraStudyModeAccess>
  );
}

import PortegoOnlyScreen from "../../src/components/PortegoOnlyScreen";
import { JlptSessionScreen } from "../../src/features/jlpt/jlpt-session-screen";

export default function JlptSessionRoute() {
  return (
    <PortegoOnlyScreen featureName="JLPT Quiz">
      <JlptSessionScreen />
    </PortegoOnlyScreen>
  );
}

import PortegoOnlyScreen from "../../src/components/PortegoOnlyScreen";
import { JlptHubScreen } from "../../src/features/jlpt/jlpt-hub-screen";

export default function JlptRoute() {
  return (
    <PortegoOnlyScreen featureName="JLPT Quiz">
      <JlptHubScreen />
    </PortegoOnlyScreen>
  );
}

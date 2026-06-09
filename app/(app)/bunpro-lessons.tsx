import { useActivityTracking } from "../../src/hooks/useActivityTracking";
import BunproLessonScreen from "../../src/screens/BunproLessonScreen";

export default function BunproLessonsRoute() {
  useActivityTracking("bunpro_lessons");
  return <BunproLessonScreen />;
}

import { useActivityTracking } from "../../src/hooks/useActivityTracking";
import BunproReviewScreen from "../../src/screens/BunproReviewScreen";

export default function BunproReviewsRoute() {
  useActivityTracking("bunpro_reviews");
  return <BunproReviewScreen />;
}

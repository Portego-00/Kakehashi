import type { Metadata } from "next";
import { PublicProgressSnapshot } from "@/features/progress/components/PublicProgressSnapshot";

export const metadata: Metadata = {
  title: "Shared Progress",
  description: "A saved WaniKani progress snapshot shared with Kakehashi.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function SharedProgressPage() {
  return <PublicProgressSnapshot />;
}

import type { Metadata } from "next";
import { VideoWorkspace } from "@/features/content/video";

export const metadata: Metadata = { title: "Video immersion" };
export default function VideoPage() { return <VideoWorkspace />; }

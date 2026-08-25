import type { Metadata } from "next";
import { SettingsWorkspace } from "@/features/settings/components/SettingsWorkspace";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() { return <SettingsWorkspace />; }

import { AppShell } from "@/components/shell/AppShell";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) { return <AppShell>{children}</AppShell>; }

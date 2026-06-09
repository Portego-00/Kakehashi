import { ProductShell } from "@/components/ProductShell";
import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <ProductShell>{children}</ProductShell>;
}

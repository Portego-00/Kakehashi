import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import styles from "./ui.module.css";

export function Card({ padding = "md", interactive = false, className, ...props }: HTMLAttributes<HTMLDivElement> & { padding?: "none" | "sm" | "md" | "lg"; interactive?: boolean }) {
  return <div className={cn(styles.card, interactive && styles.cardInteractive, padding !== "none" && styles[`cardPadding${padding[0].toUpperCase()}${padding.slice(1)}`], className)} {...props} />;
}

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import styles from "./ui.module.css";

export function Badge({ tone = "default", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "radical" | "kanji" | "vocabulary" | "danger" | "success" }) {
  return <span className={cn(styles.badge, tone !== "default" && styles[`badge${tone[0].toUpperCase()}${tone.slice(1)}`], className)} {...props} />;
}

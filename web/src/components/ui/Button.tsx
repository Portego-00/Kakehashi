import { Check, CircleAlert } from "lucide-react";
import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./ui.module.css";

export type ButtonTone = "default" | "primary" | "accent" | "danger" | "ghost";
export type ButtonState = "idle" | "loading" | "error" | "success";
type ButtonVisualProps = { children: ReactNode; tone?: ButtonTone; size?: "default" | "small"; wide?: boolean; state?: ButtonState };

function buttonClassName({ tone = "default", size = "default", wide = false, className }: Omit<ButtonVisualProps, "children" | "state"> & { className?: string }) {
  return cn(styles.button, styles[`button${tone[0].toUpperCase()}${tone.slice(1)}`], size === "small" && styles.buttonSmall, wide && styles.buttonWide, className);
}

export function Button({ children, tone = "default", size = "default", wide = false, state = "idle", disabled, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & ButtonVisualProps) {
  const icon = state === "loading" ? <span className={styles.spinner} aria-hidden /> : state === "error" ? <CircleAlert size={16} aria-hidden /> : state === "success" ? <Check size={16} aria-hidden /> : null;
  return (
    <button className={buttonClassName({ tone, size, wide, className })} data-state={state} disabled={disabled || state === "loading"} aria-busy={state === "loading"} {...props}>
      {icon}{children}
    </button>
  );
}

export function ButtonLink({ children, tone = "default", size = "default", wide = false, state = "idle", disabled = false, className, onClick, ...props }: LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & ButtonVisualProps & { disabled?: boolean }) {
  const icon = state === "loading" ? <span className={styles.spinner} aria-hidden /> : state === "error" ? <CircleAlert size={16} aria-hidden /> : state === "success" ? <Check size={16} aria-hidden /> : null;
  return <Link {...props} className={buttonClassName({ tone, size, wide, className })} data-state={state} aria-disabled={disabled || state === "loading"} aria-busy={state === "loading"} tabIndex={disabled ? -1 : undefined} onClick={(event) => { if (disabled || state === "loading") event.preventDefault(); onClick?.(event); }}>{icon}{children}</Link>;
}

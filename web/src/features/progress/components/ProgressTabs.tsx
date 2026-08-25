import { BarChart3, ChartNoAxesColumnIncreasing, Library } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "../progress.module.css";

type ProgressDestination = "level" | "items" | "analytics";

const DESTINATIONS = [
  { id: "level" as const, href: "/progress", label: "Level", icon: BarChart3 },
  { id: "items" as const, href: "/items", label: "Items", icon: Library },
  { id: "analytics" as const, href: "/analytics", label: "Analytics", icon: ChartNoAxesColumnIncreasing },
];

export function ProgressTabs({ active, action }: { active: ProgressDestination; action?: ReactNode }) {
  return <div className={styles.progressTabsRow}><nav className={styles.progressTabs} aria-label="Progress views">{DESTINATIONS.map((destination) => <Link key={destination.id} href={destination.href} aria-current={active === destination.id ? "page" : undefined}><destination.icon size={15} aria-hidden /><span>{destination.label}</span></Link>)}</nav>{action ? <div className={styles.progressTabsAction}>{action}</div> : null}</div>;
}

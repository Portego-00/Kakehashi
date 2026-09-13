import Image from "next/image";
import { cn } from "@/lib/cn";
import styles from "./KakehashiBrand.module.css";

type KakehashiBrandProps = {
  className?: string;
  markClassName?: string;
  showName?: boolean;
};

export function KakehashiBrand({
  className,
  markClassName,
  showName = true,
}: KakehashiBrandProps) {
  return (
    <span className={cn(styles.brand, className)}>
      <Image
        className={cn(styles.mark, markClassName)}
        src="/brand/kakehashi-mark.png"
        alt=""
        width={600}
        height={600}
        loading="eager"
        sizes="64px"
        aria-hidden="true"
      />
      {showName ? <span className={styles.name}>Kakehashi</span> : null}
    </span>
  );
}

"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { KakehashiBrand } from "@/components/brand/KakehashiBrand";
import { cn } from "@/lib/cn";
import { gravatarUrl } from "@/lib/gravatar";
import styles from "./UserAvatar.module.css";

let browserCacheToken = "";
const noopSubscribe = () => () => {};
const getBrowserCacheToken = () => {
  browserCacheToken ||= Date.now().toString();
  return browserCacheToken;
};

export function UserAvatar({ email, className }: { email: string; className?: string }) {
  const cacheToken = useSyncExternalStore(noopSubscribe, getBrowserCacheToken, () => "");
  const src = cacheToken ? gravatarUrl(email, 32, cacheToken) : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  return (
    <span className={cn(styles.avatar, className)}>
      <KakehashiBrand className={styles.fallback} showName={false} />
      {src && failedSrc !== src ? (
        <Image
          className={styles.image}
          src={src}
          alt=""
          width={64}
          height={64}
          sizes="32px"
          unoptimized
          onError={() => setFailedSrc(src)}
        />
      ) : null}
    </span>
  );
}

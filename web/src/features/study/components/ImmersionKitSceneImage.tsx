"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { retryImmersionKitMediaUrl } from "../../../../../shared/immersion-kit-media";

type SceneImageProps = Pick<ImageProps, "alt" | "className" | "height" | "sizes" | "width"> & { src: string };

function passthroughImageLoader({ src }: { src: string }) {
  return src;
}

export function ImmersionKitSceneImage(props: SceneImageProps) {
  return <SceneImage key={props.src} {...props} />;
}

function SceneImage({ src, alt, ...props }: SceneImageProps) {
  const [source, setSource] = useState<string | null>(src);
  if (!source) return null;

  return <Image
    {...props}
    key={source}
    src={source}
    alt={alt}
    loader={passthroughImageLoader}
    unoptimized
    onError={() => {
      const retry = source === src ? retryImmersionKitMediaUrl(src) : null;
      const next = retry === source ? null : retry;
      setSource((current) => current === source ? next : current);
    }}
  />;
}

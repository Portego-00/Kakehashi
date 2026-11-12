import React, { useState, type ReactNode } from "react";
import { Image, type ImageProps } from "react-native";
import { retryImmersionKitImageUrl } from "../../shared/immersion-kit-media";

type SceneImageProps = Pick<ImageProps, "style" | "resizeMode" | "accessibilityLabel"> & {
  uri: string;
  fallback?: ReactNode;
};

export function ImmersionKitSceneImage(props: SceneImageProps) {
  return <SceneImage key={props.uri} {...props} />;
}

function SceneImage({ uri, fallback, ...props }: SceneImageProps) {
  const [source, setSource] = useState<string | null>(uri);
  if (!source) return fallback ?? null;

  return (
    <Image
      {...props}
      key={source}
      source={{ uri: source }}
      onError={() => {
        const retry = source === uri ? retryImmersionKitImageUrl(uri) : null;
        const next = retry === source ? null : retry;
        setSource((current) => current === source ? next : current);
      }}
    />
  );
}

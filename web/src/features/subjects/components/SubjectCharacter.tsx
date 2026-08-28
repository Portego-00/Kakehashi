"use client";

import Image, { type ImageLoader } from "next/image";
import { useId, useState, type ComponentPropsWithoutRef, type CSSProperties } from "react";
import type { Subject } from "@/types/wanikani";
import { pickBestImage, pickBestPng, type PreferredRadicalImage } from "../../../../../src/utils/radicalImage";

type ImageTone = "light" | "dark" | "original" | "subject";

export interface SubjectCharacterProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  subject: Subject;
  fallbackText?: string;
  imageSize?: CSSProperties["width"];
  imageTone?: ImageTone;
  eager?: boolean;
}

const passthroughImageLoader: ImageLoader = ({ src }) => src;

function primaryMeaning(subject: Subject) {
  return subject.data.meanings.find((meaning) => meaning.primary)?.meaning ?? subject.data.meanings[0]?.meaning ?? subject.data.slug;
}

function imageFilter(tone: ImageTone, subjectTintFilterId: string) {
  if (tone === "light") return "brightness(0) invert(1)";
  if (tone === "dark") return "brightness(0)";
  if (tone === "subject") return `url("#${subjectTintFilterId}")`;
  return undefined;
}

function imageCandidates(subject: Subject): PreferredRadicalImage[] {
  if (subject.object !== "radical" || subject.data.characters) return [];
  const images = subject.data.character_images;
  const ordered = [
    pickBestImage(images),
    pickBestPng(images),
    ...(images ?? []).map((image): PreferredRadicalImage => ({ type: image.content_type === "image/svg+xml" ? "svg" : "png", url: image.url })),
  ];
  const seen = new Set<string>();
  return ordered.filter((image): image is PreferredRadicalImage => {
    if (!image?.url || seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  });
}

export function SubjectCharacter({
  subject,
  fallbackText,
  imageSize = "1em",
  imageTone = "light",
  eager = false,
  ...spanProps
}: SubjectCharacterProps) {
  const generatedId = useId();
  const subjectTintFilterId = `subject-image-${generatedId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const characters = subject.data.characters;
  const candidates = imageCandidates(subject);
  const imageIdentity = `${subject.id}:${candidates.map((candidate) => candidate.url).join("|")}`;
  const [failedImages, setFailedImages] = useState<{ identity: string; urls: string[] }>({ identity: "", urls: [] });
  const failedUrls = failedImages.identity === imageIdentity ? failedImages.urls : [];
  const image = candidates.find((candidate) => !failedUrls.includes(candidate.url));
  const meaning = primaryMeaning(subject);

  return <span
    {...spanProps}
    data-has-character-image={image ? true : undefined}
    lang={characters ? spanProps.lang ?? "ja" : spanProps.lang}
  >
    {characters ?? (image ? <>
      {imageTone === "subject" ? <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: "absolute", overflow: "hidden" }}>
        <filter id={subjectTintFilterId} data-subject-image-tint colorInterpolationFilters="sRGB">
          <feFlood floodColor="currentColor" result="subjectColor" />
          <feComposite in="subjectColor" in2="SourceAlpha" operator="in" />
        </filter>
      </svg> : null}
      <Image
        key={image.url}
        src={image.url}
        alt={`${meaning} radical`}
        width={160}
        height={160}
        sizes="(max-width: 40rem) 35vw, 10rem"
        style={{ display: "block", width: imageSize, height: imageSize, maxWidth: "100%", maxHeight: "100%", objectFit: "contain", filter: imageFilter(imageTone, subjectTintFilterId) }}
        loader={passthroughImageLoader}
        loading={eager ? "eager" : "lazy"}
        onError={() => setFailedImages((current) => {
          const urls = current.identity === imageIdentity ? current.urls : [];
          return urls.includes(image.url) ? current : { identity: imageIdentity, urls: [...urls, image.url] };
        })}
        unoptimized
      />
    </> : fallbackText ?? (subject.object === "radical" ? meaning : subject.data.slug))}
  </span>;
}

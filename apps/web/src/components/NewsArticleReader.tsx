"use client";

import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import {
  getJpdbTokensForSlice,
  HighlightedJapaneseText,
  JapaneseStudyToolbar,
  useJapaneseStudyText,
  VocabularyTooltip,
} from "@/components/JapaneseStudyText";
import {
  getNhkEasyMatchingText,
  type NhkEasyContentBlock,
  type NhkEasyItem,
} from "@/lib/nhk-easy";

export function NewsArticleReader({
  blocks,
  item,
}: {
  blocks: NhkEasyContentBlock[];
  item: NhkEasyItem;
}) {
  const matchingText = useMemo(() => getNhkEasyMatchingText(blocks), [blocks]);
  const blockOffsets = useMemo(() => {
    let cursor = 0;
    return blocks.map((block) => {
      if (block.type !== "text") return null;
      const start = cursor;
      cursor += block.content.length + 1;
      return start;
    });
  }, [blocks]);
  const study = useJapaneseStudyText(matchingText);

  return (
    <div>
      <JapaneseStudyToolbar
        actions={
          <a
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
            href={item.link}
            rel="noopener noreferrer"
            target="_blank"
          >
            Source
            <ExternalLink className="h-4 w-4" />
          </a>
        }
        onStudyModeChange={study.setStudyMode}
        status={study.status}
        studyMode={study.studyMode}
      />

      {study.message ? (
        <p className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          {study.message}
        </p>
      ) : null}

      <article className="mt-8 rounded-lg border border-white/10 bg-white/[0.03] p-5 md:p-8">
        <div className="space-y-6">
          {blocks.map((block, index) => {
            if (block.type === "image") {
              return (
                <img
                  alt=""
                  className="max-h-[420px] w-full rounded-lg object-cover"
                  key={`${block.content}-${index}`}
                  src={block.content}
                />
              );
            }

            const offset = blockOffsets[index] ?? 0;

            return (
              <HighlightedJapaneseText
                className={
                  index === 0
                    ? "font-japanese text-3xl font-bold leading-[1.6] md:text-4xl"
                    : "font-japanese text-lg leading-10 text-gray-100 md:text-xl"
                }
                jpdbTokens={getJpdbTokensForSlice(
                  study.jpdbTokens,
                  offset,
                  block.content.length
                )}
                key={`${block.content}-${index}`}
                onSelectSegment={study.selectSegment}
                studyMode={study.studyMode}
                subjects={study.subjects}
                text={block.content}
                userLevel={study.userLevel}
              />
            );
          })}
        </div>
      </article>

      <VocabularyTooltip
        match={study.selectedMatch}
        onClose={study.clearSelectedMatch}
        position={study.tooltipPosition}
      />
    </div>
  );
}

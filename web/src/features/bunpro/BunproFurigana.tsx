"use client";

import { createContext, useContext, useMemo, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";

const FuriganaContext = createContext({ hidden: false, questionKey: "" });
type RubyProps = ComponentPropsWithoutRef<"ruby"> & { base: string };

export function BunproFurigana({ hidden, questionKey, children }: { hidden: boolean; questionKey: string; children: ReactNode }) {
  const value = useMemo(() => ({ hidden, questionKey }), [hidden, questionKey]);
  return <FuriganaContext.Provider value={value}>{children}</FuriganaContext.Provider>;
}

export function BunproRuby({ base, children, ...props }: RubyProps) {
  const { hidden, questionKey } = useContext(FuriganaContext);
  return hidden ? <InteractiveRuby key={questionKey} base={base} {...props}>{children}</InteractiveRuby> : <ruby {...props}>{children}</ruby>;
}

function InteractiveRuby({ base, children, ...props }: RubyProps) {
  const [pinned, setPinned] = useState(false);
  return <ruby {...props} role="button" tabIndex={0} aria-label={`Furigana for ${base}`} aria-pressed={pinned} data-bunpro-review-furigana="hidden" data-pinned={pinned}
    onClick={(event) => { event.preventDefault(); event.stopPropagation(); setPinned(value => !value); }}
    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); if (!event.repeat) setPinned(value => !value); } }}>
    {children}
  </ruby>;
}

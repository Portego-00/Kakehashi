"use client";

import { useCallback, useState, type AnimationEventHandler } from "react";

interface FirstSubjectRevealProps {
  "data-first-reveal"?: "";
  onAnimationEnd?: AnimationEventHandler<HTMLElement>;
}

export function useFirstSubjectReveal(): FirstSubjectRevealProps {
  const [revealing, setRevealing] = useState(true);

  const finishReveal = useCallback<AnimationEventHandler<HTMLElement>>((event) => {
    if (event.target === event.currentTarget) setRevealing(false);
  }, []);

  return revealing ? { "data-first-reveal": "", onAnimationEnd: finishReveal } : {};
}

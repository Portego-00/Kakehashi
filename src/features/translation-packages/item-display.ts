import { useLearningDisplay, displaySubject } from "./display";

// Validate the complete subject that produced this summary. A separate catalog
// snapshot can become stale while the screen refreshes in the background.
export function useItemMeaning() {
  const display = useLearningDisplay();
  return (item: {
    id: number;
    type: string;
    meaning: string;
    source?: unknown;
  }) => {
    if (!display.active) return item.meaning;
    const source = displaySubject(item.source);
    return source?.id === item.id && source.object === item.type
      ? display.meaning(source, item.meaning)
      : item.meaning;
  };
}

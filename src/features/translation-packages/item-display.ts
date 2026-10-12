import { useEffect, useState } from "react";
import { getAllSubjects } from "../../utils/cache";
import { useLearningDisplay } from "./display";

// Item summaries omit readings and secondary meanings. Resolve against the
// original cached subject, preserving the package's complete source checks.
export function useItemMeaning() {
  const display = useLearningDisplay();
  const [subjects, setSubjects] = useState<Map<number, any>>(new Map());
  useEffect(() => {
    let active = true;
    getAllSubjects().then(records => {
      if (active) setSubjects(new Map(records.map(subject => [subject.id, subject])));
    });
    return () => { active = false; };
  }, []);
  return (item: {id: number; type: string; meaning: string}) => {
    const source = subjects.get(item.id);
    return source?.object === item.type ? display.meaning(source, item.meaning) : item.meaning;
  };
}

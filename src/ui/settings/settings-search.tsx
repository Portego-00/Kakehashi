import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { Text, type TextProps } from "react-native";

export type SettingsSearchEntry = {
  id: string;
  label: string;
  keywords: string;
  section: { key: string; label: string };
  reveal: () => void;
  measure: (callback: (y: number) => void) => void;
};
type Register = (entry: SettingsSearchEntry) => () => void;
export const SettingsSearchRegistryContext = createContext<Register | null>(
  null,
);
const SettingsSearchSectionContext = createContext<
  SettingsSearchEntry["section"] | null
>(null);
export const SettingsSectionAnchorContext = createContext<
  | ((
      key: string,
      measure: (callback: (y: number) => void) => void,
    ) => () => void)
  | null
>(null);
export function useSettingsSearchSection() {
  return useContext(SettingsSearchSectionContext);
}
const SettingsSearchRevealContext = createContext<readonly (() => void)[]>([]);

export function SettingsSearchSection({
  section,
  children,
}: {
  section: SettingsSearchEntry["section"];
  children: ReactNode;
}) {
  return (
    <SettingsSearchSectionContext.Provider value={section}>
      {children}
    </SettingsSearchSectionContext.Provider>
  );
}
export function SettingsSearchReveal({
  reveal,
  children,
}: {
  reveal: () => void;
  children: ReactNode;
}) {
  const parents = useContext(SettingsSearchRevealContext);
  const chain = useMemo(() => [...parents, reveal], [parents, reveal]);
  return (
    <SettingsSearchRevealContext.Provider value={chain}>
      {children}
    </SettingsSearchRevealContext.Provider>
  );
}
export function useSettingsSearchEntry(
  label: string,
  keywords: string,
  measure: SettingsSearchEntry["measure"],
) {
  const register = useContext(SettingsSearchRegistryContext);
  const section = useContext(SettingsSearchSectionContext);
  const parents = useContext(SettingsSearchRevealContext);
  const id = useId();
  useEffect(() => {
    if (!register || !section || !label.trim()) return;
    return register({
      id,
      label: label.trim(),
      keywords,
      section,
      measure,
      reveal: () => parents.forEach((open) => open()),
    });
  }, [id, label, keywords, register, section, parents, measure]);
}
function textContent(children: ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number")
        return String(child);
      if (React.isValidElement<{ children?: ReactNode }>(child))
        return textContent(child.props.children);
      return "";
    })
    .join("");
}
export function SettingsLabel({ children, ...props }: TextProps) {
  const ref = useRef<Text>(null);
  const measure = useCallback<SettingsSearchEntry["measure"]>(
    (callback) => ref.current?.measureInWindow((_x, y) => callback(y)),
    [],
  );
  useSettingsSearchEntry(textContent(children), "", measure);
  return (
    <Text {...props} ref={ref}>
      {children}
    </Text>
  );
}

export function settingsSearchMatches(
  entries: readonly SettingsSearchEntry[],
  query: string,
) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return entries.filter((entry) => {
    const haystack =
      `${entry.label} ${entry.keywords} ${entry.section.label}`.toLocaleLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

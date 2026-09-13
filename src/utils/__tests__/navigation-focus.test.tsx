import { NavigationContext } from "@react-navigation/native";
import { act, renderHook } from "@testing-library/react-native";
import React from "react";

import { useOptionalScreenIsFocused } from "../navigation-focus";

describe("useOptionalScreenIsFocused", () => {
  it("defaults to focused when rendered outside navigation", () => {
    const { result } = renderHook(() => useOptionalScreenIsFocused());
    expect(result.current).toBe(true);
  });

  it("tracks focus and blur events from the owning navigation screen", () => {
    let focused = true;
    const listeners = {
      focus: new Set<() => void>(),
      blur: new Set<() => void>(),
    };
    const navigation = {
      isFocused: () => focused,
      addListener: (event: "focus" | "blur", listener: () => void) => {
        listeners[event].add(listener);
        return () => listeners[event].delete(listener);
      },
    };
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <NavigationContext.Provider value={navigation as never}>
        {children}
      </NavigationContext.Provider>
    );
    const { result } = renderHook(() => useOptionalScreenIsFocused(), {
      wrapper,
    });

    expect(result.current).toBe(true);

    act(() => {
      focused = false;
      for (const listener of listeners.blur) listener();
    });
    expect(result.current).toBe(false);

    act(() => {
      focused = true;
      for (const listener of listeners.focus) listener();
    });
    expect(result.current).toBe(true);
  });
});

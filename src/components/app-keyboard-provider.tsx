import React, { type PropsWithChildren } from "react";

// Android keeps its existing adjustResize behavior; web needs no native observer.
export function AppKeyboardProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}

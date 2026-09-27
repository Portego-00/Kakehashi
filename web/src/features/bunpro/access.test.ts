import { expect, it } from "vitest";
import { canAccessBunpro } from "./access";
it.each(["Learner", "Portego", "Other", " learner "])("allows signed-in username %s", (username) => {
  expect(canAccessBunpro(username)).toBe(true);
});
it.each([undefined, null, "", "   "])("hides Bunpro without a username (%s)", (username) => {
  expect(canAccessBunpro(username)).toBe(false);
});

import { isPortegoUsername } from "../portegoAccess";

describe("Portego access", () => {
  it("matches the Portego username without case or surrounding whitespace", () => {
    expect(isPortegoUsername(" Portego ")).toBe(true);
    expect(isPortegoUsername("another-user")).toBe(false);
  });
});

import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { DEFAULT_WEB_SETTINGS } from "../settings";
import { BunproReviewPreferences } from "./BunproReviewPreferences";
function Preferences() {
  const [study, setStudy] = useState(DEFAULT_WEB_SETTINGS.study);
  return <BunproReviewPreferences study={study} onChange={(patch) => setStudy({ ...study, ...patch })} />;
}
it("reflects the effective close-answer pause and restores the stored choice when correct-answer pauses are off", async () => {
  render(<Preferences />);
  fireEvent.click(screen.getByText("Prompt & answer behavior", { exact: true }));
  const close = await screen.findByRole("checkbox", { name: "Pause on close answer" });
  expect(close).toBeChecked(); expect(close).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Pause on correct answer" }));
  await waitFor(() => { expect(close).toBeEnabled(); expect(close).not.toBeChecked(); });
  fireEvent.click(close); expect(close).toBeChecked();
});

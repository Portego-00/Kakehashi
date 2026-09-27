import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { CommunityEditor } from "./CommunityEditor";

function Editor() {
  const [value, setValue] = useState("Original draft");
  const [uploading, setUploading] = useState(false);
  return <><CommunityEditor label="Details" value={value} onChange={setValue} onUploadingChange={setUploading} maxLength={6000} placeholder="Reply" /><button disabled={uploading}>Post</button></>;
}
afterEach(() => vi.unstubAllGlobals());

it("uploads an image, keeps edits made during upload and previews the inserted image", async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
  render(<Editor />);
  fireEvent.change(screen.getByLabelText("Attach images to Details"), { target: { files: [new File(["image"], "image.png", { type: "image/png" })] } });
  expect(screen.getByText("Post")).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Draft edited while uploading" } });
  finish(new Response(JSON.stringify({ url: "https://example.com/image.webp" }), { status: 201 }));
  await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("Draft edited while uploading\n\n![Image](https://example.com/image.webp)\n"));
  expect(screen.getByText("Post")).not.toBeDisabled();
  fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
  expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/image.webp");
});

it("preserves the draft when an upload fails and displays an actionable error", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Sign in to upload images." }), { status: 401 })));
  render(<Editor />);
  fireEvent.paste(screen.getByRole("textbox"), { clipboardData: { files: [new File(["image"], "image.png", { type: "image/png" })] } });
  expect(await screen.findByRole("alert")).toHaveTextContent("Sign in to upload images.");
  expect(screen.getByRole("textbox")).toHaveValue("Original draft");
  expect(screen.getByText("Post")).not.toBeDisabled();
});

it("rejects oversized dropped images before sending them", async () => {
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  render(<Editor />);
  fireEvent.drop(screen.getByRole("tabpanel"), { dataTransfer: { files: [new File([new Uint8Array(4_000_001)], "big.png", { type: "image/png" })] } });
  expect(await screen.findByRole("alert")).toHaveTextContent("smaller than 4 MB");
  expect(fetchMock).not.toHaveBeenCalled();
});

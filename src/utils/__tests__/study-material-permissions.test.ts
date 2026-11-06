import { isStudyMaterialPermissionError } from "../../../shared/study-material-permissions";

describe("study material permission errors", () => {
  it.each([401, 403])("recognizes native and web HTTP %s errors", (status) => {
    expect(isStudyMaterialPermissionError(Object.assign(new Error("Unauthorized. Nice try."), { statusCode: status }))).toBe(true);
    expect(isStudyMaterialPermissionError(Object.assign(new Error("Unauthorized. Nice try."), { status }))).toBe(true);
    expect(isStudyMaterialPermissionError(new Error(`API error: ${status}: Unauthorized. Nice try.`))).toBe(true);
  });
  it.each([400, 422, 429, 500, 503])("keeps HTTP %s errors separate from missing permissions", (status) => {
    expect(isStudyMaterialPermissionError({ status, message: "Image URL https://example.com/401.png" })).toBe(false);
    expect(isStudyMaterialPermissionError(new Error(`API error: ${status}`))).toBe(false);
  });
  it.each([null, undefined, "Unauthorized", new Error("Network request failed"), new Error("Image 403.png could not be loaded")])("does not label unrelated failures as permission errors: %s", (error) => {
    expect(isStudyMaterialPermissionError(error)).toBe(false);
  });
});

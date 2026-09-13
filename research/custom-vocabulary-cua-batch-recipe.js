// Preparation only: defining this function never generates or downloads anything.
// Paste this function into the initialized CUA session only after the parent assigns
// an explicit batch. Browser access stays on the documented CUA/Playwright surface.
// Call with the CUA tab wrapper and its documented browser Tab for the SAME tab ID.
// Before calling: hold the shared download lock and snapshot Downloads filenames.
// Afterwards: reconcile every new file against the returned timing records, copy
// only uniquely identified files, preserve originals, then release the lock.

async function generateApprovedVocabularyBatch({
  cuaTab,
  tab,
  entries,
  approvedIds,
  maxInputCharacters,
  voiceName = "Shizuka - Natural & Soft",
}) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 10) {
    throw new Error("An explicitly approved batch must contain 1–10 words.");
  }
  if (!Array.isArray(approvedIds) || JSON.stringify(entries.map((entry) => entry.id)) !== JSON.stringify(approvedIds)) {
    throw new Error("Batch IDs must exactly match the separately approved list.");
  }
  if (!Number.isInteger(maxInputCharacters) || maxInputCharacters < 1) {
    throw new Error("An explicit input-character allowance is required.");
  }
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length ||
      new Set(entries.map((entry) => entry.ttsInput)).size !== entries.length) {
    throw new Error("Duplicate IDs or exact inputs need individual handling, not this loop.");
  }
  const inputCharacters = entries.reduce((count, entry) => {
    if (typeof entry.id !== "string" || !entry.id || typeof entry.ttsInput !== "string" || !entry.ttsInput.trim()) {
      throw new Error("Every entry needs its manifest ID and exact nonempty ttsInput.");
    }
    return count + [...entry.ttsInput].length;
  }, 0);
  if (inputCharacters > maxInputCharacters) throw new Error("Batch exceeds its approved character allowance.");

  const ui = tab.playwright;
  const input = ui.getByRole("textbox", { name: "Main textarea", exact: true });
  const player = ui.getByRole("region", { name: "audio player", exact: true });
  const generate = ui.getByRole("button", { name: "Generate speech ⌘+Enter", exact: true });
  const ready = ui.getByRole("button", { name: "Regenerate speech ⌘+Enter", exact: true });
  const download = player.getByRole("button", { name: "Download Audio", exact: true });
  const records = [];

  async function verifySettings() {
    if (!await ui.getByRole("button", { name: `Select voice - ${voiceName}`, exact: true }).isVisible()) {
      throw new Error("The selected voice changed; stop before spending credits.");
    }
    if (!await ui.getByRole("button", { name: "Select model - Eleven Multilingual v2", exact: true }).isVisible()) {
      throw new Error("The selected model changed; stop before spending credits.");
    }
    if (!(await ui.getByRole("combobox", { name: "Language override", exact: true }).innerText()).includes("Japanese")) {
      throw new Error("Japanese language override is not visibly selected.");
    }
    const speed = Number(await ui.getByRole("slider", { name: "Speed", exact: true }).getAttribute("aria-valuenow"));
    const style = Number(await ui.getByRole("slider", { name: "Style Exaggeration", exact: true }).getAttribute("aria-valuenow"));
    if (!Number.isFinite(speed) || !Number.isFinite(style) || Math.abs(speed - 1) > 0.00001 || style !== 0) {
      throw new Error(`Unexpected visible settings: speed ${speed}, style ${style}.`);
    }
  }

  await cuaTab.getAXState();
  await verifySettings();
  for (const entry of entries) {
    // Avoid accepting an old player result with identical text as a fresh result.
    if (await player.getByText(entry.ttsInput, { exact: true }).isVisible()) {
      throw new Error(`${entry.id}: player already contains this input; handle separately.`);
    }
    await input.fill(entry.ttsInput);
    await cuaTab.getAXState();
    const visibleInput = await input.evaluate((element) => element.value);
    if (visibleInput !== entry.ttsInput) throw new Error(`${entry.id}: input does not match its manifest text.`);
    await verifySettings();
    await generate.waitFor({ state: "visible", timeoutMs: 5000 });
    if (!await generate.isEnabled()) throw new Error(`${entry.id}: generation is not enabled.`);

    const record = { id: entry.id, ttsInput: entry.ttsInput, generationStartedAt: new Date().toISOString() };
    nodeRepl.write({ status: "starting-approved-generation", ...record });
    // Never retry this click automatically after a timeout: it may have succeeded.
    await generate.click();
    await cuaTab.getAXState();
    await player.getByText(entry.ttsInput, { exact: true }).waitFor({ state: "visible", timeoutMs: 30000 });
    await ready.waitFor({ state: "visible", timeoutMs: 30000 });
    if (!await player.getByRole("img", { name: voiceName, exact: true }).isVisible()) {
      throw new Error(`${entry.id}: fresh player voice does not match.`);
    }
    await cuaTab.getAXState();
    record.playerText = await player.innerText();
    if (!await download.isEnabled()) throw new Error(`${entry.id}: download is not enabled.`);
    record.downloadClickedAt = new Date().toISOString();
    await download.click();
    await cuaTab.getAXState();
    // Do not use waitForEvent("download"): this environment can time out although
    // the file is successfully saved to Downloads. Reconcile local files afterwards.
    if (!await player.getByText(entry.ttsInput, { exact: true }).isVisible()) {
      throw new Error(`${entry.id}: player changed while downloading; inspect files manually.`);
    }
    record.downloadClickCompletedAt = new Date().toISOString();
    records.push(record);
    nodeRepl.write({ downloaded: records.length, total: entries.length, ...record });
  }
  return { inputCharacters, generationCount: records.length, regenerationCount: 0, records };
}

// Lock convention (outside CUA, using local filesystem tools):
//   output/custom-vocabulary-audio/elevenlabs-download.lock/
// Acquire atomically with mkdir, not mkdir -p; stop if it already exists.
// Hold it from the before-snapshot until every new file is reconciled/copied.
// Use rmdir only when releasing a lock acquired by the current task. Never remove
// another task's lock, infer a stale lock, move Downloads originals, or use rm -rf.
// Require exactly one new Shizuka MP3 per record, unique timestamp matching, complete
// files (no .crdownload), and matching counts. Ambiguous files are not assigned.

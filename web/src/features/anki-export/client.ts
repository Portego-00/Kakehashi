import { z } from "zod";

const endpoint = "http://127.0.0.1:8765";
const storageKey = "kakehashi:anki-export:v1";
const configSchema = z.object({
  deckName: z.string().min(1),
  modelName: z.string().min(1),
  japaneseField: z.string().min(1),
  englishField: z.string().min(1),
  tags: z.array(z.string()),
}).refine((config) => config.japaneseField !== config.englishField);

export type AnkiExportConfig = z.infer<typeof configSchema>;
export interface AnkiSentence { japanese: string; english: string }

// A user-supplied AnkiConnect key stays in memory for this page session.
let sessionApiKey = "";
export function getAnkiApiKey() { return sessionApiKey; }

export function loadAnkiExportConfig(): AnkiExportConfig | null {
  try {
    const parsed = configSchema.safeParse(JSON.parse(localStorage.getItem(storageKey) ?? "null"));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

export function saveAnkiExportConfig(config: AnkiExportConfig) {
  localStorage.setItem(storageKey, JSON.stringify(configSchema.parse(config)));
}

async function invoke(action: string, params = {}, apiKey = sessionApiKey): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), action === "requestPermission" ? 60_000 : 15_000);
  try {
    // A plain-text JSON body allows requestPermission from an untrusted origin
    // without a JSON content-type preflight. AnkiConnect parses the JSON body.
    const response = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({ action, version: 6, params, ...(apiKey ? { key: apiKey } : {}) }),
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`AnkiConnect returned HTTP ${response.status}.`);
    const envelope = z.object({ result: z.unknown(), error: z.string().nullable() }).parse(await response.json());
    if (envelope.error) throw new Error(envelope.error);
    return envelope.result;
  } catch (error) {
    if (error instanceof TypeError || controller.signal.aborted) {
      throw new Error(action === "addNote"
        ? "The connection ended before Anki confirmed the export. Check your deck before trying again."
        : "Cannot reach Anki. Open desktop Anki with AnkiConnect installed, and allow local network access if your browser asks.");
    }
    throw error;
  } finally { clearTimeout(timeout); }
}

async function ensureAccess(apiKey: string) {
  const result = z.object({ permission: z.enum(["granted", "denied"]), requireApiKey: z.boolean().optional() })
    .parse(await invoke("requestPermission", {}, ""));
  if (result.permission !== "granted") throw new Error("Allow Kakehashi in the Anki permission window, then connect again.");
  if (result.requireApiKey && !apiKey) throw new Error("Enter the API key from your AnkiConnect settings.");
}

export async function connectToAnki(apiKey: string) {
  await ensureAccess(apiKey);
  const [decks, models] = await Promise.all([
    invoke("deckNames", {}, apiKey), invoke("modelNames", {}, apiKey),
  ]);
  const collection = { decks: z.array(z.string()).parse(decks).sort(), models: z.array(z.string()).parse(models).sort() };
  sessionApiKey = apiKey;
  return collection;
}

export async function loadAnkiFields(modelName: string): Promise<string[]> {
  return z.array(z.string()).parse(await invoke("modelFieldNames", { modelName }));
}

export function guessAnkiFields(fields: string[]) {
  const japaneseField = fields.find((field) => /japanese|expression|sentence|front/i.test(field)) ?? fields[0] ?? "";
  const englishField = fields.find((field) => field !== japaneseField && /translation|english|meaning|definition|back/i.test(field))
    ?? fields.find((field) => field !== japaneseField) ?? "";
  return { japaneseField, englishField };
}

function escapeField(value: string) {
  return value.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\r\n?|\n/g, "<br>");
}

export async function exportSentenceToAnki(config: AnkiExportConfig, sentence: AnkiSentence): Promise<number> {
  configSchema.parse(config);
  if (!sentence.japanese.trim() || !sentence.english.trim()) throw new Error("Both the Japanese sentence and English translation are required.");
  await ensureAccess(sessionApiKey);
  const fields = await loadAnkiFields(config.modelName);
  if (!fields.includes(config.japaneseField) || !fields.includes(config.englishField)) {
    throw new Error("The note type fields have changed. Connect again and choose the sentence and translation fields.");
  }
  const values = Object.fromEntries(fields.map((field) => [field, field === config.japaneseField
    ? escapeField(sentence.japanese) : field === config.englishField ? escapeField(sentence.english) : ""]));
  const noteId = await invoke("addNote", { note: {
    deckName: config.deckName, modelName: config.modelName, fields: values, tags: config.tags,
    options: { allowDuplicate: false, duplicateScope: "deck" },
  } });
  if (typeof noteId !== "number" || !Number.isSafeInteger(noteId) || noteId <= 0) throw new Error("Anki did not confirm that the sentence was added. Check your deck before trying again.");
  return noteId;
}

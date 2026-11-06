import AsyncStorage from "@react-native-async-storage/async-storage";
import {createConnection} from "node:net";
import {readFileSync, writeFileSync} from "node:fs";
import {errorService} from "../../services/errorService";
import {createSubjectList, getSubjectLists} from "../subjectLists";
import {createDefaultWordSearchConfig, getWordSearchGridSize} from "../wordSearchConfig";
import {generateWordSearch} from "../wordSearchGenerator";
import {EXTRA_STUDY_SESSION_STORAGE_KEYS, loadExtraStudySessionState, saveExtraStudySessionState} from "../extraStudySessionPersistence";

const mockInsert = jest.fn().mockResolvedValue({error: null});
jest.mock("../../lib/supabase", () => ({supabase: {from: () => ({insert: mockInsert})}}));
jest.mock("../store", () => ({useAuthStore: {getState: () => ({userData: null})}}));
jest.mock("react-native", () => ({Platform: {OS: "android"}}));
jest.mock("expo-constants", () => ({__esModule: true, default: {expoConfig: {version: "1.6.0"}}}));

const port = Number(process.env.ANDROID_STORAGE_PROBE_PORT);
const nativeSuite = port ? describe : describe.skip;

interface NativeReply {
  value?: string | null;
  capacityBytes?: number;
  availableDiskBytes?: number;
  characters?: number;
  writes?: number;
  error?: string;
  lastFailure?: string;
}

function command(request: Record<string, unknown>): Promise<NativeReply> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({host: "127.0.0.1", port});
    let body = "";
    socket.setEncoding("utf8");
    socket.setTimeout(120000, () => socket.destroy(new Error(`Android storage ${request.operation} timed out`)));
    socket.on("error", reject);
    socket.on("connect", () => socket.write(JSON.stringify(request) + "\n"));
    socket.on("data", chunk => {
      body += chunk;
      if (!body.includes("\n")) return;
      socket.end();
      try {
        const result: NativeReply = JSON.parse(body);
        if (result.error) reject(new Error(result.error));
        else resolve(result);
      } catch (error) {reject(error);}
    });
  });
}

nativeSuite("subject-list creation against native Android storage", () => {
  afterEach(() => jest.restoreAllMocks());
  it("saves a first list and a Word Search after cached data reaches the old Android quota", async () => {
    const properties = readFileSync("android/gradle.properties", "utf8");
    const capacityMB = Number(process.env.ANDROID_STORAGE_PROBE_CAPACITY_MB ?? properties.match(/^AsyncStorage_db_size_in_MB\s*=\s*(\d+)/m)?.[1] ?? 6);
    const capacity = await command({operation: "reset", capacityBytes: capacityMB * 1024 * 1024});
    jest.mocked(AsyncStorage.getItem).mockImplementation(async key => (await command({operation: "get", key})).value ?? null);
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {await command({operation: "set", key, value});});
    errorService.setUser({id: "android-list-probe", username: "Android storage regression"});
    jest.spyOn(console, "log").mockImplementation(() => {});

    const first = await createSubjectList("Chungus");
    expect((await getSubjectLists()).map(list => list.id)).toContain(first.id);
    await command({operation: "remove", key: "subject_lists:v1"});
    const cache = await command({operation: "fill"});
    let failure: unknown;
    try {
      const created = await createSubjectList("Chungus");
      expect((await getSubjectLists()).map(list => list.id)).toContain(created.id);
    } catch (error) {
      failure = error;
    }
    let wordSearchFailure: unknown;
    try {
      const config = createDefaultWordSearchConfig(23);
      const key = "word_search_config_android_storage_regression";
      await AsyncStorage.setItem(key, JSON.stringify(config));
      expect(JSON.parse((await AsyncStorage.getItem(key)) ?? "null")).toEqual(config);
      const candidates = [
        ["日本", "にほん"], ["学校", "がっこう"], ["先生", "せんせい"], ["電車", "でんしゃ"],
        ["大学", "だいがく"], ["毎日", "まいにち"], ["金曜日", "きんようび"], ["自転車", "じてんしゃ"],
      ].map(([written, reading], index) => ({subjectId: index + 1, written, reading, meaning: "Fixture vocabulary"}));
      const puzzle = generateWordSearch(candidates, {direction: config.direction, wordCount: config.wordCount, size: getWordSearchGridSize(config.wordCount), seed: 42});
      expect(puzzle.entries.length).toBeGreaterThanOrEqual(3);
      const session = {config, puzzle};
      expect(await saveExtraStudySessionState(EXTRA_STUDY_SESSION_STORAGE_KEYS.WORD_SEARCH, session)).toBe(true);
      expect(await loadExtraStudySessionState(EXTRA_STUDY_SESSION_STORAGE_KEYS.WORD_SEARCH)).toEqual(session);
    } catch (error) {
      wordSearchFailure = error;
    }
    await Promise.resolve();
    await Promise.resolve();
    const result = {capacity, cache, failure: failure instanceof Error ? failure.message : null, wordSearchFailure: wordSearchFailure instanceof Error ? wordSearchFailure.message : null, errors: mockInsert.mock.calls.map(call => call[0])};
    if (process.env.ANDROID_STORAGE_PROBE_RESULT) writeFileSync(process.env.ANDROID_STORAGE_PROBE_RESULT, JSON.stringify(result, null, 2));
    console.info("Android storage result:", JSON.stringify(result));
    if (failure) throw failure;
    if (wordSearchFailure) throw wordSearchFailure;
    expect(mockInsert).not.toHaveBeenCalled();
  }, 180000);
});

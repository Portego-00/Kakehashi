import { searchImmersionKit } from "../immersionKitService";

jest.mock("../myAnimeListService", () => ({}));
jest.mock("../../utils/subjectColors", () => ({}));

const source = "frieren_beyond_journey_s_end";
const mediaBase = "https://immersionkit.s3.bhs.io.cloud.ovh.net/media/anime/Frieren%20Beyond%20Journey's%20End/media/";

afterEach(() => jest.restoreAllMocks());

it("uses the bundled deck during an index outage and retries a transient search failure", async () => {
  const fetchMock = jest.spyOn(global, "fetch")
    .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
    .mockRejectedValueOnce(new TypeError("Network request failed"))
    .mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ examples: [{
        id: "anime_1", title: source, sentence: "十分すぎるか", translation: "There's more than enough.",
        image: "frame.jpg", sound: "clip.mp3",
      }] }),
    } as Response);
  jest.spyOn(console, "warn").mockImplementation(() => {});

  const { results } = await searchImmersionKit("十分", { category: "anime", selectedAnimes: [source] });
  expect(results).toEqual([expect.objectContaining({ imageUrl: `${mediaBase}frame.jpg`, audio: `${mediaBase}clip.mp3` })]);
  const search = new URL(String(fetchMock.mock.calls[2][0]));
  expect(search.searchParams.get("category")).toBe("anime");
  expect(search.searchParams.get("index")).toBe(source);
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

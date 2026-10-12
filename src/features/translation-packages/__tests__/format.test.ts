import { formatTurkishMeaning } from "../format";

it.each([
  ["iyi iş", "İyi İş"], ["ılık ışık", "Ilık Işık"],
  ["çalışma, şafak ve gölet", "Çalışma, Şafak Ve Gölet"],
  ["özel üniversite", "Özel Üniversite"], ["(iç) / dış", "(İç) / Dış"],
])("formats Turkish initials in %s", (value, expected) => {
  expect(formatTurkishMeaning(value)).toBe(expected);
});

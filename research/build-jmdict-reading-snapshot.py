#!/usr/bin/env python3
"""Build the compact JMdict reading-evidence snapshot for custom vocabulary."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree


SOURCE_FILES = (
    "kana-vocabulary-packs.json",
    "custom-vocab-kana-candidates.json",
    "custom-vocab-kana-expansion.json",
    "custom-vocab-kanji-candidates.json",
    "custom-vocab-kanji-expansion.json",
)
EXCLUDED_WORD_FIELDS = {
    "meaningMnemonic",
    "readingMnemonic",
    "readingMap",
    "jmdictPriorityTags",
}
CREATED_PATTERN = re.compile(rb"JMdict created:\s*(\d{4}-\d{2}-\d{2})")


def canonicalize(value: object) -> object:
    if isinstance(value, list):
        return [canonicalize(item) for item in value]
    if isinstance(value, dict):
        return {
            key: canonicalize(value[key])
            for key in sorted(value, key=lambda item: item.encode("utf-16-be"))
        }
    return value


def canonical_json(value: object) -> bytes:
    return json.dumps(
        canonicalize(value),
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def read_sources(data_directory: Path) -> tuple[list[dict], list[dict], list[dict]]:
    packs: list[dict] = []
    source_records: list[dict] = []
    for filename in SOURCE_FILES:
        path = data_directory / filename
        payload = json.loads(path.read_text(encoding="utf-8"))
        file_packs = payload if isinstance(payload, list) else payload["packs"]
        packs.extend(file_packs)
        source_records.append(
            {
                "path": f"research/data/{filename}",
                "packCount": len(file_packs),
                "wordCount": sum(len(pack["words"]) for pack in file_packs),
            }
        )

    words = [word for pack in packs for word in pack["words"]]
    return packs, words, source_records


def read_wanikani_vocabulary_snapshot(path: Path) -> tuple[dict, list[dict]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    subjects = payload.get("subjects") if isinstance(payload, dict) else None
    if (
        not isinstance(subjects, list)
        or len(subjects) < 6_000
        or payload.get("totalCount") != len(subjects)
    ):
        raise ValueError("WaniKani vocabulary snapshot is incomplete")
    for index, subject in enumerate(subjects):
        if not isinstance(subject, dict):
            raise ValueError(f"WaniKani vocabulary subject {index} is invalid")
        if not isinstance(subject.get("id"), int) or subject["id"] < 1:
            raise ValueError(f"WaniKani vocabulary subject {index} has an invalid ID")
        if not isinstance(subject.get("characters"), str) or not subject["characters"]:
            raise ValueError(f"WaniKani vocabulary subject {subject['id']} has no written form")
        if (
            not isinstance(subject.get("readings"), list)
            or not subject["readings"]
            or any(not isinstance(reading, str) or not reading for reading in subject["readings"])
        ):
            raise ValueError(f"WaniKani vocabulary subject {subject['id']} has invalid readings")
        if (
            not isinstance(subject.get("meanings"), list)
            or not subject["meanings"]
            or any(not isinstance(meaning, str) or not meaning for meaning in subject["meanings"])
        ):
            raise ValueError(f"WaniKani vocabulary subject {subject['id']} has invalid accepted meanings")
    return payload, subjects


def non_mnemonic_payload(word: dict) -> dict:
    return {key: value for key, value in word.items() if key not in EXCLUDED_WORD_FIELDS}


def pack_metadata_payload(packs: list[dict]) -> list[dict]:
    return [
        {
            "id": pack["id"],
            "title": pack["title"],
            "description": pack["description"],
            "script": pack["script"],
            "levelRange": pack.get("levelRange"),
            "wordIds": [word["id"] for word in pack["words"]],
        }
        for pack in packs
    ]


def child_texts(element: ElementTree.Element, name: str) -> list[str]:
    return [child.text or "" for child in element.findall(name)]


def parse_jmdict(path: Path, wanted_readings: set[str]) -> dict[str, list[dict]]:
    by_reading: dict[str, list[dict]] = defaultdict(list)
    with gzip.open(path, "rb") as source:
        for _, element in ElementTree.iterparse(source, events=("end",)):
            if element.tag != "entry":
                continue

            readings = []
            for reading_element in element.findall("r_ele"):
                reading = reading_element.findtext("reb") or ""
                if reading not in wanted_readings:
                    continue
                readings.append(
                    {
                        "reading": reading,
                        "noKanji": reading_element.find("re_nokanji") is not None,
                        "restrictions": child_texts(reading_element, "re_restr"),
                    }
                )
            if not readings:
                element.clear()
                continue

            senses = []
            for sense_index, sense in enumerate(element.findall("sense"), start=1):
                glosses = [
                    gloss.text or ""
                    for gloss in sense.findall("gloss")
                    if gloss.attrib.get("{http://www.w3.org/XML/1998/namespace}lang", "eng") == "eng"
                ]
                senses.append(
                    {
                        "index": sense_index,
                        "writtenRestrictions": child_texts(sense, "stagk"),
                        "readingRestrictions": child_texts(sense, "stagr"),
                        "glosses": glosses,
                    }
                )

            entry = {
                "entSeq": int(element.findtext("ent_seq") or "0"),
                "writtenForms": child_texts(element, "k_ele/keb"),
                "readings": readings,
                "senses": senses,
            }
            for reading in readings:
                by_reading[reading["reading"]].append(entry)
            element.clear()
    return by_reading


def applicable_senses(entry: dict, characters: str, reading: str, kana_form: bool) -> list[dict]:
    applicable = []
    for sense in entry["senses"]:
        if sense["readingRestrictions"] and reading not in sense["readingRestrictions"]:
            continue
        if kana_form:
            if sense["writtenRestrictions"]:
                continue
        elif sense["writtenRestrictions"] and characters not in sense["writtenRestrictions"]:
            continue
        applicable.append(sense)
    return applicable


def candidate_matches(entries: list[dict], characters: str, reading: str) -> list[dict]:
    matches = []
    kana_form = characters == reading
    for entry in entries:
        for reading_element in entry["readings"]:
            if reading_element["reading"] != reading:
                continue
            if kana_form:
                pair_allowed = True
            else:
                pair_allowed = (
                    characters in entry["writtenForms"]
                    and not reading_element["noKanji"]
                    and (
                        not reading_element["restrictions"]
                        or characters in reading_element["restrictions"]
                    )
                )
            if not pair_allowed:
                continue
            senses = applicable_senses(entry, characters, reading, kana_form)
            if not senses:
                continue
            matches.append(
                {
                    "entSeq": entry["entSeq"],
                    "writtenForms": entry["writtenForms"],
                    "readingElement": reading_element,
                    "senses": senses,
                }
            )
    return matches


def normalize_english(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def meaning_score(word: dict, match: dict) -> int:
    requested = [normalize_english(meaning) for meaning in word.get("meanings", [])]
    glosses = [normalize_english(gloss) for sense in match["senses"] for gloss in sense["glosses"]]
    score = 0
    for meaning in requested:
        meaning_tokens = set(meaning.split())
        for gloss in glosses:
            gloss_tokens = set(gloss.split())
            if meaning == gloss:
                score = max(score, 100)
            elif meaning and (meaning in gloss or gloss in meaning):
                score = max(score, 80)
            elif meaning_tokens and meaning_tokens <= gloss_tokens:
                score = max(score, 60)
            elif meaning_tokens & gloss_tokens:
                score = max(score, 20)
    return score


def form_specificity_score(word: dict, match: dict) -> int:
    if word["characters"] != word["reading"]:
        return 0
    if not match["writtenForms"]:
        return 200
    if match["readingElement"]["noKanji"]:
        return 100
    return 0


def resolve_match(word: dict, matches: list[dict]) -> tuple[dict | None, list[dict], str | None]:
    if not matches:
        return None, [], None
    scored = [
        {
            "match": match,
            "formSpecificityScore": form_specificity_score(word, match),
            "meaningScore": meaning_score(word, match),
        }
        for match in matches
    ]
    scored.sort(
        key=lambda item: (
            -item["meaningScore"],
            -item["formSpecificityScore"],
            item["match"]["entSeq"],
        )
    )
    if len(scored) == 1:
        return scored[0]["match"], scored, "sole-applicable-entry"
    if scored[0]["meaningScore"] > scored[1]["meaningScore"]:
        return scored[0]["match"], scored, "unique-meaning-match"
    if scored[0]["formSpecificityScore"] > scored[1]["formSpecificityScore"]:
        return scored[0]["match"], scored, "prefer-kana-only-entry"
    return None, scored, None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--jmdict", required=True, type=Path)
    parser.add_argument("--data-directory", type=Path, default=Path("research/data"))
    parser.add_argument("--wanikani-vocabulary-snapshot", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--server-last-modified", required=True)
    parser.add_argument("--fetched-at", required=True)
    parser.add_argument("--diagnose", action="store_true")
    args = parser.parse_args()

    packs, words, source_records = read_sources(args.data_directory)
    wanikani_snapshot_path = (
        args.wanikani_vocabulary_snapshot
        or args.data_directory / "wanikani-vocabulary-exclusions.snapshot.json"
    )
    wanikani_snapshot, wanikani_subjects = read_wanikani_vocabulary_snapshot(
        wanikani_snapshot_path
    )
    ids = [word["id"] for word in words]
    if len(words) < 500 or len(set(ids)) != len(words):
        raise ValueError(f"expected at least 500 unique words, got {len(words)} words and {len(set(ids))} IDs")

    archive_bytes = args.jmdict.read_bytes()
    with gzip.open(args.jmdict, "rb") as source:
        header = source.read(100_000)
    created_match = CREATED_PATTERN.search(header)
    if not created_match:
        raise ValueError("JMdict creation date was not found in the XML header")
    created_date = created_match.group(1).decode("ascii")

    wanted_readings = {word["reading"] for word in words}
    wanted_readings.update(
        reading
        for subject in wanikani_subjects
        for reading in subject["readings"]
    )
    entries_by_reading = parse_jmdict(args.jmdict, wanted_readings)
    results = []
    problems = []
    multiple_candidate_words = 0
    multiple_candidate_diagnostics = []
    explicit_re_restr_words = 0
    re_nokanji_kana_words = 0
    applicable_stagk_words = 0
    applicable_stagr_words = 0
    for word in words:
        matches = candidate_matches(entries_by_reading.get(word["reading"], []), word["characters"], word["reading"])
        resolved, scored, resolution_method = resolve_match(word, matches)
        if len(matches) > 1:
            multiple_candidate_words += 1
            multiple_candidate_diagnostics.append(
                {
                    "id": word["id"],
                    "characters": word["characters"],
                    "reading": word["reading"],
                    "meanings": word.get("meanings", []),
                    "chosenEntSeq": resolved["entSeq"] if resolved else None,
                    "resolutionMethod": resolution_method,
                    "candidates": [
                        {
                            "entSeq": item["match"]["entSeq"],
                            "formSpecificityScore": item["formSpecificityScore"],
                            "meaningScore": item["meaningScore"],
                            "writtenForms": item["match"]["writtenForms"],
                            "glosses": [gloss for sense in item["match"]["senses"] for gloss in sense["glosses"]],
                        }
                        for item in scored
                    ],
                }
            )
        if not resolved:
            problems.append(
                {
                    "id": word["id"],
                    "characters": word["characters"],
                    "reading": word["reading"],
                    "meanings": word.get("meanings", []),
                    "candidates": [
                        {
                            "entSeq": item["match"]["entSeq"],
                            "formSpecificityScore": item["formSpecificityScore"],
                            "meaningScore": item["meaningScore"],
                            "writtenForms": item["match"]["writtenForms"],
                            "glosses": [gloss for sense in item["match"]["senses"] for gloss in sense["glosses"]],
                        }
                        for item in scored
                    ],
                }
            )
            continue

        reading_element = resolved["readingElement"]
        kana_form = word["characters"] == word["reading"]
        if reading_element["restrictions"]:
            explicit_re_restr_words += 1
        if kana_form and reading_element["noKanji"]:
            re_nokanji_kana_words += 1
        if any(sense["writtenRestrictions"] for sense in resolved["senses"]):
            applicable_stagk_words += 1
        if any(sense["readingRestrictions"] for sense in resolved["senses"]):
            applicable_stagr_words += 1
        result = {
                "id": word["id"],
                "characters": word["characters"],
                "reading": word["reading"],
                "jmdictEntSeq": resolved["entSeq"],
                "matchMode": "kana-reading-form" if kana_form else "written-reading-pair",
                "readingElementFound": True,
                "writtenFormVerified": kana_form or word["characters"] in resolved["writtenForms"],
                "readingPairVerified": True,
                "reRestrVerified": (
                    kana_form
                    or not reading_element["restrictions"]
                    or word["characters"] in reading_element["restrictions"]
                ),
                "reNokanjiVerified": kana_form or not reading_element["noKanji"],
                "stagkVerified": True,
                "stagrVerified": True,
                "applicableSenseVerified": bool(resolved["senses"]),
                "applicableSenseIndexes": [sense["index"] for sense in resolved["senses"]],
                "nonMnemonicSha256": sha256_bytes(canonical_json(non_mnemonic_payload(word))),
            }
        if len(matches) > 1:
            result["candidateEntSeqs"] = sorted(match["entSeq"] for match in matches)
            result["resolutionMethod"] = resolution_method
        results.append(result)

    if problems:
        json.dump(problems, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
        return 2

    custom_by_ent_seq: dict[int, list[dict]] = defaultdict(list)
    for result in results:
        custom_by_ent_seq[result["jmdictEntSeq"]].append(result)

    wanikani_pair_count = 0
    wanikani_resolved_pair_count = 0
    wanikani_unmatched_pair_count = 0
    wanikani_ambiguous_pair_count = 0
    same_entry_collisions: list[dict] = []
    ambiguous_potential_collisions: list[dict] = []
    for subject in wanikani_subjects:
        for reading in subject["readings"]:
            wanikani_pair_count += 1
            wanikani_word = {
                "characters": subject["characters"],
                "reading": reading,
                "meanings": subject["meanings"],
            }
            matches = candidate_matches(
                entries_by_reading.get(reading, []),
                subject["characters"],
                reading,
            )
            if not matches:
                wanikani_unmatched_pair_count += 1
                continue
            resolved, scored, resolution_method = resolve_match(wanikani_word, matches)
            if resolved:
                wanikani_resolved_pair_count += 1
                for custom in custom_by_ent_seq.get(resolved["entSeq"], []):
                    same_entry_collisions.append(
                        {
                            "customId": custom["id"],
                            "customCharacters": custom["characters"],
                            "customReading": custom["reading"],
                            "wanikaniSubjectId": subject["id"],
                            "wanikaniCharacters": subject["characters"],
                            "wanikaniReading": reading,
                            "jmdictEntSeq": resolved["entSeq"],
                            "wanikaniResolutionMethod": resolution_method,
                        }
                    )
                continue

            wanikani_ambiguous_pair_count += 1
            shared_ent_seqs = sorted(
                {
                    item["match"]["entSeq"]
                    for item in scored
                    if item["match"]["entSeq"] in custom_by_ent_seq
                }
            )
            for ent_seq in shared_ent_seqs:
                ambiguous_potential_collisions.append(
                    {
                        "custom": [
                            {
                                "id": custom["id"],
                                "characters": custom["characters"],
                                "reading": custom["reading"],
                            }
                            for custom in custom_by_ent_seq[ent_seq]
                        ],
                        "wanikaniSubjectId": subject["id"],
                        "wanikaniCharacters": subject["characters"],
                        "wanikaniReading": reading,
                        "jmdictEntSeq": ent_seq,
                        "candidateScores": [
                            {
                                "jmdictEntSeq": item["match"]["entSeq"],
                                "meaningScore": item["meaningScore"],
                                "formSpecificityScore": item["formSpecificityScore"],
                            }
                            for item in scored
                        ],
                    }
                )

    if same_entry_collisions or ambiguous_potential_collisions:
        json.dump(
            {
                "wanikaniSameEntryCollisions": same_entry_collisions,
                "wanikaniAmbiguousPotentialCollisions": ambiguous_potential_collisions,
            },
            sys.stdout,
            ensure_ascii=False,
            indent=2,
        )
        sys.stdout.write("\n")
        return 3

    wanikani_evidence = {
        "snapshotPath": wanikani_snapshot_path.as_posix(),
        "snapshotSha256": sha256_bytes(wanikani_snapshot_path.read_bytes()),
        "dataUpdatedAt": wanikani_snapshot.get("dataUpdatedAt"),
        "subjectCount": len(wanikani_subjects),
        "readingPairCount": wanikani_pair_count,
        "resolvedReadingPairCount": wanikani_resolved_pair_count,
        "unmatchedReadingPairCount": wanikani_unmatched_pair_count,
        "ambiguousReadingPairCount": wanikani_ambiguous_pair_count,
        "sameEntryCollisionCount": 0,
        "ambiguousPotentialCollisionCount": 0,
    }

    snapshot = {
        "schemaVersion": 2,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "source": {
            "name": "JMdict English XML distribution",
            "url": args.source_url,
            "distributionIndexUrl": "https://www.edrdg.org/pub/Nihongo/00INDEX.html",
            "dtdDocumentationUrl": "https://www.edrdg.org/jmdict/jmdict_dtd_h.html",
            "fetchedAt": args.fetched_at,
            "serverLastModified": args.server_last_modified,
            "jmdictCreatedDate": created_date,
            "compressedBytes": len(archive_bytes),
            "compressedSha256": sha256_bytes(archive_bytes),
        },
        "catalog": {
            "sourceFiles": source_records,
            "sourceFileOrder": [f"research/data/{filename}" for filename in SOURCE_FILES],
            "packCount": len(packs),
            "wordCount": len(words),
            "packMetadataSha256": sha256_bytes(canonical_json(pack_metadata_payload(packs))),
        },
        "hashAlgorithm": {
            "name": "SHA-256",
            "encoding": "UTF-8",
            "serialization": "Recursively canonicalize every object using Object.keys(value).sort() insertion order, recursively canonicalize values, retain array order, then UTF-8 encode JSON.stringify(canonicalValue) with no trailing newline",
            "canonicalizationPseudocode": "canonicalize(v) = Array.isArray(v) ? v.map(canonicalize) : isPlainObject(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonicalize(v[k])])) : v",
            "nonMnemonicSha256": {
                "input": "The complete source word object with meaningMnemonic, readingMnemonic, readingMap, and jmdictPriorityTags omitted; no other field is omitted",
                "includedTopLevelFields": ["characters", "contextSentences", "id", "kanjiLevels", "meanings", "partsOfSpeech", "reading", "requiredLevel"],
                "optionalFieldRule": "Only fields present in the source object are included; absent optional fields are not converted to null",
                "serializedFieldOrder": "lexicographic at every object depth, as defined by canonicalizationPseudocode",
            },
            "packMetadataSha256": {
                "input": "An array in source-file/pack order; each pack object contains id, title, description, script, levelRange (null when absent), and wordIds in source word order",
                "packObjectFields": ["id", "title", "description", "script", "levelRange", "wordIds"],
                "levelRangeFields": ["min", "max"],
                "objectFieldOrder": "lexicographic during serialization; the field lists above define the included data, not serialized key order",
            },
        },
        "verification": {
            "expectedWordCount": len(words),
            "resolvedWordCount": len(results),
            "unresolvedWordCount": 0,
            "ambiguousWordCount": 0,
            "multipleCandidateWordCount": multiple_candidate_words,
            "uniqueIdCount": len(set(ids)),
            "matchCounts": {
                "kanaReadingForm": sum(result["matchMode"] == "kana-reading-form" for result in results),
                "writtenReadingPair": sum(result["matchMode"] == "written-reading-pair" for result in results),
                "chosenReadingWithReRestr": explicit_re_restr_words,
                "chosenKanaReadingWithReNokanji": re_nokanji_kana_words,
                "chosenEntryWithApplicableStagk": applicable_stagk_words,
                "chosenEntryWithApplicableStagr": applicable_stagr_words,
            },
            "rules": {
                "kanaReadingForm": "characters equals reading and an exact reb exists; an applicable sense must have no incompatible stagk and either no stagr or a matching stagr",
                "writtenReadingPair": "characters exactly matches keb; reading exactly matches reb; re_nokanji must be absent; re_restr must be absent or include the keb",
                "senseApplicability": "At least one sense must have no stagk/stagr restrictions or explicitly permit the exact keb/reb; applicable sense indexes are recorded without gloss text",
                "ambiguity": "Multiple applicable entries are first resolved only when normalized English meanings uniquely score one entry above all others; if meanings tie for a kana surface form, a kana-only entry is preferred over a reading attached only to kanji; unresolved ties fail generation",
            },
        },
        "wanikaniVocabularyExclusion": wanikani_evidence,
        "entries": results,
    }

    if args.diagnose:
        print(json.dumps({"packCount": len(packs), "wordCount": len(words), "resolved": len(results), "multipleCandidates": multiple_candidate_diagnostics, "wanikaniVocabularyExclusion": wanikani_evidence}, ensure_ascii=False, indent=2))
        return 0
    if not args.output:
        raise ValueError("--output is required unless --diagnose is used")
    args.output.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(results)} entries to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

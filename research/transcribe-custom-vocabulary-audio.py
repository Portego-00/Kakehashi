"""Local Japanese ASR screening; outputs JSONL and never supplies target words as prompts.

Run in an isolated environment containing mlx-whisper and ffmpeg. See the dated
QA report for model revision, package versions, limitations and setup commands.
"""

import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import time

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
import mlx_whisper
import mlx.core as mx

parser = argparse.ArgumentParser()
parser.add_argument("audio", nargs="+")
parser.add_argument("--model", required=True, help="Local directory containing config.json and weights.npz; network downloads are disabled")
args = parser.parse_args()
if not all((Path(args.model) / filename).is_file() for filename in ["config.json", "weights.npz"]):
    parser.error("--model must be an existing local MLX Whisper model directory")
print(json.dumps({"environment": {name: importlib.metadata.version(name) for name in ["mlx-whisper", "mlx", "mlx-metal", "numpy", "torch", "numba", "scipy", "huggingface_hub"]}, "metalAvailable": mx.metal.is_available(), "model": args.model}), flush=True)
for audio in args.audio:
    started = time.perf_counter()
    result = mlx_whisper.transcribe(audio, path_or_hf_repo=args.model, verbose=None, language="ja", task="transcribe", temperature=0.0, condition_on_previous_text=False, initial_prompt=None, word_timestamps=True)
    probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration,size", "-of", "json", audio]))
    with open(audio, "rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    segments = [{key: segment.get(key) for key in ["id", "start", "end", "text", "avg_logprob", "no_speech_prob", "words"]} for segment in result["segments"]]
    print(json.dumps({"audio": audio, "sha256": digest, "durationSeconds": float(probe["format"]["duration"]), "bytes": int(probe["format"]["size"]), "transcriptionSeconds": round(time.perf_counter() - started, 3), "language": result["language"], "text": result["text"], "segments": segments}, ensure_ascii=False), flush=True)

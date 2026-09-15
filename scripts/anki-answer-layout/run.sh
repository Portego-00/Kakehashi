#!/bin/sh
set -eu
task_script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
task_repo_root=$(CDPATH= cd -- "$task_script_dir/../.." && pwd)
task_build_dir=$(mktemp -d "${TMPDIR:-/tmp}/kakehashi-anki-layout.XXXXXX")
trap 'rm -rf "$task_build_dir"' EXIT HUP INT TERM

node "$task_script_dir/generate.cjs" "$task_repo_root" "$task_build_dir"
if ! cmake -S "$task_script_dir" -B "$task_build_dir" \
  -DKAKEHASHI_REPO_ROOT="$task_repo_root" -DCMAKE_BUILD_TYPE=Release \
  > "$task_build_dir/configure.log" 2>&1; then
  cat "$task_build_dir/configure.log"
  exit 2
fi
if ! cmake --build "$task_build_dir" --parallel 6 > "$task_build_dir/build.log" 2>&1; then
  cat "$task_build_dir/build.log"
  exit 2
fi
"$task_build_dir/anki-layout"
